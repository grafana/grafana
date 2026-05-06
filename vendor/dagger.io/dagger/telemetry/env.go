package telemetry

import (
	"context"
	"os"
	"strings"

	"go.opentelemetry.io/otel/propagation"
)

func PropagationEnv(ctx context.Context) []string {
	carrier := NewEnvCarrier(false)
	Propagator.Inject(ctx, carrier)
	return carrier.Env
}

type EnvCarrier struct {
	System bool
	Env    []string
}

func NewEnvCarrier(system bool) *EnvCarrier {
	return &EnvCarrier{
		System: system,
	}
}

var _ propagation.TextMapCarrier = (*EnvCarrier)(nil)

func (c *EnvCarrier) Get(key string) string {
	envName := strings.ToUpper(key)
	for _, env := range c.Env {
		env, val, ok := strings.Cut(env, "=")
		if ok && env == envName {
			return val
		}
	}
	if c.System {
		if envVal := os.Getenv(envName); envVal != "" {
			return envVal
		}
	}
	return ""
}

func (c *EnvCarrier) Set(key, val string) {
	c.Env = append(c.Env, strings.ToUpper(key)+"="+val)
}

func (c *EnvCarrier) Keys() []string {
	keys := make([]string, 0, len(c.Env))
	for _, env := range c.Env {
		env, _, ok := strings.Cut(env, "=")
		if ok {
			keys = append(keys, env)
		}
	}
	return keys
}
