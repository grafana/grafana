package kubeconfig

import (
	"context"
	"errors"

	"k8s.io/client-go/rest"
)

var (
	// ErrContextValueMissing is an error that's returned
	// when trying to fetch a Config from a context that doesn't have one.
	ErrContextValueMissing = errors.New("context does not contain the kubeconfig value")
)

type ctxKey struct{}

// NamespacedConfig is the configuration for a Kubernetes client.
// It contains a rest.Config, as well as the Kubernetes namespace to use when interacting with resources.
type NamespacedConfig struct {
	// CRC32 is used for equality checks.
	CRC32 uint32

	// RestConfig contains the Kubernetes rest.Config for creating API clients.
	RestConfig rest.Config

	// Namespace contains the namespace in which the resources should be stored and retrieved from.
	Namespace string
}

// Equals returns true if Config is equal to other.
func (c NamespacedConfig) Equals(other NamespacedConfig) bool {
	return c.CRC32 == other.CRC32
}

// WithContext returns a new Context that contains Config inside.
func WithContext(ctx context.Context, val NamespacedConfig) context.Context {
	return context.WithValue(ctx, ctxKey{}, val)
}

// FromContext extracts a Config from provided Context.
// If the Config is missing an error will be returned.
func FromContext(ctx context.Context) (NamespacedConfig, error) {
	val, ok := ctx.Value(ctxKey{}).(NamespacedConfig)
	if !ok {
		return NamespacedConfig{}, ErrContextValueMissing
	}

	return val, nil
}

// MustFromContext extracts a Config from provided Context.
// If the Config is missing the call will panic.
func MustFromContext(ctx context.Context) NamespacedConfig {
	val, err := FromContext(ctx)
	if err != nil {
		panic(err)
	}

	return val
}
