//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package generated

import (
	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
)

func (client *PageBlobClient) Endpoint() string {
	return client.endpoint
}

func (client *PageBlobClient) InternalClient() *azcore.Client {
	return client.internal
}

// NewPageBlobClient creates a new instance of PageBlobClient with the specified values.
//   - endpoint - The URL of the service account, container, or blob that is the target of the desired operation.
//   - azClient - azcore.Client is a basic HTTP client. It consists of a pipeline and tracing provider.
func NewPageBlobClient(endpoint string, azClient *azcore.Client) *PageBlobClient {
	client := &PageBlobClient{
		internal: azClient,
		endpoint: endpoint,
	}
	return client
}
