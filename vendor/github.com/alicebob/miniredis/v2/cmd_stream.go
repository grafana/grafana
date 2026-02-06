// Commands from https://redis.io/commands#stream

package miniredis

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/alicebob/miniredis/v2/server"
)

// commandsStream handles all stream operations.
func commandsStream(m *Miniredis) {
	m.srv.Register("XADD", m.cmdXadd)
	m.srv.Register("XLEN", m.cmdXlen)
	m.srv.Register("XREAD", m.cmdXread)
	m.srv.Register("XRANGE", m.makeCmdXrange(false))
	m.srv.Register("XREVRANGE", m.makeCmdXrange(true))
	m.srv.Register("XGROUP", m.cmdXgroup)
	m.srv.Register("XINFO", m.cmdXinfo)
	m.srv.Register("XREADGROUP", m.cmdXreadgroup)
	m.srv.Register("XACK", m.cmdXack)
	m.srv.Register("XDEL", m.cmdXdel)
	m.srv.Register("XPENDING", m.cmdXpending)
	m.srv.Register("XTRIM", m.cmdXtrim)
	m.srv.Register("XAUTOCLAIM", m.cmdXautoclaim)
	m.srv.Register("XCLAIM", m.cmdXclaim)
}

// XADD
func (m *Miniredis) cmdXadd(c *server.Peer, cmd string, args []string) {
	if len(args) < 4 {
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
		maxlen := -1
		minID := ""
		makeStream := true
		if strings.ToLower(args[0]) == "nomkstream" {
			args = args[1:]
			makeStream = false
		}
		if strings.ToLower(args[0]) == "maxlen" {
			args = args[1:]
			// we don't treat "~" special
			if args[0] == "~" {
				args = args[1:]
			}
			n, err := strconv.Atoi(args[0])
			if err != nil {
				c.WriteError(msgInvalidInt)
				return
			}
			if n < 0 {
				c.WriteError("ERR The MAXLEN argument must be >= 0.")
				return
			}
			maxlen = n
			args = args[1:]
		} else if strings.ToLower(args[0]) == "minid" {
			args = args[1:]
			// we don't treat "~" special
			if args[0] == "~" {
				args = args[1:]
			}
			minID = args[0]
			args = args[1:]
		}
		if len(args) < 1 {
			c.WriteError(errWrongNumber(cmd))
			return
		}
		entryID, args := args[0], args[1:]

		// args must be composed of field/value pairs.
		if len(args) == 0 || len(args)%2 != 0 {
			c.WriteError("ERR wrong number of arguments for XADD") // non-default message
			return
		}

		var values []string
		for len(args) > 0 {
			values = append(values, args[0], args[1])
			args = args[2:]
		}

		db := m.db(ctx.selectedDB)
		s, err := db.stream(key)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		if s == nil {
			if !makeStream {
				c.WriteNull()
				return
			}
			s, _ = db.newStream(key)
		}

		newID, err := s.add(entryID, values, m.effectiveNow())
		if err != nil {
			switch err {
			case errInvalidEntryID:
				c.WriteError(msgInvalidStreamID)
			default:
				c.WriteError(err.Error())
			}
			return
		}
		if maxlen >= 0 {
			s.trim(maxlen)
		}
		if minID != "" {
			s.trimBefore(minID)
		}
		db.incr(key)

		c.WriteBulk(newID)
	})
}

// XLEN
func (m *Miniredis) cmdXlen(c *server.Peer, cmd string, args []string) {
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

		s, err := db.stream(key)
		if err != nil {
			c.WriteError(err.Error())
		}
		if s == nil {
			// No such key. That's zero length.
			c.WriteInt(0)
			return
		}

		c.WriteInt(len(s.entries))
	})
}

