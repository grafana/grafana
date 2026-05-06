// Copyright 2020 The mqtt-go authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package mqtt

// ServeAsync is a MQTT message handler to process messages asynchronously.
type ServeAsync struct {
	// Handler is an underlying handler.
	// Handler.Serve() will be called asynchronously.
	Handler
}

// Serve the message in a new goroutine.
func (m *ServeAsync) Serve(message *Message) {
	go m.Handler.Serve(message.clone())
}
