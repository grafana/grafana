package goidentity

import (
	"context"
	"net/http"
	"time"
)

const (
	CTXKey = "jcmturner/goidentity"
)

type Identity interface {
	UserName() string
	SetUserName(s string)
	Domain() string
	SetDomain(s string)
	DisplayName() string
	SetDisplayName(s string)
	Human() bool
	SetHuman(b bool)
	AuthTime() time.Time
	SetAuthTime(t time.Time)
	AuthzAttributes() []string
	AddAuthzAttribute(a string)
	RemoveAuthzAttribute(a string)
	Authenticated() bool
	SetAuthenticated(b bool)
	Authorized(a string) bool
	SessionID() string
	Expired() bool
	Attributes() map[string]interface{}
	SetAttribute(k string, v interface{})
	SetAttributes(map[string]interface{})
	RemoveAttribute(k string)
	Marshal() ([]byte, error)
	Unmarshal([]byte) error
}

func AddToHTTPRequestContext(id Identity, r *http.Request) *http.Request {
	ctx := r.Context()
	ctx = context.WithValue(ctx, CTXKey, id)
	return r.WithContext(ctx)
}

func FromHTTPRequestContext(r *http.Request) Identity {
	ctx := r.Context()
	if id, ok := ctx.Value(CTXKey).(Identity); ok {
		return id
	}
	return nil
}
