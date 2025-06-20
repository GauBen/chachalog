type MaybePromise<T> = T | Promise<T>;
type MaybeArray<T> = T | T[];

export interface Platform {
	/** Account name to use when creating git commits. */
	username: string;
	/** Email address to use when creating git commits. */
	email: string;
	/** Creates a link that prompts the user to create a changelog entry starting with `frontmatter`. */
	createChangelogEntryLink: (filename: string, content: string) => MaybePromise<string>;
	/** Creates or updates a comment on the active PR. */
	upsertChangelogComment: (body: string) => MaybePromise<void>;
	/** Gets the changelog entries from the active PR. */
	getChangelogEntries: (
		dir: string,
		packagePaths: Array<[string, string]>,
	) => MaybePromise<{ title: string; entries: Map<string, string>; changedPackages: Set<string> }>;
	/** Creates a PR for the next release. */
	upsertReleasePr: (body: string) => MaybePromise<void>;
	/** Creates a release. Will be called on every commit, ensure it is idempotent. */
	createRelease: (tag: string, title: string, body: string) => MaybePromise<void>;
}

export interface Package {
	/** Package name. */
	name: string;
	/** Package version. */
	version: string;
	/** Absolute path to the package. */
	path: string;
}

export interface Manager {
	/** List of packages exported by this manager. */
	packages?: MaybeArray<Package>;
	/**
	 * Updates the version of a package.
	 *
	 * Return a truthy value to indicate that the version was updated.
	 */
	setVersion?: ((pkg: Package, version: string) => unknown) | undefined;
}

export interface UserConfig {
	/** List of allowed semver bumps. Defaults to all. */
	allowedBumps?: ReleaseTypes | [ReleaseTypes, ...ReleaseTypes[]];
	/** Title to use for each release type. */
	bumpTitles?: Partial<Record<ReleaseTypes, string>>;
	/** Platform (git host) to use. */
	platform: MaybePromise<Platform>;
	/** List of package managers. */
	managers: MaybeArray<MaybePromise<Manager>>;
	/** Prerelease identifier to use when creating a prerelease, default to `next`. */
	prereleaseIdentifier?: string;
	/** Base prerelease identifier to use when creating a prerelease, default to `1`. */
	prereleaseIdentifierBase?: "1" | "0";
	/**
	 * Returns the path to the changelog file for a package.
	 *
	 * @default `pkg => path.join(pkg.path, "CHANGELOG.md")`
	 */
	getChangelogFile?: (pkg: Package) => MaybePromise<string>;
	/**
	 * Returns a changelog initialized for a package.
	 *
	 * @default `pkg => `# ${pkg.name} Changelog\n``
	 */
	getNewChangelog?: (pkg: Package) => MaybePromise<string>;
}

export function defineConfig(config: () => MaybePromise<UserConfig>) {
	return config;
}

/** Re-export from semver, but that treeshakes. */
export const ReleaseTypes = [
	"major",
	"premajor",
	"minor",
	"preminor",
	"patch",
	"prepatch",
	"prerelease",
] as const;

export type ReleaseTypes = (typeof ReleaseTypes)[number];
