import MiniSearch from "minisearch";
import { describe, expect, it } from "vitest";
import {
	getLocalSearchScopeForPath,
	LOCAL_SEARCH_INDEX_OPTIONS,
} from "../../src/default-theme/search.ts";
import {
	buildLocalSearchIndexes,
	splitSearchSections,
} from "../../src/default-theme/search-index.ts";
import { fixtureSiteRoot } from "../helpers/fixtures.ts";

describe("splitSearchSections", () => {
	it("creates searchable heading sections with stable duplicate anchors", () => {
		const sections = splitSearchSections(
			[
				"# Guide",
				"",
				"Welcome to SolidBase.",
				"",
				"## Install",
				"",
				"First install section.",
				"",
				"## Install",
				"",
				"Second install section.",
			].join("\n"),
			{ routePath: "/guide", title: "Guide", description: "Start here" },
		);

		expect(sections).toEqual([
			expect.objectContaining({
				id: "/guide#guide",
				title: "Guide",
				text: "Start here Welcome to SolidBase.",
			}),
			expect.objectContaining({
				id: "/guide#install",
				title: "Install",
				titles: ["Guide"],
			}),
			expect.objectContaining({
				id: "/guide#install-1",
				text: "Second install section.",
			}),
		]);
	});
});

describe("getLocalSearchScopeForPath", () => {
	it("creates stable keys for route axes", () => {
		expect(
			getLocalSearchScopeForPath("/v1/fr", {
				routes: {
					path: "/{project}/{version}/{locale}",
					project: {
						default: "solid",
						values: { solid: { path: "" } },
					},
					version: {
						default: "latest",
						values: { latest: { path: "" }, v1: { path: "v1" } },
					},
					locale: {
						default: "en",
						values: { en: { path: "" }, fr: { path: "fr" } },
					},
				},
			}),
		).toBe("locale:fr|project:solid|version:v1");
	});

	it("matches legacy locale landing paths with trailing-slash links", () => {
		const config = {
			locales: {
				root: { label: "English" },
				fr: { label: "Français", link: "/fr/" },
			},
		};

		expect(getLocalSearchScopeForPath("/fr", config)).toBe("fr");
		expect(getLocalSearchScopeForPath("/fr/guide", config)).toBe("fr");
		expect(getLocalSearchScopeForPath("/guide", config)).toBe("root");
	});
});

describe("buildLocalSearchIndexes", () => {
	it("builds searchable indexes for included route scopes", async () => {
		const indexes = await buildLocalSearchIndexes(
			fixtureSiteRoot,
			{
				themeConfig: { search: { local: true } },
				markdown: {},
			} as any,
			async () => null,
		);

		const rootIndex = MiniSearch.loadJSON(
			indexes.get("root")!,
			LOCAL_SEARCH_INDEX_OPTIONS,
		);

		expect(rootIndex.search("SolidBase").map((result) => result.id)).toEqual([
			"/#home",
			"/guide/getting-started#getting-started",
		]);
	});

	it("omits pages with search disabled", async () => {
		const indexes = await buildLocalSearchIndexes(
			fixtureSiteRoot,
			{ themeConfig: { search: { local: true } }, markdown: {} } as any,
			async () => null,
		);
		const rootIndex = MiniSearch.loadJSON(
			indexes.get("root")!,
			LOCAL_SEARCH_INDEX_OPTIONS,
		);

		expect(rootIndex.search("Hidden Doc")).toEqual([]);
	});

	it("isolates indexes by the current route-axis selection", async () => {
		const indexes = await buildLocalSearchIndexes(
			fixtureSiteRoot,
			{
				themeConfig: { search: { local: true } },
				markdown: {},
				routes: {
					path: "/{project}",
					project: {
						default: "docs",
						values: {
							docs: { path: "" },
							guide: { path: "guide" },
						},
					},
				},
			} as any,
			async () => null,
		);
		const docsIndex = MiniSearch.loadJSON(
			indexes.get("project:docs")!,
			LOCAL_SEARCH_INDEX_OPTIONS,
		);
		const guideIndex = MiniSearch.loadJSON(
			indexes.get("project:guide")!,
			LOCAL_SEARCH_INDEX_OPTIONS,
		);

		expect(docsIndex.search("Welcome home")).not.toHaveLength(0);
		expect(docsIndex.search("Learn the basics")).toEqual([]);
		expect(guideIndex.search("Learn the basics")).not.toHaveLength(0);
		expect(guideIndex.search("Welcome home")).toEqual([]);
	});
});
