// Commands from https://redis.io/commands#sorted_set

package miniredis

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/alicebob/miniredis/v2/server"
)

// commandsSortedSet handles all sorted set operations.
func commandsSortedSet(m *Miniredis) {
	m.srv.Register("ZADD", m.cmdZadd)
	m.srv.Register("ZCARD", m.cmdZcard)
	m.srv.Register("ZCOUNT", m.cmdZcount)
	m.srv.Register("ZINCRBY", m.cmdZincrby)
	m.srv.Register("ZINTER", m.makeCmdZinter(false))
	m.srv.Register("ZINTERSTORE", m.makeCmdZinter(true))
	m.srv.Register("ZLEXCOUNT", m.cmdZlexcount)
	m.srv.Register("ZRANGE", m.cmdZrange)
	m.srv.Register("ZRANGEBYLEX", m.makeCmdZrangebylex(false))
	m.srv.Register("ZRANGEBYSCORE", m.makeCmdZrangebyscore(false))
	m.srv.Register("ZRANK", m.makeCmdZrank(false))
	m.srv.Register("ZREM", m.cmdZrem)
	m.srv.Register("ZREMRANGEBYLEX", m.cmdZremrangebylex)
	m.srv.Register("ZREMRANGEBYRANK", m.cmdZremrangebyrank)
	m.srv.Register("ZREMRANGEBYSCORE", m.cmdZremrangebyscore)
	m.srv.Register("ZREVRANGE", m.cmdZrevrange)
	m.srv.Register("ZREVRANGEBYLEX", m.makeCmdZrangebylex(true))
	m.srv.Register("ZREVRANGEBYSCORE", m.makeCmdZrangebyscore(true))
	m.srv.Register("ZREVRANK", m.makeCmdZrank(true))
	m.srv.Register("ZSCORE", m.cmdZscore)
	m.srv.Register("ZMSCORE", m.cmdZMscore)
	m.srv.Register("ZUNION", m.cmdZunion)
	m.srv.Register("ZUNIONSTORE", m.cmdZunionstore)
	m.srv.Register("ZSCAN", m.cmdZscan)
	m.srv.Register("ZPOPMAX", m.cmdZpopmax(true))
	m.srv.Register("ZPOPMIN", m.cmdZpopmax(false))
	m.srv.Register("ZRANDMEMBER", m.cmdZrandmember)
}

// ZADD
func (m *Miniredis) cmdZadd(c *server.Peer, cmd string, args []string) {
	if len(args) < 3 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	var opts struct {
		key  string
		nx   bool
		xx   bool
		gt   bool
		lt   bool
		ch   bool
		incr bool
	}
	elems := map[string]float64{}

	opts.key = args[0]
	args = args[1:]
outer:
	for len(args) > 0 {
		switch strings.ToUpper(args[0]) {
		case "NX":
			opts.nx = true
			args = args[1:]
			continue
		case "XX":
			opts.xx = true
			args = args[1:]
			continue
		case "GT":
			opts.gt = true
			args = args[1:]
			continue
		case "LT":
			opts.lt = true
			args = args[1:]
			continue
		case "CH":
			opts.ch = true
			args = args[1:]
			continue
		case "INCR":
			opts.incr = true
			args = args[1:]
			continue
		default:
			break outer
		}
	}

	if len(args) == 0 || len(args)%2 != 0 {
		setDirty(c)
		c.WriteError(msgSyntaxError)
		return
	}
	for len(args) > 0 {
		score, err := strconv.ParseFloat(args[0], 64)
		if err != nil {
			setDirty(c)
			c.WriteError(msgInvalidFloat)
			return
		}
		elems[args[1]] = score
		args = args[2:]
	}

	if opts.xx && opts.nx {
		setDirty(c)
		c.WriteError(msgXXandNX)
		return
	}

	if opts.gt && opts.lt ||
		opts.gt && opts.nx ||
		opts.lt && opts.nx {
		setDirty(c)
		c.WriteError(msgGTLTandNX)
		return
	}

	if opts.incr && len(elems) > 1 {
		setDirty(c)
		c.WriteError(msgSingleElementPair)
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if db.exists(opts.key) && db.t(opts.key) != "zset" {
			c.WriteError(ErrWrongType.Error())
			return
		}

		if opts.incr {
			for member, delta := range elems {
				if opts.nx && db.ssetExists(opts.key, member) {
					c.WriteNull()
					return
				}
				if opts.xx && !db.ssetExists(opts.key, member) {
					c.WriteNull()
					return
				}
				newScore := db.ssetIncrby(opts.key, member, delta)
				c.WriteFloat(newScore)
			}
			return
		}

		res := 0
		for member, score := range elems {
			exists := db.ssetExists(opts.key, member)
			if opts.nx && exists {
				continue
			}
			if opts.xx && !exists {
				continue
			}
			old := db.ssetScore(opts.key, member)
			if opts.gt && exists && score <= old {
				continue
			}
			if opts.lt && exists && score >= old {
				continue
			}
			if db.ssetAdd(opts.key, score, member) {
				res++
			} else {
				if opts.ch && old != score {
					// if 'CH' is specified, only count changed keys
					res++
				}
			}
		}
		c.WriteInt(res)
	})
}

// ZCARD
func (m *Miniredis) cmdZcard(c *server.Peer, cmd string, args []string) {
	if len(args) != 1 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	key := args[0]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if !db.exists(key) {
			c.WriteInt(0)
			return
		}

		if db.t(key) != "zset" {
			c.WriteError(ErrWrongType.Error())
			return
		}

		c.WriteInt(db.ssetCard(key))
	})
}

