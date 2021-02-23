// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package storage

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

// PostPolicyV4Options are used to construct a signed post policy.
// Please see https://cloud.google.com/storage/docs/xml-api/post-object
// for reference about the fields.
type PostPolicyV4Options struct {
	// GoogleAccessID represents the authorizer of the signed URL generation.
	// It is typically the Google service account client email address from
	// the Google Developers Console in the form of "xxx@developer.gserviceaccount.com".
	// Required.
	GoogleAccessID string

	// PrivateKey is the Google service account private key. It is obtainable
	// from the Google Developers Console.
	// At https://console.developers.google.com/project/<your-project-id>/apiui/credential,
	// create a service account client ID or reuse one of your existing service account
	// credentials. Click on the "Generate new P12 key" to generate and download
	// a new private key. Once you download the P12 file, use the following command
	// to convert it into a PEM file.
	//
	//    $ openssl pkcs12 -in key.p12 -passin pass:notasecret -out key.pem -nodes
	//
	// Provide the contents of the PEM file as a byte slice.
	// Exactly one of PrivateKey or SignBytes must be non-nil.
	PrivateKey []byte

	// SignBytes is a function for implementing custom signing. For example, if
	// your application is running on Google App Engine, you can use
	// appengine's internal signing function:
	//     ctx := appengine.NewContext(request)
	//     acc, _ := appengine.ServiceAccount(ctx)
	//     url, err := SignedURL("bucket", "object", &SignedURLOptions{
	//     	GoogleAccessID: acc,
	//     	SignBytes: func(b []byte) ([]byte, error) {
	//     		_, signedBytes, err := appengine.SignBytes(ctx, b)
	//     		return signedBytes, err
	//     	},
	//     	// etc.
	//     })
	//
	// Exactly one of PrivateKey or SignBytes must be non-nil.
	SignBytes func(hashBytes []byte) (signature []byte, err error)

	// Expires is the expiration time on the signed URL.
	// It must be a time in the future.
	// Required.
	Expires time.Time

	// Style provides options for the type of URL to use. Options are
	// PathStyle (default), BucketBoundHostname, and VirtualHostedStyle. See
	// https://cloud.google.com/storage/docs/request-endpoints for details.
	// Optional.
	Style URLStyle

	// Insecure when set indicates that the generated URL's scheme
	// will use "http" instead of "https" (default).
	// Optional.
	Insecure bool

	// Fields specifies the attributes of a PostPolicyV4 request.
	// When Fields is non-nil, its attributes must match those that will
	// passed into field Conditions.
	// Optional.
	Fields *PolicyV4Fields

	// The conditions that the uploaded file will be expected to conform to.
	// When used, the failure of an upload to satisfy a condition will result in
	// a 4XX status code, back with the message describing the problem.
	// Optional.
	Conditions []PostPolicyV4Condition
}

// PolicyV4Fields describes the attributes for a PostPolicyV4 request.
type PolicyV4Fields struct {
	// ACL specifies the access control permissions for the object.
	// Optional.
	ACL string
	// CacheControl specifies the caching directives for the object.
	// Optional.
	CacheControl string
	// ContentType specifies the media type of the object.
	// Optional.
	ContentType string
	// ContentDisposition specifies how the file will be served back to requesters.
	// Optional.
	ContentDisposition string
	// ContentEncoding specifies the decompressive transcoding that the object.
	// This field is complementary to ContentType in that the file could be
	// compressed but ContentType specifies the file's original media type.
	// Optional.
	ContentEncoding string
	// Metadata specifies custom metadata for the object.
	// If any key doesn't begin with "x-goog-meta-", an error will be returned.
	// Optional.
	Metadata map[string]string
	// StatusCodeOnSuccess when set, specifies the status code that Cloud Storage
	// will serve back on successful upload of the object.
	// Optional.
	StatusCodeOnSuccess int
	// RedirectToURLOnSuccess when set, specifies the URL that Cloud Storage
	// will serve back on successful upload of the object.
	// Optional.
	RedirectToURLOnSuccess string
}

// PostPolicyV4 describes the URL and respective form fields for a generated PostPolicyV4 request.
type PostPolicyV4 struct {
	// URL is the generated URL that the file upload will be made to.
	URL string
	// Fields specifies the generated key-values that the file uploader
	// must include in their multipart upload form.
	Fields map[string]string
}

