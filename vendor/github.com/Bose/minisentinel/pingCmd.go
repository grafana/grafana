package minisentinel

import "github.com/alicebob/miniredis/v2/server"

func commandsPing(s *Sentinel) {
	s.srv.Register("PING", s.cmdPing)
}

// cmdPing
func (s *Sentinel) cmdPing(c *server.Peer, cmd string, args []string) {
	if len(args) != 0 {
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !s.handleAuth(c) {
		return
	}
	c.WriteInline("PONG")
}
