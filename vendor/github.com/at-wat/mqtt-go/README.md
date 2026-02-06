# mqtt-go

[![Go Reference](https://pkg.go.dev/badge/github.com/at-wat/mqtt-go.svg)](https://pkg.go.dev/github.com/at-wat/mqtt-go) ![ci](https://github.com/at-wat/mqtt-go/workflows/ci/badge.svg) [![codecov](https://codecov.io/gh/at-wat/mqtt-go/branch/master/graph/badge.svg)](https://codecov.io/gh/at-wat/mqtt-go) [![Go Report Card](https://goreportcard.com/badge/github.com/at-wat/mqtt-go)](https://goreportcard.com/report/github.com/at-wat/mqtt-go) [![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Yet another Go MQTT 3.1.1 client library

- Go-ish interface
  > Fully context controlled and mockable interface.
- Extensible
  > Easy to implement a wrapper with unified interface. e.g. AWS IoT WebSocket dialer with automatic presign URL updater is available: [AWS IoT Device SDK for Go](https://github.com/seqsense/aws-iot-device-sdk-go)
- Thread-safe
  > All functions and structs are safe to be used from multiple goroutines.

## Migration guide

- [v0.14.0](MIGRATION.md#v0140)
- [v0.12.0](MIGRATION.md#v0120)

## Examples

- [MQTTs with client certificate](examples/mqtts-client-cert)
- [WebSockets with presigned URL](examples/wss-presign-url)

## Reference

- [MQTT Version 3.1.1 Plus Errata 01](http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/mqtt-v3.1.1.html)

## License

This package is licensed under [Apache License Version 2.0](./LICENSE).
