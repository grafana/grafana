package redisc

import (
	"errors"
	"time"

	"github.com/gomodule/redigo/redis"
)

// RetryConn wraps the connection c (which must be a *Conn)
// into a connection that automatically handles cluster redirections
// (MOVED and ASK replies) and retries for TRYAGAIN errors.
// Only Do, Close and Err can be called on that connection,
// all other methods return an error.
//
// The maxAtt parameter indicates the maximum number of attempts
// to successfully execute the command. The tryAgainDelay is the
// duration to wait before retrying a TRYAGAIN error.
func RetryConn(c redis.Conn, maxAtt int, tryAgainDelay time.Duration) (redis.Conn, error) {
	cc, ok := c.(*Conn)
	if !ok {
		return nil, errors.New("redisc: connection is not a *Conn")
	}
	return &retryConn{c: cc, maxAttempts: maxAtt, tryAgainDelay: tryAgainDelay}, nil
}

type retryConn struct {
	c *Conn

	maxAttempts   int
	tryAgainDelay time.Duration
}

func (rc *retryConn) Do(cmd string, args ...interface{}) (interface{}, error) {
	return rc.do(cmd, args...)
}

func (rc *retryConn) do(cmd string, args ...interface{}) (interface{}, error) {
	var att int
	var asking bool

	cluster := rc.c.cluster
	for rc.maxAttempts <= 0 || att < rc.maxAttempts {
		if asking {
			if err := rc.c.Send("ASKING"); err != nil {
				return nil, err
			}
			asking = false
		}

		v, err := rc.c.Do(cmd, args...)
		re := ParseRedir(err)
		if re == nil {
			if IsTryAgain(err) {
				// handle retry
				time.Sleep(rc.tryAgainDelay)
				att++
				continue
			}

			// not a retry error nor a redirection, return result
			return v, err
		}

		// handle redirection
		rc.c.mu.Lock()
		readOnly := rc.c.readOnly
		connAddr := rc.c.boundAddr
		rc.c.mu.Unlock()
		if readOnly {
			// check if the connection was already made to that slot, meaning
			// that the redirection is because the command can't be served
			// by the replica and a non-readonly connection must be made to
			// the slot's master. If that's not the case, then keep the
			// readonly flag to true, meaning that it will attempt a connection
			// to a replica for the new slot.
			cluster.mu.Lock()
			slotMappings := cluster.mapping[re.NewSlot]
			cluster.mu.Unlock()
			if isIn(slotMappings, connAddr) {
				readOnly = false
			}
		}

		var conn redis.Conn
		addr := re.Addr
		asking = re.Type == "ASK"

		if asking {
			// if redirecting due to ASK, use the address that was
			// provided in the ASK error reply.
			conn, err = cluster.getConnForAddr(addr, rc.c.forceDial)
			if err != nil {
				return nil, err
			}
			// TODO(mna): does redis cluster send ASK replies that
			// redirect to replicas if the source node was a replica?
			// Assume no for now.
			readOnly = false
		} else {
			// if redirecting due to a MOVED, the slot mapping is already
			// updated to reflect the new server for that slot (done in
			// rc.c.Do), so getConnForSlot will return a connection to
			// the correct address.
			conn, addr, err = cluster.getConnForSlot(re.NewSlot, rc.c.forceDial, readOnly)
			if err != nil {
				// could not get connection to that node, return that error
				return nil, err
			}
		}

		rc.c.mu.Lock()
		// close and replace the old connection (close must come before assignments)
		rc.c.closeLocked()
		rc.c.rc = conn
		rc.c.boundAddr = addr
		rc.c.readOnly = readOnly
		rc.c.mu.Unlock()

		att++
	}
	return nil, errors.New("redisc: too many attempts")
}

func (rc *retryConn) Err() error {
	return rc.c.Err()
}

func (rc *retryConn) Close() error {
	return rc.c.Close()
}

func (rc *retryConn) Send(cmd string, args ...interface{}) error {
	return errors.New("redisc: unsupported call to Send")
}

func (rc *retryConn) Receive() (interface{}, error) {
	return nil, errors.New("redisc: unsupported call to Receive")
}

func (rc *retryConn) Flush() error {
	return errors.New("redisc: unsupported call to Flush")
}

func isIn(list []string, v string) bool {
	for _, vv := range list {
		if v == vv {
			return true
		}
	}
	return false
}
