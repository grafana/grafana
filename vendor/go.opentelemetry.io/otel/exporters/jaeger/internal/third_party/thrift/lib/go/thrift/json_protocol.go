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
	"context"
	"encoding/base64"
	"fmt"
)

const (
	THRIFT_JSON_PROTOCOL_VERSION = 1
)

// for references to _ParseContext see tsimplejson_protocol.go

// JSON protocol implementation for thrift.
// Utilizes Simple JSON protocol
//
type TJSONProtocol struct {
	*TSimpleJSONProtocol
}

// Constructor
func NewTJSONProtocol(t TTransport) *TJSONProtocol {
	v := &TJSONProtocol{TSimpleJSONProtocol: NewTSimpleJSONProtocol(t)}
	v.parseContextStack.push(_CONTEXT_IN_TOPLEVEL)
	v.dumpContext.push(_CONTEXT_IN_TOPLEVEL)
	return v
}

// Factory
type TJSONProtocolFactory struct{}

func (p *TJSONProtocolFactory) GetProtocol(trans TTransport) TProtocol {
	return NewTJSONProtocol(trans)
}

func NewTJSONProtocolFactory() *TJSONProtocolFactory {
	return &TJSONProtocolFactory{}
}

func (p *TJSONProtocol) WriteMessageBegin(ctx context.Context, name string, typeId TMessageType, seqId int32) error {
	p.resetContextStack() // THRIFT-3735
	if e := p.OutputListBegin(); e != nil {
		return e
	}
	if e := p.WriteI32(ctx, THRIFT_JSON_PROTOCOL_VERSION); e != nil {
		return e
	}
	if e := p.WriteString(ctx, name); e != nil {
		return e
	}
	if e := p.WriteByte(ctx, int8(typeId)); e != nil {
		return e
	}
	if e := p.WriteI32(ctx, seqId); e != nil {
		return e
	}
	return nil
}

func (p *TJSONProtocol) WriteMessageEnd(ctx context.Context) error {
	return p.OutputListEnd()
}

func (p *TJSONProtocol) WriteStructBegin(ctx context.Context, name string) error {
	if e := p.OutputObjectBegin(); e != nil {
		return e
	}
	return nil
}

func (p *TJSONProtocol) WriteStructEnd(ctx context.Context) error {
	return p.OutputObjectEnd()
}

func (p *TJSONProtocol) WriteFieldBegin(ctx context.Context, name string, typeId TType, id int16) error {
	if e := p.WriteI16(ctx, id); e != nil {
		return e
	}
	if e := p.OutputObjectBegin(); e != nil {
		return e
	}
	s, e1 := p.TypeIdToString(typeId)
	if e1 != nil {
		return e1
	}
	if e := p.WriteString(ctx, s); e != nil {
		return e
	}
	return nil
}

func (p *TJSONProtocol) WriteFieldEnd(ctx context.Context) error {
	return p.OutputObjectEnd()
}

func (p *TJSONProtocol) WriteFieldStop(ctx context.Context) error { return nil }

func (p *TJSONProtocol) WriteMapBegin(ctx context.Context, keyType TType, valueType TType, size int) error {
	if e := p.OutputListBegin(); e != nil {
		return e
	}
	s, e1 := p.TypeIdToString(keyType)
	if e1 != nil {
		return e1
	}
	if e := p.WriteString(ctx, s); e != nil {
		return e
	}
	s, e1 = p.TypeIdToString(valueType)
	if e1 != nil {
		return e1
	}
	if e := p.WriteString(ctx, s); e != nil {
		return e
	}
	if e := p.WriteI64(ctx, int64(size)); e != nil {
		return e
	}
	return p.OutputObjectBegin()
}

func (p *TJSONProtocol) WriteMapEnd(ctx context.Context) error {
	if e := p.OutputObjectEnd(); e != nil {
		return e
	}
	return p.OutputListEnd()
}

func (p *TJSONProtocol) WriteListBegin(ctx context.Context, elemType TType, size int) error {
	return p.OutputElemListBegin(elemType, size)
}

func (p *TJSONProtocol) WriteListEnd(ctx context.Context) error {
	return p.OutputListEnd()
}

func (p *TJSONProtocol) WriteSetBegin(ctx context.Context, elemType TType, size int) error {
	return p.OutputElemListBegin(elemType, size)
}

func (p *TJSONProtocol) WriteSetEnd(ctx context.Context) error {
	return p.OutputListEnd()
}

