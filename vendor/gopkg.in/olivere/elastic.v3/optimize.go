// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
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

type OptimizeService struct {
	client             *Client
	indices            []string
	maxNumSegments     *int
	onlyExpungeDeletes *bool
	flush              *bool
	waitForMerge       *bool
	force              *bool
	pretty             bool
}

func NewOptimizeService(client *Client) *OptimizeService {
	builder := &OptimizeService{
		client:  client,
		indices: make([]string, 0),
	}
	return builder
}

func (s *OptimizeService) Index(indices ...string) *OptimizeService {
	s.indices = append(s.indices, indices...)
	return s
}

func (s *OptimizeService) MaxNumSegments(maxNumSegments int) *OptimizeService {
	s.maxNumSegments = &maxNumSegments
	return s
}

func (s *OptimizeService) OnlyExpungeDeletes(onlyExpungeDeletes bool) *OptimizeService {
	s.onlyExpungeDeletes = &onlyExpungeDeletes
	return s
}

func (s *OptimizeService) Flush(flush bool) *OptimizeService {
	s.flush = &flush
	return s
}

func (s *OptimizeService) WaitForMerge(waitForMerge bool) *OptimizeService {
	s.waitForMerge = &waitForMerge
	return s
}

func (s *OptimizeService) Force(force bool) *OptimizeService {
	s.force = &force
	return s
}

func (s *OptimizeService) Pretty(pretty bool) *OptimizeService {
	s.pretty = pretty
	return s
}

func (s *OptimizeService) Do() (*OptimizeResult, error) {
	return s.DoC(nil)
}

func (s *OptimizeService) DoC(ctx context.Context) (*OptimizeResult, error) {
	// Build url
	path := "/"

	// Indices part
	var indexPart []string
	for _, index := range s.indices {
		index, err := uritemplates.Expand("{index}", map[string]string{
			"index": index,
		})
		if err != nil {
			return nil, err
		}
		indexPart = append(indexPart, index)
	}
	if len(indexPart) > 0 {
		path += strings.Join(indexPart, ",")
	}

	path += "/_optimize"

	// Parameters
	params := make(url.Values)
	if s.maxNumSegments != nil {
		params.Set("max_num_segments", fmt.Sprintf("%d", *s.maxNumSegments))
	}
	if s.onlyExpungeDeletes != nil {
		params.Set("only_expunge_deletes", fmt.Sprintf("%v", *s.onlyExpungeDeletes))
	}
	if s.flush != nil {
		params.Set("flush", fmt.Sprintf("%v", *s.flush))
	}
	if s.waitForMerge != nil {
		params.Set("wait_for_merge", fmt.Sprintf("%v", *s.waitForMerge))
	}
	if s.force != nil {
		params.Set("force", fmt.Sprintf("%v", *s.force))
	}
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}

	// Get response
	res, err := s.client.PerformRequestC(ctx, "POST", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return result
	ret := new(OptimizeResult)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Result of an optimize request.

type OptimizeResult struct {
	Shards shardsInfo `json:"_shards,omitempty"`
}
