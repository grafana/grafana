package query

import (
	"context"
	"math"
	"sync"

	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"

	"github.com/mithrandie/ternary"
)

func ParseJoinCondition(join parser.Join, view *View, joinView *View) (parser.QueryExpression, []parser.FieldReference, []parser.FieldReference, error) {
	if join.Natural.IsEmpty() && join.Condition == nil {
		return nil, nil, nil, nil
	}

	var using []parser.QueryExpression

	if !join.Natural.IsEmpty() {
		for _, field := range view.Header {
			if field.Column == InternalIdColumn {
				continue
			}
			ref := parser.FieldReference{BaseExpr: parser.NewBaseExpr(join.Natural), Column: parser.Identifier{Literal: field.Column}}
			if _, err := joinView.Header.SearchIndex(ref); err != nil {
				if err == errFieldAmbiguous {
					return nil, nil, nil, NewFieldAmbiguousError(ref)
				}
				continue
			}
			using = append(using, parser.Identifier{BaseExpr: parser.NewBaseExpr(join.Natural), Literal: field.Column})
		}
	} else {
		cond := join.Condition.(parser.JoinCondition)
		if cond.On != nil {
			return cond.On, nil, nil, nil
		}

		using = cond.Using
	}

	if len(using) < 1 {
		return nil, nil, nil, nil
	}

	usingFields := make([]string, len(using))
	for i, v := range using {
		usingFields[i] = v.(parser.Identifier).Literal
	}

	includeFields := make([]parser.FieldReference, len(using))
	excludeFields := make([]parser.FieldReference, len(using))

	comps := make([]parser.Comparison, len(using))
	for i, v := range using {
		var lhs parser.FieldReference
		var rhs parser.FieldReference
		fieldref := parser.FieldReference{BaseExpr: v.GetBaseExpr(), Column: v.(parser.Identifier)}

		lhsidx, err := view.FieldIndex(fieldref)
		if err != nil {
			return nil, nil, nil, err
		}
		lhs = parser.FieldReference{BaseExpr: v.GetBaseExpr(), View: parser.Identifier{Literal: view.Header[lhsidx].View}, Column: v.(parser.Identifier)}

		rhsidx, err := joinView.FieldIndex(fieldref)
		if err != nil {
			return nil, nil, nil, err
		}
		rhs = parser.FieldReference{BaseExpr: v.GetBaseExpr(), View: parser.Identifier{Literal: joinView.Header[rhsidx].View}, Column: v.(parser.Identifier)}

		comps[i] = parser.Comparison{
			LHS:      lhs,
			RHS:      rhs,
			Operator: parser.Token{Token: parser.COMPARISON_OP, Literal: "="},
		}

		if join.Direction.Token == parser.RIGHT {
			includeFields[i] = rhs
			excludeFields[i] = lhs
		} else {
			includeFields[i] = lhs
			excludeFields[i] = rhs
		}
	}

	if len(comps) == 1 {
		return comps[0], includeFields, excludeFields, nil
	}

	logic := parser.Logic{
		LHS:      comps[0],
		RHS:      comps[1],
		Operator: parser.Token{Token: parser.AND, Literal: parser.TokenLiteral(parser.AND)},
	}
	for i := 2; i < len(comps); i++ {
		logic = parser.Logic{
			LHS:      logic,
			RHS:      comps[i],
			Operator: parser.Token{Token: parser.AND, Literal: parser.TokenLiteral(parser.AND)},
		}
	}
	return logic, includeFields, excludeFields, nil
}

func CrossJoin(ctx context.Context, scope *ReferenceScope, view *View, joinView *View) error {
	mergedHeader := view.Header.Merge(joinView.Header)
	records := make(RecordSet, view.RecordLen()*joinView.RecordLen())

	if err := NewGoroutineTaskManager(view.RecordLen(), CalcMinimumRequired(view.RecordLen(), joinView.RecordLen(), MinimumRequiredPerCPUCore), scope.Tx.Flags.CPU).Run(ctx, func(index int) error {
		start := index * joinView.RecordLen()
		for i := 0; i < joinView.RecordLen(); i++ {
			records[start+i] = view.RecordSet[index].Merge(joinView.RecordSet[i], nil)
		}
		return nil
	}); err != nil {
		return err
	}

	view.Header = mergedHeader
	view.RecordSet = records
	view.FileInfo = nil
	return nil
}

