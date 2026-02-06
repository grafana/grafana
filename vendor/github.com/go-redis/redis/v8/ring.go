package redis

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/cespare/xxhash/v2"
	rendezvous "github.com/dgryski/go-rendezvous" //nolint

	"github.com/go-redis/redis/v8/internal"
	"github.com/go-redis/redis/v8/internal/hashtag"
	"github.com/go-redis/redis/v8/internal/pool"
	"github.com/go-redis/redis/v8/internal/rand"
)

var errRingShardsDown = errors.New("redis: all ring shards are down")

//------------------------------------------------------------------------------

type ConsistentHash interface {
	Get(string) string
}

type rendezvousWrapper struct {
	*rendezvous.Rendezvous
}

func (w rendezvousWrapper) Get(key string) string {
	return w.Lookup(key)
}

func newRendezvous(shards []string) ConsistentHash {
	return rendezvousWrapper{rendezvous.New(shards, xxhash.Sum64String)}
}

//------------------------------------------------------------------------------

// RingOptions are used to configure a ring client and should be
// passed to NewRing.
type RingOptions struct {
	// Map of name => host:port addresses of ring shards.
	Addrs map[string]string

	// NewClient creates a shard client with provided name and options.
	NewClient func(name string, opt *Options) *Client

	// Frequency of PING commands sent to check shards availability.
	// Shard is considered down after 3 subsequent failed checks.
	HeartbeatFrequency time.Duration

	// NewConsistentHash returns a consistent hash that is used
	// to distribute keys across the shards.
	//
	// See https://medium.com/@dgryski/consistent-hashing-algorithmic-tradeoffs-ef6b8e2fcae8
	// for consistent hashing algorithmic tradeoffs.
	NewConsistentHash func(shards []string) ConsistentHash

	// Following options are copied from Options struct.

	Dialer    func(ctx context.Context, network, addr string) (net.Conn, error)
	OnConnect func(ctx context.Context, cn *Conn) error

	Username string
	Password string
	DB       int

	MaxRetries      int
	MinRetryBackoff time.Duration
	MaxRetryBackoff time.Duration

	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration

	// PoolFIFO uses FIFO mode for each node connection pool GET/PUT (default LIFO).
	PoolFIFO bool

	PoolSize           int
	MinIdleConns       int
	MaxConnAge         time.Duration
	PoolTimeout        time.Duration
	IdleTimeout        time.Duration
	IdleCheckFrequency time.Duration

	TLSConfig *tls.Config
	Limiter   Limiter
}

func (opt *RingOptions) init() {
	if opt.NewClient == nil {
		opt.NewClient = func(name string, opt *Options) *Client {
			return NewClient(opt)
		}
	}

	if opt.HeartbeatFrequency == 0 {
		opt.HeartbeatFrequency = 500 * time.Millisecond
	}

	if opt.NewConsistentHash == nil {
		opt.NewConsistentHash = newRendezvous
	}

	if opt.MaxRetries == -1 {
		opt.MaxRetries = 0
	} else if opt.MaxRetries == 0 {
		opt.MaxRetries = 3
	}
	switch opt.MinRetryBackoff {
	case -1:
		opt.MinRetryBackoff = 0
	case 0:
		opt.MinRetryBackoff = 8 * time.Millisecond
	}
	switch opt.MaxRetryBackoff {
	case -1:
		opt.MaxRetryBackoff = 0
	case 0:
		opt.MaxRetryBackoff = 512 * time.Millisecond
	}
}

func (opt *RingOptions) clientOptions() *Options {
	return &Options{
		Dialer:    opt.Dialer,
		OnConnect: opt.OnConnect,

		Username: opt.Username,
		Password: opt.Password,
		DB:       opt.DB,

		MaxRetries: -1,

		DialTimeout:  opt.DialTimeout,
		ReadTimeout:  opt.ReadTimeout,
		WriteTimeout: opt.WriteTimeout,

		PoolFIFO:           opt.PoolFIFO,
		PoolSize:           opt.PoolSize,
		MinIdleConns:       opt.MinIdleConns,
		MaxConnAge:         opt.MaxConnAge,
		PoolTimeout:        opt.PoolTimeout,
		IdleTimeout:        opt.IdleTimeout,
		IdleCheckFrequency: opt.IdleCheckFrequency,

		TLSConfig: opt.TLSConfig,
		Limiter:   opt.Limiter,
	}
}

//------------------------------------------------------------------------------

type ringShard struct {
	Client *Client
	down   int32
}

func newRingShard(opt *RingOptions, name, addr string) *ringShard {
	clopt := opt.clientOptions()
	clopt.Addr = addr

	return &ringShard{
		Client: opt.NewClient(name, clopt),
	}
}

