package redis_test

import (
	"bytes"
	"fmt"
	"io"
	"net"
	"sort"
	"strconv"
	"sync"
	"testing"
	"time"

	"gopkg.in/redis.v2"

	. "gopkg.in/check.v1"
)

const redisAddr = ":6379"

//------------------------------------------------------------------------------

func sortStrings(slice []string) []string {
	sort.Strings(slice)
	return slice
}

//------------------------------------------------------------------------------

type RedisConnectorTest struct{}

var _ = Suite(&RedisConnectorTest{})

func (t *RedisConnectorTest) TestShutdown(c *C) {
	c.Skip("shutdowns server")

	client := redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
	})

	shutdown := client.Shutdown()
	c.Check(shutdown.Err(), Equals, io.EOF)
	c.Check(shutdown.Val(), Equals, "")

	ping := client.Ping()
	c.Check(ping.Err(), ErrorMatches, "dial tcp <nil>:[0-9]+: connection refused")
	c.Check(ping.Val(), Equals, "")
}

func (t *RedisConnectorTest) TestNewTCPClient(c *C) {
	client := redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
	})
	ping := client.Ping()
	c.Check(ping.Err(), IsNil)
	c.Check(ping.Val(), Equals, "PONG")
	c.Assert(client.Close(), IsNil)
}

func (t *RedisConnectorTest) TestNewUnixClient(c *C) {
	c.Skip("not available on Travis CI")

	client := redis.NewUnixClient(&redis.Options{
		Addr: "/tmp/redis.sock",
	})
	ping := client.Ping()
	c.Check(ping.Err(), IsNil)
	c.Check(ping.Val(), Equals, "PONG")
	c.Assert(client.Close(), IsNil)
}

func (t *RedisConnectorTest) TestDialer(c *C) {
	client := redis.NewClient(&redis.Options{
		Dialer: func() (net.Conn, error) {
			return net.Dial("tcp", redisAddr)
		},
	})
	ping := client.Ping()
	c.Check(ping.Err(), IsNil)
	c.Check(ping.Val(), Equals, "PONG")
	c.Assert(client.Close(), IsNil)
}

func (t *RedisConnectorTest) TestClose(c *C) {
	client := redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
	})
	c.Assert(client.Close(), IsNil)

	ping := client.Ping()
	c.Assert(ping.Err(), Not(IsNil))
	c.Assert(ping.Err().Error(), Equals, "redis: client is closed")

	c.Assert(client.Close(), IsNil)
}

func (t *RedisConnectorTest) TestPubSubClose(c *C) {
	client := redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
	})

	pubsub := client.PubSub()
	c.Assert(pubsub.Close(), IsNil)

	_, err := pubsub.Receive()
	c.Assert(err, Not(IsNil))
	c.Assert(err.Error(), Equals, "redis: client is closed")

	ping := client.Ping()
	c.Assert(ping.Err(), IsNil)

	c.Assert(client.Close(), IsNil)
}

func (t *RedisConnectorTest) TestMultiClose(c *C) {
	client := redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
	})

	multi := client.Multi()
	c.Assert(multi.Close(), IsNil)

	_, err := multi.Exec(func() error {
		multi.Ping()
		return nil
	})
	c.Assert(err, Not(IsNil))
	c.Assert(err.Error(), Equals, "redis: client is closed")

	ping := client.Ping()
	c.Assert(ping.Err(), IsNil)

	c.Assert(client.Close(), IsNil)
}

func (t *RedisConnectorTest) TestPipelineClose(c *C) {
	client := redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
	})

	_, err := client.Pipelined(func(pipeline *redis.Pipeline) error {
		c.Assert(pipeline.Close(), IsNil)
		pipeline.Ping()
		return nil
	})
	c.Assert(err, Not(IsNil))
	c.Assert(err.Error(), Equals, "redis: client is closed")

	ping := client.Ping()
	c.Assert(ping.Err(), IsNil)

	c.Assert(client.Close(), IsNil)
}

func (t *RedisConnectorTest) TestIdleTimeout(c *C) {
	client := redis.NewTCPClient(&redis.Options{
		Addr:        redisAddr,
		IdleTimeout: time.Nanosecond,
	})
	for i := 0; i < 10; i++ {
		c.Assert(client.Ping().Err(), IsNil)
	}
}

func (t *RedisConnectorTest) TestSelectDb(c *C) {
	client1 := redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
		DB:   1,
	})
	c.Assert(client1.Set("key", "db1").Err(), IsNil)

	client2 := redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
		DB:   2,
	})
	c.Assert(client2.Get("key").Err(), Equals, redis.Nil)
}

//------------------------------------------------------------------------------

type RedisConnPoolTest struct {
	client *redis.Client
}

var _ = Suite(&RedisConnPoolTest{})

func (t *RedisConnPoolTest) SetUpTest(c *C) {
	t.client = redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
	})
}

func (t *RedisConnPoolTest) TearDownTest(c *C) {
	c.Assert(t.client.FlushDb().Err(), IsNil)
	c.Assert(t.client.Close(), IsNil)
}

func (t *RedisConnPoolTest) TestConnPoolMaxSize(c *C) {
	wg := &sync.WaitGroup{}
	for i := 0; i < 1000; i++ {
		wg.Add(1)
		go func() {
			ping := t.client.Ping()
			c.Assert(ping.Err(), IsNil)
			c.Assert(ping.Val(), Equals, "PONG")
			wg.Done()
		}()
	}
	wg.Wait()

	c.Assert(t.client.Pool().Size(), Equals, 10)
	c.Assert(t.client.Pool().Len(), Equals, 10)
}

func (t *RedisConnPoolTest) TestConnPoolMaxSizeOnPipelineClient(c *C) {
	const N = 1000

	wg := &sync.WaitGroup{}
	wg.Add(N)
	for i := 0; i < N; i++ {
		go func() {
			pipeline := t.client.Pipeline()
			ping := pipeline.Ping()
			cmds, err := pipeline.Exec()
			c.Assert(err, IsNil)
			c.Assert(cmds, HasLen, 1)
			c.Assert(ping.Err(), IsNil)
			c.Assert(ping.Val(), Equals, "PONG")

			c.Assert(pipeline.Close(), IsNil)

			wg.Done()
		}()
	}
	wg.Wait()

	c.Assert(t.client.Pool().Size(), Equals, 10)
	c.Assert(t.client.Pool().Len(), Equals, 10)
}

func (t *RedisConnPoolTest) TestConnPoolMaxSizeOnMultiClient(c *C) {
	const N = 1000

	wg := &sync.WaitGroup{}
	wg.Add(N)
	for i := 0; i < N; i++ {
		go func() {
			multi := t.client.Multi()
			var ping *redis.StatusCmd
			cmds, err := multi.Exec(func() error {
				ping = multi.Ping()
				return nil
			})
			c.Assert(err, IsNil)
			c.Assert(cmds, HasLen, 1)
			c.Assert(ping.Err(), IsNil)
			c.Assert(ping.Val(), Equals, "PONG")

			c.Assert(multi.Close(), IsNil)

			wg.Done()
		}()
	}
	wg.Wait()

	c.Assert(t.client.Pool().Size(), Equals, 10)
	c.Assert(t.client.Pool().Len(), Equals, 10)
}

func (t *RedisConnPoolTest) TestConnPoolMaxSizeOnPubSub(c *C) {
	const N = 10

	wg := &sync.WaitGroup{}
	wg.Add(N)
	for i := 0; i < N; i++ {
		go func() {
			defer wg.Done()
			pubsub := t.client.PubSub()
			c.Assert(pubsub.Subscribe(), IsNil)
			c.Assert(pubsub.Close(), IsNil)
		}()
	}
	wg.Wait()

	c.Assert(t.client.Pool().Size(), Equals, 0)
	c.Assert(t.client.Pool().Len(), Equals, 0)
}

func (t *RedisConnPoolTest) TestConnPoolRemovesBrokenConn(c *C) {
	cn, _, err := t.client.Pool().Get()
	c.Assert(err, IsNil)
	c.Assert(cn.Close(), IsNil)
	c.Assert(t.client.Pool().Put(cn), IsNil)

	ping := t.client.Ping()
	c.Assert(ping.Err().Error(), Equals, "use of closed network connection")
	c.Assert(ping.Val(), Equals, "")

	ping = t.client.Ping()
	c.Assert(ping.Err(), IsNil)
	c.Assert(ping.Val(), Equals, "PONG")

	c.Assert(t.client.Pool().Size(), Equals, 1)
	c.Assert(t.client.Pool().Len(), Equals, 1)
}

func (t *RedisConnPoolTest) TestConnPoolReusesConn(c *C) {
	for i := 0; i < 1000; i++ {
		ping := t.client.Ping()
		c.Assert(ping.Err(), IsNil)
		c.Assert(ping.Val(), Equals, "PONG")
	}

	c.Assert(t.client.Pool().Size(), Equals, 1)
	c.Assert(t.client.Pool().Len(), Equals, 1)
}

//------------------------------------------------------------------------------

type RedisTest struct {
	client *redis.Client
}

var _ = Suite(&RedisTest{})

func Test(t *testing.T) { TestingT(t) }

func (t *RedisTest) SetUpTest(c *C) {
	t.client = redis.NewTCPClient(&redis.Options{
		Addr: ":6379",
	})

	// This is much faster than Flushall.
	c.Assert(t.client.Select(1).Err(), IsNil)
	c.Assert(t.client.FlushDb().Err(), IsNil)
	c.Assert(t.client.Select(0).Err(), IsNil)
	c.Assert(t.client.FlushDb().Err(), IsNil)
}

func (t *RedisTest) TearDownTest(c *C) {
	c.Assert(t.client.Close(), IsNil)
}

//------------------------------------------------------------------------------

func (t *RedisTest) TestCmdStringMethod(c *C) {
	set := t.client.Set("foo", "bar")
	c.Assert(set.String(), Equals, "SET foo bar: OK")

	get := t.client.Get("foo")
	c.Assert(get.String(), Equals, "GET foo: bar")
}

func (t *RedisTest) TestCmdStringMethodError(c *C) {
	get2 := t.client.Get("key_does_not_exists")
	c.Assert(get2.String(), Equals, "GET key_does_not_exists: redis: nil")
}

func (t *RedisTest) TestRunWithouthCheckingErrVal(c *C) {
	set := t.client.Set("key", "hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	get := t.client.Get("key")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "hello")

	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")
}

func (t *RedisTest) TestGetSpecChars(c *C) {
	set := t.client.Set("key", "hello1\r\nhello2\r\n")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	get := t.client.Get("key")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "hello1\r\nhello2\r\n")
}

func (t *RedisTest) TestGetBigVal(c *C) {
	val := string(bytes.Repeat([]byte{'*'}, 1<<16))

	set := t.client.Set("key", val)
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	get := t.client.Get("key")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, val)
}

func (t *RedisTest) TestManyKeys(c *C) {
	var n = 100000

	for i := 0; i < n; i++ {
		t.client.Set("keys.key"+strconv.Itoa(i), "hello"+strconv.Itoa(i))
	}
	keys := t.client.Keys("keys.*")
	c.Assert(keys.Err(), IsNil)
	c.Assert(len(keys.Val()), Equals, n)
}

func (t *RedisTest) TestManyKeys2(c *C) {
	var n = 100000

	keys := []string{"non-existent-key"}
	for i := 0; i < n; i++ {
		key := "keys.key" + strconv.Itoa(i)
		t.client.Set(key, "hello"+strconv.Itoa(i))
		keys = append(keys, key)
	}
	keys = append(keys, "non-existent-key")

	mget := t.client.MGet(keys...)
	c.Assert(mget.Err(), IsNil)
	c.Assert(len(mget.Val()), Equals, n+2)
	vals := mget.Val()
	for i := 0; i < n; i++ {
		c.Assert(vals[i+1], Equals, "hello"+strconv.Itoa(i))
	}
	c.Assert(vals[0], Equals, nil)
	c.Assert(vals[n+1], Equals, nil)
}

func (t *RedisTest) TestStringCmdHelpers(c *C) {
	set := t.client.Set("key", "10")
	c.Assert(set.Err(), IsNil)

	n, err := t.client.Get("key").Int64()
	c.Assert(err, IsNil)
	c.Assert(n, Equals, int64(10))

	un, err := t.client.Get("key").Uint64()
	c.Assert(err, IsNil)
	c.Assert(un, Equals, uint64(10))

	f, err := t.client.Get("key").Float64()
	c.Assert(err, IsNil)
	c.Assert(f, Equals, float64(10))
}

//------------------------------------------------------------------------------

func (t *RedisTest) TestAuth(c *C) {
	auth := t.client.Auth("password")
	c.Assert(auth.Err(), ErrorMatches, "ERR Client sent AUTH, but no password is set")
	c.Assert(auth.Val(), Equals, "")
}

func (t *RedisTest) TestEcho(c *C) {
	echo := t.client.Echo("hello")
	c.Assert(echo.Err(), IsNil)
	c.Assert(echo.Val(), Equals, "hello")
}

func (t *RedisTest) TestPing(c *C) {
	ping := t.client.Ping()
	c.Assert(ping.Err(), IsNil)
	c.Assert(ping.Val(), Equals, "PONG")
}

