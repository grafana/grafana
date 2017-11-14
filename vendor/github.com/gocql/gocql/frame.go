// Copyright (c) 2012 The gocql Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gocql

import (
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"runtime"
	"strings"
	"sync"
	"time"
)

type unsetColumn struct{}

var UnsetValue = unsetColumn{}

type namedValue struct {
	name  string
	value interface{}
}

// NamedValue produce a value which will bind to the named parameter in a query
func NamedValue(name string, value interface{}) interface{} {
	return &namedValue{
		name:  name,
		value: value,
	}
}

const (
	protoDirectionMask = 0x80
	protoVersionMask   = 0x7F
	protoVersion1      = 0x01
	protoVersion2      = 0x02
	protoVersion3      = 0x03
	protoVersion4      = 0x04

	maxFrameSize = 256 * 1024 * 1024
)

type protoVersion byte

func (p protoVersion) request() bool {
	return p&protoDirectionMask == 0x00
}

func (p protoVersion) response() bool {
	return p&protoDirectionMask == 0x80
}

func (p protoVersion) version() byte {
	return byte(p) & protoVersionMask
}

func (p protoVersion) String() string {
	dir := "REQ"
	if p.response() {
		dir = "RESP"
	}

	return fmt.Sprintf("[version=%d direction=%s]", p.version(), dir)
}

type frameOp byte

const (
	// header ops
	opError         frameOp = 0x00
	opStartup       frameOp = 0x01
	opReady         frameOp = 0x02
	opAuthenticate  frameOp = 0x03
	opOptions       frameOp = 0x05
	opSupported     frameOp = 0x06
	opQuery         frameOp = 0x07
	opResult        frameOp = 0x08
	opPrepare       frameOp = 0x09
	opExecute       frameOp = 0x0A
	opRegister      frameOp = 0x0B
	opEvent         frameOp = 0x0C
	opBatch         frameOp = 0x0D
	opAuthChallenge frameOp = 0x0E
	opAuthResponse  frameOp = 0x0F
	opAuthSuccess   frameOp = 0x10
)

func (f frameOp) String() string {
	switch f {
	case opError:
		return "ERROR"
	case opStartup:
		return "STARTUP"
	case opReady:
		return "READY"
	case opAuthenticate:
		return "AUTHENTICATE"
	case opOptions:
		return "OPTIONS"
	case opSupported:
		return "SUPPORTED"
	case opQuery:
		return "QUERY"
	case opResult:
		return "RESULT"
	case opPrepare:
		return "PREPARE"
	case opExecute:
		return "EXECUTE"
	case opRegister:
		return "REGISTER"
	case opEvent:
		return "EVENT"
	case opBatch:
		return "BATCH"
	case opAuthChallenge:
		return "AUTH_CHALLENGE"
	case opAuthResponse:
		return "AUTH_RESPONSE"
	case opAuthSuccess:
		return "AUTH_SUCCESS"
	default:
		return fmt.Sprintf("UNKNOWN_OP_%d", f)
	}
}

const (
	// result kind
	resultKindVoid          = 1
	resultKindRows          = 2
	resultKindKeyspace      = 3
	resultKindPrepared      = 4
	resultKindSchemaChanged = 5

	// rows flags
	flagGlobalTableSpec int = 0x01
	flagHasMorePages    int = 0x02
	flagNoMetaData      int = 0x04

	// query flags
	flagValues                byte = 0x01
	flagSkipMetaData          byte = 0x02
	flagPageSize              byte = 0x04
	flagWithPagingState       byte = 0x08
	flagWithSerialConsistency byte = 0x10
	flagDefaultTimestamp      byte = 0x20
	flagWithNameValues        byte = 0x40

	// header flags
	flagCompress      byte = 0x01
	flagTracing       byte = 0x02
	flagCustomPayload byte = 0x04
	flagWarning       byte = 0x08
)

type Consistency uint16

const (
	Any         Consistency = 0x00
	One         Consistency = 0x01
	Two         Consistency = 0x02
	Three       Consistency = 0x03
	Quorum      Consistency = 0x04
	All         Consistency = 0x05
	LocalQuorum Consistency = 0x06
	EachQuorum  Consistency = 0x07
	LocalOne    Consistency = 0x0A
)

func (c Consistency) String() string {
	switch c {
	case Any:
		return "ANY"
	case One:
		return "ONE"
	case Two:
		return "TWO"
	case Three:
		return "THREE"
	case Quorum:
		return "QUORUM"
	case All:
		return "ALL"
	case LocalQuorum:
		return "LOCAL_QUORUM"
	case EachQuorum:
		return "EACH_QUORUM"
	case LocalOne:
		return "LOCAL_ONE"
	default:
		return fmt.Sprintf("UNKNOWN_CONS_0x%x", uint16(c))
	}
}

func (c Consistency) MarshalText() (text []byte, err error) {
	return []byte(c.String()), nil
}

func (c *Consistency) UnmarshalText(text []byte) error {
	switch string(text) {
	case "ANY":
		*c = Any
	case "ONE":
		*c = One
	case "TWO":
		*c = Two
	case "THREE":
		*c = Three
	case "QUORUM":
		*c = Quorum
	case "ALL":
		*c = All
	case "LOCAL_QUORUM":
		*c = LocalQuorum
	case "EACH_QUORUM":
		*c = EachQuorum
	case "LOCAL_ONE":
		*c = LocalOne
	default:
		return fmt.Errorf("invalid consistency %q", string(text))
	}

	return nil
}

func ParseConsistency(s string) Consistency {
	var c Consistency
	if err := c.UnmarshalText([]byte(strings.ToUpper(s))); err != nil {
		panic(err)
	}
	return c
}

// ParseConsistencyWrapper wraps gocql.ParseConsistency to provide an err
// return instead of a panic
func ParseConsistencyWrapper(s string) (consistency Consistency, err error) {
	err = consistency.UnmarshalText([]byte(strings.ToUpper(s)))
	return
}

// MustParseConsistency is the same as ParseConsistency except it returns
// an error (never). It is kept here since breaking changes are not good.
// DEPRECATED: use ParseConsistency if you want a panic on parse error.
func MustParseConsistency(s string) (Consistency, error) {
	c, err := ParseConsistencyWrapper(s)
	if err != nil {
		panic(err)
	}
	return c, nil
}

