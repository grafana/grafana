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

package jwt

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

var (
	errTokenFileAccess = errors.New("token file access error")
	errJWTValidation   = errors.New("invalid JWT")
)

// jwtClaims represents the JWT claims structure for extracting expiration time.
type jwtClaims struct {
	Exp int64 `json:"exp"`
}

// jwtFileReader handles reading and parsing JWT tokens from files.
// It is safe to call methods on this type concurrently as no state is stored.
type jwtFileReader struct {
	tokenFilePath string
}

// readToken reads and parses a JWT token from the configured file.
// Returns the token string, expiration time, and any error encountered.
func (r *jwtFileReader) readToken() (string, time.Time, error) {
	tokenBytes, err := os.ReadFile(r.tokenFilePath)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("%v: %w", err, errTokenFileAccess)
	}

	token := strings.TrimSpace(string(tokenBytes))
	if token == "" {
		return "", time.Time{}, fmt.Errorf("token file %q is empty: %w", r.tokenFilePath, errJWTValidation)
	}

	exp, err := r.extractExpiration(token)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("token file %q: %v: %w", r.tokenFilePath, err, errJWTValidation)
	}

	return token, exp, nil
}

const tokenDelim = "."

// extractClaimsRaw returns the JWT's claims part as raw string. Even though the
// header and signature are not used, it still expects that the input string to
// be well-formed (ie comprised of exactly three parts, separated by a dot
// character).
func extractClaimsRaw(s string) (string, bool) {
	_, s, ok := strings.Cut(s, tokenDelim)
	if !ok { // no period found
		return "", false
	}
	claims, s, ok := strings.Cut(s, tokenDelim)
	if !ok { // only one period found
		return "", false
	}
	_, _, ok = strings.Cut(s, tokenDelim)
	if ok { // three periods found
		return "", false
	}
	return claims, true
}

// extractExpiration parses the JWT token to extract the expiration time.
func (r *jwtFileReader) extractExpiration(token string) (time.Time, error) {
	claimsRaw, ok := extractClaimsRaw(token)
	if !ok {
		return time.Time{}, fmt.Errorf("expected 3 parts in token")
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(claimsRaw)
	if err != nil {
		return time.Time{}, fmt.Errorf("decode error: %v", err)
	}

	var claims jwtClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return time.Time{}, fmt.Errorf("unmarshal error: %v", err)
	}

	if claims.Exp == 0 {
		return time.Time{}, fmt.Errorf("no expiration claims")
	}

	expTime := time.Unix(claims.Exp, 0)

	// Check if token is already expired.
	if expTime.Before(time.Now()) {
		return time.Time{}, fmt.Errorf("expired token")
	}

	return expTime, nil
}
