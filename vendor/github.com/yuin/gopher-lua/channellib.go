package lua

import (
	"reflect"
)

func checkChannel(L *LState, idx int) reflect.Value {
	ch := L.CheckChannel(idx)
	return reflect.ValueOf(ch)
}

func checkGoroutineSafe(L *LState, idx int) LValue {
	v := L.CheckAny(2)
	if !isGoroutineSafe(v) {
		L.ArgError(2, "can not send a function, userdata, thread or table that has a metatable")
	}
	return v
}

func OpenChannel(L *LState) int {
	var mod LValue
	//_, ok := L.G.builtinMts[int(LTChannel)]
	//	if !ok {
	mod = L.RegisterModule(ChannelLibName, channelFuncs)
	mt := L.SetFuncs(L.NewTable(), channelMethods)
	mt.RawSetString("__index", mt)
	L.G.builtinMts[int(LTChannel)] = mt
	//	}
	L.Push(mod)
	return 1
}

var channelFuncs = map[string]LGFunction{
	"make":   channelMake,
	"select": channelSelect,
}

func channelMake(L *LState) int {
	buffer := L.OptInt(1, 0)
	L.Push(LChannel(make(chan LValue, buffer)))
	return 1
}

func channelSelect(L *LState) int {
	//TODO check case table size
	cases := make([]reflect.SelectCase, L.GetTop())
	top := L.GetTop()
	for i := 0; i < top; i++ {
		cas := reflect.SelectCase{
			Dir:  reflect.SelectSend,
			Chan: reflect.ValueOf(nil),
			Send: reflect.ValueOf(nil),
		}
		tbl := L.CheckTable(i + 1)
		dir, ok1 := tbl.RawGetInt(1).(LString)
		if !ok1 {
			L.ArgError(i+1, "invalid select case")
		}
		switch string(dir) {
		case "<-|":
			ch, ok := tbl.RawGetInt(2).(LChannel)
			if !ok {
				L.ArgError(i+1, "invalid select case")
			}
			cas.Chan = reflect.ValueOf((chan LValue)(ch))
			v := tbl.RawGetInt(3)
			if !isGoroutineSafe(v) {
				L.ArgError(i+1, "can not send a function, userdata, thread or table that has a metatable")
			}
			cas.Send = reflect.ValueOf(v)
		case "|<-":
			ch, ok := tbl.RawGetInt(2).(LChannel)
			if !ok {
				L.ArgError(i+1, "invalid select case")
			}
			cas.Chan = reflect.ValueOf((chan LValue)(ch))
			cas.Dir = reflect.SelectRecv
		case "default":
			cas.Dir = reflect.SelectDefault
		default:
			L.ArgError(i+1, "invalid channel direction:"+string(dir))
		}
		cases[i] = cas
	}

	if L.ctx != nil {
		cases = append(cases, reflect.SelectCase{
			Dir:  reflect.SelectRecv,
			Chan: reflect.ValueOf(L.ctx.Done()),
			Send: reflect.ValueOf(nil),
		})
	}

	pos, recv, rok := reflect.Select(cases)

	if L.ctx != nil && pos == L.GetTop() {
		return 0
	}

	lv := LNil
	if recv.Kind() != 0 {
		lv, _ = recv.Interface().(LValue)
		if lv == nil {
			lv = LNil
		}
	}
	tbl := L.Get(pos + 1).(*LTable)
	last := tbl.RawGetInt(tbl.Len())
	if last.Type() == LTFunction {
		L.Push(last)
		switch cases[pos].Dir {
		case reflect.SelectRecv:
			if rok {
				L.Push(LTrue)
			} else {
				L.Push(LFalse)
			}
			L.Push(lv)
			L.Call(2, 0)
		case reflect.SelectSend:
			L.Push(tbl.RawGetInt(3))
			L.Call(1, 0)
		case reflect.SelectDefault:
			L.Call(0, 0)
		}
	}
	L.Push(LNumber(pos + 1))
	L.Push(lv)
	if rok {
		L.Push(LTrue)
	} else {
		L.Push(LFalse)
	}
	return 3
}

var channelMethods = map[string]LGFunction{
	"receive": channelReceive,
	"send":    channelSend,
	"close":   channelClose,
}

func channelReceive(L *LState) int {
	rch := checkChannel(L, 1)
	var v reflect.Value
	var ok bool
	if L.ctx != nil {
		cases := []reflect.SelectCase{{
			Dir:  reflect.SelectRecv,
			Chan: reflect.ValueOf(L.ctx.Done()),
			Send: reflect.ValueOf(nil),
		}, {
			Dir:  reflect.SelectRecv,
			Chan: rch,
			Send: reflect.ValueOf(nil),
		}}
		_, v, ok = reflect.Select(cases)
	} else {
		v, ok = rch.Recv()
	}
	if ok {
		L.Push(LTrue)
		L.Push(v.Interface().(LValue))
	} else {
		L.Push(LFalse)
		L.Push(LNil)
	}
	return 2
}

func channelSend(L *LState) int {
	rch := checkChannel(L, 1)
	v := checkGoroutineSafe(L, 2)
	rch.Send(reflect.ValueOf(v))
	return 0
}

func channelClose(L *LState) int {
	rch := checkChannel(L, 1)
	rch.Close()
	return 0
}

//
