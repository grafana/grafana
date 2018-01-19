// Copyright 2014 Google Inc. All Rights Reserved.
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
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"google.golang.org/api/option"
	htransport "google.golang.org/api/transport/http"

	"cloud.google.com/go/internal/optional"
	"cloud.google.com/go/internal/version"
	"golang.org/x/net/context"
	"google.golang.org/api/googleapi"
	raw "google.golang.org/api/storage/v1"
)

var (
	ErrBucketNotExist = errors.New("storage: bucket doesn't exist")
	ErrObjectNotExist = errors.New("storage: object doesn't exist")
)

const userAgent = "gcloud-golang-storage/20151204"

const (
	// ScopeFullControl grants permissions to manage your
	// data and permissions in Google Cloud Storage.
	ScopeFullControl = raw.DevstorageFullControlScope

	// ScopeReadOnly grants permissions to
	// view your data in Google Cloud Storage.
	ScopeReadOnly = raw.DevstorageReadOnlyScope

	// ScopeReadWrite grants permissions to manage your
	// data in Google Cloud Storage.
	ScopeReadWrite = raw.DevstorageReadWriteScope
)

var xGoogHeader = fmt.Sprintf("gl-go/%s gccl/%s", version.Go(), version.Repo)

func setClientHeader(headers http.Header) {
	headers.Set("x-goog-api-client", xGoogHeader)
}

// Client is a client for interacting with Google Cloud Storage.
//
// Clients should be reused instead of created as needed.
// The methods of Client are safe for concurrent use by multiple goroutines.
type Client struct {
	hc  *http.Client
	raw *raw.Service
}

// NewClient creates a new Google Cloud Storage client.
// The default scope is ScopeFullControl. To use a different scope, like ScopeReadOnly, use option.WithScopes.
func NewClient(ctx context.Context, opts ...option.ClientOption) (*Client, error) {
	o := []option.ClientOption{
		option.WithScopes(ScopeFullControl),
		option.WithUserAgent(userAgent),
	}
	opts = append(o, opts...)
	hc, ep, err := htransport.NewClient(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("dialing: %v", err)
	}
	rawService, err := raw.New(hc)
	if err != nil {
		return nil, fmt.Errorf("storage client: %v", err)
	}
	if ep != "" {
		rawService.BasePath = ep
	}
	return &Client{
		hc:  hc,
		raw: rawService,
	}, nil
}

// Close closes the Client.
//
// Close need not be called at program exit.
func (c *Client) Close() error {
	// Set fields to nil so that subsequent uses
	// will panic.
	c.hc = nil
	c.raw = nil
	return nil
}

// SignedURLOptions allows you to restrict the access to the signed URL.
type SignedURLOptions struct {
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

	// SignBytes is a function for implementing custom signing.
	// If your application is running on Google App Engine, you can use appengine's internal signing function:
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
	SignBytes func([]byte) ([]byte, error)

	// Method is the HTTP method to be used with the signed URL.
	// Signed URLs can be used with GET, HEAD, PUT, and DELETE requests.
	// Required.
	Method string

	// Expires is the expiration time on the signed URL. It must be
	// a datetime in the future.
	// Required.
	Expires time.Time

	// ContentType is the content type header the client must provide
	// to use the generated signed URL.
	// Optional.
	ContentType string

	// Headers is a list of extension headers the client must provide
	// in order to use the generated signed URL.
	// Optional.
	Headers []string

	// MD5 is the base64 encoded MD5 checksum of the file.
	// If provided, the client should provide the exact value on the request
	// header in order to use the signed URL.
	// Optional.
	MD5 string
}

var (
	canonicalHeaderRegexp    = regexp.MustCompile(`(?i)^(x-goog-[^:]+):(.*)?$`)
	excludedCanonicalHeaders = map[string]bool{
		"x-goog-encryption-key":        true,
		"x-goog-encryption-key-sha256": true,
	}
)

// sanitizeHeaders applies the specifications for canonical extension headers at
// https://cloud.google.com/storage/docs/access-control/signed-urls#about-canonical-extension-headers.
func sanitizeHeaders(hdrs []string) []string {
	headerMap := map[string][]string{}
	for _, hdr := range hdrs {
		// No leading or trailing whitespaces.
		sanitizedHeader := strings.TrimSpace(hdr)

		// Only keep canonical headers, discard any others.
		headerMatches := canonicalHeaderRegexp.FindStringSubmatch(sanitizedHeader)
		if len(headerMatches) == 0 {
			continue
		}

		header := strings.ToLower(strings.TrimSpace(headerMatches[1]))
		if excludedCanonicalHeaders[headerMatches[1]] {
			// Do not keep any deliberately excluded canonical headers when signing.
			continue
		}
		value := strings.TrimSpace(headerMatches[2])
		if len(value) > 0 {
			// Remove duplicate headers by appending the values of duplicates
			// in their order of appearance.
			headerMap[header] = append(headerMap[header], value)
		}
	}

	var sanitizedHeaders []string
	for header, values := range headerMap {
		// There should be no spaces around the colon separating the
		// header name from the header value or around the values
		// themselves. The values should be separated by commas.
		// NOTE: The semantics for headers without a value are not clear.
		//       However from specifications these should be edge-cases
		//       anyway and we should assume that there will be no
		//       canonical headers using empty values. Any such headers
		//       are discarded at the regexp stage above.
		sanitizedHeaders = append(
			sanitizedHeaders,
			fmt.Sprintf("%s:%s", header, strings.Join(values, ",")),
		)
	}
	sort.Strings(sanitizedHeaders)
	return sanitizedHeaders
}

