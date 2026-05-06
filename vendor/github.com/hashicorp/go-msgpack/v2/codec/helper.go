// Copyright (c) 2012-2018 Ugorji Nwoke. All rights reserved.
// Use of this source code is governed by a MIT license found in the LICENSE file.

package codec

// Contains code shared by both encode and decode.

// Some shared ideas around encoding/decoding
// ------------------------------------------
//
// If an interface{} is passed, we first do a type assertion to see if it is
// a primitive type or a map/slice of primitive types, and use a fastpath to handle it.
//
// If we start with a reflect.Value, we are already in reflect.Value land and
// will try to grab the function for the underlying Type and directly call that function.
// This is more performant than calling reflect.Value.Interface().
//
// This still helps us bypass many layers of reflection, and give best performance.
//
// Containers
// ------------
// Containers in the stream are either associative arrays (key-value pairs) or
// regular arrays (indexed by incrementing integers).
//
// Some streams support indefinite-length containers, and use a breaking
// byte-sequence to denote that the container has come to an end.
//
// Some streams also are text-based, and use explicit separators to denote the
// end/beginning of different values.
//
// During encode, we use a high-level condition to determine how to iterate through
// the container. That decision is based on whether the container is text-based (with
// separators) or binary (without separators). If binary, we do not even call the
// encoding of separators.
//
// During decode, we use a different high-level condition to determine how to iterate
// through the containers. That decision is based on whether the stream contained
// a length prefix, or if it used explicit breaks. If length-prefixed, we assume that
// it has to be binary, and we do not even try to read separators.
//
// Philosophy
// ------------
// On decode, this codec will update containers appropriately:
//    - If struct, update fields from stream into fields of struct.
//      If field in stream not found in struct, handle appropriately (based on option).
//      If a struct field has no corresponding value in the stream, leave it AS IS.
//      If nil in stream, set value to nil/zero value.
//    - If map, update map from stream.
//      If the stream value is NIL, set the map to nil.
//    - if slice, try to update up to length of array in stream.
//      if container len is less than stream array length,
//      and container cannot be expanded, handled (based on option).
//      This means you can decode 4-element stream array into 1-element array.
//
// ------------------------------------
// On encode, user can specify omitEmpty. This means that the value will be omitted
// if the zero value. The problem may occur during decode, where omitted values do not affect
// the value being decoded into. This means that if decoding into a struct with an
// int field with current value=5, and the field is omitted in the stream, then after
// decoding, the value will still be 5 (not 0).
// omitEmpty only works if you guarantee that you always decode into zero-values.
//
// ------------------------------------
// We could have truncated a map to remove keys not available in the stream,
// or set values in the struct which are not in the stream to their zero values.
// We decided against it because there is no efficient way to do it.
// We may introduce it as an option later.
// However, that will require enabling it for both runtime and code generation modes.
//
// To support truncate, we need to do 2 passes over the container:
//   map
//   - first collect all keys (e.g. in k1)
//   - for each key in stream, mark k1 that the key should not be removed
//   - after updating map, do second pass and call delete for all keys in k1 which are not marked
//   struct:
//   - for each field, track the *typeInfo s1
//   - iterate through all s1, and for each one not marked, set value to zero
//   - this involves checking the possible anonymous fields which are nil ptrs.
//     too much work.
//
// ------------------------------------------
// Error Handling is done within the library using panic.
//
// This way, the code doesn't have to keep checking if an error has happened,
// and we don't have to keep sending the error value along with each call
// or storing it in the En|Decoder and checking it constantly along the way.
//
// The disadvantage is that small functions which use panics cannot be inlined.
// The code accounts for that by only using panics behind an interface;
// since interface calls cannot be inlined, this is irrelevant.
//
// We considered storing the error is En|Decoder.
//   - once it has its err field set, it cannot be used again.
//   - panicing will be optional, controlled by const flag.
//   - code should always check error first and return early.
// We eventually decided against it as it makes the code clumsier to always
// check for these error conditions.

import (
	"bytes"
	"encoding"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	scratchByteArrayLen = 32
	// initCollectionCap   = 16 // 32 is defensive. 16 is preferred.

	// Support encoding.(Binary|Text)(Unm|M)arshaler.
	// This constant flag will enable or disable it.
	supportMarshalInterfaces = true

	// for debugging, set this to false, to catch panic traces.
	// Note that this will always cause rpc tests to fail, since they need io.EOF sent via panic.
	recoverPanicToErr = true

	// arrayCacheLen is the length of the cache used in encoder or decoder for
	// allowing zero-alloc initialization.
	// arrayCacheLen = 8

	// size of the cacheline: defaulting to value for archs: amd64, arm64, 386
	// should use "runtime/internal/sys".CacheLineSize, but that is not exposed.
	cacheLineSize = 64

	wordSizeBits = 32 << (^uint(0) >> 63) // strconv.IntSize
	wordSize     = wordSizeBits / 8

	// so structFieldInfo fits into 8 bytes
	maxLevelsEmbedding = 14

	// useFinalizers=true configures finalizers to release pool'ed resources
	// acquired by Encoder/Decoder during their GC.
	//
	// Note that calling SetFinalizer is always expensive,
	// as code must be run on the systemstack even for SetFinalizer(t, nil).
	//
	// We document that folks SHOULD call Release() when done, or they can
	// explicitly call SetFinalizer themselves e.g.
	//    runtime.SetFinalizer(e, (*Encoder).Release)
	//    runtime.SetFinalizer(d, (*Decoder).Release)
	useFinalizers = false
)

var oneByteArr [1]byte
var zeroByteSlice = oneByteArr[:0:0]

var codecgen bool

var refBitset bitset256
var pool pooler
var panicv panicHdl

func init() {
	pool.init()

	refBitset.set(byte(reflect.Map))
	refBitset.set(byte(reflect.Ptr))
	refBitset.set(byte(reflect.Func))
	refBitset.set(byte(reflect.Chan))
}

type clsErr struct {
	closed    bool  // is it closed?
	errClosed error // error on closing
}

// type entryType uint8

// const (
// 	entryTypeBytes entryType = iota // make this 0, so a comparison is cheap
// 	entryTypeIo
// 	entryTypeBufio
// 	entryTypeUnset = 255
// )

type charEncoding uint8

const (
	_ charEncoding = iota // make 0 unset
	cUTF8
	cUTF16LE
	cUTF16BE
	cUTF32LE
	cUTF32BE
	// Deprecated: not a true char encoding value
	cRAW charEncoding = 255
)

// valueType is the stream type
type valueType uint8

const (
	valueTypeUnset valueType = iota
	valueTypeNil
	valueTypeInt
	valueTypeUint
	valueTypeFloat
	valueTypeBool
	valueTypeString
	valueTypeSymbol
	valueTypeBytes
	valueTypeMap
	valueTypeArray
	valueTypeTime
	valueTypeExt

	// valueTypeInvalid = 0xff
)

var valueTypeStrings = [...]string{
	"Unset",
	"Nil",
	"Int",
	"Uint",
	"Float",
	"Bool",
	"String",
	"Symbol",
	"Bytes",
	"Map",
	"Array",
	"Timestamp",
	"Ext",
}

func (x valueType) String() string {
	if int(x) < len(valueTypeStrings) {
		return valueTypeStrings[x]
	}
	return strconv.FormatInt(int64(x), 10)
}

type seqType uint8

const (
	_ seqType = iota
	seqTypeArray
	seqTypeSlice
	seqTypeChan
)

// note that containerMapStart and containerArraySend are not sent.
// This is because the ReadXXXStart and EncodeXXXStart already does these.
type containerState uint8

const (
	_ containerState = iota

	containerMapStart // slot left open, since Driver method already covers it
	containerMapKey
	containerMapValue
	containerMapEnd
	containerArrayStart // slot left open, since Driver methods already cover it
	containerArrayElem
	containerArrayEnd
)

// // sfiIdx used for tracking where a (field/enc)Name is seen in a []*structFieldInfo
// type sfiIdx struct {
// 	name  string
// 	index int
// }

// do not recurse if a containing type refers to an embedded type
// which refers back to its containing type (via a pointer).
// The second time this back-reference happens, break out,
// so as not to cause an infinite loop.
const rgetMaxRecursion = 2

// Anecdotally, we believe most types have <= 12 fields.
// - even Java's PMD rules set TooManyFields threshold to 15.
// However, go has embedded fields, which should be regarded as
// top level, allowing structs to possibly double or triple.
// In addition, we don't want to keep creating transient arrays,
// especially for the sfi index tracking, and the evtypes tracking.
//
// So - try to keep typeInfoLoadArray within 2K bytes
const (
	typeInfoLoadArraySfisLen   = 16
	typeInfoLoadArraySfiidxLen = 8 * 112
	typeInfoLoadArrayEtypesLen = 12
	typeInfoLoadArrayBLen      = 8 * 4
)

type typeInfoLoad struct {
	// fNames   []string
	// encNames []string
	etypes []uintptr
	sfis   []structFieldInfo
}

type typeInfoLoadArray struct {
	// fNames   [typeInfoLoadArrayLen]string
	// encNames [typeInfoLoadArrayLen]string
	sfis   [typeInfoLoadArraySfisLen]structFieldInfo
	sfiidx [typeInfoLoadArraySfiidxLen]byte
	etypes [typeInfoLoadArrayEtypesLen]uintptr
	b      [typeInfoLoadArrayBLen]byte // scratch - used for struct field names
}

// mirror json.Marshaler and json.Unmarshaler here,
// so we don't import the encoding/json package

type jsonMarshaler interface {
	MarshalJSON() ([]byte, error)
}
type jsonUnmarshaler interface {
	UnmarshalJSON([]byte) error
}

type isZeroer interface {
	IsZero() bool
}

type codecError struct {
	name string
	err  interface{}
}

func (e codecError) Cause() error {
	switch xerr := e.err.(type) {
	case nil:
		return nil
	case error:
		return xerr
	case string:
		return errors.New(xerr)
	case fmt.Stringer:
		return errors.New(xerr.String())
	default:
		return fmt.Errorf("%v", e.err)
	}
}

func (e codecError) Error() string {
	return fmt.Sprintf("%s error: %v", e.name, e.err)
}

// type byteAccepter func(byte) bool

var (
	bigen               = binary.BigEndian
	structInfoFieldName = "_struct"

	mapStrIntfTyp  = reflect.TypeOf(map[string]interface{}(nil))
	mapIntfIntfTyp = reflect.TypeOf(map[interface{}]interface{}(nil))
	intfSliceTyp   = reflect.TypeOf([]interface{}(nil))
	intfTyp        = intfSliceTyp.Elem()

	reflectValTyp = reflect.TypeOf((*reflect.Value)(nil)).Elem()

	stringTyp     = reflect.TypeOf("")
	timeTyp       = reflect.TypeOf(time.Time{})
	rawExtTyp     = reflect.TypeOf(RawExt{})
	rawTyp        = reflect.TypeOf(Raw{})
	uintptrTyp    = reflect.TypeOf(uintptr(0))
	uint8Typ      = reflect.TypeOf(uint8(0))
	uint8SliceTyp = reflect.TypeOf([]uint8(nil))
	uintTyp       = reflect.TypeOf(uint(0))
	intTyp        = reflect.TypeOf(int(0))

	mapBySliceTyp = reflect.TypeOf((*MapBySlice)(nil)).Elem()

	binaryMarshalerTyp   = reflect.TypeOf((*encoding.BinaryMarshaler)(nil)).Elem()
	binaryUnmarshalerTyp = reflect.TypeOf((*encoding.BinaryUnmarshaler)(nil)).Elem()

	textMarshalerTyp   = reflect.TypeOf((*encoding.TextMarshaler)(nil)).Elem()
	textUnmarshalerTyp = reflect.TypeOf((*encoding.TextUnmarshaler)(nil)).Elem()

	jsonMarshalerTyp   = reflect.TypeOf((*jsonMarshaler)(nil)).Elem()
	jsonUnmarshalerTyp = reflect.TypeOf((*jsonUnmarshaler)(nil)).Elem()

	selferTyp         = reflect.TypeOf((*Selfer)(nil)).Elem()
	missingFielderTyp = reflect.TypeOf((*MissingFielder)(nil)).Elem()
	iszeroTyp         = reflect.TypeOf((*isZeroer)(nil)).Elem()

	uint8TypId      = rt2id(uint8Typ)
	uint8SliceTypId = rt2id(uint8SliceTyp)
	rawExtTypId     = rt2id(rawExtTyp)
	rawTypId        = rt2id(rawTyp)
	intfTypId       = rt2id(intfTyp)
	timeTypId       = rt2id(timeTyp)
	stringTypId     = rt2id(stringTyp)

	mapStrIntfTypId  = rt2id(mapStrIntfTyp)
	mapIntfIntfTypId = rt2id(mapIntfIntfTyp)
	intfSliceTypId   = rt2id(intfSliceTyp)
	// mapBySliceTypId  = rt2id(mapBySliceTyp)

	intBitsize  = uint8(intTyp.Bits())
	uintBitsize = uint8(uintTyp.Bits())

	// bsAll0x00 = []byte{0, 0, 0, 0, 0, 0, 0, 0}
	bsAll0xff = []byte{0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff}

	chkOvf checkOverflow

	errNoFieldNameToStructFieldInfo = errors.New("no field name passed to parseStructFieldInfo")
)

