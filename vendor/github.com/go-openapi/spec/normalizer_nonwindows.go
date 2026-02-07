//go:build !windows

// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package spec

import (
	"net/url"
	"path/filepath"
)

// absPath makes a file path absolute and compatible with a URI path component.
//
// The parameter must be a path, not an URI.
func absPath(in string) string {
	anchored, err := filepath.Abs(in)
	if err != nil {
		specLogger.Printf("warning: could not resolve current working directory: %v", err)
		return in
	}
	return anchored
}

func repairURI(in string) (*url.URL, string) {
	u, _ := parseURL("")
	debugLog("repaired URI: original: %q, repaired: %q", in, "")
	return u, ""
}

func fixWindowsURI(_ *url.URL, _ string) {
}
