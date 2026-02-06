// Package v4 implements the AWS signature version 4 algorithm (commonly known
// as SigV4).
//
// For more information about SigV4, see [Signing AWS API requests] in the IAM
// user guide.
//
// While this implementation CAN work in an external context, it is developed
// primarily for SDK use and you may encounter fringe behaviors around header
// canonicalization.
//
// # Pre-escaping a request URI
//
// AWS v4 signature validation requires that the canonical string's URI path
// component must be the escaped form of the HTTP request's path.
//
// The Go HTTP client will perform escaping automatically on the HTTP request.
// This may cause signature validation errors because the request differs from
// the URI path or query from which the signature was generated.
//
// Because of this, we recommend that you explicitly escape the request when
// using this signer outside of the SDK to prevent possible signature mismatch.
// This can be done by setting URL.Opaque on the request. The signer will
// prefer that value, falling back to the return of URL.EscapedPath if unset.
//
// When setting URL.Opaque you must do so in the form of:
//
//	"//<hostname>/<path>"
//
//	// e.g.
//	"//example.com/some/path"
//
// The leading "//" and hostname are required or the escaping will not work
// correctly.
//
// The TestStandaloneSign unit test provides a complete example of using the
// signer outside of the SDK and pre-escaping the URI path.
//
// [Signing AWS API requests]: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_aws-signing.html
package v4

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"hash"
	"net/http"
	"net/textproto"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	v4Internal "github.com/aws/aws-sdk-go-v2/aws/signer/internal/v4"
	"github.com/aws/smithy-go/encoding/httpbinding"
	"github.com/aws/smithy-go/logging"
)

const (
	signingAlgorithm    = "AWS4-HMAC-SHA256"
	authorizationHeader = "Authorization"

	// Version of signing v4
	Version = "SigV4"
)

// HTTPSigner is an interface to a SigV4 signer that can sign HTTP requests
type HTTPSigner interface {
	SignHTTP(ctx context.Context, credentials aws.Credentials, r *http.Request, payloadHash string, service string, region string, signingTime time.Time, optFns ...func(*SignerOptions)) error
}

type keyDerivator interface {
	DeriveKey(credential aws.Credentials, service, region string, signingTime v4Internal.SigningTime) []byte
}

// SignerOptions is the SigV4 Signer options.
type SignerOptions struct {
	// Disables the Signer's moving HTTP header key/value pairs from the HTTP
	// request header to the request's query string. This is most commonly used
	// with pre-signed requests preventing headers from being added to the
	// request's query string.
	DisableHeaderHoisting bool

	// Disables the automatic escaping of the URI path of the request for the
	// siganture's canonical string's path. For services that do not need additional
	// escaping then use this to disable the signer escaping the path.
	//
	// S3 is an example of a service that does not need additional escaping.
	//
	// http://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html
	DisableURIPathEscaping bool

	// The logger to send log messages to.
	Logger logging.Logger

	// Enable logging of signed requests.
	// This will enable logging of the canonical request, the string to sign, and for presigning the subsequent
	// presigned URL.
	LogSigning bool

	// Disables setting the session token on the request as part of signing
	// through X-Amz-Security-Token. This is needed for variations of v4 that
	// present the token elsewhere.
	DisableSessionToken bool
}

// Signer applies AWS v4 signing to given request. Use this to sign requests
// that need to be signed with AWS V4 Signatures.
type Signer struct {
	options      SignerOptions
	keyDerivator keyDerivator
}

// NewSigner returns a new SigV4 Signer
func NewSigner(optFns ...func(signer *SignerOptions)) *Signer {
	options := SignerOptions{}

	for _, fn := range optFns {
		fn(&options)
	}

	return &Signer{options: options, keyDerivator: v4Internal.NewSigningKeyDeriver()}
}

type httpSigner struct {
	Request      *http.Request
	ServiceName  string
	Region       string
	Time         v4Internal.SigningTime
	Credentials  aws.Credentials
	KeyDerivator keyDerivator
	IsPreSign    bool

	PayloadHash string

	DisableHeaderHoisting  bool
	DisableURIPathEscaping bool
	DisableSessionToken    bool
}

