// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

package api

import "github.com/influxdata/influxdb-client-go/v2/domain"

// PagingOption is the function type for applying paging option
type PagingOption func(p *Paging)

// Paging holds pagination parameters for various Get* functions of InfluxDB 2 API
// Not the all options are usable for some Get* functions
type Paging struct {
	// Starting offset for returning items
	// Default 0.
	offset domain.Offset
	// Maximum number of items returned.
	// Default 0 - not applied
	limit domain.Limit
	// What field should be used for sorting
	sortBy string
	// Changes sorting direction
	descending domain.Descending
	// The last resource ID from which to seek from (but not including).
	// This is to be used instead of `offset`.
	after domain.After
}

// defaultPagingOptions returns default paging options: offset 0, limit 0 (not applied), default sorting, ascending
func defaultPaging() *Paging {
	return &Paging{limit: 0, offset: 0, sortBy: "", descending: false, after: ""}
}

// PagingWithLimit sets limit option - maximum number of items returned.
func PagingWithLimit(limit int) PagingOption {
	return func(p *Paging) {
		p.limit = domain.Limit(limit)
	}
}

// PagingWithOffset set starting offset for returning items. Default 0.
func PagingWithOffset(offset int) PagingOption {
	return func(p *Paging) {
		p.offset = domain.Offset(offset)
	}
}

// PagingWithSortBy sets field name which should be used for sorting
func PagingWithSortBy(sortBy string) PagingOption {
	return func(p *Paging) {
		p.sortBy = sortBy
	}
}

// PagingWithDescending changes sorting direction
func PagingWithDescending(descending bool) PagingOption {
	return func(p *Paging) {
		p.descending = domain.Descending(descending)
	}
}

// PagingWithAfter set after option - the last resource ID from which to seek from (but not including).
// This is to be used instead of `offset`.
func PagingWithAfter(after string) PagingOption {
	return func(p *Paging) {
		p.after = domain.After(after)
	}
}
