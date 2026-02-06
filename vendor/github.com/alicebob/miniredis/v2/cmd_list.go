// Commands from https://redis.io/commands#list

package miniredis

import (
	"strconv"
	"strings"
	"time"

	"github.com/alicebob/miniredis/v2/server"
)

type leftright int

const (
	left leftright = iota
	right
)

// commandsList handles list commands (mostly L*)
func commandsList(m *Miniredis) {
	m.srv.Register("BLPOP", m.cmdBlpop)
	m.srv.Register("BRPOP", m.cmdBrpop)
	m.srv.Register("BRPOPLPUSH", m.cmdBrpoplpush)
	m.srv.Register("LINDEX", m.cmdLindex)
	m.srv.Register("LPOS", m.cmdLpos)
	m.srv.Register("LINSERT", m.cmdLinsert)
	m.srv.Register("LLEN", m.cmdLlen)
	m.srv.Register("LPOP", m.cmdLpop)
	m.srv.Register("LPUSH", m.cmdLpush)
	m.srv.Register("LPUSHX", m.cmdLpushx)
	m.srv.Register("LRANGE", m.cmdLrange)
	m.srv.Register("LREM", m.cmdLrem)
	m.srv.Register("LSET", m.cmdLset)
	m.srv.Register("LTRIM", m.cmdLtrim)
	m.srv.Register("RPOP", m.cmdRpop)
	m.srv.Register("RPOPLPUSH", m.cmdRpoplpush)
	m.srv.Register("RPUSH", m.cmdRpush)
	m.srv.Register("RPUSHX", m.cmdRpushx)
	m.srv.Register("LMOVE", m.cmdLmove)
	m.srv.Register("BLMOVE", m.cmdBlmove)
}

// BLPOP
func (m *Miniredis) cmdBlpop(c *server.Peer, cmd string, args []string) {
	m.cmdBXpop(c, cmd, args, left)
}

// BRPOP
func (m *Miniredis) cmdBrpop(c *server.Peer, cmd string, args []string) {
	m.cmdBXpop(c, cmd, args, right)
}

func (m *Miniredis) cmdBXpop(c *server.Peer, cmd string, args []string, lr leftright) {
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
		keys    []string
		timeout time.Duration
	}

	if ok := optDuration(c, args[len(args)-1], &opts.timeout); !ok {
		return
	}
	opts.keys = args[:len(args)-1]

	blocking(
		m,
		c,
		opts.timeout,
		func(c *server.Peer, ctx *connCtx) bool {
			db := m.db(ctx.selectedDB)
			for _, key := range opts.keys {
				if !db.exists(key) {
					continue
				}
				if db.t(key) != "list" {
					c.WriteError(msgWrongType)
					return true
				}

				if len(db.listKeys[key]) == 0 {
					continue
				}
				c.WriteLen(2)
				c.WriteBulk(key)
				var v string
				switch lr {
				case left:
					v = db.listLpop(key)
				case right:
					v = db.listPop(key)
				}
				c.WriteBulk(v)
				return true
			}
			return false
		},
		func(c *server.Peer) {
			// timeout
			c.WriteLen(-1)
		},
	)
}

// LINDEX
func (m *Miniredis) cmdLindex(c *server.Peer, cmd string, args []string) {
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

	key, offsets := args[0], args[1]

	offset, err := strconv.Atoi(offsets)
	if err != nil || offsets == "-0" {
		setDirty(c)
		c.WriteError(msgInvalidInt)
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		t, ok := db.keys[key]
		if !ok {
			// No such key
			c.WriteNull()
			return
		}
		if t != "list" {
			c.WriteError(msgWrongType)
			return
		}

		l := db.listKeys[key]
		if offset < 0 {
			offset = len(l) + offset
		}
		if offset < 0 || offset > len(l)-1 {
			c.WriteNull()
			return
		}
		c.WriteBulk(l[offset])
	})
}

