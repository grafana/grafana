// Copyright 2023 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
package stats

import (
	"sort"

	"github.com/dolthub/go-mysql-server/sql"
)

func Union(ctx *sql.Context, b1, b2 []sql.HistogramBucket, types []sql.Type) ([]sql.HistogramBucket, error) {
	ret := make([]sql.HistogramBucket, 0, len(b1)+len(b2))
	i := 0
	j := 0
	for i < len(b1) && j < len(b2) {
		key1 := b1[i].UpperBound()
		key2 := b2[j].UpperBound()
		for k := range key1 {
			t := types[k]
			cmp, err := nilSafeCmp(ctx, t, key1[k], key2[k])
			if err != nil {
				return nil, err
			}
			if cmp == +1 {
				ret = append(ret, b2[j])
				j++
				break
			}
			if cmp == -1 {
				ret = append(ret, b1[i])
				i++
				break
			}
			// if keys are equal, merge buckets
			if k == len(key1)-1 {
				ret = append(ret, b1[i])
				i++
				j++
			}
		}
	}
	for i < len(b1) {
		ret = append(ret, b1[i])
		i++
	}
	for j < len(b2) {
		ret = append(ret, b2[j])
		j++
	}
	return ret, nil
}

func Intersect(ctx *sql.Context, b1, b2 []sql.HistogramBucket, types []sql.Type) ([]sql.HistogramBucket, error) {
	var ret []sql.HistogramBucket
	if len(b1) > len(b2) {
		ret = make([]sql.HistogramBucket, 0, len(b1))
	} else {
		ret = make([]sql.HistogramBucket, 0, len(b2))
	}
	i := 0
	j := 0
	for i < len(b1) && j < len(b2) {
		key1 := b1[i].UpperBound()
		key2 := b2[j].UpperBound()
		for k := range key1 {
			t := types[k]
			cmp, err := nilSafeCmp(ctx, t, key1[k], key2[k])
			if err != nil {
				return nil, err
			}
			if cmp == +1 {
				j++
				break
			}
			if cmp == -1 {
				i++
				break
			}
			// if keys are equal, merge buckets
			if k == len(key1)-1 {
				ret = append(ret, b1[i])
				i++
				j++
			}
		}
	}
	return ret, nil
}

func PrefixKey(ctx *sql.Context, buckets []sql.HistogramBucket, types []sql.Type, key []interface{}) ([]sql.HistogramBucket, error) {
	// find index of bucket >= the key
	var searchErr error
	lowBucket := sort.Search(len(buckets), func(i int) bool {
		// lowest index that func is true
		// lowest index where bucketKey >= key
		bucketKey := buckets[i].UpperBound()
		for i, _ := range key {
			t := types[i]
			cmp, err := nilSafeCmp(ctx, t, bucketKey[i], key[i])
			if err != nil {
				searchErr = err
			}
			switch cmp {
			case 0:
				// equal, keep searching for ineq
			case 1:
				return true
			case -1:
				// bucket upper range too low
				return false
			}
		}
		return true
	})
	if searchErr != nil {
		return nil, searchErr
	}

	upperBucket := lowBucket
	equals := true
	var err error
	for equals && upperBucket < len(buckets) {
		equals, err = keysEqual(ctx, types, buckets[upperBucket].UpperBound(), key)
		if err != nil {
			return nil, err
		}
		upperBucket++
	}

	ret := buckets[lowBucket:upperBucket]
	if err != nil {
		return nil, err
	}

	return ret, nil
}

func nilSafeCmp(ctx *sql.Context, typ sql.Type, left, right interface{}) (int, error) {
	if left == nil && right == nil {
		return 0, nil
	} else if left == nil && right != nil {
		return -1, nil
	} else if left != nil && right == nil {
		return 1, nil
	} else {
		return typ.Compare(ctx, left, right)
	}
}

func GetNewCounts(buckets []sql.HistogramBucket) (rowCount uint64, distinctCount uint64, nullCount uint64) {
	if len(buckets) == 0 {
		return 0, 0, 0
	}
	for _, b := range buckets {
		rowCount += b.RowCount()
		distinctCount += b.DistinctCount()
		nullCount += b.NullCount()
	}
	return rowCount, distinctCount, nullCount
}

func UpdateCounts(statistic sql.Statistic) sql.Statistic {
	buckets := []sql.HistogramBucket(statistic.Histogram())
	if len(buckets) == 0 {
		return statistic
	}
	var rowCount uint64
	var distinctCount uint64
	var nullCount uint64
	for _, b := range buckets {
		rowCount += b.RowCount()
		distinctCount += b.DistinctCount()
		nullCount += b.NullCount()
	}
	return statistic.WithRowCount(rowCount).WithDistinctCount(distinctCount).WithNullCount(nullCount)
}

func keysEqual(ctx *sql.Context, types []sql.Type, left, right []interface{}) (bool, error) {
	for i, _ := range right {
		t := types[i]
		cmp, err := t.Compare(ctx, left[i], right[i])
		if err != nil {
			return false, err
		}
		if cmp != 0 {
			return false, nil
		}
	}
	return true, nil
}

func PrefixLt(ctx *sql.Context, buckets []sql.HistogramBucket, types []sql.Type, val interface{}) ([]sql.HistogramBucket, error) {
	// first bucket whose upper bound is greater than val
	idx, err := PrefixLtHist(buckets, sql.Row{val}, func(i, j sql.Row) (int, error) {
		return nilSafeCmp(ctx, types[0], i[0], j[0])
	})
	if err != nil {
		return nil, err
	}
	// inclusive of idx bucket
	ret := buckets[:idx]
	return PrefixIsNotNull(ret)
}

