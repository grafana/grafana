/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package sqltypes

import (
	"encoding/json"

	querypb "github.com/dolthub/vitess/go/vt/proto/query"
	vtrpcpb "github.com/dolthub/vitess/go/vt/proto/vtrpc"
	"github.com/dolthub/vitess/go/vt/vterrors"
)

// PlanValue represents a value or a list of values for
// a column that will later be resolved using bind vars and used
// to perform plan actions like generating the final query or
// deciding on a route.
//
// Plan values are typically used as a slice ([]planValue)
// where each entry is for one column. For situations where
// the required output is a list of rows (like in the case
// of multi-value inserts), the representation is pivoted.
// For example, a statement like this:
// 	INSERT INTO t VALUES (1, 2), (3, 4)
// will be represented as follows:
// 	[]PlanValue{
// 		Values: {1, 3},
// 		Values: {2, 4},
// 	}
//
// For WHERE clause items that contain a combination of
// equality expressions and IN clauses like this:
//   WHERE pk1 = 1 AND pk2 IN (2, 3, 4)
// The plan values will be represented as follows:
// 	[]PlanValue{
// 		Value: 1,
// 		Values: {2, 3, 4},
// 	}
// When converted into rows, columns with single values
// are replicated as the same for all rows:
// 	[][]Value{
// 		{1, 2},
// 		{1, 3},
// 		{1, 4},
// 	}
type PlanValue struct {
	Key     string
	Value   Value
	ListKey string
	Values  []PlanValue
}

// IsNull returns true if the PlanValue is NULL.
func (pv PlanValue) IsNull() bool {
	return pv.Key == "" && pv.Value.IsNull() && pv.ListKey == "" && pv.Values == nil
}

// IsList returns true if the PlanValue is a list.
func (pv PlanValue) IsList() bool {
	return pv.ListKey != "" || pv.Values != nil
}

// ResolveValue resolves a PlanValue as a single value based on the supplied bindvars.
func (pv PlanValue) ResolveValue(bindVars map[string]*querypb.BindVariable) (Value, error) {
	switch {
	case pv.Key != "":
		bv, err := pv.lookupValue(bindVars)
		if err != nil {
			return NULL, err
		}
		return MakeTrusted(bv.Type, bv.Value), nil
	case !pv.Value.IsNull():
		return pv.Value, nil
	case pv.ListKey != "" || pv.Values != nil:
		// This code is unreachable because the parser does not allow
		// multi-value constructs where a single value is expected.
		return NULL, vterrors.New(vtrpcpb.Code_INVALID_ARGUMENT, "a list was supplied where a single value was expected")
	}
	return NULL, nil
}

func (pv PlanValue) lookupValue(bindVars map[string]*querypb.BindVariable) (*querypb.BindVariable, error) {
	bv, ok := bindVars[pv.Key]
	if !ok {
		return nil, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "missing bind var %s", pv.Key)
	}
	if bv.Type == querypb.Type_TUPLE {
		return nil, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "TUPLE was supplied for single value bind var %s", pv.ListKey)
	}
	return bv, nil
}

// ResolveList resolves a PlanValue as a list of values based on the supplied bindvars.
func (pv PlanValue) ResolveList(bindVars map[string]*querypb.BindVariable) ([]Value, error) {
	switch {
	case pv.ListKey != "":
		bv, err := pv.lookupList(bindVars)
		if err != nil {
			return nil, err
		}
		values := make([]Value, 0, len(bv.Values))
		for _, val := range bv.Values {
			values = append(values, MakeTrusted(val.Type, val.Value))
		}
		return values, nil
	case pv.Values != nil:
		values := make([]Value, 0, len(pv.Values))
		for _, val := range pv.Values {
			v, err := val.ResolveValue(bindVars)
			if err != nil {
				return nil, err
			}
			values = append(values, v)
		}
		return values, nil
	}
	// This code is unreachable because the parser does not allow
	// single value constructs where multiple values are expected.
	return nil, vterrors.New(vtrpcpb.Code_INVALID_ARGUMENT, "a single value was supplied where a list was expected")
}

