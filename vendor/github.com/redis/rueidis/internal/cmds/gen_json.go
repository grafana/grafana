// Code generated DO NOT EDIT

package cmds

import "strconv"

type JsonArrappend Incomplete

func (b Builder) JsonArrappend() (c JsonArrappend) {
	c = JsonArrappend{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.ARRAPPEND")
	return c
}

func (c JsonArrappend) Key(key string) JsonArrappendKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonArrappendKey)(c)
}

type JsonArrappendKey Incomplete

func (c JsonArrappendKey) Path(path string) JsonArrappendPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonArrappendPath)(c)
}

func (c JsonArrappendKey) Value(value ...string) JsonArrappendValue {
	c.cs.s = append(c.cs.s, value...)
	return (JsonArrappendValue)(c)
}

type JsonArrappendPath Incomplete

func (c JsonArrappendPath) Value(value ...string) JsonArrappendValue {
	c.cs.s = append(c.cs.s, value...)
	return (JsonArrappendValue)(c)
}

type JsonArrappendValue Incomplete

func (c JsonArrappendValue) Value(value ...string) JsonArrappendValue {
	c.cs.s = append(c.cs.s, value...)
	return c
}

func (c JsonArrappendValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonArrindex Incomplete

func (b Builder) JsonArrindex() (c JsonArrindex) {
	c = JsonArrindex{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "JSON.ARRINDEX")
	return c
}

func (c JsonArrindex) Key(key string) JsonArrindexKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonArrindexKey)(c)
}

type JsonArrindexKey Incomplete

func (c JsonArrindexKey) Path(path string) JsonArrindexPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonArrindexPath)(c)
}

type JsonArrindexPath Incomplete

func (c JsonArrindexPath) Value(value string) JsonArrindexValue {
	c.cs.s = append(c.cs.s, value)
	return (JsonArrindexValue)(c)
}

type JsonArrindexStartStart Incomplete

func (c JsonArrindexStartStart) Stop(stop int64) JsonArrindexStartStop {
	c.cs.s = append(c.cs.s, strconv.FormatInt(stop, 10))
	return (JsonArrindexStartStop)(c)
}

func (c JsonArrindexStartStart) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonArrindexStartStart) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonArrindexStartStop Incomplete

func (c JsonArrindexStartStop) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonArrindexStartStop) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonArrindexValue Incomplete

func (c JsonArrindexValue) Start(start int64) JsonArrindexStartStart {
	c.cs.s = append(c.cs.s, strconv.FormatInt(start, 10))
	return (JsonArrindexStartStart)(c)
}

func (c JsonArrindexValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonArrindexValue) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonArrinsert Incomplete

func (b Builder) JsonArrinsert() (c JsonArrinsert) {
	c = JsonArrinsert{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.ARRINSERT")
	return c
}

func (c JsonArrinsert) Key(key string) JsonArrinsertKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonArrinsertKey)(c)
}

type JsonArrinsertIndex Incomplete

func (c JsonArrinsertIndex) Value(value ...string) JsonArrinsertValue {
	c.cs.s = append(c.cs.s, value...)
	return (JsonArrinsertValue)(c)
}

type JsonArrinsertKey Incomplete

func (c JsonArrinsertKey) Path(path string) JsonArrinsertPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonArrinsertPath)(c)
}

type JsonArrinsertPath Incomplete

func (c JsonArrinsertPath) Index(index int64) JsonArrinsertIndex {
	c.cs.s = append(c.cs.s, strconv.FormatInt(index, 10))
	return (JsonArrinsertIndex)(c)
}

type JsonArrinsertValue Incomplete

func (c JsonArrinsertValue) Value(value ...string) JsonArrinsertValue {
	c.cs.s = append(c.cs.s, value...)
	return c
}

func (c JsonArrinsertValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonArrlen Incomplete

func (b Builder) JsonArrlen() (c JsonArrlen) {
	c = JsonArrlen{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "JSON.ARRLEN")
	return c
}

func (c JsonArrlen) Key(key string) JsonArrlenKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonArrlenKey)(c)
}

