// Copyright 2023 Google LLC
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

package transport

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"log/slog"
	"os"
	"strconv"
	"sync"

	"cloud.google.com/go/auth/internal/transport/cert"
	"cloud.google.com/go/compute/metadata"
)

const (
	configEndpointSuffix = "instance/platform-security/auto-mtls-configuration"
)

var (
	mtlsConfiguration *mtlsConfig

	mtlsOnce sync.Once
)

// GetS2AAddress returns the S2A address to be reached via plaintext connection.
// Returns empty string if not set or invalid.
func GetS2AAddress(logger *slog.Logger) string {
	getMetadataMTLSAutoConfig(logger)
	if !mtlsConfiguration.valid() {
		return ""
	}
	return mtlsConfiguration.S2A.PlaintextAddress
}

// GetMTLSS2AAddress returns the S2A address to be reached via MTLS connection.
// Returns empty string if not set or invalid.
func GetMTLSS2AAddress(logger *slog.Logger) string {
	getMetadataMTLSAutoConfig(logger)
	if !mtlsConfiguration.valid() {
		return ""
	}
	return mtlsConfiguration.S2A.MTLSAddress
}

// mtlsConfig contains the configuration for establishing MTLS connections with Google APIs.
type mtlsConfig struct {
	S2A *s2aAddresses `json:"s2a"`
}

func (c *mtlsConfig) valid() bool {
	return c != nil && c.S2A != nil
}

// s2aAddresses contains the plaintext and/or MTLS S2A addresses.
type s2aAddresses struct {
	// PlaintextAddress is the plaintext address to reach S2A
	PlaintextAddress string `json:"plaintext_address"`
	// MTLSAddress is the MTLS address to reach S2A
	MTLSAddress string `json:"mtls_address"`
}

func getMetadataMTLSAutoConfig(logger *slog.Logger) {
	var err error
	mtlsOnce.Do(func() {
		mtlsConfiguration, err = queryConfig(logger)
		if err != nil {
			log.Printf("Getting MTLS config failed: %v", err)
		}
	})
}

var httpGetMetadataMTLSConfig = func(logger *slog.Logger) (string, error) {
	metadataClient := metadata.NewWithOptions(&metadata.Options{
		Logger: logger,
	})
	return metadataClient.GetWithContext(context.Background(), configEndpointSuffix)
}

func queryConfig(logger *slog.Logger) (*mtlsConfig, error) {
	resp, err := httpGetMetadataMTLSConfig(logger)
	if err != nil {
		return nil, fmt.Errorf("querying MTLS config from MDS endpoint failed: %w", err)
	}
	var config mtlsConfig
	err = json.Unmarshal([]byte(resp), &config)
	if err != nil {
		return nil, fmt.Errorf("unmarshalling MTLS config from MDS endpoint failed: %w", err)
	}
	if config.S2A == nil {
		return nil, fmt.Errorf("returned MTLS config from MDS endpoint is invalid: %v", config)
	}
	return &config, nil
}

func shouldUseS2A(clientCertSource cert.Provider, opts *Options) bool {
	// If client cert is found, use that over S2A.
	if clientCertSource != nil {
		return false
	}
	// If EXPERIMENTAL_GOOGLE_API_USE_S2A is not set to true, skip S2A.
	if !isGoogleS2AEnabled() {
		return false
	}
	// If DefaultMTLSEndpoint is not set or has endpoint override, skip S2A.
	if opts.DefaultMTLSEndpoint == "" || opts.Endpoint != "" {
		return false
	}
	// If custom HTTP client is provided, skip S2A.
	if opts.Client != nil {
		return false
	}
	// If directPath is enabled, skip S2A.
	return !opts.EnableDirectPath && !opts.EnableDirectPathXds
}

func isGoogleS2AEnabled() bool {
	b, err := strconv.ParseBool(os.Getenv(googleAPIUseS2AEnv))
	if err != nil {
		return false
	}
	return b
}
