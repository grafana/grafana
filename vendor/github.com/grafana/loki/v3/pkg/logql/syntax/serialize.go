package syntax

import (
	"fmt"
	"io"
	"time"

	jsoniter "github.com/json-iterator/go"
	"github.com/prometheus/prometheus/model/labels"

	"github.com/grafana/loki/v3/pkg/logql/log"
)

type JSONSerializer struct {
	*jsoniter.Stream
}

func NewJSONSerializer(s *jsoniter.Stream) *JSONSerializer {
	return &JSONSerializer{
		Stream: s,
	}
}

func EncodeJSON(e Expr, w io.Writer) error {
	s := jsoniter.ConfigFastest.BorrowStream(w)
	defer jsoniter.ConfigFastest.ReturnStream(s)
	v := NewJSONSerializer(s)
	e.Accept(v)
	return s.Flush()
}

// Field names
const (
	Bin                 = "bin"
	Binary              = "binary"
	Bytes               = "bytes"
	And                 = "and"
	Card                = "cardinality"
	Dst                 = "dst"
	Duration            = "duration"
	Groups              = "groups"
	GroupingField       = "grouping"
	Include             = "include"
	Identifier          = "identifier"
	Inner               = "inner"
	IntervalNanos       = "interval_nanos"
	IPField             = "ip"
	Label               = "label"
	LabelReplace        = "label_replace"
	LHS                 = "lhs"
	Literal             = "literal"
	LogSelector         = "log_selector"
	Name                = "name"
	Numeric             = "numeric"
	MatchingLabels      = "matching_labels"
	On                  = "on"
	Op                  = "operation"
	Options             = "options"
	OffsetNanos         = "offset_nanos"
	Params              = "params"
	Pattern             = "pattern"
	PostFilterers       = "post_filterers"
	Range               = "range"
	RangeAgg            = "range_agg"
	Raw                 = "raw"
	RegexField          = "regex"
	Replacement         = "replacement"
	ReturnBool          = "return_bool"
	RHS                 = "rhs"
	Src                 = "src"
	StringField         = "string"
	NoopField           = "noop"
	Type                = "type"
	Unwrap              = "unwrap"
	Value               = "value"
	Vector              = "vector"
	VectorAgg           = "vector_agg"
	VectorMatchingField = "vector_matching"
	Without             = "without"
)

func DecodeJSON(raw string) (Expr, error) {
	iter := jsoniter.ParseString(jsoniter.ConfigFastest, raw)

	key := iter.ReadObject()
	switch key {
	case Bin:
		return decodeBinOp(iter)
	case VectorAgg:
		return decodeVectorAgg(iter)
	case RangeAgg:
		return decodeRangeAgg(iter)
	case Literal:
		return decodeLiteral(iter)
	case Vector:
		return decodeVector(iter)
	case LabelReplace:
		return decodeLabelReplace(iter)
	case LogSelector:
		return decodeLogSelector(iter)
	default:
		return nil, fmt.Errorf("unknown expression type: %s", key)
	}
}

var _ RootVisitor = &JSONSerializer{}

func (v *JSONSerializer) VisitBinOp(e *BinOpExpr) {
	v.WriteObjectStart()

	v.WriteObjectField(Bin)
	v.WriteObjectStart()

	v.WriteObjectField(Op)
	v.WriteString(e.Op)

	v.WriteMore()
	v.WriteObjectField(LHS)
	e.SampleExpr.Accept(v)

	v.WriteMore()
	v.WriteObjectField(RHS)
	e.RHS.Accept(v)

	if e.Opts != nil {
		v.WriteMore()
		v.WriteObjectField(Options)
		v.WriteObjectStart()

		v.WriteObjectField(ReturnBool)
		v.WriteBool(e.Opts.ReturnBool)

		if e.Opts.VectorMatching != nil {
			v.WriteMore()
			v.WriteObjectField(VectorMatchingField)
			encodeVectorMatching(v.Stream, e.Opts.VectorMatching)
		}

		v.WriteObjectEnd()
		v.Flush()

	}

	v.WriteObjectEnd()
	v.WriteObjectEnd()
	v.Flush()
}

