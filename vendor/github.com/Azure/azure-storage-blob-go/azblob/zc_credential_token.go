package azblob

import (
	"context"
	"errors"
	"sync/atomic"

	"runtime"
	"sync"
	"time"

	"github.com/Azure/azure-pipeline-go/pipeline"
)

// TokenRefresher represents a callback method that you write; this method is called periodically
// so you can refresh the token credential's value.
type TokenRefresher func(credential TokenCredential) time.Duration

// TokenCredential represents a token credential (which is also a pipeline.Factory).
type TokenCredential interface {
	Credential
	Token() string
	SetToken(newToken string)
}

func tokenCredentialPointers(credential TokenCredential) *string {
	if credential == nil {
		return nil
	}

	out := "Bearer " + credential.Token()
	return &out
}

// NewTokenCredential creates a token credential for use with role-based access control (RBAC) access to Azure Storage
// resources. You initialize the TokenCredential with an initial token value. If you pass a non-nil value for
// tokenRefresher, then the function you pass will be called immediately so it can refresh and change the
// TokenCredential's token value by calling SetToken. Your tokenRefresher function must return a time.Duration
// indicating how long the TokenCredential object should wait before calling your tokenRefresher function again.
// If your tokenRefresher callback fails to refresh the token, you can return a duration of 0 to stop your
// TokenCredential object from ever invoking tokenRefresher again. Also, one way to deal with failing to refresh a
// token is to cancel a context.Context object used by requests that have the TokenCredential object in their pipeline.
func NewTokenCredential(initialToken string, tokenRefresher TokenRefresher) TokenCredential {
	tc := &tokenCredential{}
	tc.SetToken(initialToken) // We don't set it above to guarantee atomicity
	if tokenRefresher == nil {
		return tc // If no callback specified, return the simple tokenCredential
	}

	tcwr := &tokenCredentialWithRefresh{token: tc}
	tcwr.token.startRefresh(tokenRefresher)
	runtime.SetFinalizer(tcwr, func(deadTC *tokenCredentialWithRefresh) {
		deadTC.token.stopRefresh()
		deadTC.token = nil //  Sanity (not really required)
	})
	return tcwr
}

// tokenCredentialWithRefresh is a wrapper over a token credential.
// When this wrapper object gets GC'd, it stops the tokenCredential's timer
// which allows the tokenCredential object to also be GC'd.
type tokenCredentialWithRefresh struct {
	token *tokenCredential
}

// credentialMarker is a package-internal method that exists just to satisfy the Credential interface.
func (*tokenCredentialWithRefresh) credentialMarker() {}

// Token returns the current token value
func (f *tokenCredentialWithRefresh) Token() string { return f.token.Token() }

// SetToken changes the current token value
func (f *tokenCredentialWithRefresh) SetToken(token string) { f.token.SetToken(token) }

// New satisfies pipeline.Factory's New method creating a pipeline policy object.
func (f *tokenCredentialWithRefresh) New(next pipeline.Policy, po *pipeline.PolicyOptions) pipeline.Policy {
	return f.token.New(next, po)
}

// /////////////////////////////////////////////////////////////////////////////

// tokenCredential is a pipeline.Factory is the credential's policy factory.
type tokenCredential struct {
	token atomic.Value

	// The members below are only used if the user specified a tokenRefresher callback function.
	timer          *time.Timer
	tokenRefresher TokenRefresher
	lock           sync.Mutex
	stopped        bool
}

// credentialMarker is a package-internal method that exists just to satisfy the Credential interface.
func (*tokenCredential) credentialMarker() {}

// Token returns the current token value
func (f *tokenCredential) Token() string { return f.token.Load().(string) }

// SetToken changes the current token value
func (f *tokenCredential) SetToken(token string) { f.token.Store(token) }

// startRefresh calls refresh which immediately calls tokenRefresher
// and then starts a timer to call tokenRefresher in the future.
func (f *tokenCredential) startRefresh(tokenRefresher TokenRefresher) {
	f.tokenRefresher = tokenRefresher
	f.stopped = false // In case user calls StartRefresh, StopRefresh, & then StartRefresh again
	f.refresh()
}

// refresh calls the user's tokenRefresher so they can refresh the token (by
// calling SetToken) and then starts another time (based on the returned duration)
// in order to refresh the token again in the future.
func (f *tokenCredential) refresh() {
	d := f.tokenRefresher(f) // Invoke the user's refresh callback outside of the lock
	if d > 0 {               // If duration is 0 or negative, refresher wants to not be called again
		f.lock.Lock()
		if !f.stopped {
			f.timer = time.AfterFunc(d, f.refresh)
		}
		f.lock.Unlock()
	}
}

// stopRefresh stops any pending timer and sets stopped field to true to prevent
// any new timer from starting.
// NOTE: Stopping the timer allows the GC to destroy the tokenCredential object.
func (f *tokenCredential) stopRefresh() {
	f.lock.Lock()
	f.stopped = true
	if f.timer != nil {
		f.timer.Stop()
	}
	f.lock.Unlock()
}

// New satisfies pipeline.Factory's New method creating a pipeline policy object.
func (f *tokenCredential) New(next pipeline.Policy, po *pipeline.PolicyOptions) pipeline.Policy {
	return pipeline.PolicyFunc(func(ctx context.Context, request pipeline.Request) (pipeline.Response, error) {
		if request.URL.Scheme != "https" {
			// HTTPS must be used, otherwise the tokens are at the risk of being exposed
			return nil, errors.New("token credentials require a URL using the https protocol scheme")
		}
		request.Header[headerAuthorization] = []string{"Bearer " + f.Token()}
		return next.Do(ctx, request)
	})
}