// LPOS key element [RANK rank] [COUNT num-matches] [MAXLEN len]
func (m *Miniredis) cmdLpos(c *server.Peer, cmd string, args []string) {
	if !m.handleAuth(c) {
		return
	}
	if m.checkPubsub(c, cmd) {
		return
	}

	if len(args) == 1 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}

	// Extract options from arguments if present.
	//
	// Redis allows duplicate options and uses the last specified.
	// `LPOS key term RANK 1 RANK 2` is effectively the same as
	// `LPOS key term RANK 2`
	if len(args)%2 == 1 {
		setDirty(c)
		c.WriteError(msgSyntaxError)
		return
	}
	rank, count := 1, 1 // Default values
	var maxlen int      // Default value is the list length (see below)
	var countSpecified, maxlenSpecified bool
	if len(args) > 2 {
		for i := 2; i < len(args); i++ {
			if i%2 == 0 {
				val := args[i+1]
				var err error
				switch strings.ToLower(args[i]) {
				case "rank":
					if rank, err = strconv.Atoi(val); err != nil {
						setDirty(c)
						c.WriteError(msgInvalidInt)
						return
					}
					if rank == 0 {
						setDirty(c)
						c.WriteError(msgRankIsZero)
						return
					}
				case "count":
					countSpecified = true
					if count, err = strconv.Atoi(val); err != nil || count < 0 {
						setDirty(c)
						c.WriteError(msgCountIsNegative)
						return
					}
				case "maxlen":
					maxlenSpecified = true
					if maxlen, err = strconv.Atoi(val); err != nil || maxlen < 0 {
						setDirty(c)
						c.WriteError(msgMaxLengthIsNegative)
						return
					}
				default:
					setDirty(c)
					c.WriteError(msgSyntaxError)
					return
				}
			}
		}
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)
		key, element := args[0], args[1]
		t, ok := db.keys[key]
		if !ok {
			// No such key
			c.WriteNull()
			return
		}
		if t != "list" {
			c.WriteError(msgWrongType)
			return
		}
		l := db.listKeys[key]

		// RANK cannot be zero (see above).
		// If RANK is positive search forward (left to right).
		// If RANK is negative search backward (right to left).
		// Iterator returns true to continue iterating.
		iterate := func(iterator func(i int, e string) bool) {
			comparisons := len(l)
			// Only use max length if specified, not zero, and less than total length.
			// When max length is specified, but is zero, this means "unlimited".
			if maxlenSpecified && maxlen != 0 && maxlen < len(l) {
				comparisons = maxlen
			}
			if rank > 0 {
				for i := 0; i < comparisons; i++ {
					if resume := iterator(i, l[i]); !resume {
						return
					}
				}
			} else if rank < 0 {
				start := len(l) - 1
				end := len(l) - comparisons
				for i := start; i >= end; i-- {
					if resume := iterator(i, l[i]); !resume {
						return
					}
				}
			}
		}

		var currentRank, currentCount int
		vals := make([]int, 0, count)
		iterate(func(i int, e string) bool {
			if e == element {
				currentRank++
				// Only collect values only after surpassing the absolute value of rank.
				if rank > 0 && currentRank < rank {
					return true
				}
				if rank < 0 && currentRank < -rank {
					return true
				}
				vals = append(vals, i)
				currentCount++
				if currentCount == count {
					return false
				}
			}
			return true
		})

		if !countSpecified && len(vals) == 0 {
			c.WriteNull()
			return
		}
		if !countSpecified && len(vals) == 1 {
			c.WriteInt(vals[0])
			return
		}
		c.WriteLen(len(vals))
		for _, val := range vals {
			c.WriteInt(val)
		}
	})
}