// XRANGE and XREVRANGE
func (m *Miniredis) makeCmdXrange(reverse bool) server.Cmd {
	return func(c *server.Peer, cmd string, args []string) {
		if len(args) < 3 {
			setDirty(c)
			c.WriteError(errWrongNumber(cmd))
			return
		}
		if len(args) == 4 || len(args) > 5 {
			setDirty(c)
			c.WriteError(msgSyntaxError)
			return
		}
		if !m.handleAuth(c) {
			return
		}
		if m.checkPubsub(c, cmd) {
			return
		}

		opts := struct {
			key            string
			startKey       string
			startExclusive bool
			endKey         string
			endExclusive   bool
		}{
			key:      args[0],
			startKey: args[1],
			endKey:   args[2],
		}
		if strings.HasPrefix(opts.startKey, "(") {
			opts.startExclusive = true
			opts.startKey = opts.startKey[1:]
			if opts.startKey == "-" || opts.startKey == "+" {
				setDirty(c)
				c.WriteError(msgInvalidStreamID)
				return
			}
		}
		if strings.HasPrefix(opts.endKey, "(") {
			opts.endExclusive = true
			opts.endKey = opts.endKey[1:]
			if opts.endKey == "-" || opts.endKey == "+" {
				setDirty(c)
				c.WriteError(msgInvalidStreamID)
				return
			}
		}

		countArg := "0"
		if len(args) == 5 {
			if strings.ToLower(args[3]) != "count" {
				setDirty(c)
				c.WriteError(msgSyntaxError)
				return
			}
			countArg = args[4]
		}

		withTx(m, c, func(c *server.Peer, ctx *connCtx) {
			start, err := formatStreamRangeBound(opts.startKey, true, reverse)
			if err != nil {
				c.WriteError(msgInvalidStreamID)
				return
			}
			end, err := formatStreamRangeBound(opts.endKey, false, reverse)
			if err != nil {
				c.WriteError(msgInvalidStreamID)
				return
			}
			count, err := strconv.Atoi(countArg)
			if err != nil {
				c.WriteError(msgInvalidInt)
				return
			}

			db := m.db(ctx.selectedDB)

			if !db.exists(opts.key) {
				c.WriteLen(0)
				return
			}

			if db.t(opts.key) != "stream" {
				c.WriteError(ErrWrongType.Error())
				return
			}

			var entries = db.streamKeys[opts.key].entries
			if reverse {
				entries = reversedStreamEntries(entries)
			}
			if count == 0 {
				count = len(entries)
			}

			var returnedEntries []StreamEntry
			for _, entry := range entries {
				if len(returnedEntries) == count {
					break
				}

				if !reverse {
					// Break if entry ID > end
					if streamCmp(entry.ID, end) == 1 {
						break
					}

					// Continue if entry ID < start
					if streamCmp(entry.ID, start) == -1 {
						continue
					}
				} else {
					// Break if entry iD < end
					if streamCmp(entry.ID, end) == -1 {
						break
					}

					// Continue if entry ID > start.
					if streamCmp(entry.ID, start) == 1 {
						continue
					}
				}

				// Continue if start exclusive and entry ID == start
				if opts.startExclusive && streamCmp(entry.ID, start) == 0 {
					continue
				}
				// Continue if end exclusive and entry ID == end
				if opts.endExclusive && streamCmp(entry.ID, end) == 0 {
					continue
				}

				returnedEntries = append(returnedEntries, entry)
			}

			c.WriteLen(len(returnedEntries))
			for _, entry := range returnedEntries {
				c.WriteLen(2)
				c.WriteBulk(entry.ID)
				c.WriteLen(len(entry.Values))
				for _, v := range entry.Values {
					c.WriteBulk(v)
				}
			}
		})
	}
}

// XGROUP
func (m *Miniredis) cmdXgroup(c *server.Peer, cmd string, args []string) {
	if len(args) == 0 {
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

	subCmd, args := strings.ToLower(args[0]), args[1:]
	switch subCmd {
	case "create":
		m.cmdXgroupCreate(c, cmd, args)
	case "destroy":
		m.cmdXgroupDestroy(c, cmd, args)
	case "createconsumer":
		m.cmdXgroupCreateconsumer(c, cmd, args)
	case "delconsumer":
		m.cmdXgroupDelconsumer(c, cmd, args)
	case "help",
		"setid":
		err := fmt.Sprintf("ERR 'XGROUP %s' not supported", subCmd)
		setDirty(c)
		c.WriteError(err)
	default:
		setDirty(c)
		c.WriteError(fmt.Sprintf(
			"ERR unknown subcommand '%s'. Try XGROUP HELP.",
			subCmd,
		))
	}
}

// XGROUP CREATE
func (m *Miniredis) cmdXgroupCreate(c *server.Peer, cmd string, args []string) {
	if len(args) != 3 && len(args) != 4 {
		setDirty(c)
		c.WriteError(errWrongNumber("CREATE"))
		return
	}
	stream, group, id := args[0], args[1], args[2]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		s, err := db.stream(stream)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		if s == nil && len(args) == 4 && strings.ToUpper(args[3]) == "MKSTREAM" {
			if s, err = db.newStream(stream); err != nil {
				c.WriteError(err.Error())
				return
			}
		}
		if s == nil {
			c.WriteError(msgXgroupKeyNotFound)
			return
		}

		if err := s.createGroup(group, id); err != nil {
			c.WriteError(err.Error())
			return
		}

		c.WriteOK()
	})
}

// XGROUP DESTROY
func (m *Miniredis) cmdXgroupDestroy(c *server.Peer, cmd string, args []string) {
	if len(args) != 2 {
		setDirty(c)
		c.WriteError(errWrongNumber("DESTROY"))
		return
	}
	stream, groupName := args[0], args[1]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		s, err := db.stream(stream)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		if s == nil {
			c.WriteError(msgXgroupKeyNotFound)
			return
		}

		if _, ok := s.groups[groupName]; !ok {
			c.WriteInt(0)
			return
		}
		delete(s.groups, groupName)
		c.WriteInt(1)
	})
}

// XGROUP CREATECONSUMER
func (m *Miniredis) cmdXgroupCreateconsumer(c *server.Peer, cmd string, args []string) {
	if len(args) != 3 {
		setDirty(c)
		c.WriteError(errWrongNumber("CREATECONSUMER"))
		return
	}
	key, groupName, consumerName := args[0], args[1], args[2]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		s, err := db.stream(key)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		if s == nil {
			c.WriteError(msgXgroupKeyNotFound)
			return
		}

		g, ok := s.groups[groupName]
		if !ok {
			err := fmt.Sprintf("NOGROUP No such consumer group '%s' for key name '%s'", groupName, key)
			c.WriteError(err)
			return
		}

		if _, ok = g.consumers[consumerName]; ok {
			c.WriteInt(0)
			return
		}
		g.consumers[consumerName] = &consumer{}
		c.WriteInt(1)
	})
}