func (t *RedisTest) TestSelect(c *C) {
	sel := t.client.Select(1)
	c.Assert(sel.Err(), IsNil)
	c.Assert(sel.Val(), Equals, "OK")
}

//------------------------------------------------------------------------------

func (t *RedisTest) TestCmdKeysDel(c *C) {
	set := t.client.Set("key1", "Hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")
	set = t.client.Set("key2", "World")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	del := t.client.Del("key1", "key2", "key3")
	c.Assert(del.Err(), IsNil)
	c.Assert(del.Val(), Equals, int64(2))
}

func (t *RedisTest) TestCmdKeysDump(c *C) {
	set := t.client.Set("key", "hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	dump := t.client.Dump("key")
	c.Assert(dump.Err(), IsNil)
	c.Assert(dump.Val(), Equals, "\x00\x05hello\x06\x00\xf5\x9f\xb7\xf6\x90a\x1c\x99")
}

func (t *RedisTest) TestCmdKeysExists(c *C) {
	set := t.client.Set("key1", "Hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	exists := t.client.Exists("key1")
	c.Assert(exists.Err(), IsNil)
	c.Assert(exists.Val(), Equals, true)

	exists = t.client.Exists("key2")
	c.Assert(exists.Err(), IsNil)
	c.Assert(exists.Val(), Equals, false)
}

func (t *RedisTest) TestCmdKeysExpire(c *C) {
	set := t.client.Set("key", "Hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	expire := t.client.Expire("key", 10*time.Second)
	c.Assert(expire.Err(), IsNil)
	c.Assert(expire.Val(), Equals, true)

	ttl := t.client.TTL("key")
	c.Assert(ttl.Err(), IsNil)
	c.Assert(ttl.Val(), Equals, 10*time.Second)

	set = t.client.Set("key", "Hello World")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	ttl = t.client.TTL("key")
	c.Assert(ttl.Err(), IsNil)
	c.Assert(ttl.Val() < 0, Equals, true)
}

func (t *RedisTest) TestCmdKeysExpireAt(c *C) {
	set := t.client.Set("key", "Hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	exists := t.client.Exists("key")
	c.Assert(exists.Err(), IsNil)
	c.Assert(exists.Val(), Equals, true)

	expireAt := t.client.ExpireAt("key", time.Now().Add(-time.Hour))
	c.Assert(expireAt.Err(), IsNil)
	c.Assert(expireAt.Val(), Equals, true)

	exists = t.client.Exists("key")
	c.Assert(exists.Err(), IsNil)
	c.Assert(exists.Val(), Equals, false)
}

func (t *RedisTest) TestCmdKeysKeys(c *C) {
	mset := t.client.MSet("one", "1", "two", "2", "three", "3", "four", "4")
	c.Assert(mset.Err(), IsNil)
	c.Assert(mset.Val(), Equals, "OK")

	keys := t.client.Keys("*o*")
	c.Assert(keys.Err(), IsNil)
	c.Assert(sortStrings(keys.Val()), DeepEquals, []string{"four", "one", "two"})

	keys = t.client.Keys("t??")
	c.Assert(keys.Err(), IsNil)
	c.Assert(keys.Val(), DeepEquals, []string{"two"})

	keys = t.client.Keys("*")
	c.Assert(keys.Err(), IsNil)
	c.Assert(
		sortStrings(keys.Val()),
		DeepEquals,
		[]string{"four", "one", "three", "two"},
	)
}

func (t *RedisTest) TestCmdKeysMigrate(c *C) {
	migrate := t.client.Migrate("localhost", "6380", "key", 0, 0)
	c.Assert(migrate.Err(), IsNil)
	c.Assert(migrate.Val(), Equals, "NOKEY")

	set := t.client.Set("key", "hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	migrate = t.client.Migrate("localhost", "6380", "key", 0, 0)
	c.Assert(migrate.Err(), ErrorMatches, "IOERR error or timeout writing to target instance")
	c.Assert(migrate.Val(), Equals, "")
}

func (t *RedisTest) TestCmdKeysMove(c *C) {
	move := t.client.Move("key", 1)
	c.Assert(move.Err(), IsNil)
	c.Assert(move.Val(), Equals, false)

	set := t.client.Set("key", "hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	move = t.client.Move("key", 1)
	c.Assert(move.Err(), IsNil)
	c.Assert(move.Val(), Equals, true)

	get := t.client.Get("key")
	c.Assert(get.Err(), Equals, redis.Nil)
	c.Assert(get.Val(), Equals, "")

	sel := t.client.Select(1)
	c.Assert(sel.Err(), IsNil)
	c.Assert(sel.Val(), Equals, "OK")

	get = t.client.Get("key")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "hello")
}

func (t *RedisTest) TestCmdKeysObject(c *C) {
	set := t.client.Set("key", "hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	refCount := t.client.ObjectRefCount("key")
	c.Assert(refCount.Err(), IsNil)
	c.Assert(refCount.Val(), Equals, int64(1))

	enc := t.client.ObjectEncoding("key")
	c.Assert(enc.Err(), IsNil)
	c.Assert(enc.Val(), Equals, "raw")

	idleTime := t.client.ObjectIdleTime("key")
	c.Assert(idleTime.Err(), IsNil)
	c.Assert(idleTime.Val(), Equals, time.Duration(0))
}

func (t *RedisTest) TestCmdKeysPersist(c *C) {
	set := t.client.Set("key", "Hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	expire := t.client.Expire("key", 10*time.Second)
	c.Assert(expire.Err(), IsNil)
	c.Assert(expire.Val(), Equals, true)

	ttl := t.client.TTL("key")
	c.Assert(ttl.Err(), IsNil)
	c.Assert(ttl.Val(), Equals, 10*time.Second)

	persist := t.client.Persist("key")
	c.Assert(persist.Err(), IsNil)
	c.Assert(persist.Val(), Equals, true)

	ttl = t.client.TTL("key")
	c.Assert(ttl.Err(), IsNil)
	c.Assert(ttl.Val() < 0, Equals, true)
}

func (t *RedisTest) TestCmdKeysPExpire(c *C) {
	set := t.client.Set("key", "Hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	expiration := 900 * time.Millisecond
	pexpire := t.client.PExpire("key", expiration)
	c.Assert(pexpire.Err(), IsNil)
	c.Assert(pexpire.Val(), Equals, true)

	ttl := t.client.TTL("key")
	c.Assert(ttl.Err(), IsNil)
	c.Assert(ttl.Val(), Equals, time.Second)

	pttl := t.client.PTTL("key")
	c.Assert(pttl.Err(), IsNil)
	c.Assert(pttl.Val() <= expiration, Equals, true)
	c.Assert(pttl.Val() >= expiration-time.Millisecond, Equals, true)
}

func (t *RedisTest) TestCmdKeysPExpireAt(c *C) {
	set := t.client.Set("key", "Hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	expiration := 900 * time.Millisecond
	pexpireat := t.client.PExpireAt("key", time.Now().Add(expiration))
	c.Assert(pexpireat.Err(), IsNil)
	c.Assert(pexpireat.Val(), Equals, true)

	ttl := t.client.TTL("key")
	c.Assert(ttl.Err(), IsNil)
	c.Assert(ttl.Val(), Equals, time.Second)

	pttl := t.client.PTTL("key")
	c.Assert(pttl.Err(), IsNil)
	c.Assert(pttl.Val() <= expiration, Equals, true)
	c.Assert(pttl.Val() >= expiration-time.Millisecond, Equals, true)
}

func (t *RedisTest) TestCmdKeysPTTL(c *C) {
	set := t.client.Set("key", "Hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	expiration := time.Second
	expire := t.client.Expire("key", expiration)
	c.Assert(expire.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	pttl := t.client.PTTL("key")
	c.Assert(pttl.Err(), IsNil)
	c.Assert(pttl.Val() <= expiration, Equals, true)
	c.Assert(pttl.Val() >= expiration-time.Millisecond, Equals, true)
}

func (t *RedisTest) TestCmdKeysRandomKey(c *C) {
	randomKey := t.client.RandomKey()
	c.Assert(randomKey.Err(), Equals, redis.Nil)
	c.Assert(randomKey.Val(), Equals, "")

	set := t.client.Set("key", "hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	randomKey = t.client.RandomKey()
	c.Assert(randomKey.Err(), IsNil)
	c.Assert(randomKey.Val(), Equals, "key")
}

func (t *RedisTest) TestCmdKeysRename(c *C) {
	set := t.client.Set("key", "hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	status := t.client.Rename("key", "key1")
	c.Assert(status.Err(), IsNil)
	c.Assert(status.Val(), Equals, "OK")

	get := t.client.Get("key1")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "hello")
}

func (t *RedisTest) TestCmdKeysRenameNX(c *C) {
	set := t.client.Set("key", "hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	renameNX := t.client.RenameNX("key", "key1")
	c.Assert(renameNX.Err(), IsNil)
	c.Assert(renameNX.Val(), Equals, true)

	get := t.client.Get("key1")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "hello")
}

func (t *RedisTest) TestCmdKeysRestore(c *C) {
	set := t.client.Set("key", "hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	dump := t.client.Dump("key")
	c.Assert(dump.Err(), IsNil)

	del := t.client.Del("key")
	c.Assert(del.Err(), IsNil)

	restore := t.client.Restore("key", 0, dump.Val())
	c.Assert(restore.Err(), IsNil)
	c.Assert(restore.Val(), Equals, "OK")

	type_ := t.client.Type("key")
	c.Assert(type_.Err(), IsNil)
	c.Assert(type_.Val(), Equals, "string")

	lRange := t.client.Get("key")
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), Equals, "hello")
}

func (t *RedisTest) TestCmdKeysSort(c *C) {
	lPush := t.client.LPush("list", "1")
	c.Assert(lPush.Err(), IsNil)
	c.Assert(lPush.Val(), Equals, int64(1))
	lPush = t.client.LPush("list", "3")
	c.Assert(lPush.Err(), IsNil)
	c.Assert(lPush.Val(), Equals, int64(2))
	lPush = t.client.LPush("list", "2")
	c.Assert(lPush.Err(), IsNil)
	c.Assert(lPush.Val(), Equals, int64(3))

	sort := t.client.Sort("list", redis.Sort{Offset: 0, Count: 2, Order: "ASC"})
	c.Assert(sort.Err(), IsNil)
	c.Assert(sort.Val(), DeepEquals, []string{"1", "2"})
}

func (t *RedisTest) TestCmdKeysSortBy(c *C) {
	lPush := t.client.LPush("list", "1")
	c.Assert(lPush.Err(), IsNil)
	c.Assert(lPush.Val(), Equals, int64(1))
	lPush = t.client.LPush("list", "3")
	c.Assert(lPush.Err(), IsNil)
	c.Assert(lPush.Val(), Equals, int64(2))
	lPush = t.client.LPush("list", "2")
	c.Assert(lPush.Err(), IsNil)
	c.Assert(lPush.Val(), Equals, int64(3))

	set := t.client.Set("weight_1", "5")
	c.Assert(set.Err(), IsNil)
	set = t.client.Set("weight_2", "2")
	c.Assert(set.Err(), IsNil)
	set = t.client.Set("weight_3", "8")
	c.Assert(set.Err(), IsNil)

	sort := t.client.Sort("list", redis.Sort{Offset: 0, Count: 2, Order: "ASC", By: "weight_*"})
	c.Assert(sort.Err(), IsNil)
	c.Assert(sort.Val(), DeepEquals, []string{"2", "1"})
}

func (t *RedisTest) TestCmdKeysTTL(c *C) {
	ttl := t.client.TTL("key")
	c.Assert(ttl.Err(), IsNil)
	c.Assert(ttl.Val() < 0, Equals, true)

	set := t.client.Set("key", "hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	expire := t.client.Expire("key", 60*time.Second)
	c.Assert(expire.Err(), IsNil)
	c.Assert(expire.Val(), Equals, true)

	ttl = t.client.TTL("key")
	c.Assert(ttl.Err(), IsNil)
	c.Assert(ttl.Val(), Equals, 60*time.Second)
}

func (t *RedisTest) TestCmdKeysType(c *C) {
	set := t.client.Set("key", "hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	type_ := t.client.Type("key")
	c.Assert(type_.Err(), IsNil)
	c.Assert(type_.Val(), Equals, "string")
}

func (t *RedisTest) TestCmdScan(c *C) {
	for i := 0; i < 1000; i++ {
		set := t.client.Set(fmt.Sprintf("key%d", i), "hello")
		c.Assert(set.Err(), IsNil)
	}

	cursor, keys, err := t.client.Scan(0, "", 0).Result()
	c.Assert(err, IsNil)
	c.Assert(cursor > 0, Equals, true)
	c.Assert(len(keys) > 0, Equals, true)
}

func (t *RedisTest) TestCmdSScan(c *C) {
	for i := 0; i < 1000; i++ {
		sadd := t.client.SAdd("myset", fmt.Sprintf("member%d", i))
		c.Assert(sadd.Err(), IsNil)
	}

	cursor, keys, err := t.client.SScan("myset", 0, "", 0).Result()
	c.Assert(err, IsNil)
	c.Assert(cursor > 0, Equals, true)
	c.Assert(len(keys) > 0, Equals, true)
}

func (t *RedisTest) TestCmdHScan(c *C) {
	for i := 0; i < 1000; i++ {
		sadd := t.client.HSet("myhash", fmt.Sprintf("key%d", i), "hello")
		c.Assert(sadd.Err(), IsNil)
	}

	cursor, keys, err := t.client.HScan("myhash", 0, "", 0).Result()
	c.Assert(err, IsNil)
	c.Assert(cursor > 0, Equals, true)
	c.Assert(len(keys) > 0, Equals, true)
}

func (t *RedisTest) TestCmdZScan(c *C) {
	for i := 0; i < 1000; i++ {
		sadd := t.client.ZAdd("myset", redis.Z{float64(i), fmt.Sprintf("member%d", i)})
		c.Assert(sadd.Err(), IsNil)
	}

	cursor, keys, err := t.client.ZScan("myset", 0, "", 0).Result()
	c.Assert(err, IsNil)
	c.Assert(cursor > 0, Equals, true)
	c.Assert(len(keys) > 0, Equals, true)
}

//------------------------------------------------------------------------------

func (t *RedisTest) TestStringsAppend(c *C) {
	exists := t.client.Exists("key")
	c.Assert(exists.Err(), IsNil)
	c.Assert(exists.Val(), Equals, false)

	append := t.client.Append("key", "Hello")
	c.Assert(append.Err(), IsNil)
	c.Assert(append.Val(), Equals, int64(5))

	append = t.client.Append("key", " World")
	c.Assert(append.Err(), IsNil)
	c.Assert(append.Val(), Equals, int64(11))

	get := t.client.Get("key")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "Hello World")
}

func (t *RedisTest) TestStringsBitCount(c *C) {
	set := t.client.Set("key", "foobar")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	bitCount := t.client.BitCount("key", nil)
	c.Assert(bitCount.Err(), IsNil)
	c.Assert(bitCount.Val(), Equals, int64(26))

	bitCount = t.client.BitCount("key", &redis.BitCount{0, 0})
	c.Assert(bitCount.Err(), IsNil)
	c.Assert(bitCount.Val(), Equals, int64(4))

	bitCount = t.client.BitCount("key", &redis.BitCount{1, 1})
	c.Assert(bitCount.Err(), IsNil)
	c.Assert(bitCount.Val(), Equals, int64(6))
}

func (t *RedisTest) TestStringsBitOpAnd(c *C) {
	set := t.client.Set("key1", "1")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	set = t.client.Set("key2", "0")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	bitOpAnd := t.client.BitOpAnd("dest", "key1", "key2")
	c.Assert(bitOpAnd.Err(), IsNil)
	c.Assert(bitOpAnd.Val(), Equals, int64(1))

	get := t.client.Get("dest")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "0")
}

func (t *RedisTest) TestStringsBitOpOr(c *C) {
	set := t.client.Set("key1", "1")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	set = t.client.Set("key2", "0")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	bitOpOr := t.client.BitOpOr("dest", "key1", "key2")
	c.Assert(bitOpOr.Err(), IsNil)
	c.Assert(bitOpOr.Val(), Equals, int64(1))

	get := t.client.Get("dest")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "1")
}

func (t *RedisTest) TestStringsBitOpXor(c *C) {
	set := t.client.Set("key1", "\xff")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	set = t.client.Set("key2", "\x0f")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	bitOpXor := t.client.BitOpXor("dest", "key1", "key2")
	c.Assert(bitOpXor.Err(), IsNil)
	c.Assert(bitOpXor.Val(), Equals, int64(1))

	get := t.client.Get("dest")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "\xf0")
}

func (t *RedisTest) TestStringsBitOpNot(c *C) {
	set := t.client.Set("key1", "\x00")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	bitOpNot := t.client.BitOpNot("dest", "key1")
	c.Assert(bitOpNot.Err(), IsNil)
	c.Assert(bitOpNot.Val(), Equals, int64(1))

	get := t.client.Get("dest")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "\xff")
}

func (t *RedisTest) TestStringsDecr(c *C) {
	set := t.client.Set("key", "10")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	decr := t.client.Decr("key")
	c.Assert(decr.Err(), IsNil)
	c.Assert(decr.Val(), Equals, int64(9))

	set = t.client.Set("key", "234293482390480948029348230948")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	decr = t.client.Decr("key")
	c.Assert(decr.Err(), ErrorMatches, "ERR value is not an integer or out of range")
	c.Assert(decr.Val(), Equals, int64(0))
}

func (t *RedisTest) TestStringsDecrBy(c *C) {
	set := t.client.Set("key", "10")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	decrBy := t.client.DecrBy("key", 5)
	c.Assert(decrBy.Err(), IsNil)
	c.Assert(decrBy.Val(), Equals, int64(5))
}

func (t *RedisTest) TestStringsGet(c *C) {
	get := t.client.Get("_")
	c.Assert(get.Err(), Equals, redis.Nil)
	c.Assert(get.Val(), Equals, "")

	set := t.client.Set("key", "hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	get = t.client.Get("key")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "hello")
}

func (t *RedisTest) TestStringsGetBit(c *C) {
	setBit := t.client.SetBit("key", 7, 1)
	c.Assert(setBit.Err(), IsNil)
	c.Assert(setBit.Val(), Equals, int64(0))

	getBit := t.client.GetBit("key", 0)
	c.Assert(getBit.Err(), IsNil)
	c.Assert(getBit.Val(), Equals, int64(0))

	getBit = t.client.GetBit("key", 7)
	c.Assert(getBit.Err(), IsNil)
	c.Assert(getBit.Val(), Equals, int64(1))

	getBit = t.client.GetBit("key", 100)
	c.Assert(getBit.Err(), IsNil)
	c.Assert(getBit.Val(), Equals, int64(0))
}

func (t *RedisTest) TestStringsGetRange(c *C) {
	set := t.client.Set("key", "This is a string")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	getRange := t.client.GetRange("key", 0, 3)
	c.Assert(getRange.Err(), IsNil)
	c.Assert(getRange.Val(), Equals, "This")

	getRange = t.client.GetRange("key", -3, -1)
	c.Assert(getRange.Err(), IsNil)
	c.Assert(getRange.Val(), Equals, "ing")

	getRange = t.client.GetRange("key", 0, -1)
	c.Assert(getRange.Err(), IsNil)
	c.Assert(getRange.Val(), Equals, "This is a string")

	getRange = t.client.GetRange("key", 10, 100)
	c.Assert(getRange.Err(), IsNil)
	c.Assert(getRange.Val(), Equals, "string")
}

func (t *RedisTest) TestStringsGetSet(c *C) {
	incr := t.client.Incr("key")
	c.Assert(incr.Err(), IsNil)
	c.Assert(incr.Val(), Equals, int64(1))

	getSet := t.client.GetSet("key", "0")
	c.Assert(getSet.Err(), IsNil)
	c.Assert(getSet.Val(), Equals, "1")

	get := t.client.Get("key")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "0")
}

func (t *RedisTest) TestStringsIncr(c *C) {
	set := t.client.Set("key", "10")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	incr := t.client.Incr("key")
	c.Assert(incr.Err(), IsNil)
	c.Assert(incr.Val(), Equals, int64(11))

	get := t.client.Get("key")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "11")
}

func (t *RedisTest) TestStringsIncrBy(c *C) {
	set := t.client.Set("key", "10")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	incrBy := t.client.IncrBy("key", 5)
	c.Assert(incrBy.Err(), IsNil)
	c.Assert(incrBy.Val(), Equals, int64(15))
}

func (t *RedisTest) TestIncrByFloat(c *C) {
	set := t.client.Set("key", "10.50")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	incrByFloat := t.client.IncrByFloat("key", 0.1)
	c.Assert(incrByFloat.Err(), IsNil)
	c.Assert(incrByFloat.Val(), Equals, 10.6)

	set = t.client.Set("key", "5.0e3")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	incrByFloat = t.client.IncrByFloat("key", 2.0e2)
	c.Assert(incrByFloat.Err(), IsNil)
	c.Assert(incrByFloat.Val(), Equals, float64(5200))
}

func (t *RedisTest) TestIncrByFloatOverflow(c *C) {
	incrByFloat := t.client.IncrByFloat("key", 996945661)
	c.Assert(incrByFloat.Err(), IsNil)
	c.Assert(incrByFloat.Val(), Equals, float64(996945661))
}

func (t *RedisTest) TestStringsMSetMGet(c *C) {
	mSet := t.client.MSet("key1", "hello1", "key2", "hello2")
	c.Assert(mSet.Err(), IsNil)
	c.Assert(mSet.Val(), Equals, "OK")

	mGet := t.client.MGet("key1", "key2", "_")
	c.Assert(mGet.Err(), IsNil)
	c.Assert(mGet.Val(), DeepEquals, []interface{}{"hello1", "hello2", nil})
}

func (t *RedisTest) TestStringsMSetNX(c *C) {
	mSetNX := t.client.MSetNX("key1", "hello1", "key2", "hello2")
	c.Assert(mSetNX.Err(), IsNil)
	c.Assert(mSetNX.Val(), Equals, true)

	mSetNX = t.client.MSetNX("key2", "hello1", "key3", "hello2")
	c.Assert(mSetNX.Err(), IsNil)
	c.Assert(mSetNX.Val(), Equals, false)
}

func (t *RedisTest) TestStringsPSetEx(c *C) {
	expiration := 50 * time.Millisecond
	psetex := t.client.PSetEx("key", expiration, "hello")
	c.Assert(psetex.Err(), IsNil)
	c.Assert(psetex.Val(), Equals, "OK")

	pttl := t.client.PTTL("key")
	c.Assert(pttl.Err(), IsNil)
	c.Assert(pttl.Val() <= expiration, Equals, true)
	c.Assert(pttl.Val() >= expiration-time.Millisecond, Equals, true)

	get := t.client.Get("key")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "hello")
}

func (t *RedisTest) TestStringsSetGet(c *C) {
	set := t.client.Set("key", "hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	get := t.client.Get("key")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "hello")
}

func (t *RedisTest) TestStringsSetEx(c *C) {
	setEx := t.client.SetEx("key", 10*time.Second, "hello")
	c.Assert(setEx.Err(), IsNil)
	c.Assert(setEx.Val(), Equals, "OK")

	ttl := t.client.TTL("key")
	c.Assert(ttl.Err(), IsNil)
	c.Assert(ttl.Val(), Equals, 10*time.Second)
}

func (t *RedisTest) TestStringsSetNX(c *C) {
	setNX := t.client.SetNX("key", "hello")
	c.Assert(setNX.Err(), IsNil)
	c.Assert(setNX.Val(), Equals, true)

	setNX = t.client.SetNX("key", "hello2")
	c.Assert(setNX.Err(), IsNil)
	c.Assert(setNX.Val(), Equals, false)

	get := t.client.Get("key")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "hello")
}

func (t *RedisTest) TestStringsSetRange(c *C) {
	set := t.client.Set("key", "Hello World")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	range_ := t.client.SetRange("key", 6, "Redis")
	c.Assert(range_.Err(), IsNil)
	c.Assert(range_.Val(), Equals, int64(11))

	get := t.client.Get("key")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "Hello Redis")
}

func (t *RedisTest) TestStringsStrLen(c *C) {
	set := t.client.Set("key", "hello")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	strLen := t.client.StrLen("key")
	c.Assert(strLen.Err(), IsNil)
	c.Assert(strLen.Val(), Equals, int64(5))

	strLen = t.client.StrLen("_")
	c.Assert(strLen.Err(), IsNil)
	c.Assert(strLen.Val(), Equals, int64(0))
}

//------------------------------------------------------------------------------

func (t *RedisTest) TestCmdHDel(c *C) {
	hSet := t.client.HSet("hash", "key", "hello")
	c.Assert(hSet.Err(), IsNil)

	hDel := t.client.HDel("hash", "key")
	c.Assert(hDel.Err(), IsNil)
	c.Assert(hDel.Val(), Equals, int64(1))

	hDel = t.client.HDel("hash", "key")
	c.Assert(hDel.Err(), IsNil)
	c.Assert(hDel.Val(), Equals, int64(0))
}

func (t *RedisTest) TestCmdHExists(c *C) {
	hSet := t.client.HSet("hash", "key", "hello")
	c.Assert(hSet.Err(), IsNil)

	hExists := t.client.HExists("hash", "key")
	c.Assert(hExists.Err(), IsNil)
	c.Assert(hExists.Val(), Equals, true)

	hExists = t.client.HExists("hash", "key1")
	c.Assert(hExists.Err(), IsNil)
	c.Assert(hExists.Val(), Equals, false)
}

func (t *RedisTest) TestCmdHGet(c *C) {
	hSet := t.client.HSet("hash", "key", "hello")
	c.Assert(hSet.Err(), IsNil)

	hGet := t.client.HGet("hash", "key")
	c.Assert(hGet.Err(), IsNil)
	c.Assert(hGet.Val(), Equals, "hello")

	hGet = t.client.HGet("hash", "key1")
	c.Assert(hGet.Err(), Equals, redis.Nil)
	c.Assert(hGet.Val(), Equals, "")
}

func (t *RedisTest) TestCmdHGetAll(c *C) {
	hSet := t.client.HSet("hash", "key1", "hello1")
	c.Assert(hSet.Err(), IsNil)
	hSet = t.client.HSet("hash", "key2", "hello2")
	c.Assert(hSet.Err(), IsNil)

	hGetAll := t.client.HGetAll("hash")
	c.Assert(hGetAll.Err(), IsNil)
	c.Assert(hGetAll.Val(), DeepEquals, []string{"key1", "hello1", "key2", "hello2"})
}

func (t *RedisTest) TestCmdHGetAllMap(c *C) {
	hSet := t.client.HSet("hash", "key1", "hello1")
	c.Assert(hSet.Err(), IsNil)
	hSet = t.client.HSet("hash", "key2", "hello2")
	c.Assert(hSet.Err(), IsNil)

	hGetAll := t.client.HGetAllMap("hash")
	c.Assert(hGetAll.Err(), IsNil)
	c.Assert(hGetAll.Val(), DeepEquals, map[string]string{"key1": "hello1", "key2": "hello2"})
}

func (t *RedisTest) TestCmdHIncrBy(c *C) {
	hSet := t.client.HSet("hash", "key", "5")
	c.Assert(hSet.Err(), IsNil)

	hIncrBy := t.client.HIncrBy("hash", "key", 1)
	c.Assert(hIncrBy.Err(), IsNil)
	c.Assert(hIncrBy.Val(), Equals, int64(6))

	hIncrBy = t.client.HIncrBy("hash", "key", -1)
	c.Assert(hIncrBy.Err(), IsNil)
	c.Assert(hIncrBy.Val(), Equals, int64(5))

	hIncrBy = t.client.HIncrBy("hash", "key", -10)
	c.Assert(hIncrBy.Err(), IsNil)
	c.Assert(hIncrBy.Val(), Equals, int64(-5))
}

func (t *RedisTest) TestCmdHIncrByFloat(c *C) {
	hSet := t.client.HSet("hash", "field", "10.50")
	c.Assert(hSet.Err(), IsNil)
	c.Assert(hSet.Val(), Equals, true)

	hIncrByFloat := t.client.HIncrByFloat("hash", "field", 0.1)
	c.Assert(hIncrByFloat.Err(), IsNil)
	c.Assert(hIncrByFloat.Val(), Equals, 10.6)

	hSet = t.client.HSet("hash", "field", "5.0e3")
	c.Assert(hSet.Err(), IsNil)
	c.Assert(hSet.Val(), Equals, false)

	hIncrByFloat = t.client.HIncrByFloat("hash", "field", 2.0e2)
	c.Assert(hIncrByFloat.Err(), IsNil)
	c.Assert(hIncrByFloat.Val(), Equals, float64(5200))
}

func (t *RedisTest) TestCmdHKeys(c *C) {
	hkeys := t.client.HKeys("hash")
	c.Assert(hkeys.Err(), IsNil)
	c.Assert(hkeys.Val(), DeepEquals, []string{})

	hset := t.client.HSet("hash", "key1", "hello1")
	c.Assert(hset.Err(), IsNil)
	hset = t.client.HSet("hash", "key2", "hello2")
	c.Assert(hset.Err(), IsNil)

	hkeys = t.client.HKeys("hash")
	c.Assert(hkeys.Err(), IsNil)
	c.Assert(hkeys.Val(), DeepEquals, []string{"key1", "key2"})
}

func (t *RedisTest) TestCmdHLen(c *C) {
	hSet := t.client.HSet("hash", "key1", "hello1")
	c.Assert(hSet.Err(), IsNil)
	hSet = t.client.HSet("hash", "key2", "hello2")
	c.Assert(hSet.Err(), IsNil)

	hLen := t.client.HLen("hash")
	c.Assert(hLen.Err(), IsNil)
	c.Assert(hLen.Val(), Equals, int64(2))
}

func (t *RedisTest) TestCmdHMGet(c *C) {
	hSet := t.client.HSet("hash", "key1", "hello1")
	c.Assert(hSet.Err(), IsNil)
	hSet = t.client.HSet("hash", "key2", "hello2")
	c.Assert(hSet.Err(), IsNil)

	hMGet := t.client.HMGet("hash", "key1", "key2", "_")
	c.Assert(hMGet.Err(), IsNil)
	c.Assert(hMGet.Val(), DeepEquals, []interface{}{"hello1", "hello2", nil})
}

func (t *RedisTest) TestCmdHMSet(c *C) {
	hMSet := t.client.HMSet("hash", "key1", "hello1", "key2", "hello2")
	c.Assert(hMSet.Err(), IsNil)
	c.Assert(hMSet.Val(), Equals, "OK")

	hGet := t.client.HGet("hash", "key1")
	c.Assert(hGet.Err(), IsNil)
	c.Assert(hGet.Val(), Equals, "hello1")

	hGet = t.client.HGet("hash", "key2")
	c.Assert(hGet.Err(), IsNil)
	c.Assert(hGet.Val(), Equals, "hello2")
}

func (t *RedisTest) TestCmdHSet(c *C) {
	hSet := t.client.HSet("hash", "key", "hello")
	c.Assert(hSet.Err(), IsNil)
	c.Assert(hSet.Val(), Equals, true)

	hGet := t.client.HGet("hash", "key")
	c.Assert(hGet.Err(), IsNil)
	c.Assert(hGet.Val(), Equals, "hello")
}

func (t *RedisTest) TestCmdHSetNX(c *C) {
	hSetNX := t.client.HSetNX("hash", "key", "hello")
	c.Assert(hSetNX.Err(), IsNil)
	c.Assert(hSetNX.Val(), Equals, true)

	hSetNX = t.client.HSetNX("hash", "key", "hello")
	c.Assert(hSetNX.Err(), IsNil)
	c.Assert(hSetNX.Val(), Equals, false)

	hGet := t.client.HGet("hash", "key")
	c.Assert(hGet.Err(), IsNil)
	c.Assert(hGet.Val(), Equals, "hello")
}

func (t *RedisTest) TestCmdHVals(c *C) {
	hSet := t.client.HSet("hash", "key1", "hello1")
	c.Assert(hSet.Err(), IsNil)
	hSet = t.client.HSet("hash", "key2", "hello2")
	c.Assert(hSet.Err(), IsNil)

	hVals := t.client.HVals("hash")
	c.Assert(hVals.Err(), IsNil)
	c.Assert(hVals.Val(), DeepEquals, []string{"hello1", "hello2"})
}

//------------------------------------------------------------------------------

func (t *RedisTest) TestCmdListsBLPop(c *C) {
	rPush := t.client.RPush("list1", "a", "b", "c")
	c.Assert(rPush.Err(), IsNil)

	bLPop := t.client.BLPop(0, "list1", "list2")
	c.Assert(bLPop.Err(), IsNil)
	c.Assert(bLPop.Val(), DeepEquals, []string{"list1", "a"})
}

func (t *RedisTest) TestCmdListsBLPopBlocks(c *C) {
	started := make(chan bool)
	done := make(chan bool)
	go func() {
		started <- true
		bLPop := t.client.BLPop(0, "list")
		c.Assert(bLPop.Err(), IsNil)
		c.Assert(bLPop.Val(), DeepEquals, []string{"list", "a"})
		done <- true
	}()
	<-started

	select {
	case <-done:
		c.Error("BLPop is not blocked")
	case <-time.After(time.Second):
		// ok
	}

	rPush := t.client.RPush("list", "a")
	c.Assert(rPush.Err(), IsNil)

	select {
	case <-done:
		// ok
	case <-time.After(time.Second):
		c.Error("BLPop is still blocked")
		// ok
	}
}

func (t *RedisTest) TestCmdListsBLPopTimeout(c *C) {
	bLPop := t.client.BLPop(1, "list1")
	c.Assert(bLPop.Err(), Equals, redis.Nil)
	c.Assert(bLPop.Val(), IsNil)
}

func (t *RedisTest) TestCmdListsBRPop(c *C) {
	rPush := t.client.RPush("list1", "a", "b", "c")
	c.Assert(rPush.Err(), IsNil)

	bRPop := t.client.BRPop(0, "list1", "list2")
	c.Assert(bRPop.Err(), IsNil)
	c.Assert(bRPop.Val(), DeepEquals, []string{"list1", "c"})
}

func (t *RedisTest) TestCmdListsBRPopBlocks(c *C) {
	started := make(chan bool)
	done := make(chan bool)
	go func() {
		started <- true
		brpop := t.client.BRPop(0, "list")
		c.Assert(brpop.Err(), IsNil)
		c.Assert(brpop.Val(), DeepEquals, []string{"list", "a"})
		done <- true
	}()
	<-started

	select {
	case <-done:
		c.Error("BRPop is not blocked")
	case <-time.After(time.Second):
		// ok
	}

	rPush := t.client.RPush("list", "a")
	c.Assert(rPush.Err(), IsNil)

	select {
	case <-done:
		// ok
	case <-time.After(time.Second):
		c.Error("BRPop is still blocked")
		// ok
	}
}

func (t *RedisTest) TestCmdListsBRPopLPush(c *C) {
	rPush := t.client.RPush("list1", "a", "b", "c")
	c.Assert(rPush.Err(), IsNil)

	bRPopLPush := t.client.BRPopLPush("list1", "list2", 0)
	c.Assert(bRPopLPush.Err(), IsNil)
	c.Assert(bRPopLPush.Val(), Equals, "c")
}

func (t *RedisTest) TestCmdListsLIndex(c *C) {
	lPush := t.client.LPush("list", "World")
	c.Assert(lPush.Err(), IsNil)
	lPush = t.client.LPush("list", "Hello")
	c.Assert(lPush.Err(), IsNil)

	lIndex := t.client.LIndex("list", 0)
	c.Assert(lIndex.Err(), IsNil)
	c.Assert(lIndex.Val(), Equals, "Hello")

	lIndex = t.client.LIndex("list", -1)
	c.Assert(lIndex.Err(), IsNil)
	c.Assert(lIndex.Val(), Equals, "World")

	lIndex = t.client.LIndex("list", 3)
	c.Assert(lIndex.Err(), Equals, redis.Nil)
	c.Assert(lIndex.Val(), Equals, "")
}

func (t *RedisTest) TestCmdListsLInsert(c *C) {
	rPush := t.client.RPush("list", "Hello")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "World")
	c.Assert(rPush.Err(), IsNil)

	lInsert := t.client.LInsert("list", "BEFORE", "World", "There")
	c.Assert(lInsert.Err(), IsNil)
	c.Assert(lInsert.Val(), Equals, int64(3))

	lRange := t.client.LRange("list", 0, -1)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{"Hello", "There", "World"})
}

func (t *RedisTest) TestCmdListsLLen(c *C) {
	lPush := t.client.LPush("list", "World")
	c.Assert(lPush.Err(), IsNil)
	lPush = t.client.LPush("list", "Hello")
	c.Assert(lPush.Err(), IsNil)

	lLen := t.client.LLen("list")
	c.Assert(lLen.Err(), IsNil)
	c.Assert(lLen.Val(), Equals, int64(2))
}

func (t *RedisTest) TestCmdListsLPop(c *C) {
	rPush := t.client.RPush("list", "one")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "two")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "three")
	c.Assert(rPush.Err(), IsNil)

	lPop := t.client.LPop("list")
	c.Assert(lPop.Err(), IsNil)
	c.Assert(lPop.Val(), Equals, "one")

	lRange := t.client.LRange("list", 0, -1)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{"two", "three"})
}

