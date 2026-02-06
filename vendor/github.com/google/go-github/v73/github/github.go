// Copyright 2013 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:generate go run gen-accessors.go
//go:generate go run gen-stringify-test.go
//go:generate ../script/metadata.sh update-go

package github

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/go-querystring/query"
)

const (
	Version = "v73.0.0"

	defaultAPIVersion = "2022-11-28"
	defaultBaseURL    = "https://api.github.com/"
	defaultUserAgent  = "go-github" + "/" + Version
	uploadBaseURL     = "https://uploads.github.com/"

	headerAPIVersion    = "X-Github-Api-Version"
	headerRateLimit     = "X-Ratelimit-Limit"
	headerRateRemaining = "X-Ratelimit-Remaining"
	headerRateUsed      = "X-Ratelimit-Used"
	headerRateReset     = "X-Ratelimit-Reset"
	headerRateResource  = "X-Ratelimit-Resource"
	headerOTP           = "X-Github-Otp"
	headerRetryAfter    = "Retry-After"

	headerTokenExpiration = "Github-Authentication-Token-Expiration"

	mediaTypeV3                = "application/vnd.github.v3+json"
	defaultMediaType           = "application/octet-stream"
	mediaTypeV3SHA             = "application/vnd.github.v3.sha"
	mediaTypeV3Diff            = "application/vnd.github.v3.diff"
	mediaTypeV3Patch           = "application/vnd.github.v3.patch"
	mediaTypeOrgPermissionRepo = "application/vnd.github.v3.repository+json"
	mediaTypeIssueImportAPI    = "application/vnd.github.golden-comet-preview+json"
	mediaTypeStarring          = "application/vnd.github.star+json"

	// Media Type values to access preview APIs
	// These media types will be added to the API request as headers
	// and used to enable particular features on GitHub API that are still in preview.
	// After some time, specific media types will be promoted (to a "stable" state).
	// From then on, the preview headers are not required anymore to activate the additional
	// feature on GitHub.com's API. However, this API header might still be needed for users
	// to run a GitHub Enterprise Server on-premise.
	// It's not uncommon for GitHub Enterprise Server customers to run older versions which
	// would probably rely on the preview headers for some time.
	// While the header promotion is going out for GitHub.com, it may be some time before it
	// even arrives in GitHub Enterprise Server.
	// We keep those preview headers around to avoid breaking older GitHub Enterprise Server
	// versions. Additionally, non-functional (preview) headers don't create any side effects
	// on GitHub Cloud version.
	//
	// See https://github.com/google/go-github/pull/2125 for full context.

	// https://help.github.com/enterprise/2.4/admin/guides/migrations/exporting-the-github-com-organization-s-repositories/
	mediaTypeMigrationsPreview = "application/vnd.github.wyandotte-preview+json"

	// https://developer.github.com/changes/2016-04-06-deployment-and-deployment-status-enhancements/
	mediaTypeDeploymentStatusPreview = "application/vnd.github.ant-man-preview+json"

	// https://developer.github.com/changes/2018-10-16-deployments-environments-states-and-auto-inactive-updates/
	mediaTypeExpandDeploymentStatusPreview = "application/vnd.github.flash-preview+json"

	// https://developer.github.com/changes/2016-05-12-reactions-api-preview/
	mediaTypeReactionsPreview = "application/vnd.github.squirrel-girl-preview"

	// https://developer.github.com/changes/2016-05-23-timeline-preview-api/
	mediaTypeTimelinePreview = "application/vnd.github.mockingbird-preview+json"

	// https://developer.github.com/changes/2016-09-14-projects-api/
	mediaTypeProjectsPreview = "application/vnd.github.inertia-preview+json"

	// https://developer.github.com/changes/2017-01-05-commit-search-api/
	mediaTypeCommitSearchPreview = "application/vnd.github.cloak-preview+json"

	// https://developer.github.com/changes/2017-02-28-user-blocking-apis-and-webhook/
	mediaTypeBlockUsersPreview = "application/vnd.github.giant-sentry-fist-preview+json"

	// https://developer.github.com/changes/2017-05-23-coc-api/
	mediaTypeCodesOfConductPreview = "application/vnd.github.scarlet-witch-preview+json"

	// https://developer.github.com/changes/2017-07-17-update-topics-on-repositories/
	mediaTypeTopicsPreview = "application/vnd.github.mercy-preview+json"

	// https://developer.github.com/changes/2018-03-16-protected-branches-required-approving-reviews/
	mediaTypeRequiredApprovingReviewsPreview = "application/vnd.github.luke-cage-preview+json"

	// https://developer.github.com/changes/2018-05-07-new-checks-api-public-beta/
	mediaTypeCheckRunsPreview = "application/vnd.github.antiope-preview+json"

	// https://developer.github.com/enterprise/2.13/v3/repos/pre_receive_hooks/
	mediaTypePreReceiveHooksPreview = "application/vnd.github.eye-scream-preview"

	// https://developer.github.com/changes/2018-02-22-protected-branches-required-signatures/
	mediaTypeSignaturePreview = "application/vnd.github.zzzax-preview+json"

	// https://developer.github.com/changes/2018-09-05-project-card-events/
	mediaTypeProjectCardDetailsPreview = "application/vnd.github.starfox-preview+json"

	// https://developer.github.com/changes/2018-12-18-interactions-preview/
	mediaTypeInteractionRestrictionsPreview = "application/vnd.github.sombra-preview+json"

	// https://developer.github.com/changes/2019-03-14-enabling-disabling-pages/
	mediaTypeEnablePagesAPIPreview = "application/vnd.github.switcheroo-preview+json"

	// https://developer.github.com/changes/2019-04-24-vulnerability-alerts/
	mediaTypeRequiredVulnerabilityAlertsPreview = "application/vnd.github.dorian-preview+json"

	// https://developer.github.com/changes/2019-05-29-update-branch-api/
	mediaTypeUpdatePullRequestBranchPreview = "application/vnd.github.lydian-preview+json"

	// https://developer.github.com/changes/2019-04-11-pulls-branches-for-commit/
	mediaTypeListPullsOrBranchesForCommitPreview = "application/vnd.github.groot-preview+json"

	// https://docs.github.com/rest/previews/#repository-creation-permissions
	mediaTypeMemberAllowedRepoCreationTypePreview = "application/vnd.github.surtur-preview+json"

	// https://docs.github.com/rest/previews/#create-and-use-repository-templates
	mediaTypeRepositoryTemplatePreview = "application/vnd.github.baptiste-preview+json"

	// https://developer.github.com/changes/2019-10-03-multi-line-comments/
	mediaTypeMultiLineCommentsPreview = "application/vnd.github.comfort-fade-preview+json"

	// https://developer.github.com/changes/2019-11-05-deprecated-passwords-and-authorizations-api/
	mediaTypeOAuthAppPreview = "application/vnd.github.doctor-strange-preview+json"

	// https://developer.github.com/changes/2019-12-03-internal-visibility-changes/
	mediaTypeRepositoryVisibilityPreview = "application/vnd.github.nebula-preview+json"

	// https://developer.github.com/changes/2018-12-10-content-attachments-api/
	mediaTypeContentAttachmentsPreview = "application/vnd.github.corsair-preview+json"
)

var errNonNilContext = errors.New("context must be non-nil")

