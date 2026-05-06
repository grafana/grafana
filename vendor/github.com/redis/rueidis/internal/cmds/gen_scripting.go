// Code generated DO NOT EDIT

package cmds

import "strconv"

type Eval Incomplete

func (b Builder) Eval() (c Eval) {
	c = Eval{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "EVAL")
	return c
}

func (c Eval) Script(script string) EvalScript {
	c.cs.s = append(c.cs.s, script)
	return (EvalScript)(c)
}

type EvalArg Incomplete

func (c EvalArg) Arg(arg ...string) EvalArg {
	c.cs.s = append(c.cs.s, arg...)
	return c
}

func (c EvalArg) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type EvalKey Incomplete

func (c EvalKey) Key(key ...string) EvalKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return c
}

func (c EvalKey) Arg(arg ...string) EvalArg {
	c.cs.s = append(c.cs.s, arg...)
	return (EvalArg)(c)
}

func (c EvalKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type EvalNumkeys Incomplete

func (c EvalNumkeys) Key(key ...string) EvalKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return (EvalKey)(c)
}

func (c EvalNumkeys) Arg(arg ...string) EvalArg {
	c.cs.s = append(c.cs.s, arg...)
	return (EvalArg)(c)
}

func (c EvalNumkeys) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type EvalRo Incomplete

func (b Builder) EvalRo() (c EvalRo) {
	c = EvalRo{cs: get(), ks: b.ks, cf: int16(scrRoTag)}
	c.cs.s = append(c.cs.s, "EVAL_RO")
	return c
}

func (c EvalRo) Script(script string) EvalRoScript {
	c.cs.s = append(c.cs.s, script)
	return (EvalRoScript)(c)
}

type EvalRoArg Incomplete

func (c EvalRoArg) Arg(arg ...string) EvalRoArg {
	c.cs.s = append(c.cs.s, arg...)
	return c
}

func (c EvalRoArg) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c EvalRoArg) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type EvalRoKey Incomplete

func (c EvalRoKey) Key(key ...string) EvalRoKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return c
}

func (c EvalRoKey) Arg(arg ...string) EvalRoArg {
	c.cs.s = append(c.cs.s, arg...)
	return (EvalRoArg)(c)
}

func (c EvalRoKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c EvalRoKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type EvalRoNumkeys Incomplete

func (c EvalRoNumkeys) Key(key ...string) EvalRoKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return (EvalRoKey)(c)
}

func (c EvalRoNumkeys) Arg(arg ...string) EvalRoArg {
	c.cs.s = append(c.cs.s, arg...)
	return (EvalRoArg)(c)
}

func (c EvalRoNumkeys) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c EvalRoNumkeys) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type EvalRoScript Incomplete

func (c EvalRoScript) Numkeys(numkeys int64) EvalRoNumkeys {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numkeys, 10))
	return (EvalRoNumkeys)(c)
}

type EvalScript Incomplete

func (c EvalScript) Numkeys(numkeys int64) EvalNumkeys {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numkeys, 10))
	return (EvalNumkeys)(c)
}

type Evalsha Incomplete

func (b Builder) Evalsha() (c Evalsha) {
	c = Evalsha{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "EVALSHA")
	return c
}

func (c Evalsha) Sha1(sha1 string) EvalshaSha1 {
	c.cs.s = append(c.cs.s, sha1)
	return (EvalshaSha1)(c)
}

type EvalshaArg Incomplete

func (c EvalshaArg) Arg(arg ...string) EvalshaArg {
	c.cs.s = append(c.cs.s, arg...)
	return c
}

func (c EvalshaArg) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type EvalshaKey Incomplete

func (c EvalshaKey) Key(key ...string) EvalshaKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return c
}

func (c EvalshaKey) Arg(arg ...string) EvalshaArg {
	c.cs.s = append(c.cs.s, arg...)
	return (EvalshaArg)(c)
}

func (c EvalshaKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type EvalshaNumkeys Incomplete

func (c EvalshaNumkeys) Key(key ...string) EvalshaKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return (EvalshaKey)(c)
}

func (c EvalshaNumkeys) Arg(arg ...string) EvalshaArg {
	c.cs.s = append(c.cs.s, arg...)
	return (EvalshaArg)(c)
}

func (c EvalshaNumkeys) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type EvalshaRo Incomplete

func (b Builder) EvalshaRo() (c EvalshaRo) {
	c = EvalshaRo{cs: get(), ks: b.ks, cf: int16(scrRoTag)}
	c.cs.s = append(c.cs.s, "EVALSHA_RO")
	return c
}

