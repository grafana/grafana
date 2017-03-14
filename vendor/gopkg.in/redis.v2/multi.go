package redis

import (
	"errors"
	"fmt"
)

var errDiscard = errors.New("redis: Discard can be used only inside Exec")

// Not thread-safe.
type Multi struct {
	*Client
}

func (c *Client) Multi() *Multi {
	return &Multi{
		Client: &Client{
			baseClient: &baseClient{
				opt:      c.opt,
				connPool: newSingleConnPool(c.connPool, true),
			},
		},
	}
}

func (c *Multi) Close() error {
	if err := c.Unwatch().Err(); err != nil {
		return err
	}
	return c.Client.Close()
}

func (c *Multi) Watch(keys ...string) *StatusCmd {
	args := append([]string{"WATCH"}, keys...)
	cmd := NewStatusCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Multi) Unwatch(keys ...string) *StatusCmd {
	args := append([]string{"UNWATCH"}, keys...)
	cmd := NewStatusCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Multi) Discard() error {
	if c.cmds == nil {
		return errDiscard
	}
	c.cmds = c.cmds[:1]
	return nil
}

// Exec always returns list of commands. If transaction fails
// TxFailedErr is returned. Otherwise Exec returns error of the first
// failed command or nil.
func (c *Multi) Exec(f func() error) ([]Cmder, error) {
	c.cmds = []Cmder{NewStatusCmd("MULTI")}
	if err := f(); err != nil {
		return nil, err
	}
	c.cmds = append(c.cmds, NewSliceCmd("EXEC"))

	cmds := c.cmds
	c.cmds = nil

	if len(cmds) == 2 {
		return []Cmder{}, nil
	}

	cn, err := c.conn()
	if err != nil {
		setCmdsErr(cmds[1:len(cmds)-1], err)
		return cmds[1 : len(cmds)-1], err
	}

	err = c.execCmds(cn, cmds)
	if err != nil {
		c.freeConn(cn, err)
		return cmds[1 : len(cmds)-1], err
	}

	c.putConn(cn)
	return cmds[1 : len(cmds)-1], nil
}

func (c *Multi) execCmds(cn *conn, cmds []Cmder) error {
	err := c.writeCmd(cn, cmds...)
	if err != nil {
		setCmdsErr(cmds[1:len(cmds)-1], err)
		return err
	}

	statusCmd := NewStatusCmd()

	// Omit last command (EXEC).
	cmdsLen := len(cmds) - 1

	// Parse queued replies.
	for i := 0; i < cmdsLen; i++ {
		if err := statusCmd.parseReply(cn.rd); err != nil {
			setCmdsErr(cmds[1:len(cmds)-1], err)
			return err
		}
	}

	// Parse number of replies.
	line, err := readLine(cn.rd)
	if err != nil {
		setCmdsErr(cmds[1:len(cmds)-1], err)
		return err
	}
	if line[0] != '*' {
		err := fmt.Errorf("redis: expected '*', but got line %q", line)
		setCmdsErr(cmds[1:len(cmds)-1], err)
		return err
	}
	if len(line) == 3 && line[1] == '-' && line[2] == '1' {
		setCmdsErr(cmds[1:len(cmds)-1], TxFailedErr)
		return TxFailedErr
	}

	var firstCmdErr error

	// Parse replies.
	// Loop starts from 1 to omit MULTI cmd.
	for i := 1; i < cmdsLen; i++ {
		cmd := cmds[i]
		if err := cmd.parseReply(cn.rd); err != nil {
			if firstCmdErr == nil {
				firstCmdErr = err
			}
		}
	}

	return firstCmdErr
}
