// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package featuregate // import "go.opentelemetry.io/collector/featuregate"

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"sort"
	"sync"
	"sync/atomic"

	"github.com/hashicorp/go-version"
)

var (
	globalRegistry = NewRegistry()

	// idRegexp is used to validate the ID of a Gate.
	// IDs' characters must be alphanumeric or dots.
	idRegexp = regexp.MustCompile(`^[0-9a-zA-Z.]*$`)
)

// ErrAlreadyRegistered is returned when adding a Gate that is already registered.
var ErrAlreadyRegistered = errors.New("gate is already registered")

// GlobalRegistry returns the global Registry.
func GlobalRegistry() *Registry {
	return globalRegistry
}

type Registry struct {
	gates sync.Map
}

// NewRegistry returns a new empty Registry.
func NewRegistry() *Registry {
	return &Registry{}
}

// RegisterOption allows to configure additional information about a Gate during registration.
type RegisterOption interface {
	apply(g *Gate) error
}

type registerOptionFunc func(g *Gate) error

func (ro registerOptionFunc) apply(g *Gate) error {
	return ro(g)
}

// WithRegisterDescription adds description for the Gate.
func WithRegisterDescription(description string) RegisterOption {
	return registerOptionFunc(func(g *Gate) error {
		g.description = description
		return nil
	})
}

// WithRegisterReferenceURL adds a URL that has all the contextual information about the Gate.
// referenceURL must be a valid URL as defined by `net/url.Parse`.
func WithRegisterReferenceURL(referenceURL string) RegisterOption {
	return registerOptionFunc(func(g *Gate) error {
		if _, err := url.Parse(referenceURL); err != nil {
			return fmt.Errorf("WithRegisterReferenceURL: invalid reference URL %q: %w", referenceURL, err)
		}

		g.referenceURL = referenceURL
		return nil
	})
}

// WithRegisterFromVersion is used to set the Gate "FromVersion".
// The "FromVersion" contains the Collector release when a feature is introduced.
// fromVersion must be a valid version string: it may start with 'v' and must be in the format Major.Minor.Patch[-PreRelease].
// PreRelease is optional and may have dashes, tildes and ASCII alphanumeric characters.
func WithRegisterFromVersion(fromVersion string) RegisterOption {
	return registerOptionFunc(func(g *Gate) error {
		from, err := version.NewVersion(fromVersion)
		if err != nil {
			return fmt.Errorf("WithRegisterFromVersion: invalid version %q: %w", fromVersion, err)
		}

		g.fromVersion = from
		return nil
	})
}

// WithRegisterToVersion is used to set the Gate "ToVersion".
// The "ToVersion", if not empty, contains the last Collector release in which you can still use a feature gate.
// If the feature stage is either "Deprecated" or "Stable", the "ToVersion" is the Collector release when the feature is removed.
// toVersion must be a valid version string: it may start with 'v' and must be in the format Major.Minor.Patch[-PreRelease].
// PreRelease is optional and may have dashes, tildes and ASCII alphanumeric characters.
func WithRegisterToVersion(toVersion string) RegisterOption {
	return registerOptionFunc(func(g *Gate) error {
		to, err := version.NewVersion(toVersion)
		if err != nil {
			return fmt.Errorf("WithRegisterToVersion: invalid version %q:  %w", toVersion, err)
		}

		g.toVersion = to
		return nil
	})
}

// MustRegister like Register but panics if an invalid ID or gate options are provided.
func (r *Registry) MustRegister(id string, stage Stage, opts ...RegisterOption) *Gate {
	g, err := r.Register(id, stage, opts...)
	if err != nil {
		panic(err)
	}
	return g
}

func validateID(id string) error {
	if id == "" {
		return errors.New("empty ID")
	}

	if !idRegexp.MatchString(id) {
		return errors.New("invalid character(s) in ID")
	}
	return nil
}

// Register a Gate and return it. The returned Gate can be used to check if is enabled or not.
// id must be an ASCII alphanumeric nonempty string. Dots are allowed for namespacing.
func (r *Registry) Register(id string, stage Stage, opts ...RegisterOption) (*Gate, error) {
	if err := validateID(id); err != nil {
		return nil, fmt.Errorf("invalid ID %q: %w", id, err)
	}

	g := &Gate{
		id:    id,
		stage: stage,
	}
	for _, opt := range opts {
		err := opt.apply(g)
		if err != nil {
			return nil, fmt.Errorf("failed to apply option: %w", err)
		}
	}
	switch g.stage {
	case StageAlpha, StageDeprecated:
		g.enabled = &atomic.Bool{}
	case StageBeta, StageStable:
		enabled := &atomic.Bool{}
		enabled.Store(true)
		g.enabled = enabled
	default:
		return nil, fmt.Errorf("unknown stage value %q for gate %q", stage, id)
	}
	if (g.stage == StageStable || g.stage == StageDeprecated) && g.toVersion == nil {
		return nil, fmt.Errorf("no removal version set for %v gate %q", g.stage.String(), id)
	}

	if g.fromVersion != nil && g.toVersion != nil && g.toVersion.LessThan(g.fromVersion) {
		return nil, fmt.Errorf("toVersion %q is before fromVersion %q", g.toVersion, g.fromVersion)
	}

	if _, loaded := r.gates.LoadOrStore(id, g); loaded {
		return nil, fmt.Errorf("failed to register %q: %w", id, ErrAlreadyRegistered)
	}
	return g, nil
}

// Set the enabled valued for a Gate identified by the given id.
func (r *Registry) Set(id string, enabled bool) error {
	v, ok := r.gates.Load(id)
	if !ok {
		validGates := []string{}
		r.VisitAll(func(g *Gate) {
			validGates = append(validGates, g.ID())
		})
		return fmt.Errorf("no such feature gate %q. valid gates: %v", id, validGates)
	}
	g := v.(*Gate)

	switch g.stage {
	case StageStable:
		if !enabled {
			return fmt.Errorf("feature gate %q is stable, can not be disabled", id)
		}
		fmt.Printf("Feature gate %q is stable and already enabled. It will be removed in version %v and continued use of the gate after version %v will result in an error.\n", id, g.toVersion, g.toVersion)
	case StageDeprecated:
		if enabled {
			return fmt.Errorf("feature gate %q is deprecated, can not be enabled", id)
		}
		fmt.Printf("Feature gate %q is deprecated and already disabled. It will be removed in version %v and continued use of the gate after version %v will result in an error.\n", id, g.toVersion, g.toVersion)
	default:
		g.enabled.Store(enabled)
	}
	return nil
}

// VisitAll visits all the gates in lexicographical order, calling fn for each.
func (r *Registry) VisitAll(fn func(*Gate)) {
	var gates []*Gate
	r.gates.Range(func(_, value any) bool {
		gates = append(gates, value.(*Gate))
		return true
	})
	sort.Slice(gates, func(i, j int) bool {
		return gates[i].ID() < gates[j].ID()
	})
	for i := range gates {
		fn(gates[i])
	}
}