// ZCOUNT
func (m *Miniredis) cmdZcount(c *server.Peer, cmd string, args []string) {
	if len(args) != 3 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	var (
		opts struct {
			key     string
			min     float64
			minIncl bool
			max     float64
			maxIncl bool
		}
		err error
	)

	opts.key = args[0]
	opts.min, opts.minIncl, err = parseFloatRange(args[1])
	if err != nil {
		setDirty(c)
		c.WriteError(msgInvalidMinMax)
		return
	}
	opts.max, opts.maxIncl, err = parseFloatRange(args[2])
	if err != nil {
		setDirty(c)
		c.WriteError(msgInvalidMinMax)
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if !db.exists(opts.key) {
			c.WriteInt(0)
			return
		}

		if db.t(opts.key) != "zset" {
			c.WriteError(ErrWrongType.Error())
			return
		}

		members := db.ssetElements(opts.key)
		members = withSSRange(members, opts.min, opts.minIncl, opts.max, opts.maxIncl)
		c.WriteInt(len(members))
	})
}

// ZINCRBY
func (m *Miniredis) cmdZincrby(c *server.Peer, cmd string, args []string) {
	if len(args) != 3 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	var opts struct {
		key    string
		delta  float64
		member string
	}

	opts.key = args[0]
	d, err := strconv.ParseFloat(args[1], 64)
	if err != nil {
		setDirty(c)
		c.WriteError(msgInvalidFloat)
		return
	}
	opts.delta = d
	opts.member = args[2]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if db.exists(opts.key) && db.t(opts.key) != "zset" {
			c.WriteError(msgWrongType)
			return
		}
		newScore := db.ssetIncrby(opts.key, opts.member, opts.delta)
		c.WriteFloat(newScore)
	})
}

// ZINTERSTORE and ZINTER
func (m *Miniredis) makeCmdZinter(store bool) func(c *server.Peer, cmd string, args []string) {
	return func(c *server.Peer, cmd string, args []string) {
		minArgs := 2
		if store {
			minArgs++
		}
		if len(args) < minArgs {
			setDirty(c)
			c.WriteError(errWrongNumber(cmd))
			return
		}
		if !m.handleAuth(c) {
			return
		}
		if m.checkPubsub(c, cmd) {
			return
		}

		var opts = struct {
			Store       bool   // if true this is ZINTERSTORE
			Destination string // only relevant if $store is true
			Keys        []string
			Aggregate   string
			WithWeights bool
			Weights     []float64
			WithScores  bool // only for ZINTER
		}{
			Store:     store,
			Aggregate: "sum",
		}

		if store {
			opts.Destination = args[0]
			args = args[1:]
		}
		numKeys, err := strconv.Atoi(args[0])
		if err != nil {
			setDirty(c)
			c.WriteError(msgInvalidInt)
			return
		}
		args = args[1:]
		if len(args) < numKeys {
			setDirty(c)
			c.WriteError(msgSyntaxError)
			return
		}
		if numKeys <= 0 {
			setDirty(c)
			c.WriteError("ERR at least 1 input key is needed for ZUNIONSTORE/ZINTERSTORE")
			return
		}
		opts.Keys = args[:numKeys]
		args = args[numKeys:]

		for len(args) > 0 {
			switch strings.ToLower(args[0]) {
			case "weights":
				if len(args) < numKeys+1 {
					setDirty(c)
					c.WriteError(msgSyntaxError)
					return
				}
				for i := 0; i < numKeys; i++ {
					f, err := strconv.ParseFloat(args[i+1], 64)
					if err != nil {
						setDirty(c)
						c.WriteError("ERR weight value is not a float")
						return
					}
					opts.Weights = append(opts.Weights, f)
				}
				opts.WithWeights = true
				args = args[numKeys+1:]
			case "aggregate":
				if len(args) < 2 {
					setDirty(c)
					c.WriteError(msgSyntaxError)
					return
				}
				aggregate := strings.ToLower(args[1])
				switch aggregate {
				case "sum", "min", "max":
					opts.Aggregate = aggregate
				default:
					setDirty(c)
					c.WriteError(msgSyntaxError)
					return
				}
				args = args[2:]
			case "withscores":
				if store {
					setDirty(c)
					c.WriteError(msgSyntaxError)
					return
				}
				opts.WithScores = true
				args = args[1:]
			default:
				setDirty(c)
				c.WriteError(msgSyntaxError)
				return
			}
		}

		withTx(m, c, func(c *server.Peer, ctx *connCtx) {
			db := m.db(ctx.selectedDB)

			// We collect everything and remove all keys which turned out not to be
			// present in every set.
			sset := map[string]float64{}
			counts := map[string]int{}
			for i, key := range opts.Keys {
				if !db.exists(key) {
					continue
				}

				var set map[string]float64
				switch db.t(key) {
				case "set":
					set = map[string]float64{}
					for elem := range db.setKeys[key] {
						set[elem] = 1.0
					}
				case "zset":
					set = db.sortedSet(key)
				default:
					c.WriteError(msgWrongType)
					return
				}
				for member, score := range set {
					if opts.WithWeights {
						score *= opts.Weights[i]
					}
					counts[member]++
					old, ok := sset[member]
					if !ok {
						sset[member] = score
						continue
					}
					switch opts.Aggregate {
					default:
						panic("Invalid aggregate")
					case "sum":
						sset[member] += score
					case "min":
						if score < old {
							sset[member] = score
						}
					case "max":
						if score > old {
							sset[member] = score
						}
					}
				}
			}
			for key, count := range counts {
				if count != numKeys {
					delete(sset, key)
				}
			}

			if opts.Store {
				// ZINTERSTORE mode
				db.del(opts.Destination, true)
				db.ssetSet(opts.Destination, sset)
				c.WriteInt(len(sset))
				return
			}
			// ZINTER mode
			size := len(sset)
			if opts.WithScores {
				size *= 2
			}
			c.WriteLen(size)
			for _, l := range sortedKeys(sset) {
				c.WriteBulk(l)
				if opts.WithScores {
					c.WriteFloat(sset[l])
				}
			}
		})
	}
}

