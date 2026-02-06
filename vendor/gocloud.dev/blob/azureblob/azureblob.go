// Copyright 2018 The Go Cloud Development Kit Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package azureblob provides a blob implementation that uses Azure Storage’s
// BlockBlob. Use OpenBucket to construct a *blob.Bucket.
//
// NOTE: SignedURLs for PUT created with this package are not fully portable;
// they will not work unless the PUT request includes a "x-ms-blob-type" header
// set to "BlockBlob".
// See https://stackoverflow.com/questions/37824136/put-on-sas-blob-url-without-specifying-x-ms-blob-type-header.
//
// # URLs
//
// For blob.OpenBucket, azureblob registers for the scheme "azblob".
//
// The default URL opener will use environment variables to generate
// credentials and a service URL; see
// https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/storage/azblob
// for a more complete descriptions of each approach.
//   - AZURE_STORAGE_ACCOUNT: The service account name. Required if used along with AZURE_STORAGE KEY, because it defines
//     authentication mechanism to be azblob.NewSharedKeyCredential, which creates immutable shared key credentials.
//     Otherwise, "storage_account" in the URL query string parameter can be used.
//   - AZURE_STORAGE_KEY: To use a shared key credential. The service account
//     name and key are passed to NewSharedKeyCredential and then the
//     resulting credential is passed to NewClientWithSharedKeyCredential.
//   - AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGEBLOB_CONNECTIONSTRING: To use a connection string, passed to
//     NewClientFromConnectionString.
//   - AZURE_STORAGE_SAS_TOKEN: To use a SAS token. The SAS token is added
//     as a URL parameter to the service URL, and passed to
//     NewClientWithNoCredential.
//   - If none of the above are provided, azureblob defaults to
//     azidentity.NewDefaultAzureCredential:
//     https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#NewDefaultAzureCredential.
//     See the documentation there for the credential types it supports, including
//     CLI creds, environment variables like AZURE_CLIENT_ID, AZURE_TENANT_ID, etc.
//
// In addition, the environment variables AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_DOMAIN,
// AZURE_STORAGE_PROTOCOL, AZURE_STORAGE_IS_CDN, and AZURE_STORAGE_IS_LOCAL_EMULATOR
// can be used to configure how the default URLOpener generates the Azure
// Service URL via ServiceURLOptions. These can all be configured via URL
// parameters as well. See ServiceURLOptions and NewDefaultServiceURL
// for more details.
//
// To customize the URL opener, or for more details on the URL format,
// see URLOpener.
//
// See https://gocloud.dev/concepts/urls/ for background information.
//
// # Escaping
//
// Go CDK supports all UTF-8 strings; to make this work with services lacking
// full UTF-8 support, strings must be escaped (during writes) and unescaped
// (during reads). The following escapes are performed for azureblob:
//   - Blob keys: ASCII characters 0-31, 34 ("\""), 35 ("#"), 37 ("%"), 63 ("?"),
//     92 ("\"), and 127 are escaped to "__0x<hex>__".
//     Additionally, the "/" in "../" and a trailing "/" in a key (e.g., "foo/") are escaped in the same way.
//   - Metadata keys: Per https://docs.microsoft.com/en-us/azure/storage/blobs/storage-properties-metadata,
//     Azure only allows C# identifiers as metadata keys. Therefore, characters
//     other than "[a-z][A-z][0-9]_" are escaped using "__0x<hex>__". In addition,
//     characters "[0-9]" are escaped when they start the string.
//     URL encoding would not work since "%" is not valid.
//   - Metadata values: Escaped using URL encoding.
//
// # As
//
// azureblob exposes the following types for As:
//   - Bucket: *container.Client
//   - Error: *azcore.ResponseError. You can use bloberror.HasCode directly though.
//   - ListObject: container.BlobItem for objects, container.BlobPrefix for "directories"
//   - ListOptions.BeforeList: *container.ListBlobsHierarchyOptions
//   - Reader: azblobblob.DownloadStreamResponse
//   - Reader.BeforeRead: *azblob.DownloadStreamOptions
//   - Attributes: azblobblob.GetPropertiesResponse
//   - CopyOptions.BeforeCopy: *azblobblob.StartCopyFromURLOptions
//   - WriterOptions.BeforeWrite: *azblob.UploadStreamOptions
//   - SignedURLOptions.BeforeSign: *sas.BlobPermissions
package azureblob

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	azblobblob "github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/bloberror"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blockblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/container"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/sas"
	"github.com/Azure/go-autorest/autorest/to"
	"github.com/google/wire"
	"gocloud.dev/blob"
	"gocloud.dev/blob/driver"
	"gocloud.dev/gcerrors"

	"gocloud.dev/internal/escape"
	"gocloud.dev/internal/gcerr"
	"gocloud.dev/internal/useragent"
)

