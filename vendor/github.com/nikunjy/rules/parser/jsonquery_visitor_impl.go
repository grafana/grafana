package parser

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/antlr4-go/antlr/v4"
)

type objStack struct {
	items []interface{}
}

func (o *objStack) empty() bool {
	return len(o.items) == 0
}

func (o *objStack) peek() interface{} {
	return o.items[len(o.items)-1]
}

func (o *objStack) pop() interface{} {
	val := o.peek()
	o.items = o.items[:len(o.items)-1]
	return val
}

func (o *objStack) push(item interface{}) {
	o.items = append(o.items, item)
}

func (o *objStack) clear() {
	o.items = nil
}

type JsonQueryVisitorImpl struct {
	antlr.ParseTreeVisitor

	item map[string]interface{}

	stack *objStack

	currentOperation Operation
	leftOp           Operand
	rightOp          Operand

	err      error
	debugErr error
}

func NewJsonQueryVisitorImpl(item map[string]interface{}) *JsonQueryVisitorImpl {
	return &JsonQueryVisitorImpl{
		stack: &objStack{},
		item:  item,
	}
}

func (j *JsonQueryVisitorImpl) setDebugErr(err error) {
	j.debugErr = err
}

func (j *JsonQueryVisitorImpl) setErr(err error) {
	j.err = err
}

func (j *JsonQueryVisitorImpl) hasErr() bool {
	return j.err != nil
}

func (j *JsonQueryVisitorImpl) Visit(tree antlr.ParseTree) interface{} {
	if j.hasErr() {
		return false
	}
	switch val := tree.(type) {
	case *LogicalExpContext:
		return val.Accept(j).(bool)
	case *CompareExpContext:
		return val.Accept(j).(bool)
	case *ParenExpContext:
		return val.Accept(j).(bool)
	case *PresentExpContext:
		return val.Accept(j).(bool)
	default:
		j.setErr(errors.New("Invalid rule"))
		return false
	}
}

func (j *JsonQueryVisitorImpl) VisitParenExp(ctx *ParenExpContext) interface{} {
	result := ctx.Query().Accept(j).(bool)
	if ctx.NOT() != nil {
		return !result
	}
	return result
}

func (j *JsonQueryVisitorImpl) VisitLogicalExp(ctx *LogicalExpContext) interface{} {
	left := ctx.Query(0).Accept(j).(bool)
	op := ctx.LOGICAL_OPERATOR().GetText()
	if op == "or" {
		if left {
			return left
		}
		return ctx.Query(1).Accept(j).(bool)
	}
	// means it is and
	if !left {
		return left
	}
	return ctx.Query(1).Accept(j).(bool)
}

func (j *JsonQueryVisitorImpl) VisitPresentExp(ctx *PresentExpContext) interface{} {
	ctx.AttrPath().Accept(j)
	return j.leftOp != nil
}

func (j *JsonQueryVisitorImpl) VisitCompareExp(ctx *CompareExpContext) interface{} {
	ctx.AttrPath().Accept(j)
	ctx.Value().Accept(j)
	if j.hasErr() {
		return false
	}
	var apply func(Operand, Operand) (bool, error)
	currentOp := j.currentOperation
	switch ctx.op.GetTokenType() {
	case JsonQueryParserEQ:
		apply = currentOp.EQ
	case JsonQueryParserNE:
		apply = currentOp.NE
	case JsonQueryParserGT:
		apply = currentOp.GT
	case JsonQueryParserLT:
		apply = currentOp.LT
	case JsonQueryParserLE:
		apply = currentOp.LE
	case JsonQueryParserGE:
		apply = currentOp.GE
	case JsonQueryParserCO:
		apply = currentOp.CO
	case JsonQueryParserSW:
		apply = currentOp.SW
	case JsonQueryParserEW:
		apply = currentOp.EW
	case JsonQueryParserIN:
		apply = currentOp.IN
	default:
		j.setErr(fmt.Errorf("Unknown operation %s", ctx.op.GetText()))
		return false
	}
	defer func() { j.rightOp = nil }()
	ret, err := apply(j.leftOp, j.rightOp)
	if err != nil {
		switch err {
		case ErrInvalidOperation:
			// in case of invalid operation lets rather
			// be conservative and return false because the rule doesn't even make
			// sense. It can be argued that it would be false positive if we were
			// to return true
			j.setErr(err)
			j.setDebugErr(
				newNestedError(err, "Not a valid operation for datatypes").Set(ErrVals{
					"operation":           ctx.op.GetTokenType(),
					"object_path_operand": j.leftOp,
					"rule_operand":        j.rightOp,
				}),
			)
		case ErrEvalOperandMissing:
			j.setDebugErr(
				newNestedError(err, "Eval operand missing in input object").Set(ErrVals{
					"attr_path": ctx.AttrPath().GetText(),
				}),
			)
		default:
			switch err.(type) {
			case *ErrInvalidOperand:
				j.setDebugErr(
					newNestedError(err, "operands are not the right value type").Set(ErrVals{
						"attr_path":           ctx.AttrPath().GetText(),
						"object_path_operand": j.leftOp,
						"rule_operand":        j.rightOp,
					}),
				)
			default:
				j.setDebugErr(
					newNestedError(err, "unknown error").Set(ErrVals{
						"attr_path":           ctx.AttrPath().GetText(),
						"object_path_operand": j.leftOp,
						"rule_operand":        j.rightOp,
					}),
				)

			}
		}

		return false
	}
	return ret
}

