package redis

import (
	"context"
	"time"
)

type StreamCmdable interface {
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
	XGroupCreateConsumer(ctx context.Context, stream, group, consumer string) *IntCmd
	XGroupDelConsumer(ctx context.Context, stream, group, consumer string) *IntCmd
	XReadGroup(ctx context.Context, a *XReadGroupArgs) *XStreamSliceCmd
	XAck(ctx context.Context, stream, group string, ids ...string) *IntCmd
	XPending(ctx context.Context, stream, group string) *XPendingCmd
	XPendingExt(ctx context.Context, a *XPendingExtArgs) *XPendingExtCmd
	XClaim(ctx context.Context, a *XClaimArgs) *XMessageSliceCmd
	XClaimJustID(ctx context.Context, a *XClaimArgs) *StringSliceCmd
	XAutoClaim(ctx context.Context, a *XAutoClaimArgs) *XAutoClaimCmd
	XAutoClaimJustID(ctx context.Context, a *XAutoClaimArgs) *XAutoClaimJustIDCmd
	XTrimMaxLen(ctx context.Context, key string, maxLen int64) *IntCmd
	XTrimMaxLenApprox(ctx context.Context, key string, maxLen, limit int64) *IntCmd
	XTrimMinID(ctx context.Context, key string, minID string) *IntCmd
	XTrimMinIDApprox(ctx context.Context, key string, minID string, limit int64) *IntCmd
	XInfoGroups(ctx context.Context, key string) *XInfoGroupsCmd
	XInfoStream(ctx context.Context, key string) *XInfoStreamCmd
	XInfoStreamFull(ctx context.Context, key string, count int) *XInfoStreamFullCmd
	XInfoConsumers(ctx context.Context, key string, group string) *XInfoConsumersCmd
}

// XAddArgs accepts values in the following formats:
//   - XAddArgs.Values = []interface{}{"key1", "value1", "key2", "value2"}
//   - XAddArgs.Values = []string("key1", "value1", "key2", "value2")
//   - XAddArgs.Values = map[string]interface{}{"key1": "value1", "key2": "value2"}
//
// Note that map will not preserve the order of key-value pairs.
// MaxLen/MaxLenApprox and MinID are in conflict, only one of them can be used.
type XAddArgs struct {
	Stream     string
	NoMkStream bool
	MaxLen     int64 // MAXLEN N
	MinID      string
	// Approx causes MaxLen and MinID to use "~" matcher (instead of "=").
	Approx bool
	Limit  int64
	ID     string
	Values interface{}
}

