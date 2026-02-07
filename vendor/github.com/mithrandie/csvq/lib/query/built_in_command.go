package query

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/mithrandie/csvq/lib/doc"
	"github.com/mithrandie/csvq/lib/file"
	"github.com/mithrandie/csvq/lib/option"
	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/syntax"
	"github.com/mithrandie/csvq/lib/value"

	"github.com/mithrandie/go-text"
	"github.com/mithrandie/go-text/color"
	"github.com/mithrandie/ternary"
)

type ObjectStatus int

const (
	ObjectFixed ObjectStatus = iota
	ObjectCreated
	ObjectUpdated
	ReadOnly
)

const IgnoredFlagPrefix = "(ignored) "

const (
	ReloadConfig = "CONFIG"
)

const (
	ShowTables     = "TABLES"
	ShowViews      = "VIEWS"
	ShowCursors    = "CURSORS"
	ShowFunctions  = "FUNCTIONS"
	ShowStatements = "STATEMENTS"
	ShowFlags      = "FLAGS"
	ShowEnv        = "ENV"
	ShowRuninfo    = "RUNINFO"
)

var ShowObjectList = []string{
	ShowTables,
	ShowViews,
	ShowCursors,
	ShowFunctions,
	ShowStatements,
	ShowFlags,
	ShowEnv,
	ShowRuninfo,
}

func Echo(ctx context.Context, scope *ReferenceScope, expr parser.Echo) (string, error) {
	p, err := Evaluate(ctx, scope, expr.Value)
	if err != nil {
		return "", err
	}

	return NewStringFormatter().Format("%s", []value.Primary{p})
}

func Print(ctx context.Context, scope *ReferenceScope, expr parser.Print) (string, error) {
	p, err := Evaluate(ctx, scope, expr.Value)
	if err != nil {
		return "", err
	}
	return p.String(), err
}

func Printf(ctx context.Context, scope *ReferenceScope, expr parser.Printf) (string, error) {
	var format string
	formatValue, err := Evaluate(ctx, scope, expr.Format)
	if err != nil {
		return "", err
	}
	formatString := value.ToString(formatValue)
	if !value.IsNull(formatString) {
		format = formatString.(*value.String).Raw()
		value.Discard(formatString)
	}

	args := make([]value.Primary, len(expr.Values))
	for i, v := range expr.Values {
		p, err := Evaluate(ctx, scope, v)
		if err != nil {
			return "", err
		}
		args[i] = p
	}

	message, err := NewStringFormatter().Format(format, args)
	if err != nil {
		return "", NewReplaceValueLengthError(expr, err.(Error).Message())
	}
	return message, nil
}

func Source(ctx context.Context, scope *ReferenceScope, expr parser.Source) ([]parser.Statement, error) {
	var fpath string

	if ident, ok := expr.FilePath.(parser.Identifier); ok {
		fpath = ident.Literal
	} else {
		p, err := Evaluate(ctx, scope, expr.FilePath)
		if err != nil {
			return nil, err
		}
		s := value.ToString(p)
		if value.IsNull(s) {
			return nil, NewSourceInvalidFilePathError(expr, expr.FilePath)
		}
		fpath = s.(*value.String).Raw()
		value.Discard(s)
	}

	if len(fpath) < 1 {
		return nil, NewSourceInvalidFilePathError(expr, expr.FilePath)
	}

	return LoadStatementsFromFile(ctx, scope.Tx, parser.Identifier{BaseExpr: expr.BaseExpr, Literal: fpath})
}

func LoadContentsFromFile(ctx context.Context, tx *Transaction, fpath parser.Identifier) (content string, err error) {
	p := fpath.Literal
	if !filepath.IsAbs(p) {
		if abs, err := filepath.Abs(p); err == nil {
			p = abs
		}
	}

	if !file.Exists(p) {
		return content, NewFileNotExistError(fpath)
	}

	h, err := tx.FileContainer.CreateHandlerWithoutLock(ctx, p, tx.WaitTimeout, tx.RetryDelay)
	if err != nil {
		return content, ConvertFileHandlerError(err, fpath)
	}
	defer func() {
		err = appendCompositeError(err, tx.FileContainer.Close(h))
	}()

	buf, err := io.ReadAll(h.File())
	if err != nil {
		return content, ConvertFileHandlerError(err, fpath)
	}
	return string(buf), nil
}

func LoadStatementsFromFile(ctx context.Context, tx *Transaction, fpath parser.Identifier) (statements []parser.Statement, err error) {
	content, err := LoadContentsFromFile(ctx, tx, fpath)
	if err != nil {
		return nil, err
	}

	statements, _, err = parser.Parse(content, fpath.Literal, false, tx.Flags.AnsiQuotes)
	if err != nil {
		err = NewSyntaxError(err.(*parser.SyntaxError))
	}
	return statements, err
}

func ParseExecuteStatements(ctx context.Context, scope *ReferenceScope, expr parser.Execute) ([]parser.Statement, error) {
	var input string
	stmt, err := Evaluate(ctx, scope, expr.Statements)
	if err != nil {
		return nil, err
	}
	stmtStr := value.ToString(stmt)
	if !value.IsNull(stmtStr) {
		input = stmt.(*value.String).Raw()
		value.Discard(stmtStr)
	}

	args := make([]value.Primary, len(expr.Values))
	for i, v := range expr.Values {
		p, err := Evaluate(ctx, scope, v)
		if err != nil {
			return nil, err
		}
		args[i] = p
	}

	input, err = NewStringFormatter().Format(input, args)
	if err != nil {
		return nil, NewReplaceValueLengthError(expr, err.(Error).Message())
	}
	statements, _, err := parser.Parse(input, fmt.Sprintf("(L:%d C:%d) EXECUTE", expr.Line(), expr.Char()), false, scope.Tx.Flags.AnsiQuotes)
	if err != nil {
		err = NewSyntaxError(err.(*parser.SyntaxError))
	}
	return statements, err
}

