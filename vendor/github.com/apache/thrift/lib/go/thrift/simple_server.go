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
	"io"
	"log/slog"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

// ServerConnectivityCheckInterval defines the ticker interval used by
// connectivity check in thrift compiled TProcessorFunc implementations.
//
// It's defined as a variable instead of constant, so that thrift server
// implementations can change its value to control the behavior.
//
// If it's changed to <=0, the feature will be disabled.
var ServerConnectivityCheckInterval = time.Millisecond * 5

// ServerStopTimeout defines max stop wait duration used by
// server stop to avoid hanging too long to wait for all client connections to be closed gracefully.
//
// It's defined as a variable instead of constant, so that thrift server
// implementations can change its value to control the behavior.
//
// If it's set to <=0, the feature will be disabled(by default), and the server will wait for
// for all the client connections to be closed gracefully.
var ServerStopTimeout = time.Duration(0)

/*
 * This is not a typical TSimpleServer as it is not blocked after accept a socket.
 * It is more like a TThreadedServer that can handle different connections in different goroutines.
 * This will work if golang user implements a conn-pool like thing in client side.
 */
type TSimpleServer struct {
	closed   atomic.Int32
	wg       sync.WaitGroup
	mu       sync.Mutex
	stopChan chan struct{}

	processorFactory       TProcessorFactory
	serverTransport        TServerTransport
	inputTransportFactory  TTransportFactory
	outputTransportFactory TTransportFactory
	inputProtocolFactory   TProtocolFactory
	outputProtocolFactory  TProtocolFactory

	// Headers to auto forward in THeaderProtocol
	forwardHeaders []string

	logContext atomic.Pointer[context.Context]
}

func NewTSimpleServer2(processor TProcessor, serverTransport TServerTransport) *TSimpleServer {
	return NewTSimpleServerFactory2(NewTProcessorFactory(processor), serverTransport)
}

func NewTSimpleServer4(processor TProcessor, serverTransport TServerTransport, transportFactory TTransportFactory, protocolFactory TProtocolFactory) *TSimpleServer {
	return NewTSimpleServerFactory4(NewTProcessorFactory(processor),
		serverTransport,
		transportFactory,
		protocolFactory,
	)
}

func NewTSimpleServer6(processor TProcessor, serverTransport TServerTransport, inputTransportFactory TTransportFactory, outputTransportFactory TTransportFactory, inputProtocolFactory TProtocolFactory, outputProtocolFactory TProtocolFactory) *TSimpleServer {
	return NewTSimpleServerFactory6(NewTProcessorFactory(processor),
		serverTransport,
		inputTransportFactory,
		outputTransportFactory,
		inputProtocolFactory,
		outputProtocolFactory,
	)
}

func NewTSimpleServerFactory2(processorFactory TProcessorFactory, serverTransport TServerTransport) *TSimpleServer {
	return NewTSimpleServerFactory6(processorFactory,
		serverTransport,
		NewTTransportFactory(),
		NewTTransportFactory(),
		NewTBinaryProtocolFactoryDefault(),
		NewTBinaryProtocolFactoryDefault(),
	)
}

func NewTSimpleServerFactory4(processorFactory TProcessorFactory, serverTransport TServerTransport, transportFactory TTransportFactory, protocolFactory TProtocolFactory) *TSimpleServer {
	return NewTSimpleServerFactory6(processorFactory,
		serverTransport,
		transportFactory,
		transportFactory,
		protocolFactory,
		protocolFactory,
	)
}

func NewTSimpleServerFactory6(processorFactory TProcessorFactory, serverTransport TServerTransport, inputTransportFactory TTransportFactory, outputTransportFactory TTransportFactory, inputProtocolFactory TProtocolFactory, outputProtocolFactory TProtocolFactory) *TSimpleServer {
	return &TSimpleServer{
		processorFactory:       processorFactory,
		serverTransport:        serverTransport,
		inputTransportFactory:  inputTransportFactory,
		outputTransportFactory: outputTransportFactory,
		inputProtocolFactory:   inputProtocolFactory,
		outputProtocolFactory:  outputProtocolFactory,
		stopChan:               make(chan struct{}),
	}
}

