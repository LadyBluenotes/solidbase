import { constants as fsConstants } from "node:fs";
import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const VERSION_SEMVER_RE =
	/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const CONFIG_FILE_CANDIDATES = [
	"app.config.ts",
	"app.config.mts",
	"app.config.js",
	"app.config.mjs",
	"vite.config.ts",
	"vite.config.mts",
	"vite.config.js",
	"vite.config.mjs",
];

export type SnapshotVersionOptions = {
	root: string;
	version: string;
	overwrite?: boolean;
};

export type SnapshotVersionResult = {
	configPath: string;
	targetDir: string;
	configUpdated: boolean;
};

export async function snapshotVersion({
	root,
	version,
	overwrite = false,
}: SnapshotVersionOptions): Promise<SnapshotVersionResult> {
	assertValidVersion(version);

	const routesDir = resolve(root, "src/routes");
	const targetDir = resolve(root, "versioned_docs", `v${version}`);
	const configPath = await findConfigFile(root);

	await access(routesDir, fsConstants.F_OK);

	const targetExists = await pathExists(targetDir);
	if (targetExists && !overwrite) {
		throw new Error(`Version '${version}' already exists at '${targetDir}'.`);
	}

	await mkdir(resolve(root, "versioned_docs"), { recursive: true });
	if (targetExists) await rm(targetDir, { recursive: true, force: true });
	await cp(routesDir, targetDir, { recursive: true });

	const configSource = await readFile(configPath, "utf8");
	const updatedSource = updateConfigFileText(configSource, version);
	const configUpdated = updatedSource !== configSource;
	if (configUpdated) await writeFile(configPath, updatedSource);

	return { configPath, targetDir, configUpdated };
}

export function assertValidVersion(version: string) {
	if (!VERSION_SEMVER_RE.test(version)) {
		throw new Error(
			`Invalid version '${version}'. Expected a semver like '1.2.3'.`,
		);
	}
}

export async function findConfigFile(root: string) {
	for (const file of CONFIG_FILE_CANDIDATES) {
		const filePath = resolve(root, file);
		if (await pathExists(filePath)) return filePath;
	}

	throw new Error(
		"Could not find a SolidBase config file. Expected app.config.* or vite.config.* in the project root.",
	);
}

export function updateConfigFileText(source: string, version: string) {
	const pluginCallIndex = source.indexOf("solidBase.plugin(");
	if (pluginCallIndex === -1) {
		throw new Error(
			"Could not find solidBase.plugin({...}) in the config file. Update the versions config manually.",
		);
	}

	const objectStart = source.indexOf("{", pluginCallIndex);
	if (objectStart === -1) {
		throw new Error("Could not find the SolidBase plugin config object.");
	}

	const objectEnd = findMatchingBrace(source, objectStart);
	const configObject = source.slice(objectStart, objectEnd + 1);
	const versionsMatch = /(\n(\s*)versions\s*:\s*\{)([\s\S]*?)(\n\2\},?)/.exec(
		configObject,
	);

	if (!versionsMatch) {
		const closingIndent = getLineIndent(source, objectEnd);
		const propertyIndent = `${closingIndent}\t`;
		const versionsBlock = `${propertyIndent}versions: {\n${propertyIndent}\tcurrent: "latest",\n${propertyIndent}\tall: [\n${formatVersionEntry(version, propertyIndent, 2)}\n${propertyIndent}\t],\n${propertyIndent}},\n`;
		return `${source.slice(0, objectEnd)}${configObject.length > 2 ? "\n" : ""}${versionsBlock}${closingIndent}${source.slice(objectEnd)}`;
	}

	const versionsBodyWithEntry = appendToArrayProperty(
		versionsMatch[3]!,
		"all",
		formatVersionEntry(version, versionsMatch[2]!, 2),
		(entryBlock) =>
			entryBlock.includes(`path: "v${version}"`) ||
			entryBlock.includes(`path: 'v${version}'`),
	);
	const versionsBody = appendStringToBuild(
		versionsBodyWithEntry,
		`v${version}`,
		versionsMatch[2]!,
	);
	const versionsBlock = `${versionsMatch[1]}${versionsBody}${versionsMatch[4]}`;

	const updatedConfigObject = configObject.replace(
		versionsMatch[0],
		versionsBlock,
	);
	return `${source.slice(0, objectStart)}${updatedConfigObject}${source.slice(objectEnd + 1)}`;
}

