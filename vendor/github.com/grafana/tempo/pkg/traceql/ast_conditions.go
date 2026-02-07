package traceql

func (r RootExpr) extractConditions(request *FetchSpansRequest) {
	r.Pipeline.extractConditions(request)
	if r.MetricsPipeline != nil {
		r.MetricsPipeline.extractConditions(request)
	}
}

func (f SpansetFilter) extractConditions(request *FetchSpansRequest) {
	f.Expression.extractConditions(request)

	// For empty spansets { } ensure there is something that matches all spans.
	// Use start time which would have been selected as part of the second pass
	// metadata, and is still fairly efficient to pull back.
	if s, ok := f.Expression.(Static); ok {
		if b, ok := s.Bool(); !ok || !b {
			return
		}

		for _, c := range request.Conditions {
			if c.Attribute.Intrinsic != IntrinsicNone && c.Op == OpNone {
				// A different match-all intrinsic is already present.
				return
			}
		}

		request.appendCondition(Condition{
			Attribute: NewIntrinsic(IntrinsicSpanStartTime),
			Op:        OpNone,
		})
	}
}

// extractConditions on Select puts its conditions into the SecondPassConditions
func (o SelectOperation) extractConditions(request *FetchSpansRequest) {
	selectR := &FetchSpansRequest{}
	for _, expr := range o.attrs {
		expr.extractConditions(selectR)
	}
	// copy any conditions to the normal request's SecondPassConditions
	request.SecondPassConditions = append(request.SecondPassConditions, selectR.Conditions...)
}

func (o *BinaryOperation) extractConditions(request *FetchSpansRequest) {
	// TODO we can further optimise this by attempting to execute every FieldExpression, if they only contain statics it should resolve
	switch o.LHS.(type) {
	case Attribute:
		switch o.RHS.(type) {
		case Static:
			if (o.RHS.(Static).Type == TypeNil && o.Op == OpNotEqual) || !o.Op.isBoolean() { // the fetch layer can't build predicates on operators that are not boolean
				request.appendCondition(Condition{
					Attribute: o.LHS.(Attribute),
					Op:        OpNone,
					Operands:  nil,
				})
			} else if o.RHS.(Static).Type == TypeBoolean && (o.Op == OpOr || o.Op == OpAnd) {
				request.appendCondition(Condition{
					Attribute: o.LHS.(Attribute),
					Op:        OpNone,
					Operands:  nil,
				})
			} else {
				request.appendCondition(Condition{
					Attribute: o.LHS.(Attribute),
					Op:        o.Op,
					Operands:  []Static{o.RHS.(Static)},
				})
			}
		case Attribute:
			// Both sides are attributes, just fetch both
			request.appendCondition(Condition{
				Attribute: o.LHS.(Attribute),
				Op:        OpNone,
				Operands:  nil,
			})
			request.appendCondition(Condition{
				Attribute: o.RHS.(Attribute),
				Op:        OpNone,
				Operands:  nil,
			})
		default:
			// Just fetch LHS and try to do something smarter with RHS
			request.appendCondition(Condition{
				Attribute: o.LHS.(Attribute),
				Op:        OpNone,
				Operands:  nil,
			})
			o.RHS.extractConditions(request)
		}
	case Static:
		switch o.RHS.(type) {
		case Static:
			// 2 statics, don't need to send any conditions
			return
		case Attribute:
			if (o.LHS.(Static).Type == TypeNil && o.Op == OpNotEqual) || !o.Op.isBoolean() { // the fetch layer can't build predicates on operators that are not boolean
				request.appendCondition(Condition{
					Attribute: o.RHS.(Attribute),
					Op:        OpNone,
					Operands:  nil,
				})
			} else if o.LHS.(Static).Type == TypeBoolean && (o.Op == OpOr || o.Op == OpAnd) {
				request.appendCondition(Condition{
					Attribute: o.RHS.(Attribute),
					Op:        OpNone,
					Operands:  nil,
				})
			} else {
				request.appendCondition(Condition{
					Attribute: o.RHS.(Attribute),
					Op:        o.Op,
					Operands:  []Static{o.LHS.(Static)},
				})
			}

		default:
			o.RHS.extractConditions(request)
		}
	default:
		o.LHS.extractConditions(request)
		o.RHS.extractConditions(request)
		request.AllConditions = request.AllConditions && (o.Op != OpOr)
	}
}

func (o UnaryOperation) extractConditions(request *FetchSpansRequest) {
	// TODO when Op is Not we should just either negate all inner Operands or just fetch the columns with OpNone
	o.Expression.extractConditions(request)
}

func (s Static) extractConditions(*FetchSpansRequest) {
}

func (a Attribute) extractConditions(request *FetchSpansRequest) {
	request.appendCondition(Condition{
		Attribute: a,
		Op:        OpNone,
		Operands:  nil,
	})
}
