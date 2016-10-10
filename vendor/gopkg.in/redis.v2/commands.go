package redis

import (
	"io"
	"strconv"
	"time"
)

func formatFloat(f float64) string {
	return strconv.FormatFloat(f, 'f', -1, 64)
}

func readTimeout(sec int64) time.Duration {
	if sec == 0 {
		return 0
	}
	return time.Duration(sec+1) * time.Second
}

//------------------------------------------------------------------------------

func (c *Client) Auth(password string) *StatusCmd {
	cmd := NewStatusCmd("AUTH", password)
	c.Process(cmd)
	return cmd
}

func (c *Client) Echo(message string) *StringCmd {
	cmd := NewStringCmd("ECHO", message)
	c.Process(cmd)
	return cmd
}

func (c *Client) Ping() *StatusCmd {
	cmd := NewStatusCmd("PING")
	c.Process(cmd)
	return cmd
}

func (c *Client) Quit() *StatusCmd {
	panic("not implemented")
}

func (c *Client) Select(index int64) *StatusCmd {
	cmd := NewStatusCmd("SELECT", strconv.FormatInt(index, 10))
	c.Process(cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c *Client) Del(keys ...string) *IntCmd {
	args := append([]string{"DEL"}, keys...)
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) Dump(key string) *StringCmd {
	cmd := NewStringCmd("DUMP", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) Exists(key string) *BoolCmd {
	cmd := NewBoolCmd("EXISTS", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) Expire(key string, dur time.Duration) *BoolCmd {
	cmd := NewBoolCmd("EXPIRE", key, strconv.FormatInt(int64(dur/time.Second), 10))
	c.Process(cmd)
	return cmd
}

func (c *Client) ExpireAt(key string, tm time.Time) *BoolCmd {
	cmd := NewBoolCmd("EXPIREAT", key, strconv.FormatInt(tm.Unix(), 10))
	c.Process(cmd)
	return cmd
}

func (c *Client) Keys(pattern string) *StringSliceCmd {
	cmd := NewStringSliceCmd("KEYS", pattern)
	c.Process(cmd)
	return cmd
}

func (c *Client) Migrate(host, port, key string, db, timeout int64) *StatusCmd {
	cmd := NewStatusCmd(
		"MIGRATE",
		host,
		port,
		key,
		strconv.FormatInt(db, 10),
		strconv.FormatInt(timeout, 10),
	)
	cmd.setReadTimeout(readTimeout(timeout))
	c.Process(cmd)
	return cmd
}

func (c *Client) Move(key string, db int64) *BoolCmd {
	cmd := NewBoolCmd("MOVE", key, strconv.FormatInt(db, 10))
	c.Process(cmd)
	return cmd
}

func (c *Client) ObjectRefCount(keys ...string) *IntCmd {
	args := append([]string{"OBJECT", "REFCOUNT"}, keys...)
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) ObjectEncoding(keys ...string) *StringCmd {
	args := append([]string{"OBJECT", "ENCODING"}, keys...)
	cmd := NewStringCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) ObjectIdleTime(keys ...string) *DurationCmd {
	args := append([]string{"OBJECT", "IDLETIME"}, keys...)
	cmd := NewDurationCmd(time.Second, args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) Persist(key string) *BoolCmd {
	cmd := NewBoolCmd("PERSIST", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) PExpire(key string, dur time.Duration) *BoolCmd {
	cmd := NewBoolCmd("PEXPIRE", key, strconv.FormatInt(int64(dur/time.Millisecond), 10))
	c.Process(cmd)
	return cmd
}

func (c *Client) PExpireAt(key string, tm time.Time) *BoolCmd {
	cmd := NewBoolCmd(
		"PEXPIREAT",
		key,
		strconv.FormatInt(tm.UnixNano()/int64(time.Millisecond), 10),
	)
	c.Process(cmd)
	return cmd
}

func (c *Client) PTTL(key string) *DurationCmd {
	cmd := NewDurationCmd(time.Millisecond, "PTTL", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) RandomKey() *StringCmd {
	cmd := NewStringCmd("RANDOMKEY")
	c.Process(cmd)
	return cmd
}

func (c *Client) Rename(key, newkey string) *StatusCmd {
	cmd := NewStatusCmd("RENAME", key, newkey)
	c.Process(cmd)
	return cmd
}

func (c *Client) RenameNX(key, newkey string) *BoolCmd {
	cmd := NewBoolCmd("RENAMENX", key, newkey)
	c.Process(cmd)
	return cmd
}

func (c *Client) Restore(key string, ttl int64, value string) *StatusCmd {
	cmd := NewStatusCmd(
		"RESTORE",
		key,
		strconv.FormatInt(ttl, 10),
		value,
	)
	c.Process(cmd)
	return cmd
}

type Sort struct {
	By            string
	Offset, Count float64
	Get           []string
	Order         string
	IsAlpha       bool
	Store         string
}

func (c *Client) Sort(key string, sort Sort) *StringSliceCmd {
	args := []string{"SORT", key}
	if sort.By != "" {
		args = append(args, "BY", sort.By)
	}
	if sort.Offset != 0 || sort.Count != 0 {
		args = append(args, "LIMIT", formatFloat(sort.Offset), formatFloat(sort.Count))
	}
	for _, get := range sort.Get {
		args = append(args, "GET", get)
	}
	if sort.Order != "" {
		args = append(args, sort.Order)
	}
	if sort.IsAlpha {
		args = append(args, "ALPHA")
	}
	if sort.Store != "" {
		args = append(args, "STORE", sort.Store)
	}
	cmd := NewStringSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) TTL(key string) *DurationCmd {
	cmd := NewDurationCmd(time.Second, "TTL", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) Type(key string) *StatusCmd {
	cmd := NewStatusCmd("TYPE", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) Scan(cursor int64, match string, count int64) *ScanCmd {
	args := []string{"SCAN", strconv.FormatInt(cursor, 10)}
	if match != "" {
		args = append(args, "MATCH", match)
	}
	if count > 0 {
		args = append(args, "COUNT", strconv.FormatInt(count, 10))
	}
	cmd := NewScanCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) SScan(key string, cursor int64, match string, count int64) *ScanCmd {
	args := []string{"SSCAN", key, strconv.FormatInt(cursor, 10)}
	if match != "" {
		args = append(args, "MATCH", match)
	}
	if count > 0 {
		args = append(args, "COUNT", strconv.FormatInt(count, 10))
	}
	cmd := NewScanCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) HScan(key string, cursor int64, match string, count int64) *ScanCmd {
	args := []string{"HSCAN", key, strconv.FormatInt(cursor, 10)}
	if match != "" {
		args = append(args, "MATCH", match)
	}
	if count > 0 {
		args = append(args, "COUNT", strconv.FormatInt(count, 10))
	}
	cmd := NewScanCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZScan(key string, cursor int64, match string, count int64) *ScanCmd {
	args := []string{"ZSCAN", key, strconv.FormatInt(cursor, 10)}
	if match != "" {
		args = append(args, "MATCH", match)
	}
	if count > 0 {
		args = append(args, "COUNT", strconv.FormatInt(count, 10))
	}
	cmd := NewScanCmd(args...)
	c.Process(cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c *Client) Append(key, value string) *IntCmd {
	cmd := NewIntCmd("APPEND", key, value)
	c.Process(cmd)
	return cmd
}

type BitCount struct {
	Start, End int64
}

func (c *Client) BitCount(key string, bitCount *BitCount) *IntCmd {
	args := []string{"BITCOUNT", key}
	if bitCount != nil {
		args = append(
			args,
			strconv.FormatInt(bitCount.Start, 10),
			strconv.FormatInt(bitCount.End, 10),
		)
	}
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) bitOp(op, destKey string, keys ...string) *IntCmd {
	args := []string{"BITOP", op, destKey}
	args = append(args, keys...)
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) BitOpAnd(destKey string, keys ...string) *IntCmd {
	return c.bitOp("AND", destKey, keys...)
}

func (c *Client) BitOpOr(destKey string, keys ...string) *IntCmd {
	return c.bitOp("OR", destKey, keys...)
}

func (c *Client) BitOpXor(destKey string, keys ...string) *IntCmd {
	return c.bitOp("XOR", destKey, keys...)
}

func (c *Client) BitOpNot(destKey string, key string) *IntCmd {
	return c.bitOp("NOT", destKey, key)
}

func (c *Client) Decr(key string) *IntCmd {
	cmd := NewIntCmd("DECR", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) DecrBy(key string, decrement int64) *IntCmd {
	cmd := NewIntCmd("DECRBY", key, strconv.FormatInt(decrement, 10))
	c.Process(cmd)
	return cmd
}

func (c *Client) Get(key string) *StringCmd {
	cmd := NewStringCmd("GET", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) GetBit(key string, offset int64) *IntCmd {
	cmd := NewIntCmd("GETBIT", key, strconv.FormatInt(offset, 10))
	c.Process(cmd)
	return cmd
}

func (c *Client) GetRange(key string, start, end int64) *StringCmd {
	cmd := NewStringCmd(
		"GETRANGE",
		key,
		strconv.FormatInt(start, 10),
		strconv.FormatInt(end, 10),
	)
	c.Process(cmd)
	return cmd
}

func (c *Client) GetSet(key, value string) *StringCmd {
	cmd := NewStringCmd("GETSET", key, value)
	c.Process(cmd)
	return cmd
}

func (c *Client) Incr(key string) *IntCmd {
	cmd := NewIntCmd("INCR", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) IncrBy(key string, value int64) *IntCmd {
	cmd := NewIntCmd("INCRBY", key, strconv.FormatInt(value, 10))
	c.Process(cmd)
	return cmd
}

func (c *Client) IncrByFloat(key string, value float64) *FloatCmd {
	cmd := NewFloatCmd("INCRBYFLOAT", key, formatFloat(value))
	c.Process(cmd)
	return cmd
}

func (c *Client) MGet(keys ...string) *SliceCmd {
	args := append([]string{"MGET"}, keys...)
	cmd := NewSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) MSet(pairs ...string) *StatusCmd {
	args := append([]string{"MSET"}, pairs...)
	cmd := NewStatusCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) MSetNX(pairs ...string) *BoolCmd {
	args := append([]string{"MSETNX"}, pairs...)
	cmd := NewBoolCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) PSetEx(key string, dur time.Duration, value string) *StatusCmd {
	cmd := NewStatusCmd(
		"PSETEX",
		key,
		strconv.FormatInt(int64(dur/time.Millisecond), 10),
		value,
	)
	c.Process(cmd)
	return cmd
}

func (c *Client) Set(key, value string) *StatusCmd {
	cmd := NewStatusCmd("SET", key, value)
	c.Process(cmd)
	return cmd
}

func (c *Client) SetBit(key string, offset int64, value int) *IntCmd {
	cmd := NewIntCmd(
		"SETBIT",
		key,
		strconv.FormatInt(offset, 10),
		strconv.FormatInt(int64(value), 10),
	)
	c.Process(cmd)
	return cmd
}

func (c *Client) SetEx(key string, dur time.Duration, value string) *StatusCmd {
	cmd := NewStatusCmd("SETEX", key, strconv.FormatInt(int64(dur/time.Second), 10), value)
	c.Process(cmd)
	return cmd
}

func (c *Client) SetNX(key, value string) *BoolCmd {
	cmd := NewBoolCmd("SETNX", key, value)
	c.Process(cmd)
	return cmd
}

func (c *Client) SetRange(key string, offset int64, value string) *IntCmd {
	cmd := NewIntCmd("SETRANGE", key, strconv.FormatInt(offset, 10), value)
	c.Process(cmd)
	return cmd
}

func (c *Client) StrLen(key string) *IntCmd {
	cmd := NewIntCmd("STRLEN", key)
	c.Process(cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c *Client) HDel(key string, fields ...string) *IntCmd {
	args := append([]string{"HDEL", key}, fields...)
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) HExists(key, field string) *BoolCmd {
	cmd := NewBoolCmd("HEXISTS", key, field)
	c.Process(cmd)
	return cmd
}

func (c *Client) HGet(key, field string) *StringCmd {
	cmd := NewStringCmd("HGET", key, field)
	c.Process(cmd)
	return cmd
}

func (c *Client) HGetAll(key string) *StringSliceCmd {
	cmd := NewStringSliceCmd("HGETALL", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) HGetAllMap(key string) *StringStringMapCmd {
	cmd := NewStringStringMapCmd("HGETALL", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) HIncrBy(key, field string, incr int64) *IntCmd {
	cmd := NewIntCmd("HINCRBY", key, field, strconv.FormatInt(incr, 10))
	c.Process(cmd)
	return cmd
}

func (c *Client) HIncrByFloat(key, field string, incr float64) *FloatCmd {
	cmd := NewFloatCmd("HINCRBYFLOAT", key, field, formatFloat(incr))
	c.Process(cmd)
	return cmd
}

func (c *Client) HKeys(key string) *StringSliceCmd {
	cmd := NewStringSliceCmd("HKEYS", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) HLen(key string) *IntCmd {
	cmd := NewIntCmd("HLEN", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) HMGet(key string, fields ...string) *SliceCmd {
	args := append([]string{"HMGET", key}, fields...)
	cmd := NewSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) HMSet(key, field, value string, pairs ...string) *StatusCmd {
	args := append([]string{"HMSET", key, field, value}, pairs...)
	cmd := NewStatusCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) HSet(key, field, value string) *BoolCmd {
	cmd := NewBoolCmd("HSET", key, field, value)
	c.Process(cmd)
	return cmd
}

func (c *Client) HSetNX(key, field, value string) *BoolCmd {
	cmd := NewBoolCmd("HSETNX", key, field, value)
	c.Process(cmd)
	return cmd
}

func (c *Client) HVals(key string) *StringSliceCmd {
	cmd := NewStringSliceCmd("HVALS", key)
	c.Process(cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c *Client) BLPop(timeout int64, keys ...string) *StringSliceCmd {
	args := append([]string{"BLPOP"}, keys...)
	args = append(args, strconv.FormatInt(timeout, 10))
	cmd := NewStringSliceCmd(args...)
	cmd.setReadTimeout(readTimeout(timeout))
	c.Process(cmd)
	return cmd
}

func (c *Client) BRPop(timeout int64, keys ...string) *StringSliceCmd {
	args := append([]string{"BRPOP"}, keys...)
	args = append(args, strconv.FormatInt(timeout, 10))
	cmd := NewStringSliceCmd(args...)
	cmd.setReadTimeout(readTimeout(timeout))
	c.Process(cmd)
	return cmd
}

func (c *Client) BRPopLPush(source, destination string, timeout int64) *StringCmd {
	cmd := NewStringCmd(
		"BRPOPLPUSH",
		source,
		destination,
		strconv.FormatInt(timeout, 10),
	)
	cmd.setReadTimeout(readTimeout(timeout))
	c.Process(cmd)
	return cmd
}

func (c *Client) LIndex(key string, index int64) *StringCmd {
	cmd := NewStringCmd("LINDEX", key, strconv.FormatInt(index, 10))
	c.Process(cmd)
	return cmd
}

func (c *Client) LInsert(key, op, pivot, value string) *IntCmd {
	cmd := NewIntCmd("LINSERT", key, op, pivot, value)
	c.Process(cmd)
	return cmd
}

func (c *Client) LLen(key string) *IntCmd {
	cmd := NewIntCmd("LLEN", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) LPop(key string) *StringCmd {
	cmd := NewStringCmd("LPOP", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) LPush(key string, values ...string) *IntCmd {
	args := append([]string{"LPUSH", key}, values...)
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) LPushX(key, value string) *IntCmd {
	cmd := NewIntCmd("LPUSHX", key, value)
	c.Process(cmd)
	return cmd
}

func (c *Client) LRange(key string, start, stop int64) *StringSliceCmd {
	cmd := NewStringSliceCmd(
		"LRANGE",
		key,
		strconv.FormatInt(start, 10),
		strconv.FormatInt(stop, 10),
	)
	c.Process(cmd)
	return cmd
}

func (c *Client) LRem(key string, count int64, value string) *IntCmd {
	cmd := NewIntCmd("LREM", key, strconv.FormatInt(count, 10), value)
	c.Process(cmd)
	return cmd
}

func (c *Client) LSet(key string, index int64, value string) *StatusCmd {
	cmd := NewStatusCmd("LSET", key, strconv.FormatInt(index, 10), value)
	c.Process(cmd)
	return cmd
}

func (c *Client) LTrim(key string, start, stop int64) *StatusCmd {
	cmd := NewStatusCmd(
		"LTRIM",
		key,
		strconv.FormatInt(start, 10),
		strconv.FormatInt(stop, 10),
	)
	c.Process(cmd)
	return cmd
}

func (c *Client) RPop(key string) *StringCmd {
	cmd := NewStringCmd("RPOP", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) RPopLPush(source, destination string) *StringCmd {
	cmd := NewStringCmd("RPOPLPUSH", source, destination)
	c.Process(cmd)
	return cmd
}

func (c *Client) RPush(key string, values ...string) *IntCmd {
	args := append([]string{"RPUSH", key}, values...)
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) RPushX(key string, value string) *IntCmd {
	cmd := NewIntCmd("RPUSHX", key, value)
	c.Process(cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c *Client) SAdd(key string, members ...string) *IntCmd {
	args := append([]string{"SADD", key}, members...)
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) SCard(key string) *IntCmd {
	cmd := NewIntCmd("SCARD", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) SDiff(keys ...string) *StringSliceCmd {
	args := append([]string{"SDIFF"}, keys...)
	cmd := NewStringSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) SDiffStore(destination string, keys ...string) *IntCmd {
	args := append([]string{"SDIFFSTORE", destination}, keys...)
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) SInter(keys ...string) *StringSliceCmd {
	args := append([]string{"SINTER"}, keys...)
	cmd := NewStringSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) SInterStore(destination string, keys ...string) *IntCmd {
	args := append([]string{"SINTERSTORE", destination}, keys...)
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) SIsMember(key, member string) *BoolCmd {
	cmd := NewBoolCmd("SISMEMBER", key, member)
	c.Process(cmd)
	return cmd
}

func (c *Client) SMembers(key string) *StringSliceCmd {
	cmd := NewStringSliceCmd("SMEMBERS", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) SMove(source, destination, member string) *BoolCmd {
	cmd := NewBoolCmd("SMOVE", source, destination, member)
	c.Process(cmd)
	return cmd
}

func (c *Client) SPop(key string) *StringCmd {
	cmd := NewStringCmd("SPOP", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) SRandMember(key string) *StringCmd {
	cmd := NewStringCmd("SRANDMEMBER", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) SRem(key string, members ...string) *IntCmd {
	args := append([]string{"SREM", key}, members...)
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) SUnion(keys ...string) *StringSliceCmd {
	args := append([]string{"SUNION"}, keys...)
	cmd := NewStringSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) SUnionStore(destination string, keys ...string) *IntCmd {
	args := append([]string{"SUNIONSTORE", destination}, keys...)
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

//------------------------------------------------------------------------------

type Z struct {
	Score  float64
	Member string
}

type ZStore struct {
	Weights   []int64
	Aggregate string
}

func (c *Client) ZAdd(key string, members ...Z) *IntCmd {
	args := []string{"ZADD", key}
	for _, m := range members {
		args = append(args, formatFloat(m.Score), m.Member)
	}
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZCard(key string) *IntCmd {
	cmd := NewIntCmd("ZCARD", key)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZCount(key, min, max string) *IntCmd {
	cmd := NewIntCmd("ZCOUNT", key, min, max)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZIncrBy(key string, increment float64, member string) *FloatCmd {
	cmd := NewFloatCmd("ZINCRBY", key, formatFloat(increment), member)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZInterStore(
	destination string,
	store ZStore,
	keys ...string,
) *IntCmd {
	args := []string{"ZINTERSTORE", destination, strconv.FormatInt(int64(len(keys)), 10)}
	args = append(args, keys...)
	if len(store.Weights) > 0 {
		args = append(args, "WEIGHTS")
		for _, weight := range store.Weights {
			args = append(args, strconv.FormatInt(weight, 10))
		}
	}
	if store.Aggregate != "" {
		args = append(args, "AGGREGATE", store.Aggregate)
	}
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) zRange(key string, start, stop int64, withScores bool) *StringSliceCmd {
	args := []string{
		"ZRANGE",
		key,
		strconv.FormatInt(start, 10),
		strconv.FormatInt(stop, 10),
	}
	if withScores {
		args = append(args, "WITHSCORES")
	}
	cmd := NewStringSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZRange(key string, start, stop int64) *StringSliceCmd {
	return c.zRange(key, start, stop, false)
}

func (c *Client) ZRangeWithScores(key string, start, stop int64) *ZSliceCmd {
	args := []string{
		"ZRANGE",
		key,
		strconv.FormatInt(start, 10),
		strconv.FormatInt(stop, 10),
		"WITHSCORES",
	}
	cmd := NewZSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

type ZRangeByScore struct {
	Min, Max string

	Offset, Count int64
}

func (c *Client) zRangeByScore(key string, opt ZRangeByScore, withScores bool) *StringSliceCmd {
	args := []string{"ZRANGEBYSCORE", key, opt.Min, opt.Max}
	if withScores {
		args = append(args, "WITHSCORES")
	}
	if opt.Offset != 0 || opt.Count != 0 {
		args = append(
			args,
			"LIMIT",
			strconv.FormatInt(opt.Offset, 10),
			strconv.FormatInt(opt.Count, 10),
		)
	}
	cmd := NewStringSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZRangeByScore(key string, opt ZRangeByScore) *StringSliceCmd {
	return c.zRangeByScore(key, opt, false)
}

func (c *Client) ZRangeByScoreWithScores(key string, opt ZRangeByScore) *ZSliceCmd {
	args := []string{"ZRANGEBYSCORE", key, opt.Min, opt.Max, "WITHSCORES"}
	if opt.Offset != 0 || opt.Count != 0 {
		args = append(
			args,
			"LIMIT",
			strconv.FormatInt(opt.Offset, 10),
			strconv.FormatInt(opt.Count, 10),
		)
	}
	cmd := NewZSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZRank(key, member string) *IntCmd {
	cmd := NewIntCmd("ZRANK", key, member)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZRem(key string, members ...string) *IntCmd {
	args := append([]string{"ZREM", key}, members...)
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZRemRangeByRank(key string, start, stop int64) *IntCmd {
	cmd := NewIntCmd(
		"ZREMRANGEBYRANK",
		key,
		strconv.FormatInt(start, 10),
		strconv.FormatInt(stop, 10),
	)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZRemRangeByScore(key, min, max string) *IntCmd {
	cmd := NewIntCmd("ZREMRANGEBYSCORE", key, min, max)
	c.Process(cmd)
	return cmd
}

func (c *Client) zRevRange(key, start, stop string, withScores bool) *StringSliceCmd {
	args := []string{"ZREVRANGE", key, start, stop}
	if withScores {
		args = append(args, "WITHSCORES")
	}
	cmd := NewStringSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZRevRange(key, start, stop string) *StringSliceCmd {
	return c.zRevRange(key, start, stop, false)
}

func (c *Client) ZRevRangeWithScores(key, start, stop string) *ZSliceCmd {
	args := []string{"ZREVRANGE", key, start, stop, "WITHSCORES"}
	cmd := NewZSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) zRevRangeByScore(key string, opt ZRangeByScore, withScores bool) *StringSliceCmd {
	args := []string{"ZREVRANGEBYSCORE", key, opt.Max, opt.Min}
	if withScores {
		args = append(args, "WITHSCORES")
	}
	if opt.Offset != 0 || opt.Count != 0 {
		args = append(
			args,
			"LIMIT",
			strconv.FormatInt(opt.Offset, 10),
			strconv.FormatInt(opt.Count, 10),
		)
	}
	cmd := NewStringSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZRevRangeByScore(key string, opt ZRangeByScore) *StringSliceCmd {
	return c.zRevRangeByScore(key, opt, false)
}

func (c *Client) ZRevRangeByScoreWithScores(key string, opt ZRangeByScore) *ZSliceCmd {
	args := []string{"ZREVRANGEBYSCORE", key, opt.Max, opt.Min, "WITHSCORES"}
	if opt.Offset != 0 || opt.Count != 0 {
		args = append(
			args,
			"LIMIT",
			strconv.FormatInt(opt.Offset, 10),
			strconv.FormatInt(opt.Count, 10),
		)
	}
	cmd := NewZSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZRevRank(key, member string) *IntCmd {
	cmd := NewIntCmd("ZREVRANK", key, member)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZScore(key, member string) *FloatCmd {
	cmd := NewFloatCmd("ZSCORE", key, member)
	c.Process(cmd)
	return cmd
}

func (c *Client) ZUnionStore(
	destination string,
	store ZStore,
	keys ...string,
) *IntCmd {
	args := []string{"ZUNIONSTORE", destination, strconv.FormatInt(int64(len(keys)), 10)}
	args = append(args, keys...)
	if len(store.Weights) > 0 {
		args = append(args, "WEIGHTS")
		for _, weight := range store.Weights {
			args = append(args, strconv.FormatInt(weight, 10))
		}
	}
	if store.Aggregate != "" {
		args = append(args, "AGGREGATE", store.Aggregate)
	}
	cmd := NewIntCmd(args...)
	c.Process(cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c *Client) BgRewriteAOF() *StatusCmd {
	cmd := NewStatusCmd("BGREWRITEAOF")
	c.Process(cmd)
	return cmd
}

func (c *Client) BgSave() *StatusCmd {
	cmd := NewStatusCmd("BGSAVE")
	c.Process(cmd)
	return cmd
}

func (c *Client) ClientKill(ipPort string) *StatusCmd {
	cmd := NewStatusCmd("CLIENT", "KILL", ipPort)
	c.Process(cmd)
	return cmd
}

func (c *Client) ClientList() *StringCmd {
	cmd := NewStringCmd("CLIENT", "LIST")
	c.Process(cmd)
	return cmd
}

func (c *Client) ConfigGet(parameter string) *SliceCmd {
	cmd := NewSliceCmd("CONFIG", "GET", parameter)
	c.Process(cmd)
	return cmd
}

func (c *Client) ConfigResetStat() *StatusCmd {
	cmd := NewStatusCmd("CONFIG", "RESETSTAT")
	c.Process(cmd)
	return cmd
}

func (c *Client) ConfigSet(parameter, value string) *StatusCmd {
	cmd := NewStatusCmd("CONFIG", "SET", parameter, value)
	c.Process(cmd)
	return cmd
}

func (c *Client) DbSize() *IntCmd {
	cmd := NewIntCmd("DBSIZE")
	c.Process(cmd)
	return cmd
}

func (c *Client) FlushAll() *StatusCmd {
	cmd := NewStatusCmd("FLUSHALL")
	c.Process(cmd)
	return cmd
}

func (c *Client) FlushDb() *StatusCmd {
	cmd := NewStatusCmd("FLUSHDB")
	c.Process(cmd)
	return cmd
}

func (c *Client) Info() *StringCmd {
	cmd := NewStringCmd("INFO")
	c.Process(cmd)
	return cmd
}

func (c *Client) LastSave() *IntCmd {
	cmd := NewIntCmd("LASTSAVE")
	c.Process(cmd)
	return cmd
}

func (c *Client) Save() *StatusCmd {
	cmd := NewStatusCmd("SAVE")
	c.Process(cmd)
	return cmd
}

func (c *Client) shutdown(modifier string) *StatusCmd {
	var args []string
	if modifier == "" {
		args = []string{"SHUTDOWN"}
	} else {
		args = []string{"SHUTDOWN", modifier}
	}
	cmd := NewStatusCmd(args...)
	c.Process(cmd)
	if err := cmd.Err(); err != nil {
		if err == io.EOF {
			// Server quit as expected.
			cmd.err = nil
		}
	} else {
		// Server did not quit. String reply contains the reason.
		cmd.err = errorf(cmd.val)
		cmd.val = ""
	}
	return cmd
}

func (c *Client) Shutdown() *StatusCmd {
	return c.shutdown("")
}

func (c *Client) ShutdownSave() *StatusCmd {
	return c.shutdown("SAVE")
}

func (c *Client) ShutdownNoSave() *StatusCmd {
	return c.shutdown("NOSAVE")
}

func (c *Client) SlaveOf(host, port string) *StatusCmd {
	cmd := NewStatusCmd("SLAVEOF", host, port)
	c.Process(cmd)
	return cmd
}

func (c *Client) SlowLog() {
	panic("not implemented")
}

func (c *Client) Sync() {
	panic("not implemented")
}

func (c *Client) Time() *StringSliceCmd {
	cmd := NewStringSliceCmd("TIME")
	c.Process(cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c *Client) Eval(script string, keys []string, args []string) *Cmd {
	cmdArgs := []string{"EVAL", script, strconv.FormatInt(int64(len(keys)), 10)}
	cmdArgs = append(cmdArgs, keys...)
	cmdArgs = append(cmdArgs, args...)
	cmd := NewCmd(cmdArgs...)
	c.Process(cmd)
	return cmd
}

func (c *Client) EvalSha(sha1 string, keys []string, args []string) *Cmd {
	cmdArgs := []string{"EVALSHA", sha1, strconv.FormatInt(int64(len(keys)), 10)}
	cmdArgs = append(cmdArgs, keys...)
	cmdArgs = append(cmdArgs, args...)
	cmd := NewCmd(cmdArgs...)
	c.Process(cmd)
	return cmd
}

func (c *Client) ScriptExists(scripts ...string) *BoolSliceCmd {
	args := append([]string{"SCRIPT", "EXISTS"}, scripts...)
	cmd := NewBoolSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) ScriptFlush() *StatusCmd {
	cmd := NewStatusCmd("SCRIPT", "FLUSH")
	c.Process(cmd)
	return cmd
}

func (c *Client) ScriptKill() *StatusCmd {
	cmd := NewStatusCmd("SCRIPT", "KILL")
	c.Process(cmd)
	return cmd
}

func (c *Client) ScriptLoad(script string) *StringCmd {
	cmd := NewStringCmd("SCRIPT", "LOAD", script)
	c.Process(cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c *Client) DebugObject(key string) *StringCmd {
	cmd := NewStringCmd("DEBUG", "OBJECT", key)
	c.Process(cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c *Client) PubSubChannels(pattern string) *StringSliceCmd {
	args := []string{"PUBSUB", "CHANNELS"}
	if pattern != "*" {
		args = append(args, pattern)
	}
	cmd := NewStringSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) PubSubNumSub(channels ...string) *SliceCmd {
	args := []string{"PUBSUB", "NUMSUB"}
	args = append(args, channels...)
	cmd := NewSliceCmd(args...)
	c.Process(cmd)
	return cmd
}

func (c *Client) PubSubNumPat() *IntCmd {
	cmd := NewIntCmd("PUBSUB", "NUMPAT")
	c.Process(cmd)
	return cmd
}