// PostPolicyV4Condition describes the constraints that the subsequent
// object upload's multipart form fields will be expected to conform to.
type PostPolicyV4Condition interface {
	isEmpty() bool
	json.Marshaler
}

type startsWith struct {
	key, value string
}

func (sw *startsWith) MarshalJSON() ([]byte, error) {
	return json.Marshal([]string{"starts-with", sw.key, sw.value})
}
func (sw *startsWith) isEmpty() bool {
	return sw.value == ""
}

// ConditionStartsWith checks that an attributes starts with value.
// An empty value will cause this condition to be ignored.
func ConditionStartsWith(key, value string) PostPolicyV4Condition {
	return &startsWith{key, value}
}

type contentLengthRangeCondition struct {
	start, end uint64
}

func (clr *contentLengthRangeCondition) MarshalJSON() ([]byte, error) {
	return json.Marshal([]interface{}{"content-length-range", clr.start, clr.end})
}
func (clr *contentLengthRangeCondition) isEmpty() bool {
	return clr.start == 0 && clr.end == 0
}

type singleValueCondition struct {
	name, value string
}

func (svc *singleValueCondition) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{svc.name: svc.value})
}
func (svc *singleValueCondition) isEmpty() bool {
	return svc.value == ""
}

// ConditionContentLengthRange constraints the limits that the
// multipart upload's range header will be expected to be within.
func ConditionContentLengthRange(start, end uint64) PostPolicyV4Condition {
	return &contentLengthRangeCondition{start, end}
}

func conditionRedirectToURLOnSuccess(redirectURL string) PostPolicyV4Condition {
	return &singleValueCondition{"success_action_redirect", redirectURL}
}

func conditionStatusCodeOnSuccess(statusCode int) PostPolicyV4Condition {
	svc := &singleValueCondition{name: "success_action_status"}
	if statusCode > 0 {
		svc.value = fmt.Sprintf("%d", statusCode)
	}
	return svc
}

