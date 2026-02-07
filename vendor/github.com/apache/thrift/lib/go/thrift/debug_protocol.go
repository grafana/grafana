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
	"log/slog"
)

type TDebugProtocol struct {
	// Required. The actual TProtocol to do the read/write.
	Delegate TProtocol

	// Optional. The logger and prefix to log all the args/return values
	// from Delegate TProtocol calls.
	//
	// If Logger is nil, StdLogger using stdlib log package with os.Stderr
	// will be used. If disable logging is desired, set Logger to NopLogger
	// explicitly instead of leaving it as nil/unset.
	//
	// Deprecated: TDebugProtocol always use slog at debug level now.
	// This field will be removed in a future version.
	Logger Logger

	LogPrefix string

	// Optional. An TProtocol to duplicate everything read/written from Delegate.
	//
	// A typical use case of this is to use TSimpleJSONProtocol wrapping
	// TMemoryBuffer in a middleware to json logging requests/responses.
	//
	// This feature is not available from TDebugProtocolFactory. In order to
	// use it you have to construct TDebugProtocol directly, or set DuplicateTo
	// field after getting a TDebugProtocol from the factory.
	//
	// Deprecated: Please use TDuplicateToProtocol instead.
	DuplicateTo TProtocol
}

type TDebugProtocolFactory struct {
	Underlying TProtocolFactory
	LogPrefix  string
	Logger     Logger
}

// NewTDebugProtocolFactory creates a TDebugProtocolFactory.
//
// Deprecated: Please use NewTDebugProtocolFactoryWithLogger or the struct
// itself instead. This version will use the default logger from standard
// library.
func NewTDebugProtocolFactory(underlying TProtocolFactory, logPrefix string) *TDebugProtocolFactory {
	return &TDebugProtocolFactory{
		Underlying: underlying,
		LogPrefix:  logPrefix,
		Logger:     StdLogger(nil),
	}
}

// NewTDebugProtocolFactoryWithLogger creates a TDebugProtocolFactory.
func NewTDebugProtocolFactoryWithLogger(underlying TProtocolFactory, logPrefix string, logger Logger) *TDebugProtocolFactory {
	return &TDebugProtocolFactory{
		Underlying: underlying,
		LogPrefix:  logPrefix,
		Logger:     logger,
	}
}

func (t *TDebugProtocolFactory) GetProtocol(trans TTransport) TProtocol {
	return &TDebugProtocol{
		Delegate:  t.Underlying.GetProtocol(trans),
		LogPrefix: t.LogPrefix,
		Logger:    fallbackLogger(t.Logger),
	}
}

