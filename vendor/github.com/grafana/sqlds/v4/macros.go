package sqlds

import (
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
)

var (
	ErrorParsingMacroBrackets = errors.New("failed to parse macro arguments (missing close bracket?)")
)

// MacroFunc defines a signature for applying a query macro
// Query macro implementations are defined by users / consumers of this package
// Deprecated: use sqlutil.MacroFunc directly
type MacroFunc = sqlutil.MacroFunc

// Macros is a list of MacroFuncs.
// The "string" key is the name of the macro function. This name has to be regex friendly.
// Deprecated: use sqlutil.Macros directly
type Macros = sqlutil.Macros

// Deprecated: use sqlutil.DefaultMacros directly
var DefaultMacros = sqlutil.DefaultMacros

// Interpolate wraps sqlutil.Interpolate for temporary backwards-compatibility
// Deprecated: use sqlutil.Interpolate directly
func Interpolate(driver Driver, query *Query) (string, error) {
	return sqlutil.Interpolate(query, driver.Macros())
}
