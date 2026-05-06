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

package searcher

import (
	"context"
	"net"

	"github.com/blevesearch/bleve/v2/search"
	index "github.com/blevesearch/bleve_index_api"
)

// netLimits returns the lo and hi bounds inside the network.
func netLimits(n *net.IPNet) (lo net.IP, hi net.IP) {
	ones, bits := n.Mask.Size()
	netNum := n.IP
	if bits == net.IPv4len*8 {
		netNum = netNum.To16()
		ones += 8 * (net.IPv6len - net.IPv4len)
	}
	mask := net.CIDRMask(ones, 8*net.IPv6len)
	lo = make(net.IP, net.IPv6len)
	hi = make(net.IP, net.IPv6len)
	for i := 0; i < net.IPv6len; i++ {
		lo[i] = netNum[i] & mask[i]
		hi[i] = lo[i] | ^mask[i]
	}
	return lo, hi
}

func NewIPRangeSearcher(ctx context.Context, indexReader index.IndexReader, ipNet *net.IPNet,
	field string, boost float64, options search.SearcherOptions) (
	search.Searcher, error) {

	lo, hi := netLimits(ipNet)
	fieldDict, err := indexReader.FieldDictRange(field, lo, hi)
	if err != nil {
		return nil, err
	}
	defer fieldDict.Close()

	var terms []string
	tfd, err := fieldDict.Next()
	for err == nil && tfd != nil {
		terms = append(terms, tfd.Term)
		if tooManyClauses(len(terms)) {
			return nil, tooManyClausesErr(field, len(terms))
		}
		tfd, err = fieldDict.Next()
	}
	if err != nil {
		return nil, err
	}

	return NewMultiTermSearcher(ctx, indexReader, terms, field, boost, options, true)
}
