# Guide to migrate from `azure-storage-blob-go` to `azblob`

This guide is intended to assist in the migration from the `azure-storage-blob-go` module, or previous betas of `azblob`, to the latest releases of the `azblob` module.

## Simplified API surface area

The redesign of the `azblob` module separates clients into various sub-packages.
In previous versions, the public surface area was "flat", so all clients and supporting types were in the `azblob` package.
This made it difficult to navigate the public surface area.

## Clients

In `azure-storage-blob-go` a client constructor always requires a `url.URL` and `Pipeline` parameters.

In `azblob` a client constructor always requires a `string` URL, any specified credential type, and a `*ClientOptions` for optional values.  You pass `nil` to accept default options.

```go
// new code
client, err := azblob.NewClient("<my storage account URL>", cred, nil)
```

## Authentication

In `azure-storage-blob-go` you created a `Pipeline` with the required credential type. This pipeline was then passed to the client constructor.

In `azblob`, you pass the required credential directly to the client constructor.

```go
// new code.  cred is an AAD token credential created from the azidentity module
client, err := azblob.NewClient("<my storage account URL>", cred, nil)
```

The `azure-storage-blob-go` module provided limited support for OAuth token authentication via `NewTokenCredential`.
This been replaced by using Azure Identity credentials from [azidentity](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#section-readme).

Authentication with a shared key via `NewSharedKeyCredential` remains unchanged.

In `azure-storage-blob-go` you created a `Pipeline` with `NewAnonymousCredential` to support anonymous or SAS authentication.

In `azblob` you use the construtor `NewClientWithNoCredential()` instead.

```go
// new code
client, err := azblob.NewClientWithNoCredential("<public blob or blob with SAS URL>", nil)
```

## Listing blobs/containers

In `azure-storage-blob-go` you explicitly created a `Marker` type that was used to page over results ([example](https://pkg.go.dev/github.com/Azure/azure-storage-blob-go/azblob?utm_source=godoc#example-package)).

In `azblob`, operations that return paginated values return a `*runtime.Pager[T]`.

```go
// new code
pager := client.NewListBlobsFlatPager("my-container", nil)
for pager.More() {
	page, err := pager.NextPage(context.TODO())
	// process results
}
```

## Configuring the HTTP pipeline

In `azure-storage-blob-go` you explicitly created a HTTP pipeline with configuration before creating a client.
This pipeline instance was then passed as an argument to the client constructor ([example](https://pkg.go.dev/github.com/Azure/azure-storage-blob-go/azblob?utm_source=godoc#example-NewPipeline)).

In `azblob` a HTTP pipeline is created during client construction.  The pipeline is configured through the `azcore.ClientOptions` type.

```go
// new code
client, err := azblob.NewClient(account, cred, &azblob.ClientOptions{
	ClientOptions: azcore.ClientOptions{
		// configure HTTP pipeline options here
	},
})
```
