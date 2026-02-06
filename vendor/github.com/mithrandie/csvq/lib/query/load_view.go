package query

import (
	"bytes"
	"context"
	gojson "encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"

	"github.com/mithrandie/csvq/lib/file"
	"github.com/mithrandie/csvq/lib/json"
	"github.com/mithrandie/csvq/lib/option"
	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"

	"github.com/mithrandie/go-text"
	"github.com/mithrandie/go-text/csv"
	"github.com/mithrandie/go-text/fixedlen"
	txjson "github.com/mithrandie/go-text/json"
	"github.com/mithrandie/go-text/jsonl"
	"github.com/mithrandie/go-text/ltsv"
)

const fileLoadingPreparedRecordSetCap = 300
const fileLoadingBuffer = 300

const inlineTablePrefix = "@__io__"

type RecordReader interface {
	Read() ([]text.RawText, error)
}

func isTableObjectAsDataObject(tablePath parser.QueryExpression) bool {
	_, ok := tablePath.(parser.Identifier)
	return !ok
}

func isTableObjectAsURL(tablePath parser.QueryExpression) bool {
	i, ok := tablePath.(parser.Identifier)
	if !ok {
		return false
	}

	return strings.HasPrefix(i.Literal, "http://") || strings.HasPrefix(i.Literal, "https://")
}

func LoadView(ctx context.Context, scope *ReferenceScope, tables []parser.QueryExpression, forUpdate bool, useInternalId bool) (*View, error) {
	if tables == nil {
		var obj parser.QueryExpression
		if scope.Tx.Session.CanReadStdin {
			obj = parser.Stdin{}
		} else {
			obj = parser.Dual{}
		}
		tables = []parser.QueryExpression{parser.Table{Object: obj}}
	}

	table := tables[0]

	for i := 1; i < len(tables); i++ {
		table = parser.Table{
			Object: parser.Join{
				Table:     table,
				JoinTable: tables[i],
				JoinType:  parser.Token{Token: parser.CROSS},
			},
		}
	}

	view, err := loadView(ctx, scope, table, forUpdate, useInternalId)
	return view, err
}

func LoadViewFromTableIdentifier(ctx context.Context, scope *ReferenceScope, table parser.QueryExpression, forUpdate bool, useInternalId bool) (*View, error) {
	tables := []parser.QueryExpression{
		parser.Table{Object: table},
	}

	return LoadView(ctx, scope, tables, forUpdate, useInternalId)
}