const (
	defaultPageSize        = 1000            // default page size for ListPaged (Azure default is 5000)
	defaultUploadBuffers   = 5               // configure the number of rotating buffers that are used when uploading (for degree of parallelism)
	defaultUploadBlockSize = 8 * 1024 * 1024 // configure the upload buffer size
)

func init() {
	blob.DefaultURLMux().RegisterBucket(Scheme, new(lazyOpener))
}

// Set holds Wire providers for this package.
var Set = wire.NewSet(
	NewDefaultServiceURLOptions,
	NewServiceURL,
	NewDefaultClient,
)

// Options sets options for constructing a *blob.Bucket backed by Azure Blob.
type Options struct{}

// ServiceURL represents an Azure service URL.
type ServiceURL string

// ContainerName represents an Azure blob container name.
type ContainerName string

// ServiceURLOptions sets options for constructing a service URL for Azure Blob.
type ServiceURLOptions struct {
	// AccountName is the account name the credentials are for.
	AccountName string

	// SASToken will be appended to the service URL.
	// See https://docs.microsoft.com/en-us/azure/storage/common/storage-dotnet-shared-access-signature-part-1#shared-access-signature-parameters.
	SASToken string

	// StorageDomain can be provided to specify an Azure Cloud Environment
	// domain to target for the blob storage account (i.e. public, government, china).
	// Defaults to "blob.core.windows.net". Possible values will look similar
	// to this but are different for each cloud (i.e. "blob.core.govcloudapi.net" for USGovernment).
	// Check the Azure developer guide for the cloud environment where your bucket resides.
	// See the docstring for NewServiceURL to see examples of how this is used
	// along with the other Options fields.
	StorageDomain string

	// Protocol can be provided to specify protocol to access Azure Blob Storage.
	// Protocols that can be specified are "http" for local emulator and "https" for general.
	// Defaults to "https".
	// See the docstring for NewServiceURL to see examples of how this is used
	// along with the other Options fields.
	Protocol string

	// IsCDN can be set to true when using a CDN URL pointing to a blob storage account:
	// https://docs.microsoft.com/en-us/azure/cdn/cdn-create-a-storage-account-with-cdn
	// See the docstring for NewServiceURL to see examples of how this is used
	// along with the other Options fields.
	IsCDN bool

	// IsLocalEmulator should be set to true when targeting Local Storage Emulator (Azurite).
	// See the docstring for NewServiceURL to see examples of how this is used
	// along with the other Options fields.
	IsLocalEmulator bool
}

// NewDefaultServiceURLOptions generates a ServiceURLOptions based on environment variables.
func NewDefaultServiceURLOptions() *ServiceURLOptions {
	isCDN, _ := strconv.ParseBool(os.Getenv("AZURE_STORAGE_IS_CDN"))
	isLocalEmulator, _ := strconv.ParseBool(os.Getenv("AZURE_STORAGE_IS_LOCAL_EMULATOR"))
	accountName := os.Getenv("AZURE_STORAGE_ACCOUNT")
	protocol := os.Getenv("AZURE_STORAGE_PROTOCOL")
	connectionString := os.Getenv("AZURE_STORAGE_CONNECTION_STRING")
	if connectionString == "" {
		connectionString = os.Getenv("AZURE_STORAGEBLOB_CONNECTIONSTRING")
	}
	if connectionString != "" {
		// Parse the connection string to get a default account name and protocol.
		// Format: DefaultEndpointsProtocol=https;AccountName=some-account;AccountKey=very-secure;EndpointSuffix=core.windows.net
		for _, part := range strings.Split(connectionString, ";") {
			keyval := strings.Split(part, "=")
			if len(keyval) == 2 {
				if accountName == "" && keyval[0] == "AccountName" {
					accountName = keyval[1]
				} else if protocol == "" && keyval[0] == "DefaultEndpointsProtocol" {
					protocol = keyval[1]
				}
			}
		}
	}
	return &ServiceURLOptions{
		AccountName:     accountName,
		SASToken:        os.Getenv("AZURE_STORAGE_SAS_TOKEN"),
		StorageDomain:   os.Getenv("AZURE_STORAGE_DOMAIN"),
		Protocol:        protocol,
		IsCDN:           isCDN,
		IsLocalEmulator: isLocalEmulator,
	}
}

