package query

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"runtime"
	"strconv"
	"strings"

	"github.com/mithrandie/csvq/lib/file"
	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"
)

const ExitMessage = "exit"
const DefaultUserTriggeredErrorMessage = "triggered error"

const (
	ErrorMessageTemplate                 = "[L:%d C:%d] %s"
	ErrorMessageWithFilepathTemplate     = "%s [L:%d C:%d] %s"
	ErrorMessageWithCustomPrefixTemplate = "[%s] %s"

	ErrMsgSignalReceived = "signal received: %s"

	ErrMsgIncorrectCommandUsage                = "incorrect usage: %s"
	ErrMsgInvalidValueExpression               = "%s: cannot evaluate as a value"
	ErrMsgInvalidPath                          = "%s: %s"
	ErrMsgIO                                   = "%s"
	ErrMsgCommit                               = "failed to commit: %s"
	ErrMsgRollback                             = "failed to rollback: %s"
	ErrMsgCannotDetectFileEncoding             = "cannot detect character encoding: %s"
	ErrMsgFieldAmbiguous                       = "field %s is ambiguous"
	ErrMsgFieldNotExist                        = "field %s does not exist"
	ErrMsgFieldNotGroupKey                     = "field %s is not a group key"
	ErrMsgDuplicateFieldName                   = "field name %s is a duplicate"
	ErrMsgNotGroupingRecords                   = "function %s cannot aggregate not grouping records"
	ErrMsgNotAllowedAnalyticFunction           = "analytic function %s is only available in select clause or order by clause"
	ErrMsgUndeclaredVariable                   = "variable %s is undeclared"
	ErrMsgVariableRedeclared                   = "variable %s is redeclared"
	ErrMsgUndefinedConstant                    = "constant %s is not defined"
	ErrMsgInvalidUrl                           = "failed to parse %q as url"
	ErrMsgUnsupportedUrlScheme                 = "url scheme %s is not supported"
	ErrMsgFunctionNotExist                     = "function %s does not exist"
	ErrMsgFunctionArgumentsLength              = "function %s takes %s"
	ErrMsgFunctionInvalidArgument              = "%s for function %s"
	ErrMsgNestedAggregateFunctions             = "aggregate functions are nested at %s"
	ErrMsgFunctionRedeclared                   = "function %s is redeclared"
	ErrMsgBuiltInFunctionDeclared              = "function %s is a built-in function"
	ErrMsgDuplicateParameter                   = "parameter %s is a duplicate"
	ErrMsgSubqueryTooManyRecords               = "subquery returns too many records, should return only one record"
	ErrMsgSubqueryTooManyFields                = "subquery returns too many fields, should return only one field"
	ErrMsgJsonQueryTooManyRecords              = "json query returns too many records, should return only one record"
	ErrMsgLoadJson                             = "json loading error: %s"
	ErrMsgJsonLinesStructure                   = "json lines must be an array of objects"
	ErrMsgIncorrectLateralUsage                = "LATERAL cannot to be used in a RIGHT or FULL outer join"
	ErrMsgEmptyInlineTable                     = "inline table is empty"
	ErrMsgInvalidTableObject                   = "invalid table object: %s"
	ErrMsgTableObjectInvalidDelimiter          = "invalid delimiter: %s"
	ErrMsgTableObjectInvalidDelimiterPositions = "invalid delimiter positions: %s"
	ErrMsgTableObjectInvalidJsonQuery          = "invalid json query: %s"
	ErrMsgTableObjectArgumentsLength           = "table object %s takes at most %d arguments"
	ErrMsgTableObjectJsonArgumentsLength       = "table object %s takes exactly %d arguments"
	ErrMsgTableObjectInvalidArgument           = "invalid argument for %s: %s"
	ErrMsgCursorRedeclared                     = "cursor %s is redeclared"
	ErrMsgUndeclaredCursor                     = "cursor %s is undeclared"
	ErrMsgCursorClosed                         = "cursor %s is closed"
	ErrMsgCursorOpen                           = "cursor %s is already open"
	ErrMsgInvalidCursorStatement               = "invalid cursor statement: %s"
	ErrMsgPseudoCursor                         = "cursor %s is a pseudo cursor"
	ErrMsgCursorFetchLength                    = "fetching from cursor %s returns %s"
	ErrMsgInvalidFetchPosition                 = "fetching position %s is not an integer value"
	ErrMsgInlineTableRedefined                 = "inline table %s is redefined"
	ErrMsgUndefinedInlineTable                 = "inline table %s is undefined"
	ErrMsgInlineTableFieldLength               = "select query should return exactly %s for inline table %s"
	ErrMsgFileNotExist                         = "file %s does not exist"
	ErrMsgFileAlreadyExist                     = "file %s already exists"
	ErrMsgFileUnableToRead                     = "file %s is unable to be read"
	ErrMsgFileLockTimeout                      = "file %s: lock wait timeout period exceeded"
	ErrMsgFileNameAmbiguous                    = "filename %s is ambiguous"
	ErrMsgDataParsing                          = "data parse error in %s: %s"
	ErrMsgDataEncoding                         = "data encode error: %s"
	ErrMsgTableFieldLength                     = "select query should return exactly %s for table %s"
	ErrMsgTemporaryTableRedeclared             = "view %s is redeclared"
	ErrMsgUndeclaredTemporaryTable             = "view %s is undeclared"
	ErrMsgTemporaryTableFieldLength            = "select query should return exactly %s for view %s"
	ErrMsgDuplicateTableName                   = "table name %s is a duplicate"
	ErrMsgTableNotLoaded                       = "table %s is not loaded"
	ErrMsgStdinEmpty                           = "STDIN is empty"
	ErrMsgInlineTableCannotBeUpdated           = "inline table cannot be updated"
	ErrMsgAliasMustBeSpecifiedForUpdate        = "alias to table identification function or URL must be specified for update"
	ErrMsgRowValueLengthInComparison           = "row value should contain exactly %s"
	ErrMsgFieldLengthInComparison              = "select query should return exactly %s"
	ErrMsgInvalidLimitPercentage               = "limit percentage %s is not a float value"
	ErrMsgInvalidLimitNumber                   = "limit number of records %s is not an integer value"
	ErrMsgInvalidOffsetNumber                  = "offset number %s is not an integer value"
	ErrMsgCombinedSetFieldLength               = "result set to be combined should contain exactly %s"
	ErrMsgRecursionExceededLimit               = "iteration of recursive query exceeded the limit %d"
	ErrMsgNestedRecursion                      = "recursive queries are nested"
	ErrMsgInsertRowValueLength                 = "row value should contain exactly %s"
	ErrMsgInsertSelectFieldLength              = "select query should return exactly %s"
	ErrMsgUpdateFieldNotExist                  = "field %s does not exist in the tables to update"
	ErrMsgUpdateValueAmbiguous                 = "value %s to set in the field %s is ambiguous"
	ErrMsgReplaceKeyNotSet                     = "replace Key %s is not set"
	ErrMsgDeleteTableNotSpecified              = "tables to delete records are not specified"
	ErrMsgShowInvalidObjectType                = "object type %s is invalid"
	ErrMsgReplaceValueLength                   = "%s"
	ErrMsgSourceInvalidFilePath                = "%s is a invalid file path"
	ErrMsgInvalidFlagName                      = "%s is an unknown flag"
	ErrMsgFlagValueNowAllowedFormat            = "%s for %s is not allowed"
	ErrMsgInvalidFlagValue                     = "%s"
	ErrMsgAddFlagNotSupportedName              = "add flag element syntax does not support %s"
	ErrMsgRemoveFlagNotSupportedName           = "remove flag element syntax does not support %s"
	ErrMsgInvalidFlagValueToBeRemoved          = "%s is an invalid value for %s to specify the element"
	ErrMsgInvalidRuntimeInformation            = "%s is an unknown runtime information"
	ErrMsgNotTable                             = "table attributes can only be set on files"
	ErrMsgInvalidTableAttributeName            = "table attribute %s does not exist"
	ErrMsgTableAttributeValueNotAllowedFormat  = "%s for %s is not allowed"
	ErrMsgInvalidTableAttributeValue           = "%s"
	ErrMsgInvalidEventName                     = "%s is an unknown event"
	ErrMsgInternalRecordIdNotExist             = "internal record id does not exist"
	ErrMsgInternalRecordIdEmpty                = "internal record id is empty"
	ErrMsgFieldLengthNotMatch                  = "field length does not match"
	ErrMsgRowValueLengthInList                 = "row value length does not match at index %d"
	ErrMsgFormatStringLengthNotMatch           = "number of replace values does not match"
	ErrMsgUnknownFormatPlaceholder             = "%q is an unknown placeholder"
	ErrMsgFormatUnexpectedTermination          = "unexpected termination of format string"
	ErrMsgExternalCommand                      = "external command: %s"
	ErrMsgHttpRequest                          = "failed to get resource from %s: %s"
	ErrMsgInvalidReloadType                    = "%s is an unknown reload type"
	ErrMsgLoadConfiguration                    = "configuration loading error: %s"
	ErrMsgDuplicateStatementName               = "statement %s is a duplicate"
	ErrMsgStatementNotExist                    = "statement %s does not exist"
	ErrMsgStatementReplaceValueNotSpecified    = "replace value for %s is not specified"
	ErrMsgSelectIntoQueryFieldLengthNotMatch   = "select into query should return exactly %s"
	ErrMsgSelectIntoQueryTooManyRecords        = "select into query returns too many records, should return only one record"
	ErrMsgIntegerDevidedByZero                 = "integer divided by zero"
)