type SerialConsistency uint16

const (
	Serial      SerialConsistency = 0x08
	LocalSerial SerialConsistency = 0x09
)

func (s SerialConsistency) String() string {
	switch s {
	case Serial:
		return "SERIAL"
	case LocalSerial:
		return "LOCAL_SERIAL"
	default:
		return fmt.Sprintf("UNKNOWN_SERIAL_CONS_0x%x", uint16(s))
	}
}

func (s SerialConsistency) MarshalText() (text []byte, err error) {
	return []byte(s.String()), nil
}

func (s *SerialConsistency) UnmarshalText(text []byte) error {
	switch string(text) {
	case "SERIAL":
		*s = Serial
	case "LOCAL_SERIAL":
		*s = LocalSerial
	default:
		return fmt.Errorf("invalid consistency %q", string(text))
	}

	return nil
}

const (
	apacheCassandraTypePrefix = "org.apache.cassandra.db.marshal."
)

var (
	ErrFrameTooBig = errors.New("frame length is bigger than the maximum allowed")
)

const maxFrameHeaderSize = 9

func writeInt(p []byte, n int32) {
	p[0] = byte(n >> 24)
	p[1] = byte(n >> 16)
	p[2] = byte(n >> 8)
	p[3] = byte(n)
}

func readInt(p []byte) int32 {
	return int32(p[0])<<24 | int32(p[1])<<16 | int32(p[2])<<8 | int32(p[3])
}

func writeShort(p []byte, n uint16) {
	p[0] = byte(n >> 8)
	p[1] = byte(n)
}

func readShort(p []byte) uint16 {
	return uint16(p[0])<<8 | uint16(p[1])
}

type frameHeader struct {
	version       protoVersion
	flags         byte
	stream        int
	op            frameOp
	length        int
	customPayload map[string][]byte
	warnings      []string
}

func (f frameHeader) String() string {
	return fmt.Sprintf("[header version=%s flags=0x%x stream=%d op=%s length=%d]", f.version, f.flags, f.stream, f.op, f.length)
}

func (f frameHeader) Header() frameHeader {
	return f
}

const defaultBufSize = 128

var framerPool = sync.Pool{
	New: func() interface{} {
		return &framer{
			wbuf:       make([]byte, defaultBufSize),
			readBuffer: make([]byte, defaultBufSize),
		}
	},
}

// a framer is responsible for reading, writing and parsing frames on a single stream
type framer struct {
	r io.Reader
	w io.Writer

	proto byte
	// flags are for outgoing flags, enabling compression and tracing etc
	flags    byte
	compres  Compressor
	headSize int
	// if this frame was read then the header will be here
	header *frameHeader

	// if tracing flag is set this is not nil
	traceID []byte

	// holds a ref to the whole byte slice for rbuf so that it can be reset to
	// 0 after a read.
	readBuffer []byte

	rbuf []byte
	wbuf []byte
}

func newFramer(r io.Reader, w io.Writer, compressor Compressor, version byte) *framer {
	f := framerPool.Get().(*framer)
	var flags byte
	if compressor != nil {
		flags |= flagCompress
	}

	version &= protoVersionMask

	headSize := 8
	if version > protoVersion2 {
		headSize = 9
	}

	f.compres = compressor
	f.proto = version
	f.flags = flags
	f.headSize = headSize

	f.r = r
	f.rbuf = f.readBuffer[:0]

	f.w = w
	f.wbuf = f.wbuf[:0]

	f.header = nil
	f.traceID = nil

	return f
}

type frame interface {
	Header() frameHeader
}

func readHeader(r io.Reader, p []byte) (head frameHeader, err error) {
	_, err = io.ReadFull(r, p[:1])
	if err != nil {
		return frameHeader{}, err
	}

	version := p[0] & protoVersionMask

	if version < protoVersion1 || version > protoVersion4 {
		return frameHeader{}, fmt.Errorf("gocql: unsupported protocol response version: %d", version)
	}

	headSize := 9
	if version < protoVersion3 {
		headSize = 8
	}

	_, err = io.ReadFull(r, p[1:headSize])
	if err != nil {
		return frameHeader{}, err
	}

	p = p[:headSize]

	head.version = protoVersion(p[0])
	head.flags = p[1]

	if version > protoVersion2 {
		if len(p) != 9 {
			return frameHeader{}, fmt.Errorf("not enough bytes to read header require 9 got: %d", len(p))
		}

		head.stream = int(int16(p[2])<<8 | int16(p[3]))
		head.op = frameOp(p[4])
		head.length = int(readInt(p[5:]))
	} else {
		if len(p) != 8 {
			return frameHeader{}, fmt.Errorf("not enough bytes to read header require 8 got: %d", len(p))
		}

		head.stream = int(int8(p[2]))
		head.op = frameOp(p[3])
		head.length = int(readInt(p[4:]))
	}

	return head, nil
}

// explicitly enables tracing for the framers outgoing requests
func (f *framer) trace() {
	f.flags |= flagTracing
}

// reads a frame form the wire into the framers buffer
func (f *framer) readFrame(head *frameHeader) error {
	if head.length < 0 {
		return fmt.Errorf("frame body length can not be less than 0: %d", head.length)
	} else if head.length > maxFrameSize {
		// need to free up the connection to be used again
		_, err := io.CopyN(ioutil.Discard, f.r, int64(head.length))
		if err != nil {
			return fmt.Errorf("error whilst trying to discard frame with invalid length: %v", err)
		}
		return ErrFrameTooBig
	}

	if cap(f.readBuffer) >= head.length {
		f.rbuf = f.readBuffer[:head.length]
	} else {
		f.readBuffer = make([]byte, head.length)
		f.rbuf = f.readBuffer
	}

	// assume the underlying reader takes care of timeouts and retries
	n, err := io.ReadFull(f.r, f.rbuf)
	if err != nil {
		return fmt.Errorf("unable to read frame body: read %d/%d bytes: %v", n, head.length, err)
	}

	if head.flags&flagCompress == flagCompress {
		if f.compres == nil {
			return NewErrProtocol("no compressor available with compressed frame body")
		}

		f.rbuf, err = f.compres.Decode(f.rbuf)
		if err != nil {
			return err
		}
	}

	f.header = head
	return nil
}

