package auth

// Anonymous
const (
	SchemeIDAnonymous = "smithy.api#noAuth"
)

// HTTP auth schemes
const (
	SchemeIDHTTPBasic  = "smithy.api#httpBasicAuth"
	SchemeIDHTTPDigest = "smithy.api#httpDigestAuth"
	SchemeIDHTTPBearer = "smithy.api#httpBearerAuth"
	SchemeIDHTTPAPIKey = "smithy.api#httpApiKeyAuth"
)

// AWS auth schemes
const (
	SchemeIDSigV4  = "aws.auth#sigv4"
	SchemeIDSigV4A = "aws.auth#sigv4a"
)
