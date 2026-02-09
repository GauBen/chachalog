import { type Mock, mock } from "node:test";
import {
  CommandWithConfig,
  CommandWithLocalConfig,
  resolveConfig,
  resolveLocalConfig,
} from "./config.ts";
import type { Platform, UserConfig } from "./index.ts";

export const createMockPlatform = (custom: Partial<Platform> = {}) =>
  ({
    email: "chachalog@example.com",
    username: "chachalog",
    createChangelogEntryLink: mock.fn(() => "https://example.com"),
    createRelease: mock.fn(),
    getChangelogEntries: mock.fn(() => ({
      title: "feat: hello world",
      entries: new Map(),
      changedPackages: new Set(),
    })),
    upsertChangelogComment: mock.fn(),
    deleteChangelogComment: mock.fn(),
    upsertReleasePr: mock.fn(),
    ...custom,
  }) as {
    [Key in keyof Platform]: Platform[Key] extends Function ? Mock<Platform[Key]> : Platform[Key];
  };

export const createContext = async (
  config: UserConfig,
  { dir = "custom", latestVersion = null }: { dir?: string; latestVersion?: string | null } = {},
): Promise<CommandWithConfig> => {
  const resolved = await resolveConfig(config);
  return new (class extends CommandWithConfig {
    config = resolved;
    dir = dir;
    latestVersion = Promise.resolve(latestVersion);
    async executeWithConfig() {}
  })();
};

export const createLocalContext = async (
  config: Omit<UserConfig, "platform">,
  { dir = "custom" }: { dir?: string } = {},
): Promise<CommandWithLocalConfig> => {
  const resolved = await resolveLocalConfig({ ...config, platform: createMockPlatform() });
  return new (class extends CommandWithLocalConfig {
    config = resolved;
    dir = dir;
    async executeWithLocalConfig() {}
  })();
};
