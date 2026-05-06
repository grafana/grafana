# v1.29.17 (2025-06-17)

* **Dependency Update**: Update to smithy-go v1.22.4.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.16 (2025-06-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.15 (2025-06-06)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.14 (2025-04-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.13 (2025-04-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.12 (2025-03-27)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.11 (2025-03-25)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.10 (2025-03-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.9 (2025-03-04.2)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.8 (2025-02-27)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.7 (2025-02-18)

* **Bug Fix**: Bump go version to 1.22
* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.6 (2025-02-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.5 (2025-02-04)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.4 (2025-01-31)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.3 (2025-01-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.2 (2025-01-24)

* **Bug Fix**: Fix env config naming and usage of deprecated ioutil
* **Dependency Update**: Updated to the latest SDK module versions
* **Dependency Update**: Upgrade to smithy-go v1.22.2.

# v1.29.1 (2025-01-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.0 (2025-01-15)

* **Feature**: S3 client behavior is updated to always calculate a checksum by default for operations that support it (such as PutObject or UploadPart), or require it (such as DeleteObjects). The checksum algorithm used by default now becomes CRC32. Checksum behavior can be configured using `when_supported` and `when_required` options - in code using RequestChecksumCalculation, in shared config using request_checksum_calculation, or as env variable using AWS_REQUEST_CHECKSUM_CALCULATION. The S3 client attempts to validate response checksums for all S3 API operations that support checksums. However, if the SDK has not implemented the specified checksum algorithm then this validation is skipped. Checksum validation behavior can be configured using `when_supported` and `when_required` options - in code using ResponseChecksumValidation, in shared config using response_checksum_validation, or as env variable using AWS_RESPONSE_CHECKSUM_VALIDATION.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.28.11 (2025-01-14)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.28.10 (2025-01-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.28.9 (2025-01-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.28.8 (2025-01-08)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.28.7 (2024-12-19)

* **Bug Fix**: Fix improper use of printf-style functions.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.28.6 (2024-12-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.28.5 (2024-11-18)

* **Dependency Update**: Update to smithy-go v1.22.1.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.28.4 (2024-11-14)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.28.3 (2024-11-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.28.2 (2024-11-06)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.28.1 (2024-10-28)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.28.0 (2024-10-16)

* **Feature**: Adds the LoadOptions hook `WithBaseEndpoint` for setting global endpoint override in-code.

# v1.27.43 (2024-10-08)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.42 (2024-10-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.41 (2024-10-04)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.40 (2024-10-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.39 (2024-09-27)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.38 (2024-09-25)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.37 (2024-09-23)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.36 (2024-09-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.35 (2024-09-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.34 (2024-09-16)

* **Bug Fix**: Read `AWS_CONTAINER_CREDENTIALS_FULL_URI` env variable if set when reading a profile with `credential_source`. Also ensure `AWS_CONTAINER_CREDENTIALS_RELATIVE_URI` is always read before it

# v1.27.33 (2024-09-04)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.32 (2024-09-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.31 (2024-08-26)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.30 (2024-08-23)

* **Bug Fix**: Don't fail credentials unit tests if credentials are found on a file

# v1.27.29 (2024-08-22)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.28 (2024-08-15)

* **Dependency Update**: Bump minimum Go version to 1.21.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.27 (2024-07-18)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.26 (2024-07-10.2)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.25 (2024-07-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.24 (2024-07-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.23 (2024-06-28)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.22 (2024-06-26)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.21 (2024-06-19)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.20 (2024-06-18)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.19 (2024-06-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.18 (2024-06-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.17 (2024-06-03)

* **Documentation**: Add deprecation docs to global endpoint resolution interfaces. These APIs were previously deprecated with the introduction of service-specific endpoint resolution (EndpointResolverV2 and BaseEndpoint on service client options).
* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.16 (2024-05-23)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.15 (2024-05-16)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.14 (2024-05-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.13 (2024-05-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.12 (2024-05-08)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.11 (2024-04-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.10 (2024-03-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.9 (2024-03-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.8 (2024-03-18)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.7 (2024-03-07)

* **Bug Fix**: Remove dependency on go-cmp.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.6 (2024-03-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.5 (2024-03-04)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.4 (2024-02-23)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.3 (2024-02-22)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.2 (2024-02-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.1 (2024-02-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.0 (2024-02-13)

* **Feature**: Bump minimum Go version to 1.20 per our language support policy.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.6 (2024-01-22)

* **Bug Fix**: Remove invalid escaping of shared config values. All values in the shared config file will now be interpreted literally, save for fully-quoted strings which are unwrapped for legacy reasons.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.5 (2024-01-18)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.4 (2024-01-16)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.3 (2024-01-04)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.2 (2023-12-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.1 (2023-12-08)

* **Bug Fix**: Correct loading of [services *] sections into shared config.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.0 (2023-12-07)

* **Feature**: Support modeled request compression. The only algorithm supported at this time is `gzip`.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.25.12 (2023-12-06)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.25.11 (2023-12-01)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.25.10 (2023-11-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.25.9 (2023-11-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.25.8 (2023-11-28.3)

* **Bug Fix**: Correct resolution of S3Express auth disable toggle.

# v1.25.7 (2023-11-28.2)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.25.6 (2023-11-28)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.25.5 (2023-11-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.25.4 (2023-11-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.25.3 (2023-11-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.25.2 (2023-11-16)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.25.1 (2023-11-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.25.0 (2023-11-14)

* **Feature**: Add support for dynamic auth token from file and EKS container host in absolute/relative URIs in the HTTP credential provider.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.24.0 (2023-11-13)

* **Feature**: Replace the legacy config parser with a modern, less-strict implementation. Parsing failures within a section will now simply ignore the invalid line rather than silently drop the entire section.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.23.0 (2023-11-09.2)

* **Feature**: BREAKFIX: In order to support subproperty parsing, invalid property definitions must not be ignored
* **Dependency Update**: Updated to the latest SDK module versions

# v1.22.3 (2023-11-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.22.2 (2023-11-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.22.1 (2023-11-06)

* No change notes available for this release.

# v1.22.0 (2023-11-02)

* **Feature**: Add env and shared config settings for disabling IMDSv1 fallback.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.21.0 (2023-11-01)

* **Feature**: Adds support for configured endpoints via environment variables and the AWS shared configuration file.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.20.0 (2023-10-31)

* **Feature**: **BREAKING CHANGE**: Bump minimum go version to 1.19 per the revised [go version support policy](https://aws.amazon.com/blogs/developer/aws-sdk-for-go-aligns-with-go-release-policy-on-supported-runtimes/).
* **Dependency Update**: Updated to the latest SDK module versions

# v1.19.1 (2023-10-24)

* No change notes available for this release.

# v1.19.0 (2023-10-16)

* **Feature**: Modify logic of retrieving user agent appID from env config

# v1.18.45 (2023-10-12)

* **Bug Fix**: Fail to load config if an explicitly provided profile doesn't exist.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.44 (2023-10-06)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.43 (2023-10-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.42 (2023-09-22)

* **Bug Fix**: Fixed a bug where merging `max_attempts` or `duration_seconds` fields across shared config files with invalid values would silently default them to 0.
* **Bug Fix**: Move type assertion of config values out of the parsing stage, which resolves an issue where the contents of a profile would silently be dropped with certain numeric formats.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.41 (2023-09-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.40 (2023-09-18)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.39 (2023-09-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.38 (2023-08-31)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.37 (2023-08-23)

* No change notes available for this release.

# v1.18.36 (2023-08-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.35 (2023-08-18)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.34 (2023-08-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.33 (2023-08-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.32 (2023-08-01)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.31 (2023-07-31)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.30 (2023-07-28)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.29 (2023-07-25)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.28 (2023-07-13)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.27 (2023-06-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.26 (2023-06-13)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.25 (2023-05-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.24 (2023-05-08)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.23 (2023-05-04)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.22 (2023-04-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.21 (2023-04-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.20 (2023-04-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.19 (2023-03-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.18 (2023-03-16)

* **Bug Fix**: Allow RoleARN to be set as functional option on STS WebIdentityRoleOptions. Fixes aws/aws-sdk-go-v2#2015.

# v1.18.17 (2023-03-14)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.16 (2023-03-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.15 (2023-02-22)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.14 (2023-02-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.13 (2023-02-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.12 (2023-02-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.11 (2023-02-01)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.10 (2023-01-25)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.9 (2023-01-23)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.8 (2023-01-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.7 (2022-12-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.6 (2022-12-19)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.5 (2022-12-15)

* **Bug Fix**: Unify logic between shared config and in finding home directory
* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.4 (2022-12-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.3 (2022-11-22)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.2 (2022-11-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.1 (2022-11-16)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.18.0 (2022-11-11)

* **Announcement**: When using the SSOTokenProvider, a previous implementation incorrectly compensated for invalid SSOTokenProvider configurations in the shared profile. This has been fixed via PR #1903 and tracked in issue #1846
* **Feature**: Adds token refresh support (via SSOTokenProvider) when using the SSOCredentialProvider
* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.11 (2022-11-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.10 (2022-10-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.9 (2022-10-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.8 (2022-09-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.7 (2022-09-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.6 (2022-09-14)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.5 (2022-09-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.4 (2022-08-31)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.3 (2022-08-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.2 (2022-08-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.1 (2022-08-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.0 (2022-08-14)

* **Feature**: Add alternative mechanism for determning the users `$HOME` or `%USERPROFILE%` location when the environment variables are not present.

# v1.16.1 (2022-08-11)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.16.0 (2022-08-10)

* **Feature**: Adds support for the following settings in the `~/.aws/credentials` file: `sso_account_id`, `sso_region`, `sso_role_name`, `sso_start_url`, and `ca_bundle`.

# v1.15.17 (2022-08-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.16 (2022-08-08)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.15 (2022-08-01)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.14 (2022-07-11)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.13 (2022-07-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.12 (2022-06-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.11 (2022-06-16)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.10 (2022-06-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.9 (2022-05-26)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.8 (2022-05-25)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.7 (2022-05-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.6 (2022-05-16)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.5 (2022-05-09)

* **Bug Fix**: Fixes a bug in LoadDefaultConfig to correctly assign ConfigSources so all config resolvers have access to the config sources. This fixes the feature/ec2/imds client not having configuration applied via config.LoadOptions such as EC2IMDSClientEnableState. PR [#1682](https://github.com/aws/aws-sdk-go-v2/pull/1682)

# v1.15.4 (2022-04-25)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.3 (2022-03-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.2 (2022-03-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.1 (2022-03-23)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.0 (2022-03-08)

* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.14.0 (2022-02-24)

* **Feature**: Adds support for loading RetryMaxAttempts and RetryMod from the environment and shared configuration files. These parameters drive how the SDK's API client will initialize its default retryer, if custome retryer has not been specified. See [config](https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/config) module and [aws.Config](https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/aws#Config) for more information about and how to use these new options.
* **Feature**: Adds support for the `ca_bundle` parameter in shared config and credentials files. The usage of the file is the same as environment variable, `AWS_CA_BUNDLE`, but sourced from shared config. Fixes [#1589](https://github.com/aws/aws-sdk-go-v2/issues/1589)
* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.13.1 (2022-01-28)

* **Bug Fix**: Fixes LoadDefaultConfig handling of errors returned by passed in functional options. Previously errors returned from the LoadOptions passed into LoadDefaultConfig were incorrectly ignored. [#1562](https://github.com/aws/aws-sdk-go-v2/pull/1562). Thanks to [Pinglei Guo](https://github.com/pingleig) for submitting this PR.
* **Bug Fix**: Fixes the SDK's handling of `duration_sections` in the shared credentials file or specified in multiple shared config and shared credentials files under the same profile. [#1568](https://github.com/aws/aws-sdk-go-v2/pull/1568). Thanks to [Amir Szekely](https://github.com/kichik) for help reproduce this bug.
* **Bug Fix**: Updates `config` module to use os.UserHomeDir instead of hard coded environment variable for OS. [#1563](https://github.com/aws/aws-sdk-go-v2/pull/1563)
* **Dependency Update**: Updated to the latest SDK module versions

# v1.13.0 (2022-01-14)

* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.12.0 (2022-01-07)

* **Feature**: Add load option for CredentialCache. Adds a new member to the LoadOptions struct, CredentialsCacheOptions. This member allows specifying a function that will be used to configure the CredentialsCache. The CredentialsCacheOptions will only be used if the configuration loader will wrap the underlying credential provider in the CredentialsCache.
* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.11.1 (2021-12-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.11.0 (2021-12-02)

* **Feature**: Add support for specifying `EndpointResolverWithOptions` on `LoadOptions`, and associated `WithEndpointResolverWithOptions`.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.10.3 (2021-11-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.10.2 (2021-11-19)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.10.1 (2021-11-12)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.10.0 (2021-11-06)

* **Feature**: The SDK now supports configuration of FIPS and DualStack endpoints using environment variables, shared configuration, or programmatically.
* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.9.0 (2021-10-21)

* **Feature**: Updated  to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.8.3 (2021-10-11)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.8.2 (2021-09-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.8.1 (2021-09-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.8.0 (2021-09-02)

* **Feature**: Add support for S3 Multi-Region Access Point ARNs.

# v1.7.0 (2021-08-27)

* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.6.1 (2021-08-19)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.6.0 (2021-08-04)

* **Feature**: adds error handling for defered close calls
* **Dependency Update**: Updated `github.com/aws/smithy-go` to latest version.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.5.0 (2021-07-15)

* **Feature**: Support has been added for EC2 IPv6-enabled Instance Metadata Service Endpoints.
* **Dependency Update**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.1 (2021-07-01)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.0 (2021-06-25)

* **Feature**: Adds configuration setting for enabling endpoint discovery.
* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.0 (2021-05-20)

* **Feature**: SSO credentials can now be defined alongside other credential providers within the same configuration profile.
* **Bug Fix**: Profile names were incorrectly normalized to lower-case, which could result in unexpected profile configurations.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.0 (2021-05-14)

* **Feature**: Constant has been added to modules to enable runtime version inspection for reporting.
* **Dependency Update**: Updated to the latest SDK module versions

