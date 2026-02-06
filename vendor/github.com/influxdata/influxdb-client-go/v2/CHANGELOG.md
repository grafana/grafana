## 2.13.0 [2023-12-05]

### Features

- [#394](https://github.com/influxdata/influxdb-client-go/pull/394) Add `DataToPoint` utility to convert a struct to a `write.Point`

### Dependencies

- [#393](https://github.com/influxdata/influxdb-client-go/pull/393) Replace deprecated `io/ioutil`
- [#392](https://github.com/influxdata/influxdb-client-go/pull/392) Upgrade `deepmap/oapi-codegen` to new major version

## 2.12.4 [2023-11-03]

### Bug fixes

- [#386](https://github.com/influxdata/influxdb-client-go/pull/386) Remove deprecated pkg/errors
- [#387](https://github.com/influxdata/influxdb-client-go/pull/387) Upgrade `deepmap/oapi-codegen`

## 2.12.3 [2023-03-29]

### Bug fixes

- Update golang.org/x/net from 0.0.0-20210119194325-5f4716e94777 to 0.7.0

## 2.12.2 [2023-01-26]

### Bug fixes

- [#368](https://github.com/influxdata/influxdb-client-go/pull/368) Allowing proxy from environment variable

## 2.12.1 [2022-12-01]

### Bug fixes

- [#363](https://github.com/influxdata/influxdb-client-go/pull/363) Generated server stubs return also error message from InfluxDB 1.x forward compatible API.
- [#364](https://github.com/influxdata/influxdb-client-go/pull/364) Fixed panic when retrying over a long period without a server connection.

### Documentation

- [#366](https://github.com/influxdata/influxdb-client-go/pull/366) Readme improvements:
  - Added GOPATH installation description
  - Added error handling to Basic Example.

## 2.12.0 [2022-10-27]

### Features

- [#358](https://github.com/influxdata/influxdb-client-go/pull/358):
  - Added possibility to set an application name, which will be part of the User-Agent HTTP header:
    - Set using `Options.SetApplicationName`
    - Warning message is written to log if an application name is not set
      - This may change to be logged as an error in a future release
  - Added example how to fully override `User-Agent` header using `Doer` interface

### Bug fixes

- [#359](https://github.com/influxdata/influxdb-client-go/pull/359) `WriteAPIBlocking.Flush()` correctly returns nil error.

## 2.11.0 [2022-09-29]

### Features

- [#353](https://github.com/influxdata/influxdb-client-go/pull/353) Simplify generated code.
- [#353](https://github.com/influxdata/influxdb-client-go/pull/353) Regenerate code from swagger.
- [#355](https://github.com/influxdata/influxdb-client-go/pull/355) Upgrade of lib gopkg.in/yaml from v2 to v3

### Bug fixes

- [#354](https://github.com/influxdata/influxdb-client-go/pull/354) More efficient synchronization in WriteAPIBlocking.

### Breaking change

- [#353](https://github.com/influxdata/influxdb-client-go/pull/353):
  - Interface `Client` has been extended with `APIClient()` function.
  - The generated client API changed:
    - Function names are simplified (was `PostDBRPWithResponse`, now `PostDBRP`)
    - All functions now accept a context and a single wrapper structure with request body and HTTP parameters
    - The functions return deserialized response body or an error (it was a response wrapper with a status code that had to be then validated)

## 2.10.0 [2022-08-25]

### Features

- [#348](https://github.com/influxdata/influxdb-client-go/pull/348) Added `write.Options.Consitency` parameter to support InfluxDB Enterprise.
- [#350](https://github.com/influxdata/influxdb-client-go/pull/350) Added support for implicit batching to `WriteAPIBlocking`. It's off by default, enabled by `EnableBatching()`.

### Bug fixes

- [#349](https://github.com/influxdata/influxdb-client-go/pull/349) Skip retrying on specific write errors (mostly partial write error).

### Breaking change

- [#350](https://github.com/influxdata/influxdb-client-go/pull/350) Interface `WriteAPIBlocking` is extend with `EnableBatching()` and `Flush()`.

## 2.9.2 [2022-07-29]

### Bug fixes

- [#341](https://github.com/influxdata/influxdb-client-go/pull/341) Changing logging level of messages about discarding batch to Error.
- [#344](https://github.com/influxdata/influxdb-client-go/pull/344) `WriteAPI.Flush()` writes also batches from the retry queue.

### Test

- [#345](https://github.com/influxdata/influxdb-client-go/pul/345) Added makefile for simplifying testing from command line.

## 2.9.1 [2022-06-24]

### Bug fixes

- [#332](https://github.com/influxdata/influxdb-client-go/pull/332) Retry strategy drops expired batches as soon as they expire.
- [#335](https://github.com/influxdata/influxdb-client-go/pull/335) Retry strategy keeps max retry delay for new batches.

## 2.9.0 [2022-05-20]

### Features

- [#323](https://github.com/influxdata/influxdb-client-go/pull/323) Added `TasksAPI.CreateTaskByFlux` to allow full control of task script.
- [#328](https://github.com/influxdata/influxdb-client-go/pull/328) Added `Client.SetupWithToken` allowing to specify a custom token.

### Bug fixes

- [#324](https://github.com/influxdata/influxdb-client-go/pull/324) Non-empty error channel will not block writes

## 2.8.2 [2022-04-19]

### Bug fixes

- [#319](https://github.com/influxdata/influxdb-client-go/pull/319) Synchronize `WriteAPIImpl.Close` to prevent panic when closing client by multiple go-routines.

## 2.8.1 [2022-03-21]

### Bug fixes

- [#311](https://github.com/influxdata/influxdb-client-go/pull/311) Correctly unwrapping http.Error from Server API calls
- [#315](https://github.com/influxdata/influxdb-client-go/pull/315) Masking authorization token in log

## 2.8.0 [2022-02-18]

### Features

- [#304](https://github.com/influxdata/influxdb-client-go/pull/304) Added public constructor for `QueryTableResult`
- [#307](https://github.com/influxdata/influxdb-client-go/pull/307) Synced generated server API with the latest [oss.yml](https://github.com/influxdata/openapi/blob/master/contracts/oss.yml).
- [#308](https://github.com/influxdata/influxdb-client-go/pull/308) Added Flux query parameters. Supported by InfluxDB Cloud only now.
- [#308](https://github.com/influxdata/influxdb-client-go/pull/308) Go 1.17 is required

## 2.7.0[2022-01-20]

### Features

- [#297](https://github.com/influxdata/influxdb-client-go/pull/297),[#298](https://github.com/influxdata/influxdb-client-go/pull/298) Optimized `WriteRecord` of [WriteAPIBlocking](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2/api#WriteAPIBlocking). Custom batch can be written by single argument.

### Bug fixes

- [#294](https://github.com/influxdata/influxdb-client-go/pull/294) `WritePoint` and `WriteRecord` of [WriteAPIBlocking](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2/api#WriteAPIBlocking) returns always full error information.
- [300](https://github.com/influxdata/influxdb-client-go/pull/300) Closing the response body after write batch.
- [302](https://github.com/influxdata/influxdb-client-go/pull/302) FluxRecord.Table() returns value of the table column.

## 2.6.0[2021-11-26]

### Features

- [#285](https://github.com/influxdata/influxdb-client-go/pull/285) Added _Client.Ping()_ function as the only validation method available in both OSS and Cloud.
- [#286](https://github.com/influxdata/influxdb-client-go/pull/286) Synced generated server API with the latest [oss.yml](https://github.com/influxdata/openapi/blob/master/contracts/oss.yml).
- [#287](https://github.com/influxdata/influxdb-client-go/pull/287) Added _FluxRecord.Result()_ function as a convenient way to retrieve the Flux result name of data.

### Bug fixes

- [#285](https://github.com/influxdata/influxdb-client-go/pull/285) Functions _Client.Health()_ and _Client.Ready()_ correctly report an error when called against InfluxDB Cloud.

### Breaking change

- [#285](https://github.com/influxdata/influxdb-client-go/pull/285) Function _Client.Ready()_ now returns `*domain.Ready` with full uptime info.

## 2.5.1[2021-09-17]

### Bug fixes

- [#276](https://github.com/influxdata/influxdb-client-go/pull/276) Synchronized logging methods of _log.Logger_.

## 2.5.0 [2021-08-20]

### Features

- [#264](https://github.com/influxdata/influxdb-client-go/pull/264) Synced generated server API with the latest [oss.yml](https://github.com/influxdata/openapi/blob/master/contracts/oss.yml).
- [#271](https://github.com/influxdata/influxdb-client-go/pull/271) Use exponential _random_ retry strategy
- [#273](https://github.com/influxdata/influxdb-client-go/pull/273) Added `WriteFailedCallback` for `WriteAPI` allowing to be _synchronously_ notified about failed writes and decide on further batch processing.

### Bug fixes

- [#269](https://github.com/influxdata/influxdb-client-go/pull/269) Synchronized setters of _log.Logger_ to allow concurrent usage
- [#270](https://github.com/influxdata/influxdb-client-go/pull/270) Fixed duplicate `Content-Type` header in requests to managemet API

### Documentation

- [#261](https://github.com/influxdata/influxdb-client-go/pull/261) Update Line Protocol document link to v2.0
- [#274](https://github.com/influxdata/influxdb-client-go/pull/274) Documenting proxy configuration and HTTP redirects handling

## 2.4.0 [2021-06-04]

### Features

- [#256](https://github.com/influxdata/influxdb-client-go/pull/256) Allowing 'Doer' interface for HTTP requests

### Bug fixes

- [#259](https://github.com/influxdata/influxdb-client-go/pull/259) Fixed leaking connection in case of not reading whole query result on TLS connection

## 2.3.0 [2021-04-30]

### Breaking change

- [#253](https://github.com/influxdata/influxdb-client-go/pull/253) Interface 'Logger' extended with 'LogLevel() uint' getter.

### Features

- [#241](https://github.com/influxdata/influxdb-client-go/pull/241),[#248](https://github.com/influxdata/influxdb-client-go/pull/248) Synced with InfluxDB 2.0.5 swagger:
  - Setup (onboarding) now sends correctly retentionDuration if specified
  - `RetentionRule` used in `Bucket` now contains `ShardGroupDurationSeconds` to specify the shard group duration.

### Documentation

1. [#242](https://github.com/influxdata/influxdb-client-go/pull/242) Documentation improvements:

- [Custom server API example](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2#example-Client-CustomServerAPICall) now shows how to create DBRP mapping
- Improved documentation about concurrency

1. [#251](https://github.com/influxdata/influxdb-client-go/pull/251) Fixed Readme.md formatting

### Bug fixes

1. [#252](https://github.com/influxdata/influxdb-client-go/pull/252) Fixed panic when getting not present standard Flux columns
1. [#253](https://github.com/influxdata/influxdb-client-go/pull/253) Conditional debug logging of buffers
1. [#254](https://github.com/influxdata/influxdb-client-go/pull/254) Fixed golint pull

## 2.2.3 [2021-04-01]

### Bug fixes

1. [#236](https://github.com/influxdata/influxdb-client-go/pull/236) Setting MaxRetries to zero value disables retry strategy.
1. [#239](https://github.com/influxdata/influxdb-client-go/pull/239) Blocking write client doesn't use retry handling.

## 2.2.2 [2021-01-29]

### Bug fixes

1. [#229](https://github.com/influxdata/influxdb-client-go/pull/229) Connection errors are also subject for retrying.

## 2.2.1 [2020-12-24]

### Bug fixes

1. [#220](https://github.com/influxdata/influxdb-client-go/pull/220) Fixed runtime error occurring when calling v2 API on v1 server.

### Documentation

1. [#218](https://github.com/influxdata/influxdb-client-go/pull/218), [#221](https://github.com/influxdata/influxdb-client-go/pull/221), [#222](https://github.com/influxdata/influxdb-client-go/pull/222), Changed links leading to sources to point to API docs in Readme, fixed broken links to InfluxDB docs.

## 2.2.0 [2020-10-30]

### Features

1. [#206](https://github.com/influxdata/influxdb-client-go/pull/206) Adding TasksAPI for managing tasks and associated logs and runs.

### Bug fixes

1. [#209](https://github.com/influxdata/influxdb-client-go/pull/209) Synchronizing access to the write service in WriteAPIBlocking.

## 2.1.0 [2020-10-02]

### Features

1. [#193](https://github.com/influxdata/influxdb-client-go/pull/193) Added authentication using username and password. See `UsersAPI.SignIn()` and `UsersAPI.SignOut()`
1. [#204](https://github.com/influxdata/influxdb-client-go/pull/204) Synced with InfluxDB 2 RC0 swagger. Added pagination to Organizations API and `After` paging param to Buckets API.

### Bug fixes

1. [#191](https://github.com/influxdata/influxdb-client-go/pull/191) Fixed QueryTableResult.Next() failed to parse boolean datatype.
1. [#192](https://github.com/influxdata/influxdb-client-go/pull/192) Client.Close() closes idle connections of internally created HTTP client

### Documentation

1. [#189](https://github.com/influxdata/influxdb-client-go/pull/189) Added clarification that server URL has to be the InfluxDB server base URL to API docs and all examples.
1. [#196](https://github.com/influxdata/influxdb-client-go/pull/196) Changed default server port 9999 to 8086 in docs and examples
1. [#200](https://github.com/influxdata/influxdb-client-go/pull/200) Fix example code in the Readme

## 2.0.1 [2020-08-14]

### Bug fixes

1. [#187](https://github.com/influxdata/influxdb-client-go/pull/187) Properly updated library for new major version.

## 2.0.0 [2020-08-14]

### Breaking changes

1. [#173](https://github.com/influxdata/influxdb-client-go/pull/173) Removed deprecated API.
1. [#174](https://github.com/influxdata/influxdb-client-go/pull/174) Removed orgs labels API cause [it has been removed from the server API](https://github.com/influxdata/influxdb/pull/19104)
1. [#175](https://github.com/influxdata/influxdb-client-go/pull/175) Removed WriteAPI.Close()

### Features

1. [#165](https://github.com/influxdata/influxdb-client-go/pull/165) Allow overriding the http.Client for the http service.
1. [#179](https://github.com/influxdata/influxdb-client-go/pull/179) Unifying retry strategy among InfluxDB 2 clients: added exponential backoff.
1. [#180](https://github.com/influxdata/influxdb-client-go/pull/180) Provided public logger API to enable overriding logging. It is also possible to disable logging.
1. [#181](https://github.com/influxdata/influxdb-client-go/pull/181) Exposed HTTP service to allow custom server API calls. Added example.

### Bug fixes

1. [#175](https://github.com/influxdata/influxdb-client-go/pull/175) Fixed WriteAPIs management. Keeping single instance for each org and bucket pair.

### Documentation

1. [#185](https://github.com/influxdata/influxdb-client-go/pull/185) DeleteAPI and sample WriteAPIBlocking wrapper for implicit batching

## 1.4.0 [2020-07-17]

### Breaking changes

1. [#156](https://github.com/influxdata/influxdb-client-go/pull/156) Fixing Go naming and code style violations:

- Introducing new \*API interfaces with proper name of types, methods and arguments.
- This also affects the `Client` interface and the `Options` type.
- Affected types and methods have been deprecated and they will be removed in the next release.

### Bug fixes

1. [#152](https://github.com/influxdata/influxdb-client-go/pull/152) Allow connecting to server on a URL path
1. [#154](https://github.com/influxdata/influxdb-client-go/pull/154) Use idiomatic go style for write channels (internal)
1. [#155](https://github.com/influxdata/influxdb-client-go/pull/155) Fix panic in FindOrganizationByName in case of no permissions

## 1.3.0 [2020-06-19]

### Features

1. [#131](https://github.com/influxdata/influxdb-client-go/pull/131) Labels API
1. [#136](https://github.com/influxdata/influxdb-client-go/pull/136) Possibility to specify default tags
1. [#138](https://github.com/influxdata/influxdb-client-go/pull/138) Fix errors from InfluxDB 1.8 being empty

### Bug fixes

1. [#132](https://github.com/influxdata/influxdb-client-go/pull/132) Handle unsupported write type as string instead of generating panic
1. [#134](https://github.com/influxdata/influxdb-client-go/pull/134) FluxQueryResult: support reordering of annotations

## 1.2.0 [2020-05-15]

### Breaking Changes

- [#107](https://github.com/influxdata/influxdb-client-go/pull/107) Renamed `InfluxDBClient` interface to `Client`, so the full name `influxdb2.Client` suits better to Go naming conventions
- [#125](https://github.com/influxdata/influxdb-client-go/pull/125) `WriteApi`,`WriteApiBlocking`,`QueryApi` interfaces and related objects like `Point`, `FluxTableMetadata`, `FluxTableColumn`, `FluxRecord`, moved to the `api` ( and `api/write`, `api/query`) packages
  to provide consistent interface

### Features

1. [#120](https://github.com/influxdata/influxdb-client-go/pull/120) Health check API
1. [#122](https://github.com/influxdata/influxdb-client-go/pull/122) Delete API
1. [#124](https://github.com/influxdata/influxdb-client-go/pull/124) Buckets API

### Bug fixes

1. [#108](https://github.com/influxdata/influxdb-client-go/pull/108) Fix default retry interval doc
1. [#110](https://github.com/influxdata/influxdb-client-go/pull/110) Allowing empty (nil) values in query result

### Documentation

- [#112](https://github.com/influxdata/influxdb-client-go/pull/112) Clarify how to use client with InfluxDB 1.8+
- [#115](https://github.com/influxdata/influxdb-client-go/pull/115) Doc and examples for reading write api errors

## 1.1.0 [2020-04-24]

### Features

1. [#100](https://github.com/influxdata/influxdb-client-go/pull/100) HTTP request timeout made configurable
1. [#99](https://github.com/influxdata/influxdb-client-go/pull/99) Organizations API and Users API
1. [#96](https://github.com/influxdata/influxdb-client-go/pull/96) Authorization API

### Docs

1. [#101](https://github.com/influxdata/influxdb-client-go/pull/101) Added examples to API docs

## 1.0.0 [2020-04-01]

### Core

- initial release of new client version

### APIs

- initial release of new client version
