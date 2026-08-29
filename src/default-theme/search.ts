import type { Options, SearchOptions } from "minisearch";
import type { SolidBaseConfig } from "../config/index.js";
import { getSolidBaseRouteMatchForPath } from "../config/route-config.js";

export type LocalSearchDocument = {
	id: string;
	title: string;
	titles: string[];
	text: string;
	excerpt: string;
};

export const LOCAL_SEARCH_INDEX_OPTIONS: Options<LocalSearchDocument> = {
	fields: ["title", "titles", "text"],
	storeFields: ["title", "titles", "excerpt"],
};

export const LOCAL_SEARCH_QUERY_OPTIONS: SearchOptions = {
	prefix: true,
	fuzzy: 0.2,
	boost: { title: 4, text: 2, titles: 1 },
};

function normalizePrefix(prefix: string) {
	if (prefix === "/") return prefix;
	return prefix.replace(/\/$/, "");
}

export function getLocalSearchScopeForPath(
	path: string,
	config: Pick<SolidBaseConfig<any>, "routes" | "locales">,
) {
	const selection = getSolidBaseRouteMatchForPath(
		config.routes,
		path,
	)?.selection;
	if (!selection) {
		for (const [locale, localeConfig] of Object.entries(config.locales ?? {})) {
			if (locale === "root") continue;
			const prefix = normalizePrefix(localeConfig.link ?? `/${locale}/`);
			if (path === prefix || path.startsWith(`${prefix}/`)) return locale;
		}

		return "root";
	}

	const entries = Object.entries(selection);
	if (entries.length === 0) return "root";

	return entries
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([axis, value]) => `${axis}:${value}`)
		.join("|");
}
