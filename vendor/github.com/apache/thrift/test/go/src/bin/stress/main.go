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

package main

import (
	"flag"
	"fmt"
	"gen/stress"
	"log"
	_ "net/http/pprof"
	"os"
	"runtime"
	"runtime/pprof"
	"sync"
	"sync/atomic"
	"thrift"
	"time"
)

var cpuprofile = flag.String("cpuprofile", "", "write cpu profile to this file")
var memprofile = flag.String("memprofile", "", "write memory profile to this file")

var (
	host      = flag.String("host", "localhost", "Host to connect")
	port      = flag.Int64("port", 9091, "Port number to connect")
	loop      = flag.Int("loops", 50000, "The number of remote thrift calls each client makes")
	runserver = flag.Int("server", 1, "Run the Thrift server in this process")
	clients   = flag.Int("clients", 20, "Number of client threads to create - 0 implies no clients, i.e. server only")
	callName  = flag.String("call", "echoVoid", "Service method to call, one of echoVoid, echoByte, echoI32, echoI64, echoString, echiList, echoSet, echoMap")
	compact   = flag.Bool("compact", false, "Use compact protocol instead of binary.")
	framed    = flag.Bool("framed", false, "Use framed transport instead of buffered.")
)
var hostPort string

type callT int64

const (
	echoVoid callT = iota
	echoByte
	echoI32
	echoI64
	echoString
	echiList
	echoSet
	echoMap
)

var callTMap = map[string]callT{
	"echoVoid":   echoVoid,
	"echoByte":   echoByte,
	"echoI32":    echoI32,
	"echoI64":    echoI64,
	"echoString": echoString,
	"echiList":   echiList,
	"echoSet":    echoSet,
	"echoMap":    echoMap,
}
var callType callT

var ready, done sync.WaitGroup

var clicounter int64 = 0
var counter int64 = 0

func main() {
	flag.Parse()
	if *memprofile != "" {
		runtime.MemProfileRate = 100
	}
	var ok bool
	if callType, ok = callTMap[*callName]; !ok {
		log.Fatal("Unknown service call", *callName)
	}
	if *cpuprofile != "" {
		f, err := os.Create(*cpuprofile)
		if err != nil {
			log.Fatal(err)
		}
		pprof.StartCPUProfile(f)
		defer pprof.StopCPUProfile()
	}
	hostPort = fmt.Sprintf("%s:%d", *host, *port)
	var protocolFactory thrift.TProtocolFactory
	var transportFactory thrift.TTransportFactory

	if *compact {
		protocolFactory = thrift.NewTCompactProtocolFactory()
	} else {
		protocolFactory = thrift.NewTBinaryProtocolFactoryDefault()
	}

	if *framed {
		transportFactory = thrift.NewTTransportFactory()
		transportFactory = thrift.NewTFramedTransportFactory(transportFactory)
	} else {
		transportFactory = thrift.NewTBufferedTransportFactory(8192)
	}

	if *runserver > 0 {
		serverTransport, err := thrift.NewTServerSocket(hostPort)
		if err != nil {
			log.Fatalf("Unable to create server socket: %s", err)
		}

		processor := stress.NewServiceProcessor(&handler{})
		server := thrift.NewTSimpleServer4(processor, serverTransport, transportFactory, protocolFactory)
		if *clients == 0 {
			server.Serve()
		} else {
			go server.Serve()
		}
	}
	//start clients
	if *clients != 0 {
		ready.Add(*clients + 1)
		done.Add(*clients)
		for i := 0; i < *clients; i++ {
			go client(protocolFactory)
		}
		ready.Done()
		ready.Wait()
		//run!
		startTime := time.Now()
		//wait for completion
		done.Wait()
		endTime := time.Now()
		duration := endTime.Sub(startTime)
		log.Printf("%d calls in %v (%f calls per second)\n", clicounter, duration, float64(clicounter)/duration.Seconds())
	}
	if *memprofile != "" {
		f, err := os.Create(*memprofile)
		if err != nil {
			log.Fatal(err)
		}
		pprof.WriteHeapProfile(f)
		f.Close()
		return
	}
}

func client(protocolFactory thrift.TProtocolFactory) {
	trans, err := thrift.NewTSocket(hostPort)
	if err != nil {
		log.Fatalf("Unable to create server socket: %s", err)
	}
	btrans := thrift.NewTBufferedTransport(trans, 2048)
	client := stress.NewServiceClientFactory(btrans, protocolFactory)
	err = trans.Open()
	if err != nil {
		log.Fatalf("Unable to open connection: %s", err)
	}
	ready.Done()
	ready.Wait()
	switch callType {
	case echoVoid:
		for i := 0; i < *loop; i++ {
			client.EchoVoid()
			atomic.AddInt64(&clicounter, 1)
		}
	case echoByte:
		for i := 0; i < *loop; i++ {
			client.EchoByte(42)
			atomic.AddInt64(&clicounter, 1)
		}
	case echoI32:
		for i := 0; i < *loop; i++ {
			client.EchoI32(4242)
			atomic.AddInt64(&clicounter, 1)
		}
	case echoI64:
		for i := 0; i < *loop; i++ {
			client.EchoI64(424242)
			atomic.AddInt64(&clicounter, 1)
		}
	case echoString:
		for i := 0; i < *loop; i++ {
			client.EchoString("TestString")
			atomic.AddInt64(&clicounter, 1)
		}
	case echiList:
		l := []int8{-10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8}
		for i := 0; i < *loop; i++ {
			client.EchoList(l)
			atomic.AddInt64(&clicounter, 1)
		}
	case echoSet:
		s := map[int8]struct{}{-10: {}, -9: {}, -8: {}, -7: {}, -6: {}, -5: {}, -4: {}, -3: {}, -2: {}, -1: {}, 0: {}, 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {}, 8: {}}
		for i := 0; i < *loop; i++ {
			client.EchoSet(s)
			atomic.AddInt64(&clicounter, 1)
		}
	case echoMap:
		m := map[int8]int8{-10: 10, -9: 9, -8: 8, -7: 7, -6: 6, -5: 5, -4: 4, -3: 3, -2: 2, -1: 1, 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8}
		for i := 0; i < *loop; i++ {
			client.EchoMap(m)
			atomic.AddInt64(&clicounter, 1)
		}
	}

	done.Done()
}

type handler struct{}

func (h *handler) EchoVoid() (err error) {
	atomic.AddInt64(&counter, 1)
	return nil
}
func (h *handler) EchoByte(arg int8) (r int8, err error) {
	atomic.AddInt64(&counter, 1)
	return arg, nil
}
func (h *handler) EchoI32(arg int32) (r int32, err error) {
	atomic.AddInt64(&counter, 1)
	return arg, nil
}
func (h *handler) EchoI64(arg int64) (r int64, err error) {
	atomic.AddInt64(&counter, 1)
	return arg, nil
}
func (h *handler) EchoString(arg string) (r string, err error) {
	atomic.AddInt64(&counter, 1)
	return arg, nil
}
func (h *handler) EchoList(arg []int8) (r []int8, err error) {
	atomic.AddInt64(&counter, 1)
	return arg, nil
}
func (h *handler) EchoSet(arg map[int8]struct{}) (r map[int8]struct{}, err error) {
	atomic.AddInt64(&counter, 1)
	return arg, nil
}
func (h *handler) EchoMap(arg map[int8]int8) (r map[int8]int8, err error) {
	atomic.AddInt64(&counter, 1)
	return arg, nil
}
