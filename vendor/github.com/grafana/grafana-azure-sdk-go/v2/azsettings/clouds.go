package azsettings

import "strings"

const (
	AzurePublic       = "AzureCloud"
	AzureChina        = "AzureChinaCloud"
	AzureUSGovernment = "AzureUSGovernment"
	AzureCustomized   = "AzureCustomizedCloud"
)

func NormalizeAzureCloud(cloudName string) string {
	switch strings.ToLower(cloudName) {
	// Public
	case "azurecloud":
		fallthrough
	case "azurepublic":
		fallthrough
	case "azurepubliccloud":
		fallthrough
	case "public":
		return AzurePublic

	// China
	case "azurechina":
		fallthrough
	case "azurechinacloud":
		fallthrough
	case "china":
		return AzureChina

	// US Government
	case "azureusgovernment":
		fallthrough
	case "azureusgovernmentcloud":
		fallthrough
	case "usgov":
		fallthrough
	case "usgovernment":
		return AzureUSGovernment

	// Customized
	case "azurecustomizedcloud":
		return AzureCustomized
	}

	// Pass the name unchanged if it's not known
	return cloudName
}
