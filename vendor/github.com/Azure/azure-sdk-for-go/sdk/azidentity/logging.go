//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import "github.com/Azure/azure-sdk-for-go/sdk/internal/log"

// EventAuthentication entries contain information about authentication.
// This includes information like the names of environment variables
// used when obtaining credentials and the type of credential used.
const EventAuthentication log.Event = "Authentication"
