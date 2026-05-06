// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"flag"
	"net/url"
	"os"

	jose "github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/hashicorp/errwrap"
)

// This file contains helper code used when writing Vault auth method or secrets engine plugins.
//
// As such, it would be better located in the sdk module with the rest of the code which is only to support plugins,
// rather than api, but is here for historical reasons. (The api module used to depend on the sdk module, this code
// calls NewClient within the api package, so placing it in the sdk would have created a dependency cycle. This reason
// is now historical, as the dependency between sdk and api has since been reversed in direction.)
// Moving this code to the sdk would be appropriate if an api v2.0.0 release is ever planned.
//
// This helper code is used when a plugin is hosted by Vault 1.11 and earlier. Vault 1.12 and sdk v0.6.0 introduced
// version 5 of the backend plugin interface, which uses go-plugin's AutoMTLS feature instead of this code.

const (
	// PluginAutoMTLSEnv is used to ensure AutoMTLS is used. This will override
	// setting a TLSProviderFunc for a plugin.
	PluginAutoMTLSEnv = "VAULT_PLUGIN_AUTOMTLS_ENABLED"

	// PluginMetadataModeEnv is an ENV name used to disable TLS communication
	// to bootstrap mounting plugins.
	PluginMetadataModeEnv = "VAULT_PLUGIN_METADATA_MODE"

	// PluginUnwrapTokenEnv is the ENV name used to pass unwrap tokens to the
	// plugin.
	PluginUnwrapTokenEnv = "VAULT_UNWRAP_TOKEN"

	// CubbyHoleJWTSignatureAlgorithm is the signature algorithm used for
	// the unwrap token that Vault passes to a plugin when auto-mTLS is
	// not enabled.
	CubbyHoleJWTSignatureAlgorithm = jose.ES512
)

// PluginAPIClientMeta is a helper that plugins can use to configure TLS connections
// back to Vault.
type PluginAPIClientMeta struct {
	// These are set by the command line flags.
	flagCACert     string
	flagCAPath     string
	flagClientCert string
	flagClientKey  string
	flagServerName string
	flagInsecure   bool
}

// FlagSet returns the flag set for configuring the TLS connection
func (f *PluginAPIClientMeta) FlagSet() *flag.FlagSet {
	fs := flag.NewFlagSet("vault plugin settings", flag.ContinueOnError)

	fs.StringVar(&f.flagCACert, "ca-cert", "", "")
	fs.StringVar(&f.flagCAPath, "ca-path", "", "")
	fs.StringVar(&f.flagClientCert, "client-cert", "", "")
	fs.StringVar(&f.flagClientKey, "client-key", "", "")
	fs.StringVar(&f.flagServerName, "tls-server-name", "", "")
	fs.BoolVar(&f.flagInsecure, "tls-skip-verify", false, "")

	return fs
}

// GetTLSConfig will return a TLSConfig based off the values from the flags
func (f *PluginAPIClientMeta) GetTLSConfig() *TLSConfig {
	// If we need custom TLS configuration, then set it
	if f.flagCACert != "" || f.flagCAPath != "" || f.flagClientCert != "" || f.flagClientKey != "" || f.flagInsecure || f.flagServerName != "" {
		t := &TLSConfig{
			CACert:        f.flagCACert,
			CAPath:        f.flagCAPath,
			ClientCert:    f.flagClientCert,
			ClientKey:     f.flagClientKey,
			TLSServerName: f.flagServerName,
			Insecure:      f.flagInsecure,
		}

		return t
	}

	return nil
}

// VaultPluginTLSProvider wraps VaultPluginTLSProviderContext using context.Background.
func VaultPluginTLSProvider(apiTLSConfig *TLSConfig) func() (*tls.Config, error) {
	return VaultPluginTLSProviderContext(context.Background(), apiTLSConfig)
}

