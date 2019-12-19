package redis // import "gopkg.in/redis.v5"

import (
	"fmt"
	"log"
	"time"

	"gopkg.in/redis.v5/internal"
	"gopkg.in/redis.v5/internal/pool"
	"gopkg.in/redis.v5/internal/proto"
)

// Redis nil reply, .e.g. when key does not exist.
const Nil = internal.Nil

func SetLogger(logger *log.Logger) {
	internal.Logger = logger
}

func (c *baseClient) String() string {
	return fmt.Sprintf("Redis<%s db:%d>", c.getAddr(), c.opt.DB)
}

func (c *baseClient) conn() (*pool.Conn, bool, error) {
	cn, isNew, err := c.connPool.Get()
	if err != nil {
		return nil, false, err
	}
	if !cn.Inited {
		if err := c.initConn(cn); err != nil {
			_ = c.connPool.Remove(cn, err)
			return nil, false, err
		}
	}
	return cn, isNew, nil
}

func (c *baseClient) putConn(cn *pool.Conn, err error, allowTimeout bool) bool {
	if internal.IsBadConn(err, allowTimeout) {
		_ = c.connPool.Remove(cn, err)
		return false
	}

	_ = c.connPool.Put(cn)
	return true
}

func (c *baseClient) initConn(cn *pool.Conn) error {
	cn.Inited = true

	if c.opt.Password == "" && c.opt.DB == 0 && !c.opt.ReadOnly {
		return nil
	}

	// Temp client for Auth and Select.
	client := newClient(c.opt, pool.NewSingleConnPool(cn))
	_, err := client.Pipelined(func(pipe *Pipeline) error {
		if c.opt.Password != "" {
			pipe.Auth(c.opt.Password)
		}

		if c.opt.DB > 0 {
			pipe.Select(c.opt.DB)
		}

		if c.opt.ReadOnly {
			pipe.ReadOnly()
		}

		return nil
	})
	return err
}

func (c *baseClient) Process(cmd Cmder) error {
	if c.process != nil {
		return c.process(cmd)
	}
	return c.defaultProcess(cmd)
}

// WrapProcess replaces the process func. It takes a function createWrapper
// which is supplied by the user. createWrapper takes the old process func as
// an input and returns the new wrapper process func. createWrapper should
// use call the old process func within the new process func.
func (c *baseClient) WrapProcess(fn func(oldProcess func(cmd Cmder) error) func(cmd Cmder) error) {
	c.process = fn(c.defaultProcess)
}

func (c *baseClient) defaultProcess(cmd Cmder) error {
	for i := 0; i <= c.opt.MaxRetries; i++ {
		cn, _, err := c.conn()
		if err != nil {
			cmd.setErr(err)
			return err
		}

		cn.SetWriteTimeout(c.opt.WriteTimeout)
		if err := writeCmd(cn, cmd); err != nil {
			c.putConn(cn, err, false)
			cmd.setErr(err)
			if err != nil && internal.IsRetryableError(err) {
				continue
			}
			return err
		}

		cn.SetReadTimeout(c.cmdTimeout(cmd))
		err = cmd.readReply(cn)
		c.putConn(cn, err, false)
		if err != nil && internal.IsRetryableError(err) {
			continue
		}

		return err
	}

	return cmd.Err()
}

func (c *baseClient) cmdTimeout(cmd Cmder) time.Duration {
	if timeout := cmd.readTimeout(); timeout != nil {
		return *timeout
	} else {
		return c.opt.ReadTimeout
	}
}

