package options

import "errors"

// WithBasicAuth sets the HTTP Basic Auth options.
// This is not a particularly secure method of authentication, so you probably want to recommend or require WithTokenAuth instead.
// NOTE: basic auth is defined as a valid authentication method by the http-protocol spec.
// See: https://git-scm.com/docs/http-protocol#_authentication
func WithBasicAuth(username, password string) Option {
	return func(o *Options) error {
		if username == "" {
			return errors.New("username cannot be empty")
		}

		if o.AuthToken != nil {
			return errors.New("cannot use both basic auth and token auth")
		}

		o.BasicAuth = &BasicAuth{
			Username: username,
			Password: password,
		}
		return nil
	}
}

// WithTokenAuth sets the Authorization header to the given token.
// We will not modify it for you. As such, if it needs a "Bearer" or "token" prefix, you must add that yourself.
// NOTE: auth beyond basic is defined as a valid authentication method by the http-protocol spec, if the server wants to implement it.
// See: https://git-scm.com/docs/http-protocol#_authentication
func WithTokenAuth(token string) Option {
	return func(o *Options) error {
		if token == "" {
			return errors.New("token cannot be empty")
		}

		if o.BasicAuth != nil {
			return errors.New("cannot use both basic auth and token auth")
		}

		o.AuthToken = &token
		return nil
	}
}
