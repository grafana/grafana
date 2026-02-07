// Package rueidis is a fast Golang Redis RESP3 client that does auto pipelining and supports client side caching.
package rueidis

//go:generate go run hack/cmds/gen.go internal/cmds hack/cmds/*.json

import (
	"context"
	"crypto/tls"
	"errors"
	"math"
	"net"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/redis/rueidis/internal/util"
)

const (
	queueTypeEnvVar = "RUEIDIS_QUEUE_TYPE"
)

// queue types.
// queue type defines the type of queue implementation to use for command pipelining
// If you want to use the ring buffer, you can set the "RUEIDIS_QUEUE_TYPE" environment variable to "ring" or empty string.
// If you want to use the flow buffer, you can set the "RUEIDIS_QUEUE_TYPE" environment variable to "flowbuffer".
const (
	// QueueTypeRing uses the default ring buffer with mutex/condition variables
	// This provides the best raw performance with atomic operations and condition variables
	// but does not support context cancellation when the buffer is full
	queueTypeRing = "ring"
	// QueueTypeFlowBuffer uses a channel-based lock-free implementation
	// This provides context cancellation support even when the buffer is full
	// but is slower than QueueTypeRing and requires more memory
	queueTypeFlowBuffer = "flowbuffer"
)

var queueTypeFromEnv string

func init() {
	queueTypeFromEnv = os.Getenv(queueTypeEnvVar)
}

const (
	// DefaultCacheBytes is the default value of ClientOption.CacheSizeEachConn, which is 128 MiB
	DefaultCacheBytes = 128 * (1 << 20)
	// DefaultRingScale is the default value of ClientOption.RingScaleEachConn, which results into having a ring of size 2^10 for each connection
	DefaultRingScale = 10
	// DefaultPoolSize is the default value of ClientOption.BlockingPoolSize
	DefaultPoolSize = 1024
	// DefaultBlockingPipeline is the default value of ClientOption.BlockingPipeline
	DefaultBlockingPipeline = 2000
	// DefaultDialTimeout is the default value of ClientOption.Dialer.Timeout
	DefaultDialTimeout = 5 * time.Second
	// DefaultTCPKeepAlive is the default value of ClientOption.Dialer.KeepAlive
	DefaultTCPKeepAlive = 1 * time.Second
	// DefaultReadBuffer is the default value of bufio.NewReaderSize for each connection, which is 0.5MiB
	DefaultReadBuffer = 1 << 19
	// DefaultWriteBuffer is the default value of bufio.NewWriterSize for each connection, which is 0.5MiB
	DefaultWriteBuffer = 1 << 19
	// MaxPipelineMultiplex is the maximum meaningful value for ClientOption.PipelineMultiplex
	MaxPipelineMultiplex = 8
	// https://github.com/valkey-io/valkey/blob/1a34a4ff7f101bb6b17a0b5e9aa3bf7d6bd29f68/src/networking.c#L4118-L4124
	ClientModeCluster    ClientMode = "cluster"
	ClientModeSentinel   ClientMode = "sentinel"
	ClientModeStandalone ClientMode = "standalone"
)

