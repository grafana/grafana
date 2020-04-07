package redis

import (
	"errors"
	"sync"

	"gopkg.in/redis.v5/internal/pool"
)

type pipelineExecer func([]Cmder) error

// Pipeline implements pipelining as described in
// http://redis.io/topics/pipelining. It's safe for concurrent use
// by multiple goroutines.
type Pipeline struct {
	cmdable
	statefulCmdable

	exec pipelineExecer

	mu     sync.Mutex
	cmds   []Cmder
	closed bool
}

func (c *Pipeline) Process(cmd Cmder) error {
	c.mu.Lock()
	c.cmds = append(c.cmds, cmd)
	c.mu.Unlock()
	return nil
}

// Close closes the pipeline, releasing any open resources.
func (c *Pipeline) Close() error {
	c.mu.Lock()
	c.discard()
	c.closed = true
	c.mu.Unlock()
	return nil
}

// Discard resets the pipeline and discards queued commands.
func (c *Pipeline) Discard() error {
	c.mu.Lock()
	err := c.discard()
	c.mu.Unlock()
	return err
}

func (c *Pipeline) discard() error {
	if c.closed {
		return pool.ErrClosed
	}
	c.cmds = c.cmds[:0]
	return nil
}

// Exec executes all previously queued commands using one
// client-server roundtrip.
//
// Exec always returns list of commands and error of the first failed
// command if any.
func (c *Pipeline) Exec() ([]Cmder, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil, pool.ErrClosed
	}

	if len(c.cmds) == 0 {
		return nil, errors.New("redis: pipeline is empty")
	}

	cmds := c.cmds
	c.cmds = nil

	return cmds, c.exec(cmds)
}

func (c *Pipeline) pipelined(fn func(*Pipeline) error) ([]Cmder, error) {
	if err := fn(c); err != nil {
		return nil, err
	}
	cmds, err := c.Exec()
	_ = c.Close()
	return cmds, err
}
