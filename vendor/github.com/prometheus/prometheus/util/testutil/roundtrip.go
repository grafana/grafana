// Copyright 2017 The Prometheus Authors
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

package testutil

import (
	"net/http"
)

type roundTrip struct {
	theResponse *http.Response
	theError    error
}

func (rt *roundTrip) RoundTrip(r *http.Request) (*http.Response, error) {
	return rt.theResponse, rt.theError
}

type roundTripCheckRequest struct {
	checkRequest func(*http.Request)
	roundTrip
}

func (rt *roundTripCheckRequest) RoundTrip(r *http.Request) (*http.Response, error) {
	rt.checkRequest(r)
	return rt.theResponse, rt.theError
}

// NewRoundTripCheckRequest creates a new instance of a type that implements http.RoundTripper,
// which before returning theResponse and theError, executes checkRequest against a http.Request.
func NewRoundTripCheckRequest(checkRequest func(*http.Request), theResponse *http.Response, theError error) http.RoundTripper {
	return &roundTripCheckRequest{
		checkRequest: checkRequest,
		roundTrip: roundTrip{
			theResponse: theResponse,
			theError:    theError}}
}
