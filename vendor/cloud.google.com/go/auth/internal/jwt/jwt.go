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

package jwt

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	// HeaderAlgRSA256 is the RS256 [Header.Algorithm].
	HeaderAlgRSA256 = "RS256"
	// HeaderAlgES256 is the ES256 [Header.Algorithm].
	HeaderAlgES256 = "ES256"
	// HeaderType is the standard [Header.Type].
	HeaderType = "JWT"
)

// Header represents a JWT header.
type Header struct {
	Algorithm string `json:"alg"`
	Type      string `json:"typ"`
	KeyID     string `json:"kid"`
}

func (h *Header) encode() (string, error) {
	b, err := json.Marshal(h)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// Claims represents the claims set of a JWT.
type Claims struct {
	// Iss is the issuer JWT claim.
	Iss string `json:"iss"`
	// Scope is the scope JWT claim.
	Scope string `json:"scope,omitempty"`
	// Exp is the expiry JWT claim. If unset, default is in one hour from now.
	Exp int64 `json:"exp"`
	// Iat is the subject issued at claim. If unset, default is now.
	Iat int64 `json:"iat"`
	// Aud is the audience JWT claim. Optional.
	Aud string `json:"aud"`
	// Sub is the subject JWT claim. Optional.
	Sub string `json:"sub,omitempty"`
	// AdditionalClaims contains any additional non-standard JWT claims. Optional.
	AdditionalClaims map[string]interface{} `json:"-"`
}

func (c *Claims) encode() (string, error) {
	// Compensate for skew
	now := time.Now().Add(-10 * time.Second)
	if c.Iat == 0 {
		c.Iat = now.Unix()
	}
	if c.Exp == 0 {
		c.Exp = now.Add(time.Hour).Unix()
	}
	if c.Exp < c.Iat {
		return "", fmt.Errorf("jwt: invalid Exp = %d; must be later than Iat = %d", c.Exp, c.Iat)
	}

	b, err := json.Marshal(c)
	if err != nil {
		return "", err
	}

	if len(c.AdditionalClaims) == 0 {
		return base64.RawURLEncoding.EncodeToString(b), nil
	}

	// Marshal private claim set and then append it to b.
	prv, err := json.Marshal(c.AdditionalClaims)
	if err != nil {
		return "", fmt.Errorf("invalid map of additional claims %v: %w", c.AdditionalClaims, err)
	}

	// Concatenate public and private claim JSON objects.
	if !bytes.HasSuffix(b, []byte{'}'}) {
		return "", fmt.Errorf("invalid JSON %s", b)
	}
	if !bytes.HasPrefix(prv, []byte{'{'}) {
		return "", fmt.Errorf("invalid JSON %s", prv)
	}
	b[len(b)-1] = ','         // Replace closing curly brace with a comma.
	b = append(b, prv[1:]...) // Append private claims.
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// EncodeJWS encodes the data using the provided key as a JSON web signature.
func EncodeJWS(header *Header, c *Claims, signer crypto.Signer) (string, error) {
	head, err := header.encode()
	if err != nil {
		return "", err
	}
	claims, err := c.encode()
	if err != nil {
		return "", err
	}
	ss := fmt.Sprintf("%s.%s", head, claims)
	h := sha256.New()
	h.Write([]byte(ss))
	sig, err := signer.Sign(rand.Reader, h.Sum(nil), crypto.SHA256)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s.%s", ss, base64.RawURLEncoding.EncodeToString(sig)), nil
}

// DecodeJWS decodes a claim set from a JWS payload.
func DecodeJWS(payload string) (*Claims, error) {
	// decode returned id token to get expiry
	s := strings.Split(payload, ".")
	if len(s) < 2 {
		return nil, errors.New("invalid token received")
	}
	decoded, err := base64.RawURLEncoding.DecodeString(s[1])
	if err != nil {
		return nil, err
	}
	c := &Claims{}
	if err := json.NewDecoder(bytes.NewBuffer(decoded)).Decode(c); err != nil {
		return nil, err
	}
	if err := json.NewDecoder(bytes.NewBuffer(decoded)).Decode(&c.AdditionalClaims); err != nil {
		return nil, err
	}
	return c, err
}

// VerifyJWS tests whether the provided JWT token's signature was produced by
// the private key associated with the provided public key.
func VerifyJWS(token string, key *rsa.PublicKey) error {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return errors.New("jwt: invalid token received, token must have 3 parts")
	}

	signedContent := parts[0] + "." + parts[1]
	signatureString, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return err
	}

	h := sha256.New()
	h.Write([]byte(signedContent))
	return rsa.VerifyPKCS1v15(key, crypto.SHA256, h.Sum(nil), signatureString)
}