func (c EvalshaRo) Sha1(sha1 string) EvalshaRoSha1 {
	c.cs.s = append(c.cs.s, sha1)
	return (EvalshaRoSha1)(c)
}

type EvalshaRoArg Incomplete

func (c EvalshaRoArg) Arg(arg ...string) EvalshaRoArg {
	c.cs.s = append(c.cs.s, arg...)
	return c
}

func (c EvalshaRoArg) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c EvalshaRoArg) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type EvalshaRoKey Incomplete

func (c EvalshaRoKey) Key(key ...string) EvalshaRoKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return c
}

func (c EvalshaRoKey) Arg(arg ...string) EvalshaRoArg {
	c.cs.s = append(c.cs.s, arg...)
	return (EvalshaRoArg)(c)
}

func (c EvalshaRoKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c EvalshaRoKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type EvalshaRoNumkeys Incomplete

func (c EvalshaRoNumkeys) Key(key ...string) EvalshaRoKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return (EvalshaRoKey)(c)
}

func (c EvalshaRoNumkeys) Arg(arg ...string) EvalshaRoArg {
	c.cs.s = append(c.cs.s, arg...)
	return (EvalshaRoArg)(c)
}

func (c EvalshaRoNumkeys) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c EvalshaRoNumkeys) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type EvalshaRoSha1 Incomplete

func (c EvalshaRoSha1) Numkeys(numkeys int64) EvalshaRoNumkeys {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numkeys, 10))
	return (EvalshaRoNumkeys)(c)
}

type EvalshaSha1 Incomplete

func (c EvalshaSha1) Numkeys(numkeys int64) EvalshaNumkeys {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numkeys, 10))
	return (EvalshaNumkeys)(c)
}

type Fcall Incomplete

func (b Builder) Fcall() (c Fcall) {
	c = Fcall{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "FCALL")
	return c
}

func (c Fcall) Function(function string) FcallFunction {
	c.cs.s = append(c.cs.s, function)
	return (FcallFunction)(c)
}

type FcallArg Incomplete

func (c FcallArg) Arg(arg ...string) FcallArg {
	c.cs.s = append(c.cs.s, arg...)
	return c
}

func (c FcallArg) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FcallFunction Incomplete

func (c FcallFunction) Numkeys(numkeys int64) FcallNumkeys {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numkeys, 10))
	return (FcallNumkeys)(c)
}

type FcallKey Incomplete

func (c FcallKey) Key(key ...string) FcallKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return c
}

func (c FcallKey) Arg(arg ...string) FcallArg {
	c.cs.s = append(c.cs.s, arg...)
	return (FcallArg)(c)
}

func (c FcallKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FcallNumkeys Incomplete

func (c FcallNumkeys) Key(key ...string) FcallKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return (FcallKey)(c)
}

func (c FcallNumkeys) Arg(arg ...string) FcallArg {
	c.cs.s = append(c.cs.s, arg...)
	return (FcallArg)(c)
}

func (c FcallNumkeys) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FcallRo Incomplete

func (b Builder) FcallRo() (c FcallRo) {
	c = FcallRo{cs: get(), ks: b.ks, cf: int16(scrRoTag)}
	c.cs.s = append(c.cs.s, "FCALL_RO")
	return c
}

func (c FcallRo) Function(function string) FcallRoFunction {
	c.cs.s = append(c.cs.s, function)
	return (FcallRoFunction)(c)
}

type FcallRoArg Incomplete

func (c FcallRoArg) Arg(arg ...string) FcallRoArg {
	c.cs.s = append(c.cs.s, arg...)
	return c
}

func (c FcallRoArg) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c FcallRoArg) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FcallRoFunction Incomplete

func (c FcallRoFunction) Numkeys(numkeys int64) FcallRoNumkeys {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numkeys, 10))
	return (FcallRoNumkeys)(c)
}

type FcallRoKey Incomplete

func (c FcallRoKey) Key(key ...string) FcallRoKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return c
}

func (c FcallRoKey) Arg(arg ...string) FcallRoArg {
	c.cs.s = append(c.cs.s, arg...)
	return (FcallRoArg)(c)
}

func (c FcallRoKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c FcallRoKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FcallRoNumkeys Incomplete

func (c FcallRoNumkeys) Key(key ...string) FcallRoKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return (FcallRoKey)(c)
}