var (
	// ErrClosing means the Client.Close had been called
	ErrClosing = errors.New("rueidis client is closing or unable to connect redis")
	// ErrNoAddr means the ClientOption.InitAddress is empty
	ErrNoAddr = errors.New("no alive address in InitAddress")
	// ErrNoCache means your redis does not support client-side caching and must set ClientOption.DisableCache to true
	ErrNoCache = errors.New("ClientOption.DisableCache must be true for redis not supporting client-side caching or not supporting RESP3")
	// ErrRESP2PubSubMixed means your redis does not support RESP3 and rueidis can't handle SUBSCRIBE/PSUBSCRIBE/SSUBSCRIBE in mixed case
	ErrRESP2PubSubMixed = errors.New("rueidis does not support SUBSCRIBE/PSUBSCRIBE/SSUBSCRIBE mixed with other commands in RESP2")
	// ErrBlockingPubSubMixed rueidis can't handle SUBSCRIBE/PSUBSCRIBE/SSUBSCRIBE mixed with other blocking commands
	ErrBlockingPubSubMixed = errors.New("rueidis does not support SUBSCRIBE/PSUBSCRIBE/SSUBSCRIBE mixed with other blocking commands")
	// ErrDoCacheAborted means redis abort EXEC request or connection closed
	ErrDoCacheAborted = errors.New("failed to fetch the cache because EXEC was aborted by redis or connection closed")
	// ErrReplicaOnlyNotSupported means ReplicaOnly flag is not supported by
	// the current client
	ErrReplicaOnlyNotSupported = errors.New("ReplicaOnly is not supported for single client")
	// ErrNoSendToReplicas means the SendToReplicas function must be provided for a standalone client with replicas.
	ErrNoSendToReplicas = errors.New("no SendToReplicas provided for standalone client with replicas")
	// ErrWrongPipelineMultiplex means wrong value for ClientOption.PipelineMultiplex
	ErrWrongPipelineMultiplex = errors.New("ClientOption.PipelineMultiplex must not be bigger than MaxPipelineMultiplex")
	// ErrDedicatedClientRecycled means the caller attempted to use the dedicated client which has been already recycled (after canceled/closed).
	ErrDedicatedClientRecycled = errors.New("dedicated client should not be used after recycled")
	// DisableClientSetInfo is the value that can be used for ClientOption.ClientSetInfo to disable making the CLIENT SETINFO command
	DisableClientSetInfo = make([]string, 0)
)

