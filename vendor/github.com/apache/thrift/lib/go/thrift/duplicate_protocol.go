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
)

type TDuplicateToProtocol struct {
	// Required. The actual TProtocol to do the read/write.
	Delegate TProtocol

	// Required. An TProtocol to duplicate everything read/written from Delegate.
	//
	// A typical use case of this is to use TSimpleJSONProtocol wrapping
	// TMemoryBuffer in a middleware to json logging requests/responses,
	// or wrapping a TTransport that counts bytes written to get the payload
	// sizes.
	//
	// DuplicateTo will be used as write only. For read calls on
	// TDuplicateToProtocol, the result read from Delegate will be written
	// to DuplicateTo.
	DuplicateTo TProtocol
}

func (tdtp *TDuplicateToProtocol) WriteMessageBegin(ctx context.Context, name string, typeId TMessageType, seqid int32) error {
	err := tdtp.Delegate.WriteMessageBegin(ctx, name, typeId, seqid)
	tdtp.DuplicateTo.WriteMessageBegin(ctx, name, typeId, seqid)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteMessageEnd(ctx context.Context) error {
	err := tdtp.Delegate.WriteMessageEnd(ctx)
	tdtp.DuplicateTo.WriteMessageEnd(ctx)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteStructBegin(ctx context.Context, name string) error {
	err := tdtp.Delegate.WriteStructBegin(ctx, name)
	tdtp.DuplicateTo.WriteStructBegin(ctx, name)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteStructEnd(ctx context.Context) error {
	err := tdtp.Delegate.WriteStructEnd(ctx)
	tdtp.DuplicateTo.WriteStructEnd(ctx)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteFieldBegin(ctx context.Context, name string, typeId TType, id int16) error {
	err := tdtp.Delegate.WriteFieldBegin(ctx, name, typeId, id)
	tdtp.DuplicateTo.WriteFieldBegin(ctx, name, typeId, id)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteFieldEnd(ctx context.Context) error {
	err := tdtp.Delegate.WriteFieldEnd(ctx)
	tdtp.DuplicateTo.WriteFieldEnd(ctx)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteFieldStop(ctx context.Context) error {
	err := tdtp.Delegate.WriteFieldStop(ctx)
	tdtp.DuplicateTo.WriteFieldStop(ctx)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteMapBegin(ctx context.Context, keyType TType, valueType TType, size int) error {
	err := tdtp.Delegate.WriteMapBegin(ctx, keyType, valueType, size)
	tdtp.DuplicateTo.WriteMapBegin(ctx, keyType, valueType, size)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteMapEnd(ctx context.Context) error {
	err := tdtp.Delegate.WriteMapEnd(ctx)
	tdtp.DuplicateTo.WriteMapEnd(ctx)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteListBegin(ctx context.Context, elemType TType, size int) error {
	err := tdtp.Delegate.WriteListBegin(ctx, elemType, size)
	tdtp.DuplicateTo.WriteListBegin(ctx, elemType, size)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteListEnd(ctx context.Context) error {
	err := tdtp.Delegate.WriteListEnd(ctx)
	tdtp.DuplicateTo.WriteListEnd(ctx)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteSetBegin(ctx context.Context, elemType TType, size int) error {
	err := tdtp.Delegate.WriteSetBegin(ctx, elemType, size)
	tdtp.DuplicateTo.WriteSetBegin(ctx, elemType, size)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteSetEnd(ctx context.Context) error {
	err := tdtp.Delegate.WriteSetEnd(ctx)
	tdtp.DuplicateTo.WriteSetEnd(ctx)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteBool(ctx context.Context, value bool) error {
	err := tdtp.Delegate.WriteBool(ctx, value)
	tdtp.DuplicateTo.WriteBool(ctx, value)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteByte(ctx context.Context, value int8) error {
	err := tdtp.Delegate.WriteByte(ctx, value)
	tdtp.DuplicateTo.WriteByte(ctx, value)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteI16(ctx context.Context, value int16) error {
	err := tdtp.Delegate.WriteI16(ctx, value)
	tdtp.DuplicateTo.WriteI16(ctx, value)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteI32(ctx context.Context, value int32) error {
	err := tdtp.Delegate.WriteI32(ctx, value)
	tdtp.DuplicateTo.WriteI32(ctx, value)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteI64(ctx context.Context, value int64) error {
	err := tdtp.Delegate.WriteI64(ctx, value)
	tdtp.DuplicateTo.WriteI64(ctx, value)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteDouble(ctx context.Context, value float64) error {
	err := tdtp.Delegate.WriteDouble(ctx, value)
	tdtp.DuplicateTo.WriteDouble(ctx, value)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteString(ctx context.Context, value string) error {
	err := tdtp.Delegate.WriteString(ctx, value)
	tdtp.DuplicateTo.WriteString(ctx, value)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteBinary(ctx context.Context, value []byte) error {
	err := tdtp.Delegate.WriteBinary(ctx, value)
	tdtp.DuplicateTo.WriteBinary(ctx, value)
	return err
}

func (tdtp *TDuplicateToProtocol) WriteUUID(ctx context.Context, value Tuuid) error {
	err := tdtp.Delegate.WriteUUID(ctx, value)
	tdtp.DuplicateTo.WriteUUID(ctx, value)
	return err
}

func (tdtp *TDuplicateToProtocol) ReadMessageBegin(ctx context.Context) (name string, typeId TMessageType, seqid int32, err error) {
	name, typeId, seqid, err = tdtp.Delegate.ReadMessageBegin(ctx)
	tdtp.DuplicateTo.WriteMessageBegin(ctx, name, typeId, seqid)
	return
}

func (tdtp *TDuplicateToProtocol) ReadMessageEnd(ctx context.Context) (err error) {
	err = tdtp.Delegate.ReadMessageEnd(ctx)
	tdtp.DuplicateTo.WriteMessageEnd(ctx)
	return
}

func (tdtp *TDuplicateToProtocol) ReadStructBegin(ctx context.Context) (name string, err error) {
	name, err = tdtp.Delegate.ReadStructBegin(ctx)
	tdtp.DuplicateTo.WriteStructBegin(ctx, name)
	return
}

func (tdtp *TDuplicateToProtocol) ReadStructEnd(ctx context.Context) (err error) {
	err = tdtp.Delegate.ReadStructEnd(ctx)
	tdtp.DuplicateTo.WriteStructEnd(ctx)
	return
}

func (tdtp *TDuplicateToProtocol) ReadFieldBegin(ctx context.Context) (name string, typeId TType, id int16, err error) {
	name, typeId, id, err = tdtp.Delegate.ReadFieldBegin(ctx)
	if typeId == STOP {
		tdtp.DuplicateTo.WriteFieldStop(ctx)
		return
	}
	tdtp.DuplicateTo.WriteFieldBegin(ctx, name, typeId, id)
	return
}

func (tdtp *TDuplicateToProtocol) ReadFieldEnd(ctx context.Context) (err error) {
	err = tdtp.Delegate.ReadFieldEnd(ctx)
	tdtp.DuplicateTo.WriteFieldEnd(ctx)
	return
}

func (tdtp *TDuplicateToProtocol) ReadMapBegin(ctx context.Context) (keyType TType, valueType TType, size int, err error) {
	keyType, valueType, size, err = tdtp.Delegate.ReadMapBegin(ctx)
	tdtp.DuplicateTo.WriteMapBegin(ctx, keyType, valueType, size)
	return
}

func (tdtp *TDuplicateToProtocol) ReadMapEnd(ctx context.Context) (err error) {
	err = tdtp.Delegate.ReadMapEnd(ctx)
	tdtp.DuplicateTo.WriteMapEnd(ctx)
	return
}

func (tdtp *TDuplicateToProtocol) ReadListBegin(ctx context.Context) (elemType TType, size int, err error) {
	elemType, size, err = tdtp.Delegate.ReadListBegin(ctx)
	tdtp.DuplicateTo.WriteListBegin(ctx, elemType, size)
	return
}

func (tdtp *TDuplicateToProtocol) ReadListEnd(ctx context.Context) (err error) {
	err = tdtp.Delegate.ReadListEnd(ctx)
	tdtp.DuplicateTo.WriteListEnd(ctx)
	return
}

func (tdtp *TDuplicateToProtocol) ReadSetBegin(ctx context.Context) (elemType TType, size int, err error) {
	elemType, size, err = tdtp.Delegate.ReadSetBegin(ctx)
	tdtp.DuplicateTo.WriteSetBegin(ctx, elemType, size)
	return
}

func (tdtp *TDuplicateToProtocol) ReadSetEnd(ctx context.Context) (err error) {
	err = tdtp.Delegate.ReadSetEnd(ctx)
	tdtp.DuplicateTo.WriteSetEnd(ctx)
	return
}

func (tdtp *TDuplicateToProtocol) ReadBool(ctx context.Context) (value bool, err error) {
	value, err = tdtp.Delegate.ReadBool(ctx)
	tdtp.DuplicateTo.WriteBool(ctx, value)
	return
}

func (tdtp *TDuplicateToProtocol) ReadByte(ctx context.Context) (value int8, err error) {
	value, err = tdtp.Delegate.ReadByte(ctx)
	tdtp.DuplicateTo.WriteByte(ctx, value)
	return
}

func (tdtp *TDuplicateToProtocol) ReadI16(ctx context.Context) (value int16, err error) {
	value, err = tdtp.Delegate.ReadI16(ctx)
	tdtp.DuplicateTo.WriteI16(ctx, value)
	return
}

func (tdtp *TDuplicateToProtocol) ReadI32(ctx context.Context) (value int32, err error) {
	value, err = tdtp.Delegate.ReadI32(ctx)
	tdtp.DuplicateTo.WriteI32(ctx, value)
	return
}

func (tdtp *TDuplicateToProtocol) ReadI64(ctx context.Context) (value int64, err error) {
	value, err = tdtp.Delegate.ReadI64(ctx)
	tdtp.DuplicateTo.WriteI64(ctx, value)
	return
}

func (tdtp *TDuplicateToProtocol) ReadDouble(ctx context.Context) (value float64, err error) {
	value, err = tdtp.Delegate.ReadDouble(ctx)
	tdtp.DuplicateTo.WriteDouble(ctx, value)
	return
}

func (tdtp *TDuplicateToProtocol) ReadString(ctx context.Context) (value string, err error) {
	value, err = tdtp.Delegate.ReadString(ctx)
	tdtp.DuplicateTo.WriteString(ctx, value)
	return
}

func (tdtp *TDuplicateToProtocol) ReadBinary(ctx context.Context) (value []byte, err error) {
	value, err = tdtp.Delegate.ReadBinary(ctx)
	tdtp.DuplicateTo.WriteBinary(ctx, value)
	return
}

func (tdtp *TDuplicateToProtocol) ReadUUID(ctx context.Context) (value Tuuid, err error) {
	value, err = tdtp.Delegate.ReadUUID(ctx)
	tdtp.DuplicateTo.WriteUUID(ctx, value)
	return
}

func (tdtp *TDuplicateToProtocol) Skip(ctx context.Context, fieldType TType) (err error) {
	err = tdtp.Delegate.Skip(ctx, fieldType)
	tdtp.DuplicateTo.Skip(ctx, fieldType)
	return
}

func (tdtp *TDuplicateToProtocol) Flush(ctx context.Context) (err error) {
	err = tdtp.Delegate.Flush(ctx)
	tdtp.DuplicateTo.Flush(ctx)
	return
}

func (tdtp *TDuplicateToProtocol) Transport() TTransport {
	return tdtp.Delegate.Transport()
}

// SetTConfiguration implements TConfigurationSetter for propagation.
func (tdtp *TDuplicateToProtocol) SetTConfiguration(conf *TConfiguration) {
	PropagateTConfiguration(tdtp.Delegate, conf)
	PropagateTConfiguration(tdtp.DuplicateTo, conf)
}

var _ TConfigurationSetter = (*TDuplicateToProtocol)(nil)