// A Client manages communication with the GitHub API.
type Client struct {
	clientMu              sync.Mutex   // clientMu protects the client during calls that modify the CheckRedirect func.
	client                *http.Client // HTTP client used to communicate with the API.
	clientIgnoreRedirects *http.Client // HTTP client used to communicate with the API on endpoints where we don't want to follow redirects.

	// Base URL for API requests. Defaults to the public GitHub API, but can be
	// set to a domain endpoint to use with GitHub Enterprise. BaseURL should
	// always be specified with a trailing slash.
	BaseURL *url.URL

	// Base URL for uploading files.
	UploadURL *url.URL

	// User agent used when communicating with the GitHub API.
	UserAgent string

	rateMu                  sync.Mutex
	rateLimits              [Categories]Rate // Rate limits for the client as determined by the most recent API calls.
	secondaryRateLimitReset time.Time        // Secondary rate limit reset for the client as determined by the most recent API calls.

	// If specified, Client will block requests for at most this duration in case of reaching a secondary
	// rate limit
	MaxSecondaryRateLimitRetryAfterDuration time.Duration

	// Whether to respect rate limit headers on endpoints that return 302 redirections to artifacts
	RateLimitRedirectionalEndpoints bool

	common service // Reuse a single struct instead of allocating one for each service on the heap.

	// Services used for talking to different parts of the GitHub API.
	Actions            *ActionsService
	Activity           *ActivityService
	Admin              *AdminService
	Apps               *AppsService
	Authorizations     *AuthorizationsService
	Billing            *BillingService
	Checks             *ChecksService
	CodeScanning       *CodeScanningService
	CodesOfConduct     *CodesOfConductService
	Codespaces         *CodespacesService
	Copilot            *CopilotService
	Dependabot         *DependabotService
	DependencyGraph    *DependencyGraphService
	Emojis             *EmojisService
	Enterprise         *EnterpriseService
	Gists              *GistsService
	Git                *GitService
	Gitignores         *GitignoresService
	Interactions       *InteractionsService
	IssueImport        *IssueImportService
	Issues             *IssuesService
	Licenses           *LicensesService
	Markdown           *MarkdownService
	Marketplace        *MarketplaceService
	Meta               *MetaService
	Migrations         *MigrationService
	Organizations      *OrganizationsService
	PullRequests       *PullRequestsService
	RateLimit          *RateLimitService
	Reactions          *ReactionsService
	Repositories       *RepositoriesService
	SCIM               *SCIMService
	Search             *SearchService
	SecretScanning     *SecretScanningService
	SecurityAdvisories *SecurityAdvisoriesService
	SubIssue           *SubIssueService
	Teams              *TeamsService
	Users              *UsersService
}

type service struct {
	client *Client
}

// Client returns the http.Client used by this GitHub client.
// This should only be used for requests to the GitHub API because
// request headers will contain an authorization token.
func (c *Client) Client() *http.Client {
	c.clientMu.Lock()
	defer c.clientMu.Unlock()
	clientCopy := *c.client
	return &clientCopy
}

// ListOptions specifies the optional parameters to various List methods that
// support offset pagination.
type ListOptions struct {
	// For paginated result sets, page of results to retrieve.
	Page int `url:"page,omitempty"`

	// For paginated result sets, the number of results to include per page.
	PerPage int `url:"per_page,omitempty"`
}

// ListCursorOptions specifies the optional parameters to various List methods that
// support cursor pagination.
type ListCursorOptions struct {
	// For paginated result sets, page of results to retrieve.
	Page string `url:"page,omitempty"`

	// For paginated result sets, the number of results to include per page.
	PerPage int `url:"per_page,omitempty"`

	// For paginated result sets, the number of results per page (max 100), starting from the first matching result.
	// This parameter must not be used in combination with last.
	First int `url:"first,omitempty"`

	// For paginated result sets, the number of results per page (max 100), starting from the last matching result.
	// This parameter must not be used in combination with first.
	Last int `url:"last,omitempty"`

	// A cursor, as given in the Link header. If specified, the query only searches for events after this cursor.
	After string `url:"after,omitempty"`

	// A cursor, as given in the Link header. If specified, the query only searches for events before this cursor.
	Before string `url:"before,omitempty"`

	// A cursor, as given in the Link header. If specified, the query continues the search using this cursor.
	Cursor string `url:"cursor,omitempty"`
}

// UploadOptions specifies the parameters to methods that support uploads.
type UploadOptions struct {
	Name      string `url:"name,omitempty"`
	Label     string `url:"label,omitempty"`
	MediaType string `url:"-"`
}

// RawType represents type of raw format of a request instead of JSON.
type RawType uint8

const (
	// Diff format.
	Diff RawType = 1 + iota
	// Patch format.
	Patch
)

// RawOptions specifies parameters when user wants to get raw format of
// a response instead of JSON.
type RawOptions struct {
	Type RawType
}

// addOptions adds the parameters in opts as URL query parameters to s. opts
// must be a struct whose fields may contain "url" tags.
func addOptions(s string, opts any) (string, error) {
	v := reflect.ValueOf(opts)
	if v.Kind() == reflect.Ptr && v.IsNil() {
		return s, nil
	}

	u, err := url.Parse(s)
	if err != nil {
		return s, err
	}

	qs, err := query.Values(opts)
	if err != nil {
		return s, err
	}

	u.RawQuery = qs.Encode()
	return u.String(), nil
}

// NewClient returns a new GitHub API client. If a nil httpClient is
// provided, a new http.Client will be used. To use API methods which require
// authentication, either use Client.WithAuthToken or provide NewClient with
// an http.Client that will perform the authentication for you (such as that
// provided by the golang.org/x/oauth2 library).
func NewClient(httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = &http.Client{}
	}
	httpClient2 := *httpClient
	c := &Client{client: &httpClient2}
	c.initialize()
	return c
}

// WithAuthToken returns a copy of the client configured to use the provided token for the Authorization header.
func (c *Client) WithAuthToken(token string) *Client {
	c2 := c.copy()
	defer c2.initialize()
	transport := c2.client.Transport
	if transport == nil {
		transport = http.DefaultTransport
	}
	c2.client.Transport = roundTripperFunc(
		func(req *http.Request) (*http.Response, error) {
			req = req.Clone(req.Context())
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
			return transport.RoundTrip(req)
		},
	)
	return c2
}

// WithEnterpriseURLs returns a copy of the client configured to use the provided base and
// upload URLs. If the base URL does not have the suffix "/api/v3/", it will be added
// automatically. If the upload URL does not have the suffix "/api/uploads", it will be
// added automatically.
//
// Note that WithEnterpriseURLs is a convenience helper only;
// its behavior is equivalent to setting the BaseURL and UploadURL fields.
//
// Another important thing is that by default, the GitHub Enterprise URL format
// should be http(s)://[hostname]/api/v3/ or you will always receive the 406 status code.
// The upload URL format should be http(s)://[hostname]/api/uploads/.
func (c *Client) WithEnterpriseURLs(baseURL, uploadURL string) (*Client, error) {
	c2 := c.copy()
	defer c2.initialize()
	var err error
	c2.BaseURL, err = url.Parse(baseURL)
	if err != nil {
		return nil, err
	}

	if !strings.HasSuffix(c2.BaseURL.Path, "/") {
		c2.BaseURL.Path += "/"
	}
	if !strings.HasSuffix(c2.BaseURL.Path, "/api/v3/") &&
		!strings.HasPrefix(c2.BaseURL.Host, "api.") &&
		!strings.Contains(c2.BaseURL.Host, ".api.") {
		c2.BaseURL.Path += "api/v3/"
	}

	c2.UploadURL, err = url.Parse(uploadURL)
	if err != nil {
		return nil, err
	}

	if !strings.HasSuffix(c2.UploadURL.Path, "/") {
		c2.UploadURL.Path += "/"
	}
	if !strings.HasSuffix(c2.UploadURL.Path, "/api/uploads/") &&
		!strings.HasPrefix(c2.UploadURL.Host, "api.") &&
		!strings.Contains(c2.UploadURL.Host, ".api.") {
		c2.UploadURL.Path += "api/uploads/"
	}
	return c2, nil
}

