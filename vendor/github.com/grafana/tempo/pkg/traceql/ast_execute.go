package traceql

import (
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/grafana/tempo/pkg/regexp"
)

var errSpansetOperationMultiple = errors.New("spanset operators are not supported for multiple spansets per trace. consider using coalesce()")

func (g GroupOperation) evaluate(ss []*Spanset) ([]*Spanset, error) {
	result := make([]*Spanset, 0, len(ss))
	groups := g.groupBuffer

	// Iterate over each spanset in the input slice
	for _, spanset := range ss {
		// clear out the groups
		for k := range groups {
			delete(groups, k)
		}

		// Iterate over each span in the spanset
		for _, span := range spanset.Spans {
			// Execute the FieldExpression for the span
			result, err := g.Expression.execute(span)
			if err != nil {
				return nil, err
			}

			// Check if the result already has a group in the map
			group, ok := groups[result.MapKey()]
			if !ok {
				// If not, create a new group and add it to the map
				group = &Spanset{}
				// copy all existing attributes forward
				group.Attributes = append(group.Attributes, spanset.Attributes...)
				group.AddAttribute(g.String(), result)
				groups[result.MapKey()] = group
			}

			// Add the current spanset to the group
			group.Spans = append(group.Spans, span)
		}

		// add all groups created by this spanset to the result
		for _, group := range groups {
			result = append(result, group)
		}
	}

	return result, nil
}

// CoalesceOperation undoes grouping. It takes spansets and recombines them into
// one by trace id. Since all spansets are guaranteed to be from the same traceid
// due to the structure of the engine we can cheat and just recombine all spansets
// in ss into one without checking.
func (CoalesceOperation) evaluate(ss []*Spanset) ([]*Spanset, error) {
	l := 0
	for _, spanset := range ss {
		l += len(spanset.Spans)
	}
	result := &Spanset{
		Spans: make([]Span, 0, l),
	}
	for _, spanset := range ss {
		result.Spans = append(result.Spans, spanset.Spans...)
	}
	return []*Spanset{result}, nil
}

func (o SpansetOperation) evaluate(input []*Spanset) (output []*Spanset, err error) {
	for i := range input {
		curr := input[i : i+1]

		lhs, err := o.LHS.evaluate(curr)
		if err != nil {
			return nil, err
		}

		rhs, err := o.RHS.evaluate(curr)
		if err != nil {
			return nil, err
		}

		var relFn func(s Span, l, r []Span) []Span

		switch o.Op {
		case OpSpansetAnd:
			if len(lhs) > 0 && len(rhs) > 0 {
				output = addSpanset(input[i], uniqueSpans(lhs, rhs), output)
			}

		case OpSpansetUnion:
			if len(lhs) > 0 || len(rhs) > 0 {
				output = addSpanset(input[i], uniqueSpans(lhs, rhs), output)
			}
		// relationship operators all set relFn which is used by below code
		// to perform the operation
		case OpSpansetNotDescendant: // !>>
			fallthrough
		case OpSpansetNotAncestor: // !<<
			fallthrough
		case OpSpansetAncestor: // <<
			fallthrough
		case OpSpansetDescendant: // >>
			fallthrough
		case OpSpansetUnionAncestor: // &<<
			fallthrough
		case OpSpansetUnionDescendant: // &>>
			falseForAll := o.Op == OpSpansetNotDescendant || o.Op == OpSpansetNotAncestor
			invert := o.Op == OpSpansetAncestor || o.Op == OpSpansetNotAncestor || o.Op == OpSpansetUnionAncestor
			union := o.Op == OpSpansetUnionAncestor || o.Op == OpSpansetUnionDescendant
			relFn = func(s Span, l, r []Span) []Span {
				return s.DescendantOf(l, r, falseForAll, invert, union, o.matchingSpansBuffer)
			}

		case OpSpansetNotChild: // !>
			fallthrough
		case OpSpansetChild: // >
			fallthrough
		case OpSpansetNotParent: // !<
			fallthrough
		case OpSpansetParent: // <
			fallthrough
		case OpSpansetUnionParent: // &<
			fallthrough
		case OpSpansetUnionChild: // &>
			falseForAll := o.Op == OpSpansetNotParent || o.Op == OpSpansetNotChild
			invert := o.Op == OpSpansetParent || o.Op == OpSpansetNotParent || o.Op == OpSpansetUnionParent
			union := o.Op == OpSpansetUnionParent || o.Op == OpSpansetUnionChild
			relFn = func(s Span, l, r []Span) []Span {
				return s.ChildOf(l, r, falseForAll, invert, union, o.matchingSpansBuffer)
			}

		case OpSpansetNotSibling: // !~
			fallthrough
		case OpSpansetSibling: // ~
			fallthrough
		case OpSpansetUnionSibling: // &~
			falseForAll := o.Op == OpSpansetNotSibling
			union := o.Op == OpSpansetUnionSibling
			relFn = func(s Span, l, r []Span) []Span {
				return s.SiblingOf(l, r, falseForAll, union, o.matchingSpansBuffer)
			}

		default:
			return nil, fmt.Errorf("spanset operation (%v) not supported", o.Op)
		}

		// if relFn was set up above we are doing a relationship operation.
		if relFn != nil {
			o.matchingSpansBuffer, err = o.joinSpansets(lhs, rhs, relFn) // o.matchingSpansBuffer is passed into the functions above and is stored here
			if err != nil {
				return nil, err
			}
			output = addSpanset(input[i], o.matchingSpansBuffer, output)
		}
	}

	return output, nil
}