// ZLEXCOUNT
func (m *Miniredis) cmdZlexcount(c *server.Peer, cmd string, args []string) {
	if len(args) != 3 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	var opts = struct {
		Key string
		Min string
		Max string
	}{
		Key: args[0],
		Min: args[1],
		Max: args[2],
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		min, minIncl, minErr := parseLexrange(opts.Min)
		max, maxIncl, maxErr := parseLexrange(opts.Max)
		if minErr != nil || maxErr != nil {
			c.WriteError(msgInvalidRangeItem)
			return
		}

		db := m.db(ctx.selectedDB)

		if !db.exists(opts.Key) {
			c.WriteInt(0)
			return
		}

		if db.t(opts.Key) != "zset" {
			c.WriteError(ErrWrongType.Error())
			return
		}

		members := db.ssetMembers(opts.Key)
		// Just key sort. If scores are not the same we don't care.
		sort.Strings(members)
		members = withLexRange(members, min, minIncl, max, maxIncl)

		c.WriteInt(len(members))
	})
}

// ZRANGE
func (m *Miniredis) cmdZrange(c *server.Peer, cmd string, args []string) {
	if len(args) < 3 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	var opts struct {
		Key        string
		Min        string
		Max        string
		WithScores bool
		ByScore    bool
		ByLex      bool
		Reverse    bool
		WithLimit  bool
		Offset     string
		Count      string
	}

	opts.Key, opts.Min, opts.Max = args[0], args[1], args[2]
	args = args[3:]

	for len(args) > 0 {
		switch strings.ToLower(args[0]) {
		case "byscore":
			opts.ByScore = true
			args = args[1:]
		case "bylex":
			opts.ByLex = true
			args = args[1:]
		case "rev":
			opts.Reverse = true
			args = args[1:]
		case "limit":
			opts.WithLimit = true
			args = args[1:]
			if len(args) < 2 {
				c.WriteError(msgSyntaxError)
				return
			}
			opts.Offset = args[0]
			opts.Count = args[1]
			args = args[2:]
		case "withscores":
			opts.WithScores = true
			args = args[1:]
		default:
			c.WriteError(msgSyntaxError)
			return
		}
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		switch {
		case opts.ByScore && opts.ByLex:
			c.WriteError(msgSyntaxError)
		case opts.ByScore:
			runRangeByScore(m, c, ctx, optsRangeByScore{
				Key:        opts.Key,
				Min:        opts.Min,
				Max:        opts.Max,
				Reverse:    opts.Reverse,
				WithLimit:  opts.WithLimit,
				Offset:     opts.Offset,
				Count:      opts.Count,
				WithScores: opts.WithScores,
			})
		case opts.ByLex:
			runRangeByLex(m, c, ctx, optsRangeByLex{
				Key:        opts.Key,
				Min:        opts.Min,
				Max:        opts.Max,
				Reverse:    opts.Reverse,
				WithLimit:  opts.WithLimit,
				Offset:     opts.Offset,
				Count:      opts.Count,
				WithScores: opts.WithScores,
			})
		default:
			if opts.WithLimit {
				c.WriteError(msgLimitCombination)
				return
			}
			runRange(m, c, ctx, optsRange{
				Key:        opts.Key,
				Min:        opts.Min,
				Max:        opts.Max,
				Reverse:    opts.Reverse,
				WithScores: opts.WithScores,
			})
		}
	})
}

// ZREVRANGE
func (m *Miniredis) cmdZrevrange(c *server.Peer, cmd string, args []string) {
	if len(args) < 3 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	var opts = optsRange{
		Reverse: true,
		Key:     args[0],
		Min:     args[1],
		Max:     args[2],
	}
	args = args[3:]

	for len(args) > 0 {
		switch strings.ToLower(args[0]) {
		case "withscores":
			opts.WithScores = true
			args = args[1:]
		default:
			c.WriteError(msgSyntaxError)
			return
		}
	}

	withTx(m, c, func(c *server.Peer, cctx *connCtx) {
		runRange(m, c, cctx, opts)
	})
}