func (f *framer) parseFrame() (frame frame, err error) {
	defer func() {
		if r := recover(); r != nil {
			if _, ok := r.(runtime.Error); ok {
				panic(r)
			}
			err = r.(error)
		}
	}()

	if f.header.version.request() {
		return nil, NewErrProtocol("got a request frame from server: %v", f.header.version)
	}

	if f.header.flags&flagTracing == flagTracing {
		f.readTrace()
	}

	if f.header.flags&flagWarning == flagWarning {
		f.header.warnings = f.readStringList()
	}

	if f.header.flags&flagCustomPayload == flagCustomPayload {
		f.header.customPayload = f.readBytesMap()
	}

	// assumes that the frame body has been read into rbuf
	switch f.header.op {
	case opError:
		frame = f.parseErrorFrame()
	case opReady:
		frame = f.parseReadyFrame()
	case opResult:
		frame, err = f.parseResultFrame()
	case opSupported:
		frame = f.parseSupportedFrame()
	case opAuthenticate:
		frame = f.parseAuthenticateFrame()
	case opAuthChallenge:
		frame = f.parseAuthChallengeFrame()
	case opAuthSuccess:
		frame = f.parseAuthSuccessFrame()
	case opEvent:
		frame = f.parseEventFrame()
	default:
		return nil, NewErrProtocol("unknown op in frame header: %s", f.header.op)
	}

	return
}

func (f *framer) parseErrorFrame() frame {
	code := f.readInt()
	msg := f.readString()

	errD := errorFrame{
		frameHeader: *f.header,
		code:        code,
		message:     msg,
	}

	switch code {
	case errUnavailable:
		cl := f.readConsistency()
		required := f.readInt()
		alive := f.readInt()
		return &RequestErrUnavailable{
			errorFrame:  errD,
			Consistency: cl,
			Required:    required,
			Alive:       alive,
		}
	case errWriteTimeout:
		cl := f.readConsistency()
		received := f.readInt()
		blockfor := f.readInt()
		writeType := f.readString()
		return &RequestErrWriteTimeout{
			errorFrame:  errD,
			Consistency: cl,
			Received:    received,
			BlockFor:    blockfor,
			WriteType:   writeType,
		}
	case errReadTimeout:
		cl := f.readConsistency()
		received := f.readInt()
		blockfor := f.readInt()
		dataPresent := f.readByte()
		return &RequestErrReadTimeout{
			errorFrame:  errD,
			Consistency: cl,
			Received:    received,
			BlockFor:    blockfor,
			DataPresent: dataPresent,
		}
	case errAlreadyExists:
		ks := f.readString()
		table := f.readString()
		return &RequestErrAlreadyExists{
			errorFrame: errD,
			Keyspace:   ks,
			Table:      table,
		}
	case errUnprepared:
		stmtId := f.readShortBytes()
		return &RequestErrUnprepared{
			errorFrame:  errD,
			StatementId: copyBytes(stmtId), // defensively copy
		}
	case errReadFailure:
		res := &RequestErrReadFailure{
			errorFrame: errD,
		}
		res.Consistency = f.readConsistency()
		res.Received = f.readInt()
		res.BlockFor = f.readInt()
		res.DataPresent = f.readByte() != 0
		return res
	case errWriteFailure:
		res := &RequestErrWriteFailure{
			errorFrame: errD,
		}
		res.Consistency = f.readConsistency()
		res.Received = f.readInt()
		res.BlockFor = f.readInt()
		res.NumFailures = f.readInt()
		res.WriteType = f.readString()
		return res
	case errFunctionFailure:
		res := RequestErrFunctionFailure{
			errorFrame: errD,
		}
		res.Keyspace = f.readString()
		res.Function = f.readString()
		res.ArgTypes = f.readStringList()
		return res
	case errInvalid, errBootstrapping, errConfig, errCredentials, errOverloaded,
		errProtocol, errServer, errSyntax, errTruncate, errUnauthorized:
		// TODO(zariel): we should have some distinct types for these errors
		return errD
	default:
		panic(fmt.Errorf("unknown error code: 0x%x", errD.code))
	}
}

func (f *framer) writeHeader(flags byte, op frameOp, stream int) {
	f.wbuf = f.wbuf[:0]
	f.wbuf = append(f.wbuf,
		f.proto,
		flags,
	)

	if f.proto > protoVersion2 {
		f.wbuf = append(f.wbuf,
			byte(stream>>8),
			byte(stream),
		)
	} else {
		f.wbuf = append(f.wbuf,
			byte(stream),
		)
	}

	// pad out length
	f.wbuf = append(f.wbuf,
		byte(op),
		0,
		0,
		0,
		0,
	)
}

func (f *framer) setLength(length int) {
	p := 4
	if f.proto > protoVersion2 {
		p = 5
	}

	f.wbuf[p+0] = byte(length >> 24)
	f.wbuf[p+1] = byte(length >> 16)
	f.wbuf[p+2] = byte(length >> 8)
	f.wbuf[p+3] = byte(length)
}

func (f *framer) finishWrite() error {
	if len(f.wbuf) > maxFrameSize {
		// huge app frame, lets remove it so it doesn't bloat the heap
		f.wbuf = make([]byte, defaultBufSize)
		return ErrFrameTooBig
	}

	if f.wbuf[1]&flagCompress == flagCompress {
		if f.compres == nil {
			panic("compress flag set with no compressor")
		}

		// TODO: only compress frames which are big enough
		compressed, err := f.compres.Encode(f.wbuf[f.headSize:])
		if err != nil {
			return err
		}

		f.wbuf = append(f.wbuf[:f.headSize], compressed...)
	}
	length := len(f.wbuf) - f.headSize
	f.setLength(length)

	_, err := f.w.Write(f.wbuf)
	if err != nil {
		return err
	}

	return nil
}

func (f *framer) readTrace() {
	f.traceID = f.readUUID().Bytes()
}

type readyFrame struct {
	frameHeader
}

