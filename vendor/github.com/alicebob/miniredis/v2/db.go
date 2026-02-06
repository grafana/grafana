package miniredis

import (
	"errors"
	"fmt"
	"math"
	"math/big"
	"sort"
	"strconv"
	"time"
)

var (
	errInvalidEntryID = errors.New("stream ID is invalid")
)

// exists also updates the lru
func (db *RedisDB) exists(k string) bool {
	_, ok := db.keys[k]
	if ok {
		db.lru[k] = db.master.effectiveNow()
	}
	return ok
}

// t gives the type of a key, or ""
func (db *RedisDB) t(k string) string {
	return db.keys[k]
}

// incr increases the version and the lru timestamp
func (db *RedisDB) incr(k string) {
	db.lru[k] = db.master.effectiveNow()
	db.keyVersion[k]++
}

// allKeys returns all keys. Sorted.
func (db *RedisDB) allKeys() []string {
	res := make([]string, 0, len(db.keys))
	for k := range db.keys {
		res = append(res, k)
	}
	sort.Strings(res) // To make things deterministic.
	return res
}

// flush removes all keys and values.
func (db *RedisDB) flush() {
	db.keys = map[string]string{}
	db.lru = map[string]time.Time{}
	db.stringKeys = map[string]string{}
	db.hashKeys = map[string]hashKey{}
	db.listKeys = map[string]listKey{}
	db.setKeys = map[string]setKey{}
	db.hllKeys = map[string]*hll{}
	db.sortedsetKeys = map[string]sortedSet{}
	db.ttl = map[string]time.Duration{}
	db.streamKeys = map[string]*streamKey{}
}

// move something to another db. Will return ok. Or not.
func (db *RedisDB) move(key string, to *RedisDB) bool {
	if _, ok := to.keys[key]; ok {
		return false
	}

	t, ok := db.keys[key]
	if !ok {
		return false
	}
	to.keys[key] = db.keys[key]
	switch t {
	case "string":
		to.stringKeys[key] = db.stringKeys[key]
	case "hash":
		to.hashKeys[key] = db.hashKeys[key]
	case "list":
		to.listKeys[key] = db.listKeys[key]
	case "set":
		to.setKeys[key] = db.setKeys[key]
	case "zset":
		to.sortedsetKeys[key] = db.sortedsetKeys[key]
	case "stream":
		to.streamKeys[key] = db.streamKeys[key]
	case "hll":
		to.hllKeys[key] = db.hllKeys[key]
	default:
		panic("unhandled key type")
	}
	if v, ok := db.ttl[key]; ok {
		to.ttl[key] = v
	}
	to.incr(key)
	db.del(key, true)
	return true
}

func (db *RedisDB) rename(from, to string) {
	db.del(to, true)
	switch db.t(from) {
	case "string":
		db.stringKeys[to] = db.stringKeys[from]
	case "hash":
		db.hashKeys[to] = db.hashKeys[from]
	case "list":
		db.listKeys[to] = db.listKeys[from]
	case "set":
		db.setKeys[to] = db.setKeys[from]
	case "zset":
		db.sortedsetKeys[to] = db.sortedsetKeys[from]
	case "stream":
		db.streamKeys[to] = db.streamKeys[from]
	case "hll":
		db.hllKeys[to] = db.hllKeys[from]
	default:
		panic("missing case")
	}
	db.keys[to] = db.keys[from]
	if v, ok := db.ttl[from]; ok {
		db.ttl[to] = v
	}
	db.incr(to)

	db.del(from, true)
}

func (db *RedisDB) del(k string, delTTL bool) {
	if !db.exists(k) {
		return
	}
	t := db.t(k)
	delete(db.keys, k)
	delete(db.lru, k)
	db.keyVersion[k]++
	if delTTL {
		delete(db.ttl, k)
	}
	switch t {
	case "string":
		delete(db.stringKeys, k)
	case "hash":
		delete(db.hashKeys, k)
	case "list":
		delete(db.listKeys, k)
	case "set":
		delete(db.setKeys, k)
	case "zset":
		delete(db.sortedsetKeys, k)
	case "stream":
		delete(db.streamKeys, k)
	case "hll":
		delete(db.hllKeys, k)
	default:
		panic("Unknown key type: " + t)
	}
}

