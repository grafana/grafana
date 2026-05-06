//go:build windows || wasm
// +build windows wasm

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

func (sc *socketConn) read0() error {
	// On non-unix platforms, we fallback to the default behavior of reading 0 bytes.
	var p []byte
	_, err := sc.Conn.Read(p)
	return err
}

func (sc *socketConn) checkConn() error {
	// On non-unix platforms, we always return nil for this check.
	return nil
}
