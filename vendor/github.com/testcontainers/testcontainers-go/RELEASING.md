# Releasing Testcontainers for Go

In order to create a release, we have added a shell script that performs all the tasks for you, allowing a dry-run mode for checking it before creating the release. We are going to explain how to use it in this document.

## Prerequisites

First, it's really important that you first check that the [version.go](./internal/version.go) file is up-to-date, containing the right version you want to create. That file will be used by the automation to perform the release.
Once the version file is correct in the repository:

Second, check that the git remote for the `origin` is pointing to `github.com/testcontainers/testcontainers-go`. You can check it by running:

```shell
git remote -v
```

## Prepare the release

Once the remote is properly set, please follow these steps:

- Run the [pre-release.sh](./scripts/pre-release.sh) shell script to run it in dry-run mode.
- You can use the `DRY_RUN` variable to enable or disable the dry-run mode. By default, it's enabled.
- To prepare for a release, updating the _Testcontainers for Go_ dependency for all the modules and examples, without performing any Git operation:

        DRY_RUN="false" ./scripts/pre-release.sh

- The script will update the [mkdocs.yml](./mkdocks.yml) file, updating the `latest_version` field to the current version.
- The script will update the `go.mod` files for each Go modules and example modules under the examples and modules directories, updating the version of the testcontainers-go dependency to the recently created tag.
- The script will modify the docs for the each Go module **that was not released yet**, updating the version of _Testcontainers for Go_ where it was added to the recently created tag.

An example execution, with dry-run mode enabled:

