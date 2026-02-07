package wait

import (
	"golang.org/x/sys/windows"
)

func isConnRefusedErr(err error) bool {
	return err == windows.WSAECONNREFUSED
}