func (s *httpSigner) Build() (signedRequest, error) {
	req := s.Request

	query := req.URL.Query()
	headers := req.Header

	s.setRequiredSigningFields(headers, query)

	// Sort Each Query Key's Values
	for key := range query {
		sort.Strings(query[key])
	}

	v4Internal.SanitizeHostForHeader(req)

	credentialScope := s.buildCredentialScope()
	credentialStr := s.Credentials.AccessKeyID + "/" + credentialScope
	if s.IsPreSign {
		query.Set(v4Internal.AmzCredentialKey, credentialStr)
	}

	unsignedHeaders := headers
	if s.IsPreSign && !s.DisableHeaderHoisting {
		var urlValues url.Values
		urlValues, unsignedHeaders = buildQuery(v4Internal.AllowedQueryHoisting, headers)
		for k := range urlValues {
			query[k] = urlValues[k]
		}
	}

	host := req.URL.Host
	if len(req.Host) > 0 {
		host = req.Host
	}

	signedHeaders, signedHeadersStr, canonicalHeaderStr := s.buildCanonicalHeaders(host, v4Internal.IgnoredHeaders, unsignedHeaders, s.Request.ContentLength)

	if s.IsPreSign {
		query.Set(v4Internal.AmzSignedHeadersKey, signedHeadersStr)
	}

	var rawQuery strings.Builder
	rawQuery.WriteString(strings.Replace(query.Encode(), "+", "%20", -1))

	canonicalURI := v4Internal.GetURIPath(req.URL)
	if !s.DisableURIPathEscaping {
		canonicalURI = httpbinding.EscapePath(canonicalURI, false)
	}

	canonicalString := s.buildCanonicalString(
		req.Method,
		canonicalURI,
		rawQuery.String(),
		signedHeadersStr,
		canonicalHeaderStr,
	)

	strToSign := s.buildStringToSign(credentialScope, canonicalString)
	signingSignature, err := s.buildSignature(strToSign)
	if err != nil {
		return signedRequest{}, err
	}

	if s.IsPreSign {
		rawQuery.WriteString("&X-Amz-Signature=")
		rawQuery.WriteString(signingSignature)
	} else {
		headers[authorizationHeader] = append(headers[authorizationHeader][:0], buildAuthorizationHeader(credentialStr, signedHeadersStr, signingSignature))
	}

	req.URL.RawQuery = rawQuery.String()

	return signedRequest{
		Request:         req,
		SignedHeaders:   signedHeaders,
		CanonicalString: canonicalString,
		StringToSign:    strToSign,
		PreSigned:       s.IsPreSign,
	}, nil
}

func buildAuthorizationHeader(credentialStr, signedHeadersStr, signingSignature string) string {
	const credential = "Credential="
	const signedHeaders = "SignedHeaders="
	const signature = "Signature="
	const commaSpace = ", "

	var parts strings.Builder
	parts.Grow(len(signingAlgorithm) + 1 +
		len(credential) + len(credentialStr) + 2 +
		len(signedHeaders) + len(signedHeadersStr) + 2 +
		len(signature) + len(signingSignature),
	)
	parts.WriteString(signingAlgorithm)
	parts.WriteRune(' ')
	parts.WriteString(credential)
	parts.WriteString(credentialStr)
	parts.WriteString(commaSpace)
	parts.WriteString(signedHeaders)
	parts.WriteString(signedHeadersStr)
	parts.WriteString(commaSpace)
	parts.WriteString(signature)
	parts.WriteString(signingSignature)
	return parts.String()
}

// SignHTTP signs AWS v4 requests with the provided payload hash, service name, region the
// request is made to, and time the request is signed at. The signTime allows
// you to specify that a request is signed for the future, and cannot be
// used until then.
//
// The payloadHash is the hex encoded SHA-256 hash of the request payload, and
// must be provided. Even if the request has no payload (aka body). If the
// request has no payload you should use the hex encoded SHA-256 of an empty
// string as the payloadHash value.
//
//	"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
//
// Some services such as Amazon S3 accept alternative values for the payload
// hash, such as "UNSIGNED-PAYLOAD" for requests where the body will not be
// included in the request signature.
//
// https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
//
// Sign differs from Presign in that it will sign the request using HTTP
// header values. This type of signing is intended for http.Request values that
// will not be shared, or are shared in a way the header values on the request
// will not be lost.
//
// The passed in request will be modified in place.
func (s Signer) SignHTTP(ctx context.Context, credentials aws.Credentials, r *http.Request, payloadHash string, service string, region string, signingTime time.Time, optFns ...func(options *SignerOptions)) error {
	options := s.options

	for _, fn := range optFns {
		fn(&options)
	}

	signer := &httpSigner{
		Request:                r,
		PayloadHash:            payloadHash,
		ServiceName:            service,
		Region:                 region,
		Credentials:            credentials,
		Time:                   v4Internal.NewSigningTime(signingTime.UTC()),
		DisableHeaderHoisting:  options.DisableHeaderHoisting,
		DisableURIPathEscaping: options.DisableURIPathEscaping,
		DisableSessionToken:    options.DisableSessionToken,
		KeyDerivator:           s.keyDerivator,
	}

	signedRequest, err := signer.Build()
	if err != nil {
		return err
	}

	logSigningInfo(ctx, options, &signedRequest, false)

	return nil
}

