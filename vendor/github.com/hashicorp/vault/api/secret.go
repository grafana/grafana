// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"reflect"
	"strings"
	"time"

	"github.com/hashicorp/errwrap"
	"github.com/hashicorp/go-secure-stdlib/parseutil"
)

// Secret is the structure returned for every secret within Vault.
type Secret struct {
	// The request ID that generated this response
	RequestID string `json:"request_id"`

	LeaseID       string `json:"lease_id"`
	LeaseDuration int    `json:"lease_duration"`
	Renewable     bool   `json:"renewable"`

	// Data is the actual contents of the secret. The format of the data
	// is arbitrary and up to the secret backend.
	Data map[string]interface{} `json:"data"`

	// Warnings contains any warnings related to the operation. These
	// are not issues that caused the command to fail, but that the
	// client should be aware of.
	Warnings []string `json:"warnings"`

	// Auth, if non-nil, means that there was authentication information
	// attached to this response.
	Auth *SecretAuth `json:"auth,omitempty"`

	// WrapInfo, if non-nil, means that the initial response was wrapped in the
	// cubbyhole of the given token (which has a TTL of the given number of
	// seconds)
	WrapInfo *SecretWrapInfo `json:"wrap_info,omitempty"`

	// MountType, if non-empty, provides some information about what kind
	// of mount this secret came from.
	MountType string `json:"mount_type,omitempty"`
}

// TokenID returns the standardized token ID (token) for the given secret.
func (s *Secret) TokenID() (string, error) {
	if s == nil {
		return "", nil
	}

	if s.Auth != nil && len(s.Auth.ClientToken) > 0 {
		return s.Auth.ClientToken, nil
	}

	if s.Data == nil || s.Data["id"] == nil {
		return "", nil
	}

	id, ok := s.Data["id"].(string)
	if !ok {
		return "", fmt.Errorf("token found but in the wrong format")
	}

	return id, nil
}

// TokenAccessor returns the standardized token accessor for the given secret.
// If the secret is nil or does not contain an accessor, this returns the empty
// string.
func (s *Secret) TokenAccessor() (string, error) {
	if s == nil {
		return "", nil
	}

	if s.Auth != nil && len(s.Auth.Accessor) > 0 {
		return s.Auth.Accessor, nil
	}

	if s.Data == nil || s.Data["accessor"] == nil {
		return "", nil
	}

	accessor, ok := s.Data["accessor"].(string)
	if !ok {
		return "", fmt.Errorf("token found but in the wrong format")
	}

	return accessor, nil
}

// TokenRemainingUses returns the standardized remaining uses for the given
// secret. If the secret is nil or does not contain the "num_uses", this
// returns -1. On error, this will return -1 and a non-nil error.
func (s *Secret) TokenRemainingUses() (int, error) {
	if s == nil || s.Data == nil || s.Data["num_uses"] == nil {
		return -1, nil
	}

	return parseutil.SafeParseInt(s.Data["num_uses"])
}

// TokenPolicies returns the standardized list of policies for the given secret.
// If the secret is nil or does not contain any policies, this returns nil. It
// also populates the secret's Auth info with identity/token policy info.
func (s *Secret) TokenPolicies() ([]string, error) {
	if s == nil {
		return nil, nil
	}

	if s.Auth != nil && len(s.Auth.Policies) > 0 {
		return s.Auth.Policies, nil
	}

	if s.Data == nil || s.Data["policies"] == nil {
		return nil, nil
	}

	var tokenPolicies []string

	// Token policies
	{
		_, ok := s.Data["policies"]
		if !ok {
			goto TOKEN_DONE
		}

		sList, ok := s.Data["policies"].([]string)
		if ok {
			tokenPolicies = sList
			goto TOKEN_DONE
		}

		list, ok := s.Data["policies"].([]interface{})
		if !ok {
			return nil, fmt.Errorf("unable to convert token policies to expected format")
		}
		for _, v := range list {
			p, ok := v.(string)
			if !ok {
				return nil, fmt.Errorf("unable to convert policy %v to string", v)
			}
			tokenPolicies = append(tokenPolicies, p)
		}
	}

TOKEN_DONE:
	var identityPolicies []string

	// Identity policies
	{
		v, ok := s.Data["identity_policies"]
		if !ok || v == nil {
			goto DONE
		}

		if s.Data["identity_policies"] == nil {
			goto DONE
		}

		sList, ok := s.Data["identity_policies"].([]string)
		if ok {
			identityPolicies = sList
			goto DONE
		}

		list, ok := s.Data["identity_policies"].([]interface{})
		if !ok {
			return nil, fmt.Errorf("unable to convert identity policies to expected format")
		}
		for _, v := range list {
			p, ok := v.(string)
			if !ok {
				return nil, fmt.Errorf("unable to convert policy %v to string", v)
			}
			identityPolicies = append(identityPolicies, p)
		}
	}

DONE:

	if s.Auth == nil {
		s.Auth = &SecretAuth{}
	}

	policies := append(tokenPolicies, identityPolicies...)

	s.Auth.TokenPolicies = tokenPolicies
	s.Auth.IdentityPolicies = identityPolicies
	s.Auth.Policies = policies

	return policies, nil
}

