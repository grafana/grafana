//go:build go1.16
// +build go1.16

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package runtime

import "github.com/Azure/azure-sdk-for-go/sdk/azcore/cloud"

func init() {
	cloud.AzureChina.Services[cloud.ResourceManager] = cloud.ServiceConfiguration{
		Audience: "https://management.core.chinacloudapi.cn",
		Endpoint: "https://management.chinacloudapi.cn",
	}
	cloud.AzureGovernment.Services[cloud.ResourceManager] = cloud.ServiceConfiguration{
		Audience: "https://management.core.usgovcloudapi.net",
		Endpoint: "https://management.usgovcloudapi.net",
	}
	cloud.AzurePublic.Services[cloud.ResourceManager] = cloud.ServiceConfiguration{
		Audience: "https://management.core.windows.net/",
		Endpoint: "https://management.azure.com",
	}
}
