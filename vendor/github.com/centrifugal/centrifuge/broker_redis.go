package centrifuge

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	_ "embed"

	"github.com/centrifugal/centrifuge/internal/convert"

	"github.com/centrifugal/protocol"
	"github.com/redis/rueidis"
)

var (
	errPubSubConnUnavailable = errors.New("redis: pub/sub connection temporary unavailable")
)

const (
	// redisSubscribeBatchLimit is a maximum number of channels to include in a single
	// batch subscribe call.
	redisSubscribeBatchLimit = 512
	// redisControlChannelSuffix is a suffix for control channel.
	redisControlChannelSuffix = ".control"
	// redisNodeChannelPrefix is a suffix for node channel.
	redisNodeChannelPrefix = ".node."
	// redisClientChannelPrefix is a prefix before channel name for client messages.
	redisClientChannelPrefix = ".client."
	// redisPubSubShardChannelSuffix is a suffix in channel name which we use to establish a sharded PUB/SUB connection.
	redisPubSubShardChannelSuffix = ".shard"
)

var _ Broker = (*RedisBroker)(nil)

type pubSubStart struct {
	once  sync.Once
	errCh chan error
}

type controlPubSubStart struct {
	once  sync.Once
	errCh chan error
}

type shardWrapper struct {
	shard               *RedisShard
	subClientsMu        sync.Mutex
	subClients          [][]rueidis.DedicatedClient
	pubSubStartChannels [][]*pubSubStart
	controlPubSubStart  *controlPubSubStart
	logFields           map[string]any
}

// RedisBroker uses Redis to implement Broker functionality. This broker allows
// scaling Centrifuge-based server to many instances and load balance client
// connections between them. Centrifuge nodes will be connected over Redis PUB/SUB.
// RedisBroker supports standalone Redis, Redis in master-replica setup with Sentinel,
// Redis Cluster. Also, it supports client-side consistent sharding between isolated
// Redis setups.
// By default, Redis >= 5 required (due to the fact RedisBroker uses STREAM data
// structure to keep publication history for a channel).
type RedisBroker struct {
	controlRound            uint64
	node                    *Node
	sharding                bool
	config                  RedisBrokerConfig
	shards                  []*shardWrapper
	publishIdempotentScript *rueidis.Lua
	historyListScript       *rueidis.Lua
	historyStreamScript     *rueidis.Lua
	addHistoryListScript    *rueidis.Lua
	addHistoryStreamScript  *rueidis.Lua
	shardChannel            string
	messagePrefix           string
	controlChannel          string
	nodeChannel             string
	closeOnce               sync.Once
	closeCh                 chan struct{}
}

// RedisBrokerConfig is a config for Broker.
type RedisBrokerConfig struct {
	// Prefix to use before every channel name and key in Redis. By default,
	// RedisBroker will use prefix "centrifuge".
	Prefix string

	// Shards is a slice of RedisShard to use. At least one shard must be provided.
	// Data will be consistently sharded by channel over provided Redis shards.
	Shards []*RedisShard

	// UseLists allows enabling usage of Redis LIST instead of STREAM data
	// structure to keep history. LIST support exist mostly for backward
	// compatibility since STREAM seems superior. If you have a use case
	// where you need to turn on this option in new setup - please share,
	// otherwise LIST support can be removed at some point in the future.
	// Iteration over history in reversed order not supported with lists.
	UseLists bool

	// Subscribe on replica Redis nodes. This only works for Redis Cluster
	// and Sentinel setups and requires replica client to be initialized in
	// each RedisShard using RedisShardConfig.ReplicaClientEnabled.
	SubscribeOnReplica bool

	// SkipPubSub enables mode when Redis broker only saves history, without
	// publishing to channels and using PUB/SUB.
	SkipPubSub bool

	// Name of broker, for observability purposes – i.e. becomes part of metrics/logs.
	// By default, empty string is used.
	Name string

	// NumShardedPubSubPartitions when greater than zero allows turning on a mode in which
	// broker will use Redis Cluster with sharded PUB/SUB feature available in
	// Redis >= 7: https://redis.io/docs/manual/pubsub/#sharded-pubsub
	//
	// To achieve sharded PUB/SUB efficiency RedisBroker reduces 16384 Redis Cluster
	// slots to the NumShardedPubSubPartitions value and starts a separate PUB/SUB for each
	// partition. This is necessary because in Centrifuge case one node can work with
	// thousands of different channels – and we can't afford running a separate
	// PUB/SUB connection for each of 16384 possible slots. We re-use partition
	// connection for many channels and make sure that all channels in the partition
	// point to the same Redis Cluster slot.
	//
	// By default, sharded PUB/SUB is not used in Redis Cluster case - Centrifuge uses
	// globally distributed PUBLISH commands in Redis Cluster where each publish is
	// distributed to all nodes in Redis Cluster.
	//
	// Note (!), that turning on NumShardedPubSubPartitions will cause Centrifuge to generate
	// different key names for history and different Redis channel names than in the base
	// Redis Cluster mode due to reasons outlined above.
	NumShardedPubSubPartitions int

	// numSubscribeShards defines how many subscribe shards will be used by Centrifuge.
	// Each subscribe shard uses a dedicated connection to Redis for making subscriptions.
	// Zero value means 1.
	numSubscribeShards int

	// numResubscribeShards defines how many subscriber goroutines will be used by
	// Centrifuge for resubscribing process for each subscribe shard. Zero value tells
	// Centrifuge to use 16 subscriber goroutines per subscribe shard.
	numResubscribeShards int

	// numPubSubProcessors allows configuring number of workers which will process
	// messages coming from Redis PUB/SUB. Zero value tells Centrifuge to use the
	// number calculated as:
	// runtime.NumCPU / numSubscribeShards / NumShardedPubSubPartitions (if used) (minimum 1).
	numPubSubProcessors int
}

