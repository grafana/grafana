// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "net/url"

// canonicalize takes a list of URLs and returns its canonicalized form, i.e.
// remove anything but scheme, userinfo, host, path, and port.
// It also removes all trailing slashes. Invalid URLs or URLs that do not
// use protocol http or https are skipped.
//
// Example:
// http://127.0.0.1:9200/?query=1 -> http://127.0.0.1:9200
// http://127.0.0.1:9200/db1/ -> http://127.0.0.1:9200/db1
func canonicalize(rawurls ...string) []string {
	var canonicalized []string
	for _, rawurl := range rawurls {
		u, err := url.Parse(rawurl)
		if err == nil {
			if u.Scheme == "http" || u.Scheme == "https" {
				// Trim trailing slashes
				for len(u.Path) > 0 && u.Path[len(u.Path)-1] == '/' {
					u.Path = u.Path[0 : len(u.Path)-1]
				}
				u.Fragment = ""
				u.RawQuery = ""
				canonicalized = append(canonicalized, u.String())
			}
		}
	}
	return canonicalized
}