func SetFlag(ctx context.Context, scope *ReferenceScope, expr parser.SetFlag) error {
	var val interface{}
	var v value.Primary
	var p value.Primary
	var err error

	if ident, ok := expr.Value.(parser.Identifier); ok {
		v = value.NewString(ident.Literal)
	} else {
		v, err = Evaluate(ctx, scope, expr.Value)
		if err != nil {
			return err
		}
	}

	switch strings.ToUpper(expr.Flag.Name) {
	case option.RepositoryFlag, option.TimezoneFlag, option.DatetimeFormatFlag,
		option.ImportFormatFlag, option.DelimiterFlag, option.DelimiterPositionsFlag, option.JsonQueryFlag, option.EncodingFlag,
		option.ExportEncodingFlag, option.FormatFlag, option.ExportDelimiterFlag, option.ExportDelimiterPositionsFlag,
		option.LineBreakFlag, option.JsonEscapeFlag:
		p = value.ToString(v)
		if value.IsNull(p) {
			return NewFlagValueNotAllowedFormatError(expr)
		}
		val = p.(*value.String).Raw()
	case option.AnsiQuotesFlag, option.StrictEqualFlag, option.AllowUnevenFieldsFlag,
		option.NoHeaderFlag, option.WithoutNullFlag, option.WithoutHeaderFlag, option.EncloseAllFlag,
		option.PrettyPrintFlag, option.ScientificNotationFlag, option.StripEndingLineBreakFlag,
		option.EastAsianEncodingFlag, option.CountDiacriticalSignFlag, option.CountFormatCodeFlag, option.ColorFlag,
		option.QuietFlag, option.StatsFlag:
		p = value.ToBoolean(v)
		if value.IsNull(p) {
			return NewFlagValueNotAllowedFormatError(expr)
		}
		val = p.(*value.Boolean).Raw()
	case option.WaitTimeoutFlag:
		p = value.ToFloat(v)
		if value.IsNull(p) {
			return NewFlagValueNotAllowedFormatError(expr)
		}
		val = p.(*value.Float).Raw()
	case option.LimitRecursion, option.CPUFlag:
		p = value.ToInteger(v)
		if value.IsNull(p) {
			return NewFlagValueNotAllowedFormatError(expr)
		}
		val = p.(*value.Integer).Raw()
	default:
		return NewInvalidFlagNameError(expr.Flag)
	}

	value.Discard(p)

	if err = scope.Tx.SetFlag(expr.Flag.Name, val); err != nil {
		return NewInvalidFlagValueError(expr, err.Error())
	}
	return nil
}

func AddFlagElement(ctx context.Context, scope *ReferenceScope, expr parser.AddFlagElement) error {
	switch strings.ToUpper(expr.Flag.Name) {
	case option.DatetimeFormatFlag:
		e := parser.SetFlag{
			BaseExpr: expr.GetBaseExpr(),
			Flag:     expr.Flag,
			Value:    expr.Value,
		}
		return SetFlag(ctx, scope, e)
	case option.RepositoryFlag, option.TimezoneFlag, option.AnsiQuotesFlag, option.StrictEqualFlag,
		option.ImportFormatFlag, option.DelimiterFlag, option.AllowUnevenFieldsFlag, option.DelimiterPositionsFlag,
		option.JsonQueryFlag, option.EncodingFlag,
		option.ExportEncodingFlag, option.FormatFlag, option.ExportDelimiterFlag, option.ExportDelimiterPositionsFlag,
		option.LineBreakFlag, option.JsonEscapeFlag, option.NoHeaderFlag, option.WithoutNullFlag, option.WithoutHeaderFlag,
		option.EncloseAllFlag, option.PrettyPrintFlag, option.ScientificNotationFlag, option.StripEndingLineBreakFlag,
		option.EastAsianEncodingFlag, option.CountDiacriticalSignFlag, option.CountFormatCodeFlag, option.ColorFlag,
		option.QuietFlag, option.StatsFlag,
		option.WaitTimeoutFlag,
		option.LimitRecursion, option.CPUFlag:

		return NewAddFlagNotSupportedNameError(expr)
	default:
		return NewInvalidFlagNameError(expr.Flag)
	}
}