func (p *TJSONProtocol) WriteBool(ctx context.Context, b bool) error {
	if b {
		return p.WriteI32(ctx, 1)
	}
	return p.WriteI32(ctx, 0)
}

func (p *TJSONProtocol) WriteByte(ctx context.Context, b int8) error {
	return p.WriteI32(ctx, int32(b))
}

func (p *TJSONProtocol) WriteI16(ctx context.Context, v int16) error {
	return p.WriteI32(ctx, int32(v))
}

func (p *TJSONProtocol) WriteI32(ctx context.Context, v int32) error {
	return p.OutputI64(int64(v))
}

func (p *TJSONProtocol) WriteI64(ctx context.Context, v int64) error {
	return p.OutputI64(int64(v))
}

func (p *TJSONProtocol) WriteDouble(ctx context.Context, v float64) error {
	return p.OutputF64(v)
}

func (p *TJSONProtocol) WriteString(ctx context.Context, v string) error {
	return p.OutputString(v)
}

func (p *TJSONProtocol) WriteBinary(ctx context.Context, v []byte) error {
	// JSON library only takes in a string,
	// not an arbitrary byte array, to ensure bytes are transmitted
	// efficiently we must convert this into a valid JSON string
	// therefore we use base64 encoding to avoid excessive escaping/quoting
	if e := p.OutputPreValue(); e != nil {
		return e
	}
	if _, e := p.write(JSON_QUOTE_BYTES); e != nil {
		return NewTProtocolException(e)
	}
	writer := base64.NewEncoder(base64.StdEncoding, p.writer)
	if _, e := writer.Write(v); e != nil {
		p.writer.Reset(p.trans) // THRIFT-3735
		return NewTProtocolException(e)
	}
	if e := writer.Close(); e != nil {
		return NewTProtocolException(e)
	}
	if _, e := p.write(JSON_QUOTE_BYTES); e != nil {
		return NewTProtocolException(e)
	}
	return p.OutputPostValue()
}

// Reading methods.
func (p *TJSONProtocol) ReadMessageBegin(ctx context.Context) (name string, typeId TMessageType, seqId int32, err error) {
	p.resetContextStack() // THRIFT-3735
	if isNull, err := p.ParseListBegin(); isNull || err != nil {
		return name, typeId, seqId, err
	}
	version, err := p.ReadI32(ctx)
	if err != nil {
		return name, typeId, seqId, err
	}
	if version != THRIFT_JSON_PROTOCOL_VERSION {
		e := fmt.Errorf("Unknown Protocol version %d, expected version %d", version, THRIFT_JSON_PROTOCOL_VERSION)
		return name, typeId, seqId, NewTProtocolExceptionWithType(INVALID_DATA, e)

	}
	if name, err = p.ReadString(ctx); err != nil {
		return name, typeId, seqId, err
	}
	bTypeId, err := p.ReadByte(ctx)
	typeId = TMessageType(bTypeId)
	if err != nil {
		return name, typeId, seqId, err
	}
	if seqId, err = p.ReadI32(ctx); err != nil {
		return name, typeId, seqId, err
	}
	return name, typeId, seqId, nil
}

func (p *TJSONProtocol) ReadMessageEnd(ctx context.Context) error {
	err := p.ParseListEnd()
	return err
}

func (p *TJSONProtocol) ReadStructBegin(ctx context.Context) (name string, err error) {
	_, err = p.ParseObjectStart()
	return "", err
}

func (p *TJSONProtocol) ReadStructEnd(ctx context.Context) error {
	return p.ParseObjectEnd()
}

func (p *TJSONProtocol) ReadFieldBegin(ctx context.Context) (string, TType, int16, error) {
	b, _ := p.reader.Peek(1)
	if len(b) < 1 || b[0] == JSON_RBRACE[0] || b[0] == JSON_RBRACKET[0] {
		return "", STOP, -1, nil
	}
	fieldId, err := p.ReadI16(ctx)
	if err != nil {
		return "", STOP, fieldId, err
	}
	if _, err = p.ParseObjectStart(); err != nil {
		return "", STOP, fieldId, err
	}
	sType, err := p.ReadString(ctx)
	if err != nil {
		return "", STOP, fieldId, err
	}
	fType, err := p.StringToTypeId(sType)
	return "", fType, fieldId, err
}

func (p *TJSONProtocol) ReadFieldEnd(ctx context.Context) error {
	return p.ParseObjectEnd()
}

