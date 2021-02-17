# Releasing

## Determine which module to release

The Go client libraries have several modules. Each module does not strictly
correspond to a single library - they correspond to trees of directories. If a
file needs to be released, you must release the closest ancestor module.

To see all modules:

```bash
$ cat `find . -name go.mod` | grep module
module cloud.google.com/go/pubsub
module cloud.google.com/go/spanner
module cloud.google.com/go
module cloud.google.com/go/bigtable
module cloud.google.com/go/bigquery
module cloud.google.com/go/storage
module cloud.google.com/go/pubsublite
module cloud.google.com/go/firestore
module cloud.google.com/go/logging
module cloud.google.com/go/internal/gapicgen
module cloud.google.com/go/internal/godocfx
module cloud.google.com/go/internal/examples/fake
module cloud.google.com/go/internal/examples/mock
module cloud.google.com/go/datastore
```

The `cloud.google.com/go` is the repository root module. Each other module is
a submodule.

So, if you need to release a change in `bigtable/bttest/inmem.go`, the closest
ancestor module is `cloud.google.com/go/bigtable` - so you should release a new
version of the `cloud.google.com/go/bigtable` submodule.

If you need to release a change in `asset/apiv1/asset_client.go`, the closest
ancestor module is `cloud.google.com/go` - so you should release a new version
of the `cloud.google.com/go` repository root module. Note: releasing
`cloud.google.com/go` has no impact on any of the submodules, and vice-versa.
They are released entirely independently.

## Test failures

If there are any test failures in the Kokoro build, releases are blocked until
the failures have been resolved.

## How to release

### Automated Releases (`cloud.google.com/go` and submodules)

We now use [release-please](https://github.com/googleapis/release-please) to
perform automated releases for `cloud.google.com/go` and all submodules.

1. If there are changes that have not yet been released, a
   [pull request](https://github.com/googleapis/google-cloud-go/pull/2971) will
   be automatically opened by release-please
   with a title like "chore: release X.Y.Z" (for the root module) or 
   "chore: release datastore X.Y.Z" (for the datastore submodule), where X.Y.Z 
   is the next version to be released. Find the desired pull request
   [here](https://github.com/googleapis/google-cloud-go/pulls)
1. Check for failures in the
   [continuous Kokoro build](http://go/google-cloud-go-continuous). If there are
   any failures in the most recent build, address them before proceeding with
   the release. (This applies even if the failures are in a different submodule
   from the one being released.)
1. Review the release notes. These are automatically generated from the titles
   of any merged commits since the previous release. If you would like to edit
   them, this can be done by updating the changes in the release PR.
1. To cut a release, approve and merge the pull request. Doing so will
   update the `CHANGES.md`, tag the merged commit with the appropriate version,
   and draft a GitHub release which will copy the notes from `CHANGES.md`.

### Manual Release (`cloud.google.com/go`)

If for whatever reason the automated release process is not working as expected,
here is how to manually cut a release of `cloud.google.com/go`.

1. Check for failures in the
   [continuous Kokoro build](http://go/google-cloud-go-continuous). If there are
   any failures in the most recent build, address them before proceeding with
   the release.
1. Navigate to `google-cloud-go/` and switch to master.
1. `git pull`
1. Run `git tag -l | grep -v beta | grep -v alpha` to see all existing releases.
   The current latest tag `$CV` is the largest tag. It should look something
   like `vX.Y.Z` (note: ignore all `LIB/vX.Y.Z` tags - these are tags for a
   specific library, not the module root). We'll call the current version `$CV`
   and the new version `$NV`.
1. On master, run `git log $CV...` to list all the changes since the last
   release. NOTE: You must manually visually parse out changes to submodules [1]
   (the `git log` is going to show you things in submodules, which are not going
   to be part of your release).
1. Edit `CHANGES.md` to include a summary of the changes.
1. In `internal/version/version.go`, update `const Repo` to today's date with
   the format `YYYYMMDD`.
1. In `internal/version` run `go generate`.
1. Commit the changes, ignoring the generated `.go-r` file. Push to your fork,
   and create a PR titled `chore: release $NV`.
1. Wait for the PR to be reviewed and merged. Once it's merged, and without
   merging any other PRs in the meantime:
   a. Switch to master.
   b. `git pull`
   c. Tag the repo with the next version: `git tag $NV`.
   d. Push the tag to origin:
      `git push origin $NV`
1. Update [the releases page](https://github.com/googleapis/google-cloud-go/releases)
   with the new release, copying the contents of `CHANGES.md`.

### Manual Releases (submodules)

If for whatever reason the automated release process is not working as expected,
here is how to manually cut a release of a submodule.

(these instructions assume we're releasing `cloud.google.com/go/datastore` - adjust accordingly)

1. Check for failures in the
   [continuous Kokoro build](http://go/google-cloud-go-continuous). If there are
   any failures in the most recent build, address them before proceeding with
   the release. (This applies even if the failures are in a different submodule
   from the one being released.)
1. Navigate to `google-cloud-go/` and switch to master.
1. `git pull`
1. Run `git tag -l | grep datastore | grep -v beta | grep -v alpha` to see all
   existing releases. The current latest tag `$CV` is the largest tag. It
   should look something like `datastore/vX.Y.Z`. We'll call the current version
   `$CV` and the new version `$NV`.
1. On master, run `git log $CV.. -- datastore/` to list all the changes to the
   submodule directory since the last release.
1. Edit `datastore/CHANGES.md` to include a summary of the changes.
1. In `internal/version` run `go generate`.
1. Commit the changes, ignoring the generated `.go-r` file. Push to your fork,
   and create a PR titled `chore(datastore): release $NV`.
1. Wait for the PR to be reviewed and merged. Once it's merged, and without
   merging any other PRs in the meantime:
   a. Switch to master.
   b. `git pull`
   c. Tag the repo with the next version: `git tag $NV`.
   d. Push the tag to origin:
      `git push origin $NV`
1. Update [the releases page](https://github.com/googleapis/google-cloud-go/releases)
   with the new release, copying the contents of `datastore/CHANGES.md`.
