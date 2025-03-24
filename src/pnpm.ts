import process from "node:process";
import { findWorkspacePackagesNoCheck, type Project } from "@pnpm/workspace.find-packages";
import { readWorkspaceManifest } from "@pnpm/workspace.read-manifest";
import type { Manager, Package } from "./index.ts";

/** pnpm plugin. Suppports pnpm-workspaces.yaml and package.{json,json5,yaml} files. */
export default async function pnpm({
	cwd = process.cwd(),
}: {
	/** Current working directory. */
	cwd?: string;
} = {}): Promise<Manager> {
	const workspaceManifest = await readWorkspaceManifest(cwd);
	const allProjects = await findWorkspacePackagesNoCheck(cwd, {
		patterns: workspaceManifest?.packages,
	});
	const packages = allProjects
		.filter((ws): ws is Project & { manifest: { name: string; version: string } } =>
			Boolean(ws.manifest.name && !ws.manifest.private && ws.manifest.version),
		)
		.map<[Package, (version: string) => Promise<void>]>((project) => [
			{
				name: project.manifest.name,
				version: project.manifest.version,
				path: project.rootDirRealPath,
			},
			(version) => project.writeProjectManifest({ ...project.manifest, version }),
		]);
	const map = new WeakMap(packages);

	return {
		packages: packages.map(([pkg]) => pkg),
		async setVersion(pkg, version) {
			const write = map.get(pkg);
			if (!write) return;
			await write(version);
			return true;
		},
	};
}