// ClientOption should be passed to NewClient to construct a Client
type ClientOption struct {
	TLSConfig *tls.Config

	// DialFn allows for a custom function to be used to create net.Conn connections
	// Deprecated: use DialCtxFn instead.
	DialFn func(string, *net.Dialer, *tls.Config) (conn net.Conn, err error)

	// DialCtxFn allows for a custom function to be used to create net.Conn connections
	DialCtxFn func(context.Context, string, *net.Dialer, *tls.Config) (conn net.Conn, err error)

	// NewCacheStoreFn allows a custom client side caching store for each connection
	NewCacheStoreFn NewCacheStoreFn

	// OnInvalidations is a callback function in case of client-side caching invalidation received.
	// Note that this function must be fast; otherwise other redis messages will be blocked.
	OnInvalidations func([]RedisMessage)

	// SendToReplicas is a function that returns true if the command should be sent to replicas.
	// NOTE: This function can't be used with the ReplicaOnly option.
	SendToReplicas func(cmd Completed) bool

	// AuthCredentialsFn allows for setting the AUTH username and password dynamically on each connection attempt to
	// support rotating credentials
	AuthCredentialsFn func(AuthCredentialsContext) (AuthCredentials, error)

	// RetryDelay is the function that returns the delay that should be used before retrying the attempt.
	// The default is an exponential backoff with a maximum delay of 1 second.
	// Only used when DisableRetry is false.
	RetryDelay RetryDelayFn

	// Deprecated: use ReadNodeSelector instead.
	// ReplicaSelector selects a replica node when `SendToReplicas` returns true.
	// If the function is set, the client will send the selected command to the replica node.
	// The Returned value is the index of the replica node in the replica slice.
	// If the returned value is out of range, the primary node will be selected.
	// If the primary node does not have any replica, the primary node will be selected
	// and the function will not be called.
	// Currently only used for a cluster client.
	// Each ReplicaInfo must not be modified.
	// NOTE: This function can't be used with ReplicaOnly option.
	// NOTE: This function must be used with the SendToReplicas function.
	ReplicaSelector func(slot uint16, replicas []NodeInfo) int

	// ReadNodeSelector returns index of node selected for a read only command.
	// If set, ReadNodeSelector is prioritized over ReplicaSelector.
	// If the returned index is out of range, the primary node will be selected.
	// The function is called only when SendToReplicas returns true.
	// Each NodeInfo must not be modified.
	// NOTE: This function can't be used with ReplicaSelector option.
	ReadNodeSelector func(slot uint16, nodes []NodeInfo) int

	// Sentinel options, including MasterSet and Auth options
	Sentinel SentinelOption

	// TCP & TLS
	// Dialer can be used to customize how rueidis connect to a redis instance via TCP, including
	// - Timeout, the default is DefaultDialTimeout
	// - KeepAlive, the default is DefaultTCPKeepAlive
	// The Dialer.KeepAlive interval is used to detect an unresponsive idle tcp connection.
	// OS takes at least (tcp_keepalive_probes+1)*Dialer.KeepAlive time to conclude an idle connection to be unresponsive.
	// For example, DefaultTCPKeepAlive = 1s and the default of tcp_keepalive_probes on Linux is 9.
	// Therefore, it takes at least 10s to kill an idle and unresponsive tcp connection on Linux by default.
	Dialer net.Dialer

	// Redis AUTH parameters
	Username   string
	Password   string
	ClientName string

	// ClientSetInfo will assign various info attributes to the current connection.
	// Note that ClientSetInfo should have exactly 2 values, the lib name and the lib version respectively.
	ClientSetInfo []string

	// InitAddress point to redis nodes.
	// Rueidis will connect to them one by one and issue a CLUSTER SLOT command to initialize the cluster client until success.
	// If len(InitAddress) == 1 and the address is not running in cluster mode, rueidis will fall back to the single client mode.
	// If ClientOption.Sentinel.MasterSet is set, then InitAddress will be used to connect sentinels
	// You can bypass this behavior by using ClientOption.ForceSingleClient.
	InitAddress []string

	// ClientTrackingOptions will be appended to the CLIENT TRACKING ON command when the connection is established.
	// The default is []string{"OPTIN"}
	ClientTrackingOptions []string

	// Standalone is the option for the standalone client.
	Standalone StandaloneOption

	SelectDB int

	// CacheSizeEachConn is redis client side cache size that bind to each TCP connection to a single redis instance.
	// The default is DefaultCacheBytes.
	CacheSizeEachConn int

	// RingScaleEachConn sets the size of the ring buffer in each connection to (2 ^ RingScaleEachConn).
	// The default is RingScaleEachConn, which results in having a ring of size 2^10 for each connection.
	// Reducing this value can reduce the memory consumption of each connection at the cost of potential throughput degradation.
	// Values smaller than 8 are typically not recommended.
	RingScaleEachConn int

	// ReadBufferEachConn is the size of the bufio.NewReaderSize for each connection, default to DefaultReadBuffer (0.5 MiB).
	ReadBufferEachConn int
	// WriteBufferEachConn is the size of the bufio.NewWriterSize for each connection, default to DefaultWriteBuffer (0.5 MiB).
	WriteBufferEachConn int

	// BlockingPoolCleanup is the duration for cleaning up idle connections.
	// If BlockingPoolCleanup is 0, then idle connections will not be cleaned up.
	BlockingPoolCleanup time.Duration
	// BlockingPoolMinSize is the minimum size of the connection pool
	// shared by blocking commands (ex BLPOP, XREAD with BLOCK).
	// Only relevant if BlockingPoolCleanup is not 0. This parameter limits
	// the number of idle connections that can be removed by BlockingPoolCleanup.
	BlockingPoolMinSize int

	// BlockingPoolSize is the size of the connection pool shared by blocking commands (ex BLPOP, XREAD with BLOCK).
	// The default is DefaultPoolSize.
	BlockingPoolSize int
	// BlockingPipeline is the threshold of a pipeline that will be treated as blocking commands when exceeding it.
	BlockingPipeline int

	// PipelineMultiplex determines how many tcp connections used to pipeline commands to one redis instance.
	// The default for single and sentinel clients is 2, which means 4 connections (2^2).
	// The default for cluster clients is 0, which means 1 connection (2^0).
	PipelineMultiplex int

	// ConnWriteTimeout is a read/write timeout for each connection. If specified,
	// it is used to control the maximum duration waits for responses to pipeline commands.
	// Also, ConnWriteTimeout is applied net.Conn.SetDeadline and periodic PINGs,
	// since the Dialer.KeepAlive will not be triggered if there is data in the outgoing buffer.
	// ConnWriteTimeout should be set to detect local congestion or unresponsive redis server.
	// This default is ClientOption.Dialer.KeepAlive * (9+1), where 9 is the default of tcp_keepalive_probes on Linux.
	ConnWriteTimeout time.Duration

	// ConnLifetime is a lifetime for each connection. If specified,
	// connections will close after passing lifetime. Note that the connection which a dedicated client and blocking use is not closed.
	ConnLifetime time.Duration

	// MaxFlushDelay when greater than zero pauses pipeline write loop for some time (not larger than MaxFlushDelay)
	// after each flushing of data to the connection. This gives the pipeline a chance to collect more commands to send
	// to Redis. Adding this delay increases latency, reduces throughput – but in most cases may significantly reduce
	// application and Redis CPU utilization due to less executed system calls. By default, Rueidis flushes data to the
	// connection without extra delays. Depending on network latency and application-specific conditions, the value
	// of MaxFlushDelay may vary, something like 20 microseconds should not affect latency/throughput a lot but still
	// produce notable CPU usage reduction under load. Ref: https://github.com/redis/rueidis/issues/156
	MaxFlushDelay time.Duration

	// ClusterOption is the options for the redis cluster client.
	ClusterOption ClusterOption

	// DisableTCPNoDelay turns on Nagle's algorithm in pipelining mode by using conn.SetNoDelay(false).
	// Turning this on can result in lower p99 latencies and lower CPU usages if all your requests are small.
	// But if you have large requests or fast network, this might degrade the performance. Ref: https://github.com/redis/rueidis/pull/650
	DisableTCPNoDelay bool

	// ShuffleInit is a handy flag that shuffles the InitAddress after passing to the NewClient() if it is true
	ShuffleInit bool
	// ClientNoTouch controls whether commands alter LRU/LFU stats
	ClientNoTouch bool
	// DisableRetry disables retrying read-only commands under network errors
	DisableRetry bool
	// DisableCache falls back Client.DoCache/Client.DoMultiCache to Client.Do/Client.DoMulti
	DisableCache bool
	// DisableAutoPipelining makes rueidis.Client always pick a connection from the BlockingPool to serve each request.
	DisableAutoPipelining bool
	// AlwaysPipelining makes rueidis.Client always pipeline redis commands even if they are not issued concurrently.
	AlwaysPipelining bool
	// AlwaysRESP2 makes rueidis.Client always uses RESP2; otherwise, it will try using RESP3 first.
	AlwaysRESP2 bool
	//  ForceSingleClient force the usage of a single client connection, without letting the lib guessing
	//  if redis instance is a cluster or a single redis instance.
	ForceSingleClient bool

	// ReplicaOnly indicates that this client will only try to connect to readonly replicas of redis setup.
	ReplicaOnly bool

	// ClientNoEvict sets the client eviction mode for the current connection.
	// When turned on and client eviction is configured,
	// the current connection will be excluded from the client eviction process
	// even if we're above the configured client eviction threshold.
	ClientNoEvict bool

	// EnableReplicaAZInfo enables the client to load the replica node's availability zone.
	// If true, the client will set the `AZ` field in `ReplicaInfo`.
	EnableReplicaAZInfo bool
}