// stringGet returns the string key or "" on error/nonexists.
func (db *RedisDB) stringGet(k string) string {
	if t, ok := db.keys[k]; !ok || t != "string" {
		return ""
	}
	return db.stringKeys[k]
}

// stringSet force set()s a key. Does not touch expire.
func (db *RedisDB) stringSet(k, v string) {
	db.del(k, false)
	db.keys[k] = "string"
	db.stringKeys[k] = v
	db.incr(k)
}

// change int key value
func (db *RedisDB) stringIncr(k string, delta int) (int, error) {
	v := 0
	if sv, ok := db.stringKeys[k]; ok {
		var err error
		v, err = strconv.Atoi(sv)
		if err != nil {
			return 0, ErrIntValueError
		}
	}

	if delta > 0 {
		if math.MaxInt-delta < v {
			return 0, ErrIntValueOverflowError
		}
	} else {
		if math.MinInt-delta > v {
			return 0, ErrIntValueOverflowError
		}
	}

	v += delta
	db.stringSet(k, strconv.Itoa(v))
	return v, nil
}

// change float key value
func (db *RedisDB) stringIncrfloat(k string, delta *big.Float) (*big.Float, error) {
	v := big.NewFloat(0.0)
	v.SetPrec(128)
	if sv, ok := db.stringKeys[k]; ok {
		var err error
		v, _, err = big.ParseFloat(sv, 10, 128, 0)
		if err != nil {
			return nil, ErrFloatValueError
		}
	}
	v.Add(v, delta)
	db.stringSet(k, formatBig(v))
	return v, nil
}

// listLpush is 'left push', aka unshift. Returns the new length.
func (db *RedisDB) listLpush(k, v string) int {
	l, ok := db.listKeys[k]
	if !ok {
		db.keys[k] = "list"
	}
	l = append([]string{v}, l...)
	db.listKeys[k] = l
	db.incr(k)
	return len(l)
}

// 'left pop', aka shift.
func (db *RedisDB) listLpop(k string) string {
	l := db.listKeys[k]
	el := l[0]
	l = l[1:]
	if len(l) == 0 {
		db.del(k, true)
	} else {
		db.listKeys[k] = l
	}
	db.incr(k)
	return el
}

func (db *RedisDB) listPush(k string, v ...string) int {
	l, ok := db.listKeys[k]
	if !ok {
		db.keys[k] = "list"
	}
	l = append(l, v...)
	db.listKeys[k] = l
	db.incr(k)
	return len(l)
}

func (db *RedisDB) listPop(k string) string {
	l := db.listKeys[k]
	el := l[len(l)-1]
	l = l[:len(l)-1]
	if len(l) == 0 {
		db.del(k, true)
	} else {
		db.listKeys[k] = l
		db.incr(k)
	}
	return el
}

// setset replaces a whole set.
func (db *RedisDB) setSet(k string, set setKey) {
	db.keys[k] = "set"
	db.setKeys[k] = set
	db.incr(k)
}

// setadd adds members to a set. Returns nr of new keys.
func (db *RedisDB) setAdd(k string, elems ...string) int {
	s, ok := db.setKeys[k]
	if !ok {
		s = setKey{}
		db.keys[k] = "set"
	}
	added := 0
	for _, e := range elems {
		if _, ok := s[e]; !ok {
			added++
		}
		s[e] = struct{}{}
	}
	db.setKeys[k] = s
	db.incr(k)
	return added
}

// setrem removes members from a set. Returns nr of deleted keys.
func (db *RedisDB) setRem(k string, fields ...string) int {
	s, ok := db.setKeys[k]
	if !ok {
		return 0
	}
	removed := 0
	for _, f := range fields {
		if _, ok := s[f]; ok {
			removed++
			delete(s, f)
		}
	}
	if len(s) == 0 {
		db.del(k, true)
	} else {
		db.setKeys[k] = s
	}
	db.incr(k)
	return removed
}

// All members of a set.
func (db *RedisDB) setMembers(k string) []string {
	set := db.setKeys[k]
	members := make([]string, 0, len(set))
	for k := range set {
		members = append(members, k)
	}
	sort.Strings(members)
	return members
}