func InnerJoin(ctx context.Context, scope *ReferenceScope, view *View, joinView *View, condition parser.QueryExpression) error {
	if condition == nil {
		return CrossJoin(ctx, scope, view, joinView)
	}

	var recordPool = &sync.Pool{
		New: func() interface{} {
			return make(Record, view.FieldLen()+joinView.FieldLen())
		},
	}

	mergedHeader := view.Header.Merge(joinView.Header)

	gm := NewGoroutineTaskManager(view.RecordLen(), CalcMinimumRequired(view.RecordLen(), joinView.RecordLen(), MinimumRequiredPerCPUCore), scope.Tx.Flags.CPU)
	recordsList := make([]RecordSet, gm.Number)

	var joinFn = func(thIdx int) {
		defer func() {
			if !gm.HasError() {
				if panicReport := recover(); panicReport != nil {
					gm.SetError(NewFatalError(panicReport))
				}
			}

			if 1 < gm.Number {
				gm.Done()
			}
		}()

		ctx := ctx
		start, end := gm.RecordRange(thIdx)
		records := make(RecordSet, 0, end-start)
		seqScope := scope.CreateScopeForRecordEvaluation(
			&View{
				Header:    mergedHeader,
				RecordSet: make(RecordSet, 1),
			},
			0,
		)

	InnerJoinLoop:
		for i := start; i < end; i++ {
			for j := 0; j < joinView.RecordLen(); j++ {
				if gm.HasError() {
					break InnerJoinLoop
				}
				if i&15 == 0 && ctx.Err() != nil {
					break InnerJoinLoop
				}

				mergedRecord := view.RecordSet[i].Merge(joinView.RecordSet[j], recordPool)
				seqScope.Records[0].view.RecordSet[0] = mergedRecord

				primary, e := Evaluate(ctx, seqScope, condition)
				if e != nil {
					gm.SetError(e)
					break InnerJoinLoop
				}
				if primary.Ternary() == ternary.TRUE {
					records = append(records, mergedRecord)
				} else {
					for i := range mergedRecord {
						mergedRecord[i] = nil
					}
					recordPool.Put(mergedRecord)
				}
			}
		}

		recordsList[thIdx] = records
	}

	if 1 < gm.Number {
		for i := 0; i < gm.Number; i++ {
			gm.Add()
			go joinFn(i)
		}
		gm.Wait()
	} else {
		joinFn(0)
	}

	if gm.HasError() {
		return gm.Err()
	}
	if ctx.Err() != nil {
		return ConvertContextError(ctx.Err())
	}

	view.Header = mergedHeader
	view.RecordSet = MergeRecordSetList(recordsList)
	view.FileInfo = nil
	return nil
}