func loadView(ctx context.Context, scope *ReferenceScope, tableExpr parser.QueryExpression, forUpdate bool, useInternalId bool) (view *View, err error) {
	if parentheses, ok := tableExpr.(parser.Parentheses); ok {
		return loadView(ctx, scope, parentheses.Expr, forUpdate, useInternalId)
	}

	table := tableExpr.(parser.Table)
	tableName, err := ParseTableName(ctx, scope, table)
	if err != nil {
		return nil, err
	}

	switch table.Object.(type) {
	case parser.Dual:
		view = NewDualView()
	case parser.FormatSpecifiedFunction:
		formatSpecifiedFunction := table.Object.(parser.FormatSpecifiedFunction)
		tablePath := formatSpecifiedFunction.Path
		options := scope.Tx.Flags.ImportOptions.Copy()

		var felem value.Primary
		if formatSpecifiedFunction.FormatElement != nil {
			p, err := Evaluate(ctx, scope, formatSpecifiedFunction.FormatElement)
			if err != nil {
				return nil, err
			}
			felem = value.ToString(p)
		}

		isInlineObject := false
		switch formatSpecifiedFunction.Type.Token {
		case parser.CSV_INLINE, parser.JSON_INLINE, parser.JSON_TABLE:
			isInlineObject = true

			if isTableObjectAsDataObject(formatSpecifiedFunction.Path) {
				p, err := Evaluate(ctx, scope, formatSpecifiedFunction.Path)
				if err != nil {
					return nil, err
				}
				d := value.ToString(p)
				if value.IsNull(d) {
					return nil, NewEmptyInlineTableError(formatSpecifiedFunction)
				}
				tablePath = DataObject{BaseExpr: formatSpecifiedFunction.GetBaseExpr(), Raw: d.(*value.String).Raw()}
			} else if isTableObjectAsURL(formatSpecifiedFunction.Path) {
				tablePath = parser.Url{BaseExpr: formatSpecifiedFunction.GetBaseExpr(), Raw: formatSpecifiedFunction.Path.(parser.Identifier).Literal}
			}

			forUpdate = false

			switch formatSpecifiedFunction.Type.Token {
			case parser.CSV_INLINE:
				formatSpecifiedFunction.Type.Token = parser.CSV
			default: // JSON_INLINE, JSON_TABLE
				formatSpecifiedFunction.Type.Token = parser.JSON
			}
		}

		encodingIdx := 0
		noHeaderIdx := 1
		withoutNullIdx := 2

		switch formatSpecifiedFunction.Type.Token {
		case parser.CSV:
			if felem == nil {
				return nil, NewTableObjectInvalidArgumentError(formatSpecifiedFunction, "delimiter is not specified")
			}
			if value.IsNull(felem) {
				return nil, NewTableObjectInvalidDelimiterError(formatSpecifiedFunction, formatSpecifiedFunction.FormatElement.String())
			}
			s := felem.(*value.String).Raw()
			d := []rune(s)
			if 1 != len(d) {
				return nil, NewTableObjectInvalidDelimiterError(formatSpecifiedFunction, formatSpecifiedFunction.FormatElement.String())
			}
			if 3 < len(formatSpecifiedFunction.Args) {
				return nil, NewTableObjectArgumentsLengthError(formatSpecifiedFunction, 5)
			}
			options.Delimiter = d[0]
			if options.Delimiter == '\t' {
				options.Format = option.TSV
			} else {
				options.Format = option.CSV
			}
		case parser.FIXED:
			if felem == nil {
				return nil, NewTableObjectInvalidArgumentError(formatSpecifiedFunction, "delimiter positions are not specified")
			}
			if value.IsNull(felem) {
				return nil, NewTableObjectInvalidDelimiterPositionsError(formatSpecifiedFunction, formatSpecifiedFunction.FormatElement.String())
			}
			s := felem.(*value.String).Raw()

			var positions []int
			if !strings.EqualFold("SPACES", s) {
				if strings.HasPrefix(s, "s[") || strings.HasPrefix(s, "S[") {
					options.SingleLine = true
					s = s[1:]
				}
				err = gojson.Unmarshal([]byte(s), &positions)
				if err != nil {
					return nil, NewTableObjectInvalidDelimiterPositionsError(formatSpecifiedFunction, formatSpecifiedFunction.FormatElement.String())
				}
			}
			if 3 < len(formatSpecifiedFunction.Args) {
				return nil, NewTableObjectArgumentsLengthError(formatSpecifiedFunction, 5)
			}
			options.DelimiterPositions = positions
			options.Format = option.FIXED
		case parser.JSON, parser.JSONL:
			if felem == nil {
				return nil, NewTableObjectInvalidArgumentError(formatSpecifiedFunction, "json query is not specified")
			}
			if value.IsNull(felem) {
				return nil, NewTableObjectInvalidJsonQueryError(formatSpecifiedFunction, formatSpecifiedFunction.FormatElement.String())
			}
			if 0 < len(formatSpecifiedFunction.Args) {
				return nil, NewTableObjectJsonArgumentsLengthError(formatSpecifiedFunction, 2)
			}

			options.JsonQuery = felem.(*value.String).Raw()
			options.Encoding = text.UTF8
			if formatSpecifiedFunction.Type.Token == parser.JSONL {
				options.Format = option.JSONL
			} else {
				options.Format = option.JSON
			}
		case parser.LTSV:
			if 2 < len(formatSpecifiedFunction.Args) {
				return nil, NewTableObjectJsonArgumentsLengthError(formatSpecifiedFunction, 3)
			}
			options.Format = option.LTSV
			withoutNullIdx, noHeaderIdx = noHeaderIdx, withoutNullIdx
		default:
			return nil, NewInvalidTableObjectError(formatSpecifiedFunction, formatSpecifiedFunction.Type.Literal)
		}

		args := make([]value.Primary, 3)
		defer func() {
			for i := range args {
				if args[i] != nil {
					value.Discard(args[i])
				}
			}
		}()

		for i, a := range formatSpecifiedFunction.Args {
			if pt, ok := a.(parser.PrimitiveType); ok && value.IsNull(pt.Value) {
				continue
			}

			var p value.Primary = value.NewNull()
			if fr, ok := a.(parser.FieldReference); ok {
				if col, ok := fr.Column.(parser.Identifier); ok {
					a = parser.NewStringValue(col.Literal)
				} else {
					return nil, NewTableObjectInvalidArgumentError(formatSpecifiedFunction, fmt.Sprintf("cannot be converted as an argument: %s", formatSpecifiedFunction.Args[encodingIdx].String()))
				}
			}
			if pv, err := Evaluate(ctx, scope, a); err == nil {
				p = pv
			}

			switch i {
			case encodingIdx:
				v := value.ToString(p)
				if !value.IsNull(v) {
					args[i] = v
				} else {
					return nil, NewTableObjectInvalidArgumentError(formatSpecifiedFunction, fmt.Sprintf("cannot be converted as a encoding value: %s", formatSpecifiedFunction.Args[encodingIdx].String()))
				}
			case noHeaderIdx:
				v := value.ToBoolean(p)
				if !value.IsNull(v) {
					args[i] = v
				} else {
					return nil, NewTableObjectInvalidArgumentError(formatSpecifiedFunction, fmt.Sprintf("cannot be converted as a no-header value: %s", formatSpecifiedFunction.Args[noHeaderIdx].String()))
				}
			case withoutNullIdx:
				v := value.ToBoolean(p)
				if !value.IsNull(v) {
					args[i] = v
				} else {
					return nil, NewTableObjectInvalidArgumentError(formatSpecifiedFunction, fmt.Sprintf("cannot be converted as a without-null value: %s", formatSpecifiedFunction.Args[withoutNullIdx].String()))
				}
			}
		}

		if args[encodingIdx] != nil {
			if options.Encoding, err = option.ParseEncoding(args[0].(*value.String).Raw()); err != nil {
				return nil, NewTableObjectInvalidArgumentError(formatSpecifiedFunction, err.Error())
			}
		}
		if args[noHeaderIdx] != nil {
			options.NoHeader = args[noHeaderIdx].(*value.Boolean).Raw()
		}
		if args[withoutNullIdx] != nil {
			options.WithoutNull = args[withoutNullIdx].(*value.Boolean).Raw()
		}

		view, err = loadObject(
			ctx,
			scope,
			tablePath,
			tableName,
			forUpdate,
			useInternalId,
			isInlineObject,
			options,
		)
		if err != nil {
			return nil, err
		}

	case parser.Identifier, parser.Url, parser.TableFunction, parser.Stdin:
		options := scope.Tx.Flags.ImportOptions.Copy()
		options.Format = option.AutoSelect

		view, err = loadObject(
			ctx,
			scope,
			table.Object,
			tableName,
			forUpdate,
			useInternalId,
			false,
			options,
		)
		if err != nil {
			return nil, err
		}

	case parser.Join:
		join := table.Object.(parser.Join)
		view, err = loadView(ctx, scope, join.Table, forUpdate, useInternalId)
		if err != nil {
			return nil, err
		}

		if t, ok := join.JoinTable.(parser.Table); ok && !t.Lateral.IsEmpty() {
			switch join.Direction.Token {
			case parser.RIGHT, parser.FULL:
				return nil, NewIncorrectLateralUsageError(t)
			}

			joinTableName, err := ParseTableName(ctx, scope, t)
			if err != nil {
				return nil, err
			}

			subquery := t.Object.(parser.Subquery)
			var hfields Header
			resultSetList := make([]RecordSet, view.RecordLen())

			if err := EvaluateSequentially(ctx, scope, view, func(seqScope *ReferenceScope, rIdx int) error {
				appliedView, err := Select(ctx, seqScope, subquery.Query)
				if err != nil {
					return err
				}

				if 0 < len(joinTableName.Literal) {
					if err = appliedView.Header.Update(joinTableName.Literal, nil); err != nil {
						return err
					}
				}

				calcView := NewView()
				calcView.Header = view.Header.Copy()
				calcView.RecordSet = RecordSet{view.RecordSet[rIdx].Copy()}
				if err = joinViews(ctx, scope, calcView, appliedView, join); err != nil {
					return err
				}

				if rIdx == 0 {
					hfields = calcView.Header
				}
				resultSetList[rIdx] = calcView.RecordSet
				return nil
			}); err != nil {
				return nil, err
			}

			resultSet := make(RecordSet, 0, view.RecordLen())
			for i := range resultSetList {
				resultSet = append(resultSet, resultSetList[i]...)
			}

			view.Header = hfields
			view.RecordSet = resultSet
			view.FileInfo = nil

		} else {
			joinView, err := loadView(ctx, scope, join.JoinTable, forUpdate, useInternalId)
			if err != nil {
				return nil, err
			}

			if err = joinViews(ctx, scope, view, joinView, join); err != nil {
				return nil, err
			}
		}

	case parser.Subquery:
		subquery := table.Object.(parser.Subquery)
		view, err = Select(ctx, scope, subquery.Query)
		if err != nil {
			return nil, err
		}

		if 0 < len(tableName.Literal) {
			if err := scope.AddAlias(tableName, ""); err != nil {
				return nil, err
			}

			if err = view.Header.Update(tableName.Literal, nil); err != nil {
				return nil, err
			}
		}

		if view.FileInfo != nil {
			view.FileInfo.ViewType = ViewTypeInlineTable
		}
	}

	if view.FileInfo != nil && !(view.FileInfo.IsUpdatable() || view.FileInfo.IsRemoteObject()) {
		view.FileInfo.Path = ""
	}

	return view, err
}