func (t *RedisTest) TestCmdListsLPush(c *C) {
	lPush := t.client.LPush("list", "World")
	c.Assert(lPush.Err(), IsNil)
	lPush = t.client.LPush("list", "Hello")
	c.Assert(lPush.Err(), IsNil)

	lRange := t.client.LRange("list", 0, -1)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{"Hello", "World"})
}

func (t *RedisTest) TestCmdListsLPushX(c *C) {
	lPush := t.client.LPush("list", "World")
	c.Assert(lPush.Err(), IsNil)

	lPushX := t.client.LPushX("list", "Hello")
	c.Assert(lPushX.Err(), IsNil)
	c.Assert(lPushX.Val(), Equals, int64(2))

	lPushX = t.client.LPushX("list2", "Hello")
	c.Assert(lPushX.Err(), IsNil)
	c.Assert(lPushX.Val(), Equals, int64(0))

	lRange := t.client.LRange("list", 0, -1)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{"Hello", "World"})

	lRange = t.client.LRange("list2", 0, -1)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{})
}

func (t *RedisTest) TestCmdListsLRange(c *C) {
	rPush := t.client.RPush("list", "one")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "two")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "three")
	c.Assert(rPush.Err(), IsNil)

	lRange := t.client.LRange("list", 0, 0)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{"one"})

	lRange = t.client.LRange("list", -3, 2)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{"one", "two", "three"})

	lRange = t.client.LRange("list", -100, 100)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{"one", "two", "three"})

	lRange = t.client.LRange("list", 5, 10)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{})
}

