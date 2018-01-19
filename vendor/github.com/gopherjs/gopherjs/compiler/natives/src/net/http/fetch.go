// +build js

package http

import (
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"strconv"

	"github.com/gopherjs/gopherjs/js"
)

// streamReader implements an io.ReadCloser wrapper for ReadableStream of https://fetch.spec.whatwg.org/.
type streamReader struct {
	pending []byte
	stream  *js.Object
}

func (r *streamReader) Read(p []byte) (n int, err error) {
	if len(r.pending) == 0 {
		var (
			bCh   = make(chan []byte)
			errCh = make(chan error)
		)
		r.stream.Call("read").Call("then",
			func(result *js.Object) {
				if result.Get("done").Bool() {
					errCh <- io.EOF
					return
				}
				bCh <- result.Get("value").Interface().([]byte)
			},
			func(reason *js.Object) {
				// Assumes it's a DOMException.
				errCh <- errors.New(reason.Get("message").String())
			},
		)
		select {
		case b := <-bCh:
			r.pending = b
		case err := <-errCh:
			return 0, err
		}
	}
	n = copy(p, r.pending)
	r.pending = r.pending[n:]
	return n, nil
}

func (r *streamReader) Close() error {
	// This ignores any error returned from cancel method. So far, I did not encounter any concrete
	// situation where reporting the error is meaningful. Most users ignore error from resp.Body.Close().
	// If there's a need to report error here, it can be implemented and tested when that need comes up.
	r.stream.Call("cancel")
	return nil
}

// fetchTransport is a RoundTripper that is implemented using Fetch API. It supports streaming
// response bodies.
type fetchTransport struct{}

func (t *fetchTransport) RoundTrip(req *Request) (*Response, error) {
	headers := js.Global.Get("Headers").New()
	for key, values := range req.Header {
		for _, value := range values {
			headers.Call("append", key, value)
		}
	}
	opt := map[string]interface{}{
		"method":      req.Method,
		"headers":     headers,
		"credentials": "same-origin",
	}
	if req.Body != nil {
		// TODO: Find out if request body can be streamed into the fetch request rather than in advance here.
		//       See BufferSource at https://fetch.spec.whatwg.org/#body-mixin.
		body, err := ioutil.ReadAll(req.Body)
		if err != nil {
			req.Body.Close() // RoundTrip must always close the body, including on errors.
			return nil, err
		}
		req.Body.Close()
		opt["body"] = body
	}
	respPromise := js.Global.Call("fetch", req.URL.String(), opt)

	var (
		respCh = make(chan *Response)
		errCh  = make(chan error)
	)
	respPromise.Call("then",
		func(result *js.Object) {
			header := Header{}
			result.Get("headers").Call("forEach", func(value, key *js.Object) {
				ck := CanonicalHeaderKey(key.String())
				header[ck] = append(header[ck], value.String())
			})

			contentLength := int64(-1)
			if cl, err := strconv.ParseInt(header.Get("Content-Length"), 10, 64); err == nil {
				contentLength = cl
			}

			select {
			case respCh <- &Response{
				Status:        result.Get("status").String() + " " + StatusText(result.Get("status").Int()),
				StatusCode:    result.Get("status").Int(),
				Header:        header,
				ContentLength: contentLength,
				Body:          &streamReader{stream: result.Get("body").Call("getReader")},
				Request:       req,
			}:
			case <-req.Context().Done():
			}
		},
		func(reason *js.Object) {
			select {
			case errCh <- fmt.Errorf("net/http: fetch() failed: %s", reason.String()):
			case <-req.Context().Done():
			}
		},
	)
	select {
	case <-req.Context().Done():
		// TODO: Abort request if possible using Fetch API.
		return nil, errors.New("net/http: request canceled")
	case resp := <-respCh:
		return resp, nil
	case err := <-errCh:
		return nil, err
	}
}