// TokenMetadata returns the map of metadata associated with this token, if any
// exists. If the secret is nil or does not contain the "metadata" key, this
// returns nil.
func (s *Secret) TokenMetadata() (map[string]string, error) {
	if s == nil {
		return nil, nil
	}

	if s.Auth != nil && len(s.Auth.Metadata) > 0 {
		return s.Auth.Metadata, nil
	}

	if s.Data == nil || (s.Data["metadata"] == nil && s.Data["meta"] == nil) {
		return nil, nil
	}

	data, ok := s.Data["metadata"].(map[string]interface{})
	if !ok {
		data, ok = s.Data["meta"].(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("unable to convert metadata field to expected format")
		}
	}

	metadata := make(map[string]string, len(data))
	for k, v := range data {
		typed, ok := v.(string)
		if !ok {
			return nil, fmt.Errorf("unable to convert metadata value %v to string", v)
		}
		metadata[k] = typed
	}

	return metadata, nil
}

// TokenIsRenewable returns the standardized token renewability for the given
// secret. If the secret is nil or does not contain the "renewable" key, this
// returns false.
func (s *Secret) TokenIsRenewable() (bool, error) {
	if s == nil {
		return false, nil
	}

	if s.Auth != nil && s.Auth.Renewable {
		return s.Auth.Renewable, nil
	}

	if s.Data == nil || s.Data["renewable"] == nil {
		return false, nil
	}

	renewable, err := parseutil.ParseBool(s.Data["renewable"])
	if err != nil {
		return false, errwrap.Wrapf("could not convert renewable value to a boolean: {{err}}", err)
	}

	return renewable, nil
}

// TokenTTL returns the standardized remaining token TTL for the given secret.
// If the secret is nil or does not contain a TTL, this returns 0.
func (s *Secret) TokenTTL() (time.Duration, error) {
	if s == nil {
		return 0, nil
	}

	if s.Auth != nil && s.Auth.LeaseDuration > 0 {
		return time.Duration(s.Auth.LeaseDuration) * time.Second, nil
	}

	if s.Data == nil || s.Data["ttl"] == nil {
		return 0, nil
	}

	ttl, err := parseutil.ParseDurationSecond(s.Data["ttl"])
	if err != nil {
		return 0, err
	}

	return ttl, nil
}

// SecretWrapInfo contains wrapping information if we have it. If what is
// contained is an authentication token, the accessor for the token will be
// available in WrappedAccessor.
type SecretWrapInfo struct {
	Token           string    `json:"token"`
	Accessor        string    `json:"accessor"`
	TTL             int       `json:"ttl"`
	CreationTime    time.Time `json:"creation_time"`
	CreationPath    string    `json:"creation_path"`
	WrappedAccessor string    `json:"wrapped_accessor"`
}

type MFAMethodID struct {
	Type         string `json:"type,omitempty"`
	ID           string `json:"id,omitempty"`
	UsesPasscode bool   `json:"uses_passcode,omitempty"`
	Name         string `json:"name,omitempty"`
}

type MFAConstraintAny struct {
	Any []*MFAMethodID `json:"any,omitempty"`
}

type MFARequirement struct {
	MFARequestID   string                       `json:"mfa_request_id,omitempty"`
	MFAConstraints map[string]*MFAConstraintAny `json:"mfa_constraints,omitempty"`
}

// SecretAuth is the structure containing auth information if we have it.
type SecretAuth struct {
	ClientToken      string            `json:"client_token"`
	Accessor         string            `json:"accessor"`
	Policies         []string          `json:"policies"`
	TokenPolicies    []string          `json:"token_policies"`
	IdentityPolicies []string          `json:"identity_policies"`
	Metadata         map[string]string `json:"metadata"`
	Orphan           bool              `json:"orphan"`
	EntityID         string            `json:"entity_id"`

	LeaseDuration int  `json:"lease_duration"`
	Renewable     bool `json:"renewable"`

	MFARequirement *MFARequirement `json:"mfa_requirement"`
}

// ParseSecret is used to parse a secret value from JSON from an io.Reader.
func ParseSecret(r io.Reader) (*Secret, error) {
	// First read the data into a buffer. Not super efficient but we want to
	// know if we actually have a body or not.
	var buf bytes.Buffer

	// io.Reader is treated like a stream and cannot be read
	// multiple times. Duplicating this stream using TeeReader
	// to use this data in case there is no top-level data from
	// api response
	var teebuf bytes.Buffer
	tee := io.TeeReader(r, &teebuf)

	_, err := buf.ReadFrom(tee)
	if err != nil {
		return nil, err
	}
	if buf.Len() == 0 {
		return nil, nil
	}

	// First decode the JSON into a map[string]interface{}
	var secret Secret
	dec := json.NewDecoder(&buf)
	dec.UseNumber()
	if err := dec.Decode(&secret); err != nil {
		return nil, err
	}

	// If the secret is null, add raw data to secret data if present
	if reflect.DeepEqual(secret, Secret{}) {
		data := make(map[string]interface{})
		dec := json.NewDecoder(&teebuf)
		dec.UseNumber()
		if err := dec.Decode(&data); err != nil {
			return nil, err
		}
		errRaw, errPresent := data["errors"]

		// if only errors are present in the resp.Body return nil
		// to return value not found as it does not have any raw data
		if len(data) == 1 && errPresent {
			return nil, nil
		}

		// if errors are present along with raw data return the error
		if errPresent {
			var errStrArray []string
			errBytes, err := json.Marshal(errRaw)
			if err != nil {
				return nil, err
			}
			if err := json.Unmarshal(errBytes, &errStrArray); err != nil {
				return nil, err
			}
			return nil, errors.New(strings.Join(errStrArray, " "))
		}

		// if any raw data is present in resp.Body, add it to secret
		if len(data) > 0 {
			secret.Data = data
		}
	}

	return &secret, nil
}
