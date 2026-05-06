package fixture

import (
	"bytes"
	"io"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/storage"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/utils"
)

type RequestProcessor func(req *http.Request) *http.Request
type ResponseProcessor func(res *http.Response) *http.Response
type Matcher func(b *http.Request) *http.Response
type Fixture struct {
	processRequest  RequestProcessor
	processResponse ResponseProcessor
	match           Matcher
	store           storage.Storage
}

// NewFixture creates a new Fixture.
func NewFixture(store storage.Storage) *Fixture {
	return &Fixture{
		processRequest:  DefaultProcessRequest,
		processResponse: DefaultProcessResponse,
		match:           store.Match,
		store:           store,
	}
}

// Add processes the http.Request and http.Response with the Fixture's RequestProcessor and ResponseProcessor and adds them to the Fixure's Storage.
func (f *Fixture) Add(originalReq *http.Request, originalRes *http.Response) error {
	req := f.processRequest(originalReq)
	res := f.processResponse(originalRes)
	defer res.Body.Close()
	return f.store.Add(req, res)
}

// Delete deletes the entry with the given ID from the Fixture's Storage.
func (f *Fixture) Delete(req *http.Request) bool {
	return f.store.Delete(req)
}

// Entries returns the entries from the Fixture's Storage.
func (f *Fixture) Entries() []*storage.Entry {
	return f.store.Entries()
}

// WithRequestProcessor sets the RequestProcessor for the Fixture.
func (f *Fixture) WithRequestProcessor(processRequest RequestProcessor) {
	f.processRequest = processRequest
}

// WithResponseProcessor sets the ResponseProcessor for the Fixture.
func (f *Fixture) WithResponseProcessor(processResponse ResponseProcessor) {
	f.processResponse = processResponse
}

// WithMatcher sets the Matcher for the Fixture.
// Note: Overriding the fixture's matcher will not affect the host matching behavior that can be configured in proxy.json.
func (f *Fixture) WithMatcher(matcher Matcher) {
	f.match = matcher
}

// Match compares incoming request to entries from the Fixture's Storage.
func (f *Fixture) Match(originalReq *http.Request) *http.Response {
	req := f.processRequest(originalReq)
	if res := f.match(req); res != nil {
		return f.processResponse(res)
	}
	return nil
}

// DefaultProcessRequest is a default implementation of ProcessRequest.
// It removes the Date, Cookie, Authorization, and User-Agent headers.
func DefaultProcessRequest(req *http.Request) *http.Request {
	processedReq := req.Clone(req.Context())
	processedReq.Header.Del("Date")
	processedReq.Header.Del("Coookie")
	processedReq.Header.Del("Authorization")
	processedReq.Header.Del("User-Agent")
	if processedReq.Body == nil {
		return processedReq
	}
	b, err := utils.ReadRequestBody(processedReq)
	if err != nil {
		return processedReq
	}
	req.Body = io.NopCloser(bytes.NewBuffer(b))
	return processedReq
}

// DefaultProcessResponse is a default implementation of ProcessResponse.
// It removes the Set-Cookie header from the response.
func DefaultProcessResponse(res *http.Response) *http.Response {
	res.Header.Del("Set-Cookie")
	return res
}
