package hook

import (
	"context"
	"github.com/open-feature/go-sdk/openfeature"
)

func NewEvaluationEnrichmentHook(exporterMetadata map[string]interface{}) openfeature.Hook {
	return &evaluationEnrichmentHook{exporterMetadata: exporterMetadata}
}

type evaluationEnrichmentHook struct {
	exporterMetadata map[string]interface{}
}

func (d *evaluationEnrichmentHook) After(_ context.Context, _ openfeature.HookContext,
	_ openfeature.InterfaceEvaluationDetails, _ openfeature.HookHints) error {
	// Do nothing, needed to satisfy the interface
	return nil
}

func (d *evaluationEnrichmentHook) Error(_ context.Context, _ openfeature.HookContext,
	_ error, _ openfeature.HookHints) {
	// Do nothing, needed to satisfy the interface
}

func (d *evaluationEnrichmentHook) Before(_ context.Context, hookCtx openfeature.HookContext, _ openfeature.HookHints) (*openfeature.EvaluationContext, error) {
	attributes := hookCtx.EvaluationContext().Attributes()
	if goffSpecific, ok := attributes["gofeatureflag"]; ok {
		switch typed := goffSpecific.(type) {
		case map[string]interface{}:
			typed["exporterMetadata"] = d.exporterMetadata
		default:
			attributes["gofeatureflag"] = map[string]interface{}{"exporterMetadata": d.exporterMetadata}
		}
	} else {
		attributes["gofeatureflag"] = map[string]interface{}{"exporterMetadata": d.exporterMetadata}
	}
	newCtx := openfeature.NewEvaluationContext(hookCtx.EvaluationContext().TargetingKey(), attributes)
	return &newCtx, nil
}

func (d *evaluationEnrichmentHook) Finally(context.Context, openfeature.HookContext, openfeature.HookHints) {
	// Do nothing, needed to satisfy the interface
}
