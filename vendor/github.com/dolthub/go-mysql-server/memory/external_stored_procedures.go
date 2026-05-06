// Copyright 2022 Dolthub, Inc.
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

package memory

import (
	"fmt"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var (
	externalSPSchemaInt = sql.Schema{&sql.Column{
		Name: "a",
		Type: types.Int64,
	}}
	externalSPSchemaUint = sql.Schema{&sql.Column{
		Name: "a",
		Type: types.Uint64,
	}}
	externalSPSchemaText = sql.Schema{&sql.Column{
		Name: "a",
		Type: types.LongText,
	}}
	ExternalStoredProcedures = []sql.ExternalStoredProcedureDetails{
		{
			Name:     "memory_inout_add",
			Schema:   nil,
			Function: inout_add,
		},
		{
			Name:     "memory_inout_set_unitialized",
			Schema:   nil,
			Function: inout_set_unitialized,
		},
		{
			Name:     "memory_overloaded_mult",
			Schema:   externalSPSchemaInt,
			Function: overloaded_mult1,
		},
		{
			Name:     "memory_overloaded_mult",
			Schema:   externalSPSchemaInt,
			Function: overloaded_mult2,
		},
		{
			Name:     "memory_overloaded_mult",
			Schema:   externalSPSchemaInt,
			Function: overloaded_mult3,
		},
		{
			Name:     "memory_overloaded_type_test",
			Schema:   externalSPSchemaInt,
			Function: overloaded_type_test1,
		},
		{
			Name:     "memory_overloaded_type_test",
			Schema:   externalSPSchemaText,
			Function: overloaded_type_test2,
		},
		{
			Name:     "memory_type_test3",
			Schema:   externalSPSchemaUint,
			Function: type_test3,
		},
		{
			Name:     "memory_inout_bool_byte",
			Schema:   nil,
			Function: inout_bool_byte,
		},
		{
			Name:     "memory_error_table_not_found",
			Schema:   nil,
			Function: error_table_not_found,
		},
		{
			Name:     "memory_variadic_add",
			Schema:   externalSPSchemaInt,
			Function: variadic_add,
		},
		{
			Name:     "memory_variadic_byte_slice",
			Schema:   externalSPSchemaText,
			Function: variadic_byte_slice,
		},
		{
			Name:     "memory_variadic_overload",
			Schema:   externalSPSchemaText,
			Function: variadic_overload1,
		},
		{
			Name:     "memory_variadic_overload",
			Schema:   externalSPSchemaText,
			Function: variadic_overload2,
		},
		{
			Name:     "memory_inout_add_readonly",
			Schema:   externalSPSchemaInt,
			Function: variadic_add,
			ReadOnly: true,
		},
		{
			Name:     "memory_inout_add_readwrite",
			Schema:   externalSPSchemaInt,
			Function: variadic_add,
			ReadOnly: false,
		},
		{
			Name:      "memory_admin_only",
			Schema:    externalSPSchemaInt,
			Function:  variadic_add,
			ReadOnly:  false,
			AdminOnly: true,
		},
	}
)

func inout_add(_ *sql.Context, a *int64, b int64) (sql.RowIter, error) {
	*a = *a + b
	return sql.RowsToRowIter(), nil
}

func inout_set_unitialized(_ *sql.Context, a *int, b *uint, c *string, d *int) (sql.RowIter, error) {
	*a = 5
	*b = 5
	*c = "5"
	// We intentionally do not set `d` to verify that it is given the zero value
	return nil, nil
}

func overloaded_mult1(_ *sql.Context, a int8) (sql.RowIter, error) {
	return sql.RowsToRowIter(sql.Row{int64(a)}), nil
}
func overloaded_mult2(_ *sql.Context, a int16, b int32) (sql.RowIter, error) {
	return sql.RowsToRowIter(sql.Row{int64(a) * int64(b)}), nil
}
func overloaded_mult3(_ *sql.Context, a int8, b int32, c int64) (sql.RowIter, error) {
	return sql.RowsToRowIter(sql.Row{int64(a) * int64(b) * c}), nil
}

func overloaded_type_test1(
	_ *sql.Context,
	aa int8, ab int16, ac int, ad int32, ae int64, af float32, ag float64,
	ba *int8, bb *int16, bc *int, bd *int32, be *int64, bf *float32, bg *float64,
) (sql.RowIter, error) {
	return sql.RowsToRowIter(sql.Row{
		int64(aa) + int64(ab) + int64(ac) + int64(ad) + int64(ae) + int64(af) + int64(ag) +
			int64(*ba) + int64(*bb) + int64(*bc) + int64(*bd) + int64(*be) + int64(*bf) + int64(*bg),
	}), nil
}
func overloaded_type_test2(
	_ *sql.Context,
	aa bool, ab string, ac []byte, ad time.Time, ae decimal.Decimal,
	ba *bool, bb *string, bc *[]byte, bd *time.Time, be *decimal.Decimal,
) (sql.RowIter, error) {
	return sql.RowsToRowIter(sql.Row{
		fmt.Sprintf(`aa:%v,ba:%v,ab:"%s",bb:"%s",ac:%v,bc:%v,ad:%s,bd:%s,ae:%s,be:%s`,
			aa, *ba, ab, *bb, ac, *bc, ad.Format("2006-01-02"), (*bd).Format("2006-01-02"), ae.String(), (*be).String()),
	}), nil
}

func type_test3(
	_ *sql.Context,
	aa uint8, ab uint16, ac uint, ad uint32, ae uint64, af float32, ag float64,
	ba *uint8, bb *uint16, bc *uint, bd *uint32, be *uint64, bf *float32, bg *float64,
) (sql.RowIter, error) {
	return sql.RowsToRowIter(sql.Row{
		uint64(aa) + uint64(ab) + uint64(ac) + uint64(ad) + uint64(ae) + uint64(af) + uint64(ag) +
			uint64(*ba) + uint64(*bb) + uint64(*bc) + uint64(*bd) + uint64(*be) + uint64(*bf) + uint64(*bg),
	}), nil
}

func inout_bool_byte(_ *sql.Context, a bool, b *bool, c []byte, d *[]byte) (sql.RowIter, error) {
	a = !a
	*b = !*b
	for i := range c {
		c[i] = c[i] + 1
	}
	for i := range *d {
		(*d)[i] = (*d)[i] + 1
	}
	return nil, nil
}

func error_table_not_found(_ *sql.Context) (sql.RowIter, error) {
	return nil, sql.ErrTableNotFound.New("non_existent_table")
}

func variadic_add(_ *sql.Context, vals ...int) (sql.RowIter, error) {
	sum := int64(0)
	for _, val := range vals {
		sum += int64(val)
	}
	return sql.RowsToRowIter(sql.Row{sum}), nil
}

func variadic_byte_slice(_ *sql.Context, vals ...[]byte) (sql.RowIter, error) {
	sb := strings.Builder{}
	for _, val := range vals {
		sb.Write(val)
	}
	return sql.RowsToRowIter(sql.Row{sb.String()}), nil
}

func variadic_overload1(_ *sql.Context, a string, b string) (sql.RowIter, error) {
	return sql.RowsToRowIter(sql.Row{fmt.Sprintf("%s-%s", a, b)}), nil
}

func variadic_overload2(_ *sql.Context, a string, b string, vals ...uint8) (sql.RowIter, error) {
	return sql.RowsToRowIter(sql.Row{fmt.Sprintf("%s,%s,%v", a, b, vals)}), nil
}
