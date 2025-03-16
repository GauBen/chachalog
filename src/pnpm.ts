import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { type Project, findWorkspacePackagesNoCheck } from "@pnpm/workspace.find-packages";
import { readWorkspaceManifest } from "@pnpm/workspace.read-manifest";
import type { Manager, Package } from "./index.ts";

export default async function pnpm({ cwd = process.cwd() }: { cwd?: string }): Promise<Manager> {
	const workspaceManifest = await readWorkspaceManifest(cwd);
	const allProjects = await findWorkspacePackagesNoCheck(cwd, {
		patterns: workspaceManifest?.packages,
	});
	const packages: Package[] = allProjects
		.filter((ws): ws is Project & { manifest: { name: string; version: string } } =>
			Boolean(ws.manifest.name && !ws.manifest.private && ws.manifest.version),
		)
		.map((project) => ({
			prefix: "npm",
			name: project.manifest.name,
			version: project.manifest.version,
			path: project.rootDirRealPath,
		}));
	const weakSet = new WeakSet(packages);

	return {
		packages,
		async setVersion(pkg, version) {
			if (!weakSet.has(pkg)) return;
			const file = path.join(pkg.path, "package.json");
			const previous = await fs.readFile(file, "utf8");
			// Update the version with a regex to preserve formatting
			const updated = previous.replace(/("version"\s*:\s*")([^"]*)(")/, `$1${version}$3`);
			await fs.writeFile(file, updated);
			return true;
		},
	};
}