func RemoveFlagElement(ctx context.Context, scope *ReferenceScope, expr parser.RemoveFlagElement) error {
	p, err := Evaluate(ctx, scope, expr.Value)
	if err != nil {
		return err
	}

	scope.Tx.operationMutex.Lock()
	defer scope.Tx.operationMutex.Unlock()

	switch strings.ToUpper(expr.Flag.Name) {
	case option.DatetimeFormatFlag:
		if i := value.ToInteger(p); !value.IsNull(i) {
			idx := int(i.(*value.Integer).Raw())
			value.Discard(i)

			if -1 < idx && idx < len(scope.Tx.Flags.DatetimeFormat) {
				scope.Tx.Flags.DatetimeFormat = append(scope.Tx.Flags.DatetimeFormat[:idx], scope.Tx.Flags.DatetimeFormat[idx+1:]...)
			}
		} else if s := value.ToString(p); !value.IsNull(s) {
			val := s.(*value.String).Raw()
			value.Discard(s)

			formats := make([]string, 0, len(scope.Tx.Flags.DatetimeFormat))
			for _, v := range scope.Tx.Flags.DatetimeFormat {
				if val != v {
					formats = append(formats, v)
				}
			}
			scope.Tx.Flags.DatetimeFormat = formats
		} else {
			return NewInvalidFlagValueToBeRemovedError(expr)
		}
	case option.RepositoryFlag, option.TimezoneFlag, option.AnsiQuotesFlag, option.StrictEqualFlag,
		option.ImportFormatFlag, option.DelimiterFlag, option.AllowUnevenFieldsFlag, option.DelimiterPositionsFlag,
		option.JsonQueryFlag, option.EncodingFlag,
		option.ExportEncodingFlag, option.FormatFlag, option.ExportDelimiterFlag, option.ExportDelimiterPositionsFlag,
		option.LineBreakFlag, option.JsonEscapeFlag, option.NoHeaderFlag, option.WithoutNullFlag, option.WithoutHeaderFlag,
		option.EncloseAllFlag, option.PrettyPrintFlag, option.ScientificNotationFlag, option.StripEndingLineBreakFlag,
		option.EastAsianEncodingFlag, option.CountDiacriticalSignFlag, option.CountFormatCodeFlag, option.ColorFlag,
		option.QuietFlag, option.StatsFlag,
		option.WaitTimeoutFlag,
		option.LimitRecursion, option.CPUFlag:

		return NewRemoveFlagNotSupportedNameError(expr)
	default:
		return NewInvalidFlagNameError(expr.Flag)
	}

	return nil
}

func ShowFlag(tx *Transaction, expr parser.ShowFlag) (string, error) {
	s, ok := showFlag(tx, expr.Flag.Name)
	if !ok {
		return s, NewInvalidFlagNameError(expr.Flag)
	}

	return tx.Palette.Render(option.LableEffect, option.FlagSymbol(strings.ToUpper(expr.Flag.Name))+":") + " " + s, nil
}

func showFlag(tx *Transaction, flagName string) (string, bool) {
	val, ok := tx.GetFlag(flagName)
	if !ok {
		return "", ok
	}

	var s string

	switch strings.ToUpper(flagName) {
	case option.RepositoryFlag:
		p := val.(*value.String)
		if len(p.Raw()) < 1 {
			wd, _ := os.Getwd()
			s = tx.Palette.Render(option.NullEffect, fmt.Sprintf("(current dir: %s)", wd))
		} else {
			s = tx.Palette.Render(option.StringEffect, p.Raw())
		}
	case option.DatetimeFormatFlag:
		p := val.(*value.String)
		if len(p.Raw()) < 1 {
			s = tx.Palette.Render(option.NullEffect, "(not set)")
		} else {
			s = tx.Palette.Render(option.StringEffect, p.Raw())
		}
	case option.JsonQueryFlag:
		p := val.(*value.String)
		if len(p.Raw()) < 1 {
			s = tx.Palette.Render(option.NullEffect, "(empty)")
		} else {
			s = tx.Palette.Render(option.StringEffect, p.Raw())
		}
	case option.ExportEncodingFlag:
		switch tx.Flags.ExportOptions.Format {
		case option.JSON, option.JSONL:
			s = tx.Palette.Render(option.NullEffect, IgnoredFlagPrefix+val.(*value.String).Raw())
		default:
			s = tx.Palette.Render(option.StringEffect, val.(*value.String).Raw())
		}
	case option.ExportDelimiterFlag:
		switch tx.Flags.ExportOptions.Format {
		case option.CSV:
			s = tx.Palette.Render(option.StringEffect, val.(*value.String).String())
		default:
			s = tx.Palette.Render(option.NullEffect, IgnoredFlagPrefix+val.(*value.String).String())
		}
	case option.ExportDelimiterPositionsFlag:
		switch tx.Flags.ExportOptions.Format {
		case option.FIXED:
			s = tx.Palette.Render(option.StringEffect, val.(*value.String).Raw())
		default:
			s = tx.Palette.Render(option.NullEffect, IgnoredFlagPrefix+val.(*value.String).Raw())
		}
	case option.WithoutHeaderFlag:
		switch tx.Flags.ExportOptions.Format {
		case option.CSV, option.TSV, option.FIXED, option.GFM, option.ORG:
			if tx.Flags.ExportOptions.Format == option.FIXED && tx.Flags.ExportOptions.SingleLine {
				s = tx.Palette.Render(option.NullEffect, IgnoredFlagPrefix+val.(*value.Boolean).String())
			} else {
				s = tx.Palette.Render(option.BooleanEffect, val.(*value.Boolean).String())
			}
		default:
			s = tx.Palette.Render(option.NullEffect, IgnoredFlagPrefix+val.(*value.Boolean).String())
		}
	case option.LineBreakFlag:
		if tx.Flags.ExportOptions.Format == option.FIXED && tx.Flags.ExportOptions.SingleLine {
			s = tx.Palette.Render(option.NullEffect, IgnoredFlagPrefix+val.(*value.String).Raw())
		} else {
			s = tx.Palette.Render(option.StringEffect, val.(*value.String).Raw())
		}
	case option.EncloseAllFlag:
		switch tx.Flags.ExportOptions.Format {
		case option.CSV, option.TSV:
			s = tx.Palette.Render(option.BooleanEffect, val.(*value.Boolean).String())
		default:
			s = tx.Palette.Render(option.NullEffect, IgnoredFlagPrefix+val.(*value.Boolean).String())
		}
	case option.JsonEscapeFlag:
		switch tx.Flags.ExportOptions.Format {
		case option.JSON, option.JSONL:
			s = tx.Palette.Render(option.StringEffect, val.(*value.String).Raw())
		default:
			s = tx.Palette.Render(option.NullEffect, IgnoredFlagPrefix+val.(*value.String).Raw())
		}
	case option.PrettyPrintFlag:
		switch tx.Flags.ExportOptions.Format {
		case option.JSON, option.JSONL:
			s = tx.Palette.Render(option.BooleanEffect, val.(*value.Boolean).String())
		default:
			s = tx.Palette.Render(option.NullEffect, IgnoredFlagPrefix+val.(*value.Boolean).String())
		}
	case option.EastAsianEncodingFlag, option.CountDiacriticalSignFlag, option.CountFormatCodeFlag:
		switch tx.Flags.ExportOptions.Format {
		case option.GFM, option.ORG, option.BOX, option.TEXT:
			s = tx.Palette.Render(option.BooleanEffect, val.(*value.Boolean).String())
		default:
			s = tx.Palette.Render(option.NullEffect, IgnoredFlagPrefix+val.(*value.Boolean).String())
		}
	case option.DelimiterFlag:
		s = tx.Palette.Render(option.StringEffect, val.(*value.String).String())
	case option.TimezoneFlag, option.ImportFormatFlag, option.DelimiterPositionsFlag, option.EncodingFlag, option.FormatFlag:
		s = tx.Palette.Render(option.StringEffect, val.(*value.String).Raw())
	case option.LimitRecursion:
		p := val.(*value.Integer)
		if p.Raw() < 0 {
			s = tx.Palette.Render(option.NullEffect, "(no limit)")
		} else {
			s = tx.Palette.Render(option.NumberEffect, p.String())
		}
	case option.CPUFlag:
		s = tx.Palette.Render(option.NumberEffect, val.(*value.Integer).String())
	case option.WaitTimeoutFlag:
		s = tx.Palette.Render(option.NumberEffect, val.(*value.Float).String())
	case option.AnsiQuotesFlag, option.StrictEqualFlag, option.AllowUnevenFieldsFlag,
		option.NoHeaderFlag, option.WithoutNullFlag, option.StripEndingLineBreakFlag, option.ScientificNotationFlag,
		option.ColorFlag, option.QuietFlag, option.StatsFlag:
		s = tx.Palette.Render(option.BooleanEffect, val.(*value.Boolean).String())
	}

	return s, true
}