// PresignHTTP signs AWS v4 requests with the payload hash, service name, region
// the request is made to, and time the request is signed at. The signTime
// allows you to specify that a request is signed for the future, and cannot
// be used until then.
//
// Returns the signed URL and the map of HTTP headers that were included in the
// signature or an error if signing the request failed. For presigned requests
// these headers and their values must be included on the HTTP request when it
// is made. This is helpful to know what header values need to be shared with
// the party the presigned request will be distributed to.
//
// The payloadHash is the hex encoded SHA-256 hash of the request payload, and
// must be provided. Even if the request has no payload (aka body). If the
// request has no payload you should use the hex encoded SHA-256 of an empty
// string as the payloadHash value.
//
//	"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
//
// Some services such as Amazon S3 accept alternative values for the payload
// hash, such as "UNSIGNED-PAYLOAD" for requests where the body will not be
// included in the request signature.
//
// https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
//
// PresignHTTP differs from SignHTTP in that it will sign the request using
// query string instead of header values. This allows you to share the
// Presigned Request's URL with third parties, or distribute it throughout your
// system with minimal dependencies.
//
// PresignHTTP will not set the expires time of the presigned request
// automatically. To specify the expire duration for a request add the
// "X-Amz-Expires" query parameter on the request with the value as the
// duration in seconds the presigned URL should be considered valid for. This
// parameter is not used by all AWS services, and is most notable used by
// Amazon S3 APIs.
//
//	expires := 20 * time.Minute
//	query := req.URL.Query()
//	query.Set("X-Amz-Expires", strconv.FormatInt(int64(expires/time.Second), 10))
//	req.URL.RawQuery = query.Encode()
//
// This method does not modify the provided request.
func (s *Signer) PresignHTTP(
	ctx context.Context, credentials aws.Credentials, r *http.Request,
	payloadHash string, service string, region string, signingTime time.Time,
	optFns ...func(*SignerOptions),
) (signedURI string, signedHeaders http.Header, err error) {
	options := s.options

	for _, fn := range optFns {
		fn(&options)
	}

	signer := &httpSigner{
		Request:                r.Clone(r.Context()),
		PayloadHash:            payloadHash,
		ServiceName:            service,
		Region:                 region,
		Credentials:            credentials,
		Time:                   v4Internal.NewSigningTime(signingTime.UTC()),
		IsPreSign:              true,
		DisableHeaderHoisting:  options.DisableHeaderHoisting,
		DisableURIPathEscaping: options.DisableURIPathEscaping,
		DisableSessionToken:    options.DisableSessionToken,
		KeyDerivator:           s.keyDerivator,
	}

	signedRequest, err := signer.Build()
	if err != nil {
		return "", nil, err
	}

	logSigningInfo(ctx, options, &signedRequest, true)

	signedHeaders = make(http.Header)

	// For the signed headers we canonicalize the header keys in the returned map.
	// This avoids situations where can standard library double headers like host header. For example the standard
	// library will set the Host header, even if it is present in lower-case form.
	for k, v := range signedRequest.SignedHeaders {
		key := textproto.CanonicalMIMEHeaderKey(k)
		signedHeaders[key] = append(signedHeaders[key], v...)
	}

	return signedRequest.Request.URL.String(), signedHeaders, nil
}

func (s *httpSigner) buildCredentialScope() string {
	return v4Internal.BuildCredentialScope(s.Time, s.Region, s.ServiceName)
}

func buildQuery(r v4Internal.Rule, header http.Header) (url.Values, http.Header) {
	query := url.Values{}
	unsignedHeaders := http.Header{}

	// A list of headers to be converted to lower case to mitigate a limitation from S3
	lowerCaseHeaders := map[string]string{
		"X-Amz-Expected-Bucket-Owner": "x-amz-expected-bucket-owner", // see #2508
		"X-Amz-Request-Payer":         "x-amz-request-payer",         // see #2764
	}

	for k, h := range header {
		if newKey, ok := lowerCaseHeaders[k]; ok {
			k = newKey
		}

		if r.IsValid(k) {
			query[k] = h
		} else {
			unsignedHeaders[k] = h
		}
	}

	return query, unsignedHeaders
}

