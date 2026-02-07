package miniredis

import (
	"context"
	"fmt"
	"math"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/alicebob/miniredis/v2/server"
)

const (
	msgWrongType            = "WRONGTYPE Operation against a key holding the wrong kind of value"
	msgNotValidHllValue     = "WRONGTYPE Key is not a valid HyperLogLog string value."
	msgInvalidInt           = "ERR value is not an integer or out of range"
	msgIntOverflow          = "ERR increment or decrement would overflow"
	msgInvalidFloat         = "ERR value is not a valid float"
	msgInvalidMinMax        = "ERR min or max is not a float"
	msgInvalidRangeItem     = "ERR min or max not valid string range item"
	msgInvalidTimeout       = "ERR timeout is not a float or out of range"
	msgInvalidRange         = "ERR value is out of range, must be positive"
	msgSyntaxError          = "ERR syntax error"
	msgKeyNotFound          = "ERR no such key"
	msgOutOfRange           = "ERR index out of range"
	msgInvalidCursor        = "ERR invalid cursor"
	msgXXandNX              = "ERR XX and NX options at the same time are not compatible"
	msgTimeoutNegative      = "ERR timeout is negative"
	msgTimeoutIsOutOfRange  = "ERR timeout is out of range"
	msgInvalidSETime        = "ERR invalid expire time in set"
	msgInvalidSETEXTime     = "ERR invalid expire time in setex"
	msgInvalidPSETEXTime    = "ERR invalid expire time in psetex"
	msgInvalidKeysNumber    = "ERR Number of keys can't be greater than number of args"
	msgNegativeKeysNumber   = "ERR Number of keys can't be negative"
	msgFScriptUsage         = "ERR unknown subcommand or wrong number of arguments for '%s'. Try SCRIPT HELP."
	msgFScriptUsageSimple   = "ERR unknown subcommand '%s'. Try SCRIPT HELP."
	msgFPubsubUsage         = "ERR unknown subcommand or wrong number of arguments for '%s'. Try PUBSUB HELP."
	msgFPubsubUsageSimple   = "ERR unknown subcommand '%s'. Try PUBSUB HELP."
	msgFObjectUsage         = "ERR unknown subcommand '%s'. Try OBJECT HELP."
	msgScriptFlush          = "ERR SCRIPT FLUSH only support SYNC|ASYNC option"
	msgSingleElementPair    = "ERR INCR option supports a single increment-element pair"
	msgGTLTandNX            = "ERR GT, LT, and/or NX options at the same time are not compatible"
	msgInvalidStreamID      = "ERR Invalid stream ID specified as stream command argument"
	msgStreamIDTooSmall     = "ERR The ID specified in XADD is equal or smaller than the target stream top item"
	msgStreamIDZero         = "ERR The ID specified in XADD must be greater than 0-0"
	msgNoScriptFound        = "NOSCRIPT No matching script. Please use EVAL."
	msgUnsupportedUnit      = "ERR unsupported unit provided. please use M, KM, FT, MI"
	msgXreadUnbalanced      = "ERR Unbalanced 'xread' list of streams: for each stream key an ID or '$' must be specified."
	msgXgroupKeyNotFound    = "ERR The XGROUP subcommand requires the key to exist. Note that for CREATE you may want to use the MKSTREAM option to create an empty stream automatically."
	msgXtrimInvalidStrategy = "ERR unsupported XTRIM strategy. Please use MAXLEN, MINID"
	msgXtrimInvalidMaxLen   = "ERR value is not an integer or out of range"
	msgXtrimInvalidLimit    = "ERR syntax error, LIMIT cannot be used without the special ~ option"
	msgDBIndexOutOfRange    = "ERR DB index is out of range"
	msgLimitCombination     = "ERR syntax error, LIMIT is only supported in combination with either BYSCORE or BYLEX"
	msgRankIsZero           = "ERR RANK can't be zero: use 1 to start from the first match, 2 from the second ... or use negative to start from the end of the list"
	msgCountIsNegative      = "ERR COUNT can't be negative"
	msgMaxLengthIsNegative  = "ERR MAXLEN can't be negative"
	msgLimitIsNegative      = "ERR LIMIT can't be negative"
	msgMemorySubcommand     = "ERR unknown subcommand '%s'. Try MEMORY HELP."
)

func errWrongNumber(cmd string) string {
	return fmt.Sprintf("ERR wrong number of arguments for '%s' command", strings.ToLower(cmd))
}

