// Commands from https://redis.io/commands#hash

package miniredis

import (
	"math/big"
	"strconv"
	"strings"

	"github.com/alicebob/miniredis/v2/server"
)

// commandsHash handles all hash value operations.
func commandsHash(m *Miniredis) {
	m.srv.Register("HDEL", m.cmdHdel)
	m.srv.Register("HEXISTS", m.cmdHexists)
	m.srv.Register("HGET", m.cmdHget)
	m.srv.Register("HGETALL", m.cmdHgetall)
	m.srv.Register("HINCRBY", m.cmdHincrby)
	m.srv.Register("HINCRBYFLOAT", m.cmdHincrbyfloat)
	m.srv.Register("HKEYS", m.cmdHkeys)
	m.srv.Register("HLEN", m.cmdHlen)
	m.srv.Register("HMGET", m.cmdHmget)
	m.srv.Register("HMSET", m.cmdHmset)
	m.srv.Register("HSET", m.cmdHset)
	m.srv.Register("HSETNX", m.cmdHsetnx)
	m.srv.Register("HSTRLEN", m.cmdHstrlen)
	m.srv.Register("HVALS", m.cmdHvals)
	m.srv.Register("HSCAN", m.cmdHscan)
	m.srv.Register("HRANDFIELD", m.cmdHrandfield)
}

// HSET
func (m *Miniredis) cmdHset(c *server.Peer, cmd string, args []string) {
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

	key, pairs := args[0], args[1:]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if len(pairs)%2 == 1 {
			c.WriteError(errWrongNumber(cmd))
			return
		}

		if t, ok := db.keys[key]; ok && t != "hash" {
			c.WriteError(msgWrongType)
			return
		}

		new := db.hashSet(key, pairs...)
		c.WriteInt(new)
	})
}

// HSETNX
func (m *Miniredis) cmdHsetnx(c *server.Peer, cmd string, args []string) {
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
		field string
		value string
	}{
		key:   args[0],
		field: args[1],
		value: args[2],
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if t, ok := db.keys[opts.key]; ok && t != "hash" {
			c.WriteError(msgWrongType)
			return
		}

		if _, ok := db.hashKeys[opts.key]; !ok {
			db.hashKeys[opts.key] = map[string]string{}
			db.keys[opts.key] = "hash"
		}
		_, ok := db.hashKeys[opts.key][opts.field]
		if ok {
			c.WriteInt(0)
			return
		}
		db.hashKeys[opts.key][opts.field] = opts.value
		db.incr(opts.key)
		c.WriteInt(1)
	})
}

// HMSET
func (m *Miniredis) cmdHmset(c *server.Peer, cmd string, args []string) {
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

	key, args := args[0], args[1:]
	if len(args)%2 != 0 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if t, ok := db.keys[key]; ok && t != "hash" {
			c.WriteError(msgWrongType)
			return
		}

		for len(args) > 0 {
			field, value := args[0], args[1]
			args = args[2:]
			db.hashSet(key, field, value)
		}
		c.WriteOK()
	})
}

// HGET
func (m *Miniredis) cmdHget(c *server.Peer, cmd string, args []string) {
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

	key, field := args[0], args[1]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		t, ok := db.keys[key]
		if !ok {
			c.WriteNull()
			return
		}
		if t != "hash" {
			c.WriteError(msgWrongType)
			return
		}
		value, ok := db.hashKeys[key][field]
		if !ok {
			c.WriteNull()
			return
		}
		c.WriteBulk(value)
	})
}

// HDEL
func (m *Miniredis) cmdHdel(c *server.Peer, cmd string, args []string) {
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

	opts := struct {
		key    string
		fields []string
	}{
		key:    args[0],
		fields: args[1:],
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		t, ok := db.keys[opts.key]
		if !ok {
			// No key is zero deleted
			c.WriteInt(0)
			return
		}
		if t != "hash" {
			c.WriteError(msgWrongType)
			return
		}

		deleted := 0
		for _, f := range opts.fields {
			_, ok := db.hashKeys[opts.key][f]
			if !ok {
				continue
			}
			delete(db.hashKeys[opts.key], f)
			deleted++
		}
		c.WriteInt(deleted)

		// Nothing left. Remove the whole key.
		if len(db.hashKeys[opts.key]) == 0 {
			db.del(opts.key, true)
		}
	})
}

