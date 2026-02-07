package parser

type IntOperation struct {
	NullOperation
}

func (o *IntOperation) get(left Operand, right Operand) (int, int, error) {
	if left == nil {
		return 0, 0, ErrEvalOperandMissing
	}
	leftVal, err := toInt(left)
	if err != nil {
		return 0, 0, err
	}
	rightVal, err := toInt(right)
	if err != nil {
		return 0, 0, err
	}
	return leftVal, rightVal, nil

}

func (o *IntOperation) EQ(left Operand, right Operand) (bool, error) {
	l, r, err := o.get(left, right)
	if err != nil {
		return false, err
	}
	return l == r, nil
}

func (o *IntOperation) NE(left Operand, right Operand) (bool, error) {
	l, r, err := o.get(left, right)
	if err != nil {
		return false, err
	}
	return l != r, nil
}

func (o *IntOperation) GT(left Operand, right Operand) (bool, error) {
	l, r, err := o.get(left, right)
	if err != nil {
		return false, err
	}
	return l > r, nil
}

func (o *IntOperation) LT(left Operand, right Operand) (bool, error) {
	l, r, err := o.get(left, right)
	if err != nil {
		return false, err
	}
	return l < r, nil
}

func (o *IntOperation) GE(left Operand, right Operand) (bool, error) {
	l, r, err := o.get(left, right)
	if err != nil {
		return false, err
	}
	return l >= r, nil
}

func (o *IntOperation) LE(left Operand, right Operand) (bool, error) {
	l, r, err := o.get(left, right)
	if err != nil {
		return false, err
	}
	return l <= r, nil
}

func (o *IntOperation) IN(left Operand, right Operand) (bool, error) {
	leftVal, ok := left.(int)
	if !ok {
		return false, newErrInvalidOperand(left, leftVal)
	}
	rightVal, ok := right.([]int)
	if !ok {
		return false, newErrInvalidOperand(right, rightVal)
	}
	for _, num := range rightVal {
		if num == leftVal {
			return true, nil
		}
	}
	return false, nil
}