func (t *RedisTest) TestCmdListsLRem(c *C) {
	rPush := t.client.RPush("list", "hello")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "hello")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "key")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "hello")
	c.Assert(rPush.Err(), IsNil)

	lRem := t.client.LRem("list", -2, "hello")
	c.Assert(lRem.Err(), IsNil)
	c.Assert(lRem.Val(), Equals, int64(2))

	lRange := t.client.LRange("list", 0, -1)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{"hello", "key"})
}

func (t *RedisTest) TestCmdListsLSet(c *C) {
	rPush := t.client.RPush("list", "one")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "two")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "three")
	c.Assert(rPush.Err(), IsNil)

	lSet := t.client.LSet("list", 0, "four")
	c.Assert(lSet.Err(), IsNil)
	c.Assert(lSet.Val(), Equals, "OK")

	lSet = t.client.LSet("list", -2, "five")
	c.Assert(lSet.Err(), IsNil)
	c.Assert(lSet.Val(), Equals, "OK")

	lRange := t.client.LRange("list", 0, -1)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{"four", "five", "three"})
}

func (t *RedisTest) TestCmdListsLTrim(c *C) {
	rPush := t.client.RPush("list", "one")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "two")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "three")
	c.Assert(rPush.Err(), IsNil)

	lTrim := t.client.LTrim("list", 1, -1)
	c.Assert(lTrim.Err(), IsNil)
	c.Assert(lTrim.Val(), Equals, "OK")

	lRange := t.client.LRange("list", 0, -1)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{"two", "three"})
}

