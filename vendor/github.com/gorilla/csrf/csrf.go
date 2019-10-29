package csrf

import (
	"fmt"
	"net/http"
	"net/url"

	"github.com/pkg/errors"

	"github.com/gorilla/securecookie"
)

// CSRF token length in bytes.
const tokenLength = 32

// Context/session keys & prefixes
const (
	tokenKey     string = "gorilla.csrf.Token"
	formKey      string = "gorilla.csrf.Form"
	errorKey     string = "gorilla.csrf.Error"
	skipCheckKey string = "gorilla.csrf.Skip"
	cookieName   string = "_gorilla_csrf"
	errorPrefix  string = "gorilla/csrf: "
)

var (
	// The name value used in form fields.
	fieldName = tokenKey
	// defaultAge sets the default MaxAge for cookies.
	defaultAge = 3600 * 12
	// The default HTTP request header to inspect
	headerName = "X-CSRF-Token"
	// Idempotent (safe) methods as defined by RFC7231 section 4.2.2.
	safeMethods = []string{"GET", "HEAD", "OPTIONS", "TRACE"}
)

// TemplateTag provides a default template tag - e.g. {{ .csrfField }} - for use
// with the TemplateField function.
var TemplateTag = "csrfField"

var (
	// ErrNoReferer is returned when a HTTPS request provides an empty Referer
	// header.
	ErrNoReferer = errors.New("referer not supplied")
	// ErrBadReferer is returned when the scheme & host in the URL do not match
	// the supplied Referer header.
	ErrBadReferer = errors.New("referer invalid")
	// ErrNoToken is returned if no CSRF token is supplied in the request.
	ErrNoToken = errors.New("CSRF token not found in request")
	// ErrBadToken is returned if the CSRF token in the request does not match
	// the token in the session, or is otherwise malformed.
	ErrBadToken = errors.New("CSRF token invalid")
)

type csrf struct {
	h    http.Handler
	sc   *securecookie.SecureCookie
	st   store
	opts options
}

// options contains the optional settings for the CSRF middleware.
type options struct {
	MaxAge int
	Domain string
	Path   string
	// Note that the function and field names match the case of the associated
	// http.Cookie field instead of the "correct" HTTPOnly name that golint suggests.
	HttpOnly       bool
	Secure         bool
	RequestHeader  string
	FieldName      string
	ErrorHandler   http.Handler
	CookieName     string
	TrustedOrigins []string
}

// Protect is HTTP middleware that provides Cross-Site Request Forgery
// protection.
//
// It securely generates a masked (unique-per-request) token that
// can be embedded in the HTTP response (e.g. form field or HTTP header).
// The original (unmasked) token is stored in the session, which is inaccessible
// by an attacker (provided you are using HTTPS). Subsequent requests are
// expected to include this token, which is compared against the session token.
// Requests that do not provide a matching token are served with a HTTP 403
// 'Forbidden' error response.
//
// Example:
//	package main
//
//	import (
//		"html/template"
//
//		"github.com/gorilla/csrf"
//		"github.com/gorilla/mux"
//	)
//
//	var t = template.Must(template.New("signup_form.tmpl").Parse(form))
//
//	func main() {
//		r := mux.NewRouter()
//
//		r.HandleFunc("/signup", GetSignupForm)
//		// POST requests without a valid token will return a HTTP 403 Forbidden.
//		r.HandleFunc("/signup/post", PostSignupForm)
//
//		// Add the middleware to your router.
//		http.ListenAndServe(":8000",
//		// Note that the authentication key provided should be 32 bytes
//		// long and persist across application restarts.
//			  csrf.Protect([]byte("32-byte-long-auth-key"))(r))
//	}
//
//	func GetSignupForm(w http.ResponseWriter, r *http.Request) {
//		// signup_form.tmpl just needs a {{ .csrfField }} template tag for
//		// csrf.TemplateField to inject the CSRF token into. Easy!
//		t.ExecuteTemplate(w, "signup_form.tmpl", map[string]interface{}{
//			csrf.TemplateTag: csrf.TemplateField(r),
//		})
//		// We could also retrieve the token directly from csrf.Token(r) and
//		// set it in the request header - w.Header.Set("X-CSRF-Token", token)
//		// This is useful if you're sending JSON to clients or a front-end JavaScript
//		// framework.
//	}
//
func Protect(authKey []byte, opts ...Option) func(http.Handler) http.Handler {
	return func(h http.Handler) http.Handler {
		cs := parseOptions(h, opts...)

		// Set the defaults if no options have been specified
		if cs.opts.ErrorHandler == nil {
			cs.opts.ErrorHandler = http.HandlerFunc(unauthorizedHandler)
		}

		if cs.opts.MaxAge < 0 {
			// Default of 12 hours
			cs.opts.MaxAge = defaultAge
		}

		if cs.opts.FieldName == "" {
			cs.opts.FieldName = fieldName
		}

		if cs.opts.CookieName == "" {
			cs.opts.CookieName = cookieName
		}

		if cs.opts.RequestHeader == "" {
			cs.opts.RequestHeader = headerName
		}

		// Create an authenticated securecookie instance.
		if cs.sc == nil {
			cs.sc = securecookie.New(authKey, nil)
			// Use JSON serialization (faster than one-off gob encoding)
			cs.sc.SetSerializer(securecookie.JSONEncoder{})
			// Set the MaxAge of the underlying securecookie.
			cs.sc.MaxAge(cs.opts.MaxAge)
		}

		if cs.st == nil {
			// Default to the cookieStore
			cs.st = &cookieStore{
				name:     cs.opts.CookieName,
				maxAge:   cs.opts.MaxAge,
				secure:   cs.opts.Secure,
				httpOnly: cs.opts.HttpOnly,
				path:     cs.opts.Path,
				domain:   cs.opts.Domain,
				sc:       cs.sc,
			}
		}

		return cs
	}
}

