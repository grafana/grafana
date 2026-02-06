// Package miniredis is a pure Go Redis test server, for use in Go unittests.
// There are no dependencies on system binaries, and every server you start
// will be empty.
//
// import "github.com/alicebob/miniredis/v2"
//
// Start a server with `s := miniredis.RunT(t)`, it'll be shutdown via a t.Cleanup().
// Or do everything manual: `s, err := miniredis.Run(); defer s.Close()`
//
// Point your Redis client to `s.Addr()` or `s.Host(), s.Port()`.
//
// Set keys directly via s.Set(...) and similar commands, or use a Redis client.
//
// For direct use you can select a Redis database with either `s.Select(12);
// s.Get("foo")` or `s.DB(12).Get("foo")`.
package miniredis

import (
	"context"
	"crypto/tls"
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/alicebob/miniredis/v2/proto"
	"github.com/alicebob/miniredis/v2/server"
)

var DumpMaxLineLen = 60

type hashKey map[string]string
type listKey []string
type setKey map[string]struct{}

// RedisDB holds a single (numbered) Redis database.
type RedisDB struct {
	master        *Miniredis               // pointer to the lock in Miniredis
	id            int                      // db id
	keys          map[string]string        // Master map of keys with their type
	stringKeys    map[string]string        // GET/SET &c. keys
	hashKeys      map[string]hashKey       // MGET/MSET &c. keys
	listKeys      map[string]listKey       // LPUSH &c. keys
	setKeys       map[string]setKey        // SADD &c. keys
	hllKeys       map[string]*hll          // PFADD &c. keys
	sortedsetKeys map[string]sortedSet     // ZADD &c. keys
	streamKeys    map[string]*streamKey    // XADD &c. keys
	ttl           map[string]time.Duration // effective TTL values
	lru           map[string]time.Time     // last recently used ( read or written to )
	keyVersion    map[string]uint          // used to watch values
}

// Miniredis is a Redis server implementation.
type Miniredis struct {
	sync.Mutex
	srv         *server.Server
	port        int
	passwords   map[string]string // username password
	dbs         map[int]*RedisDB
	selectedDB  int               // DB id used in the direct Get(), Set() &c.
	scripts     map[string]string // sha1 -> lua src
	signal      *sync.Cond
	now         time.Time // time.Now() if not set.
	subscribers map[*Subscriber]struct{}
	rand        *rand.Rand
	Ctx         context.Context
	CtxCancel   context.CancelFunc
}

type txCmd func(*server.Peer, *connCtx)

// database id + key combo
type dbKey struct {
	db  int
	key string
}

// connCtx has all state for a single connection.
// (this struct was named before context.Context existed)
type connCtx struct {
	selectedDB       int            // selected DB
	authenticated    bool           // auth enabled and a valid AUTH seen
	transaction      []txCmd        // transaction callbacks. Or nil.
	dirtyTransaction bool           // any error during QUEUEing
	watch            map[dbKey]uint // WATCHed keys
	subscriber       *Subscriber    // client is in PUBSUB mode if not nil
	nested           bool           // this is called via Lua
	nestedSHA        string         // set to the SHA of the nesting function
}

// NewMiniRedis makes a new, non-started, Miniredis object.
func NewMiniRedis() *Miniredis {
	m := Miniredis{
		dbs:         map[int]*RedisDB{},
		scripts:     map[string]string{},
		subscribers: map[*Subscriber]struct{}{},
	}
	m.Ctx, m.CtxCancel = context.WithCancel(context.Background())
	m.signal = sync.NewCond(&m)
	return &m
}

func newRedisDB(id int, m *Miniredis) RedisDB {
	return RedisDB{
		id:            id,
		master:        m,
		keys:          map[string]string{},
		lru:           map[string]time.Time{},
		stringKeys:    map[string]string{},
		hashKeys:      map[string]hashKey{},
		listKeys:      map[string]listKey{},
		setKeys:       map[string]setKey{},
		hllKeys:       map[string]*hll{},
		sortedsetKeys: map[string]sortedSet{},
		streamKeys:    map[string]*streamKey{},
		ttl:           map[string]time.Duration{},
		keyVersion:    map[string]uint{},
	}
}

// Run creates and Start()s a Miniredis.
func Run() (*Miniredis, error) {
	m := NewMiniRedis()
	return m, m.Start()
}

