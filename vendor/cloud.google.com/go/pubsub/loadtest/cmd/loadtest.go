// Copyright 2017 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"strconv"

	"math/rand"

	"cloud.google.com/go/pubsub/loadtest"
	pb "cloud.google.com/go/pubsub/loadtest/pb"
	"google.golang.org/grpc"
)

func main() {
	port := flag.Uint("worker_port", 6000, "port to bind worker to")
	role := flag.String("r", "", "role: pub/sub")
	flag.Parse()

	var lts pb.LoadtestWorkerServer
	switch *role {
	case "pub":
		lts = &loadtest.PubServer{ID: strconv.Itoa(rand.Int())}
	case "sub":
		lts = &loadtest.SubServer{}
	default:
		log.Fatalf("unknown role: %q", *role)
	}

	serv := grpc.NewServer()
	pb.RegisterLoadtestWorkerServer(serv, lts)

	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", *port))
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}
	serv.Serve(lis)
}
