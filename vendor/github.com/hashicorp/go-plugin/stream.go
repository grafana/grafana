// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package plugin

import (
	"io"
	"log"
)

func copyStream(name string, dst io.Writer, src io.Reader) {
	if src == nil {
		panic(name + ": src is nil")
	}
	if dst == nil {
		panic(name + ": dst is nil")
	}
	if _, err := io.Copy(dst, src); err != nil && err != io.EOF {
		log.Printf("[ERR] plugin: stream copy '%s' error: %s", name, err)
	}
}