func (v *JSONSerializer) VisitVectorAggregation(e *VectorAggregationExpr) {
	v.WriteObjectStart()

	v.WriteObjectField(VectorAgg)
	v.WriteObjectStart()

	v.WriteObjectField(Params)
	v.WriteInt(e.Params)

	v.WriteMore()
	v.WriteObjectField(Op)
	v.WriteString(e.Operation)

	if e.Grouping != nil {
		v.WriteMore()
		v.WriteObjectField(GroupingField)
		encodeGrouping(v.Stream, e.Grouping)
	}

	v.WriteMore()
	v.WriteObjectField(Inner)
	e.Left.Accept(v)

	v.WriteObjectEnd()
	v.WriteObjectEnd()
	v.Flush()
}

func (v *JSONSerializer) VisitRangeAggregation(e *RangeAggregationExpr) {
	v.WriteObjectStart()

	v.WriteObjectField(RangeAgg)
	v.WriteObjectStart()

	v.WriteObjectField(Op)
	v.WriteString(e.Operation)

	if e.Grouping != nil {
		v.WriteMore()
		v.WriteObjectField(GroupingField)
		encodeGrouping(v.Stream, e.Grouping)
	}

	if e.Params != nil {
		v.WriteMore()
		v.WriteObjectField(Params)
		v.WriteFloat64(*e.Params)
	}

	v.WriteMore()
	v.WriteObjectField(Range)
	v.VisitLogRange(e.Left)
	v.WriteObjectEnd()

	v.WriteObjectEnd()
	v.Flush()
}

func (v *JSONSerializer) VisitLogRange(e *LogRange) {
	v.WriteObjectStart()

	v.WriteObjectField(IntervalNanos)
	v.WriteInt64(int64(e.Interval))
	v.WriteMore()
	v.WriteObjectField(OffsetNanos)
	v.WriteInt64(int64(e.Offset))

	// Serialize log selector pipeline as string.
	v.WriteMore()
	v.WriteObjectField(LogSelector)
	encodeLogSelector(v.Stream, e.Left)

	if e.Unwrap != nil {
		v.WriteMore()
		v.WriteObjectField(Unwrap)
		encodeUnwrap(v.Stream, e.Unwrap)
	}

	v.WriteObjectEnd()
	v.Flush()
}

func (v *JSONSerializer) VisitLabelReplace(e *LabelReplaceExpr) {
	v.WriteObjectStart()

	v.WriteObjectField(LabelReplace)
	v.WriteObjectStart()

	v.WriteObjectField(Inner)
	e.Left.Accept(v)

	v.WriteMore()
	v.WriteObjectField(Dst)
	v.WriteString(e.Dst)

	v.WriteMore()
	v.WriteObjectField(Src)
	v.WriteString(e.Src)

	v.WriteMore()
	v.WriteObjectField(Replacement)
	v.WriteString(e.Replacement)

	v.WriteMore()
	v.WriteObjectField(RegexField)
	v.WriteString(e.Regex)

	v.WriteObjectEnd()
	v.WriteObjectEnd()
	v.Flush()
}

func (v *JSONSerializer) VisitLiteral(e *LiteralExpr) {
	v.WriteObjectStart()

	v.WriteObjectField(Literal)
	v.WriteObjectStart()

	v.WriteObjectField(Value)
	v.WriteFloat64(e.Val)

	v.WriteObjectEnd()
	v.WriteObjectEnd()
	v.Flush()
}

func (v *JSONSerializer) VisitVector(e *VectorExpr) {
	v.WriteObjectStart()

	v.WriteObjectField(Vector)
	v.WriteObjectStart()

	v.WriteObjectField(Value)
	v.WriteFloat64(e.Val)

	v.WriteObjectEnd()
	v.WriteObjectEnd()
	v.Flush()
}

func (v *JSONSerializer) VisitMatchers(e *MatchersExpr) {
	v.WriteObjectStart()

	v.WriteObjectField(LogSelector)
	encodeLogSelector(v.Stream, e)
	v.WriteObjectEnd()
	v.Flush()
}

func (v *JSONSerializer) VisitPipeline(e *PipelineExpr) {
	v.WriteObjectStart()

	v.WriteObjectField(LogSelector)
	encodeLogSelector(v.Stream, e)
	v.WriteObjectEnd()
	v.Flush()
}

