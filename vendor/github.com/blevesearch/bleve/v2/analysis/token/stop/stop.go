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

// Package stop implements a TokenFilter removing tokens found in
// a TokenMap.
//
// It constructor takes the following arguments:
//
// "stop_token_map" (string): the name of the token map identifying tokens to
// remove.
package stop

import (
	"fmt"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/registry"
)

const Name = "stop_tokens"

type StopTokensFilter struct {
	stopTokens analysis.TokenMap
}

func NewStopTokensFilter(stopTokens analysis.TokenMap) *StopTokensFilter {
	return &StopTokensFilter{
		stopTokens: stopTokens,
	}
}

func (f *StopTokensFilter) Filter(input analysis.TokenStream) analysis.TokenStream {
	j := 0
	for _, token := range input {
		_, isStopToken := f.stopTokens[string(token.Term)]
		if !isStopToken {
			input[j] = token
			j++
		}
	}

	return input[:j]
}

func StopTokensFilterConstructor(config map[string]interface{}, cache *registry.Cache) (analysis.TokenFilter, error) {
	stopTokenMapName, ok := config["stop_token_map"].(string)
	if !ok {
		return nil, fmt.Errorf("must specify stop_token_map")
	}
	stopTokenMap, err := cache.TokenMapNamed(stopTokenMapName)
	if err != nil {
		return nil, fmt.Errorf("error building stop words filter: %v", err)
	}
	return NewStopTokensFilter(stopTokenMap), nil
}

func init() {
	err := registry.RegisterTokenFilter(Name, StopTokensFilterConstructor)
	if err != nil {
		panic(err)
	}
}
