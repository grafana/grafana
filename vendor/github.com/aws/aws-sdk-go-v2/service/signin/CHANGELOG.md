# v1.0.5 (2026-01-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.0.4 (2025-12-08)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.0.3 (2025-12-02)

* **Dependency Update**: Updated to the latest SDK module versions
* **Dependency Update**: Upgrade to smithy-go v1.24.0. Notably this version of the library reduces the allocation footprint of the middleware system. We observe a ~10% reduction in allocations per SDK call with this change.

# v1.0.2 (2025-11-25)

* **Bug Fix**: Add error check for endpoint param binding during auth scheme resolution to fix panic reported in #3234

# v1.0.1 (2025-11-19.2)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.0.0 (2025-11-19)

* **Release**: New AWS service client module
* **Feature**: AWS Sign-In manages authentication for AWS services. This service provides secure authentication flows for accessing AWS resources from the console and developer tools. This release adds the CreateOAuth2Token API, which can be used to fetch OAuth2 access tokens and refresh tokens from Sign-In.

