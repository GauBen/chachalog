import { type Mock, mock } from "node:test";
import { CommandWithConfig, resolveConfig } from "./config.ts";
import type { Platform, UserConfig } from "./index.ts";

export const createMockPlatform = (custom: Partial<Platform> = {}) =>
	({
		email: "chachalog@example.com",
		username: "chachalog",
		createChangelogEntryLink: mock.fn((filename: string, content: string) => "https://example.com"),
		createRelease: mock.fn(),
		getChangelogEntries: mock.fn(() => ({
			title: "feat: hello world",
			entries: new Map(),
			changedPackages: new Set(),
		})),
		upsertChangelogComment: mock.fn(),
		upsertReleasePr: mock.fn(),
		...custom,
	}) as {
		[Key in keyof Platform]: Platform[Key] extends Function ? Mock<Platform[Key]> : Platform[Key];
	};

export const createContext = async (
	config: UserConfig,
): Promise<InstanceType<typeof CommandWithConfig>> => {
	const resolved = await resolveConfig(config);
	return new (class extends CommandWithConfig {
		config = resolved;
		dir = "custom";
		async executeWithConfig() {}
	})();
};
