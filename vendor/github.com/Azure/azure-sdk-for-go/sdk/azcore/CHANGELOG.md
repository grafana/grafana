# Release History

## 1.19.1 (2025-09-11)

### Bugs Fixed

* Fixed resource identifier parsing for provider-specific resource hierarchies containing "resourceGroups" segments.

### Other Changes

* Improved error fall-back for improperly authored long-running operations.
* Upgraded dependencies.

## 1.19.0 (2025-08-21)

### Features Added

* Added `runtime.APIVersionLocationPath` to be set by clients that set the API version in the path.

## 1.18.2 (2025-07-31)

### Bugs Fixed

* Fixed a case in which `BearerTokenPolicy` didn't ensure an authentication error is non-retriable

## 1.18.1 (2025-07-10)

### Bugs Fixed

* Fixed incorrect request/response logging try info when logging a request that's being retried.
* Fixed a data race in `ResourceID.String()`

## 1.18.0 (2025-04-03)

### Features Added

* Added `AccessToken.RefreshOn` and updated `BearerTokenPolicy` to consider nonzero values of it when deciding whether to request a new token

## 1.17.1 (2025-03-20)

### Other Changes

* Upgraded to Go 1.23
* Upgraded dependencies

## 1.17.0 (2025-01-07)

### Features Added

* Added field `OperationLocationResultPath` to `runtime.NewPollerOptions[T]` for LROs that use the `Operation-Location` pattern.
* Support `encoding.TextMarshaler` and `encoding.TextUnmarshaler` interfaces in `arm.ResourceID`.

## 1.16.0 (2024-10-17)

### Features Added

* Added field `Kind` to `runtime.StartSpanOptions` to allow a kind to be set when starting a span.

### Bugs Fixed

* `BearerTokenPolicy` now rewinds request bodies before retrying

## 1.15.0 (2024-10-14)

### Features Added

* `BearerTokenPolicy` handles CAE claims challenges

### Bugs Fixed

* Omit the `ResponseError.RawResponse` field from JSON marshaling so instances can be marshaled.
* Fixed an integer overflow in the retry policy.

### Other Changes

* Update dependencies.

## 1.14.0 (2024-08-07)

### Features Added

* Added field `Attributes` to `runtime.StartSpanOptions` to simplify creating spans with attributes.

### Other Changes

* Include the HTTP verb and URL in `log.EventRetryPolicy` log entries so it's clear which operation is being retried.

## 1.13.0 (2024-07-16)

### Features Added

- Added runtime.NewRequestFromRequest(), allowing for a policy.Request to be created from an existing *http.Request.

## 1.12.0 (2024-06-06)

### Features Added

* Added field `StatusCodes` to `runtime.FetcherForNextLinkOptions` allowing for additional HTTP status codes indicating success.
* Added func `NewUUID` to the `runtime` package for generating UUIDs.

### Bugs Fixed

* Fixed an issue that prevented pollers using the `Operation-Location` strategy from unmarshaling the final result in some cases.

### Other Changes

* Updated dependencies.

## 1.11.1 (2024-04-02)

### Bugs Fixed

* Pollers that use the `Location` header won't consider `http.StatusRequestTimeout` a terminal failure.
* `runtime.Poller[T].Result` won't consider non-terminal error responses as terminal.

## 1.11.0 (2024-04-01)

### Features Added

* Added `StatusCodes` to `arm/policy.RegistrationOptions` to allow supporting non-standard HTTP status codes during registration.
* Added field `InsecureAllowCredentialWithHTTP` to `azcore.ClientOptions` and dependent authentication pipeline policies.
* Added type `MultipartContent` to the `streaming` package to support multipart/form payloads with custom Content-Type and file name.

### Bugs Fixed

* `runtime.SetMultipartFormData` won't try to stringify `[]byte` values.
* Pollers that use the `Location` header won't consider `http.StatusTooManyRequests` a terminal failure.

### Other Changes

* Update dependencies.

## 1.10.0 (2024-02-29)

### Features Added

* Added logging event `log.EventResponseError` that will contain the contents of `ResponseError.Error()` whenever an `azcore.ResponseError` is created.
* Added `runtime.NewResponseErrorWithErrorCode` for creating an `azcore.ResponseError` with a caller-supplied error code.
* Added type `MatchConditions` for use in conditional requests.