// withOverrides returns o with overrides from urlValues.
// See URLOpener for supported overrides.
func (o *ServiceURLOptions) withOverrides(urlValues url.Values) (*ServiceURLOptions, error) {
	retval := *o
	for param, values := range urlValues {
		if len(values) > 1 {
			return nil, fmt.Errorf("multiple values of %v not allowed", param)
		}
		value := values[0]
		switch param {
		case "domain":
			retval.StorageDomain = value
		case "protocol":
			retval.Protocol = value
		case "cdn":
			isCDN, err := strconv.ParseBool(value)
			if err != nil {
				return nil, err
			}
			retval.IsCDN = isCDN
		case "localemu":
			isLocalEmulator, err := strconv.ParseBool(value)
			if err != nil {
				return nil, err
			}
			retval.IsLocalEmulator = isLocalEmulator
		case "storage_account":
			retval.AccountName = value
		default:
			return nil, fmt.Errorf("unknown query parameter %q", param)
		}
	}
	return &retval, nil
}

// NewServiceURL generates a URL for addressing an Azure Blob service
// account. It uses several parameters, each of which can be specified
// via ServiceURLOptions.
//
// The generated URL is "<protocol>://<account name>.<domain>"
// with the following caveats:
//   - If opts.SASToken is provided, it is appended to the URL as a query
//     parameter.
//   - If opts.IsCDN is true, the <account name> part is dropped.
//   - If opts.IsLocalEmulator is true, or the domain starts with "localhost"
//     or "127.0.0.1", the account name and domain are flipped, e.g.:
//     http://127.0.0.1:10000/myaccount
func NewServiceURL(opts *ServiceURLOptions) (ServiceURL, error) {
	if opts == nil {
		opts = &ServiceURLOptions{}
	}
	accountName := opts.AccountName
	if accountName == "" {
		return "", errors.New("azureblob: Options.AccountName is required")
	}
	domain := opts.StorageDomain
	if domain == "" {
		domain = "blob.core.windows.net"
	}
	protocol := opts.Protocol
	if protocol == "" {
		protocol = "https"
	} else if protocol != "http" && protocol != "https" {
		return "", fmt.Errorf("invalid protocol %q", protocol)
	}
	var svcURL string
	if strings.HasPrefix(domain, "127.0.0.1") || strings.HasPrefix(domain, "localhost") || opts.IsLocalEmulator {
		svcURL = fmt.Sprintf("%s://%s/%s", protocol, domain, accountName)
	} else if opts.IsCDN {
		svcURL = fmt.Sprintf("%s://%s", protocol, domain)
	} else {
		svcURL = fmt.Sprintf("%s://%s.%s", protocol, accountName, domain)
	}
	if opts.SASToken != "" {
		svcURL += "?" + opts.SASToken
	}
	return ServiceURL(svcURL), nil
}

// lazyOpener obtains credentials and creates a client on the first call to OpenBucketURL.
type lazyOpener struct {
	init   sync.Once
	opener *URLOpener
}

func (o *lazyOpener) OpenBucketURL(ctx context.Context, u *url.URL) (*blob.Bucket, error) {
	o.init.Do(func() {
		credInfo := newCredInfoFromEnv()
		opts := NewDefaultServiceURLOptions()
		o.opener = &URLOpener{
			MakeClient:        credInfo.NewClient,
			ServiceURLOptions: *opts,
		}
	})
	return o.opener.OpenBucketURL(ctx, u)
}

type credTypeEnumT int

const (
	credTypeDefault credTypeEnumT = iota
	credTypeSharedKey
	credTypeSASViaNone
	credTypeConnectionString
)

type credInfoT struct {
	CredType credTypeEnumT

	// For credTypeSharedKey.
	AccountName string
	AccountKey  string

	// For credTypeConnectionString
	ConnectionString string
}

func newCredInfoFromEnv() *credInfoT {
	accountName := os.Getenv("AZURE_STORAGE_ACCOUNT")
	accountKey := os.Getenv("AZURE_STORAGE_KEY")
	sasToken := os.Getenv("AZURE_STORAGE_SAS_TOKEN")
	connectionString := os.Getenv("AZURE_STORAGE_CONNECTION_STRING")
	if connectionString == "" {
		connectionString = os.Getenv("AZURE_STORAGEBLOB_CONNECTIONSTRING")
	}
	credInfo := &credInfoT{
		AccountName: accountName,
	}
	if accountName != "" && accountKey != "" {
		credInfo.CredType = credTypeSharedKey
		credInfo.AccountKey = accountKey
	} else if sasToken != "" {
		credInfo.CredType = credTypeSASViaNone
	} else if connectionString != "" {
		credInfo.CredType = credTypeConnectionString
		credInfo.ConnectionString = connectionString
	} else {
		credInfo.CredType = credTypeDefault
	}
	return credInfo
}

