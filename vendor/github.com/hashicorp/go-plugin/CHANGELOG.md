## v1.6.2

ENHANCEMENTS:

* Added support for gRPC dial options to the `Dial` API [[GH-257](https://github.com/hashicorp/go-plugin/pull/257)]

BUGS:

* Fixed a bug where reattaching to a plugin that exits could kill an unrelated process [[GH-320](https://github.com/hashicorp/go-plugin/pull/320)]

## v1.6.1

BUGS:

* Suppress spurious `os.ErrClosed` on plugin shutdown [[GH-299](https://github.com/hashicorp/go-plugin/pull/299)]

ENHANCEMENTS:

* deps: bump google.golang.org/grpc to v1.58.3 [[GH-296](https://github.com/hashicorp/go-plugin/pull/296)]

## v1.6.0

CHANGES:

* plugin: Plugins written in other languages can optionally start to advertise whether they support gRPC broker multiplexing.
  If the environment variable `PLUGIN_MULTIPLEX_GRPC` is set, it is safe to include a seventh field containing a boolean
  value in the `|`-separated protocol negotiation line.

ENHANCEMENTS:

* Support muxing gRPC broker connections over a single listener [[GH-288](https://github.com/hashicorp/go-plugin/pull/288)]
* client: Configurable buffer size for reading plugin log lines [[GH-265](https://github.com/hashicorp/go-plugin/pull/265)]
* Use `buf` for proto generation [[GH-286](https://github.com/hashicorp/go-plugin/pull/286)]
* deps: bump golang.org/x/net to v0.17.0 [[GH-285](https://github.com/hashicorp/go-plugin/pull/285)]
* deps: bump golang.org/x/sys to v0.13.0 [[GH-285](https://github.com/hashicorp/go-plugin/pull/285)]
* deps: bump golang.org/x/text to v0.13.0 [[GH-285](https://github.com/hashicorp/go-plugin/pull/285)]

## v1.5.2

ENHANCEMENTS:

client: New `UnixSocketConfig.TempDir` option allows setting the directory to use when creating plugin-specific Unix socket directories [[GH-282](https://github.com/hashicorp/go-plugin/pull/282)]

## v1.5.1

BUGS:

* server: `PLUGIN_UNIX_SOCKET_DIR` is consistently used for gRPC broker sockets as well as the initial socket [[GH-277](https://github.com/hashicorp/go-plugin/pull/277)]

ENHANCEMENTS:

* client: New `UnixSocketConfig` option in `ClientConfig` to support making the client's Unix sockets group-writable [[GH-277](https://github.com/hashicorp/go-plugin/pull/277)]

## v1.5.0

ENHANCEMENTS:

* client: New `runner.Runner` interface to support clients providing custom plugin command runner implementations [[GH-270](https://github.com/hashicorp/go-plugin/pull/270)]
    * Accessible via new `ClientConfig` field `RunnerFunc`, which is mutually exclusive with `Cmd` and `Reattach`
    * Reattaching support via `ReattachConfig` field `ReattachFunc`
* client: New `ClientConfig` field `SkipHostEnv` allows omitting the client process' own environment variables from the plugin command's environment [[GH-270](https://github.com/hashicorp/go-plugin/pull/270)]
* client: Add `ID()` method to `Client` for retrieving the pid or other unique ID of a running plugin [[GH-272](https://github.com/hashicorp/go-plugin/pull/272)]
* server: Support setting the directory to create Unix sockets in with the env var `PLUGIN_UNIX_SOCKET_DIR` [[GH-270](https://github.com/hashicorp/go-plugin/pull/270)]
* server: Support setting group write permission and a custom group name or gid owner with the env var `PLUGIN_UNIX_SOCKET_GROUP` [[GH-270](https://github.com/hashicorp/go-plugin/pull/270)]

## v1.4.11-rc1

ENHANCEMENTS:

* deps: bump protoreflect to v1.15.1 [[GH-264](https://github.com/hashicorp/go-plugin/pull/264)]

## v1.4.10

BUG FIXES:

* additional notes: ensure to close files [[GH-241](https://github.com/hashicorp/go-plugin/pull/241)]

ENHANCEMENTS:

* deps: Remove direct dependency on golang.org/x/net [[GH-240](https://github.com/hashicorp/go-plugin/pull/240)]

## v1.4.9

ENHANCEMENTS:

* client: Remove log warning introduced in 1.4.5 when SecureConfig is nil. [[GH-238](https://github.com/hashicorp/go-plugin/pull/238)]

## v1.4.8

BUG FIXES:

* Fix windows build: [[GH-227](https://github.com/hashicorp/go-plugin/pull/227)]

## v1.4.7

ENHANCEMENTS:

* More detailed error message on plugin start failure: [[GH-223](https://github.com/hashicorp/go-plugin/pull/223)]

## v1.4.6

BUG FIXES:

* server: Prevent gRPC broker goroutine leak when using `GRPCServer` type `GracefulStop()` or `Stop()` methods [[GH-220](https://github.com/hashicorp/go-plugin/pull/220)]

## v1.4.5

ENHANCEMENTS:

* client: log warning when SecureConfig is nil [[GH-207](https://github.com/hashicorp/go-plugin/pull/207)]


## v1.4.4

ENHANCEMENTS:

* client: increase level of plugin exit logs [[GH-195](https://github.com/hashicorp/go-plugin/pull/195)]

BUG FIXES:

* Bidirectional communication: fix bidirectional communication when AutoMTLS is enabled [[GH-193](https://github.com/hashicorp/go-plugin/pull/193)]
* RPC: Trim a spurious log message for plugins using RPC [[GH-186](https://github.com/hashicorp/go-plugin/pull/186)]