func (pv PlanValue) lookupList(bindVars map[string]*querypb.BindVariable) (*querypb.BindVariable, error) {
	bv, ok := bindVars[pv.ListKey]
	if !ok {
		return nil, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "missing bind var %s", pv.ListKey)
	}
	if bv.Type != querypb.Type_TUPLE {
		return nil, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "single value was supplied for TUPLE bind var %s", pv.ListKey)
	}
	return bv, nil
}

// MarshalJSON should be used only for testing.
func (pv PlanValue) MarshalJSON() ([]byte, error) {
	switch {
	case pv.Key != "":
		return json.Marshal(":" + pv.Key)
	case !pv.Value.IsNull():
		if pv.Value.IsIntegral() {
			return pv.Value.ToBytes(), nil
		}
		return json.Marshal(pv.Value.ToString())
	case pv.ListKey != "":
		return json.Marshal("::" + pv.ListKey)
	case pv.Values != nil:
		return json.Marshal(pv.Values)
	}
	return []byte("null"), nil
}

func rowCount(pvs []PlanValue, bindVars map[string]*querypb.BindVariable) (int, error) {
	count := -1
	setCount := func(l int) error {
		switch count {
		case -1:
			count = l
			return nil
		case l:
			return nil
		default:
			return vterrors.New(vtrpcpb.Code_INVALID_ARGUMENT, "mismatch in number of column values")
		}
	}

	for _, pv := range pvs {
		switch {
		case pv.Key != "" || !pv.Value.IsNull():
			continue
		case pv.Values != nil:
			if err := setCount(len(pv.Values)); err != nil {
				return 0, err
			}
		case pv.ListKey != "":
			bv, err := pv.lookupList(bindVars)
			if err != nil {
				return 0, err
			}
			if err := setCount(len(bv.Values)); err != nil {
				return 0, err
			}
		}
	}

	if count == -1 {
		// If there were no lists inside, it was a single row.
		// Note that count can never be 0 because there is enough
		// protection at the top level: list bind vars must have
		// at least one value (enforced by vtgate), and AST lists
		// must have at least one value (enforced by the parser).
		// Also lists created internally after vtgate validation
		// ensure at least one value.
		// TODO(sougou): verify and change API to enforce this.
		return 1, nil
	}
	return count, nil
}

// ResolveRows resolves a []PlanValue as rows based on the supplied bindvars.
func ResolveRows(pvs []PlanValue, bindVars map[string]*querypb.BindVariable) ([][]Value, error) {
	count, err := rowCount(pvs, bindVars)
	if err != nil {
		return nil, err
	}

	// Allocate the rows.
	rows := make([][]Value, count)
	for i := range rows {
		rows[i] = make([]Value, len(pvs))
	}

	// Using j because we're resolving by columns.
	for j, pv := range pvs {
		switch {
		case pv.Key != "":
			bv, err := pv.lookupValue(bindVars)
			if err != nil {
				return nil, err
			}
			for i := range rows {
				rows[i][j] = MakeTrusted(bv.Type, bv.Value)
			}
		case !pv.Value.IsNull():
			for i := range rows {
				rows[i][j] = pv.Value
			}
		case pv.ListKey != "":
			bv, err := pv.lookupList(bindVars)
			if err != nil {
				// This code is unreachable because pvRowCount already checks this.
				return nil, err
			}
			for i := range rows {
				rows[i][j] = MakeTrusted(bv.Values[i].Type, bv.Values[i].Value)
			}
		case pv.Values != nil:
			for i := range rows {
				rows[i][j], err = pv.Values[i].ResolveValue(bindVars)
				if err != nil {
					return nil, err
				}
			}
			// default case is a NULL value, which the row values are already initialized to.
		}
	}
	return rows, nil
}