func (i *credInfoT) NewClient(svcURL ServiceURL, containerName ContainerName) (*container.Client, error) {
	// Set the ApplicationID.
	azClientOpts := &container.ClientOptions{}
	azClientOpts.Telemetry = policy.TelemetryOptions{
		ApplicationID: useragent.AzureUserAgentPrefix("blob"),
	}

	containerURL, err := url.JoinPath(string(svcURL), string(containerName))
	if err != nil {
		return nil, err
	}
	switch i.CredType {
	case credTypeDefault:
		cred, err := azidentity.NewDefaultAzureCredential(nil)
		if err != nil {
			return nil, fmt.Errorf("failed azidentity.NewDefaultAzureCredential: %v", err)
		}
		return container.NewClient(containerURL, cred, azClientOpts)
	case credTypeSharedKey:
		sharedKeyCred, err := azblob.NewSharedKeyCredential(i.AccountName, i.AccountKey)
		if err != nil {
			return nil, fmt.Errorf("failed azblob.NewSharedKeyCredential: %v", err)
		}
		return container.NewClientWithSharedKeyCredential(containerURL, sharedKeyCred, azClientOpts)
	case credTypeSASViaNone:
		return container.NewClientWithNoCredential(containerURL, azClientOpts)
	case credTypeConnectionString:
		return container.NewClientFromConnectionString(i.ConnectionString, string(containerName), azClientOpts)
	default:
		return nil, errors.New("internal error, unknown cred type")
	}
}

// Scheme is the URL scheme gcsblob registers its URLOpener under on
// blob.DefaultMux.
const Scheme = "azblob"

// URLOpener opens Azure URLs like "azblob://mybucket".
//
// The URL host is used as the bucket name.
//
// The following query options are supported:
//   - domain: Overrides Options.StorageDomain.
//   - protocol: Overrides Options.Protocol.
//   - cdn: Overrides Options.IsCDN.
//   - localemu: Overrides Options.IsLocalEmulator.
type URLOpener struct {
	// MakeClient must be set to a non-nil value.
	MakeClient func(svcURL ServiceURL, containerName ContainerName) (*container.Client, error)

	// ServiceURLOptions specifies default options for generating the service URL.
	// Some options can be overridden in the URL as described above.
	ServiceURLOptions ServiceURLOptions

	// Options specifies the options to pass to OpenBucket.
	Options Options
}

// OpenBucketURL opens a blob.Bucket based on u.
func (o *URLOpener) OpenBucketURL(ctx context.Context, u *url.URL) (*blob.Bucket, error) {
	opts, err := o.ServiceURLOptions.withOverrides(u.Query())
	if err != nil {
		return nil, err
	}
	svcURL, err := NewServiceURL(opts)
	if err != nil {
		return nil, err
	}
	client, err := o.MakeClient(svcURL, ContainerName(u.Host))
	if err != nil {
		return nil, err
	}
	return OpenBucket(ctx, client, &o.Options)
}

// bucket represents a Azure Storage Account Container, which handles read,
// write and delete operations on objects within it.
// See https://docs.microsoft.com/en-us/azure/storage/blobs/storage-blobs-introduction.
type bucket struct {
	client *container.Client
	opts   *Options
}

// NewDefaultClient returns an Azure Blob container client
// with credentials from the environment as described in the package
// docstring.
func NewDefaultClient(svcURL ServiceURL, containerName ContainerName) (*container.Client, error) {
	return newCredInfoFromEnv().NewClient(svcURL, containerName)
}

// OpenBucket returns a *blob.Bucket backed by Azure Storage Account. See the package
// documentation for an example and
// https://godoc.org/github.com/Azure/azure-storage-blob-go/azblob
// for more details.
func OpenBucket(ctx context.Context, client *container.Client, opts *Options) (*blob.Bucket, error) {
	b, err := openBucket(ctx, client, opts)
	if err != nil {
		return nil, err
	}
	return blob.NewBucket(b), nil
}

func openBucket(ctx context.Context, client *container.Client, opts *Options) (*bucket, error) {
	if client == nil {
		return nil, errors.New("azureblob.OpenBucket: client is required")
	}
	if opts == nil {
		opts = &Options{}
	}
	return &bucket{
		client: client,
		opts:   opts,
	}, nil
}