func joinViews(ctx context.Context, scope *ReferenceScope, view *View, joinView *View, join parser.Join) error {
	condition, includeFields, excludeFields, err := ParseJoinCondition(join, view, joinView)
	if err != nil {
		return err
	}

	joinType := join.JoinType.Token
	if join.JoinType.IsEmpty() {
		if join.Direction.IsEmpty() {
			joinType = parser.INNER
		} else {
			joinType = parser.OUTER
		}
	}

	switch joinType {
	case parser.CROSS:
		if err = CrossJoin(ctx, scope, view, joinView); err != nil {
			return err
		}
	case parser.INNER:
		if err = InnerJoin(ctx, scope, view, joinView, condition); err != nil {
			return err
		}
	case parser.OUTER:
		if err = OuterJoin(ctx, scope, view, joinView, condition, join.Direction.Token); err != nil {
			return err
		}
	}

	if includeFields != nil {
		includeIndices := NewUintPool(len(includeFields), LimitToUseUintSlicePool)
		excludeIndices := NewUintPool(view.FieldLen()-len(includeFields), LimitToUseUintSlicePool)
		alternatives := make(map[int]int)

		for i := range includeFields {
			idx, _ := view.Header.SearchIndex(includeFields[i])
			includeIndices.Add(uint(idx))

			eidx, _ := view.Header.SearchIndex(excludeFields[i])
			excludeIndices.Add(uint(eidx))

			alternatives[idx] = eidx
		}

		fieldIndices := make([]int, 0, view.FieldLen()-excludeIndices.Len())
		header := make(Header, 0, view.FieldLen()-excludeIndices.Len())
		_ = includeIndices.Range(func(_ int, fidx uint) error {
			view.Header[fidx].View = ""
			view.Header[fidx].Number = 0
			view.Header[fidx].IsJoinColumn = true
			header = append(header, view.Header[fidx])
			fieldIndices = append(fieldIndices, int(fidx))
			return nil
		})
		for i := range view.Header {
			if excludeIndices.Exists(uint(i)) || includeIndices.Exists(uint(i)) {
				continue
			}
			header = append(header, view.Header[i])
			fieldIndices = append(fieldIndices, i)
		}
		view.Header = header
		fieldLen := len(fieldIndices)

		if err = NewGoroutineTaskManager(view.RecordLen(), -1, scope.Tx.Flags.CPU).Run(ctx, func(index int) error {
			record := make(Record, fieldLen)
			for i, idx := range fieldIndices {
				if includeIndices.Exists(uint(idx)) && value.IsNull(view.RecordSet[index][idx][0]) {
					record[i] = view.RecordSet[index][alternatives[idx]]
				} else {
					record[i] = view.RecordSet[index][idx]
				}
			}
			view.RecordSet[index] = record
			return nil
		}); err != nil {
			return err
		}
	}

	return nil
}