func (t *RedisTest) TestCmdListsRPop(c *C) {
	rPush := t.client.RPush("list", "one")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "two")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "three")
	c.Assert(rPush.Err(), IsNil)

	rPop := t.client.RPop("list")
	c.Assert(rPop.Err(), IsNil)
	c.Assert(rPop.Val(), Equals, "three")

	lRange := t.client.LRange("list", 0, -1)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{"one", "two"})
}

func (t *RedisTest) TestCmdListsRPopLPush(c *C) {
	rPush := t.client.RPush("list", "one")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "two")
	c.Assert(rPush.Err(), IsNil)
	rPush = t.client.RPush("list", "three")
	c.Assert(rPush.Err(), IsNil)

	rPopLPush := t.client.RPopLPush("list", "list2")
	c.Assert(rPopLPush.Err(), IsNil)
	c.Assert(rPopLPush.Val(), Equals, "three")

	lRange := t.client.LRange("list", 0, -1)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{"one", "two"})

	lRange = t.client.LRange("list2", 0, -1)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{"three"})
}

func (t *RedisTest) TestCmdListsRPush(c *C) {
	rPush := t.client.RPush("list", "Hello")
	c.Assert(rPush.Err(), IsNil)
	c.Assert(rPush.Val(), Equals, int64(1))

	rPush = t.client.RPush("list", "World")
	c.Assert(rPush.Err(), IsNil)
	c.Assert(rPush.Val(), Equals, int64(2))

	lRange := t.client.LRange("list", 0, -1)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{"Hello", "World"})
}

func (t *RedisTest) TestCmdListsRPushX(c *C) {
	rPush := t.client.RPush("list", "Hello")
	c.Assert(rPush.Err(), IsNil)
	c.Assert(rPush.Val(), Equals, int64(1))

	rPushX := t.client.RPushX("list", "World")
	c.Assert(rPushX.Err(), IsNil)
	c.Assert(rPushX.Val(), Equals, int64(2))

	rPushX = t.client.RPushX("list2", "World")
	c.Assert(rPushX.Err(), IsNil)
	c.Assert(rPushX.Val(), Equals, int64(0))

	lRange := t.client.LRange("list", 0, -1)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{"Hello", "World"})

	lRange = t.client.LRange("list2", 0, -1)
	c.Assert(lRange.Err(), IsNil)
	c.Assert(lRange.Val(), DeepEquals, []string{})
}

//------------------------------------------------------------------------------

func (t *RedisTest) TestSAdd(c *C) {
	sAdd := t.client.SAdd("set", "Hello")
	c.Assert(sAdd.Err(), IsNil)
	c.Assert(sAdd.Val(), Equals, int64(1))

	sAdd = t.client.SAdd("set", "World")
	c.Assert(sAdd.Err(), IsNil)
	c.Assert(sAdd.Val(), Equals, int64(1))

	sAdd = t.client.SAdd("set", "World")
	c.Assert(sAdd.Err(), IsNil)
	c.Assert(sAdd.Val(), Equals, int64(0))

	sMembers := t.client.SMembers("set")
	c.Assert(sMembers.Err(), IsNil)
	c.Assert(sortStrings(sMembers.Val()), DeepEquals, []string{"Hello", "World"})
}

func (t *RedisTest) TestSCard(c *C) {
	sAdd := t.client.SAdd("set", "Hello")
	c.Assert(sAdd.Err(), IsNil)
	c.Assert(sAdd.Val(), Equals, int64(1))

	sAdd = t.client.SAdd("set", "World")
	c.Assert(sAdd.Err(), IsNil)
	c.Assert(sAdd.Val(), Equals, int64(1))

	sCard := t.client.SCard("set")
	c.Assert(sCard.Err(), IsNil)
	c.Assert(sCard.Val(), Equals, int64(2))
}

func (t *RedisTest) TestSDiff(c *C) {
	sAdd := t.client.SAdd("set1", "a")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set1", "b")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set1", "c")
	c.Assert(sAdd.Err(), IsNil)

	sAdd = t.client.SAdd("set2", "c")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set2", "d")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set2", "e")
	c.Assert(sAdd.Err(), IsNil)

	sDiff := t.client.SDiff("set1", "set2")
	c.Assert(sDiff.Err(), IsNil)
	c.Assert(sortStrings(sDiff.Val()), DeepEquals, []string{"a", "b"})
}

func (t *RedisTest) TestSDiffStore(c *C) {
	sAdd := t.client.SAdd("set1", "a")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set1", "b")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set1", "c")
	c.Assert(sAdd.Err(), IsNil)

	sAdd = t.client.SAdd("set2", "c")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set2", "d")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set2", "e")
	c.Assert(sAdd.Err(), IsNil)

	sDiffStore := t.client.SDiffStore("set", "set1", "set2")
	c.Assert(sDiffStore.Err(), IsNil)
	c.Assert(sDiffStore.Val(), Equals, int64(2))

	sMembers := t.client.SMembers("set")
	c.Assert(sMembers.Err(), IsNil)
	c.Assert(sortStrings(sMembers.Val()), DeepEquals, []string{"a", "b"})
}

func (t *RedisTest) TestSInter(c *C) {
	sAdd := t.client.SAdd("set1", "a")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set1", "b")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set1", "c")
	c.Assert(sAdd.Err(), IsNil)

	sAdd = t.client.SAdd("set2", "c")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set2", "d")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set2", "e")
	c.Assert(sAdd.Err(), IsNil)

	sInter := t.client.SInter("set1", "set2")
	c.Assert(sInter.Err(), IsNil)
	c.Assert(sInter.Val(), DeepEquals, []string{"c"})
}

func (t *RedisTest) TestSInterStore(c *C) {
	sAdd := t.client.SAdd("set1", "a")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set1", "b")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set1", "c")
	c.Assert(sAdd.Err(), IsNil)

	sAdd = t.client.SAdd("set2", "c")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set2", "d")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set2", "e")
	c.Assert(sAdd.Err(), IsNil)

	sInterStore := t.client.SInterStore("set", "set1", "set2")
	c.Assert(sInterStore.Err(), IsNil)
	c.Assert(sInterStore.Val(), Equals, int64(1))

	sMembers := t.client.SMembers("set")
	c.Assert(sMembers.Err(), IsNil)
	c.Assert(sMembers.Val(), DeepEquals, []string{"c"})
}

func (t *RedisTest) TestIsMember(c *C) {
	sAdd := t.client.SAdd("set", "one")
	c.Assert(sAdd.Err(), IsNil)

	sIsMember := t.client.SIsMember("set", "one")
	c.Assert(sIsMember.Err(), IsNil)
	c.Assert(sIsMember.Val(), Equals, true)

	sIsMember = t.client.SIsMember("set", "two")
	c.Assert(sIsMember.Err(), IsNil)
	c.Assert(sIsMember.Val(), Equals, false)
}

func (t *RedisTest) TestSMembers(c *C) {
	sAdd := t.client.SAdd("set", "Hello")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set", "World")
	c.Assert(sAdd.Err(), IsNil)

	sMembers := t.client.SMembers("set")
	c.Assert(sMembers.Err(), IsNil)
	c.Assert(sortStrings(sMembers.Val()), DeepEquals, []string{"Hello", "World"})
}

func (t *RedisTest) TestSMove(c *C) {
	sAdd := t.client.SAdd("set1", "one")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set1", "two")
	c.Assert(sAdd.Err(), IsNil)

	sAdd = t.client.SAdd("set2", "three")
	c.Assert(sAdd.Err(), IsNil)

	sMove := t.client.SMove("set1", "set2", "two")
	c.Assert(sMove.Err(), IsNil)
	c.Assert(sMove.Val(), Equals, true)

	sMembers := t.client.SMembers("set1")
	c.Assert(sMembers.Err(), IsNil)
	c.Assert(sMembers.Val(), DeepEquals, []string{"one"})

	sMembers = t.client.SMembers("set2")
	c.Assert(sMembers.Err(), IsNil)
	c.Assert(sortStrings(sMembers.Val()), DeepEquals, []string{"three", "two"})
}

func (t *RedisTest) TestSPop(c *C) {
	sAdd := t.client.SAdd("set", "one")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set", "two")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set", "three")
	c.Assert(sAdd.Err(), IsNil)

	sPop := t.client.SPop("set")
	c.Assert(sPop.Err(), IsNil)
	c.Assert(sPop.Val(), Not(Equals), "")

	sMembers := t.client.SMembers("set")
	c.Assert(sMembers.Err(), IsNil)
	c.Assert(sMembers.Val(), HasLen, 2)
}

func (t *RedisTest) TestSRandMember(c *C) {
	sAdd := t.client.SAdd("set", "one")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set", "two")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set", "three")
	c.Assert(sAdd.Err(), IsNil)

	sRandMember := t.client.SRandMember("set")
	c.Assert(sRandMember.Err(), IsNil)
	c.Assert(sRandMember.Val(), Not(Equals), "")

	sMembers := t.client.SMembers("set")
	c.Assert(sMembers.Err(), IsNil)
	c.Assert(sMembers.Val(), HasLen, 3)
}

func (t *RedisTest) TestSRem(c *C) {
	sAdd := t.client.SAdd("set", "one")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set", "two")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set", "three")
	c.Assert(sAdd.Err(), IsNil)

	sRem := t.client.SRem("set", "one")
	c.Assert(sRem.Err(), IsNil)
	c.Assert(sRem.Val(), Equals, int64(1))

	sRem = t.client.SRem("set", "four")
	c.Assert(sRem.Err(), IsNil)
	c.Assert(sRem.Val(), Equals, int64(0))

	sMembers := t.client.SMembers("set")
	c.Assert(sMembers.Err(), IsNil)
	c.Assert(
		sortStrings(sMembers.Val()),
		DeepEquals,
		[]string{"three", "two"},
	)
}

func (t *RedisTest) TestSUnion(c *C) {
	sAdd := t.client.SAdd("set1", "a")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set1", "b")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set1", "c")
	c.Assert(sAdd.Err(), IsNil)

	sAdd = t.client.SAdd("set2", "c")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set2", "d")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set2", "e")
	c.Assert(sAdd.Err(), IsNil)

	sUnion := t.client.SUnion("set1", "set2")
	c.Assert(sUnion.Err(), IsNil)
	c.Assert(sUnion.Val(), HasLen, 5)
}

func (t *RedisTest) TestSUnionStore(c *C) {
	sAdd := t.client.SAdd("set1", "a")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set1", "b")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set1", "c")
	c.Assert(sAdd.Err(), IsNil)

	sAdd = t.client.SAdd("set2", "c")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set2", "d")
	c.Assert(sAdd.Err(), IsNil)
	sAdd = t.client.SAdd("set2", "e")
	c.Assert(sAdd.Err(), IsNil)

	sUnionStore := t.client.SUnionStore("set", "set1", "set2")
	c.Assert(sUnionStore.Err(), IsNil)
	c.Assert(sUnionStore.Val(), Equals, int64(5))

	sMembers := t.client.SMembers("set")
	c.Assert(sMembers.Err(), IsNil)
	c.Assert(sMembers.Val(), HasLen, 5)
}

//------------------------------------------------------------------------------

func (t *RedisTest) TestZAdd(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	c.Assert(zAdd.Val(), Equals, int64(1))

	zAdd = t.client.ZAdd("zset", redis.Z{1, "uno"})
	c.Assert(zAdd.Err(), IsNil)
	c.Assert(zAdd.Val(), Equals, int64(1))

	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	c.Assert(zAdd.Val(), Equals, int64(1))

	zAdd = t.client.ZAdd("zset", redis.Z{3, "two"})
	c.Assert(zAdd.Err(), IsNil)
	c.Assert(zAdd.Val(), Equals, int64(0))

	val, err := t.client.ZRangeWithScores("zset", 0, -1).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{1, "one"}, {1, "uno"}, {3, "two"}})
}

