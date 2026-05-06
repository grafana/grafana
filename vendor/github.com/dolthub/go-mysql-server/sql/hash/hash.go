// Copyright 2025 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package hash

import (
	"fmt"
	"strconv"
	"sync"

	"github.com/cespare/xxhash/v2"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var digestPool = sync.Pool{
	New: func() any {
		return xxhash.New()
	},
}

// ExprsToSchema converts a list of sql.Expression to a sql.Schema.
// This is used for functions that use HashOf, but don't already have a schema.
// The generated schema ONLY contains the types of the expressions without any column names or any other info.
func ExprsToSchema(exprs ...sql.Expression) sql.Schema {
	var sch sql.Schema
	for _, expr := range exprs {
		sch = append(sch, &sql.Column{Type: expr.Type()})
	}
	return sch
}

// HashOf returns a hash of the given row to be used as key in a cache.
func HashOf(ctx *sql.Context, sch sql.Schema, row sql.Row) (uint64, error) {
	hash := digestPool.Get().(*xxhash.Digest)
	hash.Reset()
	defer digestPool.Put(hash)
	for i, v := range row {
		if i > 0 {
			// separate each value in the row with a nil byte
			if _, err := hash.Write([]byte{0}); err != nil {
				return 0, err
			}
		}

		v, err := sql.UnwrapAny(ctx, v)
		if err != nil {
			return 0, fmt.Errorf("error unwrapping value: %w", err)
		}

		if v == nil {
			if _, err := hash.WriteString("<nil>"); err != nil {
				return 0, err
			}
			continue
		}

		// TODO: we may not always have the type information available, so we check schema length.
		//  Then, defer to original behavior
		if i < len(sch) {
			switch typ := sch[i].Type.(type) {
			case sql.ExtendedType:
				// TODO: Doltgres follows Postgres conventions which don't align with the expectations of MySQL,
				//  so we're using the old (probably incorrect) behavior for now
				_, err := hash.WriteString(fmt.Sprintf("%v", v))
				if err != nil {
					return 0, err
				}
				continue
			case types.StringType:
				var strVal string
				strVal, err = types.ConvertToString(ctx, v, typ, nil)
				if err != nil {
					return 0, err
				}
				err = typ.Collation().WriteWeightString(hash, strVal)
				if err != nil {
					return 0, err
				}
				continue
			}
		}
		switch v := v.(type) {
		case int:
			_, err = hash.WriteString(strconv.FormatInt(int64(v), 10))
		case int8:
			_, err = hash.WriteString(strconv.FormatInt(int64(v), 10))
		case int16:
			_, err = hash.WriteString(strconv.FormatInt(int64(v), 10))
		case int32:
			_, err = hash.WriteString(strconv.FormatInt(int64(v), 10))
		case int64:
			_, err = hash.WriteString(strconv.FormatInt(v, 10))
		case uint:
			_, err = hash.WriteString(strconv.FormatUint(uint64(v), 10))
		case uint8:
			_, err = hash.WriteString(strconv.FormatUint(uint64(v), 10))
		case uint16:
			_, err = hash.WriteString(strconv.FormatUint(uint64(v), 10))
		case uint32:
			_, err = hash.WriteString(strconv.FormatUint(uint64(v), 10))
		case uint64:
			_, err = hash.WriteString(strconv.FormatUint(v, 10))
		case float32:
			str := strconv.FormatFloat(float64(v), 'f', -1, 32)
			if str == "-0" {
				str = "0"
			}
			_, err = hash.WriteString(str)
		case float64:
			str := strconv.FormatFloat(v, 'f', -1, 64)
			if str == "-0" {
				str = "0"
			}
			_, err = hash.WriteString(str)
		case string:
			_, err = hash.WriteString(v)
		case []byte:
			_, err = hash.Write(v)
		default:
			_, err = hash.WriteString(fmt.Sprintf("%v", v))
		}
		if err != nil {
			return 0, err
		}
	}
	return hash.Sum64(), nil
}

// HashOfSimple returns a hash for a single interface value
func HashOfSimple(ctx *sql.Context, i any, t sql.Type) (uint64, sql.ConvertInRange, error) {
	if i == nil {
		return 0, sql.InRange, nil
	}

	var str string
	var inRange sql.ConvertInRange
	coll := sql.Collation_Default
	if types.IsTuple(t) {
		tup := i.([]any)
		tupType := t.(types.TupleType)
		hashes := make([]uint64, len(tup))
		for idx, v := range tup {
			// TODO: handle out of range conversions here?
			h, _, err := HashOfSimple(ctx, v, tupType[idx])
			if err != nil {
				return 0, sql.InRange, err
			}
			hashes[idx] = h
		}
		str = fmt.Sprintf("%v", hashes)
	} else if types.IsTextOnly(t) {
		coll = t.(sql.StringType).Collation()
		if s, ok := i.(string); ok {
			str = s
		} else {
			converted, _, err := types.ConvertOrTruncate(ctx, i, t)
			if err != nil {
				return 0, sql.InRange, err
			}
			str, _, err = sql.Unwrap[string](ctx, converted)
			if err != nil {
				return 0, sql.InRange, err
			}
		}
	} else {
		var val any
		var err error
		val, inRange, err = types.ConvertOrTruncate(ctx, i, t.Promote())
		if err != nil {
			return 0, sql.InRange, err
		}

		// Remove trailing 0s from floats
		switch v := val.(type) {
		case float32:
			str = strconv.FormatFloat(float64(v), 'f', -1, 32)
			if str == "-0" {
				str = "0"
			}
		case float64:
			str = strconv.FormatFloat(v, 'f', -1, 64)
			if str == "-0" {
				str = "0"
			}
		default:
			str = fmt.Sprintf("%v", v)
		}
	}

	// Collated strings that are equivalent may have different runes, so we must make them hash to the same value
	h, err := coll.HashToUint(str)
	if err != nil {
		return 0, sql.InRange, err
	}
	return h, inRange, nil
}
