// Package centrifuge is a real-time messaging library that abstracts
// several bidirectional transports (Websocket, SockJS) and provides
// primitives to build real-time applications with Go. It's also used as
// core of Centrifugo server (https://github.com/centrifugal/centrifugo).
//
// The API of this library is almost all goroutine-safe except cases where
// one-time operations like setting callback handlers performed. Library
// expects that code inside callbacks will not block.
//
// Centrifuge library provides several features on top of plain Websocket
// implementation - read highlights in library README on Github –
// https://github.com/centrifugal/centrifuge.
//
// Also check out examples in repo to see main library concepts in action.
package centrifuge
