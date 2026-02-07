//go:build !go1.18
// +build !go1.18

package eventstreamapi

import "github.com/aws/aws-sdk-go/aws/request"

// ApplyHTTPTransportFixes applies fixes to the HTTP request for proper event
// stream functionality. Go 1.15 through 1.17 HTTP client could hang forever
// when an HTTP/2 connection failed with an non-200 status code and err. Using
// Expect 100-Continue, allows the HTTP client to gracefully handle the non-200
// status code, and close the connection.
//
// This is a no-op for Go 1.18 and above.
func ApplyHTTPTransportFixes(r *request.Request) {
	r.Handlers.Sign.PushBack(func(r *request.Request) {
		r.HTTPRequest.Header.Set("Expect", "100-Continue")
	})
}
