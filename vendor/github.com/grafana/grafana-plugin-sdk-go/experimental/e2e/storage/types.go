package storage

import (
	"bytes"
	"net/http"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/utils"
)

// Entry represents a http.Request and http.Response pair.
type Entry struct {
	Request  *http.Request
	Response *http.Response
}

// Match compares the given http.Request with the stored http.Request and returns the stored http.Response if a match is found.
func (e *Entry) Match(incoming *http.Request) *http.Response {
	if e.Request.Method != incoming.Method {
		return nil
	}

	if e.Request.URL.String() != incoming.URL.String() {
		return nil
	}

	for name := range e.Request.Header {
		if e.Request.Header.Get(name) != incoming.Header.Get(name) {
			return nil
		}
	}

	if e.Request.Body == nil && incoming.Body == nil {
		return nil
	}

	entryRequestBody, err := utils.ReadRequestBody(e.Request)
	if err != nil {
		return nil
	}

	incomingBody, err := utils.ReadRequestBody(incoming)
	if err != nil {
		return nil
	}

	if !bytes.Equal(entryRequestBody, incomingBody) {
		return nil
	}

	return e.Response
}

// Storage is an interface for storing Entry objects.
type Storage interface {
	Add(*http.Request, *http.Response) error
	Delete(*http.Request) bool
	Entries() []*Entry
	Match(*http.Request) *http.Response
}

// file adds a read/write mutex to a file path.
type file struct {
	sync.RWMutex
	path string
}

// files allows multiple storage instances to hold read or write lock on a file.
type files struct {
	mu    sync.RWMutex
	files map[string]*file
}

// getOrAdd returns the file struct for the given path, or creates it if it does not exist.
func (f *files) getOrAdd(path string) *file {
	f.mu.RLock()
	if h, ok := f.files[path]; ok {
		f.mu.RUnlock()
		return h
	}
	f.mu.RUnlock()

	f.mu.Lock()
	defer f.mu.Unlock()

	if h, ok := f.files[path]; ok {
		return h
	}

	file := &file{path: path}
	f.files[path] = file
	return file
}

// rLock locks the HAR file for reading.
func (f *files) rLock(path string) {
	h := f.getOrAdd(path)
	h.RLock()
}

// rUnlock releases the read lock on the HAR file.
func (f *files) rUnlock(path string) {
	h := f.getOrAdd(path)
	h.RUnlock()
}

// lock locks the HAR file for writing.
func (f *files) lock(path string) {
	h := f.getOrAdd(path)
	h.Lock()
}

// unlock releases the write lock on the HAR file.
func (f *files) unlock(path string) {
	h := f.getOrAdd(path)
	h.Unlock()
}
