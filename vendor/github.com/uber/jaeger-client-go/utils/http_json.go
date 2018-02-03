// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package utils

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
)

// GetJSON makes an HTTP call to the specified URL and parses the returned JSON into `out`.
func GetJSON(url string, out interface{}) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	return ReadJSON(resp, out)
}

// ReadJSON reads JSON from http.Response and parses it into `out`
func ReadJSON(resp *http.Response, out interface{}) error {
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			return err
		}

		return fmt.Errorf("StatusCode: %d, Body: %s", resp.StatusCode, body)
	}

	if out == nil {
		io.Copy(ioutil.Discard, resp.Body)
		return nil
	}

	decoder := json.NewDecoder(resp.Body)
	return decoder.Decode(out)
}
