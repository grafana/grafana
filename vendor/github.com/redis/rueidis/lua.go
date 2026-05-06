package rueidis

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"runtime"
	"sync/atomic"

	"github.com/redis/rueidis/internal/util"
)

// NewLuaScript creates a Lua instance whose Lua.Exec uses EVALSHA and EVAL.
func NewLuaScript(script string) *Lua {
	sum := sha1.Sum([]byte(script))
	return &Lua{script: script, sha1: hex.EncodeToString(sum[:]), maxp: runtime.GOMAXPROCS(0)}
}

// NewLuaScriptReadOnly creates a Lua instance whose Lua.Exec uses EVALSHA_RO and EVAL_RO.
func NewLuaScriptReadOnly(script string) *Lua {
	lua := NewLuaScript(script)
	lua.readonly = true
	return lua
}

// Lua represents a redis lua script. It should be created from the NewLuaScript() or NewLuaScriptReadOnly()
type Lua struct {
	script   string
	sha1     string
	maxp     int
	readonly bool
}

// Exec the script to the given Client.
// It will first try with the EVALSHA/EVALSHA_RO and then EVAL/EVAL_RO if first try failed.
// Cross slot keys are prohibited if the Client is a cluster client.
func (s *Lua) Exec(ctx context.Context, c Client, keys, args []string) (resp RedisResult) {
	if s.readonly {
		resp = c.Do(ctx, c.B().EvalshaRo().Sha1(s.sha1).Numkeys(int64(len(keys))).Key(keys...).Arg(args...).Build())
	} else {
		resp = c.Do(ctx, c.B().Evalsha().Sha1(s.sha1).Numkeys(int64(len(keys))).Key(keys...).Arg(args...).Build())
	}
	if err, ok := IsRedisErr(resp.Error()); ok && err.IsNoScript() {
		if s.readonly {
			resp = c.Do(ctx, c.B().EvalRo().Script(s.script).Numkeys(int64(len(keys))).Key(keys...).Arg(args...).Build())
		} else {
			resp = c.Do(ctx, c.B().Eval().Script(s.script).Numkeys(int64(len(keys))).Key(keys...).Arg(args...).Build())
		}
	}
	return resp
}

// LuaExec is a single execution unit of Lua.ExecMulti
type LuaExec struct {
	Keys []string
	Args []string
}

// ExecMulti exec the script multiple times by the provided LuaExec to the given Client.
// It will first try SCRIPT LOAD the script to all redis nodes and then exec it with the EVALSHA/EVALSHA_RO.
// Cross slot keys within single LuaExec are prohibited if the Client is a cluster client.
func (s *Lua) ExecMulti(ctx context.Context, c Client, multi ...LuaExec) (resp []RedisResult) {
	var e atomic.Value
	util.ParallelVals(s.maxp, c.Nodes(), func(n Client) {
		if err := n.Do(ctx, n.B().ScriptLoad().Script(s.script).Build()).Error(); err != nil {
			e.CompareAndSwap(nil, &errs{error: err})
		}
	})
	if err := e.Load(); err != nil {
		resp = make([]RedisResult, len(multi))
		for i := 0; i < len(resp); i++ {
			resp[i] = newErrResult(err.(*errs).error)
		}
		return
	}
	cmds := make(Commands, 0, len(multi))
	if s.readonly {
		for _, m := range multi {
			cmds = append(cmds, c.B().EvalshaRo().Sha1(s.sha1).Numkeys(int64(len(m.Keys))).Key(m.Keys...).Arg(m.Args...).Build())
		}
	} else {
		for _, m := range multi {
			cmds = append(cmds, c.B().Evalsha().Sha1(s.sha1).Numkeys(int64(len(m.Keys))).Key(m.Keys...).Arg(m.Args...).Build())
		}
	}
	return c.DoMulti(ctx, cmds...)
}
