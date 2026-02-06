// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package plugincontainer

import (
	"errors"
)

var (
	errUnsupportedOS = errors.New("plugincontainer currently only supports Linux")

	// ErrSHA256Mismatch is returned when starting a container without any
	// images available where the provided sha256 matches the image and tag.
	ErrSHA256Mismatch = errors.New("SHA256 mismatch")
)