func loadObjectFromStdin(
	ctx context.Context,
	scope *ReferenceScope,
	stdin parser.Stdin,
	tableName parser.Identifier,
	forUpdate bool,
	useInternalId bool,
	options option.ImportOptions,
) (*View, error) {
	if options.Format == option.AutoSelect {
		options.Format = scope.Tx.Flags.ImportOptions.Format
	}

	fileInfo := NewStdinFileInfo(stdin.String(), options, scope.Tx.Flags.ExportOptions)

	scope.Tx.viewLoadingMutex.Lock()
	defer scope.Tx.viewLoadingMutex.Unlock()

	var err error
	view, ok := scope.Global().TemporaryTables.Load(stdin.String())
	if !ok || (forUpdate && !view.FileInfo.ForUpdate) {
		if forUpdate {
			if err = scope.Tx.LockStdinContext(ctx); err != nil {
				return nil, err
			}
		} else {
			if err = scope.Tx.RLockStdinContext(ctx); err != nil {
				return nil, err
			}
			defer scope.Tx.RUnlockStdin()
		}
		view, err = scope.Tx.Session.GetStdinView(ctx, scope.Tx.Flags, fileInfo, stdin)
		if err != nil {
			return nil, err
		}
		scope.Global().TemporaryTables.Set(view)
	}

	if useInternalId {
		if view, err = scope.Global().TemporaryTables.GetWithInternalId(ctx, stdin.String(), scope.Tx.Flags); err != nil {
			if err == errTableNotLoaded {
				err = NewUndeclaredTemporaryTableError(parser.Identifier{Literal: stdin.String()})
			}
			return nil, err
		}
	} else {
		if view, err = scope.Global().TemporaryTables.Get(stdin.String()); err != nil {
			if err == errTableNotLoaded {
				err = NewUndeclaredTemporaryTableError(parser.Identifier{Literal: stdin.String()})
			}
			return nil, err
		}
	}

	if err = scope.AddAlias(tableName, view.FileInfo.Path); err != nil {
		return nil, err
	}

	if !strings.EqualFold(stdin.String(), tableName.Literal) {
		if err = view.Header.Update(tableName.Literal, nil); err != nil {
			return nil, err
		}
	}

	return view, nil
}

func loadObjectFromString(
	ctx context.Context,
	scope *ReferenceScope,
	data string,
	tablePath parser.QueryExpression,
	tableName parser.Identifier,
	options option.ImportOptions,
) (*View, error) {
	fileInfo := NewInlineFileInfo(inlineTablePrefix+file.RandomString(12), options, scope.Tx.Flags.ExportOptions)

	r := strings.NewReader(data)
	view, err := loadViewFromFile(ctx, scope.Tx.Flags, r, fileInfo, options, tablePath)
	if err != nil {
		if _, ok := err.(Error); !ok {
			err = NewDataParsingError(tablePath, tablePath.String(), err.Error())
		}
		return nil, err
	}

	if 0 < len(tableName.Literal) {
		if err = scope.AddAlias(tableName, ""); err != nil {
			return nil, err
		}
		if err = view.Header.Update(tableName.Literal, nil); err != nil {
			return nil, err
		}
	}

	return view, nil
}

func loadDataObject(
	ctx context.Context,
	scope *ReferenceScope,
	dataObject DataObject,
	tablePath parser.QueryExpression,
	tableName parser.Identifier,
	options option.ImportOptions,
) (*View, error) {
	if options.Format == option.AutoSelect {
		options.Format = scope.Tx.Flags.ImportOptions.Format
	}

	view, err := loadObjectFromString(ctx, scope, dataObject.Raw, tablePath, tableName, options)
	if err == nil {
		view.FileInfo.ViewType = ViewTypeStringObject
	}
	return view, err
}

func loadHttpObject(
	ctx context.Context,
	scope *ReferenceScope,
	httpObject HttpObject,
	tablePath parser.QueryExpression,
	tableName parser.Identifier,
	options option.ImportOptions,
) (*View, error) {
	scope.Tx.viewLoadingMutex.Lock()

	urlResource, ok := scope.Tx.UrlCache[httpObject.URL]
	if !ok {
		res, err := http.Get(httpObject.URL)
		if err != nil {
			scope.Tx.viewLoadingMutex.Unlock()
			return nil, NewHttpRequestError(tablePath, httpObject.URL, err.Error())
		}
		if 400 <= res.StatusCode {
			scope.Tx.viewLoadingMutex.Unlock()
			return nil, NewHttpRequestError(tablePath, httpObject.URL, fmt.Sprintf("code %d, status %q", res.StatusCode, res.Status))
		}

		urlResource, err = NewUrlResource(res)
		if err != nil {
			scope.Tx.viewLoadingMutex.Unlock()
			return nil, err
		}
		scope.Tx.UrlCache[httpObject.URL] = urlResource
	}

	data := string(urlResource.Data)
	scope.Tx.viewLoadingMutex.Unlock()

	if options.Format == option.AutoSelect {
		switch urlResource.MimeType {
		case "text/csv":
			options.Format = option.CSV
		case "application/json":
			options.Format = option.JSON
		default:
			options.Format = scope.Tx.Flags.ImportOptions.Format
		}
	}

	view, err := loadObjectFromString(ctx, scope, data, tablePath, tableName, options)
	if err == nil {
		view.FileInfo.Path = httpObject.URL
		view.FileInfo.ViewType = ViewTypeRemoteObject
	}
	return view, err
}

func loadInlineObjectFromFile(
	ctx context.Context,
	scope *ReferenceScope,
	tableIdentifier parser.Identifier,
	tableName parser.Identifier,
	options option.ImportOptions,
) (view *View, err error) {
	scope.Tx.viewLoadingMutex.Lock()
	defer scope.Tx.viewLoadingMutex.Unlock()

	fileInfo, err := NewFileInfo(tableIdentifier, scope.Tx.Flags.Repository, options, scope.Tx.Flags.ImportOptions.Format)
	if err != nil {
		return
	}
	fileInfo.ViewType = ViewTypeInlineTable
	fileInfo.SetDefaultFileInfoAttributes(options, scope.Tx.Flags.ExportOptions)

	var fp *os.File

	cachedView, cacheExists := scope.Tx.CachedViews.Load(fileInfo.IdentifiedPath())

	if cacheExists {
		fp = cachedView.FileInfo.Handler.File()
	} else {
		h, e := scope.Tx.FileContainer.CreateHandlerForRead(ctx, fileInfo.Path, scope.Tx.WaitTimeout, scope.Tx.RetryDelay)
		if e != nil {
			tableIdentifier.Literal = fileInfo.Path
			err = ConvertFileHandlerError(e, tableIdentifier)
			return
		}
		defer func() {
			err = appendCompositeError(err, scope.Tx.FileContainer.Close(h))
		}()
		fp = h.File()
	}
	_, err = fp.Seek(0, io.SeekStart)
	if err != nil {
		return nil, NewIOError(tableIdentifier, err.Error())
	}

	view, err = loadViewFromFile(ctx, scope.Tx.Flags, fp, fileInfo, options, tableIdentifier)
	if err != nil {
		if _, ok := err.(Error); !ok {
			err = NewDataParsingError(tableIdentifier, fileInfo.Path, err.Error())
		}
		return
	}

	if 0 < len(tableName.Literal) {
		if err = scope.AddAlias(tableName, ""); err != nil {
			return
		}
		if err = view.Header.Update(tableName.Literal, nil); err != nil {
			return
		}
	}

	if !scope.FilePathExists(tableIdentifier.Literal) {
		scope.StoreFilePath(tableIdentifier.Literal, view.FileInfo.Path)
	}

	return
}

