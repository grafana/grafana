// Copyright 2019 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package http

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"io"
	"io/ioutil"
	"net/http"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/internal/task"
)

func init() {
	task.Register("tool/http.Do", newHTTPCmd)

	// For backwards compatibility.
	task.Register("http", newHTTPCmd)
}

type httpCmd struct{}

func newHTTPCmd(v cue.Value) (task.Runner, error) {
	return &httpCmd{}, nil
}

func (c *httpCmd) Run(ctx *task.Context) (res interface{}, err error) {
	var header, trailer http.Header
	var (
		method = ctx.String("method")
		u      = ctx.String("url")
	)
	var r io.Reader
	if obj := ctx.Obj.Lookup("request"); obj.Exists() {
		if v := obj.Lookup("body"); v.Exists() {
			r, err = v.Reader()
			if err != nil {
				return nil, err
			}
		} else {
			r = bytes.NewReader([]byte(""))
		}
		if header, err = parseHeaders(obj, "header"); err != nil {
			return nil, err
		}
		if trailer, err = parseHeaders(obj, "trailer"); err != nil {
			return nil, err
		}
	}

	var caCert []byte
	caCertValue := ctx.Obj.LookupPath(cue.ParsePath("tls.caCert"))
	if caCertValue.Exists() {
		caCert, err = caCertValue.Bytes()
		if err != nil {
			return nil, errors.Wrapf(err, caCertValue.Pos(), "invalid bytes value")
		}
	}

	tlsVerify := true
	tlsVerifyValue := ctx.Obj.LookupPath(cue.ParsePath("tls.verify"))
	if tlsVerifyValue.Exists() {
		tlsVerify, err = tlsVerifyValue.Bool()
		if err != nil {
			return nil, errors.Wrapf(err, tlsVerifyValue.Pos(), "invalid bool value")
		}
	}

	if ctx.Err != nil {
		return nil, ctx.Err
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{}

	if !tlsVerify {
		transport.TLSClientConfig.InsecureSkipVerify = true
	}
	if tlsVerify && len(caCert) > 0 {
		pool := x509.NewCertPool()
		for {
			block, rest := pem.Decode(caCert)
			if block == nil {
				break
			}
			if block.Type == "PUBLIC KEY" {
				c, err := x509.ParseCertificate(block.Bytes)
				if err != nil {
					return nil, errors.Wrapf(err, ctx.Obj.Pos(), "failed to parse caCert")
				}
				pool.AddCert(c)
			}
			caCert = rest
		}
		transport.TLSClientConfig.RootCAs = pool
	}

	client := &http.Client{
		Transport: transport,
		// TODO: timeout
	}

	req, err := http.NewRequest(method, u, r)
	if err != nil {
		return nil, err
	}
	req.Header = header
	req.Trailer = trailer

	// TODO: retry logic
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, err := ioutil.ReadAll(resp.Body)
	// parse response body and headers
	return map[string]interface{}{
		"response": map[string]interface{}{
			"status":     resp.Status,
			"statusCode": resp.StatusCode,
			"body":       string(b),
			"header":     resp.Header,
			"trailer":    resp.Trailer,
		},
	}, err
}

func parseHeaders(obj cue.Value, label string) (http.Header, error) {
	m := obj.Lookup(label)
	if !m.Exists() {
		return nil, nil
	}
	iter, err := m.Fields()
	if err != nil {
		return nil, err
	}
	h := http.Header{}
	for iter.Next() {
		str, err := iter.Value().String()
		if err != nil {
			return nil, err
		}
		h.Add(iter.Label(), str)
	}
	return h, nil
}