func (c cmdable) XAdd(ctx context.Context, a *XAddArgs) *StringCmd {
	args := make([]interface{}, 0, 11)
	args = append(args, "xadd", a.Stream)
	if a.NoMkStream {
		args = append(args, "nomkstream")
	}
	switch {
	case a.MaxLen > 0:
		if a.Approx {
			args = append(args, "maxlen", "~", a.MaxLen)
		} else {
			args = append(args, "maxlen", a.MaxLen)
		}
	case a.MinID != "":
		if a.Approx {
			args = append(args, "minid", "~", a.MinID)
		} else {
			args = append(args, "minid", a.MinID)
		}
	}
	if a.Limit > 0 {
		args = append(args, "limit", a.Limit)
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
	ID      string
}

func (c cmdable) XRead(ctx context.Context, a *XReadArgs) *XStreamSliceCmd {
	args := make([]interface{}, 0, 2*len(a.Streams)+6)
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
	if a.ID != "" {
		for range a.Streams {
			args = append(args, a.ID)
		}
	}

	cmd := NewXStreamSliceCmd(ctx, args...)
	if a.Block >= 0 {
		cmd.setReadTimeout(a.Block)
	}
	cmd.SetFirstKeyPos(keyPos)
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
	cmd.SetFirstKeyPos(2)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XGroupCreateMkStream(ctx context.Context, stream, group, start string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "xgroup", "create", stream, group, start, "mkstream")
	cmd.SetFirstKeyPos(2)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XGroupSetID(ctx context.Context, stream, group, start string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "xgroup", "setid", stream, group, start)
	cmd.SetFirstKeyPos(2)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XGroupDestroy(ctx context.Context, stream, group string) *IntCmd {
	cmd := NewIntCmd(ctx, "xgroup", "destroy", stream, group)
	cmd.SetFirstKeyPos(2)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XGroupCreateConsumer(ctx context.Context, stream, group, consumer string) *IntCmd {
	cmd := NewIntCmd(ctx, "xgroup", "createconsumer", stream, group, consumer)
	cmd.SetFirstKeyPos(2)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XGroupDelConsumer(ctx context.Context, stream, group, consumer string) *IntCmd {
	cmd := NewIntCmd(ctx, "xgroup", "delconsumer", stream, group, consumer)
	cmd.SetFirstKeyPos(2)
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
	args := make([]interface{}, 0, 10+len(a.Streams))
	args = append(args, "xreadgroup", "group", a.Group, a.Consumer)

	keyPos := int8(4)
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
	cmd.SetFirstKeyPos(keyPos)
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
	Idle     time.Duration
	Start    string
	End      string
	Count    int64
	Consumer string
}

func (c cmdable) XPendingExt(ctx context.Context, a *XPendingExtArgs) *XPendingExtCmd {
	args := make([]interface{}, 0, 9)
	args = append(args, "xpending", a.Stream, a.Group)
	if a.Idle != 0 {
		args = append(args, "idle", formatMs(ctx, a.Idle))
	}
	args = append(args, a.Start, a.End, a.Count)
	if a.Consumer != "" {
		args = append(args, a.Consumer)
	}
	cmd := NewXPendingExtCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

type XAutoClaimArgs struct {
	Stream   string
	Group    string
	MinIdle  time.Duration
	Start    string
	Count    int64
	Consumer string
}

func (c cmdable) XAutoClaim(ctx context.Context, a *XAutoClaimArgs) *XAutoClaimCmd {
	args := xAutoClaimArgs(ctx, a)
	cmd := NewXAutoClaimCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func (c cmdable) XAutoClaimJustID(ctx context.Context, a *XAutoClaimArgs) *XAutoClaimJustIDCmd {
	args := xAutoClaimArgs(ctx, a)
	args = append(args, "justid")
	cmd := NewXAutoClaimJustIDCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func xAutoClaimArgs(ctx context.Context, a *XAutoClaimArgs) []interface{} {
	args := make([]interface{}, 0, 8)
	args = append(args, "xautoclaim", a.Stream, a.Group, a.Consumer, formatMs(ctx, a.MinIdle), a.Start)
	if a.Count > 0 {
		args = append(args, "count", a.Count)
	}
	return args
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
	args := make([]interface{}, 0, 5+len(a.Messages))
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

// xTrim If approx is true, add the "~" parameter, otherwise it is the default "=" (redis default).
// example:
//
//	XTRIM key MAXLEN/MINID threshold LIMIT limit.
//	XTRIM key MAXLEN/MINID ~ threshold LIMIT limit.
//
// The redis-server version is lower than 6.2, please set limit to 0.
func (c cmdable) xTrim(
	ctx context.Context, key, strategy string,
	approx bool, threshold interface{}, limit int64,
) *IntCmd {
	args := make([]interface{}, 0, 7)
	args = append(args, "xtrim", key, strategy)
	if approx {
		args = append(args, "~")
	}
	args = append(args, threshold)
	if limit > 0 {
		args = append(args, "limit", limit)
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// XTrimMaxLen No `~` rules are used, `limit` cannot be used.
// cmd: XTRIM key MAXLEN maxLen
func (c cmdable) XTrimMaxLen(ctx context.Context, key string, maxLen int64) *IntCmd {
	return c.xTrim(ctx, key, "maxlen", false, maxLen, 0)
}

func (c cmdable) XTrimMaxLenApprox(ctx context.Context, key string, maxLen, limit int64) *IntCmd {
	return c.xTrim(ctx, key, "maxlen", true, maxLen, limit)
}

func (c cmdable) XTrimMinID(ctx context.Context, key string, minID string) *IntCmd {
	return c.xTrim(ctx, key, "minid", false, minID, 0)
}

func (c cmdable) XTrimMinIDApprox(ctx context.Context, key string, minID string, limit int64) *IntCmd {
	return c.xTrim(ctx, key, "minid", true, minID, limit)
}

func (c cmdable) XInfoConsumers(ctx context.Context, key string, group string) *XInfoConsumersCmd {
	cmd := NewXInfoConsumersCmd(ctx, key, group)
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

// XInfoStreamFull XINFO STREAM FULL [COUNT count]
// redis-server >= 6.0.
func (c cmdable) XInfoStreamFull(ctx context.Context, key string, count int) *XInfoStreamFullCmd {
	args := make([]interface{}, 0, 6)
	args = append(args, "xinfo", "stream", key, "full")
	if count > 0 {
		args = append(args, "count", count)
	}
	cmd := NewXInfoStreamFullCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}