// SignedURL returns a URL for the specified object. Signed URLs allow
// the users access to a restricted resource for a limited time without having a
// Google account or signing in. For more information about the signed
// URLs, see https://cloud.google.com/storage/docs/accesscontrol#Signed-URLs.
func SignedURL(bucket, name string, opts *SignedURLOptions) (string, error) {
	if opts == nil {
		return "", errors.New("storage: missing required SignedURLOptions")
	}
	if opts.GoogleAccessID == "" {
		return "", errors.New("storage: missing required GoogleAccessID")
	}
	if (opts.PrivateKey == nil) == (opts.SignBytes == nil) {
		return "", errors.New("storage: exactly one of PrivateKey or SignedBytes must be set")
	}
	if opts.Method == "" {
		return "", errors.New("storage: missing required method option")
	}
	if opts.Expires.IsZero() {
		return "", errors.New("storage: missing required expires option")
	}
	if opts.MD5 != "" {
		md5, err := base64.StdEncoding.DecodeString(opts.MD5)
		if err != nil || len(md5) != 16 {
			return "", errors.New("storage: invalid MD5 checksum")
		}
	}
	opts.Headers = sanitizeHeaders(opts.Headers)

	signBytes := opts.SignBytes
	if opts.PrivateKey != nil {
		key, err := parseKey(opts.PrivateKey)
		if err != nil {
			return "", err
		}
		signBytes = func(b []byte) ([]byte, error) {
			sum := sha256.Sum256(b)
			return rsa.SignPKCS1v15(
				rand.Reader,
				key,
				crypto.SHA256,
				sum[:],
			)
		}
	}

	u := &url.URL{
		Path: fmt.Sprintf("/%s/%s", bucket, name),
	}

	buf := &bytes.Buffer{}
	fmt.Fprintf(buf, "%s\n", opts.Method)
	fmt.Fprintf(buf, "%s\n", opts.MD5)
	fmt.Fprintf(buf, "%s\n", opts.ContentType)
	fmt.Fprintf(buf, "%d\n", opts.Expires.Unix())
	if len(opts.Headers) > 0 {
		fmt.Fprintf(buf, "%s\n", strings.Join(opts.Headers, "\n"))
	}
	fmt.Fprintf(buf, "%s", u.String())

	b, err := signBytes(buf.Bytes())
	if err != nil {
		return "", err
	}
	encoded := base64.StdEncoding.EncodeToString(b)
	u.Scheme = "https"
	u.Host = "storage.googleapis.com"
	q := u.Query()
	q.Set("GoogleAccessId", opts.GoogleAccessID)
	q.Set("Expires", fmt.Sprintf("%d", opts.Expires.Unix()))
	q.Set("Signature", string(encoded))
	u.RawQuery = q.Encode()
	return u.String(), nil
}

// ObjectHandle provides operations on an object in a Google Cloud Storage bucket.
// Use BucketHandle.Object to get a handle.
type ObjectHandle struct {
	c              *Client
	bucket         string
	object         string
	acl            ACLHandle
	gen            int64 // a negative value indicates latest
	conds          *Conditions
	encryptionKey  []byte // AES-256 key
	userProject    string // for requester-pays buckets
	readCompressed bool   // Accept-Encoding: gzip
}

// ACL provides access to the object's access control list.
// This controls who can read and write this object.
// This call does not perform any network operations.
func (o *ObjectHandle) ACL() *ACLHandle {
	return &o.acl
}

// Generation returns a new ObjectHandle that operates on a specific generation
// of the object.
// By default, the handle operates on the latest generation. Not
// all operations work when given a specific generation; check the API
// endpoints at https://cloud.google.com/storage/docs/json_api/ for details.
func (o *ObjectHandle) Generation(gen int64) *ObjectHandle {
	o2 := *o
	o2.gen = gen
	return &o2
}

// If returns a new ObjectHandle that applies a set of preconditions.
// Preconditions already set on the ObjectHandle are ignored.
// Operations on the new handle will only occur if the preconditions are
// satisfied. See https://cloud.google.com/storage/docs/generations-preconditions
// for more details.
func (o *ObjectHandle) If(conds Conditions) *ObjectHandle {
	o2 := *o
	o2.conds = &conds
	return &o2
}

