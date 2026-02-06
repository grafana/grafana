/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package thrift

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
)

type TBinaryProtocol struct {
	trans         TRichTransport
	origTransport TTransport
	cfg           *TConfiguration
	buffer        [64]byte
}

type TBinaryProtocolFactory struct {
	cfg *TConfiguration
}

// Deprecated: Use NewTBinaryProtocolConf instead.
func NewTBinaryProtocolTransport(t TTransport) *TBinaryProtocol {
	return NewTBinaryProtocolConf(t, &TConfiguration{
		noPropagation: true,
	})
}

// Deprecated: Use NewTBinaryProtocolConf instead.
func NewTBinaryProtocol(t TTransport, strictRead, strictWrite bool) *TBinaryProtocol {
	return NewTBinaryProtocolConf(t, &TConfiguration{
		TBinaryStrictRead:  &strictRead,
		TBinaryStrictWrite: &strictWrite,

		noPropagation: true,
	})
}

func NewTBinaryProtocolConf(t TTransport, conf *TConfiguration) *TBinaryProtocol {
	PropagateTConfiguration(t, conf)
	p := &TBinaryProtocol{
		origTransport: t,
		cfg:           conf,
	}
	if et, ok := t.(TRichTransport); ok {
		p.trans = et
	} else {
		p.trans = NewTRichTransport(t)
	}
	return p
}

// Deprecated: Use NewTBinaryProtocolFactoryConf instead.
func NewTBinaryProtocolFactoryDefault() *TBinaryProtocolFactory {
	return NewTBinaryProtocolFactoryConf(&TConfiguration{
		noPropagation: true,
	})
}

// Deprecated: Use NewTBinaryProtocolFactoryConf instead.
func NewTBinaryProtocolFactory(strictRead, strictWrite bool) *TBinaryProtocolFactory {
	return NewTBinaryProtocolFactoryConf(&TConfiguration{
		TBinaryStrictRead:  &strictRead,
		TBinaryStrictWrite: &strictWrite,

		noPropagation: true,
	})
}

func NewTBinaryProtocolFactoryConf(conf *TConfiguration) *TBinaryProtocolFactory {
	return &TBinaryProtocolFactory{
		cfg: conf,
	}
}

func (p *TBinaryProtocolFactory) GetProtocol(t TTransport) TProtocol {
	return NewTBinaryProtocolConf(t, p.cfg)
}

func (p *TBinaryProtocolFactory) SetTConfiguration(conf *TConfiguration) {
	p.cfg = conf
}

/**
 * Writing Methods
 */

func (p *TBinaryProtocol) WriteMessageBegin(ctx context.Context, name string, typeId TMessageType, seqId int32) error {
	if p.cfg.GetTBinaryStrictWrite() {
		version := uint32(VERSION_1) | uint32(typeId)
		e := p.WriteI32(ctx, int32(version))
		if e != nil {
			return e
		}
		e = p.WriteString(ctx, name)
		if e != nil {
			return e
		}
		e = p.WriteI32(ctx, seqId)
		return e
	} else {
		e := p.WriteString(ctx, name)
		if e != nil {
			return e
		}
		e = p.WriteByte(ctx, int8(typeId))
		if e != nil {
			return e
		}
		e = p.WriteI32(ctx, seqId)
		return e
	}
	return nil
}

func (p *TBinaryProtocol) WriteMessageEnd(ctx context.Context) error {
	return nil
}

func (p *TBinaryProtocol) WriteStructBegin(ctx context.Context, name string) error {
	return nil
}

func (p *TBinaryProtocol) WriteStructEnd(ctx context.Context) error {
	return nil
}

func (p *TBinaryProtocol) WriteFieldBegin(ctx context.Context, name string, typeId TType, id int16) error {
	e := p.WriteByte(ctx, int8(typeId))
	if e != nil {
		return e
	}
	e = p.WriteI16(ctx, id)
	return e
}

func (p *TBinaryProtocol) WriteFieldEnd(ctx context.Context) error {
	return nil
}

