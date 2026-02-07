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

package custom

import (
	"fmt"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/registry"
)

const Name = "custom"

func AnalyzerConstructor(config map[string]interface{}, cache *registry.Cache) (analysis.Analyzer, error) {

	var err error
	var charFilters []analysis.CharFilter
	charFiltersValue, ok := config["char_filters"]
	if ok {
		switch charFiltersValue := charFiltersValue.(type) {
		case []string:
			charFilters, err = getCharFilters(charFiltersValue, cache)
			if err != nil {
				return nil, err
			}
		case []interface{}:
			charFiltersNames, err := convertInterfaceSliceToStringSlice(charFiltersValue, "char filter")
			if err != nil {
				return nil, err
			}
			charFilters, err = getCharFilters(charFiltersNames, cache)
			if err != nil {
				return nil, err
			}
		default:
			return nil, fmt.Errorf("unsupported type for char_filters, must be slice")
		}
	}

	var tokenizerName string
	tokenizerValue, ok := config["tokenizer"]
	if ok {
		tokenizerName, ok = tokenizerValue.(string)
		if !ok {
			return nil, fmt.Errorf("must specify tokenizer as string")
		}
	} else {
		return nil, fmt.Errorf("must specify tokenizer")
	}

	tokenizer, err := cache.TokenizerNamed(tokenizerName)
	if err != nil {
		return nil, err
	}

	var tokenFilters []analysis.TokenFilter
	tokenFiltersValue, ok := config["token_filters"]
	if ok {
		switch tokenFiltersValue := tokenFiltersValue.(type) {
		case []string:
			tokenFilters, err = getTokenFilters(tokenFiltersValue, cache)
			if err != nil {
				return nil, err
			}
		case []interface{}:
			tokenFiltersNames, err := convertInterfaceSliceToStringSlice(tokenFiltersValue, "token filter")
			if err != nil {
				return nil, err
			}
			tokenFilters, err = getTokenFilters(tokenFiltersNames, cache)
			if err != nil {
				return nil, err
			}
		default:
			return nil, fmt.Errorf("unsupported type for token_filters, must be slice")
		}
	}

	rv := analysis.DefaultAnalyzer{
		Tokenizer: tokenizer,
	}
	if charFilters != nil {
		rv.CharFilters = charFilters
	}
	if tokenFilters != nil {
		rv.TokenFilters = tokenFilters
	}
	return &rv, nil
}

func init() {
	err := registry.RegisterAnalyzer(Name, AnalyzerConstructor)
	if err != nil {
		panic(err)
	}
}

func getCharFilters(charFilterNames []string, cache *registry.Cache) ([]analysis.CharFilter, error) {
	charFilters := make([]analysis.CharFilter, len(charFilterNames))
	for i, charFilterName := range charFilterNames {
		charFilter, err := cache.CharFilterNamed(charFilterName)
		if err != nil {
			return nil, err
		}
		charFilters[i] = charFilter
	}

	return charFilters, nil
}

func getTokenFilters(tokenFilterNames []string, cache *registry.Cache) ([]analysis.TokenFilter, error) {
	tokenFilters := make([]analysis.TokenFilter, len(tokenFilterNames))
	for i, tokenFilterName := range tokenFilterNames {
		tokenFilter, err := cache.TokenFilterNamed(tokenFilterName)
		if err != nil {
			return nil, err
		}
		tokenFilters[i] = tokenFilter
	}

	return tokenFilters, nil
}

func convertInterfaceSliceToStringSlice(interfaceSlice []interface{}, objType string) ([]string, error) {
	stringSlice := make([]string, len(interfaceSlice))
	for i, interfaceObj := range interfaceSlice {
		stringObj, ok := interfaceObj.(string)
		if ok {
			stringSlice[i] = stringObj
		} else {
			return nil, fmt.Errorf(objType + " name must be a string")
		}
	}

	return stringSlice, nil
}