func loadObjectFromFile(
	ctx context.Context,
	scope *ReferenceScope,
	fileIdentifier parser.Identifier,
	tableName parser.Identifier,
	forUpdate bool,
	useInternalId bool,
	options option.ImportOptions,
) (view *View, err error) {
	filePath, err := cacheViewFromFile(
		ctx,
		scope,
		fileIdentifier,
		forUpdate,
		options,
	)
	if err != nil {
		return
	}

	if useInternalId {
		if view, err = scope.Tx.CachedViews.GetWithInternalId(ctx, strings.ToUpper(filePath), scope.Tx.Flags); err != nil {
			if err == errTableNotLoaded {
				err = NewTableNotLoadedError(parser.Identifier{BaseExpr: fileIdentifier.GetBaseExpr(), Literal: filePath})
			}
			return
		}
	} else {
		if view, err = scope.Tx.CachedViews.Get(strings.ToUpper(filePath)); err != nil {
			err = NewTableNotLoadedError(parser.Identifier{BaseExpr: fileIdentifier.GetBaseExpr(), Literal: filePath})
			return
		}
	}

	if 0 < len(tableName.Literal) {
		if err = scope.AddAlias(tableName, filePath); err != nil {
			return
		}
	}

	if !strings.EqualFold(FormatTableName(filePath), tableName.Literal) {
		if err = view.Header.Update(tableName.Literal, nil); err != nil {
			return
		}
	}

	return
}

func loadObject(
	ctx context.Context,
	scope *ReferenceScope,
	tablePath parser.QueryExpression,
	tableName parser.Identifier,
	forUpdate bool,
	useInternalId bool,
	isInlineObject bool,
	options option.ImportOptions,
) (*View, error) {
	if stdin, ok := tablePath.(parser.Stdin); ok {
		return loadObjectFromStdin(ctx, scope, stdin, tableName, forUpdate, useInternalId, options)
	}

	if !isInlineObject {
		if tableFunction, ok := tablePath.(parser.TableFunction); ok && strings.ToUpper(tableFunction.Name) == "INLINE" {
			isInlineObject = true
		}
	}

	originalTablePath := tablePath
	tablePath, err := NormalizeTableObject(ctx, scope, tablePath)
	if err != nil {
		return nil, err
	}

	if dataObject, ok := tablePath.(DataObject); ok {
		return loadDataObject(ctx, scope, dataObject, originalTablePath, tableName, options)
	}

	if httpObject, ok := tablePath.(HttpObject); ok {
		return loadHttpObject(ctx, scope, httpObject, originalTablePath, tableName, options)
	}

	fileIdentifier := tablePath.(parser.Identifier)

	if isInlineObject {
		return loadInlineObjectFromFile(ctx, scope, fileIdentifier, tableName, options)
	}

	if scope.RecursiveTable != nil && strings.EqualFold(fileIdentifier.Literal, scope.RecursiveTable.Name.Literal) && scope.RecursiveTmpView != nil {
		view := scope.RecursiveTmpView.Copy()
		if !strings.EqualFold(scope.RecursiveTable.Name.Literal, tableName.Literal) {
			if err := view.Header.Update(tableName.Literal, nil); err != nil {
				return nil, err
			}
		}
		return view, nil
	}

	if scope.InlineTableExists(fileIdentifier) {
		if err := scope.AddAlias(tableName, ""); err != nil {
			return nil, err
		}

		view, _ := scope.GetInlineTable(fileIdentifier)
		if !strings.EqualFold(fileIdentifier.Literal, tableName.Literal) {
			if err := view.Header.Update(tableName.Literal, nil); err != nil {
				return nil, err
			}
		}
		return view, nil
	}

	if scope.TemporaryTableExists(fileIdentifier.Literal) {
		var view *View = nil
		var err error

		if useInternalId {
			view, err = scope.GetTemporaryTableWithInternalId(ctx, fileIdentifier, scope.Tx.Flags)
		} else {
			view, err = scope.GetTemporaryTable(fileIdentifier)
		}
		if err != nil {
			return nil, err
		}

		if err := scope.AddAlias(tableName, fileIdentifier.Literal); err != nil {
			return nil, err
		}

		if !strings.EqualFold(FormatTableName(fileIdentifier.Literal), tableName.Literal) {
			if err := view.Header.Update(tableName.Literal, nil); err != nil {
				return nil, err
			}
		}

		return view, nil
	}

	return loadObjectFromFile(ctx, scope, fileIdentifier, tableName, forUpdate, useInternalId, options)
}