var defTypeInfos = NewTypeInfos([]string{"codec", "json"})

var immutableKindsSet = [32]bool{
	// reflect.Invalid:  ,
	reflect.Bool:       true,
	reflect.Int:        true,
	reflect.Int8:       true,
	reflect.Int16:      true,
	reflect.Int32:      true,
	reflect.Int64:      true,
	reflect.Uint:       true,
	reflect.Uint8:      true,
	reflect.Uint16:     true,
	reflect.Uint32:     true,
	reflect.Uint64:     true,
	reflect.Uintptr:    true,
	reflect.Float32:    true,
	reflect.Float64:    true,
	reflect.Complex64:  true,
	reflect.Complex128: true,
	// reflect.Array
	// reflect.Chan
	// reflect.Func: true,
	// reflect.Interface
	// reflect.Map
	// reflect.Ptr
	// reflect.Slice
	reflect.String: true,
	reflect.Struct: true,
	// reflect.UnsafePointer
}

// Selfer defines methods by which a value can encode or decode itself.
//
// Any type which implements Selfer will be able to encode or decode itself.
// Consequently, during (en|de)code, this takes precedence over
// (text|binary)(M|Unm)arshal or extension support.
//
// By definition, it is not allowed for a Selfer to directly call Encode or Decode on itself.
// If that is done, Encode/Decode will rightfully fail with a Stack Overflow style error.
// For example, the snippet below will cause such an error.
//
//	type testSelferRecur struct{}
//	func (s *testSelferRecur) CodecEncodeSelf(e *Encoder) { e.MustEncode(s) }
//	func (s *testSelferRecur) CodecDecodeSelf(d *Decoder) { d.MustDecode(s) }
//
// Note: *the first set of bytes of any value MUST NOT represent nil in the format*.
// This is because, during each decode, we first check the the next set of bytes
// represent nil, and if so, we just set the value to nil.
type Selfer interface {
	CodecEncodeSelf(*Encoder)
	CodecDecodeSelf(*Decoder)
}

// MissingFielder defines the interface allowing structs to internally decode or encode
// values which do not map to struct fields.
//
// We expect that this interface is bound to a pointer type (so the mutation function works).
//
// A use-case is if a version of a type unexports a field, but you want compatibility between
// both versions during encoding and decoding.
//
// Note that the interface is completely ignored during codecgen.
type MissingFielder interface {
	// CodecMissingField is called to set a missing field and value pair.
	//
	// It returns true if the missing field was set on the struct.
	CodecMissingField(field []byte, value interface{}) bool

	// CodecMissingFields returns the set of fields which are not struct fields
	CodecMissingFields() map[string]interface{}
}

// MapBySlice is a tag interface that denotes wrapped slice should encode as a map in the stream.
// The slice contains a sequence of key-value pairs.
// This affords storing a map in a specific sequence in the stream.
//
// Example usage:
//
//	type T1 []string         // or []int or []Point or any other "slice" type
//	func (_ T1) MapBySlice{} // T1 now implements MapBySlice, and will be encoded as a map
//	type T2 struct { KeyValues T1 }
//
//	var kvs = []string{"one", "1", "two", "2", "three", "3"}
//	var v2 = T2{ KeyValues: T1(kvs) }
//	// v2 will be encoded like the map: {"KeyValues": {"one": "1", "two": "2", "three": "3"} }
//
// The support of MapBySlice affords the following:
//   - A slice type which implements MapBySlice will be encoded as a map
//   - A slice can be decoded from a map in the stream
//   - It MUST be a slice type (not a pointer receiver) that implements MapBySlice
type MapBySlice interface {
	MapBySlice()
}

// BasicHandle encapsulates the common options and extension functions.
//
// Deprecated: DO NOT USE DIRECTLY. EXPORTED FOR GODOC BENEFIT. WILL BE REMOVED.
type BasicHandle struct {
	// BasicHandle is always a part of a different type.
	// It doesn't have to fit into it own cache lines.

	// TypeInfos is used to get the type info for any type.
	//
	// If not configured, the default TypeInfos is used, which uses struct tag keys: codec, json
	TypeInfos *TypeInfos

	// Note: BasicHandle is not comparable, due to these slices here (extHandle, intf2impls).
	// If *[]T is used instead, this becomes comparable, at the cost of extra indirection.
	// Thses slices are used all the time, so keep as slices (not pointers).

	extHandle

	intf2impls

	inited uint32
	_      uint32 // padding

	// ---- cache line

	RPCOptions

	// TimeNotBuiltin configures whether time.Time should be treated as a builtin type.
	//
	// All Handlers should know how to encode/decode time.Time as part of the core
	// format specification, or as a standard extension defined by the format.
	//
	// However, users can elect to handle time.Time as a custom extension, or via the
	// standard library's encoding.Binary(M|Unm)arshaler or Text(M|Unm)arshaler interface.
	// To elect this behavior, users can set TimeNotBuiltin=true.
	// Note: Setting TimeNotBuiltin=true can be used to enable the legacy behavior
	// (for Cbor and Msgpack), where time.Time was not a builtin supported type.
	TimeNotBuiltin bool

	// ExplicitRelease configures whether Release() is implicitly called after an encode or
	// decode call.
	//
	// If you will hold onto an Encoder or Decoder for re-use, by calling Reset(...)
	// on it or calling (Must)Encode repeatedly into a given []byte or io.Writer,
	// then you do not want it to be implicitly closed after each Encode/Decode call.
	// Doing so will unnecessarily return resources to the shared pool, only for you to
	// grab them right after again to do another Encode/Decode call.
	//
	// Instead, you configure ExplicitRelease=true, and you explicitly call Release() when
	// you are truly done.
	//
	// As an alternative, you can explicitly set a finalizer - so its resources
	// are returned to the shared pool before it is garbage-collected. Do it as below:
	//    runtime.SetFinalizer(e, (*Encoder).Release)
	//    runtime.SetFinalizer(d, (*Decoder).Release)
	ExplicitRelease bool

	be bool   // is handle a binary encoding?
	js bool   // is handle javascript handler?
	n  byte   // first letter of handle name
	_  uint16 // padding

	// ---- cache line

	DecodeOptions

	// ---- cache line

	EncodeOptions

	// noBuiltInTypeChecker

	rtidFns atomicRtidFnSlice
	mu      sync.Mutex
	// r []uintptr     // rtids mapped to s above
}

// basicHandle returns an initialized BasicHandle from the Handle.
func basicHandle(hh Handle) (x *BasicHandle) {
	x = hh.getBasicHandle()
	// ** We need to simulate once.Do, to ensure no data race within the block.
	// ** Consequently, below would not work.
	// if atomic.CompareAndSwapUint32(&x.inited, 0, 1) {
	// 	x.be = hh.isBinary()
	// 	_, x.js = hh.(*JsonHandle)
	// 	x.n = hh.Name()[0]
	// }

	// simulate once.Do using our own stored flag and mutex as a CompareAndSwap
	// is not sufficient, since a race condition can occur within init(Handle) function.
	// init is made noinline, so that this function can be inlined by its caller.
	if atomic.LoadUint32(&x.inited) == 0 {
		x.init(hh)
	}
	return
}

//go:noinline
func (x *BasicHandle) init(hh Handle) {
	// make it uninlineable, as it is called at most once
	x.mu.Lock()
	if x.inited == 0 {
		x.be = hh.isBinary()
		_, x.js = hh.(*JsonHandle)
		x.n = hh.Name()[0]
		atomic.StoreUint32(&x.inited, 1)
	}
	x.mu.Unlock()
}

func (x *BasicHandle) getBasicHandle() *BasicHandle {
	return x
}

func (x *BasicHandle) getTypeInfo(rtid uintptr, rt reflect.Type) (pti *typeInfo) {
	if x.TypeInfos == nil {
		return defTypeInfos.get(rtid, rt)
	}
	return x.TypeInfos.get(rtid, rt)
}

func findFn(s []codecRtidFn, rtid uintptr) (i uint, fn *codecFn) {
	// binary search. adapted from sort/search.go.
	// Note: we use goto (instead of for loop) so this can be inlined.

	// h, i, j := 0, 0, len(s)
	var h uint // var h, i uint
	var j = uint(len(s))
LOOP:
	if i < j {
		h = i + (j-i)/2
		if s[h].rtid < rtid {
			i = h + 1
		} else {
			j = h
		}
		goto LOOP
	}
	if i < uint(len(s)) && s[i].rtid == rtid {
		fn = s[i].fn
	}
	return
}