// LINSERT
func (m *Miniredis) cmdLinsert(c *server.Peer, cmd string, args []string) {
	if len(args) != 4 {
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
	where := 0
	switch strings.ToLower(args[1]) {
	case "before":
		where = -1
	case "after":
		where = +1
	default:
		setDirty(c)
		c.WriteError(msgSyntaxError)
		return
	}
	pivot := args[2]
	value := args[3]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		t, ok := db.keys[key]
		if !ok {
			// No such key
			c.WriteInt(0)
			return
		}
		if t != "list" {
			c.WriteError(msgWrongType)
			return
		}

		l := db.listKeys[key]
		for i, el := range l {
			if el != pivot {
				continue
			}

			if where < 0 {
				l = append(l[:i], append(listKey{value}, l[i:]...)...)
			} else {
				if i == len(l)-1 {
					l = append(l, value)
				} else {
					l = append(l[:i+1], append(listKey{value}, l[i+1:]...)...)
				}
			}
			db.listKeys[key] = l
			db.incr(key)
			c.WriteInt(len(l))
			return
		}
		c.WriteInt(-1)
	})
}

// LLEN
func (m *Miniredis) cmdLlen(c *server.Peer, cmd string, args []string) {
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

		t, ok := db.keys[key]
		if !ok {
			// No such key. That's zero length.
			c.WriteInt(0)
			return
		}
		if t != "list" {
			c.WriteError(msgWrongType)
			return
		}

		c.WriteInt(len(db.listKeys[key]))
	})
}

// LPOP
func (m *Miniredis) cmdLpop(c *server.Peer, cmd string, args []string) {
	m.cmdXpop(c, cmd, args, left)
}

// RPOP
func (m *Miniredis) cmdRpop(c *server.Peer, cmd string, args []string) {
	m.cmdXpop(c, cmd, args, right)
}

func (m *Miniredis) cmdXpop(c *server.Peer, cmd string, args []string, lr leftright) {
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
		key       string
		withCount bool
		count     int
	}

	opts.key, args = args[0], args[1:]
	if len(args) > 0 {
		if ok := optInt(c, args[0], &opts.count); !ok {
			return
		}
		if opts.count < 0 {
			setDirty(c)
			c.WriteError(msgOutOfRange)
			return
		}
		opts.withCount = true
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
			// non-existing key is fine
			if opts.withCount && !c.Resp3 {
				// zero-length list in this specific case. Looks like a redis bug to me.
				c.WriteLen(-1)
				return
			}
			c.WriteNull()
			return
		}
		if db.t(opts.key) != "list" {
			c.WriteError(msgWrongType)
			return
		}

		if opts.withCount {
			var popped []string
			for opts.count > 0 && len(db.listKeys[opts.key]) > 0 {
				switch lr {
				case left:
					popped = append(popped, db.listLpop(opts.key))
				case right:
					popped = append(popped, db.listPop(opts.key))
				}
				opts.count -= 1
			}
			c.WriteStrings(popped)
			return
		}

		var elem string
		switch lr {
		case left:
			elem = db.listLpop(opts.key)
		case right:
			elem = db.listPop(opts.key)
		}
		c.WriteBulk(elem)
	})
}

// LPUSH
func (m *Miniredis) cmdLpush(c *server.Peer, cmd string, args []string) {
	m.cmdXpush(c, cmd, args, left)
}

// RPUSH
func (m *Miniredis) cmdRpush(c *server.Peer, cmd string, args []string) {
	m.cmdXpush(c, cmd, args, right)
}

func (m *Miniredis) cmdXpush(c *server.Peer, cmd string, args []string, lr leftright) {
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

	key, args := args[0], args[1:]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if db.exists(key) && db.t(key) != "list" {
			c.WriteError(msgWrongType)
			return
		}

		var newLen int
		for _, value := range args {
			switch lr {
			case left:
				newLen = db.listLpush(key, value)
			case right:
				newLen = db.listPush(key, value)
			}
		}
		c.WriteInt(newLen)
	})
}

// LPUSHX
func (m *Miniredis) cmdLpushx(c *server.Peer, cmd string, args []string) {
	m.cmdXpushx(c, cmd, args, left)
}

// RPUSHX
func (m *Miniredis) cmdRpushx(c *server.Peer, cmd string, args []string) {
	m.cmdXpushx(c, cmd, args, right)
}

