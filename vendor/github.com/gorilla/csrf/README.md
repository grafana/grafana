# gorilla/csrf

[![GoDoc](https://godoc.org/github.com/gorilla/csrf?status.svg)](https://godoc.org/github.com/gorilla/csrf)
[![Sourcegraph](https://sourcegraph.com/github.com/gorilla/csrf/-/badge.svg)](https://sourcegraph.com/github.com/gorilla/csrf?badge)
[![Reviewed by Hound](https://img.shields.io/badge/Reviewed_by-Hound-8E64B0.svg)](https://houndci.com)
[![CircleCI](https://circleci.com/gh/gorilla/csrf.svg?style=svg)](https://circleci.com/gh/gorilla/csrf)

gorilla/csrf is a HTTP middleware library that provides [cross-site request
forgery](http://blog.codinghorror.com/preventing-csrf-and-xsrf-attacks/) (CSRF)
protection. It includes:

- The `csrf.Protect` middleware/handler provides CSRF protection on routes
  attached to a router or a sub-router.
- A `csrf.Token` function that provides the token to pass into your response,
  whether that be a HTML form or a JSON response body.
- ... and a `csrf.TemplateField` helper that you can pass into your `html/template`
  templates to replace a `{{ .csrfField }}` template tag with a hidden input
  field.

gorilla/csrf is designed to work with any Go web framework, including:

- The [Gorilla](https://www.gorillatoolkit.org/) toolkit
- Go's built-in [net/http](http://golang.org/pkg/net/http/) package
- [Goji](https://goji.io) - see the [tailored fork](https://github.com/goji/csrf)
- [Gin](https://github.com/gin-gonic/gin)
- [Echo](https://github.com/labstack/echo)
- ... and any other router/framework that rallies around Go's `http.Handler` interface.

gorilla/csrf is also compatible with middleware 'helper' libraries like
[Alice](https://github.com/justinas/alice) and [Negroni](https://github.com/codegangsta/negroni).

## Install

With a properly configured Go toolchain:

```sh
go get github.com/gorilla/csrf
```

## Examples

- [HTML Forms](#html-forms)
- [JavaScript Apps](#javascript-applications)
- [Google App Engine](#google-app-engine)
- [Setting Options](#setting-options)

gorilla/csrf is easy to use: add the middleware to your router with
the below:

```go
CSRF := csrf.Protect([]byte("32-byte-long-auth-key"))
http.ListenAndServe(":8000", CSRF(r))
```

...and then collect the token with `csrf.Token(r)` in your handlers before
passing it to the template, JSON body or HTTP header (see below).

Note that the authentication key passed to `csrf.Protect([]byte(key))` should be
32-bytes long and persist across application restarts. Generating a random key
won't allow you to authenticate existing cookies and will break your CSRF
validation.

gorilla/csrf inspects the HTTP headers (first) and form body (second) on
subsequent POST/PUT/PATCH/DELETE/etc. requests for the token.

### HTML Forms

Here's the common use-case: HTML forms you want to provide CSRF protection for,
in order to protect malicious POST requests being made:

```go
package main

import (
    "net/http"

    "github.com/gorilla/csrf"
    "github.com/gorilla/mux"
)

func main() {
    r := mux.NewRouter()
    r.HandleFunc("/signup", ShowSignupForm)
    // All POST requests without a valid token will return HTTP 403 Forbidden.
    // We should also ensure that our mutating (non-idempotent) handler only
    // matches on POST requests. We can check that here, at the router level, or
    // within the handler itself via r.Method.
    r.HandleFunc("/signup/post", SubmitSignupForm).Methods("POST")

    // Add the middleware to your router by wrapping it.
    http.ListenAndServe(":8000",
        csrf.Protect([]byte("32-byte-long-auth-key"))(r))
    // PS: Don't forget to pass csrf.Secure(false) if you're developing locally
    // over plain HTTP (just don't leave it on in production).
}

func ShowSignupForm(w http.ResponseWriter, r *http.Request) {
    // signup_form.tmpl just needs a {{ .csrfField }} template tag for
    // csrf.TemplateField to inject the CSRF token into. Easy!
    t.ExecuteTemplate(w, "signup_form.tmpl", map[string]interface{}{
        csrf.TemplateTag: csrf.TemplateField(r),
    })
    // We could also retrieve the token directly from csrf.Token(r) and
    // set it in the request header - w.Header.Set("X-CSRF-Token", token)
    // This is useful if you're sending JSON to clients or a front-end JavaScript
    // framework.
}

func SubmitSignupForm(w http.ResponseWriter, r *http.Request) {
    // We can trust that requests making it this far have satisfied
    // our CSRF protection requirements.
}
```

Note that the CSRF middleware will (by necessity) consume the request body if the
token is passed via POST form values. If you need to consume this in your
handler, insert your own middleware earlier in the chain to capture the request
body.

### JavaScript Applications

This approach is useful if you're using a front-end JavaScript framework like
React, Ember or Angular, and are providing a JSON API. Specifically, we need
to provide a way for our front-end fetch/AJAX calls to pass the token on each
fetch (AJAX/XMLHttpRequest) request. We achieve this by:

- Parsing the token from the `<input>` field generated by the
  `csrf.TemplateField(r)` helper, or passing it back in a response header.
- Sending this token back on every request
- Ensuring our cookie is attached to the request so that the form/header
  value can be compared to the cookie value.

We'll also look at applying selective CSRF protection using
[gorilla/mux's](https://www.gorillatoolkit.org/pkg/mux) sub-routers,
as we don't handle any POST/PUT/DELETE requests with our top-level router.

```go
package main

import (
    "github.com/gorilla/csrf"
    "github.com/gorilla/mux"
)

func main() {
    r := mux.NewRouter()
    csrfMiddleware := csrf.Protect([]byte("32-byte-long-auth-key"))

    api := r.PathPrefix("/api").Subrouter()
    api.Use(csrfMiddleware)
    api.HandleFunc("/user/{id}", GetUser).Methods("GET")

    http.ListenAndServe(":8000", r)
}

func GetUser(w http.ResponseWriter, r *http.Request) {
    // Authenticate the request, get the id from the route params,
    // and fetch the user from the DB, etc.

    // Get the token and pass it in the CSRF header. Our JSON-speaking client
    // or JavaScript framework can now read the header and return the token in
    // in its own "X-CSRF-Token" request header on the subsequent POST.
    w.Header().Set("X-CSRF-Token", csrf.Token(r))
    b, err := json.Marshal(user)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }

    w.Write(b)
}
```

In our JavaScript application, we should read the token from the response
headers and pass it in a request header for all requests. Here's what that
looks like when using [Axios](https://github.com/axios/axios), a popular
JavaScript HTTP client library:

```js
// You can alternatively parse the response header for the X-CSRF-Token, and
// store that instead, if you followed the steps above to write the token to a
// response header.
let csrfToken = document.getElementsByName("gorilla.csrf.Token")[0].value

// via https://github.com/axios/axios#creating-an-instance
const instance = axios.create({
  baseURL: "https://example.com/api/",
  timeout: 1000,
  headers: { "X-CSRF-Token": csrfToken }
})

// Now, any HTTP request you make will include the csrfToken from the page,
// provided you update the csrfToken variable for each render.
try {
  let resp = await instance.post(endpoint, formData)
  // Do something with resp
} catch (err) {
  // Handle the exception
}
```

If you plan to host your JavaScript application on another domain, you can use the Trusted Origins
feature to allow the host of your JavaScript application to make requests to your Go application. Observe the example below:


```go
package main

import (
    "github.com/gorilla/csrf"
    "github.com/gorilla/mux"
)

func main() {
    r := mux.NewRouter()
    csrfMiddleware := csrf.Protect([]byte("32-byte-long-auth-key"), csrf.TrustedOrigin([]string{"ui.domain.com"}))

    api := r.PathPrefix("/api").Subrouter()
    api.Use(csrfMiddleware)
    api.HandleFunc("/user/{id}", GetUser).Methods("GET")

    http.ListenAndServe(":8000", r)
}

func GetUser(w http.ResponseWriter, r *http.Request) {
    // Authenticate the request, get the id from the route params,
    // and fetch the user from the DB, etc.

    // Get the token and pass it in the CSRF header. Our JSON-speaking client
    // or JavaScript framework can now read the header and return the token in
    // in its own "X-CSRF-Token" request header on the subsequent POST.
    w.Header().Set("X-CSRF-Token", csrf.Token(r))
    b, err := json.Marshal(user)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }

    w.Write(b)
}
```

On the example above, you're authorizing requests from `ui.domain.com` to make valid CSRF requests to your application, so you can have your API server on another domain without problems.

### Google App Engine

If you're using [Google App
Engine](https://cloud.google.com/appengine/docs/go/how-requests-are-handled#Go_Requests_and_HTTP),
(first-generation) which doesn't allow you to hook into the default `http.ServeMux` directly,
you can still use gorilla/csrf (and gorilla/mux):

```go
package app

// Remember: appengine has its own package main
func init() {
    r := mux.NewRouter()
    r.HandleFunc("/", IndexHandler)
    // ...

    // We pass our CSRF-protected router to the DefaultServeMux
    http.Handle("/", csrf.Protect([]byte(your-key))(r))
}
```

Note: You can ignore this if you're using the
[second-generation](https://cloud.google.com/appengine/docs/go/) Go runtime
on App Engine (Go 1.11 and above).

### Setting Options

What about providing your own error handler and changing the HTTP header the
package inspects on requests? (i.e. an existing API you're porting to Go). Well,
gorilla/csrf provides options for changing these as you see fit:

```go
func main() {
    CSRF := csrf.Protect(
            []byte("a-32-byte-long-key-goes-here"),
            csrf.RequestHeader("Authenticity-Token"),
            csrf.FieldName("authenticity_token"),
            csrf.ErrorHandler(http.HandlerFunc(serverError(403))),
    )

    r := mux.NewRouter()
    r.HandleFunc("/signup", GetSignupForm)
    r.HandleFunc("/signup/post", PostSignupForm)

    http.ListenAndServe(":8000", CSRF(r))
}
```

Not too bad, right?

If there's something you're confused about or a feature you would like to see
added, open an issue.

## Design Notes

Getting CSRF protection right is important, so here's some background:

- This library generates unique-per-request (masked) tokens as a mitigation
  against the [BREACH attack](http://breachattack.com/).
- The 'base' (unmasked) token is stored in the session, which means that
  multiple browser tabs won't cause a user problems as their per-request token
  is compared with the base token.
- Operates on a "whitelist only" approach where safe (non-mutating) HTTP methods
  (GET, HEAD, OPTIONS, TRACE) are the _only_ methods where token validation is not
  enforced.
- The design is based on the battle-tested
  [Django](https://docs.djangoproject.com/en/1.8/ref/csrf/) and [Ruby on
  Rails](http://api.rubyonrails.org/classes/ActionController/RequestForgeryProtection.html)
  approaches.
- Cookies are authenticated and based on the [securecookie](https://github.com/gorilla/securecookie)
  library. They're also Secure (issued over HTTPS only) and are HttpOnly
  by default, because sane defaults are important.
- Go's `crypto/rand` library is used to generate the 32 byte (256 bit) tokens
  and the one-time-pad used for masking them.

This library does not seek to be adventurous.

## License

BSD licensed. See the LICENSE file for details.