type Error interface {
	Error() string
	Message() string
	Code() int
	Number() int
	Line() int
	Char() int
	Source() string
	appendCompositeError(Error)
}

type BaseError struct {
	source        string
	line          int
	char          int
	message       string
	code          int
	number        int
	prefix        string
	compositeErrs []Error
}

func (e *BaseError) Error() string {
	msg := e.err()
	if e.compositeErrs != nil {
		msglist := make([]string, 0, len(e.compositeErrs)+1)
		msglist = append(msglist, "composite error:")
		msglist = append(msglist, msg)
		for _, ce := range e.compositeErrs {
			msglist = append(msglist, ce.Error())
		}
		msg = strings.Join(msglist, "\n  ")
	}
	return msg
}

func (e *BaseError) err() string {
	if 0 < len(e.prefix) {
		return fmt.Sprintf(ErrorMessageWithCustomPrefixTemplate, e.prefix, e.message)
	}
	if e.line < 1 {
		return e.message
	}
	if 0 < len(e.source) {
		return fmt.Sprintf(ErrorMessageWithFilepathTemplate, e.source, e.line, e.char, e.message)
	}
	return fmt.Sprintf(ErrorMessageTemplate, e.line, e.char, e.message)
}

func (e *BaseError) Message() string {
	return e.message
}

func (e *BaseError) Code() int {
	return e.code
}

func (e *BaseError) Number() int {
	return e.number
}

func (e *BaseError) Line() int {
	return e.line
}

func (e *BaseError) Char() int {
	return e.char
}

func (e *BaseError) Source() string {
	return e.source
}

func (e *BaseError) appendCompositeError(err Error) {
	e.compositeErrs = append(e.compositeErrs, err)
}

func appendCompositeError(e1 error, e2 error) error {
	if e1 == nil {
		return e2
	}
	if e2 == nil {
		return e1
	}
	appe1, ok := e1.(Error)
	if !ok {
		appe1 = NewSystemError(e1.Error()).(Error)
	}
	appe2, ok := e2.(Error)
	if !ok {
		appe2 = NewSystemError(e2.Error()).(Error)
	}
	appe1.appendCompositeError(appe2)
	return appe1
}

func NewBaseError(expr parser.Expression, message string, code int, number int) *BaseError {
	var sourceFile string
	var line int
	var char int
	if expr != nil && expr.HasParseInfo() {
		sourceFile = expr.SourceFile()
		line = expr.Line()
		char = expr.Char()
	}

	return &BaseError{
		source:  sourceFile,
		line:    line,
		char:    char,
		message: message,
		code:    code,
		number:  number,
		prefix:  "",
	}
}

func NewBaseErrorWithPrefix(prefix string, message string, code int, number int) *BaseError {
	return &BaseError{
		source:  "",
		line:    0,
		char:    0,
		message: message,
		code:    code,
		number:  number,
		prefix:  prefix,
	}
}

type FatalError struct {
	*BaseError
}

func NewFatalError(panicReport interface{}) error {
	stacks := make([]string, 0, 30)
	for depth := 0; ; depth++ {
		pc, src, line, ok := runtime.Caller(depth)
		if !ok {
			break
		}
		if depth == 0 {
			continue
		}
		stacks = append(stacks, fmt.Sprintf("  %d: %s [%s:%d]", depth-1, runtime.FuncForPC(pc).Name(), src, line))
	}

	message := fmt.Sprintf("%v\n", panicReport) +
		"An unexpected error has occurred. Please report this problem to: https://github.com/mithrandie/csvq/issues\n" +
		"\n" +
		"Stack:\n" +
		strings.Join(stacks, "\n")

	return &FatalError{
		NewBaseErrorWithPrefix("Fatal Error", message, ReturnCodeApplicationError, ErrorFatal),
	}
}

type SystemError struct {
	*BaseError
}

func NewSystemError(message string) error {
	return &SystemError{
		NewBaseErrorWithPrefix("System Error", message, ReturnCodeSystemError, ErrorSystemError),
	}
}

type ForcedExit struct {
	*BaseError
}

func NewForcedExit(code int) error {
	return &ForcedExit{&BaseError{message: ExitMessage, code: code, number: ErrorExit}}
}

type UserTriggeredError struct {
	*BaseError
}

func NewUserTriggeredError(expr parser.Trigger, message string) error {
	code := ReturnCodeDefaultUserTriggeredError
	if expr.Code != nil {
		code = int(expr.Code.(*value.Integer).Raw())
	}

	if len(message) < 1 {
		message = DefaultUserTriggeredErrorMessage
	}

	return &UserTriggeredError{
		NewBaseError(expr, message, code, ErrorUserTriggered),
	}
}

type SignalReceived struct {
	*BaseError
}

func NewSignalReceived(sig os.Signal) error {
	v := reflect.ValueOf(sig)
	code := int(v.Int())
	return &SignalReceived{
		NewBaseErrorWithPrefix("", fmt.Sprintf(ErrMsgSignalReceived, sig.String()), returnCodeBaseSignal+code, errorSignalBase+code),
	}
}

