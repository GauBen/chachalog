import path from "node:path";
import { fileURLToPath } from "node:url";
import { styleText } from "node:util";
import type { Platform, UserConfig } from "../index.ts";

export default async function doctor(config: UserConfig) {
	if (!config.platform) throw new Error("Missing platform in config");
	await Promise.resolve(config.platform).then(
		(platform) => {
			console.log(styleText("bgGreenBright", "Platform loaded successfully:"));
			const checks: {
				[key in keyof Platform]: Platform[key] extends Function
					? "function"
					: Platform[key] extends string
						? "string"
						: never;
			} = {
				createChangelogEntryLink: "function",
				createRelease: "function",
				email: "string",
				getChangelogEntries: "function",
				upsertChangelogComment: "function",
				upsertReleasePr: "function",
				username: "string",
			};
			let ok = true;
			for (const [key, check] of Object.entries(checks)) {
				const type = typeof platform[key as keyof Platform];
				ok &&= type === check;
				if (type === check) console.log(`  . ${key} is defined.`);
				else
					console.log(
						styleText(
							"redBright",
							`  x ${key} is not defined correctly, expected ${check}, received ${type}.`,
						),
					);
			}
			if (!ok) console.log(styleText("redBright", "Platform is not fully defined."));
		},
		(error: Error) => {
			console.log(styleText("bgRedBright", "Platform defined but failed to load:"));
			console.log(
				styleText("redBright", `  ${String(error.message ?? error).replaceAll("\n", "\n  ")}`),
			);
			console.log(
				styleText("dim", "  If you are running Chachalog locally, this might be expected."),
			);
			// Because of bundling, the stack trace is not very useful. Try to extract the file and line.
			const matches = error.stack?.match(/at (file:\/\/.+):(\d+):(\d+)\n/);
			if (matches) {
				const [fileURL, line, column] = matches.slice(1);
				const file = fileURLToPath(fileURL);
				console.log(
					`${styleText("dim", "  Platform defined in ")}${path.relative(process.cwd(), file)}${styleText("dim", `:${line}:${column}`)}`,
				);
			}
		},
	);
	const output = [];
	for (const [i, manager] of Array.isArray(config.managers)
		? config.managers.entries()
		: [config.managers].entries()) {
		output.push(
			Promise.resolve(manager).then(
				(manager) => {
					const managerType = typeof manager;
					if (managerType !== "object") {
						return [
							styleText("bgRedBright", `Manager #${i + 1} failed to load:`),
							styleText("redBright", `  Expected object, received ${managerType}.`),
						];
					}

					const logs: string[] = [];
					logs.push(styleText("bgGreenBright", `Manager #${i + 1} loaded successfully:`));
					const packages = Array.isArray(manager.packages)
						? manager.packages
						: manager.packages
							? [manager.packages]
							: [];
					logs.push(
						styleText(
							packages.length > 0 ? "reset" : "dim",
							`  . ${packages.length} packages found.`,
						),
					);
					for (const pkg of packages) {
						logs.push(`    . ${pkg.name}${styleText("dim", `@${pkg.version} in ${pkg.path}`)}`);
					}
					const setVersionType = typeof manager.setVersion;
					if (setVersionType === "function") {
						logs.push("  . setVersion is defined.");
					} else if (setVersionType === "undefined") {
						logs.push(styleText("dim", "  . setVersion is not defined."));
					} else {
						logs.push(
							styleText(
								"redBright",
								`  x setVersion is not a function, received ${setVersionType}.`,
							),
						);
					}

					if (packages.length === 0 && setVersionType === "undefined")
						logs.push(styleText("redBright", "  Manager is not defined."));
					return logs;
				},
				(error: Error) => {
					return [
						styleText("bgRedBright", `Manager #${i + 1} failed to load:`),
						...String(error.message ?? error)
							.split("\n")
							.map((line) => styleText("redBright", `  ${line}`)),
					];
				},
			),
		);
	}
	for (const logs of await Promise.all(output)) console.log([logs].flat().join("\n"));
}