// Run creates and Start()s a Miniredis, TLS version.
func RunTLS(cfg *tls.Config) (*Miniredis, error) {
	m := NewMiniRedis()
	return m, m.StartTLS(cfg)
}

// Tester is a minimal version of a testing.T
type Tester interface {
	Fatalf(string, ...interface{})
	Cleanup(func())
	Logf(format string, args ...interface{})
}

// RunT start a new miniredis, pass it a testing.T. It also registers the cleanup after your test is done.
func RunT(t Tester) *Miniredis {
	m := NewMiniRedis()
	if err := m.Start(); err != nil {
		t.Fatalf("could not start miniredis: %s", err)
		// not reached
	}
	t.Cleanup(m.Close)
	return m
}

func runWithClient(t Tester) (*Miniredis, *proto.Client) {
	m := RunT(t)

	c, err := proto.Dial(m.Addr())
	if err != nil {
		t.Fatalf("could not connect to miniredis: %s", err)
	}
	t.Cleanup(func() {
		if err = c.Close(); err != nil {
			t.Logf("error closing connection to miniredis: %s", err)
		}
	})

	return m, c
}

// Start starts a server. It listens on a random port on localhost. See also
// Addr().
func (m *Miniredis) Start() error {
	s, err := server.NewServer(fmt.Sprintf("127.0.0.1:%d", m.port))
	if err != nil {
		return err
	}
	return m.start(s)
}

// Start starts a server, TLS version.
func (m *Miniredis) StartTLS(cfg *tls.Config) error {
	s, err := server.NewServerTLS(fmt.Sprintf("127.0.0.1:%d", m.port), cfg)
	if err != nil {
		return err
	}
	return m.start(s)
}

// StartAddr runs miniredis with a given addr. Examples: "127.0.0.1:6379",
// ":6379", or "127.0.0.1:0"
func (m *Miniredis) StartAddr(addr string) error {
	s, err := server.NewServer(addr)
	if err != nil {
		return err
	}
	return m.start(s)
}

// StartAddrTLS runs miniredis with a given addr, TLS version.
func (m *Miniredis) StartAddrTLS(addr string, cfg *tls.Config) error {
	s, err := server.NewServerTLS(addr, cfg)
	if err != nil {
		return err
	}
	return m.start(s)
}

func (m *Miniredis) start(s *server.Server) error {
	m.Lock()
	defer m.Unlock()
	m.srv = s
	m.port = s.Addr().Port

	commandsConnection(m)
	commandsGeneric(m)
	commandsServer(m)
	commandsString(m)
	commandsHash(m)
	commandsList(m)
	commandsPubsub(m)
	commandsSet(m)
	commandsSortedSet(m)
	commandsStream(m)
	commandsTransaction(m)
	commandsScripting(m)
	commandsGeo(m)
	commandsCluster(m)
	commandsHll(m)
	commandsClient(m)
	commandsObject(m)

	return nil
}

// Restart restarts a Close()d server on the same port. Values will be
// preserved.
func (m *Miniredis) Restart() error {
	return m.Start()
}

// Close shuts down a Miniredis.
func (m *Miniredis) Close() {
	m.Lock()

	if m.srv == nil {
		m.Unlock()
		return
	}
	srv := m.srv
	m.srv = nil
	m.CtxCancel()
	m.Unlock()

	// the OnDisconnect callbacks can lock m, so run Close() outside the lock.
	srv.Close()

}

// RequireAuth makes every connection need to AUTH first. This is the old 'AUTH [password] command.
// Remove it by setting an empty string.
func (m *Miniredis) RequireAuth(pw string) {
	m.RequireUserAuth("default", pw)
}

// Add a username/password, for use with 'AUTH [username] [password]'.
// There are currently no access controls for commands implemented.
// Disable access for the user with an empty password.
func (m *Miniredis) RequireUserAuth(username, pw string) {
	m.Lock()
	defer m.Unlock()
	if m.passwords == nil {
		m.passwords = map[string]string{}
	}
	if pw == "" {
		delete(m.passwords, username)
		return
	}
	m.passwords[username] = pw
}

// DB returns a DB by ID.
func (m *Miniredis) DB(i int) *RedisDB {
	m.Lock()
	defer m.Unlock()
	return m.db(i)
}

// get DB. No locks!
func (m *Miniredis) db(i int) *RedisDB {
	if db, ok := m.dbs[i]; ok {
		return db
	}
	db := newRedisDB(i, m) // main miniredis has our mutex.
	m.dbs[i] = &db
	return &db
}

