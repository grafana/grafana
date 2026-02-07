package transport

import (
	"net/http"
	"net/url"

	"github.com/aws/smithy-go"
)

// Endpoint is the endpoint object returned by Endpoint resolution V2
type Endpoint struct {
	// The complete URL minimally specifying the scheme and host.
	// May optionally specify the port and base path component.
	URI url.URL

	// An optional set of headers to be sent using transport layer headers.
	Headers http.Header

	// A grab-bag property map of endpoint attributes. The
	// values present here are subject to change, or being add/removed at any
	// time.
	Properties smithy.Properties
}