func (p *TBinaryProtocol) WriteFieldStop(ctx context.Context) error {
	e := p.WriteByte(ctx, STOP)
	return e
}

func (p *TBinaryProtocol) WriteMapBegin(ctx context.Context, keyType TType, valueType TType, size int) error {
	e := p.WriteByte(ctx, int8(keyType))
	if e != nil {
		return e
	}
	e = p.WriteByte(ctx, int8(valueType))
	if e != nil {
		return e
	}
	e = p.WriteI32(ctx, int32(size))
	return e
}

func (p *TBinaryProtocol) WriteMapEnd(ctx context.Context) error {
	return nil
}

func (p *TBinaryProtocol) WriteListBegin(ctx context.Context, elemType TType, size int) error {
	e := p.WriteByte(ctx, int8(elemType))
	if e != nil {
		return e
	}
	e = p.WriteI32(ctx, int32(size))
	return e
}

func (p *TBinaryProtocol) WriteListEnd(ctx context.Context) error {
	return nil
}

func (p *TBinaryProtocol) WriteSetBegin(ctx context.Context, elemType TType, size int) error {
	e := p.WriteByte(ctx, int8(elemType))
	if e != nil {
		return e
	}
	e = p.WriteI32(ctx, int32(size))
	return e
}

func (p *TBinaryProtocol) WriteSetEnd(ctx context.Context) error {
	return nil
}

func (p *TBinaryProtocol) WriteBool(ctx context.Context, value bool) error {
	if value {
		return p.WriteByte(ctx, 1)
	}
	return p.WriteByte(ctx, 0)
}

func (p *TBinaryProtocol) WriteByte(ctx context.Context, value int8) error {
	e := p.trans.WriteByte(byte(value))
	return NewTProtocolException(e)
}

func (p *TBinaryProtocol) WriteI16(ctx context.Context, value int16) error {
	v := p.buffer[0:2]
	binary.BigEndian.PutUint16(v, uint16(value))
	_, e := p.trans.Write(v)
	return NewTProtocolException(e)
}

func (p *TBinaryProtocol) WriteI32(ctx context.Context, value int32) error {
	v := p.buffer[0:4]
	binary.BigEndian.PutUint32(v, uint32(value))
	_, e := p.trans.Write(v)
	return NewTProtocolException(e)
}

func (p *TBinaryProtocol) WriteI64(ctx context.Context, value int64) error {
	v := p.buffer[0:8]
	binary.BigEndian.PutUint64(v, uint64(value))
	_, err := p.trans.Write(v)
	return NewTProtocolException(err)
}

func (p *TBinaryProtocol) WriteDouble(ctx context.Context, value float64) error {
	return p.WriteI64(ctx, int64(math.Float64bits(value)))
}

func (p *TBinaryProtocol) WriteString(ctx context.Context, value string) error {
	e := p.WriteI32(ctx, int32(len(value)))
	if e != nil {
		return e
	}
	_, err := p.trans.WriteString(value)
	return NewTProtocolException(err)
}

func (p *TBinaryProtocol) WriteBinary(ctx context.Context, value []byte) error {
	e := p.WriteI32(ctx, int32(len(value)))
	if e != nil {
		return e
	}
	_, err := p.trans.Write(value)
	return NewTProtocolException(err)
}

/**
 * Reading methods
 */

func (p *TBinaryProtocol) ReadMessageBegin(ctx context.Context) (name string, typeId TMessageType, seqId int32, err error) {
	size, e := p.ReadI32(ctx)
	if e != nil {
		return "", typeId, 0, NewTProtocolException(e)
	}
	if size < 0 {
		typeId = TMessageType(size & 0x0ff)
		version := int64(int64(size) & VERSION_MASK)
		if version != VERSION_1 {
			return name, typeId, seqId, NewTProtocolExceptionWithType(BAD_VERSION, fmt.Errorf("Bad version in ReadMessageBegin"))
		}
		name, e = p.ReadString(ctx)
		if e != nil {
			return name, typeId, seqId, NewTProtocolException(e)
		}
		seqId, e = p.ReadI32(ctx)
		if e != nil {
			return name, typeId, seqId, NewTProtocolException(e)
		}
		return name, typeId, seqId, nil
	}
	if p.cfg.GetTBinaryStrictRead() {
		return name, typeId, seqId, NewTProtocolExceptionWithType(BAD_VERSION, fmt.Errorf("Missing version in ReadMessageBegin"))
	}
	name, e2 := p.readStringBody(size)
	if e2 != nil {
		return name, typeId, seqId, e2
	}
	b, e3 := p.ReadByte(ctx)
	if e3 != nil {
		return name, typeId, seqId, e3
	}
	typeId = TMessageType(b)
	seqId, e4 := p.ReadI32(ctx)
	if e4 != nil {
		return name, typeId, seqId, e4
	}
	return name, typeId, seqId, nil
}

