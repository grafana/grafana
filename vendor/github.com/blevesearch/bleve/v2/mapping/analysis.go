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

package mapping

type customAnalysis struct {
	CharFilters     map[string]map[string]interface{} `json:"char_filters,omitempty"`
	Tokenizers      map[string]map[string]interface{} `json:"tokenizers,omitempty"`
	TokenMaps       map[string]map[string]interface{} `json:"token_maps,omitempty"`
	TokenFilters    map[string]map[string]interface{} `json:"token_filters,omitempty"`
	Analyzers       map[string]map[string]interface{} `json:"analyzers,omitempty"`
	DateTimeParsers map[string]map[string]interface{} `json:"date_time_parsers,omitempty"`
	SynonymSources  map[string]map[string]interface{} `json:"synonym_sources,omitempty"`
}

func (c *customAnalysis) registerAll(i *IndexMappingImpl) error {
	for name, config := range c.CharFilters {
		_, err := i.cache.DefineCharFilter(name, config)
		if err != nil {
			return err
		}
	}

	if len(c.Tokenizers) > 0 {
		// put all the names in map tracking work to do
		todo := map[string]struct{}{}
		for name := range c.Tokenizers {
			todo[name] = struct{}{}
		}
		registered := 1
		errs := []error{}
		// as long as we keep making progress, keep going
		for len(todo) > 0 && registered > 0 {
			registered = 0
			errs = []error{}
			for name := range todo {
				config := c.Tokenizers[name]
				_, err := i.cache.DefineTokenizer(name, config)
				if err != nil {
					errs = append(errs, err)
				} else {
					delete(todo, name)
					registered++
				}
			}
		}

		if len(errs) > 0 {
			return errs[0]
		}
	}
	for name, config := range c.TokenMaps {
		_, err := i.cache.DefineTokenMap(name, config)
		if err != nil {
			return err
		}
	}
	for name, config := range c.TokenFilters {
		_, err := i.cache.DefineTokenFilter(name, config)
		if err != nil {
			return err
		}
	}
	for name, config := range c.Analyzers {
		_, err := i.cache.DefineAnalyzer(name, config)
		if err != nil {
			return err
		}
	}
	for name, config := range c.DateTimeParsers {
		_, err := i.cache.DefineDateTimeParser(name, config)
		if err != nil {
			return err
		}
	}
	for name, config := range c.SynonymSources {
		_, err := i.cache.DefineSynonymSource(name, config)
		if err != nil {
			return err
		}
	}
	return nil
}

func newCustomAnalysis() *customAnalysis {
	rv := customAnalysis{
		CharFilters:     make(map[string]map[string]interface{}),
		Tokenizers:      make(map[string]map[string]interface{}),
		TokenMaps:       make(map[string]map[string]interface{}),
		TokenFilters:    make(map[string]map[string]interface{}),
		Analyzers:       make(map[string]map[string]interface{}),
		DateTimeParsers: make(map[string]map[string]interface{}),
		SynonymSources:  make(map[string]map[string]interface{}),
	}
	return &rv
}
