# v1.7.0 (2025-03-11)

* **Feature**: Add extra check during output checksum validation so the validation skip warning would not be logged if object is not fetched from s3

# v1.6.2 (2025-02-27)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.6.1 (2025-02-18)

* **Bug Fix**: Bump go version to 1.22
* **Dependency Update**: Updated to the latest SDK module versions

# v1.6.0 (2025-02-10)

* **Feature**: Support CRC64NVME flex checksums.

# v1.5.6 (2025-02-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.5.5 (2025-01-31)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.5.4 (2025-01-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.5.3 (2025-01-24)

* **Bug Fix**: Enable request checksum validation mode by default
* **Dependency Update**: Updated to the latest SDK module versions
* **Dependency Update**: Upgrade to smithy-go v1.22.2.

# v1.5.2 (2025-01-17)

* **Bug Fix**: Fix bug where credentials weren't refreshed during retry loop.

# v1.5.1 (2025-01-16)

* **Bug Fix**: Fix nil dereference panic for operations that require checksums, but do not have an input setting for which algorithm to use.

# v1.5.0 (2025-01-15)

* **Feature**: S3 client behavior is updated to always calculate a checksum by default for operations that support it (such as PutObject or UploadPart), or require it (such as DeleteObjects). The checksum algorithm used by default now becomes CRC32. Checksum behavior can be configured using `when_supported` and `when_required` options - in code using RequestChecksumCalculation, in shared config using request_checksum_calculation, or as env variable using AWS_REQUEST_CHECKSUM_CALCULATION. The S3 client attempts to validate response checksums for all S3 API operations that support checksums. However, if the SDK has not implemented the specified checksum algorithm then this validation is skipped. Checksum validation behavior can be configured using `when_supported` and `when_required` options - in code using ResponseChecksumValidation, in shared config using response_checksum_validation, or as env variable using AWS_RESPONSE_CHECKSUM_VALIDATION.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.8 (2025-01-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.7 (2024-12-19)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.6 (2024-12-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.5 (2024-11-18)

* **Dependency Update**: Update to smithy-go v1.22.1.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.4 (2024-11-06)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.3 (2024-10-28)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.2 (2024-10-08)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.1 (2024-10-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.0 (2024-10-04)

* **Feature**: Add support for HTTP client metrics.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.20 (2024-09-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.19 (2024-09-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.18 (2024-08-15)

* **Dependency Update**: Bump minimum Go version to 1.21.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.17 (2024-07-10.2)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.16 (2024-07-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.15 (2024-06-28)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.14 (2024-06-19)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.13 (2024-06-18)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.12 (2024-06-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.11 (2024-06-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.10 (2024-06-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.9 (2024-05-16)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.8 (2024-05-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.7 (2024-03-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.6 (2024-03-18)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.5 (2024-03-07)

* **Bug Fix**: Remove dependency on go-cmp.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.4 (2024-03-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.3 (2024-03-04)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.2 (2024-02-23)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.1 (2024-02-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.0 (2024-02-13)

* **Feature**: Bump minimum Go version to 1.20 per our language support policy.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.10 (2024-01-04)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.9 (2023-12-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.8 (2023-12-01)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.7 (2023-11-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.6 (2023-11-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.5 (2023-11-28.2)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.4 (2023-11-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.3 (2023-11-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.2 (2023-11-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.1 (2023-11-01)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.0 (2023-10-31)

* **Feature**: **BREAKING CHANGE**: Bump minimum go version to 1.19 per the revised [go version support policy](https://aws.amazon.com/blogs/developer/aws-sdk-for-go-aligns-with-go-release-policy-on-supported-runtimes/).
* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.38 (2023-10-12)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.37 (2023-10-06)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.36 (2023-08-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.35 (2023-08-18)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.34 (2023-08-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.33 (2023-08-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.32 (2023-07-31)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.31 (2023-07-28)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.30 (2023-07-13)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.29 (2023-06-13)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.28 (2023-04-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.27 (2023-04-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.26 (2023-03-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.25 (2023-03-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.24 (2023-02-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.23 (2023-02-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.22 (2022-12-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.21 (2022-12-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.20 (2022-10-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.19 (2022-10-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.18 (2022-09-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.17 (2022-09-14)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.16 (2022-09-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.15 (2022-08-31)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.14 (2022-08-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.13 (2022-08-11)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.12 (2022-08-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.11 (2022-08-08)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.10 (2022-08-01)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.9 (2022-07-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.8 (2022-06-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.7 (2022-06-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.6 (2022-05-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.5 (2022-04-27)

* **Bug Fix**: Fixes a bug that could cause the SigV4 payload hash to be incorrectly encoded, leading to signing errors.

# v1.1.4 (2022-04-25)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.3 (2022-03-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.2 (2022-03-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.1 (2022-03-23)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.0 (2022-03-08)

* **Feature**:  Updates the SDK's checksum validation logic to require opt-in to output response payload validation. The SDK was always preforming output response payload checksum validation, not respecting the output validation model option. Fixes [#1606](https://github.com/aws/aws-sdk-go-v2/issues/1606)
* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.0.0 (2022-02-24)

* **Release**: New module for computing checksums
* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