func (p *TBinaryProtocol) ReadMessageEnd(ctx context.Context) error {
	return nil
}

func (p *TBinaryProtocol) ReadStructBegin(ctx context.Context) (name string, err error) {
	return
}

func (p *TBinaryProtocol) ReadStructEnd(ctx context.Context) error {
	return nil
}

func (p *TBinaryProtocol) ReadFieldBegin(ctx context.Context) (name string, typeId TType, seqId int16, err error) {
	t, err := p.ReadByte(ctx)
	typeId = TType(t)
	if err != nil {
		return name, typeId, seqId, err
	}
	if t != STOP {
		seqId, err = p.ReadI16(ctx)
	}
	return name, typeId, seqId, err
}

func (p *TBinaryProtocol) ReadFieldEnd(ctx context.Context) error {
	return nil
}

var invalidDataLength = NewTProtocolExceptionWithType(INVALID_DATA, errors.New("Invalid data length"))

func (p *TBinaryProtocol) ReadMapBegin(ctx context.Context) (kType, vType TType, size int, err error) {
	k, e := p.ReadByte(ctx)
	if e != nil {
		err = NewTProtocolException(e)
		return
	}
	kType = TType(k)
	v, e := p.ReadByte(ctx)
	if e != nil {
		err = NewTProtocolException(e)
		return
	}
	vType = TType(v)
	size32, e := p.ReadI32(ctx)
	if e != nil {
		err = NewTProtocolException(e)
		return
	}
	if size32 < 0 {
		err = invalidDataLength
		return
	}
	size = int(size32)
	return kType, vType, size, nil
}

func (p *TBinaryProtocol) ReadMapEnd(ctx context.Context) error {
	return nil
}

func (p *TBinaryProtocol) ReadListBegin(ctx context.Context) (elemType TType, size int, err error) {
	b, e := p.ReadByte(ctx)
	if e != nil {
		err = NewTProtocolException(e)
		return
	}
	elemType = TType(b)
	size32, e := p.ReadI32(ctx)
	if e != nil {
		err = NewTProtocolException(e)
		return
	}
	if size32 < 0 {
		err = invalidDataLength
		return
	}
	size = int(size32)

	return
}

func (p *TBinaryProtocol) ReadListEnd(ctx context.Context) error {
	return nil
}

func (p *TBinaryProtocol) ReadSetBegin(ctx context.Context) (elemType TType, size int, err error) {
	b, e := p.ReadByte(ctx)
	if e != nil {
		err = NewTProtocolException(e)
		return
	}
	elemType = TType(b)
	size32, e := p.ReadI32(ctx)
	if e != nil {
		err = NewTProtocolException(e)
		return
	}
	if size32 < 0 {
		err = invalidDataLength
		return
	}
	size = int(size32)
	return elemType, size, nil
}

func (p *TBinaryProtocol) ReadSetEnd(ctx context.Context) error {
	return nil
}

func (p *TBinaryProtocol) ReadBool(ctx context.Context) (bool, error) {
	b, e := p.ReadByte(ctx)
	v := true
	if b != 1 {
		v = false
	}
	return v, e
}

func (p *TBinaryProtocol) ReadByte(ctx context.Context) (int8, error) {
	v, err := p.trans.ReadByte()
	return int8(v), err
}