func ShowObjects(scope *ReferenceScope, expr parser.ShowObjects) (string, error) {
	var s string

	w := scope.Tx.CreateDocumentWriter()

	switch strings.ToUpper(expr.Type.Literal) {
	case ShowTables:
		keys := scope.Tx.CachedViews.SortedKeys()

		if len(keys) < 1 {
			s = scope.Tx.Warn("No table is loaded")
		} else {
			createdFiles, updatedFiles := scope.Tx.UncommittedViews.UncommittedFiles()

			for _, key := range keys {
				if view, ok := scope.Tx.CachedViews.Load(strings.ToUpper(key)); ok {
					fields := view.Header.TableColumnNames()
					info := view.FileInfo
					ufpath := strings.ToUpper(info.Path)

					if _, ok := createdFiles[ufpath]; ok {
						w.WriteColor("*Created* ", option.EmphasisEffect)
					} else if _, ok := updatedFiles[ufpath]; ok {
						w.WriteColor("*Updated* ", option.EmphasisEffect)
					}
					w.WriteColorWithoutLineBreak(info.Path, option.ObjectEffect)
					writeFields(w, fields)

					w.NewLine()
					writeTableAttribute(w, scope.Tx.Flags, info)
					w.ClearBlock()
					w.NewLine()
				}
			}

			uncommitted := len(createdFiles) + len(updatedFiles)

			w.Title1 = "Loaded Tables"
			if 0 < uncommitted {
				w.Title2 = fmt.Sprintf("(Uncommitted: %s)", FormatCount(uncommitted, "Table"))
				w.Title2Effect = option.EmphasisEffect
			}
			s = "\n" + w.String() + "\n"
		}
	case ShowViews:
		views := scope.AllTemporaryTables()

		if views.Len() < 1 {
			s = scope.Tx.Warn("No view is declared")
		} else {
			keys := views.SortedKeys()

			updatedViews := scope.Tx.UncommittedViews.UncommittedTempViews()

			for _, key := range keys {
				if view, ok := views.Load(key); ok {
					fields := view.Header.TableColumnNames()
					info := view.FileInfo
					ufpath := strings.ToUpper(info.Path)

					if _, ok := updatedViews[ufpath]; ok {
						w.WriteColor("*Updated* ", option.EmphasisEffect)
					}
					w.WriteColorWithoutLineBreak(info.Path, option.ObjectEffect)
					writeFields(w, fields)
					w.ClearBlock()
					w.NewLine()
				}
			}

			uncommitted := len(updatedViews)

			w.Title1 = "Views"
			if 0 < uncommitted {
				w.Title2 = fmt.Sprintf("(Uncommitted: %s)", FormatCount(uncommitted, "View"))
				w.Title2Effect = option.EmphasisEffect
			}
			s = "\n" + w.String() + "\n"
		}
	case ShowCursors:
		cursors := scope.AllCursors()
		if cursors.Len() < 1 {
			s = scope.Tx.Warn("No cursor is declared")
		} else {
			keys := cursors.SortedKeys()

			for _, key := range keys {
				if cur, ok := cursors.Load(key); ok {
					isOpen := cur.IsOpen()

					w.WriteColor(cur.Name, option.ObjectEffect)
					w.BeginBlock()

					w.NewLine()
					w.WriteColorWithoutLineBreak("Status: ", option.LableEffect)
					if isOpen == ternary.TRUE {
						nor, _ := cur.Count()
						inRange, _ := cur.IsInRange()
						position, _ := cur.Pointer()

						norStr := option.FormatInt(nor, ",")

						w.WriteColorWithoutLineBreak("Open", option.TernaryEffect)
						w.WriteColorWithoutLineBreak("    Number of Rows: ", option.LableEffect)
						w.WriteColorWithoutLineBreak(norStr, option.NumberEffect)
						w.WriteSpaces(10 - len(norStr))
						w.WriteColorWithoutLineBreak("Pointer: ", option.LableEffect)
						switch inRange {
						case ternary.FALSE:
							w.WriteColorWithoutLineBreak("Out of Range", option.TernaryEffect)
						case ternary.UNKNOWN:
							w.WriteColorWithoutLineBreak(inRange.String(), option.TernaryEffect)
						default:
							w.WriteColorWithoutLineBreak(option.FormatInt(position, ","), option.NumberEffect)
						}
					} else {
						w.WriteColorWithoutLineBreak("Closed", option.TernaryEffect)
					}

					w.NewLine()
					if cur.query.SelectEntity != nil {
						w.WriteColor("Query:", option.LableEffect)
						writeQuery(w, cur.query.String())
					} else {
						w.WriteColorWithoutLineBreak("Statement: ", option.LableEffect)
						w.WriteColorWithoutLineBreak(cur.statement.String(), option.IdentifierEffect)
					}

					w.ClearBlock()
					w.NewLine()
				}
			}
			w.Title1 = "Cursors"
			s = "\n" + w.String() + "\n"
		}
	case ShowFunctions:
		scalars, aggs := scope.AllFunctions()
		if scalars.Len() < 1 && aggs.Len() < 1 {
			s = scope.Tx.Warn("No function is declared")
		} else {
			if 0 < scalars.Len() {
				w.Clear()
				writeFunctions(w, scalars)
				w.Title1 = "Scalar Functions"
				s += "\n" + w.String()
			}
			if 0 < aggs.Len() {
				w.Clear()
				writeFunctions(w, aggs)
				w.Title1 = "Aggregate Functions"
				s += "\n" + w.String() + "\n"
			} else {
				s += "\n"
			}
		}
	case ShowStatements:
		if scope.Tx.PreparedStatements.Len() < 1 {
			s = scope.Tx.Warn("No statement is prepared")
		} else {
			keys := scope.Tx.PreparedStatements.SortedKeys()

			for _, key := range keys {
				if stmt, ok := scope.Tx.PreparedStatements.Load(key); ok {
					w.WriteColor(stmt.Name, option.ObjectEffect)
					w.BeginBlock()

					w.NewLine()
					w.WriteColorWithoutLineBreak("Placeholder Number: ", option.LableEffect)
					w.WriteColorWithoutLineBreak(strconv.Itoa(stmt.HolderNumber), option.NumberEffect)
					w.NewLine()
					w.WriteColorWithoutLineBreak("Statement:", option.LableEffect)
					writeQuery(w, stmt.StatementString)

					w.ClearBlock()
					w.NewLine()
				}
			}
			w.Title1 = "Prepared Statements"
			s = "\n" + w.String() + "\n"

		}
	case ShowFlags:
		for _, flag := range option.FlagList {
			symbol := option.FlagSymbol(flag)
			s, _ := showFlag(scope.Tx, flag)
			w.WriteSpaces(27 - len(symbol))
			w.WriteColorWithoutLineBreak(symbol, option.LableEffect)
			w.WriteColorWithoutLineBreak(":", option.LableEffect)
			w.WriteSpaces(1)
			w.WriteWithoutLineBreak(s)
			w.NewLine()
		}
		w.Title1 = "Flags"
		s = "\n" + w.String() + "\n"
	case ShowEnv:
		env := os.Environ()
		names := make([]string, 0, len(env))
		vars := make([]string, 0, len(env))
		nameWidth := 0

		for _, e := range env {
			words := strings.Split(e, "=")
			name := string(parser.VariableSign) + string(parser.EnvironmentVariableSign) + words[0]
			if nameWidth < len(name) {
				nameWidth = len(name)
			}

			var val string
			if 1 < len(words) {
				val = strings.Join(words[1:], "=")
			}
			vars = append(vars, val)
			names = append(names, name)
		}

		for i, name := range names {
			w.WriteSpaces(nameWidth - len(name))
			w.WriteColorWithoutLineBreak(name, option.LableEffect)
			w.WriteColorWithoutLineBreak(":", option.LableEffect)
			w.WriteSpaces(1)
			w.WriteWithoutLineBreak(vars[i])
			w.NewLine()
		}
		w.Title1 = "Environment Variables"
		s = "\n" + w.String() + "\n"
	case ShowRuninfo:
		for _, ri := range RuntimeInformatinList {
			label := string(parser.VariableSign) + string(parser.RuntimeInformationSign) + ri
			p, _ := GetRuntimeInformation(scope.Tx, parser.RuntimeInformation{Name: ri})

			w.WriteSpaces(19 - len(label))
			w.WriteColorWithoutLineBreak(label, option.LableEffect)
			w.WriteColorWithoutLineBreak(":", option.LableEffect)
			w.WriteSpaces(1)
			switch ri {
			case WorkingDirectory, VersionInformation:
				w.WriteColorWithoutLineBreak(p.(*value.String).Raw(), option.StringEffect)
			case UncommittedInformation:
				w.WriteColorWithoutLineBreak(p.(*value.Boolean).String(), option.BooleanEffect)
			default:
				w.WriteColorWithoutLineBreak(p.(*value.Integer).String(), option.NumberEffect)
			}
			w.NewLine()
		}
		w.Title1 = "Runtime Information"
		s = "\n" + w.String() + "\n"
	default:
		return "", NewShowInvalidObjectTypeError(expr, expr.Type.String())
	}

	return s, nil
}

