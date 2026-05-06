package openapi2

import (
	"net/url"
)

// copyURI makes a copy of the pointer.
func copyURI(u *url.URL) *url.URL {
	if u == nil {
		return nil
	}

	c := *u // shallow-copy
	return &c
}
