import type { CommandWithConfig } from "../config.ts";

export default async function deletePrComment({ config }: CommandWithConfig) {
  await config.platform.deleteChangelogComment();
}
