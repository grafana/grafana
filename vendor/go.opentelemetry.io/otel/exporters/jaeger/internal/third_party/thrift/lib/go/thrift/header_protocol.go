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
)

// THeaderProtocol is a thrift protocol that implements THeader:
// https://github.com/apache/thrift/blob/master/doc/specs/HeaderFormat.md
//
// It supports either binary or compact protocol as the wrapped protocol.
//
// Most of the THeader handlings are happening inside THeaderTransport.
type THeaderProtocol struct {
	transport *THeaderTransport

	// Will be initialized on first read/write.
	protocol TProtocol

	cfg *TConfiguration
}

// Deprecated: Use NewTHeaderProtocolConf instead.
func NewTHeaderProtocol(trans TTransport) *THeaderProtocol {
	return newTHeaderProtocolConf(trans, &TConfiguration{
		noPropagation: true,
	})
}

// NewTHeaderProtocolConf creates a new THeaderProtocol from the underlying
// transport with given TConfiguration.
//
// The passed in transport will be wrapped with THeaderTransport.
//
// Note that THeaderTransport handles frame and zlib by itself,
// so the underlying transport should be a raw socket transports (TSocket or TSSLSocket),
// instead of rich transports like TZlibTransport or TFramedTransport.
func NewTHeaderProtocolConf(trans TTransport, conf *TConfiguration) *THeaderProtocol {
	return newTHeaderProtocolConf(trans, conf)
}

func newTHeaderProtocolConf(trans TTransport, cfg *TConfiguration) *THeaderProtocol {
	t := NewTHeaderTransportConf(trans, cfg)
	p, _ := t.cfg.GetTHeaderProtocolID().GetProtocol(t)
	PropagateTConfiguration(p, cfg)
	return &THeaderProtocol{
		transport: t,
		protocol:  p,
		cfg:       cfg,
	}
}

type tHeaderProtocolFactory struct {
	cfg *TConfiguration
}

func (f tHeaderProtocolFactory) GetProtocol(trans TTransport) TProtocol {
	return newTHeaderProtocolConf(trans, f.cfg)
}

func (f *tHeaderProtocolFactory) SetTConfiguration(cfg *TConfiguration) {
	f.cfg = cfg
}

// Deprecated: Use NewTHeaderProtocolFactoryConf instead.
func NewTHeaderProtocolFactory() TProtocolFactory {
	return NewTHeaderProtocolFactoryConf(&TConfiguration{
		noPropagation: true,
	})
}

// NewTHeaderProtocolFactoryConf creates a factory for THeader with given
// TConfiguration.
func NewTHeaderProtocolFactoryConf(conf *TConfiguration) TProtocolFactory {
	return tHeaderProtocolFactory{
		cfg: conf,
	}
}

// Transport returns the underlying transport.
//
// It's guaranteed to be of type *THeaderTransport.
func (p *THeaderProtocol) Transport() TTransport {
	return p.transport
}

// GetReadHeaders returns the THeaderMap read from transport.
func (p *THeaderProtocol) GetReadHeaders() THeaderMap {
	return p.transport.GetReadHeaders()
}

// SetWriteHeader sets a header for write.
func (p *THeaderProtocol) SetWriteHeader(key, value string) {
	p.transport.SetWriteHeader(key, value)
}

// ClearWriteHeaders clears all write headers previously set.
func (p *THeaderProtocol) ClearWriteHeaders() {
	p.transport.ClearWriteHeaders()
}

// AddTransform add a transform for writing.
func (p *THeaderProtocol) AddTransform(transform THeaderTransformID) error {
	return p.transport.AddTransform(transform)
}

func (p *THeaderProtocol) Flush(ctx context.Context) error {
	return p.transport.Flush(ctx)
}

func (p *THeaderProtocol) WriteMessageBegin(ctx context.Context, name string, typeID TMessageType, seqID int32) error {
	newProto, err := p.transport.Protocol().GetProtocol(p.transport)
	if err != nil {
		return err
	}
	PropagateTConfiguration(newProto, p.cfg)
	p.protocol = newProto
	p.transport.SequenceID = seqID
	return p.protocol.WriteMessageBegin(ctx, name, typeID, seqID)
}