// Key returns a new ObjectHandle that uses the supplied encryption
// key to encrypt and decrypt the object's contents.
//
// Encryption key must be a 32-byte AES-256 key.
// See https://cloud.google.com/storage/docs/encryption for details.
func (o *ObjectHandle) Key(encryptionKey []byte) *ObjectHandle {
	o2 := *o
	o2.encryptionKey = encryptionKey
	return &o2
}

// Attrs returns meta information about the object.
// ErrObjectNotExist will be returned if the object is not found.
func (o *ObjectHandle) Attrs(ctx context.Context) (*ObjectAttrs, error) {
	if err := o.validate(); err != nil {
		return nil, err
	}
	call := o.c.raw.Objects.Get(o.bucket, o.object).Projection("full").Context(ctx)
	if err := applyConds("Attrs", o.gen, o.conds, call); err != nil {
		return nil, err
	}
	if o.userProject != "" {
		call.UserProject(o.userProject)
	}
	if err := setEncryptionHeaders(call.Header(), o.encryptionKey, false); err != nil {
		return nil, err
	}
	var obj *raw.Object
	var err error
	setClientHeader(call.Header())
	err = runWithRetry(ctx, func() error { obj, err = call.Do(); return err })
	if e, ok := err.(*googleapi.Error); ok && e.Code == http.StatusNotFound {
		return nil, ErrObjectNotExist
	}
	if err != nil {
		return nil, err
	}
	return newObject(obj), nil
}

// Update updates an object with the provided attributes.
// All zero-value attributes are ignored.
// ErrObjectNotExist will be returned if the object is not found.
func (o *ObjectHandle) Update(ctx context.Context, uattrs ObjectAttrsToUpdate) (*ObjectAttrs, error) {
	if err := o.validate(); err != nil {
		return nil, err
	}
	var attrs ObjectAttrs
	// Lists of fields to send, and set to null, in the JSON.
	var forceSendFields, nullFields []string
	if uattrs.ContentType != nil {
		attrs.ContentType = optional.ToString(uattrs.ContentType)
		// For ContentType, sending the empty string is a no-op.
		// Instead we send a null.
		if attrs.ContentType == "" {
			nullFields = append(nullFields, "ContentType")
		} else {
			forceSendFields = append(forceSendFields, "ContentType")
		}
	}
	if uattrs.ContentLanguage != nil {
		attrs.ContentLanguage = optional.ToString(uattrs.ContentLanguage)
		// For ContentLanguage it's an error to send the empty string.
		// Instead we send a null.
		if attrs.ContentLanguage == "" {
			nullFields = append(nullFields, "ContentLanguage")
		} else {
			forceSendFields = append(forceSendFields, "ContentLanguage")
		}
	}
	if uattrs.ContentEncoding != nil {
		attrs.ContentEncoding = optional.ToString(uattrs.ContentEncoding)
		forceSendFields = append(forceSendFields, "ContentEncoding")
	}
	if uattrs.ContentDisposition != nil {
		attrs.ContentDisposition = optional.ToString(uattrs.ContentDisposition)
		forceSendFields = append(forceSendFields, "ContentDisposition")
	}
	if uattrs.CacheControl != nil {
		attrs.CacheControl = optional.ToString(uattrs.CacheControl)
		forceSendFields = append(forceSendFields, "CacheControl")
	}
	if uattrs.Metadata != nil {
		attrs.Metadata = uattrs.Metadata
		if len(attrs.Metadata) == 0 {
			// Sending the empty map is a no-op. We send null instead.
			nullFields = append(nullFields, "Metadata")
		} else {
			forceSendFields = append(forceSendFields, "Metadata")
		}
	}
	if uattrs.ACL != nil {
		attrs.ACL = uattrs.ACL
		// It's an error to attempt to delete the ACL, so
		// we don't append to nullFields here.
		forceSendFields = append(forceSendFields, "Acl")
	}
	rawObj := attrs.toRawObject(o.bucket)
	rawObj.ForceSendFields = forceSendFields
	rawObj.NullFields = nullFields
	call := o.c.raw.Objects.Patch(o.bucket, o.object, rawObj).Projection("full").Context(ctx)
	if err := applyConds("Update", o.gen, o.conds, call); err != nil {
		return nil, err
	}
	if o.userProject != "" {
		call.UserProject(o.userProject)
	}
	if err := setEncryptionHeaders(call.Header(), o.encryptionKey, false); err != nil {
		return nil, err
	}
	var obj *raw.Object
	var err error
	setClientHeader(call.Header())
	err = runWithRetry(ctx, func() error { obj, err = call.Do(); return err })
	if e, ok := err.(*googleapi.Error); ok && e.Code == http.StatusNotFound {
		return nil, ErrObjectNotExist
	}
	if err != nil {
		return nil, err
	}
	return newObject(obj), nil
}

