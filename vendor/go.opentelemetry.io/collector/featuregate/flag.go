// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package featuregate // import "go.opentelemetry.io/collector/featuregate"

import (
	"flag"
	"strings"

	"go.uber.org/multierr"
)

const (
	featureGatesFlag            = "feature-gates"
	featureGatesFlagDescription = "Comma-delimited list of feature gate identifiers. Prefix with '-' to disable the feature. '+' or no prefix will enable the feature."
)

// RegisterFlagsOption is an option for RegisterFlags.
type RegisterFlagsOption interface {
	private()
}

// RegisterFlags that directly applies feature gate statuses to a Registry.
func (r *Registry) RegisterFlags(flagSet *flag.FlagSet, _ ...RegisterFlagsOption) {
	flagSet.Var(&flagValue{reg: r}, featureGatesFlag, featureGatesFlagDescription)
}

// flagValue implements the flag.Value interface and directly applies feature gate statuses to a Registry.
type flagValue struct {
	reg *Registry
}

func (f *flagValue) String() string {
	// This function can be called by isZeroValue https://github.com/golang/go/blob/go1.23.3/src/flag/flag.go#L630
	// which creates an instance of flagValue using reflect.New. In this case, the field `reg` is nil.
	if f.reg == nil {
		return ""
	}

	var ids []string
	f.reg.VisitAll(func(g *Gate) {
		id := g.ID()
		if !g.IsEnabled() {
			id = "-" + id
		}
		ids = append(ids, id)
	})
	return strings.Join(ids, ",")
}

func (f *flagValue) Set(s string) error {
	if s == "" {
		return nil
	}

	var errs error
	ids := strings.Split(s, ",")
	for i := range ids {
		id := ids[i]
		val := true
		switch id[0] {
		case '-':
			id = id[1:]
			val = false
		case '+':
			id = id[1:]
		}
		errs = multierr.Append(errs, f.reg.Set(id, val))
	}
	return errs
}
