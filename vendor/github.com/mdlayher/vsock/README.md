# vsock [![Test Status](https://github.com/mdlayher/vsock/workflows/Linux%20Test/badge.svg)](https://github.com/mdlayher/vsock/actions) [![Go Reference](https://pkg.go.dev/badge/github.com/mdlayher/vsock.svg)](https://pkg.go.dev/github.com/mdlayher/vsock)  [![Go Report Card](https://goreportcard.com/badge/github.com/mdlayher/vsock)](https://goreportcard.com/report/github.com/mdlayher/vsock)

Package `vsock` provides access to Linux VM sockets (`AF_VSOCK`) for
communication between a hypervisor and its virtual machines.  MIT Licensed.

For more information about VM sockets, see my blog about
[Linux VM sockets in Go](https://mdlayher.com/blog/linux-vm-sockets-in-go/) or
the [QEMU wiki page on virtio-vsock](http://wiki.qemu-project.org/Features/VirtioVsock).

## Stability

See the [CHANGELOG](./CHANGELOG.md) file for a description of changes between
releases.

This package has a stable v1 API and any future breaking changes will prompt
the release of a new major version. Features and bug fixes will continue to
occur in the v1.x.x series.

This package only supports the two most recent major versions of Go, mirroring
Go's own release policy. Older versions of Go may lack critical features and bug
fixes which are necessary for this package to function correctly.
