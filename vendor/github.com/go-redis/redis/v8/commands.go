package redis

import (
	"context"
	"errors"
	"io"
	"time"

	"github.com/go-redis/redis/v8/internal"
)

// KeepTTL is an option for Set command to keep key's existing TTL.
// For example:
//
//    rdb.Set(ctx, key, value, redis.KeepTTL)
const KeepTTL = -1

func usePrecise(dur time.Duration) bool {
	return dur < time.Second || dur%time.Second != 0
}

func formatMs(ctx context.Context, dur time.Duration) int64 {
	if dur > 0 && dur < time.Millisecond {
		internal.Logger.Printf(
			ctx,
			"specified duration is %s, but minimal supported value is %s - truncating to 1ms",
			dur, time.Millisecond,
		)
		return 1
	}
	return int64(dur / time.Millisecond)
}

func formatSec(ctx context.Context, dur time.Duration) int64 {
	if dur > 0 && dur < time.Second {
		internal.Logger.Printf(
			ctx,
			"specified duration is %s, but minimal supported value is %s - truncating to 1s",
			dur, time.Second,
		)
		return 1
	}
	return int64(dur / time.Second)
}

func appendArgs(dst, src []interface{}) []interface{} {
	if len(src) == 1 {
		return appendArg(dst, src[0])
	}

	dst = append(dst, src...)
	return dst
}

func appendArg(dst []interface{}, arg interface{}) []interface{} {
	switch arg := arg.(type) {
	case []string:
		for _, s := range arg {
			dst = append(dst, s)
		}
		return dst
	case []interface{}:
		dst = append(dst, arg...)
		return dst
	case map[string]interface{}:
		for k, v := range arg {
			dst = append(dst, k, v)
		}
		return dst
	default:
		return append(dst, arg)
	}
}

