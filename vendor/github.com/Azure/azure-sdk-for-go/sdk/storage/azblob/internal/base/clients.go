//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package base

import (
	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/shared"
	"strings"
)

// ClientOptions contains the optional parameters when creating a Client.
type ClientOptions struct {
	azcore.ClientOptions

	// Audience to use when requesting tokens for Azure Active Directory authentication.
	// Only has an effect when credential is of type TokenCredential. The value could be
	// https://storage.azure.com/ (default) or https://<account>.blob.core.windows.net.
	Audience string
}

type Client[T any] struct {
	inner      *T
	credential any
	options    *ClientOptions
}

func InnerClient[T any](client *Client[T]) *T {
	return client.inner
}

func SharedKey[T any](client *Client[T]) *exported.SharedKeyCredential {
	switch cred := client.credential.(type) {
	case *exported.SharedKeyCredential:
		return cred
	default:
		return nil
	}
}

func Credential[T any](client *Client[T]) any {
	return client.credential
}

func GetClientOptions[T any](client *Client[T]) *ClientOptions {
	return client.options
}

func GetAudience(clOpts *ClientOptions) string {
	if clOpts == nil || len(strings.TrimSpace(clOpts.Audience)) == 0 {
		return shared.TokenScope
	} else {
		return strings.TrimRight(clOpts.Audience, "/") + "/.default"
	}
}

func NewClient[T any](inner *T) *Client[T] {
	return &Client[T]{inner: inner}
}

func NewServiceClient(containerURL string, azClient *azcore.Client, credential any, options *ClientOptions) *Client[generated.ServiceClient] {
	return &Client[generated.ServiceClient]{
		inner:      generated.NewServiceClient(containerURL, azClient),
		credential: credential,
		options:    options,
	}
}

func NewContainerClient(containerURL string, azClient *azcore.Client, credential any, options *ClientOptions) *Client[generated.ContainerClient] {
	return &Client[generated.ContainerClient]{
		inner:      generated.NewContainerClient(containerURL, azClient),
		credential: credential,
		options:    options,
	}
}

func NewBlobClient(blobURL string, azClient *azcore.Client, credential any, options *ClientOptions) *Client[generated.BlobClient] {
	return &Client[generated.BlobClient]{
		inner:      generated.NewBlobClient(blobURL, azClient),
		credential: credential,
		options:    options,
	}
}

type CompositeClient[T, U any] struct {
	innerT    *T
	innerU    *U
	sharedKey *exported.SharedKeyCredential
}

func InnerClients[T, U any](client *CompositeClient[T, U]) (*Client[T], *U) {
	return &Client[T]{
		inner:      client.innerT,
		credential: client.sharedKey,
	}, client.innerU
}

func NewAppendBlobClient(blobURL string, azClient *azcore.Client, sharedKey *exported.SharedKeyCredential) *CompositeClient[generated.BlobClient, generated.AppendBlobClient] {
	return &CompositeClient[generated.BlobClient, generated.AppendBlobClient]{
		innerT:    generated.NewBlobClient(blobURL, azClient),
		innerU:    generated.NewAppendBlobClient(blobURL, azClient),
		sharedKey: sharedKey,
	}
}

func NewBlockBlobClient(blobURL string, azClient *azcore.Client, sharedKey *exported.SharedKeyCredential) *CompositeClient[generated.BlobClient, generated.BlockBlobClient] {
	return &CompositeClient[generated.BlobClient, generated.BlockBlobClient]{
		innerT:    generated.NewBlobClient(blobURL, azClient),
		innerU:    generated.NewBlockBlobClient(blobURL, azClient),
		sharedKey: sharedKey,
	}
}

func NewPageBlobClient(blobURL string, azClient *azcore.Client, sharedKey *exported.SharedKeyCredential) *CompositeClient[generated.BlobClient, generated.PageBlobClient] {
	return &CompositeClient[generated.BlobClient, generated.PageBlobClient]{
		innerT:    generated.NewBlobClient(blobURL, azClient),
		innerU:    generated.NewPageBlobClient(blobURL, azClient),
		sharedKey: sharedKey,
	}
}

func SharedKeyComposite[T, U any](client *CompositeClient[T, U]) *exported.SharedKeyCredential {
	return client.sharedKey
}
