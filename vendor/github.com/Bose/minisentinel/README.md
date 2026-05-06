# Minisentinel

Pure Go Redis Sentinel server

##

Sometimes you want to test code which uses Redis with Sentinel, without making it a full-blown
integration test.  Minisentinel implements (parts of) the Sentinel protocol to be used in unittests.  Used together with [Miniredis](https://github.com/alicebob/miniredis), they enable a simple, cheap, in-memory, Redis with Sentinel replacement, with a real TCP interface. Think of it as the Sentinel+Redis version of `net/http/httptest`.

It saves you from using mock code, and since both the sentinel and redis servers live within the
test process you can query for values directly, without going through the server
stack.

There are no dependencies on external binaries, so you can easily integrate it in automated build processes.


## Sentinel Commands

Implemented commands:

- Connection 
    - AUTH -- see RequireAuth()
    - PING 
- Sentinel
    - MASTERS
    - GET-MASTER-ADDR-BY-NAME
    - SLAVES

## Redis Commands

See the Miniredis documentation: https://github.com/alicebob/miniredis/blob/master/README.md

## Example

```go

package minisentinel

import (
	"errors"
	"testing"
	"time"

	"github.com/FZambia/sentinel"
	"github.com/alicebob/miniredis"
	"github.com/gomodule/redigo/redis"
	"github.com/matryer/is"
)

// TestSomething - shows how-to start up sentinel + redis in your unittest
func TestSomething(t *testing.T) {
	is := is.New(t)
	m := miniredis.NewMiniRedis()
	err := m.StartAddr(":6379")
	is.NoErr(err)
	defer m.Close()
	s := NewSentinel(m, WithReplica(m))
	err = s.StartAddr(":26379")
	is.NoErr(err)
	defer s.Close()
	// all the setup is done.. now just use sentinel/redis like you
	// would normally in your tests via a redis client
}

// TestRedisWithSentinel - an example of combining miniRedis with miniSentinel for unittests
func TestRedisWithSentinel(t *testing.T) {
	is := is.New(t)
	m, err := miniredis.Run()
	m.RequireAuth("super-secret") // not required, but demonstrates how-to
	is.NoErr(err)
	defer m.Close()
	s := NewSentinel(m, WithReplica(m))
	s.Start()
	defer s.Close()

	// use redigo to create a sentinel pool
	sntnl := &sentinel.Sentinel{
		Addrs:      []string{s.Addr()},
		MasterName: s.MasterInfo().Name,
		Dial: func(addr string) (redis.Conn, error) {
			connTimeout := time.Duration(50 * time.Millisecond)
			readWriteTimeout := time.Duration(50 * time.Millisecond)
			c, err := redis.DialTimeout("tcp", addr, connTimeout, readWriteTimeout, readWriteTimeout)
			if err != nil {
				return nil, err
			}
			return c, nil
		},
	}
	redisPassword := []byte("super-secret") // required because of m.RequireAuth()
	pool := redis.Pool{
		MaxIdle:     3,
		MaxActive:   64,
		Wait:        true,
		IdleTimeout: 240 * time.Second,
		Dial: func() (redis.Conn, error) {
			redisHostAddr, errHostAddr := sntnl.MasterAddr()
			if errHostAddr != nil {
				return nil, errHostAddr
			}
				c, err := redis.Dial("tcp", redisHostAddr)
			if err != nil {
				return nil, err
			}
			if redisPassword != nil { // auth first, before doing anything else
				if _, err := c.Do("AUTH", string(redisPassword)); err != nil {
					c.Close()
					return nil, err
				}
			}
			return c, nil
		},
		TestOnBorrow: func(c redis.Conn, t time.Time) error {
			if time.Since(t) < time.Minute {
				return nil
			}
			if !sentinel.TestRole(c, "master") {
				return errors.New("Role check failed")
			}
			return nil
		},
	}

	// Optionally set some keys your code expects:
	m.Set("foo", "not-bar")
	m.HSet("some", "other", "key")

	// Run your code and see if it behaves.
	// An example using the redigo library from "github.com/gomodule/redigo/redis":
	c := pool.Get()
	defer c.Close() //release connection back to the pool
	// use the pool connection to do things via TCP to our miniRedis
	_, err = c.Do("SET", "foo", "bar")

	// Optionally check values in redis...
	got, err := m.Get("foo")
	is.NoErr(err)
	is.Equal(got, "bar")

	// ... or use a miniRedis helper for that:
	m.CheckGet(t, "foo", "bar")

	// TTL and expiration:
	m.Set("foo", "bar")
	m.SetTTL("foo", 10*time.Second)
	m.FastForward(11 * time.Second)
	is.True(m.Exists("foo") == false) // it shouldn't be there anymore
}
```
