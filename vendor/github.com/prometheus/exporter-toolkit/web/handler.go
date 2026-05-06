// Copyright 2020 The Prometheus Authors
// This code is partly borrowed from Caddy:
//    Copyright 2015 Matthew Holt and The Caddy Authors
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

package web

import (
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"

	"golang.org/x/crypto/bcrypt"
)

// extraHTTPHeaders is a map of HTTP headers that can be added to HTTP
// responses.
// This is private on purpose to ensure consistency in the Prometheus ecosystem.
var extraHTTPHeaders = map[string][]string{
	"Strict-Transport-Security": nil,
	"X-Content-Type-Options":    {"nosniff"},
	"X-Frame-Options":           {"deny", "sameorigin"},
	"X-XSS-Protection":          nil,
	"Content-Security-Policy":   nil,
}

func validateUsers(configPath string) error {
	c, err := getConfig(configPath)
	if err != nil {
		return err
	}

	for _, p := range c.Users {
		_, err = bcrypt.Cost([]byte(p))
		if err != nil {
			return err
		}
	}

	return nil
}

// validateHeaderConfig checks that the provided header configuration is correct.
// It does not check the validity of all the values, only the ones which are
// well-defined enumerations.
func validateHeaderConfig(headers map[string]string) error {
HeadersLoop:
	for k, v := range headers {
		values, ok := extraHTTPHeaders[k]
		if !ok {
			return fmt.Errorf("HTTP header %q can not be configured", k)
		}
		for _, allowedValue := range values {
			if v == allowedValue {
				continue HeadersLoop
			}
		}
		if len(values) > 0 {
			return fmt.Errorf("invalid value for %s. Expected one of: %q, but got: %q", k, values, v)
		}
	}
	return nil
}

type webHandler struct {
	tlsConfigPath string
	handler       http.Handler
	logger        *slog.Logger
	cache         *cache
	// bcryptMtx is there to ensure that bcrypt.CompareHashAndPassword is run
	// only once in parallel as this is CPU intensive.
	bcryptMtx sync.Mutex
}

func (u *webHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	c, err := getConfig(u.tlsConfigPath)
	if err != nil {
		u.logger.Error("Unable to parse configuration", "err", err.Error())
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
		return
	}

	// Configure http headers.
	for k, v := range c.HTTPConfig.Header {
		w.Header().Set(k, v)
	}

	if len(c.Users) == 0 {
		u.handler.ServeHTTP(w, r)
		return
	}

	user, pass, auth := r.BasicAuth()
	if auth {
		hashedPassword, validUser := c.Users[user]

		if !validUser {
			// The user is not found. Use a fixed password hash to
			// prevent user enumeration by timing requests.
			// This is a bcrypt-hashed version of "fakepassword".
			hashedPassword = "$2y$10$QOauhQNbBCuQDKes6eFzPeMqBSjb7Mr5DUmpZ/VcEd00UAV/LDeSi"
		}

		cacheKey := strings.Join(
			[]string{
				hex.EncodeToString([]byte(user)),
				hex.EncodeToString([]byte(hashedPassword)),
				hex.EncodeToString([]byte(pass)),
			}, ":")
		authOk, ok := u.cache.get(cacheKey)

		if !ok {
			// This user, hashedPassword, password is not cached.
			u.bcryptMtx.Lock()
			err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(pass))
			u.bcryptMtx.Unlock()

			authOk = validUser && err == nil
			u.cache.set(cacheKey, authOk)
		}

		if authOk && validUser {
			u.handler.ServeHTTP(w, r)
			return
		}
	}

	w.Header().Set("WWW-Authenticate", "Basic")
	http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
}
