// Package redisc implements a redis cluster client on top of
// the redigo client package. It supports all commands that can
// be executed on a redis cluster, including pub-sub, scripts and
// read-only connections to read data from replicas.
// See http://redis.io/topics/cluster-spec for details.
//
// Design
//
// The package defines two main types: Cluster and Conn. Both
// are described in more details below, but the Cluster manages
// the mapping of keys (or more exactly, hash slots computed from
// keys) to a group of nodes that form a redis cluster, and a
// Conn manages a connection to this cluster.
//
// The package is designed such that for simple uses, or when
// keys have been carefully named to play well with a redis
// cluster, a Cluster value can be used as a drop-in replacement
// for a redis.Pool from the redigo package.
//
// Similarly, the Conn type implements redigo's redis.Conn
// interface (and the augmented redis.ConnWithTimeout one too),
// so the API to execute commands is the same -
// in fact the redisc package uses the redigo package as its
// only third-party dependency.
//
// When more control is needed, the package offers some
// extra behaviour specific to working with a redis cluster:
//
//     - Slot and SplitBySlot functions to compute the slot for
//     a given key and to split a list of keys into groups of
//     keys from the same slot, so that each group can safely be
//     handled using the same connection.
//
//     - *Conn.Bind (or the BindConn package-level helper function)
//     to explicitly specify the keys that will be used with the
//     connection so that the right node is selected, instead of
//     relying on the automatic detection based on the first
//     parameter of the command.
//
//     - *Conn.ReadOnly (or the ReadOnlyConn package-level helper
//     function) to mark a connection as read-only, allowing
//     commands to be served by a replica instead of the master.
//
//     - RetryConn to wrap a connection into one that automatically
//     follows redirections when the cluster moves slots around.
//
//     - Helper functions to deal with cluster-specific errors.
//
// Cluster
//
// The Cluster type manages a redis cluster and offers an
// interface compatible with redigo's redis.Pool:
//
//     Get() redis.Conn
//     Close() error
//
// Along with some additional methods specific to a cluster:
//
//     Dial() (redis.Conn, error)
//     Refresh() error
//
// If the CreatePool function field is set, then a
// redis.Pool is created to manage connections to each of the
// cluster's nodes. A call to Get returns a connection
// from that pool.
//
// The Dial method, on the other hand, guarantees that
// the returned connection will not be managed by a pool, even if
// CreatePool is set. It calls redigo's redis.Dial function
// to create the unpooled connection, passing along any DialOptions
// set on the cluster. If the cluster's CreatePool field is nil,
// Get behaves the same as Dial.
//
// The Refresh method refreshes the cluster's internal mapping of
// hash slots to nodes. It should typically be called only once,
// after the cluster is created and before it is used, so that
// the first connections already benefit from smart routing.
// It is automatically kept up-to-date based on the redis MOVED
// responses afterwards.
//
// A cluster must be closed once it is no longer used to release
// its resources.
//
// Connection
//
// The connection returned from Get or Dial is a redigo redis.Conn
// interface (that also implements redis.ConnWithTimeout),
// with a concrete type of *Conn. In addition to the
// interface's required methods, *Conn adds the following methods:
//
//     Bind(...string) error
//     ReadOnly() error
//
// The returned connection is not yet connected to any node; it is
// "bound" to a specific node only when a call to Do, Send, Receive
// or Bind is made. For Do, Send and Receive, the node selection is
// implicit, it uses the first parameter of the command, and
// computes the hash slot assuming that first parameter is a key.
// It then binds the connection to the node corresponding to that
// slot. If there are no parameters for the command, or if there is
// no command (e.g. in a call to Receive), a random node is selected.
//
// Bind is explicit, it gives control to the caller over
// which node to select by specifying a list of keys that the caller
// wishes to handle with the connection. All keys must belong to the
// same slot, and the connection must not already be bound to a node,
// otherwise an error is returned. On success, the connection is
// bound to the node holding the slot of the specified key(s).
//
// Because the connection is returned as a redis.Conn interface, a
// type assertion must be used to access the underlying *Conn and
// to be able to call Bind:
//
//     redisConn := cluster.Get()
//     if conn, ok := redisConn.(*redisc.Conn); ok {
//       if err := conn.Bind("my-key"); err != nil {
//         // handle error
//       }
//     }
//
// The BindConn package-level function is provided as a helper for
// this common use-case.
//
// The ReadOnly method marks the connection as read-only, meaning that
// it will attempt to connect to a replica instead of the master node
// for its slot. Once bound to a node, the READONLY redis command is
// sent automatically, so it doesn't have to be sent explicitly before
// use. ReadOnly must be called before the connection is bound to a
// node, otherwise an error is returned.
//
// For the same reason as for Bind, a type assertion must be used to
// call ReadOnly on a *Conn, so a package-level helper function is
// also provided, ReadOnlyConn.
//
// There is no ReadWrite method, because it can be sent as a normal
// redis command and will essentially end that connection (all commands
// will now return MOVED errors). If the connection was wrapped in
// a RetryConn call, then it will automatically follow the redirection
// to the master node (see the Redirections section).
//
// The connection must be closed after use, to release the underlying
// resources.
//
// Redirections
//
// The redis cluster may return MOVED and ASK errors when the node
// that received the command doesn't currently hold the slot corresponding
// to the key. The package cannot reliably handle those redirections
// automatically because the redirection error may be returned for
// a pipeline of commands, some of which may have succeeded.
//
// However, a connection can be wrapped by a call to RetryConn, which
// returns a redis.Conn interface where only calls to Do, Close and Err
// can succeed. That means pipelining is not supported, and only a single
// command can be executed at a time, but it will automatically handle
// MOVED and ASK replies, as well as TRYAGAIN errors.
//
// Note that even if RetryConn is not used, the cluster always updates
// its mapping of slots to nodes automatically by keeping track of
// MOVED replies.
//
// Concurrency
//
// The concurrency model is similar to that of the redigo package:
//
//     - Cluster methods are safe to call concurrently (like redis.Pool).
//
//     - Connections do not support concurrent calls to write methods
//       (Send, Flush) or concurrent calls to the read method (Receive).
//
//     - Connections do allow a concurrent reader and writer.
//
//     - Because the Do method combines the functionality of Send, Flush
//       and Receive, it cannot be called concurrently with other methods.
//
//     - The Bind and ReadOnly methods are safe to call concurrently, but
//       there is not much point in doing so for as both will fail if
//       the connection is already bound.
//
package redisc
