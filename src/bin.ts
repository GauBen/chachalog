import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { styleText } from "node:util";
import pkg from "chachalog/package.json" with { type: "json" };
import { Builtins, Cli, Command, Option, UsageError } from "clipanion";
import semver from "semver";
import commentPr from "./commands/comment-pr.ts";
import doctor from "./commands/doctor.ts";
import prepareNextRelease from "./commands/prepare-next-release.ts";
import prompt from "./commands/prompt.ts";
import publishRelease from "./commands/publish-release.ts";
import { type Package, ReleaseTypes, type UserConfig } from "./index.ts";

/** A promise to the latest version of Chachalog if greater than the current one. */
const latestVersion = fetch("https://registry.npmjs.org/chachalog/latest", {
	signal: AbortSignal.timeout(1000),
})
	.then((response) => {
		if (!response.ok) throw new Error("Network response was not ok");
		return response.json();
	})
	.then((data: { version: string }) => (semver.gt(data.version, pkg.version) ? data.version : null))
	.catch(() => null);

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
async function resolveLocalConfig(config: UserConfig) {
	// Ignore the rejection if platform fails to initialize
	Promise.resolve(config.platform).catch(() => {});

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

	const allowedBumps = Array.isArray(config.allowedBumps)
		? config.allowedBumps
		: config.allowedBumps
			? [config.allowedBumps]
			: ReleaseTypes;

	const bumpTitles: Record<ReleaseTypes, string> = {
		major: "Breaking Changes",
		premajor: "Upcoming Breaking Changes",
		minor: "New Features",
		preminor: "Upcoming New Features",
		patch: "Bug Fixes",
		prepatch: "Upcoming Bug Fixes",
		prerelease: "Upcoming Changes",
		...config.bumpTitles,
	};

	return {
		packages,
		setVersion,
		allowedBumps,
		bumpTitles,
		releaseBranch: config.releaseBranch ?? "release",
		releaseMessage: config.releaseMessage ?? "chore: release",
		prereleaseIdentifier: config.prereleaseIdentifier ?? "next",
		prereleaseIdentifierBase: config.prereleaseIdentifierBase ?? "1",
		getChangelogFile: config.getChangelogFile ?? ((pkg) => path.join(pkg.path, "CHANGELOG.md")),
		getNewChangelog: config.getNewChangelog ?? ((pkg) => `# ${pkg.name} Changelog\n`),
		validator: (bumps: unknown) => {
			const result: Record<string, ReleaseTypes> = {};
			if (typeof bumps !== "object" || !bumps) throw new Error("frontmatter should be an object");
			const errors: string[] = [];
			for (const [key, value] of Object.entries(bumps)) {
				if (!names.has(key)) errors.push(`package "${key}" not found`);
				if (!allowedBumps.includes(value as ReleaseTypes))
					errors.push(`bump "${value}" for package "${key}" is invalid`);
				result[key] = value as ReleaseTypes;
			}
			if (errors.length > 0) throw new Error(errors.join(", "));
			return result;
		},
	};
}

/** Transforms a raw config into a usable one. */
async function resolveConfig(config: UserConfig) {
	return {
		...(await resolveLocalConfig(config)),
		platform: await config.platform,
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

/** Runs a command with a resolved local config (not platform). */
export abstract class CommandWithLocalConfig extends Command {
	dir = Option.String("-d,--dir", ".chachalog", { description: "Chachalog directory" });
	config!: Awaited<ReturnType<typeof resolveLocalConfig>>;

	async execute() {
		this.config = await loadConfig(this.dir)
			.then((fn) => fn())
			.then(resolveLocalConfig);
		return this.executeWithLocalConfig();
	}

	abstract executeWithLocalConfig(): Promise<number | void>;
}

/** Runs a command with a resolved config. */
export abstract class CommandWithConfig extends Command {
	dir = Option.String("-d,--dir", ".chachalog", { description: "Chachalog directory" });
	skipCommit = Option.Boolean("--skip-commit", false, { description: "Skip commiting changes" });
	config!: Awaited<ReturnType<typeof resolveConfig>>;
	latestVersion = latestVersion;

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
					const config = await loadConfig(this.dir).then((fn) => fn());
					await doctor(config);
				} catch (error) {
					console.error(styleText("redBright", "Something went wrong during diagnostic"), error);
				}
			}
		},
		class extends CommandWithLocalConfig {
			static paths = [["prompt"]];
			static usage = Command.Usage({
				category: "Helpers",
				description: "Interactively create a new changelog entry",
			});
			async executeWithLocalConfig() {
				await prompt(this);
			}
		},
	],
	{
		binaryLabel: "🦜 Chachalog",
		binaryName: "chachalog",
		binaryVersion: pkg.version,
	},
).runExit(process.argv.slice(2), Cli.defaultContext);
