#!/usr/bin/env node
import process from "node:process";
import { styleText } from "node:util";
import pkg from "chachalog/package.json" with { type: "json" };
import { Builtins, Cli, Command, Option } from "clipanion";
import commentPr from "./commands/comment-pr.ts";
import doctor from "./commands/doctor.ts";
import prepareNextRelease from "./commands/prepare-next-release.ts";
import prompt from "./commands/prompt.ts";
import publishRelease from "./commands/publish-release.ts";
import { CommandWithConfig, CommandWithLocalConfig, loadConfig } from "./config.ts";

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
