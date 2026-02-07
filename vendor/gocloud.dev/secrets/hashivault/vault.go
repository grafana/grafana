// Copyright 2019 The Go Cloud Development Kit Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limtations under the License.

// Package hashivault provides a secrets implementation using the Transit
// Secrets Engine of Vault by Hashicorp.
// Use OpenKeeper to construct a *secrets.Keeper.
//
// # URLs
//
// For secrets.OpenKeeper, hashivault registers for the scheme "hashivault".
// The default URL opener will dial a Vault server using the environment variables
// "VAULT_SERVER_URL" (or "VAULT_ADDR") and "VAULT_SERVER_TOKEN" (or "VAULT_TOKEN").
// To customize the URL opener, or for more details on the URL format,
// see URLOpener.
// See https://gocloud.dev/concepts/urls/ for background information.
//
// # As
//
// hashivault does not support any types for As.
package hashivault

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path"
	"sync"

	"github.com/hashicorp/vault/api"
	"gocloud.dev/gcerrors"
	"gocloud.dev/secrets"
)

// Config is the authentication configurations of the Vault server.
type Config struct {
	// Token is the access token the Vault client uses to talk to the server.
	// See https://www.vaultproject.io/docs/concepts/tokens.html for more
	// information.
	Token string
	// APIConfig is used to configure the creation of the client.
	APIConfig api.Config
}

// Dial gets a Vault client.
func Dial(ctx context.Context, cfg *Config) (*api.Client, error) {
	if cfg == nil {
		return nil, errors.New("no auth Config provided")
	}
	c, err := api.NewClient(&cfg.APIConfig)
	if err != nil {
		return nil, err
	}
	if cfg.Token != "" {
		c.SetToken(cfg.Token)
	}
	return c, nil
}

func init() {
	secrets.DefaultURLMux().RegisterKeeper(Scheme, new(defaultDialer))
}

// getVaultURL ensures that we check both VAULT_SERVER_URL and VAULT_ADDR environment
// variables for the API address for vault. VAULT_SERVER_URL takes precedence over VAULT_ADDR.
func getVaultURL() (string, error) {
	serverURL := os.Getenv("VAULT_SERVER_URL")
	if serverURL != "" {
		return serverURL, nil
	}

	vaultAddr := os.Getenv("VAULT_ADDR")
	if vaultAddr != "" {
		return vaultAddr, nil
	}

	return "", errors.New("neither VAULT_SERVER_URL nor VAULT_ADDR environment variables are set")
}

// getVaultToken ensures that we check both VAULT_SERVER_TOKEN and VAULT_TOKEN environment
// variables for the API token for vault. VAULT_SERVER_TOKEN takes precedence over VAULT_TOKEN.
// If neither environment variables are found, then we return an empty string as token is not required.
func getVaultToken() string {
	serverToken := os.Getenv("VAULT_SERVER_TOKEN")
	if serverToken != "" {
		return serverToken
	}

	vaultToken := os.Getenv("VAULT_TOKEN")
	if vaultToken != "" {
		return vaultToken
	}

	return ""
}

// defaultDialer dials a default Vault server based on the environment variables
// VAULT_SERVER_URL / VAULT_ADDR and VAULT_SERVER_TOKEN / VAULT_TOKEN
type defaultDialer struct {
	init   sync.Once
	opener *URLOpener
	err    error
}

func (o *defaultDialer) OpenKeeperURL(ctx context.Context, u *url.URL) (*secrets.Keeper, error) {
	o.init.Do(func() {
		serverURL, err := getVaultURL()
		if err != nil {
			o.err = err
			return
		}
		token := getVaultToken()
		cfg := Config{Token: token, APIConfig: api.Config{Address: serverURL}}
		client, err := Dial(ctx, &cfg)
		if err != nil {
			o.err = fmt.Errorf("failed to Dial default Vault server at %q: %v", serverURL, err)
			return
		}
		o.opener = &URLOpener{Client: client}
	})
	if o.err != nil {
		return nil, fmt.Errorf("open keeper %v: %v", u, o.err)
	}
	return o.opener.OpenKeeperURL(ctx, u)
}

// Scheme is the URL scheme hashivault registers its URLOpener under on secrets.DefaultMux.
const Scheme = "hashivault"

// URLOpener opens Vault URLs like "hashivault://mykey".
//
// The URL Host + Path are used as the keyID.
//
// The following query parameters are supported:
// - engine: The secrets engine to use; defaults to "transit".
type URLOpener struct {
	// Client must be non-nil.
	Client *api.Client

	// Options specifies the options to pass to OpenKeeper.
	Options KeeperOptions
}

// OpenKeeperURL opens the Keeper URL.
func (o *URLOpener) OpenKeeperURL(ctx context.Context, u *url.URL) (*secrets.Keeper, error) {
	for param, vals := range u.Query() {
		switch param {
		case "engine":
			o.Options.Engine = vals[0]
		default:
			return nil, fmt.Errorf("open keeper %v: invalid query parameter %q", u, param)
		}
	}
	return OpenKeeper(o.Client, path.Join(u.Host, u.Path), &o.Options), nil
}

func newKeeper(client *api.Client, keyID string, opts *KeeperOptions) *keeper {
	if opts == nil {
		opts = &KeeperOptions{}
	}
	if opts.Engine == "" {
		opts.Engine = "transit"
	}
	return &keeper{
		keyID:  keyID,
		client: client,
		opts:   *opts,
	}
}

// OpenKeeper returns a *secrets.Keeper that uses the Transit Secrets Engine of
// Vault by Hashicorp.
// See the package documentation for an example.
func OpenKeeper(client *api.Client, keyID string, opts *KeeperOptions) *secrets.Keeper {
	return secrets.NewKeeper(newKeeper(client, keyID, opts))
}

type keeper struct {
	// keyID is an encryption key ring name used by the Vault's transit API.
	keyID  string
	client *api.Client
	opts   KeeperOptions
}

// Decrypt decrypts the ciphertext into a plaintext.
func (k *keeper) Decrypt(ctx context.Context, ciphertext []byte) ([]byte, error) {
	out, err := k.client.Logical().Write(
		path.Join(k.opts.Engine+"/decrypt", k.keyID),
		map[string]any{
			"ciphertext": string(ciphertext),
		},
	)
	if err != nil {
		return nil, err
	}
	return base64.StdEncoding.DecodeString(out.Data["plaintext"].(string))
}

// Encrypt encrypts a plaintext into a ciphertext.
func (k *keeper) Encrypt(ctx context.Context, plaintext []byte) ([]byte, error) {
	secret, err := k.client.Logical().Write(
		path.Join(k.opts.Engine+"/encrypt", k.keyID),
		map[string]any{
			"plaintext": plaintext,
		},
	)
	if err != nil {
		return nil, err
	}
	return []byte(secret.Data["ciphertext"].(string)), nil
}

// Close implements driver.Keeper.Close.
func (k *keeper) Close() error { return nil }

// ErrorAs implements driver.Keeper.ErrorAs.
func (k *keeper) ErrorAs(err error, i any) bool {
	return false
}

// ErrorCode implements driver.ErrorCode.
func (k *keeper) ErrorCode(error) gcerrors.ErrorCode {
	// TODO(shantuo): try to classify vault error codes
	return gcerrors.Unknown
}

// KeeperOptions controls Keeper behaviors.
// It is provided for future extensibility.
type KeeperOptions struct {
	// Engine is the name of the secrets engine to use.
	// It defaults to "transit".
	Engine string
}