// NewRedisBroker initializes Redis Broker.
func NewRedisBroker(n *Node, config RedisBrokerConfig) (*RedisBroker, error) {
	if len(config.Shards) == 0 {
		return nil, errors.New("broker: no Redis shards provided in configuration")
	}

	if config.SubscribeOnReplica {
		for i, s := range config.Shards {
			if s.replicaClient == nil {
				return nil, fmt.Errorf("broker: SubscribeOnReplica enabled but no replica client initialized in shard[%d] (ReplicaClientEnabled option)", i)
			}
		}
	}

	if len(config.Shards) > 1 {
		n.logger.log(newLogEntry(LogLevelInfo, fmt.Sprintf("broker: Redis sharding enabled: %d shards", len(config.Shards)), map[string]any{"broker_name": config.Name}))
	}

	if config.Prefix == "" {
		config.Prefix = "centrifuge"
	}

	if config.numSubscribeShards == 0 {
		config.numSubscribeShards = 1
	}

	if config.numResubscribeShards == 0 {
		config.numResubscribeShards = 16
	}

	if config.numPubSubProcessors == 0 {
		config.numPubSubProcessors = runtime.NumCPU() / config.numSubscribeShards
		if config.NumShardedPubSubPartitions > 0 {
			config.numPubSubProcessors /= config.NumShardedPubSubPartitions
		}
		if config.numPubSubProcessors < 1 {
			config.numPubSubProcessors = 1
		}
	}

	shardWrappers := make([]*shardWrapper, 0, len(config.Shards))
	for _, s := range config.Shards {
		logFields := map[string]any{
			"shard": s.string(),
		}
		if config.Name != "" {
			logFields["broker_name"] = config.Name
		}
		shardWrappers = append(shardWrappers, &shardWrapper{shard: s, logFields: logFields})
	}

	b := &RedisBroker{
		node:                    n,
		config:                  config,
		shards:                  shardWrappers,
		sharding:                len(config.Shards) > 1,
		publishIdempotentScript: rueidis.NewLuaScript(publishIdempotentSource),
		historyStreamScript:     rueidis.NewLuaScript(historyStreamSource),
		historyListScript:       rueidis.NewLuaScript(historyListSource),
		addHistoryStreamScript:  rueidis.NewLuaScript(addHistoryStreamSource),
		addHistoryListScript:    rueidis.NewLuaScript(addHistoryListSource),
		closeCh:                 make(chan struct{}),
	}
	b.shardChannel = config.Prefix + redisPubSubShardChannelSuffix
	b.messagePrefix = config.Prefix + redisClientChannelPrefix
	b.nodeChannel = string(b.nodeChannelID(n.ID()))
	b.controlChannel = config.Prefix + redisControlChannelSuffix

	for _, shardWrapper := range b.shards {
		shard := shardWrapper.shard
		if !shard.isCluster && b.config.NumShardedPubSubPartitions > 0 {
			return nil, errors.New("can use sharded PUB/SUB feature (non-zero number of pub/sub partitions) only with Redis Cluster")
		}
		subChannels := make([][]rueidis.DedicatedClient, 0)
		pubSubStartChannels := make([][]*pubSubStart, 0)

		if b.useShardedPubSub(shard) {
			for i := 0; i < b.config.NumShardedPubSubPartitions; i++ {
				subChannels = append(subChannels, make([]rueidis.DedicatedClient, 0))
				pubSubStartChannels = append(pubSubStartChannels, make([]*pubSubStart, 0))
			}
		} else {
			subChannels = append(subChannels, make([]rueidis.DedicatedClient, 0))
			pubSubStartChannels = append(pubSubStartChannels, make([]*pubSubStart, 0))
		}

		for i := 0; i < len(subChannels); i++ {
			for j := 0; j < b.config.numSubscribeShards; j++ {
				subChannels[i] = append(subChannels[i], nil)
				pubSubStartChannels[i] = append(pubSubStartChannels[i], &pubSubStart{errCh: make(chan error, 1)})
			}
		}

		shardWrapper.subClients = subChannels
		shardWrapper.pubSubStartChannels = pubSubStartChannels
		shardWrapper.controlPubSubStart = &controlPubSubStart{errCh: make(chan error, 1)}
	}

	return b, nil
}

var (
	//go:embed internal/redis_lua/broker_publish_idempotent.lua
	publishIdempotentSource string

	//go:embed internal/redis_lua/broker_history_add_list.lua
	addHistoryListSource string

	//go:embed internal/redis_lua/broker_history_add_stream.lua
	addHistoryStreamSource string

	//go:embed internal/redis_lua/broker_history_list.lua
	historyListSource string

	//go:embed internal/redis_lua/broker_history_stream.lua
	historyStreamSource string
)

func (b *RedisBroker) getShard(channel string) *shardWrapper {
	if !b.sharding {
		return b.shards[0]
	}
	return b.shards[consistentIndex(channel, len(b.shards))]
}

// Run – see Broker.Run.
func (b *RedisBroker) Run(h BrokerEventHandler) error {
	// Run all shards.
	for _, wrapper := range b.shards {
		err := b.runShard(wrapper, h)
		if err != nil {
			return err
		}
		if err := b.checkCapabilities(wrapper.shard); err != nil {
			return fmt.Errorf("capability error on shard [%s]: %v", wrapper.shard.string(), err)
		}
	}
	for i := 0; i < len(b.shards); i++ {
		<-b.shards[i].controlPubSubStart.errCh
		for j := 0; j < len(b.shards[i].pubSubStartChannels); j++ {
			for k := 0; k < len(b.shards[i].pubSubStartChannels[j]); k++ {
				<-b.shards[i].pubSubStartChannels[j][k].errCh
			}
		}
	}
	return nil
}

func (b *RedisBroker) checkCapabilities(shard *RedisShard) error {
	if !b.config.UseLists {
		// Check whether Redis Streams supported.
		if result := shard.client.Do(context.Background(), shard.client.B().Xrange().Key(b.config.Prefix+".__.check.stream").Start("0-0").End("0-0").Build()); result.Error() != nil {
			if strings.Contains(result.Error().Error(), "unknown command") {
				return errors.New("STREAM only available since Redis >= 5, consider upgrading Redis or using LIST structure for history")
			}
			return result.Error()
		}
	}
	if b.useShardedPubSub(shard) {
		// Check whether Redis Cluster sharded PUB/SUB supported.
		if result := shard.client.Do(context.Background(), shard.client.B().Spublish().Channel(b.config.Prefix+".__check.spublish").Message("").Build()); result.Error() != nil {
			if strings.Contains(result.Error().Error(), "unknown command") {
				return errors.New("this Redis version does not support cluster sharded PUB/SUB feature")
			}
			return result.Error()
		}
	}
	return nil
}

// runForever keeps another function running indefinitely.
// The reason this loop is not inside the function itself is
// so that defer can be used to clean-up nicely.
func (b *RedisBroker) runForever(fn func()) {
	for {
		select {
		case <-b.closeCh:
			return
		default:
		}
		fn()
		select {
		case <-b.closeCh:
			return
		case <-time.After(250 * time.Millisecond):
			// Wait for a while to prevent busy loop when reconnecting to Redis.
		}
	}
}

func (b *RedisBroker) runShard(s *shardWrapper, h BrokerEventHandler) error {
	if b.config.SkipPubSub {
		return nil
	}
	go b.runForever(func() {
		select {
		case <-b.closeCh:
			return
		default:
		}
		b.runControlPubSub(s.shard, s.logFields, h, func(err error) {
			s.controlPubSubStart.once.Do(func() {
				s.controlPubSubStart.errCh <- err
			})
		})
	})

	for i := 0; i < len(s.subClients); i++ { // Cluster shards.
		clusterShardIndex := i
		for j := 0; j < len(s.subClients[i]); j++ { // PUB/SUB shards.
			pubSubShardIndex := j
			go b.runForever(func() {
				select {
				case <-b.closeCh:
					return
				default:
				}
				logFields := make(map[string]any, len(s.logFields)+2)
				for k, v := range s.logFields {
					logFields[k] = v
				}
				logFields["pub_sub_shard"] = pubSubShardIndex
				b.runPubSub(s, logFields, h, clusterShardIndex, pubSubShardIndex, b.useShardedPubSub(s.shard), func(err error) {
					s.pubSubStartChannels[clusterShardIndex][pubSubShardIndex].once.Do(func() {
						s.pubSubStartChannels[clusterShardIndex][pubSubShardIndex].errCh <- err
					})
				})
			})
		}
	}
	return nil
}

