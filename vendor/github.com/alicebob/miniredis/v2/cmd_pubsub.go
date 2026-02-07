// Commands from https://redis.io/commands#pubsub

package miniredis

import (
	"fmt"
	"strings"

	"github.com/alicebob/miniredis/v2/server"
)

// commandsPubsub handles all PUB/SUB operations.
func commandsPubsub(m *Miniredis) {
	m.srv.Register("SUBSCRIBE", m.cmdSubscribe)
	m.srv.Register("UNSUBSCRIBE", m.cmdUnsubscribe)
	m.srv.Register("PSUBSCRIBE", m.cmdPsubscribe)
	m.srv.Register("PUNSUBSCRIBE", m.cmdPunsubscribe)
	m.srv.Register("PUBLISH", m.cmdPublish)
	m.srv.Register("PUBSUB", m.cmdPubSub)
}

// SUBSCRIBE
func (m *Miniredis) cmdSubscribe(c *server.Peer, cmd string, args []string) {
	if len(args) < 1 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	ctx := getCtx(c)
	if ctx.nested {
		c.WriteError(msgNotFromScripts(ctx.nestedSHA))
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		sub := m.subscribedState(c)
		for _, channel := range args {
			n := sub.Subscribe(channel)
			c.Block(func(w *server.Writer) {
				w.WritePushLen(3)
				w.WriteBulk("subscribe")
				w.WriteBulk(channel)
				w.WriteInt(n)
			})
		}
	})
}

// UNSUBSCRIBE
func (m *Miniredis) cmdUnsubscribe(c *server.Peer, cmd string, args []string) {
	if !m.handleAuth(c) {
		return
	}
	ctx := getCtx(c)
	if ctx.nested {
		c.WriteError(msgNotFromScripts(ctx.nestedSHA))
		return
	}

	channels := args

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		sub := m.subscribedState(c)

		if len(channels) == 0 {
			channels = sub.Channels()
		}

		// there is no de-duplication
		for _, channel := range channels {
			n := sub.Unsubscribe(channel)
			c.Block(func(w *server.Writer) {
				w.WritePushLen(3)
				w.WriteBulk("unsubscribe")
				w.WriteBulk(channel)
				w.WriteInt(n)
			})
		}
		if len(channels) == 0 {
			// special case: there is always a reply
			c.Block(func(w *server.Writer) {
				w.WritePushLen(3)
				w.WriteBulk("unsubscribe")
				w.WriteNull()
				w.WriteInt(0)
			})
		}

		if sub.Count() == 0 {
			endSubscriber(m, c)
		}
	})
}

// PSUBSCRIBE
func (m *Miniredis) cmdPsubscribe(c *server.Peer, cmd string, args []string) {
	if len(args) < 1 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	ctx := getCtx(c)
	if ctx.nested {
		c.WriteError(msgNotFromScripts(ctx.nestedSHA))
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		sub := m.subscribedState(c)
		for _, pat := range args {
			n := sub.Psubscribe(pat)
			c.Block(func(w *server.Writer) {
				w.WritePushLen(3)
				w.WriteBulk("psubscribe")
				w.WriteBulk(pat)
				w.WriteInt(n)
			})
		}
	})
}

// PUNSUBSCRIBE
func (m *Miniredis) cmdPunsubscribe(c *server.Peer, cmd string, args []string) {
	if !m.handleAuth(c) {
		return
	}
	ctx := getCtx(c)
	if ctx.nested {
		c.WriteError(msgNotFromScripts(ctx.nestedSHA))
		return
	}

	patterns := args

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		sub := m.subscribedState(c)

		if len(patterns) == 0 {
			patterns = sub.Patterns()
		}

		// there is no de-duplication
		for _, pat := range patterns {
			n := sub.Punsubscribe(pat)
			c.Block(func(w *server.Writer) {
				w.WritePushLen(3)
				w.WriteBulk("punsubscribe")
				w.WriteBulk(pat)
				w.WriteInt(n)
			})
		}
		if len(patterns) == 0 {
			// special case: there is always a reply
			c.Block(func(w *server.Writer) {
				w.WritePushLen(3)
				w.WriteBulk("punsubscribe")
				w.WriteNull()
				w.WriteInt(0)
			})
		}

		if sub.Count() == 0 {
			endSubscriber(m, c)
		}
	})
}

// PUBLISH
func (m *Miniredis) cmdPublish(c *server.Peer, cmd string, args []string) {
	if len(args) != 2 {
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

	channel, mesg := args[0], args[1]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		c.WriteInt(m.publish(channel, mesg))
	})
}

// PUBSUB
func (m *Miniredis) cmdPubSub(c *server.Peer, cmd string, args []string) {
	if len(args) < 1 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}

	if m.checkPubsub(c, cmd) {
		return
	}

	subcommand := strings.ToUpper(args[0])
	subargs := args[1:]
	var argsOk bool

	switch subcommand {
	case "CHANNELS":
		argsOk = len(subargs) < 2
	case "NUMSUB":
		argsOk = true
	case "NUMPAT":
		argsOk = len(subargs) == 0
	default:
		setDirty(c)
		c.WriteError(fmt.Sprintf(msgFPubsubUsageSimple, subcommand))
		return
	}

	if !argsOk {
		setDirty(c)
		c.WriteError(fmt.Sprintf(msgFPubsubUsage, subcommand))
		return
	}

	if !m.handleAuth(c) {
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		switch subcommand {
		case "CHANNELS":
			pat := ""
			if len(subargs) == 1 {
				pat = subargs[0]
			}

			allsubs := m.allSubscribers()
			channels := activeChannels(allsubs, pat)

			c.WriteLen(len(channels))
			for _, channel := range channels {
				c.WriteBulk(channel)
			}

		case "NUMSUB":
			subs := m.allSubscribers()
			c.WriteLen(len(subargs) * 2)
			for _, channel := range subargs {
				c.WriteBulk(channel)
				c.WriteInt(countSubs(subs, channel))
			}

		case "NUMPAT":
			c.WriteInt(countPsubs(m.allSubscribers()))
		}
	})
}