```shell
sed "s/latest_version: .*/latest_version: v0.20.1/g" /Users/mdelapenya/sourcecode/src/github.com/testcontainers/testcontainers-go/mkdocs.yml > /Users/mdelapenya/sourcecode/src/github.com/testcontainers/testcontainers-go/mkdocs.yml.tmp
mv /Users/mdelapenya/sourcecode/src/github.com/testcontainers/testcontainers-go/mkdocs.yml.tmp /Users/mdelapenya/sourcecode/src/github.com/testcontainers/testcontainers-go/mkdocs.yml
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" bigtable/go.mod > bigtable/go.mod.tmp
mv bigtable/go.mod.tmp bigtable/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" cockroachdb/go.mod > cockroachdb/go.mod.tmp
mv cockroachdb/go.mod.tmp cockroachdb/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" consul/go.mod > consul/go.mod.tmp
mv consul/go.mod.tmp consul/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" datastore/go.mod > datastore/go.mod.tmp
mv datastore/go.mod.tmp datastore/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" firestore/go.mod > firestore/go.mod.tmp
mv firestore/go.mod.tmp firestore/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" mongodb/go.mod > mongodb/go.mod.tmp
mv mongodb/go.mod.tmp mongodb/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" nginx/go.mod > nginx/go.mod.tmp
mv nginx/go.mod.tmp nginx/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" pubsub/go.mod > pubsub/go.mod.tmp
mv pubsub/go.mod.tmp pubsub/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" spanner/go.mod > spanner/go.mod.tmp
mv spanner/go.mod.tmp spanner/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" toxiproxy/go.mod > toxiproxy/go.mod.tmp
mv toxiproxy/go.mod.tmp toxiproxy/go.mod
go mod tidy
go mod tidy
go mod tidy
go mod tidy
go mod tidy
go mod tidy
go mod tidy
go mod tidy
go mod tidy
go mod tidy
go mod tidy
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" compose/go.mod > compose/go.mod.tmp
mv compose/go.mod.tmp compose/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" couchbase/go.mod > couchbase/go.mod.tmp
mv couchbase/go.mod.tmp couchbase/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" localstack/go.mod > localstack/go.mod.tmp
mv localstack/go.mod.tmp localstack/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" mysql/go.mod > mysql/go.mod.tmp
mv mysql/go.mod.tmp mysql/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" neo4j/go.mod > neo4j/go.mod.tmp
mv neo4j/go.mod.tmp neo4j/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" postgres/go.mod > postgres/go.mod.tmp
mv postgres/go.mod.tmp postgres/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" pulsar/go.mod > pulsar/go.mod.tmp
mv pulsar/go.mod.tmp pulsar/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" redis/go.mod > redis/go.mod.tmp
mv redis/go.mod.tmp redis/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" redpanda/go.mod > redpanda/go.mod.tmp
mv redpanda/go.mod.tmp redpanda/go.mod
sed "s/testcontainers-go v.*/testcontainers-go v0.20.1/g" vault/go.mod > vault/go.mod.tmp
mv vault/go.mod.tmp vault/go.mod
go mod tidy
go mod tidy
go mod tidy
go mod tidy
go mod tidy
go mod tidy
go mod tidy
go mod tidy
go mod tidy
go mod tidy
sed "s/Not available until the next release of testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\"><span class=\"tc-version\">:material-tag: main<\/span><\/a>/Since testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\/releases\/tag\/v0.20.1\"><span class=\"tc-version\">:material-tag: v0.20.1<\/span><\/a>/g" couchbase.md > couchbase.md.tmp
mv couchbase.md.tmp couchbase.md
sed "s/Not available until the next release of testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\"><span class=\"tc-version\">:material-tag: main<\/span><\/a>/Since testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\/releases\/tag\/v0.20.1\"><span class=\"tc-version\">:material-tag: v0.20.1<\/span><\/a>/g" localstack.md > localstack.md.tmp
mv localstack.md.tmp localstack.md
sed "s/Not available until the next release of testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\"><span class=\"tc-version\">:material-tag: main<\/span><\/a>/Since testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\/releases\/tag\/v0.20.1\"><span class=\"tc-version\">:material-tag: v0.20.1<\/span><\/a>/g" mysql.md > mysql.md.tmp
mv mysql.md.tmp mysql.md
sed "s/Not available until the next release of testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\"><span class=\"tc-version\">:material-tag: main<\/span><\/a>/Since testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\/releases\/tag\/v0.20.1\"><span class=\"tc-version\">:material-tag: v0.20.1<\/span><\/a>/g" neo4j.md > neo4j.md.tmp
mv neo4j.md.tmp neo4j.md
sed "s/Not available until the next release of testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\"><span class=\"tc-version\">:material-tag: main<\/span><\/a>/Since testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\/releases\/tag\/v0.20.1\"><span class=\"tc-version\">:material-tag: v0.20.1<\/span><\/a>/g" postgres.md > postgres.md.tmp
mv postgres.md.tmp postgres.md
sed "s/Not available until the next release of testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\"><span class=\"tc-version\">:material-tag: main<\/span><\/a>/Since testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\/releases\/tag\/v0.20.1\"><span class=\"tc-version\">:material-tag: v0.20.1<\/span><\/a>/g" pulsar.md > pulsar.md.tmp
mv pulsar.md.tmp pulsar.md
sed "s/Not available until the next release of testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\"><span class=\"tc-version\">:material-tag: main<\/span><\/a>/Since testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\/releases\/tag\/v0.20.1\"><span class=\"tc-version\">:material-tag: v0.20.1<\/span><\/a>/g" redis.md > redis.md.tmp
mv redis.md.tmp redis.md
sed "s/Not available until the next release of testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\"><span class=\"tc-version\">:material-tag: main<\/span><\/a>/Since testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\/releases\/tag\/v0.20.1\"><span class=\"tc-version\">:material-tag: v0.20.1<\/span><\/a>/g" redpanda.md > redpanda.md.tmp
mv redpanda.md.tmp redpanda.md
sed "s/Not available until the next release of testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\"><span class=\"tc-version\">:material-tag: main<\/span><\/a>/Since testcontainers-go <a href=\"https:\/\/github.com\/testcontainers\/testcontainers-go\/releases\/tag\/v0.20.1\"><span class=\"tc-version\">:material-tag: v0.20.1<\/span><\/a>/g" vault.md > vault.md.tmp
mv vault.md.tmp vault.md
```

## Performing a release

Once you are satisfied with the modified files in the git state:

- Run the [release.sh](./scripts/release.sh) shell script to create the release in dry-run mode.
- You can use the `DRY_RUN` variable to enable or disable the dry-run mode. By default, it's enabled.

        DRY_RUN="false" ./scripts/release.sh

- You can define the bump type, using the `BUMP_TYPE` environment variable. The default value is `minor`, but you can also use `major` or `patch` (the script will fail if the value is not one of these three):

        BUMP_TYPE="major" ./scripts/release.sh

