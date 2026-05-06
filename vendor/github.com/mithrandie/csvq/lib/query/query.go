package query

import (
	"context"
	"strings"
	"sync/atomic"

	"github.com/mithrandie/csvq/lib/option"
	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"
)

func FetchCursor(ctx context.Context, scope *ReferenceScope, name parser.Identifier, fetchPosition parser.FetchPosition, vars []parser.Variable) (bool, error) {
	position := parser.NEXT
	number := -1
	if !fetchPosition.Position.IsEmpty() {
		position = fetchPosition.Position.Token
		if fetchPosition.Number != nil {
			p, err := Evaluate(ctx, scope, fetchPosition.Number)
			if err != nil {
				return false, err
			}
			i := value.ToInteger(p)
			if value.IsNull(i) {
				return false, NewInvalidFetchPositionError(fetchPosition)
			}
			number = int(i.(*value.Integer).Raw())
			value.Discard(i)
		}
	}

	primaries, err := scope.FetchCursor(name, position, number)
	if err != nil {
		return false, err
	}
	if primaries == nil {
		return false, nil
	}
	if len(vars) != len(primaries) {
		return false, NewCursorFetchLengthError(name, len(primaries))
	}

	for i, v := range vars {
		_, err := scope.SubstituteVariableDirectly(v, primaries[i])
		if err != nil {
			return false, err
		}
	}
	return true, nil
}

func DeclareView(ctx context.Context, scope *ReferenceScope, expr parser.ViewDeclaration) error {
	if scope.TemporaryTableExists(expr.View.Literal) {
		return NewTemporaryTableRedeclaredError(expr.View)
	}

	var view *View
	var err error

	if expr.Query != nil {
		view, err = Select(ctx, scope, expr.Query.(parser.SelectQuery))
		if err != nil {
			return err
		}

		if err := view.Header.Update(expr.View.Literal, expr.Fields); err != nil {
			if _, ok := err.(*FieldLengthNotMatchError); ok {
				return NewTemporaryTableFieldLengthError(expr.Query.(parser.SelectQuery), expr.View, len(expr.Fields))
			}
			return err
		}
	} else {
		fields := make([]string, len(expr.Fields))
		fieldsMap := make(map[string]bool, len(expr.Fields))
		for i := range expr.Fields {
			lit := expr.Fields[i].(parser.Identifier).Literal
			ulit := strings.ToUpper(lit)
			if _, ok := fieldsMap[ulit]; ok {
				return NewDuplicateFieldNameError(expr.Fields[i].(parser.Identifier))
			}
			fields[i] = lit
			fieldsMap[ulit] = true
		}
		header := NewHeader(expr.View.Literal, fields)
		view = NewView()
		view.Header = header
		view.RecordSet = RecordSet{}
	}

	view.FileInfo = NewTemporaryTableFileInfo(expr.View.Literal)
	view.CreateRestorePoint()

	scope.SetTemporaryTable(view)

	return err
}

func Select(ctx context.Context, scope *ReferenceScope, query parser.SelectQuery) (*View, error) {
	var intoVars []parser.Variable = nil
	if selectEntity, ok := query.SelectEntity.(parser.SelectEntity); ok && selectEntity.IntoClause != nil {
		intoClause := selectEntity.IntoClause.(parser.IntoClause)
		if len(selectEntity.SelectClause.(parser.SelectClause).Fields) != len(intoClause.Variables) {
			return nil, NewSelectIntoQueryFieldLengthNotMatchError(query, len(intoClause.Variables))
		}
		for _, v := range intoClause.Variables {
			if _, err := scope.GetVariable(v); err != nil {
				return nil, err
			}
		}
		intoVars = intoClause.Variables
	}

	queryScope := scope.CreateNode()

	if query.WithClause != nil {
		if err := queryScope.LoadInlineTable(ctx, query.WithClause.(parser.WithClause)); err != nil {
			queryScope.CloseCurrentNode()
			return nil, err
		}
	}

	view, err := selectEntity(
		ctx,
		queryScope,
		query.SelectEntity,
		query.IsForUpdate(),
	)
	if err != nil {
		queryScope.CloseCurrentNode()
		return nil, err
	}

	if query.OrderByClause != nil {
		if err := view.OrderBy(ctx, queryScope, query.OrderByClause.(parser.OrderByClause)); err != nil {
			queryScope.CloseCurrentNode()
			return nil, err
		}
	}

	if query.LimitClause != nil {
		limitClause := query.LimitClause.(parser.LimitClause)
		if limitClause.OffsetClause != nil {
			if err := view.Offset(ctx, queryScope, limitClause.OffsetClause.(parser.OffsetClause)); err != nil {
				queryScope.CloseCurrentNode()
				return nil, err
			}
		}

		if !limitClause.Type.IsEmpty() {
			if err := view.Limit(ctx, queryScope, limitClause); err != nil {
				queryScope.CloseCurrentNode()
				return nil, err
			}
		}
	}

	err = view.Fix(ctx, queryScope.Tx.Flags)
	queryScope.CloseCurrentNode()

	if err == nil && intoVars != nil {
		if view.FieldLen() != len(intoVars) {
			return nil, NewSelectIntoQueryFieldLengthNotMatchError(query, len(intoVars))
		}
		switch view.RecordLen() {
		case 0:
			for _, v := range intoVars {
				if _, err := scope.SubstituteVariableDirectly(v, value.NewNull()); err != nil {
					return view, err
				}
			}
		case 1:
			for i, v := range intoVars {
				if _, err := scope.SubstituteVariableDirectly(v, view.RecordSet[0][i][0]); err != nil {
					return view, err
				}
			}
		default:
			return view, NewSelectIntoQueryTooManyRecordsError(query)
		}
	}

	return view, err
}

