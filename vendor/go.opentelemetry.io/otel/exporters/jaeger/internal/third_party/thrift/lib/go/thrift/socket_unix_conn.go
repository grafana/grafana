// +build !windows

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
	"syscall"
	"time"
)

// We rely on this variable to be the zero time,
// but define it as global variable to avoid repetitive allocations.
// Please DO NOT mutate this variable in any way.
var zeroTime time.Time

func (sc *socketConn) read0() error {
	return sc.checkConn()
}

func (sc *socketConn) checkConn() error {
	syscallConn, ok := sc.Conn.(syscall.Conn)
	if !ok {
		// No way to check, return nil
		return nil
	}

	// The reading about to be done here is non-blocking so we don't really
	// need a read deadline. We just need to clear the previously set read
	// deadline, if any.
	sc.Conn.SetReadDeadline(zeroTime)

	rc, err := syscallConn.SyscallConn()
	if err != nil {
		return err
	}

	var n int

	if readErr := rc.Read(func(fd uintptr) bool {
		n, _, err = syscall.Recvfrom(int(fd), sc.buffer[:], syscall.MSG_PEEK|syscall.MSG_DONTWAIT)
		return true
	}); readErr != nil {
		return readErr
	}

	if n > 0 {
		// We got something, which means we are good
		return nil
	}

	if errors.Is(err, syscall.EAGAIN) || errors.Is(err, syscall.EWOULDBLOCK) {
		// This means the connection is still open but we don't have
		// anything to read right now.
		return nil
	}

	if err != nil {
		return err
	}

	// At this point, it means the other side already closed the connection.
	return io.EOF
}
