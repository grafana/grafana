package evaluate

import (
	"context"
	"fmt"

	"github.com/open-feature/go-sdk-contrib/providers/ofrep/internal/outbound"
	of "github.com/open-feature/go-sdk/openfeature"
)

// Flags is the flag evaluator implementation. It contains domain logic of the OpenFeature flag evaluation.
type Flags struct {
	resolver resolver
}

type resolver interface {
	resolveSingle(ctx context.Context, key string, evalCtx map[string]interface{}) (*successDto, *of.ResolutionError)
}

func NewFlagsEvaluator(cfg outbound.Configuration) *Flags {
	return &Flags{
		resolver: NewOutboundResolver(cfg),
	}
}

func (h Flags) ResolveBoolean(ctx context.Context, key string, defaultValue bool, evalCtx map[string]interface{}) of.BoolResolutionDetail {
	evalSuccess, resolutionError := h.resolver.resolveSingle(ctx, key, evalCtx)
	if resolutionError != nil {
		return of.BoolResolutionDetail{
			Value: defaultValue,
			ProviderResolutionDetail: of.ProviderResolutionDetail{
				ResolutionError: *resolutionError,
				Reason:          of.ErrorReason,
			},
		}
	}

	if evalSuccess.Reason == string(of.DisabledReason) {
		return of.BoolResolutionDetail{
			Value: defaultValue,
			ProviderResolutionDetail: of.ProviderResolutionDetail{
				Reason:       of.DisabledReason,
				Variant:      evalSuccess.Variant,
				FlagMetadata: evalSuccess.Metadata,
			},
		}
	}

	b, ok := evalSuccess.Value.(bool)
	if !ok {
		return of.BoolResolutionDetail{
			Value: defaultValue,
			ProviderResolutionDetail: of.ProviderResolutionDetail{
				ResolutionError: of.NewTypeMismatchResolutionError(fmt.Sprintf(
					"resolved value %v is not of boolean type", evalSuccess.Value)),
				Reason: of.ErrorReason,
			},
		}
	}

	return of.BoolResolutionDetail{
		Value: b,
		ProviderResolutionDetail: of.ProviderResolutionDetail{
			Reason:       of.Reason(evalSuccess.Reason),
			Variant:      evalSuccess.Variant,
			FlagMetadata: evalSuccess.Metadata,
		},
	}
}

func (h Flags) ResolveString(ctx context.Context, key string, defaultValue string, evalCtx map[string]interface{}) of.StringResolutionDetail {
	evalSuccess, resolutionError := h.resolver.resolveSingle(ctx, key, evalCtx)
	if resolutionError != nil {
		return of.StringResolutionDetail{
			Value: defaultValue,
			ProviderResolutionDetail: of.ProviderResolutionDetail{
				ResolutionError: *resolutionError,
				Reason:          of.ErrorReason,
			},
		}
	}

	if evalSuccess.Reason == string(of.DisabledReason) {
		return of.StringResolutionDetail{
			Value: defaultValue,
			ProviderResolutionDetail: of.ProviderResolutionDetail{
				Reason:       of.DisabledReason,
				Variant:      evalSuccess.Variant,
				FlagMetadata: evalSuccess.Metadata,
			},
		}
	}

	b, ok := evalSuccess.Value.(string)
	if !ok {
		return of.StringResolutionDetail{
			Value: defaultValue,
			ProviderResolutionDetail: of.ProviderResolutionDetail{
				ResolutionError: of.NewTypeMismatchResolutionError(fmt.Sprintf(
					"resolved value %v is not of string type", evalSuccess.Value)),
				Reason: of.ErrorReason,
			},
		}
	}

	return of.StringResolutionDetail{
		Value: b,
		ProviderResolutionDetail: of.ProviderResolutionDetail{
			Reason:       of.Reason(evalSuccess.Reason),
			Variant:      evalSuccess.Variant,
			FlagMetadata: evalSuccess.Metadata,
		},
	}
}