func (tdp *TDebugProtocol) WriteMessageBegin(ctx context.Context, name string, typeId TMessageType, seqid int32) error {
	err := tdp.Delegate.WriteMessageBegin(ctx, name, typeId, seqid)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteMessageBegin",
		"name", name,
		"typeId", typeId,
		"seqid", seqid,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteMessageBegin(ctx, name, typeId, seqid)
	}
	return err
}
func (tdp *TDebugProtocol) WriteMessageEnd(ctx context.Context) error {
	err := tdp.Delegate.WriteMessageEnd(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteMessageEnd",
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteMessageEnd(ctx)
	}
	return err
}
func (tdp *TDebugProtocol) WriteStructBegin(ctx context.Context, name string) error {
	err := tdp.Delegate.WriteStructBegin(ctx, name)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteStructBegin",
		"name", name,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteStructBegin(ctx, name)
	}
	return err
}
func (tdp *TDebugProtocol) WriteStructEnd(ctx context.Context) error {
	err := tdp.Delegate.WriteStructEnd(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteStructEnd",
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteStructEnd(ctx)
	}
	return err
}
func (tdp *TDebugProtocol) WriteFieldBegin(ctx context.Context, name string, typeId TType, id int16) error {
	err := tdp.Delegate.WriteFieldBegin(ctx, name, typeId, id)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteFieldBegin",
		"name", name,
		"typeId", typeId,
		"id", id,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteFieldBegin(ctx, name, typeId, id)
	}
	return err
}
func (tdp *TDebugProtocol) WriteFieldEnd(ctx context.Context) error {
	err := tdp.Delegate.WriteFieldEnd(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteFieldEnd",
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteFieldEnd(ctx)
	}
	return err
}
func (tdp *TDebugProtocol) WriteFieldStop(ctx context.Context) error {
	err := tdp.Delegate.WriteFieldStop(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteFieldStop",
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteFieldStop(ctx)
	}
	return err
}
func (tdp *TDebugProtocol) WriteMapBegin(ctx context.Context, keyType TType, valueType TType, size int) error {
	err := tdp.Delegate.WriteMapBegin(ctx, keyType, valueType, size)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteMapBegin",
		"keyType", keyType,
		"valueType", valueType,
		"size", size,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteMapBegin(ctx, keyType, valueType, size)
	}
	return err
}
func (tdp *TDebugProtocol) WriteMapEnd(ctx context.Context) error {
	err := tdp.Delegate.WriteMapEnd(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteMapEnd",
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteMapEnd(ctx)
	}
	return err
}
func (tdp *TDebugProtocol) WriteListBegin(ctx context.Context, elemType TType, size int) error {
	err := tdp.Delegate.WriteListBegin(ctx, elemType, size)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteListBegin",
		"elemType", elemType,
		"size", size,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteListBegin(ctx, elemType, size)
	}
	return err
}
func (tdp *TDebugProtocol) WriteListEnd(ctx context.Context) error {
	err := tdp.Delegate.WriteListEnd(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteListEnd",
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteListEnd(ctx)
	}
	return err
}
func (tdp *TDebugProtocol) WriteSetBegin(ctx context.Context, elemType TType, size int) error {
	err := tdp.Delegate.WriteSetBegin(ctx, elemType, size)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteSetBegin",
		"elemType", elemType,
		"size", size,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteSetBegin(ctx, elemType, size)
	}
	return err
}
func (tdp *TDebugProtocol) WriteSetEnd(ctx context.Context) error {
	err := tdp.Delegate.WriteSetEnd(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteSetEnd",
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteSetEnd(ctx)
	}
	return err
}
func (tdp *TDebugProtocol) WriteBool(ctx context.Context, value bool) error {
	err := tdp.Delegate.WriteBool(ctx, value)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteBool",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteBool(ctx, value)
	}
	return err
}
func (tdp *TDebugProtocol) WriteByte(ctx context.Context, value int8) error {
	err := tdp.Delegate.WriteByte(ctx, value)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteByte",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteByte(ctx, value)
	}
	return err
}
func (tdp *TDebugProtocol) WriteI16(ctx context.Context, value int16) error {
	err := tdp.Delegate.WriteI16(ctx, value)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteI16",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteI16(ctx, value)
	}
	return err
}
func (tdp *TDebugProtocol) WriteI32(ctx context.Context, value int32) error {
	err := tdp.Delegate.WriteI32(ctx, value)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteI32",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteI32(ctx, value)
	}
	return err
}
func (tdp *TDebugProtocol) WriteI64(ctx context.Context, value int64) error {
	err := tdp.Delegate.WriteI64(ctx, value)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteI64",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteI64(ctx, value)
	}
	return err
}
func (tdp *TDebugProtocol) WriteDouble(ctx context.Context, value float64) error {
	err := tdp.Delegate.WriteDouble(ctx, value)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteDouble",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteDouble(ctx, value)
	}
	return err
}
func (tdp *TDebugProtocol) WriteString(ctx context.Context, value string) error {
	err := tdp.Delegate.WriteString(ctx, value)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteString",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteString(ctx, value)
	}
	return err
}
func (tdp *TDebugProtocol) WriteBinary(ctx context.Context, value []byte) error {
	err := tdp.Delegate.WriteBinary(ctx, value)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteBinary",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteBinary(ctx, value)
	}
	return err
}
func (tdp *TDebugProtocol) WriteUUID(ctx context.Context, value Tuuid) error {
	err := tdp.Delegate.WriteUUID(ctx, value)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"WriteUUID",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteUUID(ctx, value)
	}
	return err
}

