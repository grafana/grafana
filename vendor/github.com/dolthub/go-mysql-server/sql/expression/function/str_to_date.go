package function

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/planbuilder/dateparse"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// StrToDate defines the built-in function STR_TO_DATE(str, format)
type StrToDate struct {
	Date   sql.Expression
	Format sql.Expression
}

var _ sql.FunctionExpression = (*StrToDate)(nil)
var _ sql.CollationCoercible = (*StrToDate)(nil)

// NewStrToDate constructs a new function expression from the given child expressions.
func NewStrToDate(arg1, arg2 sql.Expression) sql.Expression {
	return &StrToDate{
		Date:   arg1,
		Format: arg2,
	}
}

func (s *StrToDate) FunctionName() string {
	return "str_to_date"
}

// Description implements sql.FunctionExpression
func (s *StrToDate) Description() string {
	return "parses the date/datetime/timestamp expression according to the format specifier."
}

// Resolved returns whether the node is resolved.
func (s *StrToDate) Resolved() bool {
	dateResolved := s.Date == nil || s.Date.Resolved()
	formatResolved := s.Format == nil || s.Format.Resolved()
	return dateResolved && formatResolved
}

func (s *StrToDate) String() string {
	return fmt.Sprintf("%s(%s,%s)", s.FunctionName(), s.Date, s.Format)
}

// Type returns the expression type.
func (s *StrToDate) Type() sql.Type {
	// TODO: depending on the format, the return type can be a date, datetime or timestamp
	//  just make best guess for now
	formatLit, isLit := s.Format.(*expression.Literal)
	if !isLit {
		return types.Datetime
	}
	format, err := formatLit.Eval(nil, nil)
	if err != nil {
		return types.Datetime
	}
	formatStr, isStr := format.(string)
	if !isStr {
		return types.Datetime
	}

	hasDate, hasTime, err := dateparse.HasDateOrTime(formatStr)
	if err != nil {
		return types.Datetime
	}
	if hasDate && hasTime {
		return types.Datetime
	}
	if hasDate {
		return types.Date
	}
	if hasTime {
		return types.Time
	}
	return types.Datetime
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*StrToDate) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// IsNullable returns whether the expression can be null.
func (s *StrToDate) IsNullable() bool {
	return true
}

// Children returns the children expressions of this expression.
func (s *StrToDate) Children() []sql.Expression {
	return []sql.Expression{s.Date, s.Format}
}

func (s *StrToDate) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("STR_TO_DATE", 2, len(children))
	}
	return NewStrToDate(children[0], children[1]), nil
}

// Eval evaluates the given row and returns a result.
func (s *StrToDate) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	date, err := s.Date.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	format, err := s.Format.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	dateStr, ok := date.(string)
	if !ok {
		// TODO: improve this error
		return nil, sql.ErrInvalidType.New(fmt.Sprintf("%T", date))
	}
	formatStr, ok := format.(string)
	if !ok {
		// TODO: improve this error
		return nil, sql.ErrInvalidType.New(fmt.Sprintf("%T", formatStr))
	}

	goTime, err := dateparse.ParseDateWithFormat(dateStr, formatStr)
	if err != nil {
		ctx.Warn(1411, "Incorrect value: '%s' for function %s", dateStr, s.FunctionName())
		return nil, nil
	}

	// zero dates '0000-00-00' and '2010-00-13' are allowed,
	// but depends on strict sql_mode with NO_ZERO_DATE or NO_ZERO_IN_DATE modes enabled.
	return goTime, nil
}
