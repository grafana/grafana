package mock

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"

	"github.com/gorilla/mux"
)

// EndpointPattern models the GitHub's API endpoints
type EndpointPattern struct {
	Pattern string // eg. "/repos/{owner}/{repo}/actions/artifacts"
	Method  string // "GET", "POST", "PATCH", etc
}

// MockBackendOption is used to configure the *mux.router
// for the mocked backend
type MockBackendOption func(*mux.Router)

// FIFOResponseHandler handler implementation that
// responds to the HTTP requests following a FIFO approach.
//
// Once all available `Responses` have been used, this handler will panic()!
type FIFOResponseHandler struct {
	lock         sync.Mutex
	Responses    [][]byte
	CurrentIndex int
}

// ServeHTTP implementation of `http.Handler`
func (srh *FIFOResponseHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	srh.lock.Lock()
	defer srh.lock.Unlock()

	if srh.CurrentIndex == len(srh.Responses) {
		panic(fmt.Sprintf(
			"go-github-mock: no more mocks available for %s",
			r.URL.Path,
		))
	}

	defer func() {
		srh.CurrentIndex++
	}()

	w.Write(srh.Responses[srh.CurrentIndex])
}

// PaginatedResponseHandler handler implementation that
// responds to the HTTP requests and honors the pagination headers
//
//	Header e.g: `Link: <https://api.github.com/search/code?q=addClass+user%3Amozilla&page=15>; rel="next",
//	 <https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last",
//	 <https://api.github.com/search/code?q=addClass+user%3Amozilla&page=1>; rel="first",
//	 <https://api.github.com/search/code?q=addClass+user%3Amozilla&page=13>; rel="prev"`
//
// See: https://docs.github.com/en/rest/guides/traversing-with-pagination
type PaginatedResponseHandler struct {
	ResponsePages [][]byte
}

func (prh *PaginatedResponseHandler) getCurrentPage(r *http.Request) int {
	strPage := r.URL.Query().Get("page")

	if strPage == "" {
		return 1
	}

	page, err := strconv.Atoi(r.URL.Query().Get("page"))

	if err == nil {
		return page
	}

	// this should never happen as the request is being made by the SDK
	panic(fmt.Sprintf("invalid page: %s", strPage))
}

func (prh *PaginatedResponseHandler) generateLinkHeader(
	w http.ResponseWriter,
	r *http.Request,
) {
	currentPage := prh.getCurrentPage(r)
	lastPage := len(prh.ResponsePages)

	buf := bytes.NewBufferString(`<?page=1>; rel="first",`)
	buf.WriteString(fmt.Sprintf(`<?page=%d>; rel="last",`, lastPage))

	if currentPage < lastPage {
		// when resp.NextPage == 0, it means no more pages
		// which is basically as not setting it in the response
		buf.WriteString(fmt.Sprintf(`<?page=%d>; rel="next",`, currentPage+1))
	}

	if currentPage > 1 {
		buf.WriteString(fmt.Sprintf(`<?page=%d>; rel="prev",`, currentPage-1))
	}

	w.Header().Add("Link", buf.String())
}

// ServeHTTP implementation of `http.Handler`
func (prh *PaginatedResponseHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	prh.generateLinkHeader(w, r)
	w.Write(prh.ResponsePages[prh.getCurrentPage(r)-1])
}

// EnforceHostRoundTripper rewrites all requests with the given `Host`.
type EnforceHostRoundTripper struct {
	Host                 string
	UpstreamRoundTripper http.RoundTripper
}

// RoundTrip implementation of `http.RoundTripper`
func (efrt *EnforceHostRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) {
	splitHost := strings.Split(efrt.Host, "://")
	r.URL.Scheme = splitHost[0]
	r.URL.Host = splitHost[1]

	return efrt.UpstreamRoundTripper.RoundTrip(r)
}

// NewMockedHTTPClient creates and configures an http.Client that points to
// a mocked GitHub's backend API.
//
// Example:
//
// mockedHTTPClient := NewMockedHTTPClient(
//
//	WithRequestMatch(
//		GetUsersByUsername,
//		github.User{
//			Name: github.String("foobar"),
//		},
//	),
//	WithRequestMatch(
//		GetUsersOrgsByUsername,
//		[]github.Organization{
//			{
//				Name: github.String("foobar123thisorgwasmocked"),
//			},
//		},
//	),
//	WithRequestMatchHandler(
//		GetOrgsProjectsByOrg,
//		func(w http.ResponseWriter, _ *http.Request) {
//			w.Write(MustMarshal([]github.Project{
//				{
//					Name: github.String("mocked-proj-1"),
//				},
//				{
//					Name: github.String("mocked-proj-2"),
//				},
//			}))
//		},
//	),
//
// )
//
// c := github.NewClient(mockedHTTPClient)
func NewMockedHTTPClient(options ...MockBackendOption) *http.Client {
	router := mux.NewRouter()

	router.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		WriteError(
			w,
			http.StatusNotFound,
			fmt.Sprintf("mock response not found for %s", r.URL.Path),
		)
	})

	for _, o := range options {
		o(router)
	}

	mockServer := httptest.NewServer(router)

	c := mockServer.Client()

	c.Transport = &EnforceHostRoundTripper{
		Host:                 mockServer.URL,
		UpstreamRoundTripper: mockServer.Client().Transport,
	}

	return c
}