func cacheViewFromFile(
	ctx context.Context,
	scope *ReferenceScope,
	fileIdentifier parser.Identifier,
	forUpdate bool,
	options option.ImportOptions,
) (filePath string, err error) {
	scope.Tx.viewLoadingMutex.Lock()
	defer scope.Tx.viewLoadingMutex.Unlock()

	filePath, view, isCached, err := func() (string, *View, bool, error) {
		if p, ok := scope.LoadFilePath(fileIdentifier.Literal); ok {
			if v, ok := scope.Tx.CachedViews.Load(strings.ToUpper(p)); ok {
				return p, v, true, nil
			}
		}

		// Uncommitted newly created tables are not yet created as files, so they need to be checked if they are
		// registered in the cache with CreateFilePath(), instead of SearchFilePath().
		p, e := CreateFilePath(fileIdentifier, scope.Tx.Flags.Repository)
		if e != nil {
			return "", nil, false, NewIOError(fileIdentifier, err.Error())
		}
		if v, ok := scope.Tx.CachedViews.Load(strings.ToUpper(p)); ok {
			return p, v, true, nil
		}

		p, _, e = SearchFilePath(fileIdentifier, scope.Tx.Flags.Repository, options, scope.Tx.Flags.ImportOptions.Format)
		if e != nil {
			return "", nil, false, e
		}
		v, ok := scope.Tx.CachedViews.Load(strings.ToUpper(p))
		return p, v, ok, nil
	}()
	if err != nil {
		return
	}

	if !isCached || (forUpdate && !view.FileInfo.ForUpdate) {
		var fileInfo *FileInfo = nil
		if isCached {
			fileInfo = view.FileInfo
			if err = scope.Tx.CachedViews.Dispose(scope.Tx.FileContainer, fileInfo.IdentifiedPath()); err != nil {
				return
			}
		} else {
			fileInfo, err = NewFileInfo(fileIdentifier, scope.Tx.Flags.Repository, options, scope.Tx.Flags.ImportOptions.Format)
			if err != nil {
				return
			}
			fileInfo.SetDefaultFileInfoAttributes(options, scope.Tx.Flags.ExportOptions)
			filePath = fileInfo.Path
		}

		var fp *os.File

		if forUpdate {
			h, e := scope.Tx.FileContainer.CreateHandlerForUpdate(ctx, fileInfo.Path, scope.Tx.WaitTimeout, scope.Tx.RetryDelay)
			if e != nil {
				fileIdentifier.Literal = fileInfo.Path
				err = ConvertFileHandlerError(e, fileIdentifier)
				return
			}
			fileInfo.Handler = h
			fp = h.File()
		} else {
			h, e := scope.Tx.FileContainer.CreateHandlerForRead(ctx, fileInfo.Path, scope.Tx.WaitTimeout, scope.Tx.RetryDelay)
			if e != nil {
				fileIdentifier.Literal = fileInfo.Path
				err = ConvertFileHandlerError(e, fileIdentifier)
				return
			}
			defer func() {
				err = appendCompositeError(err, scope.Tx.FileContainer.Close(h))
			}()
			fp = h.File()
		}
		_, err = fp.Seek(0, io.SeekStart)
		if err != nil {
			return filePath, NewIOError(fileIdentifier, err.Error())
		}

		view, err = loadViewFromFile(ctx, scope.Tx.Flags, fp, fileInfo, options, fileIdentifier)
		if err != nil {
			if _, ok := err.(Error); !ok {
				err = NewDataParsingError(fileIdentifier, fileInfo.Path, err.Error())
			}
			if forUpdate {
				err = appendCompositeError(err, scope.Tx.FileContainer.Close(fileInfo.Handler))
			}
			return
		}
		view.FileInfo.ForUpdate = forUpdate
		scope.Tx.CachedViews.Set(view)
	}

	if !scope.FilePathExists(fileIdentifier.Literal) {
		scope.StoreFilePath(fileIdentifier.Literal, filePath)
	}

	return
}

func loadViewFromFile(ctx context.Context, flags *option.Flags, fp io.Reader, fileInfo *FileInfo, options option.ImportOptions, expr parser.QueryExpression) (*View, error) {
	fileReader, err := file.NewReader(fp, 2048)
	if err != nil {
		return nil, NewIOError(expr, err.Error())
	}

	switch fileInfo.Format {
	case option.FIXED:
		return loadViewFromFixedLengthTextFile(ctx, fileReader, fileInfo, options.WithoutNull, expr)
	case option.LTSV:
		return loadViewFromLTSVFile(ctx, flags, fileReader, fileInfo, options.WithoutNull, expr)
	case option.JSON:
		return loadViewFromJsonFile(fileReader, fileInfo, expr)
	case option.JSONL:
		return loadViewFromJsonLinesFile(ctx, flags, fileReader, fileInfo, expr)
	}
	return loadViewFromCSVFile(ctx, fileReader, fileInfo, options.AllowUnevenFields, options.WithoutNull, expr)
}

func loadViewFromFixedLengthTextFile(ctx context.Context, fp *file.Reader, fileInfo *FileInfo, withoutNull bool, expr parser.QueryExpression) (*View, error) {
	fileHead, err := fp.HeadBytes()
	if err != nil {
		return nil, NewIOError(expr, err.Error())
	}

	enc, err := text.DetectInSpecifiedEncoding(fileHead, fileInfo.Encoding)
	if err != nil {
		return nil, NewCannotDetectFileEncodingError(expr)
	}
	fileInfo.Encoding = enc

	var r io.Reader

	if fileInfo.DelimiterPositions == nil {
		data, err := io.ReadAll(fp)
		if err != nil {
			return nil, NewIOError(expr, err.Error())
		}
		br := bytes.NewReader(data)

		d, err := fixedlen.NewDelimiter(br, fileInfo.Encoding)
		if err != nil {
			return nil, err
		}
		d.NoHeader = fileInfo.NoHeader
		d.Encoding = fileInfo.Encoding
		fileInfo.DelimiterPositions, err = d.Delimit()
		if err != nil {
			return nil, err
		}

		if _, err = br.Seek(0, io.SeekStart); err != nil {
			return nil, NewIOError(expr, err.Error())
		}
		r = br
	} else {
		r = fp
	}

	reader, err := fixedlen.NewReader(r, fileInfo.DelimiterPositions, fileInfo.Encoding)
	if err != nil {
		return nil, err
	}
	reader.WithoutNull = withoutNull
	reader.Encoding = fileInfo.Encoding
	reader.SingleLine = fileInfo.SingleLine

	var header []string
	if !fileInfo.NoHeader && !fileInfo.SingleLine {
		header, err = reader.ReadHeader()
		if err != nil && err != io.EOF {
			return nil, err
		}
	}

	records, err := readRecordSet(ctx, reader, fp.Size())
	if err != nil {
		return nil, err
	}

	if header == nil {
		header = make([]string, len(fileInfo.DelimiterPositions))
		for i := 0; i < len(fileInfo.DelimiterPositions); i++ {
			header[i] = "c" + strconv.Itoa(i+1)
		}
	}

	if reader.DetectedLineBreak != "" {
		fileInfo.LineBreak = reader.DetectedLineBreak
	}

	view := NewView()
	view.Header = NewHeaderWithAutofill(FormatTableName(fileInfo.Path), header)
	view.RecordSet = records
	view.FileInfo = fileInfo
	return view, nil
}