// ObjectAttrsToUpdate is used to update the attributes of an object.
// Only fields set to non-nil values will be updated.
// Set a field to its zero value to delete it.
//
// For example, to change ContentType and delete ContentEncoding and
// Metadata, use
//    ObjectAttrsToUpdate{
//        ContentType: "text/html",
//        ContentEncoding: "",
//        Metadata: map[string]string{},
//    }
type ObjectAttrsToUpdate struct {
	ContentType        optional.String
	ContentLanguage    optional.String
	ContentEncoding    optional.String
	ContentDisposition optional.String
	CacheControl       optional.String
	Metadata           map[string]string // set to map[string]string{} to delete
	ACL                []ACLRule
}

// Delete deletes the single specified object.
func (o *ObjectHandle) Delete(ctx context.Context) error {
	if err := o.validate(); err != nil {
		return err
	}
	call := o.c.raw.Objects.Delete(o.bucket, o.object).Context(ctx)
	if err := applyConds("Delete", o.gen, o.conds, call); err != nil {
		return err
	}
	if o.userProject != "" {
		call.UserProject(o.userProject)
	}
	// Encryption doesn't apply to Delete.
	setClientHeader(call.Header())
	err := runWithRetry(ctx, func() error { return call.Do() })
	switch e := err.(type) {
	case nil:
		return nil
	case *googleapi.Error:
		if e.Code == http.StatusNotFound {
			return ErrObjectNotExist
		}
	}
	return err
}

// ReadCompressed when true causes the read to happen without decompressing.
func (o *ObjectHandle) ReadCompressed(compressed bool) *ObjectHandle {
	o2 := *o
	o2.readCompressed = compressed
	return &o2
}

// NewReader creates a new Reader to read the contents of the
// object.
// ErrObjectNotExist will be returned if the object is not found.
//
// The caller must call Close on the returned Reader when done reading.
func (o *ObjectHandle) NewReader(ctx context.Context) (*Reader, error) {
	return o.NewRangeReader(ctx, 0, -1)
}

