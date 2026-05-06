package rueidis

import (
	"context"
	"errors"
	"time"

	intl "github.com/redis/rueidis/internal/cmds"
)

// MGetCache is a helper that consults the client-side caches with multiple keys by grouping keys within same slot into multiple GETs
func MGetCache(client Client, ctx context.Context, ttl time.Duration, keys []string) (ret map[string]RedisMessage, err error) {
	if len(keys) == 0 {
		return make(map[string]RedisMessage), nil
	}
	if isCacheDisabled(client) {
		return MGet(client, ctx, keys)
	}
	cmds := mgetcachecmdsp.Get(len(keys), len(keys))
	defer mgetcachecmdsp.Put(cmds)
	for i := range cmds.s {
		cmds.s[i] = CT(client.B().Get().Key(keys[i]).Cache(), ttl)
	}
	return doMultiCache(client, ctx, cmds.s, keys)
}

func isCacheDisabled(client Client) bool {
	switch c := client.(type) {
	case *singleClient:
		return c.DisableCache
	case *sentinelClient:
		return c.mOpt != nil && c.mOpt.DisableCache
	case *clusterClient:
		return c.opt != nil && c.opt.DisableCache
	}
	return false
}

// MGet is a helper that consults the redis directly with multiple keys by grouping keys within same slot into MGET or multiple GETs
func MGet(client Client, ctx context.Context, keys []string) (ret map[string]RedisMessage, err error) {
	if len(keys) == 0 {
		return make(map[string]RedisMessage), nil
	}

	switch client.(type) {
	case *singleClient, *sentinelClient:
		return clientMGet(client, ctx, client.B().Mget().Key(keys...).Build(), keys)
	}

	cmds := mgetcmdsp.Get(len(keys), len(keys))
	defer mgetcmdsp.Put(cmds)
	for i := range cmds.s {
		cmds.s[i] = client.B().Get().Key(keys[i]).Build()
	}
	return doMultiGet(client, ctx, cmds.s, keys)
}

// MSet is a helper that consults the redis directly with multiple keys by grouping keys within same slot into MSETs or multiple SETs
func MSet(client Client, ctx context.Context, kvs map[string]string) map[string]error {
	if len(kvs) == 0 {
		return make(map[string]error)
	}

	switch client.(type) {
	case *singleClient, *sentinelClient:
		return clientMSet(client, ctx, "MSET", kvs, make(map[string]error, len(kvs)))
	}

	cmds := mgetcmdsp.Get(0, len(kvs))
	defer mgetcmdsp.Put(cmds)
	for k, v := range kvs {
		cmds.s = append(cmds.s, client.B().Set().Key(k).Value(v).Build().Pin())
	}
	return doMultiSet(client, ctx, cmds.s)
}

// MDel is a helper that consults the redis directly with multiple keys by grouping keys within same slot into DELs
func MDel(client Client, ctx context.Context, keys []string) map[string]error {
	if len(keys) == 0 {
		return make(map[string]error)
	}

	switch client.(type) {
	case *singleClient, *sentinelClient:
		return clientMDel(client, ctx, keys)
	}

	cmds := mgetcmdsp.Get(len(keys), len(keys))
	defer mgetcmdsp.Put(cmds)
	for i, k := range keys {
		cmds.s[i] = client.B().Del().Key(k).Build().Pin()
	}
	return doMultiSet(client, ctx, cmds.s)
}

// MSetNX is a helper that consults the redis directly with multiple keys by grouping keys within same slot into MSETNXs or multiple SETNXs
func MSetNX(client Client, ctx context.Context, kvs map[string]string) map[string]error {
	if len(kvs) == 0 {
		return make(map[string]error)
	}

	switch client.(type) {
	case *singleClient, *sentinelClient:
		return clientMSet(client, ctx, "MSETNX", kvs, make(map[string]error, len(kvs)))
	}

	cmds := mgetcmdsp.Get(0, len(kvs))
	defer mgetcmdsp.Put(cmds)
	for k, v := range kvs {
		cmds.s = append(cmds.s, client.B().Set().Key(k).Value(v).Nx().Build().Pin())
	}
	return doMultiSet(client, ctx, cmds.s)
}

// JsonMGetCache is a helper that consults the client-side caches with multiple keys by grouping keys within same slot into multiple JSON.GETs
func JsonMGetCache(client Client, ctx context.Context, ttl time.Duration, keys []string, path string) (ret map[string]RedisMessage, err error) {
	if len(keys) == 0 {
		return make(map[string]RedisMessage), nil
	}
	cmds := mgetcachecmdsp.Get(len(keys), len(keys))
	defer mgetcachecmdsp.Put(cmds)
	for i := range cmds.s {
		cmds.s[i] = CT(client.B().JsonGet().Key(keys[i]).Path(path).Cache(), ttl)
	}
	return doMultiCache(client, ctx, cmds.s, keys)
}