func selectEntity(ctx context.Context, scope *ReferenceScope, expr parser.QueryExpression, forUpdate bool) (*View, error) {
	entity, ok := expr.(parser.SelectEntity)
	if !ok {
		return selectSet(ctx, scope, expr.(parser.SelectSet), forUpdate)
	}

	if entity.FromClause == nil {
		entity.FromClause = parser.FromClause{}
	}
	view, err := LoadView(ctx, scope, entity.FromClause.(parser.FromClause).Tables, forUpdate, false)
	if err != nil {
		return nil, err
	}

	if entity.WhereClause != nil {
		if err := view.Where(ctx, scope, entity.WhereClause.(parser.WhereClause)); err != nil {
			return nil, err
		}
	}

	if entity.GroupByClause != nil {
		if err := view.GroupBy(ctx, scope, entity.GroupByClause.(parser.GroupByClause)); err != nil {
			return nil, err
		}
	}

	if entity.HavingClause != nil {
		if err := view.Having(ctx, scope, entity.HavingClause.(parser.HavingClause)); err != nil {
			return nil, err
		}
	}

	if err := view.Select(ctx, scope, entity.SelectClause.(parser.SelectClause)); err != nil {
		return nil, err
	}

	return view, nil
}

func selectSetEntity(ctx context.Context, scope *ReferenceScope, expr parser.QueryExpression, forUpdate bool) (*View, error) {
	if subquery, ok := expr.(parser.Subquery); ok {
		return Select(ctx, scope, subquery.Query)
	}

	view, err := selectEntity(ctx, scope, expr, forUpdate)
	if err != nil {
		return nil, err
	}
	err = view.Fix(ctx, scope.Tx.Flags)
	return view, err
}

func selectSet(ctx context.Context, scope *ReferenceScope, set parser.SelectSet, forUpdate bool) (*View, error) {
	lview, err := selectSetEntity(ctx, scope, set.LHS, forUpdate)
	if err != nil {
		return nil, err
	}

	if scope.RecursiveTable != nil {
		scope.RecursiveTmpView = nil
		err := selectSetForRecursion(ctx, scope, lview, set, forUpdate)
		if err != nil {
			return nil, err
		}
	} else {
		queryScope := scope.CreateNode()
		rview, err := selectSetEntity(ctx, queryScope, set.RHS, forUpdate)
		queryScope.CloseCurrentNode()
		queryScope = nil
		if err != nil {
			return nil, err
		}

		if lview.FieldLen() != rview.FieldLen() {
			return nil, NewCombinedSetFieldLengthError(set.RHS, lview.FieldLen())
		}

		switch set.Operator.Token {
		case parser.UNION:
			if err = lview.Union(ctx, scope.Tx.Flags, rview, !set.All.IsEmpty()); err != nil {
				return nil, err
			}
		case parser.EXCEPT:
			if err = lview.Except(ctx, scope.Tx.Flags, rview, !set.All.IsEmpty()); err != nil {
				return nil, err
			}
		case parser.INTERSECT:
			if err = lview.Intersect(ctx, scope.Tx.Flags, rview, !set.All.IsEmpty()); err != nil {
				return nil, err
			}
		}
	}

	err = lview.SelectAllColumns(ctx, scope)
	return lview, err
}

