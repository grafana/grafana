/*
 *
 * Copyright 2021 gRPC authors.
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

// Package googledirectpath implements a resolver that configures xds to make
// cloud to prod directpath connection.
//
// It's a combo of DNS and xDS resolvers. It delegates to DNS if
// - not on GCE, or
// - xDS bootstrap env var is set (so this client needs to do normal xDS, not
// direct path, and clients with this scheme is not part of the xDS mesh).
package googledirectpath

import (
	"encoding/json"
	"fmt"
	rand "math/rand/v2"
	"net/url"
	"sync"
	"time"

	"google.golang.org/grpc/grpclog"
	"google.golang.org/grpc/internal/envconfig"
	"google.golang.org/grpc/internal/googlecloud"
	internalgrpclog "google.golang.org/grpc/internal/grpclog"
	"google.golang.org/grpc/internal/xds/bootstrap"
	"google.golang.org/grpc/internal/xds/xdsclient"
	"google.golang.org/grpc/resolver"

	_ "google.golang.org/grpc/xds" // To register xds resolvers and balancers.
)

const (
	c2pScheme    = "google-c2p"
	c2pAuthority = "traffic-director-c2p.xds.googleapis.com"

	defaultUniverseDomain   = "googleapis.com"
	zoneURL                 = "http://metadata.google.internal/computeMetadata/v1/instance/zone"
	ipv6URL                 = "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ipv6s"
	ipv6CapableMetadataName = "TRAFFICDIRECTOR_DIRECTPATH_C2P_IPV6_CAPABLE"
	httpReqTimeout          = 10 * time.Second

	logPrefix        = "[google-c2p-resolver]"
	dnsName, xdsName = "dns", "xds"
)

var (
	logger           = internalgrpclog.NewPrefixLogger(grpclog.Component("directpath"), logPrefix)
	universeDomainMu sync.Mutex
	universeDomain   = ""
	// For overriding in unittests.
	onGCE         = googlecloud.OnGCE
	randInt       = rand.Int
	xdsClientPool = xdsclient.DefaultPool
)

func init() {
	resolver.Register(c2pResolverBuilder{})
}

// SetUniverseDomain informs the gRPC library of the universe domain
// in which the process is running (for example, "googleapis.com").
// It is the caller's responsibility to ensure that the domain is correct.
//
// This setting is used by the "google-c2p" resolver (the resolver used
// for URIs with the "google-c2p" scheme) to configure its dependencies.
//
// If a gRPC channel is created with the "google-c2p" URI scheme and this
// function has NOT been called, then gRPC configures the universe domain as
// "googleapis.com".
//
// Returns nil if either:
//
//	a) The universe domain has not yet been configured.
//	b) The universe domain has been configured and matches the provided value.
//
// Otherwise, returns an error.
func SetUniverseDomain(domain string) error {
	universeDomainMu.Lock()
	defer universeDomainMu.Unlock()
	if domain == "" {
		return fmt.Errorf("universe domain cannot be empty")
	}
	if universeDomain == "" {
		universeDomain = domain
		return nil
	}
	if universeDomain != domain {
		return fmt.Errorf("universe domain cannot be set to %s, already set to different value: %s", domain, universeDomain)
	}
	return nil
}

func getXdsServerURI() string {
	universeDomainMu.Lock()
	defer universeDomainMu.Unlock()
	if universeDomain == "" {
		universeDomain = defaultUniverseDomain
	}
	// Put env var override logic after default value logic so
	// that tests still run the default value logic.
	if envconfig.C2PResolverTestOnlyTrafficDirectorURI != "" {
		return envconfig.C2PResolverTestOnlyTrafficDirectorURI
	}
	return fmt.Sprintf("dns:///directpath-pa.%s", universeDomain)
}

type c2pResolverWrapper struct {
	resolver.Resolver
	cancel func() // Release the reference to the xDS client that was created in Build().
}

func (r *c2pResolverWrapper) Close() {
	r.Resolver.Close()
	r.cancel()
}

type c2pResolverBuilder struct{}

func (c2pResolverBuilder) Build(t resolver.Target, cc resolver.ClientConn, opts resolver.BuildOptions) (resolver.Resolver, error) {
	if t.URL.Host != "" {
		return nil, fmt.Errorf("google-c2p URI scheme does not support authorities")
	}

	if !runDirectPath() {
		// If not xDS, fallback to DNS.
		t.URL.Scheme = dnsName
		return resolver.Get(dnsName).Build(t, cc, opts)
	}

	// Note that the following calls to getZone() and getIPv6Capable() does I/O,
	// and has 10 seconds timeout each.
	//
	// This should be fine in most of the cases. In certain error cases, this
	// could block Dial() for up to 10 seconds (each blocking call has its own
	// goroutine).
	zoneCh, ipv6CapableCh := make(chan string), make(chan bool)
	go func() { zoneCh <- getZone(httpReqTimeout) }()
	go func() { ipv6CapableCh <- getIPv6Capable(httpReqTimeout) }()

	xdsServerURI := getXdsServerURI()
	nodeCfg := newNodeConfig(<-zoneCh, <-ipv6CapableCh)
	xdsServerCfg := newXdsServerConfig(xdsServerURI)
	authoritiesCfg := newAuthoritiesConfig(xdsServerCfg)

	cfg := map[string]any{
		"xds_servers": []any{xdsServerCfg},
		"client_default_listener_resource_name_template": "%s",
		"authorities": authoritiesCfg,
		"node":        nodeCfg,
	}
	cfgJSON, err := json.Marshal(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal bootstrap configuration: %v", err)
	}
	config, err := bootstrap.NewConfigFromContents(cfgJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to parse bootstrap contents: %s, %v", string(cfgJSON), err)
	}

	t = resolver.Target{
		URL: url.URL{
			Scheme: xdsName,
			Host:   c2pAuthority,
			Path:   t.URL.Path,
		},
	}

	// Create a new xDS client for this target using the provided bootstrap
	// configuration. This client is stored in the xdsclient pool’s internal
	// cache, keeping it alive and associated with this resolver until Closed().
	// While the c2p resolver itself does not directly use the client, creating
	// it ensures that when the xDS resolver later requests a client for the
	// same target, the existing instance will be reused.
	_, cancel, err := xdsClientPool.NewClientWithConfig(t.String(), opts.MetricsRecorder, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create xds client: %v", err)
	}

	r, err := resolver.Get(xdsName).Build(t, cc, opts)
	if err != nil {
		cancel()
		return nil, err
	}
	return &c2pResolverWrapper{Resolver: r, cancel: cancel}, nil
}

func (b c2pResolverBuilder) Scheme() string {
	return c2pScheme
}

func newNodeConfig(zone string, ipv6Capable bool) map[string]any {
	node := map[string]any{
		"id":       fmt.Sprintf("C2P-%d", randInt()),
		"locality": map[string]any{"zone": zone},
	}
	// Enable dualstack endpoints in TD.
	if ipv6Capable {
		node["metadata"] = map[string]any{ipv6CapableMetadataName: true}
	}
	return node
}

func newAuthoritiesConfig(serverCfg map[string]any) map[string]any {
	return map[string]any{
		c2pAuthority: map[string]any{"xds_servers": []any{serverCfg}},
	}
}

func newXdsServerConfig(uri string) map[string]any {
	return map[string]any{
		"server_uri":      uri,
		"channel_creds":   []map[string]any{{"type": "google_default"}},
		"server_features": []any{"ignore_resource_deletion"},
	}
}

// runDirectPath returns whether this resolver should use direct path.
//
// direct path is enabled if this client is running on GCE.
func runDirectPath() bool {
	return onGCE()
}