func (m *Miniredis) cmdXpushx(c *server.Peer, cmd string, args []string, lr leftright) {
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

	key, args := args[0], args[1:]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if !db.exists(key) {
			c.WriteInt(0)
			return
		}
		if db.t(key) != "list" {
			c.WriteError(msgWrongType)
			return
		}

		var newLen int
		for _, value := range args {
			switch lr {
			case left:
				newLen = db.listLpush(key, value)
			case right:
				newLen = db.listPush(key, value)
			}
		}
		c.WriteInt(newLen)
	})
}

// LRANGE
func (m *Miniredis) cmdLrange(c *server.Peer, cmd string, args []string) {
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

	opts := struct {
		key   string
		start int
		end   int
	}{
		key: args[0],
	}
	if ok := optInt(c, args[1], &opts.start); !ok {
		return
	}
	if ok := optInt(c, args[2], &opts.end); !ok {
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if t, ok := db.keys[opts.key]; ok && t != "list" {
			c.WriteError(msgWrongType)
			return
		}

		l := db.listKeys[opts.key]
		if len(l) == 0 {
			c.WriteLen(0)
			return
		}

		rs, re := redisRange(len(l), opts.start, opts.end, false)
		c.WriteLen(re - rs)
		for _, el := range l[rs:re] {
			c.WriteBulk(el)
		}
	})
}

// LREM
func (m *Miniredis) cmdLrem(c *server.Peer, cmd string, args []string) {
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
		count int
		value string
	}
	opts.key = args[0]
	if ok := optInt(c, args[1], &opts.count); !ok {
		return
	}
	opts.value = args[2]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if !db.exists(opts.key) {
			c.WriteInt(0)
			return
		}
		if db.t(opts.key) != "list" {
			c.WriteError(msgWrongType)
			return
		}

		l := db.listKeys[opts.key]
		if opts.count < 0 {
			reverseSlice(l)
		}
		deleted := 0
		newL := []string{}
		toDelete := len(l)
		if opts.count < 0 {
			toDelete = -opts.count
		}
		if opts.count > 0 {
			toDelete = opts.count
		}
		for _, el := range l {
			if el == opts.value {
				if toDelete > 0 {
					deleted++
					toDelete--
					continue
				}
			}
			newL = append(newL, el)
		}
		if opts.count < 0 {
			reverseSlice(newL)
		}
		if len(newL) == 0 {
			db.del(opts.key, true)
		} else {
			db.listKeys[opts.key] = newL
			db.incr(opts.key)
		}

		c.WriteInt(deleted)
	})
}

// LSET
func (m *Miniredis) cmdLset(c *server.Peer, cmd string, args []string) {
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
		index int
		value string
	}
	opts.key = args[0]
	if ok := optInt(c, args[1], &opts.index); !ok {
		return
	}
	opts.value = args[2]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if !db.exists(opts.key) {
			c.WriteError(msgKeyNotFound)
			return
		}
		if db.t(opts.key) != "list" {
			c.WriteError(msgWrongType)
			return
		}

		l := db.listKeys[opts.key]
		index := opts.index
		if index < 0 {
			index = len(l) + index
		}
		if index < 0 || index > len(l)-1 {
			c.WriteError(msgOutOfRange)
			return
		}
		l[index] = opts.value
		db.incr(opts.key)

		c.WriteOK()
	})
}

// LTRIM
func (m *Miniredis) cmdLtrim(c *server.Peer, cmd string, args []string) {
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

		t, ok := db.keys[opts.key]
		if !ok {
			c.WriteOK()
			return
		}
		if t != "list" {
			c.WriteError(msgWrongType)
			return
		}

		l := db.listKeys[opts.key]
		rs, re := redisRange(len(l), opts.start, opts.end, false)
		l = l[rs:re]
		if len(l) == 0 {
			db.del(opts.key, true)
		} else {
			db.listKeys[opts.key] = l
			db.incr(opts.key)
		}
		c.WriteOK()
	})
}

