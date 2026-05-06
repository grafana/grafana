package miniredis

import (
	"bufio"
	"bytes"
	"fmt"
	"strings"

	lua "github.com/yuin/gopher-lua"

	"github.com/alicebob/miniredis/v2/server"
)

var luaRedisConstants = map[string]lua.LValue{
	"LOG_DEBUG":   lua.LNumber(0),
	"LOG_VERBOSE": lua.LNumber(1),
	"LOG_NOTICE":  lua.LNumber(2),
	"LOG_WARNING": lua.LNumber(3),
}

func mkLua(srv *server.Server, c *server.Peer, sha string) (map[string]lua.LGFunction, map[string]lua.LValue) {
	mkCall := func(failFast bool) func(l *lua.LState) int {
		// one server.Ctx for a single Lua run
		pCtx := &connCtx{}
		if getCtx(c).authenticated {
			pCtx.authenticated = true
		}
		pCtx.nested = true
		pCtx.nestedSHA = sha
		pCtx.selectedDB = getCtx(c).selectedDB

		return func(l *lua.LState) int {
			top := l.GetTop()
			if top == 0 {
				l.Error(lua.LString(fmt.Sprintf("Please specify at least one argument for this redis lib call script: %s, &c.", sha)), 1)
				return 0
			}
			var args []string
			for i := 1; i <= top; i++ {
				switch a := l.Get(i).(type) {
				case lua.LNumber:
					args = append(args, a.String())
				case lua.LString:
					args = append(args, string(a))
				default:
					l.Error(lua.LString(fmt.Sprintf("Lua redis lib command arguments must be strings or integers script: %s, &c.", sha)), 1)
					return 0
				}
			}
			if len(args) == 0 {
				l.Error(lua.LString(msgNotFromScripts(sha)), 1)
				return 0
			}

			buf := &bytes.Buffer{}
			wr := bufio.NewWriter(buf)
			peer := server.NewPeer(wr)
			peer.Ctx = pCtx
			srv.Dispatch(peer, args)
			wr.Flush()

			res, err := server.ParseReply(bufio.NewReader(buf))
			if err != nil {
				if failFast {
					// call() mode
					if strings.Contains(err.Error(), "ERR unknown command") {
						l.Error(lua.LString(fmt.Sprintf("Unknown Redis command called from script script: %s, &c.", sha)), 1)
					} else {
						l.Error(lua.LString(err.Error()), 1)
					}
					return 0
				}
				// pcall() mode
				l.Push(lua.LNil)
				return 1
			}

			if res == nil {
				l.Push(lua.LFalse)
			} else {
				switch r := res.(type) {
				case int64:
					l.Push(lua.LNumber(r))
				case int:
					l.Push(lua.LNumber(r))
				case []uint8:
					l.Push(lua.LString(string(r)))
				case []interface{}:
					l.Push(redisToLua(l, r))
				case server.Simple:
					l.Push(luaStatusReply(string(r)))
				case string:
					l.Push(lua.LString(r))
				case error:
					l.Error(lua.LString(r.Error()), 1)
					return 0
				default:
					panic(fmt.Sprintf("type not handled (%T)", r))
				}
			}
			return 1
		}
	}

	return map[string]lua.LGFunction{
		"call":  mkCall(true),
		"pcall": mkCall(false),
		"error_reply": func(l *lua.LState) int {
			v := l.Get(1)
			msg, ok := v.(lua.LString)
			if !ok {
				l.Error(lua.LString("wrong number or type of arguments"), 1)
				return 0
			}
			res := &lua.LTable{}
			parts := strings.SplitN(msg.String(), " ", 2)
			// '-' at the beginging will be added as a part of error response
			if parts[0] != "" && parts[0][0] == '-' {
				parts[0] = parts[0][1:]
			}
			var final_msg string
			if len(parts) == 2 {
				final_msg = fmt.Sprintf("%s %s", parts[0], parts[1])
			} else {
				final_msg = fmt.Sprintf("ERR %s", parts[0])
			}
			res.RawSetString("err", lua.LString(final_msg))
			l.Push(res)
			return 1
		},
		"log": func(l *lua.LState) int {
			level := l.CheckInt(1)
			msg := l.CheckString(2)
			_, _ = level, msg
			// do nothing by default. To see logs uncomment:
			//   fmt.Printf("%v: %v", level, msg)
			return 0
		},
		"status_reply": func(l *lua.LState) int {
			v := l.Get(1)
			msg, ok := v.(lua.LString)
			if !ok {
				l.Error(lua.LString("wrong number or type of arguments"), 1)
				return 0
			}
			res := luaStatusReply(string(msg))
			l.Push(res)
			return 1
		},
		"sha1hex": func(l *lua.LState) int {
			top := l.GetTop()
			if top != 1 {
				l.Error(lua.LString("wrong number of arguments"), 1)
				return 0
			}
			msg := lua.LVAsString(l.Get(1))
			l.Push(lua.LString(sha1Hex(msg)))
			return 1
		},
		"replicate_commands": func(l *lua.LState) int {
			// ignored
			return 1
		},
		"set_repl": func(l *lua.LState) int {
			top := l.GetTop()
			if top != 1 {
				l.Error(lua.LString("wrong number of arguments"), 1)
				return 0
			}
			// ignored
			return 1
		},
	}, luaRedisConstants
}

func luaToRedis(l *lua.LState, c *server.Peer, value lua.LValue) {
	if value == nil {
		c.WriteNull()
		return
	}

	switch t := value.(type) {
	case *lua.LNilType:
		c.WriteNull()
	case lua.LBool:
		if lua.LVAsBool(value) {
			c.WriteInt(1)
		} else {
			c.WriteNull()
		}
	case lua.LNumber:
		c.WriteInt(int(lua.LVAsNumber(value)))
	case lua.LString:
		s := lua.LVAsString(value)
		c.WriteBulk(s)
	case *lua.LTable:
		// special case for tables with an 'err' or 'ok' field
		// note: according to the docs this only counts when 'err' or 'ok' is
		// the only field.
		if s := t.RawGetString("err"); s.Type() != lua.LTNil {
			c.WriteError(s.String())
			return
		}
		if s := t.RawGetString("ok"); s.Type() != lua.LTNil {
			c.WriteInline(s.String())
			return
		}

		result := []lua.LValue{}
		for j := 1; true; j++ {
			val := l.GetTable(value, lua.LNumber(j))
			if val == nil {
				result = append(result, val)
				continue
			}

			if val.Type() == lua.LTNil {
				break
			}

			result = append(result, val)
		}

		c.WriteLen(len(result))
		for _, r := range result {
			luaToRedis(l, c, r)
		}
	default:
		panic("....")
	}
}

func redisToLua(l *lua.LState, res []interface{}) *lua.LTable {
	rettb := l.NewTable()
	for _, e := range res {
		var v lua.LValue
		if e == nil {
			v = lua.LFalse
		} else {
			switch et := e.(type) {
			case int:
				v = lua.LNumber(et)
			case int64:
				v = lua.LNumber(et)
			case []uint8:
				v = lua.LString(string(et))
			case []interface{}:
				v = redisToLua(l, et)
			case string:
				v = lua.LString(et)
			default:
				// TODO: oops?
				v = lua.LString(e.(string))
			}
		}
		l.RawSet(rettb, lua.LNumber(rettb.Len()+1), v)
	}
	return rettb
}

func luaStatusReply(msg string) *lua.LTable {
	tab := &lua.LTable{}
	tab.RawSetString("ok", lua.LString(msg))
	return tab
}