func (p *THeaderProtocol) WriteMessageEnd(ctx context.Context) error {
	if err := p.protocol.WriteMessageEnd(ctx); err != nil {
		return err
	}
	return p.transport.Flush(ctx)
}

func (p *THeaderProtocol) WriteStructBegin(ctx context.Context, name string) error {
	return p.protocol.WriteStructBegin(ctx, name)
}

func (p *THeaderProtocol) WriteStructEnd(ctx context.Context) error {
	return p.protocol.WriteStructEnd(ctx)
}

func (p *THeaderProtocol) WriteFieldBegin(ctx context.Context, name string, typeID TType, id int16) error {
	return p.protocol.WriteFieldBegin(ctx, name, typeID, id)
}

func (p *THeaderProtocol) WriteFieldEnd(ctx context.Context) error {
	return p.protocol.WriteFieldEnd(ctx)
}

func (p *THeaderProtocol) WriteFieldStop(ctx context.Context) error {
	return p.protocol.WriteFieldStop(ctx)
}

func (p *THeaderProtocol) WriteMapBegin(ctx context.Context, keyType TType, valueType TType, size int) error {
	return p.protocol.WriteMapBegin(ctx, keyType, valueType, size)
}

func (p *THeaderProtocol) WriteMapEnd(ctx context.Context) error {
	return p.protocol.WriteMapEnd(ctx)
}

func (p *THeaderProtocol) WriteListBegin(ctx context.Context, elemType TType, size int) error {
	return p.protocol.WriteListBegin(ctx, elemType, size)
}

func (p *THeaderProtocol) WriteListEnd(ctx context.Context) error {
	return p.protocol.WriteListEnd(ctx)
}

func (p *THeaderProtocol) WriteSetBegin(ctx context.Context, elemType TType, size int) error {
	return p.protocol.WriteSetBegin(ctx, elemType, size)
}

func (p *THeaderProtocol) WriteSetEnd(ctx context.Context) error {
	return p.protocol.WriteSetEnd(ctx)
}

func (p *THeaderProtocol) WriteBool(ctx context.Context, value bool) error {
	return p.protocol.WriteBool(ctx, value)
}

func (p *THeaderProtocol) WriteByte(ctx context.Context, value int8) error {
	return p.protocol.WriteByte(ctx, value)
}

func (p *THeaderProtocol) WriteI16(ctx context.Context, value int16) error {
	return p.protocol.WriteI16(ctx, value)
}

func (p *THeaderProtocol) WriteI32(ctx context.Context, value int32) error {
	return p.protocol.WriteI32(ctx, value)
}

func (p *THeaderProtocol) WriteI64(ctx context.Context, value int64) error {
	return p.protocol.WriteI64(ctx, value)
}

func (p *THeaderProtocol) WriteDouble(ctx context.Context, value float64) error {
	return p.protocol.WriteDouble(ctx, value)
}

func (p *THeaderProtocol) WriteString(ctx context.Context, value string) error {
	return p.protocol.WriteString(ctx, value)
}

func (p *THeaderProtocol) WriteBinary(ctx context.Context, value []byte) error {
	return p.protocol.WriteBinary(ctx, value)
}

// ReadFrame calls underlying THeaderTransport's ReadFrame function.
func (p *THeaderProtocol) ReadFrame(ctx context.Context) error {
	return p.transport.ReadFrame(ctx)
}

