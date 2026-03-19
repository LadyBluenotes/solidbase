// @vitest-environment jsdom

import { createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

let currentPathname = "/";

const navigate = vi.fn();
const useLocation = vi.fn(() => ({
	get pathname() {
		return currentPathname;
	},
}));
const useNavigate = vi.fn(() => navigate);
const useMatch = vi.fn((pattern: () => string) => () => {
	const matcher = pattern();
	const prefix = matcher.replace("*rest", "");

	if (prefix === "/") {
		return { params: { rest: currentPathname.slice(1) } };
	}

	if (currentPathname === prefix.slice(0, -1)) {
		return { params: { rest: "" } };
	}

	if (currentPathname.startsWith(prefix)) {
		return { params: { rest: currentPathname.slice(prefix.length) } };
	}

	return undefined;
});

vi.mock("virtual:solidbase/config", () => ({
	solidBaseConfig: {
		lang: "en-US",
		locales: {
			root: { label: "English" },
			fr: { label: "Francais" },
		},
		versions: {
			current: "latest",
			all: [
				{
					label: "v1.1.16",
					path: "v1.1.16",
					dir: "versioned_docs/v1.1.16",
					locales: {
						root: { label: "English" },
						es: { label: "Espanol" },
					},
				},
			],
		},
	},
}));

vi.mock("@solidjs/router", () => ({
	useLocation,
	useNavigate,
	useMatch,
}));

describe("locale helpers", () => {
	afterEach(() => {
		currentPathname = "/";
		navigate.mockReset();
		useLocation.mockClear();
		useNavigate.mockClear();
		useMatch.mockClear();
		vi.resetModules();
	});

	it("parses version, locale, and route path across supported URL shapes", async () => {
		const { getLocale, getRoutePath, getVersion } = await import(
			"../../src/client/locale.ts"
		);

		expect(getVersion("/guide")).toMatchObject({
			isLatest: true,
			label: "latest",
		});
		expect(getLocale("/guide")).toMatchObject({ isRoot: true, code: "en-US" });
		expect(getRoutePath("/guide")).toBe("/guide");

		expect(getVersion("/fr/guide")).toMatchObject({ isLatest: true });
		expect(getLocale("/fr/guide")).toMatchObject({ code: "fr" });
		expect(getRoutePath("/fr/guide")).toBe("/guide");

		expect(getVersion("/v1.1.16/guide")).toMatchObject({ path: "v1.1.16" });
		expect(getLocale("/v1.1.16/guide")).toMatchObject({
			isRoot: true,
			code: "en-US",
		});
		expect(getRoutePath("/v1.1.16/guide")).toBe("/guide");

		expect(getVersion("/v1.1.16/es/guide")).toMatchObject({ path: "v1.1.16" });
		expect(getLocale("/v1.1.16/es/guide")).toMatchObject({ code: "es" });
		expect(getRoutePath("/v1.1.16/es/guide")).toBe("/guide");
	});

	it("preserves the current version when switching locales", async () => {
		currentPathname = "/v1.1.16/es/guide";

		const { LocaleContextProvider, useLocale } = await import(
			"../../src/client/locale.ts"
		);

		let localeApi: ReturnType<typeof useLocale> | undefined;

		const dispose = createRoot((dispose) => {
			LocaleContextProvider({
				get children() {
					localeApi = useLocale();
					return null;
				},
			} as any);
			return dispose;
		});

		expect(localeApi?.currentVersion()).toMatchObject({ path: "v1.1.16" });
		expect(localeApi?.currentLocale()).toMatchObject({ code: "es" });
		expect(localeApi?.routePath()).toBe("/guide");

		localeApi?.setLocale(
			localeApi.locales.find((locale) => locale.isRoot)! as any,
		);
		await Promise.resolve();

		expect(navigate).toHaveBeenCalledWith("/v1.1.16/guide");
		dispose();
	});

	it("falls back to the root locale when the target version lacks the current locale", async () => {
		currentPathname = "/v1.1.16/es/guide";

		const { LocaleContextProvider, useLocale } = await import(
			"../../src/client/locale.ts"
		);

		let localeApi: ReturnType<typeof useLocale> | undefined;

		const dispose = createRoot((dispose) => {
			LocaleContextProvider({
				get children() {
					localeApi = useLocale();
					return null;
				},
			} as any);
			return dispose;
		});

		const version = localeApi?.versions.find((entry) => entry.isLatest);
		expect(version).toBeDefined();

		localeApi?.setVersion(version!);
		await Promise.resolve();

		expect(navigate).toHaveBeenCalledWith("/guide");
		dispose();
	});
});
