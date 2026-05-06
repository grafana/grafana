package hook

import (
	"context"
	"github.com/open-feature/go-sdk-contrib/providers/go-feature-flag/pkg/controller"
	"github.com/open-feature/go-sdk-contrib/providers/go-feature-flag/pkg/model"
	"github.com/open-feature/go-sdk/openfeature"
	"time"
)

func NewDataCollectorHook(dataCollectorManager *controller.DataCollectorManager) openfeature.Hook {
	return &dataCollectorHook{dataCollectorManager: dataCollectorManager}
}

type dataCollectorHook struct {
	dataCollectorManager *controller.DataCollectorManager
}

func (d *dataCollectorHook) After(ctx context.Context, hookCtx openfeature.HookContext,
	evalDetails openfeature.InterfaceEvaluationDetails, hint openfeature.HookHints) error {
	if evalDetails.Reason != openfeature.CachedReason {
		// we send it only when cached because the evaluation will be collected directly in the relay-proxy
		return nil
	}
	event := model.FeatureEvent{
		Kind:         "feature",
		ContextKind:  "user",
		UserKey:      hookCtx.EvaluationContext().TargetingKey(),
		CreationDate: time.Now().Unix(),
		Key:          hookCtx.FlagKey(),
		Variation:    evalDetails.Variant,
		Value:        evalDetails.Value,
		Default:      false,
		Source:       "PROVIDER_CACHE",
	}
	_ = d.dataCollectorManager.AddEvent(event)
	return nil
}

func (d *dataCollectorHook) Error(ctx context.Context, hookCtx openfeature.HookContext,
	err error, hint openfeature.HookHints) {
	event := model.FeatureEvent{
		Kind:         "feature",
		ContextKind:  "user",
		UserKey:      hookCtx.EvaluationContext().TargetingKey(),
		CreationDate: time.Now().Unix(),
		Key:          hookCtx.FlagKey(),
		Variation:    "SdkDefault",
		Value:        hookCtx.DefaultValue(),
		Default:      true,
		Source:       "PROVIDER_CACHE",
	}
	_ = d.dataCollectorManager.AddEvent(event)
}

func (d *dataCollectorHook) Before(context.Context, openfeature.HookContext, openfeature.HookHints) (*openfeature.EvaluationContext, error) {
	// Do nothing, needed to satisfy the interface
	return nil, nil
}

func (d *dataCollectorHook) Finally(context.Context, openfeature.HookContext, openfeature.HookHints) {
	// Do nothing, needed to satisfy the interface
}
