package miniredis

import (
	"errors"
	"math"
	"strconv"
	"time"

	"github.com/alicebob/miniredis/v2/server"
)

// optInt parses an int option in a command.
// Writes "invalid integer" error to c if it's not a valid integer. Returns
// whether or not things were okay.
func optInt(c *server.Peer, src string, dest *int) bool {
	return optIntErr(c, src, dest, msgInvalidInt)
}

func optIntErr(c *server.Peer, src string, dest *int, errMsg string) bool {
	n, err := strconv.Atoi(src)
	if err != nil {
		setDirty(c)
		c.WriteError(errMsg)
		return false
	}
	*dest = n
	return true
}

// optIntSimple sets dest or returns an error
func optIntSimple(src string, dest *int) error {
	n, err := strconv.Atoi(src)
	if err != nil {
		return errors.New(msgInvalidInt)
	}
	*dest = n
	return nil
}

func optDuration(c *server.Peer, src string, dest *time.Duration) bool {
	n, err := strconv.ParseFloat(src, 64)
	if err != nil {
		setDirty(c)
		c.WriteError(msgInvalidTimeout)
		return false
	}
	if n < 0 {
		setDirty(c)
		c.WriteError(msgTimeoutNegative)
		return false
	}
	if math.IsInf(n, 0) {
		setDirty(c)
		c.WriteError(msgTimeoutIsOutOfRange)
		return false
	}

	*dest = time.Duration(n*1_000_000) * time.Microsecond
	return true
}
