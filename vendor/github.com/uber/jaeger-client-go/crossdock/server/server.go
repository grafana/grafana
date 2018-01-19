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

package server

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"strings"
	"sync"

	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	"github.com/uber/tchannel-go"
	"golang.org/x/net/context"

	"github.com/uber/jaeger-client-go/crossdock/common"
	"github.com/uber/jaeger-client-go/crossdock/endtoend"
	"github.com/uber/jaeger-client-go/crossdock/log"
	"github.com/uber/jaeger-client-go/crossdock/thrift/tracetest"
)

// Server implements S1-S3 servers
type Server struct {
	HostPortHTTP      string
	HostPortTChannel  string
	AgentHostPort     string
	SamplingServerURL string
	Tracer            opentracing.Tracer
	listener          net.Listener
	channel           *tchannel.Channel
	eHandler          *endtoend.Handler
}

// Start starts the test server called by the Client and other upstream servers.
func (s *Server) Start() error {
	if s.HostPortHTTP == "" {
		s.HostPortHTTP = ":" + common.DefaultServerPortHTTP
	}
	if s.HostPortTChannel == "" {
		s.HostPortTChannel = ":" + common.DefaultServerPortTChannel
	}

	if err := s.startTChannelServer(s.Tracer); err != nil {
		return err
	}
	s.eHandler = endtoend.NewHandler(s.AgentHostPort, s.SamplingServerURL)

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { return }) // health check
	mux.HandleFunc("/start_trace", func(w http.ResponseWriter, r *http.Request) {
		s.handleJSON(w, r, func() interface{} {
			return tracetest.NewStartTraceRequest()
		}, func(ctx context.Context, req interface{}) (interface{}, error) {
			return s.doStartTrace(req.(*tracetest.StartTraceRequest))
		})
	})
	mux.HandleFunc("/join_trace", func(w http.ResponseWriter, r *http.Request) {
		s.handleJSON(w, r, func() interface{} {
			return tracetest.NewJoinTraceRequest()
		}, func(ctx context.Context, req interface{}) (interface{}, error) {
			return s.doJoinTrace(ctx, req.(*tracetest.JoinTraceRequest))
		})
	})
	mux.HandleFunc("/create_traces", s.eHandler.GenerateTraces)

	listener, err := net.Listen("tcp", s.HostPortHTTP)
	if err != nil {
		return err
	}
	s.listener = listener
	s.HostPortHTTP = listener.Addr().String()

	var started sync.WaitGroup
	started.Add(1)
	go func() {
		started.Done()
		http.Serve(listener, mux)
	}()
	started.Wait()
	log.Printf("Started http server at %s\n", s.HostPortHTTP)
	return nil
}

// URL returns URL of the HTTP server
func (s *Server) URL() string {
	return fmt.Sprintf("http://%s/", s.HostPortHTTP)
}

// Close stops the server
func (s *Server) Close() error {
	return s.listener.Close()
}

// GetPortHTTP returns the network port the server listens to.
func (s *Server) GetPortHTTP() string {
	hostPort := s.HostPortHTTP
	hostPortSplit := strings.Split(hostPort, ":")
	port := hostPortSplit[len(hostPortSplit)-1]
	return port
}

// GetPortTChannel returns the actual port the server listens to
func (s *Server) GetPortTChannel() string {
	hostPortSplit := strings.Split(s.HostPortTChannel, ":")
	port := hostPortSplit[len(hostPortSplit)-1]
	return port
}

func (s *Server) handleJSON(
	w http.ResponseWriter,
	r *http.Request,
	newReq func() interface{},
	handle func(ctx context.Context, req interface{}) (interface{}, error),
) {
	spanCtx, err := s.Tracer.Extract(opentracing.HTTPHeaders, opentracing.HTTPHeadersCarrier(r.Header))
	if err != nil && err != opentracing.ErrSpanContextNotFound {
		http.Error(w, fmt.Sprintf("Cannot read request body: %+v", err), http.StatusBadRequest)
		return
	}
	span := s.Tracer.StartSpan("post", ext.RPCServerOption(spanCtx))
	ctx := opentracing.ContextWithSpan(context.Background(), span)
	defer span.Finish()

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("Cannot read request body: %+v", err), http.StatusInternalServerError)
		return
	}
	log.Printf("Server request: %s", string(body))
	req := newReq()
	if err := json.Unmarshal(body, req); err != nil {
		http.Error(w, fmt.Sprintf("Cannot parse request JSON: %+v. body=[%s]", err, string(body)), http.StatusBadRequest)
		return
	}
	resp, err := handle(ctx, req)
	if err != nil {
		log.Printf("Handle error: %s", err.Error())
		http.Error(w, fmt.Sprintf("Execution error: %+v", err), http.StatusInternalServerError)
		return
	}
	json, err := json.Marshal(resp)
	if err != nil {
		http.Error(w, fmt.Sprintf("Cannot marshall response to JSON: %+v", err), http.StatusInternalServerError)
		return
	}
	log.Printf("Server response: %s", string(json))
	w.Header().Add("Content-Type", "application/json")
	if _, err := w.Write(json); err != nil {
		return
	}
}
