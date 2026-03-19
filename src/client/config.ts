import { solidBaseConfig } from "virtual:solidbase/config";
import { type Accessor, createMemo } from "solid-js";

import type { SolidBaseResolvedConfig } from "../config/index.js";
import { useLocale } from "./locale.js";

export function useRouteSolidBaseConfig<ThemeConfig>(): Accessor<
	SolidBaseResolvedConfig<ThemeConfig>
> {
	const { currentLocale, currentVersion } = useLocale();

	return createMemo(() => {
		const version = currentVersion();
		const versionConfig = version.isLatest ? {} : (version.themeConfig ?? {});
		const localeConfig = currentLocale().config.themeConfig ?? {};

		return {
			...solidBaseConfig,
			themeConfig: {
				...solidBaseConfig.themeConfig,
				...versionConfig,
				...localeConfig,
			},
		};
	});
}
