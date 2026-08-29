import MiniSearch from "minisearch";
import { describe, expect, it } from "vitest";
import { LOCAL_SEARCH_INDEX_OPTIONS } from "../../src/default-theme/search.ts";
import localSearchPlugin, {
	LOCAL_SEARCH_MODULE_ID,
} from "../../src/default-theme/vite-local-search.ts";
import { fixtureSiteRoot } from "../helpers/fixtures.ts";

describe("localSearchPlugin", () => {
	it("returns an empty loader map when local search is disabled", async () => {
		const plugin = localSearchPlugin({ themeConfig: {} } as any) as any;
		const resolvedId = plugin.resolveId(LOCAL_SEARCH_MODULE_ID);

		expect(await plugin.load(resolvedId)).toBe("export default {};");
	});

	it("exposes serialized indexes by route scope", async () => {
		const plugin = localSearchPlugin({
			themeConfig: { search: { local: true } },
			markdown: {},
		} as any) as any;
		plugin.configResolved({ root: fixtureSiteRoot });
		const context = {
			addWatchFile() {},
			resolve: async () => null,
		};
		const rootId = plugin.resolveId(LOCAL_SEARCH_MODULE_ID);
		const rootModule = await plugin.load.call(context, rootId);

		const indexes = JSON.parse(
			rootModule.match(/^export default (.*);$/s)?.[1] ?? "",
		) as Record<string, string>;
		const index = MiniSearch.loadJSON(
			indexes.root!,
			LOCAL_SEARCH_INDEX_OPTIONS,
		);

		expect(index.search("SolidBase")).not.toHaveLength(0);
	});
});
