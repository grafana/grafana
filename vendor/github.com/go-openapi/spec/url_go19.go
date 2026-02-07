// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package spec

import "net/url"

func parseURL(s string) (*url.URL, error) {
	u, err := url.Parse(s)
	if err == nil {
		u.OmitHost = false
	}
	return u, err
}