// Close closes the client, releasing any open resources.
//
// It is rare to Close a Client, as the Client is meant to be
// long-lived and shared between many goroutines.
func (c *baseClient) Close() error {
	var firstErr error
	if c.onClose != nil {
		if err := c.onClose(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	if err := c.connPool.Close(); err != nil && firstErr == nil {
		firstErr = err
	}
	return firstErr
}

func (c *baseClient) getAddr() string {
	return c.opt.Addr
}

type pipelineProcessor func(*pool.Conn, []Cmder) (bool, error)

func (c *baseClient) pipelineExecer(p pipelineProcessor) pipelineExecer {
	return func(cmds []Cmder) error {
		var firstErr error
		for i := 0; i <= c.opt.MaxRetries; i++ {
			cn, _, err := c.conn()
			if err != nil {
				setCmdsErr(cmds, err)
				return err
			}

			canRetry, err := p(cn, cmds)
			c.putConn(cn, err, false)
			if err == nil {
				return nil
			}
			if firstErr == nil {
				firstErr = err
			}
			if !canRetry || !internal.IsRetryableError(err) {
				break
			}
		}
		return firstErr
	}
}

func (c *baseClient) pipelineProcessCmds(cn *pool.Conn, cmds []Cmder) (retry bool, firstErr error) {
	cn.SetWriteTimeout(c.opt.WriteTimeout)
	if err := writeCmd(cn, cmds...); err != nil {
		setCmdsErr(cmds, err)
		return true, err
	}

	// Set read timeout for all commands.
	cn.SetReadTimeout(c.opt.ReadTimeout)
	return pipelineReadCmds(cn, cmds)
}

func pipelineReadCmds(cn *pool.Conn, cmds []Cmder) (retry bool, firstErr error) {
	for i, cmd := range cmds {
		err := cmd.readReply(cn)
		if err == nil {
			continue
		}
		if i == 0 {
			retry = true
		}
		if firstErr == nil {
			firstErr = err
		}
	}
	return false, firstErr
}

func (c *baseClient) txPipelineProcessCmds(cn *pool.Conn, cmds []Cmder) (bool, error) {
	cn.SetWriteTimeout(c.opt.WriteTimeout)
	if err := txPipelineWriteMulti(cn, cmds); err != nil {
		setCmdsErr(cmds, err)
		return true, err
	}

	// Set read timeout for all commands.
	cn.SetReadTimeout(c.opt.ReadTimeout)

	if err := c.txPipelineReadQueued(cn, cmds); err != nil {
		return false, err
	}

	_, err := pipelineReadCmds(cn, cmds)
	return false, err
}

func txPipelineWriteMulti(cn *pool.Conn, cmds []Cmder) error {
	multiExec := make([]Cmder, 0, len(cmds)+2)
	multiExec = append(multiExec, NewStatusCmd("MULTI"))
	multiExec = append(multiExec, cmds...)
	multiExec = append(multiExec, NewSliceCmd("EXEC"))
	return writeCmd(cn, multiExec...)
}

func (c *baseClient) txPipelineReadQueued(cn *pool.Conn, cmds []Cmder) error {
	var firstErr error

	// Parse queued replies.
	var statusCmd StatusCmd
	if err := statusCmd.readReply(cn); err != nil && firstErr == nil {
		firstErr = err
	}

	for _, cmd := range cmds {
		err := statusCmd.readReply(cn)
		if err != nil {
			cmd.setErr(err)
			if firstErr == nil {
				firstErr = err
			}
		}
	}

	// Parse number of replies.
	line, err := cn.Rd.ReadLine()
	if err != nil {
		if err == Nil {
			err = TxFailedErr
		}
		return err
	}

	switch line[0] {
	case proto.ErrorReply:
		return proto.ParseErrorReply(line)
	case proto.ArrayReply:
		// ok
	default:
		err := fmt.Errorf("redis: expected '*', but got line %q", line)
		return err
	}

	return nil
}

//------------------------------------------------------------------------------

// Client is a Redis client representing a pool of zero or more
// underlying connections. It's safe for concurrent use by multiple
// goroutines.
type Client struct {
	baseClient
	cmdable
}

func newClient(opt *Options, pool pool.Pooler) *Client {
	client := Client{
		baseClient: baseClient{
			opt:      opt,
			connPool: pool,
		},
	}
	client.cmdable.process = client.Process
	return &client
}

// NewClient returns a client to the Redis Server specified by Options.
func NewClient(opt *Options) *Client {
	opt.init()
	return newClient(opt, newConnPool(opt))
}

func (c *Client) copy() *Client {
	c2 := new(Client)
	*c2 = *c
	c2.cmdable.process = c2.Process
	return c2
}

// PoolStats returns connection pool stats.
func (c *Client) PoolStats() *PoolStats {
	s := c.connPool.Stats()
	return &PoolStats{
		Requests: s.Requests,
		Hits:     s.Hits,
		Timeouts: s.Timeouts,

		TotalConns: s.TotalConns,
		FreeConns:  s.FreeConns,
	}
}

func (c *Client) Pipelined(fn func(*Pipeline) error) ([]Cmder, error) {
	return c.Pipeline().pipelined(fn)
}

func (c *Client) Pipeline() *Pipeline {
	pipe := Pipeline{
		exec: c.pipelineExecer(c.pipelineProcessCmds),
	}
	pipe.cmdable.process = pipe.Process
	pipe.statefulCmdable.process = pipe.Process
	return &pipe
}

func (c *Client) TxPipelined(fn func(*Pipeline) error) ([]Cmder, error) {
	return c.TxPipeline().pipelined(fn)
}

// TxPipeline acts like Pipeline, but wraps queued commands with MULTI/EXEC.
func (c *Client) TxPipeline() *Pipeline {
	pipe := Pipeline{
		exec: c.pipelineExecer(c.txPipelineProcessCmds),
	}
	pipe.cmdable.process = pipe.Process
	pipe.statefulCmdable.process = pipe.Process
	return &pipe
}

func (c *Client) pubSub() *PubSub {
	return &PubSub{
		base: baseClient{
			opt:      c.opt,
			connPool: pool.NewStickyConnPool(c.connPool.(*pool.ConnPool), false),
		},
	}
}

// Subscribe subscribes the client to the specified channels.
func (c *Client) Subscribe(channels ...string) (*PubSub, error) {
	pubsub := c.pubSub()
	if len(channels) > 0 {
		if err := pubsub.Subscribe(channels...); err != nil {
			pubsub.Close()
			return nil, err
		}
	}
	return pubsub, nil
}

// PSubscribe subscribes the client to the given patterns.
func (c *Client) PSubscribe(channels ...string) (*PubSub, error) {
	pubsub := c.pubSub()
	if len(channels) > 0 {
		if err := pubsub.PSubscribe(channels...); err != nil {
			pubsub.Close()
			return nil, err
		}
	}
	return pubsub, nil
}
