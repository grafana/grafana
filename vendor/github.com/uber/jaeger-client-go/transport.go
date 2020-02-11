// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package jaeger

import (
	"io"
)

// Transport abstracts the method of sending spans out of process.
// Implementations are NOT required to be thread-safe; the RemoteReporter
// is expected to only call methods on the Transport from the same go-routine.
type Transport interface {
	// Append converts the span to the wire representation and adds it
	// to sender's internal buffer.  If the buffer exceeds its designated
	// size, the transport should call Flush() and return the number of spans
	// flushed, otherwise return 0. If error is returned, the returned number
	// of spans is treated as failed span, and reported to metrics accordingly.
	Append(span *Span) (int, error)

	// Flush submits the internal buffer to the remote server. It returns the
	// number of spans flushed. If error is returned, the returned number of
	// spans is treated as failed span, and reported to metrics accordingly.
	Flush() (int, error)

	io.Closer
}