type SyntaxError struct {
	*BaseError
}

func NewSyntaxError(err *parser.SyntaxError) error {
	return &SyntaxError{
		&BaseError{
			source:  err.SourceFile,
			line:    err.Line,
			char:    err.Char,
			message: err.Message,
			code:    ReturnCodeSyntaxError,
			number:  ErrorSyntaxError,
		},
	}
}

type PreparedStatementSyntaxError struct {
	*BaseError
}

func NewPreparedStatementSyntaxError(err *parser.SyntaxError) error {
	return &PreparedStatementSyntaxError{
		&BaseError{
			source:  fmt.Sprintf("prepare %s", err.SourceFile),
			line:    err.Line,
			char:    err.Char,
			message: err.Message,
			code:    ReturnCodeSyntaxError,
			number:  ErrorPreparedStatementSyntaxError,
		},
	}
}

type ContextCanceled struct {
	*BaseError
}

func NewContextCanceled(message string) error {
	return &ContextDone{
		NewBaseErrorWithPrefix("Context", message, ReturnCodeContextDone, ErrorContextCanceled),
	}
}

type ContextDone struct {
	*BaseError
}

func NewContextDone(message string) error {
	return &ContextDone{
		NewBaseErrorWithPrefix("Context", message, ReturnCodeContextDone, ErrorContextDone),
	}
}

type IncorrectCommandUsageError struct {
	*BaseError
}

func NewIncorrectCommandUsageError(message string) error {
	return &IncorrectCommandUsageError{
		NewBaseErrorWithPrefix("", fmt.Sprintf(ErrMsgIncorrectCommandUsage, message), ReturnCodeIncorrectUsage, ErrorIncorrectCommandUsage),
	}
}

type InvalidValueExpressionError struct {
	*BaseError
}

func NewInvalidValueExpressionError(expr parser.QueryExpression) error {
	return &InvalidValueExpressionError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgInvalidValueExpression, expr), ReturnCodeSyntaxError, ErrorInvalidValueExpression),
	}
}

type InvalidPathError struct {
	*BaseError
}

func NewInvalidPathError(expr parser.Expression, path string, message string) error {
	return &InvalidPathError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgInvalidPath, path, message), ReturnCodeIOError, ErrorInvalidPath),
	}
}

type IOError struct {
	*BaseError
}

func NewIOError(expr parser.QueryExpression, message string) error {
	return &IOError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgIO, message), ReturnCodeIOError, ErrorIO),
	}
}

type CommitError struct {
	*BaseError
}

func NewCommitError(expr parser.Expression, message string) error {
	if expr == nil {
		return &CommitError{
			NewBaseErrorWithPrefix("Auto Commit", fmt.Sprintf(ErrMsgCommit, message), ReturnCodeIOError, ErrorCommit),
		}
	}
	return &CommitError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgCommit, message), ReturnCodeIOError, ErrorCommit),
	}
}

type RollbackError struct {
	*BaseError
}

func NewRollbackError(expr parser.Expression, message string) error {
	if expr == nil {
		return &RollbackError{
			NewBaseErrorWithPrefix("Auto Rollback", fmt.Sprintf(ErrMsgRollback, message), ReturnCodeIOError, ErrorRollback),
		}
	}
	return &RollbackError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgRollback, message), ReturnCodeIOError, ErrorRollback),
	}
}

type CannotDetectFileEncodingError struct {
	*BaseError
}

func NewCannotDetectFileEncodingError(file parser.QueryExpression) error {
	return &CannotDetectFileEncodingError{
		NewBaseError(file, fmt.Sprintf(ErrMsgCannotDetectFileEncoding, file), ReturnCodeApplicationError, ErrorCannotDetectFileEncoding),
	}
}

type FieldAmbiguousError struct {
	*BaseError
}

func NewFieldAmbiguousError(field parser.QueryExpression) error {
	return &FieldAmbiguousError{
		NewBaseError(field, fmt.Sprintf(ErrMsgFieldAmbiguous, field), ReturnCodeApplicationError, ErrorFieldAmbiguous),
	}
}

type FieldNotExistError struct {
	*BaseError
}

func NewFieldNotExistError(field parser.QueryExpression) error {
	return &FieldNotExistError{
		NewBaseError(field, fmt.Sprintf(ErrMsgFieldNotExist, field), ReturnCodeApplicationError, ErrorFieldNotExist),
	}
}

type FieldNotGroupKeyError struct {
	*BaseError
}

func NewFieldNotGroupKeyError(field parser.QueryExpression) error {
	return &FieldNotGroupKeyError{
		NewBaseError(field, fmt.Sprintf(ErrMsgFieldNotGroupKey, field), ReturnCodeApplicationError, ErrorFieldNotGroupKey),
	}
}

type DuplicateFieldNameError struct {
	*BaseError
}

func NewDuplicateFieldNameError(fieldName parser.Identifier) error {
	return &DuplicateFieldNameError{
		NewBaseError(fieldName, fmt.Sprintf(ErrMsgDuplicateFieldName, fieldName), ReturnCodeApplicationError, ErrorDuplicateFieldName),
	}
}

type NotGroupingRecordsError struct {
	*BaseError
}

func NewNotGroupingRecordsError(expr parser.QueryExpression, funcname string) error {
	return &NotGroupingRecordsError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgNotGroupingRecords, funcname), ReturnCodeApplicationError, ErrorNotGroupingRecords),
	}
}

type NotAllowedAnalyticFunctionError struct {
	*BaseError
}

func NewNotAllowedAnalyticFunctionError(expr parser.AnalyticFunction) error {
	return &NotAllowedAnalyticFunctionError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgNotAllowedAnalyticFunction, expr.Name), ReturnCodeApplicationError, ErrorNotAllowedAnalyticFunction),
	}
}

type UndeclaredVariableError struct {
	*BaseError
}

func NewUndeclaredVariableError(expr parser.Variable) error {
	return &UndeclaredVariableError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgUndeclaredVariable, expr), ReturnCodeApplicationError, ErrorUndeclaredVariable),
	}
}

type VariableRedeclaredError struct {
	*BaseError
}

func NewVariableRedeclaredError(expr parser.Variable) error {
	return &VariableRedeclaredError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgVariableRedeclared, expr), ReturnCodeApplicationError, ErrorVariableRedeclared),
	}
}

type UndefinedConstantError struct {
	*BaseError
}

func NewUndefinedConstantError(expr parser.Constant) error {
	return &UndefinedConstantError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgUndefinedConstant, expr), ReturnCodeApplicationError, ErrorUndefinedConstant),
	}
}

type InvalidUrlError struct {
	*BaseError
}

func NewInvalidUrlError(expr parser.Url) error {
	return &InvalidUrlError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgInvalidUrl, expr), ReturnCodeApplicationError, ErrorInvalidUrl),
	}
}

type UnsupportedUrlSchemeError struct {
	*BaseError
}

func NewUnsupportedUrlSchemeError(expr parser.Url, scheme string) error {
	return &UnsupportedUrlSchemeError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgUnsupportedUrlScheme, scheme), ReturnCodeApplicationError, ErrorUnsupportedUrlScheme),
	}
}

type FunctionNotExistError struct {
	*BaseError
}

