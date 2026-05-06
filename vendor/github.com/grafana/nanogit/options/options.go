package options

import (
	"net/http"
)

type BasicAuth struct {
	Username string
	Password string
}

type Options struct {
	HTTPClient *http.Client
	UserAgent  string
	BasicAuth  *BasicAuth
	AuthToken  *string
}

type Option func(*Options) error
