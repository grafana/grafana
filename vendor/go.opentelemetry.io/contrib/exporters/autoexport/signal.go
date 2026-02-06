// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package autoexport // import "go.opentelemetry.io/contrib/exporters/autoexport"

import (
	"context"
	"os"
)

type signal[T any] struct {
	envKey   string
	registry *registry[T]
}

func newSignal[T any](envKey string) signal[T] {
	return signal[T]{
		envKey: envKey,
		registry: &registry[T]{
			names: make(map[string]func(context.Context) (T, error)),
		},
	}
}

func (s signal[T]) create(ctx context.Context, opts ...option[T]) (T, error) {
	var cfg config[T]
	for _, opt := range opts {
		opt.apply(&cfg)
	}

	expType := os.Getenv(s.envKey)
	if expType == "" {
		if cfg.fallbackFactory != nil {
			return cfg.fallbackFactory(ctx)
		}
		expType = "otlp"
	}

	return s.registry.load(ctx, expType)
}

type config[T any] struct {
	fallbackFactory func(ctx context.Context) (T, error)
}

type option[T any] interface {
	apply(cfg *config[T])
}

type optionFunc[T any] func(cfg *config[T])

//lint:ignore U1000 https://github.com/dominikh/go-tools/issues/1440
func (fn optionFunc[T]) apply(cfg *config[T]) {
	fn(cfg)
}

func withFallbackFactory[T any](fallbackFactory func(ctx context.Context) (T, error)) option[T] {
	return optionFunc[T](func(cfg *config[T]) {
		cfg.fallbackFactory = fallbackFactory
	})
}
