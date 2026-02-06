package eval

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/protobuf/types/known/structpb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/condition"
	"github.com/openfga/openfga/internal/condition/metrics"
	"github.com/openfga/openfga/pkg/telemetry"
	"github.com/openfga/openfga/pkg/tuple"
)

var tracer = otel.Tracer("openfga/internal/condition/eval")

// EvaluateTupleCondition looks at the given tuple's condition and returns an evaluation result for the given context.
// If the tuple doesn't have a condition, it exits early and doesn't create a span.
// If the tuple's condition isn't found in the model it returns an EvaluationError.
func EvaluateTupleCondition(
	ctx context.Context,
	tupleKey *openfgav1.TupleKey,
	evaluableCondition *condition.EvaluableCondition,
	context *structpb.Struct,
) (bool, error) {
	if tupleKey.GetCondition().GetName() == "" {
		return true, nil
	}

	if evaluableCondition == nil || tupleKey.GetCondition().GetName() != evaluableCondition.GetName() {
		err := condition.NewEvaluationError(tupleKey.GetCondition().GetName(), fmt.Errorf("condition was not found"))
		return false, err
	}

	ctx, span := tracer.Start(ctx, "EvaluateTupleCondition", trace.WithAttributes(
		attribute.String("tuple_key", tuple.TupleKeyWithConditionToString(tupleKey)),
		attribute.String("condition_name", tupleKey.GetCondition().GetName())))
	defer span.End()

	start := time.Now()

	// merge both contexts
	contextFields := []map[string]*structpb.Value{
		{},
	}
	if context != nil {
		contextFields = []map[string]*structpb.Value{context.GetFields()}
	}

	tupleContext := tupleKey.GetCondition().GetContext()
	if tupleContext != nil {
		contextFields = append(contextFields, tupleContext.GetFields())
	}

	conditionResult, err := evaluableCondition.Evaluate(ctx, contextFields...)
	if err != nil {
		telemetry.TraceError(span, err)
		return false, err
	}

	if len(conditionResult.MissingParameters) > 0 {
		return false, condition.NewEvaluationError(
			tupleKey.GetCondition().GetName(),
			fmt.Errorf("tuple '%s' is missing context parameters '%v'",
				tuple.TupleKeyToString(tupleKey),
				conditionResult.MissingParameters),
		)
	}

	metrics.Metrics.ObserveEvaluationDuration(time.Since(start))
	metrics.Metrics.ObserveEvaluationCost(conditionResult.Cost)

	span.SetAttributes(attribute.Bool("condition_met", conditionResult.ConditionMet),
		attribute.String("condition_cost", strconv.FormatUint(conditionResult.Cost, 10)),
		attribute.StringSlice("condition_missing_params", conditionResult.MissingParameters),
	)

	return conditionResult.ConditionMet, nil
}