type JsonArrlenKey Incomplete

func (c JsonArrlenKey) Path(path string) JsonArrlenPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonArrlenPath)(c)
}

func (c JsonArrlenKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonArrlenKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonArrlenPath Incomplete

func (c JsonArrlenPath) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonArrlenPath) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonArrpop Incomplete

func (b Builder) JsonArrpop() (c JsonArrpop) {
	c = JsonArrpop{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.ARRPOP")
	return c
}

func (c JsonArrpop) Key(key string) JsonArrpopKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonArrpopKey)(c)
}

type JsonArrpopKey Incomplete

func (c JsonArrpopKey) Path(path string) JsonArrpopPathPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonArrpopPathPath)(c)
}

func (c JsonArrpopKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonArrpopPathIndex Incomplete

func (c JsonArrpopPathIndex) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonArrpopPathPath Incomplete

func (c JsonArrpopPathPath) Index(index int64) JsonArrpopPathIndex {
	c.cs.s = append(c.cs.s, strconv.FormatInt(index, 10))
	return (JsonArrpopPathIndex)(c)
}

func (c JsonArrpopPathPath) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonArrtrim Incomplete

func (b Builder) JsonArrtrim() (c JsonArrtrim) {
	c = JsonArrtrim{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.ARRTRIM")
	return c
}

func (c JsonArrtrim) Key(key string) JsonArrtrimKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonArrtrimKey)(c)
}

type JsonArrtrimKey Incomplete

func (c JsonArrtrimKey) Path(path string) JsonArrtrimPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonArrtrimPath)(c)
}

type JsonArrtrimPath Incomplete

func (c JsonArrtrimPath) Start(start int64) JsonArrtrimStart {
	c.cs.s = append(c.cs.s, strconv.FormatInt(start, 10))
	return (JsonArrtrimStart)(c)
}

type JsonArrtrimStart Incomplete

func (c JsonArrtrimStart) Stop(stop int64) JsonArrtrimStop {
	c.cs.s = append(c.cs.s, strconv.FormatInt(stop, 10))
	return (JsonArrtrimStop)(c)
}

type JsonArrtrimStop Incomplete

func (c JsonArrtrimStop) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonClear Incomplete

func (b Builder) JsonClear() (c JsonClear) {
	c = JsonClear{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.CLEAR")
	return c
}

func (c JsonClear) Key(key string) JsonClearKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonClearKey)(c)
}

type JsonClearKey Incomplete

func (c JsonClearKey) Path(path string) JsonClearPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonClearPath)(c)
}

func (c JsonClearKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonClearPath Incomplete

func (c JsonClearPath) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonDebugHelp Incomplete

func (b Builder) JsonDebugHelp() (c JsonDebugHelp) {
	c = JsonDebugHelp{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.DEBUG", "HELP")
	return c
}

func (c JsonDebugHelp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonDebugMemory Incomplete

func (b Builder) JsonDebugMemory() (c JsonDebugMemory) {
	c = JsonDebugMemory{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.DEBUG", "MEMORY")
	return c
}

func (c JsonDebugMemory) Key(key string) JsonDebugMemoryKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonDebugMemoryKey)(c)
}

type JsonDebugMemoryKey Incomplete

func (c JsonDebugMemoryKey) Path(path string) JsonDebugMemoryPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonDebugMemoryPath)(c)
}

func (c JsonDebugMemoryKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonDebugMemoryPath Incomplete

func (c JsonDebugMemoryPath) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonDel Incomplete

func (b Builder) JsonDel() (c JsonDel) {
	c = JsonDel{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.DEL")
	return c
}

func (c JsonDel) Key(key string) JsonDelKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonDelKey)(c)
}

type JsonDelKey Incomplete

func (c JsonDelKey) Path(path string) JsonDelPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonDelPath)(c)
}