// Below are StageExpr visitors that we are skipping since a pipeline is
// serialized as a string.
func (*JSONSerializer) VisitDecolorize(*DecolorizeExpr)                     {}
func (*JSONSerializer) VisitDropLabels(*DropLabelsExpr)                     {}
func (*JSONSerializer) VisitJSONExpressionParser(*JSONExpressionParser)     {}
func (*JSONSerializer) VisitKeepLabel(*KeepLabelsExpr)                      {}
func (*JSONSerializer) VisitLabelFilter(*LabelFilterExpr)                   {}
func (*JSONSerializer) VisitLabelFmt(*LabelFmtExpr)                         {}
func (*JSONSerializer) VisitLabelParser(*LabelParserExpr)                   {}
func (*JSONSerializer) VisitLineFilter(*LineFilterExpr)                     {}
func (*JSONSerializer) VisitLineFmt(*LineFmtExpr)                           {}
func (*JSONSerializer) VisitLogfmtExpressionParser(*LogfmtExpressionParser) {}
func (*JSONSerializer) VisitLogfmtParser(*LogfmtParserExpr)                 {}

func encodeGrouping(s *jsoniter.Stream, g *Grouping) {
	s.WriteObjectStart()
	s.WriteObjectField(Without)
	s.WriteBool(g.Without)

	s.WriteMore()
	s.WriteObjectField(Groups)
	s.WriteArrayStart()
	for i, group := range g.Groups {
		if i > 0 {
			s.WriteMore()
		}
		s.WriteString(group)
	}
	s.WriteArrayEnd()
	s.WriteObjectEnd()
}

func decodeGrouping(iter *jsoniter.Iterator) (*Grouping, error) {
	g := &Grouping{}
	for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
		switch f {
		case Without:
			g.Without = iter.ReadBool()
		case Groups:
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				g.Groups = append(g.Groups, iter.ReadString())
				return true
			})
		}
	}

	return g, nil
}

func encodeUnwrap(s *jsoniter.Stream, u *UnwrapExpr) {
	s.WriteObjectStart()
	s.WriteObjectField(Identifier)
	s.WriteString(u.Identifier)

	s.WriteMore()
	s.WriteObjectField(Op)
	s.WriteString(u.Operation)

	s.WriteMore()
	s.WriteObjectField(PostFilterers)
	s.WriteArrayStart()
	for i, filter := range u.PostFilters {
		if i > 0 {
			s.WriteMore()
		}
		encodeLabelFilter(s, filter)
	}
	s.WriteArrayEnd()

	s.WriteObjectEnd()
}

func decodeUnwrap(iter *jsoniter.Iterator) *UnwrapExpr {
	e := &UnwrapExpr{}
	for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
		switch f {
		case Identifier:
			e.Identifier = iter.ReadString()
		case Op:
			e.Operation = iter.ReadString()
		case PostFilterers:
			iter.ReadArrayCB(func(i *jsoniter.Iterator) bool {
				e.PostFilters = append(e.PostFilters, decodeLabelFilter(i))
				return true
			})
		}
	}

	return e
}

