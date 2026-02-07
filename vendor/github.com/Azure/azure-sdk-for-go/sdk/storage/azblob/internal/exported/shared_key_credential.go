//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package exported

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync/atomic"
	"time"

	azlog "github.com/Azure/azure-sdk-for-go/sdk/azcore/log"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/log"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/shared"
)

// NewSharedKeyCredential creates an immutable SharedKeyCredential containing the
// storage account's name and either its primary or secondary key.
func NewSharedKeyCredential(accountName string, accountKey string) (*SharedKeyCredential, error) {
	c := SharedKeyCredential{accountName: accountName}
	if err := c.SetAccountKey(accountKey); err != nil {
		return nil, err
	}
	return &c, nil
}

// SharedKeyCredential contains an account's name and its primary or secondary key.
type SharedKeyCredential struct {
	// Only the NewSharedKeyCredential method should set these; all other methods should treat them as read-only
	accountName string
	accountKey  atomic.Value // []byte
}

// AccountName returns the Storage account's name.
func (c *SharedKeyCredential) AccountName() string {
	return c.accountName
}

// SetAccountKey replaces the existing account key with the specified account key.
func (c *SharedKeyCredential) SetAccountKey(accountKey string) error {
	_bytes, err := base64.StdEncoding.DecodeString(accountKey)
	if err != nil {
		return fmt.Errorf("decode account key: %w", err)
	}
	c.accountKey.Store(_bytes)
	return nil
}

// ComputeHMACSHA256 generates a hash signature for an HTTP request or for a SAS.
func (c *SharedKeyCredential) computeHMACSHA256(message string) (string, error) {
	h := hmac.New(sha256.New, c.accountKey.Load().([]byte))
	_, err := h.Write([]byte(message))
	return base64.StdEncoding.EncodeToString(h.Sum(nil)), err
}

func (c *SharedKeyCredential) buildStringToSign(req *http.Request) (string, error) {
	// https://docs.microsoft.com/en-us/rest/api/storageservices/authentication-for-the-azure-storage-services
	headers := req.Header
	contentLength := getHeader(shared.HeaderContentLength, headers)
	if contentLength == "0" {
		contentLength = ""
	}

	canonicalizedResource, err := c.buildCanonicalizedResource(req.URL)
	if err != nil {
		return "", err
	}

	stringToSign := strings.Join([]string{
		req.Method,
		getHeader(shared.HeaderContentEncoding, headers),
		getHeader(shared.HeaderContentLanguage, headers),
		contentLength,
		getHeader(shared.HeaderContentMD5, headers),
		getHeader(shared.HeaderContentType, headers),
		"", // Empty date because x-ms-date is expected (as per web page above)
		getHeader(shared.HeaderIfModifiedSince, headers),
		getHeader(shared.HeaderIfMatch, headers),
		getHeader(shared.HeaderIfNoneMatch, headers),
		getHeader(shared.HeaderIfUnmodifiedSince, headers),
		getHeader(shared.HeaderRange, headers),
		c.buildCanonicalizedHeader(headers),
		canonicalizedResource,
	}, "\n")
	return stringToSign, nil
}

func getHeader(key string, headers map[string][]string) string {
	if headers == nil {
		return ""
	}
	if v, ok := headers[key]; ok {
		if len(v) > 0 {
			return v[0]
		}
	}

	return ""
}

func getWeightTables() [][]int {
	tableLv0 := [...]int{
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x71c, 0x0, 0x71f, 0x721, 0x723, 0x725,
		0x0, 0x0, 0x0, 0x72d, 0x803, 0x0, 0x0, 0x733, 0x0, 0xd03, 0xd1a, 0xd1c, 0xd1e,
		0xd20, 0xd22, 0xd24, 0xd26, 0xd28, 0xd2a, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
		0xe02, 0xe09, 0xe0a, 0xe1a, 0xe21, 0xe23, 0xe25, 0xe2c, 0xe32, 0xe35, 0xe36, 0xe48, 0xe51,
		0xe70, 0xe7c, 0xe7e, 0xe89, 0xe8a, 0xe91, 0xe99, 0xe9f, 0xea2, 0xea4, 0xea6, 0xea7, 0xea9,
		0x0, 0x0, 0x0, 0x743, 0x744, 0x748, 0xe02, 0xe09, 0xe0a, 0xe1a, 0xe21, 0xe23, 0xe25,
		0xe2c, 0xe32, 0xe35, 0xe36, 0xe48, 0xe51, 0xe70, 0xe7c, 0xe7e, 0xe89, 0xe8a, 0xe91, 0xe99,
		0xe9f, 0xea2, 0xea4, 0xea6, 0xea7, 0xea9, 0x0, 0x74c, 0x0, 0x750, 0x0,
	}
	tableLv2 := [...]int{
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x8012, 0x0, 0x0, 0x0, 0x0, 0x0, 0x8212, 0x0, 0x0,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
	}
	tables := [][]int{tableLv0[:], tableLv2[:]}
	return tables
}