func NewFunctionNotExistError(expr parser.QueryExpression, funcname string) error {
	return &FunctionNotExistError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgFunctionNotExist, funcname), ReturnCodeApplicationError, ErrorFunctionNotExist),
	}
}

type FunctionArgumentLengthError struct {
	*BaseError
}

func NewFunctionArgumentLengthError(expr parser.QueryExpression, funcname string, argslen []int) error {
	var argstr string
	if 1 < len(argslen) {
		first := argslen[0]
		last := argslen[len(argslen)-1]
		lastarg := FormatCount(last, "argument")
		if len(argslen) == 2 {
			argstr = strconv.Itoa(first) + " or " + lastarg
		} else {
			argstr = strconv.Itoa(first) + " to " + lastarg
		}
	} else {
		argstr = FormatCount(argslen[0], "argument")
		if 0 < argslen[0] {
			argstr = "exactly " + argstr
		}
	}
	return &FunctionArgumentLengthError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgFunctionArgumentsLength, funcname, argstr), ReturnCodeApplicationError, ErrorFunctionArgumentsLength),
	}
}

func NewFunctionArgumentLengthErrorWithCustomArgs(expr parser.QueryExpression, funcname string, argstr string) error {
	return &FunctionArgumentLengthError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgFunctionArgumentsLength, funcname, argstr), ReturnCodeApplicationError, ErrorFunctionArgumentsLength),
	}
}

type FunctionInvalidArgumentError struct {
	*BaseError
}

func NewFunctionInvalidArgumentError(function parser.QueryExpression, funcname string, message string) error {
	return &FunctionInvalidArgumentError{
		NewBaseError(function, fmt.Sprintf(ErrMsgFunctionInvalidArgument, message, funcname), ReturnCodeApplicationError, ErrorFunctionInvalidArgument),
	}
}

type NestedAggregateFunctionsError struct {
	*BaseError
}

func NewNestedAggregateFunctionsError(expr parser.QueryExpression) error {
	return &NestedAggregateFunctionsError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgNestedAggregateFunctions, expr), ReturnCodeSyntaxError, ErrorNestedAggregateFunctions),
	}
}

type FunctionRedeclaredError struct {
	*BaseError
}

func NewFunctionRedeclaredError(expr parser.Identifier) error {
	return &FunctionRedeclaredError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgFunctionRedeclared, expr.Literal), ReturnCodeApplicationError, ErrorFunctionRedeclared),
	}
}

type BuiltInFunctionDeclaredError struct {
	*BaseError
}

func NewBuiltInFunctionDeclaredError(expr parser.Identifier) error {
	return &BuiltInFunctionDeclaredError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgBuiltInFunctionDeclared, expr.Literal), ReturnCodeApplicationError, ErrorBuiltInFunctionDeclared),
	}
}

type DuplicateParameterError struct {
	*BaseError
}

func NewDuplicateParameterError(expr parser.Variable) error {
	return &DuplicateParameterError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgDuplicateParameter, expr.String()), ReturnCodeApplicationError, ErrorDuplicateParameter),
	}
}

type SubqueryTooManyRecordsError struct {
	*BaseError
}

func NewSubqueryTooManyRecordsError(expr parser.Subquery) error {
	return &SubqueryTooManyRecordsError{
		NewBaseError(expr, ErrMsgSubqueryTooManyRecords, ReturnCodeApplicationError, ErrorSubqueryTooManyRecords),
	}
}

type SubqueryTooManyFieldsError struct {
	*BaseError
}

func NewSubqueryTooManyFieldsError(expr parser.Subquery) error {
	return &SubqueryTooManyFieldsError{
		NewBaseError(expr, ErrMsgSubqueryTooManyFields, ReturnCodeApplicationError, ErrorSubqueryTooManyFields),
	}
}

type JsonQueryTooManyRecordsError struct {
	*BaseError
}

func NewJsonQueryTooManyRecordsError(expr parser.JsonQuery) error {
	return &JsonQueryTooManyRecordsError{
		NewBaseError(expr, ErrMsgJsonQueryTooManyRecords, ReturnCodeApplicationError, ErrorJsonQueryTooManyRecords),
	}
}

type LoadJsonError struct {
	*BaseError
}

func NewLoadJsonError(expr parser.QueryExpression, message string) error {
	return &LoadJsonError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgLoadJson, message), ReturnCodeApplicationError, ErrorLoadJson),
	}
}

type JsonLinesStructureError struct {
	*BaseError
}

func NewJsonLinesStructureError(expr parser.QueryExpression) error {
	return &JsonLinesStructureError{
		NewBaseError(expr, ErrMsgJsonLinesStructure, ReturnCodeApplicationError, ErrorJsonLinesStructure),
	}
}

type IncorrectLateralUsageError struct {
	*BaseError
}

func NewIncorrectLateralUsageError(expr parser.Table) error {
	return &IncorrectLateralUsageError{
		NewBaseError(expr, ErrMsgIncorrectLateralUsage, ReturnCodeApplicationError, ErrorIncorrectLateralUsage),
	}
}

type EmptyInlineTableError struct {
	*BaseError
}

func NewEmptyInlineTableError(expr parser.FormatSpecifiedFunction) error {
	return &EmptyInlineTableError{
		NewBaseError(expr, ErrMsgEmptyInlineTable, ReturnCodeApplicationError, ErrorEmptyInlineTable),
	}
}

type InvalidTableObjectError struct {
	*BaseError
}

func NewInvalidTableObjectError(expr parser.FormatSpecifiedFunction, objectName string) error {
	return &InvalidTableObjectError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgInvalidTableObject, objectName), ReturnCodeApplicationError, ErrorInvalidTableObject),
	}
}

type TableObjectInvalidDelimiterError struct {
	*BaseError
}

func NewTableObjectInvalidDelimiterError(expr parser.FormatSpecifiedFunction, delimiter string) error {
	return &InvalidTableObjectError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgTableObjectInvalidDelimiter, delimiter), ReturnCodeApplicationError, ErrorTableObjectInvalidDelimiter),
	}
}

type TableObjectInvalidDelimiterPositionsError struct {
	*BaseError
}

func NewTableObjectInvalidDelimiterPositionsError(expr parser.FormatSpecifiedFunction, positions string) error {
	return &InvalidTableObjectError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgTableObjectInvalidDelimiterPositions, positions), ReturnCodeApplicationError, ErrorTableObjectInvalidDelimiterPositions),
	}
}

type TableObjectInvalidJsonQueryError struct {
	*BaseError
}

func NewTableObjectInvalidJsonQueryError(expr parser.FormatSpecifiedFunction, jsonQuery string) error {
	return &InvalidTableObjectError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgTableObjectInvalidJsonQuery, jsonQuery), ReturnCodeApplicationError, ErrorTableObjectInvalidJsonQuery),
	}
}

type TableObjectArgumentsLengthError struct {
	*BaseError
}

func NewTableObjectArgumentsLengthError(expr parser.FormatSpecifiedFunction, argLen int) error {
	return &TableObjectArgumentsLengthError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgTableObjectArgumentsLength, expr.Type.Literal, argLen), ReturnCodeApplicationError, ErrorTableObjectArgumentsLength),
	}
}

type TableObjectJsonArgumentsLengthError struct {
	*BaseError
}