func (x *BasicHandle) fn(rt reflect.Type, checkFastpath, checkCodecSelfer bool) (fn *codecFn) {
	rtid := rt2id(rt)
	sp := x.rtidFns.load()
	if sp != nil {
		if _, fn = findFn(sp, rtid); fn != nil {
			// xdebugf("<<<< %c: found fn for %v in rtidfns of size: %v", c.n, rt, len(sp))
			return
		}
	}
	c := x
	// xdebugf("#### for %c: load fn for %v in rtidfns of size: %v", c.n, rt, len(sp))
	fn = new(codecFn)
	fi := &(fn.i)
	ti := c.getTypeInfo(rtid, rt)
	fi.ti = ti

	rk := reflect.Kind(ti.kind)

	if checkCodecSelfer && (ti.cs || ti.csp) {
		fn.fe = (*Encoder).selferMarshal
		fn.fd = (*Decoder).selferUnmarshal
		fi.addrF = true
		fi.addrD = ti.csp
		fi.addrE = ti.csp
	} else if rtid == timeTypId && !c.TimeNotBuiltin {
		fn.fe = (*Encoder).kTime
		fn.fd = (*Decoder).kTime
	} else if rtid == rawTypId {
		fn.fe = (*Encoder).raw
		fn.fd = (*Decoder).raw
	} else if rtid == rawExtTypId {
		fn.fe = (*Encoder).rawExt
		fn.fd = (*Decoder).rawExt
		fi.addrF = true
		fi.addrD = true
		fi.addrE = true
	} else if xfFn := c.getExt(rtid); xfFn != nil {
		fi.xfTag, fi.xfFn = xfFn.tag, xfFn.ext
		fn.fe = (*Encoder).ext
		fn.fd = (*Decoder).ext
		fi.addrF = true
		fi.addrD = true
		if rk == reflect.Struct || rk == reflect.Array {
			fi.addrE = true
		}
	} else if supportMarshalInterfaces && c.be && (ti.bm || ti.bmp) && (ti.bu || ti.bup) {
		fn.fe = (*Encoder).binaryMarshal
		fn.fd = (*Decoder).binaryUnmarshal
		fi.addrF = true
		fi.addrD = ti.bup
		fi.addrE = ti.bmp
	} else if supportMarshalInterfaces && !c.be && c.js && (ti.jm || ti.jmp) && (ti.ju || ti.jup) {
		//If JSON, we should check JSONMarshal before textMarshal
		fn.fe = (*Encoder).jsonMarshal
		fn.fd = (*Decoder).jsonUnmarshal
		fi.addrF = true
		fi.addrD = ti.jup
		fi.addrE = ti.jmp
	} else if supportMarshalInterfaces && !c.be && (ti.tm || ti.tmp) && (ti.tu || ti.tup) {
		fn.fe = (*Encoder).textMarshal
		fn.fd = (*Decoder).textUnmarshal
		fi.addrF = true
		fi.addrD = ti.tup
		fi.addrE = ti.tmp
	} else {
		if fastpathEnabled && checkFastpath && (rk == reflect.Map || rk == reflect.Slice) {
			if ti.pkgpath == "" { // un-named slice or map
				if idx := fastpathAV.index(rtid); idx != -1 {
					fn.fe = fastpathAV[idx].encfn
					fn.fd = fastpathAV[idx].decfn
					fi.addrD = true
					fi.addrF = false
				}
			} else {
				// use mapping for underlying type if there
				var rtu reflect.Type
				if rk == reflect.Map {
					rtu = reflect.MapOf(ti.key, ti.elem)
				} else {
					rtu = reflect.SliceOf(ti.elem)
				}
				rtuid := rt2id(rtu)
				if idx := fastpathAV.index(rtuid); idx != -1 {
					xfnf := fastpathAV[idx].encfn
					xrt := fastpathAV[idx].rt
					fn.fe = func(e *Encoder, xf *codecFnInfo, xrv reflect.Value) {
						xfnf(e, xf, xrv.Convert(xrt))
					}
					fi.addrD = true
					fi.addrF = false // meaning it can be an address(ptr) or a value
					xfnf2 := fastpathAV[idx].decfn
					fn.fd = func(d *Decoder, xf *codecFnInfo, xrv reflect.Value) {
						if xrv.Kind() == reflect.Ptr {
							xfnf2(d, xf, xrv.Convert(reflect.PtrTo(xrt)))
						} else {
							xfnf2(d, xf, xrv.Convert(xrt))
						}
					}
				}
			}
		}
		if fn.fe == nil && fn.fd == nil {
			switch rk {
			case reflect.Bool:
				fn.fe = (*Encoder).kBool
				fn.fd = (*Decoder).kBool
			case reflect.String:
				fn.fe = (*Encoder).kString
				fn.fd = (*Decoder).kString
			case reflect.Int:
				fn.fd = (*Decoder).kInt
				fn.fe = (*Encoder).kInt
			case reflect.Int8:
				fn.fe = (*Encoder).kInt8
				fn.fd = (*Decoder).kInt8
			case reflect.Int16:
				fn.fe = (*Encoder).kInt16
				fn.fd = (*Decoder).kInt16
			case reflect.Int32:
				fn.fe = (*Encoder).kInt32
				fn.fd = (*Decoder).kInt32
			case reflect.Int64:
				fn.fe = (*Encoder).kInt64
				fn.fd = (*Decoder).kInt64
			case reflect.Uint:
				fn.fd = (*Decoder).kUint
				fn.fe = (*Encoder).kUint
			case reflect.Uint8:
				fn.fe = (*Encoder).kUint8
				fn.fd = (*Decoder).kUint8
			case reflect.Uint16:
				fn.fe = (*Encoder).kUint16
				fn.fd = (*Decoder).kUint16
			case reflect.Uint32:
				fn.fe = (*Encoder).kUint32
				fn.fd = (*Decoder).kUint32
			case reflect.Uint64:
				fn.fe = (*Encoder).kUint64
				fn.fd = (*Decoder).kUint64
			case reflect.Uintptr:
				fn.fe = (*Encoder).kUintptr
				fn.fd = (*Decoder).kUintptr
			case reflect.Float32:
				fn.fe = (*Encoder).kFloat32
				fn.fd = (*Decoder).kFloat32
			case reflect.Float64:
				fn.fe = (*Encoder).kFloat64
				fn.fd = (*Decoder).kFloat64
			case reflect.Invalid:
				fn.fe = (*Encoder).kInvalid
				fn.fd = (*Decoder).kErr
			case reflect.Chan:
				fi.seq = seqTypeChan
				fn.fe = (*Encoder).kSlice
				fn.fd = (*Decoder).kSlice
			case reflect.Slice:
				fi.seq = seqTypeSlice
				fn.fe = (*Encoder).kSlice
				fn.fd = (*Decoder).kSlice
			case reflect.Array:
				fi.seq = seqTypeArray
				fn.fe = (*Encoder).kSlice
				fi.addrF = false
				fi.addrD = false
				rt2 := reflect.SliceOf(ti.elem)
				fn.fd = func(d *Decoder, xf *codecFnInfo, xrv reflect.Value) {
					d.h.fn(rt2, true, false).fd(d, xf, xrv.Slice(0, xrv.Len()))
				}
				// fn.fd = (*Decoder).kArray
			case reflect.Struct:
				if ti.anyOmitEmpty || ti.mf || ti.mfp {
					fn.fe = (*Encoder).kStruct
				} else {
					fn.fe = (*Encoder).kStructNoOmitempty
				}
				fn.fd = (*Decoder).kStruct
			case reflect.Map:
				fn.fe = (*Encoder).kMap
				fn.fd = (*Decoder).kMap
			case reflect.Interface:
				// encode: reflect.Interface are handled already by preEncodeValue
				fn.fd = (*Decoder).kInterface
				fn.fe = (*Encoder).kErr
			default:
				// reflect.Ptr and reflect.Interface are handled already by preEncodeValue
				fn.fe = (*Encoder).kErr
				fn.fd = (*Decoder).kErr
			}
		}
	}

	c.mu.Lock()
	var sp2 []codecRtidFn
	sp = c.rtidFns.load()
	if sp == nil {
		sp2 = []codecRtidFn{{rtid, fn}}
		c.rtidFns.store(sp2)
		// xdebugf(">>>> adding rt: %v to rtidfns of size: %v", rt, len(sp2))
		// xdebugf(">>>> loading stored rtidfns of size: %v", len(c.rtidFns.load()))
	} else {
		idx, fn2 := findFn(sp, rtid)
		if fn2 == nil {
			sp2 = make([]codecRtidFn, len(sp)+1)
			copy(sp2, sp[:idx])
			copy(sp2[idx+1:], sp[idx:])
			sp2[idx] = codecRtidFn{rtid, fn}
			c.rtidFns.store(sp2)
			// xdebugf(">>>> adding rt: %v to rtidfns of size: %v", rt, len(sp2))

		}
	}
	c.mu.Unlock()
	return
}

// Handle defines a specific encoding format. It also stores any runtime state
// used during an Encoding or Decoding session e.g. stored state about Types, etc.
//
// Once a handle is configured, it can be shared across multiple Encoders and Decoders.
//
// Note that a Handle is NOT safe for concurrent modification.
// Consequently, do not modify it after it is configured if shared among
// multiple Encoders and Decoders in different goroutines.
//
// Consequently, the typical usage model is that a Handle is pre-configured
// before first time use, and not modified while in use.
// Such a pre-configured Handle is safe for concurrent access.
type Handle interface {
	Name() string
	// return the basic handle. It may not have been inited.
	// Prefer to use basicHandle() helper function that ensures it has been inited.
	getBasicHandle() *BasicHandle
	recreateEncDriver(encDriver) bool
	newEncDriver(w *Encoder) encDriver
	newDecDriver(r *Decoder) decDriver
	isBinary() bool
	hasElemSeparators() bool
	// IsBuiltinType(rtid uintptr) bool
}

// Raw represents raw formatted bytes.
// We "blindly" store it during encode and retrieve the raw bytes during decode.
// Note: it is dangerous during encode, so we may gate the behaviour
// behind an Encode flag which must be explicitly set.
type Raw []byte

// RawExt represents raw unprocessed extension data.
// Some codecs will decode extension data as a *RawExt
// if there is no registered extension for the tag.
//
// Only one of Data or Value is nil.
// If Data is nil, then the content of the RawExt is in the Value.
type RawExt struct {
	Tag uint64
	// Data is the []byte which represents the raw ext. If nil, ext is exposed in Value.
	// Data is used by codecs (e.g. binc, msgpack, simple) which do custom serialization of types
	Data []byte
	// Value represents the extension, if Data is nil.
	// Value is used by codecs (e.g. cbor, json) which leverage the format to do
	// custom serialization of the types.
	Value interface{}
}

// BytesExt handles custom (de)serialization of types to/from []byte.
// It is used by codecs (e.g. binc, msgpack, simple) which do custom serialization of the types.
type BytesExt interface {
	// WriteExt converts a value to a []byte.
	//
	// Note: v is a pointer iff the registered extension type is a struct or array kind.
	WriteExt(v interface{}) []byte

	// ReadExt updates a value from a []byte.
	//
	// Note: dst is always a pointer kind to the registered extension type.
	ReadExt(dst interface{}, src []byte)
}

// InterfaceExt handles custom (de)serialization of types to/from another interface{} value.
// The Encoder or Decoder will then handle the further (de)serialization of that known type.
//
// It is used by codecs (e.g. cbor, json) which use the format to do custom serialization of types.
type InterfaceExt interface {
	// ConvertExt converts a value into a simpler interface for easy encoding
	// e.g. convert time.Time to int64.
	//
	// Note: v is a pointer iff the registered extension type is a struct or array kind.
	ConvertExt(v interface{}) interface{}

	// UpdateExt updates a value from a simpler interface for easy decoding
	// e.g. convert int64 to time.Time.
	//
	// Note: dst is always a pointer kind to the registered extension type.
	UpdateExt(dst interface{}, src interface{})
}

// Ext handles custom (de)serialization of custom types / extensions.
type Ext interface {
	BytesExt
	InterfaceExt
}

// addExtWrapper is a wrapper implementation to support former AddExt exported method.
type addExtWrapper struct {
	encFn func(reflect.Value) ([]byte, error)
	decFn func(reflect.Value, []byte) error
}

func (x addExtWrapper) WriteExt(v interface{}) []byte {
	bs, err := x.encFn(reflect.ValueOf(v))
	if err != nil {
		panic(err)
	}
	return bs
}

func (x addExtWrapper) ReadExt(v interface{}, bs []byte) {
	if err := x.decFn(reflect.ValueOf(v), bs); err != nil {
		panic(err)
	}
}

func (x addExtWrapper) ConvertExt(v interface{}) interface{} {
	return x.WriteExt(v)
}

func (x addExtWrapper) UpdateExt(dest interface{}, v interface{}) {
	x.ReadExt(dest, v.([]byte))
}

type extWrapper struct {
	BytesExt
	InterfaceExt
}

type bytesExtFailer struct{}

func (bytesExtFailer) WriteExt(v interface{}) []byte {
	panicv.errorstr("BytesExt.WriteExt is not supported")
	return nil
}
func (bytesExtFailer) ReadExt(v interface{}, bs []byte) {
	panicv.errorstr("BytesExt.ReadExt is not supported")
}

type interfaceExtFailer struct{}

func (interfaceExtFailer) ConvertExt(v interface{}) interface{} {
	panicv.errorstr("InterfaceExt.ConvertExt is not supported")
	return nil
}
func (interfaceExtFailer) UpdateExt(dest interface{}, v interface{}) {
	panicv.errorstr("InterfaceExt.UpdateExt is not supported")
}

type binaryEncodingType struct{}

func (binaryEncodingType) isBinary() bool { return true }

type textEncodingType struct{}

func (textEncodingType) isBinary() bool { return false }

// noBuiltInTypes is embedded into many types which do not support builtins
// e.g. msgpack, simple, cbor.

// type noBuiltInTypeChecker struct{}
// func (noBuiltInTypeChecker) IsBuiltinType(rt uintptr) bool { return false }
// type noBuiltInTypes struct{ noBuiltInTypeChecker }

type noBuiltInTypes struct{}

func (noBuiltInTypes) EncodeBuiltin(rt uintptr, v interface{}) {}
func (noBuiltInTypes) DecodeBuiltin(rt uintptr, v interface{}) {}

// type noStreamingCodec struct{}
// func (noStreamingCodec) CheckBreak() bool { return false }
// func (noStreamingCodec) hasElemSeparators() bool { return false }

type noElemSeparators struct{}

func (noElemSeparators) hasElemSeparators() (v bool)            { return }
func (noElemSeparators) recreateEncDriver(e encDriver) (v bool) { return }

// bigenHelper.
// Users must already slice the x completely, because we will not reslice.
type bigenHelper struct {
	x []byte // must be correctly sliced to appropriate len. slicing is a cost.
	w *encWriterSwitch
}

