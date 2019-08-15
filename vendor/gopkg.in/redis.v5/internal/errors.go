package internal

import (
	"io"
	"net"
	"strings"
)

const Nil = RedisError("redis: nil")

type RedisError string

func (e RedisError) Error() string { return string(e) }

func IsRetryableError(err error) bool {
	return IsNetworkError(err)
}

func IsInternalError(err error) bool {
	_, ok := err.(RedisError)
	return ok
}

func IsNetworkError(err error) bool {
	if err == io.EOF {
		return true
	}
	_, ok := err.(net.Error)
	return ok
}

func IsBadConn(err error, allowTimeout bool) bool {
	if err == nil {
		return false
	}
	if IsInternalError(err) {
		return false
	}
	if allowTimeout {
		if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
			return false
		}
	}
	return true
}

func IsMovedError(err error) (moved bool, ask bool, addr string) {
	if !IsInternalError(err) {
		return
	}

	s := err.Error()
	if strings.HasPrefix(s, "MOVED ") {
		moved = true
	} else if strings.HasPrefix(s, "ASK ") {
		ask = true
	} else {
		return
	}

	ind := strings.LastIndex(s, " ")
	if ind == -1 {
		return false, false, ""
	}
	addr = s[ind+1:]
	return
}

func IsLoadingError(err error) bool {
	return strings.HasPrefix(err.Error(), "LOADING")
}

func IsExecAbortError(err error) bool {
	return strings.HasPrefix(err.Error(), "EXECABORT")
}
