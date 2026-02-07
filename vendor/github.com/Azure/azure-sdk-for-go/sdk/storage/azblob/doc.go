//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/*

Package azblob can access an Azure Blob Storage.

The azblob package is capable of :-
    - Creating, deleting, and querying containers in an account
    - Creating, deleting, and querying blobs in a container
    - Creating Shared Access Signature for authentication

Types of Resources

The azblob package allows you to interact with three types of resources :-

* Azure storage accounts.
* Containers within those storage accounts.
* Blobs (block blobs/ page blobs/ append blobs) within those containers.

The Azure Blob Storage (azblob) client library for Go allows you to interact with each of these components through the use of a dedicated client object.
To create a client object, you will need the account's blob service endpoint URL and a credential that allows you to access the account.

Types of Credentials

The clients support different forms of authentication.
The azblob library supports any of the `azcore.TokenCredential` interfaces, authorization via a Connection String,
or authorization with a Shared Access Signature token.

Using a Shared Key

To use an account shared key (aka account key or access key), provide the key as a string.
This can be found in your storage account in the Azure Portal under the "Access Keys" section.

Use the key as the credential parameter to authenticate the client:

	accountName, ok := os.LookupEnv("AZURE_STORAGE_ACCOUNT_NAME")
	if !ok {
		panic("AZURE_STORAGE_ACCOUNT_NAME could not be found")
	}
	accountKey, ok := os.LookupEnv("AZURE_STORAGE_ACCOUNT_KEY")
	if !ok {
		panic("AZURE_STORAGE_ACCOUNT_KEY could not be found")
	}

	serviceURL := fmt.Sprintf("https://%s.blob.core.windows.net/", accountName)

	cred, err := azblob.NewSharedKeyCredential(accountName, accountKey)
	handle(err)

	serviceClient, err := azblob.NewClientWithSharedKeyCredential(serviceURL, cred, nil)
	handle(err)

	fmt.Println(serviceClient.URL())

Using a Connection String

Depending on your use case and authorization method, you may prefer to initialize a client instance with a connection string instead of providing the account URL and credential separately.
To do this, pass the connection string to the service client's `NewClientFromConnectionString` method.
The connection string can be found in your storage account in the Azure Portal under the "Access Keys" section.

	connStr := "DefaultEndpointsProtocol=https;AccountName=<my_account_name>;AccountKey=<my_account_key>;EndpointSuffix=core.windows.net"
	serviceClient, err := azblob.NewClientFromConnectionString(connStr, nil)
	handle(err)

Using a Shared Access Signature (SAS) Token

To use a shared access signature (SAS) token, provide the token at the end of your service URL.
You can generate a SAS token from the Azure Portal under Shared Access Signature or use the ServiceClient.GetSASToken() functions.

	accountName, ok := os.LookupEnv("AZURE_STORAGE_ACCOUNT_NAME")
	if !ok {
		panic("AZURE_STORAGE_ACCOUNT_NAME could not be found")
	}
	accountKey, ok := os.LookupEnv("AZURE_STORAGE_ACCOUNT_KEY")
	if !ok {
		panic("AZURE_STORAGE_ACCOUNT_KEY could not be found")
	}
	serviceURL := fmt.Sprintf("https://%s.blob.core.windows.net/", accountName)

	cred, err := azblob.NewSharedKeyCredential(accountName, accountKey)
	handle(err)
	serviceClient, err := azblob.NewClientWithSharedKeyCredential(serviceURL, cred, nil)
	handle(err)
	fmt.Println(serviceClient.URL())

	// Alternatively, you can create SAS on the fly

	resources := sas.AccountResourceTypes{Service: true}
	permission := sas.AccountPermissions{Read: true}
	start := time.Now()
	expiry := start.AddDate(0, 0, 1)
	serviceURLWithSAS, err := serviceClient.ServiceClient().GetSASURL(resources, permission, expiry, &service.GetSASURLOptions{StartTime: &start})
	handle(err)

	serviceClientWithSAS, err := azblob.NewClientWithNoCredential(serviceURLWithSAS, nil)
	handle(err)

	fmt.Println(serviceClientWithSAS.URL())

