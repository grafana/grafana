package condition

import (
	"context"
	"fmt"
	"reflect"
	"sync"
	"time"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common"
	celtypes "github.com/google/cel-go/common/types"
	"go.opentelemetry.io/otel"
	"golang.org/x/exp/maps"
	"google.golang.org/protobuf/types/known/structpb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/condition/metrics"
	"github.com/openfga/openfga/internal/condition/types"
)

var tracer = otel.Tracer("openfga/internal/condition")

var celBaseEnv *cel.Env

func init() {
	var envOpts []cel.EnvOption
	for _, customTypeOpts := range types.CustomParamTypes {
		envOpts = append(envOpts, customTypeOpts...)
	}

	envOpts = append(envOpts, types.IPAddressEnvOption(), cel.EagerlyValidateDeclarations(true))

	env, err := cel.NewEnv(envOpts...)
	if err != nil {
		panic(fmt.Sprintf("failed to construct CEL base env: %v", err))
	}

	celBaseEnv = env
}

var emptyEvaluationResult = EvaluationResult{}

type EvaluationResult struct {
	Cost              uint64
	ConditionMet      bool
	MissingParameters []string
}

// EvaluableCondition represents a condition that can eventually be evaluated
// given a CEL expression and a set of parameters. Calling .Evaluate() will
// optionally call .Compile() which validates and compiles the expression and
// parameter type definitions if it hasn't been done already.
type EvaluableCondition struct {
	*openfgav1.Condition

	celProgramOpts []cel.ProgramOption
	celEnv         *cel.Env
	celProgram     cel.Program
	compileOnce    sync.Once
}

// Compile compiles a condition expression with a CEL environment
// constructed from the condition's parameter type definitions into a valid
// AST that can be evaluated at a later time.
func (e *EvaluableCondition) Compile() error {
	var compileErr error

	e.compileOnce.Do(func() {
		if err := e.compile(); err != nil {
			compileErr = err
			return
		}
	})

	return compileErr
}

func (e *EvaluableCondition) compile() error {
	start := time.Now()

	var err error
	defer func() {
		if err == nil {
			metrics.Metrics.ObserveCompilationDuration(time.Since(start))
		}
	}()

	var envOpts []cel.EnvOption
	conditionParamTypes := map[string]*types.ParameterType{}
	for paramName, paramTypeRef := range e.GetParameters() {
		paramType, err := types.DecodeParameterType(paramTypeRef)
		if err != nil {
			return &CompilationError{
				Condition: e.Name,
				Cause:     fmt.Errorf("failed to decode parameter type for parameter '%s': %w", paramName, err),
			}
		}

		conditionParamTypes[paramName] = paramType
	}

	for paramName, paramType := range conditionParamTypes {
		envOpts = append(envOpts, cel.Variable(paramName, paramType.CelType()))
	}

	env, err := celBaseEnv.Extend(envOpts...)
	if err != nil {
		return &CompilationError{
			Condition: e.Name,
			Cause:     err,
		}
	}

	source := common.NewStringSource(e.Expression, e.Name)
	ast, issues := env.CompileSource(source)
	if issues != nil {
		if err = issues.Err(); err != nil {
			return &CompilationError{
				Condition: e.Name,
				Cause:     err,
			}
		}
	}

	e.celProgramOpts = append(e.celProgramOpts, cel.EvalOptions(cel.OptPartialEval))

	prg, err := env.Program(ast, e.celProgramOpts...)
	if err != nil {
		return &CompilationError{
			Condition: e.Name,
			Cause:     fmt.Errorf("condition expression construction: %w", err),
		}
	}

	if !reflect.DeepEqual(ast.OutputType(), cel.BoolType) {
		return &CompilationError{
			Condition: e.Name,
			Cause:     fmt.Errorf("expected a bool condition expression output, but got '%s'", ast.OutputType()),
		}
	}

	e.celEnv = env
	e.celProgram = prg
	return nil
}

// CastContextToTypedParameters converts the provided context to typed condition
// parameters and returns an error if any additional context fields are provided
// that are not defined by the evaluable condition.
func (e *EvaluableCondition) CastContextToTypedParameters(contextMap map[string]*structpb.Value) (map[string]any, error) {
	if len(contextMap) == 0 {
		return nil, nil
	}

	parameterTypes := e.GetParameters()

	if len(parameterTypes) == 0 {
		return nil, &ParameterTypeError{
			Condition: e.Name,
			Cause:     fmt.Errorf("no parameters defined for the condition"),
		}
	}

	converted := make(map[string]any, len(contextMap))

	for parameterKey, paramTypeRef := range parameterTypes {
		contextValue, ok := contextMap[parameterKey]
		if !ok {
			continue
		}

		varType, err := types.DecodeParameterType(paramTypeRef)
		if err != nil {
			return nil, &ParameterTypeError{
				Condition: e.Name,
				Cause:     fmt.Errorf("failed to decode condition parameter type '%s': %w", paramTypeRef.GetTypeName(), err),
			}
		}

		convertedParam, err := varType.ConvertValue(contextValue.AsInterface())
		if err != nil {
			return nil, &ParameterTypeError{
				Condition: e.Name,
				Cause:     fmt.Errorf("failed to convert context parameter '%s': %w", parameterKey, err),
			}
		}

		converted[parameterKey] = convertedParam
	}

	return converted, nil
}