func NewTableObjectJsonArgumentsLengthError(expr parser.FormatSpecifiedFunction, argLen int) error {
	return &TableObjectJsonArgumentsLengthError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgTableObjectJsonArgumentsLength, expr.Type.Literal, argLen), ReturnCodeApplicationError, ErrorTableObjectJsonArgumentsLength),
	}
}

type TableObjectInvalidArgumentError struct {
	*BaseError
}

func NewTableObjectInvalidArgumentError(expr parser.FormatSpecifiedFunction, message string) error {
	return &TableObjectInvalidArgumentError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgTableObjectInvalidArgument, expr.Type.Literal, message), ReturnCodeApplicationError, ErrorTableObjectInvalidArgument),
	}
}

type CursorRedeclaredError struct {
	*BaseError
}

func NewCursorRedeclaredError(cursor parser.Identifier) error {
	return &CursorRedeclaredError{
		NewBaseError(cursor, fmt.Sprintf(ErrMsgCursorRedeclared, cursor), ReturnCodeApplicationError, ErrorCursorRedeclared),
	}
}

type UndeclaredCursorError struct {
	*BaseError
}

func NewUndeclaredCursorError(cursor parser.Identifier) error {
	return &UndeclaredCursorError{
		NewBaseError(cursor, fmt.Sprintf(ErrMsgUndeclaredCursor, cursor), ReturnCodeApplicationError, ErrorUndeclaredCursor),
	}
}

type CursorClosedError struct {
	*BaseError
}

func NewCursorClosedError(cursor parser.Identifier) error {
	return &CursorClosedError{
		NewBaseError(cursor, fmt.Sprintf(ErrMsgCursorClosed, cursor), ReturnCodeApplicationError, ErrorCursorClosed),
	}
}

type CursorOpenError struct {
	*BaseError
}

func NewCursorOpenError(cursor parser.Identifier) error {
	return &CursorOpenError{
		NewBaseError(cursor, fmt.Sprintf(ErrMsgCursorOpen, cursor), ReturnCodeApplicationError, ErrorCursorOpen),
	}
}

type InvalidCursorStatementError struct {
	*BaseError
}

func NewInvalidCursorStatementError(statement parser.Identifier) error {
	return &InvalidCursorStatementError{
		NewBaseError(statement, fmt.Sprintf(ErrMsgInvalidCursorStatement, statement), ReturnCodeApplicationError, ErrorInvalidCursorStatement),
	}
}

type PseudoCursorError struct {
	*BaseError
}

func NewPseudoCursorError(cursor parser.Identifier) error {
	return &PseudoCursorError{
		NewBaseError(cursor, fmt.Sprintf(ErrMsgPseudoCursor, cursor), ReturnCodeApplicationError, ErrorPseudoCursor),
	}
}

type CursorFetchLengthError struct {
	*BaseError
}

func NewCursorFetchLengthError(cursor parser.Identifier, returnLen int) error {
	return &CursorFetchLengthError{
		NewBaseError(cursor, fmt.Sprintf(ErrMsgCursorFetchLength, cursor, FormatCount(returnLen, "value")), ReturnCodeApplicationError, ErrorCursorFetchLength),
	}
}

type InvalidFetchPositionError struct {
	*BaseError
}

func NewInvalidFetchPositionError(position parser.FetchPosition) error {
	return &InvalidFetchPositionError{
		NewBaseError(position, fmt.Sprintf(ErrMsgInvalidFetchPosition, position.Number), ReturnCodeApplicationError, ErrorInvalidFetchPosition),
	}
}

type InLineTableRedefinedError struct {
	*BaseError
}

func NewInLineTableRedefinedError(table parser.Identifier) error {
	return &InLineTableRedefinedError{
		NewBaseError(table, fmt.Sprintf(ErrMsgInlineTableRedefined, table), ReturnCodeApplicationError, ErrorInlineTableRedefined),
	}
}

type UndefinedInLineTableError struct {
	*BaseError
}

func NewUndefinedInLineTableError(table parser.Identifier) error {
	return &UndefinedInLineTableError{
		NewBaseError(table, fmt.Sprintf(ErrMsgUndefinedInlineTable, table), ReturnCodeApplicationError, ErrorUndefinedInlineTable),
	}
}

type InlineTableFieldLengthError struct {
	*BaseError
}

func NewInlineTableFieldLengthError(query parser.SelectQuery, table parser.Identifier, fieldLen int) error {
	selectClause := searchSelectClause(query)

	return &InlineTableFieldLengthError{
		NewBaseError(selectClause, fmt.Sprintf(ErrMsgInlineTableFieldLength, FormatCount(fieldLen, "field"), table), ReturnCodeApplicationError, ErrorInlineTableFieldLength),
	}
}

type FileNotExistError struct {
	*BaseError
}

func NewFileNotExistError(file parser.QueryExpression) error {
	return &FileNotExistError{
		NewBaseError(file, fmt.Sprintf(ErrMsgFileNotExist, file), ReturnCodeIOError, ErrorFileNotExist),
	}
}

type FileAlreadyExistError struct {
	*BaseError
}

func NewFileAlreadyExistError(file parser.Identifier) error {
	return &FileAlreadyExistError{
		NewBaseError(file, fmt.Sprintf(ErrMsgFileAlreadyExist, file), ReturnCodeIOError, ErrorFileAlreadyExist),
	}
}

type FileUnableToReadError struct {
	*BaseError
}

func NewFileUnableToReadError(file parser.Identifier) error {
	return &FileUnableToReadError{
		NewBaseError(file, fmt.Sprintf(ErrMsgFileUnableToRead, file), ReturnCodeIOError, ErrorFileUnableToRead),
	}
}

type FileLockTimeoutError struct {
	*BaseError
}

func NewFileLockTimeoutError(file parser.Identifier) error {
	return &FileLockTimeoutError{
		NewBaseError(file, fmt.Sprintf(ErrMsgFileLockTimeout, file.Literal), ReturnCodeContextDone, ErrorFileLockTimeout),
	}
}

type FileNameAmbiguousError struct {
	*BaseError
}

func NewFileNameAmbiguousError(file parser.Identifier) error {
	return &FileNameAmbiguousError{
		NewBaseError(file, fmt.Sprintf(ErrMsgFileNameAmbiguous, file), ReturnCodeApplicationError, ErrorFileNameAmbiguous),
	}
}

type DataParsingError struct {
	*BaseError
}

func NewDataParsingError(file parser.QueryExpression, filepath string, message string) error {
	return &DataParsingError{
		NewBaseError(file, fmt.Sprintf(ErrMsgDataParsing, filepath, message), ReturnCodeApplicationError, ErrorDataParsing),
	}
}

type DataEncodingError struct {
	*BaseError
}

func NewDataEncodingError(message string) error {
	return &DataEncodingError{
		NewBaseErrorWithPrefix("", fmt.Sprintf(ErrMsgDataEncoding, message), ReturnCodeApplicationError, ErrorDataEncoding),
	}
}

type TableFieldLengthError struct {
	*BaseError
}

func NewTableFieldLengthError(query parser.SelectQuery, table parser.Identifier, fieldLen int) error {
	selectClause := searchSelectClause(query)

	return &TableFieldLengthError{
		NewBaseError(selectClause, fmt.Sprintf(ErrMsgTableFieldLength, FormatCount(fieldLen, "field"), table), ReturnCodeApplicationError, ErrorTableFieldLength),
	}
}