func selectSetForRecursion(ctx context.Context, scope *ReferenceScope, view *View, set parser.SelectSet, forUpdate bool) error {
	if ctx.Err() != nil {
		return ConvertContextError(ctx.Err())
	}

	if -1 < scope.Tx.Flags.LimitRecursion {
		if scope.RecursiveCount == nil {
			scope.RecursiveCount = new(int64)
		}
		atomic.AddInt64(scope.RecursiveCount, 1)
		if scope.Tx.Flags.LimitRecursion < *scope.RecursiveCount {
			return NewRecursionExceededLimitError(set.RHS, scope.Tx.Flags.LimitRecursion)
		}
	}

	tmpViewName := strings.ToUpper(scope.RecursiveTable.Name.Literal)

	if scope.RecursiveTmpView == nil {
		err := view.Header.Update(tmpViewName, scope.RecursiveTable.Fields)
		if err != nil {
			return err
		}
		scope.RecursiveTmpView = view
	}

	queryScope := scope.CreateNode()
	rview, err := selectSetEntity(ctx, queryScope, set.RHS, forUpdate)
	queryScope.CloseCurrentNode()
	queryScope = nil
	if err != nil {
		return err
	}
	if view.FieldLen() != rview.FieldLen() {
		return NewCombinedSetFieldLengthError(set.RHS, view.FieldLen())
	}

	if rview.RecordLen() < 1 {
		return nil
	}

	switch set.Operator.Token {
	case parser.UNION:
		if err = view.Union(ctx, scope.Tx.Flags, rview, !set.All.IsEmpty()); err != nil {
			return err
		}
	case parser.EXCEPT:
		if err = view.Except(ctx, scope.Tx.Flags, rview, !set.All.IsEmpty()); err != nil {
			return err
		}
	case parser.INTERSECT:
		if err = view.Intersect(ctx, scope.Tx.Flags, rview, !set.All.IsEmpty()); err != nil {
			return err
		}
	}

	if err = rview.Header.Update(tmpViewName, scope.RecursiveTable.Fields); err != nil {
		return err
	}
	scope.RecursiveTmpView = rview

	return selectSetForRecursion(ctx, scope, view, set, forUpdate)
}

func Insert(ctx context.Context, scope *ReferenceScope, query parser.InsertQuery) (*FileInfo, int, error) {
	queryScope := scope.CreateNode()
	defer queryScope.CloseCurrentNode()

	var insertRecords int

	if query.WithClause != nil {
		if err := queryScope.LoadInlineTable(ctx, query.WithClause.(parser.WithClause)); err != nil {
			return nil, insertRecords, err
		}
	}

	tables := []parser.QueryExpression{
		query.Table,
	}

	queryScope.Tx.operationMutex.Lock()
	defer queryScope.Tx.operationMutex.Unlock()

	view, err := LoadView(ctx, queryScope, tables, true, false)
	if err != nil {
		return nil, insertRecords, err
	}
	if !view.IsUpdatable() {
		return nil, insertRecords, NewInlineTableCannotBeUpdatedError(query.Table.Object)
	}

	fields := query.Fields
	if fields == nil {
		fields = view.Header.TableColumns()
	}

	if query.ValuesList != nil {
		if insertRecords, err = view.InsertValues(ctx, queryScope, fields, query.ValuesList); err != nil {
			return nil, insertRecords, err
		}
	} else {
		if insertRecords, err = view.InsertFromQuery(ctx, queryScope, fields, query.Query.(parser.SelectQuery)); err != nil {
			return nil, insertRecords, err
		}
	}

	if err = view.RestoreHeaderReferences(); err != nil {
		return nil, insertRecords, err
	}

	if view.FileInfo.IsInMemoryTable() {
		scope.ReplaceTemporaryTable(view)
	} else if view.FileInfo.IsFile() {
		scope.Tx.CachedViews.Set(view)
	}

	return view.FileInfo, insertRecords, err
}