// SwapDB swaps DBs by IDs.
func (m *Miniredis) SwapDB(i, j int) bool {
	m.Lock()
	defer m.Unlock()
	return m.swapDB(i, j)
}

// swap DB. No locks!
func (m *Miniredis) swapDB(i, j int) bool {
	db1 := m.db(i)
	db2 := m.db(j)

	db1.id = j
	db2.id = i

	m.dbs[i] = db2
	m.dbs[j] = db1

	return true
}

// Addr returns '127.0.0.1:12345'. Can be given to a Dial(). See also Host()
// and Port(), which return the same things.
func (m *Miniredis) Addr() string {
	m.Lock()
	defer m.Unlock()
	return m.srv.Addr().String()
}

// Host returns the host part of Addr().
func (m *Miniredis) Host() string {
	m.Lock()
	defer m.Unlock()
	return m.srv.Addr().IP.String()
}

// Port returns the (random) port part of Addr().
func (m *Miniredis) Port() string {
	m.Lock()
	defer m.Unlock()
	return strconv.Itoa(m.srv.Addr().Port)
}

// CommandCount returns the number of processed commands.
func (m *Miniredis) CommandCount() int {
	m.Lock()
	defer m.Unlock()
	return int(m.srv.TotalCommands())
}

// CurrentConnectionCount returns the number of currently connected clients.
func (m *Miniredis) CurrentConnectionCount() int {
	m.Lock()
	defer m.Unlock()
	return m.srv.ClientsLen()
}

// TotalConnectionCount returns the number of client connections since server start.
func (m *Miniredis) TotalConnectionCount() int {
	m.Lock()
	defer m.Unlock()
	return int(m.srv.TotalConnections())
}

// FastForward decreases all TTLs by the given duration. All TTLs <= 0 will be
// expired.
func (m *Miniredis) FastForward(duration time.Duration) {
	m.Lock()
	defer m.Unlock()
	for _, db := range m.dbs {
		db.fastForward(duration)
	}
}

// Server returns the underlying server to allow custom commands to be implemented
func (m *Miniredis) Server() *server.Server {
	return m.srv
}

// Dump returns a text version of the selected DB, usable for debugging.
//
// Dump limits the maximum length of each key:value to "DumpMaxLineLen" characters.
// To increase that, call something like:
//
//	miniredis.DumpMaxLineLen = 1024
//	mr, _ = miniredis.Run()
//	mr.Dump()
func (m *Miniredis) Dump() string {
	m.Lock()
	defer m.Unlock()

	var (
		maxLen = DumpMaxLineLen
		indent = "   "
		db     = m.db(m.selectedDB)
		r      = ""
		v      = func(s string) string {
			suffix := ""
			if len(s) > maxLen {
				suffix = fmt.Sprintf("...(%d)", len(s))
				s = s[:maxLen-len(suffix)]
			}
			return fmt.Sprintf("%q%s", s, suffix)
		}
	)

	for _, k := range db.allKeys() {
		r += fmt.Sprintf("- %s\n", k)
		t := db.t(k)
		switch t {
		case "string":
			r += fmt.Sprintf("%s%s\n", indent, v(db.stringKeys[k]))
		case "hash":
			for _, hk := range db.hashFields(k) {
				r += fmt.Sprintf("%s%s: %s\n", indent, hk, v(db.hashGet(k, hk)))
			}
		case "list":
			for _, lk := range db.listKeys[k] {
				r += fmt.Sprintf("%s%s\n", indent, v(lk))
			}
		case "set":
			for _, mk := range db.setMembers(k) {
				r += fmt.Sprintf("%s%s\n", indent, v(mk))
			}
		case "zset":
			for _, el := range db.ssetElements(k) {
				r += fmt.Sprintf("%s%f: %s\n", indent, el.score, v(el.member))
			}
		case "stream":
			for _, entry := range db.streamKeys[k].entries {
				r += fmt.Sprintf("%s%s\n", indent, entry.ID)
				ev := entry.Values
				for i := 0; i < len(ev)/2; i++ {
					r += fmt.Sprintf("%s%s%s: %s\n", indent, indent, v(ev[2*i]), v(ev[2*i+1]))
				}
			}
		case "hll":
			for _, entry := range db.hllKeys {
				r += fmt.Sprintf("%s%s\n", indent, v(string(entry.Bytes())))
			}
		default:
			r += fmt.Sprintf("%s(a %s, fixme!)\n", indent, t)
		}
	}
	return r
}

