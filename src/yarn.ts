import fs from "node:fs/promises";
import process from "node:process";
import { Configuration, type Ident, Manifest, Project, type Workspace } from "@yarnpkg/core";
import { stringifyIdent } from "@yarnpkg/core/structUtils";
import { npath } from "@yarnpkg/fslib";
import type { Manager, Package } from "./index.ts";

export default async function yarn({
	cwd = process.cwd(),
}: {
	/**
	 * Current working directory.
	 *
	 * MUST NOT END WITH `/`, or Yarn will not be able to resolve workspaces. */
	cwd?: string;
} = {}): Promise<Manager> {
	if (cwd.endsWith("/"))
		console.error("[chachalog/yarn] cwd must not end with `/`, value: %s", cwd);

	const configuration = await Configuration.find(npath.toPortablePath(cwd), null, {
		strict: false,
	});
	const { project } = await Project.find(configuration, npath.toPortablePath(cwd));
	const packages: Package[] = project.workspaces
		.filter((ws): ws is Workspace & { manifest: { name: Ident; version: string } } =>
			Boolean(ws.manifest.name && !ws.manifest.private && ws.manifest.version),
		)
		.map(({ cwd, manifest }) => ({
			prefix: "npm",
			name: stringifyIdent(manifest.name),
			version: manifest.version,
			path: npath.fromPortablePath(cwd),
		}));
	const weakSet = new WeakSet(packages);

	return {
		packages,
		async setVersion(pkg, version) {
			if (!weakSet.has(pkg)) return;
			const file = npath.join(pkg.path, Manifest.fileName);
			const previous = await fs.readFile(file, "utf8");
			// Update the version with a regex to preserve formatting
			const updated = previous.replace(/("version"\s*:\s*")([^"]*)(")/, `$1${version}$3`);
			await fs.writeFile(file, updated);
			return true;
		},
	};
}
