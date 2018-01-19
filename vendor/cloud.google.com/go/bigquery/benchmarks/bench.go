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

//+build ignore

package main

import (
	"encoding/json"
	"flag"
	"io/ioutil"
	"log"
	"time"

	"cloud.google.com/go/bigquery"
	"golang.org/x/net/context"
	"google.golang.org/api/iterator"
)

func main() {
	flag.Parse()

	ctx := context.Background()
	c, err := bigquery.NewClient(ctx, flag.Arg(0))
	if err != nil {
		log.Fatal(err)
	}

	queriesJSON, err := ioutil.ReadFile(flag.Arg(1))
	if err != nil {
		log.Fatal(err)
	}

	var queries []string
	if err := json.Unmarshal(queriesJSON, &queries); err != nil {
		log.Fatal(err)
	}

	for _, q := range queries {
		doQuery(ctx, c, q)
	}
}

func doQuery(ctx context.Context, c *bigquery.Client, qt string) {
	startTime := time.Now()
	q := c.Query(qt)
	it, err := q.Read(ctx)
	if err != nil {
		log.Fatal(err)
	}

	numRows, numCols := 0, 0
	var firstByte time.Duration

	for {
		var values []bigquery.Value
		err := it.Next(&values)
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Fatal(err)
		}
		if numRows == 0 {
			numCols = len(values)
			firstByte = time.Since(startTime)
		} else if numCols != len(values) {
			log.Fatalf("got %d columns, want %d", len(values), numCols)
		}
		numRows++
	}
	log.Printf("query %q: %d rows, %d cols, first byte %f sec, total %f sec",
		qt, numRows, numCols, firstByte.Seconds(), time.Since(startTime).Seconds())
}
