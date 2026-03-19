import { createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

let currentLocaleThemeConfig: Record<string, unknown> = {
	nav: { title: "Localized" },
};
let currentVersion: {
	isLatest: boolean;
	themeConfig?: Record<string, unknown>;
} = {
	isLatest: true,
};

function setSolidBaseConfig(value: Record<string, unknown>) {
	const store = ((globalThis as any).__solidBaseConfig ??= {}) as Record<
		string,
		unknown
	>;
	for (const key of Object.keys(store)) delete store[key];
	Object.assign(store, value);
}

vi.mock("../../src/client/locale.ts", () => ({
	useLocale: () => ({
		currentLocale: () => ({
			config: {
				themeConfig: currentLocaleThemeConfig,
			},
		}),
		currentVersion: () => currentVersion,
	}),
}));

describe("route config helper", () => {
	afterEach(() => {
		setSolidBaseConfig({});
		currentLocaleThemeConfig = { nav: { title: "Localized" } };
		currentVersion = { isLatest: true };
		vi.resetModules();
	});

	it("merges locale theme config over the base config", async () => {
		setSolidBaseConfig({
			title: "Docs",
			themeConfig: {
				nav: { title: "Default" },
				sidebar: { "/": [] },
			},
		});

		const { useRouteSolidBaseConfig } = await import(
			"../../src/client/config.ts"
		);

		createRoot((dispose) => {
			const config = useRouteSolidBaseConfig<any>();

			expect(config()).toMatchObject({
				title: "Docs",
				themeConfig: {
					nav: { title: "Localized" },
					sidebar: { "/": [] },
				},
			});
			dispose();
		});
	});

	it("merges version theme config between the base and locale config", async () => {
		setSolidBaseConfig({
			title: "Docs",
			themeConfig: {
				nav: { title: "Default" },
				sidebar: { "/": [] },
				footer: { message: "Base" },
			},
		});
		currentVersion = {
			isLatest: false,
			themeConfig: {
				nav: { title: "Versioned" },
				footer: { message: "Version" },
			},
		};
		currentLocaleThemeConfig = {
			footer: { message: "Localized" },
		};

		const { useRouteSolidBaseConfig } = await import(
			"../../src/client/config.ts"
		);

		createRoot((dispose) => {
			const config = useRouteSolidBaseConfig<any>();

			expect(config()).toMatchObject({
				title: "Docs",
				themeConfig: {
					nav: { title: "Versioned" },
					sidebar: { "/": [] },
					footer: { message: "Localized" },
				},
			});
			dispose();
		});
	});
});
