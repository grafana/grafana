//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"context"
	"crypto"
	"crypto/x509"
	"encoding/pem"
	"errors"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/confidential"
	"golang.org/x/crypto/pkcs12"
)

const credNameCert = "ClientCertificateCredential"

// ClientCertificateCredentialOptions contains optional parameters for ClientCertificateCredential.
type ClientCertificateCredentialOptions struct {
	azcore.ClientOptions

	// AdditionallyAllowedTenants specifies additional tenants for which the credential may acquire tokens.
	// Add the wildcard value "*" to allow the credential to acquire tokens for any tenant in which the
	// application is registered.
	AdditionallyAllowedTenants []string

	// Cache is a persistent cache the credential will use to store the tokens it acquires, making
	// them available to other processes and credential instances. The default, zero value means the
	// credential will store tokens in memory and not share them with any other credential instance.
	Cache Cache

	// DisableInstanceDiscovery should be set true only by applications authenticating in disconnected clouds, or
	// private clouds such as Azure Stack. It determines whether the credential requests Microsoft Entra instance metadata
	// from https://login.microsoft.com before authenticating. Setting this to true will skip this request, making
	// the application responsible for ensuring the configured authority is valid and trustworthy.
	DisableInstanceDiscovery bool

	// SendCertificateChain controls whether the credential sends the public certificate chain in the x5c
	// header of each token request's JWT. This is required for Subject Name/Issuer (SNI) authentication.
	// Defaults to False.
	SendCertificateChain bool
}

// ClientCertificateCredential authenticates a service principal with a certificate.
type ClientCertificateCredential struct {
	client *confidentialClient
}

// NewClientCertificateCredential constructs a ClientCertificateCredential. Pass nil for options to accept defaults. See
// [ParseCertificates] for help loading a certificate.
func NewClientCertificateCredential(tenantID string, clientID string, certs []*x509.Certificate, key crypto.PrivateKey, options *ClientCertificateCredentialOptions) (*ClientCertificateCredential, error) {
	if len(certs) == 0 {
		return nil, errors.New("at least one certificate is required")
	}
	if options == nil {
		options = &ClientCertificateCredentialOptions{}
	}
	cred, err := confidential.NewCredFromCert(certs, key)
	if err != nil {
		return nil, err
	}
	msalOpts := confidentialClientOptions{
		AdditionallyAllowedTenants: options.AdditionallyAllowedTenants,
		Cache:                      options.Cache,
		ClientOptions:              options.ClientOptions,
		DisableInstanceDiscovery:   options.DisableInstanceDiscovery,
		SendX5C:                    options.SendCertificateChain,
	}
	c, err := newConfidentialClient(tenantID, clientID, credNameCert, cred, msalOpts)
	if err != nil {
		return nil, err
	}
	return &ClientCertificateCredential{client: c}, nil
}

// GetToken requests an access token from Microsoft Entra ID. This method is called automatically by Azure SDK clients.
func (c *ClientCertificateCredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	var err error
	ctx, endSpan := runtime.StartSpan(ctx, credNameCert+"."+traceOpGetToken, c.client.azClient.Tracer(), nil)
	defer func() { endSpan(err) }()
	tk, err := c.client.GetToken(ctx, opts)
	return tk, err
}

// ParseCertificates loads certificates and a private key, in PEM or PKCS#12 format, for use with [NewClientCertificateCredential].
// Pass nil for password if the private key isn't encrypted. This function has limitations, for example it can't decrypt keys in
// PEM format or PKCS#12 certificates that use SHA256 for message authentication. If you encounter such limitations, consider
// using another module to load the certificate and private key.
func ParseCertificates(certData []byte, password []byte) ([]*x509.Certificate, crypto.PrivateKey, error) {
	var blocks []*pem.Block
	var err error
	if len(password) == 0 {
		blocks, err = loadPEMCert(certData)
	}
	if len(blocks) == 0 || err != nil {
		blocks, err = loadPKCS12Cert(certData, string(password))
	}
	if err != nil {
		return nil, nil, err
	}
	var certs []*x509.Certificate
	var pk crypto.PrivateKey
	for _, block := range blocks {
		switch block.Type {
		case "CERTIFICATE":
			c, err := x509.ParseCertificate(block.Bytes)
			if err != nil {
				return nil, nil, err
			}
			certs = append(certs, c)
		case "PRIVATE KEY":
			if pk != nil {
				return nil, nil, errors.New("certData contains multiple private keys")
			}
			pk, err = x509.ParsePKCS8PrivateKey(block.Bytes)
			if err != nil {
				pk, err = x509.ParsePKCS1PrivateKey(block.Bytes)
			}
			if err != nil {
				return nil, nil, err
			}
		case "RSA PRIVATE KEY":
			if pk != nil {
				return nil, nil, errors.New("certData contains multiple private keys")
			}
			pk, err = x509.ParsePKCS1PrivateKey(block.Bytes)
			if err != nil {
				return nil, nil, err
			}
		}
	}
	if len(certs) == 0 {
		return nil, nil, errors.New("found no certificate")
	}
	if pk == nil {
		return nil, nil, errors.New("found no private key")
	}
	return certs, pk, nil
}

func loadPEMCert(certData []byte) ([]*pem.Block, error) {
	blocks := []*pem.Block{}
	for {
		var block *pem.Block
		block, certData = pem.Decode(certData)
		if block == nil {
			break
		}
		blocks = append(blocks, block)
	}
	if len(blocks) == 0 {
		return nil, errors.New("didn't find any PEM blocks")
	}
	return blocks, nil
}

func loadPKCS12Cert(certData []byte, password string) ([]*pem.Block, error) {
	blocks, err := pkcs12.ToPEM(certData, password)
	if err != nil {
		return nil, err
	}
	if len(blocks) == 0 {
		// not mentioning PKCS12 in this message because we end up here when certData is garbage
		return nil, errors.New("didn't find any certificate content")
	}
	return blocks, err
}

var _ azcore.TokenCredential = (*ClientCertificateCredential)(nil)