// SentinelOption contains MasterSet,
type SentinelOption struct {
	// TCP & TLS, same as ClientOption but for connecting sentinel
	Dialer    net.Dialer
	TLSConfig *tls.Config

	// MasterSet is the redis master set name monitored by sentinel cluster.
	// If this field is set, then ClientOption.InitAddress will be used to connect to the sentinel cluster.
	MasterSet string

	// Redis AUTH parameters for sentinel
	Username   string
	Password   string
	ClientName string
}

// ClusterOption is the options for the redis cluster client.
type ClusterOption struct {
	// ShardsRefreshInterval is the interval to scan the cluster topology.
	// If the value is zero, refreshment will be disabled.
	// Cluster topology cache refresh happens always in the background after a successful scan.
	ShardsRefreshInterval time.Duration
}

// StandaloneOption is the options for the standalone client.
type StandaloneOption struct {
	// ReplicaAddress is the list of replicas for the primary node.
	// Note that these addresses must be online and cannot be promoted.
	// An example use case is the reader endpoint provided by cloud vendors.
	ReplicaAddress []string
	// EnableRedirect enables the CLIENT CAPA redirect feature for Valkey 8+
	// When enabled, the client will send CLIENT CAPA redirect during connection
	// initialization and handle REDIRECT responses from the server.
	EnableRedirect bool
}

