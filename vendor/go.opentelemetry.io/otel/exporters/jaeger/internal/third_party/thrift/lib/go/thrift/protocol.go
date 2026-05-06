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
	"errors"
	"fmt"
)

const (
	VERSION_MASK = 0xffff0000
	VERSION_1    = 0x80010000
)

type TProtocol interface {
	WriteMessageBegin(ctx context.Context, name string, typeId TMessageType, seqid int32) error
	WriteMessageEnd(ctx context.Context) error
	WriteStructBegin(ctx context.Context, name string) error
	WriteStructEnd(ctx context.Context) error
	WriteFieldBegin(ctx context.Context, name string, typeId TType, id int16) error
	WriteFieldEnd(ctx context.Context) error
	WriteFieldStop(ctx context.Context) error
	WriteMapBegin(ctx context.Context, keyType TType, valueType TType, size int) error
	WriteMapEnd(ctx context.Context) error
	WriteListBegin(ctx context.Context, elemType TType, size int) error
	WriteListEnd(ctx context.Context) error
	WriteSetBegin(ctx context.Context, elemType TType, size int) error
	WriteSetEnd(ctx context.Context) error
	WriteBool(ctx context.Context, value bool) error
	WriteByte(ctx context.Context, value int8) error
	WriteI16(ctx context.Context, value int16) error
	WriteI32(ctx context.Context, value int32) error
	WriteI64(ctx context.Context, value int64) error
	WriteDouble(ctx context.Context, value float64) error
	WriteString(ctx context.Context, value string) error
	WriteBinary(ctx context.Context, value []byte) error

	ReadMessageBegin(ctx context.Context) (name string, typeId TMessageType, seqid int32, err error)
	ReadMessageEnd(ctx context.Context) error
	ReadStructBegin(ctx context.Context) (name string, err error)
	ReadStructEnd(ctx context.Context) error
	ReadFieldBegin(ctx context.Context) (name string, typeId TType, id int16, err error)
	ReadFieldEnd(ctx context.Context) error
	ReadMapBegin(ctx context.Context) (keyType TType, valueType TType, size int, err error)
	ReadMapEnd(ctx context.Context) error
	ReadListBegin(ctx context.Context) (elemType TType, size int, err error)
	ReadListEnd(ctx context.Context) error
	ReadSetBegin(ctx context.Context) (elemType TType, size int, err error)
	ReadSetEnd(ctx context.Context) error
	ReadBool(ctx context.Context) (value bool, err error)
	ReadByte(ctx context.Context) (value int8, err error)
	ReadI16(ctx context.Context) (value int16, err error)
	ReadI32(ctx context.Context) (value int32, err error)
	ReadI64(ctx context.Context) (value int64, err error)
	ReadDouble(ctx context.Context) (value float64, err error)
	ReadString(ctx context.Context) (value string, err error)
	ReadBinary(ctx context.Context) (value []byte, err error)

	Skip(ctx context.Context, fieldType TType) (err error)
	Flush(ctx context.Context) (err error)

	Transport() TTransport
}

// The maximum recursive depth the skip() function will traverse
const DEFAULT_RECURSION_DEPTH = 64

// Skips over the next data element from the provided input TProtocol object.
func SkipDefaultDepth(ctx context.Context, prot TProtocol, typeId TType) (err error) {
	return Skip(ctx, prot, typeId, DEFAULT_RECURSION_DEPTH)
}

// Skips over the next data element from the provided input TProtocol object.
func Skip(ctx context.Context, self TProtocol, fieldType TType, maxDepth int) (err error) {

	if maxDepth <= 0 {
		return NewTProtocolExceptionWithType(DEPTH_LIMIT, errors.New("Depth limit exceeded"))
	}

	switch fieldType {
	case BOOL:
		_, err = self.ReadBool(ctx)
		return
	case BYTE:
		_, err = self.ReadByte(ctx)
		return
	case I16:
		_, err = self.ReadI16(ctx)
		return
	case I32:
		_, err = self.ReadI32(ctx)
		return
	case I64:
		_, err = self.ReadI64(ctx)
		return
	case DOUBLE:
		_, err = self.ReadDouble(ctx)
		return
	case STRING:
		_, err = self.ReadString(ctx)
		return
	case STRUCT:
		if _, err = self.ReadStructBegin(ctx); err != nil {
			return err
		}
		for {
			_, typeId, _, _ := self.ReadFieldBegin(ctx)
			if typeId == STOP {
				break
			}
			err := Skip(ctx, self, typeId, maxDepth-1)
			if err != nil {
				return err
			}
			self.ReadFieldEnd(ctx)
		}
		return self.ReadStructEnd(ctx)
	case MAP:
		keyType, valueType, size, err := self.ReadMapBegin(ctx)
		if err != nil {
			return err
		}
		for i := 0; i < size; i++ {
			err := Skip(ctx, self, keyType, maxDepth-1)
			if err != nil {
				return err
			}
			self.Skip(ctx, valueType)
		}
		return self.ReadMapEnd(ctx)
	case SET:
		elemType, size, err := self.ReadSetBegin(ctx)
		if err != nil {
			return err
		}
		for i := 0; i < size; i++ {
			err := Skip(ctx, self, elemType, maxDepth-1)
			if err != nil {
				return err
			}
		}
		return self.ReadSetEnd(ctx)
	case LIST:
		elemType, size, err := self.ReadListBegin(ctx)
		if err != nil {
			return err
		}
		for i := 0; i < size; i++ {
			err := Skip(ctx, self, elemType, maxDepth-1)
			if err != nil {
				return err
			}
		}
		return self.ReadListEnd(ctx)
	default:
		return NewTProtocolExceptionWithType(INVALID_DATA, errors.New(fmt.Sprintf("Unknown data type %d", fieldType)))
	}
	return nil
}
