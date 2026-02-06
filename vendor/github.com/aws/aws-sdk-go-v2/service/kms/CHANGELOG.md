# v1.41.2 (2025-06-26)

* **Documentation**: This release updates AWS CLI examples for KMS APIs.

# v1.41.1 (2025-06-17)

* **Dependency Update**: Update to smithy-go v1.22.4.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.41.0 (2025-06-12)

* **Feature**: AWS KMS announces the support of ML-DSA key pairs that creates post-quantum safe digital signatures.

# v1.40.1 (2025-06-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.40.0 (2025-06-06)

* **Feature**: Remove unpopulated KeyMaterialId from Encrypt Response

# v1.39.0 (2025-06-05)

* **Feature**: AWS KMS announces the support for on-demand rotation of symmetric-encryption KMS keys with imported key material (EXTERNAL origin).

# v1.38.3 (2025-04-10)

* No change notes available for this release.

# v1.38.2 (2025-04-03)

* No change notes available for this release.

# v1.38.1 (2025-03-04.2)

* **Bug Fix**: Add assurance test for operation order.

# v1.38.0 (2025-02-27)

* **Feature**: Track credential providers via User-Agent Feature ids
* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.19 (2025-02-18)

* **Bug Fix**: Bump go version to 1.22
* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.18 (2025-02-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.17 (2025-02-04)

* No change notes available for this release.

# v1.37.16 (2025-01-31)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.15 (2025-01-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.14 (2025-01-24)

* **Dependency Update**: Updated to the latest SDK module versions
* **Dependency Update**: Upgrade to smithy-go v1.22.2.

# v1.37.13 (2025-01-17)

* **Bug Fix**: Fix bug where credentials weren't refreshed during retry loop.

# v1.37.12 (2025-01-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.11 (2025-01-14)

* No change notes available for this release.

# v1.37.10 (2025-01-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.9 (2025-01-08)

* No change notes available for this release.

# v1.37.8 (2024-12-19)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.7 (2024-12-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.6 (2024-11-18)

* **Dependency Update**: Update to smithy-go v1.22.1.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.5 (2024-11-07)

* **Bug Fix**: Adds case-insensitive handling of error message fields in service responses

# v1.37.4 (2024-11-06)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.3 (2024-10-28)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.2 (2024-10-08)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.1 (2024-10-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.0 (2024-10-04)

* **Feature**: Add support for HTTP client metrics.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.36.4 (2024-10-03)

* No change notes available for this release.

# v1.36.3 (2024-09-27)

* No change notes available for this release.

# v1.36.2 (2024-09-25)

* No change notes available for this release.

# v1.36.1 (2024-09-23)

* No change notes available for this release.

# v1.36.0 (2024-09-20)

* **Feature**: Add tracing and metrics support to service clients.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.35.8 (2024-09-17)

* **Bug Fix**: **BREAKFIX**: Only generate AccountIDEndpointMode config for services that use it. This is a compiler break, but removes no actual functionality, as no services currently use the account ID in endpoint resolution.

# v1.35.7 (2024-09-04)

* No change notes available for this release.

# v1.35.6 (2024-09-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.35.5 (2024-08-22)

* No change notes available for this release.

# v1.35.4 (2024-08-15)

* **Dependency Update**: Bump minimum Go version to 1.21.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.35.3 (2024-07-10.2)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.35.2 (2024-07-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.35.1 (2024-06-28)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.35.0 (2024-06-26)

* **Feature**: Support list-of-string endpoint parameter.

# v1.34.1 (2024-06-19)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.34.0 (2024-06-18)

* **Feature**: Track usage of various AWS SDK features in user-agent string.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.33.1 (2024-06-17)

* **Documentation**: Updating SDK example for KMS DeriveSharedSecret API.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.33.0 (2024-06-13)

* **Feature**: This feature allows customers to use their keys stored in KMS to derive a shared secret which can then be used to establish a secured channel for communication, provide proof of possession, or establish trust with other parties.

# v1.32.3 (2024-06-07)

* **Bug Fix**: Add clock skew correction on all service clients
* **Dependency Update**: Updated to the latest SDK module versions

# v1.32.2 (2024-06-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.32.1 (2024-05-23)

* No change notes available for this release.

# v1.32.0 (2024-05-22)

* **Feature**: This release includes feature to import customer's asymmetric (RSA, ECC and SM2) and HMAC keys into KMS in China.

# v1.31.3 (2024-05-16)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.31.2 (2024-05-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.31.1 (2024-05-08)

* **Bug Fix**: GoDoc improvement

# v1.31.0 (2024-04-12)

* **Feature**: This feature supports the ability to specify a custom rotation period for automatic key rotations, the ability to perform on-demand key rotations, and visibility into your key material rotations.

# v1.30.1 (2024-03-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.30.0 (2024-03-18)

* **Feature**: Adds the ability to use the default policy name by omitting the policyName parameter in calls to PutKeyPolicy and GetKeyPolicy
* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.2 (2024-03-07)

* **Bug Fix**: Remove dependency on go-cmp.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.1 (2024-02-23)

* **Bug Fix**: Move all common, SDK-side middleware stack ops into the service client module to prevent cross-module compatibility issues in the future.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.0 (2024-02-22)

* **Feature**: Add middleware stack snapshot tests.

# v1.28.3 (2024-02-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.28.2 (2024-02-20)

* **Bug Fix**: When sourcing values for a service's `EndpointParameters`, the lack of a configured region (i.e. `options.Region == ""`) will now translate to a `nil` value for `EndpointParameters.Region` instead of a pointer to the empty string `""`. This will result in a much more explicit error when calling an operation instead of an obscure hostname lookup failure.

# v1.28.1 (2024-02-15)

* **Bug Fix**: Correct failure to determine the error type in awsJson services that could occur when errors were modeled with a non-string `code` field.

# v1.28.0 (2024-02-13)

* **Feature**: Bump minimum Go version to 1.20 per our language support policy.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.9 (2024-01-05)

* **Documentation**: Documentation updates for AWS Key Management Service (KMS).

# v1.27.8 (2024-01-04)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.7 (2023-12-20)

* No change notes available for this release.

# v1.27.6 (2023-12-15)

* **Documentation**: Documentation updates for AWS Key Management Service

# v1.27.5 (2023-12-08)

* **Bug Fix**: Reinstate presence of default Retryer in functional options, but still respect max attempts set therein.

# v1.27.4 (2023-12-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.3 (2023-12-06)

* **Bug Fix**: Restore pre-refactor auth behavior where all operations could technically be performed anonymously.

# v1.27.2 (2023-12-01)

* **Bug Fix**: Correct wrapping of errors in authentication workflow.
* **Bug Fix**: Correctly recognize cache-wrapped instances of AnonymousCredentials at client construction.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.1 (2023-11-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.0 (2023-11-29)

* **Feature**: Expose Options() accessor on service clients.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.5 (2023-11-28.2)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.4 (2023-11-28)

* **Bug Fix**: Respect setting RetryMaxAttempts in functional options at client construction.

# v1.26.3 (2023-11-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.2 (2023-11-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.1 (2023-11-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.0 (2023-11-01)

* **Feature**: Adds support for configured endpoints via environment variables and the AWS shared configuration file.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.25.0 (2023-10-31)

* **Feature**: **BREAKING CHANGE**: Bump minimum go version to 1.19 per the revised [go version support policy](https://aws.amazon.com/blogs/developer/aws-sdk-for-go-aligns-with-go-release-policy-on-supported-runtimes/).
* **Dependency Update**: Updated to the latest SDK module versions

# v1.24.7 (2023-10-12)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.24.6 (2023-10-06)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.24.5 (2023-08-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.24.4 (2023-08-18)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.24.3 (2023-08-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.24.2 (2023-08-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.24.1 (2023-08-01)

* No change notes available for this release.

# v1.24.0 (2023-07-31)

* **Feature**: Adds support for smithy-modeled endpoint resolution. A new rules-based endpoint resolution will be added to the SDK which will supercede and deprecate existing endpoint resolution. Specifically, EndpointResolver will be deprecated while BaseEndpoint and EndpointResolverV2 will take its place. For more information, please see the Endpoints section in our Developer Guide.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.23.2 (2023-07-28)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.23.1 (2023-07-13)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.23.0 (2023-07-05)

* **Feature**: Added Dry Run Feature to cryptographic and cross-account mutating KMS APIs (14 in all). This feature allows users to test their permissions and parameters before making the actual API call.

# v1.22.2 (2023-06-15)

* No change notes available for this release.

# v1.22.1 (2023-06-13)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.22.0 (2023-06-05)

* **Feature**: This release includes feature to import customer's asymmetric (RSA and ECC) and HMAC keys into KMS.  It also includes feature to allow customers to specify number of days to schedule a KMS key deletion as a policy condition key.

# v1.21.1 (2023-05-04)

* No change notes available for this release.

# v1.21.0 (2023-05-01)

* **Feature**: This release makes the NitroEnclave request parameter Recipient and the response field for CiphertextForRecipient available in AWS SDKs. It also adds the regex pattern for CloudHsmClusterId validation.

# v1.20.12 (2023-04-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.20.11 (2023-04-20)

* No change notes available for this release.

# v1.20.10 (2023-04-10)

* No change notes available for this release.

# v1.20.9 (2023-04-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.20.8 (2023-03-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.20.7 (2023-03-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.20.6 (2023-02-28)

* **Documentation**: AWS KMS is deprecating the RSAES_PKCS1_V1_5 wrapping algorithm option in the GetParametersForImport API that is used in the AWS KMS Import Key Material feature. AWS KMS will end support for this wrapping algorithm by October 1, 2023.

# v1.20.5 (2023-02-22)

* **Bug Fix**: Prevent nil pointer dereference when retrieving error codes.

# v1.20.4 (2023-02-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.20.3 (2023-02-15)

* **Announcement**: When receiving an error response in restJson-based services, an incorrect error type may have been returned based on the content of the response. This has been fixed via PR #2012 tracked in issue #1910.
* **Bug Fix**: Correct error type parsing for restJson services.

# v1.20.2 (2023-02-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.20.1 (2023-01-23)

* No change notes available for this release.

# v1.20.0 (2023-01-05)

* **Feature**: Add `ErrorCodeOverride` field to all error structs (aws/smithy-go#401).

# v1.19.4 (2022-12-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.19.3 (2022-12-14)

* No change notes available for this release.

# v1.19.2 (2022-12-07)

* **Documentation**: Updated examples and exceptions for External Key Store (XKS).

# v1.19.1 (2022-12-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.19.0 (2022-11-29.2)

* **Feature**: AWS KMS introduces the External Key Store (XKS), a new feature for customers who want to protect their data with encryption keys stored in an external key management system under their control.

# v1.18.18 (2022-11-22)

* No change notes available for this release.

# v1.18.17 (2022-11-16)

* No change notes available for this release.

# v1.18.16 (2022-11-10)

* No change notes available for this release.

# v1.18.15 (2022-10-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.14 (2022-10-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.13 (2022-10-20)

* No change notes available for this release.

# v1.18.12 (2022-10-13)

* No change notes available for this release.

# v1.18.11 (2022-09-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.10 (2022-09-14)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.9 (2022-09-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.8 (2022-08-31)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.7 (2022-08-30)

* No change notes available for this release.

# v1.18.6 (2022-08-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.5 (2022-08-22)

* No change notes available for this release.

# v1.18.4 (2022-08-11)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.3 (2022-08-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.2 (2022-08-08)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.1 (2022-08-01)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.0 (2022-07-18)

* **Feature**: Added support for the SM2 KeySpec in China Partition Regions

# v1.17.5 (2022-07-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.4 (2022-06-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.3 (2022-06-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.2 (2022-05-17)

* **Documentation**: Add HMAC best practice tip, annual rotation of AWS managed keys.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.1 (2022-04-25)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.0 (2022-04-19)

* **Feature**: Adds support for KMS keys and APIs that generate and verify HMAC codes

# v1.16.3 (2022-03-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.16.2 (2022-03-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.16.1 (2022-03-23)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.16.0 (2022-03-08)

* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.0 (2022-02-24)

* **Feature**: API client updated
* **Feature**: Adds RetryMaxAttempts and RetryMod to API client Options. This allows the API clients' default Retryer to be configured from the shared configuration files or environment variables. Adding a new Retry mode of `Adaptive`. `Adaptive` retry mode is an experimental mode, adding client rate limiting when throttles reponses are received from an API. See [retry.AdaptiveMode](https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/aws/retry#AdaptiveMode) for more details, and configuration options.
* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.14.0 (2022-01-14)

* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.13.0 (2022-01-07)

* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.12.0 (2021-12-21)

* **Feature**: API Paginators now support specifying the initial starting token, and support stopping on empty string tokens.
* **Feature**: Updated to latest service endpoints

# v1.11.1 (2021-12-02)

* **Bug Fix**: Fixes a bug that prevented aws.EndpointResolverWithOptions from being used by the service client. ([#1514](https://github.com/aws/aws-sdk-go-v2/pull/1514))
* **Dependency Update**: Updated to the latest SDK module versions

# v1.11.0 (2021-11-19)

* **Feature**: API client updated
* **Dependency Update**: Updated to the latest SDK module versions

# v1.10.0 (2021-11-12)

* **Feature**: Service clients now support custom endpoints that have an initial URI path defined.

# v1.9.0 (2021-11-06)

* **Feature**: The SDK now supports configuration of FIPS and DualStack endpoints using environment variables, shared configuration, or programmatically.
* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Feature**: Updated service to latest API model.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.8.0 (2021-10-21)

* **Feature**: API client updated
* **Feature**: Updated  to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.7.0 (2021-10-11)

* **Feature**: API client updated
* **Dependency Update**: Updated to the latest SDK module versions

# v1.6.1 (2021-09-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.6.0 (2021-09-02)

* **Feature**: API client updated

# v1.5.0 (2021-08-27)

* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.3 (2021-08-19)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.2 (2021-08-04)

* **Dependency Update**: Updated `github.com/aws/smithy-go` to latest version.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.1 (2021-07-15)

* **Dependency Update**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.0 (2021-06-25)

* **Feature**: API client updated
* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.2 (2021-06-04)

* No change notes available for this release.

# v1.3.1 (2021-05-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.0 (2021-05-14)

* **Feature**: Constant has been added to modules to enable runtime version inspection for reporting.
* **Dependency Update**: Updated to the latest SDK module versions