type TemporaryTableRedeclaredError struct {
	*BaseError
}

func NewTemporaryTableRedeclaredError(table parser.Identifier) error {
	return &TemporaryTableRedeclaredError{
		NewBaseError(table, fmt.Sprintf(ErrMsgTemporaryTableRedeclared, table), ReturnCodeApplicationError, ErrorTemporaryTableRedeclared),
	}
}

type UndeclaredTemporaryTableError struct {
	*BaseError
}

func NewUndeclaredTemporaryTableError(table parser.QueryExpression) error {
	return &UndeclaredTemporaryTableError{
		NewBaseError(table, fmt.Sprintf(ErrMsgUndeclaredTemporaryTable, table), ReturnCodeApplicationError, ErrorUndeclaredTemporaryTable),
	}
}

type TemporaryTableFieldLengthError struct {
	*BaseError
}

func NewTemporaryTableFieldLengthError(query parser.SelectQuery, table parser.Identifier, fieldLen int) error {
	selectClause := searchSelectClause(query)

	return &TemporaryTableFieldLengthError{
		NewBaseError(selectClause, fmt.Sprintf(ErrMsgTemporaryTableFieldLength, FormatCount(fieldLen, "field"), table), ReturnCodeApplicationError, ErrorTemporaryTableFieldLength),
	}
}

type DuplicateTableNameError struct {
	*BaseError
}

func NewDuplicateTableNameError(table parser.Identifier) error {
	return &DuplicateTableNameError{
		NewBaseError(table, fmt.Sprintf(ErrMsgDuplicateTableName, table), ReturnCodeApplicationError, ErrorDuplicateTableName),
	}
}

type TableNotLoadedError struct {
	*BaseError
}

func NewTableNotLoadedError(table parser.Identifier) error {
	return &TableNotLoadedError{
		NewBaseError(table, fmt.Sprintf(ErrMsgTableNotLoaded, table), ReturnCodeApplicationError, ErrorTableNotLoaded),
	}
}

type StdinEmptyError struct {
	*BaseError
}

func NewStdinEmptyError(stdin parser.Stdin) error {
	return &StdinEmptyError{
		NewBaseError(stdin, ErrMsgStdinEmpty, ReturnCodeApplicationError, ErrorStdinEmpty),
	}
}

type InlineTableCannotBeUpdatedError struct {
	*BaseError
}

func NewInlineTableCannotBeUpdatedError(expr parser.QueryExpression) error {
	return &InlineTableCannotBeUpdatedError{
		NewBaseError(expr, ErrMsgInlineTableCannotBeUpdated, ReturnCodeApplicationError, ErrorInlineTableCannotBeUpdated),
	}
}

type AliasMustBeSpecifiedForUpdateError struct {
	*BaseError
}

func NewAliasMustBeSpecifiedForUpdateError(expr parser.QueryExpression) error {
	return &AliasMustBeSpecifiedForUpdateError{
		NewBaseError(expr, ErrMsgAliasMustBeSpecifiedForUpdate, ReturnCodeApplicationError, ErrorAliasMustBeSpecifiedForUpdate),
	}
}

type RowValueLengthInComparisonError struct {
	*BaseError
}

func NewRowValueLengthInComparisonError(expr parser.QueryExpression, valueLen int) error {
	return &RowValueLengthInComparisonError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgRowValueLengthInComparison, FormatCount(valueLen, "value")), ReturnCodeApplicationError, ErrorRowValueLengthInComparison),
	}
}

type SelectFieldLengthInComparisonError struct {
	*BaseError
}

func NewSelectFieldLengthInComparisonError(query parser.Subquery, valueLen int) error {
	return &SelectFieldLengthInComparisonError{
		NewBaseError(query, fmt.Sprintf(ErrMsgFieldLengthInComparison, FormatCount(valueLen, "field")), ReturnCodeApplicationError, ErrorFieldLengthInComparison),
	}
}

type InvalidLimitPercentageError struct {
	*BaseError
}

func NewInvalidLimitPercentageError(clause parser.LimitClause) error {
	return &InvalidLimitPercentageError{
		NewBaseError(clause, fmt.Sprintf(ErrMsgInvalidLimitPercentage, clause.Value), ReturnCodeApplicationError, ErrorInvalidLimitPercentage),
	}
}

type InvalidLimitNumberError struct {
	*BaseError
}

func NewInvalidLimitNumberError(clause parser.LimitClause) error {
	return &InvalidLimitNumberError{
		NewBaseError(clause, fmt.Sprintf(ErrMsgInvalidLimitNumber, clause.Value), ReturnCodeApplicationError, ErrorInvalidLimitNumber),
	}
}

type InvalidOffsetNumberError struct {
	*BaseError
}

func NewInvalidOffsetNumberError(clause parser.OffsetClause) error {
	return &InvalidOffsetNumberError{
		NewBaseError(clause, fmt.Sprintf(ErrMsgInvalidOffsetNumber, clause.Value), ReturnCodeApplicationError, ErrorInvalidOffsetNumber),
	}
}

type CombinedSetFieldLengthError struct {
	*BaseError
}

func NewCombinedSetFieldLengthError(selectEntity parser.QueryExpression, fieldLen int) error {
	selectClause := searchSelectClauseInSelectEntity(selectEntity)

	return &CombinedSetFieldLengthError{
		NewBaseError(selectClause, fmt.Sprintf(ErrMsgCombinedSetFieldLength, FormatCount(fieldLen, "field")), ReturnCodeApplicationError, ErrorCombinedSetFieldLength),
	}
}

type RecursionExceededLimitError struct {
	*BaseError
}

func NewRecursionExceededLimitError(selectEntity parser.QueryExpression, limit int64) error {
	selectClause := searchSelectClauseInSelectEntity(selectEntity)

	return &RecursionExceededLimitError{
		NewBaseError(selectClause, fmt.Sprintf(ErrMsgRecursionExceededLimit, limit), ReturnCodeApplicationError, ErrorRecursionExceededLimit),
	}
}

type NestedRecursionError struct {
	*BaseError
}

func NewNestedRecursionError(expr parser.QueryExpression) error {
	return &RecursionExceededLimitError{
		NewBaseError(expr, ErrMsgNestedRecursion, ReturnCodeApplicationError, ErrorNestedRecursion),
	}
}

type InsertRowValueLengthError struct {
	*BaseError
}

func NewInsertRowValueLengthError(rowValue parser.RowValue, valueLen int) error {
	return &InsertRowValueLengthError{
		NewBaseError(rowValue, fmt.Sprintf(ErrMsgInsertRowValueLength, FormatCount(valueLen, "value")), ReturnCodeApplicationError, ErrorInsertRowValueLength),
	}
}

type InsertSelectFieldLengthError struct {
	*BaseError
}

func NewInsertSelectFieldLengthError(query parser.SelectQuery, fieldLen int) error {
	selectClause := searchSelectClause(query)

	return &InsertSelectFieldLengthError{
		NewBaseError(selectClause, fmt.Sprintf(ErrMsgInsertSelectFieldLength, FormatCount(fieldLen, "field")), ReturnCodeApplicationError, ErrorInsertSelectFieldLength),
	}
}

type UpdateFieldNotExistError struct {
	*BaseError
}

