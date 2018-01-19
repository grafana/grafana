/*
 *
 * Copyright 2017 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

/*
Package main provides benchmark with setting flags.

An example to run some benchmarks with profiling enabled:

go run benchmark/benchmain/main.go -benchtime=10s -workloads=all \
  -compression=on -maxConcurrentCalls=1 -trace=off \
  -reqSizeBytes=1,1048576 -respSizeBytes=1,1048576 -networkMode=Local \
  -cpuProfile=cpuProf -memProfile=memProf -memProfileRate=10000 -resultFile=result

As a suggestion, when creating a branch, you can run this benchmark and save the result
file "-resultFile=basePerf", and later when you at the middle of the work or finish the
work, you can get the benchmark result and compare it with the base anytime.

Assume there are two result files names as "basePerf" and "curPerf" created by adding
-resultFile=basePerf and -resultFile=curPerf.
	To format the curPerf, run:
  	go run benchmark/benchresult/main.go curPerf
	To observe how the performance changes based on a base result, run:
  	go run benchmark/benchresult/main.go basePerf curPerf
*/
package main

import (
	"encoding/gob"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net"
	"os"
	"reflect"
	"runtime"
	"runtime/pprof"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"golang.org/x/net/context"
	"google.golang.org/grpc"
	bm "google.golang.org/grpc/benchmark"
	testpb "google.golang.org/grpc/benchmark/grpc_testing"
	"google.golang.org/grpc/benchmark/latency"
	"google.golang.org/grpc/benchmark/stats"
	"google.golang.org/grpc/grpclog"
)

const (
	modeOn   = "on"
	modeOff  = "off"
	modeBoth = "both"
)

var allCompressionModes = []string{modeOn, modeOff, modeBoth}
var allTraceModes = []string{modeOn, modeOff, modeBoth}

const (
	workloadsUnary     = "unary"
	workloadsStreaming = "streaming"
	workloadsAll       = "all"
)

var allWorkloads = []string{workloadsUnary, workloadsStreaming, workloadsAll}

var (
	runMode = []bool{true, true} // {runUnary, runStream}
	// When set the latency to 0 (no delay), the result is slower than the real result with no delay
	// because latency simulation section has extra operations
	ltc                    = []time.Duration{0, 40 * time.Millisecond} // if non-positive, no delay.
	kbps                   = []int{0, 10240}                           // if non-positive, infinite
	mtu                    = []int{0}                                  // if non-positive, infinite
	maxConcurrentCalls     = []int{1, 8, 64, 512}
	reqSizeBytes           = []int{1, 1024, 1024 * 1024}
	respSizeBytes          = []int{1, 1024, 1024 * 1024}
	enableTrace            []bool
	benchtime              time.Duration
	memProfile, cpuProfile string
	memProfileRate         int
	enableCompressor       []bool
	networkMode            string
	benchmarkResultFile    string
	networks               = map[string]latency.Network{
		"Local":    latency.Local,
		"LAN":      latency.LAN,
		"WAN":      latency.WAN,
		"Longhaul": latency.Longhaul,
	}
)

func unaryBenchmark(startTimer func(), stopTimer func(int32), benchFeatures stats.Features, benchtime time.Duration, s *stats.Stats) {
	caller, close := makeFuncUnary(benchFeatures)
	defer close()
	runBenchmark(caller, startTimer, stopTimer, benchFeatures, benchtime, s)
}

func streamBenchmark(startTimer func(), stopTimer func(int32), benchFeatures stats.Features, benchtime time.Duration, s *stats.Stats) {
	caller, close := makeFuncStream(benchFeatures)
	defer close()
	runBenchmark(caller, startTimer, stopTimer, benchFeatures, benchtime, s)
}

func makeFuncUnary(benchFeatures stats.Features) (func(int), func()) {
	nw := &latency.Network{Kbps: benchFeatures.Kbps, Latency: benchFeatures.Latency, MTU: benchFeatures.Mtu}
	opts := []grpc.DialOption{}
	sopts := []grpc.ServerOption{}
	if benchFeatures.EnableCompressor {
		sopts = append(sopts,
			grpc.RPCCompressor(nopCompressor{}),
			grpc.RPCDecompressor(nopDecompressor{}),
		)
		opts = append(opts,
			grpc.WithCompressor(nopCompressor{}),
			grpc.WithDecompressor(nopDecompressor{}),
		)
	}
	sopts = append(sopts, grpc.MaxConcurrentStreams(uint32(benchFeatures.MaxConcurrentCalls+1)))
	opts = append(opts, grpc.WithDialer(func(address string, timeout time.Duration) (net.Conn, error) {
		return nw.TimeoutDialer(net.DialTimeout)("tcp", address, timeout)
	}))
	opts = append(opts, grpc.WithInsecure())

	target, stopper := bm.StartServer(bm.ServerInfo{Addr: "localhost:0", Type: "protobuf", Network: nw}, sopts...)
	conn := bm.NewClientConn(target, opts...)
	tc := testpb.NewBenchmarkServiceClient(conn)
	return func(int) {
			unaryCaller(tc, benchFeatures.ReqSizeBytes, benchFeatures.RespSizeBytes)
		}, func() {
			conn.Close()
			stopper()
		}
}

