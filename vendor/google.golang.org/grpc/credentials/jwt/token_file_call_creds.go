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
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/internal/backoff"
	"google.golang.org/grpc/status"
)

const preemptiveRefreshThreshold = time.Minute

// jwtTokenFileCallCreds provides JWT token-based PerRPCCredentials that reads
// tokens from a file.
// This implementation follows the A97 JWT Call Credentials specification.
type jwtTokenFileCallCreds struct {
	fileReader      *jwtFileReader
	backoffStrategy backoff.Strategy

	// cached data protected by mu
	mu               sync.Mutex
	cachedAuthHeader string    // "Bearer " + token
	cachedExpiry     time.Time // Slightly less than actual expiration time
	cachedError      error     // Error from last failed attempt
	retryAttempt     int       // Current retry attempt number
	nextRetryTime    time.Time // When next retry is allowed
	pendingRefresh   bool      // Whether a refresh is currently in progress
}

// NewTokenFileCallCredentials creates PerRPCCredentials that reads JWT tokens
// from the specified file path.
func NewTokenFileCallCredentials(tokenFilePath string) (credentials.PerRPCCredentials, error) {
	if tokenFilePath == "" {
		return nil, fmt.Errorf("tokenFilePath cannot be empty")
	}

	creds := &jwtTokenFileCallCreds{
		fileReader:      &jwtFileReader{tokenFilePath: tokenFilePath},
		backoffStrategy: backoff.DefaultExponential,
	}

	return creds, nil
}

// GetRequestMetadata gets the current request metadata, refreshing tokens if
// required. This implementation follows the PerRPCCredentials interface.  The
// tokens will get automatically refreshed if they are about to expire or if
// they haven't been loaded successfully yet.
// If it's not possible to extract a token from the file, UNAVAILABLE is
// returned.
// If the token is extracted but invalid, then UNAUTHENTICATED is returned.
// If errors are encoutered, a backoff is applied before retrying.
func (c *jwtTokenFileCallCreds) GetRequestMetadata(ctx context.Context, _ ...string) (map[string]string, error) {
	ri, _ := credentials.RequestInfoFromContext(ctx)
	if err := credentials.CheckSecurityLevel(ri.AuthInfo, credentials.PrivacyAndIntegrity); err != nil {
		return nil, fmt.Errorf("cannot send secure credentials on an insecure connection: %v", err)
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.isTokenValidLocked() {
		needsPreemptiveRefresh := time.Until(c.cachedExpiry) < preemptiveRefreshThreshold
		if needsPreemptiveRefresh && !c.pendingRefresh {
			// Start refresh if not pending (handling the prior RPC may have
			// just spawned a goroutine).
			c.pendingRefresh = true
			go c.refreshToken()
		}
		return map[string]string{
			"authorization": c.cachedAuthHeader,
		}, nil
	}

	// If in backoff state, just return the cached error.
	if c.cachedError != nil && time.Now().Before(c.nextRetryTime) {
		return nil, c.cachedError
	}

	// At this point, the token is either invalid or expired and we are no
	// longer backing off from any encountered errors. So refresh it.
	// NB: We are holding the lock while reading the token from file. This will
	// cause other RPCs to block until the read completes (sucecssfully or not)
	// and the cache is updated. Subsequent RPCs will end up using the cache.
	// This is per A97.
	token, expiry, err := c.fileReader.readToken()
	c.updateCacheLocked(token, expiry, err)

	if c.cachedError != nil {
		return nil, c.cachedError
	}
	return map[string]string{
		"authorization": c.cachedAuthHeader,
	}, nil
}

// RequireTransportSecurity indicates whether the credentials requires
// transport security.
func (c *jwtTokenFileCallCreds) RequireTransportSecurity() bool {
	return true
}

// isTokenValidLocked checks if the cached token is still valid.
// Caller must hold c.mu lock.
func (c *jwtTokenFileCallCreds) isTokenValidLocked() bool {
	if c.cachedAuthHeader == "" {
		return false
	}
	return c.cachedExpiry.After(time.Now())
}

// refreshToken reads the token from file and updates the cached data.
func (c *jwtTokenFileCallCreds) refreshToken() {
	// Deliberately not locking c.mu here. This way other RPCs can proceed
	// while we read the token. This is per gRFC A97.
	token, expiry, err := c.fileReader.readToken()

	c.mu.Lock()
	defer c.mu.Unlock()
	c.updateCacheLocked(token, expiry, err)
	c.pendingRefresh = false
}

// updateCacheLocked updates the cached token, expiry, and error state.
// If an error is provided, it determines whether to set it as an UNAVAILABLE
// or UNAUTHENTICATED error based on the error type.
// NOTE: This method (and its callers) do not queue up a token refresh/retry if
// the expiration is soon / an error was encountered. Instead, this is done when
// handling RPCs. This is as per gRFC A97, which states that it is
// undesirable to retry loading the token if the channel is idle.
// Caller must hold c.mu lock.
func (c *jwtTokenFileCallCreds) updateCacheLocked(token string, expiry time.Time, err error) {
	if err != nil {
		// Convert to gRPC status codes
		if errors.Is(err, errTokenFileAccess) {
			c.cachedError = status.Error(codes.Unavailable, err.Error())
		} else if errors.Is(err, errJWTValidation) {
			c.cachedError = status.Error(codes.Unauthenticated, err.Error())
		} else {
			// Should not happen. Treat unknown errors as UNAUTHENTICATED.
			c.cachedError = status.Error(codes.Unauthenticated, err.Error())
		}
		c.retryAttempt++
		backoffDelay := c.backoffStrategy.Backoff(c.retryAttempt - 1)
		c.nextRetryTime = time.Now().Add(backoffDelay)
		return
	}
	// Success - clear any cached error and update token cache
	c.cachedError = nil
	c.retryAttempt = 0
	c.nextRetryTime = time.Time{}

	c.cachedAuthHeader = "Bearer " + token
	// Per gRFC A97: consider token invalid if it expires within the next 30
	// seconds to accommodate for clock skew and server processing time.
	c.cachedExpiry = expiry.Add(-30 * time.Second)
}
