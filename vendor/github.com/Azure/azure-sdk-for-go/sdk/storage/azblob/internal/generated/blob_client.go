//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package generated

import (
	"context"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"time"
)

// used to convert times from UTC to GMT before sending across the wire
var gmt = time.FixedZone("GMT", 0)

func (client *BlobClient) Endpoint() string {
	return client.endpoint
}

func (client *BlobClient) InternalClient() *azcore.Client {
	return client.internal
}

func (client *BlobClient) DeleteCreateRequest(ctx context.Context, options *BlobClientDeleteOptions, leaseAccessConditions *LeaseAccessConditions, modifiedAccessConditions *ModifiedAccessConditions) (*policy.Request, error) {
	return client.deleteCreateRequest(ctx, options, leaseAccessConditions, modifiedAccessConditions)
}

func (client *BlobClient) SetTierCreateRequest(ctx context.Context, tier AccessTier, options *BlobClientSetTierOptions, leaseAccessConditions *LeaseAccessConditions, modifiedAccessConditions *ModifiedAccessConditions) (*policy.Request, error) {
	return client.setTierCreateRequest(ctx, tier, options, leaseAccessConditions, modifiedAccessConditions)
}

// NewBlobClient creates a new instance of BlobClient with the specified values.
//   - endpoint - The URL of the service account, container, or blob that is the target of the desired operation.
//   - azClient - azcore.Client is a basic HTTP client. It consists of a pipeline and tracing provider.
func NewBlobClient(endpoint string, azClient *azcore.Client) *BlobClient {
	client := &BlobClient{
		internal: azClient,
		endpoint: endpoint,
	}
	return client
}