func (b *RedisBroker) Close(_ context.Context) error {
	b.closeOnce.Do(func() {
		close(b.closeCh)
	})
	return nil
}

func getPubSubStartLogFields(s *RedisShard, logFields map[string]any) map[string]any {
	startLogFields := make(map[string]any, len(logFields))
	for k, v := range logFields {
		startLogFields[k] = v
	}
	if s.isCluster {
		startLogFields["cluster"] = true
	}
	return startLogFields
}

func (b *RedisBroker) runControlPubSub(s *RedisShard, logFields map[string]any, eventHandler BrokerEventHandler, startOnce func(error)) {
	b.node.logger.log(newLogEntry(LogLevelDebug, "running Redis control PUB/SUB", getPubSubStartLogFields(s, logFields)))
	defer func() {
		b.node.logger.log(newLogEntry(LogLevelDebug, "stopping Redis control PUB/SUB", logFields))
	}()

	controlChannel := b.controlChannel
	nodeChannel := b.nodeChannel

	done := make(chan struct{})
	var doneOnce sync.Once
	closeDoneOnce := func() {
		doneOnce.Do(func() {
			close(done)
		})
	}
	defer closeDoneOnce()

	client := s.client
	if b.config.SubscribeOnReplica {
		client = s.replicaClient
	}

	conn, cancel := client.Dedicate()
	defer cancel()
	defer conn.Close()

	numProcessors := runtime.NumCPU()

	// Run workers to spread message processing work over worker goroutines.
	workCh := make(chan rueidis.PubSubMessage, controlPubSubProcessorBufferSize)
	for i := 0; i < numProcessors; i++ {
		go func() {
			for {
				select {
				case <-done:
					return
				case msg := <-workCh:
					err := eventHandler.HandleControl(convert.StringToBytes(msg.Message))
					if err != nil {
						b.node.metrics.incRedisBrokerPubSubErrors(b.config.Name, "handle_control_message")
						b.node.logger.log(newErrorLogEntry(err, "error handling control message", logFields))
					}
				}
			}
		}()
	}

	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				b.node.metrics.redisBrokerPubSubBufferedMessages.WithLabelValues(b.config.Name, "control", "0").Set(float64(len(workCh)))
			}
		}
	}()

	wait := conn.SetPubSubHooks(rueidis.PubSubHooks{
		OnMessage: func(msg rueidis.PubSubMessage) {
			select {
			case workCh <- msg:
			case <-done:
			default:
				// Buffer is full, drop the message. It's expected that PUB/SUB layer
				// only provides at most once delivery guarantee.
				// Blocking here will block Redis connection read loop which is not a
				// good thing and can lead to slower command processing and potentially
				// to deadlocks (see https://github.com/redis/rueidis/issues/596).
				b.node.metrics.redisBrokerPubSubDroppedMessages.WithLabelValues(b.config.Name, "control").Inc()
			}
		},
	})

	err := conn.Do(context.Background(), conn.B().Subscribe().Channel(controlChannel, nodeChannel).Build()).Error()
	if err != nil {
		startOnce(err)
		b.node.metrics.incRedisBrokerPubSubErrors(b.config.Name, "subscribe_control_channel")
		b.node.logger.log(newErrorLogEntry(err, "control pub/sub subscribe error", logFields))
		return
	}

	startOnce(nil)

	select {
	case err := <-wait:
		if err != nil {
			b.node.metrics.incRedisBrokerPubSubErrors(b.config.Name, "control_connection")
			b.node.logger.log(newErrorLogEntry(err, "control pub/sub connection error", logFields))
		}
	case <-done:
	case <-s.closeCh:
	}
}

const (
	pubSubProcessorBufferSize        = 4096
	controlPubSubProcessorBufferSize = 4096
)

