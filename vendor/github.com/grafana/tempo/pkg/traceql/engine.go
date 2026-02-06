package traceql

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/tempo/pkg/tempopb"
	common_v1 "github.com/grafana/tempo/pkg/tempopb/common/v1"
	"github.com/grafana/tempo/pkg/util"
)

const (
	DefaultSpansPerSpanSet int = 3
)

type SpansetFilterFunc func(input []*Spanset) (result []*Spanset, err error)

type Engine struct{}

func NewEngine() *Engine {
	return &Engine{}
}

func Compile(query string) (*RootExpr, SpansetFilterFunc, firstStageElement, secondStageElement, *FetchSpansRequest, error) {
	expr, err := Parse(query)
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}

	req := &FetchSpansRequest{
		AllConditions: true,
	}
	expr.extractConditions(req)

	err = expr.validate()
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}

	return expr, expr.Pipeline.evaluate, expr.MetricsPipeline, expr.MetricsSecondStage, req, nil
}

func (e *Engine) ExecuteSearch(ctx context.Context, searchReq *tempopb.SearchRequest, spanSetFetcher SpansetFetcher) (*tempopb.SearchResponse, error) {
	ctx, span := tracer.Start(ctx, "traceql.Engine.ExecuteSearch")
	defer span.End()

	rootExpr, _, _, _, fetchSpansRequest, err := Compile(searchReq.Query)
	if err != nil {
		return nil, err
	}

	var mostRecent, ok bool
	if mostRecent, ok = rootExpr.Hints.GetBool(HintMostRecent, false); !ok {
		mostRecent = false
	}

	if rootExpr.IsNoop() {
		return &tempopb.SearchResponse{
			Traces:  nil,
			Metrics: &tempopb.SearchMetrics{},
		}, nil
	}

	fetchSpansRequest.StartTimeUnixNanos = unixSecToNano(searchReq.Start)
	fetchSpansRequest.EndTimeUnixNanos = unixSecToNano(searchReq.End)

	span.SetAttributes(attribute.String("pipeline", rootExpr.Pipeline.String()))
	span.SetAttributes(attribute.String("fetchSpansRequest", fmt.Sprint(fetchSpansRequest)))

	// calculate search meta conditions.
	meta := SearchMetaConditionsWithout(fetchSpansRequest.Conditions, fetchSpansRequest.AllConditions)
	fetchSpansRequest.SecondPassConditions = append(fetchSpansRequest.SecondPassConditions, meta...)

	spansetsEvaluated := 0
	// set up the expression evaluation as a filter to reduce data pulled
	fetchSpansRequest.SecondPass = func(inSS *Spanset) ([]*Spanset, error) {
		if len(inSS.Spans) == 0 {
			return nil, nil
		}

		evalSS, err := rootExpr.Pipeline.evaluate([]*Spanset{inSS})
		if err != nil {
			span.RecordError(err, trace.WithAttributes(attribute.String("msg", "pipeline.evaluate")))
			return nil, err
		}

		spansetsEvaluated++
		if len(evalSS) == 0 {
			return nil, nil
		}

		// reduce all evalSS to their max length to reduce meta data lookups
		for i := range evalSS {
			l := len(evalSS[i].Spans)
			evalSS[i].AddAttribute(attributeMatched, NewStaticInt(l))

			spansPerSpanSet := int(searchReq.SpansPerSpanSet)
			if spansPerSpanSet == 0 {
				spansPerSpanSet = DefaultSpansPerSpanSet
			}
			if l > spansPerSpanSet {
				evalSS[i].Spans = evalSS[i].Spans[:spansPerSpanSet]
			}
		}

		return evalSS, nil
	}

	fetchSpansResponse, err := spanSetFetcher.Fetch(ctx, *fetchSpansRequest)
	if err != nil {
		return nil, err
	}
	iterator := fetchSpansResponse.Results
	defer iterator.Close()

	res := &tempopb.SearchResponse{
		Traces:  nil,
		Metrics: &tempopb.SearchMetrics{},
	}
	combiner := NewMetadataCombiner(int(searchReq.Limit), mostRecent)
	for {
		spanset, err := iterator.Next(ctx)
		if err != nil && !errors.Is(err, io.EOF) {
			span.RecordError(err, trace.WithAttributes(attribute.String("msg", "iterator.Next")))
			return nil, err
		}
		if spanset == nil {
			break
		}

		combiner.addSpanset(spanset)
		if combiner.IsCompleteFor(TimestampNever) {
			break
		}
	}
	res.Traces = combiner.Metadata()

	span.SetAttributes(attribute.Int("spansets_evaluated", spansetsEvaluated))
	span.SetAttributes(attribute.Int("spansets_found", len(res.Traces)))

	// Bytes can be nil when callback is no set
	if fetchSpansResponse.Bytes != nil {
		// InspectedBytes is used to compute query throughput and SLO metrics
		res.Metrics.InspectedBytes = fetchSpansResponse.Bytes()
		span.SetAttributes(attribute.Int64("inspectedBytes", int64(res.Metrics.InspectedBytes)))
	}

	return res, nil
}

