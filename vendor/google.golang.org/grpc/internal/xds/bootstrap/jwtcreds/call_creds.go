/*
 *
 * Copyright 2025 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

// Package jwtcreds implements JWT CallCredentials for XDS, configured via xDS
// Bootstrap File. For more details, see gRFC A97:
// https://github.com/grpc/proposal/blob/master/A97-xds-jwt-call-creds.md
package jwtcreds

import (
	"encoding/json"
	"fmt"

	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/jwt"
)

// NewCallCredentials returns a new JWT token based call credentials. The input
// config must match the structure specified in gRFC A97.
//
// The caller is expected to invoke the cancel function when they are done using
// the returned call creds. This cancel function is idempotent.
func NewCallCredentials(configJSON json.RawMessage) (c credentials.PerRPCCredentials, cancel func(), err error) {
	var cfg struct {
		JWTTokenFile string `json:"jwt_token_file"`
	}
	emptyFn := func() {}

	if err := json.Unmarshal(configJSON, &cfg); err != nil {
		return nil, emptyFn, fmt.Errorf("failed to unmarshal JWT call credentials config: %v", err)
	}
	if cfg.JWTTokenFile == "" {
		return nil, emptyFn, fmt.Errorf("jwt_token_file is required in JWT call credentials config")
	}
	callCreds, err := jwt.NewTokenFileCallCredentials(cfg.JWTTokenFile)
	if err != nil {
		return nil, emptyFn, fmt.Errorf("failed to create JWT call credentials: %v", err)
	}
	return callCreds, emptyFn, nil
}
