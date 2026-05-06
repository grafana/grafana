# Serialization Versioning: Semantic Versioning for databases

Semantic Versioning, commonly known as SemVer, is a great idea that has been very widely adopted as
a way to decide how to name software versions. The whole concept is very well summarized on
semver.org with the following lines:

> Given a version number MAJOR.MINOR.PATCH, increment the:
>
> 1. MAJOR version when you make incompatible API changes,
> 2. MINOR version when you add functionality in a backwards-compatible manner, and
> 3. PATCH version when you make backwards-compatible bug fixes.
>
> Additional labels for pre-release and build metadata are available as extensions to the
> MAJOR.MINOR.PATCH format.

Unfortunately, API changes are not the most important changes for libraries that serialize data for
later consumption. For these libraries, such as BadgerDB, changes to the API are much easier to
handle than change to the data format used to store data on disk.

## Serialization Version specification

Serialization Versioning, like Semantic Versioning, uses 3 numbers and also calls them
MAJOR.MINOR.PATCH, but the semantics of the numbers are slightly modified:

Given a version number MAJOR.MINOR.PATCH, increment the:

- MAJOR version when you make changes that require a transformation of the dataset before it can be
  used again.
- MINOR version when old datasets are still readable but the API might have changed in
  backwards-compatible or incompatible ways.
- PATCH version when you make backwards-compatible bug fixes.

Additional labels for pre-release and build metadata are available as extensions to the
MAJOR.MINOR.PATCH format.

Following this naming strategy, migration from v1.x to v2.x requires a migration strategy for your
existing dataset, and as such has to be carefully planned. Migrations in between different minor
versions (e.g. v1.5.x and v1.6.x) might break your build, as the API _might_ have changed, but once
your code compiles there's no need for any data migration. Lastly, changes in between two different
patch versions should never break your build or dataset.

For more background on our decision to adopt Serialization Versioning, read the blog post [Semantic
Versioning, Go Modules, and Databases][blog] and the original proposal on [this comment on Dgraph's
Discuss forum][discuss].

[blog]: https://open.dgraph.io/post/serialization-versioning/
[discuss]: https://discuss.dgraph.io/t/go-modules-on-badger-and-dgraph/4662/7