// initialize sets default values and initializes services.
func (c *Client) initialize() {
	if c.client == nil {
		c.client = &http.Client{}
	}
	// Copy the main http client into the IgnoreRedirects one, overriding the `CheckRedirect` func
	c.clientIgnoreRedirects = &http.Client{}
	c.clientIgnoreRedirects.Transport = c.client.Transport
	c.clientIgnoreRedirects.Timeout = c.client.Timeout
	c.clientIgnoreRedirects.Jar = c.client.Jar
	c.clientIgnoreRedirects.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	}
	if c.BaseURL == nil {
		c.BaseURL, _ = url.Parse(defaultBaseURL)
	}
	if c.UploadURL == nil {
		c.UploadURL, _ = url.Parse(uploadBaseURL)
	}
	if c.UserAgent == "" {
		c.UserAgent = defaultUserAgent
	}
	c.common.client = c
	c.Actions = (*ActionsService)(&c.common)
	c.Activity = (*ActivityService)(&c.common)
	c.Admin = (*AdminService)(&c.common)
	c.Apps = (*AppsService)(&c.common)
	c.Authorizations = (*AuthorizationsService)(&c.common)
	c.Billing = (*BillingService)(&c.common)
	c.Checks = (*ChecksService)(&c.common)
	c.CodeScanning = (*CodeScanningService)(&c.common)
	c.Codespaces = (*CodespacesService)(&c.common)
	c.CodesOfConduct = (*CodesOfConductService)(&c.common)
	c.Copilot = (*CopilotService)(&c.common)
	c.Dependabot = (*DependabotService)(&c.common)
	c.DependencyGraph = (*DependencyGraphService)(&c.common)
	c.Emojis = (*EmojisService)(&c.common)
	c.Enterprise = (*EnterpriseService)(&c.common)
	c.Gists = (*GistsService)(&c.common)
	c.Git = (*GitService)(&c.common)
	c.Gitignores = (*GitignoresService)(&c.common)
	c.Interactions = (*InteractionsService)(&c.common)
	c.IssueImport = (*IssueImportService)(&c.common)
	c.Issues = (*IssuesService)(&c.common)
	c.Licenses = (*LicensesService)(&c.common)
	c.Markdown = (*MarkdownService)(&c.common)
	c.Marketplace = &MarketplaceService{client: c}
	c.Meta = (*MetaService)(&c.common)
	c.Migrations = (*MigrationService)(&c.common)
	c.Organizations = (*OrganizationsService)(&c.common)
	c.PullRequests = (*PullRequestsService)(&c.common)
	c.RateLimit = (*RateLimitService)(&c.common)
	c.Reactions = (*ReactionsService)(&c.common)
	c.Repositories = (*RepositoriesService)(&c.common)
	c.SCIM = (*SCIMService)(&c.common)
	c.Search = (*SearchService)(&c.common)
	c.SecretScanning = (*SecretScanningService)(&c.common)
	c.SecurityAdvisories = (*SecurityAdvisoriesService)(&c.common)
	c.SubIssue = (*SubIssueService)(&c.common)
	c.Teams = (*TeamsService)(&c.common)
	c.Users = (*UsersService)(&c.common)
}

// copy returns a copy of the current client. It must be initialized before use.
func (c *Client) copy() *Client {
	c.clientMu.Lock()
	// can't use *c here because that would copy mutexes by value.
	clone := Client{
		client:                          &http.Client{},
		UserAgent:                       c.UserAgent,
		BaseURL:                         c.BaseURL,
		UploadURL:                       c.UploadURL,
		RateLimitRedirectionalEndpoints: c.RateLimitRedirectionalEndpoints,
		secondaryRateLimitReset:         c.secondaryRateLimitReset,
	}
	c.clientMu.Unlock()
	if c.client != nil {
		clone.client.Transport = c.client.Transport
		clone.client.CheckRedirect = c.client.CheckRedirect
		clone.client.Jar = c.client.Jar
		clone.client.Timeout = c.client.Timeout
	}
	c.rateMu.Lock()
	copy(clone.rateLimits[:], c.rateLimits[:])
	c.rateMu.Unlock()
	return &clone
}

// NewClientWithEnvProxy enhances NewClient with the HttpProxy env.
func NewClientWithEnvProxy() *Client {
	return NewClient(&http.Client{Transport: &http.Transport{Proxy: http.ProxyFromEnvironment}})
}

// NewTokenClient returns a new GitHub API client authenticated with the provided token.
// Deprecated: Use NewClient(nil).WithAuthToken(token) instead.
func NewTokenClient(_ context.Context, token string) *Client {
	// This always returns a nil error.
	return NewClient(nil).WithAuthToken(token)
}

// NewEnterpriseClient returns a new GitHub API client with provided
// base URL and upload URL (often is your GitHub Enterprise hostname).
//
// Deprecated: Use NewClient(httpClient).WithEnterpriseURLs(baseURL, uploadURL) instead.
func NewEnterpriseClient(baseURL, uploadURL string, httpClient *http.Client) (*Client, error) {
	return NewClient(httpClient).WithEnterpriseURLs(baseURL, uploadURL)
}

// RequestOption represents an option that can modify an http.Request.
type RequestOption func(req *http.Request)

// WithVersion overrides the GitHub v3 API version for this individual request.
// For more information, see:
// https://github.blog/2022-11-28-to-infinity-and-beyond-enabling-the-future-of-githubs-rest-api-with-api-versioning/
func WithVersion(version string) RequestOption {
	return func(req *http.Request) {
		req.Header.Set(headerAPIVersion, version)
	}
}