func (h Flags) ResolveFloat(ctx context.Context, key string, defaultValue float64, evalCtx map[string]interface{}) of.FloatResolutionDetail {
	evalSuccess, resolutionError := h.resolver.resolveSingle(ctx, key, evalCtx)
	if resolutionError != nil {
		return of.FloatResolutionDetail{
			Value: defaultValue,
			ProviderResolutionDetail: of.ProviderResolutionDetail{
				ResolutionError: *resolutionError,
				Reason:          of.ErrorReason,
			},
		}
	}

	if evalSuccess.Reason == string(of.DisabledReason) {
		return of.FloatResolutionDetail{
			Value: defaultValue,
			ProviderResolutionDetail: of.ProviderResolutionDetail{
				Reason:       of.DisabledReason,
				Variant:      evalSuccess.Variant,
				FlagMetadata: evalSuccess.Metadata,
			},
		}
	}

	var value float64

	switch evalSuccess.Value.(type) {
	case float32:
		value = float64(evalSuccess.Value.(float32))
	case float64:
		value = evalSuccess.Value.(float64)
	default:
		return of.FloatResolutionDetail{
			Value: defaultValue,
			ProviderResolutionDetail: of.ProviderResolutionDetail{
				ResolutionError: of.NewTypeMismatchResolutionError(fmt.Sprintf(
					"resolved value %v is not of float type", evalSuccess.Value)),
				Reason: of.ErrorReason,
			},
		}
	}

	return of.FloatResolutionDetail{
		Value: value,
		ProviderResolutionDetail: of.ProviderResolutionDetail{
			Reason:       of.Reason(evalSuccess.Reason),
			Variant:      evalSuccess.Variant,
			FlagMetadata: evalSuccess.Metadata,
		},
	}
}

func (h Flags) ResolveInt(ctx context.Context, key string, defaultValue int64, evalCtx map[string]interface{}) of.IntResolutionDetail {
	evalSuccess, resolutionError := h.resolver.resolveSingle(ctx, key, evalCtx)
	if resolutionError != nil {
		return of.IntResolutionDetail{
			Value: defaultValue,
			ProviderResolutionDetail: of.ProviderResolutionDetail{
				ResolutionError: *resolutionError,
				Reason:          of.ErrorReason,
			},
		}
	}

	if evalSuccess.Reason == string(of.DisabledReason) {
		return of.IntResolutionDetail{
			Value: defaultValue,
			ProviderResolutionDetail: of.ProviderResolutionDetail{
				Reason:       of.DisabledReason,
				Variant:      evalSuccess.Variant,
				FlagMetadata: evalSuccess.Metadata,
			},
		}
	}

	var value int64

	switch evalSuccess.Value.(type) {
	case int:
		value = int64(evalSuccess.Value.(int))
	case int64:
		value = evalSuccess.Value.(int64)
	case float64:
		value = int64(evalSuccess.Value.(float64))
		if float64(value) != evalSuccess.Value.(float64) {
			return of.IntResolutionDetail{
				Value: defaultValue,
				ProviderResolutionDetail: of.ProviderResolutionDetail{
					ResolutionError: of.NewTypeMismatchResolutionError(fmt.Sprintf(
						"resolved value %v is not of integer type", evalSuccess.Value)),
					Reason: of.ErrorReason,
				},
			}
		}
	default:
		return of.IntResolutionDetail{
			Value: defaultValue,
			ProviderResolutionDetail: of.ProviderResolutionDetail{
				ResolutionError: of.NewTypeMismatchResolutionError(fmt.Sprintf(
					"resolved value %v is not of integer type", evalSuccess.Value)),
				Reason: of.ErrorReason,
			},
		}
	}

	return of.IntResolutionDetail{
		Value: value,
		ProviderResolutionDetail: of.ProviderResolutionDetail{
			Reason:       of.Reason(evalSuccess.Reason),
			Variant:      evalSuccess.Variant,
			FlagMetadata: evalSuccess.Metadata,
		},
	}
}

func (h Flags) ResolveObject(ctx context.Context, key string, defaultValue interface{}, evalCtx map[string]interface{}) of.InterfaceResolutionDetail {
	evalSuccess, resolutionError := h.resolver.resolveSingle(ctx, key, evalCtx)
	if resolutionError != nil {
		return of.InterfaceResolutionDetail{
			Value: defaultValue,
			ProviderResolutionDetail: of.ProviderResolutionDetail{
				ResolutionError: *resolutionError,
				Reason:          of.ErrorReason,
			},
		}
	}

	if evalSuccess.Reason == string(of.DisabledReason) {
		return of.InterfaceResolutionDetail{
			Value: defaultValue,
			ProviderResolutionDetail: of.ProviderResolutionDetail{
				Reason:       of.DisabledReason,
				Variant:      evalSuccess.Variant,
				FlagMetadata: evalSuccess.Metadata,
			},
		}
	}

	return of.InterfaceResolutionDetail{
		Value: evalSuccess.Value,
		ProviderResolutionDetail: of.ProviderResolutionDetail{
			Reason:       of.Reason(evalSuccess.Reason),
			Variant:      evalSuccess.Variant,
			FlagMetadata: evalSuccess.Metadata,
		},
	}
}
