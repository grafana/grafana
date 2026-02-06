//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

const (
	// UserAgent is the string to be used in the user agent string when making requests.
	component = "azidentity"

	// module is the fully qualified name of the module used in telemetry and distributed tracing.
	module = "github.com/Azure/azure-sdk-for-go/sdk/" + component

	// Version is the semantic version (see http://semver.org) of this module.
	version = "v1.12.0"
)