Types of Clients

There are three different clients provided to interact with the various components of the Blob Service:

1. **`ServiceClient`**
    * Get and set account settings.
    * Query, create, and delete containers within the account.

2. **`ContainerClient`**
    * Get and set container access settings, properties, and metadata.
    * Create, delete, and query blobs within the container.
    * `ContainerLeaseClient` to support container lease management.

3. **`BlobClient`**
    * `AppendBlobClient`, `BlockBlobClient`, and `PageBlobClient`
    * Get and set blob properties.
    * Perform CRUD operations on a given blob.
    * `BlobLeaseClient` to support blob lease management.

Examples

	// Your account name and key can be obtained from the Azure Portal.
	accountName, ok := os.LookupEnv("AZURE_STORAGE_ACCOUNT_NAME")
	if !ok {
		panic("AZURE_STORAGE_ACCOUNT_NAME could not be found")
	}

	accountKey, ok := os.LookupEnv("AZURE_STORAGE_ACCOUNT_KEY")
	if !ok {
		panic("AZURE_STORAGE_ACCOUNT_KEY could not be found")
	}
	cred, err := azblob.NewSharedKeyCredential(accountName, accountKey)
	handle(err)

	// The service URL for blob endpoints is usually in the form: http(s)://<account>.blob.core.windows.net/
	serviceClient, err := azblob.NewClientWithSharedKeyCredential(fmt.Sprintf("https://%s.blob.core.windows.net/", accountName), cred, nil)
	handle(err)

	// ===== 1. Create a container =====

	// First, create a container client, and use the Create method to create a new container in your account
	containerClient := serviceClient.ServiceClient().NewContainerClient("testcontainer")
	handle(err)

	// All APIs have an options' bag struct as a parameter.
	// The options' bag struct allows you to specify optional parameters such as metadata, public access types, etc.
	// If you want to use the default options, pass in nil.
	_, err = containerClient.Create(context.TODO(), nil)
	handle(err)

	// ===== 2. Upload and Download a block blob =====
	uploadData := "Hello world!"

	// Create a new blockBlobClient from the containerClient
	blockBlobClient := containerClient.NewBlockBlobClient("HelloWorld.txt")
	handle(err)

	// Upload data to the block blob
	blockBlobUploadOptions := blockblob.UploadOptions{
		Metadata: map[string]*string{"Foo": to.Ptr("Bar")},
		Tags:     map[string]string{"Year": "2022"},
	}
	_, err = blockBlobClient.Upload(context.TODO(), streaming.NopCloser(strings.NewReader(uploadData)), &blockBlobUploadOptions)
	handle(err)

	// Download the blob's contents and ensure that the download worked properly
	blobDownloadResponse, err := blockBlobClient.DownloadStream(context.TODO(), nil)
	handle(err)

	// Use the bytes.Buffer object to read the downloaded data.
	// RetryReaderOptions has a lot of in-depth tuning abilities, but for the sake of simplicity, we'll omit those here.
	reader := blobDownloadResponse.Body(nil)
	downloadData, err := io.ReadAll(reader)
	handle(err)
	if string(downloadData) != uploadData {
		handle(errors.New("uploaded data should be same as downloaded data"))
	}

	if err = reader.Close(); err != nil {
		handle(err)
		return
	}

	// ===== 3. List blobs =====
	// List methods returns a pager object which can be used to iterate over the results of a paging operation.
	// To iterate over a page use the NextPage(context.Context) to fetch the next page of results.
	// PageResponse() can be used to iterate over the results of the specific page.
	// Always check the Err() method after paging to see if an error was returned by the pager. A pager will return either an error or the page of results.
	pager := containerClient.NewListBlobsFlatPager(nil)
	for pager.More() {
		resp, err := pager.NextPage(context.TODO())
		handle(err)
		for _, v := range resp.Segment.BlobItems {
			fmt.Println(*v.Name)
		}
	}

	// Delete the blob.
	_, err = blockBlobClient.Delete(context.TODO(), nil)
	handle(err)

	// Delete the container.
	_, err = containerClient.Delete(context.TODO(), nil)
	handle(err)
*/

package azblob