func (t *RedisTest) TestZCard(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)

	zCard := t.client.ZCard("zset")
	c.Assert(zCard.Err(), IsNil)
	c.Assert(zCard.Val(), Equals, int64(2))
}

func (t *RedisTest) TestZCount(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{3, "three"})
	c.Assert(zAdd.Err(), IsNil)

	zCount := t.client.ZCount("zset", "-inf", "+inf")
	c.Assert(zCount.Err(), IsNil)
	c.Assert(zCount.Val(), Equals, int64(3))

	zCount = t.client.ZCount("zset", "(1", "3")
	c.Assert(zCount.Err(), IsNil)
	c.Assert(zCount.Val(), Equals, int64(2))
}

func (t *RedisTest) TestZIncrBy(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)

	zIncrBy := t.client.ZIncrBy("zset", 2, "one")
	c.Assert(zIncrBy.Err(), IsNil)
	c.Assert(zIncrBy.Val(), Equals, float64(3))

	val, err := t.client.ZRangeWithScores("zset", 0, -1).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{2, "two"}, {3, "one"}})
}

func (t *RedisTest) TestZInterStore(c *C) {
	zAdd := t.client.ZAdd("zset1", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset1", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)

	zAdd = t.client.ZAdd("zset2", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset2", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset3", redis.Z{3, "two"})
	c.Assert(zAdd.Err(), IsNil)

	zInterStore := t.client.ZInterStore(
		"out", redis.ZStore{Weights: []int64{2, 3}}, "zset1", "zset2")
	c.Assert(zInterStore.Err(), IsNil)
	c.Assert(zInterStore.Val(), Equals, int64(2))

	val, err := t.client.ZRangeWithScores("out", 0, -1).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{5, "one"}, {10, "two"}})
}

func (t *RedisTest) TestZRange(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{3, "three"})
	c.Assert(zAdd.Err(), IsNil)

	zRange := t.client.ZRange("zset", 0, -1)
	c.Assert(zRange.Err(), IsNil)
	c.Assert(zRange.Val(), DeepEquals, []string{"one", "two", "three"})

	zRange = t.client.ZRange("zset", 2, 3)
	c.Assert(zRange.Err(), IsNil)
	c.Assert(zRange.Val(), DeepEquals, []string{"three"})

	zRange = t.client.ZRange("zset", -2, -1)
	c.Assert(zRange.Err(), IsNil)
	c.Assert(zRange.Val(), DeepEquals, []string{"two", "three"})
}

func (t *RedisTest) TestZRangeWithScores(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{3, "three"})
	c.Assert(zAdd.Err(), IsNil)

	val, err := t.client.ZRangeWithScores("zset", 0, -1).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{1, "one"}, {2, "two"}, {3, "three"}})

	val, err = t.client.ZRangeWithScores("zset", 2, 3).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{3, "three"}})

	val, err = t.client.ZRangeWithScores("zset", -2, -1).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{2, "two"}, {3, "three"}})
}

func (t *RedisTest) TestZRangeByScore(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{3, "three"})
	c.Assert(zAdd.Err(), IsNil)

	zRangeByScore := t.client.ZRangeByScore("zset", redis.ZRangeByScore{
		Min: "-inf",
		Max: "+inf",
	})
	c.Assert(zRangeByScore.Err(), IsNil)
	c.Assert(zRangeByScore.Val(), DeepEquals, []string{"one", "two", "three"})

	zRangeByScore = t.client.ZRangeByScore("zset", redis.ZRangeByScore{
		Min: "1",
		Max: "2",
	})
	c.Assert(zRangeByScore.Err(), IsNil)
	c.Assert(zRangeByScore.Val(), DeepEquals, []string{"one", "two"})

	zRangeByScore = t.client.ZRangeByScore("zset", redis.ZRangeByScore{
		Min: "(1",
		Max: "2",
	})
	c.Assert(zRangeByScore.Err(), IsNil)
	c.Assert(zRangeByScore.Val(), DeepEquals, []string{"two"})

	zRangeByScore = t.client.ZRangeByScore("zset", redis.ZRangeByScore{
		Min: "(1",
		Max: "(2",
	})
	c.Assert(zRangeByScore.Err(), IsNil)
	c.Assert(zRangeByScore.Val(), DeepEquals, []string{})
}

func (t *RedisTest) TestZRangeByScoreWithScoresMap(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{3, "three"})
	c.Assert(zAdd.Err(), IsNil)

	val, err := t.client.ZRangeByScoreWithScores("zset", redis.ZRangeByScore{
		Min: "-inf",
		Max: "+inf",
	}).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{1, "one"}, {2, "two"}, {3, "three"}})

	val, err = t.client.ZRangeByScoreWithScores("zset", redis.ZRangeByScore{
		Min: "1",
		Max: "2",
	}).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{1, "one"}, {2, "two"}})

	val, err = t.client.ZRangeByScoreWithScores("zset", redis.ZRangeByScore{
		Min: "(1",
		Max: "2",
	}).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{2, "two"}})

	val, err = t.client.ZRangeByScoreWithScores("zset", redis.ZRangeByScore{
		Min: "(1",
		Max: "(2",
	}).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{})
}

func (t *RedisTest) TestZRank(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{3, "three"})
	c.Assert(zAdd.Err(), IsNil)

	zRank := t.client.ZRank("zset", "three")
	c.Assert(zRank.Err(), IsNil)
	c.Assert(zRank.Val(), Equals, int64(2))

	zRank = t.client.ZRank("zset", "four")
	c.Assert(zRank.Err(), Equals, redis.Nil)
	c.Assert(zRank.Val(), Equals, int64(0))
}

func (t *RedisTest) TestZRem(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{3, "three"})
	c.Assert(zAdd.Err(), IsNil)

	zRem := t.client.ZRem("zset", "two")
	c.Assert(zRem.Err(), IsNil)
	c.Assert(zRem.Val(), Equals, int64(1))

	val, err := t.client.ZRangeWithScores("zset", 0, -1).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{1, "one"}, {3, "three"}})
}

func (t *RedisTest) TestZRemRangeByRank(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{3, "three"})
	c.Assert(zAdd.Err(), IsNil)

	zRemRangeByRank := t.client.ZRemRangeByRank("zset", 0, 1)
	c.Assert(zRemRangeByRank.Err(), IsNil)
	c.Assert(zRemRangeByRank.Val(), Equals, int64(2))

	val, err := t.client.ZRangeWithScores("zset", 0, -1).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{3, "three"}})
}

func (t *RedisTest) TestZRemRangeByScore(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{3, "three"})
	c.Assert(zAdd.Err(), IsNil)

	zRemRangeByScore := t.client.ZRemRangeByScore("zset", "-inf", "(2")
	c.Assert(zRemRangeByScore.Err(), IsNil)
	c.Assert(zRemRangeByScore.Val(), Equals, int64(1))

	val, err := t.client.ZRangeWithScores("zset", 0, -1).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{2, "two"}, {3, "three"}})
}

func (t *RedisTest) TestZRevRange(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{3, "three"})
	c.Assert(zAdd.Err(), IsNil)

	zRevRange := t.client.ZRevRange("zset", "0", "-1")
	c.Assert(zRevRange.Err(), IsNil)
	c.Assert(zRevRange.Val(), DeepEquals, []string{"three", "two", "one"})

	zRevRange = t.client.ZRevRange("zset", "2", "3")
	c.Assert(zRevRange.Err(), IsNil)
	c.Assert(zRevRange.Val(), DeepEquals, []string{"one"})

	zRevRange = t.client.ZRevRange("zset", "-2", "-1")
	c.Assert(zRevRange.Err(), IsNil)
	c.Assert(zRevRange.Val(), DeepEquals, []string{"two", "one"})
}

func (t *RedisTest) TestZRevRangeWithScoresMap(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{3, "three"})
	c.Assert(zAdd.Err(), IsNil)

	val, err := t.client.ZRevRangeWithScores("zset", "0", "-1").Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{3, "three"}, {2, "two"}, {1, "one"}})

	val, err = t.client.ZRevRangeWithScores("zset", "2", "3").Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{1, "one"}})

	val, err = t.client.ZRevRangeWithScores("zset", "-2", "-1").Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{2, "two"}, {1, "one"}})
}

func (t *RedisTest) TestZRevRangeByScore(c *C) {
	zadd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zadd.Err(), IsNil)
	zadd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zadd.Err(), IsNil)
	zadd = t.client.ZAdd("zset", redis.Z{3, "three"})
	c.Assert(zadd.Err(), IsNil)

	vals, err := t.client.ZRevRangeByScore(
		"zset", redis.ZRangeByScore{Max: "+inf", Min: "-inf"}).Result()
	c.Assert(err, IsNil)
	c.Assert(vals, DeepEquals, []string{"three", "two", "one"})

	vals, err = t.client.ZRevRangeByScore(
		"zset", redis.ZRangeByScore{Max: "2", Min: "(1"}).Result()
	c.Assert(err, IsNil)
	c.Assert(vals, DeepEquals, []string{"two"})

	vals, err = t.client.ZRevRangeByScore(
		"zset", redis.ZRangeByScore{Max: "(2", Min: "(1"}).Result()
	c.Assert(err, IsNil)
	c.Assert(vals, DeepEquals, []string{})
}

func (t *RedisTest) TestZRevRangeByScoreWithScores(c *C) {
	zadd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zadd.Err(), IsNil)
	zadd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zadd.Err(), IsNil)
	zadd = t.client.ZAdd("zset", redis.Z{3, "three"})
	c.Assert(zadd.Err(), IsNil)

	vals, err := t.client.ZRevRangeByScoreWithScores(
		"zset", redis.ZRangeByScore{Max: "+inf", Min: "-inf"}).Result()
	c.Assert(err, IsNil)
	c.Assert(vals, DeepEquals, []redis.Z{{3, "three"}, {2, "two"}, {1, "one"}})
}

func (t *RedisTest) TestZRevRangeByScoreWithScoresMap(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{3, "three"})
	c.Assert(zAdd.Err(), IsNil)

	val, err := t.client.ZRevRangeByScoreWithScores(
		"zset", redis.ZRangeByScore{Max: "+inf", Min: "-inf"}).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{3, "three"}, {2, "two"}, {1, "one"}})

	val, err = t.client.ZRevRangeByScoreWithScores(
		"zset", redis.ZRangeByScore{Max: "2", Min: "(1"}).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{2, "two"}})

	val, err = t.client.ZRevRangeByScoreWithScores(
		"zset", redis.ZRangeByScore{Max: "(2", Min: "(1"}).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{})
}

func (t *RedisTest) TestZRevRank(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset", redis.Z{3, "three"})
	c.Assert(zAdd.Err(), IsNil)

	zRevRank := t.client.ZRevRank("zset", "one")
	c.Assert(zRevRank.Err(), IsNil)
	c.Assert(zRevRank.Val(), Equals, int64(2))

	zRevRank = t.client.ZRevRank("zset", "four")
	c.Assert(zRevRank.Err(), Equals, redis.Nil)
	c.Assert(zRevRank.Val(), Equals, int64(0))
}

func (t *RedisTest) TestZScore(c *C) {
	zAdd := t.client.ZAdd("zset", redis.Z{1.001, "one"})
	c.Assert(zAdd.Err(), IsNil)

	zScore := t.client.ZScore("zset", "one")
	c.Assert(zScore.Err(), IsNil)
	c.Assert(zScore.Val(), Equals, float64(1.001))
}

