//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package generated

import (
	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
)

func (client *ContainerClient) Endpoint() string {
	return client.endpoint
}

func (client *ContainerClient) InternalClient() *azcore.Client {
	return client.internal
}

// NewContainerClient creates a new instance of ContainerClient with the specified values.
//   - endpoint - The URL of the service account, container, or blob that is the target of the desired operation.
//   - pl - the pipeline used for sending requests and handling responses.
func NewContainerClient(endpoint string, azClient *azcore.Client) *ContainerClient {
	client := &ContainerClient{
		internal: azClient,
		endpoint: endpoint,
	}
	return client
}