// XGROUP DELCONSUMER
func (m *Miniredis) cmdXgroupDelconsumer(c *server.Peer, cmd string, args []string) {
	if len(args) != 3 {
		setDirty(c)
		c.WriteError(errWrongNumber("DELCONSUMER"))
		return
	}
	key, groupName, consumerName := args[0], args[1], args[2]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		s, err := db.stream(key)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		if s == nil {
			c.WriteError(msgXgroupKeyNotFound)
			return
		}

		g, ok := s.groups[groupName]
		if !ok {
			err := fmt.Sprintf("NOGROUP No such consumer group '%s' for key name '%s'", groupName, key)
			c.WriteError(err)
			return
		}

		consumer, ok := g.consumers[consumerName]
		if !ok {
			c.WriteInt(0)
			return
		}
		defer delete(g.consumers, consumerName)

		if consumer.numPendingEntries > 0 {
			newPending := make([]pendingEntry, 0)
			for _, entry := range g.pending {
				if entry.consumer != consumerName {
					newPending = append(newPending, entry)
				}
			}
			g.pending = newPending
		}
		c.WriteInt(consumer.numPendingEntries)
	})
}

// XINFO
func (m *Miniredis) cmdXinfo(c *server.Peer, cmd string, args []string) {
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

	subCmd, args := strings.ToUpper(args[0]), args[1:]
	switch subCmd {
	case "STREAM":
		m.cmdXinfoStream(c, args)
	case "CONSUMERS":
		m.cmdXinfoConsumers(c, args)
	case "GROUPS":
		m.cmdXinfoGroups(c, args)
	case "HELP":
		err := fmt.Sprintf("'XINFO %s' not supported", strings.Join(args, " "))
		setDirty(c)
		c.WriteError(err)
	default:
		setDirty(c)
		c.WriteError(fmt.Sprintf(
			"ERR unknown subcommand or wrong number of arguments for '%s'. Try XINFO HELP.",
			subCmd,
		))
	}
}

// XINFO STREAM
// Produces only part of full command output
func (m *Miniredis) cmdXinfoStream(c *server.Peer, args []string) {
	if len(args) < 1 {
		setDirty(c)
		c.WriteError(errWrongNumber("STREAM"))
		return
	}
	key := args[0]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		s, err := db.stream(key)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		if s == nil {
			c.WriteError(msgKeyNotFound)
			return
		}

		c.WriteMapLen(1)
		c.WriteBulk("length")
		c.WriteInt(len(s.entries))
	})
}

// XINFO GROUPS
func (m *Miniredis) cmdXinfoGroups(c *server.Peer, args []string) {
	if len(args) != 1 {
		setDirty(c)
		c.WriteError(errWrongNumber("GROUPS"))
		return
	}
	key := args[0]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		s, err := db.stream(key)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		if s == nil {
			c.WriteError(msgKeyNotFound)
			return
		}

		c.WriteLen(len(s.groups))
		for name, g := range s.groups {
			c.WriteMapLen(6)

			c.WriteBulk("name")
			c.WriteBulk(name)
			c.WriteBulk("consumers")
			c.WriteInt(len(g.consumers))
			c.WriteBulk("pending")
			c.WriteInt(len(g.activePending()))
			c.WriteBulk("last-delivered-id")
			c.WriteBulk(g.lastID)
			c.WriteBulk("entries-read")
			c.WriteNull()
			c.WriteBulk("lag")
			c.WriteInt(len(g.stream.entries))
		}
	})
}

// XINFO CONSUMERS
// Please note that this is only a partial implementation, for it does not
// return each consumer's "idle" value, which indicates "the number of
// milliseconds that have passed since the consumer last interacted with the
// server."
func (m *Miniredis) cmdXinfoConsumers(c *server.Peer, args []string) {
	if len(args) != 2 {
		setDirty(c)
		c.WriteError(errWrongNumber("CONSUMERS"))
		return
	}
	key, groupName := args[0], args[1]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		s, err := db.stream(key)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		if s == nil {
			c.WriteError(msgKeyNotFound)
			return
		}

		g, ok := s.groups[groupName]
		if !ok {
			err := fmt.Sprintf("NOGROUP No such consumer group '%s' for key name '%s'", groupName, key)
			c.WriteError(err)
			return
		}

		var consumerNames []string
		for name := range g.consumers {
			consumerNames = append(consumerNames, name)
		}
		sort.Strings(consumerNames)

		c.WriteLen(len(consumerNames))
		for _, name := range consumerNames {
			cons := g.consumers[name]

			c.WriteMapLen(4)
			c.WriteBulk("name")
			c.WriteBulk(name)
			c.WriteBulk("pending")
			c.WriteInt(cons.numPendingEntries)
			// TODO: these times aren't set for all commands
			c.WriteBulk("idle")
			c.WriteInt(m.sinceMilli(cons.lastSeen))
			c.WriteBulk("inactive")
			c.WriteInt(m.sinceMilli(cons.lastSuccess))
		}
	})
}

