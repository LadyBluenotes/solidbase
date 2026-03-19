import { relative } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
	getIncludedVersionEntries,
	patchVersionedRouter,
	prefixVersionedRoutePath,
} from "../../src/config/vite-plugin/versioned-routes.ts";
import {
	fixtureSiteRoot,
	routeFixturePath,
	versionedRouteFixturePath,
} from "../helpers/fixtures.ts";

class FakeRouter extends EventTarget {
	config;
	getRoutes;
	addRoute;
	updateRoute;
	removeRoute;

	constructor(dir: string) {
		super();
		this.config = {
			dir,
			extensions: ["mdx"],
		};
		this.getRoutes = vi.fn(async () => [
			this.toRoute(routeFixturePath("guide", "getting-started.mdx"))!,
		]);
		this.addRoute = vi.fn();
		this.updateRoute = vi.fn();
		this.removeRoute = vi.fn();
	}

	toRoute(src: string) {
		const routePath = this.toPath(src);
		return {
			path: routePath,
			$component: { src, pick: ["$css"] },
		};
	}

	toPath(src: string) {
		const routePath = relative(this.config.dir, src)
			.replace(/\\/g, "/")
			.replace(/\.mdx$/, "")
			.replace(/\/index$/, "");
		return routePath ? `/${routePath}` : "/";
	}
}

describe("versioned routes", () => {
	it("prefixes versioned route paths", () => {
		expect(prefixVersionedRoutePath("v1.1.16", "/guide/getting-started")).toBe(
			"/v1.1.16/guide/getting-started",
		);
		expect(prefixVersionedRoutePath("v1.1.16", "/")).toBe("/v1.1.16");
	});

	it("includes versioned routes alongside latest routes", async () => {
		const router = new FakeRouter(routeFixturePath());
		patchVersionedRouter(router as any, [
			{
				label: "v1.1.16",
				path: "v1.1.16",
				dir: "versioned_docs/v1.1.16",
				absDir: versionedRouteFixturePath("v1.1.16"),
			},
		]);

		const routes = await router.getRoutes();

		expect(routes.map((route) => route.path)).toEqual([
			"/guide/getting-started",
			"/v1.1.16/es/guide/getting-started",
			"/v1.1.16/guide/getting-started",
		]);
	});

	it("filters built versions in production builds", () => {
		const entries = getIncludedVersionEntries(
			{
				versions: {
					current: "latest",
					all: [
						{
							label: "v1.1.16",
							path: "v1.1.16",
							dir: "versioned_docs/v1.1.16",
						},
						{
							label: "v2.0.0",
							path: "v2.0.0",
							dir: "versioned_docs/v2.0.0",
						},
						{ label: "Legacy", href: "https://legacy.example.com" },
					],
					build: ["v1.1.16"],
				},
			} as any,
			fixtureSiteRoot,
			true,
		);

		expect(entries.map((entry) => entry.path)).toEqual(["v1.1.16"]);
		expect(entries[0]?.absDir).toBe(versionedRouteFixturePath("v1.1.16"));
	});

	it("includes all versions during dev regardless of build filter", () => {
		const entries = getIncludedVersionEntries(
			{
				versions: {
					current: "latest",
					all: [
						{
							label: "v1.1.16",
							path: "v1.1.16",
							dir: "versioned_docs/v1.1.16",
						},
						{
							label: "v2.0.0",
							path: "v2.0.0",
							dir: "versioned_docs/v2.0.0",
						},
					],
					build: ["v1.1.16"],
				},
			} as any,
			fixtureSiteRoot,
			false,
		);

		expect(entries.map((entry) => entry.path)).toEqual(["v1.1.16", "v2.0.0"]);
	});

	it("reloads routes when versioned files change and delegates latest files", () => {
		const router = new FakeRouter(routeFixturePath());
		const originalAddRoute = router.addRoute;
		const originalUpdateRoute = router.updateRoute;
		const reload = vi.fn();
		router.addEventListener("reload", reload);

		patchVersionedRouter(router as any, [
			{
				label: "v1.1.16",
				path: "v1.1.16",
				dir: "versioned_docs/v1.1.16",
				absDir: versionedRouteFixturePath("v1.1.16"),
			},
		]);

		router.addRoute(
			versionedRouteFixturePath("v1.1.16", "guide", "getting-started.mdx"),
		);
		expect(reload).toHaveBeenCalledTimes(1);
		expect(originalAddRoute).not.toHaveBeenCalled();

		router.updateRoute(routeFixturePath("guide", "getting-started.mdx"));
		expect(originalUpdateRoute).toHaveBeenCalledWith(
			routeFixturePath("guide", "getting-started.mdx"),
		);
	});
});