func makeFuncStream(benchFeatures stats.Features) (func(int), func()) {
	nw := &latency.Network{Kbps: benchFeatures.Kbps, Latency: benchFeatures.Latency, MTU: benchFeatures.Mtu}
	opts := []grpc.DialOption{}
	sopts := []grpc.ServerOption{}
	if benchFeatures.EnableCompressor {
		sopts = append(sopts,
			grpc.RPCCompressor(grpc.NewGZIPCompressor()),
			grpc.RPCDecompressor(grpc.NewGZIPDecompressor()),
		)
		opts = append(opts,
			grpc.WithCompressor(grpc.NewGZIPCompressor()),
			grpc.WithDecompressor(grpc.NewGZIPDecompressor()),
		)
	}
	sopts = append(sopts, grpc.MaxConcurrentStreams(uint32(benchFeatures.MaxConcurrentCalls+1)))
	opts = append(opts, grpc.WithDialer(func(address string, timeout time.Duration) (net.Conn, error) {
		return nw.TimeoutDialer(net.DialTimeout)("tcp", address, timeout)
	}))
	opts = append(opts, grpc.WithInsecure())

	target, stopper := bm.StartServer(bm.ServerInfo{Addr: "localhost:0", Type: "protobuf", Network: nw}, sopts...)
	conn := bm.NewClientConn(target, opts...)
	tc := testpb.NewBenchmarkServiceClient(conn)
	streams := make([]testpb.BenchmarkService_StreamingCallClient, benchFeatures.MaxConcurrentCalls)
	for i := 0; i < benchFeatures.MaxConcurrentCalls; i++ {
		stream, err := tc.StreamingCall(context.Background())
		if err != nil {
			grpclog.Fatalf("%v.StreamingCall(_) = _, %v", tc, err)
		}
		streams[i] = stream
	}
	return func(pos int) {
			streamCaller(streams[pos], benchFeatures.ReqSizeBytes, benchFeatures.RespSizeBytes)
		}, func() {
			conn.Close()
			stopper()
		}
}

func unaryCaller(client testpb.BenchmarkServiceClient, reqSize, respSize int) {
	if err := bm.DoUnaryCall(client, reqSize, respSize); err != nil {
		grpclog.Fatalf("DoUnaryCall failed: %v", err)
	}
}

func streamCaller(stream testpb.BenchmarkService_StreamingCallClient, reqSize, respSize int) {
	if err := bm.DoStreamingRoundTrip(stream, reqSize, respSize); err != nil {
		grpclog.Fatalf("DoStreamingRoundTrip failed: %v", err)
	}
}

func runBenchmark(caller func(int), startTimer func(), stopTimer func(int32), benchFeatures stats.Features, benchtime time.Duration, s *stats.Stats) {
	// Warm up connection.
	for i := 0; i < 10; i++ {
		caller(0)
	}
	// Run benchmark.
	startTimer()
	var (
		mu sync.Mutex
		wg sync.WaitGroup
	)
	wg.Add(benchFeatures.MaxConcurrentCalls)
	bmEnd := time.Now().Add(benchtime)
	var count int32
	for i := 0; i < benchFeatures.MaxConcurrentCalls; i++ {
		go func(pos int) {
			for {
				t := time.Now()
				if t.After(bmEnd) {
					break
				}
				start := time.Now()
				caller(pos)
				elapse := time.Since(start)
				atomic.AddInt32(&count, 1)
				mu.Lock()
				s.Add(elapse)
				mu.Unlock()
			}
			wg.Done()
		}(i)
	}
	wg.Wait()
	stopTimer(count)
}