func (p *THeaderProtocol) ReadMessageBegin(ctx context.Context) (name string, typeID TMessageType, seqID int32, err error) {
	if err = p.transport.ReadFrame(ctx); err != nil {
		return
	}

	var newProto TProtocol
	newProto, err = p.transport.Protocol().GetProtocol(p.transport)
	if err != nil {
		var tAppExc TApplicationException
		if !errors.As(err, &tAppExc) {
			return
		}
		if e := p.protocol.WriteMessageBegin(ctx, "", EXCEPTION, seqID); e != nil {
			return
		}
		if e := tAppExc.Write(ctx, p.protocol); e != nil {
			return
		}
		if e := p.protocol.WriteMessageEnd(ctx); e != nil {
			return
		}
		if e := p.transport.Flush(ctx); e != nil {
			return
		}
		return
	}
	PropagateTConfiguration(newProto, p.cfg)
	p.protocol = newProto

	return p.protocol.ReadMessageBegin(ctx)
}

func (p *THeaderProtocol) ReadMessageEnd(ctx context.Context) error {
	return p.protocol.ReadMessageEnd(ctx)
}

func (p *THeaderProtocol) ReadStructBegin(ctx context.Context) (name string, err error) {
	return p.protocol.ReadStructBegin(ctx)
}

func (p *THeaderProtocol) ReadStructEnd(ctx context.Context) error {
	return p.protocol.ReadStructEnd(ctx)
}

func (p *THeaderProtocol) ReadFieldBegin(ctx context.Context) (name string, typeID TType, id int16, err error) {
	return p.protocol.ReadFieldBegin(ctx)
}

func (p *THeaderProtocol) ReadFieldEnd(ctx context.Context) error {
	return p.protocol.ReadFieldEnd(ctx)
}

func (p *THeaderProtocol) ReadMapBegin(ctx context.Context) (keyType TType, valueType TType, size int, err error) {
	return p.protocol.ReadMapBegin(ctx)
}

func (p *THeaderProtocol) ReadMapEnd(ctx context.Context) error {
	return p.protocol.ReadMapEnd(ctx)
}

func (p *THeaderProtocol) ReadListBegin(ctx context.Context) (elemType TType, size int, err error) {
	return p.protocol.ReadListBegin(ctx)
}

func (p *THeaderProtocol) ReadListEnd(ctx context.Context) error {
	return p.protocol.ReadListEnd(ctx)
}

func (p *THeaderProtocol) ReadSetBegin(ctx context.Context) (elemType TType, size int, err error) {
	return p.protocol.ReadSetBegin(ctx)
}

func (p *THeaderProtocol) ReadSetEnd(ctx context.Context) error {
	return p.protocol.ReadSetEnd(ctx)
}

func (p *THeaderProtocol) ReadBool(ctx context.Context) (value bool, err error) {
	return p.protocol.ReadBool(ctx)
}

func (p *THeaderProtocol) ReadByte(ctx context.Context) (value int8, err error) {
	return p.protocol.ReadByte(ctx)
}

func (p *THeaderProtocol) ReadI16(ctx context.Context) (value int16, err error) {
	return p.protocol.ReadI16(ctx)
}

func (p *THeaderProtocol) ReadI32(ctx context.Context) (value int32, err error) {
	return p.protocol.ReadI32(ctx)
}

func (p *THeaderProtocol) ReadI64(ctx context.Context) (value int64, err error) {
	return p.protocol.ReadI64(ctx)
}

func (p *THeaderProtocol) ReadDouble(ctx context.Context) (value float64, err error) {
	return p.protocol.ReadDouble(ctx)
}

func (p *THeaderProtocol) ReadString(ctx context.Context) (value string, err error) {
	return p.protocol.ReadString(ctx)
}

func (p *THeaderProtocol) ReadBinary(ctx context.Context) (value []byte, err error) {
	return p.protocol.ReadBinary(ctx)
}

func (p *THeaderProtocol) Skip(ctx context.Context, fieldType TType) error {
	return p.protocol.Skip(ctx, fieldType)
}

// SetTConfiguration implements TConfigurationSetter.
func (p *THeaderProtocol) SetTConfiguration(cfg *TConfiguration) {
	PropagateTConfiguration(p.transport, cfg)
	PropagateTConfiguration(p.protocol, cfg)
	p.cfg = cfg
}

var (
	_ TConfigurationSetter = (*tHeaderProtocolFactory)(nil)
	_ TConfigurationSetter = (*THeaderProtocol)(nil)
)
