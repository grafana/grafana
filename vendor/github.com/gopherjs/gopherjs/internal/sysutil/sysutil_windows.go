package sysutil

import "errors"

func RlimitStack() (uint64, error) {
	return 0, errors.New("RlimitStack is not implemented on Windows")
}