// NewRangeReader reads part of an object, reading at most length bytes
// starting at the given offset. If length is negative, the object is read
// until the end.
func (o *ObjectHandle) NewRangeReader(ctx context.Context, offset, length int64) (*Reader, error) {
	if err := o.validate(); err != nil {
		return nil, err
	}
	if offset < 0 {
		return nil, fmt.Errorf("storage: invalid offset %d < 0", offset)
	}
	if o.conds != nil {
		if err := o.conds.validate("NewRangeReader"); err != nil {
			return nil, err
		}
	}
	u := &url.URL{
		Scheme:   "https",
		Host:     "storage.googleapis.com",
		Path:     fmt.Sprintf("/%s/%s", o.bucket, o.object),
		RawQuery: conditionsQuery(o.gen, o.conds),
	}
	verb := "GET"
	if length == 0 {
		verb = "HEAD"
	}
	req, err := http.NewRequest(verb, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req = withContext(req, ctx)
	if length < 0 && offset > 0 {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-", offset))
	} else if length > 0 {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", offset, offset+length-1))
	}
	if o.userProject != "" {
		req.Header.Set("X-Goog-User-Project", o.userProject)
	}
	if o.readCompressed {
		req.Header.Set("Accept-Encoding", "gzip")
	}
	if err := setEncryptionHeaders(req.Header, o.encryptionKey, false); err != nil {
		return nil, err
	}
	var res *http.Response
	err = runWithRetry(ctx, func() error {
		res, err = o.c.hc.Do(req)
		if err != nil {
			return err
		}
		if res.StatusCode == http.StatusNotFound {
			res.Body.Close()
			return ErrObjectNotExist
		}
		if res.StatusCode < 200 || res.StatusCode > 299 {
			body, _ := ioutil.ReadAll(res.Body)
			res.Body.Close()
			return &googleapi.Error{
				Code:   res.StatusCode,
				Header: res.Header,
				Body:   string(body),
			}
		}
		if offset > 0 && length != 0 && res.StatusCode != http.StatusPartialContent {
			res.Body.Close()
			return errors.New("storage: partial request not satisfied")
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	var size int64 // total size of object, even if a range was requested.
	if res.StatusCode == http.StatusPartialContent {
		cr := strings.TrimSpace(res.Header.Get("Content-Range"))
		if !strings.HasPrefix(cr, "bytes ") || !strings.Contains(cr, "/") {
			return nil, fmt.Errorf("storage: invalid Content-Range %q", cr)
		}
		size, err = strconv.ParseInt(cr[strings.LastIndex(cr, "/")+1:], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("storage: invalid Content-Range %q", cr)
		}
	} else {
		size = res.ContentLength
	}

	remain := res.ContentLength
	body := res.Body
	if length == 0 {
		remain = 0
		body.Close()
		body = emptyBody
	}
	var (
		checkCRC bool
		crc      uint32
	)
	// Even if there is a CRC header, we can't compute the hash on partial data.
	if remain == size {
		crc, checkCRC = parseCRC32c(res)
	}
	return &Reader{
		body:            body,
		size:            size,
		remain:          remain,
		contentType:     res.Header.Get("Content-Type"),
		contentEncoding: res.Header.Get("Content-Encoding"),
		cacheControl:    res.Header.Get("Cache-Control"),
		wantCRC:         crc,
		checkCRC:        checkCRC,
	}, nil
}

func parseCRC32c(res *http.Response) (uint32, bool) {
	const prefix = "crc32c="
	for _, spec := range res.Header["X-Goog-Hash"] {
		if strings.HasPrefix(spec, prefix) {
			c, err := decodeUint32(spec[len(prefix):])
			if err == nil {
				return c, true
			}
		}
	}
	return 0, false
}

var emptyBody = ioutil.NopCloser(strings.NewReader(""))

// NewWriter returns a storage Writer that writes to the GCS object
// associated with this ObjectHandle.
//
// A new object will be created unless an object with this name already exists.
// Otherwise any previous object with the same name will be replaced.
// The object will not be available (and any previous object will remain)
// until Close has been called.
//
// Attributes can be set on the object by modifying the returned Writer's
// ObjectAttrs field before the first call to Write. If no ContentType
// attribute is specified, the content type will be automatically sniffed
// using net/http.DetectContentType.
//
// It is the caller's responsibility to call Close when writing is done.
func (o *ObjectHandle) NewWriter(ctx context.Context) *Writer {
	return &Writer{
		ctx:         ctx,
		o:           o,
		donec:       make(chan struct{}),
		ObjectAttrs: ObjectAttrs{Name: o.object},
		ChunkSize:   googleapi.DefaultUploadChunkSize,
	}
}

func (o *ObjectHandle) validate() error {
	if o.bucket == "" {
		return errors.New("storage: bucket name is empty")
	}
	if o.object == "" {
		return errors.New("storage: object name is empty")
	}
	if !utf8.ValidString(o.object) {
		return fmt.Errorf("storage: object name %q is not valid UTF-8", o.object)
	}
	return nil
}

// parseKey converts the binary contents of a private key file to an
// *rsa.PrivateKey. It detects whether the private key is in a PEM container or
// not. If so, it extracts the private key from PEM container before
// conversion. It only supports PEM containers with no passphrase.
func parseKey(key []byte) (*rsa.PrivateKey, error) {
	if block, _ := pem.Decode(key); block != nil {
		key = block.Bytes
	}
	parsedKey, err := x509.ParsePKCS8PrivateKey(key)
	if err != nil {
		parsedKey, err = x509.ParsePKCS1PrivateKey(key)
		if err != nil {
			return nil, err
		}
	}
	parsed, ok := parsedKey.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("oauth2: private key is invalid")
	}
	return parsed, nil
}

func toRawObjectACL(oldACL []ACLRule) []*raw.ObjectAccessControl {
	var acl []*raw.ObjectAccessControl
	if len(oldACL) > 0 {
		acl = make([]*raw.ObjectAccessControl, len(oldACL))
		for i, rule := range oldACL {
			acl[i] = &raw.ObjectAccessControl{
				Entity: string(rule.Entity),
				Role:   string(rule.Role),
			}
		}
	}
	return acl
}

// toRawObject copies the editable attributes from o to the raw library's Object type.
func (o *ObjectAttrs) toRawObject(bucket string) *raw.Object {
	acl := toRawObjectACL(o.ACL)
	return &raw.Object{
		Bucket:             bucket,
		Name:               o.Name,
		ContentType:        o.ContentType,
		ContentEncoding:    o.ContentEncoding,
		ContentLanguage:    o.ContentLanguage,
		CacheControl:       o.CacheControl,
		ContentDisposition: o.ContentDisposition,
		StorageClass:       o.StorageClass,
		Acl:                acl,
		Metadata:           o.Metadata,
	}
}

// ObjectAttrs represents the metadata for a Google Cloud Storage (GCS) object.
type ObjectAttrs struct {
	// Bucket is the name of the bucket containing this GCS object.
	// This field is read-only.
	Bucket string

	// Name is the name of the object within the bucket.
	// This field is read-only.
	Name string

	// ContentType is the MIME type of the object's content.
	ContentType string

	// ContentLanguage is the content language of the object's content.
	ContentLanguage string

	// CacheControl is the Cache-Control header to be sent in the response
	// headers when serving the object data.
	CacheControl string

	// ACL is the list of access control rules for the object.
	ACL []ACLRule

	// Owner is the owner of the object. This field is read-only.
	//
	// If non-zero, it is in the form of "user-<userId>".
	Owner string

	// Size is the length of the object's content. This field is read-only.
	Size int64

	// ContentEncoding is the encoding of the object's content.
	ContentEncoding string

	// ContentDisposition is the optional Content-Disposition header of the object
	// sent in the response headers.
	ContentDisposition string

	// MD5 is the MD5 hash of the object's content. This field is read-only,
	// except when used from a Writer. If set on a Writer, the uploaded
	// data is rejected if its MD5 hash does not match this field.
	MD5 []byte

	// CRC32C is the CRC32 checksum of the object's content using
	// the Castagnoli93 polynomial. This field is read-only, except when
	// used from a Writer. If set on a Writer and Writer.SendCRC32C
	// is true, the uploaded data is rejected if its CRC32c hash does not
	// match this field.
	CRC32C uint32

	// MediaLink is an URL to the object's content. This field is read-only.
	MediaLink string

	// Metadata represents user-provided metadata, in key/value pairs.
	// It can be nil if no metadata is provided.
	Metadata map[string]string

	// Generation is the generation number of the object's content.
	// This field is read-only.
	Generation int64

	// Metageneration is the version of the metadata for this
	// object at this generation. This field is used for preconditions
	// and for detecting changes in metadata. A metageneration number
	// is only meaningful in the context of a particular generation
	// of a particular object. This field is read-only.
	Metageneration int64

	// StorageClass is the storage class of the object.
	// This value defines how objects in the bucket are stored and
	// determines the SLA and the cost of storage. Typical values are
	// "MULTI_REGIONAL", "REGIONAL", "NEARLINE", "COLDLINE", "STANDARD"
	// and "DURABLE_REDUCED_AVAILABILITY".
	// It defaults to "STANDARD", which is equivalent to "MULTI_REGIONAL"
	// or "REGIONAL" depending on the bucket's location settings.
	StorageClass string

	// Created is the time the object was created. This field is read-only.
	Created time.Time

	// Deleted is the time the object was deleted.
	// If not deleted, it is the zero value. This field is read-only.
	Deleted time.Time

	// Updated is the creation or modification time of the object.
	// For buckets with versioning enabled, changing an object's
	// metadata does not change this property. This field is read-only.
	Updated time.Time

	// CustomerKeySHA256 is the base64-encoded SHA-256 hash of the
	// customer-supplied encryption key for the object. It is empty if there is
	// no customer-supplied encryption key.
	// See // https://cloud.google.com/storage/docs/encryption for more about
	// encryption in Google Cloud Storage.
	CustomerKeySHA256 string

	// Prefix is set only for ObjectAttrs which represent synthetic "directory
	// entries" when iterating over buckets using Query.Delimiter. See
	// ObjectIterator.Next. When set, no other fields in ObjectAttrs will be
	// populated.
	Prefix string
}

// convertTime converts a time in RFC3339 format to time.Time.
// If any error occurs in parsing, the zero-value time.Time is silently returned.
func convertTime(t string) time.Time {
	var r time.Time
	if t != "" {
		r, _ = time.Parse(time.RFC3339, t)
	}
	return r
}

func newObject(o *raw.Object) *ObjectAttrs {
	if o == nil {
		return nil
	}
	acl := make([]ACLRule, len(o.Acl))
	for i, rule := range o.Acl {
		acl[i] = ACLRule{
			Entity: ACLEntity(rule.Entity),
			Role:   ACLRole(rule.Role),
		}
	}
	owner := ""
	if o.Owner != nil {
		owner = o.Owner.Entity
	}
	md5, _ := base64.StdEncoding.DecodeString(o.Md5Hash)
	crc32c, _ := decodeUint32(o.Crc32c)
	var sha256 string
	if o.CustomerEncryption != nil {
		sha256 = o.CustomerEncryption.KeySha256
	}
	return &ObjectAttrs{
		Bucket:             o.Bucket,
		Name:               o.Name,
		ContentType:        o.ContentType,
		ContentLanguage:    o.ContentLanguage,
		CacheControl:       o.CacheControl,
		ACL:                acl,
		Owner:              owner,
		ContentEncoding:    o.ContentEncoding,
		ContentDisposition: o.ContentDisposition,
		Size:               int64(o.Size),
		MD5:                md5,
		CRC32C:             crc32c,
		MediaLink:          o.MediaLink,
		Metadata:           o.Metadata,
		Generation:         o.Generation,
		Metageneration:     o.Metageneration,
		StorageClass:       o.StorageClass,
		CustomerKeySHA256:  sha256,
		Created:            convertTime(o.TimeCreated),
		Deleted:            convertTime(o.TimeDeleted),
		Updated:            convertTime(o.Updated),
	}
}

// Decode a uint32 encoded in Base64 in big-endian byte order.
func decodeUint32(b64 string) (uint32, error) {
	d, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return 0, err
	}
	if len(d) != 4 {
		return 0, fmt.Errorf("storage: %q does not encode a 32-bit value", d)
	}
	return uint32(d[0])<<24 + uint32(d[1])<<16 + uint32(d[2])<<8 + uint32(d[3]), nil
}

// Encode a uint32 as Base64 in big-endian byte order.
func encodeUint32(u uint32) string {
	b := []byte{byte(u >> 24), byte(u >> 16), byte(u >> 8), byte(u)}
	return base64.StdEncoding.EncodeToString(b)
}

// Query represents a query to filter objects from a bucket.
type Query struct {
	// Delimiter returns results in a directory-like fashion.
	// Results will contain only objects whose names, aside from the
	// prefix, do not contain delimiter. Objects whose names,
	// aside from the prefix, contain delimiter will have their name,
	// truncated after the delimiter, returned in prefixes.
	// Duplicate prefixes are omitted.
	// Optional.
	Delimiter string

	// Prefix is the prefix filter to query objects
	// whose names begin with this prefix.
	// Optional.
	Prefix string

	// Versions indicates whether multiple versions of the same
	// object will be included in the results.
	Versions bool
}

// contentTyper implements ContentTyper to enable an
// io.ReadCloser to specify its MIME type.
type contentTyper struct {
	io.Reader
	t string
}

func (c *contentTyper) ContentType() string {
	return c.t
}

// Conditions constrain methods to act on specific generations of
// objects.
//
// The zero value is an empty set of constraints. Not all conditions or
// combinations of conditions are applicable to all methods.
// See https://cloud.google.com/storage/docs/generations-preconditions
// for details on how these operate.
type Conditions struct {
	// Generation constraints.
	// At most one of the following can be set to a non-zero value.

	// GenerationMatch specifies that the object must have the given generation
	// for the operation to occur.
	// If GenerationMatch is zero, it has no effect.
	// Use DoesNotExist to specify that the object does not exist in the bucket.
	GenerationMatch int64

	// GenerationNotMatch specifies that the object must not have the given
	// generation for the operation to occur.
	// If GenerationNotMatch is zero, it has no effect.
	GenerationNotMatch int64

	// DoesNotExist specifies that the object must not exist in the bucket for
	// the operation to occur.
	// If DoesNotExist is false, it has no effect.
	DoesNotExist bool

	// Metadata generation constraints.
	// At most one of the following can be set to a non-zero value.

	// MetagenerationMatch specifies that the object must have the given
	// metageneration for the operation to occur.
	// If MetagenerationMatch is zero, it has no effect.
	MetagenerationMatch int64

	// MetagenerationNotMatch specifies that the object must not have the given
	// metageneration for the operation to occur.
	// If MetagenerationNotMatch is zero, it has no effect.
	MetagenerationNotMatch int64
}

func (c *Conditions) validate(method string) error {
	if *c == (Conditions{}) {
		return fmt.Errorf("storage: %s: empty conditions", method)
	}
	if !c.isGenerationValid() {
		return fmt.Errorf("storage: %s: multiple conditions specified for generation", method)
	}
	if !c.isMetagenerationValid() {
		return fmt.Errorf("storage: %s: multiple conditions specified for metageneration", method)
	}
	return nil
}

func (c *Conditions) isGenerationValid() bool {
	n := 0
	if c.GenerationMatch != 0 {
		n++
	}
	if c.GenerationNotMatch != 0 {
		n++
	}
	if c.DoesNotExist {
		n++
	}
	return n <= 1
}

func (c *Conditions) isMetagenerationValid() bool {
	return c.MetagenerationMatch == 0 || c.MetagenerationNotMatch == 0
}

// applyConds modifies the provided call using the conditions in conds.
// call is something that quacks like a *raw.WhateverCall.
func applyConds(method string, gen int64, conds *Conditions, call interface{}) error {
	cval := reflect.ValueOf(call)
	if gen >= 0 {
		if !setConditionField(cval, "Generation", gen) {
			return fmt.Errorf("storage: %s: generation not supported", method)
		}
	}
	if conds == nil {
		return nil
	}
	if err := conds.validate(method); err != nil {
		return err
	}
	switch {
	case conds.GenerationMatch != 0:
		if !setConditionField(cval, "IfGenerationMatch", conds.GenerationMatch) {
			return fmt.Errorf("storage: %s: ifGenerationMatch not supported", method)
		}
	case conds.GenerationNotMatch != 0:
		if !setConditionField(cval, "IfGenerationNotMatch", conds.GenerationNotMatch) {
			return fmt.Errorf("storage: %s: ifGenerationNotMatch not supported", method)
		}
	case conds.DoesNotExist:
		if !setConditionField(cval, "IfGenerationMatch", int64(0)) {
			return fmt.Errorf("storage: %s: DoesNotExist not supported", method)
		}
	}
	switch {
	case conds.MetagenerationMatch != 0:
		if !setConditionField(cval, "IfMetagenerationMatch", conds.MetagenerationMatch) {
			return fmt.Errorf("storage: %s: ifMetagenerationMatch not supported", method)
		}
	case conds.MetagenerationNotMatch != 0:
		if !setConditionField(cval, "IfMetagenerationNotMatch", conds.MetagenerationNotMatch) {
			return fmt.Errorf("storage: %s: ifMetagenerationNotMatch not supported", method)
		}
	}
	return nil
}

func applySourceConds(gen int64, conds *Conditions, call *raw.ObjectsRewriteCall) error {
	if gen >= 0 {
		call.SourceGeneration(gen)
	}
	if conds == nil {
		return nil
	}
	if err := conds.validate("CopyTo source"); err != nil {
		return err
	}
	switch {
	case conds.GenerationMatch != 0:
		call.IfSourceGenerationMatch(conds.GenerationMatch)
	case conds.GenerationNotMatch != 0:
		call.IfSourceGenerationNotMatch(conds.GenerationNotMatch)
	case conds.DoesNotExist:
		call.IfSourceGenerationMatch(0)
	}
	switch {
	case conds.MetagenerationMatch != 0:
		call.IfSourceMetagenerationMatch(conds.MetagenerationMatch)
	case conds.MetagenerationNotMatch != 0:
		call.IfSourceMetagenerationNotMatch(conds.MetagenerationNotMatch)
	}
	return nil
}

// setConditionField sets a field on a *raw.WhateverCall.
// We can't use anonymous interfaces because the return type is
// different, since the field setters are builders.
func setConditionField(call reflect.Value, name string, value interface{}) bool {
	m := call.MethodByName(name)
	if !m.IsValid() {
		return false
	}
	m.Call([]reflect.Value{reflect.ValueOf(value)})
	return true
}

// conditionsQuery returns the generation and conditions as a URL query
// string suitable for URL.RawQuery.  It assumes that the conditions
// have been validated.
func conditionsQuery(gen int64, conds *Conditions) string {
	// URL escapes are elided because integer strings are URL-safe.
	var buf []byte

	appendParam := func(s string, n int64) {
		if len(buf) > 0 {
			buf = append(buf, '&')
		}
		buf = append(buf, s...)
		buf = strconv.AppendInt(buf, n, 10)
	}

	if gen >= 0 {
		appendParam("generation=", gen)
	}
	if conds == nil {
		return string(buf)
	}
	switch {
	case conds.GenerationMatch != 0:
		appendParam("ifGenerationMatch=", conds.GenerationMatch)
	case conds.GenerationNotMatch != 0:
		appendParam("ifGenerationNotMatch=", conds.GenerationNotMatch)
	case conds.DoesNotExist:
		appendParam("ifGenerationMatch=", 0)
	}
	switch {
	case conds.MetagenerationMatch != 0:
		appendParam("ifMetagenerationMatch=", conds.MetagenerationMatch)
	case conds.MetagenerationNotMatch != 0:
		appendParam("ifMetagenerationNotMatch=", conds.MetagenerationNotMatch)
	}
	return string(buf)
}

// composeSourceObj wraps a *raw.ComposeRequestSourceObjects, but adds the methods
// that modifyCall searches for by name.
type composeSourceObj struct {
	src *raw.ComposeRequestSourceObjects
}

func (c composeSourceObj) Generation(gen int64) {
	c.src.Generation = gen
}

func (c composeSourceObj) IfGenerationMatch(gen int64) {
	// It's safe to overwrite ObjectPreconditions, since its only field is
	// IfGenerationMatch.
	c.src.ObjectPreconditions = &raw.ComposeRequestSourceObjectsObjectPreconditions{
		IfGenerationMatch: gen,
	}
}

func setEncryptionHeaders(headers http.Header, key []byte, copySource bool) error {
	if key == nil {
		return nil
	}
	// TODO(jbd): Ask the API team to return a more user-friendly error
	// and avoid doing this check at the client level.
	if len(key) != 32 {
		return errors.New("storage: not a 32-byte AES-256 key")
	}
	var cs string
	if copySource {
		cs = "copy-source-"
	}
	headers.Set("x-goog-"+cs+"encryption-algorithm", "AES256")
	headers.Set("x-goog-"+cs+"encryption-key", base64.StdEncoding.EncodeToString(key))
	keyHash := sha256.Sum256(key)
	headers.Set("x-goog-"+cs+"encryption-key-sha256", base64.StdEncoding.EncodeToString(keyHash[:]))
	return nil
}

// TODO(jbd): Add storage.objects.watch.