// Implements http.Handler for the csrf type.
func (cs *csrf) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Skip the check if directed to. This should always be a bool.
	if val, err := contextGet(r, skipCheckKey); err == nil {
		if skip, ok := val.(bool); ok {
			if skip {
				cs.h.ServeHTTP(w, r)
				return
			}
		}
	}

	// Retrieve the token from the session.
	// An error represents either a cookie that failed HMAC validation
	// or that doesn't exist.
	realToken, err := cs.st.Get(r)
	if err != nil || len(realToken) != tokenLength {
		// If there was an error retrieving the token, the token doesn't exist
		// yet, or it's the wrong length, generate a new token.
		// Note that the new token will (correctly) fail validation downstream
		// as it will no longer match the request token.
		realToken, err = generateRandomBytes(tokenLength)
		if err != nil {
			r = envError(r, err)
			cs.opts.ErrorHandler.ServeHTTP(w, r)
			return
		}

		// Save the new (real) token in the session store.
		err = cs.st.Save(realToken, w)
		if err != nil {
			r = envError(r, err)
			cs.opts.ErrorHandler.ServeHTTP(w, r)
			return
		}
	}

	// Save the masked token to the request context
	r = contextSave(r, tokenKey, mask(realToken, r))
	// Save the field name to the request context
	r = contextSave(r, formKey, cs.opts.FieldName)

	// HTTP methods not defined as idempotent ("safe") under RFC7231 require
	// inspection.
	if !contains(safeMethods, r.Method) {
		// Enforce an origin check for HTTPS connections. As per the Django CSRF
		// implementation (https://goo.gl/vKA7GE) the Referer header is almost
		// always present for same-domain HTTP requests.
		if r.URL.Scheme == "https" {
			// Fetch the Referer value. Call the error handler if it's empty or
			// otherwise fails to parse.
			referer, err := url.Parse(r.Referer())
			if err != nil || referer.String() == "" {
				r = envError(r, ErrNoReferer)
				cs.opts.ErrorHandler.ServeHTTP(w, r)
				return
			}

			valid := sameOrigin(r.URL, referer)

			if !valid {
				for _, trustedOrigin := range cs.opts.TrustedOrigins {
					if referer.Host == trustedOrigin {
						valid = true
						break
					}
				}
			}

			if valid == false {
				r = envError(r, ErrBadReferer)
				cs.opts.ErrorHandler.ServeHTTP(w, r)
				return
			}
		}

		// If the token returned from the session store is nil for non-idempotent
		// ("unsafe") methods, call the error handler.
		if realToken == nil {
			r = envError(r, ErrNoToken)
			cs.opts.ErrorHandler.ServeHTTP(w, r)
			return
		}

		// Retrieve the combined token (pad + masked) token and unmask it.
		requestToken := unmask(cs.requestToken(r))

		// Compare the request token against the real token
		if !compareTokens(requestToken, realToken) {
			r = envError(r, ErrBadToken)
			cs.opts.ErrorHandler.ServeHTTP(w, r)
			return
		}

	}

	// Set the Vary: Cookie header to protect clients from caching the response.
	w.Header().Add("Vary", "Cookie")

	// Call the wrapped handler/router on success.
	cs.h.ServeHTTP(w, r)
	// Clear the request context after the handler has completed.
	contextClear(r)
}

// unauthorizedhandler sets a HTTP 403 Forbidden status and writes the
// CSRF failure reason to the response.
func unauthorizedHandler(w http.ResponseWriter, r *http.Request) {
	http.Error(w, fmt.Sprintf("%s - %s",
		http.StatusText(http.StatusForbidden), FailureReason(r)),
		http.StatusForbidden)
	return
}