func NewUpdateFieldNotExistError(field parser.QueryExpression) error {
	return &UpdateFieldNotExistError{
		NewBaseError(field, fmt.Sprintf(ErrMsgUpdateFieldNotExist, field), ReturnCodeApplicationError, ErrorUpdateFieldNotExist),
	}
}

type UpdateValueAmbiguousError struct {
	*BaseError
}

func NewUpdateValueAmbiguousError(field parser.QueryExpression, value parser.QueryExpression) error {
	return &UpdateValueAmbiguousError{
		NewBaseError(field, fmt.Sprintf(ErrMsgUpdateValueAmbiguous, value, field), ReturnCodeApplicationError, ErrorUpdateValueAmbiguous),
	}
}

type ReplaceKeyNotSetError struct {
	*BaseError
}

func NewReplaceKeyNotSetError(key parser.QueryExpression) error {
	return &ReplaceKeyNotSetError{
		NewBaseError(key, fmt.Sprintf(ErrMsgReplaceKeyNotSet, key), ReturnCodeApplicationError, ErrorReplaceKeyNotSet),
	}
}

type DeleteTableNotSpecifiedError struct {
	*BaseError
}

func NewDeleteTableNotSpecifiedError(query parser.DeleteQuery) error {
	return &DeleteTableNotSpecifiedError{
		NewBaseError(query, ErrMsgDeleteTableNotSpecified, ReturnCodeApplicationError, ErrorDeleteTableNotSpecified),
	}
}

type ShowInvalidObjectTypeError struct {
	*BaseError
}

func NewShowInvalidObjectTypeError(expr parser.Expression, objectType string) error {
	return &ShowInvalidObjectTypeError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgShowInvalidObjectType, objectType), ReturnCodeApplicationError, ErrorShowInvalidObjectType),
	}
}

type ReplaceValueLengthError struct {
	*BaseError
}

func NewReplaceValueLengthError(expr parser.Expression, message string) error {
	return &ReplaceValueLengthError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgReplaceValueLength, message), ReturnCodeApplicationError, ErrorReplaceValueLength),
	}
}

type SourceInvalidFilePathError struct {
	*BaseError
}

func NewSourceInvalidFilePathError(source parser.Source, arg parser.QueryExpression) error {
	return &SourceInvalidFilePathError{
		NewBaseError(source, fmt.Sprintf(ErrMsgSourceInvalidFilePath, arg), ReturnCodeApplicationError, ErrorSourceInvalidFilePath),
	}
}

type InvalidFlagNameError struct {
	*BaseError
}

func NewInvalidFlagNameError(expr parser.Flag) error {
	return &InvalidFlagNameError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgInvalidFlagName, expr.String()), ReturnCodeApplicationError, ErrorInvalidFlagName),
	}
}

type InvalidRuntimeInformationError struct {
	*BaseError
}

func NewInvalidRuntimeInformationError(expr parser.RuntimeInformation) error {
	return &InvalidRuntimeInformationError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgInvalidRuntimeInformation, expr), ReturnCodeApplicationError, ErrorInvalidRuntimeInformation),
	}
}

type FlagValueNotAllowedFormatError struct {
	*BaseError
}

func NewFlagValueNotAllowedFormatError(setFlag parser.SetFlag) error {
	return &FlagValueNotAllowedFormatError{
		NewBaseError(setFlag, fmt.Sprintf(ErrMsgFlagValueNowAllowedFormat, setFlag.Value, setFlag.Flag.String()), ReturnCodeApplicationError, ErrorFlagValueNowAllowedFormat),
	}
}

type InvalidFlagValueError struct {
	*BaseError
}

func NewInvalidFlagValueError(expr parser.SetFlag, message string) error {
	return &InvalidFlagValueError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgInvalidFlagValue, message), ReturnCodeApplicationError, ErrorInvalidFlagValue),
	}
}

type AddFlagNotSupportedNameError struct {
	*BaseError
}

func NewAddFlagNotSupportedNameError(expr parser.AddFlagElement) error {
	return &AddFlagNotSupportedNameError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgAddFlagNotSupportedName, expr.Flag.String()), ReturnCodeApplicationError, ErrorAddFlagNotSupportedName),
	}
}

type RemoveFlagNotSupportedNameError struct {
	*BaseError
}

func NewRemoveFlagNotSupportedNameError(expr parser.RemoveFlagElement) error {
	return &RemoveFlagNotSupportedNameError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgRemoveFlagNotSupportedName, expr.Flag.String()), ReturnCodeApplicationError, ErrorRemoveFlagNotSupportedName),
	}
}

type InvalidFlagValueToBeRemoveError struct {
	*BaseError
}

func NewInvalidFlagValueToBeRemovedError(unsetFlag parser.RemoveFlagElement) error {
	return &InvalidFlagValueToBeRemoveError{
		NewBaseError(unsetFlag, fmt.Sprintf(ErrMsgInvalidFlagValueToBeRemoved, unsetFlag.Value, unsetFlag.Flag.String()), ReturnCodeApplicationError, ErrorInvalidFlagValueToBeRemoved),
	}
}

type NotTableError struct {
	*BaseError
}

func NewNotTableError(expr parser.QueryExpression) error {
	return &NotTableError{
		NewBaseError(expr, ErrMsgNotTable, ReturnCodeApplicationError, ErrorNotTable),
	}
}

type InvalidTableAttributeNameError struct {
	*BaseError
}

func NewInvalidTableAttributeNameError(expr parser.Identifier) error {
	return &InvalidTableAttributeNameError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgInvalidTableAttributeName, expr), ReturnCodeApplicationError, ErrorInvalidTableAttributeName),
	}
}

type TableAttributeValueNotAllowedFormatError struct {
	*BaseError
}

func NewTableAttributeValueNotAllowedFormatError(expr parser.SetTableAttribute) error {
	return &TableAttributeValueNotAllowedFormatError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgTableAttributeValueNotAllowedFormat, expr.Value, expr.Attribute), ReturnCodeApplicationError, ErrorTableAttributeValueNotAllowedFormat),
	}
}

type InvalidTableAttributeValueError struct {
	*BaseError
}

func NewInvalidTableAttributeValueError(expr parser.SetTableAttribute, message string) error {
	return &InvalidTableAttributeValueError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgInvalidTableAttributeValue, message), ReturnCodeApplicationError, ErrorInvalidTableAttributeValue),
	}
}

type InvalidEventNameError struct {
	*BaseError
}

func NewInvalidEventNameError(expr parser.Identifier) error {
	return &InvalidEventNameError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgInvalidEventName, expr), ReturnCodeApplicationError, ErrorInvalidEventName),
	}
}

type InternalRecordIdNotExistError struct {
	*BaseError
}

func NewInternalRecordIdNotExistError() error {
	return &InternalRecordIdNotExistError{
		NewBaseError(parser.NewNullValue(), ErrMsgInternalRecordIdNotExist, ReturnCodeApplicationError, ErrorInternalRecordIdNotExist),
	}
}

type InternalRecordIdEmptyError struct {
	*BaseError
}

func NewInternalRecordIdEmptyError() error {
	return &InternalRecordIdEmptyError{
		NewBaseError(parser.NewNullValue(), ErrMsgInternalRecordIdEmpty, ReturnCodeApplicationError, ErrorInternalRecordIdEmpty),
	}
}

