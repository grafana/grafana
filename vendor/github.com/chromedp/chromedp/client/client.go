// Package client provides the low level Chrome Debugging Protocol JSON types
// and related funcs.
package client

//go:generate go run gen.go

import (
	"context"
	"encoding/json"
	"errors"
	"io/ioutil"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/mailru/easyjson"
)

const (
	// DefaultURL is the default Chrome URL to connect to.
	DefaultURL = "http://localhost:9222/json"

	// DefaultWatchInterval is the default check duration.
	DefaultWatchInterval = 100 * time.Millisecond

	// DefaultWatchTimeout is the default watch timeout.
	DefaultWatchTimeout = 5 * time.Second
)

var (
	// ErrUnsupportedProtocolType is the unsupported protocol type error.
	ErrUnsupportedProtocolType = errors.New("unsupported protocol type")

	// ErrUnsupportedProtocolVersion is the unsupported protocol version error.
	ErrUnsupportedProtocolVersion = errors.New("unsupported protocol version")
)

// Target is the common interface for a Chrome Debugging Protocol target.
type Target interface {
	String() string
	GetID() string
	GetType() TargetType
	GetWebsocketURL() string
}

// Client is a Chrome Debugging Protocol client.
type Client struct {
	url     string
	check   time.Duration
	timeout time.Duration

	ver, typ string
	rw       sync.RWMutex
}

// New creates a new Chrome Debugging Protocol client.
func New(opts ...Option) *Client {
	c := &Client{
		url:     DefaultURL,
		check:   DefaultWatchInterval,
		timeout: DefaultWatchTimeout,
	}

	// apply opts
	for _, o := range opts {
		o(c)
	}

	return c
}

// doReq executes a request.
func (c *Client) doReq(ctxt context.Context, action string, v interface{}) error {
	// create request
	req, err := http.NewRequest("GET", c.url+"/"+action, nil)
	if err != nil {
		return err
	}
	req = req.WithContext(ctxt)

	cl := &http.Client{}

	// execute
	res, err := cl.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if v != nil {
		// load body
		body, err := ioutil.ReadAll(res.Body)
		if err != nil {
			return err
		}

		// unmarshal
		if z, ok := v.(easyjson.Unmarshaler); ok {
			return easyjson.Unmarshal(body, z)
		}

		return json.Unmarshal(body, v)
	}

	return nil
}

// ListTargets returns a list of all targets.
func (c *Client) ListTargets(ctxt context.Context) ([]Target, error) {
	var err error

	var l []json.RawMessage
	err = c.doReq(ctxt, "list", &l)
	if err != nil {
		return nil, err
	}

	t := make([]Target, len(l))
	for i, v := range l {
		t[i], err = c.newTarget(ctxt, v)
		if err != nil {
			return nil, err
		}
	}

	return t, nil
}

// ListTargetsWithType returns a list of Targets with the specified target
// type.
func (c *Client) ListTargetsWithType(ctxt context.Context, typ TargetType) ([]Target, error) {
	var err error

	targets, err := c.ListTargets(ctxt)
	if err != nil {
		return nil, err
	}

	var ret []Target
	for _, t := range targets {
		if t.GetType() == typ {
			ret = append(ret, t)
		}
	}

	return ret, nil
}

// ListPageTargets lists the available Page targets.
func (c *Client) ListPageTargets(ctxt context.Context) ([]Target, error) {
	return c.ListTargetsWithType(ctxt, Page)
}

var browserRE = regexp.MustCompile(`(?i)^(chrome|chromium|microsoft edge|safari)`)

// loadProtocolInfo loads the protocol information from the remote URL.
func (c *Client) loadProtocolInfo(ctxt context.Context) (string, string, error) {
	c.rw.Lock()
	defer c.rw.Unlock()

	if c.ver == "" || c.typ == "" {
		v, err := c.VersionInfo(ctxt)
		if err != nil {
			return "", "", err
		}

		if m := browserRE.FindAllStringSubmatch(v["Browser"], -1); len(m) != 0 {
			c.typ = strings.ToLower(m[0][0])
		}
		c.ver = v["Protocol-Version"]
	}

	return c.ver, c.typ, nil
}

// newTarget creates a new target.
func (c *Client) newTarget(ctxt context.Context, buf []byte) (Target, error) {
	var err error

	ver, typ, err := c.loadProtocolInfo(ctxt)
	if err != nil {
		return nil, err
	}

	if ver != "1.1" && ver != "1.2" {
		return nil, ErrUnsupportedProtocolVersion
	}

	switch typ {
	case "chrome", "chromium", "microsoft edge", "safari", "":
		x := new(Chrome)
		if buf != nil {
			err = easyjson.Unmarshal(buf, x)
			if err != nil {
				return nil, err
			}
		}

		return x, nil
	}

	return nil, ErrUnsupportedProtocolType
}

// NewPageTargetWithURL creates a new page target with the specified url.
func (c *Client) NewPageTargetWithURL(ctxt context.Context, urlstr string) (Target, error) {
	var err error

	t, err := c.newTarget(ctxt, nil)
	if err != nil {
		return nil, err
	}

	u := "new"
	if urlstr != "" {
		u += "?" + urlstr
	}

	err = c.doReq(ctxt, u, t)
	if err != nil {
		return nil, err
	}

	return t, nil
}

// NewPageTarget creates a new page target.
func (c *Client) NewPageTarget(ctxt context.Context) (Target, error) {
	return c.NewPageTargetWithURL(ctxt, "")
}

// ActivateTarget activates a target.
func (c *Client) ActivateTarget(ctxt context.Context, t Target) error {
	return c.doReq(ctxt, "activate/"+t.GetID(), nil)
}

// CloseTarget activates a target.
func (c *Client) CloseTarget(ctxt context.Context, t Target) error {
	return c.doReq(ctxt, "close/"+t.GetID(), nil)
}

// VersionInfo returns information about the remote debugging protocol.
func (c *Client) VersionInfo(ctxt context.Context) (map[string]string, error) {
	var err error

	v := map[string]string{}
	err = c.doReq(ctxt, "version", &v)
	if err != nil {
		return nil, err
	}

	return v, nil
}

// WatchPageTargets watches for new page targets.
func (c *Client) WatchPageTargets(ctxt context.Context) <-chan Target {
	if ctxt == nil {
		ctxt = context.Background()
	}

	ch := make(chan Target)
	go func() {
		defer close(ch)

		encountered := make(map[string]bool)
		check := func() error {
			targets, err := c.ListPageTargets(ctxt)
			if err != nil {
				return err
			}

			for _, t := range targets {
				if !encountered[t.GetID()] {
					ch <- t
				}
				encountered[t.GetID()] = true
			}
			return nil
		}

		var err error
		lastGood := time.Now()
		for {
			err = check()
			if err == nil {
				lastGood = time.Now()
			} else if time.Now().After(lastGood.Add(c.timeout)) {
				return
			}

			select {
			case <-time.After(c.check):
				continue

			case <-ctxt.Done():
				return
			}
		}
	}()

	return ch
}

// Option is a Chrome Debugging Protocol client option.
type Option func(*Client)

// URL is a client option to specify the remote Chrome instance to connect to.
func URL(url string) Option {
	return func(c *Client) {
		c.url = url
	}
}

// WatchInterval is a client option that specifies the check interval duration.
func WatchInterval(check time.Duration) Option {
	return func(c *Client) {
		c.check = check
	}
}

// WatchTimeout is a client option that specifies the watch timeout duration.
func WatchTimeout(timeout time.Duration) Option {
	return func(c *Client) {
		c.timeout = timeout
	}
}
