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

package main

import (
	"io"
	"os"

	"github.com/opentracing/opentracing-go"

	"github.com/uber/jaeger-client-go"
	"github.com/uber/jaeger-client-go/crossdock/client"
	"github.com/uber/jaeger-client-go/crossdock/common"
	"github.com/uber/jaeger-client-go/crossdock/log"
	"github.com/uber/jaeger-client-go/crossdock/server"
	jlog "github.com/uber/jaeger-client-go/log"
)

func main() {
	log.Enabled = true

	agentHostPort, ok := os.LookupEnv("AGENT_HOST_PORT")
	if !ok {
		jlog.StdLogger.Error("env AGENT_HOST_PORT is not specified!")
	}
	sServerURL, ok := os.LookupEnv("SAMPLING_SERVER_URL")
	if !ok {
		jlog.StdLogger.Error("env SAMPLING_SERVER_URL is not specified!")
	}

	tracer, tCloser := initTracer()
	defer tCloser.Close()

	s := &server.Server{Tracer: tracer, SamplingServerURL: sServerURL, AgentHostPort: agentHostPort}
	if err := s.Start(); err != nil {
		panic(err.Error())
	} else {
		defer s.Close()
	}
	client := &client.Client{}
	if err := client.Start(); err != nil {
		panic(err.Error())
	}
}

func initTracer() (opentracing.Tracer, io.Closer) {
	t, c := jaeger.NewTracer(
		common.DefaultTracerServiceName,
		jaeger.NewConstSampler(false),
		jaeger.NewLoggingReporter(jlog.StdLogger))
	return t, c
}
