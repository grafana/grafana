package optimizer

import (
	"fmt"
	"reflect"
	"strings"

	. "github.com/expr-lang/expr/ast"
	"github.com/expr-lang/expr/file"
)

var errorType = reflect.TypeOf((*error)(nil)).Elem()

type constExpr struct {
	applied bool
	err     error
	fns     map[string]reflect.Value
}

func (c *constExpr) Visit(node *Node) {
	defer func() {
		if r := recover(); r != nil {
			msg := fmt.Sprintf("%v", r)
			// Make message more actual, it's a runtime error, but at compile step.
			msg = strings.Replace(msg, "runtime error:", "compile error:", 1)
			c.err = &file.Error{
				Location: (*node).Location(),
				Message:  msg,
			}
		}
	}()

	if call, ok := (*node).(*CallNode); ok {
		if name, ok := call.Callee.(*IdentifierNode); ok {
			fn, ok := c.fns[name.Value]
			if ok {
				in := make([]reflect.Value, len(call.Arguments))
				for i := 0; i < len(call.Arguments); i++ {
					arg := call.Arguments[i]
					var param any

					switch a := arg.(type) {
					case *NilNode:
						param = nil
					case *IntegerNode:
						param = a.Value
					case *FloatNode:
						param = a.Value
					case *BoolNode:
						param = a.Value
					case *StringNode:
						param = a.Value
					case *ConstantNode:
						param = a.Value

					default:
						return // Const expr optimization not applicable.
					}

					if param == nil && reflect.TypeOf(param) == nil {
						// In case of nil value and nil type use this hack,
						// otherwise reflect.Call will panic on zero value.
						in[i] = reflect.ValueOf(&param).Elem()
					} else {
						in[i] = reflect.ValueOf(param)
					}
				}

				out := fn.Call(in)
				value := out[0].Interface()
				if len(out) == 2 && out[1].Type() == errorType && !out[1].IsNil() {
					c.err = out[1].Interface().(error)
					return
				}
				constNode := &ConstantNode{Value: value}
				patchWithType(node, constNode)
				c.applied = true
			}
		}
	}
}