func (b *RedisBroker) runPubSub(s *shardWrapper, logFields map[string]any, eventHandler BrokerEventHandler, clusterShardIndex, psShardIndex int, useShardedPubSub bool, startOnce func(error)) {
	numProcessors := b.config.numPubSubProcessors
	numResubscribeShards := b.config.numResubscribeShards

	shardChannel := string(b.pubSubShardChannelID(clusterShardIndex, psShardIndex, useShardedPubSub))

	if b.node.logEnabled(LogLevelDebug) {
		debugLogValues := map[string]any{
			"num_processors": numProcessors,
		}
		if useShardedPubSub {
			debugLogValues["cluster_shard_index"] = clusterShardIndex
		}
		b.node.logger.log(newLogEntry(LogLevelDebug, "running Redis PUB/SUB", getPubSubStartLogFields(s.shard, logFields), debugLogValues))
		defer func() {
			b.node.logger.log(newLogEntry(LogLevelDebug, "stopping Redis PUB/SUB", logFields, debugLogValues))
		}()
	}

	done := make(chan struct{})
	var doneOnce sync.Once
	closeDoneOnce := func() {
		doneOnce.Do(func() {
			close(done)
		})
	}
	defer closeDoneOnce()

	// Run PUB/SUB message processors to spread received message processing work over worker goroutines.
	processors := make(map[int]chan rueidis.PubSubMessage)
	for i := 0; i < numProcessors; i++ {
		processingCh := make(chan rueidis.PubSubMessage, pubSubProcessorBufferSize)
		processors[i] = processingCh
		go func(ch chan rueidis.PubSubMessage) {
			for {
				select {
				case <-done:
					return
				case msg := <-ch:
					err := b.handleRedisClientMessage(eventHandler, channelID(msg.Channel), convert.StringToBytes(msg.Message))
					if err != nil {
						b.node.metrics.incRedisBrokerPubSubErrors(b.config.Name, "handle_client_message")
						b.node.logger.log(newErrorLogEntry(err, "error handling client message", logFields))
						continue
					}
				}
			}
		}(processingCh)
	}

	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				for i := 0; i < numProcessors; i++ {
					b.node.metrics.redisBrokerPubSubBufferedMessages.WithLabelValues(b.config.Name, "client", strconv.Itoa(i)).Set(float64(len(processors[i])))
				}
			}
		}
	}()

	client := s.shard.client
	if b.config.SubscribeOnReplica {
		client = s.shard.replicaClient
	}

	conn, cancel := client.Dedicate()
	defer cancel()
	defer conn.Close()

	wait := conn.SetPubSubHooks(rueidis.PubSubHooks{
		OnMessage: func(msg rueidis.PubSubMessage) {
			select {
			case processors[index(msg.Channel, numProcessors)] <- msg:
			case <-done:
			default:
				// Buffer is full, drop the message. It's expected that PUB/SUB layer
				// only provides at most once delivery guarantee.
				// Centrifuge has offset check mechanism to handle possible message loss
				// for channels where positioning is enabled.
				// Blocking here will block Redis connection read loop which is not a
				// good thing and can lead to slower command processing and potentially
				// to deadlocks (see https://github.com/redis/rueidis/issues/596).
				b.node.metrics.redisBrokerPubSubDroppedMessages.WithLabelValues(b.config.Name, "client").Inc()
			}
		},
		OnSubscription: func(ps rueidis.PubSubSubscription) {
			if !useShardedPubSub {
				return
			}
			if ps.Kind == "sunsubscribe" && ps.Channel == shardChannel {
				// Helps to handle slot migration.
				b.node.logger.log(newLogEntry(LogLevelInfo, "pub/sub restart due to slot migration", logFields))
				closeDoneOnce()
			}
		},
	})

	var err error
	if useShardedPubSub {
		err = conn.Do(context.Background(), conn.B().Ssubscribe().Channel(shardChannel).Build()).Error()
	} else {
		err = conn.Do(context.Background(), conn.B().Subscribe().Channel(shardChannel).Build()).Error()
	}
	if err != nil {
		startOnce(err)
		b.node.metrics.incRedisBrokerPubSubErrors(b.config.Name, "subscribe_shard_channel")
		b.node.logger.log(newErrorLogEntry(err, "pub/sub subscribe error", logFields))
		return
	}

	channels := b.node.Hub().Channels()

	var wg sync.WaitGroup
	started := time.Now()

	for i := 0; i < numResubscribeShards; i++ {
		wg.Add(1)
		go func(subscriberIndex int) {
			defer wg.Done()
			estimatedCap := len(channels) / b.config.numResubscribeShards / b.config.numSubscribeShards
			if useShardedPubSub {
				estimatedCap /= b.config.NumShardedPubSubPartitions
			}
			chIDs := make([]channelID, 0, estimatedCap)

			for _, ch := range channels {
				if b.getShard(ch).shard == s.shard && ((useShardedPubSub && consistentIndex(ch, b.config.NumShardedPubSubPartitions) == clusterShardIndex && index(ch, b.config.numSubscribeShards) == psShardIndex && index(ch, b.config.numResubscribeShards) == subscriberIndex) || (index(ch, b.config.numSubscribeShards) == psShardIndex && index(ch, b.config.numResubscribeShards) == subscriberIndex)) {
					chIDs = append(chIDs, b.messageChannelID(s.shard, ch))
				}
			}

			subscribeBatch := func(batch []string) error {
				if useShardedPubSub {
					return conn.Do(context.Background(), conn.B().Ssubscribe().Channel(batch...).Build()).Error()
				}
				return conn.Do(context.Background(), conn.B().Subscribe().Channel(batch...).Build()).Error()
			}

			batch := make([]string, 0, redisSubscribeBatchLimit)

			for i, ch := range chIDs {
				if len(batch) > 0 && i%redisSubscribeBatchLimit == 0 {
					err := subscribeBatch(batch)
					if err != nil {
						b.node.logger.log(newErrorLogEntry(err, "error subscribing", logFields))
						closeDoneOnce()
						return
					}
					batch = batch[:0]
				}
				batch = append(batch, string(ch))
			}
			if len(batch) > 0 {
				err := subscribeBatch(batch)
				if err != nil {
					b.node.metrics.incRedisBrokerPubSubErrors(b.config.Name, "subscribe_channel")
					b.node.logger.log(newErrorLogEntry(err, "error subscribing", logFields))
					closeDoneOnce()
					return
				}
			}
		}(i)
	}

	go func() {
		wg.Wait()
		if len(channels) > 0 && b.node.logEnabled(LogLevelDebug) {
			b.node.logger.log(newLogEntry(LogLevelDebug, "resubscribed to channels", logFields, map[string]any{"elapsed": time.Since(started).String(), "num_channels": len(channels)}))
		}
		select {
		case <-done:
			startOnce(errors.New("error resubscribing"))
		default:
			s.subClientsMu.Lock()
			s.subClients[clusterShardIndex][psShardIndex] = conn
			s.subClientsMu.Unlock()
			defer func() {
				s.subClientsMu.Lock()
				s.subClients[clusterShardIndex][psShardIndex] = nil
				s.subClientsMu.Unlock()
			}()
			startOnce(nil)
		}
		<-done
	}()

	select {
	case err = <-wait:
		startOnce(err)
		if err != nil {
			b.node.metrics.incRedisBrokerPubSubErrors(b.config.Name, "connection")
			b.node.logger.log(newErrorLogEntry(err, "pub/sub connection error", logFields))
		}
	case <-done:
	case <-s.shard.closeCh:
	}
}

func (b *RedisBroker) useShardedPubSub(s *RedisShard) bool {
	return s.isCluster && b.config.NumShardedPubSubPartitions > 0
}

// Publish - see Broker.Publish.
func (b *RedisBroker) Publish(ch string, data []byte, opts PublishOptions) (StreamPosition, bool, error) {
	return b.publish(b.getShard(ch), ch, data, opts)
}

