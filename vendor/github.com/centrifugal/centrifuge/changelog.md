v0.29.4 and higher
==================

Since Centrifuge v0.29.4 we do not maintain CHANGELOG.md file.

All changes may be found on [Centrifuge releases page](https://github.com/centrifugal/centrifuge/releases) on Github.

v0.29.3
=======

* Support `cf_ws_frame_ping_pong` url param to simplify debugging with Postman [#306](https://github.com/centrifugal/centrifuge/pull/306)

v0.29.2
=======

* http.ResponseController to set write timeout in SSE and HTTP-streaming handlers [#292](https://github.com/centrifugal/centrifuge/pull/292)
* Experimental Client's storage API for keeping user-defined objects during connection lifetime, [#296](https://github.com/centrifugal/centrifuge/pull/296)
* Up rueidis to v1.0.8 - fixes connect to Redis Sentinel with ipv6 address
* Use default mux in examples for pprof to work

```
gorelease -base v0.29.1 -version v0.29.2
# github.com/centrifugal/centrifuge
## compatible changes
(*Client).AcquireStorage: added
ConnectReply.Storage: added

# summary
v0.29.2 is a valid semantic version for this release.
```

v0.29.1
=======

* Add `ForceRESP2` option for `RedisShardConfig`. If set to `true` forces using RESP2 protocol for communicating with Redis. By default, Redis client tries to detect supported Redis protocol automatically trying RESP3 first.

```
gorelease -base v0.29.0 -version v0.29.1
# github.com/centrifugal/centrifuge
## compatible changes
RedisShardConfig.ForceRESP2: added

# summary
v0.29.1 is a valid semantic version for this release.
```

v0.29.0
=======

This release contains several breaking changes.

* Removing client protocol v1 and all related parts, see [#275](https://github.com/centrifugal/centrifuge/issues/275) for more details. If you are using the latest SDK versions - this should not affect you.
* Possibility to configure history meta TTL on a per-channel level, [#264](https://github.com/centrifugal/centrifuge/pull/264). This is optional and global history TTL value may be set over `Config.HistoryMetaTTL` option. By default, it's 30 days.
* One shot encode/decode for control proto [#263](https://github.com/centrifugal/centrifuge/pull/263). Note that with this change all nodes in your Centrifuge cluster should be v0.29.0 to work properly. Do not mix nodes based on Centrifuge < v0.29.0 with nodes based on Centrifuge v0.29.0. 
* Add client level ping config, remove `AppLevelPing` [#286](https://github.com/centrifugal/centrifuge/pull/286) by @bfwbbrj.

```
❯ gorelease -base v0.28.0 -version v0.29.0
# github.com/centrifugal/centrifuge
## incompatible changes
(*Disconnect).CloseText, method set of *DisconnectEvent: removed
(*Disconnect).CloseText: removed
AppLevelPing: removed
DisableProtocolVersion1: removed
Disconnect.Reconnect: removed
DisconnectEvent.Reconnect: removed
HistoryEvent.Filter: changed from HistoryFilter to HistoryFilter
HistoryFilter.Limit: removed
HistoryFilter.Reverse: removed
HistoryFilter.Since: removed
HistoryFilter: changed from HistoryFilter to HistoryFilter
HistoryOptions.Limit: removed
HistoryOptions.Reverse: removed
HistoryOptions.Since: removed
MemoryBrokerConfig.HistoryMetaTTL: removed
ProtocolVersion1: removed
RedisBrokerConfig.HistoryMetaTTL: removed
SockjsConfig.HeartbeatDelay: removed
SockjsConfig.ProtocolVersion: removed
TransportInfo.AppLevelPing, method set of Transport: removed
TransportInfo.AppLevelPing: removed
TransportInfo.PingPongConfig: added
WebsocketConfig.PingInterval: removed
WebsocketConfig.PongTimeout: removed
WebsocketConfig.ProtocolVersion: removed
WithHistory: changed from func(int, time.Duration) PublishOption to func(int, time.Duration, ...time.Duration) PublishOption
## compatible changes
(*Node).Config: added
Config.HistoryMetaTTL: added
ConnectReply.PingPongConfig: added
HistoryFilter.Filter: added
HistoryFilter.MetaTTL: added
HistoryOptions.Filter: added
HistoryOptions.MetaTTL: added
PublishOptions.HistoryMetaTTL: added
SubscribeOptions.HistoryMetaTTL: added
WithHistoryFilter: added
WithHistoryMetaTTL: added
WithSubscribeHistoryMetaTTL: added

# summary
v0.29.0 is a valid semantic version for this release.
```

v0.28.0
=======

* Centrifuge v0.28.0 comes with an updated Redis Engine implementation based on [rueian/rueidis](https://github.com/rueian/rueidis) library. Allocation efficiency and throughput of Redis `Broker` and `PresenceManager` were improved in both standalone and Cluster Redis setups. See [#262](https://github.com/centrifugal/centrifuge/pull/262) and blog post [Improving Centrifugo Redis Engine throughput and allocation efficiency with Rueidis Go library](https://centrifugal.dev/blog/2022/12/20/improving-redis-engine-performance) for the reasoning and numbers behind.
* Work on a better observability and possibility to protect client protocol from misusing: Centrifuge now has `CommandReadHandler` and `CommandProcessedHandler`. These handlers are only available for client protocol v2, client protocol v1 [will be removed soon](https://github.com/centrifugal/centrifuge/issues/275). While it's not removed `DisableProtocolVersion1` global var may be used to disable possibility for clients to connect to server with `ProtocolVersion1`.
* Client now can't send infinite number of pongs to the server, only one pong after receiving ping is allowed
* Client now can't send any command to the server after getting error in Connect command
* Disconnect client if it sends async message (using `Send` method) to the server while `MessageHandler` not set
* Possibility to dramatically reduce server CPU usage in case of sending many messages towards individual connections (it may be up to 5x reduction depending on message rate). This is possible with new options of `ConnectReply`: `WriteDelay`, `ReplyWithoutQueue`, `MaxMessagesInFrame`, `QueueInitialCap` which allow tweaking Centrifuge message write loop. See [#270](https://github.com/centrifugal/centrifuge/pull/270) for more details.
* Several internal optimizations in client protocol to reduce memory allocations a bit.
* More human-readable tracing logging output (especially in Protobuf protocol case). On the other hand, tracing log level is much more expensive now. We never assumed it will be used in production – so seems an acceptable trade-off.
* Update centrifuge-js version in all examples

```
gorelease -base v0.27.2 -version v0.28.0

# github.com/centrifugal/centrifuge
## incompatible changes
(*Client).Handle: removed
(*Client).HandleCommand: changed from func(*github.com/centrifugal/protocol.Command) bool to func(*github.com/centrifugal/protocol.Command, int) bool
CommandReadHandler: changed from func(*Client, CommandReadEvent) to func(*Client, CommandReadEvent) error
DefaultRedisBrokerPrefix: removed
DefaultRedisConnectTimeout: removed
DefaultRedisPresenceManagerPrefix: removed
DefaultRedisPresenceTTL: removed
DefaultRedisReadTimeout: removed
DefaultRedisWriteTimeout: removed
RedisBrokerConfig.PubSubNumWorkers: removed
RedisShardConfig.IdleTimeout: removed
RedisShardConfig.ReadTimeout: removed
RedisShardConfig.TLSSkipVerify: removed
RedisShardConfig.UseTLS: removed
RedisShardConfig.WriteTimeout: removed
## compatible changes
(*Node).OnCommandProcessed: added
CommandProcessedEvent: added
CommandProcessedHandler: added
CommandReadEvent.CommandSize: added
ConnectReply.MaxMessagesInFrame: added
ConnectReply.QueueInitialCap: added
ConnectReply.ReplyWithoutQueue: added
ConnectReply.WriteDelay: added
DisableProtocolVersion1: added
DisconnectNotAvailable: added
DisconnectPermissionDenied: added
DisconnectTooManyErrors: added
DisconnectTooManyRequests: added
HandleReadFrame: added
RedisShardConfig.ClientName: added
RedisShardConfig.IOTimeout: added
RedisShardConfig.SentinelClientName: added
RedisShardConfig.SentinelTLSConfig: added

# summary
v0.28.0 is a valid semantic version for this release.
```

v0.27.2
=======

* Fix emulation layer in multi-node scenario [#269](https://github.com/centrifugal/centrifuge/pull/269)

v0.27.0
=======

* Disconnect clients in case of inappropriate protocol [#256](https://github.com/centrifugal/centrifuge/pull/256)
* Avoid flushing remaining in some cases [#260](https://github.com/centrifugal/centrifuge/pull/260)
* Command read handler to set callback called upon processing Command received from client connection [#259](https://github.com/centrifugal/centrifuge/pull/259)
* Shutdown nodes in tests [#252](https://github.com/centrifugal/centrifuge/pull/252)
* Better Origin check documentation

```
gorelease -base v0.26.0 -version v0.27.0
# github.com/centrifugal/centrifuge
## compatible changes
(*Node).OnCommandRead: added
CommandReadEvent: added
CommandReadHandler: added
DisconnectInappropriateProtocol: added

# summary
v0.27.0 is a valid semantic version for this release.
```

v0.26.0
=======

In this release we are finishing up a migration to client protocol v2: experimental marks removed, ping/pong configuration standardized. Most probably this is a last minor release that supports Go 1.17.

* Standardize a way to configure server-to-client ping/pong using `PingPongConfig` struct - [#250](https://github.com/centrifugal/centrifuge/pull/250)
* Add possibility to set subscription Source, which may be returned later when calling `Client.ChannelsWithContext` method - [#249](https://github.com/centrifugal/centrifuge/pull/249)
* Refactor Redis Engine to avoid leaking connection in tests (and possibly in production in case of unstable network between application and Redis). See [#237](https://github.com/centrifugal/centrifuge/pull/237)
* Add `nodeRegistry.size()` to improve nodes registry performance a bit [#236](https://github.com/centrifugal/centrifuge/pull/236)
* Fix some data races in tests [#240](https://github.com/centrifugal/centrifuge/pull/240) and avoid blinking tests [#241](https://github.com/centrifugal/centrifuge/pull/241)
* Add Redis Cluster benchmarks [#238](https://github.com/centrifugal/centrifuge/pull/238)

```
gorelease -base v0.25.0 -version v0.26.0
# github.com/centrifugal/centrifuge
## incompatible changes
HTTPStreamConfig.AppLevelPingInterval: removed
HTTPStreamConfig.AppLevelPongTimeout: removed
SSEConfig.AppLevelPingInterval: removed
SSEConfig.AppLevelPongTimeout: removed
SockjsConfig.AppLevelPingInterval: removed
SockjsConfig.AppLevelPongTimeout: removed
WebsocketConfig.AppLevelPingInterval: removed
WebsocketConfig.AppLevelPongTimeout: removed
## compatible changes
(*Client).ChannelsWithContext: added
(*RedisBroker).Close: added
(*RedisPresenceManager).Close: added
(*RedisShard).Close: added
ChannelContext: added
HTTPStreamConfig.PingInterval: added
HTTPStreamConfig.PingPongConfig: added
HTTPStreamConfig.PongTimeout: added
PingPongConfig: added
SSEConfig.PingInterval: added
SSEConfig.PingPongConfig: added
SSEConfig.PongTimeout: added
SockjsConfig.PingInterval: added
SockjsConfig.PingPongConfig: added
SockjsConfig.PongTimeout: added
SubscribeOptions.Source: added
WebsocketConfig.PingPongConfig: added
WithSubscribeSource: added

# summary
v0.26.0 is a valid semantic version for this release.
```

v0.25.0
=======

**Breaking changes**

This release enables using client protocol v2.

All SDKs in Centrifugal ecosystem now behave according to the client [SDK API specification](https://centrifugal.dev/docs/transports/client_api). The work has been done according to [Centrifugo v4 roadmap](https://github.com/centrifugal/centrifugo/issues/500).

Check out [Centrifugo v4 release post](https://centrifugal.dev/blog/2022/07/19/centrifugo-v4-released) that covers the reasoning behind changes here.

This means:

* WebSocket handler will assume client connects over protocol v2. But we will still support client protocol v1 for some time (I believe half a year at least). Protocol v1 may be forced using `WebsocketConfig.ProtocolVersion` option (set it to `ProtocolVersion1`). Or client can provide `?cf_protocol_version=v1` in connection URL. Applications can smoothly migrate to new protocol, for example, see how [Centrifugo v4 migration guide](https://centrifugal.dev/docs/getting-started/migration_v4) provides steps to migrate apps to new client protocol.
* The same applies to SockJS handler. SockJS is now DEPRECATED in Centrifugal ecosystem (we provide our own WebSocket emulation layer, which is faster, does not require sticky sessions, has less overhead in terms of network traffic and memory usage on server side)
* All examples in this repo were adapted to use the latest client SDK API which works according to new [client SDK spec](https://centrifugal.dev/docs/next/transports/client_api)
* Unidirectional transport examples were also updated and now use client protocol v2
* New SDKs that work with new client protocol will be released in parallel with Centrifuge v0.25.0 and Centrifugo v4

To summarise:

1. Current SDKs will be able to work with Centrifuge v0.25.0 – but you will need to turn on using client protocol v1 on server side. This way you can update server side without changing client side code.
2. New client SDKs which will be released will only work with new iteration of client protocol

Please don't hesitate to join our Telegram and Discord communities in case of questions - we will try to help.

v0.24.0
=======

This release has some adjustments required for [Centrifugo v4](https://github.com/centrifugal/centrifugo/issues/500).

Please take a look at example below which emphasizes the important migration step of your server-side code regarding join/leave messages.

We are not switching to client protocol v2 here yet (in v0.23.0 we mentioned it could be the part of the next minor release, but turned out we need an additional intermediate step before we can do the switch).

* change subscribe option names to be more meaningful
* support asking for join/leave messages from the client side
* send initial ping with random delay in client protocol v2 to smooth syscalls (and thus a CPU usage) after a massive reconnect scenario
* make `client.handleCommand` public (`client.HandleCommand`) to have a possibility to handle protocol commands when decoding happens on Transport layer
* fix SSEHandler default max body size (used in case of POST requests)

The important thing is that `SubscribeOptions` now have 2 flags related to join/leave messages: `SubscribeOptions.EmitJoinLeave` and `SubscribeOptions.PushJoinLeave`. This means the program like this:

```go
client.OnSubscribe(func(e centrifuge.SubscribeEvent, cb centrifuge.SubscribeCallback) {
	cb(centrifuge.SubscribeReply{
		Options: centrifuge.SubscribeOptions{
			JoinLeave: true,
		},
	}, nil)
})
```

Must be replaced with this code to inherit the previous behavior:

```go
client.OnSubscribe(func(e centrifuge.SubscribeEvent, cb centrifuge.SubscribeCallback) {
	cb(centrifuge.SubscribeReply{
		Options: centrifuge.SubscribeOptions{
			EmitJoinLeave:     true,
			PushJoinLeave:     true,
		},
	}, nil)
})
```

I.e. we tell Centrifuge that it should emit join/leave messages for a particular channel subscription, and it should send (push) join/leave messages to this particular client connection. The same applies to server-side subscriptions also, see how we adopted our own examples in repo in [#233](https://github.com/centrifugal/centrifuge/pull/233/files) where the change was introduced.

```
gorelease -base v0.23.1 -version v0.24.0
# github.com/centrifugal/centrifuge
## incompatible changes
SubscribeOptions.JoinLeave: removed
SubscribeOptions.Position: removed
SubscribeOptions.Presence: removed
SubscribeOptions.Recover: removed
WithJoinLeave: removed
WithPosition: removed
WithPresence: removed
WithRecover: removed
## compatible changes
(*Client).HandleCommand: added
SubscribeEvent.JoinLeave: added
SubscribeOptions.EmitJoinLeave: added
SubscribeOptions.EmitPresence: added
SubscribeOptions.EnablePositioning: added
SubscribeOptions.EnableRecovery: added
SubscribeOptions.PushJoinLeave: added
WithEmitJoinLeave: added
WithEmitPresence: added
WithPositioning: added
WithPushJoinLeave: added
WithRecovery: added

# summary
v0.24.0 is a valid semantic version for this release.
```

v0.23.1
=======

* Fix emitting Join message in `Client.Subscribe` call, [#231](https://github.com/centrifugal/centrifuge/issues/231).

v0.23.0
=======

This release is a work concentrated around two main things:

* More work on client protocol v2. This should become part of [Centrifugo v4](https://github.com/centrifugal/centrifugo/issues/500). New SDKs which work over new protocol and have new API will be soon released. SDKs will behave according to [client SDK API spec](https://centrifugal.dev/docs/next/transports/client_api). Probably in next major release of Centrifuge we will switch using protocol v2 by default. For now things should be backwards compatible with current protocol.
* Introducing our own EXPERIMENTAL bidirectional emulation layer using HTTP-streaming and EventSource transports. There are a couple of examples which demonstrate how to use it. Examples located in `_examples/experimental` directory (they require new `centrifuge-js` SDK served locally from [v3_dev branch](https://github.com/centrifugal/centrifuge-js/tree/v3_dev)). The important thing about our emulation implementation is that it does not require sticky sessions on load balancer in distributed case. This should be a more lightweight alternative to SockJS, and the cool thing is that our new Javascript SDK will be able to automatically fallback to HTTP-based transports in case of problems with WebSocket connection. More information will be available soon upon Centrifugo v4 release.

Lots of changes here but in most cases it should be straightforward to adapt. Don't hesitate to reach out with questions in [community chat rooms](https://centrifugal.dev/docs/getting-started/introduction#join-community).

Some important release highlights:

* `DefaultConfig` removed, use `Config{}` as a starting point. I.e. `centrifuge.New(centrifuge.Config{})` is equivalent to  `centrifuge.New(centrifuge.DefaultConfig)`.
* We are avoiding using pointers for Disconnects. We got rid of nil Disconnect inside `OnDisconnect` callback when connection closing was not forced by a server. Where we previously had `nil` we now always have `DisconnectConnectionClosed`. This should make library usage more safe and better describes the reason of disconnection.
* Refactor unsubscribe reasons, make unsubscribe first-class citizen with unsubscribe codes.
* Introducing `Temporary` flag for `Error` to indicate temporary errors to a client. This allows making Subscriptions more resilient in client protocol v2 - subscriptions will re-subscribe automatically upon receiving temporary errors.
* There are updated rules in code numbers used for errors, unsubscribes and disconnects. This allows splitting code number space and avoid code overlap. While these rules may be tricky to follow – we believe that in most cases library users do not deal with them a lot in application code:
  * For errors: error codes must be in range [0, 1999]. Codes [0, 99] are reserved for client-side errors. Codes [100, 399] are reserved for Centrifuge library internal usage. So applications must use codes in range [400, 1999] when creating custom errors.
  * For unsubscribe codes: codes must be in range [2000, 2999]. Unsubscribe codes >= 2500 coming from server to client result into resubscribe attempt in client protocol V2. Codes [2000, 2099] and [2500, 2599] are reserved for Centrifuge library internal usage. In client protocol v2 we are making Subscriptions to behave isolated from Connection. For example, some individual subscriptions can expire, but it does not result into connection close, only that individual Subscription will re-subscribe if required.
  * For disconnect codes: codes must be in range [3000, 4999]. Codes [3000, 3999] are reserved for Centrifuge library internal usage. Upon receiving disconnect code in range [3000, 3499] or [4000, 4499] client won't reconnect to a server. Splitting disconnect codes to ranges allows getting rid of sending JSON-encoded data in WebSocket CLOSE frame in client protocol v2. Thus – less network traffic and more lightweight disconnection process.
* `OnStateSnapshot` callback for connection to return Client current state to the external code, useful for connection introspection. This is EXPERIMENTAL and a subject to change.
* Remove an unnecessary lock - [#230](https://github.com/centrifugal/centrifuge/pull/230)

As you can see many changes in this release are concentrated around making library more strict in some aspects, this is a part of standardization and unifying client protocol and SDK API/behavior we want to achieve.

```
❯ gorelease -base v0.22.2 -version v0.23.0
# github.com/centrifugal/centrifuge
## incompatible changes
(*Client).Disconnect: changed from func(*Disconnect) to func(...Disconnect)
(*Client).Unsubscribe: changed from func(string) error to func(string, ...Unsubscribe)
DefaultConfig: removed
DisconnectBadRequest: changed from *Disconnect to Disconnect
DisconnectChannelLimit: changed from *Disconnect to Disconnect
DisconnectConnectionLimit: changed from *Disconnect to Disconnect
DisconnectEvent.Disconnect: changed from *Disconnect to Disconnect
DisconnectExpired: changed from *Disconnect to Disconnect
DisconnectForceNoReconnect: changed from *Disconnect to Disconnect
DisconnectForceReconnect: changed from *Disconnect to Disconnect
DisconnectInsufficientState: changed from *Disconnect to Disconnect
DisconnectInvalidToken: changed from *Disconnect to Disconnect
DisconnectNoPong: changed from *Disconnect to Disconnect
DisconnectNormal: removed
DisconnectServerError: changed from *Disconnect to Disconnect
DisconnectShutdown: changed from *Disconnect to Disconnect
DisconnectSlow: changed from *Disconnect to Disconnect
DisconnectStale: changed from *Disconnect to Disconnect
DisconnectSubExpired: changed from *Disconnect to Disconnect
DisconnectWriteError: changed from *Disconnect to Disconnect
Error.Error: removed
Hub: old is comparable, new is not
Transport.Close: changed from func(*Disconnect) error to func(Disconnect) error
TransportInfo.Emulation: added
UnsubscribeEvent.Reason: removed
UnsubscribeReason: removed
UnsubscribeReasonClient: removed
UnsubscribeReasonDisconnect: removed
UnsubscribeReasonServer: removed
WithDisconnect: removed
## compatible changes
(*Client).OnStateSnapshot: added
(*Client).StateSnapshot: added
(*Disconnect).CloseText: added
(*Hub).Connections: added
Disconnect.Error: added
Disconnect.String: added
DisconnectConnectionClosed: added
DisconnectEvent.Code: added
DisconnectEvent.Reason: added
DisconnectEvent.Reconnect: added
EmulationConfig: added
EmulationHandler: added
Error.Temporary: added
HTTPStreamConfig: added
HTTPStreamHandler: added
NewEmulationHandler: added
NewHTTPStreamHandler: added
NewSSEHandler: added
SSEConfig: added
SSEHandler: added
StateSnapshotHandler: added
SubscribeEvent.Positioned: added
SubscribeEvent.Recoverable: added
Unsubscribe.String: added
Unsubscribe: added
UnsubscribeCodeClient: added
UnsubscribeCodeDisconnect: added
UnsubscribeCodeExpired: added
UnsubscribeCodeInsufficient: added
UnsubscribeCodeServer: added
UnsubscribeEvent.Code: added
UnsubscribeEvent.Unsubscribe: added
WithCustomDisconnect: added
WithCustomUnsubscribe: added

# summary
v0.23.0 is a valid semantic version for this release.
```

v0.22.2
=======

* Bump dependencies.

v0.21.1
=======

* Fix regression of v0.21.0: periodic stream position check was off due to missing zero value in `Config`.

v0.21.0
=======

* It's now possible to use `Config` directly when creating new Centrifuge Node, without using `DefaultConfig` which is now deprecated.
* Removed some constants with default values, added better comments which reflect zero value behavior - no need to jump to const definition when reading code/docs.
* Some allocation optimizations in WebSocket disconnect process.
* Continue working on ProtocolVersion2 – introducing application-level server-to-client pings. This is still EXPERIMENTAL at the moment and may be changed in later releases.

```
gorelease -base v0.20.0 -version v0.21.0
# github.com/centrifugal/centrifuge
## incompatible changes
DefaultWebsocketMessageSizeLimit: removed
DefaultWebsocketPingInterval: removed
DefaultWebsocketWriteTimeout: removed
TransportInfo.AppLevelPing: added
## compatible changes
AppLevelPing: added
DisconnectNoPong: added
SockjsConfig.AppLevelPingInterval: added
SockjsConfig.AppLevelPongTimeout: added
WebsocketConfig.AppLevelPingInterval: added
WebsocketConfig.AppLevelPongTimeout: added
WebsocketConfig.PongTimeout: added

# summary
v0.21.0 is a valid semantic version for this release.
```

v0.20.0
=======

* Support client protocol v2. As of v0.20.0 it's considered experimental and can have some adjustments in the following releases. But the plan is to make it default at some point. The initial motivation described in [#217](https://github.com/centrifugal/centrifuge/issues/217) and implementation is in [#218](https://github.com/centrifugal/centrifuge/pull/218). Client connectors which support client protocol v2 will be released soon. Both `WebsocketConfig` and `SockjsConfig` now have an option to set default protocol version handler will expect from connecting clients. It's also possible to override that option by using `cf_protocol_version` URL parameter (`v1` or `v2`) when connecting to the server. This should provide a way to migrate to new protocol gradually.
* Refactor disconnect semantics for client protocol v2. We are getting rid of JSON in close reason by introducing strict ranges for disconnect codes - see [#221](https://github.com/centrifugal/centrifuge/pull/221). Client connectors will expose disconnect codes when working with client protocol v2. Client-side disconnect reasons will also have its own codes – according to [this comment](https://github.com/centrifugal/centrifuge/issues/149#issuecomment-727551279).
* Various optimizations in message broadcast, client command handling, client initial connect – fewer things now escape to the heap.
* `TransportWriteEvent.IsPush` field is removed (we can discuss putting it back later if required). 
* Node `Survey` API now allows choosing the node to which we want to send survey request.
* Warn log level introduced between Info and Error.
* Publication now has `Tags` field (`map[string]string`) – this may help to put some useful info into publication without modifying payload. It can help to avoid processing payload in some scenarios.
* Support for setting auth user in Redis shard configuration – for Redis itself and for Sentinel. This is useful is ACL-based auth used on Redis side.

```
gorelease -base v0.19.0 -version v0.20.0
# github.com/centrifugal/centrifuge
## incompatible changes
(*Disconnect).CloseText: changed from func() string to func(ProtocolVersion) string
(*Node).Survey: changed from func(context.Context, string, []byte) (map[string]SurveyResult, error) to func(context.Context, string, []byte, string) (map[string]SurveyResult, error)
LogLevelError: value changed from 4 to 5
PublishOptions: old is comparable, new is not
PublishReply: old is comparable, new is not
TransportInfo.ProtocolVersion: added
TransportWriteEvent.IsPush: removed
## compatible changes
LogLevelWarn: added
ProtocolVersion1: added
ProtocolVersion2: added
ProtocolVersion: added
Publication.Tags: added
PublishOptions.Tags: added
RedisShardConfig.SentinelUser: added
RedisShardConfig.User: added
SockjsConfig.ProtocolVersion: added
WebsocketConfig.ProtocolVersion: added
WithTags: added

# summary
v0.20.0 is a valid semantic version for this release.
```

v0.19.0
=======

* JSON protocol performance improvements. See [#215](https://github.com/centrifugal/centrifuge/pull/215) for details. We are now more strict in parsing multiple command frames: in a multiple command JSON frame individual `Command`s must be separated by exactly one new line symbol and have an optional new line after the last command. This was always this way and current client connectors work according to these requirements – but since the parser becoming more strict this can theoretically cause some problems with third-party connector implementations.
* Support custom `data` from a client passed in a subscribe command, this data is then available in `SubscribeEvent`.

```
gorelease -base v0.18.9 -version v0.19.0
# github.com/centrifugal/centrifuge
## incompatible changes
SubscribeEvent: old is comparable, new is not
## compatible changes
SubscribeEvent.Data: added

# summary
v0.19.0 is a valid semantic version for this release.
```

v0.18.9
=======

* Add unsubscribe Reason and optional `Disconnect` to `UnsubscribeEvent`. See issue [#211](https://github.com/centrifugal/centrifuge/issues/211) and pr [#213](https://github.com/centrifugal/centrifuge/pull/213).

```
gorelease -base v0.18.8 -version v0.18.9
# github.com/centrifugal/centrifuge
## compatible changes
UnsubscribeEvent.Disconnect: added
UnsubscribeEvent.Reason: added
UnsubscribeReason: added
UnsubscribeReasonClient: added
UnsubscribeReasonDisconnect: added
UnsubscribeReasonServer: added

# summary
v0.18.9 is a valid semantic version for this release.
```

v0.18.8
=======

* Fix subscription cleanup on client close. [Pull request with a fix](https://github.com/centrifugal/centrifuge/pull/209).

v0.18.7
=======

* Fix deadlock during PUB/SUB sync in channels with recovery. See [original report](https://github.com/centrifugal/centrifugo/issues/486) and [pr with a fix](https://github.com/centrifugal/centrifuge/pull/208).

v0.18.6
=======

* Fix panic on concurrent subscribe to the same channel with recovery on ([#207](https://github.com/centrifugal/centrifuge/pull/207)).

v0.18.5
=======

* Update `sockjs-go` dependency (contains fix for [sockjs-go#100](https://github.com/igm/sockjs-go/issues/100)).

v0.18.4
=======

* Fix `bufio: buffer full` error when unmarshalling large messages. 

v0.18.3
=======

* Fix `unexpected end of JSON input` errors in Javascript client with Centrifuge >= v0.18.0 when publishing formatted JSON (with new lines). See [centrifugal/protocol#10](https://github.com/centrifugal/protocol/pull/10). Pull request also removes one extra allocation (data copy) during JSON and Protobuf protocol Push message encoding. As the result JSON without new lines will be encoded even faster, Protobuf messages will be encoded faster regardless new lines in payloads. JSON encoding of payload with new lines will require additional allocation since we are stripping new lines now. The penalty is not critical though - see benchmarks in mentioned pull request.   

v0.18.2
=======

* Redis: reload data pipeline immediately upon reconnect, this should help to avoid one additional error after reconnecting to Redis

v0.18.1
=======

* Add history `reverse` field to client protocol and handle it.

v0.18.0
=======

This release has **several backward incompatible changes**. Changes should affect the small number of Centrifuge library users, and it should be possible to adapt only by slightly modifying server-side code. Follow release notes carefully.

* **Breaking change**. Client history API behavior changed. Now history call does not return all publications by default ([#196](https://github.com/centrifugal/centrifuge/issues/196)). See an advice how you can handle this change in a backwards compatible way below.
* **Breaking change**. Redis STREAM data structure now used by default to keep a publication history in Redis Engine ([#195](https://github.com/centrifugal/centrifuge/issues/195)). Previously Centrifuge Redis Engine used LIST data structure by default. See `RedisBrokerConfig.UseLists` option to turn on previous behavior. Redis streams is a recommended way though, support for LIST data structure may be eventually removed.
* **Breaking change**. `Transport.Encoding` removed. It turns out that this option is not really useful for the Centrifuge library and can only cause confusion.
* **Breaking change**. Change `Node.History` behavior – Unrecoverable Position error now returned based on the wrong epoch only.
* **Breaking change**. Remove deprecated seq/gen fields - see [#197](https://github.com/centrifugal/centrifuge/issues/197). Those were deprecated for a long time.
* **Breaking change**. `Client.Connect` now does not return an error – this allows Centrifuge to automatically send a proper Disconnect push towards the connection.
* **Breaking change**. `WithClientWhitelist` renamed to `WithDisconnectClientWhitelist`.
* Much faster JSON client protocol. Expect at least 4x speedup for small messages JSON encoding/decoding. For large messages the difference can be even bigger. This is possible due to using code generation for encoding and a faster library for JSON decoding in `centrifugal/protocol` package. See [centrifugal/protocol#8](https://github.com/centrifugal/protocol/pull/8).
* Message broadcast allocates less - see [#193](https://github.com/centrifugal/centrifuge/issues/193). Can be noticeable when broadcasting messages to large number of active subscribers. The side effect of this change is that Transport implementations should now have `Write` and `WriteMany` methods.
* Centrifuge now uses official Protobuf library for Go with [planetscale/vtprotobuf](https://github.com/planetscale/vtprotobuf) code generator instead of [gogo/protobuf](https://github.com/gogo/protobuf) library which is not maintained these days anymore. The performance of Protobuf marshaling/unmarshaling is comparable.
* New `Config.UseSingleFlight` option added. The option can help to reduce the load on Broker and Presence manager during massive reconnect and history synchronization scenarios.
* WebSocket subprotocol is now can be used for switching to Protobuf protocol ([#194](https://github.com/centrifugal/centrifuge/issues/194)). This will help to avoid adding `?format=protobuf` in WebSocket connection URL.
* `OnTransportWrite` callback added to inject custom logic before actual write to a client connection.
* `OnNodeInfoSend` callback added to attach custom data to Node control frame.
* `Client.Info` method which returns a copy of the connection info (set by `Credentials`).
* `Node.History` now supports iteration in reversed order ([#201](https://github.com/centrifugal/centrifuge/issues/201)).
* `Client.Refresh` and `Node.Refresh` methods added to prolong/expire connections (useful for unidirectional transports).
* GRPC unidirectional transport example improvements

Regarding client history API change. So previously when a client called history it received all publications in a stream by default. In Centrifuge v0.18.0 it will only receive current stream top position (`offset` and `epoch`) without any publications.

To mimic previous behavior you can use code like this:

```go
node.OnConnect(func(client *centrifuge.Client) {
    client.OnHistory(func(e centrifuge.HistoryEvent, cb centrifuge.HistoryCallback) {
        if e.Filter.Limit == 0 {
            result, err := node.History(e.Channel,
                centrifuge.WithSince(e.Filter.Since),
                centrifuge.WithLimit(centrifuge.NoLimit),
            )
            if err != nil {
                cb(centrifuge.HistoryReply{}, err)
                return
            }
            cb(centrifuge.HistoryReply{Result: &result}, nil)
            return
        }
        cb(centrifuge.HistoryReply{}, nil)
    })
})
```

I.e. explicitly handle zero limit and return all publications in response (using `centrifuge.NoLimit`). Then upgrade clients to use recent Centrifuge clients (will be released soon after Centrifuge v0.18.0) which allow setting limit explicitly and remove this custom logic eventually from the server code.

```
gorelease -base v0.17.1 -version v0.18.0
github.com/centrifugal/centrifuge
---------------------------------
Incompatible changes:
- (*Client).Connect: changed from func(ConnectRequest) error to func(ConnectRequest)
- CompatibilityFlags: removed
- EncodingType: removed
- EncodingTypeBinary: removed
- EncodingTypeJSON: removed
- NodeInfo: old is comparable, new is not
- RedisBrokerConfig.UseStreams: removed
- Transport.Write: changed from func(...[]byte) error to func([]byte) error
- Transport.WriteMany: added
- TransportInfo.Encoding, method set of Transport: removed
- TransportInfo.Encoding: removed
- UseSeqGen: removed
- WithClientWhitelist: removed
Compatible changes:
- (*Client).Info: added
- (*Client).Refresh: added
- (*Hub).NumSubscriptions: added
- (*Hub).UserConnections: added
- (*Node).OnNodeInfoSend: added
- (*Node).OnTransportWrite: added
- (*Node).Refresh: added
- Config.UseSingleFlight: added
- ConnectEvent.Channels: added
- DisconnectChannelLimit: added
- HistoryFilter.Reverse: added
- HistoryOptions.Reverse: added
- NodeInfo.Data: added
- NodeInfo.NumSubs: added
- NodeInfoSendHandler: added
- NodeInfoSendReply: added
- RedisBrokerConfig.UseLists: added
- RefreshOption: added
- RefreshOptions: added
- SubscribeOptions.RecoverSince: added
- TransportWriteEvent: added
- TransportWriteHandler: added
- WithDisconnectClient: added
- WithDisconnectClientWhitelist: added
- WithRecoverSince: added
- WithRefreshClient: added
- WithRefreshExpireAt: added
- WithRefreshExpired: added
- WithRefreshInfo: added
- WithReverse: added

v0.18.0 is a valid semantic version for this release.
```

v0.17.1
=======

* Possibility to bypass broker when publishing - see [#198](https://github.com/centrifugal/centrifuge/pull/198)
* Added more tests

v0.17.0
=======

* Remove unidirectional WebSocket support from builtin WebSocket transport. This was done to not force transport implementation details and to reduce code in a library core. It's still possible to build unidirectional WebSocket transport - just not with a builtin `WebsocketHandler`, see [example](https://github.com/centrifugal/centrifuge/tree/master/_examples/unidirectional_ws).
* Introduce `node.Notify` method. `Notify` allows sending an asynchronous notification to all other node (or to a single specific node). Unlike `Survey` it does not wait for any response
* `Since` option of history call renamed to `WithSince` for consistency with other option names

```
gorelease -base v0.16.0 -version v0.17.0
github.com/centrifugal/centrifuge
---------------------------------
Incompatible changes:
- Since: removed
- WebsocketConfig.Unidirectional: removed
Compatible changes:
- (*Node).Notify: added
- (*Node).OnNotification: added
- NotificationEvent: added
- NotificationHandler: added
- WithSince: added
```

v0.16.0
=======

This release is huge. The list of changes may look scary - but most changes should be pretty straightforward to adopt.

Highlights:

* Support for unidirectional clients, this opens a road to more adoption of Centrifuge for cases where bidirectional communication is not really needed. **Unidirectional support is still a subject to change in future versions** as soon as more feedback appears – for now Centrifuge has examples for [GRPC](https://github.com/centrifugal/centrifuge/tree/master/_examples/unidirectional_grpc), [EventSource(SSE)](https://github.com/centrifugal/centrifuge/tree/master/_examples/unidirectional_sse), [HTTP-streaming](https://github.com/centrifugal/centrifuge/tree/master/_examples/unidirectional_http_stream), [Unidirectional WebSocket](https://github.com/centrifugal/centrifuge/tree/master/_examples/unidirectional_ws) transports. **The beauty here is that you don't need to use any Centrifuge client library to receive real-time updates** - just use native browser APIs or GRPC generated code with simple decoding step.
* The introduction of unidirectional transport required to change `Transport` interface a bit. The important thing is that it's now a responsibility of `Transport.Write` to properly encode data to JSON-streaming or Protobuf length-delimited format
* **Centrifuge now uses [same-origin policy](https://en.wikipedia.org/wiki/Same-origin_policy) by default when checking incoming WebSocket or SockJS request due to security considerations** (prevent CSRF attack), previously default check allowed all connections. If you want to mimic previous behavior then pass custom check functions to handler configurations – see example below.
* New `Subscribe` method of `Node` - to subscribe user to server-side channels cluster-wide - see [example that demonstrates new API](https://github.com/centrifugal/centrifuge/tree/master/_examples/user_subscribe_unsubscribe)
* Engine interface removed - now Centrifuge only has separate `Broker` and `PresenceManager` entities. This changes how you should set up Redis to scale Nodes - see [updated Redis example](https://github.com/centrifugal/centrifuge/tree/master/_examples/redis_broker_presence) - it's now **required to provide Redis Broker and Redis Presence Manager separately**
* Trace level logging (to see all protocol frames, obviously mostly suitable for development)
* `WithResubscribe` option of unsubscribe removed - it never worked properly in client libraries and had no clearly defined semantics
* It is now possible to return custom data in Subscribe result or in Subscribe Push
* `Broker.PublishControl` method signature changed - it now accepts `shardKey` string argument, this is not used at the moment but can be used later if we will need an order of control messages
* `PresenceManager.AddPresence` signature changed - now presence expiration time is an option of PresenceManager itself
* Field `version` of `ConnectResult` is now omitted from JSON if empty
* Server-side subscriptions now trigger unsubscribe event (with `ServerSide` boolean flag set to `true`)
* Slightly faster Redis history decoding - [commit](https://github.com/centrifugal/centrifuge/commit/fe31f2469e4ab7790ffa48333c0c063a0f9378e8)
* Hub container now shards connections and subscriptions - this can reduce lock contention significantly in some workloads thus reducing operation latency. See [#184](https://github.com/centrifugal/centrifuge/pull/184)
* Various example improvements

That's what you have to do if you want to accept all connections without same-origin check introduced in v0.16.0 (can lead to CSRF vulnerability in some situations):

```go
wsHandler := centrifuge.NewWebsocketHandler(node, centrifuge.WebsocketConfig{
    CheckOrigin: func(r *http.Request) bool {
        return true
    },
})

sockjsHandler := centrifuge.NewSockjsHandler(node, centrifuge.SockjsConfig{
    CheckOrigin: func(r *http.Request) bool {
        return true
    },
    WebsocketCheckOrigin: func(r *http.Request) bool {
        return true
    },  
})
```

All changes:

```
$ gorelease -base v0.15.0 -version v0.16.0
github.com/centrifugal/centrifuge
---------------------------------
Incompatible changes:
- (*Client).Subscribe: changed from func(string) error to func(string, ...SubscribeOption) error
- (*Client).Unsubscribe: changed from func(string, ...UnsubscribeOption) error to func(string) error
- (*Node).SetEngine: removed
- Broker.PublishControl: changed from func([]byte, string) error to func([]byte, string, string) error
- Config.ClientPresenceExpireInterval: removed
- Engine: removed
- LogLevelDebug: value changed from 1 to 2
- LogLevelError: value changed from 3 to 4
- LogLevelInfo: value changed from 2 to 3
- MemoryEngine: removed
- MemoryEngineConfig: removed
- NewMemoryEngine: removed
- NewRedisEngine: removed
- PresenceManager.AddPresence: changed from func(string, string, *ClientInfo, time.Duration) error to func(string, string, *ClientInfo) error
- RedisEngine: removed
- RedisEngineConfig: removed
- RedisShardConfig.ClusterAddrs: removed
- RedisShardConfig.Host: removed
- RedisShardConfig.Port: removed
- RedisShardConfig.Prefix: removed
- RedisShardConfig.PubSubNumWorkers: removed
- RedisShardConfig.SentinelAddrs: removed
- Transport.Write: changed from func([]byte) error to func(...[]byte) error
- TransportInfo.DisabledPushFlags: added
- TransportInfo.Unidirectional: added
- UnsubscribeOptions.Resubscribe: removed
- WithResubscribe: removed
Compatible changes:
- (*Client).Connect: added
- (*Node).Subscribe: added
- ConnectRequest: added
- DefaultRedisBrokerPrefix: added
- DefaultRedisConnectTimeout: added
- DefaultRedisPresenceManagerPrefix: added
- DefaultRedisPresenceTTL: added
- DefaultRedisReadTimeout: added
- DefaultRedisWriteTimeout: added
- LogLevelTrace: added
- MemoryBroker: added
- MemoryBrokerConfig: added
- MemoryPresenceManager: added
- MemoryPresenceManagerConfig: added
- NewMemoryBroker: added
- NewMemoryPresenceManager: added
- NewRedisBroker: added
- NewRedisPresenceManager: added
- NewRedisShard: added
- PushFlagConnect: added
- PushFlagDisconnect: added
- PushFlagJoin: added
- PushFlagLeave: added
- PushFlagMessage: added
- PushFlagPublication: added
- PushFlagSubscribe: added
- PushFlagUnsubscribe: added
- RedisBroker: added
- RedisBrokerConfig: added
- RedisPresenceManager: added
- RedisPresenceManagerConfig: added
- RedisShard: added
- RedisShardConfig.Address: added
- RedisShardConfig.ClusterAddresses: added
- RedisShardConfig.SentinelAddresses: added
- SubscribeOption: added
- SubscribeOptions.Data: added
- SubscribeRequest: added
- UnsubscribeEvent.ServerSide: added
- WebsocketConfig.Unidirectional: added
- WithChannelInfo: added
- WithExpireAt: added
- WithJoinLeave: added
- WithPosition: added
- WithPresence: added
- WithRecover: added
- WithSubscribeClient: added
- WithSubscribeData: added
- WithUnsubscribeClient: added

v0.16.0 is a valid semantic version for this release.
```

v0.15.0
=======

* Add `Node.Survey` method – it allows gathering results from all running nodes. It's possible to define your own survey handlers. See [example](https://github.com/centrifugal/centrifuge/tree/master/_examples/survey). Keep in mind that `Survey` does not scale very well as number of Centrifuge Nodes grows. Though it has reasonably good performance to perform rare tasks even with relatively large number of nodes – see [benchmark in pull request](https://github.com/centrifugal/centrifuge/pull/174)
* The main motivation of adding `Node.Survey` was attempt to remove `Broker.Channels` method – which is not supported by most of existing PUB/SUB brokers and does not work in Redis cluster. `Broker.Channels` now removed, but it can be replaced with survey if needed
* Improve clustering - node will now send a SHUTDOWN message so other nodes have a chance to realize that node left cluster almost immediately 
* Signature of `Since` history call option changed – it now accepts a pointer to StreamPosition. This change simplifies a code to construct history call
* Added `SubscribeOptions.Position` boolean flag to enable positioning in channel stream. Positioning means that Centrifuge will check that the client did not miss any message from PUB/SUB system, as soon as loss detected client will be disconnected with `Insufficient State` reason. This is very similar to what `Recover: true` option did, but `Position: true` does not enable recovery. As soon as `Position` flag enabled Centrifuge will expose top stream `StreamPosition` information to a client in Subscribe Reply
* Added possibility to iterate over a channel history stream from client side. See [an example that demonstrates this](https://github.com/centrifugal/centrifuge/tree/master/_examples/history_pagination)
* New `Config` options: `HistoryMaxPublicationLimit` and `RecoveryMaxPublicationLimit` to control maximum number of publications to return during history call or recovery process. See Centrifuge documentation for detailed description
* New example that shows [Centrifuge integration with Tarantool](https://github.com/centrifugal/centrifuge/tree/master/_examples/custom_engine_tarantool). Tarantool engine implementation can outperform Redis (up to 5-10x for presence and history operations), though while example contains a full-featured fast Engine implementation – it's still just an example at the moment and have not been tested in production environment
* New blog post in Centrifugo blog where we [introduce Centrifuge library](https://centrifugal.github.io/centrifugo/blog/intro_centrifuge/) 
* Most [examples](https://github.com/centrifugal/centrifuge/tree/master/_examples) now do not use jQuery which was replaced by vanilla JS

```
$ gorelease -base v0.14.2 -version v0.15.0
github.com/centrifugal/centrifuge
---------------------------------
Incompatible changes:
- (*MemoryEngine).Channels: removed
- (*MemoryEngine).PublishControl: changed from func([]byte) error to func([]byte, string) error
- (*Node).Channels: removed
- (*RedisEngine).Channels: removed
- (*RedisEngine).PublishControl: changed from func([]byte) error to func([]byte, string) error
- Broker.Channels, method set of Engine: removed
- Broker.Channels: removed
- Broker.PublishControl: changed from func([]byte) error to func([]byte, string) error
- BrokerEventHandler.HandlePublication: changed from func(string, *Publication) error to func(string, *Publication, StreamPosition) error
- Since: changed from func(StreamPosition) HistoryOption to func(*StreamPosition) HistoryOption
Compatible changes:
- (*Node).ID: added
- (*Node).OnSurvey: added
- (*Node).Survey: added
- Config.HistoryMaxPublicationLimit: added
- Config.RecoveryMaxPublicationLimit: added
- ErrorUnrecoverablePosition: added
- HistoryEvent.Filter: added
- SubscribeOptions.Position: added
- SurveyCallback: added
- SurveyEvent: added
- SurveyHandler: added
- SurveyReply: added
- SurveyResult: added

v0.15.0 is a valid semantic version for this release.
```

v0.14.2
=======

* fix concurrent map access which could result in runtime crash when using presence feature.

v0.14.1
=======

* remove unused `history_full` metric, add `history` action metric to track all history calls.

v0.14.0
=======

* Add possibility to disconnect user with custom `Disconnect` object, and with client ID whitelist.
* Thus fixing non-working `WithReconnect` option when calling `node.Disconnect` method.
* No error returned from `client.Disconnect` method anymore. It was always `nil` before.

Here is what changed since v0.13.0:

```
gorelease -base v0.13.0 -version v0.14.0
github.com/centrifugal/centrifuge
---------------------------------
Incompatible changes:
- (*Client).Disconnect: changed from func(*Disconnect) error to func(*Disconnect)
- DisconnectOptions.Reconnect: removed
- DisconnectOptions: old is comparable, new is not
- WithReconnect: removed
Compatible changes:
- DisconnectOptions.ClientWhitelist: added
- DisconnectOptions.Disconnect: added
- WithClientWhitelist: added
- WithDisconnect: added

v0.14.0 is a valid semantic version for this release.
```

v0.13.0
=======

This release solves two important issues from v1.0.0 library milestone. It has API changes, though as always it's possible to implement the same as before, and adapting new version should be pretty straightforward.

* [#163](https://github.com/centrifugal/centrifuge/issues/163) Provide a way to add concurrent processing of protocol commands. Before this change protocol commands could only be processed one by one. The obvious drawback in this case is that one slow RPC could result into stopping other requests from being processed thus affecting overall latency. This required changing client handler API and use asynchronous callback style API for returning replies from event handlers. This approach while not being very idiomatic allows using whatever concurrency strategy developer wants without losing the possibility to control event order.
* [#161](https://github.com/centrifugal/centrifuge/issues/161) Eliminating `ChannelOptionsFunc` – now all channel options can be provided when calling `Publish` operation (history size and TTL) or by returning from event handlers inside `SubscribeReply` (enabling channel presence, join/leave messages, recovery in a channel). This means that channel options can now be controlled per-connection (not only per channel as before). For example if you need admin connection to subscribe to channel but not participate in channel presence – you are able to not enable presence for that connection.  
* Server-side subscriptions now set over `Subscriptions` map (instead of `Channels`). Again – subscribe options can be set with per-connection resolution.
* Change signature of `Publish` method in `Broker` interface – method now accepts `[]byte` data instead of `*Publication`.  
* Function options for `Unsubbscribe` and `Disconnect` methods now have boolean argument.
* History functional option `WithNoLimit` removed – use `WithLimit(centrifuge.NoLimit)` instead. 
* Config option `ClientUserConnectionLimit` renamed to `UserConnectionLimit`. If `UserConnectionLimit` set then now connection will be disconnected with `DisconnectConnectionLimit` instead of returning a `LimitExceeded` error.

Since API changes are pretty big, let's look at example program and how to adapt it from v0.12.0 to v0.13.0.

The program based on v0.12.0 API:

```go
package main

import (
	"context"

	"github.com/centrifugal/centrifuge"
)

func main() {
	cfg := centrifuge.DefaultConfig
	cfg.ChannelOptionsFunc = func(channel string) (centrifuge.ChannelOptions, bool, error) {
		return centrifuge.ChannelOptions{
			Presence:        true,
			JoinLeave:       true,
			HistorySize:     100,
			HistoryLifetime: 300,
			HistoryRecover:  true,
		}, true, nil
	}

	node, _ := centrifuge.New(cfg)

	node.OnConnecting(func(ctx context.Context, e centrifuge.ConnectEvent) (centrifuge.ConnectReply, error) {
		return centrifuge.ConnectReply{
			Credentials: &centrifuge.Credentials{UserID: "42"},
			// Subscribe to a server-side channel.
			Channels: []string{"news"},
		}, nil
	})

	node.OnConnect(func(c *centrifuge.Client) {
		println("client connected")
	})

	node.OnSubscribe(func(c *centrifuge.Client, e centrifuge.SubscribeEvent) (centrifuge.SubscribeReply, error) {
		return centrifuge.SubscribeReply{}, nil
	})

	node.OnPublish(func(c *centrifuge.Client, e centrifuge.PublishEvent) (centrifuge.PublishReply, error) {
		return centrifuge.PublishReply{}, nil
	})

	node.OnDisconnect(func(c *centrifuge.Client, e centrifuge.DisconnectEvent) {
		println("client disconnected")
	})

	_ = node.Run()
}
```

With v0.13.0 the same program becomes:

```go
package main

import (
	"context"
	"time"

	"github.com/centrifugal/centrifuge"
)

func main() {
	node, _ := centrifuge.New(centrifuge.DefaultConfig)

	node.OnConnecting(func(ctx context.Context, e centrifuge.ConnectEvent) (centrifuge.ConnectReply, error) {
		return centrifuge.ConnectReply{
			Credentials: &centrifuge.Credentials{UserID: "42"},
			// Subscribe to a server-side channel.
			Subscriptions: map[string]centrifuge.SubscribeOptions{
				"news": {Presence: true, JoinLeave: true, Recover: true},
			},
		}, nil
	})

	node.OnConnect(func(client *centrifuge.Client) {
		println("client connected")

		client.OnSubscribe(func(e centrifuge.SubscribeEvent, cb centrifuge.SubscribeCallback) {
			cb(centrifuge.SubscribeReply{
				Options: centrifuge.SubscribeOptions{
					Presence:  true,
					JoinLeave: true,
					Recover:   true,
				},
			}, nil)
		})

		client.OnPublish(func(e centrifuge.PublishEvent, cb centrifuge.PublishCallback) {
			// BTW you can publish here explicitly using node.Publish method – see Result
			// field of PublishReply and chat_json example.
			cb(centrifuge.PublishReply{
				Options: centrifuge.PublishOptions{
					HistorySize: 100,
					HistoryTTL:  5 * time.Minute,
				},
			}, nil)
		})

		client.OnDisconnect(func(e centrifuge.DisconnectEvent) {
			println("client disconnected")
		})
	})

	_ = node.Run()
}
```

As you can see there are three important changes:

1) You should now set up event handlers inside `node.OnConnect` closure
2) Event handlers now have callback argument that you should call with corresponding Reply as soon as you have it
3) For server-side subscriptions you should now return `Subscriptions` field in `ConnectReply` which is `map[string]SubscribeOptions` instead of `[]string` slice.

See [new example that demonstrates concurrency](https://github.com/centrifugal/centrifuge/tree/master/_examples/concurrency) using bounded semaphore.

Note that every feature enabled for a channel increases resource usage on a server. You should only enable presence, recovery, join/leave features and maintaining history in channels where this is necessary.

See also updated [Tips and tricks](https://github.com/centrifugal/centrifuge#tips-and-tricks) section in a README – it now contains information about connection life cycle and event handler concurrency. 

v0.12.0
=======

This release is a step back in Engine separation and has some important fixes and improvements. Backwards incompatible changes are all about Engine interfaces so if you are using built-in Memory or Redis engines you should be fine to upgrade. Otherwise, take a closer look on first and second points below.

* `HistoryManager` interface removed and its methods now part of `Broker` interface{}. The reason behind this is that Broker should be responsible for an atomicity of saving message into history stream and publish to PUB/SUB. More details in [#158](https://github.com/centrifugal/centrifuge/pull/158)
* Cleaner `Broker` interface methods without `ChannelOptions`
* Fix reconnects due to `InsufficientState` errors in channels with `HistoryRecover` option on when using Memory Engine and frequently publishing in parallel (from different goroutines)
* Fix reconnects due to `InsufficientState` errors when using legacy seq, gen fields - [#157](https://github.com/centrifugal/centrifuge/pull/157)
* Fix returning custom disconnect for SockJS transport
* Possibility to define history stream options in `Publish` call
* Deprecate Broker/Engine `Channels` method – see [#147](https://github.com/centrifugal/centrifuge/issues/147)
* Increase test coverage up to 83% so [#106](https://github.com/centrifugal/centrifuge/issues/106) is finally closed
* Test Sentinel scenario in CI
* Refactor queue writer to prevent possible message loss on connection close - [160](https://github.com/centrifugal/centrifuge/pull/160)
* Fix inconsistent tests of Redis Cluster recovery due to PUB/SUB buffering
* Minor improvements in Gin auth example - [#154](https://github.com/centrifugal/centrifuge/pull/154)

I have a plan for future library versions to remove `ChannelOptionFunc` completely (but still have a control over channel feature set). This is still in research – if you are interested welcome to [#161](https://github.com/centrifugal/centrifuge/issues/161).

```
$ gorelease -base v0.11.2 -version v0.12.0
github.com/centrifugal/centrifuge
---------------------------------
Incompatible changes:
- (*MemoryEngine).AddHistory: removed
- (*MemoryEngine).Publish: changed from func(string, *Publication, *ChannelOptions) error to func(string, *Publication, PublishOptions) (StreamPosition, error)
- (*MemoryEngine).PublishJoin: changed from func(string, *ClientInfo, *ChannelOptions) error to func(string, *ClientInfo) error
- (*MemoryEngine).PublishLeave: changed from func(string, *ClientInfo, *ChannelOptions) error to func(string, *ClientInfo) error
- (*Node).SetHistoryManager: removed
- (*RedisEngine).AddHistory: removed
- (*RedisEngine).Publish: changed from func(string, *Publication, *ChannelOptions) error to func(string, *Publication, PublishOptions) (StreamPosition, error)
- (*RedisEngine).PublishJoin: changed from func(string, *ClientInfo, *ChannelOptions) error to func(string, *ClientInfo) error
- (*RedisEngine).PublishLeave: changed from func(string, *ClientInfo, *ChannelOptions) error to func(string, *ClientInfo) error
- Broker.History: added
- Broker.Publish: changed from func(string, *Publication, *ChannelOptions) error to func(string, *Publication, PublishOptions) (StreamPosition, error)
- Broker.PublishJoin: changed from func(string, *ClientInfo, *ChannelOptions) error to func(string, *ClientInfo) error
- Broker.PublishLeave: changed from func(string, *ClientInfo, *ChannelOptions) error to func(string, *ClientInfo) error
- Broker.RemoveHistory: added
- HistoryManager.AddHistory, method set of Engine: removed
- HistoryManager: removed
- MemoryEngine: old is comparable, new is not
- PublishOptions.SkipHistory: removed
- RedisEngineConfig.PublishOnHistoryAdd: removed
Compatible changes:
- PublishOptions.HistorySize: added
- PublishOptions.HistoryTTL: added
- WithHistory: added

v0.12.0 is a valid semantic version for this release.
```

v0.11.2
=======

* Fix non-working websocket close with custom disconnect code: this is a regression introduced by v0.11.0.

v0.11.1
=======

* Added `MetricsNamespace` field of `Config` to configure Prometheus metrics namespace used by Centrifuge library internal metrics
* Fix `messages_sent_counter` – it now correctly counts Control, Join and Leave messages
* Redis cluster integration now tested in CI

```
$ gorelease -base v0.11.0 -version v0.11.1
github.com/centrifugal/centrifuge
---------------------------------
Compatible changes:
- Config.MetricsNamespace: added

v0.11.1 is a valid semantic version for this release.
```

v0.11.0
=======

* Refactor client channels API – see detailed changes below, [#146](https://github.com/centrifugal/centrifuge/pull/146)
* Fix atomic alignment in struct for 32-bit builds, [commit](https://github.com/centrifugal/centrifuge/commit/cafa94fbf4173ae46d1f5329a33adec97d0620c8)
* Field `Code` of `Disconnect` has `uint32` type now instead of `int`, [commit](https://github.com/centrifugal/centrifuge/commit/d86cea2c8b309e6d2ce1f1fa8ba6fcc7d06f7320)
* Refactor WebSocket graceful close – do not use a new goroutine for every read, [#144](https://github.com/centrifugal/centrifuge/pull/144)
* Support client name and version fields of `Connect` command which will be available in `ConnectEvent` struct (if set on client side), [#145](https://github.com/centrifugal/centrifuge/pull/145)

```
$ gorelease -base v0.10.1 -version v0.11.0
github.com/centrifugal/centrifuge
---------------------------------
Incompatible changes:
- (*Client).Channels: changed from func() map[string]ChannelContext to func() []string
- ChannelContext: removed
- Disconnect.Code: changed from int to uint32
Compatible changes:
- (*Client).IsSubscribed: added
- ConnectEvent.Name: added
- ConnectEvent.Version: added
- ErrorTooManyRequests: added

v0.11.0 is a valid semantic version for this release.
```

v0.10.1
=======

* Fix Redis Engine errors when epoch is missing inside stream/list meta hash. See [commit](https://github.com/centrifugal/centrifuge/commit/f5375855e3df8e1679e11775455597cc91b8e0e5)

v0.10.0
=======

This release is a massive rewrite of Centrifuge library (actually of some part of it) which should make library a more generic solution. Several opinionated and restrictive parts removed to make Centrifuge feel as a reasonably thin wrapper on top of strict client-server protocol.

Most work done inside [#129](https://github.com/centrifugal/centrifuge/pull/129) pr and relates to [#128](https://github.com/centrifugal/centrifuge/issues/128) issue.

Release highlights:

* Layer with namespace configuration and channel rules removed. Now developer is responsible for all permission checks and channel rules.
* Hard dependency on JWT and predefined claims removed. Users are now free to use any token implementation – like [Paceto](https://github.com/paragonie/paseto) tokens for example, use any custom claims etc.
* Event handlers that not set now always lead to `Not available` error returned to client.
* All event handlers now should be set to `Node` before calling its `Run` method.
* Centrifuge still needs to know some core options for channels to understand whether to use presence inside channels, keep Publication history stream or not. It's now done over user-defined callback function in Node Config called `ChannelOptionsFunc`. See its detailed description in [library docs](https://godoc.org/github.com/centrifugal/centrifuge#ChannelOptionsFunc).
* More idiomatic error handling in event handlers, see [#134](https://github.com/centrifugal/centrifuge/pull/134).
* Aliases to `Raw`, `Publication` and `ClientInfo` Protobuf types removed from library public API, see [#136](https://github.com/centrifugal/centrifuge/issues/136)
* Support Redis Sentinel password option

Look at updated [example in README](https://github.com/centrifugal/centrifuge#quick-example) and [examples](https://github.com/centrifugal/centrifuge/tree/master/_examples) folder to find out more. 

I hope to provide more guidance about library concepts in the future. I feel sorry for breaking things here but since we don't have v1 release yet, I believe this is acceptable. An important note is that while this release has lots of removed parts it's still possible (and not too hard) to implement the same functionality as before on top of this library. Feel free to ask any questions in our community chats.

v0.9.1
======

* fix `Close` method – do not use error channel since this leads to deadlock anyway, just close in goroutine.
* fix presence timer scheduling

```
gorelease -base=v0.9.0 -version=v0.9.1
github.com/centrifugal/centrifuge
---------------------------------
Incompatible changes:
- (*Client).Close: changed from func(*Disconnect) chan error to func(*Disconnect) error

v0.9.1 is a valid semantic version for this release.
```

v0.9.0
======

This release has some API changes. Here is a list of all changes in release:

```
Incompatible changes:
- (*Client).Close: changed from func(*Disconnect) error to func(*Disconnect) chan error
- (*Client).Handle: removed
- Config.ClientPresencePingInterval: removed
- NewClient: changed from func(context.Context, *Node, Transport) (*Client, error) to func(context.Context, *Node, Transport) (*TransportClient, CloseFunc, error)
- NodeEventHub.ClientRefresh: removed
- RefreshHandler: changed from func(context.Context, *Client, RefreshEvent) RefreshReply to func(RefreshEvent) RefreshReply
Compatible changes:
- (*ClientEventHub).Presence: added
- (*ClientEventHub).Refresh: added
- CloseFunc: added
- Config.ClientPresenceUpdateInterval: added
- ConnectReply.ClientSideRefresh: added
- PresenceEvent: added
- PresenceHandler: added
- PresenceReply: added
- RefreshEvent.Token: added
- RefreshReply.Disconnect: added
- TransportClient: added
```

Now let's try to highlight most notable changes and reasoning behind:

* `NewClient` returns `TransportClient` and `CloseFunc` to limit possible API on transport implementation level
* `ClientPresencePingInterval` config option renamed to `ClientPresenceUpdateInterval`
* Centrifuge now has `client.On().Presence` handler which will be called periodically while connection alive every `ClientPresenceUpdateInterval`
* `Client.Close` method now creates a goroutine internally - this was required to prevent deadlock when closing client from Presence and SubRefresh callback handlers. 
* Refresh handler moved to `Client` scope instead of being `Node` event handler
* `ConnectReply` now has new `ClientSideRefresh` field which allows setting what kind of refresh mechanism should be used for a client: server-side refresh or client-side refresh.
* It's now possible to do client-side refresh with custom token implementation ([example](https://github.com/centrifugal/centrifuge/tree/master/_examples/custom_token))
* Library now uses one concurrent timer per each connection instead of 3 - should perform a bit better

All examples updated to reflect all changes here. 

v0.8.2
======

* Fix Disconnect Code field unmarshalling, introduce helper method `Disconnect.CloseText()` to build close text sent to client in Close Frame. 
* Fix server-side Join event wrong channel when server subscribed client to several channels with JoinLeave feature on

v0.8.1
======

* Fix closing connections with `insufficient state` after publish when history recovery feature is on and `PublishOnHistoryAdd` is `false` in Redis Engine config. [#119](https://github.com/centrifugal/centrifuge/issues/119).

v0.8.0
======

This release is huge. In general, it does not change any previously defined semantics but changes API. The [list of changes is big enough](https://gist.github.com/FZambia/f59ce1c82ceb23286ccf427623a45e37) but fixes you need to do for this version adoption are mostly minimal. Except one thing emphasized below.

**So here is that thing.** Centrifuge now uses new `offset` `uint64` protocol field for Publication position inside history stream instead of previously used `seq` and `gen` (both `uint32`) fields. It replaces both `seq` and `gen`. This change required to simplify working with history API in perspective. This is a breaking change for library users in case of using history recovery feature – read migration steps below.

Our client libraries `centrifuge-js` and `centrifuge-go` were updated to use `offset` field. So if you are using these two libraries and utilizing recovery feature then you need to update `centrifuge-js` to at least `2.6.0`, and `centrifuge-go` to at least `0.5.0` to match server protocol (see the possibility to be backwards compatible on server below). All other client libraries do not support recovery at this moment so should not be affected by field changes described here.

It's important to mention that to provide backwards compatibility on client side both `centrifuge-js` and `centrifuge-go` will continue to properly work with a server which is using old `seq` and `gen` fields for recovery in its current form until v1 version of this library. It's possible to explicitly enable using old `seq` and `gen` fields on server side by calling:

```
centrifuge.CompatibilityFlags |= centrifuge.UseSeqGen
```

This allows doing migration to v0.8.0 and keeping everything compatible. Those `CompatibilityFlags` **will be supported until v1 library release**. Then we will only have one way to do things.

Other release highlights:

* support [Redis Streams](https://redis.io/topics/streams-intro) - radically reduces amount of allocations during recovery in large history streams, also provides a possibility to paginate over history stream (an API for pagination over stream added to `Node` - see `History` method)
* support [Redis Cluster](https://redis.io/topics/cluster-tutorial), client-side sharding between different Redis Clusters also works
* use [alternative library](https://github.com/cristalhq/jwt) for JWT parsing and verification - HMAC-based JWT parsing is about 2 times faster now. Related issues: [#109](https://github.com/centrifugal/centrifuge/pull/109) and [#107](https://github.com/centrifugal/centrifuge/pull/107).
* new data structure for in-memory streams (linked list + hash table) for faster insertion and recovery in large streams, also it's now possible to expire a stream meta information in case of Memory engine
* fix server side subscriptions to private channels (were ignored before)
* fix `channels` counter update frequency ([commit](https://github.com/centrifugal/centrifuge/commit/23a87fd538e44894f220146ced47a7e946bcf60d))
* drop Dep support - library now uses Go mod only for dependency management
* slightly improved test coverage
* lots of internal refactoring and style fixes

Thanks to [@Skarm](https://github.com/Skarm), [@cristaloleg](https://github.com/cristaloleg) and [@GSokol](https://github.com/GSokol) for contributions.

v0.7.0
======

* Refactor automatic subscribing to personal channel option. Option that enables feature renamed from `UserSubscribePersonal` to `UserSubscribeToPersonal`, also instead of `UserPersonalChannelPrefix` users can set `UserPersonalChannelNamespace` option, the general advice here is to create separate namespace for automatic personal channels if one requires custom channel options
* `WebsocketUseWriteBufferPool` option for SockJS handler

v0.6.0
======

* Simplify server-side subscription API replacing `[]centrifuge.Subscription` with just `[]string` - i.e. a slice of channels we want to subscribe connection to. For now it seems much more simple to just use a slice of strings and this must be sufficient for most use cases. It is also a bit more efficient for JWT use case in terms of its payload size. More complex logic can be introduced later over separate field of `ConnectReply` or `connectToken` if needed
* Support server-side subscriptions via JWT using `channels` claim field

v0.5.0
======

This release introduces server-side subscription support - see [#89](https://github.com/centrifugal/centrifuge/pull/89) for details. Release highlights:

* New field `Subscriptions` for `ConnectReply` to provide server side subscriptions
* New `Client.Subscribe` method
* New node configuration options: `UserSubscribePersonal` and `UserPersonalChannelPrefix`
* New `ServerSide` boolean namespace option
* Method `Client.Unsubscribe` now accepts one main argument (`channel`) and `UnsubscribeOptions`
* New option `UseWriteBufferPool` for WebSocket handler config
* Internal refactor of JWT related code, many thanks to [@Nesty92](https://github.com/Nesty92)
* Introduce subscription dissolver - node now reliably unsubscribes from PUB/SUB channels, see details in [#77](https://github.com/centrifugal/centrifuge/issues/77)

v0.4.0
======

* `Secret` config option renamed to `TokenHMACSecretKey`, that was reasonable due to recent addition of RSA-based tokens so we now have `TokenRSAPublicKey` option