// HEXISTS
func (m *Miniredis) cmdHexists(c *server.Peer, cmd string, args []string) {
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

	opts := struct {
		key   string
		field string
	}{
		key:   args[0],
		field: args[1],
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		t, ok := db.keys[opts.key]
		if !ok {
			c.WriteInt(0)
			return
		}
		if t != "hash" {
			c.WriteError(msgWrongType)
			return
		}

		if _, ok := db.hashKeys[opts.key][opts.field]; !ok {
			c.WriteInt(0)
			return
		}
		c.WriteInt(1)
	})
}

// HGETALL
func (m *Miniredis) cmdHgetall(c *server.Peer, cmd string, args []string) {
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
			c.WriteMapLen(0)
			return
		}
		if t != "hash" {
			c.WriteError(msgWrongType)
			return
		}

		c.WriteMapLen(len(db.hashKeys[key]))
		for _, k := range db.hashFields(key) {
			c.WriteBulk(k)
			c.WriteBulk(db.hashGet(key, k))
		}
	})
}

// HKEYS
func (m *Miniredis) cmdHkeys(c *server.Peer, cmd string, args []string) {
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
			c.WriteLen(0)
			return
		}
		if db.t(key) != "hash" {
			c.WriteError(msgWrongType)
			return
		}

		fields := db.hashFields(key)
		c.WriteLen(len(fields))
		for _, f := range fields {
			c.WriteBulk(f)
		}
	})
}

// HSTRLEN
func (m *Miniredis) cmdHstrlen(c *server.Peer, cmd string, args []string) {
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

	hash, key := args[0], args[1]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		t, ok := db.keys[hash]
		if !ok {
			c.WriteInt(0)
			return
		}
		if t != "hash" {
			c.WriteError(msgWrongType)
			return
		}

		keys := db.hashKeys[hash]
		c.WriteInt(len(keys[key]))
	})
}

// HVALS
func (m *Miniredis) cmdHvals(c *server.Peer, cmd string, args []string) {
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
			c.WriteLen(0)
			return
		}
		if t != "hash" {
			c.WriteError(msgWrongType)
			return
		}

		vals := db.hashValues(key)
		c.WriteLen(len(vals))
		for _, v := range vals {
			c.WriteBulk(v)
		}
	})
}

// HLEN
func (m *Miniredis) cmdHlen(c *server.Peer, cmd string, args []string) {
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
			c.WriteInt(0)
			return
		}
		if t != "hash" {
			c.WriteError(msgWrongType)
			return
		}

		c.WriteInt(len(db.hashKeys[key]))
	})
}

// HMGET
func (m *Miniredis) cmdHmget(c *server.Peer, cmd string, args []string) {
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

	key := args[0]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if t, ok := db.keys[key]; ok && t != "hash" {
			c.WriteError(msgWrongType)
			return
		}

		f, ok := db.hashKeys[key]
		if !ok {
			f = map[string]string{}
		}

		c.WriteLen(len(args) - 1)
		for _, k := range args[1:] {
			v, ok := f[k]
			if !ok {
				c.WriteNull()
				continue
			}
			c.WriteBulk(v)
		}
	})
}

// HINCRBY
func (m *Miniredis) cmdHincrby(c *server.Peer, cmd string, args []string) {
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
		field string
		delta int
	}{
		key:   args[0],
		field: args[1],
	}
	if ok := optInt(c, args[2], &opts.delta); !ok {
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if t, ok := db.keys[opts.key]; ok && t != "hash" {
			c.WriteError(msgWrongType)
			return
		}

		v, err := db.hashIncr(opts.key, opts.field, opts.delta)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		c.WriteInt(v)
	})
}

