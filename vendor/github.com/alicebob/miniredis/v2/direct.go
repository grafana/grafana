package miniredis

// Commands to modify and query our databases directly.

import (
	"errors"
	"math/big"
	"time"
)

var (
	// ErrKeyNotFound is returned when a key doesn't exist.
	ErrKeyNotFound = errors.New(msgKeyNotFound)

	// ErrWrongType when a key is not the right type.
	ErrWrongType = errors.New(msgWrongType)

	// ErrNotValidHllValue when a key is not a valid HyperLogLog string value.
	ErrNotValidHllValue = errors.New(msgNotValidHllValue)

	// ErrIntValueError can returned by INCRBY
	ErrIntValueError = errors.New(msgInvalidInt)

	// ErrIntValueOverflowError can be returned by INCR, DECR, INCRBY, DECRBY
	ErrIntValueOverflowError = errors.New(msgIntOverflow)

	// ErrFloatValueError can returned by INCRBYFLOAT
	ErrFloatValueError = errors.New(msgInvalidFloat)
)

// Select sets the DB id for all direct commands.
func (m *Miniredis) Select(i int) {
	m.Lock()
	defer m.Unlock()
	m.selectedDB = i
}

// Keys returns all keys from the selected database, sorted.
func (m *Miniredis) Keys() []string {
	return m.DB(m.selectedDB).Keys()
}

// Keys returns all keys, sorted.
func (db *RedisDB) Keys() []string {
	db.master.Lock()
	defer db.master.Unlock()

	return db.allKeys()
}

// FlushAll removes all keys from all databases.
func (m *Miniredis) FlushAll() {
	m.Lock()
	defer m.Unlock()
	defer m.signal.Broadcast()

	m.flushAll()
}

func (m *Miniredis) flushAll() {
	for _, db := range m.dbs {
		db.flush()
	}
}

// FlushDB removes all keys from the selected database.
func (m *Miniredis) FlushDB() {
	m.DB(m.selectedDB).FlushDB()
}

// FlushDB removes all keys.
func (db *RedisDB) FlushDB() {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	db.flush()
}

// Get returns string keys added with SET.
func (m *Miniredis) Get(k string) (string, error) {
	return m.DB(m.selectedDB).Get(k)
}

// Get returns a string key.
func (db *RedisDB) Get(k string) (string, error) {
	db.master.Lock()
	defer db.master.Unlock()

	if !db.exists(k) {
		return "", ErrKeyNotFound
	}
	if db.t(k) != "string" {
		return "", ErrWrongType
	}
	return db.stringGet(k), nil
}

// Set sets a string key. Removes expire.
func (m *Miniredis) Set(k, v string) error {
	return m.DB(m.selectedDB).Set(k, v)
}

// Set sets a string key. Removes expire.
// Unlike redis the key can't be an existing non-string key.
func (db *RedisDB) Set(k, v string) error {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	if db.exists(k) && db.t(k) != "string" {
		return ErrWrongType
	}
	db.del(k, true) // Remove expire
	db.stringSet(k, v)
	return nil
}

// Incr changes a int string value by delta.
func (m *Miniredis) Incr(k string, delta int) (int, error) {
	return m.DB(m.selectedDB).Incr(k, delta)
}

// Incr changes a int string value by delta.
func (db *RedisDB) Incr(k string, delta int) (int, error) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	if db.exists(k) && db.t(k) != "string" {
		return 0, ErrWrongType
	}

	return db.stringIncr(k, delta)
}

// IncrByFloat increments the float value of a key by the given delta.
// is an alias for Miniredis.Incrfloat
func (m *Miniredis) IncrByFloat(k string, delta float64) (float64, error) {
	return m.Incrfloat(k, delta)
}

// Incrfloat changes a float string value by delta.
func (m *Miniredis) Incrfloat(k string, delta float64) (float64, error) {
	return m.DB(m.selectedDB).Incrfloat(k, delta)
}