func (m *Miniredis) sinceMilli(t time.Time) int {
	if t.IsZero() {
		return -1
	}
	return int(m.effectiveNow().Sub(t).Milliseconds())
}

// XREADGROUP
func (m *Miniredis) cmdXreadgroup(c *server.Peer, cmd string, args []string) {
	// XREADGROUP GROUP group consumer STREAMS key ID
	if len(args) < 6 {
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
		group        string
		consumer     string
		count        int
		noack        bool
		streams      []string
		ids          []string
		block        bool
		blockTimeout time.Duration
	}

	if strings.ToUpper(args[0]) != "GROUP" {
		setDirty(c)
		c.WriteError(msgSyntaxError)
		return
	}

	opts.group, opts.consumer, args = args[1], args[2], args[3:]

	var err error
parsing:
	for len(args) > 0 {
		switch strings.ToUpper(args[0]) {
		case "COUNT":
			if len(args) < 2 {
				err = errors.New(errWrongNumber(cmd))
				break parsing
			}

			opts.count, err = strconv.Atoi(args[1])
			if err != nil {
				break parsing
			}

			args = args[2:]
		case "BLOCK":
			err = parseBlock(cmd, args, &opts.block, &opts.blockTimeout)
			if err != nil {
				break parsing
			}
			args = args[2:]
		case "NOACK":
			args = args[1:]
			opts.noack = true
		case "STREAMS":
			args = args[1:]

			if len(args)%2 != 0 {
				err = errors.New(msgXreadUnbalanced)
				break parsing
			}

			opts.streams, opts.ids = args[0:len(args)/2], args[len(args)/2:]
			break parsing
		default:
			err = fmt.Errorf("ERR incorrect argument %s", args[0])
			break parsing
		}
	}

	if err != nil {
		setDirty(c)
		c.WriteError(err.Error())
		return
	}

	if len(opts.streams) == 0 || len(opts.ids) == 0 {
		setDirty(c)
		c.WriteError(errWrongNumber(cmd))
		return
	}

	for _, id := range opts.ids {
		if id != `>` {
			opts.block = false
		}
	}

	if !opts.block {
		withTx(m, c, func(c *server.Peer, ctx *connCtx) {
			db := m.db(ctx.selectedDB)
			res, err := xreadgroup(
				db,
				opts.group,
				opts.consumer,
				opts.noack,
				opts.streams,
				opts.ids,
				opts.count,
				m.effectiveNow(),
			)
			if err != nil {
				c.WriteError(err.Error())
				return
			}
			writeXread(c, opts.streams, res)
		})
		return
	}

	blocking(
		m,
		c,
		opts.blockTimeout,
		func(c *server.Peer, ctx *connCtx) bool {
			if ctx.nested {
				setDirty(c)
				c.WriteError("ERR XREADGROUP command is not allowed with BLOCK option from scripts")
				return false
			}

			db := m.db(ctx.selectedDB)
			res, err := xreadgroup(
				db,
				opts.group,
				opts.consumer,
				opts.noack,
				opts.streams,
				opts.ids,
				opts.count,
				m.effectiveNow(),
			)
			if err != nil {
				c.WriteError(err.Error())
				return true
			}
			if len(res) == 0 {
				return false
			}
			writeXread(c, opts.streams, res)
			return true
		},
		func(c *server.Peer) { // timeout
			c.WriteLen(-1)
		},
	)
}

func xreadgroup(
	db *RedisDB,
	group,
	consumer string,
	noack bool,
	streams []string,
	ids []string,
	count int,
	now time.Time,
) (map[string][]StreamEntry, error) {
	res := map[string][]StreamEntry{}
	for i, key := range streams {
		id := ids[i]

		g, err := db.streamGroup(key, group)
		if err != nil {
			return nil, err
		}
		if g == nil {
			return nil, errXreadgroup(key, group)
		}

		if _, err := parseStreamID(id); id != `>` && err != nil {
			return nil, err
		}
		entries := g.readGroup(now, consumer, id, count, noack)
		if id == `>` && len(entries) == 0 {
			continue
		}

		res[key] = entries
	}
	return res, nil
}

// XACK
func (m *Miniredis) cmdXack(c *server.Peer, cmd string, args []string) {
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

	key, group, ids := args[0], args[1], args[2:]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)
		g, err := db.streamGroup(key, group)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		if g == nil {
			c.WriteInt(0)
			return
		}

		cnt, err := g.ack(ids)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		c.WriteInt(cnt)
	})
}

// XDEL
func (m *Miniredis) cmdXdel(c *server.Peer, cmd string, args []string) {
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

	stream, ids := args[0], args[1:]

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)
		s, err := db.stream(stream)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		if s == nil {
			c.WriteInt(0)
			return
		}

		n, err := s.delete(ids)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		db.incr(stream)
		c.WriteInt(n)
	})
}

