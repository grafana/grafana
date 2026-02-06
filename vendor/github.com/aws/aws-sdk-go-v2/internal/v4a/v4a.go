package v4a

import (
	"bytes"
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"hash"
	"math/big"
	"net/http"
	"net/textproto"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	signerCrypto "github.com/aws/aws-sdk-go-v2/internal/v4a/internal/crypto"
	v4Internal "github.com/aws/aws-sdk-go-v2/internal/v4a/internal/v4"
	"github.com/aws/smithy-go/encoding/httpbinding"
	"github.com/aws/smithy-go/logging"
)

const (
	// AmzRegionSetKey represents the region set header used for sigv4a
	AmzRegionSetKey     = "X-Amz-Region-Set"
	amzAlgorithmKey     = v4Internal.AmzAlgorithmKey
	amzSecurityTokenKey = v4Internal.AmzSecurityTokenKey
	amzDateKey          = v4Internal.AmzDateKey
	amzCredentialKey    = v4Internal.AmzCredentialKey
	amzSignedHeadersKey = v4Internal.AmzSignedHeadersKey
	authorizationHeader = "Authorization"

	signingAlgorithm = "AWS4-ECDSA-P256-SHA256"

	timeFormat      = "20060102T150405Z"
	shortTimeFormat = "20060102"

	// EmptyStringSHA256 is a hex encoded SHA-256 hash of an empty string
	EmptyStringSHA256 = v4Internal.EmptyStringSHA256

	// Version of signing v4a
	Version = "SigV4A"
)

var (
	p256          elliptic.Curve
	nMinusTwoP256 *big.Int

	one = new(big.Int).SetInt64(1)
)

func init() {
	// Ensure the elliptic curve parameters are initialized on package import rather then on first usage
	p256 = elliptic.P256()

	nMinusTwoP256 = new(big.Int).SetBytes(p256.Params().N.Bytes())
	nMinusTwoP256 = nMinusTwoP256.Sub(nMinusTwoP256, new(big.Int).SetInt64(2))
}

// SignerOptions is the SigV4a signing options for constructing a Signer.
type SignerOptions struct {
	Logger     logging.Logger
	LogSigning bool

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
}

// Signer is a SigV4a HTTP signing implementation
type Signer struct {
	options SignerOptions
}

// NewSigner constructs a SigV4a Signer.
func NewSigner(optFns ...func(*SignerOptions)) *Signer {
	options := SignerOptions{}

	for _, fn := range optFns {
		fn(&options)
	}

	return &Signer{options: options}
}

// deriveKeyFromAccessKeyPair derives a NIST P-256 PrivateKey from the given
// IAM AccessKey and SecretKey pair.
//
// Based on FIPS.186-4 Appendix B.4.2
func deriveKeyFromAccessKeyPair(accessKey, secretKey string) (*ecdsa.PrivateKey, error) {
	params := p256.Params()
	bitLen := params.BitSize // Testing random candidates does not require an additional 64 bits
	counter := 0x01

	buffer := make([]byte, 1+len(accessKey)) // 1 byte counter + len(accessKey)
	kdfContext := bytes.NewBuffer(buffer)

	inputKey := append([]byte("AWS4A"), []byte(secretKey)...)

	d := new(big.Int)
	for {
		kdfContext.Reset()
		kdfContext.WriteString(accessKey)
		kdfContext.WriteByte(byte(counter))

		key, err := signerCrypto.HMACKeyDerivation(sha256.New, bitLen, inputKey, []byte(signingAlgorithm), kdfContext.Bytes())
		if err != nil {
			return nil, err
		}

		// Check key first before calling SetBytes if key key is in fact a valid candidate.
		// This ensures the byte slice is the correct length (32-bytes) to compare in constant-time
		cmp, err := signerCrypto.ConstantTimeByteCompare(key, nMinusTwoP256.Bytes())
		if err != nil {
			return nil, err
		}
		if cmp == -1 {
			d.SetBytes(key)
			break
		}

		counter++
		if counter > 0xFF {
			return nil, fmt.Errorf("exhausted single byte external counter")
		}
	}
	d = d.Add(d, one)

	priv := new(ecdsa.PrivateKey)
	priv.PublicKey.Curve = p256
	priv.D = d
	priv.PublicKey.X, priv.PublicKey.Y = p256.ScalarBaseMult(d.Bytes())

	return priv, nil
}

type httpSigner struct {
	Request     *http.Request
	ServiceName string
	RegionSet   []string
	Time        time.Time
	Credentials Credentials
	IsPreSign   bool

	Logger logging.Logger
	Debug  bool

	// PayloadHash is the hex encoded SHA-256 hash of the request payload
	// If len(PayloadHash) == 0 the signer will attempt to send the request
	// as an unsigned payload. Note: Unsigned payloads only work for a subset of services.
	PayloadHash string

	DisableHeaderHoisting  bool
	DisableURIPathEscaping bool
}

// SignHTTP takes the provided http.Request, payload hash, service, regionSet, and time and signs using SigV4a.
// The passed in request will be modified in place.
func (s *Signer) SignHTTP(ctx context.Context, credentials Credentials, r *http.Request, payloadHash string, service string, regionSet []string, signingTime time.Time, optFns ...func(*SignerOptions)) error {
	options := s.options
	for _, fn := range optFns {
		fn(&options)
	}

	signer := &httpSigner{
		Request:                r,
		PayloadHash:            payloadHash,
		ServiceName:            service,
		RegionSet:              regionSet,
		Credentials:            credentials,
		Time:                   signingTime.UTC(),
		DisableHeaderHoisting:  options.DisableHeaderHoisting,
		DisableURIPathEscaping: options.DisableURIPathEscaping,
	}

	signedRequest, err := signer.Build()
	if err != nil {
		return err
	}

	logHTTPSigningInfo(ctx, options, signedRequest)

	return nil
}

