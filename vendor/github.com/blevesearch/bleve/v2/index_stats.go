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

package bleve

import (
	"encoding/json"
	"sync"
	"sync/atomic"
)

type IndexStat struct {
	searches   uint64
	searchTime uint64
	i          *indexImpl
}

func (is *IndexStat) statsMap() map[string]interface{} {
	m := map[string]interface{}{}
	m["index"] = is.i.i.StatsMap()
	m["searches"] = atomic.LoadUint64(&is.searches)
	m["search_time"] = atomic.LoadUint64(&is.searchTime)
	return m
}

func (is *IndexStat) MarshalJSON() ([]byte, error) {
	m := is.statsMap()
	return json.Marshal(m)
}

type IndexStats struct {
	indexes map[string]*IndexStat
	mutex   sync.RWMutex
}

func NewIndexStats() *IndexStats {
	return &IndexStats{
		indexes: make(map[string]*IndexStat),
	}
}

func (i *IndexStats) Register(index Index) {
	i.mutex.Lock()
	defer i.mutex.Unlock()
	i.indexes[index.Name()] = index.Stats()
}

func (i *IndexStats) UnRegister(index Index) {
	i.mutex.Lock()
	defer i.mutex.Unlock()
	delete(i.indexes, index.Name())
}

func (i *IndexStats) String() string {
	i.mutex.RLock()
	defer i.mutex.RUnlock()
	bytes, err := json.Marshal(i.indexes)
	if err != nil {
		return "error marshaling stats"
	}
	return string(bytes)
}

var indexStats *IndexStats