func (c JsonDelKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonDelPath Incomplete

func (c JsonDelPath) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonForget Incomplete

func (b Builder) JsonForget() (c JsonForget) {
	c = JsonForget{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.FORGET")
	return c
}

func (c JsonForget) Key(key string) JsonForgetKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonForgetKey)(c)
}

type JsonForgetKey Incomplete

func (c JsonForgetKey) Path(path string) JsonForgetPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonForgetPath)(c)
}

func (c JsonForgetKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonForgetPath Incomplete

func (c JsonForgetPath) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonGet Incomplete

func (b Builder) JsonGet() (c JsonGet) {
	c = JsonGet{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "JSON.GET")
	return c
}

func (c JsonGet) Key(key string) JsonGetKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonGetKey)(c)
}

type JsonGetIndent Incomplete

func (c JsonGetIndent) Newline(newline string) JsonGetNewline {
	c.cs.s = append(c.cs.s, "NEWLINE", newline)
	return (JsonGetNewline)(c)
}

func (c JsonGetIndent) Space(space string) JsonGetSpace {
	c.cs.s = append(c.cs.s, "SPACE", space)
	return (JsonGetSpace)(c)
}

func (c JsonGetIndent) Path(path ...string) JsonGetPath {
	c.cs.s = append(c.cs.s, path...)
	return (JsonGetPath)(c)
}

func (c JsonGetIndent) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonGetIndent) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonGetKey Incomplete

func (c JsonGetKey) Indent(indent string) JsonGetIndent {
	c.cs.s = append(c.cs.s, "INDENT", indent)
	return (JsonGetIndent)(c)
}

func (c JsonGetKey) Newline(newline string) JsonGetNewline {
	c.cs.s = append(c.cs.s, "NEWLINE", newline)
	return (JsonGetNewline)(c)
}

func (c JsonGetKey) Space(space string) JsonGetSpace {
	c.cs.s = append(c.cs.s, "SPACE", space)
	return (JsonGetSpace)(c)
}

func (c JsonGetKey) Path(path ...string) JsonGetPath {
	c.cs.s = append(c.cs.s, path...)
	return (JsonGetPath)(c)
}

func (c JsonGetKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonGetKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonGetNewline Incomplete

func (c JsonGetNewline) Space(space string) JsonGetSpace {
	c.cs.s = append(c.cs.s, "SPACE", space)
	return (JsonGetSpace)(c)
}

func (c JsonGetNewline) Path(path ...string) JsonGetPath {
	c.cs.s = append(c.cs.s, path...)
	return (JsonGetPath)(c)
}

func (c JsonGetNewline) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonGetNewline) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonGetPath Incomplete

func (c JsonGetPath) Path(path ...string) JsonGetPath {
	c.cs.s = append(c.cs.s, path...)
	return c
}

func (c JsonGetPath) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonGetPath) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonGetSpace Incomplete

func (c JsonGetSpace) Path(path ...string) JsonGetPath {
	c.cs.s = append(c.cs.s, path...)
	return (JsonGetPath)(c)
}

func (c JsonGetSpace) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonGetSpace) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonMerge Incomplete

func (b Builder) JsonMerge() (c JsonMerge) {
	c = JsonMerge{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.MERGE")
	return c
}

func (c JsonMerge) Key(key string) JsonMergeKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonMergeKey)(c)
}

type JsonMergeKey Incomplete

func (c JsonMergeKey) Path(path string) JsonMergePath {
	c.cs.s = append(c.cs.s, path)
	return (JsonMergePath)(c)
}

type JsonMergePath Incomplete

func (c JsonMergePath) Value(value string) JsonMergeValue {
	c.cs.s = append(c.cs.s, value)
	return (JsonMergeValue)(c)
}

type JsonMergeValue Incomplete

func (c JsonMergeValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonMget Incomplete

func (b Builder) JsonMget() (c JsonMget) {
	c = JsonMget{cs: get(), ks: b.ks, cf: int16(mtGetTag)}
	c.cs.s = append(c.cs.s, "JSON.MGET")
	return c
}

func (c JsonMget) Key(key ...string) JsonMgetKey {
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
	return (JsonMgetKey)(c)
}

type JsonMgetKey Incomplete

func (c JsonMgetKey) Key(key ...string) JsonMgetKey {
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

func (c JsonMgetKey) Path(path string) JsonMgetPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonMgetPath)(c)
}