func PrefixGt(ctx *sql.Context, buckets []sql.HistogramBucket, types []sql.Type, val interface{}) ([]sql.HistogramBucket, error) {
	idx, err := PrefixGtHist(buckets, sql.Row{val}, func(i, j sql.Row) (int, error) {
		return nilSafeCmp(ctx, types[0], i[0], j[0])
	})
	if err != nil {
		return nil, err
	}
	// inclusive of idx bucket
	ret := buckets[idx:]
	if err != nil {
		return nil, err
	}
	return PrefixIsNotNull(ret)
}

func PrefixLte(ctx *sql.Context, buckets []sql.HistogramBucket, types []sql.Type, val interface{}) ([]sql.HistogramBucket, error) {
	// first bucket whose upper bound is greater than val
	idx, err := PrefixLteHist(buckets, sql.Row{val}, func(i, j sql.Row) (int, error) {
		return nilSafeCmp(ctx, types[0], i[0], j[0])
	})
	if err != nil {
		return nil, err
	}
	// inclusive of idx bucket
	ret := buckets[:idx]
	return PrefixIsNotNull(ret)
}

func PrefixLteHist(h []sql.HistogramBucket, target sql.Row, cmp func(sql.Row, sql.Row) (int, error)) (int, error) {
	var searchErr error
	idx := sort.Search(len(h), func(i int) bool {
		// lowest index that func is true
		bucketKey := h[i].UpperBound()
		cmp, err := cmp(bucketKey, target)
		if err != nil {
			searchErr = err
		}
		return cmp > 0
	})
	return idx, searchErr
}

func PrefixLtHist(h []sql.HistogramBucket, target sql.Row, cmp func(sql.Row, sql.Row) (int, error)) (int, error) {
	var searchErr error
	idx := sort.Search(len(h), func(i int) bool {
		// lowest index that func is true
		bucketKey := h[i].UpperBound()
		cmp, err := cmp(bucketKey, target)
		if err != nil {
			searchErr = err
		}
		return cmp >= 0
	})
	return idx, searchErr
}

func PrefixGtHist(h []sql.HistogramBucket, target sql.Row, cmp func(sql.Row, sql.Row) (int, error)) (int, error) {
	var searchErr error
	idx := sort.Search(len(h), func(i int) bool {
		// lowest index that func is true
		// lowest index that is less than key
		bucketKey := h[i].UpperBound()
		cmp, err := cmp(bucketKey, target)
		if err != nil {
			searchErr = err
		}
		return cmp > 0
	})
	return idx, searchErr
}

func PrefixGteHist(h []sql.HistogramBucket, target sql.Row, cmp func(sql.Row, sql.Row) (int, error)) (int, error) {
	var searchErr error
	idx := sort.Search(len(h), func(i int) bool {
		// lowest index that func is true
		bucketKey := h[i].UpperBound()
		cmp, err := cmp(bucketKey, target)
		if err != nil {
			searchErr = err
		}
		return cmp >= 0
	})
	return idx, searchErr
}

func PrefixGte(ctx *sql.Context, buckets []sql.HistogramBucket, types []sql.Type, val interface{}) ([]sql.HistogramBucket, error) {
	idx, err := PrefixGteHist(buckets, sql.Row{val}, func(i, j sql.Row) (int, error) {
		return nilSafeCmp(ctx, types[0], i[0], j[0])
	})
	if err != nil {
		return nil, err
	}
	// inclusive of idx bucket
	ret := buckets[idx:]
	if err != nil {
		return nil, err
	}
	return PrefixIsNotNull(ret)
}

func PrefixIsNull(buckets []sql.HistogramBucket) ([]sql.HistogramBucket, error) {
	var searchErr error
	idx := sort.Search(len(buckets), func(i int) bool {
		// lowest index that func is true
		bucketKey := buckets[i].UpperBound()
		return bucketKey[0] != nil
	})
	if searchErr != nil {
		return nil, searchErr
	}
	// exclusive of idx bucket
	ret := buckets[:idx]
	return ret, nil
}

func PrefixIsNotNull(buckets []sql.HistogramBucket) ([]sql.HistogramBucket, error) {
	var searchErr error
	idx := sort.Search(len(buckets), func(i int) bool {
		// lowest index that func is true
		bucketKey := buckets[i].UpperBound()
		return bucketKey[0] != nil

	})
	if searchErr != nil {
		return nil, searchErr
	}
	// inclusive of idx bucket
	return buckets[idx:], nil
}

func McvPrefixGt(statistic sql.Statistic, i int, val interface{}) (sql.Statistic, error) {
	return statistic, nil
}

func McvPrefixLt(statistic sql.Statistic, i int, val interface{}) (sql.Statistic, error) {
	return statistic, nil
}

func McvPrefixGte(statistic sql.Statistic, i int, val interface{}) (sql.Statistic, error) {
	return statistic, nil
}

func McvPrefixLte(statistic sql.Statistic, i int, val interface{}) (sql.Statistic, error) {
	return statistic, nil
}

func McvPrefixIsNull(statistic sql.Statistic, i int, val interface{}) (sql.Statistic, error) {
	return statistic, nil
}

func McvPrefixIsNotNull(statistic sql.Statistic, i int, val interface{}) (sql.Statistic, error) {
	return statistic, nil
}
