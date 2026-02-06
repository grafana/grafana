# Code Generation - Azure Blob SDK for Golang

### Settings

```yaml
go: true
clear-output-folder: false
version: "^3.0.0"
license-header: MICROSOFT_MIT_NO_VERSION
input-file: "https://raw.githubusercontent.com/Azure/azure-rest-api-specs/ae95eb6a4701d844bada7d1c4f5ecf4a7444e5b8/specification/storage/data-plane/Microsoft.BlobStorage/stable/2025-01-05/blob.json"
credential-scope: "https://storage.azure.com/.default"
output-folder: ../generated
file-prefix: "zz_"
openapi-type: "data-plane"
verbose: true
security: AzureKey
modelerfour:
  group-parameters: false
  seal-single-value-enum-by-default: true
  lenient-model-deduplication: true
export-clients: true
use: "@autorest/go@4.0.0-preview.65"
```

### Add a Properties field to the BlobPrefix definition
```yaml
directive:
- from: swagger-document
  where: $.definitions
  transform: >
    $.BlobPrefix.properties["Properties"] = {
      "type": "object",
      "$ref": "#/definitions/BlobPropertiesInternal"
    };
```

### Add Owner,Group,Permissions,Acl,ResourceType in ListBlob Response
``` yaml
directive:  
- from: swagger-document    
  where: $.definitions
  transform: >
    $.BlobPropertiesInternal.properties["Owner"] = {
      "type" : "string",
    };
    $.BlobPropertiesInternal.properties["Group"] = {
      "type" : "string",
    };
    $.BlobPropertiesInternal.properties["Permissions"] = {
      "type" : "string",
    };
    $.BlobPropertiesInternal.properties["Acl"] = {
      "type" : "string",
    };
    $.BlobPropertiesInternal.properties["ResourceType"] = {
      "type" : "string",
    };

```

### Add permissions in ListBlobsInclude
``` yaml
directive:  
- from: swagger-document    
  where: $.parameters.ListBlobsInclude    
  transform: >        
    $.items.enum.push("permissions");
```

### Updating service version to 2025-05-05
```yaml
directive:
- from: 
  - zz_appendblob_client.go
  - zz_blob_client.go
  - zz_blockblob_client.go
  - zz_container_client.go
  - zz_pageblob_client.go
  - zz_service_client.go
  where: $
  transform: >-
    return $.
      replaceAll(`[]string{"2025-01-05"}`, `[]string{ServiceVersion}`);
```

### Fix CRC Response Header in PutBlob response
``` yaml
directive:
- from: swagger-document
  where: $["x-ms-paths"]["/{containerName}/{blob}?BlockBlob"].put.responses["201"].headers
  transform: >
      $["x-ms-content-crc64"] = {
        "x-ms-client-name": "ContentCRC64",
        "type": "string",
        "format": "byte",
        "description": "Returned for a block blob so that the client can check the integrity of message content."
      };
```

### Undo breaking change with BlobName 
``` yaml
directive:
- from: zz_models.go
  where: $
  transform: >-
    return $.
      replace(/Name\s+\*BlobName/g, `Name *string`);
```

### Removing UnmarshalXML for BlobItems to create customer UnmarshalXML function
```yaml
directive:
- from: swagger-document
  where: $.definitions
  transform: >
    $.BlobItemInternal["x-ms-go-omit-serde-methods"] = true;
```

### Remove pager methods and export various generated methods in container client