func (p *TSimpleServer) ProcessorFactory() TProcessorFactory {
	return p.processorFactory
}

func (p *TSimpleServer) ServerTransport() TServerTransport {
	return p.serverTransport
}

func (p *TSimpleServer) InputTransportFactory() TTransportFactory {
	return p.inputTransportFactory
}

func (p *TSimpleServer) OutputTransportFactory() TTransportFactory {
	return p.outputTransportFactory
}

func (p *TSimpleServer) InputProtocolFactory() TProtocolFactory {
	return p.inputProtocolFactory
}

func (p *TSimpleServer) OutputProtocolFactory() TProtocolFactory {
	return p.outputProtocolFactory
}

func (p *TSimpleServer) Listen() error {
	return p.serverTransport.Listen()
}

// SetForwardHeaders sets the list of header keys that will be auto forwarded
// while using THeaderProtocol.
//
// "forward" means that when the server is also a client to other upstream
// thrift servers, the context object user gets in the processor functions will
// have both read and write headers set, with write headers being forwarded.
// Users can always override the write headers by calling SetWriteHeaderList
// before calling thrift client functions.
func (p *TSimpleServer) SetForwardHeaders(headers []string) {
	size := len(headers)
	if size == 0 {
		p.forwardHeaders = nil
		return
	}

	keys := make([]string, size)
	copy(keys, headers)
	p.forwardHeaders = keys
}

// SetLogger sets the logger used by this TSimpleServer.
//
// If no logger was set before Serve is called, a default logger using standard
// log library will be used.
//
// Deprecated: The logging inside TSimpleServer is now done via slog on error
// level, this does nothing now. It will be removed in a future version.
func (p *TSimpleServer) SetLogger(_ Logger) {}

// SetLogContext sets the context to be used when logging errors inside
// TSimpleServer.
//
// If this is not called before calling Serve, context.Background() will be
// used.
func (p *TSimpleServer) SetLogContext(ctx context.Context) {
	p.logContext.Store(&ctx)
}

func (p *TSimpleServer) innerAccept() (int32, error) {
	client, err := p.serverTransport.Accept()
	p.mu.Lock()
	defer p.mu.Unlock()
	closed := p.closed.Load()
	if closed != 0 {
		return closed, nil
	}
	if err != nil {
		return 0, err
	}
	if client != nil {
		ctx, cancel := context.WithCancel(context.Background())
		p.wg.Add(2)

		go func() {
			defer p.wg.Done()
			defer cancel()
			if err := p.processRequests(client); err != nil {
				ctx := p.logContext.Load()
				slog.ErrorContext(*ctx, "error processing request", "err", err)
			}
		}()

		go func() {
			defer p.wg.Done()
			select {
			case <-ctx.Done():
				// client exited, do nothing
			case <-p.stopChan:
				// TSimpleServer.Close called, close the client connection
				client.Close()
			}
		}()
	}
	return 0, nil
}

func (p *TSimpleServer) AcceptLoop() error {
	for {
		closed, err := p.innerAccept()
		if err != nil {
			return err
		}
		if closed != 0 {
			return nil
		}
	}
}

func (p *TSimpleServer) Serve() error {
	p.logContext.CompareAndSwap(nil, Pointer(context.Background()))

	err := p.Listen()
	if err != nil {
		return err
	}
	p.AcceptLoop()
	return nil
}

func (p *TSimpleServer) Stop() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if !p.closed.CompareAndSwap(0, 1) {
		// Already closed
		return nil
	}
	p.serverTransport.Interrupt()

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		defer cancel()
		p.wg.Wait()
	}()

	if ServerStopTimeout > 0 {
		timer := time.NewTimer(ServerStopTimeout)
		select {
		case <-timer.C:
		case <-ctx.Done():
		}
		close(p.stopChan)
		timer.Stop()
	}

	<-ctx.Done()
	p.stopChan = make(chan struct{})
	return nil
}