func (e *Engine) ExecuteTagValues(
	ctx context.Context,
	tag Attribute,
	query string,
	cb FetchTagValuesCallback,
	fetcher TagValuesFetcher,
) error {
	ctx, span := tracer.Start(ctx, "traceql.Engine.ExecuteTagValues")
	defer span.End()

	span.SetAttributes(attribute.String("sanitized query", query))

	rootExpr, err := Parse(query)
	if err != nil {
		// If the query has bad TraceQL, don't error out, return unfiltered results
		var parseErr *ParseError
		if errors.As(err, &parseErr) {
			rootExpr, _ = Parse("{ true }")
		} else {
			return err
		}
	}

	autocompleteReq := e.createAutocompleteRequest(tag, rootExpr.Pipeline)

	span.SetAttributes(attribute.String("pipeline", rootExpr.Pipeline.String()))
	span.SetAttributes(attribute.String("autocompleteReq", fmt.Sprint(autocompleteReq)))

	// If the tag we are fetching is already filtered in the query, then this is a noop.
	// I.e. we are autocompleting resource.service.name and the query was {resource.service.name="foo"}
	for _, c := range autocompleteReq.Conditions {
		if c.Attribute == tag && c.Op == OpEqual {
			// If the tag is already filtered in the query,
			// then we can just return the operand as the only value.
			if len(c.Operands) > 0 {
				cb(c.Operands[0])
			}
			return nil
		}
	}

	return fetcher.Fetch(ctx, autocompleteReq, cb)
}

func (e *Engine) ExecuteTagNames(
	ctx context.Context,
	scope AttributeScope,
	query string,
	cb FetchTagsCallback,
	fetcher TagNamesFetcher,
) error {
	ctx, span := tracer.Start(ctx, "traceql.Engine.ExecuteTagNames")
	defer span.End()

	span.SetAttributes(attribute.String("sanitized query", query))

	var conditions []Condition
	rootExpr, err := Parse(query)
	// if the parse succeeded then use those conditions, otherwise pass in none. the next layer will handle it
	if err == nil {
		req := &FetchSpansRequest{}
		rootExpr.Pipeline.extractConditions(req)
		conditions = req.Conditions
	}

	autocompleteReq := FetchTagsRequest{
		Conditions: conditions,
		Scope:      scope,
	}

	span.SetAttributes(attribute.String("pipeline", rootExpr.Pipeline.String()))
	span.SetAttributes(attribute.String("autocompleteReq", fmt.Sprint(autocompleteReq)))

	return fetcher.Fetch(ctx, autocompleteReq, cb)
}

func (e *Engine) createAutocompleteRequest(tag Attribute, pipeline Pipeline) FetchTagValuesRequest {
	req := FetchSpansRequest{
		Conditions:    nil,
		AllConditions: true,
	}

	// TODO: This is a hack. If the pipeline is empty, startTime is added as a condition
	//  and breaks optimizations in block_autocomplete.go.
	//  We only want the attribute we're searching for in the conditions.
	if pipeline.String() == "{ true }" {
		return FetchTagValuesRequest{
			Conditions: []Condition{{Attribute: tag, Op: OpNone}},
			TagName:    tag,
		}
	}

	pipeline.extractConditions(&req)

	req.Conditions = append(req.Conditions, Condition{
		Attribute: tag,
		Op:        OpNone,
	})

	autocompleteReq := FetchTagValuesRequest{
		Conditions: req.Conditions,
		TagName:    tag,
	}

	return autocompleteReq
}