func encodeLabelFilter(s *jsoniter.Stream, filter log.LabelFilterer) {
	switch concrete := filter.(type) {
	case *log.BinaryLabelFilter:
		s.WriteObjectStart()
		s.WriteObjectField(Binary)

		s.WriteObjectStart()
		s.WriteObjectField(LHS)
		encodeLabelFilter(s, concrete.Left)

		s.WriteMore()
		s.WriteObjectField(RHS)
		encodeLabelFilter(s, concrete.Right)

		s.WriteMore()
		s.WriteObjectField(And)
		s.WriteBool(concrete.And)

		s.WriteObjectEnd()

		s.WriteObjectEnd()
	case *log.NoopLabelFilter:
		s.WriteObjectStart()
		s.WriteObjectField(NoopField)

		s.WriteObjectStart()
		if concrete.Matcher != nil {
			s.WriteObjectField(Name)
			s.WriteString(concrete.Name)

			s.WriteMore()
			s.WriteObjectField(Value)
			s.WriteString(concrete.Value)

			s.WriteMore()
			s.WriteObjectField(Type)
			s.WriteInt(int(concrete.Type))
		}
		s.WriteObjectEnd()

		s.WriteObjectEnd()
	case *log.BytesLabelFilter:
		s.WriteObjectStart()
		s.WriteObjectField(Bytes)

		s.WriteObjectStart()
		s.WriteObjectField(Name)
		s.WriteString(concrete.Name)

		s.WriteMore()
		s.WriteObjectField(Value)
		s.WriteUint64(concrete.Value)

		s.WriteMore()
		s.WriteObjectField(Type)
		s.WriteInt(int(concrete.Type))
		s.WriteObjectEnd()

		s.WriteObjectEnd()
	case *log.DurationLabelFilter:
		s.WriteObjectStart()
		s.WriteObjectField(Duration)

		s.WriteObjectStart()
		s.WriteObjectField(Name)
		s.WriteString(concrete.Name)

		s.WriteMore()
		s.WriteObjectField(Value)
		s.WriteInt64(int64(concrete.Value))

		s.WriteMore()
		s.WriteObjectField(Type)
		s.WriteInt(int(concrete.Type))
		s.WriteObjectEnd()

		s.WriteObjectEnd()
	case *log.NumericLabelFilter:
		s.WriteObjectStart()
		s.WriteObjectField(Numeric)

		s.WriteObjectStart()
		s.WriteObjectField(Name)
		s.WriteString(concrete.Name)

		s.WriteMore()
		s.WriteObjectField(Value)
		s.WriteFloat64(concrete.Value)

		s.WriteMore()
		s.WriteObjectField(Type)
		s.WriteInt(int(concrete.Type))
		s.WriteObjectEnd()

		s.WriteObjectEnd()
	case *log.StringLabelFilter:
		s.WriteObjectStart()
		s.WriteObjectField(StringField)

		s.WriteObjectStart()
		if concrete.Matcher != nil {
			s.WriteObjectField(Name)
			s.WriteString(concrete.Name)

			s.WriteMore()
			s.WriteObjectField(Value)
			s.WriteString(concrete.Value)

			s.WriteMore()
			s.WriteObjectField(Type)
			s.WriteInt(int(concrete.Type))
		}
		s.WriteObjectEnd()

		s.WriteObjectEnd()
	case *log.LineFilterLabelFilter:
		// Line filter label filter are encoded as string filters as
		// well. See log.NewStringLabelFilter.
		s.WriteObjectStart()
		s.WriteObjectField(StringField)

		s.WriteObjectStart()
		if concrete.Matcher != nil {
			s.WriteObjectField(Name)
			s.WriteString(concrete.Name)

			s.WriteMore()
			s.WriteObjectField(Value)
			s.WriteString(concrete.Value)

			s.WriteMore()
			s.WriteObjectField(Type)
			s.WriteInt(int(concrete.Type))
		}
		s.WriteObjectEnd()

		s.WriteObjectEnd()
	case *log.IPLabelFilter:
		s.WriteObjectStart()
		s.WriteObjectField(IPField)

		s.WriteObjectStart()
		s.WriteObjectField(Type)
		s.WriteInt(int(concrete.Ty))

		s.WriteMore()
		s.WriteObjectField(Label)
		s.WriteString(concrete.Label)

		s.WriteMore()
		s.WriteObjectField(Pattern)
		s.WriteString(concrete.Pattern)

		s.WriteObjectEnd()

		s.WriteObjectEnd()
	}
}