// NewRequest creates an API request. A relative URL can be provided in urlStr,
// in which case it is resolved relative to the BaseURL of the Client.
// Relative URLs should always be specified without a preceding slash. If
// specified, the value pointed to by body is JSON encoded and included as the
// request body.
func (c *Client) NewRequest(method, urlStr string, body any, opts ...RequestOption) (*http.Request, error) {
	if !strings.HasSuffix(c.BaseURL.Path, "/") {
		return nil, fmt.Errorf("baseURL must have a trailing slash, but %q does not", c.BaseURL)
	}

	u, err := c.BaseURL.Parse(urlStr)
	if err != nil {
		return nil, err
	}

	var buf io.ReadWriter
	if body != nil {
		buf = &bytes.Buffer{}
		enc := json.NewEncoder(buf)
		enc.SetEscapeHTML(false)
		err := enc.Encode(body)
		if err != nil {
			return nil, err
		}
	}

	req, err := http.NewRequest(method, u.String(), buf)
	if err != nil {
		return nil, err
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", mediaTypeV3)
	if c.UserAgent != "" {
		req.Header.Set("User-Agent", c.UserAgent)
	}
	req.Header.Set(headerAPIVersion, defaultAPIVersion)

	for _, opt := range opts {
		opt(req)
	}

	return req, nil
}

// NewFormRequest creates an API request. A relative URL can be provided in urlStr,
// in which case it is resolved relative to the BaseURL of the Client.
// Relative URLs should always be specified without a preceding slash.
// Body is sent with Content-Type: application/x-www-form-urlencoded.
func (c *Client) NewFormRequest(urlStr string, body io.Reader, opts ...RequestOption) (*http.Request, error) {
	if !strings.HasSuffix(c.BaseURL.Path, "/") {
		return nil, fmt.Errorf("baseURL must have a trailing slash, but %q does not", c.BaseURL)
	}

	u, err := c.BaseURL.Parse(urlStr)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, u.String(), body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", mediaTypeV3)
	if c.UserAgent != "" {
		req.Header.Set("User-Agent", c.UserAgent)
	}
	req.Header.Set(headerAPIVersion, defaultAPIVersion)

	for _, opt := range opts {
		opt(req)
	}

	return req, nil
}

// NewUploadRequest creates an upload request. A relative URL can be provided in
// urlStr, in which case it is resolved relative to the UploadURL of the Client.
// Relative URLs should always be specified without a preceding slash.
func (c *Client) NewUploadRequest(urlStr string, reader io.Reader, size int64, mediaType string, opts ...RequestOption) (*http.Request, error) {
	if !strings.HasSuffix(c.UploadURL.Path, "/") {
		return nil, fmt.Errorf("uploadURL must have a trailing slash, but %q does not", c.UploadURL)
	}
	u, err := c.UploadURL.Parse(urlStr)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", u.String(), reader)
	if err != nil {
		return nil, err
	}

	req.ContentLength = size

	if mediaType == "" {
		mediaType = defaultMediaType
	}
	req.Header.Set("Content-Type", mediaType)
	req.Header.Set("Accept", mediaTypeV3)
	req.Header.Set("User-Agent", c.UserAgent)
	req.Header.Set(headerAPIVersion, defaultAPIVersion)

	for _, opt := range opts {
		opt(req)
	}

	return req, nil
}

// Response is a GitHub API response. This wraps the standard http.Response
// returned from GitHub and provides convenient access to things like
// pagination links.
type Response struct {
	*http.Response

	// These fields provide the page values for paginating through a set of
	// results. Any or all of these may be set to the zero value for
	// responses that are not part of a paginated set, or for which there
	// are no additional pages.
	//
	// These fields support what is called "offset pagination" and should
	// be used with the ListOptions struct.
	NextPage  int
	PrevPage  int
	FirstPage int
	LastPage  int

	// Additionally, some APIs support "cursor pagination" instead of offset.
	// This means that a token points directly to the next record which
	// can lead to O(1) performance compared to O(n) performance provided
	// by offset pagination.
	//
	// For APIs that support cursor pagination (such as
	// TeamsService.ListIDPGroupsInOrganization), the following field
	// will be populated to point to the next page.
	//
	// To use this token, set ListCursorOptions.Page to this value before
	// calling the endpoint again.
	NextPageToken string

	// For APIs that support cursor pagination, such as RepositoriesService.ListHookDeliveries,
	// the following field will be populated to point to the next page.
	// Set ListCursorOptions.Cursor to this value when calling the endpoint again.
	Cursor string

	// For APIs that support before/after pagination, such as OrganizationsService.AuditLog.
	Before string
	After  string

	// Explicitly specify the Rate type so Rate's String() receiver doesn't
	// propagate to Response.
	Rate Rate

	// token's expiration date. Timestamp is 0001-01-01 when token doesn't expire.
	// So it is valid for TokenExpiration.Equal(Timestamp{}) or TokenExpiration.Time.After(time.Now())
	TokenExpiration Timestamp
}

// newResponse creates a new Response for the provided http.Response.
// r must not be nil.
func newResponse(r *http.Response) *Response {
	response := &Response{Response: r}
	response.populatePageValues()
	response.Rate = parseRate(r)
	response.TokenExpiration = parseTokenExpiration(r)
	return response
}

// populatePageValues parses the HTTP Link response headers and populates the
// various pagination link values in the Response.
func (r *Response) populatePageValues() {
	if links, ok := r.Response.Header["Link"]; ok && len(links) > 0 {
		for _, link := range strings.Split(links[0], ",") {
			segments := strings.Split(strings.TrimSpace(link), ";")

			// link must at least have href and rel
			if len(segments) < 2 {
				continue
			}

			// ensure href is properly formatted
			if !strings.HasPrefix(segments[0], "<") || !strings.HasSuffix(segments[0], ">") {
				continue
			}

			// try to pull out page parameter
			url, err := url.Parse(segments[0][1 : len(segments[0])-1])
			if err != nil {
				continue
			}

			q := url.Query()

			if cursor := q.Get("cursor"); cursor != "" {
				for _, segment := range segments[1:] {
					switch strings.TrimSpace(segment) {
					case `rel="next"`:
						r.Cursor = cursor
					}
				}

				continue
			}

			page := q.Get("page")
			since := q.Get("since")
			before := q.Get("before")
			after := q.Get("after")

			if page == "" && before == "" && after == "" && since == "" {
				continue
			}

			if since != "" && page == "" {
				page = since
			}

			for _, segment := range segments[1:] {
				switch strings.TrimSpace(segment) {
				case `rel="next"`:
					if r.NextPage, err = strconv.Atoi(page); err != nil {
						r.NextPageToken = page
					}
					r.After = after
				case `rel="prev"`:
					r.PrevPage, _ = strconv.Atoi(page)
					r.Before = before
				case `rel="first"`:
					r.FirstPage, _ = strconv.Atoi(page)
				case `rel="last"`:
					r.LastPage, _ = strconv.Atoi(page)
				}
			}
		}
	}
}

// parseRate parses the rate related headers.
func parseRate(r *http.Response) Rate {
	var rate Rate
	if limit := r.Header.Get(headerRateLimit); limit != "" {
		rate.Limit, _ = strconv.Atoi(limit)
	}
	if remaining := r.Header.Get(headerRateRemaining); remaining != "" {
		rate.Remaining, _ = strconv.Atoi(remaining)
	}
	if used := r.Header.Get(headerRateUsed); used != "" {
		rate.Used, _ = strconv.Atoi(used)
	}
	if reset := r.Header.Get(headerRateReset); reset != "" {
		if v, _ := strconv.ParseInt(reset, 10, 64); v != 0 {
			rate.Reset = Timestamp{time.Unix(v, 0)}
		}
	}
	if resource := r.Header.Get(headerRateResource); resource != "" {
		rate.Resource = resource
	}
	return rate
}

// parseSecondaryRate parses the secondary rate related headers,
// and returns the time to retry after.
func parseSecondaryRate(r *http.Response) *time.Duration {
	// According to GitHub support, the "Retry-After" header value will be
	// an integer which represents the number of seconds that one should
	// wait before resuming making requests.
	if v := r.Header.Get(headerRetryAfter); v != "" {
		retryAfterSeconds, _ := strconv.ParseInt(v, 10, 64) // Error handling is noop.
		retryAfter := time.Duration(retryAfterSeconds) * time.Second
		return &retryAfter
	}

	// According to GitHub support, endpoints might return x-ratelimit-reset instead,
	// as an integer which represents the number of seconds since epoch UTC,
	// representing the time to resume making requests.
	if v := r.Header.Get(headerRateReset); v != "" {
		secondsSinceEpoch, _ := strconv.ParseInt(v, 10, 64) // Error handling is noop.
		retryAfter := time.Until(time.Unix(secondsSinceEpoch, 0))
		return &retryAfter
	}

	return nil
}

// parseTokenExpiration parses the TokenExpiration related headers.
// Returns 0001-01-01 if the header is not defined or could not be parsed.
func parseTokenExpiration(r *http.Response) Timestamp {
	if v := r.Header.Get(headerTokenExpiration); v != "" {
		if t, err := time.Parse("2006-01-02 15:04:05 MST", v); err == nil {
			return Timestamp{t.Local()}
		}
		// Some tokens include the timezone offset instead of the timezone.
		// https://github.com/google/go-github/issues/2649
		if t, err := time.Parse("2006-01-02 15:04:05 -0700", v); err == nil {
			return Timestamp{t.Local()}
		}
	}
	return Timestamp{} // 0001-01-01 00:00:00
}

type requestContext uint8

const (
	// BypassRateLimitCheck prevents a pre-emptive check for exceeded primary rate limits
	// Specify this by providing a context with this key, e.g.
	//   context.WithValue(context.Background(), github.BypassRateLimitCheck, true)
	BypassRateLimitCheck requestContext = iota

	SleepUntilPrimaryRateLimitResetWhenRateLimited
)

// bareDo sends an API request using `caller` http.Client passed in the parameters
// and lets you handle the api response. If an error or API Error occurs, the error
// will contain more information. Otherwise you are supposed to read and close the
// response's Body. If rate limit is exceeded and reset time is in the future,
// bareDo returns *RateLimitError immediately without making a network API call.
//
// The provided ctx must be non-nil, if it is nil an error is returned. If it is
// canceled or times out, ctx.Err() will be returned.
func (c *Client) bareDo(ctx context.Context, caller *http.Client, req *http.Request) (*Response, error) {
	if ctx == nil {
		return nil, errNonNilContext
	}

	req = withContext(ctx, req)

	rateLimitCategory := GetRateLimitCategory(req.Method, req.URL.Path)

	if bypass := ctx.Value(BypassRateLimitCheck); bypass == nil {
		// If we've hit rate limit, don't make further requests before Reset time.
		if err := c.checkRateLimitBeforeDo(req, rateLimitCategory); err != nil {
			return &Response{
				Response: err.Response,
				Rate:     err.Rate,
			}, err
		}
		// If we've hit a secondary rate limit, don't make further requests before Retry After.
		if err := c.checkSecondaryRateLimitBeforeDo(req); err != nil {
			return &Response{
				Response: err.Response,
			}, err
		}
	}

	resp, err := caller.Do(req)
	var response *Response
	if resp != nil {
		response = newResponse(resp)
	}

	if err != nil {
		// If we got an error, and the context has been canceled,
		// the context's error is probably more useful.
		select {
		case <-ctx.Done():
			return response, ctx.Err()
		default:
		}

		// If the error type is *url.Error, sanitize its URL before returning.
		if e, ok := err.(*url.Error); ok {
			if url, err := url.Parse(e.URL); err == nil {
				e.URL = sanitizeURL(url).String()
				return response, e
			}
		}

		return response, err
	}

	// Don't update the rate limits if this was a cached response.
	// X-From-Cache is set by https://github.com/gregjones/httpcache
	if response.Header.Get("X-From-Cache") == "" {
		c.rateMu.Lock()
		c.rateLimits[rateLimitCategory] = response.Rate
		c.rateMu.Unlock()
	}

	err = CheckResponse(resp)
	if err != nil {
		defer resp.Body.Close()
		// Special case for AcceptedErrors. If an AcceptedError
		// has been encountered, the response's payload will be
		// added to the AcceptedError and returned.
		//
		// Issue #1022
		aerr, ok := err.(*AcceptedError)
		if ok {
			b, readErr := io.ReadAll(resp.Body)
			if readErr != nil {
				return response, readErr
			}

			aerr.Raw = b
			err = aerr
		}

		rateLimitError, ok := err.(*RateLimitError)
		if ok && req.Context().Value(SleepUntilPrimaryRateLimitResetWhenRateLimited) != nil {
			if err := sleepUntilResetWithBuffer(req.Context(), rateLimitError.Rate.Reset.Time); err != nil {
				return response, err
			}
			// retry the request once when the rate limit has reset
			return c.bareDo(context.WithValue(req.Context(), SleepUntilPrimaryRateLimitResetWhenRateLimited, nil), caller, req)
		}

		// Update the secondary rate limit if we hit it.
		rerr, ok := err.(*AbuseRateLimitError)
		if ok && rerr.RetryAfter != nil {
			// if a max duration is specified, make sure that we are waiting at most this duration
			if c.MaxSecondaryRateLimitRetryAfterDuration > 0 && rerr.GetRetryAfter() > c.MaxSecondaryRateLimitRetryAfterDuration {
				rerr.RetryAfter = &c.MaxSecondaryRateLimitRetryAfterDuration
			}
			c.rateMu.Lock()
			c.secondaryRateLimitReset = time.Now().Add(*rerr.RetryAfter)
			c.rateMu.Unlock()
		}
	}
	return response, err
}

// BareDo sends an API request and lets you handle the api response. If an error
// or API Error occurs, the error will contain more information. Otherwise you
// are supposed to read and close the response's Body. If rate limit is exceeded
// and reset time is in the future, BareDo returns *RateLimitError immediately
// without making a network API call.
//
// The provided ctx must be non-nil, if it is nil an error is returned. If it is
// canceled or times out, ctx.Err() will be returned.
func (c *Client) BareDo(ctx context.Context, req *http.Request) (*Response, error) {
	return c.bareDo(ctx, c.client, req)
}

// bareDoIgnoreRedirects has the exact same behavior as BareDo but stops at the first
// redirection code returned by the API. If a redirection is returned by the api, bareDoIgnoreRedirects
// returns a *RedirectionError.
//
// The provided ctx must be non-nil, if it is nil an error is returned. If it is
// canceled or times out, ctx.Err() will be returned.
func (c *Client) bareDoIgnoreRedirects(ctx context.Context, req *http.Request) (*Response, error) {
	return c.bareDo(ctx, c.clientIgnoreRedirects, req)
}

var errInvalidLocation = errors.New("invalid or empty Location header in redirection response")

// bareDoUntilFound has the exact same behavior as BareDo but only follows 301s, up to maxRedirects times. If it receives
// a 302, it will parse the Location header into a *url.URL and return that.
// This is useful for endpoints that return a 302 in successful cases but still might return 301s for
// permanent redirections.
//
// The provided ctx must be non-nil, if it is nil an error is returned. If it is
// canceled or times out, ctx.Err() will be returned.
func (c *Client) bareDoUntilFound(ctx context.Context, req *http.Request, maxRedirects int) (*url.URL, *Response, error) {
	response, err := c.bareDoIgnoreRedirects(ctx, req)
	if err != nil {
		rerr, ok := err.(*RedirectionError)
		if ok {
			// If we receive a 302, transform potential relative locations into absolute and return it.
			if rerr.StatusCode == http.StatusFound {
				if rerr.Location == nil {
					return nil, nil, errInvalidLocation
				}
				newURL := c.BaseURL.ResolveReference(rerr.Location)
				return newURL, response, nil
			}
			// If permanent redirect response is returned, follow it
			if maxRedirects > 0 && rerr.StatusCode == http.StatusMovedPermanently {
				if rerr.Location == nil {
					return nil, nil, errInvalidLocation
				}
				newURL := c.BaseURL.ResolveReference(rerr.Location)
				newRequest := req.Clone(ctx)
				newRequest.URL = newURL
				return c.bareDoUntilFound(ctx, newRequest, maxRedirects-1)
			}
			// If we reached the maximum amount of redirections, return an error
			if maxRedirects <= 0 && rerr.StatusCode == http.StatusMovedPermanently {
				return nil, response, fmt.Errorf("reached the maximum amount of redirections: %w", err)
			}
			return nil, response, fmt.Errorf("unexpected redirection response: %w", err)
		}
	}

	// If we don't receive a redirection, forward the response and potential error
	return nil, response, err
}

// Do sends an API request and returns the API response. The API response is
// JSON decoded and stored in the value pointed to by v, or returned as an
// error if an API error has occurred. If v implements the io.Writer interface,
// the raw response body will be written to v, without attempting to first
// decode it. If v is nil, and no error happens, the response is returned as is.
// If rate limit is exceeded and reset time is in the future, Do returns
// *RateLimitError immediately without making a network API call.
//
// The provided ctx must be non-nil, if it is nil an error is returned. If it
// is canceled or times out, ctx.Err() will be returned.
func (c *Client) Do(ctx context.Context, req *http.Request, v any) (*Response, error) {
	resp, err := c.BareDo(ctx, req)
	if err != nil {
		return resp, err
	}
	defer resp.Body.Close()

	switch v := v.(type) {
	case nil:
	case io.Writer:
		_, err = io.Copy(v, resp.Body)
	default:
		decErr := json.NewDecoder(resp.Body).Decode(v)
		if decErr == io.EOF {
			decErr = nil // ignore EOF errors caused by empty response body
		}
		if decErr != nil {
			err = decErr
		}
	}
	return resp, err
}

// checkRateLimitBeforeDo does not make any network calls, but uses existing knowledge from
// current client state in order to quickly check if *RateLimitError can be immediately returned
// from Client.Do, and if so, returns it so that Client.Do can skip making a network API call unnecessarily.
// Otherwise it returns nil, and Client.Do should proceed normally.
func (c *Client) checkRateLimitBeforeDo(req *http.Request, rateLimitCategory RateLimitCategory) *RateLimitError {
	c.rateMu.Lock()
	rate := c.rateLimits[rateLimitCategory]
	c.rateMu.Unlock()
	if !rate.Reset.Time.IsZero() && rate.Remaining == 0 && time.Now().Before(rate.Reset.Time) {
		// Create a fake response.
		resp := &http.Response{
			Status:     http.StatusText(http.StatusForbidden),
			StatusCode: http.StatusForbidden,
			Request:    req,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader("")),
		}

		if req.Context().Value(SleepUntilPrimaryRateLimitResetWhenRateLimited) != nil {
			if err := sleepUntilResetWithBuffer(req.Context(), rate.Reset.Time); err == nil {
				return nil
			}
			return &RateLimitError{
				Rate:     rate,
				Response: resp,
				Message:  fmt.Sprintf("Context cancelled while waiting for rate limit to reset until %v, not making remote request.", rate.Reset.Time),
			}
		}

		return &RateLimitError{
			Rate:     rate,
			Response: resp,
			Message:  fmt.Sprintf("API rate limit of %v still exceeded until %v, not making remote request.", rate.Limit, rate.Reset.Time),
		}
	}

	return nil
}

