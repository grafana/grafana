// Copyright 2013 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

/*
Package github provides a client for using the GitHub API.

Usage:

	import "github.com/google/go-github/v73/github"	// with go modules enabled (GO111MODULE=on or outside GOPATH)
	import "github.com/google/go-github/github"     // with go modules disabled

Construct a new GitHub client, then use the various services on the client to
access different parts of the GitHub API. For example:

	client := github.NewClient(nil)

	// list all organizations for user "willnorris"
	orgs, _, err := client.Organizations.List(ctx, "willnorris", nil)

Some API methods have optional parameters that can be passed. For example:

	client := github.NewClient(nil)

	// list public repositories for org "github"
	opt := &github.RepositoryListByOrgOptions{Type: "public"}
	repos, _, err := client.Repositories.ListByOrg(ctx, "github", opt)

The services of a client divide the API into logical chunks and correspond to
the structure of the GitHub API documentation at
https://docs.github.com/rest .

NOTE: Using the [context] package, one can easily
pass cancelation signals and deadlines to various services of the client for
handling a request. In case there is no context available, then [context.Background]
can be used as a starting point.

For more sample code snippets, head over to the https://github.com/google/go-github/tree/master/example directory.

# Authentication

Use [Client.WithAuthToken] to configure your client to authenticate using an Oauth token
(for example, a personal access token). This is what is needed for a majority of use cases
aside from GitHub Apps.

	client := github.NewClient(nil).WithAuthToken("... your access token ...")

Note that when using an authenticated [Client], all calls made by the client will
include the specified OAuth token. Therefore, authenticated clients should
almost never be shared between different users.

For API methods that require HTTP Basic Authentication, use the
[BasicAuthTransport].

GitHub Apps authentication can be provided by the
https://github.com/bradleyfalzon/ghinstallation package.
It supports both authentication as an installation, using an installation access token,
and as an app, using a JWT.

To authenticate as an installation:

	import "github.com/bradleyfalzon/ghinstallation"

	func main() {
		// Wrap the shared transport for use with the integration ID 1 authenticating with installation ID 99.
		itr, err := ghinstallation.NewKeyFromFile(http.DefaultTransport, 1, 99, "2016-10-19.private-key.pem")
		if err != nil {
			// Handle error.
		}

		// Use installation transport with client
		client := github.NewClient(&http.Client{Transport: itr})

		// Use client...
	}

To authenticate as an app, using a JWT:

	import "github.com/bradleyfalzon/ghinstallation"

	func main() {
		// Wrap the shared transport for use with the application ID 1.
		atr, err := ghinstallation.NewAppsTransportKeyFromFile(http.DefaultTransport, 1, "2016-10-19.private-key.pem")
		if err != nil {
			// Handle error.
		}

		// Use app transport with client
		client := github.NewClient(&http.Client{Transport: atr})

		// Use client...
	}

# Rate Limiting

GitHub imposes a rate limit on all API clients. Unauthenticated clients are
limited to 60 requests per hour, while authenticated clients can make up to
5,000 requests per hour. The Search API has a custom rate limit. Unauthenticated
clients are limited to 10 requests per minute, while authenticated clients
can make up to 30 requests per minute. To receive the higher rate limit when
making calls that are not issued on behalf of a user,
use [UnauthenticatedRateLimitedTransport].

The returned [Response].[Rate] value contains the rate limit information
from the most recent API call. If a recent enough response isn't
available, you can use RateLimits to fetch the most up-to-date rate
limit data for the client.

To detect an API rate limit error, you can check if its type is *[RateLimitError].
For secondary rate limits, you can check if its type is *[AbuseRateLimitError]:

	repos, _, err := client.Repositories.List(ctx, "", nil)
	if _, ok := err.(*github.RateLimitError); ok {
		log.Println("hit rate limit")
	}
	if _, ok := err.(*github.AbuseRateLimitError); ok {
		log.Println("hit secondary rate limit")
	}

Learn more about GitHub rate limiting at
https://docs.github.com/rest/rate-limit .

# Accepted Status

Some endpoints may return a 202 Accepted status code, meaning that the
information required is not yet ready and was scheduled to be gathered on
the GitHub side. Methods known to behave like this are documented specifying
this behavior.

To detect this condition of error, you can check if its type is
*[AcceptedError]:

	stats, _, err := client.Repositories.ListContributorsStats(ctx, org, repo)
	if _, ok := err.(*github.AcceptedError); ok {
		log.Println("scheduled on GitHub side")
	}

# Conditional Requests

The GitHub REST API has good support for conditional HTTP requests
via the ETag header which will help prevent you from burning through your
rate limit, as well as help speed up your application. go-github does not
handle conditional requests directly, but is instead designed to work with a
caching [http.Transport].

Typically, an RFC 7234 compliant HTTP cache such as https://github.com/gregjones/httpcache
is recommended. Alternatively, the https://github.com/bored-engineer/github-conditional-http-transport
package relies on (undocumented) GitHub specific cache logic and is
recommended when making requests using short-lived credentials such as a
GitHub App installation token.

Learn more about GitHub conditional requests at
https://docs.github.com/rest/overview/resources-in-the-rest-api#conditional-requests.

# Creating and Updating Resources

All structs for GitHub resources use pointer values for all non-repeated fields.
This allows distinguishing between unset fields and those set to a zero-value.
A helper function, [Ptr], has been provided to easily create these pointers for string,
bool, and int values. For example:

	// create a new private repository named "foo"
	repo := &github.Repository{
		Name:    github.Ptr("foo"),
		Private: github.Ptr(true),
	}
	client.Repositories.Create(ctx, "", repo)

Users who have worked with protocol buffers should find this pattern familiar.

# Pagination

All requests for resource collections (repos, pull requests, issues, etc.)
support pagination. Pagination options are described in the
[ListOptions] struct and passed to the list methods directly or as an
embedded type of a more specific list options struct (for example
[PullRequestListOptions]). Pages information is available via the
[Response] struct.

	client := github.NewClient(nil)

	opt := &github.RepositoryListByOrgOptions{
		ListOptions: github.ListOptions{PerPage: 10},
	}
	// get all pages of results
	var allRepos []*github.Repository
	for {
		repos, resp, err := client.Repositories.ListByOrg(ctx, "github", opt)
		if err != nil {
			return err
		}
		allRepos = append(allRepos, repos...)
		if resp.NextPage == 0 {
			break
		}
		opt.Page = resp.NextPage
	}
*/
package github
