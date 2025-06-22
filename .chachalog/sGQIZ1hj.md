---
# Allowed version bumps: patch, minor, major
chachalog: patch
# "@chachalog/create": minor
# "@chachalog/types": minor
---

Introducing a new, special changelog entry: `intro.md`. (#41)

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