// NodeInfo is the information of a replica node in a redis cluster.
type NodeInfo struct {
	conn conn
	Addr string
	AZ   string
}

// ReplicaInfo is the information of a replica node in a redis cluster.
type ReplicaInfo = NodeInfo

type ClientMode string

// Client is the redis client interface for both single redis instance and redis cluster. It should be created from the NewClient()
type Client interface {
	CoreClient

	// DoCache is similar to Do, but it uses opt-in client side caching and requires a client side TTL.
	// The explicit client side TTL specifies the maximum TTL on the client side.
	// If the key's TTL on the server is smaller than the client side TTL, the client side TTL will be capped.
	//  client.Do(ctx, client.B().Get().Key("k").Cache(), time.Minute).ToString()
	// The above example will send the following command to redis if the cache misses:
	//  CLIENT CACHING YES
	//  PTTL k
	//  GET k
	// The in-memory cache size is configured by ClientOption.CacheSizeEachConn.
	// The cmd parameter is recycled after passing into DoCache() and should not be reused.
	DoCache(ctx context.Context, cmd Cacheable, ttl time.Duration) (resp RedisResult)

	// DoMultiCache is similar to DoCache but works with multiple cacheable commands across different slots.
	// It will first group commands by slots and will send only cache missed commands to redis.
	DoMultiCache(ctx context.Context, multi ...CacheableTTL) (resp []RedisResult)

	// DoStream send a command to redis through a dedicated connection acquired from a connection pool.
	// It returns a RedisResultStream, but it does not read the command response until the RedisResultStream.WriteTo is called.
	// After the RedisResultStream.WriteTo is called, the underlying connection is then recycled.
	// DoStream should only be used when you want to stream redis response directly to an io.Writer without additional allocation,
	// otherwise, the normal Do() should be used instead.
	// Also note that DoStream can only work with commands returning string, integer, or float response.
	DoStream(ctx context.Context, cmd Completed) RedisResultStream

	// DoMultiStream is similar to DoStream, but pipelines multiple commands to redis.
	// It returns a MultiRedisResultStream, and users should call MultiRedisResultStream.WriteTo as many times as the number of commands sequentially
	// to read each command response from redis. After all responses are read, the underlying connection is then recycled.
	// DoMultiStream should only be used when you want to stream redis responses directly to an io.Writer without additional allocation,
	// otherwise, the normal DoMulti() should be used instead.
	// DoMultiStream does not support multiple key slots when connecting to a redis cluster.
	DoMultiStream(ctx context.Context, multi ...Completed) MultiRedisResultStream

	// Dedicated acquire a connection from the blocking connection pool, no one else can use the connection
	// during Dedicated. The main usage of Dedicated is CAS operations, which is WATCH + MULTI + EXEC.
	// However, one should try to avoid CAS operation but use a Lua script instead, because occupying a connection
	// is not good for performance.
	Dedicated(fn func(DedicatedClient) error) (err error)

	// Dedicate does the same as Dedicated, but it exposes DedicatedClient directly
	// and requires user to invoke cancel() manually to put connection back to the pool.
	Dedicate() (client DedicatedClient, cancel func())

	// Nodes returns each redis node this client known as rueidis.Client. This is useful if you want to
	// send commands to some specific redis nodes in the cluster.
	Nodes() map[string]Client
	// Mode returns the current mode of the client, which indicates whether the client is operating
	// in standalone, sentinel, or cluster mode.
	// This can be useful for determining the type of Redis deployment the client is connected to
	// and for making decisions based on the deployment type.
	Mode() ClientMode
}