// ZRANGEBYLEX and ZREVRANGEBYLEX
func (m *Miniredis) makeCmdZrangebylex(reverse bool) server.Cmd {
	return func(c *server.Peer, cmd string, args []string) {
		if len(args) < 3 {
			setDirty(c)
			c.WriteError(errWrongNumber(cmd))
			return
		}
		if !m.handleAuth(c) {
			return
		}
		if m.checkPubsub(c, cmd) {
			return
		}
		opts := optsRangeByLex{
			Reverse: reverse,
			Key:     args[0],
			Min:     args[1],
			Max:     args[2],
		}
		args = args[3:]

		for len(args) > 0 {
			switch strings.ToLower(args[0]) {
			case "limit":
				opts.WithLimit = true
				args = args[1:]
				if len(args) < 2 {
					c.WriteError(msgSyntaxError)
					return
				}
				opts.Offset = args[0]
				opts.Count = args[1]
				args = args[2:]
				continue
			default:
				// Syntax error
				setDirty(c)
				c.WriteError(msgSyntaxError)
				return
			}
		}

		withTx(m, c, func(c *server.Peer, cctx *connCtx) {
			runRangeByLex(m, c, cctx, opts)
		})
	}
}

// ZRANGEBYSCORE and ZREVRANGEBYSCORE
func (m *Miniredis) makeCmdZrangebyscore(reverse bool) server.Cmd {
	return func(c *server.Peer, cmd string, args []string) {
		if len(args) < 3 {
			setDirty(c)
			c.WriteError(errWrongNumber(cmd))
			return
		}
		if !m.handleAuth(c) {
			return
		}
		if m.checkPubsub(c, cmd) {
			return
		}

		var opts = optsRangeByScore{
			Reverse: reverse,
			Key:     args[0],
			Min:     args[1],
			Max:     args[2],
		}
		args = args[3:]

		for len(args) > 0 {
			if strings.ToLower(args[0]) == "limit" {
				opts.WithLimit = true
				args = args[1:]
				if len(args) < 2 {
					c.WriteError(msgSyntaxError)
					return
				}
				opts.Offset = args[0]
				opts.Count = args[1]
				args = args[2:]
				continue
			}
			if strings.ToLower(args[0]) == "withscores" {
				opts.WithScores = true
				args = args[1:]
				continue
			}
			setDirty(c)
			c.WriteError(msgSyntaxError)
			return
		}

		withTx(m, c, func(c *server.Peer, cctx *connCtx) {
			runRangeByScore(m, c, cctx, opts)
		})
	}
}

// ZRANK and ZREVRANK
func (m *Miniredis) makeCmdZrank(reverse bool) server.Cmd {
	return func(c *server.Peer, cmd string, args []string) {
		if len(args) < 2 {
			setDirty(c)
			c.WriteError(errWrongNumber(cmd))
			return
		}
		if !m.handleAuth(c) {
			return
		}
		if m.checkPubsub(c, cmd) {
			return
		}

		key, member := args[0], args[1]

		withTx(m, c, func(c *server.Peer, ctx *connCtx) {
			db := m.db(ctx.selectedDB)

			withScore := false
			if len(args) > 0 && strings.ToUpper(args[len(args)-1]) == "WITHSCORE" {
				withScore = true
				args = args[:len(args)-1]
			}

			if len(args) > 2 {
				setDirty(c)
				c.WriteError(msgSyntaxError)
				return
			}

			if !db.exists(key) {
				if withScore {
					c.WriteLen(-1)
				} else {
					c.WriteNull()
				}
				return
			}

			if db.t(key) != "zset" {
				c.WriteError(ErrWrongType.Error())
				return
			}

			direction := asc
			if reverse {
				direction = desc
			}
			rank, ok := db.ssetRank(key, member, direction)
			if !ok {
				if withScore {
					c.WriteLen(-1)
				} else {
					c.WriteNull()
				}
				return
			}

			if withScore {
				c.WriteLen(2)
				c.WriteInt(rank)
				c.WriteFloat(db.ssetScore(key, member))
			} else {
				c.WriteInt(rank)
			}
		})
	}
}

// ZREM
func (m *Miniredis) cmdZrem(c *server.Peer, cmd string, args []string) {
	if len(args) < 2 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	key, members := args[0], args[1:]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if !db.exists(key) {
			c.WriteInt(0)
			return
		}

		if db.t(key) != "zset" {
			c.WriteError(ErrWrongType.Error())
			return
		}

		deleted := 0
		for _, member := range members {
			if db.ssetRem(key, member) {
				deleted++
			}
		}
		c.WriteInt(deleted)
	})
}

// ZREMRANGEBYLEX
func (m *Miniredis) cmdZremrangebylex(c *server.Peer, cmd string, args []string) {
	if len(args) != 3 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	var opts = struct {
		Key string
		Min string
		Max string
	}{
		Key: args[0],
		Min: args[1],
		Max: args[2],
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		min, minIncl, minErr := parseLexrange(opts.Min)
		max, maxIncl, maxErr := parseLexrange(opts.Max)
		if minErr != nil || maxErr != nil {
			c.WriteError(msgInvalidRangeItem)
			return
		}

		db := m.db(ctx.selectedDB)

		if !db.exists(opts.Key) {
			c.WriteInt(0)
			return
		}

		if db.t(opts.Key) != "zset" {
			c.WriteError(ErrWrongType.Error())
			return
		}

		members := db.ssetMembers(opts.Key)
		// Just key sort. If scores are not the same we don't care.
		sort.Strings(members)
		members = withLexRange(members, min, minIncl, max, maxIncl)

		for _, el := range members {
			db.ssetRem(opts.Key, el)
		}
		c.WriteInt(len(members))
	})
}