func errLuaParseError(err error) string {
	return fmt.Sprintf("ERR Error compiling script (new function): %s", err.Error())
}

func errReadgroup(key, group string) error {
	return fmt.Errorf("NOGROUP No such key '%s' or consumer group '%s'", key, group)
}

func errXreadgroup(key, group string) error {
	return fmt.Errorf("NOGROUP No such key '%s' or consumer group '%s' in XREADGROUP with GROUP option", key, group)
}

func msgNotFromScripts(sha string) string {
	return fmt.Sprintf("This Redis command is not allowed from script script: %s, &c", sha)
}

// withTx wraps the non-argument-checking part of command handling code in
// transaction logic.
func withTx(
	m *Miniredis,
	c *server.Peer,
	cb txCmd,
) {
	ctx := getCtx(c)

	if ctx.nested {
		// this is a call via Lua's .call(). It's already locked.
		cb(c, ctx)
		m.signal.Broadcast()
		return
	}

	if inTx(ctx) {
		addTxCmd(ctx, cb)
		c.WriteInline("QUEUED")
		return
	}
	m.Lock()
	cb(c, ctx)
	// done, wake up anyone who waits on anything.
	m.signal.Broadcast()
	m.Unlock()
}

// blockCmd is executed returns whether it is done
type blockCmd func(*server.Peer, *connCtx) bool

// blocking keeps trying a command until the callback returns true. Calls
// onTimeout after the timeout (or when we call this in a transaction).
func blocking(
	m *Miniredis,
	c *server.Peer,
	timeout time.Duration,
	cb blockCmd,
	onTimeout func(*server.Peer),
) {
	var (
		ctx = getCtx(c)
	)
	if inTx(ctx) {
		addTxCmd(ctx, func(c *server.Peer, ctx *connCtx) {
			if !cb(c, ctx) {
				onTimeout(c)
			}
		})
		c.WriteInline("QUEUED")
		return
	}

	localCtx, cancel := context.WithCancel(m.Ctx)
	defer cancel()
	timedOut := false
	if timeout != 0 {
		go setCondTimer(localCtx, m.signal, &timedOut, timeout)
	}
	go func() {
		<-localCtx.Done()
		m.signal.Broadcast() // main loop might miss this signal
	}()

	if !ctx.nested {
		// this is a call via Lua's .call(). It's already locked.
		m.Lock()
		defer m.Unlock()
	}
	for {
		if c.Closed() {
			return
		}

		if m.Ctx.Err() != nil {
			return
		}

		done := cb(c, ctx)
		if done {
			return
		}

		if timedOut {
			onTimeout(c)
			return
		}

		m.signal.Wait()
	}
}

func setCondTimer(ctx context.Context, sig *sync.Cond, timedOut *bool, timeout time.Duration) {
	dl := time.NewTimer(timeout)
	defer dl.Stop()
	select {
	case <-dl.C:
		sig.L.Lock() // for timedOut
		*timedOut = true
		sig.Broadcast() // main loop might miss this signal
		sig.L.Unlock()
	case <-ctx.Done():
	}
}

// formatBig formats a float the way redis does
func formatBig(v *big.Float) string {
	// Format with %f and strip trailing 0s.
	if v.IsInf() {
		return "inf"
	}
	// if math.IsInf(v, -1) {
	// return "-inf"
	// }
	return stripZeros(fmt.Sprintf("%.17f", v))
}

func stripZeros(sv string) string {
	for strings.Contains(sv, ".") {
		if sv[len(sv)-1] != '0' {
			break
		}
		// Remove trailing 0s.
		sv = sv[:len(sv)-1]
		// Ends with a '.'.
		if sv[len(sv)-1] == '.' {
			sv = sv[:len(sv)-1]
			break
		}
	}
	return sv
}

// redisRange gives Go offsets for something l long with start/end in
// Redis semantics. Both start and end can be negative.
// Used for string range and list range things.
// The results can be used as: v[start:end]
// Note that GETRANGE (on a string key) never returns an empty string when end
// is a large negative number.
func redisRange(l, start, end int, stringSymantics bool) (int, int) {
	if start < 0 {
		start = l + start
		if start < 0 {
			start = 0
		}
	}
	if start > l {
		start = l
	}

	if end < 0 {
		end = l + end
		if end < 0 {
			end = -1
			if stringSymantics {
				end = 0
			}
		}
	}
	if end < math.MaxInt32 {
		end++ // end argument is inclusive in Redis.
	}
	if end > l {
		end = l
	}

	if end < start {
		return 0, 0
	}
	return start, end
}
