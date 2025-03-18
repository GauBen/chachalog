import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { styleText } from "node:util";
import pkg from "chachalog/package.json" with { type: "json" };
import { Builtins, Cli, Command, Option, UsageError } from "clipanion";
import * as v from "valibot";
import commentPr from "./commands/comment-pr.ts";
import doctor from "./commands/doctor.ts";
import prepareNextRelease from "./commands/prepare-next-release.ts";
import publishRelease from "./commands/publish-release.ts";
import { type Package, ReleaseTypes, type UserConfig } from "./index.ts";

/** Finds a config file in `dir`, returns its absolute path or throws. */
async function findConfigFile(dir: string) {
	const extensions = ["js", "mjs", "ts", "mts"];
	for (const file of extensions) {
		try {
			const config = path.resolve(dir, `config.${file}`);
			await fs.access(config);
			return config;
		} catch {}
	}
	throw new UsageError(`No config file found in ${dir}/config.{${extensions.join(",")}}`);
}

/** Transforms a raw config into a usable one. */
async function resolveConfig(config: UserConfig) {
	const managers = Array.isArray(config.managers)
		? await Promise.all(config.managers)
		: [await config.managers];

	const setVersion = async (pkg: Package, version: string) => {
		let updated: unknown;
		for (const manager of managers) {
			// Written as updated = ... || updated to avoid short-circuiting
			if (manager.setVersion) updated = (await manager.setVersion(pkg, version)) || updated;
		}
		if (!updated) console.error("[chachalog] setVersion failed for", pkg.name);
	};

	const packages: Package[] = [];

	// Find duplicates
	const paths = new Map<string, number>();
	const names = new Map<string, number>();

	for (const [i, manager] of managers.entries()) {
		if (!manager.packages) continue;

		for (const pkg of Array.isArray(manager.packages) ? manager.packages : [manager.packages]) {
			if (names.has(pkg.name)) {
				throw new UsageError(
					`Package "${pkg.name}" reported by managers ${names.get(pkg.name)} and ${i + 1}`,
				);
			}

			if (paths.has(pkg.path)) {
				throw new UsageError(
					`Package "${pkg.name}" at "${pkg.path}" reported by managers ${paths.get(pkg.path)} and ${i + 1}`,
				);
			}

			names.set(pkg.name, i + 1);
			paths.set(pkg.path, i + 1);
			packages.push(pkg);
		}
	}

	if (packages.length === 0) {
		throw new UsageError(
			"No packages found in the config. Try running `npx chachalog doctor` to diagnose the issue.",
		);
	}

	return {
		packages,
		setVersion,
		platform: await config.platform,
		validator: v.record(v.picklist([...names.keys()]), v.picklist(ReleaseTypes)),
	};
}

/**
 * Loads a config file in `dir`.
 *
 * We copy `dist` and `package.json` into a temporary `node_modules` folder. This allows users to
 * import `chachalog` in their config without having to install it.
 */
async function loadConfig(dir: string) {
	const configFile = await findConfigFile(dir);
	try {
		await fs.cp(
			new URL(".", import.meta.resolve("chachalog")),
			path.join(dir, "node_modules", "chachalog", "dist"),
			{ recursive: true },
		);
		await fs.copyFile(
			new URL(import.meta.resolve("chachalog/package.json")),
			path.join(dir, "node_modules", "chachalog", "package.json"),
		);
		const { default: raw } = await import(configFile);
		return raw as () => UserConfig | Promise<UserConfig>;
	} finally {
		await fs.rm(path.join(dir, "node_modules"), { recursive: true, force: true });
	}
}

/** Runs a command with a resolved config. */
export abstract class CommandWithConfig extends Command {
	dir = Option.String("-d,--dir", ".chachalog", { description: "Chachalog directory" });
	skipCommit = Option.Boolean("--skip-commit", false, { description: "Skip commiting changes" });
	config!: Awaited<ReturnType<typeof resolveConfig>>;

	async execute() {
		this.config = await loadConfig(this.dir)
			.then((fn) => fn())
			.then(resolveConfig);
		return this.executeWithConfig();
	}

	abstract executeWithConfig(): Promise<number | void>;
}

await Cli.from(
	[
		Builtins.VersionCommand,
		Builtins.HelpCommand,
		class extends CommandWithConfig {
			static paths = [["comment-pr"]];
			static usage = Command.Usage({
				category: "Commands",
				description: "Create/update the changelog comment on the active PR",
			});
			override async executeWithConfig() {
				return commentPr(this);
			}
		},
		class extends CommandWithConfig {
			static paths = [["prepare-next-release"]];
			static usage = Command.Usage({
				category: "Commands",
				description: "Create/update the next release PR",
			});
			async executeWithConfig() {
				return prepareNextRelease(this);
			}
		},
		class extends CommandWithConfig {
			static paths = [["publish-release"]];
			static usage = Command.Usage({
				category: "Commands",
				description: "Create a new release using the changelog",
			});
			async executeWithConfig() {
				return publishRelease(this);
			}
		},
		class extends Command {
			dir = Option.String("-d,--dir", ".chachalog", { description: "Chachalog directory" });
			static paths = [["doctor"]];
			static usage = Command.Usage({
				category: "Helpers",
				description: "Ensures the configuration is correct",
			});
			async execute() {
				try {
					const rawConfig = await loadConfig(this.dir);
					if (typeof rawConfig !== "function")
						console.log(styleText("red", "Config should be a function"));
					const config = typeof rawConfig === "function" ? await rawConfig() : rawConfig;
					await doctor(config);
				} catch (error) {
					console.error(styleText("redBright", "Something went wrong during diagnostic"), error);
				}
			}
		},
	],
	{
		binaryLabel: "🦜 Chachalog",
		binaryName: "chachalog",
		binaryVersion: pkg.version,
	},
).runExit(process.argv.slice(2), Cli.defaultContext);
