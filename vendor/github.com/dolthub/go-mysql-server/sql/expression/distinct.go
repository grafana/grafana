package expression

import (
	"fmt"

	"github.com/cespare/xxhash/v2"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type DistinctExpression struct {
	seen    sql.KeyValueCache
	dispose sql.DisposeFunc
	Child   sql.Expression
	seenNil bool
}

var _ sql.Expression = (*DistinctExpression)(nil)
var _ sql.Disposable = (*DistinctExpression)(nil)
var _ sql.CollationCoercible = (*DistinctExpression)(nil)

func NewDistinctExpression(e sql.Expression) *DistinctExpression {
	return &DistinctExpression{
		Child: e,
	}
}

func (de *DistinctExpression) seenValue(ctx *sql.Context, value interface{}) (bool, error) {
	if de.seen == nil {
		cache, dispose := ctx.Memory.NewHistoryCache()
		de.seen = cache
		de.dispose = dispose
	}

	// nil values can't be hashed, so we need a member variable to track them
	if value == nil {
		if de.seenNil {
			return false, nil
		}
		de.seenNil = true
		return true, nil
	}

	v, _, err := types.Text.Convert(ctx, value)
	if err != nil {
		return false, err
	}
	str, ok := v.(string)
	if !ok {
		return false, fmt.Errorf("distinct unable to hash value: %s", err)
	}

	hash := xxhash.New()
	_, err = hash.WriteString(str)
	if err != nil {
		return false, err
	}
	h := hash.Sum64()

	if _, err = de.seen.Get(h); err == nil {
		return false, nil
	}

	if err = de.seen.Put(h, struct{}{}); err != nil {
		return false, err
	}

	return true, nil
}

func (de *DistinctExpression) Dispose() {
	if de.dispose != nil {
		de.dispose()
	}

	de.dispose = nil
	de.seen = nil
	de.seenNil = false
}

func (de *DistinctExpression) Resolved() bool {
	return de.Child.Resolved()
}

func (de *DistinctExpression) String() string {
	return fmt.Sprintf("DISTINCT %s", de.Child.String())
}

func (de *DistinctExpression) Type() sql.Type {
	return de.Child.Type()
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (de *DistinctExpression) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, de.Child)
}

func (de *DistinctExpression) IsNullable() bool {
	return false
}

// Returns the child value if the cache hasn't seen the value before otherwise returns nil.
// Since NULLs are ignored in aggregate expressions that use DISTINCT this is a valid return scheme.
func (de *DistinctExpression) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := de.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	should, err := de.seenValue(ctx, val)
	if err != nil {
		return nil, err
	}

	if should {
		return val, nil
	}

	return nil, nil
}

func (de *DistinctExpression) Children() []sql.Expression {
	return []sql.Expression{de.Child}
}

func (de *DistinctExpression) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, fmt.Errorf("DistinctExpression has an invalid number of children")
	}

	return &DistinctExpression{Child: children[0]}, nil
}