func (shard *ringShard) String() string {
	var state string
	if shard.IsUp() {
		state = "up"
	} else {
		state = "down"
	}
	return fmt.Sprintf("%s is %s", shard.Client, state)
}

func (shard *ringShard) IsDown() bool {
	const threshold = 3
	return atomic.LoadInt32(&shard.down) >= threshold
}

func (shard *ringShard) IsUp() bool {
	return !shard.IsDown()
}

// Vote votes to set shard state and returns true if state was changed.
func (shard *ringShard) Vote(up bool) bool {
	if up {
		changed := shard.IsDown()
		atomic.StoreInt32(&shard.down, 0)
		return changed
	}

	if shard.IsDown() {
		return false
	}

	atomic.AddInt32(&shard.down, 1)
	return shard.IsDown()
}

//------------------------------------------------------------------------------

type ringShards struct {
	opt *RingOptions

	mu       sync.RWMutex
	hash     ConsistentHash
	shards   map[string]*ringShard // read only
	list     []*ringShard          // read only
	numShard int
	closed   bool
}

func newRingShards(opt *RingOptions) *ringShards {
	shards := make(map[string]*ringShard, len(opt.Addrs))
	list := make([]*ringShard, 0, len(shards))

	for name, addr := range opt.Addrs {
		shard := newRingShard(opt, name, addr)
		shards[name] = shard

		list = append(list, shard)
	}

	c := &ringShards{
		opt: opt,

		shards: shards,
		list:   list,
	}
	c.rebalance()

	return c
}

func (c *ringShards) List() []*ringShard {
	var list []*ringShard

	c.mu.RLock()
	if !c.closed {
		list = c.list
	}
	c.mu.RUnlock()

	return list
}

func (c *ringShards) Hash(key string) string {
	key = hashtag.Key(key)

	var hash string

	c.mu.RLock()
	if c.numShard > 0 {
		hash = c.hash.Get(key)
	}
	c.mu.RUnlock()

	return hash
}

func (c *ringShards) GetByKey(key string) (*ringShard, error) {
	key = hashtag.Key(key)

	c.mu.RLock()

	if c.closed {
		c.mu.RUnlock()
		return nil, pool.ErrClosed
	}

	if c.numShard == 0 {
		c.mu.RUnlock()
		return nil, errRingShardsDown
	}

	hash := c.hash.Get(key)
	if hash == "" {
		c.mu.RUnlock()
		return nil, errRingShardsDown
	}

	shard := c.shards[hash]
	c.mu.RUnlock()

	return shard, nil
}

func (c *ringShards) GetByName(shardName string) (*ringShard, error) {
	if shardName == "" {
		return c.Random()
	}

	c.mu.RLock()
	shard := c.shards[shardName]
	c.mu.RUnlock()
	return shard, nil
}

func (c *ringShards) Random() (*ringShard, error) {
	return c.GetByKey(strconv.Itoa(rand.Int()))
}

// heartbeat monitors state of each shard in the ring.
func (c *ringShards) Heartbeat(frequency time.Duration) {
	ticker := time.NewTicker(frequency)
	defer ticker.Stop()

	ctx := context.Background()
	for range ticker.C {
		var rebalance bool

		for _, shard := range c.List() {
			err := shard.Client.Ping(ctx).Err()
			isUp := err == nil || err == pool.ErrPoolTimeout
			if shard.Vote(isUp) {
				internal.Logger.Printf(context.Background(), "ring shard state changed: %s", shard)
				rebalance = true
			}
		}

		if rebalance {
			c.rebalance()
		}
	}
}

// rebalance removes dead shards from the Ring.
func (c *ringShards) rebalance() {
	c.mu.RLock()
	shards := c.shards
	c.mu.RUnlock()

	liveShards := make([]string, 0, len(shards))

	for name, shard := range shards {
		if shard.IsUp() {
			liveShards = append(liveShards, name)
		}
	}

	hash := c.opt.NewConsistentHash(liveShards)

	c.mu.Lock()
	c.hash = hash
	c.numShard = len(liveShards)
	c.mu.Unlock()
}

func (c *ringShards) Len() int {
	c.mu.RLock()
	l := c.numShard
	c.mu.RUnlock()
	return l
}

func (c *ringShards) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil
	}
	c.closed = true

	var firstErr error
	for _, shard := range c.shards {
		if err := shard.Client.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	c.hash = nil
	c.shards = nil
	c.list = nil

	return firstErr
}

//------------------------------------------------------------------------------

type ring struct {
	opt           *RingOptions
	shards        *ringShards
	cmdsInfoCache *cmdsInfoCache //nolint:structcheck
}