func Update(ctx context.Context, scope *ReferenceScope, query parser.UpdateQuery) ([]*FileInfo, []int, error) {
	queryScope := scope.CreateNode()
	defer queryScope.CloseCurrentNode()

	if query.WithClause != nil {
		if err := queryScope.LoadInlineTable(ctx, query.WithClause.(parser.WithClause)); err != nil {
			return nil, nil, err
		}
	}

	if query.FromClause == nil {
		query.FromClause = parser.FromClause{Tables: query.Tables}
	}

	queryScope.Tx.operationMutex.Lock()
	defer queryScope.Tx.operationMutex.Unlock()

	view, err := LoadView(ctx, queryScope, query.FromClause.(parser.FromClause).Tables, true, true)
	if err != nil {
		return nil, nil, err
	}

	if query.WhereClause != nil {
		if err := view.Where(ctx, queryScope, query.WhereClause.(parser.WhereClause)); err != nil {
			return nil, nil, err
		}
	}

	viewsToUpdate := make(map[string]*View)
	updatedCount := make(map[string]int)
	for _, v := range query.Tables {
		table := v.(parser.Table)
		tableName, err := ParseTableName(ctx, queryScope, table)
		if err != nil {
			return nil, nil, err
		}
		if len(tableName.Literal) < 1 {
			return nil, nil, NewAliasMustBeSpecifiedForUpdateError(table.Object)
		}

		fpath, err := queryScope.GetAlias(tableName)
		if err != nil {
			return nil, nil, err
		}
		if len(fpath) < 1 {
			return nil, nil, NewInlineTableCannotBeUpdatedError(table.Object)
		}
		viewKey := strings.ToUpper(tableName.Literal)

		if queryScope.TemporaryTableExists(fpath) {
			viewsToUpdate[viewKey], _ = queryScope.GetTemporaryTable(parser.Identifier{Literal: fpath})
		} else {
			viewsToUpdate[viewKey], err = queryScope.Tx.CachedViews.Get(fpath)
			if err != nil {
				return nil, nil, NewInlineTableCannotBeUpdatedError(table.Object)
			}
		}
		if err = viewsToUpdate[viewKey].Header.Update(tableName.Literal, nil); err != nil {
			return nil, nil, err
		}
	}

	updatesList := make(map[string]map[int]*UintPool)
	seqScope := queryScope.CreateScopeForSequentialEvaluation(view)
	for i := range view.RecordSet {
		seqScope.Records[0].recordIndex = i
		internalIds := make(map[string]int)
		setListLen := len(query.SetList)

		for _, uset := range query.SetList {
			val, err := Evaluate(ctx, seqScope, uset.Value)
			if err != nil {
				return nil, nil, err
			}

			viewref, err := view.FieldViewName(uset.Field)
			if err != nil {
				return nil, nil, err
			}
			viewref = strings.ToUpper(viewref)

			if _, ok := viewsToUpdate[viewref]; !ok {
				return nil, nil, NewUpdateFieldNotExistError(uset.Field)
			}

			var internalId int
			if id, ok := internalIds[viewref]; ok {
				internalId = id
			} else {
				id, err := view.InternalRecordId(viewref, i)
				if err != nil {
					return nil, nil, NewUpdateValueAmbiguousError(uset.Field, uset.Value)
				}

				internalId = id
				internalIds[viewref] = internalId
			}

			fieldIdx, _ := viewsToUpdate[viewref].Header.SearchIndex(uset.Field)
			if _, ok := updatesList[viewref]; !ok {
				updatesList[viewref] = make(map[int]*UintPool)
			}
			if _, ok := updatesList[viewref][internalId]; !ok {
				updatesList[viewref][internalId] = NewUintPool(setListLen, LimitToUseUintSlicePool)
				updatedCount[viewref]++
			}
			if updatesList[viewref][internalId].Exists(uint(fieldIdx)) {
				return nil, nil, NewUpdateValueAmbiguousError(uset.Field, uset.Value)
			}
			updatesList[viewref][internalId].Add(uint(fieldIdx))
			viewsToUpdate[viewref].RecordSet[internalId][fieldIdx] = NewCell(val)
		}
	}

	fileInfos := make([]*FileInfo, 0)
	updateRecords := make([]int, 0)
	for k, v := range viewsToUpdate {
		if err = v.RestoreHeaderReferences(); err != nil {
			return nil, nil, err
		}

		if v.FileInfo.IsInMemoryTable() {
			scope.ReplaceTemporaryTable(v)
		} else if v.FileInfo.IsFile() {
			scope.Tx.CachedViews.Set(v)
		}

		fileInfos = append(fileInfos, v.FileInfo)
		updateRecords = append(updateRecords, updatedCount[k])
	}

	return fileInfos, updateRecords, nil
}

