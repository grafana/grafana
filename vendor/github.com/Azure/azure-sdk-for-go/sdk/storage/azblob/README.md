# Azure Blob Storage module for Go
[![PkgGoDev](https://pkg.go.dev/badge/github.com/Azure/azure-sdk-for-go/sdk/azblob)](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/storage/azblob)
[![Build Status](https://dev.azure.com/azure-sdk/public/_apis/build/status/go/go%20-%20azdatalake%20-%20ci?branchName=main)](https://dev.azure.com/azure-sdk/public/_build/latest?definitionId=2854&branchName=main)
[![Code Coverage](https://img.shields.io/azure-devops/coverage/azure-sdk/public/2854/main)](https://img.shields.io/azure-devops/coverage/azure-sdk/public/2854/main)

> Service Version: 2023-11-03

Azure Blob Storage is Microsoft's object storage solution for the cloud. Blob
Storage is optimized for storing massive amounts of unstructured data - data that does not adhere to a particular data model or
definition, such as text or binary data. For more information, see [Introduction to Azure Blob Storage](https://learn.microsoft.com/azure/storage/blobs/storage-blobs-introduction).

Use the Azure Blob Storage client module `github.com/Azure/azure-sdk-for-go/sdk/storage/azblob` to:

* Authenticate clients with Azure Blob Storage
* Manipulate containers and blobs in an Azure storage account

Key links:

[Source code][source] | [API reference documentation][docs] | [REST API documentation][rest_docs] | [Product documentation][product_docs] | [Samples][go_samples]

## Getting started

### Prerequisites

- [Supported](https://aka.ms/azsdk/go/supported-versions) version of Go - [Install Go](https://go.dev/doc/install)
- Azure subscription - [Create a free account](https://azure.microsoft.com/free/)
- Azure storage account - To create a storage account, use tools including the [Azure portal][storage_account_create_portal],
[Azure PowerShell][storage_account_create_ps], or the [Azure CLI][storage_account_create_cli].
Here's an example using the Azure CLI:

```bash
az storage account create --name MyStorageAccount --resource-group MyResourceGroup --location westus --sku Standard_LRS
```

### Install the package

Install the Azure Blob Storage client module for Go with [go get][goget]:

```bash
go get github.com/Azure/azure-sdk-for-go/sdk/storage/azblob
```

If you plan to authenticate with Azure Active Directory (recommended), also install the [azidentity][azidentity] module.

```bash
go get github.com/Azure/azure-sdk-for-go/sdk/azidentity
```

### Authenticate the client

To interact with the Azure Blob Storage service, you'll need to create an instance of the `azblob.Client` type.  The [azidentity][azidentity] module makes it easy to add Azure Active Directory support for authenticating Azure SDK clients with their corresponding Azure services.

```go
// create a credential for authenticating with Azure Active Directory
cred, err := azidentity.NewDefaultAzureCredential(nil)
// TODO: handle err

// create an azblob.Client for the specified storage account that uses the above credential
client, err := azblob.NewClient("https://MYSTORAGEACCOUNT.blob.core.windows.net/", cred, nil)
// TODO: handle err
```

Learn more about enabling Azure Active Directory for authentication with Azure Storage:

*  [Authorize access to blobs using Azure Active Directory][storage_ad]

Other options for authentication include connection strings, shared key, shared access signatures (SAS), and anonymous public access. Use the appropriate client constructor function for the authentication mechanism you wish to use. For examples, see:

* [Blob samples][samples]

## Key concepts

Blob Storage is designed for:

- Serving images or documents directly to a browser.
- Storing files for distributed access.
- Streaming video and audio.
- Writing to log files.
- Storing data for backup and restore, disaster recovery, and archiving.
- Storing data for analysis by an on-premises or Azure-hosted service.

Blob Storage offers three types of resources:

- The _storage account_
- One or more _containers_ in a storage account
- One or more _blobs_ in a container

Instances of the `azblob.Client` type provide methods for manipulating containers and blobs within a storage account.
The storage account is specified when the `azblob.Client` is constructed.

### Specialized clients

The Azure Blob Storage client module for Go also provides specialized clients in various subpackages. Use these clients when you need to interact with a specific kind of blob. Learn more about [block blobs, append blobs, and page blobs](https://learn.microsoft.com/rest/api/storageservices/understanding-block-blobs--append-blobs--and-page-blobs).

- [appendblob][append_blob]
- [blockblob][block_blob]
- [pageblob][page_blob]

The [blob][blob] package contains APIs common to all blob types.  This includes APIs for deleting and undeleting a blob, setting metadata, and more.

The [lease][lease] package contains clients for managing leases on blobs and containers. See the [REST API reference](https://learn.microsoft.com/rest/api/storageservices/lease-blob#remarks) for general information on leases.

The [container][container] package contains APIs specific to containers.  This includes APIs for setting access policies or properties, and more.

The [service][service] package contains APIs specific to the Blob service. This includes APIs for manipulating containers, retrieving account information, and more.

The [sas][sas] package contains utilities to aid in the creation and manipulation of shared access signature (SAS) tokens.
See the package's documentation for more information.

### Goroutine safety

We guarantee that all client instance methods are goroutine-safe and independent of each other (see [guideline](https://azure.github.io/azure-sdk/golang_introduction.html#thread-safety)). This ensures that the recommendation to reuse client instances is always safe, even across goroutines.

### Blob metadata

Blob metadata name-value pairs are valid HTTP headers and should adhere to all restrictions governing HTTP headers. Metadata names must be valid HTTP header names, may contain only ASCII characters, and should be treated as case-insensitive. Base64-encode or URL-encode metadata values containing non-ASCII characters.

### Additional concepts
<!-- CLIENT COMMON BAR -->
[Client options](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azcore/policy#ClientOptions) |
[Accessing the response](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime#WithCaptureResponse) |
[Handling failures](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azcore#ResponseError) |
[Logging](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azcore/log)
<!-- CLIENT COMMON BAR -->

## Examples

### Upload a blob

```go
const (
	account       = "https://MYSTORAGEACCOUNT.blob.core.windows.net/"
	containerName = "sample-container"
	blobName      = "sample-blob"
	sampleFile    = "path/to/sample/file"
)

// authenticate with Azure Active Directory
cred, err := azidentity.NewDefaultAzureCredential(nil)
// TODO: handle error

// create a client for the specified storage account
client, err := azblob.NewClient(account, cred, nil)
// TODO: handle error

// open the file for reading
file, err := os.OpenFile(sampleFile, os.O_RDONLY, 0)
// TODO: handle error
defer file.Close()

// upload the file to the specified container with the specified blob name
_, err = client.UploadFile(context.TODO(), containerName, blobName, file, nil)
// TODO: handle error
```

### Download a blob

```go
// this example accesses a public blob via anonymous access, so no credentials are required
client, err := azblob.NewClientWithNoCredential("https://azurestoragesamples.blob.core.windows.net/", nil)
// TODO: handle error

// create or open a local file where we can download the blob
file, err := os.Create("cloud.jpg")
// TODO: handle error
defer file.Close()

// download the blob
_, err = client.DownloadFile(context.TODO(), "samples", "cloud.jpg", file, nil)
// TODO: handle error
```

### Enumerate blobs

```go
const (
	account       = "https://MYSTORAGEACCOUNT.blob.core.windows.net/"
	containerName = "sample-container"
)

// authenticate with Azure Active Directory
cred, err := azidentity.NewDefaultAzureCredential(nil)
// TODO: handle error

// create a client for the specified storage account
client, err := azblob.NewClient(account, cred, nil)
// TODO: handle error

// blob listings are returned across multiple pages
pager := client.NewListBlobsFlatPager(containerName, nil)

// continue fetching pages until no more remain
for pager.More() {
  // advance to the next page
	page, err := pager.NextPage(context.TODO())
	// TODO: handle error

	// print the blob names for this page
	for _, blob := range page.Segment.BlobItems {
		fmt.Println(*blob.Name)
	}
}
```

## Troubleshooting

All Blob service operations will return an
[*azcore.ResponseError][azcore_response_error] on failure with a
populated `ErrorCode` field. Many of these errors are recoverable.
The [bloberror][blob_error] package provides the possible Storage error codes
along with helper facilities for error handling.

```go
const (
	connectionString = "<connection_string>"
	containerName    = "sample-container"
)

// create a client with the provided connection string
client, err := azblob.NewClientFromConnectionString(connectionString, nil)
// TODO: handle error

// try to delete the container, avoiding any potential race conditions with an in-progress or completed deletion
_, err = client.DeleteContainer(context.TODO(), containerName, nil)

if bloberror.HasCode(err, bloberror.ContainerBeingDeleted, bloberror.ContainerNotFound) {
	// ignore any errors if the container is being deleted or already has been deleted
} else if err != nil {
	// TODO: some other error
}
```

## Next steps

Get started with our [Blob samples][samples]. They contain complete examples of the above snippets and more.

## Contributing

See the [Storage CONTRIBUTING.md][storage_contrib] for details on building,
testing, and contributing to this library.

This project welcomes contributions and suggestions.  Most contributions require
you to agree to a Contributor License Agreement (CLA) declaring that you have
the right to, and actually do, grant us the rights to use your contribution. For
details, visit [cla.microsoft.com][cla].

This project has adopted the [Microsoft Open Source Code of Conduct][coc].
For more information see the [Code of Conduct FAQ][coc_faq]
or contact [opencode@microsoft.com][coc_contact] with any
additional questions or comments.



<!-- LINKS -->
[source]: https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/storage/azblob
[docs]: https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/storage/azblob#section_documentation
[rest_docs]: https://learn.microsoft.com/rest/api/storageservices/blob-service-rest-api
[product_docs]: https://learn.microsoft.com/azure/storage/blobs/storage-blobs-overview
[godevdl]: https://go.dev/dl/
[goget]: https://pkg.go.dev/cmd/go#hdr-Add_dependencies_to_current_module_and_install_them
[go_samples]: https://github.com/Azure-Samples/azure-sdk-for-go-samples/tree/main
[storage_account_docs]: https://learn.microsoft.com/azure/storage/common/storage-account-overview
[storage_account_create_ps]: https://learn.microsoft.com/azure/storage/common/storage-quickstart-create-account?tabs=azure-powershell
[storage_account_create_cli]: https://learn.microsoft.com/azure/storage/common/storage-quickstart-create-account?tabs=azure-cli
[storage_account_create_portal]: https://learn.microsoft.com/azure/storage/common/storage-quickstart-create-account?tabs=azure-portal
[azure_cli]: https://learn.microsoft.com/cli/azure
[azure_sub]: https://azure.microsoft.com/free/
[azidentity]: https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity
[storage_ad]: https://learn.microsoft.com/azure/storage/common/storage-auth-aad
[azcore_response_error]: https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azcore#ResponseError
[samples]: https://github.com/Azure/azure-sdk-for-go/blob/main/sdk/storage/azblob/examples_test.go
[append_blob]: https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/storage/azblob/appendblob/client.go
[blob]: https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/storage/azblob/blob/client.go
[blob_error]: https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/storage/azblob/bloberror/error_codes.go
[block_blob]: https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/storage/azblob/blockblob/client.go
[container]: https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/storage/azblob/container/client.go
[lease]: https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/storage/azblob/lease
[page_blob]: https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/storage/azblob/pageblob/client.go
[sas]: https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/storage/azblob/sas
[service]: https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/storage/azblob/service/client.go
[storage_contrib]: https://github.com/Azure/azure-sdk-for-go/blob/main/CONTRIBUTING.md
[cla]: https://cla.microsoft.com
[coc]: https://opensource.microsoft.com/codeofconduct/
[coc_faq]: https://opensource.microsoft.com/codeofconduct/faq/
[coc_contact]: mailto:opencode@microsoft.com