func writeTableAttribute(w *doc.Writer, flags *option.Flags, info *FileInfo) {
	encWidth := option.TextWidth(info.Encoding.String(), flags)

	w.WriteColor("Format: ", option.LableEffect)
	w.WriteWithoutLineBreak(info.Format.String())

	w.WriteSpaces(encWidth + 4 - option.TextWidth(info.Format.String(), flags))
	switch info.Format {
	case option.CSV:
		w.WriteColorWithoutLineBreak("Delimiter: ", option.LableEffect)
		w.WriteWithoutLineBreak("'" + option.EscapeString(string(info.Delimiter)) + "'")
	case option.TSV:
		w.WriteColorWithoutLineBreak("Delimiter: ", option.LableEffect)
		w.WriteColorWithoutLineBreak("'\\t'", option.NullEffect)
	case option.FIXED:
		dp := info.DelimiterPositions.String()
		if info.SingleLine {
			dp = "S" + dp
		}

		w.WriteColorWithoutLineBreak("Delimiter Positions: ", option.LableEffect)
		w.WriteWithoutLineBreak(dp)
	case option.JSON, option.JSONL:
		escapeStr := option.JsonEscapeTypeToString(info.JsonEscape)
		w.WriteColorWithoutLineBreak("Escape: ", option.LableEffect)
		w.WriteWithoutLineBreak(escapeStr)

		spaces := 9 - len(escapeStr)
		if spaces < 2 {
			spaces = 2
		}
		w.WriteSpaces(spaces)

		w.WriteColorWithoutLineBreak("Query: ", option.LableEffect)
		if len(info.JsonQuery) < 1 {
			w.WriteColorWithoutLineBreak("(empty)", option.NullEffect)
		} else {
			w.WriteColorWithoutLineBreak(info.JsonQuery, option.NullEffect)
		}
	}

	switch info.Format {
	case option.CSV, option.TSV:
		w.WriteSpaces(4 - (option.TextWidth(option.EscapeString(string(info.Delimiter)), flags)))
		w.WriteColorWithoutLineBreak("Enclose All: ", option.LableEffect)
		w.WriteWithoutLineBreak(strconv.FormatBool(info.EncloseAll))
	}

	w.NewLine()

	w.WriteColor("Encoding: ", option.LableEffect)
	switch info.Format {
	case option.JSON, option.JSONL:
		w.WriteColorWithoutLineBreak(text.UTF8.String(), option.NullEffect)
	default:
		w.WriteWithoutLineBreak(info.Encoding.String())
	}

	if !(info.Format == option.FIXED && info.SingleLine) {
		w.WriteSpaces(encWidth + 2 - (option.TextWidth(info.Encoding.String(), flags)))
		w.WriteColorWithoutLineBreak("LineBreak: ", option.LableEffect)
		w.WriteWithoutLineBreak(info.LineBreak.String())
	}

	switch info.Format {
	case option.JSON, option.JSONL:
		w.WriteSpaces(6 - (option.TextWidth(info.LineBreak.String(), flags)))
		w.WriteColorWithoutLineBreak("Pretty Print: ", option.LableEffect)
		w.WriteWithoutLineBreak(strconv.FormatBool(info.PrettyPrint))
	case option.CSV, option.TSV, option.FIXED, option.GFM, option.ORG:
		if !(info.Format == option.FIXED && info.SingleLine) {
			w.WriteSpaces(6 - (option.TextWidth(info.LineBreak.String(), flags)))
			w.WriteColorWithoutLineBreak("Header: ", option.LableEffect)
			w.WriteWithoutLineBreak(strconv.FormatBool(!info.NoHeader))
		}
	}
}