// ZREMRANGEBYRANK
func (m *Miniredis) cmdZremrangebyrank(c *server.Peer, cmd string, args []string) {
	if len(args) != 3 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	var opts struct {
		key   string
		start int
		end   int
	}

	opts.key = args[0]
	if ok := optInt(c, args[1], &opts.start); !ok {
		return
	}
	if ok := optInt(c, args[2], &opts.end); !ok {
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if !db.exists(opts.key) {
			c.WriteInt(0)
			return
		}

		if db.t(opts.key) != "zset" {
			c.WriteError(ErrWrongType.Error())
			return
		}

		members := db.ssetMembers(opts.key)
		rs, re := redisRange(len(members), opts.start, opts.end, false)
		for _, el := range members[rs:re] {
			db.ssetRem(opts.key, el)
		}
		c.WriteInt(re - rs)
	})
}

// ZREMRANGEBYSCORE
func (m *Miniredis) cmdZremrangebyscore(c *server.Peer, cmd string, args []string) {
	if len(args) != 3 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	var (
		opts struct {
			key     string
			min     float64
			minIncl bool
			max     float64
			maxIncl bool
		}
		err error
	)
	opts.key = args[0]
	opts.min, opts.minIncl, err = parseFloatRange(args[1])
	if err != nil {
		setDirty(c)
		c.WriteError(msgInvalidMinMax)
		return
	}
	opts.max, opts.maxIncl, err = parseFloatRange(args[2])
	if err != nil {
		setDirty(c)
		c.WriteError(msgInvalidMinMax)
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if !db.exists(opts.key) {
			c.WriteInt(0)
			return
		}

		if db.t(opts.key) != "zset" {
			c.WriteError(ErrWrongType.Error())
			return
		}

		members := db.ssetElements(opts.key)
		members = withSSRange(members, opts.min, opts.minIncl, opts.max, opts.maxIncl)

		for _, el := range members {
			db.ssetRem(opts.key, el.member)
		}
		c.WriteInt(len(members))
	})
}

// ZSCORE
func (m *Miniredis) cmdZscore(c *server.Peer, cmd string, args []string) {
	if len(args) != 2 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	key, member := args[0], args[1]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if !db.exists(key) {
			c.WriteNull()
			return
		}

		if db.t(key) != "zset" {
			c.WriteError(ErrWrongType.Error())
			return
		}

		if !db.ssetExists(key, member) {
			c.WriteNull()
			return
		}

		c.WriteFloat(db.ssetScore(key, member))
	})
}

// ZMSCORE
func (m *Miniredis) cmdZMscore(c *server.Peer, cmd string, args []string) {
	if len(args) < 2 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	key, members := args[0], args[1:]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if !db.exists(key) {
			c.WriteLen(len(members))
			for range members {
				c.WriteNull()
			}
			return
		}

		if db.t(key) != "zset" {
			c.WriteError(ErrWrongType.Error())
			return
		}

		c.WriteLen(len(members))
		for _, member := range members {
			if !db.ssetExists(key, member) {
				c.WriteNull()
				continue
			}
			c.WriteFloat(db.ssetScore(key, member))
		}
	})
}

// parseFloatRange handles ZRANGEBYSCORE floats. They are inclusive unless the
// string starts with '('
func parseFloatRange(s string) (float64, bool, error) {
	if len(s) == 0 {
		return 0, false, nil
	}
	inclusive := true
	if s[0] == '(' {
		s = s[1:]
		inclusive = false
	}
	switch strings.ToLower(s) {
	case "+inf":
		return math.Inf(+1), true, nil
	case "-inf":
		return math.Inf(-1), true, nil
	default:
		f, err := strconv.ParseFloat(s, 64)
		return f, inclusive, err
	}
}

// withSSRange limits a list of sorted set elements by the ZRANGEBYSCORE range
// logic.
func withSSRange(members ssElems, min float64, minIncl bool, max float64, maxIncl bool) ssElems {
	gt := func(a, b float64) bool { return a > b }
	gteq := func(a, b float64) bool { return a >= b }

	mincmp := gt
	if minIncl {
		mincmp = gteq
	}
	for i, m := range members {
		if mincmp(m.score, min) {
			members = members[i:]
			goto checkmax
		}
	}
	// all elements were smaller
	return nil

checkmax:
	maxcmp := gteq
	if maxIncl {
		maxcmp = gt
	}
	for i, m := range members {
		if maxcmp(m.score, max) {
			members = members[:i]
			break
		}
	}

	return members
}

// withLexRange limits a list of sorted set elements.
func withLexRange(members []string, min string, minIncl bool, max string, maxIncl bool) []string {
	if max == "-" || min == "+" {
		return nil
	}
	if min != "-" {
		found := false
		if minIncl {
			for i, m := range members {
				if m >= min {
					members = members[i:]
					found = true
					break
				}
			}
		} else {
			// Excluding min
			for i, m := range members {
				if m > min {
					members = members[i:]
					found = true
					break
				}
			}
		}
		if !found {
			return nil
		}
	}
	if max != "+" {
		if maxIncl {
			for i, m := range members {
				if m > max {
					members = members[:i]
					break
				}
			}
		} else {
			// Excluding max
			for i, m := range members {
				if m >= max {
					members = members[:i]
					break
				}
			}
		}
	}
	return members
}