- The script will commit the current state of the git repository, if the `DRY_RUN` variable is set to `false`. The modified files are the ones modified by the `pre-release.sh` script.
- The script will create a git tag with the current value of the [version.go](./internal/version.go) file, starting with `v`: e.g. `v0.18.0`, for the following Go modules:
    - the root module, representing the Testcontainers for Go library.
    - all the Go modules living in both the `examples` and `modules` directory. The git tag value for these Go modules will be created using this name convention:

             "${directory}/${module_name}/${version}", e.g. "examples/mysql/v0.18.0", "modules/compose/v0.18.0"

- The script will update the [version.go](./internal/version.go) file, setting the next development version to the value defined in the `BUMP_TYPE` environment variable. For example, if the current version is `v0.18.0`, the script will update the [version.go](./internal/version.go) file with the next development version `v0.19.0`.
- The script will create a commit in the **main** branch if the `DRY_RUN` variable is set to `false`.
- The script will push the main branch including the tags to the upstream repository, https://github.com/testcontainers/testcontainers-go, if the `DRY_RUN` variable is set to `false`.
- Finally, the script will trigger the Golang proxy to update the modules in https://proxy.golang.org/, if the `DRY_RUN` variable is set to `false`.

An example execution, with dry-run mode enabled:

```
$ ./scripts/release.sh
Current version: v0.20.1
git add /Users/mdelapenya/sourcecode/src/github.com/testcontainers/testcontainers-go/internal/version.go
git add /Users/mdelapenya/sourcecode/src/github.com/testcontainers/testcontainers-go/mkdocs.yml
git add examples/**/go.*
git add modules/**/go.*
git commit -m chore: use new version (v0.20.1) in modules and examples
git tag v0.20.1
git tag examples/bigtable/v0.20.1
git tag examples/datastore/v0.20.1
git tag examples/firestore/v0.20.1
git tag examples/mongodb/v0.20.1
git tag examples/nginx/v0.20.1
git tag examples/pubsub/v0.20.1
git tag examples/spanner/v0.20.1
git tag examples/toxiproxy/v0.20.1
git tag modules/cockroachdb/v0.20.1
git tag modules/compose/v0.20.1
git tag modules/couchbase/v0.20.1
git tag modules/localstack/v0.20.1
git tag modules/mysql/v0.20.1
git tag modules/neo4j/v0.20.1
git tag modules/postgres/v0.20.1
git tag modules/pulsar/v0.20.1
git tag modules/redis/v0.20.1
git tag modules/redpanda/v0.20.1
git tag modules/vault/v0.20.1
WARNING: The requested image's platform (linux/amd64) does not match the detected host platform (linux/arm64/v8) and no specific platform was requested
Producing a minor bump of the version, from 0.20.1 to 0.21.0
sed "s/const Version = ".*"/const Version = "0.21.0"/g" /Users/mdelapenya/sourcecode/src/github.com/testcontainers/testcontainers-go/internal/version.go > /Users/mdelapenya/sourcecode/src/github.com/testcontainers/testcontainers-go/internal/version.go.tmp
mv /Users/mdelapenya/sourcecode/src/github.com/testcontainers/testcontainers-go/internal/version.go.tmp /Users/mdelapenya/sourcecode/src/github.com/testcontainers/testcontainers-go/internal/version.go
git add /Users/mdelapenya/sourcecode/src/github.com/testcontainers/testcontainers-go/internal/version.go
git commit -m chore: prepare for next minor development cycle (0.21.0)
git push origin main --tags
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/examples/bigtable/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/examples/datastore/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/examples/firestore/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/examples/mongodb/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/examples/nginx/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/examples/pubsub/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/examples/spanner/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/examples/toxiproxy/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/modules/cockroachdb/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/modules/compose/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/modules/couchbase/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/modules/localstack/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/modules/mysql/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/modules/neo4j/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/modules/postgres/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/modules/pulsar/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/modules/redis/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/modules/redpanda/@v/v0.20.1.info
curl https://proxy.golang.org/github.com/testcontainers/testcontainers-go/modules/vault/@v/v0.20.1.info
```

Right after that, you have to:
- Verify that the commits are in the upstream repository, otherwise, update it with the current state of the main branch.