// Incrfloat changes a float string value by delta.
func (db *RedisDB) Incrfloat(k string, delta float64) (float64, error) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	if db.exists(k) && db.t(k) != "string" {
		return 0, ErrWrongType
	}

	v, err := db.stringIncrfloat(k, big.NewFloat(delta))
	if err != nil {
		return 0, err
	}
	vf, _ := v.Float64()
	return vf, nil
}

// List returns the list k, or an error if it's not there or something else.
// This is the same as the Redis command `LRANGE 0 -1`, but you can do your own
// range-ing.
func (m *Miniredis) List(k string) ([]string, error) {
	return m.DB(m.selectedDB).List(k)
}

// List returns the list k, or an error if it's not there or something else.
// This is the same as the Redis command `LRANGE 0 -1`, but you can do your own
// range-ing.
func (db *RedisDB) List(k string) ([]string, error) {
	db.master.Lock()
	defer db.master.Unlock()

	if !db.exists(k) {
		return nil, ErrKeyNotFound
	}
	if db.t(k) != "list" {
		return nil, ErrWrongType
	}
	return db.listKeys[k], nil
}

// Lpush prepends one value to a list. Returns the new length.
func (m *Miniredis) Lpush(k, v string) (int, error) {
	return m.DB(m.selectedDB).Lpush(k, v)
}

// Lpush prepends one value to a list. Returns the new length.
func (db *RedisDB) Lpush(k, v string) (int, error) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	if db.exists(k) && db.t(k) != "list" {
		return 0, ErrWrongType
	}
	return db.listLpush(k, v), nil
}

// Lpop removes and returns the last element in a list.
func (m *Miniredis) Lpop(k string) (string, error) {
	return m.DB(m.selectedDB).Lpop(k)
}

// Lpop removes and returns the last element in a list.
func (db *RedisDB) Lpop(k string) (string, error) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	if !db.exists(k) {
		return "", ErrKeyNotFound
	}
	if db.t(k) != "list" {
		return "", ErrWrongType
	}
	return db.listLpop(k), nil
}

// RPush appends one or multiple values to a list. Returns the new length.
// An alias for Push
func (m *Miniredis) RPush(k string, v ...string) (int, error) {
	return m.Push(k, v...)
}

// Push add element at the end. Returns the new length.
func (m *Miniredis) Push(k string, v ...string) (int, error) {
	return m.DB(m.selectedDB).Push(k, v...)
}

// Push add element at the end. Is called RPUSH in redis. Returns the new length.
func (db *RedisDB) Push(k string, v ...string) (int, error) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	if db.exists(k) && db.t(k) != "list" {
		return 0, ErrWrongType
	}
	return db.listPush(k, v...), nil
}

// RPop is an alias for Pop
func (m *Miniredis) RPop(k string) (string, error) {
	return m.Pop(k)
}

// Pop removes and returns the last element. Is called RPOP in Redis.
func (m *Miniredis) Pop(k string) (string, error) {
	return m.DB(m.selectedDB).Pop(k)
}

// Pop removes and returns the last element. Is called RPOP in Redis.
func (db *RedisDB) Pop(k string) (string, error) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	if !db.exists(k) {
		return "", ErrKeyNotFound
	}
	if db.t(k) != "list" {
		return "", ErrWrongType
	}

	return db.listPop(k), nil
}

// SAdd adds keys to a set. Returns the number of new keys.
// Alias for SetAdd
func (m *Miniredis) SAdd(k string, elems ...string) (int, error) {
	return m.SetAdd(k, elems...)
}

// SetAdd adds keys to a set. Returns the number of new keys.
func (m *Miniredis) SetAdd(k string, elems ...string) (int, error) {
	return m.DB(m.selectedDB).SetAdd(k, elems...)
}

// SetAdd adds keys to a set. Returns the number of new keys.
func (db *RedisDB) SetAdd(k string, elems ...string) (int, error) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	if db.exists(k) && db.t(k) != "set" {
		return 0, ErrWrongType
	}
	return db.setAdd(k, elems...), nil
}