// Close implements driver.Close.
func (b *bucket) Close() error {
	return nil
}

// Copy implements driver.Copy.
func (b *bucket) Copy(ctx context.Context, dstKey, srcKey string, opts *driver.CopyOptions) error {
	dstKey = escapeKey(dstKey, false)
	dstBlobClient := b.client.NewBlobClient(dstKey)
	srcKey = escapeKey(srcKey, false)
	srcBlobClient := b.client.NewBlobClient(srcKey)
	copyOptions := &azblobblob.StartCopyFromURLOptions{}
	if opts.BeforeCopy != nil {
		asFunc := func(i any) bool {
			switch v := i.(type) {
			case **azblobblob.StartCopyFromURLOptions:
				*v = copyOptions
				return true
			}
			return false
		}
		if err := opts.BeforeCopy(asFunc); err != nil {
			return err
		}
	}
	resp, err := dstBlobClient.StartCopyFromURL(ctx, srcBlobClient.URL(), copyOptions)
	if err != nil {
		return err
	}
	nErrors := 0
	copyStatus := *resp.CopyStatus
	for copyStatus == azblobblob.CopyStatusTypePending {
		// Poll until the copy is complete.
		time.Sleep(500 * time.Millisecond)
		propertiesResp, err := dstBlobClient.GetProperties(ctx, nil)
		if err != nil {
			// A GetProperties failure may be transient, so allow a couple
			// of them before giving up.
			nErrors++
			if ctx.Err() != nil || nErrors == 3 {
				return err
			}
		}
		copyStatus = *propertiesResp.CopyStatus
	}
	if copyStatus != azblobblob.CopyStatusTypeSuccess {
		return fmt.Errorf("Copy failed with status: %s", copyStatus)
	}
	return nil
}

// Delete implements driver.Delete.
func (b *bucket) Delete(ctx context.Context, key string) error {
	key = escapeKey(key, false)
	blobClient := b.client.NewBlobClient(key)
	_, err := blobClient.Delete(ctx, nil)
	return err
}

// reader reads an azblob. It implements io.ReadCloser.
type reader struct {
	body  io.ReadCloser
	attrs driver.ReaderAttributes
	raw   *azblobblob.DownloadStreamResponse
}

func (r *reader) Read(p []byte) (int, error) {
	return r.body.Read(p)
}

func (r *reader) Close() error {
	return r.body.Close()
}

func (r *reader) Attributes() *driver.ReaderAttributes {
	return &r.attrs
}

func (r *reader) As(i any) bool {
	p, ok := i.(*azblobblob.DownloadStreamResponse)
	if !ok {
		return false
	}
	*p = *r.raw
	return true
}

// NewRangeReader implements driver.NewRangeReader.
func (b *bucket) NewRangeReader(ctx context.Context, key string, offset, length int64, opts *driver.ReaderOptions) (driver.Reader, error) {
	key = escapeKey(key, false)
	blobClient := b.client.NewBlobClient(key)
	downloadOpts := azblob.DownloadStreamOptions{}
	if offset != 0 {
		downloadOpts.Range.Offset = offset
	}
	if length >= 0 {
		downloadOpts.Range.Count = length
	}
	if opts.BeforeRead != nil {
		asFunc := func(i any) bool {
			if p, ok := i.(**azblobblob.DownloadStreamOptions); ok {
				*p = &downloadOpts
				return true
			}
			return false
		}
		if err := opts.BeforeRead(asFunc); err != nil {
			return nil, err
		}
	}
	blobDownloadResponse, err := blobClient.DownloadStream(ctx, &downloadOpts)
	if err != nil {
		return nil, err
	}
	attrs := driver.ReaderAttributes{
		ContentType: to.String(blobDownloadResponse.ContentType),
		Size:        getSize(blobDownloadResponse.ContentLength, to.String(blobDownloadResponse.ContentRange)),
		ModTime:     *blobDownloadResponse.LastModified,
	}
	var body io.ReadCloser
	if length == 0 {
		body = http.NoBody
	} else {
		body = blobDownloadResponse.Body
	}
	return &reader{
		body:  body,
		attrs: attrs,
		raw:   &blobDownloadResponse,
	}, nil
}

