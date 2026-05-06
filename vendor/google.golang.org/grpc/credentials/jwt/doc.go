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

// Package jwt implements JWT token file-based call credentials.
//
// This package provides support for A97 JWT Call Credentials, allowing gRPC
// clients to authenticate using JWT tokens read from files. While originally
// designed for xDS environments, these credentials are general-purpose.
//
// The credentials can be used directly in gRPC clients or configured via xDS.
//
// # Token Requirements
//
// JWT tokens must:
//   - Be valid, well-formed JWT tokens with header, payload, and signature
//   - Include an "exp" (expiration) claim
//   - Be readable from the specified file path
//
// # Considerations
//
// - Tokens are cached until expiration to avoid excessive file I/O
// - Transport security is required (RequireTransportSecurity returns true)
// - Errors in reading tokens or parsing JWTs will result in RPC UNAVAILALBE or
// UNAUTHENTICATED errors. The errors are cached and retried with exponential
// backoff.
//
// This implementation is originally intended for use in service mesh
// environments like Istio where JWT tokens are provisioned and rotated by the
// infrastructure.
//
// # Experimental
//
// Notice: All APIs in this package are experimental and may be removed in a
// later release.
package jwt
