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
To format the benchmark result:
  go run benchmark/benchresult/main.go resultfile

To see the performance change based on a old result:
  go run benchmark/benchresult/main.go resultfile_old resultfile
It will print the comparison result of intersection benchmarks between two files.

*/
package main

import (
	"encoding/gob"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"google.golang.org/grpc/benchmark/stats"
)

func createMap(fileName string, m map[string]stats.BenchResults) {
	f, err := os.Open(fileName)
	if err != nil {
		log.Fatalf("Read file %s error: %s\n", fileName, err)
	}
	defer f.Close()
	var data []stats.BenchResults
	decoder := gob.NewDecoder(f)
	if err = decoder.Decode(&data); err != nil {
		log.Fatalf("Decode file %s error: %s\n", fileName, err)
	}
	for _, d := range data {
		m[d.RunMode+"-"+d.Features.String()] = d
	}
}

func intChange(title string, val1, val2 int64) string {
	return fmt.Sprintf("%10s %12s %12s %8.2f%%\n", title, strconv.FormatInt(val1, 10),
		strconv.FormatInt(val2, 10), float64(val2-val1)*100/float64(val1))
}

func timeChange(title int, val1, val2 time.Duration) string {
	return fmt.Sprintf("%10s %12s %12s %8.2f%%\n", strconv.Itoa(title)+" latency", val1.String(),
		val2.String(), float64(val2-val1)*100/float64(val1))
}

func compareTwoMap(m1, m2 map[string]stats.BenchResults) {
	for k2, v2 := range m2 {
		if v1, ok := m1[k2]; ok {
			changes := k2 + "\n"
			changes += fmt.Sprintf("%10s %12s %12s %8s\n", "Title", "Before", "After", "Percentage")
			changes += intChange("Bytes/op", v1.AllocedBytesPerOp, v2.AllocedBytesPerOp)
			changes += intChange("Allocs/op", v1.AllocsPerOp, v2.AllocsPerOp)
			changes += timeChange(v1.Latency[1].Percent, v1.Latency[1].Value, v2.Latency[1].Value)
			changes += timeChange(v1.Latency[2].Percent, v1.Latency[2].Value, v2.Latency[2].Value)
			fmt.Printf("%s\n", changes)
		}
	}
}

func compareBenchmark(file1, file2 string) {
	var BenchValueFile1 map[string]stats.BenchResults
	var BenchValueFile2 map[string]stats.BenchResults
	BenchValueFile1 = make(map[string]stats.BenchResults)
	BenchValueFile2 = make(map[string]stats.BenchResults)

	createMap(file1, BenchValueFile1)
	createMap(file2, BenchValueFile2)

	compareTwoMap(BenchValueFile1, BenchValueFile2)
}

func printline(benchName, ltc50, ltc90, allocByte, allocsOp interface{}) {
	fmt.Printf("%-80v%12v%12v%12v%12v\n", benchName, ltc50, ltc90, allocByte, allocsOp)
}

func formatBenchmark(fileName string) {
	f, err := os.Open(fileName)
	if err != nil {
		log.Fatalf("Read file %s error: %s\n", fileName, err)
	}
	defer f.Close()
	var data []stats.BenchResults
	decoder := gob.NewDecoder(f)
	if err = decoder.Decode(&data); err != nil {
		log.Fatalf("Decode file %s error: %s\n", fileName, err)
	}
	if len(data) == 0 {
		log.Fatalf("No data in file %s\n", fileName)
	}
	printPos := data[0].SharedPosion
	fmt.Println("\nShared features:\n" + strings.Repeat("-", 20))
	fmt.Print(stats.PartialPrintString(printPos, data[0].Features, true))
	fmt.Println(strings.Repeat("-", 35))
	for i := 0; i < len(data[0].SharedPosion); i++ {
		printPos[i] = !printPos[i]
	}
	printline("Name", "latency-50", "latency-90", "Alloc (B)", "Alloc (#)")
	for _, d := range data {
		name := d.RunMode + stats.PartialPrintString(printPos, d.Features, false)
		printline(name, d.Latency[1].Value.String(), d.Latency[2].Value.String(),
			d.AllocedBytesPerOp, d.AllocsPerOp)
	}
}

func main() {
	if len(os.Args) == 2 {
		formatBenchmark(os.Args[1])
	} else {
		compareBenchmark(os.Args[1], os.Args[2])
	}
}
