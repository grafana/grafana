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
	"expvar"
	"io"
	"log"
	"time"

	"github.com/blevesearch/bleve/v2/index/scorch"
	"github.com/blevesearch/bleve/v2/index/upsidedown/store/gtreap"
	"github.com/blevesearch/bleve/v2/registry"
	"github.com/blevesearch/bleve/v2/search/highlight/highlighter/html"
	index "github.com/blevesearch/bleve_index_api"
)

var bleveExpVar = expvar.NewMap("bleve")

type configuration struct {
	Cache                  *registry.Cache
	DefaultHighlighter     string
	DefaultKVStore         string
	DefaultMemKVStore      string
	DefaultIndexType       string
	SlowSearchLogThreshold time.Duration
	analysisQueue          *index.AnalysisQueue
}

func (c *configuration) SetAnalysisQueueSize(n int) {
	if c.analysisQueue != nil {
		c.analysisQueue.Close()
	}
	c.analysisQueue = index.NewAnalysisQueue(n)
}

func (c *configuration) Shutdown() {
	c.SetAnalysisQueueSize(0)
}

func newConfiguration() *configuration {
	return &configuration{
		Cache:         registry.NewCache(),
		analysisQueue: index.NewAnalysisQueue(4),
	}
}

// Config contains library level configuration
var Config *configuration

func init() {
	bootStart := time.Now()

	// build the default configuration
	Config = newConfiguration()

	// set the default highlighter
	Config.DefaultHighlighter = html.Name

	// default kv store
	Config.DefaultKVStore = ""

	// default mem only kv store
	Config.DefaultMemKVStore = gtreap.Name

	// default index
	Config.DefaultIndexType = scorch.Name

	bootDuration := time.Since(bootStart)
	bleveExpVar.Add("bootDuration", int64(bootDuration))
	indexStats = NewIndexStats()
	bleveExpVar.Set("indexes", indexStats)

	initDisk()
}

var logger = log.New(io.Discard, "bleve", log.LstdFlags)

// SetLog sets the logger used for logging
// by default log messages are sent to io.Discard
func SetLog(l *log.Logger) {
	logger = l
}
