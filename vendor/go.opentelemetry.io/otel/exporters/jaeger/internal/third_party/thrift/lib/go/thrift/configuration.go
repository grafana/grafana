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
	"crypto/tls"
	"fmt"
	"time"
)

// Default TConfiguration values.
const (
	DEFAULT_MAX_MESSAGE_SIZE = 100 * 1024 * 1024
	DEFAULT_MAX_FRAME_SIZE   = 16384000

	DEFAULT_TBINARY_STRICT_READ  = false
	DEFAULT_TBINARY_STRICT_WRITE = true

	DEFAULT_CONNECT_TIMEOUT = 0
	DEFAULT_SOCKET_TIMEOUT  = 0
)

// TConfiguration defines some configurations shared between TTransport,
// TProtocol, TTransportFactory, TProtocolFactory, and other implementations.
//
// When constructing TConfiguration, you only need to specify the non-default
// fields. All zero values have sane default values.
//
// Not all configurations defined are applicable to all implementations.
// Implementations are free to ignore the configurations not applicable to them.
//
// All functions attached to this type are nil-safe.
//
// See [1] for spec.
//
// NOTE: When using TConfiguration, fill in all the configurations you want to
// set across the stack, not only the ones you want to set in the immediate
// TTransport/TProtocol.
//
// For example, say you want to migrate this old code into using TConfiguration:
//
//     sccket := thrift.NewTSocketTimeout("host:port", time.Second)
//     transFactory := thrift.NewTFramedTransportFactoryMaxLength(
//         thrift.NewTTransportFactory(),
//         1024 * 1024 * 256,
//     )
//     protoFactory := thrift.NewTBinaryProtocolFactory(true, true)
//
// This is the wrong way to do it because in the end the TConfiguration used by
// socket and transFactory will be overwritten by the one used by protoFactory
// because of TConfiguration propagation:
//
//     // bad example, DO NOT USE
//     sccket := thrift.NewTSocketConf("host:port", &thrift.TConfiguration{
//         ConnectTimeout: time.Second,
//         SocketTimeout:  time.Second,
//     })
//     transFactory := thrift.NewTFramedTransportFactoryConf(
//         thrift.NewTTransportFactory(),
//         &thrift.TConfiguration{
//             MaxFrameSize: 1024 * 1024 * 256,
//         },
//     )
//     protoFactory := thrift.NewTBinaryProtocolFactoryConf(&thrift.TConfiguration{
//         TBinaryStrictRead:  thrift.BoolPtr(true),
//         TBinaryStrictWrite: thrift.BoolPtr(true),
//     })
//
// This is the correct way to do it:
//
//     conf := &thrift.TConfiguration{
//         ConnectTimeout: time.Second,
//         SocketTimeout:  time.Second,
//
//         MaxFrameSize: 1024 * 1024 * 256,
//
//         TBinaryStrictRead:  thrift.BoolPtr(true),
//         TBinaryStrictWrite: thrift.BoolPtr(true),
//     }
//     sccket := thrift.NewTSocketConf("host:port", conf)
//     transFactory := thrift.NewTFramedTransportFactoryConf(thrift.NewTTransportFactory(), conf)
//     protoFactory := thrift.NewTBinaryProtocolFactoryConf(conf)
//
// [1]: https://github.com/apache/thrift/blob/master/doc/specs/thrift-tconfiguration.md
type TConfiguration struct {
	// If <= 0, DEFAULT_MAX_MESSAGE_SIZE will be used instead.
	MaxMessageSize int32

	// If <= 0, DEFAULT_MAX_FRAME_SIZE will be used instead.
	//
	// Also if MaxMessageSize < MaxFrameSize,
	// MaxMessageSize will be used instead.
	MaxFrameSize int32

	// Connect and socket timeouts to be used by TSocket and TSSLSocket.
	//
	// 0 means no timeout.
	//
	// If <0, DEFAULT_CONNECT_TIMEOUT and DEFAULT_SOCKET_TIMEOUT will be
	// used.
	ConnectTimeout time.Duration
	SocketTimeout  time.Duration

	// TLS config to be used by TSSLSocket.
	TLSConfig *tls.Config

	// Strict read/write configurations for TBinaryProtocol.
	//
	// BoolPtr helper function is available to use literal values.
	TBinaryStrictRead  *bool
	TBinaryStrictWrite *bool

	// The wrapped protocol id to be used in THeader transport/protocol.
	//
	// THeaderProtocolIDPtr and THeaderProtocolIDPtrMust helper functions
	// are provided to help filling this value.
	THeaderProtocolID *THeaderProtocolID

	// Used internally by deprecated constructors, to avoid overriding
	// underlying TTransport/TProtocol's cfg by accidental propagations.
	//
	// For external users this is always false.
	noPropagation bool
}