func (b *RedisBroker) publish(s *shardWrapper, ch string, data []byte, opts PublishOptions) (StreamPosition, bool, error) {
	protoPub := &protocol.Publication{
		Data: data,
		Info: infoToProto(opts.ClientInfo),
		Tags: opts.Tags,
		Time: time.Now().UnixMilli(),
	}
	if opts.HistorySize <= 0 || opts.HistoryTTL <= 0 {
		// In no history case we communicate delta flag over Publication field. This field is then
		// cleaned up before passing to the Node layer when handling Redis message.
		protoPub.Delta = opts.UseDelta
	}

	byteMessage, err := protoPub.MarshalVT()
	if err != nil {
		return StreamPosition{}, false, err
	}

	publishChannel := b.messageChannelID(s.shard, ch)
	useShardedPublish := b.useShardedPubSub(s.shard)
	var publishCommand = "publish"
	if useShardedPublish {
		publishCommand = "spublish"
	}

	idempotencyKey := opts.IdempotencyKey
	resultKey := b.resultCacheKey(s.shard, ch, idempotencyKey)
	var resultExpire string
	if idempotencyKey != "" {
		if opts.IdempotentResultTTL != 0 {
			resultExpire = strconv.Itoa(int(opts.IdempotentResultTTL.Seconds()))
		} else {
			resultExpire = strconv.Itoa(defaultIdempotentResultExpireSeconds)
		}
	}

	publishChannelStr := string(publishChannel)
	if b.config.SkipPubSub {
		publishChannelStr = ""
	}

	if opts.HistorySize <= 0 || opts.HistoryTTL <= 0 {
		var resp rueidis.RedisResult
		if useShardedPublish {
			if resultExpire == "" {
				if publishChannelStr == "" {
					return StreamPosition{}, false, nil
				}
				cmd := s.shard.client.B().Spublish().Channel(string(publishChannel)).Message(convert.BytesToString(byteMessage)).Build()
				resp = s.shard.client.Do(context.Background(), cmd)
			} else {
				resp = b.publishIdempotentScript.Exec(
					context.Background(),
					s.shard.client,
					[]string{string(resultKey)},
					[]string{
						convert.BytesToString(byteMessage),
						publishChannelStr,
						publishCommand,
						resultExpire,
					},
				)
			}
		} else {
			if resultExpire == "" {
				if publishChannelStr == "" {
					return StreamPosition{}, false, nil
				}
				cmd := s.shard.client.B().Publish().Channel(string(publishChannel)).Message(convert.BytesToString(byteMessage)).Build()
				resp = s.shard.client.Do(context.Background(), cmd)
			} else {
				resp = b.publishIdempotentScript.Exec(
					context.Background(),
					s.shard.client,
					[]string{string(resultKey)},
					[]string{
						convert.BytesToString(byteMessage),
						publishChannelStr,
						publishCommand,
						resultExpire,
					},
				)
			}
		}
		return StreamPosition{}, false, resp.Error()
	}

	historyMetaKey := b.historyMetaKey(s.shard, ch)

	historyMetaTTL := opts.HistoryMetaTTL
	if historyMetaTTL == 0 {
		historyMetaTTL = b.node.config.HistoryMetaTTL
	}

	historyMetaTTLSeconds := int(historyMetaTTL.Seconds())

	var streamKey channelID
	var size int
	var script *rueidis.Lua
	if b.config.UseLists {
		streamKey = b.historyListKey(s.shard, ch)
		size = opts.HistorySize - 1
		script = b.addHistoryListScript
	} else {
		streamKey = b.historyStreamKey(s.shard, ch)
		size = opts.HistorySize
		script = b.addHistoryStreamScript
	}

	var useDelta string
	if opts.UseDelta {
		useDelta = "1"
	}

	replies, err := script.Exec(
		context.Background(),
		s.shard.client,
		[]string{string(streamKey), string(historyMetaKey), string(resultKey)},
		[]string{
			convert.BytesToString(byteMessage),
			strconv.Itoa(size),
			strconv.Itoa(int(opts.HistoryTTL.Seconds())),
			publishChannelStr,
			strconv.Itoa(historyMetaTTLSeconds),
			strconv.FormatInt(time.Now().Unix(), 10),
			publishCommand,
			resultExpire,
			useDelta,
		},
	).ToArray()
	if err != nil {
		return StreamPosition{}, false, err
	}
	if len(replies) != 2 && len(replies) != 3 {
		return StreamPosition{}, false, errors.New("wrong Redis reply")
	}
	offset, err := replies[0].AsInt64()
	if err != nil {
		return StreamPosition{}, false, errors.New("wrong Redis reply offset")
	}
	epoch, err := replies[1].ToString()
	if err != nil {
		return StreamPosition{}, false, errors.New("wrong Redis reply epoch")
	}
	fromCache := false
	if len(replies) == 3 {
		fromCacheStr, err := replies[2].ToString()
		if err != nil {
			return StreamPosition{}, false, errors.New("wrong Redis reply from cache flag")
		}
		fromCache = fromCacheStr == "1"
	}

	return StreamPosition{Offset: uint64(offset), Epoch: epoch}, fromCache, nil
}

// PublishJoin - see Broker.PublishJoin.
func (b *RedisBroker) PublishJoin(ch string, info *ClientInfo) error {
	return b.publishJoin(b.getShard(ch), ch, info)
}

func (b *RedisBroker) publishJoin(s *shardWrapper, ch string, info *ClientInfo) error {
	byteMessage, err := infoToProto(info).MarshalVT()
	if err != nil {
		return err
	}

	chID := b.messageChannelID(s.shard, ch)

	var resp rueidis.RedisResult
	if b.useShardedPubSub(s.shard) {
		cmd := s.shard.client.B().Spublish().Channel(string(chID)).Message(convert.BytesToString(append(joinTypePrefix, byteMessage...))).Build()
		resp = s.shard.client.Do(context.Background(), cmd)
	} else {
		cmd := s.shard.client.B().Publish().Channel(string(chID)).Message(convert.BytesToString(append(joinTypePrefix, byteMessage...))).Build()
		resp = s.shard.client.Do(context.Background(), cmd)
	}
	return resp.Error()
}

// PublishLeave - see Broker.PublishLeave.
func (b *RedisBroker) PublishLeave(ch string, info *ClientInfo) error {
	return b.publishLeave(b.getShard(ch), ch, info)
}

func (b *RedisBroker) publishLeave(s *shardWrapper, ch string, info *ClientInfo) error {
	byteMessage, err := infoToProto(info).MarshalVT()
	if err != nil {
		return err
	}

	chID := b.messageChannelID(s.shard, ch)

	var resp rueidis.RedisResult
	if b.useShardedPubSub(s.shard) {
		cmd := s.shard.client.B().Spublish().Channel(string(chID)).Message(convert.BytesToString(append(leaveTypePrefix, byteMessage...))).Build()
		resp = s.shard.client.Do(context.Background(), cmd)
	} else {
		cmd := s.shard.client.B().Publish().Channel(string(chID)).Message(convert.BytesToString(append(leaveTypePrefix, byteMessage...))).Build()
		resp = s.shard.client.Do(context.Background(), cmd)
	}
	return resp.Error()
}

// PublishControl - see Broker.PublishControl.
func (b *RedisBroker) PublishControl(data []byte, nodeID string, _ string) error {
	currentRound := atomic.AddUint64(&b.controlRound, 1)
	index := currentRound % uint64(len(b.shards))
	s := b.shards[index]
	return b.publishControl(s, data, nodeID)
}

func (b *RedisBroker) publishControl(s *shardWrapper, data []byte, nodeID string) error {
	var chID channelID
	if nodeID == "" {
		chID = channelID(b.controlChannel)
	} else {
		chID = b.nodeChannelID(nodeID)
	}
	cmd := s.shard.client.B().Publish().Channel(string(chID)).Message(convert.BytesToString(data)).Build()
	resp := s.shard.client.Do(context.Background(), cmd)
	return resp.Error()
}

// Subscribe - see Broker.Subscribe.
func (b *RedisBroker) Subscribe(ch string) error {
	return b.subscribe(b.getShard(ch), ch)
}

func (b *RedisBroker) subscribe(s *shardWrapper, ch string) error {
	if b.node.logEnabled(LogLevelDebug) {
		b.node.logger.log(newLogEntry(LogLevelDebug, "subscribe node on channel", map[string]any{"broker_name": b.config.Name, "channel": ch}))
	}
	psShardIndex := index(ch, b.config.numSubscribeShards)
	var clusterShardIndex int
	if b.useShardedPubSub(s.shard) {
		clusterShardIndex = consistentIndex(ch, b.config.NumShardedPubSubPartitions)
	}

	s.subClientsMu.Lock()
	conn := s.subClients[clusterShardIndex][psShardIndex]
	if conn == nil {
		s.subClientsMu.Unlock()
		return errPubSubConnUnavailable
	}
	s.subClientsMu.Unlock()

	var err error
	if b.useShardedPubSub(s.shard) {
		err = conn.Do(context.Background(), conn.B().Ssubscribe().Channel(string(b.messageChannelID(s.shard, ch))).Build()).Error()
	} else {
		err = conn.Do(context.Background(), conn.B().Subscribe().Channel(string(b.messageChannelID(s.shard, ch))).Build()).Error()
	}
	return err
}

// Unsubscribe - see Broker.Unsubscribe.
func (b *RedisBroker) Unsubscribe(ch string) error {
	return b.unsubscribe(b.getShard(ch), ch)
}