// HINCRBYFLOAT
func (m *Miniredis) cmdHincrbyfloat(c *server.Peer, cmd string, args []string) {
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
		field string
		delta *big.Float
	}{
		key:   args[0],
		field: args[1],
	}
	delta, _, err := big.ParseFloat(args[2], 10, 128, 0)
	if err != nil {
		setDirty(c)
		c.WriteError(msgInvalidFloat)
		return
	}
	opts.delta = delta

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		if t, ok := db.keys[opts.key]; ok && t != "hash" {
			c.WriteError(msgWrongType)
			return
		}

		v, err := db.hashIncrfloat(opts.key, opts.field, opts.delta)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		c.WriteBulk(formatBig(v))
	})
}

// HSCAN
func (m *Miniredis) cmdHscan(c *server.Peer, cmd string, args []string) {
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

	opts := struct {
		key       string
		cursor    int
		withMatch bool
		match     string
	}{
		key: args[0],
	}
	if ok := optIntErr(c, args[1], &opts.cursor, msgInvalidCursor); !ok {
		return
	}
	args = args[2:]

	// MATCH and COUNT options
	for len(args) > 0 {
		if strings.ToLower(args[0]) == "count" {
			// we do nothing with count
			if len(args) < 2 {
				setDirty(c)
				c.WriteError(msgSyntaxError)
				return
			}
			_, err := strconv.Atoi(args[1])
			if err != nil {
				setDirty(c)
				c.WriteError(msgInvalidInt)
				return
			}
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
			opts.match, args = args[1], args[2:]
			continue
		}
		setDirty(c)
		c.WriteError(msgSyntaxError)
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)
		// return _all_ (matched) keys every time

		if opts.cursor != 0 {
			// Invalid cursor.
			c.WriteLen(2)
			c.WriteBulk("0") // no next cursor
			c.WriteLen(0)    // no elements
			return
		}
		if db.exists(opts.key) && db.t(opts.key) != "hash" {
			c.WriteError(ErrWrongType.Error())
			return
		}

		members := db.hashFields(opts.key)
		if opts.withMatch {
			members, _ = matchKeys(members, opts.match)
		}

		c.WriteLen(2)
		c.WriteBulk("0") // no next cursor
		// HSCAN gives key, values.
		c.WriteLen(len(members) * 2)
		for _, k := range members {
			c.WriteBulk(k)
			c.WriteBulk(db.hashGet(opts.key, k))
		}
	})
}

// HRANDFIELD
func (m *Miniredis) cmdHrandfield(c *server.Peer, cmd string, args []string) {
	if len(args) > 3 || len(args) < 1 {
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
		key        string
		count      int
		countSet   bool
		withValues bool
	}{
		key: args[0],
	}

	if len(args) > 1 {
		if ok := optIntErr(c, args[1], &opts.count, msgInvalidInt); !ok {
			return
		}
		opts.countSet = true
	}

	if len(args) == 3 {
		if strings.ToLower(args[2]) == "withvalues" {
			opts.withValues = true
		} else {
			setDirty(c)
			c.WriteError(msgSyntaxError)
			return
		}
	}

	withTx(m, c, func(peer *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)
		members := db.hashFields(opts.key)
		m.shuffle(members)

		if !opts.countSet {
			// > When called with just the key argument, return a random field from the
			// hash value stored at key.
			if len(members) == 0 {
				peer.WriteNull()
				return
			}
			peer.WriteBulk(members[0])
			return
		}

		if len(members) > abs(opts.count) {
			members = members[:abs(opts.count)]
		}
		switch {
		case opts.count >= 0:
			// if count is positive there can't be duplicates, and the length is restricted
		case opts.count < 0:
			// if count is negative there can be duplicates, but length will match
			if len(members) > 0 {
				for len(members) < -opts.count {
					members = append(members, members[m.randIntn(len(members))])
				}
			}
		}

		if opts.withValues {
			peer.WriteMapLen(len(members))
			for _, m := range members {
				peer.WriteBulk(m)
				peer.WriteBulk(db.hashGet(opts.key, m))
			}
			return
		}
		peer.WriteLen(len(members))
		for _, m := range members {
			peer.WriteBulk(m)
		}
	})
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}