// ZUNION
func (m *Miniredis) cmdZunion(c *server.Peer, cmd string, args []string) {
	if len(args) < 2 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}

	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	numKeys, err := strconv.Atoi(args[0])
	if err != nil {
		setDirty(c)
		c.WriteError(msgInvalidInt)
		return
	}
	args = args[1:]
	if len(args) < numKeys {
		setDirty(c)
		c.WriteError(msgSyntaxError)
		return
	}
	if numKeys <= 0 {
		setDirty(c)
		c.WriteError("ERR at least 1 input key is needed for ZUNION")
		return
	}
	keys := args[:numKeys]
	args = args[numKeys:]

	withScores := false
	if len(args) > 0 && strings.ToUpper(args[len(args)-1]) == "WITHSCORES" {
		withScores = true
		args = args[:len(args)-1]
	}

	opts := zunionOptions{
		Keys:        keys,
		WithWeights: false,
		Weights:     []float64{},
		Aggregate:   "sum",
	}

	if err := opts.parseArgs(args, numKeys); err != nil {
		setDirty(c)
		c.WriteError(err.Error())
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		sset, err := executeZUnion(db, opts)
		if err != nil {
			c.WriteError(err.Error())
			return
		}

		if withScores {
			c.WriteLen(len(sset) * 2)
		} else {
			c.WriteLen(len(sset))
		}
		for _, el := range sset.byScore(asc) {
			c.WriteBulk(el.member)
			if withScores {
				c.WriteFloat(el.score)
			}
		}
	})
}

// ZUNIONSTORE
func (m *Miniredis) cmdZunionstore(c *server.Peer, cmd string, args []string) {
	if len(args) < 3 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	destination := args[0]
	numKeys, err := strconv.Atoi(args[1])
	if err != nil {
		setDirty(c)
		c.WriteError(msgInvalidInt)
		return
	}
	args = args[2:]
	if len(args) < numKeys {
		setDirty(c)
		c.WriteError(msgSyntaxError)
		return
	}
	if numKeys <= 0 {
		setDirty(c)
		c.WriteError("ERR at least 1 input key is needed for ZUNIONSTORE/ZINTERSTORE")
		return
	}
	keys := args[:numKeys]
	args = args[numKeys:]

	opts := zunionOptions{
		Keys:        keys,
		WithWeights: false,
		Weights:     []float64{},
		Aggregate:   "sum",
	}

	if err := opts.parseArgs(args, numKeys); err != nil {
		setDirty(c)
		c.WriteError(err.Error())
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)
		deleteDest := true
		for _, key := range keys {
			if destination == key {
				deleteDest = false
			}
		}
		if deleteDest {
			db.del(destination, true)
		}

		sset, err := executeZUnion(db, opts)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		db.ssetSet(destination, sset)
		c.WriteInt(sset.card())
	})
}

type zunionOptions struct {
	Keys        []string
	WithWeights bool
	Weights     []float64
	Aggregate   string
}

func (opts *zunionOptions) parseArgs(args []string, numKeys int) error {
	for len(args) > 0 {
		switch strings.ToLower(args[0]) {
		case "weights":
			if len(args) < numKeys+1 {
				return errors.New(msgSyntaxError)
			}
			for i := 0; i < numKeys; i++ {
				f, err := strconv.ParseFloat(args[i+1], 64)
				if err != nil {
					return errors.New("ERR weight value is not a float")
				}
				opts.Weights = append(opts.Weights, f)
			}
			opts.WithWeights = true
			args = args[numKeys+1:]
		case "aggregate":
			if len(args) < 2 {
				return errors.New(msgSyntaxError)
			}
			opts.Aggregate = strings.ToLower(args[1])
			switch opts.Aggregate {
			default:
				return errors.New(msgSyntaxError)
			case "sum", "min", "max":
			}
			args = args[2:]
		default:
			return errors.New(msgSyntaxError)
		}
	}
	return nil
}

func executeZUnion(db *RedisDB, opts zunionOptions) (sortedSet, error) {
	sset := sortedSet{}
	for i, key := range opts.Keys {
		if !db.exists(key) {
			continue
		}

		var set map[string]float64
		switch db.t(key) {
		case "set":
			set = map[string]float64{}
			for elem := range db.setKeys[key] {
				set[elem] = 1.0
			}
		case "zset":
			set = db.sortedSet(key)
		default:
			return nil, errors.New(msgWrongType)
		}

		for member, score := range set {
			if opts.WithWeights {
				score *= opts.Weights[i]
			}
			old, ok := sset[member]
			if !ok {
				sset[member] = score
				continue
			}
			switch opts.Aggregate {
			default:
				panic("Invalid aggregate")
			case "sum":
				sset[member] += score
			case "min":
				if score < old {
					sset[member] = score
				}
			case "max":
				if score > old {
					sset[member] = score
				}
			}
		}
	}

	return sset, nil
}