func decodeLabelFilter(iter *jsoniter.Iterator) log.LabelFilterer {
	var filter log.LabelFilterer
	for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
		switch f {
		case Binary:
			var left, right log.LabelFilterer
			var and bool
			for k := iter.ReadObject(); k != ""; k = iter.ReadObject() {
				switch k {
				case And:
					and = iter.ReadBool()
				case LHS:
					left = decodeLabelFilter(iter)
				case RHS:
					right = decodeLabelFilter(iter)
				}
			}

			filter = &log.BinaryLabelFilter{
				And:   and,
				Left:  left,
				Right: right,
			}

		case Bytes:
			var name string
			var b uint64
			var t log.LabelFilterType
			for k := iter.ReadObject(); k != ""; k = iter.ReadObject() {
				switch k {
				case Name:
					name = iter.ReadString()
				case Value:
					b = iter.ReadUint64()
				case Type:
					t = log.LabelFilterType(iter.ReadInt())
				}
			}
			filter = log.NewBytesLabelFilter(t, name, b)
		case Duration:
			var name string
			var duration time.Duration
			var t log.LabelFilterType
			for k := iter.ReadObject(); k != ""; k = iter.ReadObject() {
				switch k {
				case Name:
					name = iter.ReadString()
				case Value:
					duration = time.Duration(iter.ReadInt64())
				case Type:
					t = log.LabelFilterType(iter.ReadInt())
				}
			}

			filter = log.NewDurationLabelFilter(t, name, duration)
		case Numeric:
			var name string
			var value float64
			var t log.LabelFilterType
			for k := iter.ReadObject(); k != ""; k = iter.ReadObject() {
				switch k {
				case Name:
					name = iter.ReadString()
				case Value:
					value = iter.ReadFloat64()
				case Type:
					t = log.LabelFilterType(iter.ReadInt())
				}
			}

			filter = log.NewNumericLabelFilter(t, name, value)
		case StringField, NoopField:
			var name string
			var value string
			var t labels.MatchType
			for k := iter.ReadObject(); k != ""; k = iter.ReadObject() {
				switch k {
				case Name:
					name = iter.ReadString()
				case Value:
					value = iter.ReadString()
				case Type:
					t = labels.MatchType(iter.ReadInt())
				}
			}

			var matcher *labels.Matcher
			matcher = labels.MustNewMatcher(t, name, value)

			filter = log.NewStringLabelFilter(matcher)

		case IPField:
			var label string
			var pattern string
			var t log.LabelFilterType
			for k := iter.ReadObject(); k != ""; k = iter.ReadObject() {
				switch k {
				case Pattern:
					pattern = iter.ReadString()
				case Label:
					label = iter.ReadString()
				case Type:
					t = log.LabelFilterType(iter.ReadInt())
				}
			}
			filter = log.NewIPLabelFilter(pattern, label, t)
		}
	}

	return filter
}

func encodeLogSelector(s *jsoniter.Stream, e LogSelectorExpr) {
	s.WriteObjectStart()
	s.WriteObjectField(Raw)

	s.WriteString(e.String())

	s.WriteObjectEnd()
	s.Flush()
}

func decodeLogSelector(iter *jsoniter.Iterator) (LogSelectorExpr, error) {
	var e LogSelectorExpr

	for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
		switch f {
		case Raw:
			raw := iter.ReadString()
			expr, err := ParseExpr(raw)
			if err != nil {
				return nil, err
			}

			var ok bool
			e, ok = expr.(LogSelectorExpr)

			if !ok {
				return nil, fmt.Errorf("unexpected expression type: want(LogSelectorExpr), got(%T)", expr)
			}
		}
	}

	return e, nil
}

func decodeSample(iter *jsoniter.Iterator) (SampleExpr, error) {
	var expr SampleExpr
	var err error
	for key := iter.ReadObject(); key != ""; key = iter.ReadObject() {
		switch key {
		case Bin:
			expr, err = decodeBinOp(iter)
		case VectorAgg:
			expr, err = decodeVectorAgg(iter)
		case RangeAgg:
			expr, err = decodeRangeAgg(iter)
		case Literal:
			expr, err = decodeLiteral(iter)
		case Vector:
			expr, err = decodeVector(iter)
		case LabelReplace:
			expr, err = decodeLabelReplace(iter)
		default:
			return nil, fmt.Errorf("unknown sample expression type: %s", key)
		}
	}
	return expr, err
}

func decodeBinOp(iter *jsoniter.Iterator) (*BinOpExpr, error) {
	expr := &BinOpExpr{}
	var err error

	for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
		switch f {
		case Op:
			expr.Op = iter.ReadString()
		case RHS:
			expr.RHS, err = decodeSample(iter)
		case LHS:
			expr.SampleExpr, err = decodeSample(iter)
		case Options:
			expr.Opts = decodeBinOpOptions(iter)
		}
	}

	return expr, err
}
func decodeBinOpOptions(iter *jsoniter.Iterator) *BinOpOptions {
	opts := &BinOpOptions{}

	for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
		switch f {
		case ReturnBool:
			opts.ReturnBool = iter.ReadBool()
		case VectorMatchingField:
			opts.VectorMatching = decodeVectorMatching(iter)
		}
	}

	return opts
}