// XREAD
func (m *Miniredis) cmdXread(c *server.Peer, cmd string, args []string) {
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

	var (
		opts struct {
			count        int
			streams      []string
			ids          []string
			block        bool
			blockTimeout time.Duration
		}
		err error
	)

parsing:
	for len(args) > 0 {
		switch strings.ToUpper(args[0]) {
		case "COUNT":
			if len(args) < 2 {
				err = errors.New(errWrongNumber(cmd))
				break parsing
			}

			opts.count, err = strconv.Atoi(args[1])
			if err != nil {
				break parsing
			}
			args = args[2:]
		case "BLOCK":
			err = parseBlock(cmd, args, &opts.block, &opts.blockTimeout)
			if err != nil {
				break parsing
			}
			args = args[2:]
		case "STREAMS":
			args = args[1:]

			if len(args)%2 != 0 {
				err = errors.New(msgXreadUnbalanced)
				break parsing
			}

			opts.streams, opts.ids = args[0:len(args)/2], args[len(args)/2:]
			for i, id := range opts.ids {
				if _, err := parseStreamID(id); id != `$` && err != nil {
					setDirty(c)
					c.WriteError(msgInvalidStreamID)
					return
				} else if id == "$" {
					withTx(m, c, func(c *server.Peer, ctx *connCtx) {
						db := m.db(getCtx(c).selectedDB)
						stream, ok := db.streamKeys[opts.streams[i]]
						if ok {
							opts.ids[i] = stream.lastID()
						} else {
							opts.ids[i] = "0-0"
						}
					})
				}
			}
			args = nil
			break parsing
		default:
			err = fmt.Errorf("ERR incorrect argument %s", args[0])
			break parsing
		}
	}
	if err != nil {
		setDirty(c)
		c.WriteError(err.Error())
		return
	}

	if !opts.block {
		withTx(m, c, func(c *server.Peer, ctx *connCtx) {
			db := m.db(ctx.selectedDB)
			res := xread(db, opts.streams, opts.ids, opts.count)
			writeXread(c, opts.streams, res)
		})
		return
	}
	blocking(
		m,
		c,
		opts.blockTimeout,
		func(c *server.Peer, ctx *connCtx) bool {
			if ctx.nested {
				setDirty(c)
				c.WriteError("ERR XREAD command is not allowed with BLOCK option from scripts")
				return false
			}

			db := m.db(ctx.selectedDB)
			res := xread(db, opts.streams, opts.ids, opts.count)
			if len(res) == 0 {
				return false
			}
			writeXread(c, opts.streams, res)
			return true
		},
		func(c *server.Peer) { // timeout
			c.WriteLen(-1)
		},
	)
}

func xread(db *RedisDB, streams []string, ids []string, count int) map[string][]StreamEntry {
	res := map[string][]StreamEntry{}
	for i := range streams {
		stream := streams[i]
		id := ids[i]

		var s, ok = db.streamKeys[stream]
		if !ok {
			continue
		}
		entries := s.entries
		if len(entries) == 0 {
			continue
		}

		entryCount := count
		if entryCount == 0 {
			entryCount = len(entries)
		}

		var returnedEntries []StreamEntry
		for _, entry := range entries {
			if len(returnedEntries) == entryCount {
				break
			}
			if id == "$" {
				id = s.lastID()
			}
			if streamCmp(entry.ID, id) <= 0 {
				continue
			}
			returnedEntries = append(returnedEntries, entry)
		}
		if len(returnedEntries) > 0 {
			res[stream] = returnedEntries
		}
	}
	return res
}

func writeXread(c *server.Peer, streams []string, res map[string][]StreamEntry) {
	if len(res) == 0 {
		c.WriteLen(-1)
		return
	}
	c.WriteLen(len(res))
	for _, stream := range streams {
		entries, ok := res[stream]
		if !ok {
			continue
		}
		c.WriteLen(2)
		c.WriteBulk(stream)
		c.WriteLen(len(entries))
		for _, entry := range entries {
			c.WriteLen(2)
			c.WriteBulk(entry.ID)
			c.WriteLen(len(entry.Values))
			for _, v := range entry.Values {
				c.WriteBulk(v)
			}
		}
	}
}

// XPENDING
func (m *Miniredis) cmdXpending(c *server.Peer, cmd string, args []string) {
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
		key        string
		group      string
		summary    bool
		idle       time.Duration
		start, end string
		count      int
		consumer   *string
	}

	opts.key, opts.group, args = args[0], args[1], args[2:]
	opts.summary = true
	if len(args) >= 3 {
		opts.summary = false

		if strings.ToUpper(args[0]) == "IDLE" {
			idleMs, err := strconv.ParseInt(args[1], 10, 64)
			if err != nil {
				setDirty(c)
				c.WriteError(msgInvalidInt)
				return
			}
			opts.idle = time.Duration(idleMs) * time.Millisecond

			args = args[2:]
			if len(args) < 3 {
				setDirty(c)
				c.WriteError(msgSyntaxError)
				return
			}
		}

		var err error
		opts.start, err = formatStreamRangeBound(args[0], true, false)
		if err != nil {
			setDirty(c)
			c.WriteError(msgInvalidStreamID)
			return
		}
		opts.end, err = formatStreamRangeBound(args[1], false, false)
		if err != nil {
			setDirty(c)
			c.WriteError(msgInvalidStreamID)
			return
		}
		opts.count, err = strconv.Atoi(args[2]) // negative is allowed
		if err != nil {
			setDirty(c)
			c.WriteError(msgInvalidInt)
			return
		}
		args = args[3:]

		if len(args) == 1 {
			opts.consumer, args = &args[0], args[1:]
		}
	}
	if len(args) != 0 {
		setDirty(c)
		c.WriteError(msgSyntaxError)
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)
		g, err := db.streamGroup(opts.key, opts.group)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		if g == nil {
			c.WriteError(errReadgroup(opts.key, opts.group).Error())
			return
		}

		if opts.summary {
			writeXpendingSummary(c, *g)
			return
		}
		writeXpending(m.effectiveNow(), c, *g, opts.idle, opts.start, opts.end, opts.count, opts.consumer)
	})
}