func (t *RedisTest) TestZUnionStore(c *C) {
	zAdd := t.client.ZAdd("zset1", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset1", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)

	zAdd = t.client.ZAdd("zset2", redis.Z{1, "one"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset2", redis.Z{2, "two"})
	c.Assert(zAdd.Err(), IsNil)
	zAdd = t.client.ZAdd("zset2", redis.Z{3, "three"})
	c.Assert(zAdd.Err(), IsNil)

	zUnionStore := t.client.ZUnionStore(
		"out", redis.ZStore{Weights: []int64{2, 3}}, "zset1", "zset2")
	c.Assert(zUnionStore.Err(), IsNil)
	c.Assert(zUnionStore.Val(), Equals, int64(3))

	val, err := t.client.ZRangeWithScores("out", 0, -1).Result()
	c.Assert(err, IsNil)
	c.Assert(val, DeepEquals, []redis.Z{{5, "one"}, {9, "three"}, {10, "two"}})
}

//------------------------------------------------------------------------------

func (t *RedisTest) TestPatternPubSub(c *C) {
	pubsub := t.client.PubSub()
	defer func() {
		c.Assert(pubsub.Close(), IsNil)
	}()

	c.Assert(pubsub.PSubscribe("mychannel*"), IsNil)

	pub := t.client.Publish("mychannel1", "hello")
	c.Assert(pub.Err(), IsNil)
	c.Assert(pub.Val(), Equals, int64(1))

	c.Assert(pubsub.PUnsubscribe("mychannel*"), IsNil)

	{
		msgi, err := pubsub.ReceiveTimeout(time.Second)
		c.Assert(err, IsNil)
		subscr := msgi.(*redis.Subscription)
		c.Assert(subscr.Kind, Equals, "psubscribe")
		c.Assert(subscr.Channel, Equals, "mychannel*")
		c.Assert(subscr.Count, Equals, 1)
	}

	{
		msgi, err := pubsub.ReceiveTimeout(time.Second)
		c.Assert(err, IsNil)
		subscr := msgi.(*redis.PMessage)
		c.Assert(subscr.Channel, Equals, "mychannel1")
		c.Assert(subscr.Pattern, Equals, "mychannel*")
		c.Assert(subscr.Payload, Equals, "hello")
	}

	{
		msgi, err := pubsub.ReceiveTimeout(time.Second)
		c.Assert(err, IsNil)
		subscr := msgi.(*redis.Subscription)
		c.Assert(subscr.Kind, Equals, "punsubscribe")
		c.Assert(subscr.Channel, Equals, "mychannel*")
		c.Assert(subscr.Count, Equals, 0)
	}

	{
		msgi, err := pubsub.ReceiveTimeout(time.Second)
		c.Assert(err.(net.Error).Timeout(), Equals, true)
		c.Assert(msgi, IsNil)
	}
}

func (t *RedisTest) TestPubSub(c *C) {
	pubsub := t.client.PubSub()
	defer func() {
		c.Assert(pubsub.Close(), IsNil)
	}()

	c.Assert(pubsub.Subscribe("mychannel", "mychannel2"), IsNil)

	pub := t.client.Publish("mychannel", "hello")
	c.Assert(pub.Err(), IsNil)
	c.Assert(pub.Val(), Equals, int64(1))

	pub = t.client.Publish("mychannel2", "hello2")
	c.Assert(pub.Err(), IsNil)
	c.Assert(pub.Val(), Equals, int64(1))

	c.Assert(pubsub.Unsubscribe("mychannel", "mychannel2"), IsNil)

	{
		msgi, err := pubsub.ReceiveTimeout(time.Second)
		c.Assert(err, IsNil)
		subscr := msgi.(*redis.Subscription)
		c.Assert(subscr.Kind, Equals, "subscribe")
		c.Assert(subscr.Channel, Equals, "mychannel")
		c.Assert(subscr.Count, Equals, 1)
	}

	{
		msgi, err := pubsub.ReceiveTimeout(time.Second)
		c.Assert(err, IsNil)
		subscr := msgi.(*redis.Subscription)
		c.Assert(subscr.Kind, Equals, "subscribe")
		c.Assert(subscr.Channel, Equals, "mychannel2")
		c.Assert(subscr.Count, Equals, 2)
	}

	{
		msgi, err := pubsub.ReceiveTimeout(time.Second)
		c.Assert(err, IsNil)
		subscr := msgi.(*redis.Message)
		c.Assert(subscr.Channel, Equals, "mychannel")
		c.Assert(subscr.Payload, Equals, "hello")
	}

	{
		msgi, err := pubsub.ReceiveTimeout(time.Second)
		c.Assert(err, IsNil)
		msg := msgi.(*redis.Message)
		c.Assert(msg.Channel, Equals, "mychannel2")
		c.Assert(msg.Payload, Equals, "hello2")
	}

	{
		msgi, err := pubsub.ReceiveTimeout(time.Second)
		c.Assert(err, IsNil)
		subscr := msgi.(*redis.Subscription)
		c.Assert(subscr.Kind, Equals, "unsubscribe")
		c.Assert(subscr.Channel, Equals, "mychannel")
		c.Assert(subscr.Count, Equals, 1)
	}

	{
		msgi, err := pubsub.ReceiveTimeout(time.Second)
		c.Assert(err, IsNil)
		subscr := msgi.(*redis.Subscription)
		c.Assert(subscr.Kind, Equals, "unsubscribe")
		c.Assert(subscr.Channel, Equals, "mychannel2")
		c.Assert(subscr.Count, Equals, 0)
	}

	{
		msgi, err := pubsub.ReceiveTimeout(time.Second)
		c.Assert(err.(net.Error).Timeout(), Equals, true)
		c.Assert(msgi, IsNil)
	}
}

func (t *RedisTest) TestPubSubChannels(c *C) {
	channels, err := t.client.PubSubChannels("mychannel*").Result()
	c.Assert(err, IsNil)
	c.Assert(channels, HasLen, 0)
	c.Assert(channels, Not(IsNil))

	pubsub := t.client.PubSub()
	defer pubsub.Close()

	c.Assert(pubsub.Subscribe("mychannel", "mychannel2"), IsNil)

	channels, err = t.client.PubSubChannels("mychannel*").Result()
	c.Assert(err, IsNil)
	c.Assert(sortStrings(channels), DeepEquals, []string{"mychannel", "mychannel2"})

	channels, err = t.client.PubSubChannels("").Result()
	c.Assert(err, IsNil)
	c.Assert(channels, HasLen, 0)

	channels, err = t.client.PubSubChannels("*").Result()
	c.Assert(err, IsNil)
	c.Assert(len(channels) >= 2, Equals, true)
}

func (t *RedisTest) TestPubSubNumSub(c *C) {
	pubsub := t.client.PubSub()
	defer pubsub.Close()

	c.Assert(pubsub.Subscribe("mychannel", "mychannel2"), IsNil)

	channels, err := t.client.PubSubNumSub("mychannel", "mychannel2", "mychannel3").Result()
	c.Assert(err, IsNil)
	c.Assert(
		channels,
		DeepEquals,
		[]interface{}{"mychannel", int64(1), "mychannel2", int64(1), "mychannel3", int64(0)},
	)
}

func (t *RedisTest) TestPubSubNumPat(c *C) {
	num, err := t.client.PubSubNumPat().Result()
	c.Assert(err, IsNil)
	c.Assert(num, Equals, int64(0))

	pubsub := t.client.PubSub()
	defer pubsub.Close()

	c.Assert(pubsub.PSubscribe("mychannel*"), IsNil)

	num, err = t.client.PubSubNumPat().Result()
	c.Assert(err, IsNil)
	c.Assert(num, Equals, int64(1))
}

//------------------------------------------------------------------------------

func (t *RedisTest) TestPipeline(c *C) {
	set := t.client.Set("key2", "hello2")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	pipeline := t.client.Pipeline()
	defer func() {
		c.Assert(pipeline.Close(), IsNil)
	}()

	set = pipeline.Set("key1", "hello1")
	get := pipeline.Get("key2")
	incr := pipeline.Incr("key3")
	getNil := pipeline.Get("key4")

	cmds, err := pipeline.Exec()
	c.Assert(err, Equals, redis.Nil)
	c.Assert(cmds, HasLen, 4)

	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "hello2")

	c.Assert(incr.Err(), IsNil)
	c.Assert(incr.Val(), Equals, int64(1))

	c.Assert(getNil.Err(), Equals, redis.Nil)
	c.Assert(getNil.Val(), Equals, "")
}

func (t *RedisTest) TestPipelineDiscardQueued(c *C) {
	pipeline := t.client.Pipeline()

	pipeline.Get("key")
	pipeline.Discard()
	cmds, err := pipeline.Exec()
	c.Assert(err, IsNil)
	c.Assert(cmds, HasLen, 0)

	c.Assert(pipeline.Close(), IsNil)
}

func (t *RedisTest) TestPipelined(c *C) {
	var get *redis.StringCmd
	cmds, err := t.client.Pipelined(func(pipe *redis.Pipeline) error {
		get = pipe.Get("foo")
		return nil
	})
	c.Assert(err, Equals, redis.Nil)
	c.Assert(cmds, HasLen, 1)
	c.Assert(cmds[0], Equals, get)
	c.Assert(get.Err(), Equals, redis.Nil)
	c.Assert(get.Val(), Equals, "")
}

func (t *RedisTest) TestPipelineErrValNotSet(c *C) {
	pipeline := t.client.Pipeline()
	defer func() {
		c.Assert(pipeline.Close(), IsNil)
	}()

	get := pipeline.Get("key")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "")
}

func (t *RedisTest) TestPipelineRunQueuedOnEmptyQueue(c *C) {
	pipeline := t.client.Pipeline()
	defer func() {
		c.Assert(pipeline.Close(), IsNil)
	}()

	cmds, err := pipeline.Exec()
	c.Assert(err, IsNil)
	c.Assert(cmds, HasLen, 0)
}

// TODO: make thread safe?
func (t *RedisTest) TestPipelineIncr(c *C) {
	const N = 20000
	key := "TestPipelineIncr"

	pipeline := t.client.Pipeline()

	wg := &sync.WaitGroup{}
	wg.Add(N)
	for i := 0; i < N; i++ {
		pipeline.Incr(key)
		wg.Done()
	}
	wg.Wait()

	cmds, err := pipeline.Exec()
	c.Assert(err, IsNil)
	c.Assert(len(cmds), Equals, 20000)
	for _, cmd := range cmds {
		if cmd.Err() != nil {
			c.Errorf("got %v, expected nil", cmd.Err())
		}
	}

	get := t.client.Get(key)
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, strconv.Itoa(N))

	c.Assert(pipeline.Close(), IsNil)
}

func (t *RedisTest) TestPipelineEcho(c *C) {
	const N = 1000

	wg := &sync.WaitGroup{}
	wg.Add(N)
	for i := 0; i < N; i++ {
		go func(i int) {
			pipeline := t.client.Pipeline()

			msg1 := "echo" + strconv.Itoa(i)
			msg2 := "echo" + strconv.Itoa(i+1)

			echo1 := pipeline.Echo(msg1)
			echo2 := pipeline.Echo(msg2)

			cmds, err := pipeline.Exec()
			c.Assert(err, IsNil)
			c.Assert(cmds, HasLen, 2)

			c.Assert(echo1.Err(), IsNil)
			c.Assert(echo1.Val(), Equals, msg1)

			c.Assert(echo2.Err(), IsNil)
			c.Assert(echo2.Val(), Equals, msg2)

			c.Assert(pipeline.Close(), IsNil)

			wg.Done()
		}(i)
	}
	wg.Wait()
}

//------------------------------------------------------------------------------

func (t *RedisTest) TestMultiExec(c *C) {
	multi := t.client.Multi()
	defer func() {
		c.Assert(multi.Close(), IsNil)
	}()

	var (
		set *redis.StatusCmd
		get *redis.StringCmd
	)
	cmds, err := multi.Exec(func() error {
		set = multi.Set("key", "hello")
		get = multi.Get("key")
		return nil
	})
	c.Assert(err, IsNil)
	c.Assert(cmds, HasLen, 2)

	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "hello")
}

func (t *RedisTest) TestMultiExecDiscard(c *C) {
	multi := t.client.Multi()
	defer func() {
		c.Assert(multi.Close(), IsNil)
	}()

	cmds, err := multi.Exec(func() error {
		multi.Set("key1", "hello1")
		multi.Discard()
		multi.Set("key2", "hello2")
		return nil
	})
	c.Assert(err, IsNil)
	c.Assert(cmds, HasLen, 1)

	get := t.client.Get("key1")
	c.Assert(get.Err(), Equals, redis.Nil)
	c.Assert(get.Val(), Equals, "")

	get = t.client.Get("key2")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "hello2")
}

func (t *RedisTest) TestMultiExecEmpty(c *C) {
	multi := t.client.Multi()
	defer func() {
		c.Assert(multi.Close(), IsNil)
	}()

	cmds, err := multi.Exec(func() error { return nil })
	c.Assert(err, IsNil)
	c.Assert(cmds, HasLen, 0)

	ping := multi.Ping()
	c.Check(ping.Err(), IsNil)
	c.Check(ping.Val(), Equals, "PONG")
}

func (t *RedisTest) TestMultiExecOnEmptyQueue(c *C) {
	multi := t.client.Multi()
	defer func() {
		c.Assert(multi.Close(), IsNil)
	}()

	cmds, err := multi.Exec(func() error { return nil })
	c.Assert(err, IsNil)
	c.Assert(cmds, HasLen, 0)
}

func (t *RedisTest) TestMultiExecIncr(c *C) {
	multi := t.client.Multi()
	defer func() {
		c.Assert(multi.Close(), IsNil)
	}()

	cmds, err := multi.Exec(func() error {
		for i := int64(0); i < 20000; i++ {
			multi.Incr("key")
		}
		return nil
	})
	c.Assert(err, IsNil)
	c.Assert(len(cmds), Equals, 20000)
	for _, cmd := range cmds {
		if cmd.Err() != nil {
			c.Errorf("got %v, expected nil", cmd.Err())
		}
	}

	get := t.client.Get("key")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Equals, "20000")
}

func (t *RedisTest) transactionalIncr(c *C) ([]redis.Cmder, error) {
	multi := t.client.Multi()
	defer func() {
		c.Assert(multi.Close(), IsNil)
	}()

	watch := multi.Watch("key")
	c.Assert(watch.Err(), IsNil)
	c.Assert(watch.Val(), Equals, "OK")

	get := multi.Get("key")
	c.Assert(get.Err(), IsNil)
	c.Assert(get.Val(), Not(Equals), redis.Nil)

	v, err := strconv.ParseInt(get.Val(), 10, 64)
	c.Assert(err, IsNil)

	return multi.Exec(func() error {
		multi.Set("key", strconv.FormatInt(v+1, 10))
		return nil
	})
}

