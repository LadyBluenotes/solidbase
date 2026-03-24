import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
	assertValidVersion,
	snapshotVersion,
	updateConfigFileText,
} from "../../src/cli/version.ts";

describe("version cli helpers", () => {
	it("inserts a versions block into a SolidBase config", () => {
		const source = [
			"export default defineConfig({",
			"\tplugins: [",
			"\t\tsolidBase.plugin({",
			'\t\t\ttitle: "Docs",',
			"\t\t\tthemeConfig: {},",
			"\t\t}),",
			"\t],",
			"});",
		].join("\n");

		const updated = updateConfigFileText(source, "1.2.3");

		expect(updated).toContain("versions:");
		expect(updated).toContain('current: "latest"');
		expect(updated).toContain('label: "v1.2.3"');
		expect(updated).toContain('path: "v1.2.3"');
		expect(updated).toContain('dir: "versioned_docs/v1.2.3"');
	});

	it("appends new versions to existing all/build arrays without duplication", () => {
		const source = [
			"export default defineConfig({",
			"\tplugins: [",
			"\t\tsolidBase.plugin({",
			"\t\t\tversions: {",
			'\t\t\t\tcurrent: "latest",',
			"\t\t\t\tall: [",
			"\t\t\t\t\t{",
			'\t\t\t\t\t\tlabel: "v1.1.0",',
			'\t\t\t\t\t\tpath: "v1.1.0",',
			'\t\t\t\t\t\tdir: "versioned_docs/v1.1.0",',
			"\t\t\t\t\t},",
			"\t\t\t\t],",
			"\t\t\t\tbuild: [",
			'\t\t\t\t\t"v1.1.0",',
			"\t\t\t\t],",
			"\t\t\t},",
			"\t\t}),",
			"\t],",
			"});",
		].join("\n");

		const updated = updateConfigFileText(source, "1.2.3");
		const updatedAgain = updateConfigFileText(updated, "1.2.3");

		expect(updated).toContain('path: "v1.2.3"');
		expect(updated).toContain('dir: "versioned_docs/v1.2.3"');
		expect(updated).toContain('"v1.2.3"');
		expect(updatedAgain.match(/path: "v1.2.3"/g)).toHaveLength(1);
	});

	it("copies routes and updates vite config for a snapshot", async () => {
		const root = await mkdtemp(join(tmpdir(), "solidbase-cli-version-"));
		await mkdir(join(root, "src", "routes", "guide"), { recursive: true });
		await writeFile(join(root, "src", "routes", "index.mdx"), "# Home\n");
		await writeFile(
			join(root, "src", "routes", "guide", "getting-started.mdx"),
			"# Getting Started\n",
		);
		await writeFile(
			join(root, "vite.config.mts"),
			[
				"export default defineConfig({",
				"\tplugins: [",
				"\t\tsolidBase.plugin({",
				'\t\t\ttitle: "Docs",',
				"\t\t}),",
				"\t],",
				"});",
			].join("\n"),
		);

		const result = await snapshotVersion({ root, version: "1.2.3" });

		expect(result.targetDir).toBe(join(root, "versioned_docs", "v1.2.3"));
		expect(
			await readFile(
				join(root, "versioned_docs", "v1.2.3", "index.mdx"),
				"utf8",
			),
		).toContain("# Home");
		expect(
			await readFile(
				join(root, "versioned_docs", "v1.2.3", "guide", "getting-started.mdx"),
				"utf8",
			),
		).toContain("# Getting Started");

		const config = await readFile(join(root, "vite.config.mts"), "utf8");
		expect(config).toContain('path: "v1.2.3"');
		expect(config).toContain('dir: "versioned_docs/v1.2.3"');
	});

	it("rejects invalid semver strings", () => {
		expect(() => assertValidVersion("v1.2.3")).toThrow("Invalid version");
		expect(() => assertValidVersion("1.2")).toThrow("Invalid version");
		expect(() => assertValidVersion("1.2.3")).not.toThrow();
	});
});
