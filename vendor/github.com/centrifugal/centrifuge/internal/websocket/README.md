Fork of Gorilla Websocket adapted for Centrifuge needs. All copyrights were left – huge respect to the original authors.

What was changed:

* no custom Proxy in Client
* no concurrent use best-effort detection
* selected subprotocol is not kept internally, returned during Upgrade or Dial
* lint fixes
* no possibility to set custom CloseHandler
* upgrade optimizations (9 -> 3 allocations, see BenchmarkUpgrade)