func (s *httpSigner) buildCanonicalHeaders(host string, rule v4Internal.Rule, header http.Header, length int64) (signed http.Header, signedHeaders, canonicalHeadersStr string) {
	signed = make(http.Header)

	var headers []string
	const hostHeader = "host"
	headers = append(headers, hostHeader)
	signed[hostHeader] = append(signed[hostHeader], host)

	const contentLengthHeader = "content-length"
	if length > 0 {
		headers = append(headers, contentLengthHeader)
		signed[contentLengthHeader] = append(signed[contentLengthHeader], strconv.FormatInt(length, 10))
	}

	for k, v := range header {
		if !rule.IsValid(k) {
			continue // ignored header
		}
		if strings.EqualFold(k, contentLengthHeader) {
			// prevent signing already handled content-length header.
			continue
		}

		lowerCaseKey := strings.ToLower(k)
		if _, ok := signed[lowerCaseKey]; ok {
			// include additional values
			signed[lowerCaseKey] = append(signed[lowerCaseKey], v...)
			continue
		}

		headers = append(headers, lowerCaseKey)
		signed[lowerCaseKey] = v
	}
	sort.Strings(headers)

	signedHeaders = strings.Join(headers, ";")

	var canonicalHeaders strings.Builder
	n := len(headers)
	const colon = ':'
	for i := 0; i < n; i++ {
		if headers[i] == hostHeader {
			canonicalHeaders.WriteString(hostHeader)
			canonicalHeaders.WriteRune(colon)
			canonicalHeaders.WriteString(v4Internal.StripExcessSpaces(host))
		} else {
			canonicalHeaders.WriteString(headers[i])
			canonicalHeaders.WriteRune(colon)
			// Trim out leading, trailing, and dedup inner spaces from signed header values.
			values := signed[headers[i]]
			for j, v := range values {
				cleanedValue := strings.TrimSpace(v4Internal.StripExcessSpaces(v))
				canonicalHeaders.WriteString(cleanedValue)
				if j < len(values)-1 {
					canonicalHeaders.WriteRune(',')
				}
			}
		}
		canonicalHeaders.WriteRune('\n')
	}
	canonicalHeadersStr = canonicalHeaders.String()

	return signed, signedHeaders, canonicalHeadersStr
}

func (s *httpSigner) buildCanonicalString(method, uri, query, signedHeaders, canonicalHeaders string) string {
	return strings.Join([]string{
		method,
		uri,
		query,
		canonicalHeaders,
		signedHeaders,
		s.PayloadHash,
	}, "\n")
}

func (s *httpSigner) buildStringToSign(credentialScope, canonicalRequestString string) string {
	return strings.Join([]string{
		signingAlgorithm,
		s.Time.TimeFormat(),
		credentialScope,
		hex.EncodeToString(makeHash(sha256.New(), []byte(canonicalRequestString))),
	}, "\n")
}

func makeHash(hash hash.Hash, b []byte) []byte {
	hash.Reset()
	hash.Write(b)
	return hash.Sum(nil)
}

func (s *httpSigner) buildSignature(strToSign string) (string, error) {
	key := s.KeyDerivator.DeriveKey(s.Credentials, s.ServiceName, s.Region, s.Time)
	return hex.EncodeToString(v4Internal.HMACSHA256(key, []byte(strToSign))), nil
}

func (s *httpSigner) setRequiredSigningFields(headers http.Header, query url.Values) {
	amzDate := s.Time.TimeFormat()

	if s.IsPreSign {
		query.Set(v4Internal.AmzAlgorithmKey, signingAlgorithm)
		sessionToken := s.Credentials.SessionToken
		if !s.DisableSessionToken && len(sessionToken) > 0 {
			query.Set("X-Amz-Security-Token", sessionToken)
		}

		query.Set(v4Internal.AmzDateKey, amzDate)
		return
	}

	headers[v4Internal.AmzDateKey] = append(headers[v4Internal.AmzDateKey][:0], amzDate)

	if !s.DisableSessionToken && len(s.Credentials.SessionToken) > 0 {
		headers[v4Internal.AmzSecurityTokenKey] = append(headers[v4Internal.AmzSecurityTokenKey][:0], s.Credentials.SessionToken)
	}
}

func logSigningInfo(ctx context.Context, options SignerOptions, request *signedRequest, isPresign bool) {
	if !options.LogSigning {
		return
	}
	signedURLMsg := ""
	if isPresign {
		signedURLMsg = fmt.Sprintf(logSignedURLMsg, request.Request.URL.String())
	}
	logger := logging.WithContext(ctx, options.Logger)
	logger.Logf(logging.Debug, logSignInfoMsg, request.CanonicalString, request.StringToSign, signedURLMsg)
}

type signedRequest struct {
	Request         *http.Request
	SignedHeaders   http.Header
	CanonicalString string
	StringToSign    string
	PreSigned       bool
}

const logSignInfoMsg = `Request Signature:
---[ CANONICAL STRING  ]-----------------------------
%s
---[ STRING TO SIGN ]--------------------------------
%s%s
-----------------------------------------------------`
const logSignedURLMsg = `
---[ SIGNED URL ]------------------------------------
%s`