type JsonMgetPath Incomplete

func (c JsonMgetPath) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonMgetPath) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonMset Incomplete

func (b Builder) JsonMset() (c JsonMset) {
	c = JsonMset{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.MSET")
	return c
}

func (c JsonMset) Key(key string) JsonMsetTripletKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonMsetTripletKey)(c)
}

type JsonMsetTripletKey Incomplete

func (c JsonMsetTripletKey) Path(path string) JsonMsetTripletPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonMsetTripletPath)(c)
}

type JsonMsetTripletPath Incomplete

func (c JsonMsetTripletPath) Value(value string) JsonMsetTripletValue {
	c.cs.s = append(c.cs.s, value)
	return (JsonMsetTripletValue)(c)
}

type JsonMsetTripletValue Incomplete

func (c JsonMsetTripletValue) Key(key string) JsonMsetTripletKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonMsetTripletKey)(c)
}

func (c JsonMsetTripletValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonNumincrby Incomplete

func (b Builder) JsonNumincrby() (c JsonNumincrby) {
	c = JsonNumincrby{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.NUMINCRBY")
	return c
}

func (c JsonNumincrby) Key(key string) JsonNumincrbyKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonNumincrbyKey)(c)
}

type JsonNumincrbyKey Incomplete

func (c JsonNumincrbyKey) Path(path string) JsonNumincrbyPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonNumincrbyPath)(c)
}

type JsonNumincrbyPath Incomplete

func (c JsonNumincrbyPath) Value(value float64) JsonNumincrbyValue {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(value, 'f', -1, 64))
	return (JsonNumincrbyValue)(c)
}

type JsonNumincrbyValue Incomplete

func (c JsonNumincrbyValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonNummultby Incomplete

func (b Builder) JsonNummultby() (c JsonNummultby) {
	c = JsonNummultby{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.NUMMULTBY")
	return c
}

func (c JsonNummultby) Key(key string) JsonNummultbyKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonNummultbyKey)(c)
}

type JsonNummultbyKey Incomplete

func (c JsonNummultbyKey) Path(path string) JsonNummultbyPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonNummultbyPath)(c)
}

type JsonNummultbyPath Incomplete

func (c JsonNummultbyPath) Value(value float64) JsonNummultbyValue {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(value, 'f', -1, 64))
	return (JsonNummultbyValue)(c)
}

type JsonNummultbyValue Incomplete

func (c JsonNummultbyValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonObjkeys Incomplete

func (b Builder) JsonObjkeys() (c JsonObjkeys) {
	c = JsonObjkeys{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "JSON.OBJKEYS")
	return c
}

func (c JsonObjkeys) Key(key string) JsonObjkeysKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonObjkeysKey)(c)
}

type JsonObjkeysKey Incomplete

func (c JsonObjkeysKey) Path(path string) JsonObjkeysPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonObjkeysPath)(c)
}

func (c JsonObjkeysKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonObjkeysKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonObjkeysPath Incomplete

func (c JsonObjkeysPath) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonObjkeysPath) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonObjlen Incomplete

func (b Builder) JsonObjlen() (c JsonObjlen) {
	c = JsonObjlen{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "JSON.OBJLEN")
	return c
}

func (c JsonObjlen) Key(key string) JsonObjlenKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonObjlenKey)(c)
}

type JsonObjlenKey Incomplete

func (c JsonObjlenKey) Path(path string) JsonObjlenPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonObjlenPath)(c)
}

func (c JsonObjlenKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonObjlenKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonObjlenPath Incomplete

func (c JsonObjlenPath) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonObjlenPath) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonResp Incomplete

func (b Builder) JsonResp() (c JsonResp) {
	c = JsonResp{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "JSON.RESP")
	return c
}