// GenerateSignedPostPolicyV4 generates a PostPolicyV4 value from bucket, object and opts.
// The generated URL and fields will then allow an unauthenticated client to perform multipart uploads.
func GenerateSignedPostPolicyV4(bucket, object string, opts *PostPolicyV4Options) (*PostPolicyV4, error) {
	if bucket == "" {
		return nil, errors.New("storage: bucket must be non-empty")
	}
	if object == "" {
		return nil, errors.New("storage: object must be non-empty")
	}
	now := utcNow()
	if err := validatePostPolicyV4Options(opts, now); err != nil {
		return nil, err
	}

	var signingFn func(hashedBytes []byte) ([]byte, error)
	switch {
	case opts.SignBytes != nil:
		signingFn = opts.SignBytes

	case len(opts.PrivateKey) != 0:
		parsedRSAPrivKey, err := parseKey(opts.PrivateKey)
		if err != nil {
			return nil, err
		}
		signingFn = func(hashedBytes []byte) ([]byte, error) {
			return rsa.SignPKCS1v15(rand.Reader, parsedRSAPrivKey, crypto.SHA256, hashedBytes)
		}

	default:
		return nil, errors.New("storage: exactly one of PrivateKey or SignedBytes must be set")
	}

	var descFields PolicyV4Fields
	if opts.Fields != nil {
		descFields = *opts.Fields
	}

	if err := validateMetadata(descFields.Metadata); err != nil {
		return nil, err
	}

	// Build the policy.
	conds := make([]PostPolicyV4Condition, len(opts.Conditions))
	copy(conds, opts.Conditions)
	conds = append(conds,
		// These are ordered lexicographically. Technically the order doesn't matter
		// for creating the policy, but we use this order to match the
		// cross-language conformance tests for this feature.
		&singleValueCondition{"acl", descFields.ACL},
		&singleValueCondition{"cache-control", descFields.CacheControl},
		&singleValueCondition{"content-disposition", descFields.ContentDisposition},
		&singleValueCondition{"content-encoding", descFields.ContentEncoding},
		&singleValueCondition{"content-type", descFields.ContentType},
		conditionRedirectToURLOnSuccess(descFields.RedirectToURLOnSuccess),
		conditionStatusCodeOnSuccess(descFields.StatusCodeOnSuccess),
	)

	YYYYMMDD := now.Format(yearMonthDay)
	policyFields := map[string]string{
		"key":                     object,
		"x-goog-date":             now.Format(iso8601),
		"x-goog-credential":       opts.GoogleAccessID + "/" + YYYYMMDD + "/auto/storage/goog4_request",
		"x-goog-algorithm":        "GOOG4-RSA-SHA256",
		"acl":                     descFields.ACL,
		"cache-control":           descFields.CacheControl,
		"content-disposition":     descFields.ContentDisposition,
		"content-encoding":        descFields.ContentEncoding,
		"content-type":            descFields.ContentType,
		"success_action_redirect": descFields.RedirectToURLOnSuccess,
	}
	for key, value := range descFields.Metadata {
		conds = append(conds, &singleValueCondition{key, value})
		policyFields[key] = value
	}

	// Following from the order expected by the conformance test cases,
	// hence manually inserting these fields in a specific order.
	conds = append(conds,
		&singleValueCondition{"bucket", bucket},
		&singleValueCondition{"key", object},
		&singleValueCondition{"x-goog-date", now.Format(iso8601)},
		&singleValueCondition{
			name:  "x-goog-credential",
			value: opts.GoogleAccessID + "/" + YYYYMMDD + "/auto/storage/goog4_request",
		},
		&singleValueCondition{"x-goog-algorithm", "GOOG4-RSA-SHA256"},
	)

	nonEmptyConds := make([]PostPolicyV4Condition, 0, len(opts.Conditions))
	for _, cond := range conds {
		if cond == nil || !cond.isEmpty() {
			nonEmptyConds = append(nonEmptyConds, cond)
		}
	}
	condsAsJSON, err := json.Marshal(map[string]interface{}{
		"conditions": nonEmptyConds,
		"expiration": opts.Expires.Format(time.RFC3339),
	})
	if err != nil {
		return nil, fmt.Errorf("storage: PostPolicyV4 JSON serialization failed: %v", err)
	}

	b64Policy := base64.StdEncoding.EncodeToString(condsAsJSON)
	shaSum := sha256.Sum256([]byte(b64Policy))
	signature, err := signingFn(shaSum[:])
	if err != nil {
		return nil, err
	}

	policyFields["policy"] = b64Policy
	policyFields["x-goog-signature"] = fmt.Sprintf("%x", signature)

	// Construct the URL.
	scheme := "https"
	if opts.Insecure {
		scheme = "http"
	}
	path := opts.Style.path(bucket, "") + "/"
	u := &url.URL{
		Path:    path,
		RawPath: pathEncodeV4(path),
		Host:    opts.Style.host(bucket),
		Scheme:  scheme,
	}

	if descFields.StatusCodeOnSuccess > 0 {
		policyFields["success_action_status"] = fmt.Sprintf("%d", descFields.StatusCodeOnSuccess)
	}

	// Clear out fields with blanks values.
	for key, value := range policyFields {
		if value == "" {
			delete(policyFields, key)
		}
	}
	pp4 := &PostPolicyV4{
		Fields: policyFields,
		URL:    u.String(),
	}
	return pp4, nil
}

// validatePostPolicyV4Options checks that:
// * GoogleAccessID is set
// * either but not both PrivateKey and SignBytes are set or nil, but not both
// * Expires, the deadline is not in the past
// * if Style is not set, it'll use PathStyle
func validatePostPolicyV4Options(opts *PostPolicyV4Options, now time.Time) error {
	if opts == nil || opts.GoogleAccessID == "" {
		return errors.New("storage: missing required GoogleAccessID")
	}
	if privBlank, signBlank := len(opts.PrivateKey) == 0, opts.SignBytes == nil; privBlank == signBlank {
		return errors.New("storage: exactly one of PrivateKey or SignedBytes must be set")
	}
	if opts.Expires.Before(now) {
		return errors.New("storage: expecting Expires to be in the future")
	}
	if opts.Style == nil {
		opts.Style = PathStyle()
	}
	return nil
}

// validateMetadata ensures that all keys passed in have a prefix of "x-goog-meta-",
// otherwise it will return an error.
func validateMetadata(hdrs map[string]string) (err error) {
	if len(hdrs) == 0 {
		return nil
	}

	badKeys := make([]string, 0, len(hdrs))
	for key := range hdrs {
		if !strings.HasPrefix(key, "x-goog-meta-") {
			badKeys = append(badKeys, key)
		}
	}
	if len(badKeys) != 0 {
		err = errors.New("storage: expected metadata to begin with x-goog-meta-, got " + strings.Join(badKeys, ", "))
	}
	return
}
