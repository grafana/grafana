# Releases

## What to do know before cutting a release

While `prometheus/sigv4` does not have a formal release process. We strongly encourage you follow these steps:

1. Scan the list of available issues / PRs and make sure that You attempt to merge any pull requests that appear to be ready or almost ready
2. Notify the maintainers listed as part of [`MANTAINERS.md`](MAINTAINERS.md) that you're going to do a release.

With those steps done, you can proceed to cut a release.

## How to cut an individual release

There is no automated process for cutting a release in `prometheus/sigv4`. A manual release using GitHub's release feature via [this link](https://github.com/prometheus/prometheus/releases/new) is the best way to go. The tag name must be prefixed with a `v` e.g. `v0.53.0` and then you can use the "Generate release notes" button to generate the release note automagically ✨. No need to create a discussion or mark it a pre-release, please do mark it as the latest release if needed.

## Versioning strategy

We aim to adhere to [Semantic Versioning](https://semver.org/) as much as possible. For example, patch version (e.g. v0.0.x) releases should contain bugfixes only and any sort of major or minor version bump should be a minor or major release respectively.