func (f *framer) parseReadyFrame() frame {
	return &readyFrame{
		frameHeader: *f.header,
	}
}

type supportedFrame struct {
	frameHeader

	supported map[string][]string
}

// TODO: if we move the body buffer onto the frameHeader then we only need a single
// framer, and can move the methods onto the header.
func (f *framer) parseSupportedFrame() frame {
	return &supportedFrame{
		frameHeader: *f.header,

		supported: f.readStringMultiMap(),
	}
}

type writeStartupFrame struct {
	opts map[string]string
}

func (w writeStartupFrame) String() string {
	return fmt.Sprintf("[startup opts=%+v]", w.opts)
}

func (w *writeStartupFrame) writeFrame(framer *framer, streamID int) error {
	return framer.writeStartupFrame(streamID, w.opts)
}

func (f *framer) writeStartupFrame(streamID int, options map[string]string) error {
	f.writeHeader(f.flags&^flagCompress, opStartup, streamID)
	f.writeStringMap(options)

	return f.finishWrite()
}

type writePrepareFrame struct {
	statement string
}

func (w *writePrepareFrame) writeFrame(framer *framer, streamID int) error {
	return framer.writePrepareFrame(streamID, w.statement)
}

func (f *framer) writePrepareFrame(stream int, statement string) error {
	f.writeHeader(f.flags, opPrepare, stream)
	f.writeLongString(statement)
	return f.finishWrite()
}

func (f *framer) readTypeInfo() TypeInfo {
	// TODO: factor this out so the same code paths can be used to parse custom
	// types and other types, as much of the logic will be duplicated.
	id := f.readShort()

	simple := NativeType{
		proto: f.proto,
		typ:   Type(id),
	}

	if simple.typ == TypeCustom {
		simple.custom = f.readString()
		if cassType := getApacheCassandraType(simple.custom); cassType != TypeCustom {
			simple.typ = cassType
		}
	}

	switch simple.typ {
	case TypeTuple:
		n := f.readShort()
		tuple := TupleTypeInfo{
			NativeType: simple,
			Elems:      make([]TypeInfo, n),
		}

		for i := 0; i < int(n); i++ {
			tuple.Elems[i] = f.readTypeInfo()
		}

		return tuple

	case TypeUDT:
		udt := UDTTypeInfo{
			NativeType: simple,
		}
		udt.KeySpace = f.readString()
		udt.Name = f.readString()

		n := f.readShort()
		udt.Elements = make([]UDTField, n)
		for i := 0; i < int(n); i++ {
			field := &udt.Elements[i]
			field.Name = f.readString()
			field.Type = f.readTypeInfo()
		}

		return udt
	case TypeMap, TypeList, TypeSet:
		collection := CollectionType{
			NativeType: simple,
		}

		if simple.typ == TypeMap {
			collection.Key = f.readTypeInfo()
		}

		collection.Elem = f.readTypeInfo()

		return collection
	}

	return simple
}

type preparedMetadata struct {
	resultMetadata

	// proto v4+
	pkeyColumns []int
}

func (r preparedMetadata) String() string {
	return fmt.Sprintf("[prepared flags=0x%x pkey=%v paging_state=% X columns=%v col_count=%d actual_col_count=%d]", r.flags, r.pkeyColumns, r.pagingState, r.columns, r.colCount, r.actualColCount)
}

func (f *framer) parsePreparedMetadata() preparedMetadata {
	// TODO: deduplicate this from parseMetadata
	meta := preparedMetadata{}

	meta.flags = f.readInt()
	meta.colCount = f.readInt()
	if meta.colCount < 0 {
		panic(fmt.Errorf("received negative column count: %d", meta.colCount))
	}
	meta.actualColCount = meta.colCount

	if f.proto >= protoVersion4 {
		pkeyCount := f.readInt()
		pkeys := make([]int, pkeyCount)
		for i := 0; i < pkeyCount; i++ {
			pkeys[i] = int(f.readShort())
		}
		meta.pkeyColumns = pkeys
	}

	if meta.flags&flagHasMorePages == flagHasMorePages {
		meta.pagingState = f.readBytes()
	}

	if meta.flags&flagNoMetaData == flagNoMetaData {
		return meta
	}

	var keyspace, table string
	globalSpec := meta.flags&flagGlobalTableSpec == flagGlobalTableSpec
	if globalSpec {
		keyspace = f.readString()
		table = f.readString()
	}

	var cols []ColumnInfo
	if meta.colCount < 1000 {
		// preallocate columninfo to avoid excess copying
		cols = make([]ColumnInfo, meta.colCount)
		for i := 0; i < meta.colCount; i++ {
			f.readCol(&cols[i], &meta.resultMetadata, globalSpec, keyspace, table)
		}
	} else {
		// use append, huge number of columns usually indicates a corrupt frame or
		// just a huge row.
		for i := 0; i < meta.colCount; i++ {
			var col ColumnInfo
			f.readCol(&col, &meta.resultMetadata, globalSpec, keyspace, table)
			cols = append(cols, col)
		}
	}

	meta.columns = cols

	return meta
}

type resultMetadata struct {
	flags int

	// only if flagPageState
	pagingState []byte

	columns  []ColumnInfo
	colCount int

	// this is a count of the total number of columns which can be scanned,
	// it is at minimum len(columns) but may be larger, for instance when a column
	// is a UDT or tuple.
	actualColCount int
}

func (r resultMetadata) String() string {
	return fmt.Sprintf("[metadata flags=0x%x paging_state=% X columns=%v]", r.flags, r.pagingState, r.columns)
}

func (f *framer) readCol(col *ColumnInfo, meta *resultMetadata, globalSpec bool, keyspace, table string) {
	if !globalSpec {
		col.Keyspace = f.readString()
		col.Table = f.readString()
	} else {
		col.Keyspace = keyspace
		col.Table = table
	}

	col.Name = f.readString()
	col.TypeInfo = f.readTypeInfo()
	switch v := col.TypeInfo.(type) {
	// maybe also UDT
	case TupleTypeInfo:
		// -1 because we already included the tuple column
		meta.actualColCount += len(v.Elems) - 1
	}
}