func Replace(ctx context.Context, scope *ReferenceScope, query parser.ReplaceQuery) (*FileInfo, int, error) {
	queryScope := scope.CreateNode()
	defer queryScope.CloseCurrentNode()

	var replaceRecords int

	if query.WithClause != nil {
		if err := queryScope.LoadInlineTable(ctx, query.WithClause.(parser.WithClause)); err != nil {
			return nil, replaceRecords, err
		}
	}

	tables := []parser.QueryExpression{
		query.Table,
	}

	queryScope.Tx.operationMutex.Lock()
	defer queryScope.Tx.operationMutex.Unlock()

	view, err := LoadView(ctx, queryScope, tables, true, false)
	if err != nil {
		return nil, replaceRecords, err
	}
	if !view.IsUpdatable() {
		return nil, replaceRecords, NewInlineTableCannotBeUpdatedError(query.Table.Object)
	}

	fields := query.Fields
	if fields == nil {
		fields = view.Header.TableColumns()
	}

	if query.ValuesList != nil {
		if replaceRecords, err = view.ReplaceValues(ctx, queryScope, fields, query.ValuesList, query.Keys); err != nil {
			return nil, replaceRecords, err
		}
	} else {
		if replaceRecords, err = view.ReplaceFromQuery(ctx, queryScope, fields, query.Query.(parser.SelectQuery), query.Keys); err != nil {
			return nil, replaceRecords, err
		}
	}

	if err = view.RestoreHeaderReferences(); err != nil {
		return nil, replaceRecords, err
	}

	if view.FileInfo.IsInMemoryTable() {
		scope.ReplaceTemporaryTable(view)
	} else if view.FileInfo.IsFile() {
		scope.Tx.CachedViews.Set(view)
	}

	return view.FileInfo, replaceRecords, err
}

func Delete(ctx context.Context, scope *ReferenceScope, query parser.DeleteQuery) ([]*FileInfo, []int, error) {
	queryScope := scope.CreateNode()
	defer queryScope.CloseCurrentNode()

	if query.WithClause != nil {
		if err := queryScope.LoadInlineTable(ctx, query.WithClause.(parser.WithClause)); err != nil {
			return nil, nil, err
		}
	}

	tables := query.FromClause.Tables
	if query.Tables == nil {
		if 1 < len(tables) {
			return nil, nil, NewDeleteTableNotSpecifiedError(query)
		}
		query.Tables = tables
	}

	queryScope.Tx.operationMutex.Lock()
	defer queryScope.Tx.operationMutex.Unlock()

	view, err := LoadView(ctx, queryScope, tables, true, true)
	if err != nil {
		return nil, nil, err
	}

	if query.WhereClause != nil {
		if err := view.Where(ctx, queryScope, query.WhereClause.(parser.WhereClause)); err != nil {
			return nil, nil, err
		}
	}

	viewsToDelete := make(map[string]*View)
	deletedIndices := make(map[string]map[int]bool)
	for _, v := range query.Tables {
		table := v.(parser.Table)
		tableName, err := ParseTableName(ctx, queryScope, table)
		if err != nil {
			return nil, nil, err
		}
		if len(tableName.Literal) < 1 {
			return nil, nil, NewAliasMustBeSpecifiedForUpdateError(table.Object)
		}

		fpath, err := queryScope.GetAlias(tableName)
		if err != nil {
			return nil, nil, err
		}
		if len(fpath) < 1 {
			return nil, nil, NewInlineTableCannotBeUpdatedError(table.Object)
		}
		viewKey := strings.ToUpper(tableName.Literal)

		if queryScope.TemporaryTableExists(fpath) {
			viewsToDelete[viewKey], _ = queryScope.GetTemporaryTable(parser.Identifier{Literal: fpath})
		} else {
			viewsToDelete[viewKey], err = queryScope.Tx.CachedViews.Get(fpath)
			if err != nil {
				return nil, nil, NewInlineTableCannotBeUpdatedError(table.Object)
			}
		}
		if err = viewsToDelete[viewKey].Header.Update(tableName.Literal, nil); err != nil {
			return nil, nil, err
		}
		deletedIndices[viewKey] = make(map[int]bool)
	}

	for i := range view.RecordSet {
		if ctx.Err() != nil {
			return nil, nil, ConvertContextError(ctx.Err())
		}

		for viewref := range viewsToDelete {
			internalId, err := view.InternalRecordId(viewref, i)
			if err != nil {
				continue
			}
			if !deletedIndices[viewref][internalId] {
				deletedIndices[viewref][internalId] = true
			}
		}
	}

	fileInfos := make([]*FileInfo, 0)
	deletedCounts := make([]int, 0)
	for k, v := range viewsToDelete {
		if ctx.Err() != nil {
			return nil, nil, ConvertContextError(ctx.Err())
		}

		records := make(RecordSet, 0, v.RecordLen()-len(deletedIndices[k]))
		for i, record := range v.RecordSet {
			if !deletedIndices[k][i] {
				records = append(records, record)
			}
		}
		v.RecordSet = records

		if err = v.RestoreHeaderReferences(); err != nil {
			return nil, nil, err
		}

		if v.FileInfo.IsInMemoryTable() {
			scope.ReplaceTemporaryTable(v)
		} else if v.FileInfo.IsFile() {
			scope.Tx.CachedViews.Set(v)
		}

		fileInfos = append(fileInfos, v.FileInfo)
		deletedCounts = append(deletedCounts, len(deletedIndices[k]))
	}

	return fileInfos, deletedCounts, nil
}

