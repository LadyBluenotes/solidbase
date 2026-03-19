import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import solidBaseLlmsPlugin from "../../src/config/vite-plugin/llms.ts";
import { fixtureSiteRoot } from "../helpers/fixtures.ts";

describe("solidBaseLlmsPlugin", () => {
	it("returns no plugin when llms is disabled", () => {
		expect(solidBaseLlmsPlugin({ llms: false } as any)).toEqual([]);
	});

	it("writes llms assets for the configured root", async () => {
		const pluginOption = solidBaseLlmsPlugin({
			title: "SolidBase Docs",
			description: "Documentation for SolidBase",
			llms: true,
			themeConfig: {
				sidebar: {
					"/": [
						{
							title: "Guide",
							items: [
								{ title: "Getting Started", link: "/guide/getting-started" },
							],
						},
					],
				},
			},
			markdown: {},
		} as any);
		const plugin = (
			Array.isArray(pluginOption) ? pluginOption[0] : pluginOption
		) as any;
		expect(plugin).toBeDefined();
		if (!plugin) throw new Error("Expected LLMS plugin to be defined");

		const llmsOutputDir = join(
			fixtureSiteRoot,
			"node_modules",
			".solidbase",
			"llms",
		);
		await rm(llmsOutputDir, { recursive: true, force: true });

		plugin.configResolved?.({ root: fixtureSiteRoot } as any);
		await plugin.buildStart?.call({} as any);

		const llmsIndex = await readFile(join(llmsOutputDir, "llms.txt"), "utf8");
		const rootDoc = await readFile(join(llmsOutputDir, "index.md"), "utf8");
		const guideDoc = await readFile(
			join(llmsOutputDir, "guide", "getting-started.md"),
			"utf8",
		);

		expect(llmsIndex).toContain("SolidBase Docs");
		expect(rootDoc).toContain("# Home");
		expect(guideDoc).toContain("Getting Started");
	});
});