func (c FcallRoNumkeys) Arg(arg ...string) FcallRoArg {
	c.cs.s = append(c.cs.s, arg...)
	return (FcallRoArg)(c)
}

func (c FcallRoNumkeys) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c FcallRoNumkeys) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionDelete Incomplete

func (b Builder) FunctionDelete() (c FunctionDelete) {
	c = FunctionDelete{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "FUNCTION", "DELETE")
	return c
}

func (c FunctionDelete) LibraryName(libraryName string) FunctionDeleteLibraryName {
	c.cs.s = append(c.cs.s, libraryName)
	return (FunctionDeleteLibraryName)(c)
}

type FunctionDeleteLibraryName Incomplete

func (c FunctionDeleteLibraryName) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionDump Incomplete

func (b Builder) FunctionDump() (c FunctionDump) {
	c = FunctionDump{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "FUNCTION", "DUMP")
	return c
}

func (c FunctionDump) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionFlush Incomplete

func (b Builder) FunctionFlush() (c FunctionFlush) {
	c = FunctionFlush{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "FUNCTION", "FLUSH")
	return c
}

func (c FunctionFlush) Async() FunctionFlushAsync {
	c.cs.s = append(c.cs.s, "ASYNC")
	return (FunctionFlushAsync)(c)
}

func (c FunctionFlush) Sync() FunctionFlushAsyncSync {
	c.cs.s = append(c.cs.s, "SYNC")
	return (FunctionFlushAsyncSync)(c)
}

func (c FunctionFlush) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionFlushAsync Incomplete

func (c FunctionFlushAsync) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionFlushAsyncSync Incomplete

func (c FunctionFlushAsyncSync) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionHelp Incomplete

func (b Builder) FunctionHelp() (c FunctionHelp) {
	c = FunctionHelp{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "FUNCTION", "HELP")
	return c
}

