package redis

import (
	"context"
	"sync"

	"github.com/go-redis/redis/v8/internal/pool"
)

type pipelineExecer func(context.Context, []Cmder) error

// Pipeliner is an mechanism to realise Redis Pipeline technique.
//
// Pipelining is a technique to extremely speed up processing by packing
// operations to batches, send them at once to Redis and read a replies in a
// singe step.
// See https://redis.io/topics/pipelining
//
// Pay attention, that Pipeline is not a transaction, so you can get unexpected
// results in case of big pipelines and small read/write timeouts.
// Redis client has retransmission logic in case of timeouts, pipeline
// can be retransmitted and commands can be executed more then once.
// To avoid this: it is good idea to use reasonable bigger read/write timeouts
// depends of your batch size and/or use TxPipeline.
type Pipeliner interface {
	StatefulCmdable
	Do(ctx context.Context, args ...interface{}) *Cmd
	Process(ctx context.Context, cmd Cmder) error
	Close() error
	Discard() error
	Exec(ctx context.Context) ([]Cmder, error)
}

var _ Pipeliner = (*Pipeline)(nil)

// Pipeline implements pipelining as described in
// http://redis.io/topics/pipelining. It's safe for concurrent use
// by multiple goroutines.
type Pipeline struct {
	cmdable
	statefulCmdable

	ctx  context.Context
	exec pipelineExecer

	mu     sync.Mutex
	cmds   []Cmder
	closed bool
}

func (c *Pipeline) init() {
	c.cmdable = c.Process
	c.statefulCmdable = c.Process
}

func (c *Pipeline) Do(ctx context.Context, args ...interface{}) *Cmd {
	cmd := NewCmd(ctx, args...)
	_ = c.Process(ctx, cmd)
	return cmd
}

// Process queues the cmd for later execution.
func (c *Pipeline) Process(ctx context.Context, cmd Cmder) error {
	c.mu.Lock()
	c.cmds = append(c.cmds, cmd)
	c.mu.Unlock()
	return nil
}

// Close closes the pipeline, releasing any open resources.
func (c *Pipeline) Close() error {
	c.mu.Lock()
	_ = c.discard()
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
func (c *Pipeline) Exec(ctx context.Context) ([]Cmder, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil, pool.ErrClosed
	}

	if len(c.cmds) == 0 {
		return nil, nil
	}

	cmds := c.cmds
	c.cmds = nil

	return cmds, c.exec(ctx, cmds)
}

func (c *Pipeline) Pipelined(ctx context.Context, fn func(Pipeliner) error) ([]Cmder, error) {
	if err := fn(c); err != nil {
		return nil, err
	}
	cmds, err := c.Exec(ctx)
	_ = c.Close()
	return cmds, err
}

func (c *Pipeline) Pipeline() Pipeliner {
	return c
}

func (c *Pipeline) TxPipelined(ctx context.Context, fn func(Pipeliner) error) ([]Cmder, error) {
	return c.Pipelined(ctx, fn)
}

func (c *Pipeline) TxPipeline() Pipeliner {
	return c
}