// PresignHTTP takes the provided http.Request, payload hash, service, regionSet, and time and presigns using SigV4a
// Returns the presigned URL along with the headers that were signed with the request.
//
// PresignHTTP will not set the expires time of the presigned request
// automatically. To specify the expire duration for a request add the
// "X-Amz-Expires" query parameter on the request with the value as the
// duration in seconds the presigned URL should be considered valid for. This
// parameter is not used by all AWS services, and is most notable used by
// Amazon S3 APIs.
func (s *Signer) PresignHTTP(ctx context.Context, credentials Credentials, r *http.Request, payloadHash string, service string, regionSet []string, signingTime time.Time, optFns ...func(*SignerOptions)) (signedURI string, signedHeaders http.Header, err error) {
	options := s.options
	for _, fn := range optFns {
		fn(&options)
	}

	signer := &httpSigner{
		Request:                r,
		PayloadHash:            payloadHash,
		ServiceName:            service,
		RegionSet:              regionSet,
		Credentials:            credentials,
		Time:                   signingTime.UTC(),
		IsPreSign:              true,
		DisableHeaderHoisting:  options.DisableHeaderHoisting,
		DisableURIPathEscaping: options.DisableURIPathEscaping,
	}

	signedRequest, err := signer.Build()
	if err != nil {
		return "", nil, err
	}

	logHTTPSigningInfo(ctx, options, signedRequest)

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

func (s *httpSigner) setRequiredSigningFields(headers http.Header, query url.Values) {
	amzDate := s.Time.Format(timeFormat)

	if s.IsPreSign {
		query.Set(AmzRegionSetKey, strings.Join(s.RegionSet, ","))
		query.Set(amzDateKey, amzDate)
		query.Set(amzAlgorithmKey, signingAlgorithm)
		if len(s.Credentials.SessionToken) > 0 {
			query.Set(amzSecurityTokenKey, s.Credentials.SessionToken)
		}
		return
	}

	headers.Set(AmzRegionSetKey, strings.Join(s.RegionSet, ","))
	headers.Set(amzDateKey, amzDate)
	if len(s.Credentials.SessionToken) > 0 {
		headers.Set(amzSecurityTokenKey, s.Credentials.SessionToken)
	}
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
	credentialStr := s.Credentials.Context + "/" + credentialScope
	if s.IsPreSign {
		query.Set(amzCredentialKey, credentialStr)
	}

	unsignedHeaders := headers
	if s.IsPreSign && !s.DisableHeaderHoisting {
		urlValues := url.Values{}
		urlValues, unsignedHeaders = buildQuery(v4Internal.AllowedQueryHoisting, unsignedHeaders)
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
		query.Set(amzSignedHeadersKey, signedHeadersStr)
	}

	rawQuery := strings.Replace(query.Encode(), "+", "%20", -1)

	canonicalURI := v4Internal.GetURIPath(req.URL)
	if !s.DisableURIPathEscaping {
		canonicalURI = httpbinding.EscapePath(canonicalURI, false)
	}

	canonicalString := s.buildCanonicalString(
		req.Method,
		canonicalURI,
		rawQuery,
		signedHeadersStr,
		canonicalHeaderStr,
	)

	strToSign := s.buildStringToSign(credentialScope, canonicalString)
	signingSignature, err := s.buildSignature(strToSign)
	if err != nil {
		return signedRequest{}, err
	}

	if s.IsPreSign {
		rawQuery += "&X-Amz-Signature=" + signingSignature
	} else {
		headers[authorizationHeader] = append(headers[authorizationHeader][:0], buildAuthorizationHeader(credentialStr, signedHeadersStr, signingSignature))
	}

	req.URL.RawQuery = rawQuery

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
		len(credential) + len(credentialStr) + len(commaSpace) +
		len(signedHeaders) + len(signedHeadersStr) + len(commaSpace) +
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

func (s *httpSigner) buildCredentialScope() string {
	return strings.Join([]string{
		s.Time.Format(shortTimeFormat),
		s.ServiceName,
		"aws4_request",
	}, "/")

}

func buildQuery(r v4Internal.Rule, header http.Header) (url.Values, http.Header) {
	query := url.Values{}
	unsignedHeaders := http.Header{}
	for k, h := range header {
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

	if length > 0 {
		const contentLengthHeader = "content-length"
		headers = append(headers, contentLengthHeader)
		signed[contentLengthHeader] = append(signed[contentLengthHeader], strconv.FormatInt(length, 10))
	}

	for k, v := range header {
		if !rule.IsValid(k) {
			continue // ignored header
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
		s.Time.Format(timeFormat),
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
	sig, err := s.Credentials.PrivateKey.Sign(rand.Reader, makeHash(sha256.New(), []byte(strToSign)), crypto.SHA256)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(sig), nil
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

func logHTTPSigningInfo(ctx context.Context, options SignerOptions, r signedRequest) {
	if !options.LogSigning {
		return
	}
	signedURLMsg := ""
	if r.PreSigned {
		signedURLMsg = fmt.Sprintf(logSignedURLMsg, r.Request.URL.String())
	}
	logger := logging.WithContext(ctx, options.Logger)
	logger.Logf(logging.Debug, logSignInfoMsg, r.CanonicalString, r.StringToSign, signedURLMsg)
}

type signedRequest struct {
	Request         *http.Request
	SignedHeaders   http.Header
	CanonicalString string
	StringToSign    string
	PreSigned       bool
}