func writeXpendingSummary(c *server.Peer, g streamGroup) {
	pend := g.activePending()
	if len(pend) == 0 {
		c.WriteLen(4)
		c.WriteInt(0)
		c.WriteNull()
		c.WriteNull()
		c.WriteLen(-1)
		return
	}

	// format:
	//  - number of pending
	//  - smallest ID
	//  - highest ID
	//  - all consumers with > 0 pending items
	c.WriteLen(4)
	c.WriteInt(len(pend))
	c.WriteBulk(pend[0].id)
	c.WriteBulk(pend[len(pend)-1].id)
	cons := map[string]int{}
	for id := range g.consumers {
		cnt := g.pendingCount(id)
		if cnt > 0 {
			cons[id] = cnt
		}
	}
	c.WriteLen(len(cons))
	var ids []string
	for id := range cons {
		ids = append(ids, id)
	}
	sort.Strings(ids) // be predicatable
	for _, id := range ids {
		c.WriteLen(2)
		c.WriteBulk(id)
		c.WriteBulk(strconv.Itoa(cons[id]))
	}
}

func writeXpending(
	now time.Time,
	c *server.Peer,
	g streamGroup,
	idle time.Duration,
	start,
	end string,
	count int,
	consumer *string,
) {
	if len(g.pending) == 0 || count < 0 {
		c.WriteLen(-1)
		return
	}

	// format, list of:
	//  - message ID
	//  - consumer
	//  - milliseconds since delivery
	//  - delivery count
	type entry struct {
		id       string
		consumer string
		millis   int
		count    int
	}
	var res []entry
	for _, p := range g.pending {
		if len(res) >= count {
			break
		}
		if consumer != nil && p.consumer != *consumer {
			continue
		}
		if streamCmp(p.id, start) < 0 {
			continue
		}
		if streamCmp(p.id, end) > 0 {
			continue
		}
		timeSinceLastDelivery := now.Sub(p.lastDelivery)
		if timeSinceLastDelivery >= idle {
			res = append(res, entry{
				id:       p.id,
				consumer: p.consumer,
				millis:   int(timeSinceLastDelivery.Milliseconds()),
				count:    p.deliveryCount,
			})
		}
	}
	if len(res) == 0 {
		c.WriteLen(-1)
		return
	}
	c.WriteLen(len(res))
	for _, e := range res {
		c.WriteLen(4)
		c.WriteBulk(e.id)
		c.WriteBulk(e.consumer)
		c.WriteInt(e.millis)
		c.WriteInt(e.count)
	}
}

// XTRIM
func (m *Miniredis) cmdXtrim(c *server.Peer, cmd string, args []string) {
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
		stream     string
		strategy   string
		maxLen     int    // for MAXLEN
		threshold  string // for MINID
		withLimit  bool   // "LIMIT"
		withExact  bool   // "="
		withNearly bool   // "~"
	}

	opts.stream, opts.strategy, args = args[0], strings.ToUpper(args[1]), args[2:]

	if opts.strategy != "MAXLEN" && opts.strategy != "MINID" {
		setDirty(c)
		c.WriteError(msgXtrimInvalidStrategy)
		return
	}

	// Ignore nearly exact trimming parameters.
	switch args[0] {
	case "=":
		opts.withExact = true
		args = args[1:]
	case "~":
		opts.withNearly = true
		args = args[1:]
	}

	switch opts.strategy {
	case "MAXLEN":
		maxLen, err := strconv.Atoi(args[0])
		if err != nil {
			setDirty(c)
			c.WriteError(msgXtrimInvalidMaxLen)
			return
		}
		opts.maxLen = maxLen
	case "MINID":
		opts.threshold = args[0]
	}
	args = args[1:]

	if len(args) == 2 && strings.ToUpper(args[0]) == "LIMIT" {
		// Ignore LIMIT.
		opts.withLimit = true
		if _, err := strconv.Atoi(args[1]); err != nil {
			setDirty(c)
			c.WriteError(msgInvalidInt)
			return
		}

		args = args[2:]
	}

	if len(args) != 0 {
		setDirty(c)
		c.WriteError(fmt.Sprintf("ERR incorrect argument %s", args[0]))
		return
	}

	if opts.withLimit && !opts.withNearly {
		setDirty(c)
		c.WriteError(fmt.Sprintf(msgXtrimInvalidLimit))
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)
		s, err := db.stream(opts.stream)
		if err != nil {
			setDirty(c)
			c.WriteError(err.Error())
			return
		}
		if s == nil {
			c.WriteInt(0)
			return
		}

		switch opts.strategy {
		case "MAXLEN":
			entriesBefore := len(s.entries)
			s.trim(opts.maxLen)
			c.WriteInt(entriesBefore - len(s.entries))
		case "MINID":
			n := s.trimBefore(opts.threshold)
			c.WriteInt(n)
		}
	})
}