func loadViewFromCSVFile(ctx context.Context, fp *file.Reader, fileInfo *FileInfo, allowUnevenFields bool, withoutNull bool, expr parser.QueryExpression) (*View, error) {
	if fileInfo.Format == option.TSV {
		fileInfo.Delimiter = '\t'
	}

	fileHead, err := fp.HeadBytes()
	if err != nil {
		return nil, NewIOError(expr, err.Error())
	}

	enc, err := text.DetectInSpecifiedEncoding(fileHead, fileInfo.Encoding)
	if err != nil {
		return nil, NewCannotDetectFileEncodingError(expr)
	}
	fileInfo.Encoding = enc

	reader, err := csv.NewReader(fp, fileInfo.Encoding)
	if err != nil {
		return nil, err
	}
	reader.Delimiter = fileInfo.Delimiter
	reader.WithoutNull = withoutNull
	reader.AllowUnevenFields = allowUnevenFields

	var header []string
	if !fileInfo.NoHeader {
		header, err = reader.ReadHeader()
		if err != nil && err != io.EOF {
			return nil, err
		}
	}

	records, err := readRecordSet(ctx, reader, fp.Size())
	if err != nil {
		return nil, err
	}

	if header == nil {
		header = make([]string, reader.FieldsPerRecord)
		for i := 0; i < reader.FieldsPerRecord; i++ {
			header[i] = "c" + strconv.Itoa(i+1)
		}
	}

	if reader.DetectedLineBreak != "" {
		fileInfo.LineBreak = reader.DetectedLineBreak
	}
	fileInfo.EncloseAll = reader.EnclosedAll

	view := NewView()

	if allowUnevenFields {
		if len(header) < reader.FieldsPerRecord {
			header = append(header, make([]string, reader.FieldsPerRecord-len(header))...)
		}
		view.Header = NewHeaderWithAutofill(FormatTableName(fileInfo.Path), header)

		for i := range records {
			if reader.FieldsPerRecord <= len(records[i]) {
				continue
			}

			filling := make([]Cell, reader.FieldsPerRecord-len(records[i]))
			for j := range filling {
				if withoutNull {
					filling[j] = NewCell(value.NewString(""))
				} else {
					filling[j] = NewCell(value.NewNull())
				}
			}

			records[i] = append(records[i], filling...)
		}
	} else {
		view.Header = NewHeader(FormatTableName(fileInfo.Path), header)
	}

	view.RecordSet = records
	view.FileInfo = fileInfo
	return view, nil
}