func (b *RedisBroker) unsubscribe(s *shardWrapper, ch string) error {
	if b.node.logEnabled(LogLevelDebug) {
		b.node.logger.log(newLogEntry(LogLevelDebug, "unsubscribe node from channel", map[string]any{"broker_name": b.config.Name, "channel": ch}))
	}
	psShardIndex := index(ch, b.config.numSubscribeShards)
	var clusterShardIndex int
	if b.useShardedPubSub(s.shard) {
		clusterShardIndex = consistentIndex(ch, b.config.NumShardedPubSubPartitions)
	}

	s.subClientsMu.Lock()
	conn := s.subClients[clusterShardIndex][psShardIndex]
	if conn == nil {
		s.subClientsMu.Unlock()
		return errPubSubConnUnavailable
	}
	s.subClientsMu.Unlock()

	var err error
	if b.useShardedPubSub(s.shard) {
		err = conn.Do(context.Background(), conn.B().Sunsubscribe().Channel(string(b.messageChannelID(s.shard, ch))).Build()).Error()
	} else {
		err = conn.Do(context.Background(), conn.B().Unsubscribe().Channel(string(b.messageChannelID(s.shard, ch))).Build()).Error()
	}
	return err
}

// History - see Broker.History.
func (b *RedisBroker) History(ch string, opts HistoryOptions) ([]*Publication, StreamPosition, error) {
	return b.history(b.getShard(ch), ch, opts)
}

func (b *RedisBroker) history(s *shardWrapper, ch string, opts HistoryOptions) ([]*Publication, StreamPosition, error) {
	if b.config.UseLists {
		return b.historyList(s.shard, ch, opts.Filter)
	}
	return b.historyStream(s.shard, ch, opts)
}

// RemoveHistory - see Broker.RemoveHistory.
func (b *RedisBroker) RemoveHistory(ch string) error {
	return b.removeHistory(b.getShard(ch), ch)
}

func (b *RedisBroker) removeHistory(s *shardWrapper, ch string) error {
	var key channelID
	if b.config.UseLists {
		key = b.historyListKey(s.shard, ch)
	} else {
		key = b.historyStreamKey(s.shard, ch)
	}
	cmd := s.shard.client.B().Del().Key(string(key)).Build()
	resp := s.shard.client.Do(context.Background(), cmd)
	return resp.Error()
}

func (b *RedisBroker) messageChannelID(s *RedisShard, ch string) channelID {
	if b.useShardedPubSub(s) {
		ch = "{" + strconv.Itoa(consistentIndex(ch, b.config.NumShardedPubSubPartitions)) + "}." + ch
	}
	return channelID(b.messagePrefix + ch)
}

func (b *RedisBroker) pubSubShardChannelID(clusterShardIndex int, psShardIndex int, useShardedPubSub bool) channelID {
	if useShardedPubSub {
		return channelID(b.shardChannel + "." + strconv.Itoa(psShardIndex) + ".{" + strconv.Itoa(clusterShardIndex) + "}")
	}
	return channelID(b.shardChannel + "." + strconv.Itoa(psShardIndex))
}

func (b *RedisBroker) nodeChannelID(nodeID string) channelID {
	return channelID(b.config.Prefix + redisNodeChannelPrefix + nodeID)
}

func (b *RedisBroker) resultCacheKey(s *RedisShard, ch string, idempotencyKey string) channelID {
	if s.isCluster {
		if b.config.NumShardedPubSubPartitions > 0 {
			ch = "{" + strconv.Itoa(consistentIndex(ch, b.config.NumShardedPubSubPartitions)) + "}." + ch
		} else {
			ch = "{" + ch + "}"
		}
	}
	return channelID(b.config.Prefix + ".result." + ch + "." + idempotencyKey)
}

func (b *RedisBroker) historyListKey(s *RedisShard, ch string) channelID {
	if s.isCluster {
		if b.config.NumShardedPubSubPartitions > 0 {
			ch = "{" + strconv.Itoa(consistentIndex(ch, b.config.NumShardedPubSubPartitions)) + "}." + ch
		} else {
			ch = "{" + ch + "}"
		}
	}
	return channelID(b.config.Prefix + ".list." + ch)
}

func (b *RedisBroker) historyStreamKey(s *RedisShard, ch string) channelID {
	if s.isCluster {
		if b.config.NumShardedPubSubPartitions > 0 {
			ch = "{" + strconv.Itoa(consistentIndex(ch, b.config.NumShardedPubSubPartitions)) + "}." + ch
		} else {
			ch = "{" + ch + "}"
		}
	}
	return channelID(b.config.Prefix + ".stream." + ch)
}

func (b *RedisBroker) historyMetaKey(s *RedisShard, ch string) channelID {
	if s.isCluster {
		if b.config.NumShardedPubSubPartitions > 0 {
			ch = "{" + strconv.Itoa(consistentIndex(ch, b.config.NumShardedPubSubPartitions)) + "}." + ch
		} else {
			ch = "{" + ch + "}"
		}
	}
	if b.config.UseLists {
		return channelID(b.config.Prefix + ".list.meta." + ch)
	}
	return channelID(b.config.Prefix + ".stream.meta." + ch)
}

func (b *RedisBroker) extractChannel(chID channelID) string {
	ch := strings.TrimPrefix(string(chID), b.messagePrefix)
	if b.config.NumShardedPubSubPartitions == 0 {
		return ch
	}
	if strings.HasPrefix(ch, "{") {
		i := strings.Index(ch, ".")
		return ch[i+1:]
	}
	return ch
}

// Define prefixes to distinguish Join and Leave messages coming from PUB/SUB.
var (
	joinTypePrefix  = []byte("__j__")
	leaveTypePrefix = []byte("__l__")
)

func (b *RedisBroker) handleRedisClientMessage(eventHandler BrokerEventHandler, chID channelID, data []byte) error {
	pushData, typeOfPush, sp, delta, prevPayload, ok := extractPushData(data)
	if !ok {
		return fmt.Errorf("malformed PUB/SUB data: %s", data)
	}
	channel := b.extractChannel(chID)
	if typeOfPush == pubPushType {
		var pub protocol.Publication
		err := pub.UnmarshalVT(pushData)
		if err != nil {
			return err
		}
		if pub.Offset == 0 {
			// When adding to history and publishing happens atomically in Broker
			// position info is prepended to Publication payload. In this case we should attach
			// it to unmarshalled Publication.
			pub.Offset = sp.Offset
		}
		if pub.Delta {
			// In at most once scenario we are passing delta in Publication itself. But need to clean it
			// before passing further.
			delta = true
			pub.Delta = false
		}
		if delta && len(prevPayload) > 0 {
			var prevPub protocol.Publication
			err = prevPub.UnmarshalVT(prevPayload)
			if err != nil {
				return err
			}
			_ = eventHandler.HandlePublication(channel, pubFromProto(&pub), sp, true, pubFromProto(&prevPub))
		} else {
			_ = eventHandler.HandlePublication(channel, pubFromProto(&pub), sp, delta, nil)
		}
	} else if typeOfPush == joinPushType {
		var info protocol.ClientInfo
		err := info.UnmarshalVT(pushData)
		if err != nil {
			return err
		}
		_ = eventHandler.HandleJoin(channel, infoFromProto(&info))
	} else if typeOfPush == leavePushType {
		var info protocol.ClientInfo
		err := info.UnmarshalVT(pushData)
		if err != nil {
			return err
		}
		_ = eventHandler.HandleLeave(channel, infoFromProto(&info))
	}
	return nil
}

