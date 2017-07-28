package rpc

import (
	"fmt"
	"net/http"
	"testing"
)

// --------------------------------------------------------------------

func TestNewRequest(t *testing.T) {

	req, err := http.NewRequest("GET", "-H\t abc.com \thttp://127.0.0.1/foo/bar", nil)
	if err != nil {
		t.Fatal("http.NewRequest failed")
	}
	if req.Host != "" {
		t.Fatal(`http.NewRequest: req.Host != ""`)
	}

	req, err = newRequest("GET", "-H\t abc.com \thttp://127.0.0.1/foo/bar", nil)
	if err != nil {
		t.Fatal("newRequest failed:", err)
	}

	fmt.Println("Host:", req.Host, "path:", req.URL.Path, "url.host:", req.URL.Host)

	if req.Host != "abc.com" || req.URL.Path != "/foo/bar" || req.URL.Host != "127.0.0.1" {
		t.Fatal(`req.Host != "abc.com" || req.URL.Path != "/foo/bar" || req.URL.Host != "127.0.0.1"`)
	}
}

// --------------------------------------------------------------------

type transport struct {
	a http.RoundTripper
}

func (p *transport) RoundTrip(req *http.Request) (resp *http.Response, err error) {
	return p.a.RoundTrip(req)
}

func (p *transport) NestedObject() interface{} {
	return p.a
}

func Test_getRequestCanceler(t *testing.T) {

	p := &transport{a: http.DefaultTransport}
	if _, ok := getRequestCanceler(p); !ok {
		t.Fatal("getRequestCanceler failed")
	}

	p2 := &transport{a: p}
	if _, ok := getRequestCanceler(p2); !ok {
		t.Fatal("getRequestCanceler(p2) failed")
	}

	p3 := &transport{}
	if _, ok := getRequestCanceler(p3); ok {
		t.Fatal("getRequestCanceler(p3)?")
	}
}

// --------------------------------------------------------------------