// Is a SET value present?
func (db *RedisDB) setIsMember(k, v string) bool {
	set, ok := db.setKeys[k]
	if !ok {
		return false
	}
	_, ok = set[v]
	return ok
}

// hashFields returns all (sorted) keys ('fields') for a hash key.
func (db *RedisDB) hashFields(k string) []string {
	v := db.hashKeys[k]
	var r []string
	for k := range v {
		r = append(r, k)
	}
	sort.Strings(r)
	return r
}

// hashValues returns all (sorted) values a hash key.
func (db *RedisDB) hashValues(k string) []string {
	h := db.hashKeys[k]
	var r []string
	for _, v := range h {
		r = append(r, v)
	}
	sort.Strings(r)
	return r
}

// hashGet a value
func (db *RedisDB) hashGet(key, field string) string {
	return db.hashKeys[key][field]
}

// hashSet returns the number of new keys
func (db *RedisDB) hashSet(k string, fv ...string) int {
	if t, ok := db.keys[k]; ok && t != "hash" {
		db.del(k, true)
	}
	db.keys[k] = "hash"
	if _, ok := db.hashKeys[k]; !ok {
		db.hashKeys[k] = map[string]string{}
	}
	new := 0
	for idx := 0; idx < len(fv)-1; idx = idx + 2 {
		f, v := fv[idx], fv[idx+1]
		_, ok := db.hashKeys[k][f]
		db.hashKeys[k][f] = v
		db.incr(k)
		if !ok {
			new++
		}
	}
	return new
}

// hashIncr changes int key value
func (db *RedisDB) hashIncr(key, field string, delta int) (int, error) {
	v := 0
	if h, ok := db.hashKeys[key]; ok {
		if f, ok := h[field]; ok {
			var err error
			v, err = strconv.Atoi(f)
			if err != nil {
				return 0, ErrIntValueError
			}
		}
	}
	v += delta
	db.hashSet(key, field, strconv.Itoa(v))
	return v, nil
}

// hashIncrfloat changes float key value
func (db *RedisDB) hashIncrfloat(key, field string, delta *big.Float) (*big.Float, error) {
	v := big.NewFloat(0.0)
	v.SetPrec(128)
	if h, ok := db.hashKeys[key]; ok {
		if f, ok := h[field]; ok {
			var err error
			v, _, err = big.ParseFloat(f, 10, 128, 0)
			if err != nil {
				return nil, ErrFloatValueError
			}
		}
	}
	v.Add(v, delta)
	db.hashSet(key, field, formatBig(v))
	return v, nil
}

// sortedSet set returns a sortedSet as map
func (db *RedisDB) sortedSet(key string) map[string]float64 {
	ss := db.sortedsetKeys[key]
	return map[string]float64(ss)
}

// ssetSet sets a complete sorted set.
func (db *RedisDB) ssetSet(key string, sset sortedSet) {
	db.keys[key] = "zset"
	db.incr(key)
	db.sortedsetKeys[key] = sset
}

// ssetAdd adds member to a sorted set. Returns whether this was a new member.
func (db *RedisDB) ssetAdd(key string, score float64, member string) bool {
	ss, ok := db.sortedsetKeys[key]
	if !ok {
		ss = newSortedSet()
		db.keys[key] = "zset"
	}
	_, ok = ss[member]
	ss[member] = score
	db.sortedsetKeys[key] = ss
	db.incr(key)
	return !ok
}

// All members from a sorted set, ordered by score.
func (db *RedisDB) ssetMembers(key string) []string {
	ss, ok := db.sortedsetKeys[key]
	if !ok {
		return nil
	}
	elems := ss.byScore(asc)
	members := make([]string, 0, len(elems))
	for _, e := range elems {
		members = append(members, e.member)
	}
	return members
}

// All members+scores from a sorted set, ordered by score.
func (db *RedisDB) ssetElements(key string) ssElems {
	ss, ok := db.sortedsetKeys[key]
	if !ok {
		return nil
	}
	return ss.byScore(asc)
}

func (db *RedisDB) ssetRandomMember(key string) string {
	elems := db.ssetElements(key)
	if len(elems) == 0 {
		return ""
	}
	return elems[db.master.randIntn(len(elems))].member
}