func CreateTable(ctx context.Context, scope *ReferenceScope, query parser.CreateTable) (*FileInfo, error) {
	queryScope := scope.CreateNode()
	defer queryScope.CloseCurrentNode()

	var view *View

	flags := queryScope.Tx.Flags
	fileInfo, err := NewFileInfoForCreate(query.Table, flags.Repository, flags.ExportOptions.Delimiter, flags.ExportOptions.Encoding)
	if err != nil {
		return nil, err
	}
	h, err := queryScope.Tx.FileContainer.CreateHandlerForCreate(fileInfo.Path)
	if err != nil {
		query.Table.Literal = fileInfo.Path
		return nil, ConvertFileHandlerError(err, query.Table)
	}
	fileInfo.Handler = h

	fileInfo.LineBreak = flags.ExportOptions.LineBreak
	fileInfo.EncloseAll = flags.ExportOptions.EncloseAll
	fileInfo.NoHeader = flags.ExportOptions.WithoutHeader
	fileInfo.PrettyPrint = flags.ExportOptions.PrettyPrint
	fileInfo.ForUpdate = true

	if query.Query != nil {
		view, err = Select(ctx, queryScope, query.Query.(parser.SelectQuery))
		if err != nil {
			return nil, appendCompositeError(err, queryScope.Tx.FileContainer.Close(fileInfo.Handler))
		}

		if err = view.Header.Update(FormatTableName(fileInfo.Path), query.Fields); err != nil {
			if _, ok := err.(*FieldLengthNotMatchError); ok {
				err = NewTableFieldLengthError(query.Query.(parser.SelectQuery), query.Table, len(query.Fields))
			}
			return nil, appendCompositeError(err, queryScope.Tx.FileContainer.Close(fileInfo.Handler))
		}
	} else {
		fields := make([]string, len(query.Fields))
		fieldsMap := make(map[string]bool, len(query.Fields))
		for i := range query.Fields {
			lit := query.Fields[i].(parser.Identifier).Literal
			ulit := strings.ToUpper(lit)
			if _, ok := fieldsMap[ulit]; ok {
				err = NewDuplicateFieldNameError(query.Fields[i].(parser.Identifier))
				return nil, appendCompositeError(err, queryScope.Tx.FileContainer.Close(fileInfo.Handler))
			}
			fields[i] = lit
			fieldsMap[ulit] = true
		}
		header := NewHeader(FormatTableName(fileInfo.Path), fields)
		view = &View{
			Header:    header,
			RecordSet: RecordSet{},
		}
	}

	view.FileInfo = fileInfo

	scope.Tx.CachedViews.Set(view)

	return view.FileInfo, nil
}