func OuterJoin(ctx context.Context, scope *ReferenceScope, view *View, joinView *View, condition parser.QueryExpression, direction int) error {
	if direction == parser.TokenUndefined {
		direction = parser.LEFT
	}

	var recordPool = &sync.Pool{
		New: func() interface{} {
			return make(Record, view.FieldLen()+joinView.FieldLen())
		},
	}

	mergedHeader := view.Header.Merge(joinView.Header)

	if direction == parser.RIGHT {
		view, joinView = joinView, view
	}

	gm := NewGoroutineTaskManager(view.RecordLen(), CalcMinimumRequired(view.RecordLen(), joinView.RecordLen(), MinimumRequiredPerCPUCore), scope.Tx.Flags.CPU)

	recordsList := make([]RecordSet, gm.Number+1)
	joinViewMatchesList := make([][]bool, gm.Number)

	var joinFn = func(thIdx int) {
		defer func() {
			if !gm.HasError() {
				if panicReport := recover(); panicReport != nil {
					gm.SetError(NewFatalError(panicReport))
				}
			}

			if 1 < gm.Number {
				gm.Done()
			}
		}()

		ctx := ctx
		start, end := gm.RecordRange(thIdx)
		records := make(RecordSet, 0, end-start)
		seqScope := scope.CreateScopeForRecordEvaluation(
			&View{
				Header:    mergedHeader,
				RecordSet: make(RecordSet, 1),
			},
			0,
		)

		joinViewMatches := make([]bool, joinView.RecordLen())
		var leftViewFieldLen int
		if direction == parser.RIGHT {
			leftViewFieldLen = joinView.FieldLen()
		} else {
			leftViewFieldLen = view.FieldLen()
		}

	OuterJoinLoop:
		for i := start; i < end; i++ {
			match := false
			for j := 0; j < joinView.RecordLen(); j++ {
				if gm.HasError() {
					break OuterJoinLoop
				}
				if i&15 == 0 && ctx.Err() != nil {
					break OuterJoinLoop
				}

				var mergedRecord Record
				switch direction {
				case parser.RIGHT:
					mergedRecord = joinView.RecordSet[j].Merge(view.RecordSet[i], recordPool)
				default:
					mergedRecord = view.RecordSet[i].Merge(joinView.RecordSet[j], recordPool)
				}
				seqScope.Records[0].view.RecordSet[0] = mergedRecord

				primary, e := Evaluate(ctx, seqScope, condition)
				if e != nil {
					gm.SetError(e)
					break OuterJoinLoop
				}
				if primary.Ternary() == ternary.TRUE {
					if direction == parser.FULL && !joinViewMatches[j] {
						joinViewMatches[j] = true
					}
					records = append(records, mergedRecord)
					match = true
				} else {
					for i := range mergedRecord {
						mergedRecord[i] = nil
					}
					recordPool.Put(mergedRecord)
				}
			}

			if !match {
				record := recordPool.Get().(Record)
				switch direction {
				case parser.RIGHT:
					for k := 0; k < leftViewFieldLen; k++ {
						record[k] = NewCell(value.NewNull())
					}
					for k := range view.RecordSet[i] {
						record[k+leftViewFieldLen] = view.RecordSet[i][k]
					}
				default:
					for k := range view.RecordSet[i] {
						record[k] = view.RecordSet[i][k]
					}
					for k := 0; k < joinView.FieldLen(); k++ {
						record[k+leftViewFieldLen] = NewCell(value.NewNull())
					}
				}
				records = append(records, record)

			}
		}

		recordsList[thIdx] = records
		joinViewMatchesList[thIdx] = joinViewMatches
	}

	if 1 < gm.Number {
		for i := 0; i < gm.Number; i++ {
			gm.Add()
			go joinFn(i)
		}
		gm.Wait()
	} else {
		joinFn(0)
	}

	if gm.HasError() {
		return gm.Err()
	}
	if ctx.Err() != nil {
		return ConvertContextError(ctx.Err())
	}

	if direction == parser.FULL {
		appendIndices := make([]int, 0, joinView.RecordLen())

		for i := 0; i < joinView.RecordLen(); i++ {
			match := false
			for _, joinViewMatches := range joinViewMatchesList {
				if joinViewMatches[i] {
					match = true
					break
				}
			}
			if !match {
				appendIndices = append(appendIndices, i)
			}
		}

		recordsListIdx := len(recordsList) - 1
		recordsList[recordsListIdx] = make(RecordSet, len(appendIndices))
		viewFieldLen := view.FieldLen()
		for i, idx := range appendIndices {
			record := recordPool.Get().(Record)
			for k := 0; k < viewFieldLen; k++ {
				record[k] = NewCell(value.NewNull())
			}
			for k := range joinView.RecordSet[idx] {
				record[k+viewFieldLen] = joinView.RecordSet[idx][k]
			}
			recordsList[recordsListIdx][i] = record

		}
	}

	if direction == parser.RIGHT {
		view, joinView = joinView, view
	}

	view.Header = mergedHeader
	view.RecordSet = MergeRecordSetList(recordsList)
	view.FileInfo = nil
	return nil
}

func CalcMinimumRequired(i1 int, i2 int, defaultMinimumRequired int) int {
	if i1 < 1 || i2 < 1 {
		return defaultMinimumRequired
	}

	p := i1 * i2
	if p <= defaultMinimumRequired {
		return defaultMinimumRequired
	}
	return int(math.Ceil(float64(i1) / math.Floor(float64(p)/float64(defaultMinimumRequired))))
}
