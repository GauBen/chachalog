---
"@chachalog": minor
---

Allow `npx chachalog prompt` to work without a configuration file. When no config exists, users can now create changelog entries without specifying version bumps. The command will display a yellow warning and create entries in the `.chachalog/` directory with empty version information.
