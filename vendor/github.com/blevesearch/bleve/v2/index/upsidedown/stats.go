//  Copyright (c) 2014 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package upsidedown

import (
	"sync/atomic"

	"github.com/blevesearch/bleve/v2/util"
	"github.com/blevesearch/upsidedown_store_api"
)

type indexStat struct {
	updates, deletes, batches, errors uint64
	analysisTime, indexTime           uint64
	termSearchersStarted              uint64
	termSearchersFinished             uint64
	numPlainTextBytesIndexed          uint64
	i                                 *UpsideDownCouch
}

func (i *indexStat) statsMap() map[string]interface{} {
	m := map[string]interface{}{}
	m["updates"] = atomic.LoadUint64(&i.updates)
	m["deletes"] = atomic.LoadUint64(&i.deletes)
	m["batches"] = atomic.LoadUint64(&i.batches)
	m["errors"] = atomic.LoadUint64(&i.errors)
	m["analysis_time"] = atomic.LoadUint64(&i.analysisTime)
	m["index_time"] = atomic.LoadUint64(&i.indexTime)
	m["term_searchers_started"] = atomic.LoadUint64(&i.termSearchersStarted)
	m["term_searchers_finished"] = atomic.LoadUint64(&i.termSearchersFinished)
	m["num_plain_text_bytes_indexed"] = atomic.LoadUint64(&i.numPlainTextBytesIndexed)

	if o, ok := i.i.store.(store.KVStoreStats); ok {
		m["kv"] = o.StatsMap()
	}

	return m
}

func (i *indexStat) MarshalJSON() ([]byte, error) {
	m := i.statsMap()
	return util.MarshalJSON(m)
}