func (p *TBinaryProtocol) ReadI16(ctx context.Context) (value int16, err error) {
	buf := p.buffer[0:2]
	err = p.readAll(ctx, buf)
	value = int16(binary.BigEndian.Uint16(buf))
	return value, err
}

func (p *TBinaryProtocol) ReadI32(ctx context.Context) (value int32, err error) {
	buf := p.buffer[0:4]
	err = p.readAll(ctx, buf)
	value = int32(binary.BigEndian.Uint32(buf))
	return value, err
}

func (p *TBinaryProtocol) ReadI64(ctx context.Context) (value int64, err error) {
	buf := p.buffer[0:8]
	err = p.readAll(ctx, buf)
	value = int64(binary.BigEndian.Uint64(buf))
	return value, err
}

func (p *TBinaryProtocol) ReadDouble(ctx context.Context) (value float64, err error) {
	buf := p.buffer[0:8]
	err = p.readAll(ctx, buf)
	value = math.Float64frombits(binary.BigEndian.Uint64(buf))
	return value, err
}

func (p *TBinaryProtocol) ReadString(ctx context.Context) (value string, err error) {
	size, e := p.ReadI32(ctx)
	if e != nil {
		return "", e
	}
	err = checkSizeForProtocol(size, p.cfg)
	if err != nil {
		return
	}
	if size < 0 {
		err = invalidDataLength
		return
	}
	if size == 0 {
		return "", nil
	}
	if size < int32(len(p.buffer)) {
		// Avoid allocation on small reads
		buf := p.buffer[:size]
		read, e := io.ReadFull(p.trans, buf)
		return string(buf[:read]), NewTProtocolException(e)
	}

	return p.readStringBody(size)
}

func (p *TBinaryProtocol) ReadBinary(ctx context.Context) ([]byte, error) {
	size, e := p.ReadI32(ctx)
	if e != nil {
		return nil, e
	}
	if err := checkSizeForProtocol(size, p.cfg); err != nil {
		return nil, err
	}

	buf, err := safeReadBytes(size, p.trans)
	return buf, NewTProtocolException(err)
}

func (p *TBinaryProtocol) Flush(ctx context.Context) (err error) {
	return NewTProtocolException(p.trans.Flush(ctx))
}

func (p *TBinaryProtocol) Skip(ctx context.Context, fieldType TType) (err error) {
	return SkipDefaultDepth(ctx, p, fieldType)
}

func (p *TBinaryProtocol) Transport() TTransport {
	return p.origTransport
}

func (p *TBinaryProtocol) readAll(ctx context.Context, buf []byte) (err error) {
	var read int
	_, deadlineSet := ctx.Deadline()
	for {
		read, err = io.ReadFull(p.trans, buf)
		if deadlineSet && read == 0 && isTimeoutError(err) && ctx.Err() == nil {
			// This is I/O timeout without anything read,
			// and we still have time left, keep retrying.
			continue
		}
		// For anything else, don't retry
		break
	}
	return NewTProtocolException(err)
}

func (p *TBinaryProtocol) readStringBody(size int32) (value string, err error) {
	buf, err := safeReadBytes(size, p.trans)
	return string(buf), NewTProtocolException(err)
}

func (p *TBinaryProtocol) SetTConfiguration(conf *TConfiguration) {
	PropagateTConfiguration(p.trans, conf)
	PropagateTConfiguration(p.origTransport, conf)
	p.cfg = conf
}

var (
	_ TConfigurationSetter = (*TBinaryProtocolFactory)(nil)
	_ TConfigurationSetter = (*TBinaryProtocol)(nil)
)

// This function is shared between TBinaryProtocol and TCompactProtocol.
//
// It tries to read size bytes from trans, in a way that prevents large
// allocations when size is insanely large (mostly caused by malformed message).
func safeReadBytes(size int32, trans io.Reader) ([]byte, error) {
	if size < 0 {
		return nil, nil
	}

	buf := new(bytes.Buffer)
	_, err := io.CopyN(buf, trans, int64(size))
	return buf.Bytes(), err
}