// checkSecondaryRateLimitBeforeDo does not make any network calls, but uses existing knowledge from
// current client state in order to quickly check if *AbuseRateLimitError can be immediately returned
// from Client.Do, and if so, returns it so that Client.Do can skip making a network API call unnecessarily.
// Otherwise it returns nil, and Client.Do should proceed normally.
func (c *Client) checkSecondaryRateLimitBeforeDo(req *http.Request) *AbuseRateLimitError {
	c.rateMu.Lock()
	secondary := c.secondaryRateLimitReset
	c.rateMu.Unlock()
	if !secondary.IsZero() && time.Now().Before(secondary) {
		// Create a fake response.
		resp := &http.Response{
			Status:     http.StatusText(http.StatusForbidden),
			StatusCode: http.StatusForbidden,
			Request:    req,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader("")),
		}

		retryAfter := time.Until(secondary)
		return &AbuseRateLimitError{
			Response:   resp,
			Message:    fmt.Sprintf("API secondary rate limit exceeded until %v, not making remote request.", secondary),
			RetryAfter: &retryAfter,
		}
	}

	return nil
}

// compareHTTPResponse returns whether two http.Response objects are equal or not.
// Currently, only StatusCode is checked. This function is used when implementing the
// Is(error) bool interface for the custom error types in this package.
func compareHTTPResponse(r1, r2 *http.Response) bool {
	if r1 == nil && r2 == nil {
		return true
	}

	if r1 != nil && r2 != nil {
		return r1.StatusCode == r2.StatusCode
	}
	return false
}

