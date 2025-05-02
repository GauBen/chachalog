# chachalog Changelog

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
