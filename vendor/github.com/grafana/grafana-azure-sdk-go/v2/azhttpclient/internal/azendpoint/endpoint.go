package azendpoint

import (
	"net/url"
)

func Endpoint(u url.URL) *url.URL {
	if u.Opaque != "" || u.Scheme == "" || u.Host == "" {
		return nil
	}

	return &url.URL{
		Scheme: u.Scheme,
		Host:   u.Host,
	}
}
