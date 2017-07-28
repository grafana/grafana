// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"net/url"
	"strings"

	"golang.org/x/net/context"

	"gopkg.in/olivere/elastic.v3/uritemplates"
)

type AliasesService struct {
	client  *Client
	indices []string
	pretty  bool
}

func NewAliasesService(client *Client) *AliasesService {
	builder := &AliasesService{
		client:  client,
		indices: make([]string, 0),
	}
	return builder
}

func (s *AliasesService) Pretty(pretty bool) *AliasesService {
	s.pretty = pretty
	return s
}

func (s *AliasesService) Index(indices ...string) *AliasesService {
	s.indices = append(s.indices, indices...)
	return s
}

// buildURL builds the URL for the operation.
func (s *AliasesService) buildURL() (string, url.Values, error) {
	var err error
	var path string

	if len(s.indices) > 0 {
		path, err = uritemplates.Expand("/{index}/_aliases", map[string]string{
			"index": strings.Join(s.indices, ","),
		})
	} else {
		path = "/_aliases"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}
	return path, params, nil
}

func (s *AliasesService) Do() (*AliasesResult, error) {
	return s.DoC(nil)
}

func (s *AliasesService) DoC(ctx context.Context) (*AliasesResult, error) {
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Get response
	res, err := s.client.PerformRequestC(ctx, "GET", path, params, nil)
	if err != nil {
		return nil, err
	}

	// {
	//   "indexName" : {
	//     "aliases" : {
	//       "alias1" : { },
	//       "alias2" : { }
	//     }
	//   },
	//   "indexName2" : {
	//     ...
	//   },
	// }
	indexMap := make(map[string]interface{})
	if err := s.client.decoder.Decode(res.Body, &indexMap); err != nil {
		return nil, err
	}

	// Each (indexName, _)
	ret := &AliasesResult{
		Indices: make(map[string]indexResult),
	}
	for indexName, indexData := range indexMap {
		indexOut, found := ret.Indices[indexName]
		if !found {
			indexOut = indexResult{Aliases: make([]aliasResult, 0)}
		}

		// { "aliases" : { ... } }
		indexDataMap, ok := indexData.(map[string]interface{})
		if ok {
			aliasesData, ok := indexDataMap["aliases"].(map[string]interface{})
			if ok {
				for aliasName := range aliasesData {
					aliasRes := aliasResult{AliasName: aliasName}
					indexOut.Aliases = append(indexOut.Aliases, aliasRes)
				}
			}
		}

		ret.Indices[indexName] = indexOut
	}

	return ret, nil
}

// -- Result of an alias request.

type AliasesResult struct {
	Indices map[string]indexResult
}

type indexResult struct {
	Aliases []aliasResult
}

type aliasResult struct {
	AliasName string
}

func (ar AliasesResult) IndicesByAlias(aliasName string) []string {
	var indices []string

	for indexName, indexInfo := range ar.Indices {
		for _, aliasInfo := range indexInfo.Aliases {
			if aliasInfo.AliasName == aliasName {
				indices = append(indices, indexName)
			}
		}
	}

	return indices
}

func (ir indexResult) HasAlias(aliasName string) bool {
	for _, alias := range ir.Aliases {
		if alias.AliasName == aliasName {
			return true
		}
	}
	return false
}
