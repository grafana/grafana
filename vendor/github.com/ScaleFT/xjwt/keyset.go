package xjwt

import (
	"context"
	"encoding/json"
	"net/http"
	"sync/atomic"
	"time"

	"fmt"

	"io/ioutil"

	opentracing "github.com/opentracing/opentracing-go"
	otext "github.com/opentracing/opentracing-go/ext"
	"github.com/pquerna/cachecontrol"
	"golang.org/x/net/context/ctxhttp"
	jose "gopkg.in/square/go-jose.v2"
)

const (
	xjwtOpenTracingTag = "com.scaleft.xjwt"
)

type KeysetOptions struct {
	UserAgent        string
	URL              string
	Client           *http.Client
	MinCacheDuration time.Duration
	MaxCacheDuration time.Duration
	RefreshWarning   func(err error)
}

// NewRemoteKeyset creates a JSON Keyset that is cached in memory.
//
// On creation, it will do a block HTTP request to load the initial keyset.
//
// After initial load, it will refresh the cached keyset, any consumers may see
// older versions of the cache until the refresh is complete.
//
// NewRemoteKeyset emits opentracing spans on the supplied context when fetching the keyset.
func NewRemoteKeyset(ctx context.Context, opts KeysetOptions) (*RemoteKeyset, error) {
	ctx, cfunc := context.WithCancel(ctx)
	rk := &RemoteKeyset{
		ctx:    ctx,
		cfunc:  cfunc,
		opts:   opts,
		client: opts.Client,
	}

	if rk.client == nil {
		rk.client = &http.Client{
			Timeout: time.Second * 30,
		}
	}

	if rk.opts.MinCacheDuration == 0 {
		rk.opts.MinCacheDuration = time.Minute * 5
	}

	if rk.opts.MaxCacheDuration == 0 {
		rk.opts.MaxCacheDuration = time.Hour * 12
	}

	if rk.opts.RefreshWarning == nil {
		rk.opts.RefreshWarning = func(err error) {}
	}
	err := rk.init()
	if err != nil {
		return nil, err
	}
	return rk, nil
}

type RemoteKeyset struct {
	opts KeysetOptions

	ctx   context.Context
	cfunc context.CancelFunc

	client *http.Client
	now    func() time.Time

	current atomic.Value
}

func (rk *RemoteKeyset) init() error {
	rk.current.Store(&jose.JSONWebKeySet{})
	rv, refresh, err := rk.fetchKeyset()
	if err != nil {
		return err
	}
	rk.current.Store(rv)

	go rk.refreshKeySet(refresh)

	return nil
}

func (rk *RemoteKeyset) refreshKeySet(refresh time.Duration) {
	select {
	case <-rk.ctx.Done():
		return
	case <-time.After(refresh):
		rv, d, err := rk.fetchKeyset()
		if err != nil {
			rk.opts.RefreshWarning(err)
			go rk.refreshKeySet(refresh)
			return
		}
		rk.current.Store(rv)
		go rk.refreshKeySet(d)
		return
	}
}

func (rk *RemoteKeyset) fetchKeyset() (*jose.JSONWebKeySet, time.Duration, error) {
	ctx, cancel := context.WithTimeout(rk.ctx, time.Second*30)
	defer cancel()

	req, err := http.NewRequest("GET", rk.opts.URL, nil)
	if err != nil {
		return nil, time.Duration(0), err
	}

	req.Header.Set("Accept", "application/json")

	if rk.opts.UserAgent != "" {
		req.Header.Set("User-Agent", rk.opts.UserAgent)
	} else {
		req.Header.Set("User-Agent", "xjwt.go/0.1.0")
	}

	sp, ctx := opentracing.StartSpanFromContext(ctx, "xjwt.keyset.fetch")
	otext.Component.Set(sp, xjwtOpenTracingTag)
	otext.SpanKind.Set(sp, otext.SpanKindRPCClientEnum)
	otext.HTTPUrl.Set(sp, req.URL.String())
	otext.HTTPMethod.Set(sp, req.Method)
	defer sp.Finish()

	resp, err := ctxhttp.Do(ctx, rk.client, req)
	if err != nil {
		otext.Error.Set(sp, true)
		return nil, time.Duration(0), err
	}
	otext.HTTPStatusCode.Set(sp, uint16(resp.StatusCode))
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return rk.parseResponse(req, resp)
	}

	return nil, time.Duration(0), fmt.Errorf("xjwt.keyset: Fetch returned HTTP Status Code '%d' for '%s'", resp.StatusCode, rk.opts.URL)
}

func (rk *RemoteKeyset) parseResponse(req *http.Request, resp *http.Response) (*jose.JSONWebKeySet, time.Duration, error) {
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, time.Duration(0), fmt.Errorf("xjwt.keyset: Error reading response '%s': %v", rk.opts.URL, err)
	}

	rv := &jose.JSONWebKeySet{}

	err = json.Unmarshal(data, rv)
	if err != nil {
		return nil, time.Duration(0), fmt.Errorf("xjwt.keyset: Error parsing response '%s': %v", rk.opts.URL, err)
	}

	_, cacheExpires, err := cachecontrol.CachableResponse(req, resp, cachecontrol.Options{})
	if err != nil {
		return nil, time.Duration(0), fmt.Errorf("xjwt.keyset: Error parsing cache control header '%s': %v", rk.opts.URL, err)
	}

	n := time.Now()

	exp := cacheExpires.Sub(n)
	if exp > rk.opts.MaxCacheDuration {
		return rv, rk.opts.MaxCacheDuration, nil
	} else if exp < rk.opts.MinCacheDuration {
		return rv, rk.opts.MinCacheDuration, nil
	}

	return rv, exp, nil
}

func (rk *RemoteKeyset) Get() (*jose.JSONWebKeySet, error) {
	return rk.current.Load().(*jose.JSONWebKeySet), nil
}

func (rk *RemoteKeyset) Close() {
	rk.cfunc()
}
