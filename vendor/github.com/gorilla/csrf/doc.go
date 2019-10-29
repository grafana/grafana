/*
Package csrf (gorilla/csrf) provides Cross Site Request Forgery (CSRF)
prevention middleware for Go web applications & services.

It includes:

* The `csrf.Protect` middleware/handler provides CSRF protection on routes
attached to a router or a sub-router.

* A `csrf.Token` function that provides the token to pass into your response,
whether that be a HTML form or a JSON response body.

* ... and a `csrf.TemplateField` helper that you can pass into your `html/template`
templates to replace a `{{ .csrfField }}` template tag with a hidden input
field.

gorilla/csrf is easy to use: add the middleware to individual handlers with
the below:

    CSRF := csrf.Protect([]byte("32-byte-long-auth-key"))
    http.HandlerFunc("/route", CSRF(YourHandler))

... and then collect the token with `csrf.Token(r)` before passing it to the
template, JSON body or HTTP header (you pick!). gorilla/csrf inspects the form body
(first) and HTTP headers (second) on subsequent POST/PUT/PATCH/DELETE/etc. requests
for the token.

Note that the authentication key passed to `csrf.Protect([]byte(key))` should be
32-bytes long and persist across application restarts. Generating a random key
won't allow you to authenticate existing cookies and will break your CSRF
validation.

Here's the common use-case: HTML forms you want to provide CSRF protection for,
in order to protect malicious POST requests being made:

	package main

	import (
		"fmt"
		"html/template"
		"net/http"

		"github.com/gorilla/csrf"
		"github.com/gorilla/mux"
	)

	var form = `
	<html>
	<head>
	<title>Sign Up!</title>
	</head>
	<body>
	<form method="POST" action="/signup/post" accept-charset="UTF-8">
	<input type="text" name="name">
	<input type="text" name="email">
	<!--
	The default template tag used by the CSRF middleware .
	This will be replaced with a hidden <input> field containing the
	masked CSRF token.
	-->
	{{ .csrfField }}
	<input type="submit" value="Sign up!">
	</form>
	</body>
	</html>
	`

	var t = template.Must(template.New("signup_form.tmpl").Parse(form))

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
	}

	func SubmitSignupForm(w http.ResponseWriter, r *http.Request) {
		// We can trust that requests making it this far have satisfied
		// our CSRF protection requirements.
		fmt.Fprintf(w, "%v\n", r.PostForm)
	}

Note that the CSRF middleware will (by necessity) consume the request body if the
token is passed via POST form values. If you need to consume this in your
handler, insert your own middleware earlier in the chain to capture the request
body.

You can also send the CSRF token in the response header. This approach is useful
if you're using a front-end JavaScript framework like Ember or Angular, or are
providing a JSON API:

	package main

	import (
		"github.com/gorilla/csrf"
		"github.com/gorilla/mux"
	)

	func main() {
		r := mux.NewRouter()

		api := r.PathPrefix("/api").Subrouter()
		api.HandleFunc("/user/:id", GetUser).Methods("GET")

		http.ListenAndServe(":8000",
		csrf.Protect([]byte("32-byte-long-auth-key"))(r))
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

If you're writing a client that's supposed to mimic browser behavior, make sure to
send back the CSRF cookie (the default name is _gorilla_csrf, but this can be changed
with the CookieName Option) along with either the X-CSRF-Token header or the gorilla.csrf.Token form field.

In addition: getting CSRF protection right is important, so here's some background:

* This library generates unique-per-request (masked) tokens as a mitigation
against the BREACH attack (http://breachattack.com/).

* The 'base' (unmasked) token is stored in the session, which means that
multiple browser tabs won't cause a user problems as their per-request token
is compared with the base token.

* Operates on a "whitelist only" approach where safe (non-mutating) HTTP methods
(GET, HEAD, OPTIONS, TRACE) are the *only* methods where token validation is not
enforced.

* The design is based on the battle-tested Django
(https://docs.djangoproject.com/en/1.8/ref/csrf/) and Ruby on Rails
(http://api.rubyonrails.org/classes/ActionController/RequestForgeryProtection.html)
approaches.

* Cookies are authenticated and based on the securecookie
(https://github.com/gorilla/securecookie) library. They're also Secure (issued
over HTTPS only) and are HttpOnly by default, because sane defaults are
important.

* Go's `crypto/rand` library is used to generate the 32 byte (256 bit) tokens
and the one-time-pad used for masking them.

This library does not seek to be adventurous.

*/
package csrf