func (p *TJSONProtocol) ReadMapBegin(ctx context.Context) (keyType TType, valueType TType, size int, e error) {
	if isNull, e := p.ParseListBegin(); isNull || e != nil {
		return VOID, VOID, 0, e
	}

	// read keyType
	sKeyType, e := p.ReadString(ctx)
	if e != nil {
		return keyType, valueType, size, e
	}
	keyType, e = p.StringToTypeId(sKeyType)
	if e != nil {
		return keyType, valueType, size, e
	}

	// read valueType
	sValueType, e := p.ReadString(ctx)
	if e != nil {
		return keyType, valueType, size, e
	}
	valueType, e = p.StringToTypeId(sValueType)
	if e != nil {
		return keyType, valueType, size, e
	}

	// read size
	iSize, e := p.ReadI64(ctx)
	if e != nil {
		return keyType, valueType, size, e
	}
	size = int(iSize)

	_, e = p.ParseObjectStart()
	return keyType, valueType, size, e
}

func (p *TJSONProtocol) ReadMapEnd(ctx context.Context) error {
	e := p.ParseObjectEnd()
	if e != nil {
		return e
	}
	return p.ParseListEnd()
}

func (p *TJSONProtocol) ReadListBegin(ctx context.Context) (elemType TType, size int, e error) {
	return p.ParseElemListBegin()
}

func (p *TJSONProtocol) ReadListEnd(ctx context.Context) error {
	return p.ParseListEnd()
}

func (p *TJSONProtocol) ReadSetBegin(ctx context.Context) (elemType TType, size int, e error) {
	return p.ParseElemListBegin()
}

func (p *TJSONProtocol) ReadSetEnd(ctx context.Context) error {
	return p.ParseListEnd()
}

func (p *TJSONProtocol) ReadBool(ctx context.Context) (bool, error) {
	value, err := p.ReadI32(ctx)
	return (value != 0), err
}

func (p *TJSONProtocol) ReadByte(ctx context.Context) (int8, error) {
	v, err := p.ReadI64(ctx)
	return int8(v), err
}

func (p *TJSONProtocol) ReadI16(ctx context.Context) (int16, error) {
	v, err := p.ReadI64(ctx)
	return int16(v), err
}

func (p *TJSONProtocol) ReadI32(ctx context.Context) (int32, error) {
	v, err := p.ReadI64(ctx)
	return int32(v), err
}

func (p *TJSONProtocol) ReadI64(ctx context.Context) (int64, error) {
	v, _, err := p.ParseI64()
	return v, err
}

func (p *TJSONProtocol) ReadDouble(ctx context.Context) (float64, error) {
	v, _, err := p.ParseF64()
	return v, err
}

func (p *TJSONProtocol) ReadString(ctx context.Context) (string, error) {
	var v string
	if err := p.ParsePreValue(); err != nil {
		return v, err
	}
	f, _ := p.reader.Peek(1)
	if len(f) > 0 && f[0] == JSON_QUOTE {
		p.reader.ReadByte()
		value, err := p.ParseStringBody()
		v = value
		if err != nil {
			return v, err
		}
	} else if len(f) > 0 && f[0] == JSON_NULL[0] {
		b := make([]byte, len(JSON_NULL))
		_, err := p.reader.Read(b)
		if err != nil {
			return v, NewTProtocolException(err)
		}
		if string(b) != string(JSON_NULL) {
			e := fmt.Errorf("Expected a JSON string, found unquoted data started with %s", string(b))
			return v, NewTProtocolExceptionWithType(INVALID_DATA, e)
		}
	} else {
		e := fmt.Errorf("Expected a JSON string, found unquoted data started with %s", string(f))
		return v, NewTProtocolExceptionWithType(INVALID_DATA, e)
	}
	return v, p.ParsePostValue()
}

func (p *TJSONProtocol) ReadBinary(ctx context.Context) ([]byte, error) {
	var v []byte
	if err := p.ParsePreValue(); err != nil {
		return nil, err
	}
	f, _ := p.reader.Peek(1)
	if len(f) > 0 && f[0] == JSON_QUOTE {
		p.reader.ReadByte()
		value, err := p.ParseBase64EncodedBody()
		v = value
		if err != nil {
			return v, err
		}
	} else if len(f) > 0 && f[0] == JSON_NULL[0] {
		b := make([]byte, len(JSON_NULL))
		_, err := p.reader.Read(b)
		if err != nil {
			return v, NewTProtocolException(err)
		}
		if string(b) != string(JSON_NULL) {
			e := fmt.Errorf("Expected a JSON string, found unquoted data started with %s", string(b))
			return v, NewTProtocolExceptionWithType(INVALID_DATA, e)
		}
	} else {
		e := fmt.Errorf("Expected a JSON string, found unquoted data started with %s", string(f))
		return v, NewTProtocolExceptionWithType(INVALID_DATA, e)
	}

	return v, p.ParsePostValue()
}

