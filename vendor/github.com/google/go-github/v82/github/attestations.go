// Copyright 2024 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"encoding/json"
)

// Attestation represents an artifact attestation associated with a repository.
// The provided bundle can be used to verify the provenance of artifacts.
//
// https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds
type Attestation struct {
	// The attestation's Sigstore Bundle.
	// Refer to the sigstore bundle specification for more info:
	// https://github.com/sigstore/protobuf-specs/blob/main/protos/sigstore_bundle.proto
	Bundle       json.RawMessage `json:"bundle"`
	RepositoryID int64           `json:"repository_id"`
}

// AttestationsResponse represents a collection of artifact attestations.
type AttestationsResponse struct {
	Attestations []*Attestation `json:"attestations"`
}