function appendToArrayProperty(
	versionsBody: string,
	property: string,
	entry: string,
	exists: (body: string) => boolean,
) {
	const arrayMatch = new RegExp(
		`(\\n(\\s*)${property}\\s*:\\s*\\[)([\\s\\S]*?)(\\n\\2\\],?)`,
	).exec(versionsBody);
	if (!arrayMatch) {
		throw new Error(
			`Found versions config, but it has no top-level ${property}: [...] array. Update it manually.`,
		);
	}

	const existingBody = arrayMatch[3]!;
	if (exists(existingBody)) return versionsBody;

	const arrayIndent = arrayMatch[2]!;
	const updatedArray = `${arrayMatch[1]}${existingBody}${existingBody.trim().length > 0 ? "," : ""}\n${entry}\n${arrayIndent}${arrayMatch[4].trimStart()}`;
	return versionsBody.replace(arrayMatch[0], updatedArray);
}

function appendStringToBuild(
	versionsBody: string,
	value: string,
	versionsIndent: string,
) {
	const arrayMatch = /(\n(\s*)build\s*:\s*\[)([\s\S]*?)(\n\2\],?)/.exec(
		versionsBody,
	);
	if (!arrayMatch) return versionsBody;
	if (
		arrayMatch[3]!.includes(`"${value}"`) ||
		arrayMatch[3]!.includes(`'${value}'`)
	)
		return versionsBody;

	const arrayIndent = arrayMatch[2]!;
	const updatedArray = `${arrayMatch[1]}${arrayMatch[3]}${arrayMatch[3]!.trim().length > 0 ? "," : ""}\n${arrayIndent}\t"${value}"\n${arrayIndent}${arrayMatch[4]!.trimStart()}`;
	return versionsBody.replace(arrayMatch[0], updatedArray);
}

function formatVersionEntry(
	version: string,
	baseIndent: string,
	extraLevels: number,
) {
	const indent = `${baseIndent}${"\t".repeat(extraLevels)}`;
	return `${indent}{\n${indent}\tlabel: "v${version}",\n${indent}\tpath: "v${version}",\n${indent}\tdir: "versioned_docs/v${version}",\n${indent}}`;
}

function findMatchingBrace(source: string, start: number) {
	let depth = 0;

	for (let i = start; i < source.length; i += 1) {
		const char = source[i]!;

		if (char === '"' || char === "'" || char === "`") {
			i = skipString(source, i);
			continue;
		}

		if (char === "/" && source[i + 1] === "/") {
			i = skipLineComment(source, i);
			continue;
		}

		if (char === "/" && source[i + 1] === "*") {
			i = skipBlockComment(source, i);
			continue;
		}

		if (char === "{") depth += 1;
		if (char === "}") {
			depth -= 1;
			if (depth === 0) return i;
		}
	}

	throw new Error("Could not find the matching '}' token.");
}

function getLineIndent(source: string, index: number) {
	const lineStart = source.lastIndexOf("\n", index) + 1;
	const line = source.slice(lineStart, index);
	return line.match(/^\s*/)?.[0] ?? "";
}

function skipString(source: string, start: number) {
	const quote = source[start]!;
	let i = start + 1;

	while (i < source.length) {
		const char = source[i]!;
		if (char === "\\") {
			i += 2;
			continue;
		}
		if (quote === "`" && char === "$" && source[i + 1] === "{") {
			i = findMatchingBrace(source, i + 1);
			i += 1;
			continue;
		}
		if (char === quote) return i;
		i += 1;
	}

	return source.length - 1;
}

function skipLineComment(source: string, start: number) {
	const newline = source.indexOf("\n", start + 2);
	return newline === -1 ? source.length - 1 : newline;
}

function skipBlockComment(source: string, start: number) {
	const end = source.indexOf("*/", start + 2);
	return end === -1 ? source.length - 1 : end + 1;
}

async function pathExists(path: string) {
	try {
		await access(path, fsConstants.F_OK);
		return true;
	} catch {
		return false;
	}
}