// RPOPLPUSH
func (m *Miniredis) cmdRpoplpush(c *server.Peer, cmd string, args []string) {
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

	src, dst := args[0], args[1]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if !db.exists(src) {
			c.WriteNull()
			return
		}
		if db.t(src) != "list" || (db.exists(dst) && db.t(dst) != "list") {
			c.WriteError(msgWrongType)
			return
		}
		elem := db.listPop(src)
		db.listLpush(dst, elem)
		c.WriteBulk(elem)
	})
}

// BRPOPLPUSH
func (m *Miniredis) cmdBrpoplpush(c *server.Peer, cmd string, args []string) {
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
		src     string
		dst     string
		timeout time.Duration
	}
	opts.src = args[0]
	opts.dst = args[1]
	if ok := optDuration(c, args[2], &opts.timeout); !ok {
		return
	}

	blocking(
		m,
		c,
		opts.timeout,
		func(c *server.Peer, ctx *connCtx) bool {
			db := m.db(ctx.selectedDB)

			if !db.exists(opts.src) {
				return false
			}
			if db.t(opts.src) != "list" || (db.exists(opts.dst) && db.t(opts.dst) != "list") {
				c.WriteError(msgWrongType)
				return true
			}
			if len(db.listKeys[opts.src]) == 0 {
				return false
			}
			elem := db.listPop(opts.src)
			db.listLpush(opts.dst, elem)
			c.WriteBulk(elem)
			return true
		},
		func(c *server.Peer) {
			// timeout
			c.WriteLen(-1)
		},
	)
}

// LMOVE
func (m *Miniredis) cmdLmove(c *server.Peer, cmd string, args []string) {
	if len(args) != 4 {
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

	opts := struct {
		src    string
		dst    string
		srcDir string
		dstDir string
	}{
		src:    args[0],
		dst:    args[1],
		srcDir: strings.ToLower(args[2]),
		dstDir: strings.ToLower(args[3]),
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if !db.exists(opts.src) {
			c.WriteNull()
			return
		}
		if db.t(opts.src) != "list" || (db.exists(opts.dst) && db.t(opts.dst) != "list") {
			c.WriteError(msgWrongType)
			return
		}
		var elem string
		switch opts.srcDir {
		case "left":
			elem = db.listLpop(opts.src)
		case "right":
			elem = db.listPop(opts.src)
		default:
			c.WriteError(msgSyntaxError)
			return
		}

		switch opts.dstDir {
		case "left":
			db.listLpush(opts.dst, elem)
		case "right":
			db.listPush(opts.dst, elem)
		default:
			c.WriteError(msgSyntaxError)
			return
		}
		c.WriteBulk(elem)
	})
}

// BLMOVE
func (m *Miniredis) cmdBlmove(c *server.Peer, cmd string, args []string) {
	if len(args) != 5 {
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

	opts := struct {
		src     string
		dst     string
		srcDir  string
		dstDir  string
		timeout time.Duration
	}{
		src:    args[0],
		dst:    args[1],
		srcDir: strings.ToLower(args[2]),
		dstDir: strings.ToLower(args[3]),
	}
	if ok := optDuration(c, args[len(args)-1], &opts.timeout); !ok {
		return
	}

	blocking(
		m,
		c,
		opts.timeout,
		func(c *server.Peer, ctx *connCtx) bool {
			db := m.db(ctx.selectedDB)

			if !db.exists(opts.src) {
				return false
			}
			if db.t(opts.src) != "list" || (db.exists(opts.dst) && db.t(opts.dst) != "list") {
				c.WriteError(msgWrongType)
				return true
			}

			var elem string
			switch opts.srcDir {
			case "left":
				elem = db.listLpop(opts.src)
			case "right":
				elem = db.listPop(opts.src)
			default:
				c.WriteError(msgSyntaxError)
				return true
			}

			switch opts.dstDir {
			case "left":
				db.listLpush(opts.dst, elem)
			case "right":
				db.listPush(opts.dst, elem)
			default:
				c.WriteError(msgSyntaxError)
				return true
			}

			c.WriteBulk(elem)
			return true
		},
		func(c *server.Peer) {
			// timeout
			c.WriteLen(-1)
		},
	)
}
