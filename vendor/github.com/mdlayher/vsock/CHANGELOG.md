# CHANGELOG

# v1.2.1

- [Improvement]: updated dependencies, test with Go 1.20.

# v1.2.0

**This is the first release of package vsock that only supports Go 1.18+. Users
on older versions of Go must use v1.1.1.**

- [Improvement]: drop support for older versions of Go so we can begin using
  modern versions of `x/sys` and other dependencies.

## v1.1.1

**This is the last release of package vsock that supports Go 1.17 and below.**

- [Bug Fix] [commit](https://github.com/mdlayher/vsock/commit/ead86435c244d5d6baad549a6df0557ada3f4401):
  fix build on non-UNIX platforms such as Windows. This is a no-op change on
  Linux but provides a friendlier experience for non-Linux users.

## v1.1.0

- [New API] [commit](https://github.com/mdlayher/vsock/commit/44cd82dc5f7de644436f22236b111ab97fa9a14f):
  `vsock.FileListener` can be used to create a `vsock.Listener` from an existing
  `os.File`, which may be provided by systemd socket activation or another
  external mechanism.

## v1.0.1

- [Bug Fix] [commit](https://github.com/mdlayher/vsock/commit/99a6dccdebad21d1fa5f757d228d677ccb1412dc):
  upgrade `github.com/mdlayher/socket` to handle non-blocking `connect(2)`
  errors (called in `vsock.Dial`) properly by checking the `SO_ERROR` socket
  option. Lock in this behavior with a new test.
- [Improvement] [commit](https://github.com/mdlayher/vsock/commit/375f3bbcc363500daf367ec511638a4655471719):
  downgrade the version of `golang.org/x/net` in use to support Go 1.12. We
  don't need the latest version for this package.

## v1.0.0

**This is the first release of package vsock that only supports Go 1.12+.
Users on older versions of Go must use an unstable release.**

- Initial stable commit!
- [API change]: the `vsock.Dial` and `vsock.Listen` constructors now accept an
  optional `*vsock.Config` parameter to enable future expansion in v1.x.x
  without prompting further breaking API changes. Because `vsock.Config` has no
  options as of this release, `nil` may be passed in all call sites to fix
  existing code upon upgrading to v1.0.0.
- [New API]: the `vsock.ListenContextID` function can be used to create a
  `*vsock.Listener` which is bound to an explicit context ID address, rather
  than inferring one automatically as `vsock.Listen` does.
