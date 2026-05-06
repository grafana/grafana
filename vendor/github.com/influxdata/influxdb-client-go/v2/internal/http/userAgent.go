// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

// Package http hold internal HTTP related stuff
package http

import (
	"fmt"
)

// UserAgentBase keeps once created base User-Agent string
var UserAgentBase string

// FormatUserAgent creates User-Agent header value for application name
func FormatUserAgent(appName string) string {
	if appName != "" {
		return fmt.Sprintf("%s %s", UserAgentBase, appName)
	}
	return UserAgentBase
}
