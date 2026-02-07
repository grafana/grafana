# v1.84.0 (2025-07-15)

* **Feature**: Amazon S3 Metadata live inventory tables provide a queryable inventory of all the objects in your general purpose bucket so that you can determine the latest state of your data. To help minimize your storage costs, use journal table record expiration to set a retention period for your records.

# v1.83.0 (2025-07-02)

* **Feature**: Added support for directory bucket creation with tags and bucket ARN retrieval in CreateBucket, ListDirectoryBuckets, and HeadBucket operations

# v1.82.0 (2025-06-25)

* **Feature**: Adds support for additional server-side encryption mode and storage class values for accessing Amazon FSx data from Amazon S3 using S3 Access Points

# v1.81.0 (2025-06-18)

* **Feature**: Added support for renaming objects within the same bucket using the new RenameObject API.

# v1.80.3 (2025-06-17)

* **Dependency Update**: Update to smithy-go v1.22.4.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.80.2 (2025-06-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.80.1 (2025-06-06)

* No change notes available for this release.

# v1.80.0 (2025-05-29)

* **Feature**: Adding checksum support for S3 PutBucketOwnershipControls API.

# v1.79.4 (2025-05-22)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.79.3 (2025-04-28)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.79.2 (2025-04-10)

* No change notes available for this release.

# v1.79.1 (2025-04-03)

* No change notes available for this release.

# v1.79.0 (2025-03-31)

* **Feature**: Amazon S3 adds support for S3 Access Points for directory buckets in AWS Dedicated Local Zones

# v1.78.2 (2025-03-11)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.78.1 (2025-03-04.2)

* **Bug Fix**: Add assurance test for operation order.

# v1.78.0 (2025-02-27)

* **Feature**: Track credential providers via User-Agent Feature ids
* **Dependency Update**: Updated to the latest SDK module versions

# v1.77.1 (2025-02-18)

* **Bug Fix**: Bump go version to 1.22
* **Dependency Update**: Updated to the latest SDK module versions

# v1.77.0 (2025-02-14)

* **Feature**: Added support for Content-Range header in HeadObject response.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.76.1 (2025-02-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.76.0 (2025-02-06)

* **Feature**: Updated list of the valid AWS Region values for the LocationConstraint parameter for general purpose buckets.

# v1.75.4 (2025-02-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.75.3 (2025-02-04)

* No change notes available for this release.

# v1.75.2 (2025-01-31)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.75.1 (2025-01-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.75.0 (2025-01-29)

* **Feature**: Change the type of MpuObjectSize in CompleteMultipartUploadRequest from int to long.

# v1.74.1 (2025-01-24)

* **Bug Fix**: Enable request checksum validation mode by default
* **Dependency Update**: Updated to the latest SDK module versions
* **Dependency Update**: Upgrade to smithy-go v1.22.2.

# v1.74.0 (2025-01-22)

* **Feature**: Add a client config option to disable logging when output checksum validation is skipped due to an unsupported algorithm.

# v1.73.2 (2025-01-17)

* **Bug Fix**: Fix bug where credentials weren't refreshed during retry loop.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.73.1 (2025-01-16)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.73.0 (2025-01-15)

* **Feature**: S3 client behavior is updated to always calculate a checksum by default for operations that support it (such as PutObject or UploadPart), or require it (such as DeleteObjects). The checksum algorithm used by default now becomes CRC32. Checksum behavior can be configured using `when_supported` and `when_required` options - in code using RequestChecksumCalculation, in shared config using request_checksum_calculation, or as env variable using AWS_REQUEST_CHECKSUM_CALCULATION. The S3 client attempts to validate response checksums for all S3 API operations that support checksums. However, if the SDK has not implemented the specified checksum algorithm then this validation is skipped. Checksum validation behavior can be configured using `when_supported` and `when_required` options - in code using ResponseChecksumValidation, in shared config using response_checksum_validation, or as env variable using AWS_RESPONSE_CHECKSUM_VALIDATION.
* **Feature**: This change enhances integrity protections for new SDK requests to S3. S3 SDKs now support the CRC64NVME checksum algorithm, full object checksums for multipart S3 objects, and new default integrity protections for S3 requests.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.72.3 (2025-01-14)

* **Bug Fix**: Fix issue where waiters were not failing on unmatched errors as they should. This may have breaking behavioral changes for users in fringe cases. See [this announcement](https://github.com/aws/aws-sdk-go-v2/discussions/2954) for more information.

# v1.72.2 (2025-01-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.72.1 (2025-01-08)

* No change notes available for this release.

# v1.72.0 (2025-01-03)

* **Feature**: This change is only for updating the model regexp of CopySource which is not for validation but only for documentation and user guide change.

# v1.71.1 (2024-12-19)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.71.0 (2024-12-03.2)

* **Feature**: Amazon S3 Metadata stores object metadata in read-only, fully managed Apache Iceberg metadata tables that you can query. You can create metadata table configurations for S3 general purpose buckets.

# v1.70.0 (2024-12-02)

* **Feature**: Amazon S3 introduces support for AWS Dedicated Local Zones
* **Dependency Update**: Updated to the latest SDK module versions

# v1.69.0 (2024-11-25)

* **Feature**: Amazon Simple Storage Service / Features: Add support for ETag based conditional writes in PutObject and CompleteMultiPartUpload APIs to prevent unintended object modifications.

# v1.68.0 (2024-11-21)

* **Feature**: Add support for conditional deletes for the S3 DeleteObject and DeleteObjects APIs. Add support for write offset bytes option used to append to objects with the S3 PutObject API.

# v1.67.1 (2024-11-18)

* **Dependency Update**: Update to smithy-go v1.22.1.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.67.0 (2024-11-14)

* **Feature**: This release updates the ListBuckets API Reference documentation in support of the new 10,000 general purpose bucket default quota on all AWS accounts. To increase your bucket quota from 10,000 to up to 1 million buckets, simply request a quota increase via Service Quotas.

# v1.66.3 (2024-11-06)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.66.2 (2024-10-28)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.66.1 (2024-10-25)

* **Bug Fix**: Update presign post URL resolution to use the exact result from EndpointResolverV2

# v1.66.0 (2024-10-16)

* **Feature**: Add support for the new optional bucket-region and prefix query parameters in the ListBuckets API. For ListBuckets requests that express pagination, Amazon S3 will now return both the bucket names and associated AWS regions in the response.

# v1.65.3 (2024-10-11)

* **Bug Fix**: **BREAKING CHANGE**: S3 ReplicationRuleFilter and LifecycleRuleFilter shapes are being changed from union to structure types

# v1.65.2 (2024-10-08)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.65.1 (2024-10-07)

* **Bug Fix**: **CHANGE IN BEHAVIOR**: Allow serialization of headers with empty string for prefix headers. We are deploying this fix because the behavior is actively preventing users from transmitting keys with empty values to the service. If you were setting metadata keys with empty values before this change, they will now actually be sent to the service.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.65.0 (2024-10-04)

* **Feature**: Add support for HTTP client metrics.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.64.1 (2024-10-03)

* No change notes available for this release.

# v1.64.0 (2024-10-02)

* **Feature**: This release introduces a header representing the minimum object size limit for Lifecycle transitions.

# v1.63.3 (2024-09-27)

* No change notes available for this release.

# v1.63.2 (2024-09-25)

* No change notes available for this release.

# v1.63.1 (2024-09-23)

* No change notes available for this release.

# v1.63.0 (2024-09-20)

* **Feature**: Add tracing and metrics support to service clients.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.62.0 (2024-09-18)

* **Feature**: Added SSE-KMS support for directory buckets.

# v1.61.3 (2024-09-17)

* **Bug Fix**: **BREAKFIX**: Only generate AccountIDEndpointMode config for services that use it. This is a compiler break, but removes no actual functionality, as no services currently use the account ID in endpoint resolution.

# v1.61.2 (2024-09-04)

* No change notes available for this release.

# v1.61.1 (2024-09-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.61.0 (2024-08-28)

* **Feature**: Add presignPost for s3 PutObject

# v1.60.1 (2024-08-22)

* No change notes available for this release.

# v1.60.0 (2024-08-20)

* **Feature**: Amazon Simple Storage Service / Features : Add support for conditional writes for PutObject and CompleteMultipartUpload APIs.

# v1.59.0 (2024-08-15)

* **Feature**: Amazon Simple Storage Service / Features  : Adds support for pagination in the S3 ListBuckets API.
* **Dependency Update**: Bump minimum Go version to 1.21.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.58.3 (2024-08-02)

* **Bug Fix**: Add assurance tests for auth scheme selection logic.

# v1.58.2 (2024-07-10.2)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.58.1 (2024-07-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.58.0 (2024-07-02)

* **Feature**: Added response overrides to Head Object requests.

# v1.57.1 (2024-06-28)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.57.0 (2024-06-26)

* **Feature**: Support list-of-string endpoint parameter.

# v1.56.1 (2024-06-19)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.56.0 (2024-06-18)

* **Feature**: Track usage of various AWS SDK features in user-agent string.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.55.2 (2024-06-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.55.1 (2024-06-07)

* **Bug Fix**: Add clock skew correction on all service clients
* **Dependency Update**: Updated to the latest SDK module versions

# v1.55.0 (2024-06-05)

* **Feature**: Added new params copySource and key to copyObject API for supporting S3 Access Grants plugin. These changes will not change any of the existing S3 API functionality.
* **Bug Fix**: Add S3-specific smithy protocol tests.

# v1.54.4 (2024-06-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.54.3 (2024-05-23)

* **Bug Fix**: Prevent parsing failures for nonstandard `Expires` values in responses. If the SDK cannot parse the value set in the response header for this field it will now be returned as `nil`. A new field, `ExpiresString`, has been added that will retain the unparsed value from the response (regardless of whether it came back in a format recognized by the SDK).

# v1.54.2 (2024-05-16)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.54.1 (2024-05-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.54.0 (2024-05-14)

* **Feature**: Updated a few x-id in the http uri traits

# v1.53.2 (2024-05-08)

* **Bug Fix**: GoDoc improvement

# v1.53.1 (2024-03-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.53.0 (2024-03-18)

* **Feature**: Fix two issues with response root node names.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.52.1 (2024-03-15)

* **Documentation**: Documentation updates for Amazon S3.

# v1.52.0 (2024-03-13)

* **Feature**: This release makes the default option for S3 on Outposts request signing to use the SigV4A algorithm when using AWS Common Runtime (CRT).

# v1.51.4 (2024-03-07)

* **Bug Fix**: Remove dependency on go-cmp.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.51.3 (2024-03-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.51.2 (2024-03-04)

* **Bug Fix**: Update internal/presigned-url dependency for corrected API name.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.51.1 (2024-02-23)

* **Bug Fix**: Move all common, SDK-side middleware stack ops into the service client module to prevent cross-module compatibility issues in the future.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.51.0 (2024-02-22)

* **Feature**: Add middleware stack snapshot tests.

# v1.50.3 (2024-02-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.50.2 (2024-02-20)

* **Bug Fix**: When sourcing values for a service's `EndpointParameters`, the lack of a configured region (i.e. `options.Region == ""`) will now translate to a `nil` value for `EndpointParameters.Region` instead of a pointer to the empty string `""`. This will result in a much more explicit error when calling an operation instead of an obscure hostname lookup failure.

# v1.50.1 (2024-02-19)

* **Bug Fix**: Prevent potential panic caused by invalid comparison of credentials.

# v1.50.0 (2024-02-16)

* **Feature**: Add new ClientOptions field to waiter config which allows you to extend the config for operation calls made by waiters.

# v1.49.0 (2024-02-13)

* **Feature**: Bump minimum Go version to 1.20 per our language support policy.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.48.1 (2024-01-24)

* No change notes available for this release.

# v1.48.0 (2024-01-05)

* **Feature**: Support smithy sigv4a trait for codegen.

# v1.47.8 (2024-01-04)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.47.7 (2023-12-20)

* No change notes available for this release.

# v1.47.6 (2023-12-18)

* No change notes available for this release.

# v1.47.5 (2023-12-08)

* **Bug Fix**: Add non-vhostable buckets to request path when using legacy V1 endpoint resolver.
* **Bug Fix**: Improve uniqueness of default S3Express sesssion credentials cache keying to prevent collision in multi-credential scenarios.
* **Bug Fix**: Reinstate presence of default Retryer in functional options, but still respect max attempts set therein.

# v1.47.4 (2023-12-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.47.3 (2023-12-06)

* **Bug Fix**: Restore pre-refactor auth behavior where all operations could technically be performed anonymously.

# v1.47.2 (2023-12-01)

* **Bug Fix**: Correct wrapping of errors in authentication workflow.
* **Bug Fix**: Correctly recognize cache-wrapped instances of AnonymousCredentials at client construction.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.47.1 (2023-11-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.47.0 (2023-11-29)

* **Feature**: Expose Options() accessor on service clients.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.46.0 (2023-11-28.2)

* **Feature**: Add S3Express support.
* **Feature**: Adds support for S3 Express One Zone.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.45.1 (2023-11-28)

* **Bug Fix**: Respect setting RetryMaxAttempts in functional options at client construction.

# v1.45.0 (2023-11-27)

* **Feature**: Adding new params - Key and Prefix, to S3 API operations for supporting S3 Access Grants. Note - These updates will not change any of the existing S3 API functionality.

# v1.44.0 (2023-11-21)

* **Feature**: Add support for automatic date based partitioning in S3 Server Access Logs.
* **Bug Fix**: Don't send MaxKeys/MaxUploads=0 when unspecified in ListObjectVersions and ListMultipartUploads paginators.

# v1.43.1 (2023-11-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.43.0 (2023-11-17)

* **Feature**: **BREAKING CHANGE** Correct nullability of a large number of S3 structure fields. See https://github.com/aws/aws-sdk-go-v2/issues/2162.
* **Feature**: Removes all default 0 values for numbers and false values for booleans

# v1.42.2 (2023-11-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.42.1 (2023-11-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.42.0 (2023-11-01)

* **Feature**: Adds support for configured endpoints via environment variables and the AWS shared configuration file.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.41.0 (2023-10-31)

* **Feature**: **BREAKING CHANGE**: Bump minimum go version to 1.19 per the revised [go version support policy](https://aws.amazon.com/blogs/developer/aws-sdk-for-go-aligns-with-go-release-policy-on-supported-runtimes/).
* **Dependency Update**: Updated to the latest SDK module versions

# v1.40.2 (2023-10-12)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.40.1 (2023-10-06)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.40.0 (2023-09-26)

* **Feature**: This release adds a new field COMPLETED to the ReplicationStatus Enum. You can now use this field to validate the replication status of S3 objects using the AWS SDK.

# v1.39.0 (2023-09-20)

* **Feature**: Fix an issue where the SDK can fail to unmarshall response due to NumberFormatException

# v1.38.5 (2023-08-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.38.4 (2023-08-18)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.38.3 (2023-08-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.38.2 (2023-08-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.38.1 (2023-08-01)

* No change notes available for this release.

# v1.38.0 (2023-07-31)

* **Feature**: Adds support for smithy-modeled endpoint resolution. A new rules-based endpoint resolution will be added to the SDK which will supercede and deprecate existing endpoint resolution. Specifically, EndpointResolver will be deprecated while BaseEndpoint and EndpointResolverV2 will take its place. For more information, please see the Endpoints section in our Developer Guide.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.1 (2023-07-28)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.37.0 (2023-07-13)

* **Feature**: S3 Inventory now supports Object Access Control List and Object Owner as available object metadata fields in inventory reports.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.36.0 (2023-06-28)

* **Feature**: The S3 LISTObjects, ListObjectsV2 and ListObjectVersions API now supports a new optional header x-amz-optional-object-attributes. If header contains RestoreStatus as the value, then S3 will include Glacier restore status i.e. isRestoreInProgress and RestoreExpiryDate in List response.

# v1.35.0 (2023-06-16)

* **Feature**: This release adds SDK support for request-payer request header and request-charged response header in the "GetBucketAccelerateConfiguration", "ListMultipartUploads", "ListObjects", "ListObjectsV2" and "ListObjectVersions" S3 APIs.

# v1.34.1 (2023-06-15)

* No change notes available for this release.

# v1.34.0 (2023-06-13)

* **Feature**: Integrate double encryption feature to SDKs.
* **Bug Fix**: Fix HeadObject to return types.Nound when an object does not exist. Fixes [2084](https://github.com/aws/aws-sdk-go-v2/issues/2084)
* **Dependency Update**: Updated to the latest SDK module versions

# v1.33.1 (2023-05-04)

* **Documentation**: Documentation updates for Amazon S3

# v1.33.0 (2023-04-24)

* **Feature**: added custom paginators for listMultipartUploads and ListObjectVersions
* **Dependency Update**: Updated to the latest SDK module versions

# v1.32.0 (2023-04-19)

* **Feature**: Provides support for "Snow" Storage class.

# v1.31.3 (2023-04-10)

* No change notes available for this release.

# v1.31.2 (2023-04-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.31.1 (2023-03-31)

* **Documentation**: Documentation updates for Amazon S3

# v1.31.0 (2023-03-21)

* **Feature**: port v1 sdk 100-continue http header customization for s3 PutObject/UploadPart request and enable user config
* **Dependency Update**: Updated to the latest SDK module versions

# v1.30.6 (2023-03-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.30.5 (2023-02-22)

* **Bug Fix**: Prevent nil pointer dereference when retrieving error codes.

# v1.30.4 (2023-02-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.30.3 (2023-02-14)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.30.2 (2023-02-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.30.1 (2023-01-23)

* No change notes available for this release.

# v1.30.0 (2023-01-05)

* **Feature**: Add `ErrorCodeOverride` field to all error structs (aws/smithy-go#401).

# v1.29.6 (2022-12-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.5 (2022-12-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.4 (2022-11-22)

* No change notes available for this release.

# v1.29.3 (2022-11-16)

* No change notes available for this release.

# v1.29.2 (2022-11-10)

* No change notes available for this release.

# v1.29.1 (2022-10-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.0 (2022-10-21)

* **Feature**: S3 on Outposts launches support for automatic bucket-style alias. You can use the automatic access point alias instead of an access point ARN for any object-level operation in an Outposts bucket.
* **Bug Fix**: The SDK client has been updated to utilize the `aws.IsCredentialsProvider` function for determining if `aws.AnonymousCredentials` has been configured for the `CredentialProvider`.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.28.0 (2022-10-19)

* **Feature**: Updates internal logic for constructing API endpoints. We have added rule-based endpoints and internal model parameters.

# v1.27.11 (2022-09-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.10 (2022-09-14)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.9 (2022-09-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.8 (2022-08-31)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.7 (2022-08-30)

* No change notes available for this release.

# v1.27.6 (2022-08-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.5 (2022-08-11)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.4 (2022-08-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.3 (2022-08-08)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.2 (2022-08-01)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.1 (2022-07-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.0 (2022-07-01)

* **Feature**: Add presign support for HeadBucket, DeleteObject, and DeleteBucket. Fixes [#1076](https://github.com/aws/aws-sdk-go-v2/issues/1076).

# v1.26.12 (2022-06-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.11 (2022-06-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.10 (2022-05-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.9 (2022-05-06)

* No change notes available for this release.

# v1.26.8 (2022-05-03)

* **Documentation**: Documentation only update for doc bug fixes for the S3 API docs.

# v1.26.7 (2022-04-27)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.6 (2022-04-25)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.5 (2022-04-12)

* **Bug Fix**: Fixes an issue that caused the unexported constructor function names for EventStream types to be swapped for the event reader and writer respectivly.

# v1.26.4 (2022-04-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.3 (2022-03-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.2 (2022-03-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.1 (2022-03-23)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.0 (2022-03-08)

* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.25.0 (2022-02-24)

* **Feature**: API client updated
* **Feature**: Adds RetryMaxAttempts and RetryMod to API client Options. This allows the API clients' default Retryer to be configured from the shared configuration files or environment variables. Adding a new Retry mode of `Adaptive`. `Adaptive` retry mode is an experimental mode, adding client rate limiting when throttles reponses are received from an API. See [retry.AdaptiveMode](https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/aws/retry#AdaptiveMode) for more details, and configuration options.
* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Bug Fix**: Fixes the AWS Sigv4 signer to trim header value's whitespace when computing the canonical headers block of the string to sign.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.24.1 (2022-01-28)

* **Bug Fix**: Updates SDK API client deserialization to pre-allocate byte slice and string response payloads, [#1565](https://github.com/aws/aws-sdk-go-v2/pull/1565). Thanks to [Tyson Mote](https://github.com/tysonmote) for submitting this PR.

# v1.24.0 (2022-01-14)

* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.23.0 (2022-01-07)

* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Documentation**: API client updated
* **Dependency Update**: Updated to the latest SDK module versions

# v1.22.0 (2021-12-21)

* **Feature**: API Paginators now support specifying the initial starting token, and support stopping on empty string tokens.
* **Feature**: Updated to latest service endpoints

# v1.21.0 (2021-12-02)

* **Feature**: API client updated
* **Bug Fix**: Fixes a bug that prevented aws.EndpointResolverWithOptions from being used by the service client. ([#1514](https://github.com/aws/aws-sdk-go-v2/pull/1514))
* **Dependency Update**: Updated to the latest SDK module versions

# v1.20.0 (2021-11-30)

* **Feature**: API client updated

# v1.19.1 (2021-11-19)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.19.0 (2021-11-12)

* **Feature**: Waiters now have a `WaitForOutput` method, which can be used to retrieve the output of the successful wait operation. Thank you to [Andrew Haines](https://github.com/haines) for contributing this feature.

# v1.18.0 (2021-11-06)

* **Feature**: Support has been added for the SelectObjectContent API.
* **Feature**: The SDK now supports configuration of FIPS and DualStack endpoints using environment variables, shared configuration, or programmatically.
* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Feature**: Updated service to latest API model.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.0 (2021-10-21)

* **Feature**: Updated  to latest version
* **Feature**: Updates S3 streaming operations - PutObject, UploadPart, WriteGetObjectResponse to use unsigned payload signing auth when TLS is enabled.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.16.1 (2021-10-11)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.16.0 (2021-09-17)

* **Feature**: Updated API client and endpoints to latest revision.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.1 (2021-09-10)

* No change notes available for this release.

# v1.15.0 (2021-09-02)

* **Feature**: API client updated
* **Feature**: Add support for S3 Multi-Region Access Point ARNs.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.14.0 (2021-08-27)

* **Feature**: Updated API model to latest revision.
* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.13.0 (2021-08-19)

* **Feature**: API client updated
* **Dependency Update**: Updated to the latest SDK module versions

# v1.12.0 (2021-08-04)

* **Feature**: Add `HeadObject` presign support. ([#1346](https://github.com/aws/aws-sdk-go-v2/pull/1346))
* **Dependency Update**: Updated `github.com/aws/smithy-go` to latest version.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.11.1 (2021-07-15)

* **Dependency Update**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.11.0 (2021-06-25)

* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.10.0 (2021-06-04)

* **Feature**: The handling of AccessPoint and Outpost ARNs have been updated.
* **Feature**: Updated service client to latest API model.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.9.0 (2021-05-25)

* **Feature**: API client updated

# v1.8.0 (2021-05-20)

* **Feature**: API client updated
* **Dependency Update**: Updated to the latest SDK module versions

# v1.7.0 (2021-05-14)

* **Feature**: Constant has been added to modules to enable runtime version inspection for reporting.
* **Feature**: Updated to latest service API model.
* **Dependency Update**: Updated to the latest SDK module versions

