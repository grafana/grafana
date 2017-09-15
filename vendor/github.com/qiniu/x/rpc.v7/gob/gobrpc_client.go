package gob

import (
	"bytes"
	"encoding/gob"
	"io"
	"io/ioutil"
	"net/http"
	"strconv"

	"qiniupkg.com/x/rpc.v7"

	. "golang.org/x/net/context"
)

// ---------------------------------------------------------------------------

func Register(value interface{}) {

	gob.Register(value)
}

func RegisterName(name string, value interface{}) {

	gob.RegisterName(name, value)
}

// ---------------------------------------------------------------------------

func ResponseError(resp *http.Response) (err error) {

	e := &rpc.ErrorInfo{
		Reqid: resp.Header.Get("X-Reqid"),
		Code:  resp.StatusCode,
	}
	if resp.StatusCode > 299 {
		e.Err = resp.Header.Get("X-Err")
		if errno := resp.Header.Get("X-Errno"); errno != "" {
			v, err2 := strconv.ParseInt(errno, 10, 32)
			if err2 != nil {
				e.Err = err2.Error()
			}
			e.Errno = int(v)
		}
	}
	return e
}

func CallRet(ctx Context, ret interface{}, resp *http.Response) (err error) {

	defer func() {
		io.Copy(ioutil.Discard, resp.Body)
		resp.Body.Close()
	}()

	if resp.StatusCode/100 == 2 {
		if ret != nil && resp.ContentLength != 0 {
			err = gob.NewDecoder(resp.Body).Decode(ret)
			if err != nil {
				return
			}
		}
		if resp.StatusCode == 200 {
			return nil
		}
	}
	return ResponseError(resp)
}

// ---------------------------------------------------------------------------

type Client struct {
	rpc.Client
}

var (
	DefaultClient = Client{rpc.DefaultClient}
)

func (r Client) Call(
	ctx Context, ret interface{}, method, url1 string) (err error) {

	resp, err := r.DoRequestWith(ctx, method, url1, "application/gob", nil, 0)
	if err != nil {
		return err
	}
	return CallRet(ctx, ret, resp)
}

func (r Client) CallWithGob(
	ctx Context, ret interface{}, method, url1 string, params interface{}) (err error) {

	var b bytes.Buffer
	err = gob.NewEncoder(&b).Encode(params)
	if err != nil {
		return err
	}

	resp, err := r.DoRequestWith(ctx, method, url1, "application/gob", &b, b.Len())
	if err != nil {
		return err
	}
	return CallRet(ctx, ret, resp)
}

// ---------------------------------------------------------------------------