func getSize(contentLength *int64, contentRange string) int64 {
	var size int64
	// Default size to ContentLength, but that's incorrect for partial-length reads,
	// where ContentLength refers to the size of the returned Body, not the entire
	// size of the blob. ContentRange has the full size.
	if contentLength != nil {
		size = *contentLength
	}
	if contentRange != "" {
		// Sample: bytes 10-14/27 (where 27 is the full size).
		parts := strings.Split(contentRange, "/")
		if len(parts) == 2 {
			if i, err := strconv.ParseInt(parts[1], 10, 64); err == nil {
				size = i
			}
		}
	}
	return size
}

// As implements driver.As.
func (b *bucket) As(i any) bool {
	p, ok := i.(**container.Client)
	if !ok {
		return false
	}
	*p = b.client
	return true
}

// As implements driver.ErrorAs.
func (b *bucket) ErrorAs(err error, i any) bool {
	switch v := err.(type) {
	case *azcore.ResponseError:
		if p, ok := i.(**azcore.ResponseError); ok {
			*p = v
			return true
		}
	}
	return false
}

func (b *bucket) ErrorCode(err error) gcerrors.ErrorCode {
	if bloberror.HasCode(err, bloberror.BlobNotFound) {
		return gcerrors.NotFound
	}
	if bloberror.HasCode(err, bloberror.AuthenticationFailed) {
		return gcerrors.PermissionDenied
	}
	var rErr *azcore.ResponseError
	if errors.As(err, &rErr) {
		code := bloberror.Code(rErr.ErrorCode)
		if code == bloberror.BlobNotFound || rErr.StatusCode == 404 {
			return gcerrors.NotFound
		}
		if code == bloberror.AuthenticationFailed {
			return gcerrors.PermissionDenied
		}
	}
	if strings.Contains(err.Error(), "no such host") {
		// This happens with an invalid storage account name; the host
		// is something like invalidstorageaccount.blob.core.windows.net.
		return gcerrors.NotFound
	}
	return gcerrors.Unknown
}

// Attributes implements driver.Attributes.
func (b *bucket) Attributes(ctx context.Context, key string) (*driver.Attributes, error) {
	key = escapeKey(key, false)
	blobClient := b.client.NewBlobClient(key)
	blobPropertiesResponse, err := blobClient.GetProperties(ctx, nil)
	if err != nil {
		return nil, err
	}

	md := make(map[string]string, len(blobPropertiesResponse.Metadata))
	for k, v := range blobPropertiesResponse.Metadata {
		// See the package comments for more details on escaping of metadata
		// keys & values.
		if v != nil {
			md[escape.HexUnescape(k)] = escape.URLUnescape(*v)
		}
	}
	var eTag string
	if blobPropertiesResponse.ETag != nil {
		eTag = string(*blobPropertiesResponse.ETag)
	}
	return &driver.Attributes{
		CacheControl:       to.String(blobPropertiesResponse.CacheControl),
		ContentDisposition: to.String(blobPropertiesResponse.ContentDisposition),
		ContentEncoding:    to.String(blobPropertiesResponse.ContentEncoding),
		ContentLanguage:    to.String(blobPropertiesResponse.ContentLanguage),
		ContentType:        to.String(blobPropertiesResponse.ContentType),
		Size:               to.Int64(blobPropertiesResponse.ContentLength),
		CreateTime:         *blobPropertiesResponse.CreationTime,
		ModTime:            *blobPropertiesResponse.LastModified,
		MD5:                blobPropertiesResponse.ContentMD5,
		ETag:               eTag,
		Metadata:           md,
		AsFunc: func(i any) bool {
			p, ok := i.(*azblobblob.GetPropertiesResponse)
			if !ok {
				return false
			}
			*p = blobPropertiesResponse
			return true
		},
	}, nil
}

