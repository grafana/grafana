//  Copyright (c) 2015 Couchbase, Inc.
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

package html

import (
	"fmt"

	"github.com/blevesearch/bleve/v2/registry"
	"github.com/blevesearch/bleve/v2/search/highlight"
	htmlFormatter "github.com/blevesearch/bleve/v2/search/highlight/format/html"
	simpleFragmenter "github.com/blevesearch/bleve/v2/search/highlight/fragmenter/simple"
	simpleHighlighter "github.com/blevesearch/bleve/v2/search/highlight/highlighter/simple"
)

const Name = "html"

func Constructor(config map[string]interface{}, cache *registry.Cache) (highlight.Highlighter, error) {

	fragmenter, err := cache.FragmenterNamed(simpleFragmenter.Name)
	if err != nil {
		return nil, fmt.Errorf("error building fragmenter: %v", err)
	}

	formatter, err := cache.FragmentFormatterNamed(htmlFormatter.Name)
	if err != nil {
		return nil, fmt.Errorf("error building fragment formatter: %v", err)
	}

	return simpleHighlighter.NewHighlighter(
			fragmenter,
			formatter,
			simpleHighlighter.DefaultSeparator),
		nil
}

func init() {
	err := registry.RegisterHighlighter(Name, Constructor)
	if err != nil {
		panic(err)
	}
}