// Evaluate evaluates the provided CEL condition expression with a CEL environment
// constructed from the condition's parameter type definitions and using the context maps provided.
// If more than one source map of context is provided, and if the keys provided in those map
// context(s) are overlapping, then the overlapping key for the last most context wins.
// If there are parameters missing, ConditionMet will always be set as false.
func (e *EvaluableCondition) Evaluate(
	ctx context.Context,
	contextMaps ...map[string]*structpb.Value,
) (EvaluationResult, error) {
	_, span := tracer.Start(ctx, "Evaluate")
	defer span.End()

	if err := e.Compile(); err != nil {
		return emptyEvaluationResult, NewEvaluationError(e.Name, err)
	}

	contextFields := contextMaps[0]
	if contextFields == nil {
		contextFields = map[string]*structpb.Value{}
	}

	// merge context fields
	clonedContextFields := maps.Clone(contextFields)

	for _, fields := range contextMaps[1:] {
		maps.Copy(clonedContextFields, fields)
	}

	typedParams, err := e.CastContextToTypedParameters(clonedContextFields)
	if err != nil {
		return emptyEvaluationResult, NewEvaluationError(e.Name, err)
	}

	activation, err := e.celEnv.PartialVars(typedParams)
	if err != nil {
		return emptyEvaluationResult, NewEvaluationError(e.Name, fmt.Errorf("failed to construct condition partial vars: %w", err))
	}

	var missingParameters []string
	for key := range e.GetParameters() {
		if _, ok := activation.ResolveName(key); ok {
			continue
		}

		missingParameters = append(missingParameters, key)
	}

	out, details, err := e.celProgram.ContextEval(ctx, activation)
	if err != nil {
		return emptyEvaluationResult, NewEvaluationError(
			e.Name,
			fmt.Errorf("failed to evaluate condition expression: %w", err),
		)
	}

	var evaluationCost uint64
	if details != nil {
		cost := details.ActualCost()
		if cost != nil {
			evaluationCost = *cost
		}
	}

	if celtypes.IsUnknown(out) {
		return EvaluationResult{
			ConditionMet:      false,
			MissingParameters: missingParameters,
			Cost:              evaluationCost,
		}, nil
	}

	conditionMetVal, err := out.ConvertToNative(reflect.TypeOf(false))
	if err != nil {
		return emptyEvaluationResult, NewEvaluationError(
			e.Name,
			fmt.Errorf("failed to convert condition output to bool: %w", err),
		)
	}

	conditionMet, ok := conditionMetVal.(bool)
	if !ok {
		return emptyEvaluationResult, NewEvaluationError(
			e.Name,
			fmt.Errorf("expected CEL type conversion to return native Go bool"),
		)
	}

	return EvaluationResult{
		ConditionMet:      conditionMet,
		MissingParameters: missingParameters,
		Cost:              evaluationCost,
	}, nil
}

// WithTrackEvaluationCost enables CEL evaluation cost on the EvaluableCondition and returns the
// mutated EvaluableCondition. The expectation is that this is called on the Uncompiled condition
// because it modifies the behavior of the CEL program that is constructed after Compile.
func (e *EvaluableCondition) WithTrackEvaluationCost() *EvaluableCondition {
	e.celProgramOpts = append(e.celProgramOpts, cel.EvalOptions(cel.OptOptimize, cel.OptTrackCost))

	return e
}

// WithMaxEvaluationCost enables CEL evaluation cost enforcement on the EvaluableCondition and
// returns the mutated EvaluableCondition. The expectation is that this is called on the Uncompiled
// condition because it modifies the behavior of the CEL program that is constructed after Compile.
func (e *EvaluableCondition) WithMaxEvaluationCost(cost uint64) *EvaluableCondition {
	e.celProgramOpts = append(e.celProgramOpts, cel.CostLimit(cost))

	return e
}

// WithInterruptCheckFrequency defines the upper limit on the number of iterations within a CEL comprehension to evaluate before CEL will interrupt evaluation and check for cancellation.
// Within a comprehension on the EvaluableCondition and returns the mutated EvaluableCondition.
// The expectation is that this is called on the Uncompiled condition because it modifies
// the behavior of the CEL program that is constructed after Compile.
func (e *EvaluableCondition) WithInterruptCheckFrequency(checkFrequency uint) *EvaluableCondition {
	e.celProgramOpts = append(e.celProgramOpts, cel.InterruptCheckFrequency(checkFrequency))

	return e
}

// NewUncompiled returns a new EvaluableCondition that has not
// validated and compiled its expression.
func NewUncompiled(condition *openfgav1.Condition) *EvaluableCondition {
	return &EvaluableCondition{Condition: condition}
}

// NewCompiled returns a new EvaluableCondition with a validated and
// compiled expression.
func NewCompiled(condition *openfgav1.Condition) (*EvaluableCondition, error) {
	compiled := NewUncompiled(condition)

	if err := compiled.Compile(); err != nil {
		return nil, err
	}

	return compiled, nil
}