// NewHeaderStringComparer performs a multi-level, weight-based comparison of two strings
func compareHeaders(lhs, rhs string, tables [][]int) int {
	currLevel, i, j := 0, 0, 0
	n := len(tables)
	lhsLen := len(lhs)
	rhsLen := len(rhs)

	for currLevel < n {
		if currLevel == (n-1) && i != j {
			if i > j {
				return -1
			}
			if i < j {
				return 1
			}
			return 0
		}

		var w1, w2 int

		// Check bounds before accessing lhs[i]
		if i < lhsLen {
			w1 = tables[currLevel][lhs[i]]
		} else {
			w1 = 0x1
		}

		// Check bounds before accessing rhs[j]
		if j < rhsLen {
			w2 = tables[currLevel][rhs[j]]
		} else {
			w2 = 0x1
		}

		if w1 == 0x1 && w2 == 0x1 {
			i = 0
			j = 0
			currLevel++
		} else if w1 == w2 {
			i++
			j++
		} else if w1 == 0 {
			i++
		} else if w2 == 0 {
			j++
		} else {
			if w1 < w2 {
				return -1
			}
			if w1 > w2 {
				return 1
			}
			return 0
		}
	}
	return 0
}

func (c *SharedKeyCredential) buildCanonicalizedHeader(headers http.Header) string {
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
	tables := getWeightTables()
	// Sort the keys using the custom comparator
	sort.Slice(keys, func(i, j int) bool {
		return compareHeaders(keys[i], keys[j], tables) < 0
	})
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

func (c *SharedKeyCredential) buildCanonicalizedResource(u *url.URL) (string, error) {
	// https://docs.microsoft.com/en-us/rest/api/storageservices/authentication-for-the-azure-storage-services
	cr := bytes.NewBufferString("/")
	cr.WriteString(c.accountName)

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
		return "", fmt.Errorf("failed to parse query params: %w", err)
	}

	if len(params) > 0 { // There is at least 1 query parameter
		var paramNames []string // We use this to sort the parameter key names
		for paramName := range params {
			paramNames = append(paramNames, paramName) // paramNames must be lowercase
		}
		sort.Strings(paramNames)

		for _, paramName := range paramNames {
			paramValues := params[paramName]
			sort.Strings(paramValues)

			// Join the sorted key values separated by ','
			// Then prepend "keyName:"; then add this string to the buffer
			cr.WriteString("\n" + strings.ToLower(paramName) + ":" + strings.Join(paramValues, ","))
		}
	}
	return cr.String(), nil
}

// ComputeHMACSHA256 is a helper for computing the signed string outside of this package.
func ComputeHMACSHA256(cred *SharedKeyCredential, message string) (string, error) {
	return cred.computeHMACSHA256(message)
}

// the following content isn't actually exported but must live
// next to SharedKeyCredential as it uses its unexported methods

type SharedKeyCredPolicy struct {
	cred *SharedKeyCredential
}

func NewSharedKeyCredPolicy(cred *SharedKeyCredential) *SharedKeyCredPolicy {
	return &SharedKeyCredPolicy{cred: cred}
}

func (s *SharedKeyCredPolicy) Do(req *policy.Request) (*http.Response, error) {
	// skip adding the authorization header if no SharedKeyCredential was provided.
	// this prevents a panic that might be hard to diagnose and allows testing
	// against http endpoints that don't require authentication.
	if s.cred == nil {
		return req.Next()
	}

	if d := getHeader(shared.HeaderXmsDate, req.Raw().Header); d == "" {
		req.Raw().Header.Set(shared.HeaderXmsDate, time.Now().UTC().Format(http.TimeFormat))
	}
	stringToSign, err := s.cred.buildStringToSign(req.Raw())
	if err != nil {
		return nil, err
	}
	signature, err := s.cred.computeHMACSHA256(stringToSign)
	if err != nil {
		return nil, err
	}
	authHeader := strings.Join([]string{"SharedKey ", s.cred.AccountName(), ":", signature}, "")
	req.Raw().Header.Set(shared.HeaderAuthorization, authHeader)

	response, err := req.Next()
	if err != nil && response != nil && response.StatusCode == http.StatusForbidden {
		// Service failed to authenticate request, log it
		log.Write(azlog.EventResponse, "===== HTTP Forbidden status, String-to-Sign:\n"+stringToSign+"\n===============================\n")
	}
	return response, err
}