func (tdp *TDebugProtocol) ReadMessageBegin(ctx context.Context) (name string, typeId TMessageType, seqid int32, err error) {
	name, typeId, seqid, err = tdp.Delegate.ReadMessageBegin(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadMessageBegin",
		"name", name,
		"typeId", typeId,
		"seqid", seqid,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteMessageBegin(ctx, name, typeId, seqid)
	}
	return
}
func (tdp *TDebugProtocol) ReadMessageEnd(ctx context.Context) (err error) {
	err = tdp.Delegate.ReadMessageEnd(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadMessageEnd",
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteMessageEnd(ctx)
	}
	return
}
func (tdp *TDebugProtocol) ReadStructBegin(ctx context.Context) (name string, err error) {
	name, err = tdp.Delegate.ReadStructBegin(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadStructBegin",
		"name", name,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteStructBegin(ctx, name)
	}
	return
}
func (tdp *TDebugProtocol) ReadStructEnd(ctx context.Context) (err error) {
	err = tdp.Delegate.ReadStructEnd(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadStructEnd",
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteStructEnd(ctx)
	}
	return
}
func (tdp *TDebugProtocol) ReadFieldBegin(ctx context.Context) (name string, typeId TType, id int16, err error) {
	name, typeId, id, err = tdp.Delegate.ReadFieldBegin(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadFieldBegin",
		"name", name,
		"typeId", typeId,
		"id", id,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteFieldBegin(ctx, name, typeId, id)
	}
	return
}
func (tdp *TDebugProtocol) ReadFieldEnd(ctx context.Context) (err error) {
	err = tdp.Delegate.ReadFieldEnd(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadFieldEnd",
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteFieldEnd(ctx)
	}
	return
}
func (tdp *TDebugProtocol) ReadMapBegin(ctx context.Context) (keyType TType, valueType TType, size int, err error) {
	keyType, valueType, size, err = tdp.Delegate.ReadMapBegin(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadMapBegin",
		"keyType", keyType,
		"valueType", valueType,
		"size", size,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteMapBegin(ctx, keyType, valueType, size)
	}
	return
}
func (tdp *TDebugProtocol) ReadMapEnd(ctx context.Context) (err error) {
	err = tdp.Delegate.ReadMapEnd(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadMapEnd",
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteMapEnd(ctx)
	}
	return
}
func (tdp *TDebugProtocol) ReadListBegin(ctx context.Context) (elemType TType, size int, err error) {
	elemType, size, err = tdp.Delegate.ReadListBegin(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadListBegin",
		"elemType", elemType,
		"size", size,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteListBegin(ctx, elemType, size)
	}
	return
}
func (tdp *TDebugProtocol) ReadListEnd(ctx context.Context) (err error) {
	err = tdp.Delegate.ReadListEnd(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadListEnd",
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteListEnd(ctx)
	}
	return
}
func (tdp *TDebugProtocol) ReadSetBegin(ctx context.Context) (elemType TType, size int, err error) {
	elemType, size, err = tdp.Delegate.ReadSetBegin(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadSetBegin",
		"elemType", elemType,
		"size", size,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteSetBegin(ctx, elemType, size)
	}
	return
}
func (tdp *TDebugProtocol) ReadSetEnd(ctx context.Context) (err error) {
	err = tdp.Delegate.ReadSetEnd(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadSetEnd",
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteSetEnd(ctx)
	}
	return
}
func (tdp *TDebugProtocol) ReadBool(ctx context.Context) (value bool, err error) {
	value, err = tdp.Delegate.ReadBool(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadBool",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteBool(ctx, value)
	}
	return
}
func (tdp *TDebugProtocol) ReadByte(ctx context.Context) (value int8, err error) {
	value, err = tdp.Delegate.ReadByte(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadByte",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteByte(ctx, value)
	}
	return
}
func (tdp *TDebugProtocol) ReadI16(ctx context.Context) (value int16, err error) {
	value, err = tdp.Delegate.ReadI16(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadI16",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteI16(ctx, value)
	}
	return
}
func (tdp *TDebugProtocol) ReadI32(ctx context.Context) (value int32, err error) {
	value, err = tdp.Delegate.ReadI32(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadI32",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteI32(ctx, value)
	}
	return
}
func (tdp *TDebugProtocol) ReadI64(ctx context.Context) (value int64, err error) {
	value, err = tdp.Delegate.ReadI64(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadI64",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteI64(ctx, value)
	}
	return
}
func (tdp *TDebugProtocol) ReadDouble(ctx context.Context) (value float64, err error) {
	value, err = tdp.Delegate.ReadDouble(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadDouble",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteDouble(ctx, value)
	}
	return
}
func (tdp *TDebugProtocol) ReadString(ctx context.Context) (value string, err error) {
	value, err = tdp.Delegate.ReadString(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadString",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteString(ctx, value)
	}
	return
}
func (tdp *TDebugProtocol) ReadBinary(ctx context.Context) (value []byte, err error) {
	value, err = tdp.Delegate.ReadBinary(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadBinary",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteBinary(ctx, value)
	}
	return
}
func (tdp *TDebugProtocol) ReadUUID(ctx context.Context) (value Tuuid, err error) {
	value, err = tdp.Delegate.ReadUUID(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"ReadUUID",
		"value", value,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.WriteUUID(ctx, value)
	}
	return
}
func (tdp *TDebugProtocol) Skip(ctx context.Context, fieldType TType) (err error) {
	err = tdp.Delegate.Skip(ctx, fieldType)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"Skip",
		"fieldType", fieldType,
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.Skip(ctx, fieldType)
	}
	return
}
func (tdp *TDebugProtocol) Flush(ctx context.Context) (err error) {
	err = tdp.Delegate.Flush(ctx)
	slog.DebugContext(
		ctx,
		tdp.LogPrefix+"Flush",
		"err", err,
	)
	if tdp.DuplicateTo != nil {
		tdp.DuplicateTo.Flush(ctx)
	}
	return
}

func (tdp *TDebugProtocol) Transport() TTransport {
	return tdp.Delegate.Transport()
}

// SetTConfiguration implements TConfigurationSetter for propagation.
func (tdp *TDebugProtocol) SetTConfiguration(conf *TConfiguration) {
	PropagateTConfiguration(tdp.Delegate, conf)
	PropagateTConfiguration(tdp.DuplicateTo, conf)
}

var _ TConfigurationSetter = (*TDebugProtocol)(nil)