func loadViewFromLTSVFile(ctx context.Context, flags *option.Flags, fp *file.Reader, fileInfo *FileInfo, withoutNull bool, expr parser.QueryExpression) (*View, error) {
	fileHead, err := fp.HeadBytes()
	if err != nil {
		return nil, NewIOError(expr, err.Error())
	}

	enc, err := text.DetectInSpecifiedEncoding(fileHead, fileInfo.Encoding)
	if err != nil {
		return nil, NewCannotDetectFileEncodingError(expr)
	}
	fileInfo.Encoding = enc

	reader, err := ltsv.NewReader(fp, fileInfo.Encoding)
	if err != nil {
		return nil, NewIOError(expr, err.Error())
	}
	reader.WithoutNull = withoutNull

	records, err := readRecordSet(ctx, reader, fp.Size())
	if err != nil {
		return nil, err
	}

	header := reader.Header.Fields()
	if err = NewGoroutineTaskManager(len(records), -1, flags.CPU).Run(ctx, func(index int) error {
		for j := len(records[index]); j < len(header); j++ {
			if withoutNull {
				records[index] = append(records[index], NewCell(value.NewString("")))
			} else {
				records[index] = append(records[index], NewCell(value.NewNull()))
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}

	if reader.DetectedLineBreak != "" {
		fileInfo.LineBreak = reader.DetectedLineBreak
	}

	view := NewView()
	view.Header = NewHeader(FormatTableName(fileInfo.Path), header)
	view.RecordSet = records
	view.FileInfo = fileInfo
	return view, nil
}

func readRecordSet(ctx context.Context, reader RecordReader, fileSize int64) (RecordSet, error) {
	var err error
	recordSet := make(RecordSet, 0, fileLoadingPreparedRecordSetCap)
	rowch := make(chan []text.RawText, fileLoadingBuffer)
	panicCh := make(chan bool, 1)
	pos := 0

	wg := sync.WaitGroup{}

	wg.Add(1)
	go func() {
		defer func() {
			if err == nil {
				if panicReport := recover(); panicReport != nil {
					err = NewFatalError(panicReport)
				}
			}
			panicCh <- true
			wg.Done()
		}()

		for {
			row, ok := <-rowch
			if !ok {
				break
			}

			record := make(Record, len(row))
			for i, v := range row {
				if v == nil {
					record[i] = NewCell(value.NewNull())
				} else {
					record[i] = NewCell(value.NewString(string(v)))
				}
			}

			if 0 < fileSize && 0 < pos && len(recordSet) == fileLoadingPreparedRecordSetCap && int64(pos) < fileSize {
				l := int((float64(fileSize) / float64(pos)) * fileLoadingPreparedRecordSetCap * 1.2)
				newSet := make(RecordSet, fileLoadingPreparedRecordSetCap, l)
				copy(newSet, recordSet)
				recordSet = newSet
			}

			recordSet = append(recordSet, record)
		}
	}()

	wg.Add(1)
	go func() {
		panicOccurred := false

		defer func() {
			if err == nil && !panicOccurred {
				if panicReport := recover(); panicReport != nil {
					err = NewFatalError(panicReport)
				}
			}
			close(rowch)
			wg.Done()
		}()

		i := 0

		for {
			if i&15 == 0 && ctx.Err() != nil {
				err = ConvertContextError(ctx.Err())
				break
			}

			row, e := reader.Read()
			if e == io.EOF {
				break
			}
			if e != nil {
				err = e
				break
			}

			if 0 < fileSize && i < fileLoadingPreparedRecordSetCap {
				for j := range row {
					pos += len(row[j])
				}
			}

			select {
			case _ = <-panicCh:
				panicOccurred = true
			case rowch <- row:
				// Row data sent.
			}

			if panicOccurred {
				break
			}
			i++
		}
	}()

	wg.Wait()
	close(panicCh)

	return recordSet, err
}

func loadViewFromJsonFile(fp *file.Reader, fileInfo *FileInfo, expr parser.QueryExpression) (*View, error) {
	jsonText, err := io.ReadAll(fp)
	if err != nil {
		return nil, NewIOError(expr, err.Error())
	}

	headerLabels, rows, escapeType, err := json.LoadTable(fileInfo.JsonQuery, string(jsonText))
	if err != nil {
		return nil, NewLoadJsonError(expr, err.Error())
	}

	records := make(RecordSet, len(rows))
	for i := range rows {
		records[i] = NewRecord(rows[i])
	}

	fileInfo.Encoding = text.UTF8
	fileInfo.JsonEscape = escapeType

	view := NewView()
	view.Header = NewHeader(FormatTableName(fileInfo.Path), headerLabels)
	view.RecordSet = records
	view.FileInfo = fileInfo
	return view, nil
}

func loadViewFromJsonLinesFile(ctx context.Context, flags *option.Flags, fp *file.Reader, fileInfo *FileInfo, expr parser.QueryExpression) (*View, error) {
	var err error
	headerList := make([]string, 0, 32)
	headerMap := make(map[string]bool, 32)
	objectList := make([]txjson.Object, 0, fileLoadingPreparedRecordSetCap)

	escapeType := txjson.Backslash
	fileSize := fp.Size()
	jsonQuery, err := json.Query.Parse(fileInfo.JsonQuery)
	if err != nil {
		return nil, NewLoadJsonError(expr, err.Error())
	}

	rowch := make(chan txjson.Object, fileLoadingBuffer)
	panicCh := make(chan bool, 1)
	pos := 0

	reader := jsonl.NewReader(fp)
	reader.SetUseInteger(false)

	wg := sync.WaitGroup{}

	wg.Add(1)
	go func() {
		defer func() {
			if err == nil {
				if panicReport := recover(); panicReport != nil {
					err = NewFatalError(panicReport)
				}
			}
			panicCh <- true
			wg.Done()
		}()

		for {
			row, ok := <-rowch
			if !ok {
				break
			}

			for _, v := range row.Keys() {
				if _, ok := headerMap[v]; !ok {
					headerMap[v] = true
					headerList = append(headerList, v)
				}
			}

			if 0 < fileSize && 0 < pos && len(objectList) == fileLoadingPreparedRecordSetCap && int64(pos) < fileSize {
				l := int((float64(fileSize) / float64(pos)) * fileLoadingPreparedRecordSetCap * 1.2)
				newSet := make([]txjson.Object, fileLoadingPreparedRecordSetCap, l)
				copy(newSet, objectList)
				objectList = newSet
			}

			objectList = append(objectList, row)
		}
	}()

	wg.Add(1)
	go func() {
		panicOccurred := false

		defer func() {
			if err == nil && !panicOccurred {
				if panicReport := recover(); panicReport != nil {
					err = NewFatalError(panicReport)
				}
			}
			close(rowch)
			wg.Done()
		}()

		i := 0
		for {
			if i&15 == 0 && ctx.Err() != nil {
				err = ConvertContextError(ctx.Err())
				break
			}

			row, et, e := reader.Read()
			if e == io.EOF {
				break
			}
			if e != nil {
				err = e
				break
			}

			rowObj, ok := row.(txjson.Object)
			if !ok {
				err = NewJsonLinesStructureError(expr)
				break
			}

			if jsonQuery != nil {
				jstruct, e := json.Extract(jsonQuery, rowObj)
				if e != nil {
					err = e
					break
				}
				jarray, ok := jstruct.(txjson.Array)
				if !ok || len(jarray) < 1 {
					err = NewJsonLinesStructureError(expr)
					break
				}
				rowObj, ok = jarray[0].(txjson.Object)
				if !ok {
					err = NewJsonLinesStructureError(expr)
					break
				}
			}

			if escapeType < et {
				escapeType = et
			}

			if 0 < fileSize && i < fileLoadingPreparedRecordSetCap {
				pos = reader.Pos()
			}

			select {
			case _ = <-panicCh:
				panicOccurred = true
			case rowch <- rowObj:
				// Row data sent.
			}

			if panicOccurred {
				break
			}
			i++
		}
	}()

	wg.Wait()
	close(panicCh)

	if err != nil {
		return nil, err
	}

	recordSet := make(RecordSet, len(objectList))

	if err = NewGoroutineTaskManager(len(objectList), -1, flags.CPU).Run(ctx, func(index int) error {
		values := make([]value.Primary, len(headerList))

		for i, v := range headerList {
			if objectList[index].Exists(v) {
				values[i] = json.ConvertToValue(objectList[index].Value(v))
			} else {
				values[i] = value.NewNull()
			}
		}

		recordSet[index] = NewRecord(values)
		return nil
	}); err != nil {
		return nil, err
	}

	fileInfo.Encoding = text.UTF8
	fileInfo.JsonEscape = escapeType

	view := NewView()
	view.Header = NewHeader(FormatTableName(fileInfo.Path), headerList)
	view.RecordSet = recordSet
	view.FileInfo = fileInfo
	return view, nil
}
