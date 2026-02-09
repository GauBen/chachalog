# chachalog Changelog

## 0.5.0

* **Breaking change**: dropped support for Node.js versions below 24. (#56)

  GitHub has a new image more suited for repository tasks, [`ubuntu-slim`](https://github.com/actions/runner-images/blob/main/images/ubuntu-slim/ubuntu-slim-Readme.md), and it's the new target of Chachalog.

  You can upgrade your CI files manually or run `npm init @chachalog@latest` to create fresh ones.

## 0.4.4

* Republish with provenance.

## 0.4.3

* Bump all dependencies. (#47)

## 0.4.2

* Added new `chachalog apply-next-versions` to make nightlies easier to implement.

* `yarn()` accepts a custom mutation function, used during bumps: `updateWorkspace`.

## 0.4.1

This release is the first release to include user-requested features!

*(this text was set in `.chachalog/intro.md`)*

* New command `chachalog delete-pr-comment` to remove Chachalog comment created by `comment-pr`.

* Introducing a new, special changelog entry: `intro.md`. (#41)

  If an `intro.md` file exists, it will be used to introduce the upcoming release of all packages to be released:

  ```md
  <!-- intro.md -->

  # foo

  This major release...
  ```

  This line will be inserted in the `CHANGELOG.md` file for `foo`:

  ```md
  <!-- foo/CHANGELOG.md -->

  # foo Changelog

  ## 2.0.0

  This major release...

  (rest of the changelog)
  ```

  See #31 for the original feature request.

## 0.4.0

* Removed `--skip-commit` CLI flag. (#38)

* `releaseBranch` and `releaseMessage` options moved from root level to `github()`. (#38)

  ```diff
   export default defineConfig(() => ({
     allowedBumps: ["patch", "minor", "major"],
  -  releaseMessage: "chore: release",
     platform: github({
  +    releaseMessage: "chore: release"
     }),
     managers: yarn()
   }));
  ```

## 0.3.16

* Reference the head repo rather than the base repo in PR comment.

## 0.3.15

* Move to `pull_request_target` event to circumvent permission issues. (#35)

## 0.3.14

* Support running chachalog in forks. (#33)

## 0.3.13

* In GitHub workflows, write `changelogEntries` output variable.

## 0.3.12

* Ignore changes in the `.chachalog` directory in bump suggestions.

## 0.3.11

* Ensure all pnpm dependencies are properly bundled. (#25)

## 0.3.10

* Suggest all packages in frontmatter comment.

## 0.3.9

* Promote prompt in PR comment.

* Properly group multi-line entries.

## 0.3.8

* Make `bumpTitles` optional in config file type.

## 0.3.7

* Prevent the prompt from creating empty entries.

## 0.3.6

* Suggest latest version in PR body.

* Support prereleases. (#20)

## 0.3.5

* Changelog path, default and release branches, commit message are now configurable.

* Make bump titles configurable, with good defaults.

* Release PR body contains formatted bump details.

## 0.3.4

* Suggest packages and bumps in PR comment. (#16)

* More detailed PR comment. (#15)

## 0.3.3

* New option: `allowedBumps` to restrict semver bumps.

## 0.3.2

* New command `npx chachalog prompt` to choose bumps locally.

## 0.3.1

* Report duplicate packages in `npx chachalog doctor`. (#10)

* Group changelog entries per release type (major, minor, patch...) in the CHANGELOG.md file.

## 0.3.0

### Breaking changes

* Platform must return files as `Map<string, string>`.

* Remove `prefix` and `stringifyPackage`.

### Other changes

* Package names and version bumps are now validated in changelog entries.

* Prevent superfluous whitespace in changelogs.

## 0.2.0

### Breaking changes

* Configuration must now be a function: `defineConfig(() => config)`

### Other changes

* New command: `chachalog doctor`, to help check the configuration (#5)

## 0.1.2

* Properly extract release notes from the changelog.

## 0.1.1

* pnpm is now supported: `import pnpm from "chachalog/pnpm"` (#2)

## 0.1.0

* Welcome Chachalog!