// ZSCAN
func (m *Miniredis) cmdZscan(c *server.Peer, cmd string, args []string) {
	if len(args) < 2 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	var opts struct {
		key       string
		cursor    int
		count     int
		withMatch bool
		match     string
	}

	opts.key = args[0]
	if ok := optIntErr(c, args[1], &opts.cursor, msgInvalidCursor); !ok {
		return
	}
	args = args[2:]
	// MATCH and COUNT options
	for len(args) > 0 {
		if strings.ToLower(args[0]) == "count" {
			if len(args) < 2 {
				setDirty(c)
				c.WriteError(msgSyntaxError)
				return
			}
			count, err := strconv.Atoi(args[1])
			if err != nil {
				setDirty(c)
				c.WriteError(msgInvalidInt)
				return
			}
			if count <= 0 {
				setDirty(c)
				c.WriteError(msgSyntaxError)
				return
			}
			opts.count = count
			args = args[2:]
			continue
		}
		if strings.ToLower(args[0]) == "match" {
			if len(args) < 2 {
				setDirty(c)
				c.WriteError(msgSyntaxError)
				return
			}
			opts.withMatch = true
			opts.match = args[1]
			args = args[2:]
			continue
		}
		setDirty(c)
		c.WriteError(msgSyntaxError)
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)
		if db.exists(opts.key) && db.t(opts.key) != "zset" {
			c.WriteError(ErrWrongType.Error())
			return
		}

		members := db.ssetMembers(opts.key)
		if opts.withMatch {
			members, _ = matchKeys(members, opts.match)
		}

		low := opts.cursor
		high := low + opts.count
		// validate high is correct
		if high > len(members) || high == 0 {
			high = len(members)
		}
		if opts.cursor > high {
			// invalid cursor
			c.WriteLen(2)
			c.WriteBulk("0") // no next cursor
			c.WriteLen(0)    // no elements
			return
		}
		cursorValue := low + opts.count
		if cursorValue >= len(members) {
			cursorValue = 0 // no next cursor
		}
		members = members[low:high]

		c.WriteLen(2)
		c.WriteBulk(fmt.Sprintf("%d", cursorValue))
		// HSCAN gives key, values.
		c.WriteLen(len(members) * 2)
		for _, k := range members {
			c.WriteBulk(k)
			c.WriteFloat(db.ssetScore(opts.key, k))
		}
	})
}

// ZPOPMAX and ZPOPMIN
func (m *Miniredis) cmdZpopmax(reverse bool) server.Cmd {
	return func(c *server.Peer, cmd string, args []string) {
		if len(args) < 1 {
			setDirty(c)
			c.WriteError(errWrongNumber(cmd))
			return
		}
		if !m.handleAuth(c) {
			return
		}

		key := args[0]
		count := 1
		var err error
		if len(args) > 1 {
			count, err = strconv.Atoi(args[1])
			if err != nil || count < 0 {
				setDirty(c)
				c.WriteError(msgInvalidRange)
				return
			}
		}

		withScores := true
		if len(args) > 2 {
			c.WriteError(msgSyntaxError)
			return
		}

		withTx(m, c, func(c *server.Peer, ctx *connCtx) {
			db := m.db(ctx.selectedDB)

			if !db.exists(key) {
				c.WriteLen(0)
				return
			}

			if db.t(key) != "zset" {
				c.WriteError(ErrWrongType.Error())
				return
			}

			members := db.ssetMembers(key)
			if reverse {
				reverseSlice(members)
			}
			rs, re := redisRange(len(members), 0, count-1, false)
			if withScores {
				c.WriteLen((re - rs) * 2)
			} else {
				c.WriteLen(re - rs)
			}
			for _, el := range members[rs:re] {
				c.WriteBulk(el)
				if withScores {
					c.WriteFloat(db.ssetScore(key, el))
				}
				db.ssetRem(key, el)
			}
		})
	}
}

// ZRANDMEMBER
func (m *Miniredis) cmdZrandmember(c *server.Peer, cmd string, args []string) {
	if len(args) < 1 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	var opts struct {
		key        string
		withCount  bool
		count      int
		withScores bool
	}

	opts.key = args[0]
	args = args[1:]

	if len(args) > 0 {
		// can be negative
		if ok := optInt(c, args[0], &opts.count); !ok {
			return
		}
		opts.withCount = true
		args = args[1:]
	}

	if len(args) > 0 && strings.ToUpper(args[0]) == "WITHSCORES" {
		opts.withScores = true
		args = args[1:]
	}

	if len(args) > 0 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if !db.exists(opts.key) {
			if opts.withCount {
				c.WriteLen(0)
			} else {
				c.WriteNull()
			}
			return
		}

		if db.t(opts.key) != "zset" {
			c.WriteError(ErrWrongType.Error())
			return
		}

		if !opts.withCount {
			member := db.ssetRandomMember(opts.key)
			if member == "" {
				c.WriteNull()
				return
			}
			c.WriteBulk(member)
			return
		}

		var members []string
		switch {
		case opts.count == 0:
			c.WriteStrings(nil)
			return
		case opts.count > 0:
			allMembers := db.ssetMembers(opts.key)
			db.master.shuffle(allMembers)
			if len(allMembers) > opts.count {
				allMembers = allMembers[:opts.count]
			}
			members = allMembers
		case opts.count < 0:
			for i := 0; i < -opts.count; i++ {
				members = append(members, db.ssetRandomMember(opts.key))
			}
		}
		if opts.withScores {
			c.WriteLen(len(members) * 2)
			for _, m := range members {
				c.WriteBulk(m)
				c.WriteFloat(db.ssetScore(opts.key, m))
			}
			return
		}
		c.WriteStrings(members)
	})
}

type optsRange struct {
	Key        string
	Min        string
	Max        string
	Reverse    bool
	WithScores bool
}

func runRange(m *Miniredis, c *server.Peer, cctx *connCtx, opts optsRange) {
	min, minErr := strconv.Atoi(opts.Min)
	max, maxErr := strconv.Atoi(opts.Max)
	if minErr != nil || maxErr != nil {
		c.WriteError(msgInvalidInt)
		return
	}

	db := m.db(cctx.selectedDB)

	if !db.exists(opts.Key) {
		c.WriteLen(0)
		return
	}

	if db.t(opts.Key) != "zset" {
		c.WriteError(ErrWrongType.Error())
		return
	}

	members := db.ssetMembers(opts.Key)
	if opts.Reverse {
		reverseSlice(members)
	}
	rs, re := redisRange(len(members), min, max, false)
	if opts.WithScores {
		c.WriteLen((re - rs) * 2)
	} else {
		c.WriteLen(re - rs)
	}
	for _, el := range members[rs:re] {
		c.WriteBulk(el)
		if opts.WithScores {
			c.WriteFloat(db.ssetScore(opts.Key, el))
		}
	}
}