// XAUTOCLAIM
func (m *Miniredis) cmdXautoclaim(c *server.Peer, cmd string, args []string) {
	// XAUTOCLAIM key group consumer min-idle-time start
	if len(args) < 5 {
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
		key         string
		group       string
		consumer    string
		minIdleTime time.Duration
		start       string
		justId      bool
		count       int
	}

	opts.key, opts.group, opts.consumer = args[0], args[1], args[2]
	n, err := strconv.Atoi(args[3])
	if err != nil {
		setDirty(c)
		c.WriteError("ERR Invalid min-idle-time argument for XAUTOCLAIM")
		return
	}
	opts.minIdleTime = time.Millisecond * time.Duration(n)

	start_, err := formatStreamRangeBound(args[4], true, false)
	if err != nil {
		c.WriteError(msgInvalidStreamID)
		return
	}
	opts.start = start_

	args = args[5:]

	opts.count = 100
parsing:
	for len(args) > 0 {
		switch strings.ToUpper(args[0]) {
		case "COUNT":
			if len(args) < 2 {
				err = errors.New(errWrongNumber(cmd))
				break parsing
			}

			opts.count, err = strconv.Atoi(args[1])
			if err != nil {
				break parsing
			}

			args = args[2:]
		case "JUSTID":
			args = args[1:]
			opts.justId = true
		default:
			err = errors.New(msgSyntaxError)
			break parsing
		}
	}

	if err != nil {
		setDirty(c)
		c.WriteError(err.Error())
		return
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)
		g, err := db.streamGroup(opts.key, opts.group)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		if g == nil {
			c.WriteError(errReadgroup(opts.key, opts.group).Error())
			return
		}

		nextCallId, entries := xautoclaim(m.effectiveNow(), *g, opts.minIdleTime, opts.start, opts.count, opts.consumer)
		writeXautoclaim(c, nextCallId, entries, opts.justId)
	})
}

func xautoclaim(
	now time.Time,
	g streamGroup,
	minIdleTime time.Duration,
	start string,
	count int,
	consumerID string,
) (string, []StreamEntry) {
	nextCallId := "0-0"
	if len(g.pending) == 0 || count < 0 {
		return nextCallId, nil
	}

	msgs := g.pendingAfter(start)
	var res []StreamEntry
	for i, p := range msgs {
		if minIdleTime > 0 && now.Before(p.lastDelivery.Add(minIdleTime)) {
			continue
		}

		prevConsumerID := p.consumer
		if _, ok := g.consumers[consumerID]; !ok {
			g.consumers[consumerID] = &consumer{}
		}
		p.consumer = consumerID

		_, entry := g.stream.get(p.id)
		// not found. Weird?
		if entry == nil {
			// TODO: support third element of return from XAUTOCLAIM, which
			// should delete entries not found in the PEL during XAUTOCLAIM.
			// (Introduced in Redis 7.0)
			continue
		}

		p.deliveryCount += 1
		p.lastDelivery = now

		g.consumers[prevConsumerID].numPendingEntries--
		g.consumers[consumerID].numPendingEntries++

		msgs[i] = p
		res = append(res, *entry)

		if len(res) >= count {
			if len(msgs) > i+1 {
				nextCallId = msgs[i+1].id
			}
			break
		}
	}
	return nextCallId, res
}

func writeXautoclaim(c *server.Peer, nextCallId string, res []StreamEntry, justId bool) {
	c.WriteLen(3)
	c.WriteBulk(nextCallId)
	c.WriteLen(len(res))
	for _, entry := range res {
		if justId {
			c.WriteBulk(entry.ID)
			continue
		}

		c.WriteLen(2)
		c.WriteBulk(entry.ID)
		c.WriteLen(len(entry.Values))
		for _, v := range entry.Values {
			c.WriteBulk(v)
		}
	}
	// TODO: see "Redis 7" note
	c.WriteLen(0)
}