### Bugs Fixed

* Fixed a potential race condition between `NullValue` and `IsNullValue`.
* `runtime.EncodeQueryParams` will escape semicolons before calling `url.ParseQuery`.

### Other Changes

* Update dependencies.

## 1.9.2 (2024-02-06)

### Bugs Fixed

* `runtime.MarshalAsByteArray` and `runtime.MarshalAsJSON` will preserve the preexisting value of the `Content-Type` header.

### Other Changes

* Update to latest version of `internal`.

## 1.9.1 (2023-12-11)

### Bugs Fixed

* The `retry-after-ms` and `x-ms-retry-after-ms` headers weren't being checked during retries.

### Other Changes

* Update dependencies.

## 1.9.0 (2023-11-06)

### Breaking Changes
> These changes affect only code written against previous beta versions of `v1.7.0` and `v1.8.0`
* The function `NewTokenCredential` has been removed from the `fake` package. Use a literal `&fake.TokenCredential{}` instead.
* The field `TracingNamespace` in `runtime.PipelineOptions` has been replaced by `TracingOptions`.

### Bugs Fixed

* Fixed an issue that could cause some allowed HTTP header values to not show up in logs.
* Include error text instead of error type in traces when the transport returns an error.
* Fixed an issue that could cause an HTTP/2 request to hang when the TCP connection becomes unresponsive.
* Block key and SAS authentication for non TLS protected endpoints.
* Passing a `nil` credential value will no longer cause a panic. Instead, the authentication is skipped.
* Calling `Error` on a zero-value `azcore.ResponseError` will no longer panic.
* Fixed an issue in `fake.PagerResponder[T]` that would cause a trailing error to be omitted when iterating over pages.
* Context values created by `azcore` will no longer flow across disjoint HTTP requests.

### Other Changes

* Skip generating trace info for no-op tracers.
* The `clientName` paramater in client constructors has been renamed to `moduleName`.

## 1.9.0-beta.1 (2023-10-05)

### Other Changes

* The beta features for tracing and fakes have been reinstated.

## 1.8.0 (2023-10-05)

### Features Added

* This includes the following features from `v1.8.0-beta.N` releases.
  * Claims and CAE for authentication.
  * New `messaging` package.
  * Various helpers in the `runtime` package.
  * Deprecation of `runtime.With*` funcs and their replacements in the `policy` package.
* Added types `KeyCredential` and `SASCredential` to the `azcore` package.
  * Includes their respective constructor functions.
* Added types `KeyCredentialPolicy` and `SASCredentialPolicy` to the `azcore/runtime` package.
  * Includes their respective constructor functions and options types.

### Breaking Changes
> These changes affect only code written against beta versions of `v1.8.0`
* The beta features for tracing and fakes have been omitted for this release.

### Bugs Fixed

* Fixed an issue that could cause some ARM RPs to not be automatically registered.
* Block bearer token authentication for non TLS protected endpoints.

### Other Changes

* Updated dependencies.

## 1.8.0-beta.3 (2023-09-07)

### Features Added

* Added function `FetcherForNextLink` and `FetcherForNextLinkOptions` to the `runtime` package to centralize creation of `Pager[T].Fetcher` from a next link URL.

### Bugs Fixed

* Suppress creating spans for nested SDK API calls. The HTTP span will be a child of the outer API span.

### Other Changes

* The following functions in the `runtime` package are now exposed from the `policy` package, and the `runtime` versions have been deprecated.
  * `WithCaptureResponse`
  * `WithHTTPHeader`
  * `WithRetryOptions`

## 1.7.2 (2023-09-06)

### Bugs Fixed

* Fix default HTTP transport to work in WASM modules.

## 1.8.0-beta.2 (2023-08-14)

### Features Added

* Added function `SanitizePagerPollerPath` to the `server` package to centralize sanitization and formalize the contract.
* Added `TokenRequestOptions.EnableCAE` to indicate whether to request a CAE token.

### Breaking Changes

> This change affects only code written against beta version `v1.8.0-beta.1`.
* `messaging.CloudEvent` deserializes JSON objects as `[]byte`, instead of `json.RawMessage`. See the documentation for CloudEvent.Data for more information.