func (f *framer) parseResultMetadata() resultMetadata {
	var meta resultMetadata

	meta.flags = f.readInt()
	meta.colCount = f.readInt()
	if meta.colCount < 0 {
		panic(fmt.Errorf("received negative column count: %d", meta.colCount))
	}
	meta.actualColCount = meta.colCount

	if meta.flags&flagHasMorePages == flagHasMorePages {
		meta.pagingState = f.readBytes()
	}

	if meta.flags&flagNoMetaData == flagNoMetaData {
		return meta
	}

	var keyspace, table string
	globalSpec := meta.flags&flagGlobalTableSpec == flagGlobalTableSpec
	if globalSpec {
		keyspace = f.readString()
		table = f.readString()
	}

	var cols []ColumnInfo
	if meta.colCount < 1000 {
		// preallocate columninfo to avoid excess copying
		cols = make([]ColumnInfo, meta.colCount)
		for i := 0; i < meta.colCount; i++ {
			f.readCol(&cols[i], &meta, globalSpec, keyspace, table)
		}

	} else {
		// use append, huge number of columns usually indicates a corrupt frame or
		// just a huge row.
		for i := 0; i < meta.colCount; i++ {
			var col ColumnInfo
			f.readCol(&col, &meta, globalSpec, keyspace, table)
			cols = append(cols, col)
		}
	}

	meta.columns = cols

	return meta
}

type resultVoidFrame struct {
	frameHeader
}

func (f *resultVoidFrame) String() string {
	return "[result_void]"
}

func (f *framer) parseResultFrame() (frame, error) {
	kind := f.readInt()

	switch kind {
	case resultKindVoid:
		return &resultVoidFrame{frameHeader: *f.header}, nil
	case resultKindRows:
		return f.parseResultRows(), nil
	case resultKindKeyspace:
		return f.parseResultSetKeyspace(), nil
	case resultKindPrepared:
		return f.parseResultPrepared(), nil
	case resultKindSchemaChanged:
		return f.parseResultSchemaChange(), nil
	}

	return nil, NewErrProtocol("unknown result kind: %x", kind)
}

type resultRowsFrame struct {
	frameHeader

	meta resultMetadata
	// dont parse the rows here as we only need to do it once
	numRows int
}

func (f *resultRowsFrame) String() string {
	return fmt.Sprintf("[result_rows meta=%v]", f.meta)
}

func (f *framer) parseResultRows() frame {
	result := &resultRowsFrame{}
	result.meta = f.parseResultMetadata()

	result.numRows = f.readInt()
	if result.numRows < 0 {
		panic(fmt.Errorf("invalid row_count in result frame: %d", result.numRows))
	}

	return result
}

type resultKeyspaceFrame struct {
	frameHeader
	keyspace string
}

func (r *resultKeyspaceFrame) String() string {
	return fmt.Sprintf("[result_keyspace keyspace=%s]", r.keyspace)
}

func (f *framer) parseResultSetKeyspace() frame {
	return &resultKeyspaceFrame{
		frameHeader: *f.header,
		keyspace:    f.readString(),
	}
}

type resultPreparedFrame struct {
	frameHeader

	preparedID []byte
	reqMeta    preparedMetadata
	respMeta   resultMetadata
}

func (f *framer) parseResultPrepared() frame {
	frame := &resultPreparedFrame{
		frameHeader: *f.header,
		preparedID:  f.readShortBytes(),
		reqMeta:     f.parsePreparedMetadata(),
	}

	if f.proto < protoVersion2 {
		return frame
	}

	frame.respMeta = f.parseResultMetadata()

	return frame
}

type schemaChangeKeyspace struct {
	frameHeader

	change   string
	keyspace string
}

func (f schemaChangeKeyspace) String() string {
	return fmt.Sprintf("[event schema_change_keyspace change=%q keyspace=%q]", f.change, f.keyspace)
}

type schemaChangeTable struct {
	frameHeader

	change   string
	keyspace string
	object   string
}

func (f schemaChangeTable) String() string {
	return fmt.Sprintf("[event schema_change change=%q keyspace=%q object=%q]", f.change, f.keyspace, f.object)
}

type schemaChangeFunction struct {
	frameHeader

	change   string
	keyspace string
	name     string
	args     []string
}

func (f *framer) parseResultSchemaChange() frame {
	if f.proto <= protoVersion2 {
		change := f.readString()
		keyspace := f.readString()
		table := f.readString()

		if table != "" {
			return &schemaChangeTable{
				frameHeader: *f.header,
				change:      change,
				keyspace:    keyspace,
				object:      table,
			}
		} else {
			return &schemaChangeKeyspace{
				frameHeader: *f.header,
				change:      change,
				keyspace:    keyspace,
			}
		}
	} else {
		change := f.readString()
		target := f.readString()

		// TODO: could just use a separate type for each target
		switch target {
		case "KEYSPACE":
			frame := &schemaChangeKeyspace{
				frameHeader: *f.header,
				change:      change,
			}

			frame.keyspace = f.readString()

			return frame
		case "TABLE", "TYPE":
			frame := &schemaChangeTable{
				frameHeader: *f.header,
				change:      change,
			}

			frame.keyspace = f.readString()
			frame.object = f.readString()

			return frame
		case "FUNCTION", "AGGREGATE":
			frame := &schemaChangeFunction{
				frameHeader: *f.header,
				change:      change,
			}

			frame.keyspace = f.readString()
			frame.name = f.readString()
			frame.args = f.readStringList()

			return frame
		default:
			panic(fmt.Errorf("gocql: unknown SCHEMA_CHANGE target: %q change: %q", target, change))
		}
	}

}

type authenticateFrame struct {
	frameHeader

	class string
}

func (a *authenticateFrame) String() string {
	return fmt.Sprintf("[authenticate class=%q]", a.class)
}

func (f *framer) parseAuthenticateFrame() frame {
	return &authenticateFrame{
		frameHeader: *f.header,
		class:       f.readString(),
	}
}

type authSuccessFrame struct {
	frameHeader

	data []byte
}

func (a *authSuccessFrame) String() string {
	return fmt.Sprintf("[auth_success data=%q]", a.data)
}

