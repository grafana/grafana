// Copyright 2015 go-swagger maintainers
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package middleware

import (
	"net/http"

	"github.com/go-openapi/runtime"
)

type errorResp struct {
	code     int
	response interface{}
	headers  http.Header
}

func (e *errorResp) WriteResponse(rw http.ResponseWriter, producer runtime.Producer) {
	for k, v := range e.headers {
		for _, val := range v {
			rw.Header().Add(k, val)
		}
	}
	if e.code > 0 {
		rw.WriteHeader(e.code)
	} else {
		rw.WriteHeader(http.StatusInternalServerError)
	}
	if err := producer.Produce(rw, e.response); err != nil {
		Logger.Printf("failed to write error response: %v", err)
	}
}

// NotImplemented the error response when the response is not implemented
func NotImplemented(message string) Responder {
	return Error(http.StatusNotImplemented, message)
}

// Error creates a generic responder for returning errors, the data will be serialized
// with the matching producer for the request
func Error(code int, data interface{}, headers ...http.Header) Responder {
	var hdr http.Header
	for _, h := range headers {
		for k, v := range h {
			if hdr == nil {
				hdr = make(http.Header)
			}
			hdr[k] = v
		}
	}
	return &errorResp{
		code:     code,
		response: data,
		headers:  hdr,
	}
}