// XCLAIM
func (m *Miniredis) cmdXclaim(c *server.Peer, cmd string, args []string) {
	if len(args) < 5 {
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
		key             string
		groupName       string
		consumerName    string
		minIdleTime     time.Duration
		newLastDelivery time.Time
		ids             []string
		retryCount      *int
		force           bool
		justId          bool
	}

	opts.key, opts.groupName, opts.consumerName = args[0], args[1], args[2]

	minIdleTimeMillis, err := strconv.Atoi(args[3])
	if err != nil {
		setDirty(c)
		c.WriteError("ERR Invalid min-idle-time argument for XCLAIM")
		return
	}
	opts.minIdleTime = time.Millisecond * time.Duration(minIdleTimeMillis)

	opts.newLastDelivery = m.effectiveNow()
	opts.ids = append(opts.ids, args[4])

	args = args[5:]
	for len(args) > 0 {
		arg := strings.ToUpper(args[0])
		if arg == "IDLE" ||
			arg == "TIME" ||
			arg == "RETRYCOUNT" ||
			arg == "FORCE" ||
			arg == "JUSTID" {
			break
		}
		opts.ids = append(opts.ids, arg)
		args = args[1:]
	}

	for len(args) > 0 {
		arg := strings.ToUpper(args[0])
		switch arg {
		case "IDLE":
			idleMs, err := strconv.ParseInt(args[1], 10, 64)
			if err != nil {
				setDirty(c)
				c.WriteError("ERR Invalid IDLE option argument for XCLAIM")
				return
			}
			if idleMs < 0 {
				idleMs = 0
			}
			opts.newLastDelivery = m.effectiveNow().Add(time.Millisecond * time.Duration(-idleMs))
			args = args[2:]
		case "TIME":
			timeMs, err := strconv.ParseInt(args[1], 10, 64)
			if err != nil {
				setDirty(c)
				c.WriteError("ERR Invalid TIME option argument for XCLAIM")
				return
			}
			opts.newLastDelivery = time.UnixMilli(timeMs)
			args = args[2:]
		case "RETRYCOUNT":
			retryCount, err := strconv.Atoi(args[1])
			if err != nil {
				setDirty(c)
				c.WriteError("ERR Invalid RETRYCOUNT option argument for XCLAIM")
				return
			}
			opts.retryCount = &retryCount
			args = args[2:]
		case "FORCE":
			opts.force = true
			args = args[1:]
		case "JUSTID":
			opts.justId = true
			args = args[1:]
		default:
			setDirty(c)
			c.WriteError(fmt.Sprintf("ERR Unrecognized XCLAIM option '%s'", args[0]))
			return
		}
	}

	withTx(m, c, func(c *server.Peer, ctx *connCtx) {
		db := m.db(ctx.selectedDB)

		g, err := db.streamGroup(opts.key, opts.groupName)
		if err != nil {
			c.WriteError(err.Error())
			return
		}
		if g == nil {
			c.WriteError(errReadgroup(opts.key, opts.groupName).Error())
			return
		}

		claimedEntryIDs := m.xclaim(g, opts.consumerName, opts.minIdleTime, opts.newLastDelivery, opts.ids, opts.retryCount, opts.force)
		writeXclaim(c, g.stream, claimedEntryIDs, opts.justId)
	})
}

func (m *Miniredis) xclaim(
	group *streamGroup,
	consumerName string,
	minIdleTime time.Duration,
	newLastDelivery time.Time,
	ids []string,
	retryCount *int,
	force bool,
) (claimedEntryIDs []string) {
	for _, id := range ids {
		pelPos, pelEntry := group.searchPending(id)
		if pelEntry == nil {
			group.setLastSeen(consumerName, m.effectiveNow())
			if !force {
				continue
			}

			if pelPos < len(group.pending) {
				group.pending = append(group.pending[:pelPos+1], group.pending[pelPos:]...)
			} else {
				group.pending = append(group.pending, pendingEntry{})
			}
			pelEntry = &group.pending[pelPos]

			*pelEntry = pendingEntry{
				id:            id,
				consumer:      consumerName,
				deliveryCount: 1,
			}
			group.setLastSuccess(consumerName, m.effectiveNow())
		} else {
			group.consumers[pelEntry.consumer].numPendingEntries--
			pelEntry.consumer = consumerName
		}

		if retryCount != nil {
			pelEntry.deliveryCount = *retryCount
		} else {
			pelEntry.deliveryCount++
		}
		pelEntry.lastDelivery = newLastDelivery

		// redis7: don't report entries which are deleted by now
		if _, e := group.stream.get(id); e == nil {
			continue
		}

		claimedEntryIDs = append(claimedEntryIDs, id)
	}
	if len(claimedEntryIDs) == 0 {
		group.setLastSeen(consumerName, m.effectiveNow())
		return
	}

	if _, ok := group.consumers[consumerName]; !ok {
		group.consumers[consumerName] = &consumer{}
	}
	consumer := group.consumers[consumerName]
	consumer.numPendingEntries += len(claimedEntryIDs)

	group.setLastSuccess(consumerName, m.effectiveNow())
	return
}

func writeXclaim(c *server.Peer, stream *streamKey, claimedEntryIDs []string, justId bool) {
	c.WriteLen(len(claimedEntryIDs))
	for _, id := range claimedEntryIDs {
		if justId {
			c.WriteBulk(id)
			continue
		}

		_, entry := stream.get(id)
		if entry == nil {
			c.WriteNull()
			continue
		}

		c.WriteLen(2)
		c.WriteBulk(entry.ID)
		c.WriteStrings(entry.Values)
	}
}

func parseBlock(cmd string, args []string, block *bool, timeout *time.Duration) error {
	if len(args) < 2 {
		return errors.New(errWrongNumber(cmd))
	}
	(*block) = true
	ms, err := strconv.Atoi(args[1])
	if err != nil {
		return errors.New(msgInvalidInt)
	}
	if ms < 0 {
		return errors.New("ERR timeout is negative")
	}
	(*timeout) = time.Millisecond * time.Duration(ms)
	return nil
}
