package redis

import (
	"fmt"
)

// Redis nil reply.
var Nil = errorf("redis: nil")

// Redis transaction failed.
var TxFailedErr = errorf("redis: transaction failed")

type redisError struct {
	s string
}

func errorf(s string, args ...interface{}) redisError {
	return redisError{s: fmt.Sprintf(s, args...)}
}

func (err redisError) Error() string {
	return err.s
}