func (b *RedisBroker) historyStream(s *RedisShard, ch string, opts HistoryOptions) ([]*Publication, StreamPosition, error) {
	historyKey := b.historyStreamKey(s, ch)
	historyMetaKey := b.historyMetaKey(s, ch)

	filter := opts.Filter

	var includePubs = "1"
	var offset uint64
	if filter.Since != nil {
		if filter.Reverse {
			offset = filter.Since.Offset - 1
			if offset == 0 {
				includePubs = "0"
			}
		} else {
			offset = filter.Since.Offset + 1
		}
	}
	var limit int
	if filter.Limit == 0 {
		includePubs = "0"
	}
	if filter.Limit > 0 {
		limit = filter.Limit
	}

	reverse := "0"
	if filter.Reverse {
		reverse = "1"
	}

	historyMetaTTL := opts.MetaTTL
	if historyMetaTTL == 0 {
		historyMetaTTL = b.node.config.HistoryMetaTTL
	}

	historyMetaTTLSeconds := int(historyMetaTTL.Seconds())

	replies, err := b.historyStreamScript.Exec(context.Background(), s.client, []string{string(historyKey), string(historyMetaKey)}, []string{includePubs, strconv.FormatUint(offset, 10), strconv.Itoa(limit), reverse, strconv.Itoa(historyMetaTTLSeconds), strconv.FormatInt(time.Now().Unix(), 10)}).ToArray()
	if err != nil {
		return nil, StreamPosition{}, err
	}
	if len(replies) < 2 {
		return nil, StreamPosition{}, fmt.Errorf("wrong Redis reply number: %d", len(replies))
	}
	var offs int64
	offs, err = replies[0].AsInt64()
	if err != nil {
		if rueidis.IsRedisNil(err) {
			offs = 0
		} else {
			return nil, StreamPosition{}, fmt.Errorf("wrong Redis reply offset: %w", err)
		}
	}
	epoch, err := replies[1].ToString()
	if err != nil {
		return nil, StreamPosition{}, errors.New("wrong Redis reply epoch")
	}

	if includePubs == "1" && len(replies) == 3 {
		values, err := replies[2].ToArray()
		if err != nil {
			return nil, StreamPosition{}, err
		}
		publications := make([]*Publication, 0, len(values))
		for _, v := range values {
			values, err := v.ToArray()
			if err != nil {
				return nil, StreamPosition{}, err
			}
			if len(values) != 2 {
				return nil, StreamPosition{}, fmt.Errorf("got %d, wanted 2", len(values))
			}
			id, err := values[0].ToString()
			if err != nil {
				return nil, StreamPosition{}, err
			}
			fieldValues, err := values[1].ToArray()
			if err != nil {
				return nil, StreamPosition{}, err
			}
			var pushData []byte
			for i := 0; i < len(fieldValues); i += 2 {
				k, _ := fieldValues[i].ToString()
				if k != "d" {
					continue
				}
				v, _ := fieldValues[i+1].ToString()
				pushData = convert.StringToBytes(v)
				break
			}
			if pushData == nil {
				return nil, StreamPosition{}, errors.New("no push data found in entry")
			}
			hyphenPos := strings.Index(id, "-") // ex. "4-0", 4 is our offset.
			if hyphenPos <= 0 {
				return nil, StreamPosition{}, fmt.Errorf("unexpected offset format: %s", id)
			}
			offset, err := strconv.ParseUint(id[:hyphenPos], 10, 64)
			if err != nil {
				return nil, StreamPosition{}, err
			}
			var pub protocol.Publication
			err = pub.UnmarshalVT(pushData)
			if err != nil {
				return nil, StreamPosition{}, fmt.Errorf("can not unmarshal value to Publication: %v", err)
			}
			pub.Offset = offset
			publications = append(publications, pubFromProto(&pub))
		}
		return publications, StreamPosition{Offset: uint64(offs), Epoch: epoch}, nil
	}
	return nil, StreamPosition{Offset: uint64(offs), Epoch: epoch}, nil
}

func (b *RedisBroker) historyList(s *RedisShard, ch string, filter HistoryFilter) ([]*Publication, StreamPosition, error) {
	historyKey := b.historyListKey(s, ch)
	historyMetaKey := b.historyMetaKey(s, ch)

	var includePubs = "1"
	var rightBound = "-1"
	if filter.Limit == 0 {
		rightBound = "0"
		includePubs = "0"
	}

	historyMetaTTLSeconds := int(b.node.config.HistoryMetaTTL.Seconds())

	replies, err := b.historyListScript.Exec(context.Background(), s.client, []string{string(historyKey), string(historyMetaKey)}, []string{includePubs, rightBound, strconv.Itoa(historyMetaTTLSeconds), strconv.FormatInt(time.Now().Unix(), 10)}).ToArray()
	if err != nil {
		return nil, StreamPosition{}, err
	}
	if len(replies) < 2 {
		return nil, StreamPosition{}, fmt.Errorf("wrong Redis reply number: %d", len(replies))
	}
	var offs int64
	offs, err = replies[0].AsInt64()
	if err != nil {
		if rueidis.IsRedisNil(err) {
			offs = 0
		} else {
			return nil, StreamPosition{}, fmt.Errorf("wrong Redis reply offset: %w", err)
		}
	}
	epoch, err := replies[1].ToString()
	if err != nil {
		return nil, StreamPosition{}, errors.New("wrong Redis reply epoch")
	}

	latestPosition := StreamPosition{Offset: uint64(offs), Epoch: epoch}

	if includePubs == "0" || len(replies) == 2 {
		return nil, latestPosition, nil
	}

	values, err := replies[2].ToArray()
	if err != nil {
		return nil, StreamPosition{}, err
	}
	publications := make([]*Publication, 0, len(values)/2)

	for i := len(values) - 1; i >= 0; i-- {
		value, err := values[i].ToString()
		if err != nil {
			return nil, StreamPosition{}, errors.New("error getting value")
		}

		pushData, _, sp, _, _, ok := extractPushData(convert.StringToBytes(value))
		if !ok {
			return nil, StreamPosition{}, fmt.Errorf("malformed publication value: %s", value)
		}

		var pub protocol.Publication
		err = pub.UnmarshalVT(pushData)
		if err != nil {
			return nil, StreamPosition{}, fmt.Errorf("can not unmarshal value to Pub: %v", err)
		}
		pub.Offset = sp.Offset
		publications = append(publications, pubFromProto(&pub))
	}

	since := filter.Since
	if since == nil {
		if filter.Limit >= 0 && len(publications) >= filter.Limit {
			return publications[:filter.Limit], latestPosition, nil
		}
		return publications, latestPosition, nil
	}

	if latestPosition.Offset == since.Offset && since.Epoch == latestPosition.Epoch {
		return nil, latestPosition, nil
	}

	if latestPosition.Offset < since.Offset {
		return nil, latestPosition, nil
	}

	nextOffset := since.Offset + 1

	position := -1

	for i := 0; i < len(publications); i++ {
		pub := publications[i]
		if pub.Offset == since.Offset {
			position = i + 1
			break
		}
		if pub.Offset == nextOffset {
			position = i
			break
		}
	}

	if position > -1 {
		pubs := publications[position:]
		if filter.Limit >= 0 {
			limit := filter.Limit
			if limit > len(pubs) {
				limit = len(pubs)
			}
			return pubs[:limit], latestPosition, nil
		}
		return pubs, latestPosition, nil
	}

	if filter.Limit >= 0 {
		limit := filter.Limit
		if limit > len(publications) {
			limit = len(publications)
		}
		return publications[:limit], latestPosition, nil
	}
	return publications, latestPosition, nil
}

