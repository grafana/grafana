package miniredis

import (
	"fmt"
	"strings"

	"github.com/alicebob/miniredis/v2/server"
)

// commandsObject handles all object operations.
func commandsObject(m *Miniredis) {
	m.srv.Register("OBJECT", m.cmdObject)
}

// OBJECT
func (m *Miniredis) cmdObject(c *server.Peer, cmd string, args []string) {
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

	switch sub := strings.ToLower(args[0]); sub {
	case "idletime":
		m.cmdObjectIdletime(c, args[1:])
	default:
		setDirty(c)
		c.WriteError(fmt.Sprintf(msgFObjectUsage, sub))
	}
}

// OBJECT IDLETIME
func (m *Miniredis) cmdObjectIdletime(c *server.Peer, args []string) {
	if len(args) != 1 {
		setDirty(c)
		c.WriteError(errWrongNumber("object|idletime"))
		return
	}
	key := args[0]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		t, ok := db.lru[key]
		if !ok {
			c.WriteNull()
			return
		}

		c.WriteInt(int(db.master.effectiveNow().Sub(t).Seconds()))
	})
}