func (z bigenHelper) writeUint16(v uint16) {
	bigen.PutUint16(z.x, v)
	z.w.writeb(z.x)
}

func (z bigenHelper) writeUint32(v uint32) {
	bigen.PutUint32(z.x, v)
	z.w.writeb(z.x)
}

func (z bigenHelper) writeUint64(v uint64) {
	bigen.PutUint64(z.x, v)
	z.w.writeb(z.x)
}

type extTypeTagFn struct {
	rtid     uintptr
	rtidptr  uintptr
	rt       reflect.Type
	tag      uint64
	ext      Ext
	_padding [1]uint64 // padding
}

type extHandle []extTypeTagFn

// AddExt registes an encode and decode function for a reflect.Type.
// To deregister an Ext, call AddExt with nil encfn and/or nil decfn.
//
// Deprecated: Use SetBytesExt or SetInterfaceExt on the Handle instead.
func (o *extHandle) AddExt(rt reflect.Type, tag byte,
	encfn func(reflect.Value) ([]byte, error),
	decfn func(reflect.Value, []byte) error) (err error) {
	if encfn == nil || decfn == nil {
		return o.SetExt(rt, uint64(tag), nil)
	}
	return o.SetExt(rt, uint64(tag), addExtWrapper{encfn, decfn})
}

// SetExt will set the extension for a tag and reflect.Type.
// Note that the type must be a named type, and specifically not a pointer or Interface.
// An error is returned if that is not honored.
// To Deregister an ext, call SetExt with nil Ext.
//
// Deprecated: Use SetBytesExt or SetInterfaceExt on the Handle instead.
func (o *extHandle) SetExt(rt reflect.Type, tag uint64, ext Ext) (err error) {
	// o is a pointer, because we may need to initialize it
	rk := rt.Kind()
	for rk == reflect.Ptr {
		rt = rt.Elem()
		rk = rt.Kind()
	}

	if rt.PkgPath() == "" || rk == reflect.Interface { // || rk == reflect.Ptr {
		return fmt.Errorf("codec.Handle.SetExt: Takes named type, not a pointer or interface: %v", rt)
	}

	rtid := rt2id(rt)
	switch rtid {
	case timeTypId, rawTypId, rawExtTypId:
		// all natively supported type, so cannot have an extension
		return // TODO: should we silently ignore, or return an error???
	}
	o2 := *o
	for i := range o2 {
		v := &o2[i]
		if v.rtid == rtid {
			v.tag, v.ext = tag, ext
			return
		}
	}
	rtidptr := rt2id(reflect.PtrTo(rt))
	*o = append(o2, extTypeTagFn{rtid, rtidptr, rt, tag, ext, [1]uint64{}})
	return
}

func (o extHandle) getExt(rtid uintptr) (v *extTypeTagFn) {
	for i := range o {
		v = &o[i]
		if v.rtid == rtid || v.rtidptr == rtid {
			return
		}
	}
	return nil
}

func (o extHandle) getExtForTag(tag uint64) (v *extTypeTagFn) {
	for i := range o {
		v = &o[i]
		if v.tag == tag {
			return
		}
	}
	return nil
}

type intf2impl struct {
	rtid uintptr // for intf
	impl reflect.Type
	// _    [1]uint64 // padding // not-needed, as *intf2impl is never returned.
}

type intf2impls []intf2impl

// Intf2Impl maps an interface to an implementing type.
// This allows us support infering the concrete type
// and populating it when passed an interface.
// e.g. var v io.Reader can be decoded as a bytes.Buffer, etc.
//
// Passing a nil impl will clear the mapping.
func (o *intf2impls) Intf2Impl(intf, impl reflect.Type) (err error) {
	if impl != nil && !impl.Implements(intf) {
		return fmt.Errorf("Intf2Impl: %v does not implement %v", impl, intf)
	}
	rtid := rt2id(intf)
	o2 := *o
	for i := range o2 {
		v := &o2[i]
		if v.rtid == rtid {
			v.impl = impl
			return
		}
	}
	*o = append(o2, intf2impl{rtid, impl})
	return
}

func (o intf2impls) intf2impl(rtid uintptr) (rv reflect.Value) {
	for i := range o {
		v := &o[i]
		if v.rtid == rtid {
			if v.impl == nil {
				return
			}
			if v.impl.Kind() == reflect.Ptr {
				return reflect.New(v.impl.Elem())
			}
			return reflect.New(v.impl).Elem()
		}
	}
	return
}

type structFieldInfoFlag uint8

const (
	_ structFieldInfoFlag = 1 << iota
	structFieldInfoFlagReady
	structFieldInfoFlagOmitEmpty
)

func (x *structFieldInfoFlag) flagSet(f structFieldInfoFlag) {
	*x = *x | f
}

func (x *structFieldInfoFlag) flagClr(f structFieldInfoFlag) {
	*x = *x &^ f
}

func (x structFieldInfoFlag) flagGet(f structFieldInfoFlag) bool {
	return x&f != 0
}

func (x structFieldInfoFlag) omitEmpty() bool {
	return x.flagGet(structFieldInfoFlagOmitEmpty)
}

func (x structFieldInfoFlag) ready() bool {
	return x.flagGet(structFieldInfoFlagReady)
}

type structFieldInfo struct {
	encName   string // encode name
	fieldName string // field name

	is  [maxLevelsEmbedding]uint16 // (recursive/embedded) field index in struct
	nis uint8                      // num levels of embedding. if 1, then it's not embedded.

	encNameAsciiAlphaNum bool // the encName only contains ascii alphabet and numbers
	structFieldInfoFlag
	_ [1]byte // padding
}

func (si *structFieldInfo) setToZeroValue(v reflect.Value) {
	if v, valid := si.field(v, false); valid {
		v.Set(reflect.Zero(v.Type()))
	}
}

// rv returns the field of the struct.
// If anonymous, it returns an Invalid
func (si *structFieldInfo) field(v reflect.Value, update bool) (rv2 reflect.Value, valid bool) {
	// replicate FieldByIndex
	for i, x := range si.is {
		if uint8(i) == si.nis {
			break
		}
		if v, valid = baseStructRv(v, update); !valid {
			return
		}
		v = v.Field(int(x))
	}

	return v, true
}

// func (si *structFieldInfo) fieldval(v reflect.Value, update bool) reflect.Value {
// 	v, _ = si.field(v, update)
// 	return v
// }

func parseStructInfo(stag string) (toArray, omitEmpty bool, keytype valueType) {
	keytype = valueTypeString // default
	if stag == "" {
		return
	}
	for i, s := range strings.Split(stag, ",") {
		if i == 0 {
		} else {
			switch s {
			case "omitempty":
				omitEmpty = true
			case "toarray":
				toArray = true
			case "int":
				keytype = valueTypeInt
			case "uint":
				keytype = valueTypeUint
			case "float":
				keytype = valueTypeFloat
				// case "bool":
				// 	keytype = valueTypeBool
			case "string":
				keytype = valueTypeString
			}
		}
	}
	return
}

func (si *structFieldInfo) parseTag(stag string) {
	// if fname == "" {
	// 	panic(errNoFieldNameToStructFieldInfo)
	// }

	if stag == "" {
		return
	}
	for i, s := range strings.Split(stag, ",") {
		if i == 0 {
			if s != "" {
				si.encName = s
			}
		} else {
			switch s {
			case "omitempty":
				si.flagSet(structFieldInfoFlagOmitEmpty)
				// si.omitEmpty = true
				// case "toarray":
				// 	si.toArray = true
			}
		}
	}
}

type sfiSortedByEncName []*structFieldInfo

