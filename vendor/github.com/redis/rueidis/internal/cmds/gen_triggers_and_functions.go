// Code generated DO NOT EDIT

package cmds

import "strconv"

type Tfcall Incomplete

func (b Builder) Tfcall() (c Tfcall) {
	c = Tfcall{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TFCALL")
	return c
}

func (c Tfcall) LibraryFunction(libraryFunction string) TfcallLibraryFunction {
	c.cs.s = append(c.cs.s, libraryFunction)
	return (TfcallLibraryFunction)(c)
}

type TfcallArg Incomplete

func (c TfcallArg) Arg(arg ...string) TfcallArg {
	c.cs.s = append(c.cs.s, arg...)
	return c
}

func (c TfcallArg) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TfcallKey Incomplete

func (c TfcallKey) Key(key ...string) TfcallKey {
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

func (c TfcallKey) Arg(arg ...string) TfcallArg {
	c.cs.s = append(c.cs.s, arg...)
	return (TfcallArg)(c)
}

func (c TfcallKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TfcallLibraryFunction Incomplete

func (c TfcallLibraryFunction) Numkeys(numkeys int64) TfcallNumkeys {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numkeys, 10))
	return (TfcallNumkeys)(c)
}

type TfcallNumkeys Incomplete

func (c TfcallNumkeys) Key(key ...string) TfcallKey {
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
	return (TfcallKey)(c)
}

func (c TfcallNumkeys) Arg(arg ...string) TfcallArg {
	c.cs.s = append(c.cs.s, arg...)
	return (TfcallArg)(c)
}

func (c TfcallNumkeys) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Tfcallasync Incomplete

func (b Builder) Tfcallasync() (c Tfcallasync) {
	c = Tfcallasync{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TFCALLASYNC")
	return c
}

func (c Tfcallasync) LibraryFunction(libraryFunction string) TfcallasyncLibraryFunction {
	c.cs.s = append(c.cs.s, libraryFunction)
	return (TfcallasyncLibraryFunction)(c)
}

type TfcallasyncArg Incomplete

func (c TfcallasyncArg) Arg(arg ...string) TfcallasyncArg {
	c.cs.s = append(c.cs.s, arg...)
	return c
}

func (c TfcallasyncArg) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TfcallasyncKey Incomplete

func (c TfcallasyncKey) Key(key ...string) TfcallasyncKey {
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

func (c TfcallasyncKey) Arg(arg ...string) TfcallasyncArg {
	c.cs.s = append(c.cs.s, arg...)
	return (TfcallasyncArg)(c)
}

func (c TfcallasyncKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TfcallasyncLibraryFunction Incomplete

func (c TfcallasyncLibraryFunction) Numkeys(numkeys int64) TfcallasyncNumkeys {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numkeys, 10))
	return (TfcallasyncNumkeys)(c)
}

type TfcallasyncNumkeys Incomplete

func (c TfcallasyncNumkeys) Key(key ...string) TfcallasyncKey {
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
	return (TfcallasyncKey)(c)
}

func (c TfcallasyncNumkeys) Arg(arg ...string) TfcallasyncArg {
	c.cs.s = append(c.cs.s, arg...)
	return (TfcallasyncArg)(c)
}

func (c TfcallasyncNumkeys) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TfunctionDelete Incomplete

func (b Builder) TfunctionDelete() (c TfunctionDelete) {
	c = TfunctionDelete{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TFUNCTION", "DELETE")
	return c
}

func (c TfunctionDelete) LibraryName(libraryName string) TfunctionDeleteLibraryName {
	c.cs.s = append(c.cs.s, libraryName)
	return (TfunctionDeleteLibraryName)(c)
}

type TfunctionDeleteLibraryName Incomplete

func (c TfunctionDeleteLibraryName) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TfunctionList Incomplete

func (b Builder) TfunctionList() (c TfunctionList) {
	c = TfunctionList{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TFUNCTION", "LIST")
	return c
}

func (c TfunctionList) LibraryName(libraryName string) TfunctionListLibraryName {
	c.cs.s = append(c.cs.s, libraryName)
	return (TfunctionListLibraryName)(c)
}

func (c TfunctionList) Withcode() TfunctionListWithcode {
	c.cs.s = append(c.cs.s, "WITHCODE")
	return (TfunctionListWithcode)(c)
}

func (c TfunctionList) Verbose() TfunctionListVerbose {
	c.cs.s = append(c.cs.s, "VERBOSE")
	return (TfunctionListVerbose)(c)
}

func (c TfunctionList) V() TfunctionListV {
	c.cs.s = append(c.cs.s, "V")
	return (TfunctionListV)(c)
}

func (c TfunctionList) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TfunctionListLibraryName Incomplete

func (c TfunctionListLibraryName) Withcode() TfunctionListWithcode {
	c.cs.s = append(c.cs.s, "WITHCODE")
	return (TfunctionListWithcode)(c)
}

func (c TfunctionListLibraryName) Verbose() TfunctionListVerbose {
	c.cs.s = append(c.cs.s, "VERBOSE")
	return (TfunctionListVerbose)(c)
}

func (c TfunctionListLibraryName) V() TfunctionListV {
	c.cs.s = append(c.cs.s, "V")
	return (TfunctionListV)(c)
}

func (c TfunctionListLibraryName) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TfunctionListV Incomplete

func (c TfunctionListV) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TfunctionListVerbose Incomplete

func (c TfunctionListVerbose) V() TfunctionListV {
	c.cs.s = append(c.cs.s, "V")
	return (TfunctionListV)(c)
}

func (c TfunctionListVerbose) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TfunctionListWithcode Incomplete

func (c TfunctionListWithcode) Verbose() TfunctionListVerbose {
	c.cs.s = append(c.cs.s, "VERBOSE")
	return (TfunctionListVerbose)(c)
}

func (c TfunctionListWithcode) V() TfunctionListV {
	c.cs.s = append(c.cs.s, "V")
	return (TfunctionListV)(c)
}

func (c TfunctionListWithcode) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TfunctionLoad Incomplete

func (b Builder) TfunctionLoad() (c TfunctionLoad) {
	c = TfunctionLoad{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TFUNCTION", "LOAD")
	return c
}

func (c TfunctionLoad) Replace() TfunctionLoadReplace {
	c.cs.s = append(c.cs.s, "REPLACE")
	return (TfunctionLoadReplace)(c)
}

func (c TfunctionLoad) Config(config string) TfunctionLoadConfig {
	c.cs.s = append(c.cs.s, "CONFIG", config)
	return (TfunctionLoadConfig)(c)
}

func (c TfunctionLoad) LibraryCode(libraryCode string) TfunctionLoadLibraryCode {
	c.cs.s = append(c.cs.s, libraryCode)
	return (TfunctionLoadLibraryCode)(c)
}

type TfunctionLoadConfig Incomplete

func (c TfunctionLoadConfig) LibraryCode(libraryCode string) TfunctionLoadLibraryCode {
	c.cs.s = append(c.cs.s, libraryCode)
	return (TfunctionLoadLibraryCode)(c)
}

type TfunctionLoadLibraryCode Incomplete

func (c TfunctionLoadLibraryCode) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TfunctionLoadReplace Incomplete

func (c TfunctionLoadReplace) Config(config string) TfunctionLoadConfig {
	c.cs.s = append(c.cs.s, "CONFIG", config)
	return (TfunctionLoadConfig)(c)
}

func (c TfunctionLoadReplace) LibraryCode(libraryCode string) TfunctionLoadLibraryCode {
	c.cs.s = append(c.cs.s, libraryCode)
	return (TfunctionLoadLibraryCode)(c)
}