// Initiate main function to get settings of features.
func init() {
	var (
		workloads, traceMode, compressorMode, readLatency string
		readKbps, readMtu, readMaxConcurrentCalls         intSliceType
		readReqSizeBytes, readRespSizeBytes               intSliceType
	)
	flag.StringVar(&workloads, "workloads", workloadsAll,
		fmt.Sprintf("Workloads to execute - One of: %v", strings.Join(allWorkloads, ", ")))
	flag.StringVar(&traceMode, "trace", modeOff,
		fmt.Sprintf("Trace mode - One of: %v", strings.Join(allTraceModes, ", ")))
	flag.StringVar(&readLatency, "latency", "", "Simulated one-way network latency - may be a comma-separated list")
	flag.DurationVar(&benchtime, "benchtime", time.Second, "Configures the amount of time to run each benchmark")
	flag.Var(&readKbps, "kbps", "Simulated network throughput (in kbps) - may be a comma-separated list")
	flag.Var(&readMtu, "mtu", "Simulated network MTU (Maximum Transmission Unit) - may be a comma-separated list")
	flag.Var(&readMaxConcurrentCalls, "maxConcurrentCalls", "Number of concurrent RPCs during benchmarks")
	flag.Var(&readReqSizeBytes, "reqSizeBytes", "Request size in bytes - may be a comma-separated list")
	flag.Var(&readRespSizeBytes, "respSizeBytes", "Response size in bytes - may be a comma-separated list")
	flag.StringVar(&memProfile, "memProfile", "", "Enables memory profiling output to the filename provided.")
	flag.IntVar(&memProfileRate, "memProfileRate", 512*1024, "Configures the memory profiling rate. \n"+
		"memProfile should be set before setting profile rate. To include every allocated block in the profile, "+
		"set MemProfileRate to 1. To turn off profiling entirely, set MemProfileRate to 0. 512 * 1024 by default.")
	flag.StringVar(&cpuProfile, "cpuProfile", "", "Enables CPU profiling output to the filename provided")
	flag.StringVar(&compressorMode, "compression", modeOff,
		fmt.Sprintf("Compression mode - One of: %v", strings.Join(allCompressionModes, ", ")))
	flag.StringVar(&benchmarkResultFile, "resultFile", "", "Save the benchmark result into a binary file")
	flag.StringVar(&networkMode, "networkMode", "", "Network mode includes LAN, WAN, Local and Longhaul")
	flag.Parse()
	if flag.NArg() != 0 {
		log.Fatal("Error: unparsed arguments: ", flag.Args())
	}
	switch workloads {
	case workloadsUnary:
		runMode[0] = true
		runMode[1] = false
	case workloadsStreaming:
		runMode[0] = false
		runMode[1] = true
	case workloadsAll:
		runMode[0] = true
		runMode[1] = true
	default:
		log.Fatalf("Unknown workloads setting: %v (want one of: %v)",
			workloads, strings.Join(allWorkloads, ", "))
	}
	enableCompressor = setMode(compressorMode)
	enableTrace = setMode(traceMode)
	// Time input formats as (time + unit).
	readTimeFromInput(&ltc, readLatency)
	readIntFromIntSlice(&kbps, readKbps)
	readIntFromIntSlice(&mtu, readMtu)
	readIntFromIntSlice(&maxConcurrentCalls, readMaxConcurrentCalls)
	readIntFromIntSlice(&reqSizeBytes, readReqSizeBytes)
	readIntFromIntSlice(&respSizeBytes, readRespSizeBytes)
	// Re-write latency, kpbs and mtu if network mode is set.
	if network, ok := networks[networkMode]; ok {
		ltc = []time.Duration{network.Latency}
		kbps = []int{network.Kbps}
		mtu = []int{network.MTU}
	}
}

func setMode(name string) []bool {
	switch name {
	case modeOn:
		return []bool{true}
	case modeOff:
		return []bool{false}
	case modeBoth:
		return []bool{false, true}
	default:
		log.Fatalf("Unknown %s setting: %v (want one of: %v)",
			name, name, strings.Join(allCompressionModes, ", "))
		return []bool{}
	}
}

type intSliceType []int

func (intSlice *intSliceType) String() string {
	return fmt.Sprintf("%v", *intSlice)
}

func (intSlice *intSliceType) Set(value string) error {
	if len(*intSlice) > 0 {
		return errors.New("interval flag already set")
	}
	for _, num := range strings.Split(value, ",") {
		next, err := strconv.Atoi(num)
		if err != nil {
			return err
		}
		*intSlice = append(*intSlice, next)
	}
	return nil
}

func readIntFromIntSlice(values *[]int, replace intSliceType) {
	// If not set replace in the flag, just return to run the default settings.
	if len(replace) == 0 {
		return
	}
	*values = replace
}

func readTimeFromInput(values *[]time.Duration, replace string) {
	if strings.Compare(replace, "") != 0 {
		*values = []time.Duration{}
		for _, ltc := range strings.Split(replace, ",") {
			duration, err := time.ParseDuration(ltc)
			if err != nil {
				log.Fatal(err.Error())
			}
			*values = append(*values, duration)
		}
	}
}