type Cmdable interface {
	Pipeline() Pipeliner
	Pipelined(ctx context.Context, fn func(Pipeliner) error) ([]Cmder, error)

	TxPipelined(ctx context.Context, fn func(Pipeliner) error) ([]Cmder, error)
	TxPipeline() Pipeliner

	Command(ctx context.Context) *CommandsInfoCmd
	ClientGetName(ctx context.Context) *StringCmd
	Echo(ctx context.Context, message interface{}) *StringCmd
	Ping(ctx context.Context) *StatusCmd
	Quit(ctx context.Context) *StatusCmd
	Del(ctx context.Context, keys ...string) *IntCmd
	Unlink(ctx context.Context, keys ...string) *IntCmd
	Dump(ctx context.Context, key string) *StringCmd
	Exists(ctx context.Context, keys ...string) *IntCmd
	Expire(ctx context.Context, key string, expiration time.Duration) *BoolCmd
	ExpireAt(ctx context.Context, key string, tm time.Time) *BoolCmd
	Keys(ctx context.Context, pattern string) *StringSliceCmd
	Migrate(ctx context.Context, host, port, key string, db int, timeout time.Duration) *StatusCmd
	Move(ctx context.Context, key string, db int) *BoolCmd
	ObjectRefCount(ctx context.Context, key string) *IntCmd
	ObjectEncoding(ctx context.Context, key string) *StringCmd
	ObjectIdleTime(ctx context.Context, key string) *DurationCmd
	Persist(ctx context.Context, key string) *BoolCmd
	PExpire(ctx context.Context, key string, expiration time.Duration) *BoolCmd
	PExpireAt(ctx context.Context, key string, tm time.Time) *BoolCmd
	PTTL(ctx context.Context, key string) *DurationCmd
	RandomKey(ctx context.Context) *StringCmd
	Rename(ctx context.Context, key, newkey string) *StatusCmd
	RenameNX(ctx context.Context, key, newkey string) *BoolCmd
	Restore(ctx context.Context, key string, ttl time.Duration, value string) *StatusCmd
	RestoreReplace(ctx context.Context, key string, ttl time.Duration, value string) *StatusCmd
	Sort(ctx context.Context, key string, sort *Sort) *StringSliceCmd
	SortStore(ctx context.Context, key, store string, sort *Sort) *IntCmd
	SortInterfaces(ctx context.Context, key string, sort *Sort) *SliceCmd
	Touch(ctx context.Context, keys ...string) *IntCmd
	TTL(ctx context.Context, key string) *DurationCmd
	Type(ctx context.Context, key string) *StatusCmd
	Append(ctx context.Context, key, value string) *IntCmd
	Decr(ctx context.Context, key string) *IntCmd
	DecrBy(ctx context.Context, key string, decrement int64) *IntCmd
	Get(ctx context.Context, key string) *StringCmd
	GetRange(ctx context.Context, key string, start, end int64) *StringCmd
	GetSet(ctx context.Context, key string, value interface{}) *StringCmd
	Incr(ctx context.Context, key string) *IntCmd
	IncrBy(ctx context.Context, key string, value int64) *IntCmd
	IncrByFloat(ctx context.Context, key string, value float64) *FloatCmd
	MGet(ctx context.Context, keys ...string) *SliceCmd
	MSet(ctx context.Context, values ...interface{}) *StatusCmd
	MSetNX(ctx context.Context, values ...interface{}) *BoolCmd
	Set(ctx context.Context, key string, value interface{}, expiration time.Duration) *StatusCmd
	SetEX(ctx context.Context, key string, value interface{}, expiration time.Duration) *StatusCmd
	SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) *BoolCmd
	SetXX(ctx context.Context, key string, value interface{}, expiration time.Duration) *BoolCmd
	SetRange(ctx context.Context, key string, offset int64, value string) *IntCmd
	StrLen(ctx context.Context, key string) *IntCmd

	GetBit(ctx context.Context, key string, offset int64) *IntCmd
	SetBit(ctx context.Context, key string, offset int64, value int) *IntCmd
	BitCount(ctx context.Context, key string, bitCount *BitCount) *IntCmd
	BitOpAnd(ctx context.Context, destKey string, keys ...string) *IntCmd
	BitOpOr(ctx context.Context, destKey string, keys ...string) *IntCmd
	BitOpXor(ctx context.Context, destKey string, keys ...string) *IntCmd
	BitOpNot(ctx context.Context, destKey string, key string) *IntCmd
	BitPos(ctx context.Context, key string, bit int64, pos ...int64) *IntCmd
	BitField(ctx context.Context, key string, args ...interface{}) *IntSliceCmd

	Scan(ctx context.Context, cursor uint64, match string, count int64) *ScanCmd
	SScan(ctx context.Context, key string, cursor uint64, match string, count int64) *ScanCmd
	HScan(ctx context.Context, key string, cursor uint64, match string, count int64) *ScanCmd
	ZScan(ctx context.Context, key string, cursor uint64, match string, count int64) *ScanCmd

	HDel(ctx context.Context, key string, fields ...string) *IntCmd
	HExists(ctx context.Context, key, field string) *BoolCmd
	HGet(ctx context.Context, key, field string) *StringCmd
	HGetAll(ctx context.Context, key string) *StringStringMapCmd
	HIncrBy(ctx context.Context, key, field string, incr int64) *IntCmd
	HIncrByFloat(ctx context.Context, key, field string, incr float64) *FloatCmd
	HKeys(ctx context.Context, key string) *StringSliceCmd
	HLen(ctx context.Context, key string) *IntCmd
	HMGet(ctx context.Context, key string, fields ...string) *SliceCmd
	HSet(ctx context.Context, key string, values ...interface{}) *IntCmd
	HMSet(ctx context.Context, key string, values ...interface{}) *BoolCmd
	HSetNX(ctx context.Context, key, field string, value interface{}) *BoolCmd
	HVals(ctx context.Context, key string) *StringSliceCmd

	BLPop(ctx context.Context, timeout time.Duration, keys ...string) *StringSliceCmd
	BRPop(ctx context.Context, timeout time.Duration, keys ...string) *StringSliceCmd
	BRPopLPush(ctx context.Context, source, destination string, timeout time.Duration) *StringCmd
	LIndex(ctx context.Context, key string, index int64) *StringCmd
	LInsert(ctx context.Context, key, op string, pivot, value interface{}) *IntCmd
	LInsertBefore(ctx context.Context, key string, pivot, value interface{}) *IntCmd
	LInsertAfter(ctx context.Context, key string, pivot, value interface{}) *IntCmd
	LLen(ctx context.Context, key string) *IntCmd
	LPop(ctx context.Context, key string) *StringCmd
	LPos(ctx context.Context, key string, value string, args LPosArgs) *IntCmd
	LPosCount(ctx context.Context, key string, value string, count int64, args LPosArgs) *IntSliceCmd
	LPush(ctx context.Context, key string, values ...interface{}) *IntCmd
	LPushX(ctx context.Context, key string, values ...interface{}) *IntCmd
	LRange(ctx context.Context, key string, start, stop int64) *StringSliceCmd
	LRem(ctx context.Context, key string, count int64, value interface{}) *IntCmd
	LSet(ctx context.Context, key string, index int64, value interface{}) *StatusCmd
	LTrim(ctx context.Context, key string, start, stop int64) *StatusCmd
	RPop(ctx context.Context, key string) *StringCmd
	RPopLPush(ctx context.Context, source, destination string) *StringCmd
	RPush(ctx context.Context, key string, values ...interface{}) *IntCmd
	RPushX(ctx context.Context, key string, values ...interface{}) *IntCmd

	SAdd(ctx context.Context, key string, members ...interface{}) *IntCmd
	SCard(ctx context.Context, key string) *IntCmd
	SDiff(ctx context.Context, keys ...string) *StringSliceCmd
	SDiffStore(ctx context.Context, destination string, keys ...string) *IntCmd
	SInter(ctx context.Context, keys ...string) *StringSliceCmd
	SInterStore(ctx context.Context, destination string, keys ...string) *IntCmd
	SIsMember(ctx context.Context, key string, member interface{}) *BoolCmd
	SMembers(ctx context.Context, key string) *StringSliceCmd
	SMembersMap(ctx context.Context, key string) *StringStructMapCmd
	SMove(ctx context.Context, source, destination string, member interface{}) *BoolCmd
	SPop(ctx context.Context, key string) *StringCmd
	SPopN(ctx context.Context, key string, count int64) *StringSliceCmd
	SRandMember(ctx context.Context, key string) *StringCmd
	SRandMemberN(ctx context.Context, key string, count int64) *StringSliceCmd
	SRem(ctx context.Context, key string, members ...interface{}) *IntCmd
	SUnion(ctx context.Context, keys ...string) *StringSliceCmd
	SUnionStore(ctx context.Context, destination string, keys ...string) *IntCmd

	XAdd(ctx context.Context, a *XAddArgs) *StringCmd
	XDel(ctx context.Context, stream string, ids ...string) *IntCmd
	XLen(ctx context.Context, stream string) *IntCmd
	XRange(ctx context.Context, stream, start, stop string) *XMessageSliceCmd
	XRangeN(ctx context.Context, stream, start, stop string, count int64) *XMessageSliceCmd
	XRevRange(ctx context.Context, stream string, start, stop string) *XMessageSliceCmd
	XRevRangeN(ctx context.Context, stream string, start, stop string, count int64) *XMessageSliceCmd
	XRead(ctx context.Context, a *XReadArgs) *XStreamSliceCmd
	XReadStreams(ctx context.Context, streams ...string) *XStreamSliceCmd
	XGroupCreate(ctx context.Context, stream, group, start string) *StatusCmd
	XGroupCreateMkStream(ctx context.Context, stream, group, start string) *StatusCmd
	XGroupSetID(ctx context.Context, stream, group, start string) *StatusCmd
	XGroupDestroy(ctx context.Context, stream, group string) *IntCmd
	XGroupDelConsumer(ctx context.Context, stream, group, consumer string) *IntCmd
	XReadGroup(ctx context.Context, a *XReadGroupArgs) *XStreamSliceCmd
	XAck(ctx context.Context, stream, group string, ids ...string) *IntCmd
	XPending(ctx context.Context, stream, group string) *XPendingCmd
	XPendingExt(ctx context.Context, a *XPendingExtArgs) *XPendingExtCmd
	XClaim(ctx context.Context, a *XClaimArgs) *XMessageSliceCmd
	XClaimJustID(ctx context.Context, a *XClaimArgs) *StringSliceCmd
	XTrim(ctx context.Context, key string, maxLen int64) *IntCmd
	XTrimApprox(ctx context.Context, key string, maxLen int64) *IntCmd
	XInfoGroups(ctx context.Context, key string) *XInfoGroupsCmd
	XInfoStream(ctx context.Context, key string) *XInfoStreamCmd

	BZPopMax(ctx context.Context, timeout time.Duration, keys ...string) *ZWithKeyCmd
	BZPopMin(ctx context.Context, timeout time.Duration, keys ...string) *ZWithKeyCmd
	ZAdd(ctx context.Context, key string, members ...*Z) *IntCmd
	ZAddNX(ctx context.Context, key string, members ...*Z) *IntCmd
	ZAddXX(ctx context.Context, key string, members ...*Z) *IntCmd
	ZAddCh(ctx context.Context, key string, members ...*Z) *IntCmd
	ZAddNXCh(ctx context.Context, key string, members ...*Z) *IntCmd
	ZAddXXCh(ctx context.Context, key string, members ...*Z) *IntCmd
	ZIncr(ctx context.Context, key string, member *Z) *FloatCmd
	ZIncrNX(ctx context.Context, key string, member *Z) *FloatCmd
	ZIncrXX(ctx context.Context, key string, member *Z) *FloatCmd
	ZCard(ctx context.Context, key string) *IntCmd
	ZCount(ctx context.Context, key, min, max string) *IntCmd
	ZLexCount(ctx context.Context, key, min, max string) *IntCmd
	ZIncrBy(ctx context.Context, key string, increment float64, member string) *FloatCmd
	ZInterStore(ctx context.Context, destination string, store *ZStore) *IntCmd
	ZPopMax(ctx context.Context, key string, count ...int64) *ZSliceCmd
	ZPopMin(ctx context.Context, key string, count ...int64) *ZSliceCmd
	ZRange(ctx context.Context, key string, start, stop int64) *StringSliceCmd
	ZRangeWithScores(ctx context.Context, key string, start, stop int64) *ZSliceCmd
	ZRangeByScore(ctx context.Context, key string, opt *ZRangeBy) *StringSliceCmd
	ZRangeByLex(ctx context.Context, key string, opt *ZRangeBy) *StringSliceCmd
	ZRangeByScoreWithScores(ctx context.Context, key string, opt *ZRangeBy) *ZSliceCmd
	ZRank(ctx context.Context, key, member string) *IntCmd
	ZRem(ctx context.Context, key string, members ...interface{}) *IntCmd
	ZRemRangeByRank(ctx context.Context, key string, start, stop int64) *IntCmd
	ZRemRangeByScore(ctx context.Context, key, min, max string) *IntCmd
	ZRemRangeByLex(ctx context.Context, key, min, max string) *IntCmd
	ZRevRange(ctx context.Context, key string, start, stop int64) *StringSliceCmd
	ZRevRangeWithScores(ctx context.Context, key string, start, stop int64) *ZSliceCmd
	ZRevRangeByScore(ctx context.Context, key string, opt *ZRangeBy) *StringSliceCmd
	ZRevRangeByLex(ctx context.Context, key string, opt *ZRangeBy) *StringSliceCmd
	ZRevRangeByScoreWithScores(ctx context.Context, key string, opt *ZRangeBy) *ZSliceCmd
	ZRevRank(ctx context.Context, key, member string) *IntCmd
	ZScore(ctx context.Context, key, member string) *FloatCmd
	ZUnionStore(ctx context.Context, dest string, store *ZStore) *IntCmd

	PFAdd(ctx context.Context, key string, els ...interface{}) *IntCmd
	PFCount(ctx context.Context, keys ...string) *IntCmd
	PFMerge(ctx context.Context, dest string, keys ...string) *StatusCmd

	BgRewriteAOF(ctx context.Context) *StatusCmd
	BgSave(ctx context.Context) *StatusCmd
	ClientKill(ctx context.Context, ipPort string) *StatusCmd
	ClientKillByFilter(ctx context.Context, keys ...string) *IntCmd
	ClientList(ctx context.Context) *StringCmd
	ClientPause(ctx context.Context, dur time.Duration) *BoolCmd
	ClientID(ctx context.Context) *IntCmd
	ConfigGet(ctx context.Context, parameter string) *SliceCmd
	ConfigResetStat(ctx context.Context) *StatusCmd
	ConfigSet(ctx context.Context, parameter, value string) *StatusCmd
	ConfigRewrite(ctx context.Context) *StatusCmd
	DBSize(ctx context.Context) *IntCmd
	FlushAll(ctx context.Context) *StatusCmd
	FlushAllAsync(ctx context.Context) *StatusCmd
	FlushDB(ctx context.Context) *StatusCmd
	FlushDBAsync(ctx context.Context) *StatusCmd
	Info(ctx context.Context, section ...string) *StringCmd
	LastSave(ctx context.Context) *IntCmd
	Save(ctx context.Context) *StatusCmd
	Shutdown(ctx context.Context) *StatusCmd
	ShutdownSave(ctx context.Context) *StatusCmd
	ShutdownNoSave(ctx context.Context) *StatusCmd
	SlaveOf(ctx context.Context, host, port string) *StatusCmd
	Time(ctx context.Context) *TimeCmd
	DebugObject(ctx context.Context, key string) *StringCmd
	ReadOnly(ctx context.Context) *StatusCmd
	ReadWrite(ctx context.Context) *StatusCmd
	MemoryUsage(ctx context.Context, key string, samples ...int) *IntCmd

	Eval(ctx context.Context, script string, keys []string, args ...interface{}) *Cmd
	EvalSha(ctx context.Context, sha1 string, keys []string, args ...interface{}) *Cmd
	ScriptExists(ctx context.Context, hashes ...string) *BoolSliceCmd
	ScriptFlush(ctx context.Context) *StatusCmd
	ScriptKill(ctx context.Context) *StatusCmd
	ScriptLoad(ctx context.Context, script string) *StringCmd

	Publish(ctx context.Context, channel string, message interface{}) *IntCmd
	PubSubChannels(ctx context.Context, pattern string) *StringSliceCmd
	PubSubNumSub(ctx context.Context, channels ...string) *StringIntMapCmd
	PubSubNumPat(ctx context.Context) *IntCmd

	ClusterSlots(ctx context.Context) *ClusterSlotsCmd
	ClusterNodes(ctx context.Context) *StringCmd
	ClusterMeet(ctx context.Context, host, port string) *StatusCmd
	ClusterForget(ctx context.Context, nodeID string) *StatusCmd
	ClusterReplicate(ctx context.Context, nodeID string) *StatusCmd
	ClusterResetSoft(ctx context.Context) *StatusCmd
	ClusterResetHard(ctx context.Context) *StatusCmd
	ClusterInfo(ctx context.Context) *StringCmd
	ClusterKeySlot(ctx context.Context, key string) *IntCmd
	ClusterGetKeysInSlot(ctx context.Context, slot int, count int) *StringSliceCmd
	ClusterCountFailureReports(ctx context.Context, nodeID string) *IntCmd
	ClusterCountKeysInSlot(ctx context.Context, slot int) *IntCmd
	ClusterDelSlots(ctx context.Context, slots ...int) *StatusCmd
	ClusterDelSlotsRange(ctx context.Context, min, max int) *StatusCmd
	ClusterSaveConfig(ctx context.Context) *StatusCmd
	ClusterSlaves(ctx context.Context, nodeID string) *StringSliceCmd
	ClusterFailover(ctx context.Context) *StatusCmd
	ClusterAddSlots(ctx context.Context, slots ...int) *StatusCmd
	ClusterAddSlotsRange(ctx context.Context, min, max int) *StatusCmd

	GeoAdd(ctx context.Context, key string, geoLocation ...*GeoLocation) *IntCmd
	GeoPos(ctx context.Context, key string, members ...string) *GeoPosCmd
	GeoRadius(ctx context.Context, key string, longitude, latitude float64, query *GeoRadiusQuery) *GeoLocationCmd
	GeoRadiusStore(ctx context.Context, key string, longitude, latitude float64, query *GeoRadiusQuery) *IntCmd
	GeoRadiusByMember(ctx context.Context, key, member string, query *GeoRadiusQuery) *GeoLocationCmd
	GeoRadiusByMemberStore(ctx context.Context, key, member string, query *GeoRadiusQuery) *IntCmd
	GeoDist(ctx context.Context, key string, member1, member2, unit string) *FloatCmd
	GeoHash(ctx context.Context, key string, members ...string) *StringSliceCmd
}