func asTraceSearchMetadata(spanset *Spanset) *tempopb.TraceSearchMetadata {
	metadata := &tempopb.TraceSearchMetadata{
		TraceID:           util.TraceIDToHexString(spanset.TraceID),
		RootServiceName:   spanset.RootServiceName,
		RootTraceName:     spanset.RootSpanName,
		StartTimeUnixNano: spanset.StartTimeUnixNanos,
		DurationMs:        uint32(spanset.DurationNanos / 1_000_000),
		ServiceStats:      make(map[string]*tempopb.ServiceStats, len(spanset.ServiceStats)),
		SpanSet:           &tempopb.SpanSet{},
	}

	for service, stats := range spanset.ServiceStats {
		metadata.ServiceStats[service] = &tempopb.ServiceStats{
			SpanCount:  stats.SpanCount,
			ErrorCount: stats.ErrorCount,
		}
	}

	for _, span := range spanset.Spans {
		tempopbSpan := &tempopb.Span{
			SpanID:            util.SpanIDToHexString(span.ID()),
			StartTimeUnixNano: span.StartTimeUnixNanos(),
			DurationNanos:     span.DurationNanos(),
			Attributes:        nil,
		}

		atts := span.AllAttributes()

		if name, ok := atts[NewIntrinsic(IntrinsicName)]; ok {
			tempopbSpan.Name = name.EncodeToString(false)
		}

		for attribute, static := range atts {
			if attribute.Intrinsic == IntrinsicName ||
				attribute.Intrinsic == IntrinsicDuration ||
				attribute.Intrinsic == IntrinsicTraceDuration ||
				attribute.Intrinsic == IntrinsicTraceRootService ||
				attribute.Intrinsic == IntrinsicTraceRootSpan ||
				attribute.Intrinsic == IntrinsicTraceID ||
				attribute.Intrinsic == IntrinsicSpanID {

				continue
			}

			staticAnyValue := static.AsAnyValue()

			keyValue := &common_v1.KeyValue{
				Key:   attribute.Name,
				Value: staticAnyValue,
			}

			tempopbSpan.Attributes = append(tempopbSpan.Attributes, keyValue)
		}

		metadata.SpanSet.Spans = append(metadata.SpanSet.Spans, tempopbSpan)
	}

	// create a new slice and add the spanset to it. eventually we will deprecate
	//  metadata.SpanSet. populating both the SpanSet and the []SpanSets is for
	//  backwards compatibility with Grafana. since this method only translates one
	//  spanset into a TraceSearchMetadata Spansets[0] == Spanset. Higher up the chain
	//  we will combine Spansets with the same trace id.
	metadata.SpanSets = []*tempopb.SpanSet{metadata.SpanSet}

	// add attributes
	for _, att := range spanset.Attributes {
		if att.Name == attributeMatched {
			if n, ok := att.Val.Int(); ok {
				metadata.SpanSet.Matched = uint32(n)
			}
			continue
		}

		staticAnyValue := att.Val.AsAnyValue()
		keyValue := &common_v1.KeyValue{
			Key:   att.Name,
			Value: staticAnyValue,
		}
		metadata.SpanSet.Attributes = append(metadata.SpanSet.Attributes, keyValue)
	}

	return metadata
}

func unixSecToNano(ts uint32) uint64 {
	return uint64(ts) * uint64(time.Second/time.Nanosecond)
}

