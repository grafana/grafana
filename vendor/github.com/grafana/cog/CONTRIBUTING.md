# Contributing Guidelines

This document is a guide to help you through the process of contributing to `cog`.

## Development environment

`cog` relies on [`devbox`](https://www.jetify.com/devbox/docs/) to manage all
the tools and programming languages it targets.

A shell including all the required tools is accessible via:

```console
$ devbox shell
```

This shell can be exited like any other shell, with `exit` or `CTRL+D`.

One-off commands can be executed within the devbox shell as well:

```console
$ devbox run go version
```

Packages can be installed using:

```console
$ devbox add go@1.23
```

Available packages can be found on the [NixOS package repository](https://search.nixos.org/packages).

## Releasing

Releases are handled by `goreleaser`, configured in the
[`.goreleaser.yaml`](../.goreleaser.yaml) file and running in the
[`release.yaml`](../.github/workflows/release.yaml) GitHub action.

Trigger the release pipeline by creating and pushing a tag: `git tag v{version} && git push origin v{version}`