// If err is actually EOF or NOT_OPEN, return nil, otherwise return err as-is.
func treatEOFErrorsAsNil(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, io.EOF) {
		return nil
	}
	var te TTransportException
	// NOT_OPEN returned by processor.Process is usually caused by client
	// abandoning the connection (e.g. client side time out, or just client
	// closes connections from the pool because of shutting down).
	// Those logs will be very noisy, so suppress those logs as well.
	if errors.As(err, &te) && (te.TypeId() == END_OF_FILE || te.TypeId() == NOT_OPEN) {
		return nil
	}
	return err
}

func (p *TSimpleServer) processRequests(client TTransport) (err error) {
	defer func() {
		err = treatEOFErrorsAsNil(err)
	}()

	processor := p.processorFactory.GetProcessor(client)
	inputTransport, err := p.inputTransportFactory.GetTransport(client)
	if err != nil {
		return err
	}
	inputProtocol := p.inputProtocolFactory.GetProtocol(inputTransport)
	var outputTransport TTransport
	var outputProtocol TProtocol

	// for THeaderProtocol, we must use the same protocol instance for
	// input and output so that the response is in the same dialect that
	// the server detected the request was in.
	headerProtocol, ok := inputProtocol.(*THeaderProtocol)
	if ok {
		outputProtocol = inputProtocol
	} else {
		oTrans, err := p.outputTransportFactory.GetTransport(client)
		if err != nil {
			return err
		}
		outputTransport = oTrans
		outputProtocol = p.outputProtocolFactory.GetProtocol(outputTransport)
	}

	if inputTransport != nil {
		defer inputTransport.Close()
	}
	if outputTransport != nil {
		defer outputTransport.Close()
	}
	for {
		if p.closed.Load() != 0 {
			return nil
		}

		ctx := SetResponseHelper(
			defaultCtx,
			TResponseHelper{
				THeaderResponseHelper: NewTHeaderResponseHelper(outputProtocol),
			},
		)
		if headerProtocol != nil {
			// We need to call ReadFrame here, otherwise we won't
			// get any headers on the AddReadTHeaderToContext call.
			//
			// ReadFrame is safe to be called multiple times so it
			// won't break when it's called again later when we
			// actually start to read the message.
			if err := headerProtocol.ReadFrame(ctx); err != nil {
				return err
			}
			ctx = AddReadTHeaderToContext(ctx, headerProtocol.GetReadHeaders())
			ctx = SetWriteHeaderList(ctx, p.forwardHeaders)
		}

		ok, err := processor.Process(ctx, inputProtocol, outputProtocol)
		if errors.Is(err, ErrAbandonRequest) {
			err := client.Close()
			if errors.Is(err, net.ErrClosed) {
				// In this case, it's kinda expected to get
				// net.ErrClosed, treat that as no-error
				return nil
			}
			return err
		}
		if errors.As(err, new(TTransportException)) && err != nil {
			return err
		}
		var tae TApplicationException
		if errors.As(err, &tae) && tae.TypeId() == UNKNOWN_METHOD {
			continue
		}
		if !ok {
			break
		}
	}
	return nil
}

// ErrAbandonRequest is a special error that server handler implementations can
// return to indicate that the request has been abandoned.
//
// TSimpleServer and compiler generated Process functions will check for this
// error, and close the client connection instead of trying to write the error
// back to the client.
//
// It shall only be used when the server handler implementation know that the
// client already abandoned the request (by checking that the passed in context
// is already canceled, for example).
//
// It also implements the interface defined by errors.Unwrap and always unwrap
// to context.Canceled error.
var ErrAbandonRequest = abandonRequestError{}

type abandonRequestError struct{}

func (abandonRequestError) Error() string {
	return "request abandoned"
}

func (abandonRequestError) Unwrap() error {
	return context.Canceled
}