func writeFields(w *doc.Writer, fields []string) {
	w.BeginBlock()
	w.NewLine()
	w.WriteColor("Fields: ", option.LableEffect)
	w.BeginSubBlock()
	lastIdx := len(fields) - 1
	for i, f := range fields {
		escaped := option.EscapeIdentifier(f)
		if i < lastIdx && !w.FitInLine(escaped+", ") {
			w.NewLine()
		}
		w.WriteColor(escaped, option.AttributeEffect)
		if i < lastIdx {
			w.WriteWithoutLineBreak(", ")
		}
	}
	w.EndSubBlock()
}

func writeFunctions(w *doc.Writer, funcs UserDefinedFunctionMap) {
	keys := funcs.SortedKeys()

	for _, key := range keys {
		if fn, ok := funcs.Load(key); ok {
			w.WriteColor(fn.Name.String(), option.ObjectEffect)
			w.WriteWithoutLineBreak(" (")

			if fn.IsAggregate {
				w.WriteColorWithoutLineBreak(fn.Cursor.String(), option.IdentifierEffect)
				if 0 < len(fn.Parameters) {
					w.WriteWithoutLineBreak(", ")
				}
			}

			for i, p := range fn.Parameters {
				if 0 < i {
					w.WriteWithoutLineBreak(", ")
				}
				if def, ok := fn.Defaults[p.Name]; ok {
					w.WriteColorWithoutLineBreak(p.String(), option.AttributeEffect)
					w.WriteWithoutLineBreak(" = ")
					w.WriteColorWithoutLineBreak(def.String(), option.ValueEffect)
				} else {
					w.WriteColorWithoutLineBreak(p.String(), option.AttributeEffect)
				}
			}

			w.WriteWithoutLineBreak(")")
			w.ClearBlock()
			w.NewLine()
		}
	}
}