// joinSpansets compares all pairwise combinations of the inputs and returns the right-hand side
// where the eval callback returns true.  For now the behavior is only defined when there is exactly one
// spanset on both sides and will return an error if multiple spansets are present.
func (o *SpansetOperation) joinSpansets(lhs, rhs []*Spanset, eval func(s Span, l, r []Span) []Span) ([]Span, error) {
	if len(lhs) < 1 || len(rhs) < 1 {
		return nil, nil
	}

	if len(lhs) > 1 || len(rhs) > 1 {
		return nil, errSpansetOperationMultiple
	}

	// if rhs side is empty then no spans match and we can bail out here
	if len(rhs[0].Spans) == 0 {
		return nil, nil
	}

	return eval(rhs[0].Spans[0], lhs[0].Spans, rhs[0].Spans), nil
}

// addSpanset is a helper function that adds a new spanset to the output. it clones
// the input to prevent modifying the original spanset.
func addSpanset(input *Spanset, matching []Span, output []*Spanset) []*Spanset {
	if len(matching) == 0 {
		return output
	}

	matchingSpanset := input.clone()
	matchingSpanset.Spans = matching

	return append(output, matchingSpanset)
}

// SelectOperation evaluate is a no-op b/c the fetch layer has already decorated the spans with the requested attributes
func (o SelectOperation) evaluate(input []*Spanset) (output []*Spanset, err error) {
	return input, nil
}

func (f ScalarFilter) evaluate(input []*Spanset) (output []*Spanset, err error) {
	// TODO we solve this gap where pipeline elements and scalar binary
	// operations meet in a generic way. For now we only support well-defined
	// case: aggregate binop static
	switch l := f.lhs.(type) {
	case Aggregate:
		switch r := f.rhs.(type) {
		case Static:
			input, err = l.evaluate(input)
			if err != nil {
				return nil, err
			}

			for _, ss := range input {
				res, err := binOp(f.op, ss.Scalar, r)
				if err != nil {
					return nil, fmt.Errorf("scalar filter (%v) failed: %v", f, err)
				}
				if res {
					output = append(output, ss)
				}
			}

		default:
			return nil, fmt.Errorf("scalar filter lhs (%v) not supported", f.lhs)
		}

	default:
		return nil, fmt.Errorf("scalar filter lhs (%v) not supported", f.lhs)
	}

	return output, nil
}