func (f *framer) parseAuthSuccessFrame() frame {
	return &authSuccessFrame{
		frameHeader: *f.header,
		data:        f.readBytes(),
	}
}

type authChallengeFrame struct {
	frameHeader

	data []byte
}

func (a *authChallengeFrame) String() string {
	return fmt.Sprintf("[auth_challenge data=%q]", a.data)
}

func (f *framer) parseAuthChallengeFrame() frame {
	return &authChallengeFrame{
		frameHeader: *f.header,
		data:        f.readBytes(),
	}
}

type statusChangeEventFrame struct {
	frameHeader

	change string
	host   net.IP
	port   int
}

func (t statusChangeEventFrame) String() string {
	return fmt.Sprintf("[status_change change=%s host=%v port=%v]", t.change, t.host, t.port)
}

// essentially the same as statusChange
type topologyChangeEventFrame struct {
	frameHeader

	change string
	host   net.IP
	port   int
}

func (t topologyChangeEventFrame) String() string {
	return fmt.Sprintf("[topology_change change=%s host=%v port=%v]", t.change, t.host, t.port)
}

func (f *framer) parseEventFrame() frame {
	eventType := f.readString()

	switch eventType {
	case "TOPOLOGY_CHANGE":
		frame := &topologyChangeEventFrame{frameHeader: *f.header}
		frame.change = f.readString()
		frame.host, frame.port = f.readInet()

		return frame
	case "STATUS_CHANGE":
		frame := &statusChangeEventFrame{frameHeader: *f.header}
		frame.change = f.readString()
		frame.host, frame.port = f.readInet()

		return frame
	case "SCHEMA_CHANGE":
		// this should work for all versions
		return f.parseResultSchemaChange()
	default:
		panic(fmt.Errorf("gocql: unknown event type: %q", eventType))
	}

}

type writeAuthResponseFrame struct {
	data []byte
}

func (a *writeAuthResponseFrame) String() string {
	return fmt.Sprintf("[auth_response data=%q]", a.data)
}

func (a *writeAuthResponseFrame) writeFrame(framer *framer, streamID int) error {
	return framer.writeAuthResponseFrame(streamID, a.data)
}

func (f *framer) writeAuthResponseFrame(streamID int, data []byte) error {
	f.writeHeader(f.flags, opAuthResponse, streamID)
	f.writeBytes(data)
	return f.finishWrite()
}

type queryValues struct {
	value []byte

	// optional name, will set With names for values flag
	name    string
	isUnset bool
}

type queryParams struct {
	consistency Consistency
	// v2+
	skipMeta          bool
	values            []queryValues
	pageSize          int
	pagingState       []byte
	serialConsistency SerialConsistency
	// v3+
	defaultTimestamp      bool
	defaultTimestampValue int64
}

func (q queryParams) String() string {
	return fmt.Sprintf("[query_params consistency=%v skip_meta=%v page_size=%d paging_state=%q serial_consistency=%v default_timestamp=%v values=%v]",
		q.consistency, q.skipMeta, q.pageSize, q.pagingState, q.serialConsistency, q.defaultTimestamp, q.values)
}

func (f *framer) writeQueryParams(opts *queryParams) {
	f.writeConsistency(opts.consistency)

	if f.proto == protoVersion1 {
		return
	}

	var flags byte
	if len(opts.values) > 0 {
		flags |= flagValues
	}
	if opts.skipMeta {
		flags |= flagSkipMetaData
	}
	if opts.pageSize > 0 {
		flags |= flagPageSize
	}
	if len(opts.pagingState) > 0 {
		flags |= flagWithPagingState
	}
	if opts.serialConsistency > 0 {
		flags |= flagWithSerialConsistency
	}

	names := false

	// protoV3 specific things
	if f.proto > protoVersion2 {
		if opts.defaultTimestamp {
			flags |= flagDefaultTimestamp
		}

		if len(opts.values) > 0 && opts.values[0].name != "" {
			flags |= flagWithNameValues
			names = true
		}
	}

	f.writeByte(flags)

	if n := len(opts.values); n > 0 {
		f.writeShort(uint16(n))

		for i := 0; i < n; i++ {
			if names {
				f.writeString(opts.values[i].name)
			}
			if opts.values[i].isUnset {
				f.writeUnset()
			} else {
				f.writeBytes(opts.values[i].value)
			}
		}
	}

	if opts.pageSize > 0 {
		f.writeInt(int32(opts.pageSize))
	}

	if len(opts.pagingState) > 0 {
		f.writeBytes(opts.pagingState)
	}

	if opts.serialConsistency > 0 {
		f.writeConsistency(Consistency(opts.serialConsistency))
	}

	if f.proto > protoVersion2 && opts.defaultTimestamp {
		// timestamp in microseconds
		var ts int64
		if opts.defaultTimestampValue != 0 {
			ts = opts.defaultTimestampValue
		} else {
			ts = time.Now().UnixNano() / 1000
		}
		f.writeLong(ts)
	}
}

type writeQueryFrame struct {
	statement string
	params    queryParams
}

func (w *writeQueryFrame) String() string {
	return fmt.Sprintf("[query statement=%q params=%v]", w.statement, w.params)
}

func (w *writeQueryFrame) writeFrame(framer *framer, streamID int) error {
	return framer.writeQueryFrame(streamID, w.statement, &w.params)
}

func (f *framer) writeQueryFrame(streamID int, statement string, params *queryParams) error {
	f.writeHeader(f.flags, opQuery, streamID)
	f.writeLongString(statement)
	f.writeQueryParams(params)

	return f.finishWrite()
}

type frameWriter interface {
	writeFrame(framer *framer, streamID int) error
}

type frameWriterFunc func(framer *framer, streamID int) error

func (f frameWriterFunc) writeFrame(framer *framer, streamID int) error {
	return f(framer, streamID)
}

type writeExecuteFrame struct {
	preparedID []byte
	params     queryParams
}

func (e *writeExecuteFrame) String() string {
	return fmt.Sprintf("[execute id=% X params=%v]", e.preparedID, &e.params)
}

func (e *writeExecuteFrame) writeFrame(fr *framer, streamID int) error {
	return fr.writeExecuteFrame(streamID, e.preparedID, &e.params)
}