func (s Static) AsAnyValue() *common_v1.AnyValue {
	switch s.Type {
	case TypeInt:
		n, _ := s.Int()
		return &common_v1.AnyValue{
			Value: &common_v1.AnyValue_IntValue{
				IntValue: int64(n),
			},
		}
	case TypeFloat:
		return &common_v1.AnyValue{
			Value: &common_v1.AnyValue_DoubleValue{
				DoubleValue: s.Float(),
			},
		}
	case TypeBoolean:
		b, _ := s.Bool()
		return &common_v1.AnyValue{
			Value: &common_v1.AnyValue_BoolValue{
				BoolValue: b,
			},
		}
	case TypeDuration:
		d, _ := s.Duration()
		return &common_v1.AnyValue{
			Value: &common_v1.AnyValue_StringValue{
				StringValue: d.String(),
			},
		}
	case TypeString, TypeStatus, TypeNil, TypeKind:
		return &common_v1.AnyValue{
			Value: &common_v1.AnyValue_StringValue{
				StringValue: s.EncodeToString(false),
			},
		}
	case TypeIntArray:
		ints, _ := s.IntArray()

		anyInts := make([]common_v1.AnyValue_IntValue, len(ints))
		anyVals := make([]common_v1.AnyValue, len(ints))
		anyArray := common_v1.ArrayValue{
			Values: make([]*common_v1.AnyValue, len(ints)),
		}
		for i, n := range ints {
			anyInts[i].IntValue = int64(n)
			anyVals[i].Value = &anyInts[i]
			anyArray.Values[i] = &anyVals[i]
		}

		return &common_v1.AnyValue{Value: &common_v1.AnyValue_ArrayValue{ArrayValue: &anyArray}}
	case TypeFloatArray:
		floats, _ := s.FloatArray()

		anyDouble := make([]common_v1.AnyValue_DoubleValue, len(floats))
		anyVals := make([]common_v1.AnyValue, len(floats))
		anyArray := common_v1.ArrayValue{
			Values: make([]*common_v1.AnyValue, len(floats)),
		}
		for i, f := range floats {
			anyDouble[i].DoubleValue = f
			anyVals[i].Value = &anyDouble[i]
			anyArray.Values[i] = &anyVals[i]
		}

		return &common_v1.AnyValue{Value: &common_v1.AnyValue_ArrayValue{ArrayValue: &anyArray}}
	case TypeStringArray:
		strs, _ := s.StringArray()

		anyStrs := make([]common_v1.AnyValue_StringValue, len(strs))
		anyVals := make([]common_v1.AnyValue, len(strs))
		anyArray := common_v1.ArrayValue{
			Values: make([]*common_v1.AnyValue, len(strs)),
		}
		for i, str := range strs {
			anyStrs[i].StringValue = str
			anyVals[i].Value = &anyStrs[i]
			anyArray.Values[i] = &anyVals[i]
		}

		return &common_v1.AnyValue{Value: &common_v1.AnyValue_ArrayValue{ArrayValue: &anyArray}}
	case TypeBooleanArray:
		bools, _ := s.BooleanArray()

		anyBools := make([]common_v1.AnyValue_BoolValue, len(bools))
		anyVals := make([]common_v1.AnyValue, len(bools))
		anyArray := common_v1.ArrayValue{
			Values: make([]*common_v1.AnyValue, len(bools)),
		}
		for i, b := range bools {
			anyBools[i].BoolValue = b
			anyVals[i].Value = &anyBools[i]
			anyArray.Values[i] = &anyVals[i]
		}

		return &common_v1.AnyValue{Value: &common_v1.AnyValue_ArrayValue{ArrayValue: &anyArray}}
	default:
		return &common_v1.AnyValue{
			Value: &common_v1.AnyValue_StringValue{
				StringValue: fmt.Sprintf("error formatting val: static has unexpected type %v", s.Type),
			},
		}
	}
}

func StaticFromAnyValue(a *common_v1.AnyValue) Static {
	switch v := a.Value.(type) {
	case *common_v1.AnyValue_StringValue:
		return NewStaticString(v.StringValue)
	case *common_v1.AnyValue_IntValue:
		return NewStaticInt(int(v.IntValue))
	case *common_v1.AnyValue_BoolValue:
		return NewStaticBool(v.BoolValue)
	case *common_v1.AnyValue_DoubleValue:
		return NewStaticFloat(v.DoubleValue)
	default:
		return NewStaticNil()
	}
}
