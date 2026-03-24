import { solidStart } from "@solidjs/start/config";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

import { createSolidBase, defineTheme } from "../src/config";
import { createFilesystemSidebar } from "../src/config/sidebar";
import defaultTheme from "../src/default-theme";

const theme = defineTheme({
	componentsPath: import.meta.resolve("./src/solidbase-theme"),
	extends: defaultTheme,
});

const solidBase = createSolidBase(theme);

export default defineConfig({
	plugins: [
		solidBase.plugin({
			title: "SolidBase Dev",
			description: "Development playground for the latest SolidBase features",
			llms: true,
			lang: "en",
			locales: {
				root: {
					label: "English",
				},
				fr: {
					label: "Francais",
				},
			},
			versions: {
				current: "latest",
				all: [
					{
						label: "v1.1.16",
						path: "v1.1.16",
						dir: "versioned_docs/v1.1.16",
						themeConfig: {
							nav: [
								{
									text: "v1.1.16",
									link: "/about",
								},
							],
							sidebar: {
								"/": [
									{
										title: "Versioned",
										items: [
											{
												title: "Versioned Home",
												link: "/",
											},
											{
												title: "Versioned About",
												link: "/about",
											},
										],
									},
								],
							},
						},
						locales: {
							root: {
								label: "English",
							},
							es: {
								label: "Espanol",
							},
						},
					},
				],
			},
			themeConfig: {
				sidebar: {
					"/": createFilesystemSidebar("./src/routes", {
						filter: (item) => {
							if ("items" in item) return true;
							return /\.(md|mdx)$/.test(item.filePath);
						},
					}),
				},
			},
		}),
		solidStart(solidBase.startConfig()),
		nitro({
			prerender: { crawlLinks: true },
		}),
	],
});