type StatefulCmdable interface {
	Cmdable
	Auth(ctx context.Context, password string) *StatusCmd
	AuthACL(ctx context.Context, username, password string) *StatusCmd
	Select(ctx context.Context, index int) *StatusCmd
	SwapDB(ctx context.Context, index1, index2 int) *StatusCmd
	ClientSetName(ctx context.Context, name string) *BoolCmd
}

var (
	_ Cmdable = (*Client)(nil)
	_ Cmdable = (*Tx)(nil)
	_ Cmdable = (*Ring)(nil)
	_ Cmdable = (*ClusterClient)(nil)
)

type cmdable func(ctx context.Context, cmd Cmder) error

type statefulCmdable func(ctx context.Context, cmd Cmder) error

//------------------------------------------------------------------------------

func (c statefulCmdable) Auth(ctx context.Context, password string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "auth", password)
	_ = c(ctx, cmd)
	return cmd
}

// Perform an AUTH command, using the given user and pass.
// Should be used to authenticate the current connection with one of the connections defined in the ACL list
// when connecting to a Redis 6.0 instance, or greater, that is using the Redis ACL system.
func (c statefulCmdable) AuthACL(ctx context.Context, username, password string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "auth", username, password)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Wait(ctx context.Context, numSlaves int, timeout time.Duration) *IntCmd {
	cmd := NewIntCmd(ctx, "wait", numSlaves, int(timeout/time.Millisecond))
	_ = c(ctx, cmd)
	return cmd
}

func (c statefulCmdable) Select(ctx context.Context, index int) *StatusCmd {
	cmd := NewStatusCmd(ctx, "select", index)
	_ = c(ctx, cmd)
	return cmd
}

func (c statefulCmdable) SwapDB(ctx context.Context, index1, index2 int) *StatusCmd {
	cmd := NewStatusCmd(ctx, "swapdb", index1, index2)
	_ = c(ctx, cmd)
	return cmd
}