func AddColumns(ctx context.Context, scope *ReferenceScope, query parser.AddColumns) (*FileInfo, int, error) {
	queryScope := scope.CreateNode()
	defer queryScope.CloseCurrentNode()

	if query.Position == nil {
		query.Position = parser.ColumnPosition{
			Position: parser.Token{Token: parser.LAST, Literal: parser.TokenLiteral(parser.LAST)},
		}
	}

	queryScope.Tx.operationMutex.Lock()
	defer queryScope.Tx.operationMutex.Unlock()

	view, err := LoadViewFromTableIdentifier(ctx, queryScope, query.Table, true, false)
	if err != nil {
		return nil, 0, err
	}
	if !view.IsUpdatable() {
		return nil, 0, NewInlineTableCannotBeUpdatedError(query.Table)
	}

	var insertPos int
	pos, _ := query.Position.(parser.ColumnPosition)
	switch pos.Position.Token {
	case parser.FIRST:
		insertPos = 0
	case parser.LAST:
		insertPos = view.FieldLen()
	default:
		idx, err := view.FieldIndex(pos.Column)
		if err != nil {
			return nil, 0, err
		}
		switch pos.Position.Token {
		case parser.BEFORE:
			insertPos = idx
		default: //parser.AFTER
			insertPos = idx + 1
		}
	}

	newFieldLen := view.FieldLen() + len(query.Columns)
	columnNames := view.Header.TableColumnNames()
	columnNamesMap := make(map[string]bool, newFieldLen)
	for i := range columnNames {
		columnNamesMap[strings.ToUpper(columnNames[i])] = true
	}

	fields := make([]string, len(query.Columns))
	defaults := make([]parser.QueryExpression, len(query.Columns))
	for i, coldef := range query.Columns {
		ulit := strings.ToUpper(coldef.Column.Literal)
		if _, ok := columnNamesMap[ulit]; ok {
			return nil, 0, NewDuplicateFieldNameError(coldef.Column)
		}
		fields[i] = coldef.Column.Literal
		defaults[i] = coldef.Value
		columnNamesMap[ulit] = true
	}

	addHeader := NewHeader(FormatTableName(view.FileInfo.Path), fields)
	header := make(Header, newFieldLen)
	for i, v := range view.Header {
		var idx int
		if i < insertPos {
			idx = i
		} else {
			idx = i + len(fields)
		}
		header[idx] = v
	}
	for i, v := range addHeader {
		header[i+insertPos] = v
	}
	colNumber := 0
	for i := range header {
		colNumber++
		header[i].Number = colNumber
	}

	records := make(RecordSet, view.RecordLen())

	if err := EvaluateSequentially(ctx, queryScope, view, func(seqScope *ReferenceScope, rIdx int) error {
		record := make(Record, newFieldLen)
		for i, cell := range view.RecordSet[rIdx] {
			var cellIdx int
			if i < insertPos {
				cellIdx = i
			} else {
				cellIdx = i + len(fields)
			}
			record[cellIdx] = cell
		}

		for i, v := range defaults {
			if v == nil {
				v = parser.NewNullValue()
			}
			val, e := Evaluate(ctx, seqScope, v)
			if e != nil {
				return e
			}
			record[i+insertPos] = NewCell(val)
		}
		records[rIdx] = record
		return nil
	}); err != nil {
		return nil, 0, err
	}

	view.Header = header
	view.RecordSet = records

	if view.FileInfo.IsInMemoryTable() {
		scope.ReplaceTemporaryTable(view)
	} else if view.FileInfo.IsFile() {
		scope.Tx.CachedViews.Set(view)
	}

	return view.FileInfo, len(fields), err
}

func DropColumns(ctx context.Context, scope *ReferenceScope, query parser.DropColumns) (*FileInfo, int, error) {
	queryScope := scope.CreateNode()
	defer queryScope.CloseCurrentNode()

	queryScope.Tx.operationMutex.Lock()
	defer queryScope.Tx.operationMutex.Unlock()

	view, err := LoadViewFromTableIdentifier(ctx, queryScope, query.Table, true, false)
	if err != nil {
		return nil, 0, err
	}
	if !view.IsUpdatable() {
		return nil, 0, NewInlineTableCannotBeUpdatedError(query.Table)
	}

	dropIndices := NewUintPool(len(query.Columns), LimitToUseUintSlicePool)
	for _, v := range query.Columns {
		idx, err := view.FieldIndex(v)
		if err != nil {
			return nil, 0, err
		}
		if !dropIndices.Exists(uint(idx)) {
			dropIndices.Add(uint(idx))
		}
	}

	view.selectFields = []int{}
	for i := 0; i < view.FieldLen(); i++ {
		if view.Header[i].IsFromTable && !dropIndices.Exists(uint(i)) {
			view.selectFields = append(view.selectFields, i)
		}
	}

	if err = view.Fix(ctx, scope.Tx.Flags); err != nil {
		return nil, 0, err
	}

	if view.FileInfo.IsInMemoryTable() {
		scope.ReplaceTemporaryTable(view)
	} else if view.FileInfo.IsFile() {
		scope.Tx.CachedViews.Set(view)
	}

	return view.FileInfo, dropIndices.Len(), err

}

