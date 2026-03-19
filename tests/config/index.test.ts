import { describe, expect, it, vi } from "vitest";

const solidBaseMdx = vi.fn();
const solidBaseVitePlugin = vi.fn();

vi.mock("../../src/config/mdx.ts", () => ({
	solidBaseMdx,
}));

vi.mock("../../src/config/vite-plugin/index.ts", () => ({
	default: solidBaseVitePlugin,
}));

vi.mock("../../src/default-theme/index.js", () => ({
	default: {
		componentsPath: "/themes/default",
	},
}));

describe("createSolidBase", () => {
	it("applies defaults and returns mdx, core, and theme plugins", async () => {
		solidBaseMdx.mockReset();
		solidBaseVitePlugin.mockReset();
		solidBaseMdx.mockReturnValue("mdx-plugin");
		solidBaseVitePlugin.mockReturnValue("solidbase-plugin");

		const { createSolidBase } = await import("../../src/config/index.ts");
		const theme = {
			componentsPath: "/themes/custom",
			config: vi.fn(),
			vite: vi.fn(() => "theme-plugin"),
		} as any;

		const solidBase = createSolidBase(theme);
		const config = solidBase.startConfig({
			extensions: ["tsx", "md"],
		});
		const plugins = solidBase.plugin({ title: "Docs", llms: true });

		expect(config.extensions).toEqual(["tsx", "md", "mdx"]);
		expect(config.ssr).toBe(true);
		expect(theme.config).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Docs",
				llms: true,
				lang: "en-US",
				issueAutolink: false,
			}),
		);
		expect(plugins).toEqual(["mdx-plugin", "solidbase-plugin", "theme-plugin"]);
		expect(solidBaseMdx).toHaveBeenCalledWith(
			expect.objectContaining({ title: "Docs", llms: true }),
		);
		expect(solidBaseVitePlugin).toHaveBeenCalledWith(
			theme,
			expect.objectContaining({ title: "Docs", llms: true }),
		);
	});

	it("passes versions config through to theme and core plugins", async () => {
		solidBaseMdx.mockReset();
		solidBaseVitePlugin.mockReset();
		solidBaseMdx.mockReturnValue("mdx-plugin");
		solidBaseVitePlugin.mockReturnValue("solidbase-plugin");

		const { createSolidBase } = await import("../../src/config/index.ts");
		const theme = {
			componentsPath: "/themes/custom",
			config: vi.fn(),
			vite: vi.fn(() => "theme-plugin"),
		} as any;

		const solidBase = createSolidBase(theme);

		const versions = {
			current: "latest",
			all: [
				{
					label: "v1.1.16",
					path: "v1.1.16",
					dir: "versioned_docs/v1.1.16",
					themeConfig: { nav: [{ title: "Versioned" }] },
					locales: {
						en: { label: "English" },
					},
				},
				{ label: "Legacy", href: "https://legacy.example.com" },
			],
			build: ["v1.1.16"],
		} satisfies {
			current: string;
			all: Array<
				| {
						label: string;
						path: string;
						dir: string;
						themeConfig: { nav: Array<{ title: string }> };
						locales: { en: { label: string } };
				  }
				| { label: string; href: string }
			>;
			build: string[];
		};

		solidBase.plugin({
			themeConfig: { nav: [{ title: "Latest" }] },
			versions,
		});

		expect(theme.config).toHaveBeenCalledWith(
			expect.objectContaining({
				versions,
			}),
		);
		expect(solidBaseMdx).toHaveBeenCalledWith(
			expect.objectContaining({ versions }),
		);
		expect(solidBaseVitePlugin).toHaveBeenCalledWith(
			theme,
			expect.objectContaining({ versions }),
		);
	});

	it("merges inherited theme config hooks and reverses theme vite order", async () => {
		solidBaseMdx.mockReset();
		solidBaseVitePlugin.mockReset();
		solidBaseMdx.mockReturnValue("mdx-plugin");
		solidBaseVitePlugin.mockReturnValue("solidbase-plugin");

		const { createSolidBase } = await import("../../src/config/index.ts");
		const parent = {
			componentsPath: "/themes/parent",
			config: vi.fn(),
			vite: vi.fn(() => "parent-plugin"),
		} as any;
		const child = {
			componentsPath: "/themes/child",
			extends: parent,
			config: vi.fn(),
			vite: vi.fn(() => "child-plugin"),
		} as any;

		const solidBase = createSolidBase(child);
		const plugins = solidBase.plugin();

		expect(child.config.mock.invocationCallOrder[0]).toBeLessThan(
			parent.config.mock.invocationCallOrder[0],
		);
		expect(parent.config).toHaveBeenCalled();
		expect(child.vite.mock.invocationCallOrder[0]).toBeLessThan(
			parent.vite.mock.invocationCallOrder[0],
		);
		expect((plugins as any[]).slice(-2)).toEqual([
			"parent-plugin",
			"child-plugin",
		]);
	});
});
