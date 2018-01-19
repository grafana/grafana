// +build js

package http

import (
	"bufio"
	"bytes"
	"errors"
	"io/ioutil"
	"net/textproto"
	"strconv"

	"github.com/gopherjs/gopherjs/js"
)

var DefaultTransport = func() RoundTripper {
	switch {
	case js.Global.Get("fetch") != js.Undefined && js.Global.Get("ReadableStream") != js.Undefined: // ReadableStream is used as a check for support of streaming response bodies, see https://fetch.spec.whatwg.org/#streams.
		return &fetchTransport{}
	case js.Global.Get("XMLHttpRequest") != js.Undefined:
		return &XHRTransport{}
	default:
		return noTransport{}
	}
}()

// noTransport is used when neither Fetch API nor XMLHttpRequest API are available. It always fails.
type noTransport struct{}

func (noTransport) RoundTrip(req *Request) (*Response, error) {
	return nil, errors.New("net/http: neither of Fetch nor XMLHttpRequest APIs is available")
}

type XHRTransport struct {
	inflight map[*Request]*js.Object
}

func (t *XHRTransport) RoundTrip(req *Request) (*Response, error) {
	xhr := js.Global.Get("XMLHttpRequest").New()

	if t.inflight == nil {
		t.inflight = map[*Request]*js.Object{}
	}
	t.inflight[req] = xhr
	defer delete(t.inflight, req)

	respCh := make(chan *Response)
	errCh := make(chan error)

	xhr.Set("onload", func() {
		header, _ := textproto.NewReader(bufio.NewReader(bytes.NewReader([]byte(xhr.Call("getAllResponseHeaders").String() + "\n")))).ReadMIMEHeader()
		body := js.Global.Get("Uint8Array").New(xhr.Get("response")).Interface().([]byte)

		contentLength := int64(-1)
		switch req.Method {
		case "HEAD":
			if l, err := strconv.ParseInt(header.Get("Content-Length"), 10, 64); err == nil {
				contentLength = l
			}
		default:
			contentLength = int64(len(body))
		}

		respCh <- &Response{
			Status:        xhr.Get("status").String() + " " + xhr.Get("statusText").String(),
			StatusCode:    xhr.Get("status").Int(),
			Header:        Header(header),
			ContentLength: contentLength,
			Body:          ioutil.NopCloser(bytes.NewReader(body)),
			Request:       req,
		}
	})

	xhr.Set("onerror", func(e *js.Object) {
		errCh <- errors.New("net/http: XMLHttpRequest failed")
	})

	xhr.Set("onabort", func(e *js.Object) {
		errCh <- errors.New("net/http: request canceled")
	})

	xhr.Call("open", req.Method, req.URL.String())
	xhr.Set("responseType", "arraybuffer") // has to be after "open" until https://bugzilla.mozilla.org/show_bug.cgi?id=1110761 is resolved
	for key, values := range req.Header {
		for _, value := range values {
			xhr.Call("setRequestHeader", key, value)
		}
	}
	if req.Body == nil {
		xhr.Call("send")
	} else {
		body, err := ioutil.ReadAll(req.Body)
		if err != nil {
			req.Body.Close() // RoundTrip must always close the body, including on errors.
			return nil, err
		}
		req.Body.Close()
		xhr.Call("send", body)
	}

	select {
	case resp := <-respCh:
		return resp, nil
	case err := <-errCh:
		return nil, err
	}
}

func (t *XHRTransport) CancelRequest(req *Request) {
	if xhr, ok := t.inflight[req]; ok {
		xhr.Call("abort")
	}
}
