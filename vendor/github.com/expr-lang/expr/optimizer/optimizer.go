package optimizer

import (
	"fmt"
	"reflect"

	. "github.com/expr-lang/expr/ast"
	"github.com/expr-lang/expr/conf"
)

func Optimize(node *Node, config *conf.Config) error {
	Walk(node, &inArray{})
	for limit := 1000; limit >= 0; limit-- {
		fold := &fold{}
		Walk(node, fold)
		if fold.err != nil {
			return fold.err
		}
		if !fold.applied {
			break
		}
	}
	if config != nil && len(config.ConstFns) > 0 {
		for limit := 100; limit >= 0; limit-- {
			constExpr := &constExpr{
				fns: config.ConstFns,
			}
			Walk(node, constExpr)
			if constExpr.err != nil {
				return constExpr.err
			}
			if !constExpr.applied {
				break
			}
		}
	}
	Walk(node, &inRange{})
	Walk(node, &filterMap{})
	Walk(node, &filterLen{})
	Walk(node, &filterLast{})
	Walk(node, &filterFirst{})
	Walk(node, &predicateCombination{})
	Walk(node, &sumArray{})
	Walk(node, &sumMap{})
	return nil
}

var (
	boolType    = reflect.TypeOf(true)
	integerType = reflect.TypeOf(0)
	floatType   = reflect.TypeOf(float64(0))
	stringType  = reflect.TypeOf("")
)

func patchWithType(node *Node, newNode Node) {
	switch n := newNode.(type) {
	case *BoolNode:
		newNode.SetType(boolType)
	case *IntegerNode:
		newNode.SetType(integerType)
	case *FloatNode:
		newNode.SetType(floatType)
	case *StringNode:
		newNode.SetType(stringType)
	case *ConstantNode:
		newNode.SetType(reflect.TypeOf(n.Value))
	case *BinaryNode:
		newNode.SetType(n.Type())
	default:
		panic(fmt.Sprintf("unknown type %T", newNode))
	}
	Patch(node, newNode)
}

func patchCopyType(node *Node, newNode Node) {
	t := (*node).Type()
	newNode.SetType(t)
	Patch(node, newNode)
}
