# Release History

## 1.6.1 (2025-04-16)

### Bugs Fixed
* Fixed return value of DownloadBuffer when the HTTPRange count given is greater than the data length. Fixes [#23884](https://github.com/Azure/azure-sdk-for-go/issues/23884)

### Other Changes
* Updated `azidentity` version to `1.9.0`
* Updated `azcore` version to `1.18.0`

## 1.6.1-beta.1 (2025-02-12)

### Features Added
* Upgraded service version to `2025-05-05`.

## 1.6.0 (2025-01-23)

### Features Added
* Upgraded service version to `2025-01-05`.

## 1.6.0-beta.1 (2025-01-13)

### Features Added
* Added permissions & resourcetype parameters in listblob response.
* Added BlobProperties field in BlobPrefix definition in listblob response.

### Bugs Fixed
* Fix FilterBlob API if Query contains a space character. Fixes [#23546](https://github.com/Azure/azure-sdk-for-go/issues/23546)

## 1.5.0 (2024-11-13)

### Features Added
* Fix compareHeaders custom sorting algorithm for String To Sign.

## 1.5.0-beta.1 (2024-10-22)

### Other Changes
* Updated `azcore` version to `1.16.0`
* Updated `azidentity` version to `1.8.0`

## 1.4.1 (2024-09-18)

### Features Added
* Added crc64 response header to Put Blob.
* Upgraded service version to `2024-08-04`.

## 1.4.1-beta.1 (2024-08-27)

### Features Added
* Upgraded service version to `2024-08-04`.

### Other Changes
* Updated `azcore` version to `1.14.0`

## 1.4.0 (2024-07-18)

### Other Changes
* GetProperties() was called twice in DownloadFile method. Enhanced to call it only once, reducing latency.
* Updated `azcore` version to `1.13.0`

## 1.4.0-beta.1 (2024-06-14)

### Features Added
* Updated service version to `2024-05-04`.

### Other Changes
* Updated `azidentity` version to `1.6.0`
* Updated `azcore` version to `1.12.0`

## 1.3.2 (2024-04-09)

### Bugs Fixed
* Fixed an issue where GetSASURL() was providing HTTPS SAS, instead of the default http+https SAS. Fixes [#22448](https://github.com/Azure/azure-sdk-for-go/issues/22448)

### Other Changes
* Integrate `InsecureAllowCredentialWithHTTP` client options.
* Update dependencies.

## 1.3.1 (2024-02-28)

### Bugs Fixed

* Re-enabled `SharedKeyCredential` authentication mode for non TLS protected endpoints.
* Use random write in `DownloadFile` method. Fixes [#22426](https://github.com/Azure/azure-sdk-for-go/issues/22426).

## 1.3.0 (2024-02-12)

### Bugs Fixed
* Fix concurrency issue while Downloading File. Fixes [#22156](https://github.com/Azure/azure-sdk-for-go/issues/22156). 
* Fix panic when nil options bag is passed to NewGetPageRangesPager. Fixes [22356](https://github.com/Azure/azure-sdk-for-go/issues/22356).
* Fix file offset update after Download file. Fixes [#22297](https://github.com/Azure/azure-sdk-for-go/issues/22297).

### Other Changes
* Updated the version of `azcore` to `1.9.2`

## 1.3.0-beta.1 (2024-01-09)

### Features Added

* Updated service version to `2023-11-03`.
* Added support for Audience when OAuth is used.

### Bugs Fixed

* Block `SharedKeyCredential` authentication mode for non TLS protected endpoints. Fixes [#21841](https://github.com/Azure/azure-sdk-for-go/issues/21841).

## 1.2.1 (2023-12-13)

### Features Added

* Exposed GetSASURL from specialized clients

### Bugs Fixed

* Fixed case in Blob Batch API when blob path has / in it. Fixes [#21649](https://github.com/Azure/azure-sdk-for-go/issues/21649).
* Fixed SharedKeyMissingError when using client.BlobClient().GetSASURL() method
* Fixed an issue that would cause metadata keys with empty values to be omitted when enumerating blobs.
* Fixed an issue where passing empty map to set blob tags API was causing panic. Fixes [#21869](https://github.com/Azure/azure-sdk-for-go/issues/21869).
* Fixed an issue where downloaded file has incorrect size when not a multiple of block size. Fixes [#21995](https://github.com/Azure/azure-sdk-for-go/issues/21995).
* Fixed case where `io.ErrUnexpectedEOF` was treated as expected error in `UploadStream`. Fixes [#21837](https://github.com/Azure/azure-sdk-for-go/issues/21837).

### Other Changes

* Updated the version of `azcore` to `1.9.1` and `azidentity` to `1.4.0`.

## 1.2.0 (2023-10-11)

### Bugs Fixed
* Fixed null pointer exception when `SetImmutabilityPolicyOptions` is passed as `nil`.

## 1.2.0-beta.1 (2023-09-18)

### Features Added
* Added support for service version 2020-12-06, 2021-02-12, 2021-04-10, 2021-06-08, 2021-08-06 , 2021-10-04, 2021-12-02, 2022-11-02, 2023-01-03, 2023-05-03, and 2023-08-03
* Added support for [Cold Tier](https://learn.microsoft.com/azure/storage/blobs/access-tiers-overview?tabs=azure-portal).
* Added `CopySourceTag` option for `UploadBlobFromURLOptions`
* Added [FilterBlobs by Tags](https://learn.microsoft.com/rest/api/storageservices/find-blobs-by-tags-container) API for container client.
* Added `System` option to `ListContainersInclude` to allow listing of system containers (i.e, $web).
* Updated the SAS Version to `2021-12-02` and added `Encryption Scope` to Account SAS, Service SAS, and User Delegation SAS
* Added `ArchiveStatusRehydratePendingToCold` value to `ArchiveStatus` enum.
* Content length limit for `AppendBlob.AppendBlock()` and `AppendBlob.AppendBlockFromURL()` raised from 4 MB to 100 MB.

### Bugs Fixed
* Fixed issue where some requests fail with mismatch in string to sign.
* Fixed service SAS creation where expiry time or permissions can be omitted when stored access policy is used. Fixes [#21229](https://github.com/Azure/azure-sdk-for-go/issues/21229).

### Other Changes
* Updating version of azcore to 1.6.0.

## 1.1.0 (2023-07-13)

### Features Added

* Added [Blob Batch API](https://learn.microsoft.com/rest/api/storageservices/blob-batch).
* Added support for bearer challenge for identity based managed disks.
* Added support for GetAccountInfo to container and blob level clients.
* Added [UploadBlobFromURL API](https://learn.microsoft.com/rest/api/storageservices/put-blob-from-url).
* Added support for CopySourceAuthorization to appendblob.AppendBlockFromURL
* Added support for tag permission in Container SAS.

### Bugs Fixed

* Fixed time formatting for the conditional request headers. Fixes [#20475](https://github.com/Azure/azure-sdk-for-go/issues/20475).
* Fixed an issue where passing a blob tags map of length 0 would result in the x-ms-tags header to be sent to the service with an empty string as value.
* Fixed block size and number of blocks calculation in `UploadBuffer` and `UploadFile`. Fixes [#20735](https://github.com/Azure/azure-sdk-for-go/issues/20735).

### Other Changes

* Add `dragonfly` to the list of build constraints for `blockblob`.
* Updating version of azcore to 1.6.0 and azidentity to 1.3.0

## 1.1.0-beta.1 (2023-05-09)

### Features Added

* Added [Blob Batch API](https://learn.microsoft.com/rest/api/storageservices/blob-batch).
* Added support for bearer challenge for identity based managed disks.
* Added support for GetAccountInfo to container and blob level clients. 
* Added [UploadBlobFromURL API](https://learn.microsoft.com/rest/api/storageservices/put-blob-from-url).
* Added support for CopySourceAuthorization to appendblob.AppendBlockFromURL
* Added support for tag permission in Container SAS. 

### Bugs Fixed

* Fixed time formatting for the conditional request headers. Fixes [#20475](https://github.com/Azure/azure-sdk-for-go/issues/20475).
* Fixed an issue where passing a blob tags map of length 0 would result in the x-ms-tags header to be sent to the service with an empty string as value.

## 1.0.0 (2023-02-07)

### Features Added

* Add support to log calculated block size and count during uploads
* Added MissingSharedKeyCredential error type for cleaner UX. Related to [#19864](https://github.com/Azure/azure-sdk-for-go/issues/19864).

### Breaking Changes

* Changed API signatures to map correctly to Azure Storage REST APIs, These changes impact:
  * `blob.GetSASURL()`
  * `blockblob.StageBlockFromURL()`
  * `container.SetAccessPolicy()`
  * `container.GetSASURL()`
  * `service.GetSASURL()`
  * `service.FilterBlobs()`
  * `lease.AcquireLease()` (blobs and containers)
  * `lease.ChangeLease()` (blobs and containers)
* Type name changes:
  * `CpkInfo` -> `CPKInfo`
  * `CpkScopeInfo` -> `CPKScopeInfo`
  * `RuleId` -> `RuleID`
  * `PolicyId` -> `PolicyID`
  * `CorsRule` -> `CORSRule`
* Remove `AccountServices` it is now hardcoded to blobs

### Bugs Fixed

* Fixed encoding issues seen in FilterBlobs. Fixes [#17421](https://github.com/Azure/azure-sdk-for-go/issues/17421).
* Fixing inconsistency seen with Metadata and ORS response. Fixes [#19688](https://github.com/Azure/azure-sdk-for-go/issues/19688).
* Fixed endless loop during pagination issue [#19773](https://github.com/Azure/azure-sdk-for-go/pull/19773).

### Other Changes

* Exported some missing types in the `blob`, `container` and `service` packages. Fixes [#19775](https://github.com/Azure/azure-sdk-for-go/issues/19775).
* SAS changes [#19781](https://github.com/Azure/azure-sdk-for-go/pull/19781):
  * AccountSASPermissions: SetImmutabilityPolicy support
  * ContainerSASPermissions: Move support
  * Validations to ensure correct sas perm ordering

## 0.6.1 (2022-12-09)

### Bugs Fixed

* Fix compilation error on Darwin.

## 0.6.0 (2022-12-08)

### Features Added

* Added BlobDeleteType to DeleteOptions to allow access to ['Permanent'](https://learn.microsoft.com/rest/api/storageservices/delete-blob#permanent-delete) DeleteType.
* Added [Set Blob Expiry API](https://learn.microsoft.com/rest/api/storageservices/set-blob-expiry).
* Added method `ServiceClient()` to the `azblob.Client` type, allowing access to the underlying service client.
* Added support for object level immutability policy with versioning (Version Level WORM).
* Added the custom CRC64 polynomial used by storage for transactional hashes, and implemented automatic hashing for transactions.

### Breaking Changes

* Corrected the name for `saoid` and `suoid` SAS parameters in `BlobSignatureValues` struct as per [this](https://learn.microsoft.com/rest/api/storageservices/create-user-delegation-sas#construct-a-user-delegation-sas)
* Updated type of `BlockSize` from int to int64 in `UploadStreamOptions`
* CRC64 transactional hashes are now supplied with a `uint64` rather than a `[]byte` to conform with Golang's `hash/crc64` package
* Field `XMSContentCRC64` has been renamed to `ContentCRC64`
* The `Lease*` constant types and values in the `blob` and `container` packages have been moved to the `lease` package and their names fixed up to avoid stuttering.
* Fields `TransactionalContentCRC64` and `TransactionalContentMD5` have been replaced by `TransactionalValidation`.
* Fields `SourceContentCRC64` and `SourceContentMD5` have been replaced by `SourceContentValidation`.
* Field `TransactionalContentMD5` has been removed from type `AppendBlockFromURLOptions`.

### Bugs Fixed

* Corrected signing of User Delegation SAS. Fixes [#19372](https://github.com/Azure/azure-sdk-for-go/issues/19372) and [#19454](https://github.com/Azure/azure-sdk-for-go/issues/19454)
* Added formatting of start and expiry time in [SetAccessPolicy](https://learn.microsoft.com/rest/api/storageservices/set-container-acl#request-body). Fixes [#18712](https://github.com/Azure/azure-sdk-for-go/issues/18712)
* Uploading block blobs larger than 256MB can fail in some cases with error `net/http: HTTP/1.x transport connection broken`.
* Blob name parameters are URL-encoded before constructing the complete blob URL.

### Other Changes

* Added some missing public surface area in the `container` and `service` packages.
* The `UploadStream()` methods now use anonymous memory mapped files for buffers in order to reduce heap allocations/fragmentation.
  * The anonymous memory mapped files are typically backed by the page/swap file, multiple files are not actually created.

## 0.5.1 (2022-10-11)

### Bugs Fixed

* `GetSASURL()`: for container and blob clients, don't add a forward slash before the query string
* Fixed issue [#19249](https://github.com/Azure/azure-sdk-for-go/issues/19249) by increasing service version to '2020-02-10'.

### Other Changes

* Improved docs for client constructors.
* Updating azcore version to 1.1.4

## 0.5.0 (2022-09-29)

### Breaking Changes

* Complete architectural change for better user experience. Please view the [README](https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/storage/azblob#readme)

### Features Added

* Added [UserDelegationCredential](https://learn.microsoft.com/rest/api/storageservices/create-user-delegation-sas) which resolves [#18976](https://github.com/Azure/azure-sdk-for-go/issues/18976), [#16916](https://github.com/Azure/azure-sdk-for-go/issues/16916), [#18977](https://github.com/Azure/azure-sdk-for-go/issues/18977)
* Added [Restore Container API](https://learn.microsoft.com/rest/api/storageservices/restore-container).

### Bugs Fixed

* Fixed issue [#18767](https://github.com/Azure/azure-sdk-for-go/issues/18767)
* Fix deadlock when error writes are slow [#16937](https://github.com/Azure/azure-sdk-for-go/pull/16937)

## 0.4.1 (2022-05-12)

### Other Changes

* Updated to latest `azcore` and `internal` modules

## 0.4.0 (2022-04-19)

### Breaking Changes

* Fixed Issue #17150 : Renaming/refactoring high level methods.
* Fixed Issue #16972 : Constructors should return clients by reference.
* Renaming the options bags to match the naming convention same as that of response. The behaviour of options bags
  remains the same.

### Bugs Fixed

* Fixed Issue #17515 : SetTags options bag missing leaseID.
* Fixed Issue #17423 : Drop "Type" suffix from `GeoReplicationStatusType`.
* Fixed Issue #17335 : Nil pointer exception when passing nil options bag in `ListBlobsFlat` API call.
* Fixed Issue #17188 : `BlobURLParts` not supporting VersionID
* Fixed Issue #17152 , Issue #17131 , Issue #17061 : `UploadStreamToBlockBlob` / `UploadStreamToBlockBlob` methods
  ignoring the options bag.
* Fixed Issue #16920 : Fixing error handling example.
* Fixed Issue #16786 : Refactoring of autorest code generation definition and adding necessary transformations.
* Fixed Issue #16679 : Response parsing issue in List blobs API.

## 0.3.0 (2022-02-09)

### Breaking Changes

* Updated to latest `azcore`. Public surface area is unchanged.
* [#16978](https://github.com/Azure/azure-sdk-for-go/pull/16978): The `DownloadResponse.Body` parameter is
  now `*RetryReaderOptions`.

### Bugs Fixed

* Fixed Issue #16193 : `azblob.GetSASToken` wrong signed resource.
* Fixed Issue #16223 : `HttpRange` does not expose its fields.
* Fixed Issue #16254 : Issue passing reader to upload `BlockBlobClient`
* Fixed Issue #16295 : Problem with listing blobs by using of `ListBlobsHierarchy()`
* Fixed Issue #16542 : Empty `StorageError` in the Azurite environment
* Fixed Issue #16679 : Unable to access Metadata when listing blobs
* Fixed Issue #16816 : `ContainerClient.GetSASToken` doesn't allow list permission.
* Fixed Issue #16988 : Too many arguments in call to `runtime.NewResponseError`

## 0.2.0 (2021-11-03)

### Breaking Changes

* Clients now have one constructor per authentication method

## 0.1.0 (2021-09-13)

### Features Added

* This is the initial preview release of the `azblob` library