// ssetCard is the sorted set cardinality.
func (db *RedisDB) ssetCard(key string) int {
	ss := db.sortedsetKeys[key]
	return ss.card()
}

// ssetRank is the sorted set rank.
func (db *RedisDB) ssetRank(key, member string, d direction) (int, bool) {
	ss := db.sortedsetKeys[key]
	return ss.rankByScore(member, d)
}

// ssetScore is sorted set score.
func (db *RedisDB) ssetScore(key, member string) float64 {
	ss := db.sortedsetKeys[key]
	return ss[member]
}

// ssetMScore returns multiple scores of a list of members in a sorted set.
func (db *RedisDB) ssetMScore(key string, members []string) []float64 {
	scores := make([]float64, 0, len(members))
	ss := db.sortedsetKeys[key]
	for _, member := range members {
		scores = append(scores, ss[member])
	}
	return scores
}

// ssetRem is sorted set key delete.
func (db *RedisDB) ssetRem(key, member string) bool {
	ss := db.sortedsetKeys[key]
	_, ok := ss[member]
	delete(ss, member)
	if len(ss) == 0 {
		// Delete key on removal of last member
		db.del(key, true)
	}
	return ok
}

// ssetExists tells if a member exists in a sorted set.
func (db *RedisDB) ssetExists(key, member string) bool {
	ss := db.sortedsetKeys[key]
	_, ok := ss[member]
	return ok
}

// ssetIncrby changes float sorted set score.
func (db *RedisDB) ssetIncrby(k, m string, delta float64) float64 {
	ss, ok := db.sortedsetKeys[k]
	if !ok {
		ss = newSortedSet()
		db.keys[k] = "zset"
		db.sortedsetKeys[k] = ss
	}

	v, _ := ss.get(m)
	v += delta
	ss.set(v, m)
	db.incr(k)
	return v
}

// setDiff implements the logic behind SDIFF*
func (db *RedisDB) setDiff(keys []string) (setKey, error) {
	key := keys[0]
	keys = keys[1:]
	if db.exists(key) && db.t(key) != "set" {
		return nil, ErrWrongType
	}
	s := setKey{}
	for k := range db.setKeys[key] {
		s[k] = struct{}{}
	}
	for _, sk := range keys {
		if !db.exists(sk) {
			continue
		}
		if db.t(sk) != "set" {
			return nil, ErrWrongType
		}
		for e := range db.setKeys[sk] {
			delete(s, e)
		}
	}
	return s, nil
}

// setInter implements the logic behind SINTER*
// len keys needs to be > 0
func (db *RedisDB) setInter(keys []string) (setKey, error) {
	// all keys must either not exist, or be of type "set".
	for _, key := range keys {
		if db.exists(key) && db.t(key) != "set" {
			return nil, ErrWrongType
		}
	}

	key := keys[0]
	keys = keys[1:]
	if !db.exists(key) {
		return nil, nil
	}
	if db.t(key) != "set" {
		return nil, ErrWrongType
	}
	s := setKey{}
	for k := range db.setKeys[key] {
		s[k] = struct{}{}
	}
	for _, sk := range keys {
		if !db.exists(sk) {
			return setKey{}, nil
		}
		if db.t(sk) != "set" {
			return nil, ErrWrongType
		}
		other := db.setKeys[sk]
		for e := range s {
			if _, ok := other[e]; ok {
				continue
			}
			delete(s, e)
		}
	}
	return s, nil
}

// setIntercard implements the logic behind SINTER*
// len keys needs to be > 0
func (db *RedisDB) setIntercard(keys []string, limit int) (int, error) {
	// all keys must either not exist, or be of type "set".
	allExist := true
	for _, key := range keys {
		exists := db.exists(key)
		allExist = allExist && exists
		if exists && db.t(key) != "set" {
			return 0, ErrWrongType
		}
	}

	if !allExist {
		return 0, nil
	}

	smallestKey := keys[0]
	smallestIdx := 0
	for i, key := range keys {
		if len(db.setKeys[key]) < len(db.setKeys[smallestKey]) {
			smallestKey = key
			smallestIdx = i
		}
	}
	keys[smallestIdx] = keys[len(keys)-1]
	keys = keys[:len(keys)-1]

	count := 0
	for item := range db.setKeys[smallestKey] {
		inIntersection := true
		for _, key := range keys {
			if _, ok := db.setKeys[key][item]; !ok {
				inIntersection = false
				break
			}
		}
		if inIntersection {
			count++
			if count == limit {
				break
			}
		}
	}

	return count, nil
}

