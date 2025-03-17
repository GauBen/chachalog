import process from "node:process";
import { Configuration, type Ident, Project, type Workspace } from "@yarnpkg/core";
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
	const packages = project.workspaces
		.filter((ws): ws is Workspace & { manifest: { name: Ident; version: string } } =>
			Boolean(ws.manifest.name && !ws.manifest.private && ws.manifest.version),
		)
		.map<[Package, (version: string) => Promise<void>]>((ws) => [
			{
				prefix: "npm",
				name: stringifyIdent(ws.manifest.name),
				version: ws.manifest.version,
				path: npath.fromPortablePath(ws.cwd),
			},
			async (version) => {
				ws.manifest.version = version;
				await ws.persistManifest();
			},
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