func (p *TJSONProtocol) Flush(ctx context.Context) (err error) {
	err = p.writer.Flush()
	if err == nil {
		err = p.trans.Flush(ctx)
	}
	return NewTProtocolException(err)
}

func (p *TJSONProtocol) Skip(ctx context.Context, fieldType TType) (err error) {
	return SkipDefaultDepth(ctx, p, fieldType)
}

func (p *TJSONProtocol) Transport() TTransport {
	return p.trans
}

func (p *TJSONProtocol) OutputElemListBegin(elemType TType, size int) error {
	if e := p.OutputListBegin(); e != nil {
		return e
	}
	s, e1 := p.TypeIdToString(elemType)
	if e1 != nil {
		return e1
	}
	if e := p.OutputString(s); e != nil {
		return e
	}
	if e := p.OutputI64(int64(size)); e != nil {
		return e
	}
	return nil
}

func (p *TJSONProtocol) ParseElemListBegin() (elemType TType, size int, e error) {
	if isNull, e := p.ParseListBegin(); isNull || e != nil {
		return VOID, 0, e
	}
	// We don't really use the ctx in ReadString implementation,
	// so this is safe for now.
	// We might want to add context to ParseElemListBegin if we start to use
	// ctx in ReadString implementation in the future.
	sElemType, err := p.ReadString(context.Background())
	if err != nil {
		return VOID, size, err
	}
	elemType, err = p.StringToTypeId(sElemType)
	if err != nil {
		return elemType, size, err
	}
	nSize, _, err2 := p.ParseI64()
	size = int(nSize)
	return elemType, size, err2
}

func (p *TJSONProtocol) readElemListBegin() (elemType TType, size int, e error) {
	if isNull, e := p.ParseListBegin(); isNull || e != nil {
		return VOID, 0, e
	}
	// We don't really use the ctx in ReadString implementation,
	// so this is safe for now.
	// We might want to add context to ParseElemListBegin if we start to use
	// ctx in ReadString implementation in the future.
	sElemType, err := p.ReadString(context.Background())
	if err != nil {
		return VOID, size, err
	}
	elemType, err = p.StringToTypeId(sElemType)
	if err != nil {
		return elemType, size, err
	}
	nSize, _, err2 := p.ParseI64()
	size = int(nSize)
	return elemType, size, err2
}

func (p *TJSONProtocol) writeElemListBegin(elemType TType, size int) error {
	if e := p.OutputListBegin(); e != nil {
		return e
	}
	s, e1 := p.TypeIdToString(elemType)
	if e1 != nil {
		return e1
	}
	if e := p.OutputString(s); e != nil {
		return e
	}
	if e := p.OutputI64(int64(size)); e != nil {
		return e
	}
	return nil
}

func (p *TJSONProtocol) TypeIdToString(fieldType TType) (string, error) {
	switch byte(fieldType) {
	case BOOL:
		return "tf", nil
	case BYTE:
		return "i8", nil
	case I16:
		return "i16", nil
	case I32:
		return "i32", nil
	case I64:
		return "i64", nil
	case DOUBLE:
		return "dbl", nil
	case STRING:
		return "str", nil
	case STRUCT:
		return "rec", nil
	case MAP:
		return "map", nil
	case SET:
		return "set", nil
	case LIST:
		return "lst", nil
	}

	e := fmt.Errorf("Unknown fieldType: %d", int(fieldType))
	return "", NewTProtocolExceptionWithType(INVALID_DATA, e)
}

func (p *TJSONProtocol) StringToTypeId(fieldType string) (TType, error) {
	switch fieldType {
	case "tf":
		return TType(BOOL), nil
	case "i8":
		return TType(BYTE), nil
	case "i16":
		return TType(I16), nil
	case "i32":
		return TType(I32), nil
	case "i64":
		return TType(I64), nil
	case "dbl":
		return TType(DOUBLE), nil
	case "str":
		return TType(STRING), nil
	case "rec":
		return TType(STRUCT), nil
	case "map":
		return TType(MAP), nil
	case "set":
		return TType(SET), nil
	case "lst":
		return TType(LIST), nil
	}

	e := fmt.Errorf("Unknown type identifier: %s", fieldType)
	return TType(STOP), NewTProtocolExceptionWithType(INVALID_DATA, e)
}

var _ TConfigurationSetter = (*TJSONProtocol)(nil)