func (a Aggregate) evaluate(input []*Spanset) ([]*Spanset, error) {
	var output []*Spanset

	for _, ss := range input {
		switch a.op {
		case aggregateCount:
			cpy := ss.clone()
			cpy.Scalar = NewStaticInt(len(ss.Spans))
			cpy.AddAttribute(a.String(), cpy.Scalar)
			output = append(output, cpy)

		case aggregateAvg:
			var sum *Static
			count := 0
			for _, s := range ss.Spans {
				val, err := a.e.execute(s)
				if err != nil {
					return nil, err
				}
				if val.IsNil() {
					continue
				}

				if sum == nil {
					sum = &val
				} else {
					sum.sumInto(&val)
				}
				count++
			}
			if sum == nil {
				continue
			}

			cpy := ss.clone()
			cpy.Scalar = sum.divideBy(float64(count))
			cpy.AddAttribute(a.String(), cpy.Scalar)
			output = append(output, cpy)

		case aggregateMax:
			var maxS *Static
			for _, s := range ss.Spans {
				val, err := a.e.execute(s)
				if err != nil {
					return nil, err
				}
				if val.IsNil() {
					continue
				}

				if maxS == nil || val.compare(maxS) > 0 {
					maxS = &val
				}
			}
			if maxS == nil {
				continue
			}

			cpy := ss.clone()
			cpy.Scalar = *maxS
			cpy.AddAttribute(a.String(), cpy.Scalar)
			output = append(output, cpy)

		case aggregateMin:
			var minS *Static
			for _, s := range ss.Spans {
				val, err := a.e.execute(s)
				if err != nil {
					return nil, err
				}
				if val.IsNil() {
					continue
				}

				if minS == nil || val.compare(minS) == -1 {
					minS = &val
				}
			}
			if minS == nil {
				continue
			}

			cpy := ss.clone()
			cpy.Scalar = *minS
			cpy.AddAttribute(a.String(), cpy.Scalar)
			output = append(output, cpy)

		case aggregateSum:
			var sum *Static
			for _, s := range ss.Spans {
				val, err := a.e.execute(s)
				if err != nil {
					return nil, err
				}
				if val.IsNil() {
					continue
				}

				if sum == nil {
					sum = &val
				} else {
					sum.sumInto(&val)
				}
			}
			if sum == nil {
				continue
			}

			cpy := ss.clone()
			cpy.Scalar = *sum
			cpy.AddAttribute(a.String(), cpy.Scalar)
			output = append(output, cpy)

		default:
			return nil, fmt.Errorf("aggregate operation (%v) not supported", a.op)
		}
	}

	return output, nil
}

