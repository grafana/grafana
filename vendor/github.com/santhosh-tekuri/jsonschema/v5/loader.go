package jsonschema

import (
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

func loadFileURL(s string) (io.ReadCloser, error) {
	u, err := url.Parse(s)
	if err != nil {
		return nil, err
	}
	f := u.Path
	if runtime.GOOS == "windows" {
		f = strings.TrimPrefix(f, "/")
		f = filepath.FromSlash(f)
	}
	return os.Open(f)
}

// Loaders is a registry of functions, which know how to load
// absolute url of specific schema.
//
// New loaders can be registered by adding to this map. Key is schema,
// value is function that knows how to load url of that schema
var Loaders = map[string]func(url string) (io.ReadCloser, error){
	"file": loadFileURL,
}

// LoaderNotFoundError is the error type returned by Load function.
// It tells that no Loader is registered for that URL Scheme.
type LoaderNotFoundError string

func (e LoaderNotFoundError) Error() string {
	return fmt.Sprintf("jsonschema: no Loader found for %s", string(e))
}

// LoadURL loads document at given absolute URL. The default implementation
// uses Loaders registry to lookup by schema and uses that loader.
//
// Users can change this variable, if they would like to take complete
// responsibility of loading given URL. Used by Compiler if its LoadURL
// field is nil.
var LoadURL = func(s string) (io.ReadCloser, error) {
	u, err := url.Parse(s)
	if err != nil {
		return nil, err
	}
	loader, ok := Loaders[u.Scheme]
	if !ok {
		return nil, LoaderNotFoundError(s)

	}
	return loader(s)
}