// GetMaxMessageSize returns the max message size an implementation should
// follow.
//
// It's nil-safe. DEFAULT_MAX_MESSAGE_SIZE will be returned if tc is nil.
func (tc *TConfiguration) GetMaxMessageSize() int32 {
	if tc == nil || tc.MaxMessageSize <= 0 {
		return DEFAULT_MAX_MESSAGE_SIZE
	}
	return tc.MaxMessageSize
}

// GetMaxFrameSize returns the max frame size an implementation should follow.
//
// It's nil-safe. DEFAULT_MAX_FRAME_SIZE will be returned if tc is nil.
//
// If the configured max message size is smaller than the configured max frame
// size, the smaller one will be returned instead.
func (tc *TConfiguration) GetMaxFrameSize() int32 {
	if tc == nil {
		return DEFAULT_MAX_FRAME_SIZE
	}
	maxFrameSize := tc.MaxFrameSize
	if maxFrameSize <= 0 {
		maxFrameSize = DEFAULT_MAX_FRAME_SIZE
	}
	if maxMessageSize := tc.GetMaxMessageSize(); maxMessageSize < maxFrameSize {
		return maxMessageSize
	}
	return maxFrameSize
}

// GetConnectTimeout returns the connect timeout should be used by TSocket and
// TSSLSocket.
//
// It's nil-safe. If tc is nil, DEFAULT_CONNECT_TIMEOUT will be returned instead.
func (tc *TConfiguration) GetConnectTimeout() time.Duration {
	if tc == nil || tc.ConnectTimeout < 0 {
		return DEFAULT_CONNECT_TIMEOUT
	}
	return tc.ConnectTimeout
}

// GetSocketTimeout returns the socket timeout should be used by TSocket and
// TSSLSocket.
//
// It's nil-safe. If tc is nil, DEFAULT_SOCKET_TIMEOUT will be returned instead.
func (tc *TConfiguration) GetSocketTimeout() time.Duration {
	if tc == nil || tc.SocketTimeout < 0 {
		return DEFAULT_SOCKET_TIMEOUT
	}
	return tc.SocketTimeout
}

// GetTLSConfig returns the tls config should be used by TSSLSocket.
//
// It's nil-safe. If tc is nil, nil will be returned instead.
func (tc *TConfiguration) GetTLSConfig() *tls.Config {
	if tc == nil {
		return nil
	}
	return tc.TLSConfig
}

// GetTBinaryStrictRead returns the strict read configuration TBinaryProtocol
// should follow.
//
// It's nil-safe. DEFAULT_TBINARY_STRICT_READ will be returned if either tc or
// tc.TBinaryStrictRead is nil.
func (tc *TConfiguration) GetTBinaryStrictRead() bool {
	if tc == nil || tc.TBinaryStrictRead == nil {
		return DEFAULT_TBINARY_STRICT_READ
	}
	return *tc.TBinaryStrictRead
}

// GetTBinaryStrictWrite returns the strict read configuration TBinaryProtocol
// should follow.
//
// It's nil-safe. DEFAULT_TBINARY_STRICT_WRITE will be returned if either tc or
// tc.TBinaryStrictWrite is nil.
func (tc *TConfiguration) GetTBinaryStrictWrite() bool {
	if tc == nil || tc.TBinaryStrictWrite == nil {
		return DEFAULT_TBINARY_STRICT_WRITE
	}
	return *tc.TBinaryStrictWrite
}

// GetTHeaderProtocolID returns the THeaderProtocolID should be used by
// THeaderProtocol clients (for servers, they always use the same one as the
// client instead).
//
// It's nil-safe. If either tc or tc.THeaderProtocolID is nil,
// THeaderProtocolDefault will be returned instead.
// THeaderProtocolDefault will also be returned if configured value is invalid.
func (tc *TConfiguration) GetTHeaderProtocolID() THeaderProtocolID {
	if tc == nil || tc.THeaderProtocolID == nil {
		return THeaderProtocolDefault
	}
	protoID := *tc.THeaderProtocolID
	if err := protoID.Validate(); err != nil {
		return THeaderProtocolDefault
	}
	return protoID
}