func (p sfiSortedByEncName) Len() int           { return len(p) }
func (p sfiSortedByEncName) Less(i, j int) bool { return p[uint(i)].encName < p[uint(j)].encName }
func (p sfiSortedByEncName) Swap(i, j int)      { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

const structFieldNodeNumToCache = 4

type structFieldNodeCache struct {
	rv  [structFieldNodeNumToCache]reflect.Value
	idx [structFieldNodeNumToCache]uint32
	num uint8
}

func (x *structFieldNodeCache) get(key uint32) (fv reflect.Value, valid bool) {
	for i, k := range &x.idx {
		if uint8(i) == x.num {
			return // break
		}
		if key == k {
			return x.rv[i], true
		}
	}
	return
}

func (x *structFieldNodeCache) tryAdd(fv reflect.Value, key uint32) {
	if x.num < structFieldNodeNumToCache {
		x.rv[x.num] = fv
		x.idx[x.num] = key
		x.num++
		return
	}
}

type structFieldNode struct {
	v      reflect.Value
	cache2 structFieldNodeCache
	cache3 structFieldNodeCache
	update bool
}

func (x *structFieldNode) field(si *structFieldInfo) (fv reflect.Value) {
	// return si.fieldval(x.v, x.update)
	// Note: we only cache if nis=2 or nis=3 i.e. up to 2 levels of embedding
	// This mostly saves us time on the repeated calls to v.Elem, v.Field, etc.
	var valid bool
	switch si.nis {
	case 1:
		fv = x.v.Field(int(si.is[0]))
	case 2:
		if fv, valid = x.cache2.get(uint32(si.is[0])); valid {
			fv = fv.Field(int(si.is[1]))
			return
		}
		fv = x.v.Field(int(si.is[0]))
		if fv, valid = baseStructRv(fv, x.update); !valid {
			return
		}
		x.cache2.tryAdd(fv, uint32(si.is[0]))
		fv = fv.Field(int(si.is[1]))
	case 3:
		var key uint32 = uint32(si.is[0])<<16 | uint32(si.is[1])
		if fv, valid = x.cache3.get(key); valid {
			fv = fv.Field(int(si.is[2]))
			return
		}
		fv = x.v.Field(int(si.is[0]))
		if fv, valid = baseStructRv(fv, x.update); !valid {
			return
		}
		fv = fv.Field(int(si.is[1]))
		if fv, valid = baseStructRv(fv, x.update); !valid {
			return
		}
		x.cache3.tryAdd(fv, key)
		fv = fv.Field(int(si.is[2]))
	default:
		fv, _ = si.field(x.v, x.update)
	}
	return
}

func baseStructRv(v reflect.Value, update bool) (v2 reflect.Value, valid bool) {
	for v.Kind() == reflect.Ptr {
		if v.IsNil() {
			if !update {
				return
			}
			v.Set(reflect.New(v.Type().Elem()))
		}
		v = v.Elem()
	}
	return v, true
}

type typeInfoFlag uint8

const (
	typeInfoFlagComparable = 1 << iota
	typeInfoFlagIsZeroer
	typeInfoFlagIsZeroerPtr
)

// typeInfo keeps information about each (non-ptr) type referenced in the encode/decode sequence.
//
// During an encode/decode sequence, we work as below:
//   - If base is a built in type, en/decode base value
//   - If base is registered as an extension, en/decode base value
//   - If type is binary(M/Unm)arshaler, call Binary(M/Unm)arshal method
//   - If type is text(M/Unm)arshaler, call Text(M/Unm)arshal method
//   - Else decode appropriately based on the reflect.Kind
type typeInfo struct {
	rt      reflect.Type
	elem    reflect.Type
	pkgpath string

	rtid uintptr
	// rv0  reflect.Value // saved zero value, used if immutableKind

	numMeth uint16 // number of methods
	kind    uint8
	chandir uint8

	anyOmitEmpty bool      // true if a struct, and any of the fields are tagged "omitempty"
	toArray      bool      // whether this (struct) type should be encoded as an array
	keyType      valueType // if struct, how is the field name stored in a stream? default is string
	mbs          bool      // base type (T or *T) is a MapBySlice

	// ---- cpu cache line boundary?
	sfiSort []*structFieldInfo // sorted. Used when enc/dec struct to map.
	sfiSrc  []*structFieldInfo // unsorted. Used when enc/dec struct to array.

	key reflect.Type

	// ---- cpu cache line boundary?
	// sfis         []structFieldInfo // all sfi, in src order, as created.
	sfiNamesSort []byte // all names, with indexes into the sfiSort

	// format of marshal type fields below: [btj][mu]p? OR csp?

	bm  bool // T is a binaryMarshaler
	bmp bool // *T is a binaryMarshaler
	bu  bool // T is a binaryUnmarshaler
	bup bool // *T is a binaryUnmarshaler
	tm  bool // T is a textMarshaler
	tmp bool // *T is a textMarshaler
	tu  bool // T is a textUnmarshaler
	tup bool // *T is a textUnmarshaler

	jm  bool // T is a jsonMarshaler
	jmp bool // *T is a jsonMarshaler
	ju  bool // T is a jsonUnmarshaler
	jup bool // *T is a jsonUnmarshaler
	cs  bool // T is a Selfer
	csp bool // *T is a Selfer
	mf  bool // T is a MissingFielder
	mfp bool // *T is a MissingFielder

	// other flags, with individual bits representing if set.
	flags              typeInfoFlag
	infoFieldOmitempty bool

	_ [6]byte   // padding
	_ [2]uint64 // padding
}

func (ti *typeInfo) isFlag(f typeInfoFlag) bool {
	return ti.flags&f != 0
}

func (ti *typeInfo) indexForEncName(name []byte) (index int16) {
	var sn []byte
	if len(name)+2 <= 32 {
		var buf [32]byte // should not escape to heap
		sn = buf[:len(name)+2]
	} else {
		sn = make([]byte, len(name)+2)
	}
	copy(sn[1:], name)
	sn[0], sn[len(sn)-1] = tiSep2(name), 0xff
	j := bytes.Index(ti.sfiNamesSort, sn)
	if j < 0 {
		return -1
	}
	index = int16(uint16(ti.sfiNamesSort[j+len(sn)+1]) | uint16(ti.sfiNamesSort[j+len(sn)])<<8)
	return
}

type rtid2ti struct {
	rtid uintptr
	ti   *typeInfo
}

// TypeInfos caches typeInfo for each type on first inspection.
//
// It is configured with a set of tag keys, which are used to get
// configuration for the type.
type TypeInfos struct {
	// infos: formerly map[uintptr]*typeInfo, now *[]rtid2ti, 2 words expected
	infos atomicTypeInfoSlice
	mu    sync.Mutex
	tags  []string
	_     [2]uint64 // padding
}

// NewTypeInfos creates a TypeInfos given a set of struct tags keys.
//
// This allows users customize the struct tag keys which contain configuration
// of their types.
func NewTypeInfos(tags []string) *TypeInfos {
	return &TypeInfos{tags: tags}
}

func (x *TypeInfos) structTag(t reflect.StructTag) (s string) {
	// check for tags: codec, json, in that order.
	// this allows seamless support for many configured structs.
	for _, x := range x.tags {
		s = t.Get(x)
		if s != "" {
			return s
		}
	}
	return
}

func findTypeInfo(s []rtid2ti, rtid uintptr) (i uint, ti *typeInfo) {
	// binary search. adapted from sort/search.go.
	// Note: we use goto (instead of for loop) so this can be inlined.

	// if sp == nil {
	// 	return -1, nil
	// }
	// s := *sp

	// h, i, j := 0, 0, len(s)
	var h uint // var h, i uint
	var j = uint(len(s))
LOOP:
	if i < j {
		h = i + (j-i)/2
		if s[h].rtid < rtid {
			i = h + 1
		} else {
			j = h
		}
		goto LOOP
	}
	if i < uint(len(s)) && s[i].rtid == rtid {
		ti = s[i].ti
	}
	return
}

func (x *TypeInfos) get(rtid uintptr, rt reflect.Type) (pti *typeInfo) {
	sp := x.infos.load()
	if sp != nil {
		_, pti = findTypeInfo(sp, rtid)
		if pti != nil {
			return
		}
	}

	rk := rt.Kind()

	if rk == reflect.Ptr { // || (rk == reflect.Interface && rtid != intfTypId) {
		panicv.errorf("invalid kind passed to TypeInfos.get: %v - %v", rk, rt)
	}

	// do not hold lock while computing this.
	// it may lead to duplication, but that's ok.
	ti := typeInfo{
		rt:      rt,
		rtid:    rtid,
		kind:    uint8(rk),
		pkgpath: rt.PkgPath(),
		keyType: valueTypeString, // default it - so it's never 0
	}
	// ti.rv0 = reflect.Zero(rt)

	// ti.comparable = rt.Comparable()
	ti.numMeth = uint16(rt.NumMethod())

	ti.bm, ti.bmp = implIntf(rt, binaryMarshalerTyp)
	ti.bu, ti.bup = implIntf(rt, binaryUnmarshalerTyp)
	ti.tm, ti.tmp = implIntf(rt, textMarshalerTyp)
	ti.tu, ti.tup = implIntf(rt, textUnmarshalerTyp)
	ti.jm, ti.jmp = implIntf(rt, jsonMarshalerTyp)
	ti.ju, ti.jup = implIntf(rt, jsonUnmarshalerTyp)
	ti.cs, ti.csp = implIntf(rt, selferTyp)
	ti.mf, ti.mfp = implIntf(rt, missingFielderTyp)

	b1, b2 := implIntf(rt, iszeroTyp)
	if b1 {
		ti.flags |= typeInfoFlagIsZeroer
	}
	if b2 {
		ti.flags |= typeInfoFlagIsZeroerPtr
	}
	if rt.Comparable() {
		ti.flags |= typeInfoFlagComparable
	}

	switch rk {
	case reflect.Struct:
		var omitEmpty bool
		if f, ok := rt.FieldByName(structInfoFieldName); ok {
			ti.toArray, omitEmpty, ti.keyType = parseStructInfo(x.structTag(f.Tag))
			ti.infoFieldOmitempty = omitEmpty
		} else {
			ti.keyType = valueTypeString
		}
		pp, pi := &pool.tiload, pool.tiload.Get() // pool.tiLoad()
		pv := pi.(*typeInfoLoadArray)
		pv.etypes[0] = ti.rtid
		// vv := typeInfoLoad{pv.fNames[:0], pv.encNames[:0], pv.etypes[:1], pv.sfis[:0]}
		vv := typeInfoLoad{pv.etypes[:1], pv.sfis[:0]}
		x.rget(rt, rtid, omitEmpty, nil, &vv)
		// ti.sfis = vv.sfis
		ti.sfiSrc, ti.sfiSort, ti.sfiNamesSort, ti.anyOmitEmpty = rgetResolveSFI(rt, vv.sfis, pv)
		pp.Put(pi)
	case reflect.Map:
		ti.elem = rt.Elem()
		ti.key = rt.Key()
	case reflect.Slice:
		ti.mbs, _ = implIntf(rt, mapBySliceTyp)
		ti.elem = rt.Elem()
	case reflect.Chan:
		ti.elem = rt.Elem()
		ti.chandir = uint8(rt.ChanDir())
	case reflect.Array, reflect.Ptr:
		ti.elem = rt.Elem()
	}
	// sfi = sfiSrc

	x.mu.Lock()
	sp = x.infos.load()
	var sp2 []rtid2ti
	if sp == nil {
		pti = &ti
		sp2 = []rtid2ti{{rtid, pti}}
		x.infos.store(sp2)
	} else {
		var idx uint
		idx, pti = findTypeInfo(sp, rtid)
		if pti == nil {
			pti = &ti
			sp2 = make([]rtid2ti, len(sp)+1)
			copy(sp2, sp[:idx])
			copy(sp2[idx+1:], sp[idx:])
			sp2[idx] = rtid2ti{rtid, pti}
			x.infos.store(sp2)
		}
	}
	x.mu.Unlock()
	return
}

func (x *TypeInfos) rget(rt reflect.Type, rtid uintptr, omitEmpty bool,
	indexstack []uint16, pv *typeInfoLoad) {
	// Read up fields and store how to access the value.
	//
	// It uses go's rules for message selectors,
	// which say that the field with the shallowest depth is selected.
	//
	// Note: we consciously use slices, not a map, to simulate a set.
	//       Typically, types have < 16 fields,
	//       and iteration using equals is faster than maps there
	flen := rt.NumField()
	if flen > (1<<maxLevelsEmbedding - 1) {
		panicv.errorf("codec: types with > %v fields are not supported - has %v fields",
			(1<<maxLevelsEmbedding - 1), flen)
	}
	// pv.sfis = make([]structFieldInfo, flen)
LOOP:
	for j, jlen := uint16(0), uint16(flen); j < jlen; j++ {
		f := rt.Field(int(j))
		fkind := f.Type.Kind()
		// skip if a func type, or is unexported, or structTag value == "-"
		switch fkind {
		case reflect.Func, reflect.Complex64, reflect.Complex128, reflect.UnsafePointer:
			continue LOOP
		}

		isUnexported := f.PkgPath != ""
		if isUnexported && !f.Anonymous {
			continue
		}
		stag := x.structTag(f.Tag)
		if stag == "-" {
			continue
		}
		var si structFieldInfo
		var parsed bool
		// if anonymous and no struct tag (or it's blank),
		// and a struct (or pointer to struct), inline it.
		if f.Anonymous && fkind != reflect.Interface {
			// ^^ redundant but ok: per go spec, an embedded pointer type cannot be to an interface
			ft := f.Type
			isPtr := ft.Kind() == reflect.Ptr
			for ft.Kind() == reflect.Ptr {
				ft = ft.Elem()
			}
			isStruct := ft.Kind() == reflect.Struct

			// Ignore embedded fields of unexported non-struct types.
			// Also, from go1.10, ignore pointers to unexported struct types
			// because unmarshal cannot assign a new struct to an unexported field.
			// See https://golang.org/issue/21357
			if (isUnexported && !isStruct) || (isUnexported && isPtr) {
				continue
			}
			doInline := stag == ""
			if !doInline {
				si.parseTag(stag)
				parsed = true
				doInline = si.encName == ""
				// doInline = si.isZero()
			}
			if doInline && isStruct {
				// if etypes contains this, don't call rget again (as fields are already seen here)
				ftid := rt2id(ft)
				// We cannot recurse forever, but we need to track other field depths.
				// So - we break if we see a type twice (not the first time).
				// This should be sufficient to handle an embedded type that refers to its
				// owning type, which then refers to its embedded type.
				processIt := true
				numk := 0
				for _, k := range pv.etypes {
					if k == ftid {
						numk++
						if numk == rgetMaxRecursion {
							processIt = false
							break
						}
					}
				}
				if processIt {
					pv.etypes = append(pv.etypes, ftid)
					indexstack2 := make([]uint16, len(indexstack)+1)
					copy(indexstack2, indexstack)
					indexstack2[len(indexstack)] = j
					// indexstack2 := append(append(make([]int, 0, len(indexstack)+4), indexstack...), j)
					x.rget(ft, ftid, omitEmpty, indexstack2, pv)
				}
				continue
			}
		}

		// after the anonymous dance: if an unexported field, skip
		if isUnexported {
			continue
		}

		if f.Name == "" {
			panic(errNoFieldNameToStructFieldInfo)
		}

		// pv.fNames = append(pv.fNames, f.Name)
		// if si.encName == "" {

		if !parsed {
			si.encName = f.Name
			si.parseTag(stag)
			parsed = true
		} else if si.encName == "" {
			si.encName = f.Name
		}
		si.encNameAsciiAlphaNum = true
		for i := len(si.encName) - 1; i >= 0; i-- { // bounds-check elimination
			b := si.encName[i]
			if (b >= '0' && b <= '9') || (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') {
				continue
			}
			si.encNameAsciiAlphaNum = false
			break
		}
		si.fieldName = f.Name
		si.flagSet(structFieldInfoFlagReady)

		// pv.encNames = append(pv.encNames, si.encName)

		// si.ikind = int(f.Type.Kind())
		if len(indexstack) > maxLevelsEmbedding-1 {
			panicv.errorf("codec: only supports up to %v depth of embedding - type has %v depth",
				maxLevelsEmbedding-1, len(indexstack))
		}
		si.nis = uint8(len(indexstack)) + 1
		copy(si.is[:], indexstack)
		si.is[len(indexstack)] = j

		if omitEmpty {
			si.flagSet(structFieldInfoFlagOmitEmpty)
		}
		pv.sfis = append(pv.sfis, si)
	}
}

func tiSep(name string) uint8 {
	// (xn[0]%64) // (between 192-255 - outside ascii BMP)
	// return 0xfe - (name[0] & 63)
	// return 0xfe - (name[0] & 63) - uint8(len(name))
	// return 0xfe - (name[0] & 63) - uint8(len(name)&63)
	// return ((0xfe - (name[0] & 63)) & 0xf8) | (uint8(len(name) & 0x07))
	return 0xfe - (name[0] & 63) - uint8(len(name)&63)
}

func tiSep2(name []byte) uint8 {
	return 0xfe - (name[0] & 63) - uint8(len(name)&63)
}

// resolves the struct field info got from a call to rget.
// Returns a trimmed, unsorted and sorted []*structFieldInfo.
func rgetResolveSFI(rt reflect.Type, x []structFieldInfo, pv *typeInfoLoadArray) (
	y, z []*structFieldInfo, ss []byte, anyOmitEmpty bool) {
	sa := pv.sfiidx[:0]
	sn := pv.b[:]
	n := len(x)

	var xn string
	var ui uint16
	var sep byte

	for i := range x {
		ui = uint16(i)
		xn = x[i].encName // fieldName or encName? use encName for now.
		if len(xn)+2 > cap(pv.b) {
			sn = make([]byte, len(xn)+2)
		} else {
			sn = sn[:len(xn)+2]
		}
		// use a custom sep, so that misses are less frequent,
		// since the sep (first char in search) is as unique as first char in field name.
		sep = tiSep(xn)
		sn[0], sn[len(sn)-1] = sep, 0xff
		copy(sn[1:], xn)
		j := bytes.Index(sa, sn)
		if j == -1 {
			sa = append(sa, sep)
			sa = append(sa, xn...)
			sa = append(sa, 0xff, byte(ui>>8), byte(ui))
		} else {
			index := uint16(sa[j+len(sn)+1]) | uint16(sa[j+len(sn)])<<8
			// one of them must be reset to nil,
			// and the index updated appropriately to the other one
			if x[i].nis == x[index].nis {
			} else if x[i].nis < x[index].nis {
				sa[j+len(sn)], sa[j+len(sn)+1] = byte(ui>>8), byte(ui)
				if x[index].ready() {
					x[index].flagClr(structFieldInfoFlagReady)
					n--
				}
			} else {
				if x[i].ready() {
					x[i].flagClr(structFieldInfoFlagReady)
					n--
				}
			}
		}

	}
	var w []structFieldInfo
	sharingArray := len(x) <= typeInfoLoadArraySfisLen // sharing array with typeInfoLoadArray
	if sharingArray {
		w = make([]structFieldInfo, n)
	}

	// remove all the nils (non-ready)
	y = make([]*structFieldInfo, n)
	n = 0
	var sslen int
	for i := range x {
		if !x[i].ready() {
			continue
		}
		if !anyOmitEmpty && x[i].omitEmpty() {
			anyOmitEmpty = true
		}
		if sharingArray {
			w[n] = x[i]
			y[n] = &w[n]
		} else {
			y[n] = &x[i]
		}
		sslen = sslen + len(x[i].encName) + 4
		n++
	}
	if n != len(y) {
		panicv.errorf("failure reading struct %v - expecting %d of %d valid fields, got %d",
			rt, len(y), len(x), n)
	}

	z = make([]*structFieldInfo, len(y))
	copy(z, y)
	sort.Sort(sfiSortedByEncName(z))

	sharingArray = len(sa) <= typeInfoLoadArraySfiidxLen
	if sharingArray {
		ss = make([]byte, 0, sslen)
	} else {
		ss = sa[:0] // reuse the newly made sa array if necessary
	}
	for i := range z {
		xn = z[i].encName
		sep = tiSep(xn)
		ui = uint16(i)
		ss = append(ss, sep)
		ss = append(ss, xn...)
		ss = append(ss, 0xff, byte(ui>>8), byte(ui))
	}
	return
}

func implIntf(rt, iTyp reflect.Type) (base bool, indir bool) {
	return rt.Implements(iTyp), reflect.PtrTo(rt).Implements(iTyp)
}

// isEmptyStruct is only called from isEmptyValue, and checks if a struct is empty:
//   - does it implement IsZero() bool
//   - is it comparable, and can i compare directly using ==
//   - if checkStruct, then walk through the encodable fields
//     and check if they are empty or not.
func isEmptyStruct(v reflect.Value, tinfos *TypeInfos, deref, checkStruct bool) bool {
	// v is a struct kind - no need to check again.
	// We only check isZero on a struct kind, to reduce the amount of times
	// that we lookup the rtid and typeInfo for each type as we walk the tree.

	vt := v.Type()
	rtid := rt2id(vt)
	if tinfos == nil {
		tinfos = defTypeInfos
	}
	ti := tinfos.get(rtid, vt)
	if ti.rtid == timeTypId {
		return rv2i(v).(time.Time).IsZero()
	}
	if ti.isFlag(typeInfoFlagIsZeroerPtr) && v.CanAddr() {
		return rv2i(v.Addr()).(isZeroer).IsZero()
	}
	if ti.isFlag(typeInfoFlagIsZeroer) {
		return rv2i(v).(isZeroer).IsZero()
	}
	if ti.isFlag(typeInfoFlagComparable) {
		return rv2i(v) == rv2i(reflect.Zero(vt))
	}
	if !checkStruct {
		return false
	}
	// We only care about what we can encode/decode,
	// so that is what we use to check omitEmpty.
	for _, si := range ti.sfiSrc {
		sfv, valid := si.field(v, false)
		if valid && !isEmptyValue(sfv, tinfos, deref, checkStruct) {
			return false
		}
	}
	return true
}

// func roundFloat(x float64) float64 {
// 	t := math.Trunc(x)
// 	if math.Abs(x-t) >= 0.5 {
// 		return t + math.Copysign(1, x)
// 	}
// 	return t
// }

func panicToErr(h errDecorator, err *error) {
	// Note: This method MUST be called directly from defer i.e. defer panicToErr ...
	// else it seems the recover is not fully handled
	if recoverPanicToErr {
		if x := recover(); x != nil {
			// fmt.Printf("panic'ing with: %v\n", x)
			// debug.PrintStack()
			panicValToErr(h, x, err)
		}
	}
}

func panicValToErr(h errDecorator, v interface{}, err *error) {
	switch xerr := v.(type) {
	case nil:
	case error:
		switch xerr {
		case nil:
		case io.EOF, io.ErrUnexpectedEOF, errEncoderNotInitialized, errDecoderNotInitialized:
			// treat as special (bubble up)
			*err = xerr
		default:
			h.wrapErr(xerr, err)
		}
	case string:
		if xerr != "" {
			h.wrapErr(xerr, err)
		}
	case fmt.Stringer:
		if xerr != nil {
			h.wrapErr(xerr, err)
		}
	default:
		h.wrapErr(v, err)
	}
}

func isImmutableKind(k reflect.Kind) (v bool) {
	// return immutableKindsSet[k]
	// since we know reflect.Kind is in range 0..31, then use the k%32 == k constraint
	return immutableKindsSet[k%reflect.Kind(len(immutableKindsSet))] // bounds-check-elimination
}

// ----

type codecFnInfo struct {
	ti    *typeInfo
	xfFn  Ext
	xfTag uint64
	seq   seqType
	addrD bool
	addrF bool // if addrD, this says whether decode function can take a value or a ptr
	addrE bool
}

// codecFn encapsulates the captured variables and the encode function.
// This way, we only do some calculations one times, and pass to the
// code block that should be called (encapsulated in a function)
// instead of executing the checks every time.
type codecFn struct {
	i  codecFnInfo
	fe func(*Encoder, *codecFnInfo, reflect.Value)
	fd func(*Decoder, *codecFnInfo, reflect.Value)
	_  [1]uint64 // padding
}

type codecRtidFn struct {
	rtid uintptr
	fn   *codecFn
}

// ----

// these "checkOverflow" functions must be inlinable, and not call anybody.
// Overflow means that the value cannot be represented without wrapping/overflow.
// Overflow=false does not mean that the value can be represented without losing precision
// (especially for floating point).

type checkOverflow struct{}

// func (checkOverflow) Float16(f float64) (overflow bool) {
// 	panicv.errorf("unimplemented")
// 	if f < 0 {
// 		f = -f
// 	}
// 	return math.MaxFloat32 < f && f <= math.MaxFloat64
// }

func (checkOverflow) Float32(v float64) (overflow bool) {
	if v < 0 {
		v = -v
	}
	return math.MaxFloat32 < v && v <= math.MaxFloat64
}
func (checkOverflow) Uint(v uint64, bitsize uint8) (overflow bool) {
	if bitsize == 0 || bitsize >= 64 || v == 0 {
		return
	}
	if trunc := (v << (64 - bitsize)) >> (64 - bitsize); v != trunc {
		overflow = true
	}
	return
}
func (checkOverflow) Int(v int64, bitsize uint8) (overflow bool) {
	if bitsize == 0 || bitsize >= 64 || v == 0 {
		return
	}
	if trunc := (v << (64 - bitsize)) >> (64 - bitsize); v != trunc {
		overflow = true
	}
	return
}
func (checkOverflow) SignedInt(v uint64) (overflow bool) {
	//e.g. -127 to 128 for int8
	pos := (v >> 63) == 0
	ui2 := v & 0x7fffffffffffffff
	if pos {
		if ui2 > math.MaxInt64 {
			overflow = true
		}
	} else {
		if ui2 > math.MaxInt64-1 {
			overflow = true
		}
	}
	return
}

func (x checkOverflow) Float32V(v float64) float64 {
	if x.Float32(v) {
		panicv.errorf("float32 overflow: %v", v)
	}
	return v
}
func (x checkOverflow) UintV(v uint64, bitsize uint8) uint64 {
	if x.Uint(v, bitsize) {
		panicv.errorf("uint64 overflow: %v", v)
	}
	return v
}
func (x checkOverflow) IntV(v int64, bitsize uint8) int64 {
	if x.Int(v, bitsize) {
		panicv.errorf("int64 overflow: %v", v)
	}
	return v
}
func (x checkOverflow) SignedIntV(v uint64) int64 {
	if x.SignedInt(v) {
		panicv.errorf("uint64 to int64 overflow: %v", v)
	}
	return int64(v)
}

// ------------------ SORT -----------------

func isNaN(f float64) bool { return f != f }

// -----------------------

type ioFlusher interface {
	Flush() error
}

type ioPeeker interface {
	Peek(int) ([]byte, error)
}

type ioBuffered interface {
	Buffered() int
}

// -----------------------

type intSlice []int64
type uintSlice []uint64

// type uintptrSlice []uintptr
type floatSlice []float64
type boolSlice []bool
type stringSlice []string

// type bytesSlice [][]byte

func (p intSlice) Len() int           { return len(p) }
func (p intSlice) Less(i, j int) bool { return p[uint(i)] < p[uint(j)] }
func (p intSlice) Swap(i, j int)      { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

func (p uintSlice) Len() int           { return len(p) }
func (p uintSlice) Less(i, j int) bool { return p[uint(i)] < p[uint(j)] }
func (p uintSlice) Swap(i, j int)      { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

// func (p uintptrSlice) Len() int           { return len(p) }
// func (p uintptrSlice) Less(i, j int) bool { return p[uint(i)] < p[uint(j)] }
// func (p uintptrSlice) Swap(i, j int)      { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

func (p floatSlice) Len() int { return len(p) }
func (p floatSlice) Less(i, j int) bool {
	return p[uint(i)] < p[uint(j)] || isNaN(p[uint(i)]) && !isNaN(p[uint(j)])
}
func (p floatSlice) Swap(i, j int) { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

func (p stringSlice) Len() int           { return len(p) }
func (p stringSlice) Less(i, j int) bool { return p[uint(i)] < p[uint(j)] }
func (p stringSlice) Swap(i, j int)      { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

// func (p bytesSlice) Len() int           { return len(p) }
// func (p bytesSlice) Less(i, j int) bool { return bytes.Compare(p[uint(i)], p[uint(j)]) == -1 }
// func (p bytesSlice) Swap(i, j int)      { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

func (p boolSlice) Len() int           { return len(p) }
func (p boolSlice) Less(i, j int) bool { return !p[uint(i)] && p[uint(j)] }
func (p boolSlice) Swap(i, j int)      { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

// ---------------------

type sfiRv struct {
	v *structFieldInfo
	r reflect.Value
}

type intRv struct {
	v int64
	r reflect.Value
}
type intRvSlice []intRv
type uintRv struct {
	v uint64
	r reflect.Value
}
type uintRvSlice []uintRv
type floatRv struct {
	v float64
	r reflect.Value
}
type floatRvSlice []floatRv
type boolRv struct {
	v bool
	r reflect.Value
}
type boolRvSlice []boolRv
type stringRv struct {
	v string
	r reflect.Value
}
type stringRvSlice []stringRv
type bytesRv struct {
	v []byte
	r reflect.Value
}
type bytesRvSlice []bytesRv
type timeRv struct {
	v time.Time
	r reflect.Value
}
type timeRvSlice []timeRv

func (p intRvSlice) Len() int           { return len(p) }
func (p intRvSlice) Less(i, j int) bool { return p[uint(i)].v < p[uint(j)].v }
func (p intRvSlice) Swap(i, j int)      { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

func (p uintRvSlice) Len() int           { return len(p) }
func (p uintRvSlice) Less(i, j int) bool { return p[uint(i)].v < p[uint(j)].v }
func (p uintRvSlice) Swap(i, j int)      { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

func (p floatRvSlice) Len() int { return len(p) }
func (p floatRvSlice) Less(i, j int) bool {
	return p[uint(i)].v < p[uint(j)].v || isNaN(p[uint(i)].v) && !isNaN(p[uint(j)].v)
}
func (p floatRvSlice) Swap(i, j int) { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

func (p stringRvSlice) Len() int           { return len(p) }
func (p stringRvSlice) Less(i, j int) bool { return p[uint(i)].v < p[uint(j)].v }
func (p stringRvSlice) Swap(i, j int)      { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

func (p bytesRvSlice) Len() int           { return len(p) }
func (p bytesRvSlice) Less(i, j int) bool { return bytes.Compare(p[uint(i)].v, p[uint(j)].v) == -1 }
func (p bytesRvSlice) Swap(i, j int)      { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

func (p boolRvSlice) Len() int           { return len(p) }
func (p boolRvSlice) Less(i, j int) bool { return !p[uint(i)].v && p[uint(j)].v }
func (p boolRvSlice) Swap(i, j int)      { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

func (p timeRvSlice) Len() int           { return len(p) }
func (p timeRvSlice) Less(i, j int) bool { return p[uint(i)].v.Before(p[uint(j)].v) }
func (p timeRvSlice) Swap(i, j int)      { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

// -----------------

type bytesI struct {
	v []byte
	i interface{}
}

type bytesISlice []bytesI

func (p bytesISlice) Len() int           { return len(p) }
func (p bytesISlice) Less(i, j int) bool { return bytes.Compare(p[uint(i)].v, p[uint(j)].v) == -1 }
func (p bytesISlice) Swap(i, j int)      { p[uint(i)], p[uint(j)] = p[uint(j)], p[uint(i)] }

// -----------------

type set []uintptr

func (s *set) add(v uintptr) (exists bool) {
	// e.ci is always nil, or len >= 1
	x := *s
	if x == nil {
		x = make([]uintptr, 1, 8)
		x[0] = v
		*s = x
		return
	}
	// typically, length will be 1. make this perform.
	if len(x) == 1 {
		if j := x[0]; j == 0 {
			x[0] = v
		} else if j == v {
			exists = true
		} else {
			x = append(x, v)
			*s = x
		}
		return
	}
	// check if it exists
	for _, j := range x {
		if j == v {
			exists = true
			return
		}
	}
	// try to replace a "deleted" slot
	for i, j := range x {
		if j == 0 {
			x[i] = v
			return
		}
	}
	// if unable to replace deleted slot, just append it.
	x = append(x, v)
	*s = x
	return
}

func (s *set) remove(v uintptr) (exists bool) {
	x := *s
	if len(x) == 0 {
		return
	}
	if len(x) == 1 {
		if x[0] == v {
			x[0] = 0
		}
		return
	}
	for i, j := range x {
		if j == v {
			exists = true
			x[i] = 0 // set it to 0, as way to delete it.
			// copy(x[i:], x[i+1:])
			// x = x[:len(x)-1]
			return
		}
	}
	return
}

// ------

// bitset types are better than [256]bool, because they permit the whole
// bitset array being on a single cache line and use less memory.
//
// Also, since pos is a byte (0-255), there's no bounds checks on indexing (cheap).
//
// We previously had bitset128 [16]byte, and bitset32 [4]byte, but those introduces
// bounds checking, so we discarded them, and everyone uses bitset256.
//
// given x > 0 and n > 0 and x is exactly 2^n, then pos/x === pos>>n AND pos%x === pos&(x-1).
// consequently, pos/32 === pos>>5, pos/16 === pos>>4, pos/8 === pos>>3, pos%8 == pos&7

type bitset256 [32]byte

func (x *bitset256) isset(pos byte) bool {
	return x[pos>>3]&(1<<(pos&7)) != 0
}

// func (x *bitset256) issetv(pos byte) byte {
// 	return x[pos>>3] & (1 << (pos & 7))
// }

func (x *bitset256) set(pos byte) {
	x[pos>>3] |= (1 << (pos & 7))
}

// func (x *bitset256) unset(pos byte) {
// 	x[pos>>3] &^= (1 << (pos & 7))
// }

// type bit2set256 [64]byte

// func (x *bit2set256) set(pos byte, v1, v2 bool) {
// 	var pos2 uint8 = (pos & 3) << 1 // returning 0, 2, 4 or 6
// 	if v1 {
// 		x[pos>>2] |= 1 << (pos2 + 1)
// 	}
// 	if v2 {
// 		x[pos>>2] |= 1 << pos2
// 	}
// }
// func (x *bit2set256) get(pos byte) uint8 {
// 	var pos2 uint8 = (pos & 3) << 1     // returning 0, 2, 4 or 6
// 	return x[pos>>2] << (6 - pos2) >> 6 // 11000000 -> 00000011
// }

// ------------

type pooler struct {
	// function-scoped pooled resources
	tiload                                      sync.Pool // for type info loading
	sfiRv8, sfiRv16, sfiRv32, sfiRv64, sfiRv128 sync.Pool // for struct encoding

	// lifetime-scoped pooled resources
	// dn                                 sync.Pool // for decNaked
	buf1k, buf2k, buf4k, buf8k, buf16k, buf32k, buf64k sync.Pool // for [N]byte
}

func (p *pooler) init() {
	p.tiload.New = func() interface{} { return new(typeInfoLoadArray) }

	p.sfiRv8.New = func() interface{} { return new([8]sfiRv) }
	p.sfiRv16.New = func() interface{} { return new([16]sfiRv) }
	p.sfiRv32.New = func() interface{} { return new([32]sfiRv) }
	p.sfiRv64.New = func() interface{} { return new([64]sfiRv) }
	p.sfiRv128.New = func() interface{} { return new([128]sfiRv) }

	// p.dn.New = func() interface{} { x := new(decNaked); x.init(); return x }

	p.buf1k.New = func() interface{} { return new([1 * 1024]byte) }
	p.buf2k.New = func() interface{} { return new([2 * 1024]byte) }
	p.buf4k.New = func() interface{} { return new([4 * 1024]byte) }
	p.buf8k.New = func() interface{} { return new([8 * 1024]byte) }
	p.buf16k.New = func() interface{} { return new([16 * 1024]byte) }
	p.buf32k.New = func() interface{} { return new([32 * 1024]byte) }
	p.buf64k.New = func() interface{} { return new([64 * 1024]byte) }

}

// func (p *pooler) sfiRv8() (sp *sync.Pool, v interface{}) {
// 	return &p.strRv8, p.strRv8.Get()
// }
// func (p *pooler) sfiRv16() (sp *sync.Pool, v interface{}) {
// 	return &p.strRv16, p.strRv16.Get()
// }
// func (p *pooler) sfiRv32() (sp *sync.Pool, v interface{}) {
// 	return &p.strRv32, p.strRv32.Get()
// }
// func (p *pooler) sfiRv64() (sp *sync.Pool, v interface{}) {
// 	return &p.strRv64, p.strRv64.Get()
// }
// func (p *pooler) sfiRv128() (sp *sync.Pool, v interface{}) {
// 	return &p.strRv128, p.strRv128.Get()
// }

// func (p *pooler) bytes1k() (sp *sync.Pool, v interface{}) {
// 	return &p.buf1k, p.buf1k.Get()
// }
// func (p *pooler) bytes2k() (sp *sync.Pool, v interface{}) {
// 	return &p.buf2k, p.buf2k.Get()
// }
// func (p *pooler) bytes4k() (sp *sync.Pool, v interface{}) {
// 	return &p.buf4k, p.buf4k.Get()
// }
// func (p *pooler) bytes8k() (sp *sync.Pool, v interface{}) {
// 	return &p.buf8k, p.buf8k.Get()
// }
// func (p *pooler) bytes16k() (sp *sync.Pool, v interface{}) {
// 	return &p.buf16k, p.buf16k.Get()
// }
// func (p *pooler) bytes32k() (sp *sync.Pool, v interface{}) {
// 	return &p.buf32k, p.buf32k.Get()
// }
// func (p *pooler) bytes64k() (sp *sync.Pool, v interface{}) {
// 	return &p.buf64k, p.buf64k.Get()
// }

// func (p *pooler) tiLoad() (sp *sync.Pool, v interface{}) {
// 	return &p.tiload, p.tiload.Get()
// }

// func (p *pooler) decNaked() (sp *sync.Pool, v interface{}) {
// 	return &p.dn, p.dn.Get()
// }

// func (p *pooler) decNaked() (v *decNaked, f func(*decNaked) ) {
// 	sp := &(p.dn)
// 	vv := sp.Get()
// 	return vv.(*decNaked), func(x *decNaked) { sp.Put(vv) }
// }
// func (p *pooler) decNakedGet() (v interface{}) {
// 	return p.dn.Get()
// }
// func (p *pooler) tiLoadGet() (v interface{}) {
// 	return p.tiload.Get()
// }
// func (p *pooler) decNakedPut(v interface{}) {
// 	p.dn.Put(v)
// }
// func (p *pooler) tiLoadPut(v interface{}) {
// 	p.tiload.Put(v)
// }

// ----------------------------------------------------

type panicHdl struct{}

func (panicHdl) errorv(err error) {
	if err != nil {
		panic(err)
	}
}

func (panicHdl) errorstr(message string) {
	if message != "" {
		panic(message)
	}
}

func (panicHdl) errorf(format string, params ...interface{}) {
	if format == "" {
	} else if len(params) == 0 {
		panic(format)
	} else {
		panic(fmt.Sprintf(format, params...))
	}
}

// ----------------------------------------------------

type errDecorator interface {
	wrapErr(in interface{}, out *error)
}

type errDecoratorDef struct{}

func (errDecoratorDef) wrapErr(v interface{}, e *error) { *e = fmt.Errorf("%v", v) }

// ----------------------------------------------------

type must struct{}

func (must) String(s string, err error) string {
	if err != nil {
		panicv.errorv(err)
	}
	return s
}
func (must) Int(s int64, err error) int64 {
	if err != nil {
		panicv.errorv(err)
	}
	return s
}
func (must) Uint(s uint64, err error) uint64 {
	if err != nil {
		panicv.errorv(err)
	}
	return s
}
func (must) Float(s float64, err error) float64 {
	if err != nil {
		panicv.errorv(err)
	}
	return s
}

// -------------------

type bytesBufPooler struct {
	pool    *sync.Pool
	poolbuf interface{}
}

func (z *bytesBufPooler) end() {
	if z.pool != nil {
		z.pool.Put(z.poolbuf)
		z.pool, z.poolbuf = nil, nil
	}
}

func (z *bytesBufPooler) get(bufsize int) (buf []byte) {
	// ensure an end is called first (if necessary)
	if z.pool != nil {
		z.pool.Put(z.poolbuf)
		z.pool, z.poolbuf = nil, nil
	}

	if bufsize <= 1*1024 {
		z.pool, z.poolbuf = &pool.buf1k, pool.buf1k.Get() // pool.bytes1k()
		buf = z.poolbuf.(*[1 * 1024]byte)[:]
	} else if bufsize <= 2*1024 {
		z.pool, z.poolbuf = &pool.buf2k, pool.buf2k.Get() // pool.bytes2k()
		buf = z.poolbuf.(*[2 * 1024]byte)[:]
	} else if bufsize <= 4*1024 {
		z.pool, z.poolbuf = &pool.buf4k, pool.buf4k.Get() // pool.bytes4k()
		buf = z.poolbuf.(*[4 * 1024]byte)[:]
	} else if bufsize <= 8*1024 {
		z.pool, z.poolbuf = &pool.buf8k, pool.buf8k.Get() // pool.bytes8k()
		buf = z.poolbuf.(*[8 * 1024]byte)[:]
	} else if bufsize <= 16*1024 {
		z.pool, z.poolbuf = &pool.buf16k, pool.buf16k.Get() // pool.bytes16k()
		buf = z.poolbuf.(*[16 * 1024]byte)[:]
	} else if bufsize <= 32*1024 {
		z.pool, z.poolbuf = &pool.buf32k, pool.buf32k.Get() // pool.bytes32k()
		buf = z.poolbuf.(*[32 * 1024]byte)[:]
	} else {
		z.pool, z.poolbuf = &pool.buf64k, pool.buf64k.Get() // pool.bytes64k()
		buf = z.poolbuf.(*[64 * 1024]byte)[:]
	}
	return
}

// ----------------

type sfiRvPooler struct {
	pool  *sync.Pool
	poolv interface{}
}

func (z *sfiRvPooler) end() {
	if z.pool != nil {
		z.pool.Put(z.poolv)
		z.pool, z.poolv = nil, nil
	}
}

func (z *sfiRvPooler) get(newlen int) (fkvs []sfiRv) {
	if newlen < 0 { // bounds-check-elimination
		// cannot happen // here for bounds-check-elimination
	} else if newlen <= 8 {
		z.pool, z.poolv = &pool.sfiRv8, pool.sfiRv8.Get() // pool.sfiRv8()
		fkvs = z.poolv.(*[8]sfiRv)[:newlen]
	} else if newlen <= 16 {
		z.pool, z.poolv = &pool.sfiRv16, pool.sfiRv16.Get() // pool.sfiRv16()
		fkvs = z.poolv.(*[16]sfiRv)[:newlen]
	} else if newlen <= 32 {
		z.pool, z.poolv = &pool.sfiRv32, pool.sfiRv32.Get() // pool.sfiRv32()
		fkvs = z.poolv.(*[32]sfiRv)[:newlen]
	} else if newlen <= 64 {
		z.pool, z.poolv = &pool.sfiRv64, pool.sfiRv64.Get() // pool.sfiRv64()
		fkvs = z.poolv.(*[64]sfiRv)[:newlen]
	} else if newlen <= 128 {
		z.pool, z.poolv = &pool.sfiRv128, pool.sfiRv128.Get() // pool.sfiRv128()
		fkvs = z.poolv.(*[128]sfiRv)[:newlen]
	} else {
		fkvs = make([]sfiRv, newlen)
	}
	return
}

// safe-mod optimizations

const safeMode = true

// stringView returns a view of the []byte as a string.
// In unsafe mode, it doesn't incur allocation and copying caused by conversion.
// In regular safe mode, it is an allocation and copy.
//
// Usage: Always maintain a reference to v while result of this call is in use,
//
//	and call keepAlive4BytesView(v) at point where done with view.
func stringView(v []byte) string {
	return string(v)
}

// bytesView returns a view of the string as a []byte.
// In unsafe mode, it doesn't incur allocation and copying caused by conversion.
// In regular safe mode, it is an allocation and copy.
//
// Usage: Always maintain a reference to v while result of this call is in use,
//
//	and call keepAlive4BytesView(v) at point where done with view.
func bytesView(v string) []byte {
	return []byte(v)
}

func definitelyNil(v interface{}) bool {
	// this is a best-effort option.
	// We just return false, so we don't unnecessarily incur the cost of reflection this early.
	return false
}

func rv2i(rv reflect.Value) interface{} {
	return rv.Interface()
}

func rt2id(rt reflect.Type) uintptr {
	return reflect.ValueOf(rt).Pointer()
}

func i2rtid(i interface{}) uintptr {
	return reflect.ValueOf(reflect.TypeOf(i)).Pointer()
}

// --------------------------

func isEmptyValue(v reflect.Value, tinfos *TypeInfos, deref, checkStruct bool) bool {
	switch v.Kind() {
	case reflect.Invalid:
		return true
	case reflect.Array, reflect.Map, reflect.Slice, reflect.String:
		return v.Len() == 0
	case reflect.Bool:
		return !v.Bool()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return v.Int() == 0
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return v.Uint() == 0
	case reflect.Float32, reflect.Float64:
		return v.Float() == 0
	case reflect.Interface, reflect.Ptr:
		if deref {
			if v.IsNil() {
				return true
			}
			return isEmptyValue(v.Elem(), tinfos, deref, checkStruct)
		}
		return v.IsNil()
	case reflect.Struct:
		return isEmptyStruct(v, tinfos, deref, checkStruct)
	}
	return false
}

// --------------------------
type atomicClsErr struct {
	v atomic.Value
}

func (x *atomicClsErr) load() (e clsErr) {
	if i := x.v.Load(); i != nil {
		e = i.(clsErr)
	}
	return
}

func (x *atomicClsErr) store(p clsErr) {
	x.v.Store(p)
}

// --------------------------
type atomicTypeInfoSlice struct { // expected to be 2 words
	v atomic.Value
}

func (x *atomicTypeInfoSlice) load() (e []rtid2ti) {
	if i := x.v.Load(); i != nil {
		e = i.([]rtid2ti)
	}
	return
}

func (x *atomicTypeInfoSlice) store(p []rtid2ti) {
	x.v.Store(p)
}

// --------------------------
type atomicRtidFnSlice struct { // expected to be 2 words
	v atomic.Value
}

func (x *atomicRtidFnSlice) load() (e []codecRtidFn) {
	if i := x.v.Load(); i != nil {
		e = i.([]codecRtidFn)
	}
	return
}

func (x *atomicRtidFnSlice) store(p []codecRtidFn) {
	x.v.Store(p)
}

// --------------------------
func (n *decNaked) ru() reflect.Value {
	return reflect.ValueOf(&n.u).Elem()
}
func (n *decNaked) ri() reflect.Value {
	return reflect.ValueOf(&n.i).Elem()
}
func (n *decNaked) rf() reflect.Value {
	return reflect.ValueOf(&n.f).Elem()
}
func (n *decNaked) rl() reflect.Value {
	return reflect.ValueOf(&n.l).Elem()
}
func (n *decNaked) rs() reflect.Value {
	return reflect.ValueOf(&n.s).Elem()
}
func (n *decNaked) rt() reflect.Value {
	return reflect.ValueOf(&n.t).Elem()
}
func (n *decNaked) rb() reflect.Value {
	return reflect.ValueOf(&n.b).Elem()
}

// --------------------------
func (d *Decoder) raw(f *codecFnInfo, rv reflect.Value) {
	rv.SetBytes(d.rawBytes())
}

func (d *Decoder) kString(f *codecFnInfo, rv reflect.Value) {
	rv.SetString(d.d.DecodeString())
}

func (d *Decoder) kBool(f *codecFnInfo, rv reflect.Value) {
	rv.SetBool(d.d.DecodeBool())
}

func (d *Decoder) kTime(f *codecFnInfo, rv reflect.Value) {
	rv.Set(reflect.ValueOf(d.d.DecodeTime()))
}

func (d *Decoder) kFloat32(f *codecFnInfo, rv reflect.Value) {
	fv := d.d.DecodeFloat64()
	if chkOvf.Float32(fv) {
		d.errorf("float32 overflow: %v", fv)
	}
	rv.SetFloat(fv)
}

func (d *Decoder) kFloat64(f *codecFnInfo, rv reflect.Value) {
	rv.SetFloat(d.d.DecodeFloat64())
}

func (d *Decoder) kInt(f *codecFnInfo, rv reflect.Value) {
	rv.SetInt(chkOvf.IntV(d.d.DecodeInt64(), intBitsize))
}

func (d *Decoder) kInt8(f *codecFnInfo, rv reflect.Value) {
	rv.SetInt(chkOvf.IntV(d.d.DecodeInt64(), 8))
}

func (d *Decoder) kInt16(f *codecFnInfo, rv reflect.Value) {
	rv.SetInt(chkOvf.IntV(d.d.DecodeInt64(), 16))
}

func (d *Decoder) kInt32(f *codecFnInfo, rv reflect.Value) {
	rv.SetInt(chkOvf.IntV(d.d.DecodeInt64(), 32))
}

func (d *Decoder) kInt64(f *codecFnInfo, rv reflect.Value) {
	rv.SetInt(d.d.DecodeInt64())
}

func (d *Decoder) kUint(f *codecFnInfo, rv reflect.Value) {
	rv.SetUint(chkOvf.UintV(d.d.DecodeUint64(), uintBitsize))
}

func (d *Decoder) kUintptr(f *codecFnInfo, rv reflect.Value) {
	rv.SetUint(chkOvf.UintV(d.d.DecodeUint64(), uintBitsize))
}

func (d *Decoder) kUint8(f *codecFnInfo, rv reflect.Value) {
	rv.SetUint(chkOvf.UintV(d.d.DecodeUint64(), 8))
}

func (d *Decoder) kUint16(f *codecFnInfo, rv reflect.Value) {
	rv.SetUint(chkOvf.UintV(d.d.DecodeUint64(), 16))
}

func (d *Decoder) kUint32(f *codecFnInfo, rv reflect.Value) {
	rv.SetUint(chkOvf.UintV(d.d.DecodeUint64(), 32))
}

func (d *Decoder) kUint64(f *codecFnInfo, rv reflect.Value) {
	rv.SetUint(d.d.DecodeUint64())
}

// ----------------

func (e *Encoder) kBool(f *codecFnInfo, rv reflect.Value) {
	e.e.EncodeBool(rv.Bool())
}

func (e *Encoder) kTime(f *codecFnInfo, rv reflect.Value) {
	e.e.EncodeTime(rv2i(rv).(time.Time))
}

func (e *Encoder) kString(f *codecFnInfo, rv reflect.Value) {
	s := rv.String()
	if e.h.StringToRaw {
		e.e.EncodeStringBytesRaw(bytesView(s))
	} else {
		e.e.EncodeStringEnc(cUTF8, s)
	}
}

func (e *Encoder) kFloat64(f *codecFnInfo, rv reflect.Value) {
	e.e.EncodeFloat64(rv.Float())
}

func (e *Encoder) kFloat32(f *codecFnInfo, rv reflect.Value) {
	e.e.EncodeFloat32(float32(rv.Float()))
}

func (e *Encoder) kInt(f *codecFnInfo, rv reflect.Value) {
	e.e.EncodeInt(rv.Int())
}

func (e *Encoder) kInt8(f *codecFnInfo, rv reflect.Value) {
	e.e.EncodeInt(rv.Int())
}

func (e *Encoder) kInt16(f *codecFnInfo, rv reflect.Value) {
	e.e.EncodeInt(rv.Int())
}

func (e *Encoder) kInt32(f *codecFnInfo, rv reflect.Value) {
	e.e.EncodeInt(rv.Int())
}

func (e *Encoder) kInt64(f *codecFnInfo, rv reflect.Value) {
	e.e.EncodeInt(rv.Int())
}

func (e *Encoder) kUint(f *codecFnInfo, rv reflect.Value) {
	e.e.EncodeUint(rv.Uint())
}

func (e *Encoder) kUint8(f *codecFnInfo, rv reflect.Value) {
	e.e.EncodeUint(rv.Uint())
}

func (e *Encoder) kUint16(f *codecFnInfo, rv reflect.Value) {
	e.e.EncodeUint(rv.Uint())
}

func (e *Encoder) kUint32(f *codecFnInfo, rv reflect.Value) {
	e.e.EncodeUint(rv.Uint())
}

func (e *Encoder) kUint64(f *codecFnInfo, rv reflect.Value) {
	e.e.EncodeUint(rv.Uint())
}

func (e *Encoder) kUintptr(f *codecFnInfo, rv reflect.Value) {
	e.e.EncodeUint(rv.Uint())
}

func makeMapReflect(t reflect.Type, size int) reflect.Value {
	if size < 0 {
		return reflect.MakeMapWithSize(t, 4)
	}
	return reflect.MakeMapWithSize(t, size)
}
