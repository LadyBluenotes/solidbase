import { readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import type {
	ExternalVersionEntry,
	SolidBaseResolvedConfig,
	VersionedEntry,
} from "../index.js";

type Route = {
	path: string;
	[key: string]: unknown;
};

type RouterLike = EventTarget & {
	config: {
		dir: string;
		extensions: string[];
		dataOnly?: boolean;
	};
	toRoute(src: string): Route | undefined;
	getRoutes(): Promise<Route[]>;
	addRoute(path: string): void;
	updateRoute(path: string): void;
	removeRoute(path: string): void;
	__solidbaseVersionedRoutesPatched__?: boolean;
};

type InternalVersionEntry<ThemeConfig> = VersionedEntry<ThemeConfig> & {
	absDir: string;
};

const ROUTER_NAMES = ["client", "ssr"] as const;

export function patchVersionedRouters(
	solidBaseConfig: SolidBaseResolvedConfig<any>,
	root: string,
	isBuild: boolean,
) {
	const versions = getIncludedVersionEntries(solidBaseConfig, root, isBuild);
	if (versions.length === 0) return;

	const routers = (globalThis as { ROUTERS?: Record<string, RouterLike> })
		.ROUTERS;
	if (!routers) return;

	for (const name of ROUTER_NAMES) {
		const router = routers[name];
		if (!router || router.__solidbaseVersionedRoutesPatched__) continue;
		patchVersionedRouter(router, versions);
	}
}

export function patchVersionedRouter(
	router: RouterLike,
	versions: InternalVersionEntry<any>[],
) {
	if (versions.length === 0 || router.__solidbaseVersionedRoutesPatched__)
		return;

	router.__solidbaseVersionedRoutesPatched__ = true;

	const originalGetRoutes = router.getRoutes.bind(router);
	const originalAddRoute = router.addRoute.bind(router);
	const originalUpdateRoute = router.updateRoute.bind(router);
	const originalRemoveRoute = router.removeRoute.bind(router);
	const originalToRoute = router.toRoute.bind(router);

	router.getRoutes = async () => {
		const [baseRoutes, versionedRoutes] = await Promise.all([
			originalGetRoutes(),
			getVersionedRoutes(router, versions, originalToRoute),
		]);

		assertNoRouteCollisions([...baseRoutes, ...versionedRoutes]);
		return [...baseRoutes, ...versionedRoutes];
	};

	router.addRoute = (path) => {
		if (isVersionedRouteFile(path, versions, router.config.extensions)) {
			router.dispatchEvent(new Event("reload"));
			return;
		}

		originalAddRoute(path);
	};

	router.updateRoute = (path) => {
		if (isVersionedRouteFile(path, versions, router.config.extensions)) {
			router.dispatchEvent(new Event("reload"));
			return;
		}

		originalUpdateRoute(path);
	};

	router.removeRoute = (path) => {
		if (isVersionedRouteFile(path, versions, router.config.extensions)) {
			router.dispatchEvent(new Event("reload"));
			return;
		}

		originalRemoveRoute(path);
	};
}

export function getIncludedVersionEntries(
	solidBaseConfig: SolidBaseResolvedConfig<any>,
	root: string,
	isBuild: boolean,
): InternalVersionEntry<any>[] {
	const configuredBuilds = isBuild
		? new Set(solidBaseConfig.versions?.build)
		: null;

	return (solidBaseConfig.versions?.all ?? [])
		.filter(isVersionedEntry)
		.filter((entry) => !configuredBuilds || configuredBuilds.has(entry.path))
		.map((entry) => ({
			...entry,
			absDir: resolve(root, entry.dir),
		}));
}

export function prefixVersionedRoutePath(
	versionPath: string,
	routePath: string,
) {
	const normalizedVersionPath = normalizeSegment(versionPath);
	if (routePath === "/") return `/${normalizedVersionPath}`;
	return `/${normalizedVersionPath}${routePath}`;
}

function isVersionedEntry(
	entry: VersionedEntry<any> | ExternalVersionEntry,
): entry is VersionedEntry<any> {
	return "path" in entry && "dir" in entry;
}

function normalizeSegment(value: string) {
	return value.replace(/^\/+|\/+$/g, "");
}

function isVersionedRouteFile(
	filePath: string,
	versions: InternalVersionEntry<any>[],
	extensions: string[],
) {
	const resolvedPath = resolve(filePath);
	return (
		matchesSupportedExtension(resolvedPath, extensions) &&
		versions.some((version) => isWithinDir(resolvedPath, version.absDir))
	);
}

async function getVersionedRoutes(
	router: RouterLike,
	versions: InternalVersionEntry<any>[],
	toRoute: (src: string) => Route | undefined,
) {
	const routes: Route[] = [];

	for (const version of versions) {
		const files = await collectRouteFiles(
			version.absDir,
			router.config.extensions,
		);
		for (const file of files) {
			const route = withRouteDir(router, version.absDir, () => toRoute(file));
			if (!route) continue;

			routes.push({
				...route,
				path: prefixVersionedRoutePath(version.path, route.path),
			});
		}
	}

	return routes;
}

async function collectRouteFiles(dir: string, extensions: string[]) {
	const files: string[] = [];

	try {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const filePath = resolve(dir, entry.name);
			if (entry.isDirectory()) {
				files.push(...(await collectRouteFiles(filePath, extensions)));
				continue;
			}

			if (matchesSupportedExtension(filePath, extensions)) files.push(filePath);
		}
	} catch (error) {
		if (isMissingDirectoryError(error)) return files;
		throw error;
	}

	return files.sort((a, b) => a.localeCompare(b));
}

function withRouteDir<T>(router: RouterLike, dir: string, fn: () => T) {
	const previousDir = router.config.dir;
	router.config.dir = dir;

	try {
		return fn();
	} finally {
		router.config.dir = previousDir;
	}
}

function matchesSupportedExtension(filePath: string, extensions: string[]) {
	return extensions.some((extension) => filePath.endsWith(`.${extension}`));
}

function isWithinDir(filePath: string, dir: string) {
	const relativePath = relative(dir, filePath);
	return (
		relativePath === "" ||
		(!relativePath.startsWith("..") && !relativePath.includes(`..${sep}`))
	);
}

function assertNoRouteCollisions(routes: Route[]) {
	const seen = new Map<string, string>();

	for (const route of routes) {
		const source = getRouteSource(route);
		const previous = seen.get(route.path);
		if (previous) {
			throw new Error(
				`Duplicate route path '${route.path}' generated from '${previous}' and '${source}'.`,
			);
		}

		seen.set(route.path, source);
	}
}

function getRouteSource(route: Route) {
	const routeRecord = route as Record<string, any>;
	return (
		routeRecord.$component?.src ?? routeRecord.$$route?.src ?? routeRecord.path
	);
}

function isMissingDirectoryError(
	error: unknown,
): error is NodeJS.ErrnoException {
	return (
		!!error &&
		typeof error === "object" &&
		"code" in error &&
		error.code === "ENOENT"
	);
}
