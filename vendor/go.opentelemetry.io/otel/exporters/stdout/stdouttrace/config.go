// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package stdouttrace // import "go.opentelemetry.io/otel/exporters/stdout/stdouttrace"

import (
	"io"
	"os"
)

var (
	defaultWriter      = os.Stdout
	defaultPrettyPrint = false
	defaultTimestamps  = true
)

// config contains options for the STDOUT exporter.
type config struct {
	// Writer is the destination.  If not set, os.Stdout is used.
	Writer io.Writer

	// PrettyPrint will encode the output into readable JSON. Default is
	// false.
	PrettyPrint bool

	// Timestamps specifies if timestamps should be printed. Default is
	// true.
	Timestamps bool
}

// newConfig creates a validated Config configured with options.
func newConfig(options ...Option) config {
	cfg := config{
		Writer:      defaultWriter,
		PrettyPrint: defaultPrettyPrint,
		Timestamps:  defaultTimestamps,
	}
	for _, opt := range options {
		cfg = opt.apply(cfg)
	}
	return cfg
}

// Option sets the value of an option for a Config.
type Option interface {
	apply(config) config
}

// WithWriter sets the export stream destination.
func WithWriter(w io.Writer) Option {
	return writerOption{w}
}

type writerOption struct {
	W io.Writer
}

func (o writerOption) apply(cfg config) config {
	cfg.Writer = o.W
	return cfg
}

// WithPrettyPrint prettifies the emitted output.
func WithPrettyPrint() Option {
	return prettyPrintOption(true)
}

type prettyPrintOption bool

func (o prettyPrintOption) apply(cfg config) config {
	cfg.PrettyPrint = bool(o)
	return cfg
}

// WithoutTimestamps sets the export stream to not include timestamps.
func WithoutTimestamps() Option {
	return timestampsOption(false)
}

type timestampsOption bool

func (o timestampsOption) apply(cfg config) config {
	cfg.Timestamps = bool(o)
	return cfg
}
