package parser

type NullOperation struct {
}

func (o *NullOperation) EQ(left Operand, right Operand) (bool, error) {
	return left == nil, nil
}

func (o *NullOperation) NE(left Operand, right Operand) (bool, error) {
	return left != nil, nil
}

func (o *NullOperation) GT(left Operand, right Operand) (bool, error) {
	return false, ErrInvalidOperation
}

func (o *NullOperation) LT(left Operand, right Operand) (bool, error) {
	return false, ErrInvalidOperation
}

func (o *NullOperation) GE(left Operand, right Operand) (bool, error) {
	return false, ErrInvalidOperation
}

func (o *NullOperation) LE(left Operand, right Operand) (bool, error) {
	return false, ErrInvalidOperation
}

func (o *NullOperation) CO(left Operand, right Operand) (bool, error) {
	return false, ErrInvalidOperation
}

func (o *NullOperation) SW(left Operand, right Operand) (bool, error) {
	return false, ErrInvalidOperation
}

func (o *NullOperation) EW(left Operand, right Operand) (bool, error) {
	return false, ErrInvalidOperation
}

func (o *NullOperation) IN(left Operand, right Operand) (bool, error) {
	return false, ErrInvalidOperation
}