// ListPaged implements driver.ListPaged.
func (b *bucket) ListPaged(ctx context.Context, opts *driver.ListOptions) (*driver.ListPage, error) {
	pageSize := opts.PageSize
	if pageSize == 0 {
		pageSize = defaultPageSize
	}

	var marker *string
	if len(opts.PageToken) > 0 {
		pt := string(opts.PageToken)
		marker = &pt
	}

	pageSize32 := int32(pageSize)
	prefix := escapeKey(opts.Prefix, true)
	azOpts := container.ListBlobsHierarchyOptions{
		MaxResults: &pageSize32,
		Prefix:     &prefix,
		Marker:     marker,
	}
	if opts.BeforeList != nil {
		asFunc := func(i any) bool {
			p, ok := i.(**container.ListBlobsHierarchyOptions)
			if !ok {
				return false
			}
			*p = &azOpts
			return true
		}
		if err := opts.BeforeList(asFunc); err != nil {
			return nil, err
		}
	}
	azPager := b.client.NewListBlobsHierarchyPager(escapeKey(opts.Delimiter, true), &azOpts)
	resp, err := azPager.NextPage(ctx)
	if err != nil {
		return nil, err
	}
	page := &driver.ListPage{}
	page.Objects = []*driver.ListObject{}
	segment := resp.ListBlobsHierarchySegmentResponse.Segment
	for _, blobPrefix := range segment.BlobPrefixes {
		blobPrefix := blobPrefix // capture loop variable for use in AsFunc
		page.Objects = append(page.Objects, &driver.ListObject{
			Key:   unescapeKey(to.String(blobPrefix.Name)),
			Size:  0,
			IsDir: true,
			AsFunc: func(i any) bool {
				v, ok := i.(*container.BlobPrefix)
				if ok {
					*v = *blobPrefix
				}
				return ok
			},
		})
	}
	for _, blobInfo := range segment.BlobItems {
		blobInfo := blobInfo // capture loop variable for use in AsFunc
		page.Objects = append(page.Objects, &driver.ListObject{
			Key:     unescapeKey(to.String(blobInfo.Name)),
			ModTime: *blobInfo.Properties.LastModified,
			Size:    *blobInfo.Properties.ContentLength,
			MD5:     blobInfo.Properties.ContentMD5,
			IsDir:   false,
			AsFunc: func(i any) bool {
				v, ok := i.(*container.BlobItem)
				if ok {
					*v = *blobInfo
				}
				return ok
			},
		})
	}
	if resp.NextMarker != nil {
		page.NextPageToken = []byte(*resp.NextMarker)
	}
	if len(segment.BlobPrefixes) > 0 && len(segment.BlobItems) > 0 {
		sort.Slice(page.Objects, func(i, j int) bool {
			return page.Objects[i].Key < page.Objects[j].Key
		})
	}
	return page, nil
}

// SignedURL implements driver.SignedURL.
func (b *bucket) SignedURL(ctx context.Context, key string, opts *driver.SignedURLOptions) (string, error) {
	if opts.ContentType != "" || opts.EnforceAbsentContentType {
		return "", gcerr.New(gcerr.Unimplemented, nil, 1, "azureblob: does not enforce Content-Type on PUT")
	}

	key = escapeKey(key, false)
	blobClient := b.client.NewBlobClient(key)
	perms := sas.BlobPermissions{}
	switch opts.Method {
	case http.MethodGet:
		perms.Read = true
	case http.MethodPut:
		perms.Create = true
		perms.Write = true
	case http.MethodDelete:
		perms.Delete = true
	default:
		return "", fmt.Errorf("unsupported Method %s", opts.Method)
	}

	if opts.BeforeSign != nil {
		asFunc := func(i any) bool {
			v, ok := i.(**sas.BlobPermissions)
			if ok {
				*v = &perms
			}
			return ok
		}
		if err := opts.BeforeSign(asFunc); err != nil {
			return "", err
		}
	}
	start := time.Now().UTC()
	expiry := start.Add(opts.Expiry)
	return blobClient.GetSASURL(perms, expiry, &azblobblob.GetSASURLOptions{StartTime: &start})
}

type writer struct {
	ctx        context.Context
	client     *blockblob.Client
	uploadOpts *azblob.UploadStreamOptions

	// Ends of an io.Pipe, created when the first byte is written.
	pw *io.PipeWriter
	pr *io.PipeReader

	// Alternatively, upload is set to true when Upload was
	// used to upload data.
	upload bool

	donec chan struct{} // closed when done writing
	// The following fields will be written before donec closes:
	err error
}

// escapeKey does all required escaping for UTF-8 strings to work with Azure.
// isPrefix indicates whether the  key is a full key, or a prefix/delimiter.
func escapeKey(key string, isPrefix bool) string {
	return escape.HexEscape(key, func(r []rune, i int) bool {
		c := r[i]
		switch {
		// Azure does not work well with backslashes in blob names.
		case c == '\\':
			return true
		// Azure doesn't handle these characters (determined via experimentation).
		case c < 32 || c == 34 || c == 35 || c == 37 || c == 63 || c == 127:
			return true
		// Escape trailing "/" for full keys, otherwise Azure can't address them
		// consistently.
		case !isPrefix && i == len(key)-1 && c == '/':
			return true
		// For "../", escape the trailing slash.
		case i > 1 && r[i] == '/' && r[i-1] == '.' && r[i-2] == '.':
			return true
		}
		return false
	})
}

