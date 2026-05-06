# Releasing

1. Run `release.sh` script which updates versions in go.mod files and pushes a new branch to GitHub:

```shell
TAG=v1.0.0 ./scripts/release.sh
```

2. Open a pull request and wait for the build to finish.

3. Merge the pull request and run `tag.sh` to create tags for packages:

```shell
TAG=v1.0.0 ./scripts/tag.sh
```
