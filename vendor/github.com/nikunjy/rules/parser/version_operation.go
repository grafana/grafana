package parser

import (
	"github.com/blang/semver"
)

type VersionOperation struct {
	NullOperation
}

func (v *VersionOperation) get(left Operand, right Operand) (semver.Version, semver.Version, error) {
	var leftVer, rightVer semver.Version
	leftVal, ok := left.(string)
	if !ok {
		return leftVer, rightVer, newErrInvalidOperand(left, leftVal)
	}
	rightVal, ok := right.(string)
	if !ok {
		return leftVer, rightVer, newErrInvalidOperand(right, rightVal)
	}
	var err error
	leftVer, err = semver.Make(leftVal)
	if err != nil {
		return leftVer, rightVer, err
	}
	rightVer, err = semver.Make(rightVal)
	return leftVer, rightVer, err
}

func (v *VersionOperation) EQ(left Operand, right Operand) (bool, error) {
	leftVer, rightVer, err := v.get(left, right)
	if err != nil {
		return false, err
	}
	return leftVer.EQ(rightVer), nil
}

func (v *VersionOperation) NE(left Operand, right Operand) (bool, error) {
	leftVer, rightVer, err := v.get(left, right)
	if err != nil {
		return false, err
	}
	return leftVer.NE(rightVer), nil
}

func (v *VersionOperation) LT(left Operand, right Operand) (bool, error) {
	leftVer, rightVer, err := v.get(left, right)
	if err != nil {
		return false, err
	}
	return leftVer.LT(rightVer), nil
}

func (v *VersionOperation) GT(left Operand, right Operand) (bool, error) {
	leftVer, rightVer, err := v.get(left, right)
	if err != nil {
		return false, err
	}
	return leftVer.GT(rightVer), nil
}

func (v *VersionOperation) LE(left Operand, right Operand) (bool, error) {
	leftVer, rightVer, err := v.get(left, right)
	if err != nil {
		return false, err
	}
	return leftVer.LE(rightVer), nil
}

func (v *VersionOperation) GE(left Operand, right Operand) (bool, error) {
	leftVer, rightVer, err := v.get(left, right)
	if err != nil {
		return false, err
	}
	return leftVer.GE(rightVer), nil
}