func ShowFields(ctx context.Context, scope *ReferenceScope, expr parser.ShowFields) (string, error) {
	var tableName = func(expr parser.QueryExpression) string {
		switch e := expr.(type) {
		case parser.Identifier:
			return e.Literal
		case parser.Stdin:
			return e.String()
		case HttpObject:
			return "Remote Object"
		case DataObject:
			return "String Object"
		default:
			return "Inline Table"
		}
	}

	if !strings.EqualFold(expr.Type.Literal, "FIELDS") {
		return "", NewShowInvalidObjectTypeError(expr, expr.Type.Literal)
	}

	var status = ObjectFixed

	queryScope := scope.CreateNode()
	defer queryScope.CloseCurrentNode()

	view, err := LoadViewFromTableIdentifier(ctx, queryScope, expr.Table, false, false)
	if err != nil {
		return "", err
	}

	if view.FileInfo.IsInMemoryTable() {
		updatedViews := scope.Tx.UncommittedViews.UncommittedTempViews()
		ufpath := view.FileInfo.IdentifiedPath()

		if _, ok := updatedViews[ufpath]; ok {
			status = ObjectUpdated
		}
	} else if view.FileInfo.IsFile() {
		createdViews, updatedView := scope.Tx.UncommittedViews.UncommittedFiles()
		ufpath := view.FileInfo.IdentifiedPath()

		if _, ok := createdViews[ufpath]; ok {
			status = ObjectCreated
		} else if _, ok := updatedView[ufpath]; ok {
			status = ObjectUpdated
		}
	} else {
		status = ReadOnly
	}

	w := scope.Tx.CreateDocumentWriter()
	w.WriteColorWithoutLineBreak("Type: ", option.LableEffect)
	if view.FileInfo.IsTemporaryTable() {
		w.WriteWithoutLineBreak("Temporary Table")
	} else if view.FileInfo.IsStdin() {
		w.WriteWithoutLineBreak("STDIN")
	} else if view.FileInfo.IsFile() {
		w.WriteWithoutLineBreak("File")
		w.NewLine()
		w.WriteColorWithoutLineBreak("Path: ", option.LableEffect)
		w.WriteColorWithoutLineBreak(view.FileInfo.Path, option.ObjectEffect)
	} else if view.FileInfo.IsRemoteObject() {
		w.WriteWithoutLineBreak("Remote Object")
		w.NewLine()
		w.WriteColorWithoutLineBreak(" URL: ", option.LableEffect)
		w.WriteColorWithoutLineBreak(view.FileInfo.Path, option.ObjectEffect)
	} else if view.FileInfo.IsStringObject() {
		w.WriteWithoutLineBreak("String Object")
	} else if view.FileInfo.IsInlineTable() {
		w.WriteWithoutLineBreak("Inline Table")
	}

	if !view.FileInfo.IsTemporaryTable() {
		w.NewLine()
		writeTableAttribute(w, scope.Tx.Flags, view.FileInfo)
	}

	if b, ok := ctx.Value("CallFromSubcommand").(bool); !ok || !b {
		w.NewLine()
		w.WriteColorWithoutLineBreak("Status: ", option.LableEffect)
		switch status {
		case ObjectCreated:
			w.WriteColorWithoutLineBreak("Created", option.EmphasisEffect)
		case ObjectUpdated:
			w.WriteColorWithoutLineBreak("Updated", option.EmphasisEffect)
		case ReadOnly:
			w.WriteWithoutLineBreak("Read-Only")
		default:
			w.WriteWithoutLineBreak("Fixed")
		}
	}

	w.NewLine()
	writeFieldList(w, view.Header.TableColumnNames())

	w.Title1 = "Fields in"
	tablePath := func() parser.QueryExpression {
		if e, ok := expr.Table.(parser.FormatSpecifiedFunction); ok {
			return e.Path
		}
		return expr.Table
	}()
	tableObject, err := NormalizeTableObject(ctx, scope, tablePath)
	if err != nil {
		return "", nil
	}
	w.Title2 = tableName(tableObject)
	w.Title2Effect = option.IdentifierEffect
	return "\n" + w.String() + "\n", nil
}

func writeFieldList(w *doc.Writer, fields []string) {
	l := len(fields)
	digits := len(strconv.Itoa(l))
	fieldNumbers := make([]string, 0, l)
	for i := 0; i < l; i++ {
		idxstr := strconv.Itoa(i + 1)
		fieldNumbers = append(fieldNumbers, strings.Repeat(" ", digits-len(idxstr))+idxstr)
	}

	w.WriteColorWithoutLineBreak("Fields:", option.LableEffect)
	w.NewLine()
	w.WriteSpaces(2)
	w.BeginSubBlock()
	for i := 0; i < l; i++ {
		w.WriteColor(fieldNumbers[i], option.NumberEffect)
		w.Write(".")
		w.WriteSpaces(1)
		w.WriteColorWithoutLineBreak(fields[i], option.AttributeEffect)
		w.NewLine()
	}
}

func writeQuery(w *doc.Writer, s string) {
	w.NewLine()
	w.WriteSpaces(2)
	w.BeginSubBlock()
	w.WriteWithAutoLineBreakWithContinueMark(s)
	w.EndSubBlock()
}

