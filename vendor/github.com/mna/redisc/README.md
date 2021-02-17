# redisc [![GoDoc](https://godoc.org/github.com/mna/redisc?status.png)][godoc] [![Build Status](https://semaphoreci.com/api/v1/mna/redisc/branches/master/badge.svg)](https://semaphoreci.com/mna/redisc)

Package redisc implements a redis cluster client built on top of the [redigo package][redigo]. See the [godoc][] for details.

## Installation

    $ go get [-u] [-t] github.com/mna/redisc

## Releases

* **v1.1.7** : Do not bind to a random node if `Do` is called without a command and the connection is not already bound (thanks to [@tysonmote][tysonmote]).

* **v1.1.6** : Append the actual error messages when a refresh returns "all nodes failed" error.

* **v1.1.5** : Add `Cluster.PoolWaitTime` to configure the time to wait on a connection from a pool with `MaxActive` > 0 and `Wait` set to true (thanks to [@iwanbk][iwanbk]).

* **v1.1.4** : Add `Conn.DoWithTimeout` and `Conn.ReceiveWithTimeout` to match redigo's `ConnWithTimeout` interface (thanks to [@letsfire][letsfire]).

* **v1.1.3** : Fix handling of `ASK` replies in `RetryConn`.

* **v1.1.2** : Remove mention that `StartupNodes` in `Cluster` struct needs to be master nodes (it can be replicas). Add supporting test.

* **v1.1.1** : Fix CI tests.

* **v1.1.0** : This release builds with the `github.com/gomodule/redigo` package (the new import path of `redigo`, which also has a breaking change in its `v2.0.0`, the `PMessage` type has been removed and consolidated into `Message`).

* **v1.0.0** : This release builds with the `github.com/garyburd/redigo` package, which - according to its [readme][oldredigo] - will not be maintained anymore, having moved to [`github.com/gomodule/redigo`][redigo] for future development. As such, `redisc` will not be updated with the old redigo package, this version was created only to avoid causing issues to users of redisc.

## Documentation

The [godoc][] is the canonical source for documentation.

The design goal of redisc is to be as compatible as possible with the [redigo][] package. As such, the `Cluster` type can be used as a drop-in replacement to a `redis.Pool`, and the connections returned by the cluster implement the `redis.Conn` interface. The package offers additional features specific to dealing with a cluster that may be needed for more advanced scenarios.

The main features are:

* Drop-in replacement for `redis.Pool` (the `Cluster` type implements the same `Get` and `Close` method signatures).
* Connections are `redis.Conn` interfaces and use the `redigo` package to execute commands, `redisc` only handles the cluster part.
* Support for all cluster-supported commands including scripting, transactions and pub-sub.
* Support for READONLY/READWRITE commands to allow reading data from replicas.
* Client-side smart routing, automatically keeps track of which node holds which key slots.
* Automatic retry of MOVED, ASK and TRYAGAIN errors when desired, via `RetryConn`.
* Manual handling of redirections and retries when desired, via `IsTryAgain` and `ParseRedir`.
* Automatic detection of the node to call based on the command's first parameter (assumed to be the key).
* Explicit selection of the node to call via `BindConn` when needed.
* Support for optimal batch calls via `SplitBySlot`.

## Alternatives

* [redis-go-cluster][rgc].
* [radix v1][radix1] provides a cluster package.
* [radix v2][radix2] provides a cluster package.

## Support

There are a number of ways you can support the project:

* Use it, star it, build something with it, spread the word!
* Raise issues to improve the project (note: doc typos and clarifications are issues too!)
  - Please search existing issues before opening a new one - it may have already been adressed.
* Pull requests: please discuss new code in an issue first, unless the fix is really trivial.
  - Make sure new code is tested.
  - Be mindful of existing code - PRs that break existing code have a high probability of being declined, unless it fixes a serious issue.

If you desperately want to send money my way, I have a BuyMeACoffee.com page:

<a href="https://www.buymeacoffee.com/mna" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

## License

The [BSD 3-Clause license][bsd].

[bsd]: http://opensource.org/licenses/BSD-3-Clause
[godoc]: http://godoc.org/github.com/mna/redisc
[redigo]: https://github.com/gomodule/redigo
[oldredigo]: https://github.com/garyburd/redigo
[rgc]: https://github.com/chasex/redis-go-cluster
[radix1]: https://github.com/fzzy/radix
[radix2]: https://github.com/mediocregopher/radix.v2
[letsfire]: https://github.com/letsfire
[iwanbk]: https://github.com/iwanbk
[tysonmote]: https://github.com/tysonmote