// unescapeKey reverses escapeKey.
func unescapeKey(key string) string {
	return escape.HexUnescape(key)
}

// NewTypedWriter implements driver.NewTypedWriter.
func (b *bucket) NewTypedWriter(ctx context.Context, key, contentType string, opts *driver.WriterOptions) (driver.Writer, error) {
	key = escapeKey(key, false)
	blobClient := b.client.NewBlockBlobClient(key)
	if opts.BufferSize == 0 {
		opts.BufferSize = defaultUploadBlockSize
	}
	if opts.MaxConcurrency == 0 {
		opts.MaxConcurrency = defaultUploadBuffers
	}

	md := make(map[string]*string, len(opts.Metadata))
	for k, v := range opts.Metadata {
		// See the package comments for more details on escaping of metadata
		// keys & values.
		e := escape.HexEscape(k, func(runes []rune, i int) bool {
			c := runes[i]
			switch {
			case i == 0 && c >= '0' && c <= '9':
				return true
			case escape.IsASCIIAlphanumeric(c):
				return false
			case c == '_':
				return false
			}
			return true
		})
		if _, ok := md[e]; ok {
			return nil, fmt.Errorf("duplicate keys after escaping: %q => %q", k, e)
		}
		escaped := escape.URLEscape(v)
		md[e] = &escaped
	}
	uploadOpts := &azblob.UploadStreamOptions{
		BlockSize:   int64(opts.BufferSize),
		Concurrency: opts.MaxConcurrency,
		Metadata:    md,
		HTTPHeaders: &azblobblob.HTTPHeaders{
			BlobCacheControl:       &opts.CacheControl,
			BlobContentDisposition: &opts.ContentDisposition,
			BlobContentEncoding:    &opts.ContentEncoding,
			BlobContentLanguage:    &opts.ContentLanguage,
			BlobContentMD5:         opts.ContentMD5,
			BlobContentType:        &contentType,
		},
	}
	if opts.IfNotExist {
		etagAny := azcore.ETagAny
		uploadOpts.AccessConditions = &azblob.AccessConditions{
			ModifiedAccessConditions: &azblobblob.ModifiedAccessConditions{
				IfNoneMatch: &etagAny,
			},
		}
	}
	if opts.BeforeWrite != nil {
		asFunc := func(i any) bool {
			p, ok := i.(**azblob.UploadStreamOptions)
			if !ok {
				return false
			}
			*p = uploadOpts
			return true
		}
		if err := opts.BeforeWrite(asFunc); err != nil {
			return nil, err
		}
	}
	return &writer{
		ctx:        ctx,
		client:     blobClient,
		uploadOpts: uploadOpts,
		donec:      make(chan struct{}),
	}, nil
}

// Write appends p to w.pw. User must call Close to close the w after done writing.
func (w *writer) Write(p []byte) (int, error) {
	// Avoid opening the pipe for a zero-length write;
	// the concrete can do these for empty blobs.
	if len(p) == 0 {
		return 0, nil
	}
	if w.pw == nil {
		// We'll write into pw and use pr as an io.Reader for the
		// Upload call to Azure.
		w.pr, w.pw = io.Pipe()
		w.open(w.pr, true)
	}
	return w.pw.Write(p)
}

// Upload reads from r. Per the driver, it is guaranteed to be the only
// write call for this writer.
func (w *writer) Upload(r io.Reader) error {
	w.upload = true
	w.open(r, false)
	return nil
}

// r may be nil if we're Closing and no data was written.
// If closePipeOnError is true, w.pr will be closed if there's an
// error uploading to Azure.
func (w *writer) open(r io.Reader, closePipeOnError bool) {
	go func() {
		defer close(w.donec)

		if r == nil {
			r = http.NoBody
		}
		_, w.err = w.client.UploadStream(w.ctx, r, w.uploadOpts)
		if w.err != nil {
			if closePipeOnError {
				w.pr.CloseWithError(w.err)
				w.pr = nil
			}
		}
	}()
}

// Close completes the writer and closes it. Any error occurring during write will
// be returned. If a writer is closed before any Write is called, Close will
// create an empty file at the given key.
func (w *writer) Close() error {
	if !w.upload {
		if w.pr != nil {
			defer w.pr.Close()
		}
		if w.pw == nil {
			// We never got any bytes written. We'll write an http.NoBody.
			w.open(nil, false)
		} else if err := w.pw.Close(); err != nil {
			return err
		}
	}
	<-w.donec
	return w.err
}