// DedicatedClient is obtained from Client.Dedicated() and it will be bound to a single redis connection, and
// no other commands can be pipelined into this connection during Client.Dedicated().
// If the DedicatedClient is obtained from a cluster client, the first command to it must have a Key() to identify the redis node.
type DedicatedClient interface {
	CoreClient

	// SetPubSubHooks is an alternative way to processing Pub/Sub messages instead of using Receive.
	// SetPubSubHooks is non-blocking and allows users to subscribe/unsubscribe channels later.
	// Note that the hooks will be called sequentially but in another goroutine.
	// The return value will be either:
	//   1. an error channel, if the hooks passed in are not zero, or
	//   2. nil, if the hooks passed in are zero. (used for reset hooks)
	// In the former case, the error channel is guaranteed to be close when the hooks will not be called anymore
	// and has at most one error describing the reason why the hooks will not be called anymore.
	// Users can use the error channel to detect disconnection.
	SetPubSubHooks(hooks PubSubHooks) <-chan error
}

// CoreClient is the minimum interface shared by the Client and the DedicatedClient.
type CoreClient interface {
	// B is the getter function to the command builder for the client
	// If the client is a cluster client, the command builder also prohibits cross-key slots in one command.
	B() Builder
	// Do is the method sending user's redis command building from the B() to a redis node.
	//  client.Do(ctx, client.B().Get().Key("k").Build()).ToString()
	// All concurrent non-blocking commands will be pipelined automatically and have better throughput.
	// Blocking commands will use another separated connection pool.
	// The cmd parameter is recycled after passing into Do() and should not be reused.
	Do(ctx context.Context, cmd Completed) (resp RedisResult)
	// DoMulti takes multiple redis commands and sends them together, reducing RTT from the user code.
	// The multi parameters are recycled after passing into DoMulti() and should not be reused.
	DoMulti(ctx context.Context, multi ...Completed) (resp []RedisResult)
	// Receive accepts SUBSCRIBE, SSUBSCRIBE, PSUBSCRIBE command and a message handler.
	// Receive will block and then return value only when the following cases:
	//   1. return nil when received any unsubscribe/punsubscribe message related to the provided `subscribe` command.
	//   2. return ErrClosing when the client is closed manually.
	//   3. return ctx.Err() when the `ctx` is done.
	//   4. return non-nil err when the provided `subscribe` command failed.
	Receive(ctx context.Context, subscribe Completed, fn func(msg PubSubMessage)) error
	// Close will make further calls to the client be rejected with ErrClosing,
	// and Close will wait until all pending calls finished.
	Close()
}

// CT is a shorthand constructor for CacheableTTL
func CT(cmd Cacheable, ttl time.Duration) CacheableTTL {
	return CacheableTTL{Cmd: cmd, TTL: ttl}
}

// CacheableTTL is a parameter container of DoMultiCache
type CacheableTTL struct {
	Cmd Cacheable
	TTL time.Duration
}

// AuthCredentialsContext is the parameter container of AuthCredentialsFn
type AuthCredentialsContext struct {
	Address net.Addr
}

// AuthCredentials is the output of AuthCredentialsFn
type AuthCredentials struct {
	Username string
	Password string
}

