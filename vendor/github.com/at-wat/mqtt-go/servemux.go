// Copyright 2019 The mqtt-go authors.
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

// ServeMux is a MQTT message handler multiplexer.
// The idea is very similar to http.ServeMux.
type ServeMux struct {
	handlers []serveMuxHandler
}

type serveMuxHandler struct {
	filter  topicFilter
	handler Handler
}

// HandleFunc registers the handler function for the given pattern.
func (m *ServeMux) HandleFunc(filter string, handler func(*Message)) error {
	return m.Handle(filter, HandlerFunc(handler))
}

// Handle registers the handler for the given pattern.
func (m *ServeMux) Handle(filter string, handler Handler) error {
	f, err := newTopicFilter(filter)
	if err != nil {
		return err
	}
	m.handlers = append(m.handlers, serveMuxHandler{
		filter:  f,
		handler: handler,
	})
	return nil
}

// Serve dispatches the message to the registered handlers.
func (m *ServeMux) Serve(message *Message) {
	for _, h := range m.handlers {
		if h.filter.Match(message.Topic) {
			h.handler.Serve(message.clone())
		}
	}
}