func (f *framer) writeExecuteFrame(streamID int, preparedID []byte, params *queryParams) error {
	f.writeHeader(f.flags, opExecute, streamID)
	f.writeShortBytes(preparedID)
	if f.proto > protoVersion1 {
		f.writeQueryParams(params)
	} else {
		n := len(params.values)
		f.writeShort(uint16(n))
		for i := 0; i < n; i++ {
			if params.values[i].isUnset {
				f.writeUnset()
			} else {
				f.writeBytes(params.values[i].value)
			}
		}
		f.writeConsistency(params.consistency)
	}

	return f.finishWrite()
}

// TODO: can we replace BatchStatemt with batchStatement? As they prety much
// duplicate each other
type batchStatment struct {
	preparedID []byte
	statement  string
	values     []queryValues
}

type writeBatchFrame struct {
	typ         BatchType
	statements  []batchStatment
	consistency Consistency

	// v3+
	serialConsistency     SerialConsistency
	defaultTimestamp      bool
	defaultTimestampValue int64
}

func (w *writeBatchFrame) writeFrame(framer *framer, streamID int) error {
	return framer.writeBatchFrame(streamID, w)
}

func (f *framer) writeBatchFrame(streamID int, w *writeBatchFrame) error {
	f.writeHeader(f.flags, opBatch, streamID)
	f.writeByte(byte(w.typ))

	n := len(w.statements)
	f.writeShort(uint16(n))

	var flags byte

	for i := 0; i < n; i++ {
		b := &w.statements[i]
		if len(b.preparedID) == 0 {
			f.writeByte(0)
			f.writeLongString(b.statement)
		} else {
			f.writeByte(1)
			f.writeShortBytes(b.preparedID)
		}

		f.writeShort(uint16(len(b.values)))
		for j := range b.values {
			col := &b.values[j]
			if f.proto > protoVersion2 && col.name != "" {
				// TODO: move this check into the caller and set a flag on writeBatchFrame
				// to indicate using named values
				flags |= flagWithNameValues
				f.writeString(col.name)
			}
			if col.isUnset {
				f.writeUnset()
			} else {
				f.writeBytes(col.value)
			}
		}
	}

	f.writeConsistency(w.consistency)

	if f.proto > protoVersion2 {
		if w.serialConsistency > 0 {
			flags |= flagWithSerialConsistency
		}
		if w.defaultTimestamp {
			flags |= flagDefaultTimestamp
		}

		f.writeByte(flags)

		if w.serialConsistency > 0 {
			f.writeConsistency(Consistency(w.serialConsistency))
		}

		if w.defaultTimestamp {
			var ts int64
			if w.defaultTimestampValue != 0 {
				ts = w.defaultTimestampValue
			} else {
				ts = time.Now().UnixNano() / 1000
			}
			f.writeLong(ts)
		}
	}

	return f.finishWrite()
}

type writeOptionsFrame struct{}

func (w *writeOptionsFrame) writeFrame(framer *framer, streamID int) error {
	return framer.writeOptionsFrame(streamID, w)
}

func (f *framer) writeOptionsFrame(stream int, _ *writeOptionsFrame) error {
	f.writeHeader(f.flags, opOptions, stream)
	return f.finishWrite()
}

type writeRegisterFrame struct {
	events []string
}

func (w *writeRegisterFrame) writeFrame(framer *framer, streamID int) error {
	return framer.writeRegisterFrame(streamID, w)
}

func (f *framer) writeRegisterFrame(streamID int, w *writeRegisterFrame) error {
	f.writeHeader(f.flags, opRegister, streamID)
	f.writeStringList(w.events)

	return f.finishWrite()
}

func (f *framer) readByte() byte {
	if len(f.rbuf) < 1 {
		panic(fmt.Errorf("not enough bytes in buffer to read byte require 1 got: %d", len(f.rbuf)))
	}

	b := f.rbuf[0]
	f.rbuf = f.rbuf[1:]
	return b
}

func (f *framer) readInt() (n int) {
	if len(f.rbuf) < 4 {
		panic(fmt.Errorf("not enough bytes in buffer to read int require 4 got: %d", len(f.rbuf)))
	}

	n = int(int32(f.rbuf[0])<<24 | int32(f.rbuf[1])<<16 | int32(f.rbuf[2])<<8 | int32(f.rbuf[3]))
	f.rbuf = f.rbuf[4:]
	return
}

func (f *framer) readShort() (n uint16) {
	if len(f.rbuf) < 2 {
		panic(fmt.Errorf("not enough bytes in buffer to read short require 2 got: %d", len(f.rbuf)))
	}
	n = uint16(f.rbuf[0])<<8 | uint16(f.rbuf[1])
	f.rbuf = f.rbuf[2:]
	return
}

func (f *framer) readLong() (n int64) {
	if len(f.rbuf) < 8 {
		panic(fmt.Errorf("not enough bytes in buffer to read long require 8 got: %d", len(f.rbuf)))
	}
	n = int64(f.rbuf[0])<<56 | int64(f.rbuf[1])<<48 | int64(f.rbuf[2])<<40 | int64(f.rbuf[3])<<32 |
		int64(f.rbuf[4])<<24 | int64(f.rbuf[5])<<16 | int64(f.rbuf[6])<<8 | int64(f.rbuf[7])
	f.rbuf = f.rbuf[8:]
	return
}

func (f *framer) readString() (s string) {
	size := f.readShort()

	if len(f.rbuf) < int(size) {
		panic(fmt.Errorf("not enough bytes in buffer to read string require %d got: %d", size, len(f.rbuf)))
	}

	s = string(f.rbuf[:size])
	f.rbuf = f.rbuf[size:]
	return
}

func (f *framer) readLongString() (s string) {
	size := f.readInt()

	if len(f.rbuf) < size {
		panic(fmt.Errorf("not enough bytes in buffer to read long string require %d got: %d", size, len(f.rbuf)))
	}

	s = string(f.rbuf[:size])
	f.rbuf = f.rbuf[size:]
	return
}

