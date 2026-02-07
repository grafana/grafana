//  Copyright (c) 2019 Couchbase, Inc.
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
	"fmt"

	"github.com/blevesearch/bleve/v2/document"
	"github.com/blevesearch/bleve/v2/index/scorch"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/util"
	index "github.com/blevesearch/bleve_index_api"
)

type builderImpl struct {
	b index.IndexBuilder
	m mapping.IndexMapping
}

func (b *builderImpl) Index(id string, data interface{}) error {
	if id == "" {
		return ErrorEmptyID
	}

	doc := document.NewDocument(id)
	err := b.m.MapDocument(doc, data)
	if err != nil {
		return err
	}
	err = b.b.Index(doc)
	return err
}

func (b *builderImpl) Close() error {
	return b.b.Close()
}

func newBuilder(path string, mapping mapping.IndexMapping, config map[string]interface{}) (Builder, error) {
	if path == "" {
		return nil, fmt.Errorf("builder requires path")
	}

	err := mapping.Validate()
	if err != nil {
		return nil, err
	}

	if config == nil {
		config = map[string]interface{}{}
	}

	// the builder does not have an API to interact with internal storage
	// however we can pass k/v pairs through the config
	mappingBytes, err := util.MarshalJSON(mapping)
	if err != nil {
		return nil, err
	}
	config["internal"] = map[string][]byte{
		string(util.MappingInternalKey): mappingBytes,
	}

	// do not use real config, as these are options for the builder,
	// not the resulting index
	meta := newIndexMeta(scorch.Name, scorch.Name, map[string]interface{}{})
	err = meta.Save(path)
	if err != nil {
		return nil, err
	}

	config["path"] = indexStorePath(path)

	b, err := scorch.NewBuilder(config)
	if err != nil {
		return nil, err
	}
	rv := &builderImpl{
		b: b,
		m: mapping,
	}

	return rv, nil
}
