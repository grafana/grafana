package rueidis

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"runtime"
	"sync"
	"sync/atomic"

	"github.com/redis/rueidis/internal/util"
)

// LuaOption is a functional option for configuring Lua script behavior.
type LuaOption func(*Lua)

// WithLoadSHA1 allows enabling loading of SHA-1 from Redis via SCRIPT LOAD instead of calculating
// it on the client side. When enabled, the SHA-1 hash is not calculated client-side (important
// for FIPS compliance). Instead, on first execution, SCRIPT LOAD is called to obtain the SHA-1
// from Redis, which is then used for EVALSHA commands in subsequent executions.
func WithLoadSHA1(enabled bool) LuaOption {
	return func(l *Lua) {
		l.loadSha1 = enabled
	}
}

// NewLuaScript creates a Lua instance whose Lua.Exec uses EVALSHA and EVAL.
// By default, SHA-1 is calculated client-side. Use WithLoadSHA1(true) option to load SHA-1 from Redis instead.
func NewLuaScript(script string, opts ...LuaOption) *Lua {
	return newLuaScript(script, false, false, opts...)
}

// NewLuaScriptReadOnly creates a Lua instance whose Lua.Exec uses EVALSHA_RO and EVAL_RO.
// By default, SHA-1 is calculated client-side. Use WithLoadSHA1(true) option to load SHA-1 from Redis instead.
func NewLuaScriptReadOnly(script string, opts ...LuaOption) *Lua {
	return newLuaScript(script, true, false, opts...)
}

// NewLuaScriptNoSha creates a Lua instance whose Lua.Exec uses EVAL only (never EVALSHA).
// No SHA-1 is calculated or loaded. The script is sent to the server every time. Use this when you want
// to avoid SHA-1 entirely (e.g., to fully avoid hash collision concerns).
func NewLuaScriptNoSha(script string) *Lua {
	return newLuaScript(script, false, true)
}

// NewLuaScriptReadOnlyNoSha creates a Lua instance whose Lua.Exec uses EVAL_RO only (never EVALSHA_RO).
// No SHA-1 is calculated or loaded. The script is sent to the server every time. Use this when you want
// to avoid SHA-1 entirely (e.g., to fully avoid hash collision concerns).
func NewLuaScriptReadOnlyNoSha(script string) *Lua {
	return newLuaScript(script, true, true)
}

func newLuaScript(script string, readonly bool, noSha1 bool, opts ...LuaOption) *Lua {
	l := &Lua{
		script:   script,
		maxp:     runtime.GOMAXPROCS(0),
		readonly: readonly,
		noSha1:   noSha1,
	}
	for _, opt := range opts {
		opt(l)
	}
	if !noSha1 && !l.loadSha1 {
		// It's important to avoid calling sha1 methods where not needed since Go will panic in FIPS mode.
		sum := sha1.Sum([]byte(script))
		l.sha1 = hex.EncodeToString(sum[:])
	}
	return l
}

// Lua represents a redis lua script. It should be created from the NewLuaScript() or NewLuaScriptReadOnly().
type Lua struct {
	script   string
	sha1     string
	sha1Call call
	maxp     int
	sha1Mu   sync.RWMutex
	readonly bool
	noSha1   bool
	loadSha1 bool
}