// SMembers returns all keys in a set, sorted.
// Alias for Members.
func (m *Miniredis) SMembers(k string) ([]string, error) {
	return m.Members(k)
}

// Members returns all keys in a set, sorted.
func (m *Miniredis) Members(k string) ([]string, error) {
	return m.DB(m.selectedDB).Members(k)
}

// Members gives all set keys. Sorted.
func (db *RedisDB) Members(k string) ([]string, error) {
	db.master.Lock()
	defer db.master.Unlock()

	if !db.exists(k) {
		return nil, ErrKeyNotFound
	}
	if db.t(k) != "set" {
		return nil, ErrWrongType
	}
	return db.setMembers(k), nil
}

// SIsMember tells if value is in the set.
// Alias for IsMember
func (m *Miniredis) SIsMember(k, v string) (bool, error) {
	return m.IsMember(k, v)
}

// IsMember tells if value is in the set.
func (m *Miniredis) IsMember(k, v string) (bool, error) {
	return m.DB(m.selectedDB).IsMember(k, v)
}

// IsMember tells if value is in the set.
func (db *RedisDB) IsMember(k, v string) (bool, error) {
	db.master.Lock()
	defer db.master.Unlock()

	if !db.exists(k) {
		return false, ErrKeyNotFound
	}
	if db.t(k) != "set" {
		return false, ErrWrongType
	}
	return db.setIsMember(k, v), nil
}

// HKeys returns all (sorted) keys ('fields') for a hash key.
func (m *Miniredis) HKeys(k string) ([]string, error) {
	return m.DB(m.selectedDB).HKeys(k)
}

// HKeys returns all (sorted) keys ('fields') for a hash key.
func (db *RedisDB) HKeys(key string) ([]string, error) {
	db.master.Lock()
	defer db.master.Unlock()

	if !db.exists(key) {
		return nil, ErrKeyNotFound
	}
	if db.t(key) != "hash" {
		return nil, ErrWrongType
	}
	return db.hashFields(key), nil
}

// Del deletes a key and any expiration value. Returns whether there was a key.
func (m *Miniredis) Del(k string) bool {
	return m.DB(m.selectedDB).Del(k)
}

// Del deletes a key and any expiration value. Returns whether there was a key.
func (db *RedisDB) Del(k string) bool {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	if !db.exists(k) {
		return false
	}
	db.del(k, true)
	return true
}

// Unlink deletes a key and any expiration value. Returns where there was a key.
// It's exactly the same as Del() and is not async. It is here for the consistency.
func (m *Miniredis) Unlink(k string) bool {
	return m.Del(k)
}

// Unlink deletes a key and any expiration value. Returns where there was a key.
// It's exactly the same as Del() and is not async. It is here for the consistency.
func (db *RedisDB) Unlink(k string) bool {
	return db.Del(k)
}

// TTL is the left over time to live. As set via EXPIRE, PEXPIRE, EXPIREAT,
// PEXPIREAT.
// Note: this direct function returns 0 if there is no TTL set, unlike redis,
// which returns -1.
func (m *Miniredis) TTL(k string) time.Duration {
	return m.DB(m.selectedDB).TTL(k)
}

// TTL is the left over time to live. As set via EXPIRE, PEXPIRE, EXPIREAT,
// PEXPIREAT.
// 0 if not set.
func (db *RedisDB) TTL(k string) time.Duration {
	db.master.Lock()
	defer db.master.Unlock()

	return db.ttl[k]
}

// SetTTL sets the TTL of a key.
func (m *Miniredis) SetTTL(k string, ttl time.Duration) {
	m.DB(m.selectedDB).SetTTL(k, ttl)
}

// SetTTL sets the time to live of a key.
func (db *RedisDB) SetTTL(k string, ttl time.Duration) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	db.ttl[k] = ttl
	db.incr(k)
}