// setUnion implements the logic behind SUNION*
func (db *RedisDB) setUnion(keys []string) (setKey, error) {
	key := keys[0]
	keys = keys[1:]
	if db.exists(key) && db.t(key) != "set" {
		return nil, ErrWrongType
	}
	s := setKey{}
	for k := range db.setKeys[key] {
		s[k] = struct{}{}
	}
	for _, sk := range keys {
		if !db.exists(sk) {
			continue
		}
		if db.t(sk) != "set" {
			return nil, ErrWrongType
		}
		for e := range db.setKeys[sk] {
			s[e] = struct{}{}
		}
	}
	return s, nil
}

func (db *RedisDB) newStream(key string) (*streamKey, error) {
	if s, err := db.stream(key); err != nil {
		return nil, err
	} else if s != nil {
		return nil, fmt.Errorf("ErrAlreadyExists")
	}

	db.keys[key] = "stream"
	s := newStreamKey()
	db.streamKeys[key] = s
	db.incr(key)
	return s, nil
}

// return existing stream, or nil.
func (db *RedisDB) stream(key string) (*streamKey, error) {
	if db.exists(key) && db.t(key) != "stream" {
		return nil, ErrWrongType
	}

	return db.streamKeys[key], nil
}

// return existing stream group, or nil.
func (db *RedisDB) streamGroup(key, group string) (*streamGroup, error) {
	s, err := db.stream(key)
	if err != nil || s == nil {
		return nil, err
	}
	return s.groups[group], nil
}

// fastForward proceeds the current timestamp with duration, works as a time machine
func (db *RedisDB) fastForward(duration time.Duration) {
	for _, key := range db.allKeys() {
		if value, ok := db.ttl[key]; ok {
			db.ttl[key] = value - duration
			db.checkTTL(key)
		}
	}
}

func (db *RedisDB) checkTTL(key string) {
	if v, ok := db.ttl[key]; ok && v <= 0 {
		db.del(key, true)
	}
}

// hllAdd adds members to a hll. Returns 1 if at least 1 if internal HyperLogLog was altered, otherwise 0
func (db *RedisDB) hllAdd(k string, elems ...string) int {
	s, ok := db.hllKeys[k]
	if !ok {
		s = newHll()
		db.keys[k] = "hll"
	}
	hllAltered := 0
	for _, e := range elems {
		if s.Add([]byte(e)) {
			hllAltered = 1
		}
	}
	db.hllKeys[k] = s
	db.incr(k)
	return hllAltered
}

// hllCount estimates the amount of members added to hll by hllAdd. If called with several arguments, hllCount returns a sum of estimations
func (db *RedisDB) hllCount(keys []string) (int, error) {
	countOverall := 0
	for _, key := range keys {
		if db.exists(key) && db.t(key) != "hll" {
			return 0, ErrNotValidHllValue
		}
		if !db.exists(key) {
			continue
		}
		countOverall += db.hllKeys[key].Count()
	}

	return countOverall, nil
}

// hllMerge merges all the hlls provided as keys to the first key. Creates a new hll in the first key if it contains nothing
func (db *RedisDB) hllMerge(keys []string) error {
	for _, key := range keys {
		if db.exists(key) && db.t(key) != "hll" {
			return ErrNotValidHllValue
		}
	}

	destKey := keys[0]
	restKeys := keys[1:]

	var destHll *hll
	if db.exists(destKey) {
		destHll = db.hllKeys[destKey]
	} else {
		destHll = newHll()
	}

	for _, key := range restKeys {
		if !db.exists(key) {
			continue
		}
		destHll.Merge(db.hllKeys[key])
	}

	db.hllKeys[destKey] = destHll
	db.keys[destKey] = "hll"
	db.incr(destKey)

	return nil
}
