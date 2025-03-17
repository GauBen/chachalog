type MaybePromise<T> = T | Promise<T>;
type MaybeArray<T> = T | T[];

export interface Platform {
	/** Account name to use when creating git commits. */
	username: string;
	/** Email address to use when creating git commits. */
	email: string;
	/** Creates a link that prompts the user to create a changelog entry starting with `frontmatter`. */
	createChangelogEntryLink: (filename: string, frontmatter: string) => MaybePromise<string>;
	/** Creates or updates a comment on the active PR. */
	upsertChangelogComment: (body: string) => MaybePromise<void>;
	/** Gets the changelog entries from the active PR. */
	getChangelogEntries: (dir: string) => MaybePromise<string[]>;
	/** Creates a PR for the next release. */
	upsertReleasePr: (title: string, body: string) => MaybePromise<void>;
	/** Creates a release. Will be called on every commit, ensure it is idempotent. */
	createRelease: (tag: string, title: string, body: string) => MaybePromise<void>;
}

export interface Package {
	/** Package format prefix. */
	prefix: string;
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
	managers: MaybeArray<MaybePromise<Manager>>;
	platform: MaybePromise<Platform>;
}

export function defineConfig(config: () => MaybePromise<UserConfig>) {
	return config;
}

export function stringifyPackage(pkg: Package) {
	return `${pkg.prefix}:${pkg.name}`;
}
