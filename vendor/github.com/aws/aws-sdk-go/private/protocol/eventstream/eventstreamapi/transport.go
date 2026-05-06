//go:build go1.18
// +build go1.18

package eventstreamapi

import "github.com/aws/aws-sdk-go/aws/request"

// ApplyHTTPTransportFixes is a no-op for Go 1.18 and above.
func ApplyHTTPTransportFixes(r *request.Request) {
}
