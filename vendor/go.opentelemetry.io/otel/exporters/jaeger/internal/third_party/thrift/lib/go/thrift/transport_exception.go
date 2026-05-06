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
	"errors"
	"io"
)

type timeoutable interface {
	Timeout() bool
}

// Thrift Transport exception
type TTransportException interface {
	TException
	TypeId() int
	Err() error
}

const (
	UNKNOWN_TRANSPORT_EXCEPTION = 0
	NOT_OPEN                    = 1
	ALREADY_OPEN                = 2
	TIMED_OUT                   = 3
	END_OF_FILE                 = 4
)

type tTransportException struct {
	typeId int
	err    error
	msg    string
}

var _ TTransportException = (*tTransportException)(nil)

func (tTransportException) TExceptionType() TExceptionType {
	return TExceptionTypeTransport
}

func (p *tTransportException) TypeId() int {
	return p.typeId
}

func (p *tTransportException) Error() string {
	return p.msg
}

func (p *tTransportException) Err() error {
	return p.err
}

func (p *tTransportException) Unwrap() error {
	return p.err
}

func (p *tTransportException) Timeout() bool {
	return p.typeId == TIMED_OUT
}

func NewTTransportException(t int, e string) TTransportException {
	return &tTransportException{
		typeId: t,
		err:    errors.New(e),
		msg:    e,
	}
}

func NewTTransportExceptionFromError(e error) TTransportException {
	if e == nil {
		return nil
	}

	if t, ok := e.(TTransportException); ok {
		return t
	}

	te := &tTransportException{
		typeId: UNKNOWN_TRANSPORT_EXCEPTION,
		err:    e,
		msg:    e.Error(),
	}

	if isTimeoutError(e) {
		te.typeId = TIMED_OUT
		return te
	}

	if errors.Is(e, io.EOF) {
		te.typeId = END_OF_FILE
		return te
	}

	return te
}

func prependTTransportException(prepend string, e TTransportException) TTransportException {
	return &tTransportException{
		typeId: e.TypeId(),
		err:    e,
		msg:    prepend + e.Error(),
	}
}

// isTimeoutError returns true when err is an error caused by timeout.
//
// Note that this also includes TTransportException wrapped timeout errors.
func isTimeoutError(err error) bool {
	var t timeoutable
	if errors.As(err, &t) {
		return t.Timeout()
	}
	return false
}
