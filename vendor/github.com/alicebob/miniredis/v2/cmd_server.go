// Commands from https://redis.io/commands#server

package miniredis

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/alicebob/miniredis/v2/server"
	"github.com/alicebob/miniredis/v2/size"
)

func commandsServer(m *Miniredis) {
	m.srv.Register("COMMAND", m.cmdCommand)
	m.srv.Register("DBSIZE", m.cmdDbsize)
	m.srv.Register("FLUSHALL", m.cmdFlushall)
	m.srv.Register("FLUSHDB", m.cmdFlushdb)
	m.srv.Register("INFO", m.cmdInfo)
	m.srv.Register("TIME", m.cmdTime)
	m.srv.Register("MEMORY", m.cmdMemory)
}

// MEMORY
func (m *Miniredis) cmdMemory(c *server.Peer, cmd string, args []string) {
	if len(args) == 0 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		cmd, args := strings.ToLower(args[0]), args[1:]
		switch cmd {
		case "usage":
			if len(args) < 1 {
				setDirty(c)
				c.WriteError(errWrongNumber("memory|usage"))
				return
			}
			if len(args) > 1 {
				setDirty(c)
				c.WriteError(msgSyntaxError)
				return
			}

			var (
				value interface{}
				ok    bool
			)
			switch db.keys[args[0]] {
			case "string":
				value, ok = db.stringKeys[args[0]]
			case "set":
				value, ok = db.setKeys[args[0]]
			case "hash":
				value, ok = db.hashKeys[args[0]]
			case "list":
				value, ok = db.listKeys[args[0]]
			case "hll":
				value, ok = db.hllKeys[args[0]]
			case "zset":
				value, ok = db.sortedsetKeys[args[0]]
			case "stream":
				value, ok = db.streamKeys[args[0]]
			}
			if !ok {
				c.WriteNull()
				return
			}
			c.WriteInt(size.Of(value))
		default:
			c.WriteError(fmt.Sprintf(msgMemorySubcommand, strings.ToUpper(cmd)))
		}
	})
}

// DBSIZE
func (m *Miniredis) cmdDbsize(c *server.Peer, cmd string, args []string) {
	if len(args) > 0 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		c.WriteInt(len(db.keys))
	})
}

// FLUSHALL
func (m *Miniredis) cmdFlushall(c *server.Peer, cmd string, args []string) {
	if len(args) > 0 && strings.ToLower(args[0]) == "async" {
		args = args[1:]
	}
	if len(args) > 0 {
		setDirty(c)
		c.WriteError(msgSyntaxError)
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		m.flushAll()
		c.WriteOK()
	})
}

// FLUSHDB
func (m *Miniredis) cmdFlushdb(c *server.Peer, cmd string, args []string) {
	if len(args) > 0 && strings.ToLower(args[0]) == "async" {
		args = args[1:]
	}
	if len(args) > 0 {
		setDirty(c)
		c.WriteError(msgSyntaxError)
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		m.db(ctx.selectedDB).flush()
		c.WriteOK()
	})
}

// TIME
func (m *Miniredis) cmdTime(c *server.Peer, cmd string, args []string) {
	if len(args) > 0 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		now := m.effectiveNow()
		nanos := now.UnixNano()
		seconds := nanos / 1_000_000_000
		microseconds := (nanos / 1_000) % 1_000_000

		c.WriteLen(2)
		c.WriteBulk(strconv.FormatInt(seconds, 10))
		c.WriteBulk(strconv.FormatInt(microseconds, 10))
	})
}