// NewClient uses ClientOption to initialize the Client for both a cluster client and a single client.
// It will first try to connect as a cluster client. If the len(ClientOption.InitAddress) == 1 and
// the address does not enable cluster mode, the NewClient() will use single client instead.
func NewClient(option ClientOption) (client Client, err error) {
	// Validate configuration conflicts early
	if option.Standalone.EnableRedirect && len(option.Standalone.ReplicaAddress) > 0 {
		return nil, errors.New("EnableRedirect and ReplicaAddress cannot be used together")
	}

	if option.ReadBufferEachConn < 32 { // the buffer should be able to hold an int64 string at least
		option.ReadBufferEachConn = DefaultReadBuffer
	}
	if option.WriteBufferEachConn < 32 {
		option.WriteBufferEachConn = DefaultWriteBuffer
	}
	if option.CacheSizeEachConn <= 0 {
		option.CacheSizeEachConn = DefaultCacheBytes
	}
	if option.Dialer.Timeout == 0 {
		option.Dialer.Timeout = DefaultDialTimeout
	}
	if option.Dialer.KeepAlive == 0 {
		option.Dialer.KeepAlive = DefaultTCPKeepAlive
	}
	if option.ConnWriteTimeout == 0 {
		option.ConnWriteTimeout = max(DefaultTCPKeepAlive, option.Dialer.KeepAlive) * 10
	}
	if option.BlockingPipeline == 0 {
		option.BlockingPipeline = DefaultBlockingPipeline
	}
	if option.DisableAutoPipelining {
		option.AlwaysPipelining = false
	}
	if option.ShuffleInit {
		util.Shuffle(len(option.InitAddress), func(i, j int) {
			option.InitAddress[i], option.InitAddress[j] = option.InitAddress[j], option.InitAddress[i]
		})
	}
	if option.PipelineMultiplex > MaxPipelineMultiplex {
		return nil, ErrWrongPipelineMultiplex
	}
	if option.RetryDelay == nil {
		option.RetryDelay = defaultRetryDelayFn
	}
	if option.Sentinel.MasterSet != "" {
		option.PipelineMultiplex = singleClientMultiplex(option.PipelineMultiplex)
		return newSentinelClient(&option, makeConn, newRetryer(option.RetryDelay))
	}

	if option.Standalone.EnableRedirect {
		option.PipelineMultiplex = singleClientMultiplex(option.PipelineMultiplex)
		return newStandaloneClient(&option, makeConn, newRetryer(option.RetryDelay))
	}
	if len(option.Standalone.ReplicaAddress) > 0 {
		if option.SendToReplicas == nil {
			return nil, ErrNoSendToReplicas
		}
		option.PipelineMultiplex = singleClientMultiplex(option.PipelineMultiplex)
		return newStandaloneClient(&option, makeConn, newRetryer(option.RetryDelay))
	}
	if option.ForceSingleClient {
		option.PipelineMultiplex = singleClientMultiplex(option.PipelineMultiplex)
		return newSingleClient(&option, nil, makeConn, newRetryer(option.RetryDelay))
	}
	if client, err = newClusterClient(&option, makeConn, newRetryer(option.RetryDelay)); err != nil {
		if client == (*clusterClient)(nil) {
			return nil, err
		}
		if len(option.InitAddress) == 1 && (err.Error() == redisErrMsgCommandNotAllow || strings.Contains(strings.ToUpper(err.Error()), "CLUSTER")) {
			option.PipelineMultiplex = singleClientMultiplex(option.PipelineMultiplex)
			client, err = newSingleClient(&option, client.(*clusterClient).single(), makeConn, newRetryer(option.RetryDelay))
		} else {
			client.Close()
			return nil, err
		}
	}
	return client, err
}

func singleClientMultiplex(multiplex int) int {
	if multiplex == 0 {
		if multiplex = int(math.Log2(float64(runtime.GOMAXPROCS(0)))); multiplex >= 2 {
			multiplex = 2
		}
	}
	if multiplex < 0 {
		multiplex = 0
	}
	return multiplex
}

func makeConn(dst string, opt *ClientOption) conn {
	return makeMux(dst, opt, dial)
}

func dial(ctx context.Context, dst string, opt *ClientOption) (conn net.Conn, err error) {
	if opt.DialCtxFn != nil {
		return opt.DialCtxFn(ctx, dst, &opt.Dialer, opt.TLSConfig)
	}
	if opt.DialFn != nil {
		return opt.DialFn(dst, &opt.Dialer, opt.TLSConfig)
	}
	if opt.TLSConfig != nil {
		dialer := tls.Dialer{NetDialer: &opt.Dialer, Config: opt.TLSConfig}
		conn, err = dialer.DialContext(ctx, "tcp", dst)
	} else {
		conn, err = opt.Dialer.DialContext(ctx, "tcp", dst)
	}
	return conn, err
}

const redisErrMsgCommandNotAllow = "command is not allowed"

var (
	// errConnExpired means the wrong connection that ClientOption.ConnLifetime had passed since connecting
	errConnExpired = errors.New("connection is expired")
)