func RenameColumn(ctx context.Context, scope *ReferenceScope, query parser.RenameColumn) (*FileInfo, error) {
	queryScope := scope.CreateNode()
	defer queryScope.CloseCurrentNode()

	queryScope.Tx.operationMutex.Lock()
	defer queryScope.Tx.operationMutex.Unlock()

	view, err := LoadViewFromTableIdentifier(ctx, queryScope, query.Table, true, false)
	if err != nil {
		return nil, err
	}
	if !view.IsUpdatable() {
		return nil, NewInlineTableCannotBeUpdatedError(query.Table)
	}

	columnNames := view.Header.TableColumnNames()
	columnNamesMap := make(map[string]bool, len(columnNames))
	for i := range columnNames {
		columnNamesMap[strings.ToUpper(columnNames[i])] = true
	}
	if _, ok := columnNamesMap[strings.ToUpper(query.New.Literal)]; ok {
		return nil, NewDuplicateFieldNameError(query.New)
	}

	idx, err := view.FieldIndex(query.Old)
	if err != nil {
		return nil, err
	}

	view.Header[idx].Column = query.New.Literal

	if view.FileInfo.IsInMemoryTable() {
		scope.ReplaceTemporaryTable(view)
	} else if view.FileInfo.IsFile() {
		scope.Tx.CachedViews.Set(view)
	}

	return view.FileInfo, err
}

func SetTableAttribute(ctx context.Context, scope *ReferenceScope, query parser.SetTableAttribute) (*FileInfo, string, error) {
	var log string

	queryScope := scope.CreateNode()
	defer queryScope.CloseCurrentNode()

	queryScope.Tx.operationMutex.Lock()
	defer queryScope.Tx.operationMutex.Unlock()

	view, err := LoadViewFromTableIdentifier(ctx, queryScope, query.Table, true, false)
	if err != nil {
		return nil, log, err
	}
	if !view.FileInfo.IsFile() {
		return nil, log, NewNotTableError(query.Table)
	}

	var p value.Primary
	if ident, ok := query.Value.(parser.Identifier); ok {
		p = value.NewString(ident.Literal)
	} else {
		p, err = Evaluate(ctx, scope, query.Value)
		if err != nil {
			return nil, log, err
		}
	}

	fileInfo := view.FileInfo
	attr := strings.ToUpper(query.Attribute.Literal)
	switch attr {
	case TableDelimiter, TableDelimiterPositions, TableFormat, TableEncoding, TableLineBreak, TableJsonEscape:
		s := value.ToString(p)
		if value.IsNull(s) {
			return nil, log, NewTableAttributeValueNotAllowedFormatError(query)
		}
		switch attr {
		case TableDelimiter:
			err = fileInfo.SetDelimiter(s.(*value.String).Raw())
		case TableDelimiterPositions:
			err = fileInfo.SetDelimiterPositions(s.(*value.String).Raw())
		case TableFormat:
			err = fileInfo.SetFormat(s.(*value.String).Raw())
		case TableEncoding:
			err = fileInfo.SetEncoding(s.(*value.String).Raw())
		case TableLineBreak:
			err = fileInfo.SetLineBreak(s.(*value.String).Raw())
		case TableJsonEscape:
			err = fileInfo.SetJsonEscape(s.(*value.String).Raw())
		}
		value.Discard(s)
	case TableHeader, TableEncloseAll, TablePrettyPrint:
		b := value.ToBoolean(p)
		if value.IsNull(b) {
			return nil, log, NewTableAttributeValueNotAllowedFormatError(query)
		}
		switch attr {
		case TableHeader:
			err = fileInfo.SetNoHeader(!b.(*value.Boolean).Raw())
		case TableEncloseAll:
			err = fileInfo.SetEncloseAll(b.(*value.Boolean).Raw())
		case TablePrettyPrint:
			err = fileInfo.SetPrettyPrint(b.(*value.Boolean).Raw())
		}
	default:
		return nil, log, NewInvalidTableAttributeNameError(query.Attribute)
	}

	if err != nil {
		if _, ok := err.(*TableAttributeUnchangedError); ok {
			return nil, log, err
		}
		return nil, log, NewInvalidTableAttributeValueError(query, err.Error())
	}

	w := scope.Tx.CreateDocumentWriter()
	w.WriteColorWithoutLineBreak("Path: ", option.LableEffect)
	w.WriteColorWithoutLineBreak(fileInfo.Path, option.ObjectEffect)
	w.NewLine()
	writeTableAttribute(w, scope.Tx.Flags, fileInfo)
	w.NewLine()

	w.Title1 = "Attributes Updated in"
	if i, ok := query.Table.(parser.Identifier); ok {
		w.Title2 = i.Literal
	} else if to, ok := query.Table.(parser.FormatSpecifiedFunction); ok {
		if pi, ok := to.Path.(parser.Identifier); ok {
			w.Title2 = pi.Literal
		}
	}
	w.Title2Effect = option.IdentifierEffect
	log = "\n" + w.String() + "\n"

	scope.Tx.CachedViews.Set(view)
	return view.FileInfo, log, err
}