// SetTime sets the time against which EXPIREAT values are compared, and the
// time used in stream entry IDs.  Will use time.Now() if this is not set.
func (m *Miniredis) SetTime(t time.Time) {
	m.Lock()
	defer m.Unlock()
	m.now = t
}

// make every command return this message. For example:
//
//	LOADING Redis is loading the dataset in memory
//	MASTERDOWN Link with MASTER is down and replica-serve-stale-data is set to 'no'.
//
// Clear it with an empty string. Don't add newlines.
func (m *Miniredis) SetError(msg string) {
	cb := server.Hook(nil)
	if msg != "" {
		cb = func(c *server.Peer, cmd string, args ...string) bool {
			c.WriteError(msg)
			return true
		}
	}
	m.srv.SetPreHook(cb)
}

// isValidCMD returns true if command is valid and can be executed.
func (m *Miniredis) isValidCMD(c *server.Peer, cmd string) bool {
	if !m.handleAuth(c) {
		return false
	}
	if m.checkPubsub(c, cmd) {
		return false
	}

	return true
}

// handleAuth returns false if connection has no access. It sends the reply.
func (m *Miniredis) handleAuth(c *server.Peer) bool {
	if getCtx(c).nested {
		return true
	}

	m.Lock()
	defer m.Unlock()
	if len(m.passwords) == 0 {
		return true
	}
	if !getCtx(c).authenticated {
		c.WriteError("NOAUTH Authentication required.")
		return false
	}
	return true
}

// handlePubsub sends an error to the user if the connection is in PUBSUB mode.
// It'll return true if it did.
func (m *Miniredis) checkPubsub(c *server.Peer, cmd string) bool {
	if getCtx(c).nested {
		return false
	}

	m.Lock()
	defer m.Unlock()

	ctx := getCtx(c)
	if ctx.subscriber == nil {
		return false
	}

	prefix := "ERR "
	if strings.ToLower(cmd) == "exec" {
		prefix = "EXECABORT Transaction discarded because of: "
	}
	c.WriteError(fmt.Sprintf(
		"%sCan't execute '%s': only (P)SUBSCRIBE / (P)UNSUBSCRIBE / PING / QUIT are allowed in this context",
		prefix,
		strings.ToLower(cmd),
	))
	return true
}

func getCtx(c *server.Peer) *connCtx {
	if c.Ctx == nil {
		c.Ctx = &connCtx{}
	}
	return c.Ctx.(*connCtx)
}

func startTx(ctx *connCtx) {
	ctx.transaction = []txCmd{}
	ctx.dirtyTransaction = false
}

func stopTx(ctx *connCtx) {
	ctx.transaction = nil
	unwatch(ctx)
}

func inTx(ctx *connCtx) bool {
	return ctx.transaction != nil
}

func addTxCmd(ctx *connCtx, cb txCmd) {
	ctx.transaction = append(ctx.transaction, cb)
}

func watch(db *RedisDB, ctx *connCtx, key string) {
	if ctx.watch == nil {
		ctx.watch = map[dbKey]uint{}
	}
	ctx.watch[dbKey{db: db.id, key: key}] = db.keyVersion[key] // Can be 0.
}

func unwatch(ctx *connCtx) {
	ctx.watch = nil
}

// setDirty can be called even when not in an tx. Is an no-op then.
func setDirty(c *server.Peer) {
	if c.Ctx == nil {
		// No transaction. Not relevant.
		return
	}
	getCtx(c).dirtyTransaction = true
}

func (m *Miniredis) addSubscriber(s *Subscriber) {
	m.subscribers[s] = struct{}{}
}

// closes and remove the subscriber.
func (m *Miniredis) removeSubscriber(s *Subscriber) {
	_, ok := m.subscribers[s]
	delete(m.subscribers, s)
	if ok {
		s.Close()
	}
}

func (m *Miniredis) publish(c, msg string) int {
	n := 0
	for s := range m.subscribers {
		n += s.Publish(c, msg)
	}
	return n
}

