#!/usr/bin/env node

import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { snapshotVersion } from "./cli/version.js";

async function main() {
	const [, , command, ...args] = process.argv;

	if (command === "version") {
		const version = args[0];
		if (!version) {
			throw new Error("Missing version. Usage: solidbase version <semver>");
		}

		try {
			const result = await snapshotVersion({
				root: process.cwd(),
				version,
			});
			stdout.write(
				`Created version ${version} in ${result.targetDir} and updated ${result.configPath}.\n`,
			);
			return;
		} catch (error) {
			if (error instanceof Error && error.message.includes("already exists")) {
				const rl = createInterface({ input: stdin, output: stdout });
				const answer = await rl.question(
					`Version ${version} already exists. Overwrite it? [y/N] `,
				);
				rl.close();

				if (!/^y(es)?$/i.test(answer.trim())) return;

				const result = await snapshotVersion({
					root: process.cwd(),
					version,
					overwrite: true,
				});
				stdout.write(
					`Overwrote version ${version} in ${result.targetDir} and updated ${result.configPath}.\n`,
				);
				return;
			}

			throw error;
		}
	}

	stdout.write("Usage: solidbase version <semver>\n");
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exitCode = 1;
});
