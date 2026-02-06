package azblob

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/Azure/azure-pipeline-go/pipeline"
)

// NewSharedKeyCredential creates an immutable SharedKeyCredential containing the
// storage account's name and either its primary or secondary key.
func NewSharedKeyCredential(accountName, accountKey string) (*SharedKeyCredential, error) {
	bytes, err := base64.StdEncoding.DecodeString(accountKey)
	if err != nil {
		return &SharedKeyCredential{}, err
	}
	return &SharedKeyCredential{accountName: accountName, accountKey: bytes}, nil
}

// SharedKeyCredential contains an account's name and its primary or secondary key.
// It is immutable making it shareable and goroutine-safe.
type SharedKeyCredential struct {
	// Only the NewSharedKeyCredential method should set these; all other methods should treat them as read-only
	accountName string
	accountKey  []byte
}

// AccountName returns the Storage account's name.
func (f SharedKeyCredential) AccountName() string {
	return f.accountName
}

func (f SharedKeyCredential) getAccountKey() []byte {
	return f.accountKey
}

// noop function to satisfy StorageAccountCredential interface
func (f SharedKeyCredential) getUDKParams() *UserDelegationKey {
	return nil
}

// New creates a credential policy object.
func (f *SharedKeyCredential) New(next pipeline.Policy, po *pipeline.PolicyOptions) pipeline.Policy {
	return pipeline.PolicyFunc(func(ctx context.Context, request pipeline.Request) (pipeline.Response, error) {
		// Add a x-ms-date header if it doesn't already exist
		if d := request.Header.Get(headerXmsDate); d == "" {
			request.Header[headerXmsDate] = []string{time.Now().UTC().Format(http.TimeFormat)}
		}
		stringToSign, err := f.buildStringToSign(request)
		if err != nil {
			return nil, err
		}
		signature := f.ComputeHMACSHA256(stringToSign)
		authHeader := strings.Join([]string{"SharedKey ", f.accountName, ":", signature}, "")
		request.Header[headerAuthorization] = []string{authHeader}

		response, err := next.Do(ctx, request)
		if err != nil && response != nil && response.Response() != nil && response.Response().StatusCode == http.StatusForbidden {
			// Service failed to authenticate request, log it
			po.Log(pipeline.LogError, "===== HTTP Forbidden status, String-to-Sign:\n"+stringToSign+"\n===============================\n")
		}
		return response, err
	})
}

// credentialMarker is a package-internal method that exists just to satisfy the Credential interface.
func (*SharedKeyCredential) credentialMarker() {}

// Constants ensuring that header names are correctly spelled and consistently cased.
const (
	headerAuthorization      = "Authorization"
	headerCacheControl       = "Cache-Control"
	headerContentEncoding    = "Content-Encoding"
	headerContentDisposition = "Content-Disposition"
	headerContentLanguage    = "Content-Language"
	headerContentLength      = "Content-Length"
	headerContentMD5         = "Content-MD5"
	headerContentType        = "Content-Type"
	headerDate               = "Date"
	headerIfMatch            = "If-Match"
	headerIfModifiedSince    = "If-Modified-Since"
	headerIfNoneMatch        = "If-None-Match"
	headerIfUnmodifiedSince  = "If-Unmodified-Since"
	headerRange              = "Range"
	headerUserAgent          = "User-Agent"
	headerXmsDate            = "x-ms-date"
	headerXmsVersion         = "x-ms-version"
)

// ComputeHMACSHA256 generates a hash signature for an HTTP request or for a SAS.
func (f SharedKeyCredential) ComputeHMACSHA256(message string) (base64String string) {
	h := hmac.New(sha256.New, f.accountKey)
	h.Write([]byte(message))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func (f *SharedKeyCredential) buildStringToSign(request pipeline.Request) (string, error) {
	// https://docs.microsoft.com/en-us/rest/api/storageservices/authentication-for-the-azure-storage-services
	headers := request.Header
	contentLength := headers.Get(headerContentLength)
	if contentLength == "0" {
		contentLength = ""
	}

	canonicalizedResource, err := f.buildCanonicalizedResource(request.URL)
	if err != nil {
		return "", err
	}

	stringToSign := strings.Join([]string{
		request.Method,
		headers.Get(headerContentEncoding),
		headers.Get(headerContentLanguage),
		contentLength,
		headers.Get(headerContentMD5),
		headers.Get(headerContentType),
		"", // Empty date because x-ms-date is expected (as per web page above)
		headers.Get(headerIfModifiedSince),
		headers.Get(headerIfMatch),
		headers.Get(headerIfNoneMatch),
		headers.Get(headerIfUnmodifiedSince),
		headers.Get(headerRange),
		buildCanonicalizedHeader(headers),
		canonicalizedResource,
	}, "\n")
	return stringToSign, nil
}

func buildCanonicalizedHeader(headers http.Header) string {
	cm := map[string][]string{}
	for k, v := range headers {
		headerName := strings.TrimSpace(strings.ToLower(k))
		if strings.HasPrefix(headerName, "x-ms-") {
			cm[headerName] = v // NOTE: the value must not have any whitespace around it.
		}
	}
	if len(cm) == 0 {
		return ""
	}

	keys := make([]string, 0, len(cm))
	for key := range cm {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	ch := bytes.NewBufferString("")
	for i, key := range keys {
		if i > 0 {
			ch.WriteRune('\n')
		}
		ch.WriteString(key)
		ch.WriteRune(':')
		ch.WriteString(strings.Join(cm[key], ","))
	}
	return ch.String()
}

func (f *SharedKeyCredential) buildCanonicalizedResource(u *url.URL) (string, error) {
	// https://docs.microsoft.com/en-us/rest/api/storageservices/authentication-for-the-azure-storage-services
	cr := bytes.NewBufferString("/")
	cr.WriteString(f.accountName)

	if len(u.Path) > 0 {
		// Any portion of the CanonicalizedResource string that is derived from
		// the resource's URI should be encoded exactly as it is in the URI.
		// -- https://msdn.microsoft.com/en-gb/library/azure/dd179428.aspx
		cr.WriteString(u.EscapedPath())
	} else {
		// a slash is required to indicate the root path
		cr.WriteString("/")
	}

	// params is a map[string][]string; param name is key; params values is []string
	params, err := url.ParseQuery(u.RawQuery) // Returns URL decoded values
	if err != nil {
		return "", errors.New("parsing query parameters must succeed, otherwise there might be serious problems in the SDK/generated code")
	}

	if len(params) > 0 { // There is at least 1 query parameter
		paramNames := []string{} // We use this to sort the parameter key names
		for paramName := range params {
			paramNames = append(paramNames, paramName) // paramNames must be lowercase
		}
		sort.Strings(paramNames)

		for _, paramName := range paramNames {
			paramValues := params[paramName]
			sort.Strings(paramValues)

			// Join the sorted key values separated by ','
			// Then prepend "keyName:"; then add this string to the buffer
			cr.WriteString("\n" + paramName + ":" + strings.Join(paramValues, ","))
		}
	}
	return cr.String(), nil
}
