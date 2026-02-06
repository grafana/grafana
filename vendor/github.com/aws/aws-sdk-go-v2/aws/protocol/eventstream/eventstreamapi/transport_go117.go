//go:build !go1.18
// +build !go1.18

package eventstreamapi

import smithyhttp "github.com/aws/smithy-go/transport/http"

// ApplyHTTPTransportFixes applies fixes to the HTTP request for proper event stream functionality.
func ApplyHTTPTransportFixes(r *smithyhttp.Request) error {
	r.Header.Set("Expect", "100-continue")
	return nil
}
