package ofrep

import (
	"context"
	"fmt"
	"net/http"

	"github.com/open-feature/go-sdk-contrib/providers/ofrep/internal/evaluate"
	"github.com/open-feature/go-sdk-contrib/providers/ofrep/internal/outbound"
	"github.com/open-feature/go-sdk/openfeature"
)

// Provider implementation for OFREP
type Provider struct {
	evaluator Evaluator
}

type Option func(*outbound.Configuration)

// NewProvider returns an OFREP provider configured with provided configuration.
// The only mandatory configuration is the baseUri, which is the base path of the OFREP service implementation.
func NewProvider(baseUri string, options ...Option) *Provider {
	cfg := outbound.Configuration{
		BaseURI: baseUri,
	}

	for _, option := range options {
		option(&cfg)
	}

	provider := &Provider{
		evaluator: evaluate.NewFlagsEvaluator(cfg),
	}

	return provider
}

func (p Provider) Metadata() openfeature.Metadata {
	return openfeature.Metadata{
		Name: "OpenFeature Remote Evaluation Protocol Provider",
	}
}

func (p Provider) BooleanEvaluation(ctx context.Context, flag string, defaultValue bool, evalCtx openfeature.FlattenedContext) openfeature.BoolResolutionDetail {
	return p.evaluator.ResolveBoolean(ctx, flag, defaultValue, evalCtx)
}

func (p Provider) StringEvaluation(ctx context.Context, flag string, defaultValue string, evalCtx openfeature.FlattenedContext) openfeature.StringResolutionDetail {
	return p.evaluator.ResolveString(ctx, flag, defaultValue, evalCtx)
}

func (p Provider) FloatEvaluation(ctx context.Context, flag string, defaultValue float64, evalCtx openfeature.FlattenedContext) openfeature.FloatResolutionDetail {
	return p.evaluator.ResolveFloat(ctx, flag, defaultValue, evalCtx)
}

func (p Provider) IntEvaluation(ctx context.Context, flag string, defaultValue int64, evalCtx openfeature.FlattenedContext) openfeature.IntResolutionDetail {
	return p.evaluator.ResolveInt(ctx, flag, defaultValue, evalCtx)
}

func (p Provider) ObjectEvaluation(ctx context.Context, flag string, defaultValue interface{}, evalCtx openfeature.FlattenedContext) openfeature.InterfaceResolutionDetail {
	return p.evaluator.ResolveObject(ctx, flag, defaultValue, evalCtx)
}

func (p Provider) Hooks() []openfeature.Hook {
	return []openfeature.Hook{}
}

// options of the OFREP provider

// WithHeaderProvider allows to configure a custom header callback to set a custom authorization header
func WithHeaderProvider(callback outbound.HeaderCallback) func(*outbound.Configuration) {
	return func(c *outbound.Configuration) {
		c.Callbacks = append(c.Callbacks, callback)
	}
}

// WithBearerToken allows to set token to be used for bearer token authorization
func WithBearerToken(token string) func(*outbound.Configuration) {
	return func(c *outbound.Configuration) {
		c.Callbacks = append(c.Callbacks, func() (string, string) {
			return "Authorization", fmt.Sprintf("Bearer %s", token)
		})
	}
}

// WithApiKeyAuth allows to set token to be used for api key authorization
func WithApiKeyAuth(token string) func(*outbound.Configuration) {
	return func(c *outbound.Configuration) {
		c.Callbacks = append(c.Callbacks, func() (string, string) {
			return "X-API-Key", token
		})
	}
}

// WithClient allows to provide a pre-configured http.Client for the communication with the OFREP service
func WithClient(client *http.Client) func(configuration *outbound.Configuration) {
	return func(configuration *outbound.Configuration) {
		configuration.Client = client
	}
}