func (f *framer) readUUID() *UUID {
	if len(f.rbuf) < 16 {
		panic(fmt.Errorf("not enough bytes in buffer to read uuid require %d got: %d", 16, len(f.rbuf)))
	}

	// TODO: how to handle this error, if it is a uuid, then sureley, problems?
	u, _ := UUIDFromBytes(f.rbuf[:16])
	f.rbuf = f.rbuf[16:]
	return &u
}

func (f *framer) readStringList() []string {
	size := f.readShort()

	l := make([]string, size)
	for i := 0; i < int(size); i++ {
		l[i] = f.readString()
	}

	return l
}

func (f *framer) readBytesInternal() ([]byte, error) {
	size := f.readInt()
	if size < 0 {
		return nil, nil
	}

	if len(f.rbuf) < size {
		return nil, fmt.Errorf("not enough bytes in buffer to read bytes require %d got: %d", size, len(f.rbuf))
	}

	l := f.rbuf[:size]
	f.rbuf = f.rbuf[size:]

	return l, nil
}

func (f *framer) readBytes() []byte {
	l, err := f.readBytesInternal()
	if err != nil {
		panic(err)
	}

	return l
}

func (f *framer) readShortBytes() []byte {
	size := f.readShort()
	if len(f.rbuf) < int(size) {
		panic(fmt.Errorf("not enough bytes in buffer to read short bytes: require %d got %d", size, len(f.rbuf)))
	}

	l := f.rbuf[:size]
	f.rbuf = f.rbuf[size:]

	return l
}

func (f *framer) readInet() (net.IP, int) {
	if len(f.rbuf) < 1 {
		panic(fmt.Errorf("not enough bytes in buffer to read inet size require %d got: %d", 1, len(f.rbuf)))
	}

	size := f.rbuf[0]
	f.rbuf = f.rbuf[1:]

	if !(size == 4 || size == 16) {
		panic(fmt.Errorf("invalid IP size: %d", size))
	}

	if len(f.rbuf) < 1 {
		panic(fmt.Errorf("not enough bytes in buffer to read inet require %d got: %d", size, len(f.rbuf)))
	}

	ip := make([]byte, size)
	copy(ip, f.rbuf[:size])
	f.rbuf = f.rbuf[size:]

	port := f.readInt()
	return net.IP(ip), port
}

func (f *framer) readConsistency() Consistency {
	return Consistency(f.readShort())
}

func (f *framer) readStringMap() map[string]string {
	size := f.readShort()
	m := make(map[string]string)

	for i := 0; i < int(size); i++ {
		k := f.readString()
		v := f.readString()
		m[k] = v
	}

	return m
}

func (f *framer) readBytesMap() map[string][]byte {
	size := f.readShort()
	m := make(map[string][]byte)

	for i := 0; i < int(size); i++ {
		k := f.readString()
		v := f.readBytes()
		m[k] = v
	}

	return m
}

func (f *framer) readStringMultiMap() map[string][]string {
	size := f.readShort()
	m := make(map[string][]string)

	for i := 0; i < int(size); i++ {
		k := f.readString()
		v := f.readStringList()
		m[k] = v
	}

	return m
}

func (f *framer) writeByte(b byte) {
	f.wbuf = append(f.wbuf, b)
}

func appendBytes(p []byte, d []byte) []byte {
	if d == nil {
		return appendInt(p, -1)
	}
	p = appendInt(p, int32(len(d)))
	p = append(p, d...)
	return p
}

func appendShort(p []byte, n uint16) []byte {
	return append(p,
		byte(n>>8),
		byte(n),
	)
}

func appendInt(p []byte, n int32) []byte {
	return append(p, byte(n>>24),
		byte(n>>16),
		byte(n>>8),
		byte(n))
}

func appendLong(p []byte, n int64) []byte {
	return append(p,
		byte(n>>56),
		byte(n>>48),
		byte(n>>40),
		byte(n>>32),
		byte(n>>24),
		byte(n>>16),
		byte(n>>8),
		byte(n),
	)
}

// these are protocol level binary types
func (f *framer) writeInt(n int32) {
	f.wbuf = appendInt(f.wbuf, n)
}

func (f *framer) writeShort(n uint16) {
	f.wbuf = appendShort(f.wbuf, n)
}

func (f *framer) writeLong(n int64) {
	f.wbuf = appendLong(f.wbuf, n)
}

func (f *framer) writeString(s string) {
	f.writeShort(uint16(len(s)))
	f.wbuf = append(f.wbuf, s...)
}

func (f *framer) writeLongString(s string) {
	f.writeInt(int32(len(s)))
	f.wbuf = append(f.wbuf, s...)
}

func (f *framer) writeUUID(u *UUID) {
	f.wbuf = append(f.wbuf, u[:]...)
}

func (f *framer) writeStringList(l []string) {
	f.writeShort(uint16(len(l)))
	for _, s := range l {
		f.writeString(s)
	}
}

func (f *framer) writeUnset() {
	// Protocol version 4 specifies that bind variables do not require having a
	// value when executing a statement.   Bind variables without a value are
	// called 'unset'. The 'unset' bind variable is serialized as the int
	// value '-2' without following bytes.
	f.writeInt(-2)
}

func (f *framer) writeBytes(p []byte) {
	// TODO: handle null case correctly,
	//     [bytes]        A [int] n, followed by n bytes if n >= 0. If n < 0,
	//					  no byte should follow and the value represented is `null`.
	if p == nil {
		f.writeInt(-1)
	} else {
		f.writeInt(int32(len(p)))
		f.wbuf = append(f.wbuf, p...)
	}
}

func (f *framer) writeShortBytes(p []byte) {
	f.writeShort(uint16(len(p)))
	f.wbuf = append(f.wbuf, p...)
}

func (f *framer) writeInet(ip net.IP, port int) {
	f.wbuf = append(f.wbuf,
		byte(len(ip)),
	)

	f.wbuf = append(f.wbuf,
		[]byte(ip)...,
	)

	f.writeInt(int32(port))
}

func (f *framer) writeConsistency(cons Consistency) {
	f.writeShort(uint16(cons))
}

func (f *framer) writeStringMap(m map[string]string) {
	f.writeShort(uint16(len(m)))
	for k, v := range m {
		f.writeString(k)
		f.writeString(v)
	}
}
