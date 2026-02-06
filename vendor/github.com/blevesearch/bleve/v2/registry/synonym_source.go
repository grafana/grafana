//  Copyright (c) 2024 Couchbase, Inc.
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

func RegisterSynonymSource(typ string, constructor SynonymSourceConstructor) error {
	_, exists := synonymSources[typ]
	if exists {
		return fmt.Errorf("attempted to register duplicate synonym source with type '%s'", typ)
	}
	synonymSources[typ] = constructor
	return nil
}

type SynonymSourceCache struct {
	*ConcurrentCache
}

func NewSynonymSourceCache() *SynonymSourceCache {
	return &SynonymSourceCache{
		NewConcurrentCache(),
	}
}

type SynonymSourceConstructor func(config map[string]interface{}, cache *Cache) (analysis.SynonymSource, error)
type SynonymSourceRegistry map[string]SynonymSourceConstructor

func SynonymSourceBuild(name string, config map[string]interface{}, cache *Cache) (interface{}, error) {
	cons, registered := synonymSources[name]
	if !registered {
		return nil, fmt.Errorf("no synonym source with name '%s' registered", name)
	}
	synonymSource, err := cons(config, cache)
	if err != nil {
		return nil, fmt.Errorf("error building synonym source: %v", err)
	}
	return synonymSource, nil
}

func (c *SynonymSourceCache) SynonymSourceNamed(name string, cache *Cache) (analysis.SynonymSource, error) {
	item, err := c.ItemNamed(name, cache, SynonymSourceBuild)
	if err != nil {
		return nil, err
	}
	return item.(analysis.SynonymSource), nil
}

func (c *SynonymSourceCache) DefineSynonymSource(name string, typ string, config map[string]interface{}, cache *Cache) (analysis.SynonymSource, error) {
	item, err := c.DefineItem(name, typ, config, cache, SynonymSourceBuild)
	if err != nil {
		if err == ErrAlreadyDefined {
			return nil, fmt.Errorf("synonym source named '%s' already defined", name)
		}
		return nil, err
	}
	return item.(analysis.SynonymSource), nil
}

func (c *SynonymSourceCache) VisitSynonymSources(visitor analysis.SynonymSourceVisitor) error {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	for k, v := range c.data {
		err := visitor(k, v.(analysis.SynonymSource))
		if err != nil {
			return err
		}
	}
	return nil
}
