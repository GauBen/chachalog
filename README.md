# 🦜 Chachalog

The modern changelog generator.

## Workflow

Here's what to expect when using Chachalog:

1. Create a new branch for your changes, as you normally would.

2. Open a pull request to merge your changes into the main branch.

3. **Chachalog will comment your pull request to invite you to write a changelog entry.**

4. Add a changelog entry by clicking the link in the comment. This entry also contains the expected version bump associated with your changes.

5. When ready, merge your pull request.

6. **Chachalog will collect all changelog entries and open a pull request.** This pull request will contain the updated changelog and the version bump.

7. When your release is ready, merge the changelog pull request.

8. **Chachalog will create a new release with the updated changelog.**

9. Celebrate! 🎉

All Chachalog features are opt-in. You can choose the features you want during the installation process, or at any time by editing the workflow files.

## Installation

The best way to install Chachalog is by running `npm init @chachalog` in your project directory. The CLI will guide you through the installation process.

If you are using TypeScript, add `@chachalog/types` to your `devDependencies` to get type definitions.

Don't forget to check **Allow GitHub Actions to create and approve pull requests** in Settings > Actions to enable Chachalog to submit pull requests.

Run `npx chachalog doctor` to check if everything is set up correctly.

## Why Chachalog?

Chachalog is a modern take on changelog editing. Its workflow is largely inspired by [Changesets](https://github.com/changesets/changesets), but tries to address some of its shortcomings:

- No need to install a GitHub application, no need to install it to repositories individually. Just run `npx chachalog` in your workflows and you're good to go.

- Fully typed config file, with types shipped separately from the CLI.

- Pluggable. Yarn and pnpm are not hard-coded into the CLI, but implemented as plugins. Because the plugins actually use `@yarnpkg/core` and `@pnpm/core`, they are guaranteed to behave exactly like the real package managers.

- Does not publish packages to a registry. This feature is already covered by package managers, no need to reimplement it.

- Not tied to a specific language or ecosystem. Other package managers/other languages can be supported by implementing a plugin.

## Plugins

Chachalog is designed to be extensible. It ships with some plugins:

- `chachalog/yarn`: Yarn plugin, based on [`@yarnpkg/core`](https://npmjs.com/package/@yarnpkg/core). Supports monorepos with package.json workspaces. Compatible with npm.

- `chachalog/pnpm`: pnpm plugin, based on [`@pnpm/core`](https://npmjs.com/package/@pnpm/core). Supports monorepos with `pnpm-workspace.yaml`. Supports `package.{json,json5,yaml}`, as pnpm does.

- `chachalog/github`: GitHub plugin, based on [`@octokit/core`](https://npmjs.com/package/@octokit/core). Supports creating pull requests and comments.

---

Chachalog is named after chachalacas, a bird species native to the Americas.