``` yaml
directive:
  - from: zz_container_client.go
    where: $
    transform: >-
      return $.
        replace(/func \(client \*ContainerClient\) NewListBlobFlatSegmentPager\(.+\/\/ listBlobFlatSegmentCreateRequest creates the ListBlobFlatSegment request/s, `//\n// listBlobFlatSegmentCreateRequest creates the ListBlobFlatSegment request`).
        replace(/\(client \*ContainerClient\) listBlobFlatSegmentCreateRequest\(/, `(client *ContainerClient) ListBlobFlatSegmentCreateRequest(`).
        replace(/\(client \*ContainerClient\) listBlobFlatSegmentHandleResponse\(/, `(client *ContainerClient) ListBlobFlatSegmentHandleResponse(`);
```

### Remove pager methods and export various generated methods in service client

``` yaml
directive:
  - from: zz_service_client.go
    where: $
    transform: >-
      return $.
        replace(/func \(client \*ServiceClient\) NewListContainersSegmentPager\(.+\/\/ listContainersSegmentCreateRequest creates the ListContainersSegment request/s, `//\n// listContainersSegmentCreateRequest creates the ListContainersSegment request`).
        replace(/\(client \*ServiceClient\) listContainersSegmentCreateRequest\(/, `(client *ServiceClient) ListContainersSegmentCreateRequest(`).
        replace(/\(client \*ServiceClient\) listContainersSegmentHandleResponse\(/, `(client *ServiceClient) ListContainersSegmentHandleResponse(`);
```

### Fix BlobMetadata.

``` yaml
directive:
- from: swagger-document
  where: $.definitions
  transform: >
    delete $.BlobMetadata["properties"];

```

### Don't include container name or blob in path - we have direct URIs.

``` yaml
directive:
- from: swagger-document
  where: $["x-ms-paths"]
  transform: >
    for (const property in $)
    {
        if (property.includes('/{containerName}/{blob}'))
        {
            $[property]["parameters"] = $[property]["parameters"].filter(function(param) { return (typeof param['$ref'] === "undefined") || (false == param['$ref'].endsWith("#/parameters/ContainerName") && false == param['$ref'].endsWith("#/parameters/Blob"))});
        } 
        else if (property.includes('/{containerName}'))
        {
            $[property]["parameters"] = $[property]["parameters"].filter(function(param) { return (typeof param['$ref'] === "undefined") || (false == param['$ref'].endsWith("#/parameters/ContainerName"))});
        }
    }
```

### Remove DataLake stuff.

``` yaml
directive:
- from: swagger-document
  where: $["x-ms-paths"]
  transform: >
    for (const property in $)
    {
        if (property.includes('filesystem'))
        {
            delete $[property];
        }
    }
```

### Remove DataLakeStorageError

``` yaml
directive:
- from: swagger-document
  where: $.definitions
  transform: >
    delete $.DataLakeStorageError;
```

### Fix 304s

``` yaml
directive:
- from: swagger-document
  where: $["x-ms-paths"]["/{containerName}/{blob}"]
  transform: >
    $.get.responses["304"] = {
      "description": "The condition specified using HTTP conditional header(s) is not met.",
      "x-az-response-name": "ConditionNotMetError",
      "headers": { "x-ms-error-code": { "x-ms-client-name": "ErrorCode", "type": "string" } }
    };
```

### Fix GeoReplication

``` yaml
directive:
- from: swagger-document
  where: $.definitions
  transform: >
    delete $.GeoReplication.properties.Status["x-ms-enum"];
    $.GeoReplication.properties.Status["x-ms-enum"] = {
        "name": "BlobGeoReplicationStatus",
        "modelAsString": false
    };
```

### Fix RehydratePriority

``` yaml
directive:
- from: swagger-document
  where: $.definitions
  transform: >
    delete $.RehydratePriority["x-ms-enum"];
    $.RehydratePriority["x-ms-enum"] = {
        "name": "RehydratePriority",
        "modelAsString": false
    };
```

### Fix BlobDeleteType

``` yaml
directive:
- from: swagger-document
  where: $.parameters
  transform: >
    delete $.BlobDeleteType.enum;
    $.BlobDeleteType.enum = [
        "None",
        "Permanent"
    ];
```

### Fix EncryptionAlgorithm

``` yaml
directive:
- from: swagger-document
  where: $.parameters
  transform: >
    delete $.EncryptionAlgorithm.enum;
    $.EncryptionAlgorithm.enum = [
      "None",
      "AES256"
    ];
```

### Fix XML string "ObjectReplicationMetadata" to "OrMetadata"

``` yaml
directive:
- from: swagger-document
  where: $.definitions
  transform: >
    $.BlobItemInternal.properties["OrMetadata"] = $.BlobItemInternal.properties["ObjectReplicationMetadata"];
    delete $.BlobItemInternal.properties["ObjectReplicationMetadata"];
```

# Export various createRequest/HandleResponse methods

``` yaml
directive:
- from: zz_container_client.go
  where: $
  transform: >-
    return $.
      replace(/listBlobHierarchySegmentCreateRequest/g, function(_, s) { return `ListBlobHierarchySegmentCreateRequest` }).
      replace(/listBlobHierarchySegmentHandleResponse/g, function(_, s) { return `ListBlobHierarchySegmentHandleResponse` });

- from: zz_pageblob_client.go
  where: $
  transform: >-
    return $.
      replace(/getPageRanges(Diff)?CreateRequest/g, function(_, s) { if (s === undefined) { s = '' }; return `GetPageRanges${s}CreateRequest` }).
      replace(/getPageRanges(Diff)?HandleResponse/g, function(_, s) { if (s === undefined) { s = '' }; return `GetPageRanges${s}HandleResponse` });
```

### Clean up some const type names so they don't stutter

``` yaml
directive:
- from: swagger-document
  where: $.parameters['BlobDeleteType']
  transform: >
    $["x-ms-enum"].name = "DeleteType";
    $["x-ms-client-name"] = "DeleteType";

- from: swagger-document
  where: $.parameters['BlobExpiryOptions']
  transform: >
    $["x-ms-enum"].name = "ExpiryOptions";
    $["x-ms-client-name"].name = "ExpiryOptions";

- from: swagger-document
  where: $["x-ms-paths"][*].*.responses[*].headers["x-ms-immutability-policy-mode"]
  transform: >
    $["x-ms-client-name"].name = "ImmutabilityPolicyMode";
    $.enum = [ "Mutable", "Unlocked", "Locked"];
    $["x-ms-enum"] = { "name": "ImmutabilityPolicyMode", "modelAsString": false };

- from: swagger-document
  where: $.parameters['ImmutabilityPolicyMode']
  transform: >
    $["x-ms-enum"].name = "ImmutabilityPolicySetting";
    $["x-ms-client-name"].name = "ImmutabilityPolicySetting";

- from: swagger-document
  where: $.definitions['BlobPropertiesInternal']
  transform: >
    $.properties.ImmutabilityPolicyMode["x-ms-enum"].name = "ImmutabilityPolicyMode";
```

### use azcore.ETag

``` yaml
directive:
- from:
  - zz_models.go
  - zz_options.go
  where: $
  transform: >-
    return $.
      replace(/import "time"/, `import (\n\t"time"\n\t"github.com/Azure/azure-sdk-for-go/sdk/azcore"\n)`).
      replace(/Etag\s+\*string/g, `ETag *azcore.ETag`).
      replace(/IfMatch\s+\*string/g, `IfMatch *azcore.ETag`).
      replace(/IfNoneMatch\s+\*string/g, `IfNoneMatch *azcore.ETag`).
      replace(/SourceIfMatch\s+\*string/g, `SourceIfMatch *azcore.ETag`).
      replace(/SourceIfNoneMatch\s+\*string/g, `SourceIfNoneMatch *azcore.ETag`);

- from: zz_responses.go
  where: $
  transform: >-
    return $.
      replace(/"time"/, `"time"\n\t"github.com/Azure/azure-sdk-for-go/sdk/azcore"`).
      replace(/ETag\s+\*string/g, `ETag *azcore.ETag`);

- from:
  - zz_appendblob_client.go
  - zz_blob_client.go
  - zz_blockblob_client.go
  - zz_container_client.go
  - zz_pageblob_client.go
  where: $
  transform: >-
    return $.
      replace(/"github\.com\/Azure\/azure\-sdk\-for\-go\/sdk\/azcore\/policy"/, `"github.com/Azure/azure-sdk-for-go/sdk/azcore"\n\t"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"`).
      replace(/result\.ETag\s+=\s+&val/g, `result.ETag = (*azcore.ETag)(&val)`).
      replace(/\*modifiedAccessConditions.IfMatch/g, `string(*modifiedAccessConditions.IfMatch)`).
      replace(/\*modifiedAccessConditions.IfNoneMatch/g, `string(*modifiedAccessConditions.IfNoneMatch)`).
      replace(/\*sourceModifiedAccessConditions.SourceIfMatch/g, `string(*sourceModifiedAccessConditions.SourceIfMatch)`).
      replace(/\*sourceModifiedAccessConditions.SourceIfNoneMatch/g, `string(*sourceModifiedAccessConditions.SourceIfNoneMatch)`);
```

### Unsure why this casing changed, but fixing it

``` yaml
directive:
- from: zz_models.go
  where: $
  transform: >-
    return $.
      replace(/SignedOid\s+\*string/g, `SignedOID *string`).
      replace(/SignedTid\s+\*string/g, `SignedTID *string`);
```

### Fixing Typo with StorageErrorCodeIncrementalCopyOfEarlierVersionSnapshotNotAllowed

``` yaml
directive:
- from: zz_constants.go
  where: $
  transform: >-
    return $.
      replace(/IncrementalCopyOfEralierVersionSnapshotNotAllowed/g, "IncrementalCopyOfEarlierVersionSnapshotNotAllowed");
```

### Fix up x-ms-content-crc64 header response name

``` yaml
directive:
- from: swagger-document
  where: $.x-ms-paths.*.*.responses.*.headers.x-ms-content-crc64
  transform: >
    $["x-ms-client-name"] = "ContentCRC64"
```

``` yaml
directive:
- rename-model:
    from: BlobItemInternal
    to: BlobItem
- rename-model:
    from: BlobPropertiesInternal
    to: BlobProperties
```

### Updating encoding URL, Golang adds '+' which disrupts encoding with service

``` yaml
directive:
- from: 
  - zz_service_client.go
  - zz_container_client.go
  where: $
  transform: >-
    return $.
      replace(/req.Raw\(\).URL.RawQuery \= reqQP.Encode\(\)/g, `req.Raw().URL.RawQuery = strings.Replace(reqQP.Encode(), "+", "%20", -1)`);
```

### Change `where` parameter in blob filtering to be required

``` yaml
directive:
- from: swagger-document
  where: $.parameters.FilterBlobsWhere
  transform: >
    $.required = true;
```

### Change `Duration` parameter in leases to be required

``` yaml
directive:
- from: swagger-document
  where: $.parameters.LeaseDuration
  transform: >
    $.required = true;
```

### Change CPK acronym to be all caps

``` yaml
directive:
  - from: source-file-go
    where: $
    transform: >-
      return $.
        replace(/Cpk/g, "CPK");
```

### Change CORS acronym to be all caps

``` yaml
directive:
  - from: source-file-go
    where: $
    transform: >-
      return $.
        replace(/Cors/g, "CORS");
```

### Change cors xml to be correct

``` yaml
directive:
  - from: source-file-go
    where: $
    transform: >-
      return $.
        replace(/xml:"CORS>CORSRule"/g, "xml:\"Cors>CorsRule\"");
```

### Fix Content-Type header in submit batch request

``` yaml
directive:
- from: 
  - zz_container_client.go
  - zz_service_client.go
  where: $
  transform: >-
    return $.
      replace (/req.SetBody\(body\,\s+\"application\/xml\"\)/g, `req.SetBody(body, multipartContentType)`);
```

### Fix response status code check in submit batch request

``` yaml
directive:
- from: zz_service_client.go
  where: $
  transform: >-
    return $.
      replace(/if\s+!runtime\.HasStatusCode\(httpResp,\s+http\.StatusOK\)\s+\{\s+err\s+=\s+runtime\.NewResponseError\(httpResp\)\s+return ServiceClientSubmitBatchResponse\{\}\,\s+err\s+}/g, 
      `if !runtime.HasStatusCode(httpResp, http.StatusAccepted) {\n\t\terr = runtime.NewResponseError(httpResp)\n\t\treturn ServiceClientSubmitBatchResponse{}, err\n\t}`);
```

### Convert time to GMT for If-Modified-Since and If-Unmodified-Since request headers

``` yaml
directive:
- from: 
  - zz_container_client.go
  - zz_blob_client.go
  - zz_appendblob_client.go
  - zz_blockblob_client.go
  - zz_pageblob_client.go
  where: $
  transform: >-
    return $.
      replace (/req\.Raw\(\)\.Header\[\"If-Modified-Since\"\]\s+=\s+\[\]string\{modifiedAccessConditions\.IfModifiedSince\.Format\(time\.RFC1123\)\}/g, 
      `req.Raw().Header["If-Modified-Since"] = []string{(*modifiedAccessConditions.IfModifiedSince).In(gmt).Format(time.RFC1123)}`).
      replace (/req\.Raw\(\)\.Header\[\"If-Unmodified-Since\"\]\s+=\s+\[\]string\{modifiedAccessConditions\.IfUnmodifiedSince\.Format\(time\.RFC1123\)\}/g, 
      `req.Raw().Header["If-Unmodified-Since"] = []string{(*modifiedAccessConditions.IfUnmodifiedSince).In(gmt).Format(time.RFC1123)}`).
      replace (/req\.Raw\(\)\.Header\[\"x-ms-source-if-modified-since\"\]\s+=\s+\[\]string\{sourceModifiedAccessConditions\.SourceIfModifiedSince\.Format\(time\.RFC1123\)\}/g, 
      `req.Raw().Header["x-ms-source-if-modified-since"] = []string{(*sourceModifiedAccessConditions.SourceIfModifiedSince).In(gmt).Format(time.RFC1123)}`).
      replace (/req\.Raw\(\)\.Header\[\"x-ms-source-if-unmodified-since\"\]\s+=\s+\[\]string\{sourceModifiedAccessConditions\.SourceIfUnmodifiedSince\.Format\(time\.RFC1123\)\}/g, 
      `req.Raw().Header["x-ms-source-if-unmodified-since"] = []string{(*sourceModifiedAccessConditions.SourceIfUnmodifiedSince).In(gmt).Format(time.RFC1123)}`).
      replace (/req\.Raw\(\)\.Header\[\"x-ms-immutability-policy-until-date\"\]\s+=\s+\[\]string\{options\.ImmutabilityPolicyExpiry\.Format\(time\.RFC1123\)\}/g, 
      `req.Raw().Header["x-ms-immutability-policy-until-date"] = []string{(*options.ImmutabilityPolicyExpiry).In(gmt).Format(time.RFC1123)}`);
      
