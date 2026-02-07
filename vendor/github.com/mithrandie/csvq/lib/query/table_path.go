package query

import (
	"context"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"
)

type DataObject struct {
	*parser.BaseExpr
	Raw string
}

func (o DataObject) String() string {
	return o.Raw
}

type HttpObject struct {
	*parser.BaseExpr
	URL string
}

func (o HttpObject) String() string {
	return o.URL
}

func ParseTableName(ctx context.Context, scope *ReferenceScope, table parser.Table) (parser.Identifier, error) {
	if table.Alias != nil {
		return table.Alias.(parser.Identifier), nil
	}

	name := parser.Identifier{
		BaseExpr: table.Object.GetBaseExpr(),
	}

	tableObject, err := NormalizeTableObject(ctx, scope, table.Object)
	if err != nil {
		return name, err
	}

	switch obj := tableObject.(type) {
	case parser.Identifier:
		name.Literal = FormatTableName(obj.Literal)
	case parser.Stdin:
		name.Literal = obj.String()
	case parser.FormatSpecifiedFunction:
		return ParseTableName(ctx, scope, parser.Table{Object: obj.Path})
	default:
		// Do Nothing
	}
	return name, nil
}

func NormalizeTableObject(ctx context.Context, scope *ReferenceScope, tableObject parser.QueryExpression) (parser.QueryExpression, error) {
	if tableFunction, ok := tableObject.(parser.TableFunction); ok {
		p, err := ConvertTableFunction(ctx, scope, tableFunction)
		if err != nil {
			return nil, err
		}
		tableObject = p
	}

	if urlExpr, ok := tableObject.(parser.Url); ok {
		p, err := ConvertUrlExpr(urlExpr)
		if err != nil {
			return nil, err
		}
		tableObject = p
	}

	return tableObject, nil
}

func ConvertTableFunction(ctx context.Context, scope *ReferenceScope, tableFunction parser.TableFunction) (parser.QueryExpression, error) {
	name := strings.ToUpper(tableFunction.Name)

	switch name {
	case "FILE", "INLINE", "URL", "DATA":
		if len(tableFunction.Args) != 1 {
			return nil, NewFunctionArgumentLengthError(tableFunction, strings.ToUpper(tableFunction.Name), []int{1})
		}
	default:
		return nil, NewFunctionNotExistError(tableFunction, strings.ToUpper(tableFunction.Name))
	}

	args := make([]value.Primary, len(tableFunction.Args))
	for i, v := range tableFunction.Args {
		arg, err := Evaluate(ctx, scope, v)
		if err != nil {
			return nil, err
		}
		args[i] = arg
	}

	var expr parser.QueryExpression

	switch name {
	case "FILE", "INLINE":
		p := value.ToString(args[0])
		if value.IsNull(p) {
			return nil, NewFunctionInvalidArgumentError(tableFunction, strings.ToUpper(tableFunction.Name), "the first argument must be a string")
		}
		expr = parser.Identifier{BaseExpr: tableFunction.GetBaseExpr(), Literal: p.(*value.String).Raw()}
	case "URL":
		p := value.ToString(args[0])
		if value.IsNull(p) {
			return nil, NewFunctionInvalidArgumentError(tableFunction, strings.ToUpper(tableFunction.Name), "the first argument must be a string")
		}
		expr = parser.Url{BaseExpr: tableFunction.GetBaseExpr(), Raw: p.(*value.String).Raw()}
	case "DATA":
		p := value.ToString(args[0])
		if value.IsNull(p) {
			return nil, NewFunctionInvalidArgumentError(tableFunction, strings.ToUpper(tableFunction.Name), "the first argument must be a string")
		}
		expr = DataObject{BaseExpr: tableFunction.GetBaseExpr(), Raw: p.(*value.String).Raw()}
	}
	return expr, nil
}

func ConvertUrlExpr(urlExpr parser.Url) (parser.QueryExpression, error) {
	u, e := url.Parse(urlExpr.Raw)
	if e != nil {
		return nil, NewInvalidUrlError(urlExpr)
	}

	switch u.Scheme {
	case "http", "https":
		return HttpObject{BaseExpr: urlExpr.GetBaseExpr(), URL: u.String()}, nil
	case "file":
		path := u.Path
		var err error

		if strings.HasPrefix(u.String(), "file://") {
			if 0 < len(u.Host) {
				return nil, NewInvalidUrlError(urlExpr)
			}
			if u.IsAbs() && 0 < len(path) && !filepath.IsAbs(path) {
				path = path[1:]
			}
		} else {
			path = u.String()[5:]
		}

		if len(path) < 1 {
			path = "."
		}

		path, err = url.PathUnescape(path)
		if err != nil {
			return nil, NewInvalidUrlError(urlExpr)
		}

		return parser.Identifier{BaseExpr: urlExpr.GetBaseExpr(), Literal: path}, nil
	}
	return nil, NewUnsupportedUrlSchemeError(urlExpr, u.Scheme)
}
