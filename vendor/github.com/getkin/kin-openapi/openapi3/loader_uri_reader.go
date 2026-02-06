package openapi3

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"sync"
)

// ReadFromURIFunc defines a function which reads the contents of a resource
// located at a URI.
type ReadFromURIFunc func(loader *Loader, url *url.URL) ([]byte, error)

var uriMu = &sync.RWMutex{}

// ErrURINotSupported indicates the ReadFromURIFunc does not know how to handle a
// given URI.
var ErrURINotSupported = errors.New("unsupported URI")

// ReadFromURIs returns a ReadFromURIFunc which tries to read a URI using the
// given reader functions, in the same order. If a reader function does not
// support the URI and returns ErrURINotSupported, the next function is checked
// until a match is found, or the URI is not supported by any.
func ReadFromURIs(readers ...ReadFromURIFunc) ReadFromURIFunc {
	return func(loader *Loader, url *url.URL) ([]byte, error) {
		for i := range readers {
			buf, err := readers[i](loader, url)
			if err == ErrURINotSupported {
				continue
			} else if err != nil {
				return nil, err
			}
			return buf, nil
		}
		return nil, ErrURINotSupported
	}
}

// DefaultReadFromURI returns a caching ReadFromURIFunc which can read remote
// HTTP URIs and local file URIs.
var DefaultReadFromURI = URIMapCache(ReadFromURIs(ReadFromHTTP(http.DefaultClient), ReadFromFile))

// ReadFromHTTP returns a ReadFromURIFunc which uses the given http.Client to
// read the contents from a remote HTTP URI. This client may be customized to
// implement timeouts, RFC 7234 caching, etc.
func ReadFromHTTP(cl *http.Client) ReadFromURIFunc {
	return func(loader *Loader, location *url.URL) ([]byte, error) {
		if location.Scheme == "" || location.Host == "" {
			return nil, ErrURINotSupported
		}
		req, err := http.NewRequest("GET", location.String(), nil)
		if err != nil {
			return nil, err
		}
		resp, err := cl.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		if resp.StatusCode > 399 {
			return nil, fmt.Errorf("error loading %q: request returned status code %d", location.String(), resp.StatusCode)
		}
		return io.ReadAll(resp.Body)
	}
}

func is_file(location *url.URL) bool {
	return location.Path != "" &&
		location.Host == "" &&
		(location.Scheme == "" || location.Scheme == "file")
}

// ReadFromFile is a ReadFromURIFunc which reads local file URIs.
func ReadFromFile(loader *Loader, location *url.URL) ([]byte, error) {
	if !is_file(location) {
		return nil, ErrURINotSupported
	}
	return os.ReadFile(path.Clean(filepath.FromSlash(location.Path)))
}

// URIMapCache returns a ReadFromURIFunc that caches the contents read from URI
// locations in a simple map. This cache implementation is suitable for
// short-lived processes such as command-line tools which process OpenAPI
// documents.
func URIMapCache(reader ReadFromURIFunc) ReadFromURIFunc {
	cache := map[string][]byte{}
	return func(loader *Loader, location *url.URL) (buf []byte, err error) {
		if location.Scheme == "" || location.Scheme == "file" {
			if !filepath.IsAbs(location.Path) {
				// Do not cache relative file paths; this can cause trouble if
				// the current working directory changes when processing
				// multiple top-level documents.
				return reader(loader, location)
			}
		}
		uri := location.String()
		var ok bool
		uriMu.RLock()
		if buf, ok = cache[uri]; ok {
			uriMu.RUnlock()
			return
		}
		uriMu.RUnlock()
		if buf, err = reader(loader, location); err != nil {
			return
		}
		uriMu.Lock()
		defer uriMu.Unlock()
		cache[uri] = buf
		return
	}
}
