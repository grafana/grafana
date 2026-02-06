package v4

import "strings"

// BuildCredentialScope builds the Signature Version 4 (SigV4) signing scope
func BuildCredentialScope(signingTime SigningTime, region, service string) string {
	return strings.Join([]string{
		signingTime.ShortTimeFormat(),
		region,
		service,
		"aws4_request",
	}, "/")
}
