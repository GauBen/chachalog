# chachalog Changelog

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
