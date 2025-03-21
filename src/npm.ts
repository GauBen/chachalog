import process from "node:process";
import { readFile, writeFile } from "node:fs/promises"
import path from 'node:path'
import type { Manager } from "./index.ts";

/** npm plugin. Suppports package.json. */
export default async function npm({
	cwd = process.cwd(),
}: {
	/** Current working directory. */
	cwd?: string;
} = {}): Promise<Manager> {
	const manifest = await readFile(path.join(cwd, "package.json")).then(contents => JSON.parse(contents))

	return {
		packages: [manifest.name],
		async setVersion(pkg, version) {
			if (pkg !== manifest.name) throw new Error(`NPM does not support monorepos. You can only set the version of the root package, ${JSON.stringify(manifest.name)}.`)
			manifest.version = version
			await writeFile(path.join(cwd, "package.json"), JSON.stringify(manifest))
			return true;
		},
	};
}
