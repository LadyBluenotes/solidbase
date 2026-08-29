import type { PluginOption } from "vite";
import type { SolidBaseResolvedConfig } from "../config/index.js";
import { buildLocalSearchIndexes } from "./search-index.js";

export const LOCAL_SEARCH_MODULE_ID = "virtual:solidbase/local-search";
const RESOLVED_LOCAL_SEARCH_MODULE_ID = `\0${LOCAL_SEARCH_MODULE_ID}`;

export default function localSearchPlugin(
	config: SolidBaseResolvedConfig<any>,
): PluginOption {
	let root = process.cwd();

	return {
		name: "solidbase:local-search",
		configResolved(resolvedConfig) {
			root = resolvedConfig.root;
		},
		resolveId(id) {
			if (id === LOCAL_SEARCH_MODULE_ID) return RESOLVED_LOCAL_SEARCH_MODULE_ID;
		},
		async load(id) {
			if (id !== RESOLVED_LOCAL_SEARCH_MODULE_ID) return;
			if (config.themeConfig?.search?.local !== true)
				return "export default {};";

			const indexes = await buildLocalSearchIndexes(
				root,
				config,
				(source, importer) => this.resolve(source, importer),
				(filePath) => this.addWatchFile(filePath),
			);

			return `export default ${JSON.stringify(Object.fromEntries(indexes))};`;
		},
	};
}