func SetEnvVar(ctx context.Context, scope *ReferenceScope, expr parser.SetEnvVar) error {
	var p value.Primary
	var err error

	if ident, ok := expr.Value.(parser.Identifier); ok {
		p = value.NewString(ident.Literal)
		defer value.Discard(p)
	} else {
		p, err = Evaluate(ctx, scope, expr.Value)
		if err != nil {
			return err
		}
	}

	var val string
	if s := value.ToString(p); !value.IsNull(s) {
		val = s.(*value.String).Raw()
		value.Discard(s)
	}
	return os.Setenv(expr.EnvVar.Name, val)
}

func UnsetEnvVar(expr parser.UnsetEnvVar) error {
	return os.Unsetenv(expr.EnvVar.Name)
}

func Chdir(ctx context.Context, scope *ReferenceScope, expr parser.Chdir) error {
	var dirpath string
	var err error

	if ident, ok := expr.DirPath.(parser.Identifier); ok {
		dirpath = ident.Literal
	} else {
		p, err := Evaluate(ctx, scope, expr.DirPath)
		if err != nil {
			return err
		}
		s := value.ToString(p)
		if value.IsNull(s) {
			return NewInvalidPathError(expr, expr.DirPath.String(), "invalid directory path")
		}
		dirpath = s.(*value.String).Raw()
		value.Discard(s)
	}

	if err = os.Chdir(dirpath); err != nil {
		if patherr, ok := err.(*os.PathError); ok {
			err = NewInvalidPathError(expr, patherr.Path, patherr.Err.Error())
		}
	}
	return err
}

func Pwd(expr parser.Pwd) (string, error) {
	dirpath, err := os.Getwd()
	if err != nil {
		if patherr, ok := err.(*os.PathError); ok {
			err = NewInvalidPathError(expr, patherr.Path, patherr.Err.Error())
		}
	}
	return dirpath, err
}

func Reload(ctx context.Context, tx *Transaction, expr parser.Reload) error {
	tx.operationMutex.Lock()
	defer tx.operationMutex.Unlock()

	switch strings.ToUpper(expr.Type.Literal) {
	case ReloadConfig:
		if err := tx.Environment.Load(ctx, tx.WaitTimeout, tx.RetryDelay); err != nil {
			return NewLoadConfigurationError(expr, err.Error())
		}

		for _, v := range tx.Environment.DatetimeFormat {
			tx.Flags.DatetimeFormat = option.AppendStrIfNotExist(tx.Flags.DatetimeFormat, v)
		}

		palette, err := color.GeneratePalette(tx.Environment.Palette)
		if err != nil {
			return NewLoadConfigurationError(expr, err.Error())
		}
		tx.Palette.Merge(palette)

		if tx.Session.Terminal() != nil {
			if err := tx.Session.Terminal().ReloadConfig(); err != nil {
				return NewLoadConfigurationError(expr, err.Error())
			}
		}

	default:
		return NewInvalidReloadTypeError(expr, expr.Type.Literal)
	}
	return nil
}

func Syntax(ctx context.Context, scope *ReferenceScope, expr parser.Syntax) (string, error) {
	keys := make([]string, 0, len(expr.Keywords))
	for _, key := range expr.Keywords {
		var keystr string
		if fr, ok := key.(parser.FieldReference); ok {
			if col, ok := fr.Column.(parser.Identifier); ok {
				keystr = col.Literal
			}
		} else {
			if p, err := Evaluate(ctx, scope, key); err == nil {
				if s := value.ToString(p); !value.IsNull(s) {
					keystr = s.(*value.String).Raw()
					value.Discard(s)
				}
			}
		}

		if 0 < len(keystr) {
			words := strings.Split(option.TrimSpace(keystr), " ")
			for _, w := range words {
				w = option.TrimSpace(w)
				if 0 < len(w) {
					keys = append(keys, w)
				}
			}
		}
	}

	store := syntax.NewStore()
	exps := store.Search(keys)

	w := scope.Tx.CreateDocumentWriter()

	for _, exp := range exps {
		w.WriteColor(exp.Label, option.LableEffect)
		w.NewLine()
		if len(exps) < 4 {
			w.BeginBlock()

			if 0 < len(exp.Description.Template) {
				w.WriteWithAutoLineBreak(exp.Description.Format(scope.Tx.Palette))
				w.NewLine()
				w.NewLine()
			}

			for _, def := range exp.Grammar {
				w.Write(def.Name.Format(scope.Tx.Palette))
				w.NewLine()
				w.BeginBlock()
				for i, gram := range def.Group {
					if i == 0 {
						w.Write(": ")
					} else {
						w.Write("| ")
					}
					w.BeginSubBlock()
					w.WriteWithAutoLineBreak(gram.Format(scope.Tx.Palette))
					w.EndSubBlock()
					w.NewLine()
				}

				if 0 < len(def.Description.Template) {
					if 0 < len(def.Group) {
						w.NewLine()
					}
					w.WriteWithAutoLineBreak(def.Description.Format(scope.Tx.Palette))
					w.NewLine()
				}

				w.EndBlock()
				w.NewLine()
			}
			w.EndBlock()
		}

		if 0 < len(exp.Children) && (len(keys) < 1 || strings.EqualFold(exp.Label, strings.Join(keys, " "))) {
			w.BeginBlock()
			for _, child := range exp.Children {
				w.WriteColor(child.Label, option.LableEffect)
				w.NewLine()
			}
		}

		w.ClearBlock()
	}

	if len(keys) < 1 {
		w.Title1 = "Contents"
	} else {
		w.Title1 = "Search: " + strings.Join(keys, " ")
	}
	return "\n" + w.String() + "\n", nil

}