func encodeVectorMatching(s *jsoniter.Stream, vm *VectorMatching) {
	s.WriteObjectStart()

	s.WriteObjectField(Include)
	s.WriteArrayStart()
	for i, l := range vm.Include {
		if i > 0 {
			s.WriteMore()
		}
		s.WriteString(l)
	}
	s.WriteArrayEnd()

	s.WriteMore()
	s.WriteObjectField(On)
	s.WriteBool(vm.On)

	s.WriteMore()
	s.WriteObjectField(Card)
	s.WriteInt(int(vm.Card))

	s.WriteMore()
	s.WriteObjectField(MatchingLabels)
	s.WriteArrayStart()
	for i, l := range vm.MatchingLabels {
		if i > 0 {
			s.WriteMore()
		}
		s.WriteString(l)
	}
	s.WriteArrayEnd()

	s.WriteObjectEnd()
}

func decodeVectorMatching(iter *jsoniter.Iterator) *VectorMatching {
	vm := &VectorMatching{}

	for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
		switch f {
		case Include:
			iter.ReadArrayCB(func(i *jsoniter.Iterator) bool {
				vm.Include = append(vm.Include, i.ReadString())
				return true
			})
		case On:
			vm.On = iter.ReadBool()
		case Card:
			vm.Card = VectorMatchCardinality(iter.ReadInt())
		case MatchingLabels:
			iter.ReadArrayCB(func(i *jsoniter.Iterator) bool {
				vm.MatchingLabels = append(vm.MatchingLabels, i.ReadString())
				return true
			})
		}
	}
	return vm
}

func decodeVectorAgg(iter *jsoniter.Iterator) (*VectorAggregationExpr, error) {
	expr := &VectorAggregationExpr{}
	var err error

	for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
		switch f {
		case Op:
			expr.Operation = iter.ReadString()
		case Params:
			expr.Params = iter.ReadInt()
		case GroupingField:
			expr.Grouping, err = decodeGrouping(iter)
		case Inner:
			expr.Left, err = decodeSample(iter)
		}
	}

	return expr, err
}

func decodeRangeAgg(iter *jsoniter.Iterator) (*RangeAggregationExpr, error) {
	expr := &RangeAggregationExpr{}
	var err error

	for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
		switch f {
		case Op:
			expr.Operation = iter.ReadString()
		case Params:
			tmp := iter.ReadFloat64()
			expr.Params = &tmp
		case Range:
			expr.Left, err = decodeLogRange(iter)
		case GroupingField:
			expr.Grouping, err = decodeGrouping(iter)
		}
	}

	return expr, err
}

func decodeLogRange(iter *jsoniter.Iterator) (*LogRange, error) {
	expr := &LogRange{}
	var err error

	for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
		switch f {
		case LogSelector:
			expr.Left, err = decodeLogSelector(iter)
		case IntervalNanos:
			expr.Interval = time.Duration(iter.ReadInt64())
		case OffsetNanos:
			expr.Offset = time.Duration(iter.ReadInt64())
		case Unwrap:
			expr.Unwrap = decodeUnwrap(iter)
		}
	}

	return expr, err
}

func decodeLabelReplace(iter *jsoniter.Iterator) (*LabelReplaceExpr, error) {
	var err error
	var left SampleExpr
	var dst, src, replacement, regex string

	for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
		switch f {
		case Inner:
			left, err = decodeSample(iter)
			if err != nil {
				return nil, err
			}
		case Dst:
			dst = iter.ReadString()
		case Src:
			src = iter.ReadString()
		case Replacement:
			replacement = iter.ReadString()
		case RegexField:
			regex = iter.ReadString()
		}
	}

	return mustNewLabelReplaceExpr(left, dst, replacement, src, regex), nil
}

func decodeLiteral(iter *jsoniter.Iterator) (*LiteralExpr, error) {
	expr := &LiteralExpr{}

	for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
		switch f {
		case Value:
			expr.Val = iter.ReadFloat64()
		}
	}

	return expr, nil
}

func decodeVector(iter *jsoniter.Iterator) (*VectorExpr, error) {
	expr := &VectorExpr{}

	for f := iter.ReadObject(); f != ""; f = iter.ReadObject() {
		switch f {
		case Value:
			expr.Val = iter.ReadFloat64()
		}
	}

	return expr, nil
}

func decodeMatchers(iter *jsoniter.Iterator) (LogSelectorExpr, error) {
	return decodeLogSelector(iter)
}

func decodePipeline(iter *jsoniter.Iterator) (LogSelectorExpr, error) {
	return decodeLogSelector(iter)
}
