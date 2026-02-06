# platforms

A Go package for formatting, normalizing and matching container platforms.

This package is based on the Open Containers Image Spec definition of a [platform](https://github.com/opencontainers/image-spec/blob/main/specs-go/v1/descriptor.go#L52).

## Platform Specifier

While the OCI platform specifications provide a tool for components to
specify structured information, user input typically doesn't need the full
context and much can be inferred. To solve this problem, this package introduces
"specifiers". A specifier has the format
`<os>|<arch>|<os>/<arch>[/<variant>]`.  The user can provide either the
operating system or the architecture or both.

An example of a common specifier is `linux/amd64`. If the host has a default
runtime that matches this, the user can simply provide the component that
matters. For example, if an image provides `amd64` and `arm64` support, the
operating system, `linux` can be inferred, so they only have to provide
`arm64` or `amd64`. Similar behavior is implemented for operating systems,
where the architecture may be known but a runtime may support images from
different operating systems.

## Project details

**platforms** is a containerd sub-project, licensed under the [Apache 2.0 license](./LICENSE).
As a containerd sub-project, you will find the:
 * [Project governance](https://github.com/containerd/project/blob/main/GOVERNANCE.md),
 * [Maintainers](https://github.com/containerd/project/blob/main/MAINTAINERS),
 * and [Contributing guidelines](https://github.com/containerd/project/blob/main/CONTRIBUTING.md)

information in our [`containerd/project`](https://github.com/containerd/project) repository.