func (o *BinaryOperation) execute(span Span) (Static, error) {
	recording := o.b.Recording
	if recording {
		o.b.Start()
	}

	lhs, err := o.LHS.execute(span)
	if err != nil {
		return NewStaticNil(), err
	}

	if recording {
		o.b.Finish(leftBranch)
	}

	// Look for cases where we don't even need to evalulate the RHS
	// But wait until we have enough samples so we can optimize
	if !recording {
		if lhsB, ok := lhs.Bool(); ok {
			if o.Op == OpAnd && !lhsB {
				// x && y
				// x is false so we don't need to evalulate y
				return StaticFalse, nil
			}
			if o.Op == OpOr && lhsB {
				// x || y
				// x is true so we don't need to evalulate y
				return StaticTrue, nil
			}
		}
	}

	if recording {
		o.b.Start()
	}

	rhs, err := o.RHS.execute(span)
	if err != nil {
		return NewStaticNil(), err
	}

	if recording {
		o.b.Finish(rightBranch)
	}

	// Ensure the resolved types are still valid
	lhsT := lhs.Type
	rhsT := rhs.Type
	if !lhsT.isMatchingOperand(rhsT) {
		return StaticFalse, nil
	}

	if !o.Op.binaryTypesValid(lhsT, rhsT) {
		return NewStaticBool(false), nil
	}

	if lhsT == TypeString && rhsT == TypeString {
		switch o.Op {
		case OpGreater:
			return NewStaticBool(strings.Compare(lhs.String(), rhs.String()) > 0), nil
		case OpGreaterEqual:
			return NewStaticBool(strings.Compare(lhs.String(), rhs.String()) >= 0), nil
		case OpLess:
			return NewStaticBool(strings.Compare(lhs.String(), rhs.String()) < 0), nil
		case OpLessEqual:
			return NewStaticBool(strings.Compare(lhs.String(), rhs.String()) <= 0), nil
		case OpRegex:
			if o.compiledExpression == nil {
				o.compiledExpression, err = regexp.NewRegexp([]string{rhs.EncodeToString(false)}, true)
				if err != nil {
					return NewStaticNil(), err
				}
			}

			matched := o.compiledExpression.MatchString(lhs.EncodeToString(false))
			return NewStaticBool(matched), err
		case OpNotRegex:
			if o.compiledExpression == nil {
				o.compiledExpression, err = regexp.NewRegexp([]string{rhs.EncodeToString(false)}, false)
				if err != nil {
					return NewStaticNil(), err
				}
			}

			matched := o.compiledExpression.MatchString(lhs.EncodeToString(false))
			return NewStaticBool(matched), err
		default:
		}
	}

	// if both sides are integers then do integer math, otherwise we can drop to the
	// catch-all below
	if lhsT == TypeInt && rhsT == TypeInt {
		lhsN, _ := lhs.Int()
		rhsN, _ := rhs.Int()

		switch o.Op {
		case OpAdd:
			return NewStaticInt(lhsN + rhsN), nil
		case OpSub:
			return NewStaticInt(lhsN - rhsN), nil
		case OpDiv:
			return NewStaticInt(lhsN / rhsN), nil
		case OpMod:
			return NewStaticInt(lhsN % rhsN), nil
		case OpMult:
			return NewStaticInt(lhsN * rhsN), nil
		case OpGreater:
			return NewStaticBool(lhsN > rhsN), nil
		case OpGreaterEqual:
			return NewStaticBool(lhsN >= rhsN), nil
		case OpLess:
			return NewStaticBool(lhsN < rhsN), nil
		case OpLessEqual:
			return NewStaticBool(lhsN <= rhsN), nil
		case OpPower:
			return NewStaticInt(intPow(rhsN, lhsN)), nil
		}
	}

	if lhsT == TypeBoolean && rhsT == TypeBoolean {
		lhsB, _ := lhs.Bool()
		rhsB, _ := rhs.Bool()

		if recording {
			switch o.Op {
			case OpAnd:
				if !lhsB {
					// Record cost of wasted rhs execution
					o.b.Penalize(rightBranch)
				}
				if !rhsB {
					// Record cost of wasted lhs execution
					o.b.Penalize(leftBranch)
				}
			case OpOr:
				if rhsB {
					// Record cost of wasted lhs execution
					o.b.Penalize(rightBranch)
				}
				if lhsB {
					// Record cost of wasated rhs execution
					o.b.Penalize(leftBranch)
				}
			}

			if done := o.b.Sampled(); done {
				if o.b.OptimalBranch() == rightBranch {
					// RHS is the optimal starting branch,
					// so swap the elements now.
					o.LHS, o.RHS = o.RHS, o.LHS
				}
			}
		}

		switch o.Op {
		case OpAnd:
			return NewStaticBool(lhsB && rhsB), nil
		case OpOr:
			return NewStaticBool(lhsB || rhsB), nil
		}
	}

	if lhsT.isMatchingArrayElement(rhsT) {
		// we only support boolean op in the arrays
		if !o.Op.isBoolean() {
			return NewStaticNil(), errors.ErrUnsupported
		}

		elemOp := &BinaryOperation{Op: o.Op, LHS: lhs, RHS: rhs}
		arraySide := lhs
		// to support symmetric operations
		if rhsT.isArray() {
			// for regex operations, TraceQL makes an assumption that RHS is the regex, and compiles it.
			// we can support symmetric array operations by flipping the sides and executing the binary operation.
			elemOp = &BinaryOperation{Op: getFlippedOp(o.Op), LHS: rhs, RHS: lhs}
			arraySide = rhs
		}

		var res Static
		err := arraySide.GetElements(func(elem Static) bool {
			elemOp.LHS = elem
			res, err = elemOp.execute(span)
			if err != nil {
				return false // stop iteration early if there's an error
			}
			match, ok := res.Bool()
			return !(ok && match) // stop if a match is found
		})
		if err != nil {
			return NewStaticNil(), err
		}

		return res, err
	}

	switch o.Op {
	case OpAdd:
		return NewStaticFloat(lhs.Float() + rhs.Float()), nil
	case OpSub:
		return NewStaticFloat(lhs.Float() - rhs.Float()), nil
	case OpDiv:
		return NewStaticFloat(lhs.Float() / rhs.Float()), nil
	case OpMod:
		return NewStaticFloat(math.Mod(lhs.Float(), rhs.Float())), nil
	case OpMult:
		return NewStaticFloat(lhs.Float() * rhs.Float()), nil
	case OpGreater:
		return NewStaticBool(lhs.Float() > rhs.Float()), nil
	case OpGreaterEqual:
		return NewStaticBool(lhs.Float() >= rhs.Float()), nil
	case OpLess:
		return NewStaticBool(lhs.Float() < rhs.Float()), nil
	case OpLessEqual:
		return NewStaticBool(lhs.Float() <= rhs.Float()), nil
	case OpPower:
		return NewStaticFloat(math.Pow(lhs.Float(), rhs.Float())), nil
	case OpEqual:
		return NewStaticBool(lhs.Equals(&rhs)), nil
	case OpNotEqual:
		return NewStaticBool(lhs.NotEquals(&rhs)), nil
	default:
		return NewStaticNil(), errors.New("unexpected operator " + o.Op.String())
	}
}

