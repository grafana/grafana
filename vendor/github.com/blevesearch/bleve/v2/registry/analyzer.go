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

package registry

import (
	"fmt"

	"github.com/blevesearch/bleve/v2/analysis"
)

func RegisterAnalyzer(name string, constructor AnalyzerConstructor) error {
	_, exists := analyzers[name]
	if exists {
		return fmt.Errorf("attempted to register duplicate analyzer named '%s'", name)
	}
	analyzers[name] = constructor
	return nil
}

type AnalyzerConstructor func(config map[string]interface{}, cache *Cache) (analysis.Analyzer, error)
type AnalyzerRegistry map[string]AnalyzerConstructor

type AnalyzerCache struct {
	*ConcurrentCache
}

func NewAnalyzerCache() *AnalyzerCache {
	return &AnalyzerCache{
		NewConcurrentCache(),
	}
}

func AnalyzerBuild(name string, config map[string]interface{}, cache *Cache) (interface{}, error) {
	cons, registered := analyzers[name]
	if !registered {
		return nil, fmt.Errorf("no analyzer with name or type '%s' registered", name)
	}
	analyzer, err := cons(config, cache)
	if err != nil {
		return nil, fmt.Errorf("error building analyzer: %v", err)
	}
	return analyzer, nil
}

func (c *AnalyzerCache) AnalyzerNamed(name string, cache *Cache) (analysis.Analyzer, error) {
	item, err := c.ItemNamed(name, cache, AnalyzerBuild)
	if err != nil {
		return nil, err
	}
	return item.(analysis.Analyzer), nil
}

func (c *AnalyzerCache) DefineAnalyzer(name string, typ string, config map[string]interface{}, cache *Cache) (analysis.Analyzer, error) {
	item, err := c.DefineItem(name, typ, config, cache, AnalyzerBuild)
	if err != nil {
		if err == ErrAlreadyDefined {
			return nil, fmt.Errorf("analyzer named '%s' already defined", name)
		}
		return nil, err
	}
	return item.(analysis.Analyzer), nil
}

func AnalyzerTypesAndInstances() ([]string, []string) {
	emptyConfig := map[string]interface{}{}
	emptyCache := NewCache()
	var types []string
	var instances []string
	for name, cons := range analyzers {
		_, err := cons(emptyConfig, emptyCache)
		if err == nil {
			instances = append(instances, name)
		} else {
			types = append(types, name)
		}
	}
	return types, instances
}