type pushType int

const (
	pubPushType   pushType = 0
	joinPushType  pushType = 1
	leavePushType pushType = 2
)

var (
	metaSep    = []byte("__")
	contentSep = ":"
)

// See tests for supported format examples.
func extractPushData(data []byte) ([]byte, pushType, StreamPosition, bool, []byte, bool) {
	var offset uint64
	var epoch string
	if !bytes.HasPrefix(data, metaSep) {
		return data, pubPushType, StreamPosition{Epoch: epoch, Offset: offset}, false, nil, true
	}

	content := data[len(metaSep):]
	if len(content) == 0 {
		return data, pubPushType, StreamPosition{Epoch: epoch, Offset: offset}, false, nil, false
	}

	contentType := content[0]

	switch contentType {
	case 'j':
		// __j__payload.
		nextMetaSepPos := bytes.Index(data[len(metaSep):], metaSep)
		if nextMetaSepPos <= 0 {
			return data, pubPushType, StreamPosition{Epoch: epoch, Offset: offset}, false, nil, false
		}
		rest := data[len(metaSep)+nextMetaSepPos+len(metaSep):]
		return rest, joinPushType, StreamPosition{}, false, nil, true
	case 'l':
		// __l__payload.
		nextMetaSepPos := bytes.Index(data[len(metaSep):], metaSep)
		if nextMetaSepPos <= 0 {
			return data, pubPushType, StreamPosition{Epoch: epoch, Offset: offset}, false, nil, false
		}
		rest := data[len(metaSep)+nextMetaSepPos+len(metaSep):]
		return rest, leavePushType, StreamPosition{}, false, nil, true
	case 'p':
		// p1:offset:epoch__payload
		nextMetaSepPos := bytes.Index(data[len(metaSep):], metaSep)
		if nextMetaSepPos <= 0 {
			return data, pubPushType, StreamPosition{Epoch: epoch, Offset: offset}, false, nil, false
		}
		header := data[len(metaSep) : len(metaSep)+nextMetaSepPos]
		stringHeader := convert.BytesToString(header)

		rest := data[len(metaSep)+nextMetaSepPos+len(metaSep):]

		stringHeader = stringHeader[3:] // offset:epoch
		epochDelimiterPos := strings.Index(stringHeader, contentSep)
		if epochDelimiterPos <= 0 {
			return rest, pubPushType, StreamPosition{Epoch: epoch, Offset: offset}, false, nil, false
		}
		var err error
		offset, err = strconv.ParseUint(stringHeader[:epochDelimiterPos], 10, 64)
		epoch = stringHeader[epochDelimiterPos+1:]
		return rest, pubPushType, StreamPosition{Epoch: epoch, Offset: offset}, false, nil, err == nil
	case 'd':
		// d1:offset:epoch:prev_payload_length:prev_payload:payload_length:payload
		stringContent := convert.BytesToString(content)
		parsedDelta, err := parseDeltaPush(stringContent)
		if err != nil {
			// Unexpected error.
			return nil, pubPushType, StreamPosition{Epoch: epoch, Offset: offset}, false, nil, false
		}
		return convert.StringToBytes(parsedDelta.Payload), pubPushType, StreamPosition{Epoch: parsedDelta.Epoch, Offset: parsedDelta.Offset}, true, convert.StringToBytes(parsedDelta.PrevPayload), true
	default:
		// Unknown content type.
		return nil, pubPushType, StreamPosition{Epoch: epoch, Offset: offset}, false, nil, false
	}
}

type deltaPublicationPush struct {
	Offset            uint64
	Epoch             string
	PrevPayloadLength int
	PrevPayload       string
	PayloadLength     int
	Payload           string
}

func parseDeltaPush(input string) (deltaPublicationPush, error) {
	// d1:offset:epoch:prev_payload_length:prev_payload:payload_length:payload
	const prefix = "d1:"
	if !strings.HasPrefix(input, prefix) {
		return deltaPublicationPush{}, fmt.Errorf("input does not start with the expected prefix")
	}
	input = input[len(prefix):] // Remove prefix

	// offset:epoch:prev_payload_length:prev_payload:payload_length:payload

	idx := strings.IndexByte(input, ':')
	if idx == -1 {
		return deltaPublicationPush{}, fmt.Errorf("invalid format, missing offset")
	}
	offset, err := strconv.ParseUint(input[:idx], 10, 64)
	if err != nil {
		return deltaPublicationPush{}, fmt.Errorf("error parsing offset: %v", err)
	}
	input = input[idx+1:]

	// epoch:prev_payload_length:prev_payload:payload_length:payload

	idx = strings.IndexByte(input, ':')
	if idx == -1 {
		return deltaPublicationPush{}, fmt.Errorf("invalid format, missing epoch")
	}
	epoch := input[:idx]
	input = input[idx+1:]

	// prev_payload_length:prev_payload:payload_length:payload

	idx = strings.IndexByte(input, ':')
	if idx == -1 {
		return deltaPublicationPush{}, fmt.Errorf("invalid format, missing prev payload length")
	}
	prevPayloadLength, err := strconv.Atoi(input[:idx])
	if err != nil {
		return deltaPublicationPush{}, fmt.Errorf("error parsing prev payload length: %v", err)
	}

	input = input[idx+1:]

	// Extract prev_payload based on prev_payload_length
	if len(input) < prevPayloadLength {
		return deltaPublicationPush{}, fmt.Errorf("input is shorter than expected prev payload length")
	}
	prevPayload := input[:prevPayloadLength]
	input = input[prevPayloadLength+1:]

	// payload_length:payload
	idx = strings.IndexByte(input, ':')
	if idx == -1 {
		return deltaPublicationPush{}, fmt.Errorf("invalid format, missing payload")
	}
	payloadLength, err := strconv.Atoi(input[:idx])
	if err != nil {
		return deltaPublicationPush{}, fmt.Errorf("error parsing payload_length: %v", err)
	}
	input = input[idx+1:]

	// Extract payload based on payload_length
	if len(input) < payloadLength {
		return deltaPublicationPush{}, fmt.Errorf("input is shorter than expected payload length")
	}
	payload := input[:payloadLength]

	return deltaPublicationPush{
		Offset:            offset,
		Epoch:             epoch,
		PrevPayloadLength: prevPayloadLength,
		PrevPayload:       prevPayload,
		PayloadLength:     payloadLength,
		Payload:           payload,
	}, nil
}