func (c FunctionHelp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionKill Incomplete

func (b Builder) FunctionKill() (c FunctionKill) {
	c = FunctionKill{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "FUNCTION", "KILL")
	return c
}

func (c FunctionKill) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionList Incomplete

func (b Builder) FunctionList() (c FunctionList) {
	c = FunctionList{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "FUNCTION", "LIST")
	return c
}

func (c FunctionList) Libraryname(libraryNamePattern string) FunctionListLibraryname {
	c.cs.s = append(c.cs.s, "LIBRARYNAME", libraryNamePattern)
	return (FunctionListLibraryname)(c)
}

func (c FunctionList) Withcode() FunctionListWithcode {
	c.cs.s = append(c.cs.s, "WITHCODE")
	return (FunctionListWithcode)(c)
}

func (c FunctionList) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionListLibraryname Incomplete

func (c FunctionListLibraryname) Withcode() FunctionListWithcode {
	c.cs.s = append(c.cs.s, "WITHCODE")
	return (FunctionListWithcode)(c)
}

func (c FunctionListLibraryname) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionListWithcode Incomplete

func (c FunctionListWithcode) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionLoad Incomplete

func (b Builder) FunctionLoad() (c FunctionLoad) {
	c = FunctionLoad{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "FUNCTION", "LOAD")
	return c
}

func (c FunctionLoad) Replace() FunctionLoadReplace {
	c.cs.s = append(c.cs.s, "REPLACE")
	return (FunctionLoadReplace)(c)
}

func (c FunctionLoad) FunctionCode(functionCode string) FunctionLoadFunctionCode {
	c.cs.s = append(c.cs.s, functionCode)
	return (FunctionLoadFunctionCode)(c)
}

type FunctionLoadFunctionCode Incomplete

func (c FunctionLoadFunctionCode) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionLoadReplace Incomplete

func (c FunctionLoadReplace) FunctionCode(functionCode string) FunctionLoadFunctionCode {
	c.cs.s = append(c.cs.s, functionCode)
	return (FunctionLoadFunctionCode)(c)
}

type FunctionRestore Incomplete

func (b Builder) FunctionRestore() (c FunctionRestore) {
	c = FunctionRestore{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "FUNCTION", "RESTORE")
	return c
}

func (c FunctionRestore) SerializedValue(serializedValue string) FunctionRestoreSerializedValue {
	c.cs.s = append(c.cs.s, serializedValue)
	return (FunctionRestoreSerializedValue)(c)
}

type FunctionRestorePolicyAppend Incomplete

func (c FunctionRestorePolicyAppend) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionRestorePolicyFlush Incomplete

func (c FunctionRestorePolicyFlush) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionRestorePolicyReplace Incomplete

func (c FunctionRestorePolicyReplace) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionRestoreSerializedValue Incomplete

func (c FunctionRestoreSerializedValue) Flush() FunctionRestorePolicyFlush {
	c.cs.s = append(c.cs.s, "FLUSH")
	return (FunctionRestorePolicyFlush)(c)
}

func (c FunctionRestoreSerializedValue) Append() FunctionRestorePolicyAppend {
	c.cs.s = append(c.cs.s, "APPEND")
	return (FunctionRestorePolicyAppend)(c)
}

func (c FunctionRestoreSerializedValue) Replace() FunctionRestorePolicyReplace {
	c.cs.s = append(c.cs.s, "REPLACE")
	return (FunctionRestorePolicyReplace)(c)
}

func (c FunctionRestoreSerializedValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FunctionStats Incomplete

func (b Builder) FunctionStats() (c FunctionStats) {
	c = FunctionStats{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "FUNCTION", "STATS")
	return c
}

func (c FunctionStats) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ScriptDebug Incomplete

func (b Builder) ScriptDebug() (c ScriptDebug) {
	c = ScriptDebug{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SCRIPT", "DEBUG")
	return c
}

func (c ScriptDebug) Yes() ScriptDebugModeYes {
	c.cs.s = append(c.cs.s, "YES")
	return (ScriptDebugModeYes)(c)
}

func (c ScriptDebug) Sync() ScriptDebugModeSync {
	c.cs.s = append(c.cs.s, "SYNC")
	return (ScriptDebugModeSync)(c)
}

func (c ScriptDebug) No() ScriptDebugModeNo {
	c.cs.s = append(c.cs.s, "NO")
	return (ScriptDebugModeNo)(c)
}

type ScriptDebugModeNo Incomplete

func (c ScriptDebugModeNo) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ScriptDebugModeSync Incomplete

func (c ScriptDebugModeSync) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ScriptDebugModeYes Incomplete

func (c ScriptDebugModeYes) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ScriptExists Incomplete

func (b Builder) ScriptExists() (c ScriptExists) {
	c = ScriptExists{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SCRIPT", "EXISTS")
	return c
}

func (c ScriptExists) Sha1(sha1 ...string) ScriptExistsSha1 {
	c.cs.s = append(c.cs.s, sha1...)
	return (ScriptExistsSha1)(c)
}

type ScriptExistsSha1 Incomplete

func (c ScriptExistsSha1) Sha1(sha1 ...string) ScriptExistsSha1 {
	c.cs.s = append(c.cs.s, sha1...)
	return c
}

func (c ScriptExistsSha1) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ScriptFlush Incomplete

func (b Builder) ScriptFlush() (c ScriptFlush) {
	c = ScriptFlush{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SCRIPT", "FLUSH")
	return c
}

func (c ScriptFlush) Async() ScriptFlushAsync {
	c.cs.s = append(c.cs.s, "ASYNC")
	return (ScriptFlushAsync)(c)
}

func (c ScriptFlush) Sync() ScriptFlushAsyncSync {
	c.cs.s = append(c.cs.s, "SYNC")
	return (ScriptFlushAsyncSync)(c)
}

func (c ScriptFlush) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ScriptFlushAsync Incomplete

func (c ScriptFlushAsync) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ScriptFlushAsyncSync Incomplete

func (c ScriptFlushAsyncSync) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ScriptKill Incomplete

func (b Builder) ScriptKill() (c ScriptKill) {
	c = ScriptKill{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SCRIPT", "KILL")
	return c
}

func (c ScriptKill) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ScriptLoad Incomplete

func (b Builder) ScriptLoad() (c ScriptLoad) {
	c = ScriptLoad{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SCRIPT", "LOAD")
	return c
}

func (c ScriptLoad) Script(script string) ScriptLoadScript {
	c.cs.s = append(c.cs.s, script)
	return (ScriptLoadScript)(c)
}

type ScriptLoadScript Incomplete

func (c ScriptLoadScript) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ScriptShow Incomplete

func (b Builder) ScriptShow() (c ScriptShow) {
	c = ScriptShow{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SCRIPT", "SHOW")
	return c
}

func (c ScriptShow) Sha1(sha1 string) ScriptShowSha1 {
	c.cs.s = append(c.cs.s, sha1)
	return (ScriptShowSha1)(c)
}

type ScriptShowSha1 Incomplete

func (c ScriptShowSha1) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
