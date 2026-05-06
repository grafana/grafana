package minisentinel

import (
	"fmt"
	"strconv"
	"strings"
	"sync"

	"github.com/alicebob/miniredis/v2"
	"github.com/alicebob/miniredis/v2/server"
)

func errWrongNumber(cmd string) string {
	return fmt.Sprintf("ERR wrong number of arguments for '%s' command", strings.ToLower(cmd))
}

// Sentinel - a redis sentinel server implementation.
type Sentinel struct {
	sync.Mutex
	srv         *server.Server
	port        int
	password    string
	signal      *sync.Cond
	masterInfo  MasterInfo
	master      *miniredis.Miniredis
	replicaInfo ReplicaInfo
	replica     *miniredis.Miniredis
}

// connCtx has all state for a single connection.
type connCtx struct {
	authenticated bool // auth enabled and a valid AUTH seen
}

// NewSentinel makes a new, non-started, Miniredis object.
func NewSentinel(master *miniredis.Miniredis, opts ...Option) *Sentinel {
	s := Sentinel{}
	s.signal = sync.NewCond(&s)
	o := GetOpts(opts...)
	s.master = master
	s.replica = o.master // set a reasonable default

	if o.replica != nil {
		s.replica = o.replica
	}
	s.MasterInfo(opts...)  // init and return masterInfo
	s.ReplicaInfo(opts...) // init/return replicaInfo
	return &s
}

// WithMaster - set the master
func (s *Sentinel) WithMaster(m *miniredis.Miniredis, opts ...Option) {
	s.master = m
}

// Master - get the master
func (s *Sentinel) Master() *miniredis.Miniredis {
	return s.master
}

// SetReplica - replace all the existing replicas
func (s *Sentinel) SetReplica(replica *miniredis.Miniredis) {
	s.replica = replica
}

// Replica - get the current replica
func (s *Sentinel) Replica() *miniredis.Miniredis {
	return s.replica
}

// Run creates and Start()s a Sentinel.
func Run(master *miniredis.Miniredis, opts ...Option) (*Sentinel, error) {
	s := NewSentinel(master)
	return s, s.Start()
}

// Start starts a server. It listens on a random port on localhost. See also
// Addr().
func (s *Sentinel) Start() error {
	srv, err := server.NewServer(fmt.Sprintf("127.0.0.1:%d", s.port))
	if err != nil {
		return err
	}
	return s.start(srv)
}

// StartAddr runs sentinel with a given addr. Examples: "127.0.0.1:26379",
// ":6379", or "127.0.0.1:0"
func (s *Sentinel) StartAddr(addr string) error {
	srv, err := server.NewServer(addr)
	if err != nil {
		return err
	}
	return s.start(srv)
}

func (s *Sentinel) start(srv *server.Server) error {
	s.Lock()
	defer s.Unlock()
	s.srv = srv
	s.port = srv.Addr().Port

	commandsPing(s)
	commandsSentinel(s)
	return nil
}

// Restart restarts a Close()d server on the same port. Values will be
// preserved.
func (s *Sentinel) Restart() error {
	return s.Start()
}

// Close shuts down a Sentinel.
func (s *Sentinel) Close() {
	s.Lock()

	if s.srv == nil {
		s.Unlock()
		return
	}
	srv := s.srv
	s.srv = nil
	s.Unlock()

	// the OnDisconnect callbacks can lock m, so run Close() outside the lock.
	srv.Close()

}

// RequireAuth makes every connection need to AUTH first. Disable again by
// setting an empty string.
func (s *Sentinel) RequireAuth(pw string) {
	s.Lock()
	defer s.Unlock()
	s.password = pw
}

// Addr returns '127.0.0.1:12345'. Can be given to a Dial(). See also Host()
// and Port(), which return the same things.
func (s *Sentinel) Addr() string {
	s.Lock()
	defer s.Unlock()
	return s.srv.Addr().String()
}

// Host returns the host part of Addr().
func (s *Sentinel) Host() string {
	s.Lock()
	defer s.Unlock()
	return s.srv.Addr().IP.String()
}

// Port returns the (random) port part of Addr().
func (s *Sentinel) Port() string {
	s.Lock()
	defer s.Unlock()
	return strconv.Itoa(s.srv.Addr().Port)
}

// CurrentConnectionCount returns the number of currently connected clients.
func (s *Sentinel) CurrentConnectionCount() int {
	s.Lock()
	defer s.Unlock()
	return s.srv.ClientsLen()
}

// TotalConnectionCount returns the number of client connections since server start.
func (s *Sentinel) TotalConnectionCount() int {
	s.Lock()
	defer s.Unlock()
	return int(s.srv.TotalConnections())
}

// MasterInfo - get the master's info
func (s *Sentinel) MasterInfo(opts ...Option) MasterInfo {
	return initMasterInfo(s, opts...)
}

// ReplicaInfo - get the replica's info
func (s *Sentinel) ReplicaInfo(opts ...Option) ReplicaInfo {
	return initReplicaInfo(s, opts...)
}

// handleAuth returns false if connection has no access. It sends the reply.
func (s *Sentinel) handleAuth(c *server.Peer) bool {
	s.Lock()
	defer s.Unlock()
	if s.password == "" {
		return true
	}
	if !getCtx(c).authenticated {
		c.WriteError("NOAUTH Authentication required.")
		return false
	}
	return true
}

func getCtx(c *server.Peer) *connCtx {
	if c.Ctx == nil {
		c.Ctx = &connCtx{}
	}
	return c.Ctx.(*connCtx)
}

func setAuthenticated(c *server.Peer) {
	getCtx(c).authenticated = true
}