func (c JsonResp) Key(key string) JsonRespKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonRespKey)(c)
}

type JsonRespKey Incomplete

func (c JsonRespKey) Path(path string) JsonRespPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonRespPath)(c)
}

func (c JsonRespKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonRespKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonRespPath Incomplete

func (c JsonRespPath) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonRespPath) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonSet Incomplete

func (b Builder) JsonSet() (c JsonSet) {
	c = JsonSet{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.SET")
	return c
}

func (c JsonSet) Key(key string) JsonSetKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonSetKey)(c)
}

type JsonSetConditionNx Incomplete

func (c JsonSetConditionNx) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonSetConditionXx Incomplete

func (c JsonSetConditionXx) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonSetKey Incomplete

func (c JsonSetKey) Path(path string) JsonSetPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonSetPath)(c)
}

type JsonSetPath Incomplete

func (c JsonSetPath) Value(value string) JsonSetValue {
	c.cs.s = append(c.cs.s, value)
	return (JsonSetValue)(c)
}

type JsonSetValue Incomplete

func (c JsonSetValue) Nx() JsonSetConditionNx {
	c.cs.s = append(c.cs.s, "NX")
	return (JsonSetConditionNx)(c)
}

func (c JsonSetValue) Xx() JsonSetConditionXx {
	c.cs.s = append(c.cs.s, "XX")
	return (JsonSetConditionXx)(c)
}

func (c JsonSetValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonStrappend Incomplete

func (b Builder) JsonStrappend() (c JsonStrappend) {
	c = JsonStrappend{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.STRAPPEND")
	return c
}

func (c JsonStrappend) Key(key string) JsonStrappendKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonStrappendKey)(c)
}

type JsonStrappendKey Incomplete

func (c JsonStrappendKey) Path(path string) JsonStrappendPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonStrappendPath)(c)
}

func (c JsonStrappendKey) Value(value string) JsonStrappendValue {
	c.cs.s = append(c.cs.s, value)
	return (JsonStrappendValue)(c)
}

type JsonStrappendPath Incomplete

func (c JsonStrappendPath) Value(value string) JsonStrappendValue {
	c.cs.s = append(c.cs.s, value)
	return (JsonStrappendValue)(c)
}

type JsonStrappendValue Incomplete

func (c JsonStrappendValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonStrlen Incomplete

func (b Builder) JsonStrlen() (c JsonStrlen) {
	c = JsonStrlen{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "JSON.STRLEN")
	return c
}

func (c JsonStrlen) Key(key string) JsonStrlenKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonStrlenKey)(c)
}

type JsonStrlenKey Incomplete

func (c JsonStrlenKey) Path(path string) JsonStrlenPath {
	c.cs.s = append(c.cs.s, path)
	return (JsonStrlenPath)(c)
}

func (c JsonStrlenKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonStrlenKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonStrlenPath Incomplete

func (c JsonStrlenPath) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonStrlenPath) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonToggle Incomplete

func (b Builder) JsonToggle() (c JsonToggle) {
	c = JsonToggle{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "JSON.TOGGLE")
	return c
}

func (c JsonToggle) Key(key string) JsonToggleKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonToggleKey)(c)
}

type JsonToggleKey Incomplete

func (c JsonToggleKey) Path(path string) JsonTogglePath {
	c.cs.s = append(c.cs.s, path)
	return (JsonTogglePath)(c)
}

type JsonTogglePath Incomplete

func (c JsonTogglePath) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonType Incomplete

func (b Builder) JsonType() (c JsonType) {
	c = JsonType{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "JSON.TYPE")
	return c
}

func (c JsonType) Key(key string) JsonTypeKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (JsonTypeKey)(c)
}

type JsonTypeKey Incomplete

func (c JsonTypeKey) Path(path string) JsonTypePath {
	c.cs.s = append(c.cs.s, path)
	return (JsonTypePath)(c)
}

func (c JsonTypeKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonTypeKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type JsonTypePath Incomplete

func (c JsonTypePath) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c JsonTypePath) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
