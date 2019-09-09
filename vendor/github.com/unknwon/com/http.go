// Copyright 2013 com authors
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package com

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path"
)

type NotFoundError struct {
	Message string
}

func (e NotFoundError) Error() string {
	return e.Message
}

type RemoteError struct {
	Host string
	Err  error
}

func (e *RemoteError) Error() string {
	return e.Err.Error()
}

var UserAgent = "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1541.0 Safari/537.36"

// HttpCall makes HTTP method call.
func HttpCall(client *http.Client, method, url string, header http.Header, body io.Reader) (io.ReadCloser, error) {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", UserAgent)
	for k, vs := range header {
		req.Header[k] = vs
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode == 200 {
		return resp.Body, nil
	}
	resp.Body.Close()
	if resp.StatusCode == 404 { // 403 can be rate limit error.  || resp.StatusCode == 403 {
		err = fmt.Errorf("resource not found: %s", url)
	} else {
		err = fmt.Errorf("%s %s -> %d", method, url, resp.StatusCode)
	}
	return nil, err
}

// HttpGet gets the specified resource.
// ErrNotFound is returned if the server responds with status 404.
func HttpGet(client *http.Client, url string, header http.Header) (io.ReadCloser, error) {
	return HttpCall(client, "GET", url, header, nil)
}

// HttpPost posts the specified resource.
// ErrNotFound is returned if the server responds with status 404.
func HttpPost(client *http.Client, url string, header http.Header, body []byte) (io.ReadCloser, error) {
	return HttpCall(client, "POST", url, header, bytes.NewBuffer(body))
}

// HttpGetToFile gets the specified resource and writes to file.
// ErrNotFound is returned if the server responds with status 404.
func HttpGetToFile(client *http.Client, url string, header http.Header, fileName string) error {
	rc, err := HttpGet(client, url, header)
	if err != nil {
		return err
	}
	defer rc.Close()

	os.MkdirAll(path.Dir(fileName), os.ModePerm)
	f, err := os.Create(fileName)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, rc)
	return err
}

// HttpGetBytes gets the specified resource. ErrNotFound is returned if the server
// responds with status 404.
func HttpGetBytes(client *http.Client, url string, header http.Header) ([]byte, error) {
	rc, err := HttpGet(client, url, header)
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return ioutil.ReadAll(rc)
}

// HttpGetJSON gets the specified resource and mapping to struct.
// ErrNotFound is returned if the server responds with status 404.
func HttpGetJSON(client *http.Client, url string, v interface{}) error {
	rc, err := HttpGet(client, url, nil)
	if err != nil {
		return err
	}
	defer rc.Close()
	err = json.NewDecoder(rc).Decode(v)
	if _, ok := err.(*json.SyntaxError); ok {
		return fmt.Errorf("JSON syntax error at %s", url)
	}
	return nil
}

// HttpPostJSON posts the specified resource with struct values,
// and maps results to struct.
// ErrNotFound is returned if the server responds with status 404.
func HttpPostJSON(client *http.Client, url string, body, v interface{}) error {
	data, err := json.Marshal(body)
	if err != nil {
		return err
	}
	rc, err := HttpPost(client, url, http.Header{"content-type": []string{"application/json"}}, data)
	if err != nil {
		return err
	}
	defer rc.Close()
	err = json.NewDecoder(rc).Decode(v)
	if _, ok := err.(*json.SyntaxError); ok {
		return fmt.Errorf("JSON syntax error at %s", url)
	}
	return nil
}

// A RawFile describes a file that can be downloaded.
type RawFile interface {
	Name() string
	RawUrl() string
	Data() []byte
	SetData([]byte)
}

// FetchFiles fetches files specified by the rawURL field in parallel.
func FetchFiles(client *http.Client, files []RawFile, header http.Header) error {
	ch := make(chan error, len(files))
	for i := range files {
		go func(i int) {
			p, err := HttpGetBytes(client, files[i].RawUrl(), nil)
			if err != nil {
				ch <- err
				return
			}
			files[i].SetData(p)
			ch <- nil
		}(i)
	}
	for _ = range files {
		if err := <-ch; err != nil {
			return err
		}
	}
	return nil
}

// FetchFilesCurl uses command `curl` to fetch files specified by the rawURL field in parallel.
func FetchFilesCurl(files []RawFile, curlOptions ...string) error {
	ch := make(chan error, len(files))
	for i := range files {
		go func(i int) {
			stdout, _, err := ExecCmd("curl", append(curlOptions, files[i].RawUrl())...)
			if err != nil {
				ch <- err
				return
			}

			files[i].SetData([]byte(stdout))
			ch <- nil
		}(i)
	}
	for _ = range files {
		if err := <-ch; err != nil {
			return err
		}
	}
	return nil
}