type FieldLengthNotMatchError struct {
	*BaseError
}

func NewFieldLengthNotMatchError(expr parser.QueryExpression) error {
	return &FieldLengthNotMatchError{
		NewBaseError(expr, ErrMsgFieldLengthNotMatch, ReturnCodeApplicationError, ErrorFieldLengthNotMatch),
	}
}

type RowValueLengthInListError struct {
	*BaseError
	Index int
}

func NewRowValueLengthInListError(i int) error {
	return &RowValueLengthInListError{
		BaseError: NewBaseError(parser.NewNullValue(), fmt.Sprintf(ErrMsgRowValueLengthInList, i), ReturnCodeApplicationError, ErrorRowValueLengthInList),
		Index:     i,
	}
}

type FormatStringLengthNotMatchError struct {
	*BaseError
}

func NewFormatStringLengthNotMatchError() error {
	return &FormatStringLengthNotMatchError{
		BaseError: NewBaseError(parser.NewNullValue(), ErrMsgFormatStringLengthNotMatch, ReturnCodeApplicationError, ErrorFormatStringLengthNotMatch),
	}
}

type UnknownFormatPlaceholderError struct {
	*BaseError
}

func NewUnknownFormatPlaceholderError(placeholder rune) error {
	return &UnknownFormatPlaceholderError{
		BaseError: NewBaseError(parser.NewNullValue(), fmt.Sprintf(ErrMsgUnknownFormatPlaceholder, string(placeholder)), ReturnCodeApplicationError, ErrorUnknownFormatPlaceholder),
	}
}

type FormatUnexpectedTerminationError struct {
	*BaseError
}

func NewFormatUnexpectedTerminationError() error {
	return &FormatUnexpectedTerminationError{
		BaseError: NewBaseError(parser.NewNullValue(), ErrMsgFormatUnexpectedTermination, ReturnCodeApplicationError, ErrorFormatUnexpectedTermination),
	}
}

type ExternalCommandError struct {
	*BaseError
}

func NewExternalCommandError(expr parser.Expression, message string) error {
	return &ExternalCommandError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgExternalCommand, message), ReturnCodeSystemError, ErrorExternalCommand),
	}
}

type HttpRequestError struct {
	*BaseError
}

func NewHttpRequestError(expr parser.Expression, url string, message string) error {
	return &HttpRequestError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgHttpRequest, url, message), ReturnCodeSystemError, ErrorHttpRequestError),
	}
}

type InvalidReloadTypeError struct {
	*BaseError
}

func NewInvalidReloadTypeError(expr parser.Reload, name string) error {
	return &InvalidReloadTypeError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgInvalidReloadType, name), ReturnCodeApplicationError, ErrorInvalidReloadType),
	}
}

type LoadConfigurationError struct {
	*BaseError
}

func NewLoadConfigurationError(expr parser.Expression, message string) error {
	return &LoadConfigurationError{
		NewBaseError(expr, fmt.Sprintf(ErrMsgLoadConfiguration, message), ReturnCodeApplicationError, ErrorLoadConfiguration),
	}
}

type DuplicateStatementNameError struct {
	*BaseError
}

func NewDuplicateStatementNameError(name parser.Identifier) error {
	return &DuplicateStatementNameError{
		NewBaseError(name, fmt.Sprintf(ErrMsgDuplicateStatementName, name.Literal), ReturnCodeApplicationError, ErrorDuplicateStatementName),
	}
}

type StatementNotExistError struct {
	*BaseError
}

func NewStatementNotExistError(name parser.Identifier) error {
	return &DuplicateStatementNameError{
		NewBaseError(name, fmt.Sprintf(ErrMsgStatementNotExist, name.Literal), ReturnCodeApplicationError, ErrorStatementNotExist),
	}
}

type StatementReplaceValueNotSpecifiedError struct {
	*BaseError
}

func NewStatementReplaceValueNotSpecifiedError(placeholder parser.Placeholder) error {
	return &StatementReplaceValueNotSpecifiedError{
		NewBaseError(placeholder, fmt.Sprintf(ErrMsgStatementReplaceValueNotSpecified, placeholder), ReturnCodeApplicationError, ErrorStatementReplaceValueNotSpecified),
	}
}

type SelectIntoQueryFieldLengthNotMatchError struct {
	*BaseError
}

func NewSelectIntoQueryFieldLengthNotMatchError(query parser.SelectQuery, fieldLen int) error {
	selectClause := searchSelectClause(query)

	return &SelectIntoQueryFieldLengthNotMatchError{
		NewBaseError(selectClause, fmt.Sprintf(ErrMsgSelectIntoQueryFieldLengthNotMatch, FormatCount(fieldLen, "field")), ReturnCodeApplicationError, ErrorSelectIntoQueryFieldLengthNotMatch),
	}
}

type SelectIntoQueryTooManyRecordsError struct {
	*BaseError
}

func NewSelectIntoQueryTooManyRecordsError(query parser.SelectQuery) error {
	selectClause := searchSelectClause(query)

	return &SelectIntoQueryTooManyRecordsError{
		NewBaseError(selectClause, ErrMsgSelectIntoQueryTooManyRecords, ReturnCodeApplicationError, ErrorSelectIntoQueryTooManyRecords),
	}
}

type IntegerDevidedByZeroError struct {
	*BaseError
}

func NewIntegerDevidedByZeroError(expr parser.Arithmetic) error {
	return &IntegerDevidedByZeroError{
		NewBaseError(expr, ErrMsgIntegerDevidedByZero, ReturnCodeApplicationError, ErrorIntegerDevidedByZero),
	}
}

func searchSelectClause(query parser.SelectQuery) parser.SelectClause {
	return searchSelectClauseInSelectEntity(query.SelectEntity)
}

func searchSelectClauseInSelectEntity(selectEntity parser.QueryExpression) parser.SelectClause {
	if entity, ok := selectEntity.(parser.SelectEntity); ok {
		return entity.SelectClause.(parser.SelectClause)
	}
	return searchSelectClauseInSelectSetEntity(selectEntity.(parser.SelectSet).LHS)
}

func searchSelectClauseInSelectSetEntity(selectSetEntity parser.QueryExpression) parser.SelectClause {
	if subquery, ok := selectSetEntity.(parser.Subquery); ok {
		return searchSelectClause(subquery.Query)
	}
	return searchSelectClauseInSelectEntity(selectSetEntity)
}

func ConvertFileHandlerError(err error, ident parser.Identifier) error {
	switch err.(type) {
	case *file.TimeoutError:
		err = NewFileLockTimeoutError(ident)
	case *file.ContextCanceled:
		err = NewContextCanceled(err.Error())
	case *file.ContextDone:
		err = NewContextDone(err.Error())
	case *file.NotExistError:
		err = NewFileNotExistError(ident)
	case *file.AlreadyExistError:
		err = NewFileAlreadyExistError(ident)
	default:
		err = NewIOError(ident, err.Error())
	}
	return err
}

func ConvertLoadConfigurationError(err error) error {
	switch err.(type) {
	case *file.ContextDone:
		err = NewContextDone(err.Error())
	default:
		err = NewLoadConfigurationError(nil, err.Error())
	}
	return err
}

func ConvertContextError(err error) error {
	if err == context.Canceled {
		return NewContextCanceled(err.Error())
	}
	return NewContextDone(err.Error())
}
