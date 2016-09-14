// Package s3 signs HTTP requests for Amazon S3 and compatible services.
package s3

// See
// http://docs.amazonwebservices.com/AmazonS3/2006-03-01/dev/RESTAuthentication.html.

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"io"
	"net/http"
	"sort"
	"strings"
)

var signParams = map[string]bool{
	"acl":                          true,
	"delete":                       true,
	"lifecycle":                    true,
	"location":                     true,
	"logging":                      true,
	"notification":                 true,
	"partNumber":                   true,
	"policy":                       true,
	"requestPayment":               true,
	"response-cache-control":       true,
	"response-content-disposition": true,
	"response-content-encoding":    true,
	"response-content-language":    true,
	"response-content-type":        true,
	"response-expires":             true,
	"restore":                      true,
	"torrent":                      true,
	"uploadId":                     true,
	"uploads":                      true,
	"versionId":                    true,
	"versioning":                   true,
	"versions":                     true,
	"website":                      true,
}

// Keys holds a set of Amazon Security Credentials.
type Keys struct {
	AccessKey string
	SecretKey string

	// SecurityToken is used for temporary security credentials.
	// If set, it will be added to header field X-Amz-Security-Token
	// before signing a request.
	SecurityToken string
	// See http://docs.aws.amazon.com/AmazonS3/latest/dev/MakingRequests.html#TypesofSecurityCredentials
}

// IdentityBucket returns subdomain.
// It is designed to be used with S3-compatible services that
// treat the entire subdomain as the bucket name, for example
// storage.io.
func IdentityBucket(subdomain string) string {
	return subdomain
}

// AmazonBucket returns everything up to the last '.' in subdomain.
// It is designed to be used with the Amazon service.
//   "johnsmith.s3"           becomes "johnsmith"
//   "johnsmith.s3-eu-west-1" becomes "johnsmith"
//   "www.example.com.s3"     becomes "www.example.com"
func AmazonBucket(subdomain string) string {
	if i := strings.LastIndex(subdomain, "."); i != -1 {
		return subdomain[:i]
	}
	return ""
}

// DefaultService is the default Service used by Sign.
var DefaultService = &Service{Domain: "amazonaws.com"}

// Sign signs an HTTP request with the given S3 keys.
//
// This function is a wrapper around DefaultService.Sign.
func Sign(r *http.Request, k Keys) {
	DefaultService.Sign(r, k)
}

// Service represents an S3-compatible service.
type Service struct {
	// Domain is the service's root domain. It is used to extract
	// the subdomain from an http.Request before passing the
	// subdomain to Bucket.
	Domain string

	// Bucket derives the bucket name from a subdomain.
	// If nil, AmazonBucket is used.
	Bucket func(subdomain string) string
}

// Sign signs an HTTP request with the given S3 keys for use on service s.
func (s *Service) Sign(r *http.Request, k Keys) {
	if k.SecurityToken != "" {
		r.Header.Set("X-Amz-Security-Token", k.SecurityToken)
	}
	h := hmac.New(sha1.New, []byte(k.SecretKey))
	s.writeSigData(h, r)
	sig := make([]byte, base64.StdEncoding.EncodedLen(h.Size()))
	base64.StdEncoding.Encode(sig, h.Sum(nil))
	r.Header.Set("Authorization", "AWS "+k.AccessKey+":"+string(sig))
}

func (s *Service) writeSigData(w io.Writer, r *http.Request) {
	w.Write([]byte(r.Method))
	w.Write([]byte{'\n'})
	w.Write([]byte(r.Header.Get("content-md5")))
	w.Write([]byte{'\n'})
	w.Write([]byte(r.Header.Get("content-type")))
	w.Write([]byte{'\n'})
	if _, ok := r.Header["X-Amz-Date"]; !ok {
		w.Write([]byte(r.Header.Get("date")))
	}
	w.Write([]byte{'\n'})
	writeAmzHeaders(w, r)
	s.writeResource(w, r)
}

func (s *Service) writeResource(w io.Writer, r *http.Request) {
	s.writeVhostBucket(w, strings.ToLower(r.Host))
	path := r.URL.RequestURI()
	if r.URL.RawQuery != "" {
		path = path[:len(path)-len(r.URL.RawQuery)-1]
	}
	w.Write([]byte(path))
	s.writeSubResource(w, r)
}

func (s *Service) writeVhostBucket(w io.Writer, host string) {
	if i := strings.Index(host, ":"); i != -1 {
		host = host[:i]
	}

	if host == s.Domain {
		// no vhost - do nothing
	} else if strings.HasSuffix(host, "."+s.Domain) {
		// vhost - bucket may be in prefix
		b := s.Bucket
		if b == nil {
			b = AmazonBucket
		}
		bucket := b(host[:len(host)-len(s.Domain)-1])

		if bucket != "" {
			w.Write([]byte{'/'})
			w.Write([]byte(bucket))
		}
	} else {
		// cname - bucket is host
		w.Write([]byte{'/'})
		w.Write([]byte(host))
	}
}

func (s *Service) writeSubResource(w io.Writer, r *http.Request) {
	var a []string
	for k, vs := range r.URL.Query() {
		if signParams[k] {
			for _, v := range vs {
				if v == "" {
					a = append(a, k)
				} else {
					a = append(a, k+"="+v)
				}
			}
		}
	}
	sort.Strings(a)
	var p byte = '?'
	for _, s := range a {
		w.Write([]byte{p})
		w.Write([]byte(s))
		p = '&'
	}
}

func writeAmzHeaders(w io.Writer, r *http.Request) {
	var keys []string
	for k, _ := range r.Header {
		if strings.HasPrefix(strings.ToLower(k), "x-amz-") {
			keys = append(keys, k)
		}
	}

	sort.Strings(keys)
	var a []string
	for _, k := range keys {
		v := r.Header[k]
		a = append(a, strings.ToLower(k)+":"+strings.Join(v, ","))
	}
	for _, h := range a {
		w.Write([]byte(h))
		w.Write([]byte{'\n'})
	}
}
