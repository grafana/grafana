package parser

type BoolOperation struct {
	NullOperation
}

func (o *BoolOperation) get(left Operand, right Operand) (bool, bool, error) {
	if left == nil {
		return false, false, ErrEvalOperandMissing
	}
	leftVal, ok := left.(bool)
	if !ok {
		return false, false, newErrInvalidOperand(left, leftVal)
	}
	rightVal, ok := right.(bool)
	if !ok {
		return false, false, newErrInvalidOperand(right, rightVal)
	}
	return leftVal, rightVal, nil
}

func (o *BoolOperation) EQ(left Operand, right Operand) (bool, error) {
	l, r, err := o.get(left, right)
	if err != nil {
		return false, err
	}
	return l == r, nil
}

func (o *BoolOperation) NE(left Operand, right Operand) (bool, error) {
	l, r, err := o.get(left, right)
	if err != nil {
		return false, err
	}
	return l != r, nil
}
