package query

import (
	"context"
	"math"
	"sort"
	"strings"
	"sync"

	"github.com/mithrandie/csvq/lib/option"
	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"

	"github.com/mithrandie/ternary"
)

type View struct {
	Header    Header
	RecordSet RecordSet
	FileInfo  *FileInfo

	selectFields []int
	selectLabels []string
	isGrouped    bool

	comparisonKeysInEachRecord []string
	sortValuesInEachCell       [][]*SortValue
	sortValuesInEachRecord     []SortValues
	sortDirections             []int
	sortNullPositions          []int

	offset int
}

func NewView() *View {
	return &View{}
}

func NewDualView() *View {
	return &View{
		Header:    NewEmptyHeader(1),
		RecordSet: RecordSet{NewEmptyRecord(1)},
	}
}

func NewViewFromGroupedRecord(ctx context.Context, flags *option.Flags, referenceRecord ReferenceRecord) (*View, error) {
	view := NewView()
	view.Header = referenceRecord.view.Header
	record := referenceRecord.view.RecordSet[referenceRecord.recordIndex]

	view.RecordSet = make(RecordSet, record.GroupLen())

	if err := NewGoroutineTaskManager(record.GroupLen(), -1, flags.CPU).Run(ctx, func(index int) error {
		view.RecordSet[index] = make(Record, view.FieldLen())
		for j := range record {
			grpIdx := index
			if len(record[j]) < 2 {
				grpIdx = 0
			}
			view.RecordSet[index][j] = record[j][grpIdx : grpIdx+1]
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return view, nil
}

func (view *View) IsUpdatable() bool {
	return view.FileInfo != nil && view.FileInfo.IsUpdatable()
}

func (view *View) Where(ctx context.Context, scope *ReferenceScope, clause parser.WhereClause) error {
	return view.filter(ctx, scope, clause.Filter)
}

func (view *View) filter(ctx context.Context, scope *ReferenceScope, condition parser.QueryExpression) error {
	results := make([]bool, view.RecordLen())

	if err := EvaluateSequentially(ctx, scope, view, func(seqScope *ReferenceScope, rIdx int) error {
		primary, e := Evaluate(ctx, seqScope, condition)
		if e != nil {
			return e
		}

		if primary.Ternary() == ternary.TRUE {
			results[rIdx] = true
		}
		return nil
	}); err != nil {
		return err
	}

	newIdx := 0
	for i, ok := range results {
		if ok {
			if i != newIdx {
				view.RecordSet[newIdx] = view.RecordSet[i]
			}
			newIdx++
		}
	}

	view.RecordSet = view.RecordSet[:newIdx]
	return nil
}

func (view *View) GroupBy(ctx context.Context, scope *ReferenceScope, clause parser.GroupByClause) error {
	return view.group(ctx, scope, clause.Items)
}

func (view *View) group(ctx context.Context, scope *ReferenceScope, items []parser.QueryExpression) error {
	if items == nil {
		return view.groupAll(ctx, scope.Tx.Flags)
	}

	gm := NewGoroutineTaskManager(view.RecordLen(), -1, scope.Tx.Flags.CPU)
	groupsList := make([]map[string][]int, gm.Number)
	groupKeyCnt := make(map[string]int, 40)
	groupKeys := make([]string, 0, 40)
	mtx := &sync.Mutex{}

	var grpFn = func(thIdx int) {
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

		start, end := gm.RecordRange(thIdx)
		seqScope := scope.CreateScopeForSequentialEvaluation(view)
		groups := make(map[string][]int, 20)
		values := make([]value.Primary, len(items))

	GroupKeyLoop:
		for i := start; i < end; i++ {
			if gm.HasError() {
				break GroupKeyLoop
			}
			if i&15 == 0 && ctx.Err() != nil {
				break GroupKeyLoop
			}

			seqScope.Records[0].recordIndex = i

			for i, item := range items {
				p, e := Evaluate(ctx, seqScope, item)
				if e != nil {
					gm.SetError(e)
					break GroupKeyLoop
				}
				values[i] = p
			}
			keyBuf := GetComparisonKeysBuf()
			SerializeComparisonKeys(keyBuf, values, seqScope.Tx.Flags)
			key := keyBuf.String()
			PutComparisonkeysBuf(keyBuf)

			if _, ok := groups[key]; ok {
				groups[key] = append(groups[key], i)
			} else {
				groups[key] = make([]int, 0, int(math.Min(float64(view.RecordLen()/18), 1000)))
				groups[key] = append(groups[key], i)
				mtx.Lock()
				if _, ok := groupKeyCnt[key]; !ok {
					groupKeyCnt[key] = 0
					groupKeys = append(groupKeys, key)
				}
				mtx.Unlock()
			}
		}

		groupsList[thIdx] = groups
	}

	if 1 < gm.Number {
		for i := 0; i < gm.Number; i++ {
			gm.Add()
			go grpFn(i)
		}
		gm.Wait()
	} else {
		grpFn(0)
	}

	if gm.HasError() {
		return gm.Err()
	}
	if ctx.Err() != nil {
		return ConvertContextError(ctx.Err())
	}

	for i := range groupsList {
		for k := range groupsList[i] {
			groupKeyCnt[k] = groupKeyCnt[k] + len(groupsList[i][k])
		}
	}

	records := make(RecordSet, len(groupKeys))
	calcCnt := view.RecordLen() * len(groupKeys)
	minReq := -1
	if MinimumRequiredPerCPUCore < calcCnt {
		minReq = int(math.Ceil(float64(len(groupKeys)) / (math.Floor(float64(calcCnt) / MinimumRequiredPerCPUCore))))
	}
	if err := NewGoroutineTaskManager(len(groupKeys), minReq, scope.Tx.Flags.CPU).Run(ctx, func(gIdx int) error {
		record := make(Record, view.FieldLen())

		for i := 0; i < view.FieldLen(); i++ {
			primaries := make(Cell, groupKeyCnt[groupKeys[gIdx]])
			pos := 0
			for j := range groupsList {
				if indices, ok := groupsList[j][groupKeys[gIdx]]; ok {
					for k := range indices {
						primaries[pos+k] = view.RecordSet[indices[k]][i][0]
					}
					pos += len(indices)
				}
			}
			record[i] = primaries
		}

		records[gIdx] = record
		return nil
	}); err != nil {
		return err
	}

	view.RecordSet = records
	view.isGrouped = true
	for _, item := range items {
		switch item.(type) {
		case parser.FieldReference, parser.ColumnNumber:
			idx, _ := view.Header.SearchIndex(item)
			view.Header[idx].IsGroupKey = true
		}
	}
	return nil
}

func (view *View) groupAll(ctx context.Context, flags *option.Flags) error {
	if 0 < view.RecordLen() {
		record := make(Record, view.FieldLen())

		calcCnt := view.RecordLen() * view.FieldLen()
		minReq := -1
		if MinimumRequiredPerCPUCore < calcCnt {
			minReq = int(math.Ceil(float64(view.FieldLen()) / (math.Floor(float64(calcCnt) / MinimumRequiredPerCPUCore))))
		}
		if err := NewGoroutineTaskManager(view.FieldLen(), minReq, flags.CPU).Run(ctx, func(fIdx int) error {
			primaries := make(Cell, len(view.RecordSet))
			for j := range view.RecordSet {
				primaries[j] = view.RecordSet[j][fIdx][0]
			}
			record[fIdx] = primaries
			return nil
		}); err != nil {
			return err
		}

		view.RecordSet = view.RecordSet[:1]
		view.RecordSet[0] = record
	}

	view.isGrouped = true
	return nil
}

func (view *View) Having(ctx context.Context, scope *ReferenceScope, clause parser.HavingClause) error {
	err := view.filter(ctx, scope, clause.Filter)
	if err != nil {
		if _, ok := err.(*NotGroupingRecordsError); ok {
			if err = view.group(ctx, scope, nil); err != nil {
				return err
			}
			if err = view.filter(ctx, scope, clause.Filter); err != nil {
				return err
			}
		} else {
			return err
		}
	}
	return nil
}

func (view *View) Select(ctx context.Context, scope *ReferenceScope, clause parser.SelectClause) error {
	var parseWildcard = func(fields []parser.QueryExpression) []parser.Field {
		list := make([]parser.Field, 0, len(fields))

		columns := view.Header.TableColumns()

		for _, v := range fields {
			field := v.(parser.Field)

			if _, ok := field.Object.(parser.AllColumns); ok {
				for _, c := range columns {
					list = append(list, parser.Field{
						Object: c,
					})
				}

				continue
			}

			if fieldReference, ok := field.Object.(parser.FieldReference); ok {
				if _, ok := fieldReference.Column.(parser.AllColumns); ok {
					viewName := fieldReference.View.Literal

					for _, c := range columns {
						cref := c.(parser.FieldReference)
						if cref.View.Literal != viewName {
							continue
						}

						list = append(list, parser.Field{
							Object: c,
						})
					}

					continue
				}
			}

			list = append(list, field)
		}

		return list
	}

	var evalFields = func(fields []parser.Field) error {
		view.selectFields = make([]int, len(fields))
		view.selectLabels = make([]string, len(fields))
		for i, field := range fields {
			alias := ""
			if field.Alias != nil {
				alias = field.Alias.(parser.Identifier).Literal
			}
			idx, err := view.evalColumn(ctx, scope, field.Object, alias)
			if err != nil {
				return err
			}
			view.selectFields[i] = idx
			view.selectLabels[i] = field.Name()
		}

		return nil
	}

	fields := parseWildcard(clause.Fields)
	fieldObjects := make([]parser.QueryExpression, len(fields))
	for i := range fields {
		fieldObjects[i] = fields[i].Object
	}

	if !view.isGrouped {
		hasAggregateFunction, err := HasAggregateFunctionInList(fieldObjects, scope)
		if err != nil {
			return err
		}

		if hasAggregateFunction {
			if err = view.group(ctx, scope, nil); err != nil {
				return err
			}

			if view.RecordLen() < 1 {
				record := make(Record, view.FieldLen())
				for i := range record {
					record[i] = make(Cell, 0)
				}
				view.RecordSet = append(view.RecordSet, record)
			}
		}
	}

	analyticFunctions, err := SearchAnalyticFunctionsInList(fieldObjects)
	if err != nil {
		return err
	}

	if err := view.ExtendRecordCapacity(ctx, scope, fieldObjects, analyticFunctions); err != nil {
		return err
	}

	for _, fn := range analyticFunctions {
		err = view.evalAnalyticFunction(ctx, scope, fn)
		if err != nil {
			return err
		}
	}

	err = evalFields(fields)
	if err != nil {
		return err
	}

	if clause.IsDistinct() {
		if err = view.GenerateComparisonKeys(ctx, scope.Tx.Flags); err != nil {
			return err
		}
		records := make(RecordSet, 0, 40)
		values := make(map[string]bool, 40)
		for i, v := range view.RecordSet {
			if !values[view.comparisonKeysInEachRecord[i]] {
				values[view.comparisonKeysInEachRecord[i]] = true

				record := make(Record, len(view.selectFields))
				for j, idx := range view.selectFields {
					record[j] = v[idx]
				}
				records = append(records, record)
			}
		}

		hfields := NewEmptyHeader(len(view.selectFields))
		for i, idx := range view.selectFields {
			hfields[i] = view.Header[idx]
			view.selectFields[i] = i
		}

		view.Header = hfields
		view.RecordSet = records
		view.comparisonKeysInEachRecord = nil
		view.sortValuesInEachCell = nil
	}

	return nil
}

func (view *View) GenerateComparisonKeys(ctx context.Context, flags *option.Flags) error {
	view.comparisonKeysInEachRecord = make([]string, view.RecordLen())

	return NewGoroutineTaskManager(view.RecordLen(), -1, flags.CPU).Run(ctx, func(index int) error {
		flags := flags
		buf := GetComparisonKeysBuf()
		var primaries []value.Primary = nil

		if view.selectFields != nil {
			primaries = make([]value.Primary, len(view.selectFields))
			for j, idx := range view.selectFields {
				primaries[j] = view.RecordSet[index][idx][0]
			}
		} else {
			primaries = make([]value.Primary, view.FieldLen())
			for j := range view.RecordSet[index] {
				primaries[j] = view.RecordSet[index][j][0]
			}
		}
		SerializeComparisonKeys(buf, primaries, flags)

		view.comparisonKeysInEachRecord[index] = buf.String()
		PutComparisonkeysBuf(buf)
		return nil
	})
}

func (view *View) SelectAllColumns(ctx context.Context, scope *ReferenceScope) error {
	selectClause := parser.SelectClause{
		Fields: []parser.QueryExpression{
			parser.Field{Object: parser.AllColumns{}},
		},
	}
	return view.Select(ctx, scope, selectClause)
}

func (view *View) OrderBy(ctx context.Context, scope *ReferenceScope, clause parser.OrderByClause) error {
	if view.RecordLen() < 2 {
		return nil
	}

	orderValues := make([]parser.QueryExpression, len(clause.Items))
	for i, item := range clause.Items {
		orderValues[i] = item.(parser.OrderItem).Value
	}

	analyticFunctions, err := SearchAnalyticFunctionsInList(orderValues)
	if err != nil {
		return err
	}

	if err := view.ExtendRecordCapacity(ctx, scope, orderValues, analyticFunctions); err != nil {
		return err
	}

	for _, fn := range analyticFunctions {
		err = view.evalAnalyticFunction(ctx, scope, fn)
		if err != nil {
			return err
		}
	}

	sortIndices := make([]int, len(clause.Items))
	for i, v := range clause.Items {
		oi := v.(parser.OrderItem)
		idx, err := view.evalColumn(ctx, scope, oi.Value, "")
		if err != nil {
			return err
		}
		sortIndices[i] = idx
	}

	view.sortValuesInEachRecord = make([]SortValues, view.RecordLen())
	view.sortDirections = make([]int, len(clause.Items))
	view.sortNullPositions = make([]int, len(clause.Items))

	for i, v := range clause.Items {
		oi := v.(parser.OrderItem)
		if oi.Direction.IsEmpty() {
			view.sortDirections[i] = parser.ASC
		} else {
			view.sortDirections[i] = oi.Direction.Token
		}

		if oi.NullsPosition.IsEmpty() {
			switch view.sortDirections[i] {
			case parser.ASC:
				view.sortNullPositions[i] = parser.FIRST
			default: //parser.DESC
				view.sortNullPositions[i] = parser.LAST
			}
		} else {
			view.sortNullPositions[i] = oi.NullsPosition.Token
		}
	}

	if err := NewGoroutineTaskManager(view.RecordLen(), -1, scope.Tx.Flags.CPU).Run(ctx, func(index int) error {
		if view.sortValuesInEachCell != nil && view.sortValuesInEachCell[index] == nil {
			view.sortValuesInEachCell[index] = make([]*SortValue, cap(view.RecordSet[index]))
		}

		sortValues := make(SortValues, len(sortIndices))
		for j, idx := range sortIndices {
			if view.sortValuesInEachCell != nil && idx < len(view.sortValuesInEachCell[index]) && view.sortValuesInEachCell[index][idx] != nil {
				sortValues[j] = view.sortValuesInEachCell[index][idx]
			} else {
				sortValues[j] = NewSortValue(view.RecordSet[index][idx][0], scope.Tx.Flags)
				if view.sortValuesInEachCell != nil && idx < len(view.sortValuesInEachCell[index]) {
					view.sortValuesInEachCell[index][idx] = sortValues[j]
				}
			}
		}
		view.sortValuesInEachRecord[index] = sortValues
		return nil
	}); err != nil {
		return err
	}

	sort.Sort(view)
	return nil
}

func (view *View) numberOfColumnsToBeAdded(exprs []parser.QueryExpression, funcs []parser.AnalyticFunction) int {
	n := 0

	analyticFunctionIdentifiers := make(map[string]bool, len(funcs))

	numberInAnalyticFunction := func(fn parser.AnalyticFunction) int {
		if _, ok := view.Header.ContainsObject(fn); ok {
			return 0
		}

		identifier := FormatFieldIdentifier(fn)

		if _, ok := analyticFunctionIdentifiers[identifier]; ok {
			return 0
		}

		analyticFunctionIdentifiers[identifier] = true
		partitionExprs := fn.AnalyticClause.PartitionValues()
		numberInPartitionClause := view.numberOfColumnsToBeAdded(partitionExprs, nil)

		numberInOrderByClause := 0
		if fn.AnalyticClause.OrderByClause != nil {
			orderByExprs := GetValuesInOrderByClause(fn.AnalyticClause.OrderByClause.(parser.OrderByClause))
			numberInOrderByClause = view.numberOfColumnsToBeAdded(orderByExprs, nil)
		}

		return 1 + numberInOrderByClause + numberInPartitionClause
	}

	for _, expr := range exprs {
		switch expr.(type) {
		case parser.FieldReference, parser.ColumnNumber:
			continue
		case parser.AnalyticFunction:
			n = n + numberInAnalyticFunction(expr.(parser.AnalyticFunction))
		default:
			n = n + 1
		}
	}

	for _, expr := range funcs {
		n = n + numberInAnalyticFunction(expr)
	}

	return n
}

func (view *View) ExtendRecordCapacity(ctx context.Context, scope *ReferenceScope, exprs []parser.QueryExpression, funcs []parser.AnalyticFunction) error {
	fieldCap := view.FieldLen() + view.numberOfColumnsToBeAdded(exprs, funcs)

	if 0 < view.RecordLen() && fieldCap <= cap(view.RecordSet[0]) {
		return nil
	}

	return NewGoroutineTaskManager(view.RecordLen(), -1, scope.Tx.Flags.CPU).Run(ctx, func(index int) error {
		record := make(Record, view.FieldLen(), fieldCap)
		copy(record, view.RecordSet[index])
		view.RecordSet[index] = record
		return nil
	})
}

func (view *View) evalColumn(ctx context.Context, scope *ReferenceScope, obj parser.QueryExpression, alias string) (int, error) {
	var idx = -1
	var ok = false

	switch obj.(type) {
	case parser.FieldReference, parser.ColumnNumber, parser.AnalyticFunction:
		idx, ok = view.Header.ContainsObject(obj)

		switch obj.(type) {
		case parser.FieldReference, parser.ColumnNumber:
			if ok && view.isGrouped && view.Header[idx].IsFromTable && !view.Header[idx].IsGroupKey {
				return idx, NewFieldNotGroupKeyError(obj)
			}
		}
	}

	if !ok {
		if err := EvaluateSequentially(ctx, scope, view, func(seqScope *ReferenceScope, rIdx int) error {
			primary, e := Evaluate(ctx, seqScope, obj)
			if e != nil {
				return e
			}

			view.RecordSet[rIdx] = append(view.RecordSet[rIdx], NewCell(primary))
			return nil
		}); err != nil {
			return idx, err
		}
		view.Header, idx = AddHeaderField(view.Header, FormatFieldIdentifier(obj), FormatFieldLabel(obj), alias)
	}

	if 0 < len(alias) {
		if !strings.EqualFold(view.Header[idx].Column, alias) && !InStrSliceWithCaseInsensitive(alias, view.Header[idx].Aliases) {
			view.Header[idx].Aliases = append(view.Header[idx].Aliases, alias)
		}
	}

	return idx, nil
}

func (view *View) evalAnalyticFunction(ctx context.Context, scope *ReferenceScope, expr parser.AnalyticFunction) error {
	if _, ok := view.Header.ContainsObject(expr); ok {
		return nil
	}

	name := strings.ToUpper(expr.Name)
	if _, ok := AggregateFunctions[name]; !ok {
		if _, ok := AnalyticFunctions[name]; !ok {
			if udfn, err := scope.GetFunction(expr, expr.Name); err != nil || !udfn.IsAggregate {
				return NewFunctionNotExistError(expr, expr.Name)
			}
		}
	}

	var partitionIndices []int
	if expr.AnalyticClause.PartitionClause != nil {
		partitionExprs := expr.AnalyticClause.PartitionValues()

		partitionIndices = make([]int, len(partitionExprs))
		for i, pexpr := range partitionExprs {
			idx, err := view.evalColumn(ctx, scope, pexpr, "")
			if err != nil {
				return err
			}
			partitionIndices[i] = idx
		}
	}

	if view.sortValuesInEachCell == nil {
		view.sortValuesInEachCell = make([][]*SortValue, view.RecordLen())
	}

	if expr.AnalyticClause.OrderByClause != nil {
		err := view.OrderBy(ctx, scope, expr.AnalyticClause.OrderByClause.(parser.OrderByClause))
		if err != nil {
			return err
		}
	}

	err := Analyze(ctx, scope, view, expr, partitionIndices)

	view.sortValuesInEachRecord = nil
	view.sortDirections = nil
	view.sortNullPositions = nil

	return err
}

func (view *View) Offset(ctx context.Context, scope *ReferenceScope, clause parser.OffsetClause) error {
	val, err := Evaluate(ctx, scope, clause.Value)
	if err != nil {
		return err
	}
	number := value.ToInteger(val)
	if value.IsNull(number) {
		return NewInvalidOffsetNumberError(clause)
	}
	view.offset = int(number.(*value.Integer).Raw())
	value.Discard(number)

	if view.offset < 0 {
		view.offset = 0
	}

	if view.RecordLen() <= view.offset {
		view.RecordSet = RecordSet{}
	} else {
		newSet := view.RecordSet[view.offset:]
		view.RecordSet = view.RecordSet[:len(newSet)]
		for i := range newSet {
			view.RecordSet[i] = newSet[i]
		}
	}
	return nil
}

func (view *View) Limit(ctx context.Context, scope *ReferenceScope, clause parser.LimitClause) error {
	val, err := Evaluate(ctx, scope, clause.Value)
	if err != nil {
		return err
	}

	var limit int
	if clause.Percentage() {
		number := value.ToFloat(val)
		if value.IsNull(number) {
			return NewInvalidLimitPercentageError(clause)
		}
		percentage := number.(*value.Float).Raw()
		value.Discard(number)

		if 100 < percentage {
			limit = 100
		} else if percentage < 0 {
			limit = 0
		} else {
			limit = int(math.Ceil(float64(view.RecordLen()+view.offset) * percentage / 100))
		}
	} else {
		number := value.ToInteger(val)
		if value.IsNull(number) {
			return NewInvalidLimitNumberError(clause)
		}
		limit = int(number.(*value.Integer).Raw())
		value.Discard(number)

		if limit < 0 {
			limit = 0
		}
	}

	if view.RecordLen() <= limit {
		return nil
	}

	if clause.WithTies() && view.sortValuesInEachRecord != nil {
		bottomSortValues := view.sortValuesInEachRecord[limit-1]
		for limit < view.RecordLen() {
			if !bottomSortValues.EquivalentTo(view.sortValuesInEachRecord[limit]) {
				break
			}
			limit++
		}
	}

	view.RecordSet = view.RecordSet[:limit]
	return nil
}

func (view *View) InsertValues(ctx context.Context, scope *ReferenceScope, fields []parser.QueryExpression, list []parser.QueryExpression) (int, error) {
	recordValues, err := view.convertListToRecordValues(ctx, scope, fields, list)
	if err != nil {
		return 0, err
	}
	return view.insert(ctx, fields, recordValues)
}

func (view *View) InsertFromQuery(ctx context.Context, scope *ReferenceScope, fields []parser.QueryExpression, query parser.SelectQuery) (int, error) {
	recordValues, err := view.convertResultSetToRecordValues(ctx, scope, fields, query)
	if err != nil {
		return 0, err
	}
	return view.insert(ctx, fields, recordValues)
}

func (view *View) ReplaceValues(ctx context.Context, scope *ReferenceScope, fields []parser.QueryExpression, list []parser.QueryExpression, keys []parser.QueryExpression) (int, error) {
	recordValues, err := view.convertListToRecordValues(ctx, scope, fields, list)
	if err != nil {
		return 0, err
	}
	return view.replace(ctx, scope.Tx.Flags, fields, recordValues, keys)
}

func (view *View) ReplaceFromQuery(ctx context.Context, scope *ReferenceScope, fields []parser.QueryExpression, query parser.SelectQuery, keys []parser.QueryExpression) (int, error) {
	recordValues, err := view.convertResultSetToRecordValues(ctx, scope, fields, query)
	if err != nil {
		return 0, err
	}
	return view.replace(ctx, scope.Tx.Flags, fields, recordValues, keys)
}

func (view *View) convertListToRecordValues(ctx context.Context, scope *ReferenceScope, fields []parser.QueryExpression, list []parser.QueryExpression) ([][]value.Primary, error) {
	recordValues := make([][]value.Primary, len(list))
	for i, item := range list {
		if ctx.Err() != nil {
			return nil, ConvertContextError(ctx.Err())
		}

		rv := item.(parser.RowValue)
		values, err := EvalRowValue(ctx, scope, rv)
		if err != nil {
			return recordValues, err
		}
		if len(fields) != len(values) {
			return recordValues, NewInsertRowValueLengthError(rv, len(fields))
		}

		recordValues[i] = values
	}
	return recordValues, nil
}

func (view *View) convertResultSetToRecordValues(ctx context.Context, scope *ReferenceScope, fields []parser.QueryExpression, query parser.SelectQuery) ([][]value.Primary, error) {
	selectedView, err := Select(ctx, scope, query)
	if err != nil {
		return nil, err
	}
	if len(fields) != selectedView.FieldLen() {
		return nil, NewInsertSelectFieldLengthError(query, len(fields))
	}

	recordValues := make([][]value.Primary, selectedView.RecordLen())
	for i, record := range selectedView.RecordSet {
		if ctx.Err() != nil {
			return nil, ConvertContextError(ctx.Err())
		}

		values := make([]value.Primary, selectedView.FieldLen())
		for j, cell := range record {
			values[j] = cell[0]
		}
		recordValues[i] = values
	}
	return recordValues, nil
}

func (view *View) convertRecordValuesToRecordSet(ctx context.Context, fields []parser.QueryExpression, recordValues [][]value.Primary) (RecordSet, error) {
	var valueIndex = func(i int, list []int) int {
		for j, v := range list {
			if i == v {
				return j
			}
		}
		return -1
	}

	fieldIndices, err := view.FieldIndices(fields)
	if err != nil {
		return nil, err
	}

	recordIndices := make([]int, view.FieldLen())
	for i := 0; i < view.FieldLen(); i++ {
		recordIndices[i] = valueIndex(i, fieldIndices)
	}

	records := make(RecordSet, len(recordValues))
	for i, values := range recordValues {
		if ctx.Err() != nil {
			return nil, ConvertContextError(ctx.Err())
		}

		record := make(Record, view.FieldLen())
		for j := 0; j < view.FieldLen(); j++ {
			if recordIndices[j] < 0 {
				record[j] = NewCell(value.NewNull())
			} else {
				record[j] = NewCell(values[recordIndices[j]])
			}
		}
		records[i] = record
	}
	return records, nil
}

func (view *View) insert(ctx context.Context, fields []parser.QueryExpression, recordValues [][]value.Primary) (int, error) {
	records, err := view.convertRecordValuesToRecordSet(ctx, fields, recordValues)
	if err != nil {
		return 0, err
	}

	view.RecordSet = view.RecordSet.Merge(records)
	return len(recordValues), nil
}

func (view *View) replace(ctx context.Context, flags *option.Flags, fields []parser.QueryExpression, recordValues [][]value.Primary, keys []parser.QueryExpression) (int, error) {
	fieldIndices, err := view.FieldIndices(fields)
	if err != nil {
		return 0, err
	}
	fieldIndicesMap := make(map[uint]bool, len(fieldIndices))
	for _, v := range fieldIndices {
		fieldIndicesMap[uint(v)] = true
	}

	keyIndices, err := view.FieldIndices(keys)
	if err != nil {
		return 0, err
	}
	keyIndicesMap := make(map[uint]bool, len(keyIndices))
	for _, v := range keyIndices {
		keyIndicesMap[uint(v)] = true
	}

	for idx, i := range keyIndices {
		if _, ok := fieldIndicesMap[uint(i)]; !ok {
			return 0, NewReplaceKeyNotSetError(keys[idx])
		}
	}
	updateIndices := make([]int, 0, len(fieldIndices)-len(keyIndices))
	for _, i := range fieldIndices {
		if _, ok := keyIndicesMap[uint(i)]; !ok {
			updateIndices = append(updateIndices, i)
		}
	}

	records, err := view.convertRecordValuesToRecordSet(ctx, fields, recordValues)
	if err != nil {
		return 0, err
	}

	sortValuesInEachRecord := make([]SortValues, view.RecordLen())
	if err := NewGoroutineTaskManager(view.RecordLen(), -1, flags.CPU).Run(ctx, func(index int) error {
		sortValues := make(SortValues, len(keyIndices))
		for j, idx := range keyIndices {
			sortValues[j] = NewSortValue(view.RecordSet[index][idx][0], flags)
		}
		sortValuesInEachRecord[index] = sortValues
		return nil
	}); err != nil {
		return 0, err
	}

	sortValuesInInsertRecords := make([]SortValues, len(records))
	if err := NewGoroutineTaskManager(len(records), -1, flags.CPU).Run(ctx, func(index int) error {
		sortValues := make(SortValues, len(keyIndices))
		for j, idx := range keyIndices {
			sortValues[j] = NewSortValue(records[index][idx][0], flags)
		}
		sortValuesInInsertRecords[index] = sortValues
		return nil
	}); err != nil {
		return 0, err
	}

	replacedRecord := make(map[int]bool, len(records))
	replacedCount := 0
	for i := range records {
		replacedRecord[i] = false
	}
	replaceMtx := &sync.Mutex{}
	var replaced = func(idx int) {
		replaceMtx.Lock()
		replacedRecord[idx] = true
		replacedCount++
		replaceMtx.Unlock()
	}
	if err := NewGoroutineTaskManager(view.RecordLen(), -1, flags.CPU).Run(ctx, func(index int) error {
		for j, rsv := range sortValuesInInsertRecords {
			if sortValuesInEachRecord[index].EquivalentTo(rsv) {
				for _, fidx := range updateIndices {
					view.RecordSet[index][fidx] = records[j][fidx]
				}
				replaced(j)
				break
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}

	insertRecords := make(RecordSet, 0, len(records))
	for i, isReplaced := range replacedRecord {
		if !isReplaced {
			insertRecords = append(insertRecords, records[i])
		}
	}
	view.RecordSet = view.RecordSet.Merge(insertRecords)
	return len(insertRecords) + replacedCount, nil
}

func (view *View) Fix(ctx context.Context, flags *option.Flags) error {
	fieldLen := len(view.selectFields)
	resize := false
	if fieldLen != view.FieldLen() {
		resize = true
	} else {
		for i := 0; i < view.FieldLen(); i++ {
			if view.selectFields[i] != i {
				resize = true
				break
			}
		}
	}

	if resize {
		if err := NewGoroutineTaskManager(view.RecordLen(), -1, flags.CPU).Run(ctx, func(index int) error {
			record := make(Record, fieldLen)
			for j, idx := range view.selectFields {
				record[j] = view.RecordSet[index][idx][:1]
			}

			if len(view.RecordSet[index]) < fieldLen {
				view.RecordSet[index] = make(Record, fieldLen)
			} else if fieldLen < len(view.RecordSet[index]) {
				view.RecordSet[index] = view.RecordSet[index][:fieldLen]
			}
			for i := range record {
				view.RecordSet[index][i] = record[i]
			}
			return nil
		}); err != nil {
			return err
		}
	}

	hfields := NewEmptyHeader(len(view.selectFields))

	colNumber := 0
	for i, idx := range view.selectFields {
		colNumber++

		hfields[i] = view.Header[idx]
		hfields[i].Identifier = ""
		hfields[i].Aliases = nil
		hfields[i].Number = colNumber
		hfields[i].IsFromTable = true
		hfields[i].IsJoinColumn = false
		hfields[i].IsGroupKey = false

		if 0 < len(view.selectLabels) {
			hfields[i].Column = view.selectLabels[i]
		}
	}

	view.Header = hfields
	view.selectFields = nil
	view.selectLabels = nil
	view.isGrouped = false
	view.comparisonKeysInEachRecord = nil
	view.sortValuesInEachCell = nil
	view.sortValuesInEachRecord = nil
	view.sortDirections = nil
	view.sortNullPositions = nil
	view.offset = 0
	return nil
}

func (view *View) Union(ctx context.Context, flags *option.Flags, calcView *View, all bool) (err error) {
	view.RecordSet = view.RecordSet.Merge(calcView.RecordSet)
	view.FileInfo = nil

	if !all {
		if err = view.GenerateComparisonKeys(ctx, flags); err != nil {
			return err
		}

		records := make(RecordSet, 0, view.RecordLen())
		values := make(map[string]bool)

		for i, key := range view.comparisonKeysInEachRecord {
			if !values[key] {
				values[key] = true
				records = append(records, view.RecordSet[i])
			}
		}

		view.RecordSet = records
		view.comparisonKeysInEachRecord = nil
	}
	return
}

func (view *View) Except(ctx context.Context, flags *option.Flags, calcView *View, all bool) (err error) {
	if err = view.GenerateComparisonKeys(ctx, flags); err != nil {
		return err
	}
	if err = calcView.GenerateComparisonKeys(ctx, flags); err != nil {
		return err
	}

	keys := make(map[string]bool)
	for _, key := range calcView.comparisonKeysInEachRecord {
		if !keys[key] {
			keys[key] = true
		}
	}

	distinctKeys := make(map[string]bool)
	records := make(RecordSet, 0, view.RecordLen())
	for i, key := range view.comparisonKeysInEachRecord {
		if !keys[key] {
			if !all {
				if distinctKeys[key] {
					continue
				}
				distinctKeys[key] = true
			}
			records = append(records, view.RecordSet[i])
		}
	}
	view.RecordSet = records
	view.FileInfo = nil
	view.comparisonKeysInEachRecord = nil
	return
}

func (view *View) Intersect(ctx context.Context, flags *option.Flags, calcView *View, all bool) (err error) {
	if err = view.GenerateComparisonKeys(ctx, flags); err != nil {
		return err
	}
	if err = calcView.GenerateComparisonKeys(ctx, flags); err != nil {
		return err
	}

	keys := make(map[string]bool)
	for _, key := range calcView.comparisonKeysInEachRecord {
		if !keys[key] {
			keys[key] = true
		}
	}

	distinctKeys := make(map[string]bool)
	records := make(RecordSet, 0, view.RecordLen())
	for i, key := range view.comparisonKeysInEachRecord {
		if _, ok := keys[key]; ok {
			if !all {
				if distinctKeys[key] {
					continue
				}
				distinctKeys[key] = true
			}
			records = append(records, view.RecordSet[i])
		}
	}
	view.RecordSet = records
	view.FileInfo = nil
	view.comparisonKeysInEachRecord = nil
	return
}

func (view *View) ListValuesForAggregateFunctions(ctx context.Context, scope *ReferenceScope, expr parser.QueryExpression, arg parser.QueryExpression, distinct bool) ([]value.Primary, error) {
	list := make([]value.Primary, view.RecordLen())

	if err := EvaluateSequentially(ctx, scope, view, func(sqlScope *ReferenceScope, rIdx int) error {
		p, e := Evaluate(ctx, sqlScope, arg)
		if e != nil {
			if _, ok := e.(*NotGroupingRecordsError); ok {
				e = NewNestedAggregateFunctionsError(expr)
			}
			return e
		}
		list[rIdx] = p
		return nil
	}); err != nil {
		return nil, err
	}

	if distinct {
		list = Distinguish(list, scope.Tx.Flags)
	}

	return list, nil
}

func (view *View) RestoreHeaderReferences() error {
	return view.Header.Update(FormatTableName(view.FileInfo.Path), nil)
}

func (view *View) FieldIndex(fieldRef parser.QueryExpression) (int, error) {
	idx, err := view.Header.SearchIndex(fieldRef)
	if err != nil {
		if err == errFieldAmbiguous {
			err = NewFieldAmbiguousError(fieldRef)
		} else {
			err = NewFieldNotExistError(fieldRef)
		}
	}
	return idx, err
}

func (view *View) FieldIndices(fields []parser.QueryExpression) ([]int, error) {
	indices := make([]int, len(fields))
	for i, v := range fields {
		idx, err := view.FieldIndex(v)
		if err != nil {
			return nil, err
		}
		indices[i] = idx
	}
	return indices, nil
}

func (view *View) FieldViewName(fieldRef parser.QueryExpression) (string, error) {
	idx, err := view.FieldIndex(fieldRef)
	if err != nil {
		return "", err
	}
	return view.Header[idx].View, nil
}

func (view *View) InternalRecordId(ref string, recordIndex int) (int, error) {
	idx, err := view.Header.ContainsInternalId(ref)
	if err != nil {
		return -1, NewInternalRecordIdNotExistError()
	}
	internalId, ok := view.RecordSet[recordIndex][idx][0].(*value.Integer)
	if !ok {
		return -1, NewInternalRecordIdEmptyError()
	}
	return int(internalId.Raw()), nil
}

func (view *View) CreateRestorePoint() {
	view.FileInfo.restorePointRecordSet = view.RecordSet.Copy()
	view.FileInfo.restorePointHeader = view.Header.Copy()
}

func (view *View) Restore() {
	view.RecordSet = view.FileInfo.restorePointRecordSet.Copy()
	view.Header = view.FileInfo.restorePointHeader.Copy()
}

func (view *View) FieldLen() int {
	return view.Header.Len()
}

func (view *View) RecordLen() int {
	return view.Len()
}

func (view *View) Len() int {
	return len(view.RecordSet)
}

func (view *View) Swap(i, j int) {
	view.RecordSet[i], view.RecordSet[j] = view.RecordSet[j], view.RecordSet[i]
	view.sortValuesInEachRecord[i], view.sortValuesInEachRecord[j] = view.sortValuesInEachRecord[j], view.sortValuesInEachRecord[i]
	if view.sortValuesInEachCell != nil {
		view.sortValuesInEachCell[i], view.sortValuesInEachCell[j] = view.sortValuesInEachCell[j], view.sortValuesInEachCell[i]
	}
}

func (view *View) Less(i, j int) bool {
	return view.sortValuesInEachRecord[i].Less(view.sortValuesInEachRecord[j], view.sortDirections, view.sortNullPositions)
}

func (view *View) Copy() *View {
	header := view.Header.Copy()
	records := view.RecordSet.Copy()

	return &View{
		Header:    header,
		RecordSet: records,
		FileInfo:  view.FileInfo,
	}
}
