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

package grpctransport

import (
	"context"
	"net"
	"os"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/auth/credentials"
	"cloud.google.com/go/auth/internal/compute"
	"golang.org/x/time/rate"
	"google.golang.org/grpc"
	grpcgoogle "google.golang.org/grpc/credentials/google"
)

var logRateLimiter = rate.Sometimes{Interval: 1 * time.Second}

func isDirectPathEnabled(endpoint string, opts *Options) bool {
	if opts.InternalOptions != nil && !opts.InternalOptions.EnableDirectPath {
		return false
	}
	if !checkDirectPathEndPoint(endpoint) {
		return false
	}
	if b, _ := strconv.ParseBool(os.Getenv(disableDirectPathEnvVar)); b {
		return false
	}
	return true
}

func checkDirectPathEndPoint(endpoint string) bool {
	// Only [dns:///]host[:port] is supported, not other schemes (e.g., "tcp://" or "unix://").
	// Also don't try direct path if the user has chosen an alternate name resolver
	// (i.e., via ":///" prefix).
	if strings.Contains(endpoint, "://") && !strings.HasPrefix(endpoint, "dns:///") {
		return false
	}

	if endpoint == "" {
		return false
	}

	return true
}

func isTokenProviderComputeEngine(tp auth.TokenProvider) bool {
	if tp == nil {
		return false
	}
	tok, err := tp.Token(context.Background())
	if err != nil {
		return false
	}
	if tok == nil {
		return false
	}
	if tok.MetadataString("auth.google.tokenSource") != "compute-metadata" {
		return false
	}
	if tok.MetadataString("auth.google.serviceAccount") != "default" {
		return false
	}
	return true
}

func isTokenProviderDirectPathCompatible(tp auth.TokenProvider, o *Options) bool {
	if tp == nil {
		return false
	}
	if o.InternalOptions != nil && o.InternalOptions.EnableNonDefaultSAForDirectPath {
		return true
	}
	return isTokenProviderComputeEngine(tp)
}

func isDirectPathXdsUsed(o *Options) bool {
	// Method 1: Enable DirectPath xDS by env;
	if b, _ := strconv.ParseBool(os.Getenv(enableDirectPathXdsEnvVar)); b {
		return true
	}
	// Method 2: Enable DirectPath xDS by option;
	if o.InternalOptions != nil && o.InternalOptions.EnableDirectPathXds {
		return true
	}
	return false
}

func isDirectPathBoundTokenEnabled(opts *InternalOptions) bool {
	for _, ev := range opts.AllowHardBoundTokens {
		if ev == "ALTS" {
			return true
		}
	}
	return false
}

// configureDirectPath returns some dial options and an endpoint to use if the
// configuration allows the use of direct path. If it does not the provided
// grpcOpts and endpoint are returned.
func configureDirectPath(grpcOpts []grpc.DialOption, opts *Options, endpoint string, creds *auth.Credentials) ([]grpc.DialOption, string, error) {
	logRateLimiter.Do(func() {
		logDirectPathMisconfig(endpoint, creds, opts)
	})
	if isDirectPathEnabled(endpoint, opts) && compute.OnComputeEngine() && isTokenProviderDirectPathCompatible(creds, opts) {
		// Overwrite all of the previously specific DialOptions, DirectPath uses its own set of credentials and certificates.
		defaultCredetialsOptions := grpcgoogle.DefaultCredentialsOptions{PerRPCCreds: &grpcCredentialsProvider{creds: creds}}
		if isDirectPathBoundTokenEnabled(opts.InternalOptions) && isTokenProviderComputeEngine(creds) {
			optsClone := opts.resolveDetectOptions()
			optsClone.TokenBindingType = credentials.ALTSHardBinding
			altsCreds, err := credentials.DetectDefault(optsClone)
			if err != nil {
				return nil, "", err
			}
			defaultCredetialsOptions.ALTSPerRPCCreds = &grpcCredentialsProvider{creds: altsCreds}
		}
		grpcOpts = []grpc.DialOption{
			grpc.WithCredentialsBundle(grpcgoogle.NewDefaultCredentialsWithOptions(defaultCredetialsOptions))}
		if timeoutDialerOption != nil {
			grpcOpts = append(grpcOpts, timeoutDialerOption)
		}
		// Check if google-c2p resolver is enabled for DirectPath
		if isDirectPathXdsUsed(opts) {
			// google-c2p resolver target must not have a port number
			if addr, _, err := net.SplitHostPort(endpoint); err == nil {
				endpoint = "google-c2p:///" + addr
			} else {
				endpoint = "google-c2p:///" + endpoint
			}
		} else {
			if !strings.HasPrefix(endpoint, "dns:///") {
				endpoint = "dns:///" + endpoint
			}
			grpcOpts = append(grpcOpts,
				// For now all DirectPath go clients will be using the following lb config, but in future
				// when different services need different configs, then we should change this to a
				// per-service config.
				grpc.WithDisableServiceConfig(),
				grpc.WithDefaultServiceConfig(`{"loadBalancingConfig":[{"grpclb":{"childPolicy":[{"pick_first":{}}]}}]}`))
		}
		// TODO: add support for system parameters (quota project, request reason) via chained interceptor.
	}
	return grpcOpts, endpoint, nil
}

func logDirectPathMisconfig(endpoint string, creds *auth.Credentials, o *Options) {

	// Case 1: does not enable DirectPath
	if !isDirectPathEnabled(endpoint, o) {
		o.logger().Warn("DirectPath is disabled. To enable, please set the EnableDirectPath option along with the EnableDirectPathXds option.")
	} else {
		// Case 2: credential is not correctly set
		if !isTokenProviderDirectPathCompatible(creds, o) {
			o.logger().Warn("DirectPath is disabled. Please make sure the token source is fetched from GCE metadata server and the default service account is used.")
		}
		// Case 3: not running on GCE
		if !compute.OnComputeEngine() {
			o.logger().Warn("DirectPath is disabled. DirectPath is only available in a GCE environment.")
		}
	}
}