// enter 'subscribed state', or return the existing one.
func (m *Miniredis) subscribedState(c *server.Peer) *Subscriber {
	ctx := getCtx(c)
	sub := ctx.subscriber
	if sub != nil {
		return sub
	}

	sub = newSubscriber()
	m.addSubscriber(sub)

	c.OnDisconnect(func() {
		m.Lock()
		m.removeSubscriber(sub)
		m.Unlock()
	})

	ctx.subscriber = sub

	go monitorPublish(c, sub.publish)
	go monitorPpublish(c, sub.ppublish)

	return sub
}

// whenever the p?sub count drops to 0 subscribed state should be stopped, and
// all redis commands are allowed again.
func endSubscriber(m *Miniredis, c *server.Peer) {
	ctx := getCtx(c)
	if sub := ctx.subscriber; sub != nil {
		m.removeSubscriber(sub) // will Close() the sub
	}
	ctx.subscriber = nil
}

// Start a new pubsub subscriber. It can (un) subscribe to channels and
// patterns, and has a channel to get published messages. Close it with
// Close().
// Does not close itself when there are no subscriptions left.
func (m *Miniredis) NewSubscriber() *Subscriber {
	sub := newSubscriber()

	m.Lock()
	m.addSubscriber(sub)
	m.Unlock()

	return sub
}

func (m *Miniredis) allSubscribers() []*Subscriber {
	var subs []*Subscriber
	for s := range m.subscribers {
		subs = append(subs, s)
	}
	return subs
}

func (m *Miniredis) Seed(seed int) {
	m.Lock()
	defer m.Unlock()

	// m.rand is not safe for concurrent use.
	m.rand = rand.New(rand.NewSource(int64(seed)))
}

func (m *Miniredis) randIntn(n int) int {
	if m.rand == nil {
		return rand.Intn(n)
	}
	return m.rand.Intn(n)
}

// shuffle shuffles a list of strings. Kinda.
func (m *Miniredis) shuffle(l []string) {
	for range l {
		i := m.randIntn(len(l))
		j := m.randIntn(len(l))
		l[i], l[j] = l[j], l[i]
	}
}

func (m *Miniredis) effectiveNow() time.Time {
	if !m.now.IsZero() {
		return m.now
	}
	return time.Now().UTC()
}

// convert a unixtimestamp to a duration, to use an absolute time as TTL.
// d can be either time.Second or time.Millisecond.
func (m *Miniredis) at(i int, d time.Duration) time.Duration {
	var ts time.Time
	switch d {
	case time.Millisecond:
		ts = time.Unix(int64(i/1000), 1000000*int64(i%1000))
	case time.Second:
		ts = time.Unix(int64(i), 0)
	default:
		panic("invalid time unit (d). Fixme!")
	}
	now := m.effectiveNow()
	return ts.Sub(now)
}

// copy does not mind if dst already exists.
func (m *Miniredis) copy(
	srcDB *RedisDB, src string,
	destDB *RedisDB, dst string,
) error {
	if !srcDB.exists(src) {
		return ErrKeyNotFound
	}

	switch srcDB.t(src) {
	case "string":
		destDB.stringKeys[dst] = srcDB.stringKeys[src]
	case "hash":
		destDB.hashKeys[dst] = copyHashKey(srcDB.hashKeys[src])
	case "list":
		destDB.listKeys[dst] = copyListKey(srcDB.listKeys[src])
	case "set":
		destDB.setKeys[dst] = copySetKey(srcDB.setKeys[src])
	case "zset":
		destDB.sortedsetKeys[dst] = copySortedSet(srcDB.sortedsetKeys[src])
	case "stream":
		destDB.streamKeys[dst] = srcDB.streamKeys[src].copy()
	case "hll":
		destDB.hllKeys[dst] = srcDB.hllKeys[src].copy()
	default:
		panic("missing case")
	}
	destDB.keys[dst] = srcDB.keys[src]
	destDB.incr(dst)
	if v, ok := srcDB.ttl[src]; ok {
		destDB.ttl[dst] = v
	}
	return nil
}

func copyHashKey(orig hashKey) hashKey {
	cpy := hashKey{}
	for k, v := range orig {
		cpy[k] = v
	}
	return cpy
}

func copyListKey(orig listKey) listKey {
	cpy := make(listKey, len(orig))
	copy(cpy, orig)
	return cpy
}

func copySetKey(orig setKey) setKey {
	cpy := setKey{}
	for k, v := range orig {
		cpy[k] = v
	}
	return cpy
}

func copySortedSet(orig sortedSet) sortedSet {
	cpy := sortedSet{}
	for k, v := range orig {
		cpy[k] = v
	}
	return cpy
}