> This change affects only code written against beta versions `v1.7.0-beta.2` and `v1.8.0-beta.1`.
* Removed parameter from method `Span.End()` and its type `tracing.SpanEndOptions`. This API GA'ed in `v1.2.0` so we cannot change it.

### Bugs Fixed

* Propagate any query parameters when constructing a fake poller and/or injecting next links.

## 1.7.1 (2023-08-14)

## Bugs Fixed

* Enable TLS renegotiation in the default transport policy.

## 1.8.0-beta.1 (2023-07-12)

### Features Added

- `messaging/CloudEvent` allows you to serialize/deserialize CloudEvents, as described in the CloudEvents 1.0 specification: [link](https://github.com/cloudevents/spec)

### Other Changes

* The beta features for CAE, tracing, and fakes have been reinstated.

## 1.7.0 (2023-07-12)

### Features Added
* Added method `WithClientName()` to type `azcore.Client` to support shallow cloning of a client with a new name used for tracing.

### Breaking Changes
> These changes affect only code written against beta versions v1.7.0-beta.1 or v1.7.0-beta.2
* The beta features for CAE, tracing, and fakes have been omitted for this release.

## 1.7.0-beta.2 (2023-06-06)

### Breaking Changes
> These changes affect only code written against beta version v1.7.0-beta.1
* Method `SpanFromContext()` on type `tracing.Tracer` had the `bool` return value removed.
  * This includes the field `SpanFromContext` in supporting type `tracing.TracerOptions`.
* Method `AddError()` has been removed from type `tracing.Span`.
* Method `Span.End()` now requires an argument of type `*tracing.SpanEndOptions`.

## 1.6.1 (2023-06-06)

### Bugs Fixed
* Fixed an issue in `azcore.NewClient()` and `arm.NewClient()` that could cause an incorrect module name to be used in telemetry.

### Other Changes
* This version contains all bug fixes from `v1.7.0-beta.1`

## 1.7.0-beta.1 (2023-05-24)

### Features Added
* Restored CAE support for ARM clients.
* Added supporting features to enable distributed tracing.
  * Added func `runtime.StartSpan()` for use by SDKs to start spans.
  * Added method `WithContext()` to `runtime.Request` to support shallow cloning with a new context.
  * Added field `TracingNamespace` to `runtime.PipelineOptions`.
  * Added field `Tracer` to `runtime.NewPollerOptions` and `runtime.NewPollerFromResumeTokenOptions` types.
  * Added field `SpanFromContext` to `tracing.TracerOptions`.
  * Added methods `Enabled()`, `SetAttributes()`, and `SpanFromContext()` to `tracing.Tracer`.
  * Added supporting pipeline policies to include HTTP spans when creating clients.
* Added package `fake` to support generated fakes packages in SDKs.
  * The package contains public surface area exposed by fake servers and supporting APIs intended only for use by the fake server implementations.
  * Added an internal fake poller implementation.

### Bugs Fixed
* Retry policy always clones the underlying `*http.Request` before invoking the next policy.
* Added some non-standard error codes to the list of error codes for unregistered resource providers.

## 1.6.0 (2023-05-04)

### Features Added
* Added support for ARM cross-tenant authentication. Set the `AuxiliaryTenants` field of `arm.ClientOptions` to enable.
* Added `TenantID` field to `policy.TokenRequestOptions`.

## 1.5.0 (2023-04-06)

### Features Added
* Added `ShouldRetry` to `policy.RetryOptions` for finer-grained control over when to retry.

### Breaking Changes
> These changes affect only code written against a beta version such as v1.5.0-beta.1
> These features will return in v1.6.0-beta.1.
* Removed `TokenRequestOptions.Claims` and `.TenantID`
* Removed ARM client support for CAE and cross-tenant auth.

### Bugs Fixed
* Added non-conformant LRO terminal states `Cancelled` and `Completed`.

### Other Changes
* Updated to latest `internal` module.

## 1.5.0-beta.1 (2023-03-02)

### Features Added
* This release includes the features added in v1.4.0-beta.1

## 1.4.0 (2023-03-02)
> This release doesn't include features added in v1.4.0-beta.1. They will return in v1.5.0-beta.1.

### Features Added
* Add `Clone()` method for `arm/policy.ClientOptions`.

### Bugs Fixed
* ARM's RP registration policy will no longer swallow unrecognized errors.
* Fixed an issue in `runtime.NewPollerFromResumeToken()` when resuming a `Poller` with a custom `PollingHandler`.
* Fixed wrong policy copy in `arm/runtime.NewPipeline()`.

## 1.4.0-beta.1 (2023-02-02)

### Features Added
* Added support for ARM cross-tenant authentication. Set the `AuxiliaryTenants` field of `arm.ClientOptions` to enable.
* Added `Claims` and `TenantID` fields to `policy.TokenRequestOptions`.
* ARM bearer token policy handles CAE challenges.

## 1.3.1 (2023-02-02)

### Other Changes
* Update dependencies to latest versions.

## 1.3.0 (2023-01-06)

### Features Added
* Added `BearerTokenOptions.AuthorizationHandler` to enable extending `runtime.BearerTokenPolicy`
  with custom authorization logic
* Added `Client` types and matching constructors to the `azcore` and `arm` packages.  These represent a basic client for HTTP and ARM respectively.

### Other Changes
* Updated `internal` module to latest version.
* `policy/Request.SetBody()` allows replacing a request's body with an empty one

## 1.2.0 (2022-11-04)

### Features Added
* Added `ClientOptions.APIVersion` field, which overrides the default version a client
  requests of the service, if the client supports this (all ARM clients do).
* Added package `tracing` that contains the building blocks for distributed tracing.
* Added field `TracingProvider` to type `policy.ClientOptions` that will be used to set the per-client tracing implementation.

### Bugs Fixed
* Fixed an issue in `runtime.SetMultipartFormData` to properly handle slices of `io.ReadSeekCloser`.
* Fixed the MaxRetryDelay default to be 60s.
* Failure to poll the state of an LRO will now return an `*azcore.ResponseError` for poller types that require this behavior.
* Fixed a bug in `runtime.NewPipeline` that would cause pipeline-specified allowed headers and query parameters to be lost.

### Other Changes
* Retain contents of read-only fields when sending requests.

## 1.1.4 (2022-10-06)

### Bugs Fixed
* Don't retry a request if the `Retry-After` delay is greater than the configured `RetryOptions.MaxRetryDelay`.
* `runtime.JoinPaths`: do not unconditionally add a forward slash before the query string

### Other Changes
* Removed logging URL from retry policy as it's redundant.
* Retry policy logs when it exits due to a non-retriable status code.

## 1.1.3 (2022-09-01)

### Bugs Fixed
* Adjusted the initial retry delay to 800ms per the Azure SDK guidelines.

## 1.1.2 (2022-08-09)

### Other Changes
* Fixed various doc bugs.

## 1.1.1 (2022-06-30)

### Bugs Fixed
* Avoid polling when a RELO LRO synchronously terminates.

## 1.1.0 (2022-06-03)

### Other Changes
* The one-second floor for `Frequency` when calling `PollUntilDone()` has been removed when running tests.

## 1.0.0 (2022-05-12)

### Features Added
* Added interface `runtime.PollingHandler` to support custom poller implementations.
  * Added field `PollingHandler` of this type to `runtime.NewPollerOptions[T]` and `runtime.NewPollerFromResumeTokenOptions[T]`.

### Breaking Changes
* Renamed `cloud.Configuration.LoginEndpoint` to `.ActiveDirectoryAuthorityHost`
* Renamed `cloud.AzurePublicCloud` to `cloud.AzurePublic`
* Removed `AuxiliaryTenants` field from `arm/ClientOptions` and `arm/policy/BearerTokenOptions`
* Removed `TokenRequestOptions.TenantID`
* `Poller[T].PollUntilDone()` now takes an `options *PollUntilDoneOptions` param instead of `freq time.Duration`
* Removed `arm/runtime.Poller[T]`, `arm/runtime.NewPoller[T]()` and `arm/runtime.NewPollerFromResumeToken[T]()`
* Removed `arm/runtime.FinalStateVia` and related `const` values
* Renamed `runtime.PageProcessor` to `runtime.PagingHandler`
* The `arm/runtime.ProviderRepsonse` and `arm/runtime.Provider` types are no longer exported.
* Renamed `NewRequestIdPolicy()` to `NewRequestIDPolicy()`
* `TokenCredential.GetToken` now returns `AccessToken` by value.

### Bugs Fixed
* When per-try timeouts are enabled, only cancel the context after the body has been read and closed.
* The `Operation-Location` poller now properly handles `final-state-via` values.
* Improvements in `runtime.Poller[T]`
  * `Poll()` shouldn't cache errors, allowing for additional retries when in a non-terminal state.
  * `Result()` will cache the terminal result or error but not transient errors, allowing for additional retries.

### Other Changes
* Updated to latest `internal` module and absorbed breaking changes.
  * Use `temporal.Resource` and deleted copy.
* The internal poller implementation has been refactored.
  * The implementation in `internal/pollers/poller.go` has been merged into `runtime/poller.go` with some slight modification.
  * The internal poller types had their methods updated to conform to the `runtime.PollingHandler` interface.
  * The creation of resume tokens has been refactored so that implementers of `runtime.PollingHandler` don't need to know about it.
* `NewPipeline()` places policies from `ClientOptions` after policies from `PipelineOptions`
* Default User-Agent headers no longer include `azcore` version information

## 0.23.1 (2022-04-14)

### Bugs Fixed
* Include XML header when marshalling XML content.
* Handle XML namespaces when searching for error code.
* Handle `odata.error` when searching for error code.

## 0.23.0 (2022-04-04)

### Features Added
* Added `runtime.Pager[T any]` and `runtime.Poller[T any]` supporting types for central, generic, implementations.
* Added `cloud` package with a new API for cloud configuration
* Added `FinalStateVia` field to `runtime.NewPollerOptions[T any]` type.

### Breaking Changes
* Removed the `Poller` type-alias to the internal poller implementation.
* Added `Ptr[T any]` and `SliceOfPtrs[T any]` in the `to` package and removed all non-generic implementations.
* `NullValue` and `IsNullValue` now take a generic type parameter instead of an interface func parameter.
* Replaced `arm.Endpoint` with `cloud` API
  * Removed the `endpoint` parameter from `NewRPRegistrationPolicy()`
  * `arm/runtime.NewPipeline()` and `.NewRPRegistrationPolicy()` now return an `error`
* Refactored `NewPoller` and `NewPollerFromResumeToken` funcs in `arm/runtime` and `runtime` packages.
  * Removed the `pollerID` parameter as it's no longer required.
  * Created optional parameter structs and moved optional parameters into them.
* Changed `FinalStateVia` field to a `const` type.

### Other Changes
* Converted expiring resource and dependent types to use generics.

## 0.22.0 (2022-03-03)

### Features Added
* Added header `WWW-Authenticate` to the default allow-list of headers for logging.
* Added a pipeline policy that enables the retrieval of HTTP responses from API calls.
  * Added `runtime.WithCaptureResponse` to enable the policy at the API level (off by default).

### Breaking Changes
* Moved `WithHTTPHeader` and `WithRetryOptions` from the `policy` package to the `runtime` package.

## 0.21.1 (2022-02-04)

### Bugs Fixed
* Restore response body after reading in `Poller.FinalResponse()`. (#16911)
* Fixed bug in `NullValue` that could lead to incorrect comparisons for empty maps/slices (#16969)

### Other Changes
* `BearerTokenPolicy` is more resilient to transient authentication failures. (#16789)

## 0.21.0 (2022-01-11)

### Features Added
* Added `AllowedHeaders` and `AllowedQueryParams` to `policy.LogOptions` to control which headers and query parameters are written to the logger.
* Added `azcore.ResponseError` type which is returned from APIs when a non-success HTTP status code is received.

### Breaking Changes
* Moved `[]policy.Policy` parameters of `arm/runtime.NewPipeline` and `runtime.NewPipeline` into a new struct, `runtime.PipelineOptions`
* Renamed `arm/ClientOptions.Host` to `.Endpoint`
* Moved `Request.SkipBodyDownload` method to function `runtime.SkipBodyDownload`
* Removed `azcore.HTTPResponse` interface type
* `arm.NewPoller()` and `runtime.NewPoller()` no longer require an `eu` parameter
* `runtime.NewResponseError()` no longer requires an `error` parameter

## 0.20.0 (2021-10-22)

### Breaking Changes
* Removed `arm.Connection`
* Removed `azcore.Credential` and `.NewAnonymousCredential()`
  * `NewRPRegistrationPolicy` now requires an `azcore.TokenCredential`
* `runtime.NewPipeline` has a new signature that simplifies implementing custom authentication
* `arm/runtime.RegistrationOptions` embeds `policy.ClientOptions`
* Contents in the `log` package have been slightly renamed.
* Removed `AuthenticationOptions` in favor of `policy.BearerTokenOptions`
* Changed parameters for `NewBearerTokenPolicy()`
* Moved policy config options out of `arm/runtime` and into `arm/policy`

### Features Added
* Updating Documentation
* Added string typdef `arm.Endpoint` to provide a hint toward expected ARM client endpoints
* `azcore.ClientOptions` contains common pipeline configuration settings
* Added support for multi-tenant authorization in `arm/runtime`
* Require one second minimum when calling `PollUntilDone()`

### Bug Fixes
* Fixed a potential panic when creating the default Transporter.
* Close LRO initial response body when creating a poller.
* Fixed a panic when recursively cloning structs that contain time.Time.

## 0.19.0 (2021-08-25)

### Breaking Changes
* Split content out of `azcore` into various packages.  The intent is to separate content based on its usage (common, uncommon, SDK authors).
  * `azcore` has all core functionality.
  * `log` contains facilities for configuring in-box logging.
  * `policy` is used for configuring pipeline options and creating custom pipeline policies.
  * `runtime` contains various helpers used by SDK authors and generated content.
  * `streaming` has helpers for streaming IO operations.
* `NewTelemetryPolicy()` now requires module and version parameters and the `Value` option has been removed.
  * As a result, the `Request.Telemetry()` method has been removed.
* The telemetry policy now includes the SDK prefix `azsdk-go-` so callers no longer need to provide it.
* The `*http.Request` in `runtime.Request` is no longer anonymously embedded.  Use the `Raw()` method to access it.
* The `UserAgent` and `Version` constants have been made internal, `Module` and `Version` respectively.

### Bug Fixes
* Fixed an issue in the retry policy where the request body could be overwritten after a rewind.

### Other Changes
* Moved modules `armcore` and `to` content into `arm` and `to` packages respectively.
  * The `Pipeline()` method on `armcore.Connection` has been replaced by `NewPipeline()` in `arm.Connection`.  It takes module and version parameters used by the telemetry policy.
* Poller logic has been consolidated across ARM and core implementations.
  * This required some changes to the internal interfaces for core pollers.
* The core poller types have been improved, including more logging and test coverage.

## 0.18.1 (2021-08-20)

### Features Added
* Adds an `ETag` type for comparing etags and handling etags on requests
* Simplifies the `requestBodyProgess` and `responseBodyProgress` into a single `progress` object

### Bugs Fixed
* `JoinPaths` will preserve query parameters encoded in the `root` url.

### Other Changes
* Bumps dependency on `internal` module to the latest version (v0.7.0)

## 0.18.0 (2021-07-29)
### Features Added
* Replaces methods from Logger type with two package methods for interacting with the logging functionality.
* `azcore.SetClassifications` replaces `azcore.Logger().SetClassifications`
* `azcore.SetListener` replaces `azcore.Logger().SetListener`

### Breaking Changes
* Removes `Logger` type from `azcore`


## 0.17.0 (2021-07-27)
### Features Added
* Adding TenantID to TokenRequestOptions (https://github.com/Azure/azure-sdk-for-go/pull/14879)
* Adding AuxiliaryTenants to AuthenticationOptions (https://github.com/Azure/azure-sdk-for-go/pull/15123)

### Breaking Changes
* Rename `AnonymousCredential` to `NewAnonymousCredential` (https://github.com/Azure/azure-sdk-for-go/pull/15104)
* rename `AuthenticationPolicyOptions` to `AuthenticationOptions` (https://github.com/Azure/azure-sdk-for-go/pull/15103)
* Make Header constants private (https://github.com/Azure/azure-sdk-for-go/pull/15038)


## 0.16.2 (2021-05-26)
### Features Added
* Improved support for byte arrays [#14715](https://github.com/Azure/azure-sdk-for-go/pull/14715)


## 0.16.1 (2021-05-19)
### Features Added
* Add license.txt to azcore module [#14682](https://github.com/Azure/azure-sdk-for-go/pull/14682)


## 0.16.0 (2021-05-07)
### Features Added
* Remove extra `*` in UnmarshalAsByteArray() [#14642](https://github.com/Azure/azure-sdk-for-go/pull/14642)


## 0.15.1 (2021-05-06)
### Features Added
* Cache the original request body on Request [#14634](https://github.com/Azure/azure-sdk-for-go/pull/14634)


## 0.15.0 (2021-05-05)
### Features Added
* Add support for null map and slice
* Export `Response.Payload` method

### Breaking Changes
* remove `Response.UnmarshalError` as it's no longer required


## 0.14.5 (2021-04-23)
### Features Added
* Add `UnmarshalError()` on `azcore.Response`


## 0.14.4 (2021-04-22)
### Features Added
* Support for basic LRO polling
* Added type `LROPoller` and supporting types for basic polling on long running operations.
* rename poller param and added doc comment

### Bugs Fixed
* Fixed content type detection bug in logging.


## 0.14.3 (2021-03-29)
### Features Added
* Add support for multi-part form data
* Added method `WriteMultipartFormData()` to Request.


## 0.14.2 (2021-03-17)
### Features Added
* Add support for encoding JSON null values
* Adds `NullValue()` and `IsNullValue()` functions for setting and detecting sentinel values used for encoding a JSON null.
* Documentation fixes

### Bugs Fixed
* Fixed improper error wrapping


## 0.14.1 (2021-02-08)
### Features Added
* Add `Pager` and `Poller` interfaces to azcore


## 0.14.0 (2021-01-12)
### Features Added
* Accept zero-value options for default values
* Specify zero-value options structs to accept default values.
* Remove `DefaultXxxOptions()` methods.
* Do not silently change TryTimeout on negative values
* make per-try timeout opt-in


## 0.13.4 (2020-11-20)
### Features Added
* Include telemetry string in User Agent


## 0.13.3 (2020-11-20)
### Features Added
* Updating response body handling on `azcore.Response`


## 0.13.2 (2020-11-13)
### Features Added
* Remove implementation of stateless policies as first-class functions.


## 0.13.1 (2020-11-05)
### Features Added
* Add `Telemetry()` method to `azcore.Request()`


## 0.13.0 (2020-10-14)
### Features Added
* Rename `log` to `logger` to avoid name collision with the log package.
* Documentation improvements
* Simplified `DefaultHTTPClientTransport()` implementation


## 0.12.1 (2020-10-13)
### Features Added
* Update `internal` module dependence to `v0.5.0`


## 0.12.0 (2020-10-08)
### Features Added
* Removed storage specific content
* Removed internal content to prevent API clutter
* Refactored various policy options to conform with our options pattern


## 0.11.0 (2020-09-22)
### Features Added

* Removed `LogError` and `LogSlowResponse`.
* Renamed `options` in `RequestLogOptions`.
* Updated `NewRequestLogPolicy()` to follow standard pattern for options.
* Refactored `requestLogPolicy.Do()` per above changes.
* Cleaned up/added logging in retry policy.
* Export `NewResponseError()`
* Fix `RequestLogOptions` comment


## 0.10.1 (2020-09-17)
### Features Added
* Add default console logger
* Default console logger writes to stderr. To enable it, set env var `AZURE_SDK_GO_LOGGING` to the value 'all'.
* Added `Logger.Writef()` to reduce the need for `ShouldLog()` checks.
* Add `LogLongRunningOperation`


## 0.10.0 (2020-09-10)
### Features Added
* The `request` and `transport` interfaces have been refactored to align with the patterns in the standard library.
* `NewRequest()` now uses `http.NewRequestWithContext()` and performs additional validation, it also requires a context parameter.
* The `Policy` and `Transport` interfaces have had their context parameter removed as the context is associated with the underlying `http.Request`.
* `Pipeline.Do()` will validate the HTTP request before sending it through the pipeline, avoiding retries on a malformed request.
* The `Retrier` interface has been replaced with the `NonRetriableError` interface, and the retry policy updated to test for this.
* `Request.SetBody()` now requires a content type parameter for setting the request's MIME type.
* moved path concatenation into `JoinPaths()` func


## 0.9.6 (2020-08-18)
### Features Added
* Improvements to body download policy
* Always download the response body for error responses, i.e. HTTP status codes >= 400.
* Simplify variable declarations


## 0.9.5 (2020-08-11)
### Features Added
* Set the Content-Length header in `Request.SetBody`


## 0.9.4 (2020-08-03)
### Features Added
* Fix cancellation of per try timeout
* Per try timeout is used to ensure that an HTTP operation doesn't take too long, e.g. that a GET on some URL doesn't take an inordinant amount of time.
* Once the HTTP request returns, the per try timeout should be cancelled, not when the response has been read to completion.
* Do not drain response body if there are no more retries
* Do not retry non-idempotent operations when body download fails


## 0.9.3 (2020-07-28)
### Features Added
* Add support for custom HTTP request headers
* Inserts an internal policy into the pipeline that can extract HTTP header values from the caller's context, adding them to the request.
* Use `azcore.WithHTTPHeader` to add HTTP headers to a context.
* Remove method specific to Go 1.14


## 0.9.2 (2020-07-28)
### Features Added
* Omit read-only content from request payloads
* If any field in a payload's object graph contains `azure:"ro"`, make a clone of the object graph, omitting all fields with this annotation.
* Verify no fields were dropped
* Handle embedded struct types
* Added test for cloning by value
* Add messages to failures


## 0.9.1 (2020-07-22)
### Features Added
* Updated dependency on internal module to fix race condition.


## 0.9.0 (2020-07-09)
### Features Added
* Add `HTTPResponse` interface to be used by callers to access the raw HTTP response from an error in the event of an API call failure.
* Updated `sdk/internal` dependency to latest version.
* Rename package alias


## 0.8.2 (2020-06-29)
### Features Added
* Added missing documentation comments

### Bugs Fixed
* Fixed a bug in body download policy.


## 0.8.1 (2020-06-26)
### Features Added
* Miscellaneous clean-up reported by linters


## 0.8.0 (2020-06-01)
### Features Added
* Differentiate between standard and URL encoding.


## 0.7.1 (2020-05-27)
### Features Added
* Add support for for base64 encoding and decoding of payloads.


## 0.7.0 (2020-05-12)
### Features Added
* Change `RetryAfter()` to a function.


## 0.6.0 (2020-04-29)
### Features Added
* Updating `RetryAfter` to only return the detaion in the RetryAfter header


## 0.5.0 (2020-03-23)
### Features Added
* Export `TransportFunc`

### Breaking Changes
* Removed `IterationDone`


## 0.4.1 (2020-02-25)
### Features Added
* Ensure per-try timeout is properly cancelled
* Explicitly call cancel the per-try timeout when the response body has been read/closed by the body download policy.
* When the response body is returned to the caller for reading/closing, wrap it in a `responseBodyReader` that will cancel the timeout when the body is closed.
* `Logger.Should()` will return false if no listener is set.


## 0.4.0 (2020-02-18)
### Features Added
* Enable custom `RetryOptions` to be specified per API call
* Added `WithRetryOptions()` that adds a custom `RetryOptions` to the provided context, allowing custom settings per API call.
* Remove 429 from the list of default HTTP status codes for retry.
* Change StatusCodesForRetry to a slice so consumers can append to it.
* Added support for retry-after in HTTP-date format.
* Cleaned up some comments specific to storage.
* Remove `Request.SetQueryParam()`
* Renamed `MaxTries` to `MaxRetries`

## 0.3.0 (2020-01-16)
### Features Added
* Added `DefaultRetryOptions` to create initialized default options.

### Breaking Changes
* Removed `Response.CheckStatusCode()`


## 0.2.0 (2020-01-15)
### Features Added
* Add support for marshalling and unmarshalling JSON
* Removed `Response.Payload` field
* Exit early when unmarsahlling if there is no payload


## 0.1.0 (2020-01-10)
### Features Added
* Initial release