/*
An ErrorResponse reports one or more errors caused by an API request.

GitHub API docs: https://docs.github.com/rest/#client-errors
*/
type ErrorResponse struct {
	Response *http.Response `json:"-"`       // HTTP response that caused this error
	Message  string         `json:"message"` // error message
	//nolint:sliceofpointers
	Errors []Error `json:"errors"` // more detail on individual errors
	// Block is only populated on certain types of errors such as code 451.
	Block *ErrorBlock `json:"block,omitempty"`
	// Most errors will also include a documentation_url field pointing
	// to some content that might help you resolve the error, see
	// https://docs.github.com/rest/#client-errors
	DocumentationURL string `json:"documentation_url,omitempty"`
}

// ErrorBlock contains a further explanation for the reason of an error.
// See https://developer.github.com/changes/2016-03-17-the-451-status-code-is-now-supported/
// for more information.
type ErrorBlock struct {
	Reason    string     `json:"reason,omitempty"`
	CreatedAt *Timestamp `json:"created_at,omitempty"`
}

func (r *ErrorResponse) Error() string {
	if r.Response != nil && r.Response.Request != nil {
		return fmt.Sprintf("%v %v: %d %v %+v",
			r.Response.Request.Method, sanitizeURL(r.Response.Request.URL),
			r.Response.StatusCode, r.Message, r.Errors)
	}

	if r.Response != nil {
		return fmt.Sprintf("%d %v %+v", r.Response.StatusCode, r.Message, r.Errors)
	}

	return fmt.Sprintf("%v %+v", r.Message, r.Errors)
}

// Is returns whether the provided error equals this error.
func (r *ErrorResponse) Is(target error) bool {
	v, ok := target.(*ErrorResponse)
	if !ok {
		return false
	}

	if r.Message != v.Message || (r.DocumentationURL != v.DocumentationURL) ||
		!compareHTTPResponse(r.Response, v.Response) {
		return false
	}

	// Compare Errors.
	if len(r.Errors) != len(v.Errors) {
		return false
	}
	for idx := range r.Errors {
		if r.Errors[idx] != v.Errors[idx] {
			return false
		}
	}

	// Compare Block.
	if (r.Block != nil && v.Block == nil) || (r.Block == nil && v.Block != nil) {
		return false
	}
	if r.Block != nil && v.Block != nil {
		if r.Block.Reason != v.Block.Reason {
			return false
		}
		if (r.Block.CreatedAt != nil && v.Block.CreatedAt == nil) || (r.Block.CreatedAt ==
			nil && v.Block.CreatedAt != nil) {
			return false
		}
		if r.Block.CreatedAt != nil && v.Block.CreatedAt != nil {
			if *(r.Block.CreatedAt) != *(v.Block.CreatedAt) {
				return false
			}
		}
	}

	return true
}

// TwoFactorAuthError occurs when using HTTP Basic Authentication for a user
// that has two-factor authentication enabled. The request can be reattempted
// by providing a one-time password in the request.
type TwoFactorAuthError ErrorResponse

func (r *TwoFactorAuthError) Error() string { return (*ErrorResponse)(r).Error() }

// RateLimitError occurs when GitHub returns 403 Forbidden response with a rate limit
// remaining value of 0.
type RateLimitError struct {
	Rate     Rate           // Rate specifies last known rate limit for the client
	Response *http.Response // HTTP response that caused this error
	Message  string         `json:"message"` // error message
}

func (r *RateLimitError) Error() string {
	return fmt.Sprintf("%v %v: %d %v %v",
		r.Response.Request.Method, sanitizeURL(r.Response.Request.URL),
		r.Response.StatusCode, r.Message, formatRateReset(time.Until(r.Rate.Reset.Time)))
}

// Is returns whether the provided error equals this error.
func (r *RateLimitError) Is(target error) bool {
	v, ok := target.(*RateLimitError)
	if !ok {
		return false
	}

	return r.Rate == v.Rate &&
		r.Message == v.Message &&
		compareHTTPResponse(r.Response, v.Response)
}

// AcceptedError occurs when GitHub returns 202 Accepted response with an
// empty body, which means a job was scheduled on the GitHub side to process
// the information needed and cache it.
// Technically, 202 Accepted is not a real error, it's just used to
// indicate that results are not ready yet, but should be available soon.
// The request can be repeated after some time.
type AcceptedError struct {
	// Raw contains the response body.
	Raw []byte
}

func (*AcceptedError) Error() string {
	return "job scheduled on GitHub side; try again later"
}

// Is returns whether the provided error equals this error.
func (ae *AcceptedError) Is(target error) bool {
	v, ok := target.(*AcceptedError)
	if !ok {
		return false
	}
	return bytes.Equal(ae.Raw, v.Raw)
}

// AbuseRateLimitError occurs when GitHub returns 403 Forbidden response with the
// "documentation_url" field value equal to "https://docs.github.com/rest/overview/rate-limits-for-the-rest-api#about-secondary-rate-limits".
type AbuseRateLimitError struct {
	Response *http.Response // HTTP response that caused this error
	Message  string         `json:"message"` // error message

	// RetryAfter is provided with some abuse rate limit errors. If present,
	// it is the amount of time that the client should wait before retrying.
	// Otherwise, the client should try again later (after an unspecified amount of time).
	RetryAfter *time.Duration
}

func (r *AbuseRateLimitError) Error() string {
	return fmt.Sprintf("%v %v: %d %v",
		r.Response.Request.Method, sanitizeURL(r.Response.Request.URL),
		r.Response.StatusCode, r.Message)
}

// Is returns whether the provided error equals this error.
func (r *AbuseRateLimitError) Is(target error) bool {
	v, ok := target.(*AbuseRateLimitError)
	if !ok {
		return false
	}

	return r.Message == v.Message &&
		r.RetryAfter == v.RetryAfter &&
		compareHTTPResponse(r.Response, v.Response)
}

// RedirectionError represents a response that returned a redirect status code:
//
//	301 (Moved Permanently)
//	302 (Found)
//	303 (See Other)
//	307 (Temporary Redirect)
//	308 (Permanent Redirect)
//
// If there was a valid Location header included, it will be parsed to a URL. You should use
// `BaseURL.ResolveReference()` to enrich it with the correct hostname where needed.
type RedirectionError struct {
	Response   *http.Response // HTTP response that caused this error
	StatusCode int
	Location   *url.URL // location header of the redirection if present
}

func (r *RedirectionError) Error() string {
	return fmt.Sprintf("%v %v: %d location %v",
		r.Response.Request.Method, sanitizeURL(r.Response.Request.URL),
		r.StatusCode, sanitizeURL(r.Location))
}