// THeaderProtocolIDPtr validates and returns the pointer to id.
//
// If id is not a valid THeaderProtocolID, a pointer to THeaderProtocolDefault
// and the validation error will be returned.
func THeaderProtocolIDPtr(id THeaderProtocolID) (*THeaderProtocolID, error) {
	err := id.Validate()
	if err != nil {
		id = THeaderProtocolDefault
	}
	return &id, err
}

// THeaderProtocolIDPtrMust validates and returns the pointer to id.
//
// It's similar to THeaderProtocolIDPtr, but it panics on validation errors
// instead of returning them.
func THeaderProtocolIDPtrMust(id THeaderProtocolID) *THeaderProtocolID {
	ptr, err := THeaderProtocolIDPtr(id)
	if err != nil {
		panic(err)
	}
	return ptr
}

// TConfigurationSetter is an optional interface TProtocol, TTransport,
// TProtocolFactory, TTransportFactory, and other implementations can implement.
//
// It's intended to be called during intializations.
// The behavior of calling SetTConfiguration on a TTransport/TProtocol in the
// middle of a message is undefined:
// It may or may not change the behavior of the current processing message,
// and it may even cause the current message to fail.
//
// Note for implementations: SetTConfiguration might be called multiple times
// with the same value in quick successions due to the implementation of the
// propagation. Implementations should make SetTConfiguration as simple as
// possible (usually just overwrite the stored configuration and propagate it to
// the wrapped TTransports/TProtocols).
type TConfigurationSetter interface {
	SetTConfiguration(*TConfiguration)
}

// PropagateTConfiguration propagates cfg to impl if impl implements
// TConfigurationSetter and cfg is non-nil, otherwise it does nothing.
//
// NOTE: nil cfg is not propagated. If you want to propagate a TConfiguration
// with everything being default value, use &TConfiguration{} explicitly instead.
func PropagateTConfiguration(impl interface{}, cfg *TConfiguration) {
	if cfg == nil || cfg.noPropagation {
		return
	}

	if setter, ok := impl.(TConfigurationSetter); ok {
		setter.SetTConfiguration(cfg)
	}
}

func checkSizeForProtocol(size int32, cfg *TConfiguration) error {
	if size < 0 {
		return NewTProtocolExceptionWithType(
			NEGATIVE_SIZE,
			fmt.Errorf("negative size: %d", size),
		)
	}
	if size > cfg.GetMaxMessageSize() {
		return NewTProtocolExceptionWithType(
			SIZE_LIMIT,
			fmt.Errorf("size exceeded max allowed: %d", size),
		)
	}
	return nil
}

type tTransportFactoryConf struct {
	delegate TTransportFactory
	cfg      *TConfiguration
}

func (f *tTransportFactoryConf) GetTransport(orig TTransport) (TTransport, error) {
	trans, err := f.delegate.GetTransport(orig)
	if err == nil {
		PropagateTConfiguration(orig, f.cfg)
		PropagateTConfiguration(trans, f.cfg)
	}
	return trans, err
}

func (f *tTransportFactoryConf) SetTConfiguration(cfg *TConfiguration) {
	PropagateTConfiguration(f.delegate, f.cfg)
	f.cfg = cfg
}

// TTransportFactoryConf wraps a TTransportFactory to propagate
// TConfiguration on the factory's GetTransport calls.
func TTransportFactoryConf(delegate TTransportFactory, conf *TConfiguration) TTransportFactory {
	return &tTransportFactoryConf{
		delegate: delegate,
		cfg:      conf,
	}
}

type tProtocolFactoryConf struct {
	delegate TProtocolFactory
	cfg      *TConfiguration
}

func (f *tProtocolFactoryConf) GetProtocol(trans TTransport) TProtocol {
	proto := f.delegate.GetProtocol(trans)
	PropagateTConfiguration(trans, f.cfg)
	PropagateTConfiguration(proto, f.cfg)
	return proto
}

func (f *tProtocolFactoryConf) SetTConfiguration(cfg *TConfiguration) {
	PropagateTConfiguration(f.delegate, f.cfg)
	f.cfg = cfg
}

// TProtocolFactoryConf wraps a TProtocolFactory to propagate
// TConfiguration on the factory's GetProtocol calls.
func TProtocolFactoryConf(delegate TProtocolFactory, conf *TConfiguration) TProtocolFactory {
	return &tProtocolFactoryConf{
		delegate: delegate,
		cfg:      conf,
	}
}

var (
	_ TConfigurationSetter = (*tTransportFactoryConf)(nil)
	_ TConfigurationSetter = (*tProtocolFactoryConf)(nil)
)