// getFlippedOp will return the flipped op, used when flipping the LHS and RHS of a BinaryOperation
func getFlippedOp(op Operator) Operator {
	switch op {
	case OpGreater:
		return OpLess
	case OpGreaterEqual:
		return OpLessEqual
	case OpLess:
		return OpGreater
	case OpLessEqual:
		return OpGreaterEqual
	default:
		return op
	}
}

// why does this and the above exist?
func binOp(op Operator, lhs, rhs Static) (bool, error) {
	lhsT := lhs.impliedType()
	rhsT := rhs.impliedType()
	if !lhsT.isMatchingOperand(rhsT) {
		return false, nil
	}

	if !op.binaryTypesValid(lhsT, rhsT) {
		return false, nil
	}

	if lhsT == TypeBoolean && rhsT == TypeBoolean {
		lhsB, _ := lhs.Bool()
		rhsB, _ := rhs.Bool()

		switch op {
		case OpAnd:
			return lhsB && rhsB, nil
		case OpOr:
			return lhsB || rhsB, nil
		}
	}

	switch op {
	case OpGreater:
		return lhs.Float() > rhs.Float(), nil
	case OpGreaterEqual:
		return lhs.Float() >= rhs.Float(), nil
	case OpLess:
		return lhs.Float() < rhs.Float(), nil
	case OpLessEqual:
		return lhs.Float() <= rhs.Float(), nil
	case OpEqual:
		return lhs.Equals(&rhs), nil
	case OpNotEqual:
		return lhs.NotEquals(&rhs), nil
	}

	return false, errors.New("unexpected operator " + op.String())
}

func (o UnaryOperation) execute(span Span) (Static, error) {
	static, err := o.Expression.execute(span)
	if err != nil {
		return NewStaticNil(), err
	}

	if o.Op == OpNot {
		if static.Type != TypeBoolean {
			return NewStaticNil(), fmt.Errorf("expression (%v) expected a boolean, but got %v", o, static.Type)
		}
		b, _ := static.Bool()
		return NewStaticBool(!b), nil
	}
	if o.Op == OpSub {
		if !static.Type.isNumeric() {
			return NewStaticNil(), fmt.Errorf("expression (%v) expected a numeric, but got %v", o, static.Type)
		}
		switch static.Type {
		case TypeInt:
			n, _ := static.Int()
			return NewStaticInt(-1 * n), nil
		case TypeFloat:
			return NewStaticFloat(-1 * static.Float()), nil
		case TypeDuration:
			d, _ := static.Duration()
			return NewStaticDuration(-1 * d), nil
		}
	}
	if o.Op == OpExists {
		return NewStaticBool(static.Type != TypeNil), nil
	}

	return NewStaticNil(), fmt.Errorf("UnaryOperation has invalid operator %v", o.Op)
}

func (s Static) execute(Span) (Static, error) {
	return s, nil
}

func (a Attribute) execute(span Span) (Static, error) {
	static, ok := span.AttributeFor(a)
	if ok {
		return static, nil
	}

	return StaticNil, nil
}

func uniqueSpans(ss1 []*Spanset, ss2 []*Spanset) []Span {
	ss1Count := 0
	ss2Count := 0

	for _, ss1 := range ss1 {
		ss1Count += len(ss1.Spans)
	}
	for _, ss2 := range ss2 {
		ss2Count += len(ss2.Spans)
	}
	output := make([]Span, 0, ss1Count+ss2Count)

	ssCount := ss2Count
	ssSmaller := ss2
	ssLarger := ss1
	if ss1Count < ss2Count {
		ssCount = ss1Count
		ssSmaller = ss1
		ssLarger = ss2
	}

	// make the map with ssSmaller
	spans := make(map[Span]struct{}, ssCount)
	for _, ss := range ssSmaller {
		for _, span := range ss.Spans {
			spans[span] = struct{}{}
			output = append(output, span)
		}
	}

	// only add the spans from ssLarger that aren't in the map
	for _, ss := range ssLarger {
		for _, span := range ss.Spans {
			if _, ok := spans[span]; !ok {
				output = append(output, span)
			}
		}
	}

	return output
}

func intPow(m, n int) int {
	result := 1
	for i := 0; i < n; i++ {
		result *= m
	}
	return result
}
