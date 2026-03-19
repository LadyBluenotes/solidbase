import { solidBaseConfig } from "virtual:solidbase/config";
import { createContextProvider } from "@solid-primitives/context";
import { useLocation, useMatch, useNavigate } from "@solidjs/router";
import { createMemo, startTransition } from "solid-js";
import { getRequestEvent, isServer } from "solid-js/web";

import type {
	ExternalVersionEntry,
	LocaleConfig,
	VersionedEntry,
} from "../config/index.js";

export const DEFAULT_LANG_CODE = "en-US";
export const DEFAULT_LANG_LABEL = "English";
export const DEFAULT_VERSION_LABEL = "Latest";

export interface ResolvedLocale<ThemeConfig> {
	code: string;
	isRoot?: boolean;
	config: LocaleConfig<ThemeConfig>;
}

export interface LatestVersionEntry {
	label: string;
	isLatest: true;
}

export interface ResolvedVersion<ThemeConfig> {
	label: string;
	path: string;
	dir: string;
	themeConfig?: Partial<ThemeConfig>;
	locales?: Record<string, LocaleConfig<ThemeConfig>>;
	isLatest?: false;
}

export type VersionOption<ThemeConfig> =
	| LatestVersionEntry
	| ResolvedVersion<ThemeConfig>;

const latestVersion: LatestVersionEntry = {
	label: solidBaseConfig.versions?.current ?? DEFAULT_VERSION_LABEL,
	isLatest: true,
};

const versionEntries = (solidBaseConfig.versions?.all ?? []).filter(
	isVersionedEntry,
);

const versions = [latestVersion, ...versionEntries];

function isVersionedEntry<ThemeConfig>(
	entry: VersionedEntry<ThemeConfig> | ExternalVersionEntry,
): entry is ResolvedVersion<ThemeConfig> {
	return "path" in entry && "dir" in entry;
}

function normalizePath(path: string): `/${string}` {
	let normalized = path.trim() || "/";
	if (!normalized.startsWith("/")) normalized = `/${normalized}`;
	normalized = normalized.replace(/\/{2,}/g, "/");
	if (normalized.length > 1 && normalized.endsWith("/")) {
		normalized = normalized.slice(0, -1);
	}
	return normalized as `/${string}`;
}

function normalizePrefix(path: string): `/${string}` {
	const normalized = normalizePath(path);
	if (normalized === "/") return normalized;
	return `${normalized}/` as `/${string}`;
}

function matchesPrefix(path: string, prefix: string) {
	const normalizedPath = normalizePath(path);
	const normalizedPrefix = normalizePrefix(prefix);
	if (normalizedPrefix === "/") return true;
	return (
		normalizedPath === normalizedPrefix.slice(0, -1) ||
		normalizedPath.startsWith(normalizedPrefix)
	);
}

function stripPrefix(path: string, prefix: string): `/${string}` {
	const normalizedPath = normalizePath(path);
	const normalizedPrefix = normalizePrefix(prefix);
	if (normalizedPrefix === "/") return normalizedPath;
	if (normalizedPath === normalizedPrefix.slice(0, -1)) return "/";
	if (!normalizedPath.startsWith(normalizedPrefix)) return normalizedPath;
	return normalizePath(normalizedPath.slice(normalizedPrefix.length));
}

function joinPath(...parts: string[]): `/${string}` {
	const normalizedParts = parts
		.map((part) => normalizePath(part))
		.filter((part) => part !== "/");

	if (normalizedParts.length === 0) return "/";

	return normalizePath(normalizedParts.join("/"));
}

function getRootLocale<ThemeConfig>(
	locales: Array<ResolvedLocale<ThemeConfig>>,
) {
	return locales.find((locale) => locale.isRoot) ?? locales[0]!;
}

function getLocalesForVersion<ThemeConfig>(
	version: VersionOption<ThemeConfig> = latestVersion,
) {
	const versionLocales = version.isLatest ? undefined : version.locales;
	const localeConfig = {
		...(solidBaseConfig.locales ?? {}),
		...(versionLocales ?? {}),
	};

	let rootHandled = false;
	const locales = Object.entries(localeConfig).map(([locale, config]) => {
		if (locale === "root") {
			rootHandled = true;
			return {
				code: config.lang ?? solidBaseConfig.lang ?? DEFAULT_LANG_CODE,
				config,
				isRoot: true,
			} satisfies ResolvedLocale<ThemeConfig>;
		}

		return { code: locale, config } satisfies ResolvedLocale<ThemeConfig>;
	});

	if (!rootHandled) {
		locales.unshift({
			code: solidBaseConfig.lang ?? DEFAULT_LANG_CODE,
			isRoot: true,
			config: {
				label: DEFAULT_LANG_LABEL,
			},
		});
	}

	return locales;
}

