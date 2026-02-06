//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package exported

import (
	"fmt"
	"strconv"
)

// HTTPRange defines a range of bytes within an HTTP resource, starting at offset and
// ending at offset+count. A zero-value HTTPRange indicates the entire resource. An HTTPRange
// which has an offset and zero value count indicates from the offset to the resource's end.
type HTTPRange struct {
	Offset int64
	Count  int64
}

// FormatHTTPRange converts an HTTPRange to its string format.
func FormatHTTPRange(r HTTPRange) *string {
	if r.Offset == 0 && r.Count == 0 {
		return nil // No specified range
	}
	endOffset := "" // if count == CountToEnd (0)
	if r.Count > 0 {
		endOffset = strconv.FormatInt((r.Offset+r.Count)-1, 10)
	}
	dataRange := fmt.Sprintf("bytes=%v-%s", r.Offset, endOffset)
	return &dataRange
}