// JsonMGet is a helper that consults redis directly with multiple keys by grouping keys within same slot into JSON.MGETs or multiple JSON.GETs
func JsonMGet(client Client, ctx context.Context, keys []string, path string) (ret map[string]RedisMessage, err error) {
	if len(keys) == 0 {
		return make(map[string]RedisMessage), nil
	}

	switch client.(type) {
	case *singleClient, *sentinelClient:
		return clientMGet(client, ctx, client.B().JsonMget().Key(keys...).Path(path).Build(), keys)
	}

	cmds := mgetcmdsp.Get(len(keys), len(keys))
	defer mgetcmdsp.Put(cmds)
	for i := range cmds.s {
		cmds.s[i] = client.B().JsonGet().Key(keys[i]).Path(path).Build()
	}
	return doMultiGet(client, ctx, cmds.s, keys)
}

// JsonMSet is a helper that consults redis directly with multiple keys by grouping keys within same slot into JSON.MSETs or multiple JOSN.SETs
func JsonMSet(client Client, ctx context.Context, kvs map[string]string, path string) map[string]error {
	if len(kvs) == 0 {
		return make(map[string]error)
	}

	switch client.(type) {
	case *singleClient, *sentinelClient:
		return clientJSONMSet(client, ctx, kvs, path, make(map[string]error, len(kvs)))
	}

	cmds := mgetcmdsp.Get(0, len(kvs))
	defer mgetcmdsp.Put(cmds)
	for k, v := range kvs {
		cmds.s = append(cmds.s, client.B().JsonSet().Key(k).Path(path).Value(v).Build().Pin())
	}
	return doMultiSet(client, ctx, cmds.s)
}

// DecodeSliceOfJSON is a helper that struct-scans each RedisMessage into dest, which must be a slice of pointer.
func DecodeSliceOfJSON[T any](result RedisResult, dest *[]T) error {
	values, err := result.ToArray()
	if err != nil {
		return err
	}

	ts := make([]T, len(values))
	for i, v := range values {
		var t T
		if err = v.DecodeJSON(&t); err != nil {
			if IsRedisNil(err) {
				continue
			}
			return err
		}
		ts[i] = t
	}
	*dest = ts
	return nil
}

func clientMGet(client Client, ctx context.Context, cmd Completed, keys []string) (ret map[string]RedisMessage, err error) {
	arr, err := client.Do(ctx, cmd).ToArray()
	if err != nil {
		return nil, err
	}
	return arrayToKV(make(map[string]RedisMessage, len(keys)), arr, keys), nil
}

func clientMSet(client Client, ctx context.Context, mset string, kvs map[string]string, ret map[string]error) map[string]error {
	cmd := client.B().Arbitrary(mset)
	for k, v := range kvs {
		cmd = cmd.Args(k, v)
	}
	ok, err := client.Do(ctx, cmd.Build()).AsBool()
	if err == nil && !ok {
		err = ErrMSetNXNotSet
	}
	for k := range kvs {
		ret[k] = err
	}
	return ret
}

func clientJSONMSet(client Client, ctx context.Context, kvs map[string]string, path string, ret map[string]error) map[string]error {
	cmd := intl.JsonMsetTripletValue(client.B().JsonMset())
	for k, v := range kvs {
		cmd = cmd.Key(k).Path(path).Value(v)
	}
	err := client.Do(ctx, cmd.Build()).Error()
	for k := range kvs {
		ret[k] = err
	}
	return ret
}

func clientMDel(client Client, ctx context.Context, keys []string) map[string]error {
	err := client.Do(ctx, client.B().Del().Key(keys...).Build()).Error()
	ret := make(map[string]error, len(keys))
	for _, k := range keys {
		ret[k] = err
	}
	return ret
}

func doMultiCache(cc Client, ctx context.Context, cmds []CacheableTTL, keys []string) (ret map[string]RedisMessage, err error) {
	ret = make(map[string]RedisMessage, len(keys))
	resps := cc.DoMultiCache(ctx, cmds...)
	defer resultsp.Put(&redisresults{s: resps})
	for i, resp := range resps {
		if err := resp.NonRedisError(); err != nil {
			return nil, err
		}
		ret[keys[i]] = resp.val
	}
	return ret, nil
}

func doMultiGet(cc Client, ctx context.Context, cmds []Completed, keys []string) (ret map[string]RedisMessage, err error) {
	ret = make(map[string]RedisMessage, len(keys))
	resps := cc.DoMulti(ctx, cmds...)
	defer resultsp.Put(&redisresults{s: resps})
	for i, resp := range resps {
		if err := resp.NonRedisError(); err != nil {
			return nil, err
		}
		ret[keys[i]] = resp.val
	}
	return ret, nil
}

func doMultiSet(cc Client, ctx context.Context, cmds []Completed) (ret map[string]error) {
	ret = make(map[string]error, len(cmds))
	resps := cc.DoMulti(ctx, cmds...)
	for i, resp := range resps {
		if ret[cmds[i].Commands()[1]] = resp.Error(); resp.NonRedisError() == nil {
			intl.PutCompletedForce(cmds[i])
		}
	}
	resultsp.Put(&redisresults{s: resps})
	return ret
}

func arrayToKV(m map[string]RedisMessage, arr []RedisMessage, keys []string) map[string]RedisMessage {
	for i, resp := range arr {
		m[keys[i]] = resp
	}
	return m
}

// ErrMSetNXNotSet is used in the MSetNX helper when the underlying MSETNX response is 0.
// Ref: https://redis.io/commands/msetnx/
var ErrMSetNXNotSet = errors.New("MSETNX: no key was set")