// Is returns whether the provided error equals this error.
func (r *RedirectionError) Is(target error) bool {
	v, ok := target.(*RedirectionError)
	if !ok {
		return false
	}

	return r.StatusCode == v.StatusCode &&
		(r.Location == v.Location || // either both locations are nil or exactly the same pointer
			r.Location != nil && v.Location != nil && r.Location.String() == v.Location.String()) // or they are both not nil and marshaled identically
}

// sanitizeURL redacts the client_secret parameter from the URL which may be
// exposed to the user.
func sanitizeURL(uri *url.URL) *url.URL {
	if uri == nil {
		return nil
	}
	params := uri.Query()
	if len(params.Get("client_secret")) > 0 {
		params.Set("client_secret", "REDACTED")
		uri.RawQuery = params.Encode()
	}
	return uri
}

/*
An Error reports more details on an individual error in an ErrorResponse.
These are the possible validation error codes:

	missing:
	    resource does not exist
	missing_field:
	    a required field on a resource has not been set
	invalid:
	    the formatting of a field is invalid
	already_exists:
	    another resource has the same valid as this field
	custom:
	    some resources return this (e.g. github.User.CreateKey()), additional
	    information is set in the Message field of the Error

GitHub error responses structure are often undocumented and inconsistent.
Sometimes error is just a simple string (Issue #540).
In such cases, Message represents an error message as a workaround.

GitHub API docs: https://docs.github.com/rest/#client-errors
*/
type Error struct {
	Resource string `json:"resource"` // resource on which the error occurred
	Field    string `json:"field"`    // field on which the error occurred
	Code     string `json:"code"`     // validation error code
	Message  string `json:"message"`  // Message describing the error. Errors with Code == "custom" will always have this set.
}

func (e *Error) Error() string {
	return fmt.Sprintf("%v error caused by %v field on %v resource",
		e.Code, e.Field, e.Resource)
}

func (e *Error) UnmarshalJSON(data []byte) error {
	type aliasError Error // avoid infinite recursion by using type alias.
	if err := json.Unmarshal(data, (*aliasError)(e)); err != nil {
		return json.Unmarshal(data, &e.Message) // data can be json string.
	}
	return nil
}

// CheckResponse checks the API response for errors, and returns them if
// present. A response is considered an error if it has a status code outside
// the 200 range or equal to 202 Accepted.
// API error responses are expected to have response
// body, and a JSON response body that maps to [ErrorResponse].
//
// The error type will be *[RateLimitError] for rate limit exceeded errors,
// *[AcceptedError] for 202 Accepted status codes,
// *[TwoFactorAuthError] for two-factor authentication errors,
// and *[RedirectionError] for redirect status codes (only happens when ignoring redirections).
func CheckResponse(r *http.Response) error {
	if r.StatusCode == http.StatusAccepted {
		return &AcceptedError{}
	}
	if c := r.StatusCode; 200 <= c && c <= 299 {
		return nil
	}

	errorResponse := &ErrorResponse{Response: r}
	data, err := io.ReadAll(r.Body)
	if err == nil && data != nil {
		err = json.Unmarshal(data, errorResponse)
		if err != nil {
			// reset the response as if this never happened
			errorResponse = &ErrorResponse{Response: r}
		}
	}
	// Re-populate error response body because GitHub error responses are often
	// undocumented and inconsistent.
	// Issue #1136, #540.
	r.Body = io.NopCloser(bytes.NewBuffer(data))
	switch {
	case r.StatusCode == http.StatusUnauthorized && strings.HasPrefix(r.Header.Get(headerOTP), "required"):
		return (*TwoFactorAuthError)(errorResponse)
	case r.StatusCode == http.StatusForbidden && r.Header.Get(headerRateRemaining) == "0":
		return &RateLimitError{
			Rate:     parseRate(r),
			Response: errorResponse.Response,
			Message:  errorResponse.Message,
		}
	case r.StatusCode == http.StatusForbidden &&
		(strings.HasSuffix(errorResponse.DocumentationURL, "#abuse-rate-limits") ||
			strings.HasSuffix(errorResponse.DocumentationURL, "secondary-rate-limits")):
		abuseRateLimitError := &AbuseRateLimitError{
			Response: errorResponse.Response,
			Message:  errorResponse.Message,
		}
		if retryAfter := parseSecondaryRate(r); retryAfter != nil {
			abuseRateLimitError.RetryAfter = retryAfter
		}
		return abuseRateLimitError
	// Check that the status code is a redirection and return a sentinel error that can be used to handle special cases
	// where 302 is considered a successful result.
	// This should never happen with the default `CheckRedirect`, because it would return a `url.Error` that should be handled upstream.
	case r.StatusCode == http.StatusMovedPermanently ||
		r.StatusCode == http.StatusFound ||
		r.StatusCode == http.StatusSeeOther ||
		r.StatusCode == http.StatusTemporaryRedirect ||
		r.StatusCode == http.StatusPermanentRedirect:

		locationStr := r.Header.Get("Location")
		var location *url.URL
		if locationStr != "" {
			location, _ = url.Parse(locationStr)
		}
		return &RedirectionError{
			Response:   errorResponse.Response,
			StatusCode: r.StatusCode,
			Location:   location,
		}
	default:
		return errorResponse
	}
}

// parseBoolResponse determines the boolean result from a GitHub API response.
// Several GitHub API methods return boolean responses indicated by the HTTP
// status code in the response (true indicated by a 204, false indicated by a
// 404). This helper function will determine that result and hide the 404
// error if present. Any other error will be returned through as-is.
func parseBoolResponse(err error) (bool, error) {
	if err == nil {
		return true, nil
	}

	if err, ok := err.(*ErrorResponse); ok && err.Response.StatusCode == http.StatusNotFound {
		// Simply false. In this one case, we do not pass the error through.
		return false, nil
	}

	// some other real error occurred
	return false, err
}

type RateLimitCategory uint8

const (
	CoreCategory RateLimitCategory = iota
	SearchCategory
	GraphqlCategory
	IntegrationManifestCategory
	SourceImportCategory
	CodeScanningUploadCategory
	ActionsRunnerRegistrationCategory
	ScimCategory
	DependencySnapshotsCategory
	CodeSearchCategory
	AuditLogCategory

	Categories // An array of this length will be able to contain all rate limit categories.
)

// GetRateLimitCategory returns the rate limit RateLimitCategory of the endpoint, determined by HTTP method and Request.URL.Path.
func GetRateLimitCategory(method, path string) RateLimitCategory {
	switch {
	// https://docs.github.com/rest/rate-limit#about-rate-limits
	default:
		// NOTE: coreCategory is returned for actionsRunnerRegistrationCategory too,
		// because no API found for this category.
		return CoreCategory

	// https://docs.github.com/en/rest/search/search#search-code
	case strings.HasPrefix(path, "/search/code") &&
		method == http.MethodGet:
		return CodeSearchCategory

	case strings.HasPrefix(path, "/search/"):
		return SearchCategory
	case path == "/graphql":
		return GraphqlCategory
	case strings.HasPrefix(path, "/app-manifests/") &&
		strings.HasSuffix(path, "/conversions") &&
		method == http.MethodPost:
		return IntegrationManifestCategory

	// https://docs.github.com/rest/migrations/source-imports#start-an-import
	case strings.HasPrefix(path, "/repos/") &&
		strings.HasSuffix(path, "/import") &&
		method == http.MethodPut:
		return SourceImportCategory

	// https://docs.github.com/rest/code-scanning#upload-an-analysis-as-sarif-data
	case strings.HasSuffix(path, "/code-scanning/sarifs"):
		return CodeScanningUploadCategory

	// https://docs.github.com/enterprise-cloud@latest/rest/scim
	case strings.HasPrefix(path, "/scim/"):
		return ScimCategory

	// https://docs.github.com/en/rest/dependency-graph/dependency-submission#create-a-snapshot-of-dependencies-for-a-repository
	case strings.HasPrefix(path, "/repos/") &&
		strings.HasSuffix(path, "/dependency-graph/snapshots") &&
		method == http.MethodPost:
		return DependencySnapshotsCategory

	// https://docs.github.com/en/enterprise-cloud@latest/rest/orgs/orgs?apiVersion=2022-11-28#get-the-audit-log-for-an-organization
	case strings.HasSuffix(path, "/audit-log"):
		return AuditLogCategory
	}
}