// Ring is a Redis client that uses consistent hashing to distribute
// keys across multiple Redis servers (shards). It's safe for
// concurrent use by multiple goroutines.
//
// Ring monitors the state of each shard and removes dead shards from
// the ring. When a shard comes online it is added back to the ring. This
// gives you maximum availability and partition tolerance, but no
// consistency between different shards or even clients. Each client
// uses shards that are available to the client and does not do any
// coordination when shard state is changed.
//
// Ring should be used when you need multiple Redis servers for caching
// and can tolerate losing data when one of the servers dies.
// Otherwise you should use Redis Cluster.
type Ring struct {
	*ring
	cmdable
	hooks
	ctx context.Context
}

func NewRing(opt *RingOptions) *Ring {
	opt.init()

	ring := Ring{
		ring: &ring{
			opt:    opt,
			shards: newRingShards(opt),
		},
		ctx: context.Background(),
	}

	ring.cmdsInfoCache = newCmdsInfoCache(ring.cmdsInfo)
	ring.cmdable = ring.Process

	go ring.shards.Heartbeat(opt.HeartbeatFrequency)

	return &ring
}

func (c *Ring) Context() context.Context {
	return c.ctx
}

func (c *Ring) WithContext(ctx context.Context) *Ring {
	if ctx == nil {
		panic("nil context")
	}
	clone := *c
	clone.cmdable = clone.Process
	clone.hooks.lock()
	clone.ctx = ctx
	return &clone
}

// Do creates a Cmd from the args and processes the cmd.
func (c *Ring) Do(ctx context.Context, args ...interface{}) *Cmd {
	cmd := NewCmd(ctx, args...)
	_ = c.Process(ctx, cmd)
	return cmd
}

func (c *Ring) Process(ctx context.Context, cmd Cmder) error {
	return c.hooks.process(ctx, cmd, c.process)
}

// Options returns read-only Options that were used to create the client.
func (c *Ring) Options() *RingOptions {
	return c.opt
}

func (c *Ring) retryBackoff(attempt int) time.Duration {
	return internal.RetryBackoff(attempt, c.opt.MinRetryBackoff, c.opt.MaxRetryBackoff)
}

// PoolStats returns accumulated connection pool stats.
func (c *Ring) PoolStats() *PoolStats {
	shards := c.shards.List()
	var acc PoolStats
	for _, shard := range shards {
		s := shard.Client.connPool.Stats()
		acc.Hits += s.Hits
		acc.Misses += s.Misses
		acc.Timeouts += s.Timeouts
		acc.TotalConns += s.TotalConns
		acc.IdleConns += s.IdleConns
	}
	return &acc
}

// Len returns the current number of shards in the ring.
func (c *Ring) Len() int {
	return c.shards.Len()
}

// Subscribe subscribes the client to the specified channels.
func (c *Ring) Subscribe(ctx context.Context, channels ...string) *PubSub {
	if len(channels) == 0 {
		panic("at least one channel is required")
	}

	shard, err := c.shards.GetByKey(channels[0])
	if err != nil {
		// TODO: return PubSub with sticky error
		panic(err)
	}
	return shard.Client.Subscribe(ctx, channels...)
}

// PSubscribe subscribes the client to the given patterns.
func (c *Ring) PSubscribe(ctx context.Context, channels ...string) *PubSub {
	if len(channels) == 0 {
		panic("at least one channel is required")
	}

	shard, err := c.shards.GetByKey(channels[0])
	if err != nil {
		// TODO: return PubSub with sticky error
		panic(err)
	}
	return shard.Client.PSubscribe(ctx, channels...)
}

// ForEachShard concurrently calls the fn on each live shard in the ring.
// It returns the first error if any.
func (c *Ring) ForEachShard(
	ctx context.Context,
	fn func(ctx context.Context, client *Client) error,
) error {
	shards := c.shards.List()
	var wg sync.WaitGroup
	errCh := make(chan error, 1)
	for _, shard := range shards {
		if shard.IsDown() {
			continue
		}

		wg.Add(1)
		go func(shard *ringShard) {
			defer wg.Done()
			err := fn(ctx, shard.Client)
			if err != nil {
				select {
				case errCh <- err:
				default:
				}
			}
		}(shard)
	}
	wg.Wait()

	select {
	case err := <-errCh:
		return err
	default:
		return nil
	}
}

func (c *Ring) cmdsInfo(ctx context.Context) (map[string]*CommandInfo, error) {
	shards := c.shards.List()
	var firstErr error
	for _, shard := range shards {
		cmdsInfo, err := shard.Client.Command(ctx).Result()
		if err == nil {
			return cmdsInfo, nil
		}
		if firstErr == nil {
			firstErr = err
		}
	}
	if firstErr == nil {
		return nil, errRingShardsDown
	}
	return nil, firstErr
}

func (c *Ring) cmdInfo(ctx context.Context, name string) *CommandInfo {
	cmdsInfo, err := c.cmdsInfoCache.Get(ctx)
	if err != nil {
		return nil
	}
	info := cmdsInfo[name]
	if info == nil {
		internal.Logger.Printf(ctx, "info for cmd=%s not found", name)
	}
	return info
}

