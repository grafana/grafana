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

package client

import (
	"fmt"
	"net"
	"net/http"
	"sync"

	"github.com/crossdock/crossdock-go"

	"github.com/uber/jaeger-client-go/crossdock/common"
)

// Client is a controller for the tests
type Client struct {
	ClientHostPort     string
	ServerPortHTTP     string
	ServerPortTChannel string
	listener           net.Listener
	hostMapper         func(service string) string
}

// Start begins a blocking Crossdock client
func (c *Client) Start() error {
	if err := c.Listen(); err != nil {
		return err
	}
	return c.Serve()
}

// AsyncStart begins a Crossdock client in the background,
// but does not return until it started serving.
func (c *Client) AsyncStart() error {
	if err := c.Listen(); err != nil {
		return err
	}
	var started sync.WaitGroup
	started.Add(1)
	go func() {
		started.Done()
		c.Serve()
	}()
	started.Wait()
	return nil
}

// Listen initializes the server
func (c *Client) Listen() error {
	c.setDefaultPort(&c.ClientHostPort, ":"+common.DefaultClientPortHTTP)
	c.setDefaultPort(&c.ServerPortHTTP, common.DefaultServerPortHTTP)
	c.setDefaultPort(&c.ServerPortTChannel, common.DefaultServerPortTChannel)

	behaviors := crossdock.Behaviors{
		behaviorTrace: c.trace,
	}

	http.Handle("/", crossdock.Handler(behaviors, true))

	listener, err := net.Listen("tcp", c.ClientHostPort)
	if err != nil {
		return err
	}
	c.listener = listener
	c.ClientHostPort = listener.Addr().String()
	return nil
}

// Serve starts service crossdock traffic. This is a blocking call.
func (c *Client) Serve() error {
	return http.Serve(c.listener, nil)
}

// Close stops the client
func (c *Client) Close() error {
	return c.listener.Close()
}

// URL returns a URL that the client can be accessed on
func (c *Client) URL() string {
	return fmt.Sprintf("http://%s/", c.ClientHostPort)
}

func (c *Client) setDefaultPort(port *string, defaultPort string) {
	if *port == "" {
		*port = defaultPort
	}
}

func (c *Client) mapServiceToHost(service string) string {
	mapper := c.hostMapper
	if mapper == nil {
		return service
	}
	return mapper(service)
}