// Exec the script to the given Client.
// It will first try with the EVALSHA/EVALSHA_RO and then EVAL/EVAL_RO if the first try failed.
// If Lua is initialized with disabled SHA1, it will use EVAL/EVAL_RO without the EVALSHA/EVALSHA_RO attempt.
// If Lua is initialized with SHA-1 loading, it will call SCRIPT LOAD once to obtain the SHA-1 from Redis.
// Cross-slot keys are prohibited if the Client is a cluster client.
func (s *Lua) Exec(ctx context.Context, c Client, keys, args []string) (resp RedisResult) {
	var isNoScript bool
	var scriptSha1 string

	// Determine which SHA-1 to use.
	if s.loadSha1 {
		// Check if SHA-1 is already loaded.
		s.sha1Mu.RLock()
		scriptSha1 = s.sha1
		s.sha1Mu.RUnlock()

		// If not loaded yet, use singleflight to load it.
		if scriptSha1 == "" {
			err := s.sha1Call.Do(ctx, func() error {
				result := c.Do(ctx, c.B().ScriptLoad().Script(s.script).Build())
				if shaStr, err := result.ToString(); err == nil {
					s.sha1Mu.Lock()
					s.sha1 = shaStr
					s.sha1Mu.Unlock()
					return nil
				}
				return result.Error()
			})
			if err != nil {
				return newErrResult(err)
			}
			// Reload scriptSha1 after singleflight completes.
			s.sha1Mu.RLock()
			scriptSha1 = s.sha1
			s.sha1Mu.RUnlock()
		}
	} else {
		scriptSha1 = s.sha1
	}

	// NoSha constructors: always use EVAL, never EVALSHA.
	// Regular constructors: use EVALSHA if SHA-1 is available, fall back to EVAL on NOSCRIPT error.
	if !s.noSha1 && scriptSha1 != "" {
		if s.readonly {
			resp = c.Do(ctx, c.B().EvalshaRo().Sha1(scriptSha1).Numkeys(int64(len(keys))).Key(keys...).Arg(args...).Build())
		} else {
			resp = c.Do(ctx, c.B().Evalsha().Sha1(scriptSha1).Numkeys(int64(len(keys))).Key(keys...).Arg(args...).Build())
		}
		err, isErr := IsRedisErr(resp.Error())
		isNoScript = isErr && err.IsNoScript()
	}
	if s.noSha1 || isNoScript {
		if s.readonly {
			resp = c.Do(ctx, c.B().EvalRo().Script(s.script).Numkeys(int64(len(keys))).Key(keys...).Arg(args...).Build())
		} else {
			resp = c.Do(ctx, c.B().Eval().Script(s.script).Numkeys(int64(len(keys))).Key(keys...).Arg(args...).Build())
		}
	}
	return resp
}

// LuaExec is a single execution unit of Lua.ExecMulti.
type LuaExec struct {
	Keys []string
	Args []string
}

// ExecMulti exec the script multiple times by the provided LuaExec to the given Client.
// For regular constructors, it will SCRIPT LOAD to all redis nodes and then use EVALSHA/EVALSHA_RO.
// For NoSha constructors, it will use EVAL/EVAL_RO only without any script loading.
// Cross-slot keys within the single LuaExec are prohibited if the Client is a cluster client.
func (s *Lua) ExecMulti(ctx context.Context, c Client, multi ...LuaExec) (resp []RedisResult) {
	var scriptSha1 string

	// For regular constructors (not NoSha), load the script to all nodes.
	if !s.noSha1 {
		var e atomic.Value
		var sha1Result atomic.Value
		util.ParallelVals(s.maxp, c.Nodes(), func(n Client) {
			result := n.Do(ctx, n.B().ScriptLoad().Script(s.script).Build())
			if err := result.Error(); err != nil {
				e.CompareAndSwap(nil, &errs{error: err})
			} else if s.loadSha1 {
				// Store the first successful SHA-1 result for cases when sha1 loading on.
				if sha, err := result.ToString(); err == nil {
					sha1Result.CompareAndSwap(nil, sha)
				}
			}
		})
		if err := e.Load(); err != nil {
			resp = make([]RedisResult, len(multi))
			for i := 0; i < len(resp); i++ {
				resp[i] = newErrResult(err.(*errs).error)
			}
			return
		}
		// Set SHA-1 from Redis if sha1 loading is enabled.
		if s.loadSha1 {
			if sha := sha1Result.Load(); sha != nil {
				s.sha1Mu.Lock()
				if s.sha1 == "" {
					s.sha1 = sha.(string)
				}
				s.sha1Mu.Unlock()
			}
		}
	}

	s.sha1Mu.RLock()
	scriptSha1 = s.sha1
	s.sha1Mu.RUnlock()

	cmds := make(Commands, 0, len(multi))
	for _, m := range multi {
		// NoSha constructors: always use EVAL.
		// Regular constructors: use EVALSHA if SHA-1 is available.
		if !s.noSha1 && scriptSha1 != "" {
			if s.readonly {
				cmds = append(cmds, c.B().EvalshaRo().Sha1(scriptSha1).Numkeys(int64(len(m.Keys))).Key(m.Keys...).Arg(m.Args...).Build())
			} else {
				cmds = append(cmds, c.B().Evalsha().Sha1(scriptSha1).Numkeys(int64(len(m.Keys))).Key(m.Keys...).Arg(m.Args...).Build())
			}
		} else {
			if s.readonly {
				cmds = append(cmds, c.B().EvalRo().Script(s.script).Numkeys(int64(len(m.Keys))).Key(m.Keys...).Arg(m.Args...).Build())
			} else {
				cmds = append(cmds, c.B().Eval().Script(s.script).Numkeys(int64(len(m.Keys))).Key(m.Keys...).Arg(m.Args...).Build())
			}
		}
	}
	return c.DoMulti(ctx, cmds...)
}
