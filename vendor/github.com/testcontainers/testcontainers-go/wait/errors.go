//go:build !windows
// +build !windows

package wait

import (
	"errors"
	"syscall"
)

func isConnRefusedErr(err error) bool {
	return errors.Is(err, syscall.ECONNREFUSED)
}