// VaultPluginTLSProviderContext is run inside a plugin and retrieves the response
// wrapped TLS certificate from vault. It returns a configured TLS Config.
func VaultPluginTLSProviderContext(ctx context.Context, apiTLSConfig *TLSConfig) func() (*tls.Config, error) {
	if os.Getenv(PluginAutoMTLSEnv) == "true" || os.Getenv(PluginMetadataModeEnv) == "true" {
		return nil
	}

	return func() (*tls.Config, error) {
		unwrapToken := os.Getenv(PluginUnwrapTokenEnv)

		parsedJWT, err := jwt.ParseSigned(unwrapToken, []jose.SignatureAlgorithm{CubbyHoleJWTSignatureAlgorithm})
		if err != nil {
			return nil, errwrap.Wrapf("error parsing wrapping token: {{err}}", err)
		}

		allClaims := make(map[string]interface{})
		if err = parsedJWT.UnsafeClaimsWithoutVerification(&allClaims); err != nil {
			return nil, errwrap.Wrapf("error parsing claims from wrapping token: {{err}}", err)
		}

		addrClaimRaw, ok := allClaims["addr"]
		if !ok {
			return nil, errors.New("could not validate addr claim")
		}
		vaultAddr, ok := addrClaimRaw.(string)
		if !ok {
			return nil, errors.New("could not parse addr claim")
		}
		if vaultAddr == "" {
			return nil, errors.New(`no vault api_addr found`)
		}

		// Sanity check the value
		if _, err := url.Parse(vaultAddr); err != nil {
			return nil, errwrap.Wrapf("error parsing the vault api_addr: {{err}}", err)
		}

		// Unwrap the token
		clientConf := DefaultConfig()
		clientConf.Address = vaultAddr
		if apiTLSConfig != nil {
			err := clientConf.ConfigureTLS(apiTLSConfig)
			if err != nil {
				return nil, errwrap.Wrapf("error configuring api client {{err}}", err)
			}
		}
		client, err := NewClient(clientConf)
		if err != nil {
			return nil, errwrap.Wrapf("error during api client creation: {{err}}", err)
		}

		// Reset token value to make sure nothing has been set by default
		client.ClearToken()

		secret, err := client.Logical().UnwrapWithContext(ctx, unwrapToken)
		if err != nil {
			return nil, errwrap.Wrapf("error during token unwrap request: {{err}}", err)
		}
		if secret == nil {
			return nil, errors.New("error during token unwrap request: secret is nil")
		}

		// Retrieve and parse the server's certificate
		serverCertBytesRaw, ok := secret.Data["ServerCert"].(string)
		if !ok {
			return nil, errors.New("error unmarshalling certificate")
		}

		serverCertBytes, err := base64.StdEncoding.DecodeString(serverCertBytesRaw)
		if err != nil {
			return nil, errwrap.Wrapf("error parsing certificate: {{err}}", err)
		}

		serverCert, err := x509.ParseCertificate(serverCertBytes)
		if err != nil {
			return nil, errwrap.Wrapf("error parsing certificate: {{err}}", err)
		}

		// Retrieve and parse the server's private key
		serverKeyB64, ok := secret.Data["ServerKey"].(string)
		if !ok {
			return nil, errors.New("error unmarshalling certificate")
		}

		serverKeyRaw, err := base64.StdEncoding.DecodeString(serverKeyB64)
		if err != nil {
			return nil, errwrap.Wrapf("error parsing certificate: {{err}}", err)
		}

		serverKey, err := x509.ParseECPrivateKey(serverKeyRaw)
		if err != nil {
			return nil, errwrap.Wrapf("error parsing certificate: {{err}}", err)
		}

		// Add CA cert to the cert pool
		caCertPool := x509.NewCertPool()
		caCertPool.AddCert(serverCert)

		// Build a certificate object out of the server's cert and private key.
		cert := tls.Certificate{
			Certificate: [][]byte{serverCertBytes},
			PrivateKey:  serverKey,
			Leaf:        serverCert,
		}

		// Setup TLS config
		tlsConfig := &tls.Config{
			ClientCAs:  caCertPool,
			RootCAs:    caCertPool,
			ClientAuth: tls.RequireAndVerifyClientCert,
			// TLS 1.2 minimum
			MinVersion:   tls.VersionTLS12,
			Certificates: []tls.Certificate{cert},
			ServerName:   serverCert.Subject.CommonName,
		}

		return tlsConfig, nil
	}
}