func (c *Ring) cmdShard(ctx context.Context, cmd Cmder) (*ringShard, error) {
	cmdInfo := c.cmdInfo(ctx, cmd.Name())
	pos := cmdFirstKeyPos(cmd, cmdInfo)
	if pos == 0 {
		return c.shards.Random()
	}
	firstKey := cmd.stringArg(pos)
	return c.shards.GetByKey(firstKey)
}

func (c *Ring) process(ctx context.Context, cmd Cmder) error {
	var lastErr error
	for attempt := 0; attempt <= c.opt.MaxRetries; attempt++ {
		if attempt > 0 {
			if err := internal.Sleep(ctx, c.retryBackoff(attempt)); err != nil {
				return err
			}
		}

		shard, err := c.cmdShard(ctx, cmd)
		if err != nil {
			return err
		}

		lastErr = shard.Client.Process(ctx, cmd)
		if lastErr == nil || !shouldRetry(lastErr, cmd.readTimeout() == nil) {
			return lastErr
		}
	}
	return lastErr
}

func (c *Ring) Pipelined(ctx context.Context, fn func(Pipeliner) error) ([]Cmder, error) {
	return c.Pipeline().Pipelined(ctx, fn)
}

func (c *Ring) Pipeline() Pipeliner {
	pipe := Pipeline{
		ctx:  c.ctx,
		exec: c.processPipeline,
	}
	pipe.init()
	return &pipe
}

func (c *Ring) processPipeline(ctx context.Context, cmds []Cmder) error {
	return c.hooks.processPipeline(ctx, cmds, func(ctx context.Context, cmds []Cmder) error {
		return c.generalProcessPipeline(ctx, cmds, false)
	})
}

func (c *Ring) TxPipelined(ctx context.Context, fn func(Pipeliner) error) ([]Cmder, error) {
	return c.TxPipeline().Pipelined(ctx, fn)
}

func (c *Ring) TxPipeline() Pipeliner {
	pipe := Pipeline{
		ctx:  c.ctx,
		exec: c.processTxPipeline,
	}
	pipe.init()
	return &pipe
}

func (c *Ring) processTxPipeline(ctx context.Context, cmds []Cmder) error {
	return c.hooks.processPipeline(ctx, cmds, func(ctx context.Context, cmds []Cmder) error {
		return c.generalProcessPipeline(ctx, cmds, true)
	})
}

func (c *Ring) generalProcessPipeline(
	ctx context.Context, cmds []Cmder, tx bool,
) error {
	cmdsMap := make(map[string][]Cmder)
	for _, cmd := range cmds {
		cmdInfo := c.cmdInfo(ctx, cmd.Name())
		hash := cmd.stringArg(cmdFirstKeyPos(cmd, cmdInfo))
		if hash != "" {
			hash = c.shards.Hash(hash)
		}
		cmdsMap[hash] = append(cmdsMap[hash], cmd)
	}

	var wg sync.WaitGroup
	for hash, cmds := range cmdsMap {
		wg.Add(1)
		go func(hash string, cmds []Cmder) {
			defer wg.Done()

			_ = c.processShardPipeline(ctx, hash, cmds, tx)
		}(hash, cmds)
	}

	wg.Wait()
	return cmdsFirstErr(cmds)
}

func (c *Ring) processShardPipeline(
	ctx context.Context, hash string, cmds []Cmder, tx bool,
) error {
	// TODO: retry?
	shard, err := c.shards.GetByName(hash)
	if err != nil {
		setCmdsErr(cmds, err)
		return err
	}

	if tx {
		return shard.Client.processTxPipeline(ctx, cmds)
	}
	return shard.Client.processPipeline(ctx, cmds)
}

func (c *Ring) Watch(ctx context.Context, fn func(*Tx) error, keys ...string) error {
	if len(keys) == 0 {
		return fmt.Errorf("redis: Watch requires at least one key")
	}

	var shards []*ringShard
	for _, key := range keys {
		if key != "" {
			shard, err := c.shards.GetByKey(hashtag.Key(key))
			if err != nil {
				return err
			}

			shards = append(shards, shard)
		}
	}

	if len(shards) == 0 {
		return fmt.Errorf("redis: Watch requires at least one shard")
	}

	if len(shards) > 1 {
		for _, shard := range shards[1:] {
			if shard.Client != shards[0].Client {
				err := fmt.Errorf("redis: Watch requires all keys to be in the same shard")
				return err
			}
		}
	}

	return shards[0].Client.Watch(ctx, fn, keys...)
}

// Close closes the ring client, releasing any open resources.
//
// It is rare to Close a Ring, as the Ring is meant to be long-lived
// and shared between many goroutines.
func (c *Ring) Close() error {
	return c.shards.Close()
}