// Type gives the type of a key, or ""
func (m *Miniredis) Type(k string) string {
	return m.DB(m.selectedDB).Type(k)
}

// Type gives the type of a key, or ""
func (db *RedisDB) Type(k string) string {
	db.master.Lock()
	defer db.master.Unlock()

	return db.t(k)
}

// Exists tells whether a key exists.
func (m *Miniredis) Exists(k string) bool {
	return m.DB(m.selectedDB).Exists(k)
}

// Exists tells whether a key exists.
func (db *RedisDB) Exists(k string) bool {
	db.master.Lock()
	defer db.master.Unlock()

	return db.exists(k)
}

// HGet returns hash keys added with HSET.
// This will return an empty string if the key is not set. Redis would return
// a nil.
// Returns empty string when the key is of a different type.
func (m *Miniredis) HGet(k, f string) string {
	return m.DB(m.selectedDB).HGet(k, f)
}

// HGet returns hash keys added with HSET.
// Returns empty string when the key is of a different type.
func (db *RedisDB) HGet(k, f string) string {
	db.master.Lock()
	defer db.master.Unlock()

	h, ok := db.hashKeys[k]
	if !ok {
		return ""
	}
	return h[f]
}

// HSet sets hash keys.
// If there is another key by the same name it will be gone.
func (m *Miniredis) HSet(k string, fv ...string) {
	m.DB(m.selectedDB).HSet(k, fv...)
}

// HSet sets hash keys.
// If there is another key by the same name it will be gone.
func (db *RedisDB) HSet(k string, fv ...string) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	db.hashSet(k, fv...)
}

// HDel deletes a hash key.
func (m *Miniredis) HDel(k, f string) {
	m.DB(m.selectedDB).HDel(k, f)
}

// HDel deletes a hash key.
func (db *RedisDB) HDel(k, f string) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	db.hdel(k, f)
}

func (db *RedisDB) hdel(k, f string) {
	if _, ok := db.hashKeys[k]; !ok {
		return
	}
	delete(db.hashKeys[k], f)
	db.incr(k)
}

// HIncrBy increases the integer value of a hash field by delta (int).
func (m *Miniredis) HIncrBy(k, f string, delta int) (int, error) {
	return m.HIncr(k, f, delta)
}

// HIncr increases a key/field by delta (int).
func (m *Miniredis) HIncr(k, f string, delta int) (int, error) {
	return m.DB(m.selectedDB).HIncr(k, f, delta)
}

// HIncr increases a key/field by delta (int).
func (db *RedisDB) HIncr(k, f string, delta int) (int, error) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	return db.hashIncr(k, f, delta)
}

// HIncrByFloat increases a key/field by delta (float).
func (m *Miniredis) HIncrByFloat(k, f string, delta float64) (float64, error) {
	return m.HIncrfloat(k, f, delta)
}

// HIncrfloat increases a key/field by delta (float).
func (m *Miniredis) HIncrfloat(k, f string, delta float64) (float64, error) {
	return m.DB(m.selectedDB).HIncrfloat(k, f, delta)
}

// HIncrfloat increases a key/field by delta (float).
func (db *RedisDB) HIncrfloat(k, f string, delta float64) (float64, error) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	v, err := db.hashIncrfloat(k, f, big.NewFloat(delta))
	if err != nil {
		return 0, err
	}
	vf, _ := v.Float64()
	return vf, nil
}

// SRem removes fields from a set. Returns number of deleted fields.
func (m *Miniredis) SRem(k string, fields ...string) (int, error) {
	return m.DB(m.selectedDB).SRem(k, fields...)
}

// SRem removes fields from a set. Returns number of deleted fields.
func (db *RedisDB) SRem(k string, fields ...string) (int, error) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	if !db.exists(k) {
		return 0, ErrKeyNotFound
	}
	if db.t(k) != "set" {
		return 0, ErrWrongType
	}
	return db.setRem(k, fields...), nil
}

