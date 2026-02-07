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

package client

import (
	"encoding/base64"

	"github.com/go-openapi/strfmt"

	"github.com/go-openapi/runtime"
)

// PassThroughAuth never manipulates the request
var PassThroughAuth runtime.ClientAuthInfoWriter

func init() {
	PassThroughAuth = runtime.ClientAuthInfoWriterFunc(func(_ runtime.ClientRequest, _ strfmt.Registry) error { return nil })
}

// BasicAuth provides a basic auth info writer
func BasicAuth(username, password string) runtime.ClientAuthInfoWriter {
	return runtime.ClientAuthInfoWriterFunc(func(r runtime.ClientRequest, _ strfmt.Registry) error {
		encoded := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
		return r.SetHeaderParam(runtime.HeaderAuthorization, "Basic "+encoded)
	})
}

// APIKeyAuth provides an API key auth info writer
func APIKeyAuth(name, in, value string) runtime.ClientAuthInfoWriter {
	if in == "query" {
		return runtime.ClientAuthInfoWriterFunc(func(r runtime.ClientRequest, _ strfmt.Registry) error {
			return r.SetQueryParam(name, value)
		})
	}

	if in == "header" {
		return runtime.ClientAuthInfoWriterFunc(func(r runtime.ClientRequest, _ strfmt.Registry) error {
			return r.SetHeaderParam(name, value)
		})
	}
	return nil
}

// BearerToken provides a header based oauth2 bearer access token auth info writer
func BearerToken(token string) runtime.ClientAuthInfoWriter {
	return runtime.ClientAuthInfoWriterFunc(func(r runtime.ClientRequest, _ strfmt.Registry) error {
		return r.SetHeaderParam(runtime.HeaderAuthorization, "Bearer "+token)
	})
}

// Compose combines multiple ClientAuthInfoWriters into a single one.
// Useful when multiple auth headers are needed.
func Compose(auths ...runtime.ClientAuthInfoWriter) runtime.ClientAuthInfoWriter {
	return runtime.ClientAuthInfoWriterFunc(func(r runtime.ClientRequest, _ strfmt.Registry) error {
		for _, auth := range auths {
			if auth == nil {
				continue
			}
			if err := auth.AuthenticateRequest(r, nil); err != nil {
				return err
			}
		}
		return nil
	})
}