// ClientSetName assigns a name to the connection.
func (c statefulCmdable) ClientSetName(ctx context.Context, name string) *BoolCmd {
	cmd := NewBoolCmd(ctx, "client", "setname", name)
	_ = c(ctx, cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c cmdable) Command(ctx context.Context) *CommandsInfoCmd {
	cmd := NewCommandsInfoCmd(ctx, "command")
	_ = c(ctx, cmd)
	return cmd
}

// ClientGetName returns the name of the connection.
func (c cmdable) ClientGetName(ctx context.Context) *StringCmd {
	cmd := NewStringCmd(ctx, "client", "getname")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Echo(ctx context.Context, message interface{}) *StringCmd {
	cmd := NewStringCmd(ctx, "echo", message)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Ping(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "ping")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Quit(ctx context.Context) *StatusCmd {
	panic("not implemented")
}

func (c cmdable) Del(ctx context.Context, keys ...string) *IntCmd {
	args := make([]interface{}, 1+len(keys))
	args[0] = "del"
	for i, key := range keys {
		args[1+i] = key
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Unlink(ctx context.Context, keys ...string) *IntCmd {
	args := make([]interface{}, 1+len(keys))
	args[0] = "unlink"
	for i, key := range keys {
		args[1+i] = key
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Dump(ctx context.Context, key string) *StringCmd {
	cmd := NewStringCmd(ctx, "dump", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Exists(ctx context.Context, keys ...string) *IntCmd {
	args := make([]interface{}, 1+len(keys))
	args[0] = "exists"
	for i, key := range keys {
		args[1+i] = key
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Expire(ctx context.Context, key string, expiration time.Duration) *BoolCmd {
	cmd := NewBoolCmd(ctx, "expire", key, formatSec(ctx, expiration))
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ExpireAt(ctx context.Context, key string, tm time.Time) *BoolCmd {
	cmd := NewBoolCmd(ctx, "expireat", key, tm.Unix())
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Keys(ctx context.Context, pattern string) *StringSliceCmd {
	cmd := NewStringSliceCmd(ctx, "keys", pattern)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Migrate(ctx context.Context, host, port, key string, db int, timeout time.Duration) *StatusCmd {
	cmd := NewStatusCmd(
		ctx,
		"migrate",
		host,
		port,
		key,
		db,
		formatMs(ctx, timeout),
	)
	cmd.setReadTimeout(timeout)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Move(ctx context.Context, key string, db int) *BoolCmd {
	cmd := NewBoolCmd(ctx, "move", key, db)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ObjectRefCount(ctx context.Context, key string) *IntCmd {
	cmd := NewIntCmd(ctx, "object", "refcount", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ObjectEncoding(ctx context.Context, key string) *StringCmd {
	cmd := NewStringCmd(ctx, "object", "encoding", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ObjectIdleTime(ctx context.Context, key string) *DurationCmd {
	cmd := NewDurationCmd(ctx, time.Second, "object", "idletime", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Persist(ctx context.Context, key string) *BoolCmd {
	cmd := NewBoolCmd(ctx, "persist", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) PExpire(ctx context.Context, key string, expiration time.Duration) *BoolCmd {
	cmd := NewBoolCmd(ctx, "pexpire", key, formatMs(ctx, expiration))
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) PExpireAt(ctx context.Context, key string, tm time.Time) *BoolCmd {
	cmd := NewBoolCmd(
		ctx,
		"pexpireat",
		key,
		tm.UnixNano()/int64(time.Millisecond),
	)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) PTTL(ctx context.Context, key string) *DurationCmd {
	cmd := NewDurationCmd(ctx, time.Millisecond, "pttl", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) RandomKey(ctx context.Context) *StringCmd {
	cmd := NewStringCmd(ctx, "randomkey")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Rename(ctx context.Context, key, newkey string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "rename", key, newkey)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) RenameNX(ctx context.Context, key, newkey string) *BoolCmd {
	cmd := NewBoolCmd(ctx, "renamenx", key, newkey)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Restore(ctx context.Context, key string, ttl time.Duration, value string) *StatusCmd {
	cmd := NewStatusCmd(
		ctx,
		"restore",
		key,
		formatMs(ctx, ttl),
		value,
	)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) RestoreReplace(ctx context.Context, key string, ttl time.Duration, value string) *StatusCmd {
	cmd := NewStatusCmd(
		ctx,
		"restore",
		key,
		formatMs(ctx, ttl),
		value,
		"replace",
	)
	_ = c(ctx, cmd)
	return cmd
}

type Sort struct {
	By            string
	Offset, Count int64
	Get           []string
	Order         string
	Alpha         bool
}

func (sort *Sort) args(key string) []interface{} {
	args := []interface{}{"sort", key}
	if sort.By != "" {
		args = append(args, "by", sort.By)
	}
	if sort.Offset != 0 || sort.Count != 0 {
		args = append(args, "limit", sort.Offset, sort.Count)
	}
	for _, get := range sort.Get {
		args = append(args, "get", get)
	}
	if sort.Order != "" {
		args = append(args, sort.Order)
	}
	if sort.Alpha {
		args = append(args, "alpha")
	}
	return args
}

func (c cmdable) Sort(ctx context.Context, key string, sort *Sort) *StringSliceCmd {
	cmd := NewStringSliceCmd(ctx, sort.args(key)...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SortStore(ctx context.Context, key, store string, sort *Sort) *IntCmd {
	args := sort.args(key)
	if store != "" {
		args = append(args, "store", store)
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SortInterfaces(ctx context.Context, key string, sort *Sort) *SliceCmd {
	cmd := NewSliceCmd(ctx, sort.args(key)...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Touch(ctx context.Context, keys ...string) *IntCmd {
	args := make([]interface{}, len(keys)+1)
	args[0] = "touch"
	for i, key := range keys {
		args[i+1] = key
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) TTL(ctx context.Context, key string) *DurationCmd {
	cmd := NewDurationCmd(ctx, time.Second, "ttl", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Type(ctx context.Context, key string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "type", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Append(ctx context.Context, key, value string) *IntCmd {
	cmd := NewIntCmd(ctx, "append", key, value)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Decr(ctx context.Context, key string) *IntCmd {
	cmd := NewIntCmd(ctx, "decr", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) DecrBy(ctx context.Context, key string, decrement int64) *IntCmd {
	cmd := NewIntCmd(ctx, "decrby", key, decrement)
	_ = c(ctx, cmd)
	return cmd
}

// Redis `GET key` command. It returns redis.Nil error when key does not exist.
func (c cmdable) Get(ctx context.Context, key string) *StringCmd {
	cmd := NewStringCmd(ctx, "get", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) GetRange(ctx context.Context, key string, start, end int64) *StringCmd {
	cmd := NewStringCmd(ctx, "getrange", key, start, end)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) GetSet(ctx context.Context, key string, value interface{}) *StringCmd {
	cmd := NewStringCmd(ctx, "getset", key, value)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Incr(ctx context.Context, key string) *IntCmd {
	cmd := NewIntCmd(ctx, "incr", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) IncrBy(ctx context.Context, key string, value int64) *IntCmd {
	cmd := NewIntCmd(ctx, "incrby", key, value)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) IncrByFloat(ctx context.Context, key string, value float64) *FloatCmd {
	cmd := NewFloatCmd(ctx, "incrbyfloat", key, value)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) MGet(ctx context.Context, keys ...string) *SliceCmd {
	args := make([]interface{}, 1+len(keys))
	args[0] = "mget"
	for i, key := range keys {
		args[1+i] = key
	}
	cmd := NewSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// MSet is like Set but accepts multiple values:
//   - MSet("key1", "value1", "key2", "value2")
//   - MSet([]string{"key1", "value1", "key2", "value2"})
//   - MSet(map[string]interface{}{"key1": "value1", "key2": "value2"})
func (c cmdable) MSet(ctx context.Context, values ...interface{}) *StatusCmd {
	args := make([]interface{}, 1, 1+len(values))
	args[0] = "mset"
	args = appendArgs(args, values)
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// MSetNX is like SetNX but accepts multiple values:
//   - MSetNX("key1", "value1", "key2", "value2")
//   - MSetNX([]string{"key1", "value1", "key2", "value2"})
//   - MSetNX(map[string]interface{}{"key1": "value1", "key2": "value2"})
func (c cmdable) MSetNX(ctx context.Context, values ...interface{}) *BoolCmd {
	args := make([]interface{}, 1, 1+len(values))
	args[0] = "msetnx"
	args = appendArgs(args, values)
	cmd := NewBoolCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// Redis `SET key value [expiration]` command.
// Use expiration for `SETEX`-like behavior.
//
// Zero expiration means the key has no expiration time.
// KeepTTL(-1) expiration is a Redis KEEPTTL option to keep existing TTL.
func (c cmdable) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) *StatusCmd {
	args := make([]interface{}, 3, 5)
	args[0] = "set"
	args[1] = key
	args[2] = value
	if expiration > 0 {
		if usePrecise(expiration) {
			args = append(args, "px", formatMs(ctx, expiration))
		} else {
			args = append(args, "ex", formatSec(ctx, expiration))
		}
	} else if expiration == KeepTTL {
		args = append(args, "keepttl")
	}

	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// Redis `SETEX key expiration value` command.
func (c cmdable) SetEX(ctx context.Context, key string, value interface{}, expiration time.Duration) *StatusCmd {
	cmd := NewStatusCmd(ctx, "setex", key, formatSec(ctx, expiration), value)
	_ = c(ctx, cmd)
	return cmd
}

// Redis `SET key value [expiration] NX` command.
//
// Zero expiration means the key has no expiration time.
// KeepTTL(-1) expiration is a Redis KEEPTTL option to keep existing TTL.
func (c cmdable) SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) *BoolCmd {
	var cmd *BoolCmd
	switch expiration {
	case 0:
		// Use old `SETNX` to support old Redis versions.
		cmd = NewBoolCmd(ctx, "setnx", key, value)
	case KeepTTL:
		cmd = NewBoolCmd(ctx, "set", key, value, "keepttl", "nx")
	default:
		if usePrecise(expiration) {
			cmd = NewBoolCmd(ctx, "set", key, value, "px", formatMs(ctx, expiration), "nx")
		} else {
			cmd = NewBoolCmd(ctx, "set", key, value, "ex", formatSec(ctx, expiration), "nx")
		}
	}

	_ = c(ctx, cmd)
	return cmd
}

// Redis `SET key value [expiration] XX` command.
//
// Zero expiration means the key has no expiration time.
// KeepTTL(-1) expiration is a Redis KEEPTTL option to keep existing TTL.
func (c cmdable) SetXX(ctx context.Context, key string, value interface{}, expiration time.Duration) *BoolCmd {
	var cmd *BoolCmd
	switch expiration {
	case 0:
		cmd = NewBoolCmd(ctx, "set", key, value, "xx")
	case KeepTTL:
		cmd = NewBoolCmd(ctx, "set", key, value, "keepttl", "xx")
	default:
		if usePrecise(expiration) {
			cmd = NewBoolCmd(ctx, "set", key, value, "px", formatMs(ctx, expiration), "xx")
		} else {
			cmd = NewBoolCmd(ctx, "set", key, value, "ex", formatSec(ctx, expiration), "xx")
		}
	}

	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SetRange(ctx context.Context, key string, offset int64, value string) *IntCmd {
	cmd := NewIntCmd(ctx, "setrange", key, offset, value)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) StrLen(ctx context.Context, key string) *IntCmd {
	cmd := NewIntCmd(ctx, "strlen", key)
	_ = c(ctx, cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c cmdable) GetBit(ctx context.Context, key string, offset int64) *IntCmd {
	cmd := NewIntCmd(ctx, "getbit", key, offset)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SetBit(ctx context.Context, key string, offset int64, value int) *IntCmd {
	cmd := NewIntCmd(
		ctx,
		"setbit",
		key,
		offset,
		value,
	)
	_ = c(ctx, cmd)
	return cmd
}

type BitCount struct {
	Start, End int64
}

func (c cmdable) BitCount(ctx context.Context, key string, bitCount *BitCount) *IntCmd {
	args := []interface{}{"bitcount", key}
	if bitCount != nil {
		args = append(
			args,
			bitCount.Start,
			bitCount.End,
		)
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) bitOp(ctx context.Context, op, destKey string, keys ...string) *IntCmd {
	args := make([]interface{}, 3+len(keys))
	args[0] = "bitop"
	args[1] = op
	args[2] = destKey
	for i, key := range keys {
		args[3+i] = key
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) BitOpAnd(ctx context.Context, destKey string, keys ...string) *IntCmd {
	return c.bitOp(ctx, "and", destKey, keys...)
}

func (c cmdable) BitOpOr(ctx context.Context, destKey string, keys ...string) *IntCmd {
	return c.bitOp(ctx, "or", destKey, keys...)
}

func (c cmdable) BitOpXor(ctx context.Context, destKey string, keys ...string) *IntCmd {
	return c.bitOp(ctx, "xor", destKey, keys...)
}

func (c cmdable) BitOpNot(ctx context.Context, destKey string, key string) *IntCmd {
	return c.bitOp(ctx, "not", destKey, key)
}

func (c cmdable) BitPos(ctx context.Context, key string, bit int64, pos ...int64) *IntCmd {
	args := make([]interface{}, 3+len(pos))
	args[0] = "bitpos"
	args[1] = key
	args[2] = bit
	switch len(pos) {
	case 0:
	case 1:
		args[3] = pos[0]
	case 2:
		args[3] = pos[0]
		args[4] = pos[1]
	default:
		panic("too many arguments")
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) BitField(ctx context.Context, key string, args ...interface{}) *IntSliceCmd {
	a := make([]interface{}, 0, 2+len(args))
	a = append(a, "bitfield")
	a = append(a, key)
	a = append(a, args...)
	cmd := NewIntSliceCmd(ctx, a...)
	_ = c(ctx, cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c cmdable) Scan(ctx context.Context, cursor uint64, match string, count int64) *ScanCmd {
	args := []interface{}{"scan", cursor}
	if match != "" {
		args = append(args, "match", match)
	}
	if count > 0 {
		args = append(args, "count", count)
	}
	cmd := NewScanCmd(ctx, c, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SScan(ctx context.Context, key string, cursor uint64, match string, count int64) *ScanCmd {
	args := []interface{}{"sscan", key, cursor}
	if match != "" {
		args = append(args, "match", match)
	}
	if count > 0 {
		args = append(args, "count", count)
	}
	cmd := NewScanCmd(ctx, c, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) HScan(ctx context.Context, key string, cursor uint64, match string, count int64) *ScanCmd {
	args := []interface{}{"hscan", key, cursor}
	if match != "" {
		args = append(args, "match", match)
	}
	if count > 0 {
		args = append(args, "count", count)
	}
	cmd := NewScanCmd(ctx, c, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZScan(ctx context.Context, key string, cursor uint64, match string, count int64) *ScanCmd {
	args := []interface{}{"zscan", key, cursor}
	if match != "" {
		args = append(args, "match", match)
	}
	if count > 0 {
		args = append(args, "count", count)
	}
	cmd := NewScanCmd(ctx, c, args...)
	_ = c(ctx, cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c cmdable) HDel(ctx context.Context, key string, fields ...string) *IntCmd {
	args := make([]interface{}, 2+len(fields))
	args[0] = "hdel"
	args[1] = key
	for i, field := range fields {
		args[2+i] = field
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) HExists(ctx context.Context, key, field string) *BoolCmd {
	cmd := NewBoolCmd(ctx, "hexists", key, field)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) HGet(ctx context.Context, key, field string) *StringCmd {
	cmd := NewStringCmd(ctx, "hget", key, field)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) HGetAll(ctx context.Context, key string) *StringStringMapCmd {
	cmd := NewStringStringMapCmd(ctx, "hgetall", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) HIncrBy(ctx context.Context, key, field string, incr int64) *IntCmd {
	cmd := NewIntCmd(ctx, "hincrby", key, field, incr)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) HIncrByFloat(ctx context.Context, key, field string, incr float64) *FloatCmd {
	cmd := NewFloatCmd(ctx, "hincrbyfloat", key, field, incr)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) HKeys(ctx context.Context, key string) *StringSliceCmd {
	cmd := NewStringSliceCmd(ctx, "hkeys", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) HLen(ctx context.Context, key string) *IntCmd {
	cmd := NewIntCmd(ctx, "hlen", key)
	_ = c(ctx, cmd)
	return cmd
}

// HMGet returns the values for the specified fields in the hash stored at key.
// It returns an interface{} to distinguish between empty string and nil value.
func (c cmdable) HMGet(ctx context.Context, key string, fields ...string) *SliceCmd {
	args := make([]interface{}, 2+len(fields))
	args[0] = "hmget"
	args[1] = key
	for i, field := range fields {
		args[2+i] = field
	}
	cmd := NewSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// HSet accepts values in following formats:
//   - HSet("myhash", "key1", "value1", "key2", "value2")
//   - HSet("myhash", []string{"key1", "value1", "key2", "value2"})
//   - HSet("myhash", map[string]interface{}{"key1": "value1", "key2": "value2"})
//
// Note that it requires Redis v4 for multiple field/value pairs support.
func (c cmdable) HSet(ctx context.Context, key string, values ...interface{}) *IntCmd {
	args := make([]interface{}, 2, 2+len(values))
	args[0] = "hset"
	args[1] = key
	args = appendArgs(args, values)
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// HMSet is a deprecated version of HSet left for compatibility with Redis 3.
func (c cmdable) HMSet(ctx context.Context, key string, values ...interface{}) *BoolCmd {
	args := make([]interface{}, 2, 2+len(values))
	args[0] = "hmset"
	args[1] = key
	args = appendArgs(args, values)
	cmd := NewBoolCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) HSetNX(ctx context.Context, key, field string, value interface{}) *BoolCmd {
	cmd := NewBoolCmd(ctx, "hsetnx", key, field, value)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) HVals(ctx context.Context, key string) *StringSliceCmd {
	cmd := NewStringSliceCmd(ctx, "hvals", key)
	_ = c(ctx, cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c cmdable) BLPop(ctx context.Context, timeout time.Duration, keys ...string) *StringSliceCmd {
	args := make([]interface{}, 1+len(keys)+1)
	args[0] = "blpop"
	for i, key := range keys {
		args[1+i] = key
	}
	args[len(args)-1] = formatSec(ctx, timeout)
	cmd := NewStringSliceCmd(ctx, args...)
	cmd.setReadTimeout(timeout)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) BRPop(ctx context.Context, timeout time.Duration, keys ...string) *StringSliceCmd {
	args := make([]interface{}, 1+len(keys)+1)
	args[0] = "brpop"
	for i, key := range keys {
		args[1+i] = key
	}
	args[len(keys)+1] = formatSec(ctx, timeout)
	cmd := NewStringSliceCmd(ctx, args...)
	cmd.setReadTimeout(timeout)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) BRPopLPush(ctx context.Context, source, destination string, timeout time.Duration) *StringCmd {
	cmd := NewStringCmd(
		ctx,
		"brpoplpush",
		source,
		destination,
		formatSec(ctx, timeout),
	)
	cmd.setReadTimeout(timeout)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) LIndex(ctx context.Context, key string, index int64) *StringCmd {
	cmd := NewStringCmd(ctx, "lindex", key, index)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) LInsert(ctx context.Context, key, op string, pivot, value interface{}) *IntCmd {
	cmd := NewIntCmd(ctx, "linsert", key, op, pivot, value)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) LInsertBefore(ctx context.Context, key string, pivot, value interface{}) *IntCmd {
	cmd := NewIntCmd(ctx, "linsert", key, "before", pivot, value)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) LInsertAfter(ctx context.Context, key string, pivot, value interface{}) *IntCmd {
	cmd := NewIntCmd(ctx, "linsert", key, "after", pivot, value)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) LLen(ctx context.Context, key string) *IntCmd {
	cmd := NewIntCmd(ctx, "llen", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) LPop(ctx context.Context, key string) *StringCmd {
	cmd := NewStringCmd(ctx, "lpop", key)
	_ = c(ctx, cmd)
	return cmd
}

type LPosArgs struct {
	Rank, MaxLen int64
}

func (c cmdable) LPos(ctx context.Context, key string, value string, a LPosArgs) *IntCmd {
	args := []interface{}{"lpos", key, value}
	if a.Rank != 0 {
		args = append(args, "rank", a.Rank)
	}
	if a.MaxLen != 0 {
		args = append(args, "maxlen", a.MaxLen)
	}

	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) LPosCount(ctx context.Context, key string, value string, count int64, a LPosArgs) *IntSliceCmd {
	args := []interface{}{"lpos", key, value, "count", count}
	if a.Rank != 0 {
		args = append(args, "rank", a.Rank)
	}
	if a.MaxLen != 0 {
		args = append(args, "maxlen", a.MaxLen)
	}
	cmd := NewIntSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) LPush(ctx context.Context, key string, values ...interface{}) *IntCmd {
	args := make([]interface{}, 2, 2+len(values))
	args[0] = "lpush"
	args[1] = key
	args = appendArgs(args, values)
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) LPushX(ctx context.Context, key string, values ...interface{}) *IntCmd {
	args := make([]interface{}, 2, 2+len(values))
	args[0] = "lpushx"
	args[1] = key
	args = appendArgs(args, values)
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) LRange(ctx context.Context, key string, start, stop int64) *StringSliceCmd {
	cmd := NewStringSliceCmd(
		ctx,
		"lrange",
		key,
		start,
		stop,
	)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) LRem(ctx context.Context, key string, count int64, value interface{}) *IntCmd {
	cmd := NewIntCmd(ctx, "lrem", key, count, value)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) LSet(ctx context.Context, key string, index int64, value interface{}) *StatusCmd {
	cmd := NewStatusCmd(ctx, "lset", key, index, value)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) LTrim(ctx context.Context, key string, start, stop int64) *StatusCmd {
	cmd := NewStatusCmd(
		ctx,
		"ltrim",
		key,
		start,
		stop,
	)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) RPop(ctx context.Context, key string) *StringCmd {
	cmd := NewStringCmd(ctx, "rpop", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) RPopLPush(ctx context.Context, source, destination string) *StringCmd {
	cmd := NewStringCmd(ctx, "rpoplpush", source, destination)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) RPush(ctx context.Context, key string, values ...interface{}) *IntCmd {
	args := make([]interface{}, 2, 2+len(values))
	args[0] = "rpush"
	args[1] = key
	args = appendArgs(args, values)
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) RPushX(ctx context.Context, key string, values ...interface{}) *IntCmd {
	args := make([]interface{}, 2, 2+len(values))
	args[0] = "rpushx"
	args[1] = key
	args = appendArgs(args, values)
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c cmdable) SAdd(ctx context.Context, key string, members ...interface{}) *IntCmd {
	args := make([]interface{}, 2, 2+len(members))
	args[0] = "sadd"
	args[1] = key
	args = appendArgs(args, members)
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SCard(ctx context.Context, key string) *IntCmd {
	cmd := NewIntCmd(ctx, "scard", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SDiff(ctx context.Context, keys ...string) *StringSliceCmd {
	args := make([]interface{}, 1+len(keys))
	args[0] = "sdiff"
	for i, key := range keys {
		args[1+i] = key
	}
	cmd := NewStringSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SDiffStore(ctx context.Context, destination string, keys ...string) *IntCmd {
	args := make([]interface{}, 2+len(keys))
	args[0] = "sdiffstore"
	args[1] = destination
	for i, key := range keys {
		args[2+i] = key
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SInter(ctx context.Context, keys ...string) *StringSliceCmd {
	args := make([]interface{}, 1+len(keys))
	args[0] = "sinter"
	for i, key := range keys {
		args[1+i] = key
	}
	cmd := NewStringSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SInterStore(ctx context.Context, destination string, keys ...string) *IntCmd {
	args := make([]interface{}, 2+len(keys))
	args[0] = "sinterstore"
	args[1] = destination
	for i, key := range keys {
		args[2+i] = key
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SIsMember(ctx context.Context, key string, member interface{}) *BoolCmd {
	cmd := NewBoolCmd(ctx, "sismember", key, member)
	_ = c(ctx, cmd)
	return cmd
}

// Redis `SMEMBERS key` command output as a slice.
func (c cmdable) SMembers(ctx context.Context, key string) *StringSliceCmd {
	cmd := NewStringSliceCmd(ctx, "smembers", key)
	_ = c(ctx, cmd)
	return cmd
}

// Redis `SMEMBERS key` command output as a map.
func (c cmdable) SMembersMap(ctx context.Context, key string) *StringStructMapCmd {
	cmd := NewStringStructMapCmd(ctx, "smembers", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SMove(ctx context.Context, source, destination string, member interface{}) *BoolCmd {
	cmd := NewBoolCmd(ctx, "smove", source, destination, member)
	_ = c(ctx, cmd)
	return cmd
}

// Redis `SPOP key` command.
func (c cmdable) SPop(ctx context.Context, key string) *StringCmd {
	cmd := NewStringCmd(ctx, "spop", key)
	_ = c(ctx, cmd)
	return cmd
}

// Redis `SPOP key count` command.
func (c cmdable) SPopN(ctx context.Context, key string, count int64) *StringSliceCmd {
	cmd := NewStringSliceCmd(ctx, "spop", key, count)
	_ = c(ctx, cmd)
	return cmd
}

// Redis `SRANDMEMBER key` command.
func (c cmdable) SRandMember(ctx context.Context, key string) *StringCmd {
	cmd := NewStringCmd(ctx, "srandmember", key)
	_ = c(ctx, cmd)
	return cmd
}

// Redis `SRANDMEMBER key count` command.
func (c cmdable) SRandMemberN(ctx context.Context, key string, count int64) *StringSliceCmd {
	cmd := NewStringSliceCmd(ctx, "srandmember", key, count)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SRem(ctx context.Context, key string, members ...interface{}) *IntCmd {
	args := make([]interface{}, 2, 2+len(members))
	args[0] = "srem"
	args[1] = key
	args = appendArgs(args, members)
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SUnion(ctx context.Context, keys ...string) *StringSliceCmd {
	args := make([]interface{}, 1+len(keys))
	args[0] = "sunion"
	for i, key := range keys {
		args[1+i] = key
	}
	cmd := NewStringSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SUnionStore(ctx context.Context, destination string, keys ...string) *IntCmd {
	args := make([]interface{}, 2+len(keys))
	args[0] = "sunionstore"
	args[1] = destination
	for i, key := range keys {
		args[2+i] = key
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

//------------------------------------------------------------------------------

// XAddArgs accepts values in the following formats:
//   - XAddArgs.Values = []interface{}{"key1", "value1", "key2", "value2"}
//   - XAddArgs.Values = []string("key1", "value1", "key2", "value2")
//   - XAddArgs.Values = map[string]interface{}{"key1": "value1", "key2": "value2"}
//
// Note that map will not preserve the order of key-value pairs.
type XAddArgs struct {
	Stream       string
	MaxLen       int64 // MAXLEN N
	MaxLenApprox int64 // MAXLEN ~ N
	ID           string
	Values       interface{}
}

func (c cmdable) XAdd(ctx context.Context, a *XAddArgs) *StringCmd {
	args := make([]interface{}, 0, 8)
	args = append(args, "xadd")
	args = append(args, a.Stream)
	if a.MaxLen > 0 {
		args = append(args, "maxlen", a.MaxLen)
	} else if a.MaxLenApprox > 0 {
		args = append(args, "maxlen", "~", a.MaxLenApprox)
	}
	if a.ID != "" {
		args = append(args, a.ID)
	} else {
		args = append(args, "*")
	}
	args = appendArg(args, a.Values)

	cmd := NewStringCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XDel(ctx context.Context, stream string, ids ...string) *IntCmd {
	args := []interface{}{"xdel", stream}
	for _, id := range ids {
		args = append(args, id)
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XLen(ctx context.Context, stream string) *IntCmd {
	cmd := NewIntCmd(ctx, "xlen", stream)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XRange(ctx context.Context, stream, start, stop string) *XMessageSliceCmd {
	cmd := NewXMessageSliceCmd(ctx, "xrange", stream, start, stop)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XRangeN(ctx context.Context, stream, start, stop string, count int64) *XMessageSliceCmd {
	cmd := NewXMessageSliceCmd(ctx, "xrange", stream, start, stop, "count", count)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XRevRange(ctx context.Context, stream, start, stop string) *XMessageSliceCmd {
	cmd := NewXMessageSliceCmd(ctx, "xrevrange", stream, start, stop)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XRevRangeN(ctx context.Context, stream, start, stop string, count int64) *XMessageSliceCmd {
	cmd := NewXMessageSliceCmd(ctx, "xrevrange", stream, start, stop, "count", count)
	_ = c(ctx, cmd)
	return cmd
}

type XReadArgs struct {
	Streams []string // list of streams and ids, e.g. stream1 stream2 id1 id2
	Count   int64
	Block   time.Duration
}

func (c cmdable) XRead(ctx context.Context, a *XReadArgs) *XStreamSliceCmd {
	args := make([]interface{}, 0, 5+len(a.Streams))
	args = append(args, "xread")

	keyPos := int8(1)
	if a.Count > 0 {
		args = append(args, "count")
		args = append(args, a.Count)
		keyPos += 2
	}
	if a.Block >= 0 {
		args = append(args, "block")
		args = append(args, int64(a.Block/time.Millisecond))
		keyPos += 2
	}
	args = append(args, "streams")
	keyPos++
	for _, s := range a.Streams {
		args = append(args, s)
	}

	cmd := NewXStreamSliceCmd(ctx, args...)
	if a.Block >= 0 {
		cmd.setReadTimeout(a.Block)
	}
	cmd.setFirstKeyPos(keyPos)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XReadStreams(ctx context.Context, streams ...string) *XStreamSliceCmd {
	return c.XRead(ctx, &XReadArgs{
		Streams: streams,
		Block:   -1,
	})
}

func (c cmdable) XGroupCreate(ctx context.Context, stream, group, start string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "xgroup", "create", stream, group, start)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XGroupCreateMkStream(ctx context.Context, stream, group, start string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "xgroup", "create", stream, group, start, "mkstream")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XGroupSetID(ctx context.Context, stream, group, start string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "xgroup", "setid", stream, group, start)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XGroupDestroy(ctx context.Context, stream, group string) *IntCmd {
	cmd := NewIntCmd(ctx, "xgroup", "destroy", stream, group)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XGroupDelConsumer(ctx context.Context, stream, group, consumer string) *IntCmd {
	cmd := NewIntCmd(ctx, "xgroup", "delconsumer", stream, group, consumer)
	_ = c(ctx, cmd)
	return cmd
}

type XReadGroupArgs struct {
	Group    string
	Consumer string
	Streams  []string // list of streams and ids, e.g. stream1 stream2 id1 id2
	Count    int64
	Block    time.Duration
	NoAck    bool
}

func (c cmdable) XReadGroup(ctx context.Context, a *XReadGroupArgs) *XStreamSliceCmd {
	args := make([]interface{}, 0, 8+len(a.Streams))
	args = append(args, "xreadgroup", "group", a.Group, a.Consumer)

	keyPos := int8(1)
	if a.Count > 0 {
		args = append(args, "count", a.Count)
		keyPos += 2
	}
	if a.Block >= 0 {
		args = append(args, "block", int64(a.Block/time.Millisecond))
		keyPos += 2
	}
	if a.NoAck {
		args = append(args, "noack")
		keyPos++
	}
	args = append(args, "streams")
	keyPos++
	for _, s := range a.Streams {
		args = append(args, s)
	}

	cmd := NewXStreamSliceCmd(ctx, args...)
	if a.Block >= 0 {
		cmd.setReadTimeout(a.Block)
	}
	cmd.setFirstKeyPos(keyPos)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XAck(ctx context.Context, stream, group string, ids ...string) *IntCmd {
	args := []interface{}{"xack", stream, group}
	for _, id := range ids {
		args = append(args, id)
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XPending(ctx context.Context, stream, group string) *XPendingCmd {
	cmd := NewXPendingCmd(ctx, "xpending", stream, group)
	_ = c(ctx, cmd)
	return cmd
}

type XPendingExtArgs struct {
	Stream   string
	Group    string
	Start    string
	End      string
	Count    int64
	Consumer string
}

func (c cmdable) XPendingExt(ctx context.Context, a *XPendingExtArgs) *XPendingExtCmd {
	args := make([]interface{}, 0, 7)
	args = append(args, "xpending", a.Stream, a.Group, a.Start, a.End, a.Count)
	if a.Consumer != "" {
		args = append(args, a.Consumer)
	}
	cmd := NewXPendingExtCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

type XClaimArgs struct {
	Stream   string
	Group    string
	Consumer string
	MinIdle  time.Duration
	Messages []string
}

func (c cmdable) XClaim(ctx context.Context, a *XClaimArgs) *XMessageSliceCmd {
	args := xClaimArgs(a)
	cmd := NewXMessageSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XClaimJustID(ctx context.Context, a *XClaimArgs) *StringSliceCmd {
	args := xClaimArgs(a)
	args = append(args, "justid")
	cmd := NewStringSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func xClaimArgs(a *XClaimArgs) []interface{} {
	args := make([]interface{}, 0, 4+len(a.Messages))
	args = append(args,
		"xclaim",
		a.Stream,
		a.Group, a.Consumer,
		int64(a.MinIdle/time.Millisecond))
	for _, id := range a.Messages {
		args = append(args, id)
	}
	return args
}

func (c cmdable) XTrim(ctx context.Context, key string, maxLen int64) *IntCmd {
	cmd := NewIntCmd(ctx, "xtrim", key, "maxlen", maxLen)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XTrimApprox(ctx context.Context, key string, maxLen int64) *IntCmd {
	cmd := NewIntCmd(ctx, "xtrim", key, "maxlen", "~", maxLen)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XInfoGroups(ctx context.Context, key string) *XInfoGroupsCmd {
	cmd := NewXInfoGroupsCmd(ctx, key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XInfoStream(ctx context.Context, key string) *XInfoStreamCmd {
	cmd := NewXInfoStreamCmd(ctx, key)
	_ = c(ctx, cmd)
	return cmd
}

//------------------------------------------------------------------------------

// Z represents sorted set member.
type Z struct {
	Score  float64
	Member interface{}
}

// ZWithKey represents sorted set member including the name of the key where it was popped.
type ZWithKey struct {
	Z
	Key string
}

// ZStore is used as an arg to ZInterStore and ZUnionStore.
type ZStore struct {
	Keys    []string
	Weights []float64
	// Can be SUM, MIN or MAX.
	Aggregate string
}

// Redis `BZPOPMAX key [key ...] timeout` command.
func (c cmdable) BZPopMax(ctx context.Context, timeout time.Duration, keys ...string) *ZWithKeyCmd {
	args := make([]interface{}, 1+len(keys)+1)
	args[0] = "bzpopmax"
	for i, key := range keys {
		args[1+i] = key
	}
	args[len(args)-1] = formatSec(ctx, timeout)
	cmd := NewZWithKeyCmd(ctx, args...)
	cmd.setReadTimeout(timeout)
	_ = c(ctx, cmd)
	return cmd
}

// Redis `BZPOPMIN key [key ...] timeout` command.
func (c cmdable) BZPopMin(ctx context.Context, timeout time.Duration, keys ...string) *ZWithKeyCmd {
	args := make([]interface{}, 1+len(keys)+1)
	args[0] = "bzpopmin"
	for i, key := range keys {
		args[1+i] = key
	}
	args[len(args)-1] = formatSec(ctx, timeout)
	cmd := NewZWithKeyCmd(ctx, args...)
	cmd.setReadTimeout(timeout)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) zAdd(ctx context.Context, a []interface{}, n int, members ...*Z) *IntCmd {
	for i, m := range members {
		a[n+2*i] = m.Score
		a[n+2*i+1] = m.Member
	}
	cmd := NewIntCmd(ctx, a...)
	_ = c(ctx, cmd)
	return cmd
}

// Redis `ZADD key score member [score member ...]` command.
func (c cmdable) ZAdd(ctx context.Context, key string, members ...*Z) *IntCmd {
	const n = 2
	a := make([]interface{}, n+2*len(members))
	a[0], a[1] = "zadd", key
	return c.zAdd(ctx, a, n, members...)
}

// Redis `ZADD key NX score member [score member ...]` command.
func (c cmdable) ZAddNX(ctx context.Context, key string, members ...*Z) *IntCmd {
	const n = 3
	a := make([]interface{}, n+2*len(members))
	a[0], a[1], a[2] = "zadd", key, "nx"
	return c.zAdd(ctx, a, n, members...)
}

// Redis `ZADD key XX score member [score member ...]` command.
func (c cmdable) ZAddXX(ctx context.Context, key string, members ...*Z) *IntCmd {
	const n = 3
	a := make([]interface{}, n+2*len(members))
	a[0], a[1], a[2] = "zadd", key, "xx"
	return c.zAdd(ctx, a, n, members...)
}

// Redis `ZADD key CH score member [score member ...]` command.
func (c cmdable) ZAddCh(ctx context.Context, key string, members ...*Z) *IntCmd {
	const n = 3
	a := make([]interface{}, n+2*len(members))
	a[0], a[1], a[2] = "zadd", key, "ch"
	return c.zAdd(ctx, a, n, members...)
}

// Redis `ZADD key NX CH score member [score member ...]` command.
func (c cmdable) ZAddNXCh(ctx context.Context, key string, members ...*Z) *IntCmd {
	const n = 4
	a := make([]interface{}, n+2*len(members))
	a[0], a[1], a[2], a[3] = "zadd", key, "nx", "ch"
	return c.zAdd(ctx, a, n, members...)
}

// Redis `ZADD key XX CH score member [score member ...]` command.
func (c cmdable) ZAddXXCh(ctx context.Context, key string, members ...*Z) *IntCmd {
	const n = 4
	a := make([]interface{}, n+2*len(members))
	a[0], a[1], a[2], a[3] = "zadd", key, "xx", "ch"
	return c.zAdd(ctx, a, n, members...)
}

func (c cmdable) zIncr(ctx context.Context, a []interface{}, n int, members ...*Z) *FloatCmd {
	for i, m := range members {
		a[n+2*i] = m.Score
		a[n+2*i+1] = m.Member
	}
	cmd := NewFloatCmd(ctx, a...)
	_ = c(ctx, cmd)
	return cmd
}

// Redis `ZADD key INCR score member` command.
func (c cmdable) ZIncr(ctx context.Context, key string, member *Z) *FloatCmd {
	const n = 3
	a := make([]interface{}, n+2)
	a[0], a[1], a[2] = "zadd", key, "incr"
	return c.zIncr(ctx, a, n, member)
}

// Redis `ZADD key NX INCR score member` command.
func (c cmdable) ZIncrNX(ctx context.Context, key string, member *Z) *FloatCmd {
	const n = 4
	a := make([]interface{}, n+2)
	a[0], a[1], a[2], a[3] = "zadd", key, "incr", "nx"
	return c.zIncr(ctx, a, n, member)
}

// Redis `ZADD key XX INCR score member` command.
func (c cmdable) ZIncrXX(ctx context.Context, key string, member *Z) *FloatCmd {
	const n = 4
	a := make([]interface{}, n+2)
	a[0], a[1], a[2], a[3] = "zadd", key, "incr", "xx"
	return c.zIncr(ctx, a, n, member)
}

func (c cmdable) ZCard(ctx context.Context, key string) *IntCmd {
	cmd := NewIntCmd(ctx, "zcard", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZCount(ctx context.Context, key, min, max string) *IntCmd {
	cmd := NewIntCmd(ctx, "zcount", key, min, max)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZLexCount(ctx context.Context, key, min, max string) *IntCmd {
	cmd := NewIntCmd(ctx, "zlexcount", key, min, max)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZIncrBy(ctx context.Context, key string, increment float64, member string) *FloatCmd {
	cmd := NewFloatCmd(ctx, "zincrby", key, increment, member)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZInterStore(ctx context.Context, destination string, store *ZStore) *IntCmd {
	args := make([]interface{}, 3+len(store.Keys))
	args[0] = "zinterstore"
	args[1] = destination
	args[2] = len(store.Keys)
	for i, key := range store.Keys {
		args[3+i] = key
	}
	if len(store.Weights) > 0 {
		args = append(args, "weights")
		for _, weight := range store.Weights {
			args = append(args, weight)
		}
	}
	if store.Aggregate != "" {
		args = append(args, "aggregate", store.Aggregate)
	}
	cmd := NewIntCmd(ctx, args...)
	cmd.setFirstKeyPos(3)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZPopMax(ctx context.Context, key string, count ...int64) *ZSliceCmd {
	args := []interface{}{
		"zpopmax",
		key,
	}

	switch len(count) {
	case 0:
		break
	case 1:
		args = append(args, count[0])
	default:
		panic("too many arguments")
	}

	cmd := NewZSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZPopMin(ctx context.Context, key string, count ...int64) *ZSliceCmd {
	args := []interface{}{
		"zpopmin",
		key,
	}

	switch len(count) {
	case 0:
		break
	case 1:
		args = append(args, count[0])
	default:
		panic("too many arguments")
	}

	cmd := NewZSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) zRange(ctx context.Context, key string, start, stop int64, withScores bool) *StringSliceCmd {
	args := []interface{}{
		"zrange",
		key,
		start,
		stop,
	}
	if withScores {
		args = append(args, "withscores")
	}
	cmd := NewStringSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZRange(ctx context.Context, key string, start, stop int64) *StringSliceCmd {
	return c.zRange(ctx, key, start, stop, false)
}

func (c cmdable) ZRangeWithScores(ctx context.Context, key string, start, stop int64) *ZSliceCmd {
	cmd := NewZSliceCmd(ctx, "zrange", key, start, stop, "withscores")
	_ = c(ctx, cmd)
	return cmd
}

type ZRangeBy struct {
	Min, Max      string
	Offset, Count int64
}

func (c cmdable) zRangeBy(ctx context.Context, zcmd, key string, opt *ZRangeBy, withScores bool) *StringSliceCmd {
	args := []interface{}{zcmd, key, opt.Min, opt.Max}
	if withScores {
		args = append(args, "withscores")
	}
	if opt.Offset != 0 || opt.Count != 0 {
		args = append(
			args,
			"limit",
			opt.Offset,
			opt.Count,
		)
	}
	cmd := NewStringSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZRangeByScore(ctx context.Context, key string, opt *ZRangeBy) *StringSliceCmd {
	return c.zRangeBy(ctx, "zrangebyscore", key, opt, false)
}

func (c cmdable) ZRangeByLex(ctx context.Context, key string, opt *ZRangeBy) *StringSliceCmd {
	return c.zRangeBy(ctx, "zrangebylex", key, opt, false)
}

func (c cmdable) ZRangeByScoreWithScores(ctx context.Context, key string, opt *ZRangeBy) *ZSliceCmd {
	args := []interface{}{"zrangebyscore", key, opt.Min, opt.Max, "withscores"}
	if opt.Offset != 0 || opt.Count != 0 {
		args = append(
			args,
			"limit",
			opt.Offset,
			opt.Count,
		)
	}
	cmd := NewZSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZRank(ctx context.Context, key, member string) *IntCmd {
	cmd := NewIntCmd(ctx, "zrank", key, member)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZRem(ctx context.Context, key string, members ...interface{}) *IntCmd {
	args := make([]interface{}, 2, 2+len(members))
	args[0] = "zrem"
	args[1] = key
	args = appendArgs(args, members)
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZRemRangeByRank(ctx context.Context, key string, start, stop int64) *IntCmd {
	cmd := NewIntCmd(
		ctx,
		"zremrangebyrank",
		key,
		start,
		stop,
	)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZRemRangeByScore(ctx context.Context, key, min, max string) *IntCmd {
	cmd := NewIntCmd(ctx, "zremrangebyscore", key, min, max)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZRemRangeByLex(ctx context.Context, key, min, max string) *IntCmd {
	cmd := NewIntCmd(ctx, "zremrangebylex", key, min, max)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZRevRange(ctx context.Context, key string, start, stop int64) *StringSliceCmd {
	cmd := NewStringSliceCmd(ctx, "zrevrange", key, start, stop)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZRevRangeWithScores(ctx context.Context, key string, start, stop int64) *ZSliceCmd {
	cmd := NewZSliceCmd(ctx, "zrevrange", key, start, stop, "withscores")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) zRevRangeBy(ctx context.Context, zcmd, key string, opt *ZRangeBy) *StringSliceCmd {
	args := []interface{}{zcmd, key, opt.Max, opt.Min}
	if opt.Offset != 0 || opt.Count != 0 {
		args = append(
			args,
			"limit",
			opt.Offset,
			opt.Count,
		)
	}
	cmd := NewStringSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZRevRangeByScore(ctx context.Context, key string, opt *ZRangeBy) *StringSliceCmd {
	return c.zRevRangeBy(ctx, "zrevrangebyscore", key, opt)
}

func (c cmdable) ZRevRangeByLex(ctx context.Context, key string, opt *ZRangeBy) *StringSliceCmd {
	return c.zRevRangeBy(ctx, "zrevrangebylex", key, opt)
}

func (c cmdable) ZRevRangeByScoreWithScores(ctx context.Context, key string, opt *ZRangeBy) *ZSliceCmd {
	args := []interface{}{"zrevrangebyscore", key, opt.Max, opt.Min, "withscores"}
	if opt.Offset != 0 || opt.Count != 0 {
		args = append(
			args,
			"limit",
			opt.Offset,
			opt.Count,
		)
	}
	cmd := NewZSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZRevRank(ctx context.Context, key, member string) *IntCmd {
	cmd := NewIntCmd(ctx, "zrevrank", key, member)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZScore(ctx context.Context, key, member string) *FloatCmd {
	cmd := NewFloatCmd(ctx, "zscore", key, member)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ZUnionStore(ctx context.Context, dest string, store *ZStore) *IntCmd {
	args := make([]interface{}, 3+len(store.Keys))
	args[0] = "zunionstore"
	args[1] = dest
	args[2] = len(store.Keys)
	for i, key := range store.Keys {
		args[3+i] = key
	}
	if len(store.Weights) > 0 {
		args = append(args, "weights")
		for _, weight := range store.Weights {
			args = append(args, weight)
		}
	}
	if store.Aggregate != "" {
		args = append(args, "aggregate", store.Aggregate)
	}

	cmd := NewIntCmd(ctx, args...)
	cmd.setFirstKeyPos(3)
	_ = c(ctx, cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c cmdable) PFAdd(ctx context.Context, key string, els ...interface{}) *IntCmd {
	args := make([]interface{}, 2, 2+len(els))
	args[0] = "pfadd"
	args[1] = key
	args = appendArgs(args, els)
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) PFCount(ctx context.Context, keys ...string) *IntCmd {
	args := make([]interface{}, 1+len(keys))
	args[0] = "pfcount"
	for i, key := range keys {
		args[1+i] = key
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) PFMerge(ctx context.Context, dest string, keys ...string) *StatusCmd {
	args := make([]interface{}, 2+len(keys))
	args[0] = "pfmerge"
	args[1] = dest
	for i, key := range keys {
		args[2+i] = key
	}
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c cmdable) BgRewriteAOF(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "bgrewriteaof")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) BgSave(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "bgsave")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClientKill(ctx context.Context, ipPort string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "client", "kill", ipPort)
	_ = c(ctx, cmd)
	return cmd
}

// ClientKillByFilter is new style syntax, while the ClientKill is old
//
//   CLIENT KILL <option> [value] ... <option> [value]
func (c cmdable) ClientKillByFilter(ctx context.Context, keys ...string) *IntCmd {
	args := make([]interface{}, 2+len(keys))
	args[0] = "client"
	args[1] = "kill"
	for i, key := range keys {
		args[2+i] = key
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClientList(ctx context.Context) *StringCmd {
	cmd := NewStringCmd(ctx, "client", "list")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClientPause(ctx context.Context, dur time.Duration) *BoolCmd {
	cmd := NewBoolCmd(ctx, "client", "pause", formatMs(ctx, dur))
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClientID(ctx context.Context) *IntCmd {
	cmd := NewIntCmd(ctx, "client", "id")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClientUnblock(ctx context.Context, id int64) *IntCmd {
	cmd := NewIntCmd(ctx, "client", "unblock", id)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClientUnblockWithError(ctx context.Context, id int64) *IntCmd {
	cmd := NewIntCmd(ctx, "client", "unblock", id, "error")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ConfigGet(ctx context.Context, parameter string) *SliceCmd {
	cmd := NewSliceCmd(ctx, "config", "get", parameter)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ConfigResetStat(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "config", "resetstat")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ConfigSet(ctx context.Context, parameter, value string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "config", "set", parameter, value)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ConfigRewrite(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "config", "rewrite")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) DBSize(ctx context.Context) *IntCmd {
	cmd := NewIntCmd(ctx, "dbsize")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) FlushAll(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "flushall")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) FlushAllAsync(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "flushall", "async")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) FlushDB(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "flushdb")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) FlushDBAsync(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "flushdb", "async")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Info(ctx context.Context, section ...string) *StringCmd {
	args := []interface{}{"info"}
	if len(section) > 0 {
		args = append(args, section[0])
	}
	cmd := NewStringCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) LastSave(ctx context.Context) *IntCmd {
	cmd := NewIntCmd(ctx, "lastsave")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Save(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "save")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) shutdown(ctx context.Context, modifier string) *StatusCmd {
	var args []interface{}
	if modifier == "" {
		args = []interface{}{"shutdown"}
	} else {
		args = []interface{}{"shutdown", modifier}
	}
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	if err := cmd.Err(); err != nil {
		if err == io.EOF {
			// Server quit as expected.
			cmd.err = nil
		}
	} else {
		// Server did not quit. String reply contains the reason.
		cmd.err = errors.New(cmd.val)
		cmd.val = ""
	}
	return cmd
}

func (c cmdable) Shutdown(ctx context.Context) *StatusCmd {
	return c.shutdown(ctx, "")
}

func (c cmdable) ShutdownSave(ctx context.Context) *StatusCmd {
	return c.shutdown(ctx, "save")
}

func (c cmdable) ShutdownNoSave(ctx context.Context) *StatusCmd {
	return c.shutdown(ctx, "nosave")
}

func (c cmdable) SlaveOf(ctx context.Context, host, port string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "slaveof", host, port)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) SlowLogGet(ctx context.Context, num int64) *SlowLogCmd {
	cmd := NewSlowLogCmd(context.Background(), "slowlog", "get", num)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) Sync(ctx context.Context) {
	panic("not implemented")
}

func (c cmdable) Time(ctx context.Context) *TimeCmd {
	cmd := NewTimeCmd(ctx, "time")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) DebugObject(ctx context.Context, key string) *StringCmd {
	cmd := NewStringCmd(ctx, "debug", "object", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ReadOnly(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "readonly")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ReadWrite(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "readwrite")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) MemoryUsage(ctx context.Context, key string, samples ...int) *IntCmd {
	args := []interface{}{"memory", "usage", key}
	if len(samples) > 0 {
		if len(samples) != 1 {
			panic("MemoryUsage expects single sample count")
		}
		args = append(args, "SAMPLES", samples[0])
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c cmdable) Eval(ctx context.Context, script string, keys []string, args ...interface{}) *Cmd {
	cmdArgs := make([]interface{}, 3+len(keys), 3+len(keys)+len(args))
	cmdArgs[0] = "eval"
	cmdArgs[1] = script
	cmdArgs[2] = len(keys)
	for i, key := range keys {
		cmdArgs[3+i] = key
	}
	cmdArgs = appendArgs(cmdArgs, args)
	cmd := NewCmd(ctx, cmdArgs...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) EvalSha(ctx context.Context, sha1 string, keys []string, args ...interface{}) *Cmd {
	cmdArgs := make([]interface{}, 3+len(keys), 3+len(keys)+len(args))
	cmdArgs[0] = "evalsha"
	cmdArgs[1] = sha1
	cmdArgs[2] = len(keys)
	for i, key := range keys {
		cmdArgs[3+i] = key
	}
	cmdArgs = appendArgs(cmdArgs, args)
	cmd := NewCmd(ctx, cmdArgs...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ScriptExists(ctx context.Context, hashes ...string) *BoolSliceCmd {
	args := make([]interface{}, 2+len(hashes))
	args[0] = "script"
	args[1] = "exists"
	for i, hash := range hashes {
		args[2+i] = hash
	}
	cmd := NewBoolSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ScriptFlush(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "script", "flush")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ScriptKill(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "script", "kill")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ScriptLoad(ctx context.Context, script string) *StringCmd {
	cmd := NewStringCmd(ctx, "script", "load", script)
	_ = c(ctx, cmd)
	return cmd
}

//------------------------------------------------------------------------------

// Publish posts the message to the channel.
func (c cmdable) Publish(ctx context.Context, channel string, message interface{}) *IntCmd {
	cmd := NewIntCmd(ctx, "publish", channel, message)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) PubSubChannels(ctx context.Context, pattern string) *StringSliceCmd {
	args := []interface{}{"pubsub", "channels"}
	if pattern != "*" {
		args = append(args, pattern)
	}
	cmd := NewStringSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) PubSubNumSub(ctx context.Context, channels ...string) *StringIntMapCmd {
	args := make([]interface{}, 2+len(channels))
	args[0] = "pubsub"
	args[1] = "numsub"
	for i, channel := range channels {
		args[2+i] = channel
	}
	cmd := NewStringIntMapCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) PubSubNumPat(ctx context.Context) *IntCmd {
	cmd := NewIntCmd(ctx, "pubsub", "numpat")
	_ = c(ctx, cmd)
	return cmd
}

//------------------------------------------------------------------------------

func (c cmdable) ClusterSlots(ctx context.Context) *ClusterSlotsCmd {
	cmd := NewClusterSlotsCmd(ctx, "cluster", "slots")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterNodes(ctx context.Context) *StringCmd {
	cmd := NewStringCmd(ctx, "cluster", "nodes")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterMeet(ctx context.Context, host, port string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "cluster", "meet", host, port)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterForget(ctx context.Context, nodeID string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "cluster", "forget", nodeID)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterReplicate(ctx context.Context, nodeID string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "cluster", "replicate", nodeID)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterResetSoft(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "cluster", "reset", "soft")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterResetHard(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "cluster", "reset", "hard")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterInfo(ctx context.Context) *StringCmd {
	cmd := NewStringCmd(ctx, "cluster", "info")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterKeySlot(ctx context.Context, key string) *IntCmd {
	cmd := NewIntCmd(ctx, "cluster", "keyslot", key)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterGetKeysInSlot(ctx context.Context, slot int, count int) *StringSliceCmd {
	cmd := NewStringSliceCmd(ctx, "cluster", "getkeysinslot", slot, count)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterCountFailureReports(ctx context.Context, nodeID string) *IntCmd {
	cmd := NewIntCmd(ctx, "cluster", "count-failure-reports", nodeID)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterCountKeysInSlot(ctx context.Context, slot int) *IntCmd {
	cmd := NewIntCmd(ctx, "cluster", "countkeysinslot", slot)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterDelSlots(ctx context.Context, slots ...int) *StatusCmd {
	args := make([]interface{}, 2+len(slots))
	args[0] = "cluster"
	args[1] = "delslots"
	for i, slot := range slots {
		args[2+i] = slot
	}
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterDelSlotsRange(ctx context.Context, min, max int) *StatusCmd {
	size := max - min + 1
	slots := make([]int, size)
	for i := 0; i < size; i++ {
		slots[i] = min + i
	}
	return c.ClusterDelSlots(ctx, slots...)
}

func (c cmdable) ClusterSaveConfig(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "cluster", "saveconfig")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterSlaves(ctx context.Context, nodeID string) *StringSliceCmd {
	cmd := NewStringSliceCmd(ctx, "cluster", "slaves", nodeID)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterFailover(ctx context.Context) *StatusCmd {
	cmd := NewStatusCmd(ctx, "cluster", "failover")
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterAddSlots(ctx context.Context, slots ...int) *StatusCmd {
	args := make([]interface{}, 2+len(slots))
	args[0] = "cluster"
	args[1] = "addslots"
	for i, num := range slots {
		args[2+i] = num
	}
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) ClusterAddSlotsRange(ctx context.Context, min, max int) *StatusCmd {
	size := max - min + 1
	slots := make([]int, size)
	for i := 0; i < size; i++ {
		slots[i] = min + i
	}
	return c.ClusterAddSlots(ctx, slots...)
}

//------------------------------------------------------------------------------

func (c cmdable) GeoAdd(ctx context.Context, key string, geoLocation ...*GeoLocation) *IntCmd {
	args := make([]interface{}, 2+3*len(geoLocation))
	args[0] = "geoadd"
	args[1] = key
	for i, eachLoc := range geoLocation {
		args[2+3*i] = eachLoc.Longitude
		args[2+3*i+1] = eachLoc.Latitude
		args[2+3*i+2] = eachLoc.Name
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// GeoRadius is a read-only GEORADIUS_RO command.
func (c cmdable) GeoRadius(
	ctx context.Context, key string, longitude, latitude float64, query *GeoRadiusQuery,
) *GeoLocationCmd {
	cmd := NewGeoLocationCmd(ctx, query, "georadius_ro", key, longitude, latitude)
	if query.Store != "" || query.StoreDist != "" {
		cmd.SetErr(errors.New("GeoRadius does not support Store or StoreDist"))
		return cmd
	}
	_ = c(ctx, cmd)
	return cmd
}

// GeoRadiusStore is a writing GEORADIUS command.
func (c cmdable) GeoRadiusStore(
	ctx context.Context, key string, longitude, latitude float64, query *GeoRadiusQuery,
) *IntCmd {
	args := geoLocationArgs(query, "georadius", key, longitude, latitude)
	cmd := NewIntCmd(ctx, args...)
	if query.Store == "" && query.StoreDist == "" {
		cmd.SetErr(errors.New("GeoRadiusStore requires Store or StoreDist"))
		return cmd
	}
	_ = c(ctx, cmd)
	return cmd
}

// GeoRadius is a read-only GEORADIUSBYMEMBER_RO command.
func (c cmdable) GeoRadiusByMember(
	ctx context.Context, key, member string, query *GeoRadiusQuery,
) *GeoLocationCmd {
	cmd := NewGeoLocationCmd(ctx, query, "georadiusbymember_ro", key, member)
	if query.Store != "" || query.StoreDist != "" {
		cmd.SetErr(errors.New("GeoRadiusByMember does not support Store or StoreDist"))
		return cmd
	}
	_ = c(ctx, cmd)
	return cmd
}

// GeoRadiusByMemberStore is a writing GEORADIUSBYMEMBER command.
func (c cmdable) GeoRadiusByMemberStore(
	ctx context.Context, key, member string, query *GeoRadiusQuery,
) *IntCmd {
	args := geoLocationArgs(query, "georadiusbymember", key, member)
	cmd := NewIntCmd(ctx, args...)
	if query.Store == "" && query.StoreDist == "" {
		cmd.SetErr(errors.New("GeoRadiusByMemberStore requires Store or StoreDist"))
		return cmd
	}
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) GeoDist(
	ctx context.Context, key string, member1, member2, unit string,
) *FloatCmd {
	if unit == "" {
		unit = "km"
	}
	cmd := NewFloatCmd(ctx, "geodist", key, member1, member2, unit)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) GeoHash(ctx context.Context, key string, members ...string) *StringSliceCmd {
	args := make([]interface{}, 2+len(members))
	args[0] = "geohash"
	args[1] = key
	for i, member := range members {
		args[2+i] = member
	}
	cmd := NewStringSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) GeoPos(ctx context.Context, key string, members ...string) *GeoPosCmd {
	args := make([]interface{}, 2+len(members))
	args[0] = "geopos"
	args[1] = key
	for i, member := range members {
		args[2+i] = member
	}
	cmd := NewGeoPosCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}