// ZAdd adds a score,member to a sorted set.
func (m *Miniredis) ZAdd(k string, score float64, member string) (bool, error) {
	return m.DB(m.selectedDB).ZAdd(k, score, member)
}

// ZAdd adds a score,member to a sorted set.
func (db *RedisDB) ZAdd(k string, score float64, member string) (bool, error) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	if db.exists(k) && db.t(k) != "zset" {
		return false, ErrWrongType
	}
	return db.ssetAdd(k, score, member), nil
}

// ZMembers returns all members of a sorted set by score
func (m *Miniredis) ZMembers(k string) ([]string, error) {
	return m.DB(m.selectedDB).ZMembers(k)
}

// ZMembers returns all members of a sorted set by score
func (db *RedisDB) ZMembers(k string) ([]string, error) {
	db.master.Lock()
	defer db.master.Unlock()

	if !db.exists(k) {
		return nil, ErrKeyNotFound
	}
	if db.t(k) != "zset" {
		return nil, ErrWrongType
	}
	return db.ssetMembers(k), nil
}

// SortedSet returns a raw string->float64 map.
func (m *Miniredis) SortedSet(k string) (map[string]float64, error) {
	return m.DB(m.selectedDB).SortedSet(k)
}

// SortedSet returns a raw string->float64 map.
func (db *RedisDB) SortedSet(k string) (map[string]float64, error) {
	db.master.Lock()
	defer db.master.Unlock()

	if !db.exists(k) {
		return nil, ErrKeyNotFound
	}
	if db.t(k) != "zset" {
		return nil, ErrWrongType
	}
	return db.sortedSet(k), nil
}

// ZRem deletes a member. Returns whether the was a key.
func (m *Miniredis) ZRem(k, member string) (bool, error) {
	return m.DB(m.selectedDB).ZRem(k, member)
}

// ZRem deletes a member. Returns whether the was a key.
func (db *RedisDB) ZRem(k, member string) (bool, error) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	if !db.exists(k) {
		return false, ErrKeyNotFound
	}
	if db.t(k) != "zset" {
		return false, ErrWrongType
	}
	return db.ssetRem(k, member), nil
}

// ZScore gives the score of a sorted set member.
func (m *Miniredis) ZScore(k, member string) (float64, error) {
	return m.DB(m.selectedDB).ZScore(k, member)
}

// ZScore gives the score of a sorted set member.
func (db *RedisDB) ZScore(k, member string) (float64, error) {
	db.master.Lock()
	defer db.master.Unlock()

	if !db.exists(k) {
		return 0, ErrKeyNotFound
	}
	if db.t(k) != "zset" {
		return 0, ErrWrongType
	}
	return db.ssetScore(k, member), nil
}

// ZScore gives scores of a list of members in a sorted set.
func (m *Miniredis) ZMScore(k string, members ...string) ([]float64, error) {
	return m.DB(m.selectedDB).ZMScore(k, members)
}

func (db *RedisDB) ZMScore(k string, members []string) ([]float64, error) {
	db.master.Lock()
	defer db.master.Unlock()

	if !db.exists(k) {
		return nil, ErrKeyNotFound
	}
	if db.t(k) != "zset" {
		return nil, ErrWrongType
	}
	return db.ssetMScore(k, members), nil
}

// XAdd adds an entry to a stream. `id` can be left empty or be '*'.
// If a value is given normal XADD rules apply. Values should be an even
// length.
func (m *Miniredis) XAdd(k string, id string, values []string) (string, error) {
	return m.DB(m.selectedDB).XAdd(k, id, values)
}

// XAdd adds an entry to a stream. `id` can be left empty or be '*'.
// If a value is given normal XADD rules apply. Values should be an even
// length.
func (db *RedisDB) XAdd(k string, id string, values []string) (string, error) {
	db.master.Lock()
	defer db.master.Unlock()
	defer db.master.signal.Broadcast()

	s, err := db.stream(k)
	if err != nil {
		return "", err
	}
	if s == nil {
		s, _ = db.newStream(k)
	}

	return s.add(id, values, db.master.effectiveNow())
}

