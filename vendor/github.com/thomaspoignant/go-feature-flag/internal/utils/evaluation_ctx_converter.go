package utils

import "github.com/thomaspoignant/go-feature-flag/ffcontext"

// ConvertEvaluationCtxFromRequest convert the result of an unmarshal request from the API to a ffcontext.Context
// @param targetingKey the targeting key to use for the context
// @param custom the custom attributes to add to the context
// @return ffcontext.Context
func ConvertEvaluationCtxFromRequest(targetingKey string, custom map[string]interface{}) ffcontext.Context {
	ctx := ffcontext.NewEvaluationContextBuilder(targetingKey)
	for k, v := range custom {
		switch val := v.(type) {
		case float64:
			if IsIntegral(val) {
				ctx.AddCustom(k, int(val))
				continue
			}
			ctx.AddCustom(k, val)
		default:
			ctx.AddCustom(k, val)
		}
	}
	return ctx.Build()
}
