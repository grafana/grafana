// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package featuregate // import "go.opentelemetry.io/collector/featuregate"

import (
	"fmt"
	"sync/atomic"

	"github.com/hashicorp/go-version"
)

// Gate is an immutable object that is owned by the Registry and represents an individual feature that
// may be enabled or disabled based on the lifecycle state of the feature and CLI flags specified by the user.
type Gate struct {
	id           string
	description  string
	referenceURL string
	fromVersion  *version.Version
	toVersion    *version.Version
	stage        Stage
	enabled      *atomic.Bool
}

// ID returns the id of the Gate.
func (g *Gate) ID() string {
	return g.id
}

// IsEnabled returns true if the feature described by the Gate is enabled.
func (g *Gate) IsEnabled() bool {
	return g.enabled.Load()
}

// Description returns the description for the Gate.
func (g *Gate) Description() string {
	return g.description
}

// Stage returns the Gate's lifecycle stage.
func (g *Gate) Stage() Stage {
	return g.stage
}

// ReferenceURL returns the URL to the contextual information about the Gate.
func (g *Gate) ReferenceURL() string {
	return g.referenceURL
}

// FromVersion returns the version information when the Gate's was added.
func (g *Gate) FromVersion() string {
	return fmt.Sprintf("v%s", g.fromVersion)
}

// ToVersion returns the version information when Gate's in StageStable.
func (g *Gate) ToVersion() string {
	return fmt.Sprintf("v%s", g.toVersion)
}