// Stream returns a slice of stream entries. Oldest first.
func (m *Miniredis) Stream(k string) ([]StreamEntry, error) {
	return m.DB(m.selectedDB).Stream(k)
}

// Stream returns a slice of stream entries. Oldest first.
func (db *RedisDB) Stream(key string) ([]StreamEntry, error) {
	db.master.Lock()
	defer db.master.Unlock()

	s, err := db.stream(key)
	if err != nil {
		return nil, err
	}
	if s == nil {
		return nil, nil
	}
	return s.entries, nil
}

// Publish a message to subscribers. Returns the number of receivers.
func (m *Miniredis) Publish(channel, message string) int {
	m.Lock()
	defer m.Unlock()

	return m.publish(channel, message)
}

// PubSubChannels is "PUBSUB CHANNELS <pattern>". An empty pattern is fine
// (meaning all channels).
// Returned channels will be ordered alphabetically.
func (m *Miniredis) PubSubChannels(pattern string) []string {
	m.Lock()
	defer m.Unlock()

	return activeChannels(m.allSubscribers(), pattern)
}

// PubSubNumSub is "PUBSUB NUMSUB [channels]". It returns all channels with their
// subscriber count.
func (m *Miniredis) PubSubNumSub(channels ...string) map[string]int {
	m.Lock()
	defer m.Unlock()

	subs := m.allSubscribers()
	res := map[string]int{}
	for _, channel := range channels {
		res[channel] = countSubs(subs, channel)
	}
	return res
}

// PubSubNumPat is "PUBSUB NUMPAT"
func (m *Miniredis) PubSubNumPat() int {
	m.Lock()
	defer m.Unlock()

	return countPsubs(m.allSubscribers())
}

// PfAdd adds keys to a hll. Returns the flag which equals to 1 if the inner hll value has been changed.
func (m *Miniredis) PfAdd(k string, elems ...string) (int, error) {
	return m.DB(m.selectedDB).HllAdd(k, elems...)
}

// HllAdd adds keys to a hll. Returns the flag which equals to true if the inner hll value has been changed.
func (db *RedisDB) HllAdd(k string, elems ...string) (int, error) {
	db.master.Lock()
	defer db.master.Unlock()

	if db.exists(k) && db.t(k) != "hll" {
		return 0, ErrWrongType
	}
	return db.hllAdd(k, elems...), nil
}

// PfCount returns an estimation of the amount of elements previously added to a hll.
func (m *Miniredis) PfCount(keys ...string) (int, error) {
	return m.DB(m.selectedDB).HllCount(keys...)
}

// HllCount returns an estimation of the amount of elements previously added to a hll.
func (db *RedisDB) HllCount(keys ...string) (int, error) {
	db.master.Lock()
	defer db.master.Unlock()

	return db.hllCount(keys)
}

// PfMerge merges all the input hlls into a hll under destKey key.
func (m *Miniredis) PfMerge(destKey string, sourceKeys ...string) error {
	return m.DB(m.selectedDB).HllMerge(destKey, sourceKeys...)
}

// HllMerge merges all the input hlls into a hll under destKey key.
func (db *RedisDB) HllMerge(destKey string, sourceKeys ...string) error {
	db.master.Lock()
	defer db.master.Unlock()

	return db.hllMerge(append([]string{destKey}, sourceKeys...))
}

// Copy a value.
// Needs the IDs of both the source and dest DBs (which can differ).
// Returns ErrKeyNotFound if src does not exist.
// Overwrites dest if it already exists (unlike the redis command, which needs a flag to allow that).
func (m *Miniredis) Copy(srcDB int, src string, destDB int, dest string) error {
	return m.copy(m.DB(srcDB), src, m.DB(destDB), dest)
}