func (t *RedisTest) TestWatchUnwatch(c *C) {
	var n = 10000
	if testing.Short() {
		n = 1000
	}

	set := t.client.Set("key", "0")
	c.Assert(set.Err(), IsNil)

	wg := &sync.WaitGroup{}
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				cmds, err := t.transactionalIncr(c)
				if err == redis.TxFailedErr {
					continue
				}
				c.Assert(err, IsNil)
				c.Assert(cmds, HasLen, 1)
				c.Assert(cmds[0].Err(), IsNil)
				break
			}
		}()
	}
	wg.Wait()

	val, err := t.client.Get("key").Int64()
	c.Assert(err, IsNil)
	c.Assert(val, Equals, int64(n))
}

//------------------------------------------------------------------------------

func (t *RedisTest) TestRaceEcho(c *C) {
	var n = 10000
	if testing.Short() {
		n = 1000
	}

	wg := &sync.WaitGroup{}
	wg.Add(n)
	for i := 0; i < n; i++ {
		go func(i int) {
			msg := "echo" + strconv.Itoa(i)
			echo := t.client.Echo(msg)
			c.Assert(echo.Err(), IsNil)
			c.Assert(echo.Val(), Equals, msg)
			wg.Done()
		}(i)
	}
	wg.Wait()
}

func (t *RedisTest) TestRaceIncr(c *C) {
	var n = 10000
	if testing.Short() {
		n = 1000
	}

	wg := &sync.WaitGroup{}
	wg.Add(n)
	for i := 0; i < n; i++ {
		go func() {
			incr := t.client.Incr("TestRaceIncr")
			if err := incr.Err(); err != nil {
				panic(err)
			}
			wg.Done()
		}()
	}
	wg.Wait()

	val, err := t.client.Get("TestRaceIncr").Result()
	c.Assert(err, IsNil)
	c.Assert(val, Equals, strconv.Itoa(n))
}

//------------------------------------------------------------------------------

func (t *RedisTest) TestCmdBgRewriteAOF(c *C) {
	r := t.client.BgRewriteAOF()
	c.Assert(r.Err(), IsNil)
	c.Assert(r.Val(), Equals, "Background append only file rewriting started")
}

func (t *RedisTest) TestCmdBgSave(c *C) {
	// workaround for "ERR Can't BGSAVE while AOF log rewriting is in progress"
	time.Sleep(time.Second)

	r := t.client.BgSave()
	c.Assert(r.Err(), IsNil)
	c.Assert(r.Val(), Equals, "Background saving started")
}

func (t *RedisTest) TestCmdClientKill(c *C) {
	r := t.client.ClientKill("1.1.1.1:1111")
	c.Assert(r.Err(), ErrorMatches, "ERR No such client")
	c.Assert(r.Val(), Equals, "")
}

func (t *RedisTest) TestCmdConfigGet(c *C) {
	r := t.client.ConfigGet("*")
	c.Assert(r.Err(), IsNil)
	c.Assert(len(r.Val()) > 0, Equals, true)
}

func (t *RedisTest) TestCmdConfigResetStat(c *C) {
	r := t.client.ConfigResetStat()
	c.Assert(r.Err(), IsNil)
	c.Assert(r.Val(), Equals, "OK")
}

func (t *RedisTest) TestCmdConfigSet(c *C) {
	configGet := t.client.ConfigGet("maxmemory")
	c.Assert(configGet.Err(), IsNil)
	c.Assert(configGet.Val(), HasLen, 2)
	c.Assert(configGet.Val()[0], Equals, "maxmemory")

	configSet := t.client.ConfigSet("maxmemory", configGet.Val()[1].(string))
	c.Assert(configSet.Err(), IsNil)
	c.Assert(configSet.Val(), Equals, "OK")
}

func (t *RedisTest) TestCmdDbSize(c *C) {
	dbSize := t.client.DbSize()
	c.Assert(dbSize.Err(), IsNil)
	c.Assert(dbSize.Val(), Equals, int64(0))
}

func (t *RedisTest) TestCmdFlushAll(c *C) {
	// TODO
}

func (t *RedisTest) TestCmdFlushDb(c *C) {
	// TODO
}

func (t *RedisTest) TestCmdInfo(c *C) {
	info := t.client.Info()
	c.Assert(info.Err(), IsNil)
	c.Assert(info.Val(), Not(Equals), "")
}

func (t *RedisTest) TestCmdLastSave(c *C) {
	lastSave := t.client.LastSave()
	c.Assert(lastSave.Err(), IsNil)
	c.Assert(lastSave.Val(), Not(Equals), 0)
}

func (t *RedisTest) TestCmdSave(c *C) {
	save := t.client.Save()
	c.Assert(save.Err(), IsNil)
	c.Assert(save.Val(), Equals, "OK")
}

func (t *RedisTest) TestSlaveOf(c *C) {
	slaveOf := t.client.SlaveOf("localhost", "8888")
	c.Assert(slaveOf.Err(), IsNil)
	c.Assert(slaveOf.Val(), Equals, "OK")

	slaveOf = t.client.SlaveOf("NO", "ONE")
	c.Assert(slaveOf.Err(), IsNil)
	c.Assert(slaveOf.Val(), Equals, "OK")
}

func (t *RedisTest) TestTime(c *C) {
	time := t.client.Time()
	c.Assert(time.Err(), IsNil)
	c.Assert(time.Val(), HasLen, 2)
}

//------------------------------------------------------------------------------

func (t *RedisTest) TestScriptingEval(c *C) {
	eval := t.client.Eval(
		"return {KEYS[1],KEYS[2],ARGV[1],ARGV[2]}",
		[]string{"key1", "key2"},
		[]string{"first", "second"},
	)
	c.Assert(eval.Err(), IsNil)
	c.Assert(eval.Val(), DeepEquals, []interface{}{"key1", "key2", "first", "second"})

	eval = t.client.Eval(
		"return redis.call('set',KEYS[1],'bar')",
		[]string{"foo"},
		[]string{},
	)
	c.Assert(eval.Err(), IsNil)
	c.Assert(eval.Val(), Equals, "OK")

	eval = t.client.Eval("return 10", []string{}, []string{})
	c.Assert(eval.Err(), IsNil)
	c.Assert(eval.Val(), Equals, int64(10))

	eval = t.client.Eval("return {1,2,{3,'Hello World!'}}", []string{}, []string{})
	c.Assert(eval.Err(), IsNil)
	// DeepEquals can't compare nested slices.
	c.Assert(
		fmt.Sprintf("%#v", eval.Val()),
		Equals,
		`[]interface {}{1, 2, []interface {}{3, "Hello World!"}}`,
	)
}

func (t *RedisTest) TestScriptingEvalSha(c *C) {
	set := t.client.Set("foo", "bar")
	c.Assert(set.Err(), IsNil)
	c.Assert(set.Val(), Equals, "OK")

	eval := t.client.Eval("return redis.call('get','foo')", nil, nil)
	c.Assert(eval.Err(), IsNil)
	c.Assert(eval.Val(), Equals, "bar")

	evalSha := t.client.EvalSha("6b1bf486c81ceb7edf3c093f4c48582e38c0e791", nil, nil)
	c.Assert(evalSha.Err(), IsNil)
	c.Assert(evalSha.Val(), Equals, "bar")

	evalSha = t.client.EvalSha("ffffffffffffffffffffffffffffffffffffffff", nil, nil)
	c.Assert(evalSha.Err(), ErrorMatches, "NOSCRIPT No matching script. Please use EVAL.")
	c.Assert(evalSha.Val(), Equals, nil)
}

func (t *RedisTest) TestScriptingScriptExists(c *C) {
	scriptLoad := t.client.ScriptLoad("return 1")
	c.Assert(scriptLoad.Err(), IsNil)
	c.Assert(scriptLoad.Val(), Equals, "e0e1f9fabfc9d4800c877a703b823ac0578ff8db")

	scriptExists := t.client.ScriptExists(
		"e0e1f9fabfc9d4800c877a703b823ac0578ff8db",
		"ffffffffffffffffffffffffffffffffffffffff",
	)
	c.Assert(scriptExists.Err(), IsNil)
	c.Assert(scriptExists.Val(), DeepEquals, []bool{true, false})
}

func (t *RedisTest) TestScriptingScriptFlush(c *C) {
	scriptFlush := t.client.ScriptFlush()
	c.Assert(scriptFlush.Err(), IsNil)
	c.Assert(scriptFlush.Val(), Equals, "OK")
}

func (t *RedisTest) TestScriptingScriptKill(c *C) {
	scriptKill := t.client.ScriptKill()
	c.Assert(scriptKill.Err(), ErrorMatches, ".*No scripts in execution right now.")
	c.Assert(scriptKill.Val(), Equals, "")
}

func (t *RedisTest) TestScriptingScriptLoad(c *C) {
	scriptLoad := t.client.ScriptLoad("return redis.call('get','foo')")
	c.Assert(scriptLoad.Err(), IsNil)
	c.Assert(scriptLoad.Val(), Equals, "6b1bf486c81ceb7edf3c093f4c48582e38c0e791")
}

func (t *RedisTest) TestScriptingNewScript(c *C) {
	s := redis.NewScript("return 1")
	run := s.Run(t.client, nil, nil)
	c.Assert(run.Err(), IsNil)
	c.Assert(run.Val(), Equals, int64(1))
}

func (t *RedisTest) TestScriptingEvalAndPipeline(c *C) {
	pipeline := t.client.Pipeline()
	s := redis.NewScript("return 1")
	run := s.Eval(pipeline, nil, nil)
	_, err := pipeline.Exec()
	c.Assert(err, IsNil)
	c.Assert(run.Err(), IsNil)
	c.Assert(run.Val(), Equals, int64(1))
}

func (t *RedisTest) TestScriptingEvalShaAndPipeline(c *C) {
	s := redis.NewScript("return 1")
	c.Assert(s.Load(t.client).Err(), IsNil)

	pipeline := t.client.Pipeline()
	run := s.Eval(pipeline, nil, nil)
	_, err := pipeline.Exec()
	c.Assert(err, IsNil)
	c.Assert(run.Err(), IsNil)
	c.Assert(run.Val(), Equals, int64(1))
}

//------------------------------------------------------------------------------

func (t *RedisTest) TestCmdDebugObject(c *C) {
	{
		debug := t.client.DebugObject("foo")
		c.Assert(debug.Err(), Not(IsNil))
		c.Assert(debug.Err().Error(), Equals, "ERR no such key")
	}

	{
		t.client.Set("foo", "bar")
		debug := t.client.DebugObject("foo")
		c.Assert(debug.Err(), IsNil)
		c.Assert(debug.Val(), FitsTypeOf, "")
		c.Assert(debug.Val(), Not(Equals), "")
	}
}

//------------------------------------------------------------------------------

func BenchmarkRedisPing(b *testing.B) {
	b.StopTimer()
	client := redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
	})
	b.StartTimer()

	for i := 0; i < b.N; i++ {
		if err := client.Ping().Err(); err != nil {
			panic(err)
		}
	}
}

func BenchmarkRedisSet(b *testing.B) {
	b.StopTimer()
	client := redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
	})
	b.StartTimer()

	for i := 0; i < b.N; i++ {
		if err := client.Set("key", "hello").Err(); err != nil {
			panic(err)
		}
	}
}

func BenchmarkRedisGetNil(b *testing.B) {
	b.StopTimer()
	client := redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
	})
	if err := client.FlushDb().Err(); err != nil {
		b.Fatal(err)
	}
	b.StartTimer()

	for i := 0; i < b.N; i++ {
		if err := client.Get("key").Err(); err != redis.Nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkRedisGet(b *testing.B) {
	b.StopTimer()
	client := redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
	})
	if err := client.Set("key", "hello").Err(); err != nil {
		b.Fatal(err)
	}
	b.StartTimer()

	for i := 0; i < b.N; i++ {
		if err := client.Get("key").Err(); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkRedisMGet(b *testing.B) {
	b.StopTimer()
	client := redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
	})
	if err := client.MSet("key1", "hello1", "key2", "hello2").Err(); err != nil {
		b.Fatal(err)
	}
	b.StartTimer()

	for i := 0; i < b.N; i++ {
		if err := client.MGet("key1", "key2").Err(); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkSetExpire(b *testing.B) {
	b.StopTimer()
	client := redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
	})
	b.StartTimer()

	for i := 0; i < b.N; i++ {
		if err := client.Set("key", "hello").Err(); err != nil {
			b.Fatal(err)
		}
		if err := client.Expire("key", time.Second).Err(); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkPipeline(b *testing.B) {
	b.StopTimer()
	client := redis.NewTCPClient(&redis.Options{
		Addr: redisAddr,
	})
	b.StartTimer()

	for i := 0; i < b.N; i++ {
		_, err := client.Pipelined(func(pipe *redis.Pipeline) error {
			pipe.Set("key", "hello")
			pipe.Expire("key", time.Second)
			return nil
		})
		if err != nil {
			b.Fatal(err)
		}
	}
}
