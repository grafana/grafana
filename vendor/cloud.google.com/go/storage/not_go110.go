// Copyright 2017 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// +build !go1.10

package storage

import (
	"net/url"
	"strings"

	"google.golang.org/api/googleapi"
)

func shouldRetry(err error) bool {
	switch e := err.(type) {
	case *googleapi.Error:
		// Retry on 429 and 5xx, according to
		// https://cloud.google.com/storage/docs/exponential-backoff.
		return e.Code == 429 || (e.Code >= 500 && e.Code < 600)
	case *url.Error:
		// Retry on REFUSED_STREAM.
		// Unfortunately the error type is unexported, so we resort to string
		// matching.
		return strings.Contains(e.Error(), "REFUSED_STREAM")
	case interface{ Temporary() bool }:
		return e.Temporary()
	default:
		return false
	}
}