// RateLimits returns the rate limits for the current client.
//
// Deprecated: Use RateLimitService.Get instead.
func (c *Client) RateLimits(ctx context.Context) (*RateLimits, *Response, error) {
	return c.RateLimit.Get(ctx)
}

func setCredentialsAsHeaders(req *http.Request, id, secret string) *http.Request {
	// To set extra headers, we must make a copy of the Request so
	// that we don't modify the Request we were given. This is required by the
	// specification of http.RoundTripper.
	//
	// Since we are going to modify only req.Header here, we only need a deep copy
	// of req.Header.
	convertedRequest := new(http.Request)
	*convertedRequest = *req
	convertedRequest.Header = make(http.Header, len(req.Header))

	for k, s := range req.Header {
		convertedRequest.Header[k] = append([]string(nil), s...)
	}
	convertedRequest.SetBasicAuth(id, secret)
	return convertedRequest
}

/*
UnauthenticatedRateLimitedTransport allows you to make unauthenticated calls
that need to use a higher rate limit associated with your OAuth application.

	t := &github.UnauthenticatedRateLimitedTransport{
		ClientID:     "your app's client ID",
		ClientSecret: "your app's client secret",
	}
	client := github.NewClient(t.Client())

This will add the client id and secret as a base64-encoded string in the format
ClientID:ClientSecret and apply it as an "Authorization": "Basic" header.

See https://docs.github.com/rest/#unauthenticated-rate-limited-requests for
more information.
*/
type UnauthenticatedRateLimitedTransport struct {
	// ClientID is the GitHub OAuth client ID of the current application, which
	// can be found by selecting its entry in the list at
	// https://github.com/settings/applications.
	ClientID string

	// ClientSecret is the GitHub OAuth client secret of the current
	// application.
	ClientSecret string

	// Transport is the underlying HTTP transport to use when making requests.
	// It will default to http.DefaultTransport if nil.
	Transport http.RoundTripper
}

// RoundTrip implements the RoundTripper interface.
func (t *UnauthenticatedRateLimitedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if t.ClientID == "" {
		return nil, errors.New("t.ClientID is empty")
	}
	if t.ClientSecret == "" {
		return nil, errors.New("t.ClientSecret is empty")
	}

	req2 := setCredentialsAsHeaders(req, t.ClientID, t.ClientSecret)
	// Make the HTTP request.
	return t.transport().RoundTrip(req2)
}

// Client returns an *http.Client that makes requests which are subject to the
// rate limit of your OAuth application.
func (t *UnauthenticatedRateLimitedTransport) Client() *http.Client {
	return &http.Client{Transport: t}
}

func (t *UnauthenticatedRateLimitedTransport) transport() http.RoundTripper {
	if t.Transport != nil {
		return t.Transport
	}
	return http.DefaultTransport
}

// BasicAuthTransport is an http.RoundTripper that authenticates all requests
// using HTTP Basic Authentication with the provided username and password. It
// additionally supports users who have two-factor authentication enabled on
// their GitHub account.
type BasicAuthTransport struct {
	Username string // GitHub username
	Password string // GitHub password
	OTP      string // one-time password for users with two-factor auth enabled

	// Transport is the underlying HTTP transport to use when making requests.
	// It will default to http.DefaultTransport if nil.
	Transport http.RoundTripper
}

// RoundTrip implements the RoundTripper interface.
func (t *BasicAuthTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req2 := setCredentialsAsHeaders(req, t.Username, t.Password)
	if t.OTP != "" {
		req2.Header.Set(headerOTP, t.OTP)
	}
	return t.transport().RoundTrip(req2)
}

// Client returns an *http.Client that makes requests that are authenticated
// using HTTP Basic Authentication.
func (t *BasicAuthTransport) Client() *http.Client {
	return &http.Client{Transport: t}
}

func (t *BasicAuthTransport) transport() http.RoundTripper {
	if t.Transport != nil {
		return t.Transport
	}
	return http.DefaultTransport
}

// formatRateReset formats d to look like "[rate reset in 2s]" or
// "[rate reset in 87m02s]" for the positive durations. And like "[rate limit was reset 87m02s ago]"
// for the negative cases.
func formatRateReset(d time.Duration) string {
	isNegative := d < 0
	if isNegative {
		d *= -1
	}
	secondsTotal := int(0.5 + d.Seconds())
	minutes := secondsTotal / 60
	seconds := secondsTotal - minutes*60

	var timeString string
	if minutes > 0 {
		timeString = fmt.Sprintf("%dm%02ds", minutes, seconds)
	} else {
		timeString = fmt.Sprintf("%ds", seconds)
	}

	if isNegative {
		return fmt.Sprintf("[rate limit was reset %v ago]", timeString)
	}
	return fmt.Sprintf("[rate reset in %v]", timeString)
}

func sleepUntilResetWithBuffer(ctx context.Context, reset time.Time) error {
	buffer := time.Second
	timer := time.NewTimer(time.Until(reset) + buffer)
	select {
	case <-ctx.Done():
		if !timer.Stop() {
			<-timer.C
		}
		return ctx.Err()
	case <-timer.C:
	}
	return nil
}

// When using roundTripWithOptionalFollowRedirect, note that it
// is the responsibility of the caller to close the response body.
func (c *Client) roundTripWithOptionalFollowRedirect(ctx context.Context, u string, maxRedirects int, opts ...RequestOption) (*http.Response, error) {
	req, err := c.NewRequest("GET", u, nil, opts...)
	if err != nil {
		return nil, err
	}

	var resp *http.Response
	// Use http.DefaultTransport if no custom Transport is configured
	req = withContext(ctx, req)
	if c.client.Transport == nil {
		resp, err = http.DefaultTransport.RoundTrip(req)
	} else {
		resp, err = c.client.Transport.RoundTrip(req)
	}
	if err != nil {
		return nil, err
	}

	// If redirect response is returned, follow it
	if maxRedirects > 0 && resp.StatusCode == http.StatusMovedPermanently {
		_ = resp.Body.Close()
		u = resp.Header.Get("Location")
		resp, err = c.roundTripWithOptionalFollowRedirect(ctx, u, maxRedirects-1, opts...)
	}
	return resp, err
}

// Ptr is a helper routine that allocates a new T value
// to store v and returns a pointer to it.
func Ptr[T any](v T) *T {
	return &v
}

// Bool is a helper routine that allocates a new bool value
// to store v and returns a pointer to it.
//
// Deprecated: use Ptr instead.
func Bool(v bool) *bool { return &v }

// Int is a helper routine that allocates a new int value
// to store v and returns a pointer to it.
//
// Deprecated: use Ptr instead.
func Int(v int) *int { return &v }

// Int64 is a helper routine that allocates a new int64 value
// to store v and returns a pointer to it.
//
// Deprecated: use Ptr instead.
func Int64(v int64) *int64 { return &v }

// String is a helper routine that allocates a new string value
// to store v and returns a pointer to it.
//
// Deprecated: use Ptr instead.
func String(v string) *string { return &v }

// roundTripperFunc creates a RoundTripper (transport).
type roundTripperFunc func(*http.Request) (*http.Response, error)

func (fn roundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return fn(r)
}

var runIDFromURLRE = regexp.MustCompile(`repos/.*/actions/runs/(\d+)/deployment_protection_rule$`)

// GetRunID is a Helper Function used to extract the workflow RunID from the *DeploymentProtectionRuleEvent.DeploymentCallBackURL.
func (e *DeploymentProtectionRuleEvent) GetRunID() (int64, error) {
	match := runIDFromURLRE.FindStringSubmatch(*e.DeploymentCallbackURL)
	if len(match) != 2 {
		return -1, errors.New("no match")
	}
	runID, err := strconv.ParseInt(match[1], 10, 64)
	if err != nil {
		return -1, err
	}
	return runID, nil
}
