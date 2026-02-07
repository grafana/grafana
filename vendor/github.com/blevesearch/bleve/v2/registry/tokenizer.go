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

func RegisterTokenizer(name string, constructor TokenizerConstructor) error {
	_, exists := tokenizers[name]
	if exists {
		return fmt.Errorf("attempted to register duplicate tokenizer named '%s'", name)
	}
	tokenizers[name] = constructor
	return nil
}

type TokenizerConstructor func(config map[string]interface{}, cache *Cache) (analysis.Tokenizer, error)
type TokenizerRegistry map[string]TokenizerConstructor

type TokenizerCache struct {
	*ConcurrentCache
}

func NewTokenizerCache() *TokenizerCache {
	return &TokenizerCache{
		NewConcurrentCache(),
	}
}

func TokenizerBuild(name string, config map[string]interface{}, cache *Cache) (interface{}, error) {
	cons, registered := tokenizers[name]
	if !registered {
		return nil, fmt.Errorf("no tokenizer with name or type '%s' registered", name)
	}
	tokenizer, err := cons(config, cache)
	if err != nil {
		return nil, fmt.Errorf("error building tokenizer: %v", err)
	}
	return tokenizer, nil
}

func (c *TokenizerCache) TokenizerNamed(name string, cache *Cache) (analysis.Tokenizer, error) {
	item, err := c.ItemNamed(name, cache, TokenizerBuild)
	if err != nil {
		return nil, err
	}
	return item.(analysis.Tokenizer), nil
}

func (c *TokenizerCache) DefineTokenizer(name string, typ string, config map[string]interface{}, cache *Cache) (analysis.Tokenizer, error) {
	item, err := c.DefineItem(name, typ, config, cache, TokenizerBuild)
	if err != nil {
		if err == ErrAlreadyDefined {
			return nil, fmt.Errorf("tokenizer named '%s' already defined", name)
		}
		return nil, err
	}
	return item.(analysis.Tokenizer), nil
}

func TokenizerTypesAndInstances() ([]string, []string) {
	emptyConfig := map[string]interface{}{}
	emptyCache := NewCache()
	var types []string
	var instances []string
	for name, cons := range tokenizers {
		_, err := cons(emptyConfig, emptyCache)
		if err == nil {
			instances = append(instances, name)
		} else {
			types = append(types, name)
		}
	}
	return types, instances
}