function getLocaleForPath<ThemeConfig>(
	path: string,
	version: VersionOption<ThemeConfig> = latestVersion,
) {
	const locales = getLocalesForVersion(version);

	for (const locale of locales) {
		if (locale.isRoot) continue;
		if (matchesPrefix(path, getLocaleLink(locale))) return locale;
	}

	return getRootLocale(locales);
}

function getRouteParts<ThemeConfig>(path: string) {
	const version = getVersion(path) as VersionOption<ThemeConfig>;
	const pathWithoutVersion = stripPrefix(path, getVersionLink(version));
	const locale = getLocaleForPath<ThemeConfig>(pathWithoutVersion, version);
	const routePath = stripPrefix(pathWithoutVersion, getLocaleLink(locale));

	return { version, locale, routePath };
}

function getLocaleForVersionCode<ThemeConfig>(
	version: VersionOption<ThemeConfig>,
	code: string,
) {
	return getLocalesForVersion(version).find((locale) => locale.code === code);
}

function getPathPrefix<ThemeConfig>(
	locale: ResolvedLocale<ThemeConfig>,
	version: VersionOption<ThemeConfig> = latestVersion,
) {
	return joinPath(getVersionLink(version), getLocaleLink(locale));
}

function applyRoutePrefix<ThemeConfig>(
	path: string,
	locale: ResolvedLocale<ThemeConfig>,
	version: VersionOption<ThemeConfig> = latestVersion,
) {
	return joinPath(getPathPrefix(locale, version), path);
}

const [LocaleContextProvider, useLocaleContext] = createContextProvider(() => {
	const location = useLocation();
	const navigate = useNavigate();

	const currentVersion = createMemo(() => getVersion(location.pathname));
	const currentLocales = createMemo(() =>
		getLocalesForVersion(currentVersion()),
	);
	const currentLocale = createMemo(() =>
		getLocaleForPath(
			stripPrefix(location.pathname, getVersionLink(currentVersion())),
			currentVersion(),
		),
	);

	const match = useMatch(
		() => `${getPathPrefix(currentLocale(), currentVersion())}*rest`,
	);

	const routePath = () => {
		const rest = match()?.params.rest;
		if (!rest) return "/" as const;
		return normalizePath(rest);
	};

	return {
		get locales() {
			return currentLocales();
		},
		versions,
		currentLocale,
		currentVersion,
		setLocale: (locale: ResolvedLocale<any>) => {
			startTransition(() =>
				navigate(applyRoutePrefix(routePath(), locale, currentVersion())),
			);
			document.documentElement.lang = locale.code;
		},
		setVersion: (version: VersionOption<any>) => {
			const nextLocale =
				getLocaleForVersionCode(version, currentLocale().code) ??
				getRootLocale(getLocalesForVersion(version));

			startTransition(() =>
				navigate(applyRoutePrefix(routePath(), nextLocale, version)),
			);
			document.documentElement.lang = nextLocale.code;
		},
		applyPathPrefix: (path: string): `/${string}` =>
			applyRoutePrefix(path, currentLocale(), currentVersion()),
		routePath,
		getPathPrefix: (locale = currentLocale(), version = currentVersion()) =>
			getPathPrefix(locale, version),
	};
});

export { LocaleContextProvider };

export function useLocale() {
	return (
		useLocaleContext() ??
		(() => {
			throw new Error(
				"useLocale must be called underneath a LocaleContextProvider",
			);
		})()
	);
}

export const getLocaleLink = (locale: ResolvedLocale<any>): `/${string}` =>
	normalizePrefix(
		locale.config.link ?? `/${locale.isRoot ? "" : `${locale.code}`}`,
	);

export const getVersionLink = (version: VersionOption<any>): `/${string}` =>
	version.isLatest ? "/" : normalizePrefix(`/${version.path}`);

export function getVersion(_path?: string) {
	let path = _path;
	if (path === undefined) {
		if (isServer) {
			const e = getRequestEvent();
			if (!e) throw new Error("getVersion must be called in a request context");

			path = new URL(e.request.url).pathname;
		} else {
			path = location.pathname;
		}
	}

	for (const version of versionEntries) {
		if (matchesPrefix(path, getVersionLink(version))) return version;
	}

	return latestVersion;
}

export function getLocale(_path?: string) {
	let path = _path;
	if (path === undefined) {
		if (isServer) {
			const e = getRequestEvent();
			if (!e) throw new Error("getLang must be called in a request context");

			path = new URL(e.request.url).pathname;
		} else {
			path = location.pathname;
		}
	}

	return getRouteParts(path).locale;
}

export function getRoutePath(path: string) {
	return getRouteParts(path).routePath;
}