type optsRangeByScore struct {
	Key        string
	Min        string
	Max        string
	Reverse    bool
	WithLimit  bool
	Offset     string
	Count      string
	WithScores bool
}

func runRangeByScore(m *Miniredis, c *server.Peer, cctx *connCtx, opts optsRangeByScore) {
	var limitOffset, limitCount int
	var err error
	if opts.WithLimit {
		limitOffset, err = strconv.Atoi(opts.Offset)
		if err != nil {
			c.WriteError(msgInvalidInt)
			return
		}
		limitCount, err = strconv.Atoi(opts.Count)
		if err != nil {
			c.WriteError(msgInvalidInt)
			return
		}
	}
	min, minIncl, minErr := parseFloatRange(opts.Min)
	max, maxIncl, maxErr := parseFloatRange(opts.Max)
	if minErr != nil || maxErr != nil {
		c.WriteError(msgInvalidMinMax)
		return
	}

	db := m.db(cctx.selectedDB)

	if !db.exists(opts.Key) {
		c.WriteLen(0)
		return
	}

	if db.t(opts.Key) != "zset" {
		c.WriteError(ErrWrongType.Error())
		return
	}

	members := db.ssetElements(opts.Key)
	if opts.Reverse {
		min, max = max, min
		minIncl, maxIncl = maxIncl, minIncl
	}
	members = withSSRange(members, min, minIncl, max, maxIncl)
	if opts.Reverse {
		reverseElems(members)
	}

	// Apply LIMIT ranges. That's <start> <elements>. Unlike RANGE.
	if opts.WithLimit {
		if limitOffset < 0 {
			members = ssElems{}
		} else {
			if limitOffset < len(members) {
				members = members[limitOffset:]
			} else {
				// out of range
				members = ssElems{}
			}
			if limitCount >= 0 {
				if len(members) > limitCount {
					members = members[:limitCount]
				}
			}
		}
	}

	if opts.WithScores {
		c.WriteLen(len(members) * 2)
	} else {
		c.WriteLen(len(members))
	}
	for _, el := range members {
		c.WriteBulk(el.member)
		if opts.WithScores {
			c.WriteFloat(el.score)
		}
	}
}

type optsRangeByLex struct {
	Key        string
	Min        string
	Max        string
	Reverse    bool
	WithLimit  bool
	Offset     string
	Count      string
	WithScores bool
}

func runRangeByLex(m *Miniredis, c *server.Peer, cctx *connCtx, opts optsRangeByLex) {
	var limitOffset, limitCount int
	var err error
	if opts.WithLimit {
		limitOffset, err = strconv.Atoi(opts.Offset)
		if err != nil {
			c.WriteError(msgInvalidInt)
			return
		}
		limitCount, err = strconv.Atoi(opts.Count)
		if err != nil {
			c.WriteError(msgInvalidInt)
			return
		}
	}
	min, minIncl, minErr := parseLexrange(opts.Min)
	max, maxIncl, maxErr := parseLexrange(opts.Max)
	if minErr != nil || maxErr != nil {
		c.WriteError(msgInvalidRangeItem)
		return
	}

	db := m.db(cctx.selectedDB)

	if !db.exists(opts.Key) {
		c.WriteLen(0)
		return
	}

	if db.t(opts.Key) != "zset" {
		c.WriteError(ErrWrongType.Error())
		return
	}

	members := db.ssetMembers(opts.Key)
	// Just key sort. If scores are not the same we don't care.
	sort.Strings(members)
	if opts.Reverse {
		min, max = max, min
		minIncl, maxIncl = maxIncl, minIncl
	}
	members = withLexRange(members, min, minIncl, max, maxIncl)
	if opts.Reverse {
		reverseSlice(members)
	}

	// Apply LIMIT ranges. That's <start> <elements>. Unlike RANGE.
	if opts.WithLimit {
		if limitOffset < 0 {
			members = nil
		} else {
			if limitOffset < len(members) {
				members = members[limitOffset:]
			} else {
				// out of range
				members = nil
			}
			if limitCount >= 0 {
				if len(members) > limitCount {
					members = members[:limitCount]
				}
			}
		}
	}

	c.WriteLen(len(members))
	for _, el := range members {
		c.WriteBulk(el)
	}
}

// optLexrange handles ZRANGE{,BYLEX} ranges. They start with '[', '(', or are
// '+' or '-'.
// Sets destValue and destInclusive. destValue can be '+' or '-'.
func parseLexrange(s string) (string, bool, error) {
	if len(s) == 0 {
		return "", false, errors.New(msgInvalidRangeItem)
	}

	if s == "+" || s == "-" {
		return s, false, nil
	}

	switch s[0] {
	case '(':
		return s[1:], false, nil
	case '[':
		return s[1:], true, nil
	default:
		return "", false, errors.New(msgInvalidRangeItem)
	}
}

func sortedKeys(m map[string]float64) []string {
	var keys []string
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
