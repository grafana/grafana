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
