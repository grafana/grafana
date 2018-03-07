package redis

// Not thread-safe.
type Pipeline struct {
	*Client

	closed bool
}

func (c *Client) Pipeline() *Pipeline {
	return &Pipeline{
		Client: &Client{
			baseClient: &baseClient{
				opt:      c.opt,
				connPool: c.connPool,

				cmds: make([]Cmder, 0),
			},
		},
	}
}

func (c *Client) Pipelined(f func(*Pipeline) error) ([]Cmder, error) {
	pc := c.Pipeline()
	if err := f(pc); err != nil {
		return nil, err
	}
	cmds, err := pc.Exec()
	pc.Close()
	return cmds, err
}

func (c *Pipeline) Close() error {
	c.closed = true
	return nil
}

func (c *Pipeline) Discard() error {
	if c.closed {
		return errClosed
	}
	c.cmds = c.cmds[:0]
	return nil
}

// Exec always returns list of commands and error of the first failed
// command if any.
func (c *Pipeline) Exec() ([]Cmder, error) {
	if c.closed {
		return nil, errClosed
	}

	cmds := c.cmds
	c.cmds = make([]Cmder, 0)

	if len(cmds) == 0 {
		return []Cmder{}, nil
	}

	cn, err := c.conn()
	if err != nil {
		setCmdsErr(cmds, err)
		return cmds, err
	}

	if err := c.execCmds(cn, cmds); err != nil {
		c.freeConn(cn, err)
		return cmds, err
	}

	c.putConn(cn)
	return cmds, nil
}

func (c *Pipeline) execCmds(cn *conn, cmds []Cmder) error {
	if err := c.writeCmd(cn, cmds...); err != nil {
		setCmdsErr(cmds, err)
		return err
	}

	var firstCmdErr error
	for _, cmd := range cmds {
		if err := cmd.parseReply(cn.rd); err != nil {
			if firstCmdErr == nil {
				firstCmdErr = err
			}
		}
	}

	return firstCmdErr
}
