package miniredis

import (
	"fmt"
	"strings"

	"github.com/alicebob/miniredis/v2/server"
)

// commandsClient handles client operations.
func commandsClient(m *Miniredis) {
	m.srv.Register("CLIENT", m.cmdClient)
}

// CLIENT
func (m *Miniredis) cmdClient(c *server.Peer, cmd string, args []string) {
	if len(args) == 0 {
		setDirty(c)
		c.WriteError("ERR wrong number of arguments for 'client' command")
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		switch cmd := strings.ToUpper(args[0]); cmd {
		case "SETNAME":
			m.cmdClientSetName(c, args[1:])
		case "GETNAME":
			m.cmdClientGetName(c, args[1:])
		default:
			setDirty(c)
			c.WriteError(fmt.Sprintf("ERR unknown subcommand '%s'. Try CLIENT HELP.", cmd))
		}
	})
}

// CLIENT SETNAME
func (m *Miniredis) cmdClientSetName(c *server.Peer, args []string) {
	if len(args) != 1 {
		setDirty(c)
		c.WriteError("ERR wrong number of arguments for 'client setname' command")
		return
	}

	name := args[0]
	if strings.ContainsAny(name, " \n") {
		setDirty(c)
		c.WriteError("ERR Client names cannot contain spaces, newlines or special characters.")
		return

	}
	c.ClientName = name
	c.WriteOK()
}

// CLIENT GETNAME
func (m *Miniredis) cmdClientGetName(c *server.Peer, args []string) {
	if len(args) > 0 {
		setDirty(c)
		c.WriteError("ERR wrong number of arguments for 'client getname' command")
		return
	}

	if c.ClientName == "" {
		c.WriteNull()
	} else {
		c.WriteBulk(c.ClientName)
	}
}
