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
	"log"
	"os"
)

// Logger is a simple wrapper of a logging function.
//
// In reality the users might actually use different logging libraries, and they
// are not always compatible with each other.
//
// Logger is meant to be a simple common ground that it's easy to wrap whatever
// logging library they use into.
//
// See https://issues.apache.org/jira/browse/THRIFT-4985 for the design
// discussion behind it.
type Logger func(msg string)

// NopLogger is a Logger implementation that does nothing.
func NopLogger(msg string) {}

// StdLogger wraps stdlib log package into a Logger.
//
// If logger passed in is nil, it will fallback to use stderr and default flags.
func StdLogger(logger *log.Logger) Logger {
	if logger == nil {
		logger = log.New(os.Stderr, "", log.LstdFlags)
	}
	return func(msg string) {
		logger.Print(msg)
	}
}

func fallbackLogger(logger Logger) Logger {
	if logger == nil {
		return StdLogger(nil)
	}
	return logger
}
