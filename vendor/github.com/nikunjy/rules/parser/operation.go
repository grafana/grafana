package parser

import (
	"errors"
	"fmt"
	"reflect"
)

func toFloat(op Operand) (float64, error) {
	switch val := op.(type) {
	case int:
		return float64(val), nil
	case float64:
		return val, nil
	}
	var exp float64
	return 0, newErrInvalidOperand(op, exp)
}

func toInt(op Operand) (int, error) {
	switch val := op.(type) {
	case int:
		return val, nil
	case float64:
		return int(val), nil
	case int32:
		return int(val), nil
	case int64:
		return int(val), nil
	}
	var exp int
	return 0, newErrInvalidOperand(op, exp)
}

type Operand interface{}

var (
	ErrInvalidOperation   = errors.New("Invalid operation on the type")
	ErrEvalOperandMissing = errors.New("Operand not present")
)

type ErrInvalidOperand struct {
	Val     interface{}
	typeObj interface{}
}

func newErrInvalidOperand(val Operand, typeObj interface{}) *ErrInvalidOperand {
	return &ErrInvalidOperand{
		Val:     val,
		typeObj: typeObj,
	}
}

func (e *ErrInvalidOperand) Error() string {
	return fmt.Sprintf("Operand %v is not the correct type. Expected: %s, Actual: %s",
		e.Val,
		reflect.TypeOf(e.typeObj).String(),
		reflect.TypeOf(e.Val).String(),
	)
}

type Operation interface {
	EQ(left Operand, right Operand) (bool, error)
	NE(left Operand, right Operand) (bool, error)
	GT(left Operand, right Operand) (bool, error)
	LT(left Operand, right Operand) (bool, error)
	GE(left Operand, right Operand) (bool, error)
	LE(left Operand, right Operand) (bool, error)
	CO(left Operand, right Operand) (bool, error)
	SW(left Operand, right Operand) (bool, error)
	EW(left Operand, right Operand) (bool, error)
	IN(left Operand, right Operand) (bool, error)
}
