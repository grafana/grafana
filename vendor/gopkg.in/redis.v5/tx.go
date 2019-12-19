package redis

import (
	"gopkg.in/redis.v5/internal"
	"gopkg.in/redis.v5/internal/pool"
)

// Redis transaction failed.
const TxFailedErr = internal.RedisError("redis: transaction failed")

// Tx implements Redis transactions as described in
// http://redis.io/topics/transactions. It's NOT safe for concurrent use
// by multiple goroutines, because Exec resets list of watched keys.
// If you don't need WATCH it is better to use Pipeline.
type Tx struct {
	cmdable
	statefulCmdable
	baseClient
}

func (c *Client) newTx() *Tx {
	tx := Tx{
		baseClient: baseClient{
			opt:      c.opt,
			connPool: pool.NewStickyConnPool(c.connPool.(*pool.ConnPool), true),
		},
	}
	tx.cmdable.process = tx.Process
	tx.statefulCmdable.process = tx.Process
	return &tx
}

func (c *Client) Watch(fn func(*Tx) error, keys ...string) error {
	tx := c.newTx()
	if len(keys) > 0 {
		if err := tx.Watch(keys...).Err(); err != nil {
			_ = tx.Close()
			return err
		}
	}
	firstErr := fn(tx)
	if err := tx.Close(); err != nil && firstErr == nil {
		firstErr = err
	}
	return firstErr
}

// close closes the transaction, releasing any open resources.
func (c *Tx) Close() error {
	_ = c.Unwatch().Err()
	return c.baseClient.Close()
}

// Watch marks the keys to be watched for conditional execution
// of a transaction.
func (c *Tx) Watch(keys ...string) *StatusCmd {
	args := make([]interface{}, 1+len(keys))
	args[0] = "WATCH"
	for i, key := range keys {
		args[1+i] = key
	}
	cmd := NewStatusCmd(args...)
	c.Process(cmd)
	return cmd
}

// Unwatch flushes all the previously watched keys for a transaction.
func (c *Tx) Unwatch(keys ...string) *StatusCmd {
	args := make([]interface{}, 1+len(keys))
	args[0] = "UNWATCH"
	for i, key := range keys {
		args[1+i] = key
	}
	cmd := NewStatusCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Tx) Pipeline() *Pipeline {
	pipe := Pipeline{
		exec: c.pipelineExecer(c.txPipelineProcessCmds),
	}
	pipe.cmdable.process = pipe.Process
	pipe.statefulCmdable.process = pipe.Process
	return &pipe
}

// Pipelined executes commands queued in the fn in a transaction
// and restores the connection state to normal.
//
// When using WATCH, EXEC will execute commands only if the watched keys
// were not modified, allowing for a check-and-set mechanism.
//
// Exec always returns list of commands. If transaction fails
// TxFailedErr is returned. Otherwise Exec returns error of the first
// failed command or nil.
func (c *Tx) Pipelined(fn func(*Pipeline) error) ([]Cmder, error) {
	return c.Pipeline().pipelined(fn)
}