func main() {
	before()
	featuresPos := make([]int, 8)
	// 0:enableTracing 1:ltc 2:kbps 3:mtu 4:maxC 5:reqSize 6:respSize
	featuresNum := []int{len(enableTrace), len(ltc), len(kbps), len(mtu),
		len(maxConcurrentCalls), len(reqSizeBytes), len(respSizeBytes), len(enableCompressor)}
	initalPos := make([]int, len(featuresPos))
	s := stats.NewStats(10)
	s.SortLatency()
	var memStats runtime.MemStats
	var results testing.BenchmarkResult
	var startAllocs, startBytes uint64
	var startTime time.Time
	start := true
	var startTimer = func() {
		runtime.ReadMemStats(&memStats)
		startAllocs = memStats.Mallocs
		startBytes = memStats.TotalAlloc
		startTime = time.Now()
	}
	var stopTimer = func(count int32) {
		runtime.ReadMemStats(&memStats)
		results = testing.BenchmarkResult{N: int(count), T: time.Now().Sub(startTime),
			Bytes: 0, MemAllocs: memStats.Mallocs - startAllocs, MemBytes: memStats.TotalAlloc - startBytes}
	}
	sharedPos := make([]bool, len(featuresPos))
	for i := 0; i < len(featuresPos); i++ {
		if featuresNum[i] <= 1 {
			sharedPos[i] = true
		}
	}

	// Run benchmarks
	resultSlice := []stats.BenchResults{}
	for !reflect.DeepEqual(featuresPos, initalPos) || start {
		start = false
		benchFeature := stats.Features{
			NetworkMode:        networkMode,
			EnableTrace:        enableTrace[featuresPos[0]],
			Latency:            ltc[featuresPos[1]],
			Kbps:               kbps[featuresPos[2]],
			Mtu:                mtu[featuresPos[3]],
			MaxConcurrentCalls: maxConcurrentCalls[featuresPos[4]],
			ReqSizeBytes:       reqSizeBytes[featuresPos[5]],
			RespSizeBytes:      respSizeBytes[featuresPos[6]],
			EnableCompressor:   enableCompressor[featuresPos[7]],
		}

		grpc.EnableTracing = enableTrace[featuresPos[0]]
		if runMode[0] {
			unaryBenchmark(startTimer, stopTimer, benchFeature, benchtime, s)
			s.SetBenchmarkResult("Unary", benchFeature, results.N,
				results.AllocedBytesPerOp(), results.AllocsPerOp(), sharedPos)
			fmt.Println(s.BenchString())
			fmt.Println(s.String())
			resultSlice = append(resultSlice, s.GetBenchmarkResults())
			s.Clear()
		}
		if runMode[1] {
			streamBenchmark(startTimer, stopTimer, benchFeature, benchtime, s)
			s.SetBenchmarkResult("Stream", benchFeature, results.N,
				results.AllocedBytesPerOp(), results.AllocsPerOp(), sharedPos)
			fmt.Println(s.BenchString())
			fmt.Println(s.String())
			resultSlice = append(resultSlice, s.GetBenchmarkResults())
			s.Clear()
		}
		bm.AddOne(featuresPos, featuresNum)
	}
	after(resultSlice)
}

func before() {
	if memProfile != "" {
		runtime.MemProfileRate = memProfileRate
	}
	if cpuProfile != "" {
		f, err := os.Create(cpuProfile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "testing: %s\n", err)
			return
		}
		if err := pprof.StartCPUProfile(f); err != nil {
			fmt.Fprintf(os.Stderr, "testing: can't start cpu profile: %s\n", err)
			f.Close()
			return
		}
	}
}

func after(data []stats.BenchResults) {
	if cpuProfile != "" {
		pprof.StopCPUProfile() // flushes profile to disk
	}
	if memProfile != "" {
		f, err := os.Create(memProfile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "testing: %s\n", err)
			os.Exit(2)
		}
		runtime.GC() // materialize all statistics
		if err = pprof.WriteHeapProfile(f); err != nil {
			fmt.Fprintf(os.Stderr, "testing: can't write heap profile %s: %s\n", memProfile, err)
			os.Exit(2)
		}
		f.Close()
	}
	if benchmarkResultFile != "" {
		f, err := os.Create(benchmarkResultFile)
		if err != nil {
			log.Fatalf("testing: can't write benchmark result %s: %s\n", benchmarkResultFile, err)
		}
		dataEncoder := gob.NewEncoder(f)
		dataEncoder.Encode(data)
		f.Close()
	}
}

// nopCompressor is a compressor that just copies data.
type nopCompressor struct{}

func (nopCompressor) Do(w io.Writer, p []byte) error {
	n, err := w.Write(p)
	if err != nil {
		return err
	}
	if n != len(p) {
		return fmt.Errorf("nopCompressor.Write: wrote %v bytes; want %v", n, len(p))
	}
	return nil
}

func (nopCompressor) Type() string { return "nop" }

// nopDecompressor is a decompressor that just copies data.
type nopDecompressor struct{}

func (nopDecompressor) Do(r io.Reader) ([]byte, error) { return ioutil.ReadAll(r) }
func (nopDecompressor) Type() string                   { return "nop" }