func (j *JsonQueryVisitorImpl) VisitAttrPath(ctx *AttrPathContext) interface{} {
	var item interface{}
	if ctx.SubAttr() == nil || ctx.SubAttr().IsEmpty() {
		if !j.stack.empty() {
			item = j.stack.pop()
		} else {
			item = j.item
		}
		if item == nil {
			return nil
		}
		m := item.(map[string]interface{})
		j.leftOp = m[ctx.ATTRNAME().GetText()]
		j.stack.clear()
		return nil
	}
	if !j.stack.empty() {
		item = j.stack.peek()
	} else {
		item = j.item
	}
	if item == nil {
		return nil
	}
	m := item.(map[string]interface{})
	j.stack.push(m[ctx.ATTRNAME().GetText()])
	return ctx.SubAttr().Accept(j)
}

func (j *JsonQueryVisitorImpl) VisitSubAttr(ctx *SubAttrContext) interface{} {
	return ctx.AttrPath().Accept(j)
}

func (j *JsonQueryVisitorImpl) VisitBoolean(ctx *BooleanContext) interface{} {
	j.currentOperation = &BoolOperation{}

	val, err := strconv.ParseBool(ctx.GetText())
	if err != nil {
		j.rightOp = nil
		j.setErr(newNestedError(err, "Error converting boolean"))
		return nil
	}
	j.rightOp = val
	return nil
}

func (j *JsonQueryVisitorImpl) VisitNull(ctx *NullContext) interface{} {
	j.currentOperation = &NullOperation{}
	j.rightOp = nil
	return nil
}

func getString(s string) string {
	if len(s) > 2 {
		return s[1 : len(s)-1]
	}
	return ""
}

func (j *JsonQueryVisitorImpl) VisitString(ctx *StringContext) interface{} {
	j.currentOperation = &StringOperation{}
	j.rightOp = getString(ctx.GetText())
	return nil
}

func (j *JsonQueryVisitorImpl) VisitDouble(ctx *DoubleContext) interface{} {
	j.currentOperation = &FloatOperation{}
	val, err := strconv.ParseFloat(ctx.GetText(), 10)
	if err != nil {
		// TODO set err somewhere
		j.rightOp = nil
		return false
	}
	j.rightOp = val
	return nil
}

func (j *JsonQueryVisitorImpl) VisitVersion(ctx *VersionContext) interface{} {
	j.currentOperation = &VersionOperation{}
	j.rightOp = ctx.VERSION().GetText()
	return nil
}

func (j *JsonQueryVisitorImpl) VisitLong(ctx *LongContext) interface{} {
	j.currentOperation = &IntOperation{}
	val, err := strconv.ParseInt(ctx.GetText(), 10, 64)
	if err != nil {
		j.rightOp = nil
		j.setErr(err)
		return nil
	}
	j.rightOp = int(val)
	return nil
}

func (j *JsonQueryVisitorImpl) VisitListOfInts(ctx *ListOfIntsContext) interface{} {
	j.currentOperation = &IntOperation{}
	return ctx.ListInts().Accept(j)
}

func (j *JsonQueryVisitorImpl) VisitListInts(ctx *ListIntsContext) interface{} {
	return ctx.SubListOfInts().Accept(j)
}

func (j *JsonQueryVisitorImpl) VisitSubListOfInts(ctx *SubListOfIntsContext) interface{} {
	if j.rightOp == nil {
		j.rightOp = make([]int, 0)
	}
	list := j.rightOp.([]int)
	val, err := strconv.ParseInt(ctx.INT().GetText(), 10, 64)
	if err != nil {
		j.setErr(err)
		return nil
	}
	j.rightOp = append(list, int(val))
	if ctx.SubListOfInts() == nil || ctx.SubListOfInts().IsEmpty() {
		return nil
	}
	return ctx.SubListOfInts().Accept(j)
}

func (j *JsonQueryVisitorImpl) VisitListOfDoubles(ctx *ListOfDoublesContext) interface{} {
	j.currentOperation = &FloatOperation{}
	return ctx.ListDoubles().Accept(j)
}

func (j *JsonQueryVisitorImpl) VisitListDoubles(ctx *ListDoublesContext) interface{} {
	return ctx.SubListOfDoubles().Accept(j)
}

func (j *JsonQueryVisitorImpl) VisitSubListOfDoubles(ctx *SubListOfDoublesContext) interface{} {
	if j.rightOp == nil {
		j.rightOp = make([]float64, 0)
	}
	list := j.rightOp.([]float64)
	val, err := strconv.ParseFloat(ctx.DOUBLE().GetText(), 10)
	if err != nil {
		j.setErr(err)
		return nil
	}
	j.rightOp = append(list, val)
	if ctx.SubListOfDoubles() == nil || ctx.SubListOfDoubles().IsEmpty() {
		return nil
	}
	return ctx.SubListOfDoubles().Accept(j)
}

func (j *JsonQueryVisitorImpl) VisitListOfStrings(ctx *ListOfStringsContext) interface{} {
	j.currentOperation = &StringOperation{}
	return ctx.ListStrings().Accept(j)
}

func (j *JsonQueryVisitorImpl) VisitListStrings(ctx *ListStringsContext) interface{} {
	return ctx.SubListOfStrings().Accept(j)
}

func (j *JsonQueryVisitorImpl) VisitSubListOfStrings(ctx *SubListOfStringsContext) interface{} {
	if j.rightOp == nil {
		j.rightOp = make([]string, 0)
	}
	val := getString(ctx.STRING().GetText())
	list := j.rightOp.([]string)
	j.rightOp = append(list, val)
	if ctx.SubListOfStrings() == nil || ctx.SubListOfStrings().IsEmpty() {
		return nil
	}
	return ctx.SubListOfStrings().Accept(j)
}
