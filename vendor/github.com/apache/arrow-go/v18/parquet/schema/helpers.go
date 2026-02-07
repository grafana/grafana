// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package schema

import (
	"github.com/apache/arrow-go/v18/parquet"
	"golang.org/x/xerrors"
)

// ListOf is a convenience helper function to create a properly structured
// list structure according to the Parquet Spec.
//
//	<list-repetition> group <name> (LIST) {
//	  repeated group list {
//	    <element-repetition> <element-type> element;
//	  }
//	}
//
// <list-repetition> can only be optional or required.
// <element-repetition> can only be optional or required.
func ListOf(n Node, rep parquet.Repetition, fieldID int32) (*GroupNode, error) {
	return ListOfWithName(n.Name(), n, rep, fieldID)
}

// ListOf is a convenience helper function to create a properly structured
// list structure according to the Parquet Spec.
//
//	<list-repetition> group <name> (LIST) {
//	  repeated group list {
//	    <element-repetition> <element-type> element;
//	  }
//	}
//
// <list-repetition> can only be optional or required.
// <element-repetition> can only be optional or required.
func ListOfWithName(listName string, element Node, rep parquet.Repetition, fieldID int32) (*GroupNode, error) {
	if rep == parquet.Repetitions.Repeated {
		return nil, xerrors.Errorf("parquet: listof repetition must not be repeated, got :%s", rep)
	}

	if element.RepetitionType() == parquet.Repetitions.Repeated {
		return nil, xerrors.Errorf("parquet: element repetition must not be repeated, got: %s", element.RepetitionType())
	}

	switch n := element.(type) {
	case *PrimitiveNode:
		n.name = "element"
	case *GroupNode:
		n.name = "element"
	}

	list, err := NewGroupNode("list" /* name */, parquet.Repetitions.Repeated, FieldList{element}, -1 /* fieldID */)
	if err != nil {
		return nil, err
	}

	return NewGroupNodeLogical(listName, rep, FieldList{list}, ListLogicalType{}, fieldID)
}

// MapOf is a convenience helper function to create a properly structured
// parquet map node setup according to the Parquet Spec.
//
//	<map-repetition> group <name> (MAP) {
//		 repeated group key_value {
//		   required <key-type> key;
//	    <value-repetition> <value-type> value;
//	  }
//	}
//
// key node will be renamed to "key", value node if not nil will be renamed to "value"
//
// <map-repetition> must be only optional or required. panics if repeated is passed.
//
// the key node *must* be required repetition. panics if optional or repeated
//
// value node can be nil (omitted) or have a repetition of required or optional *only*.
func MapOf(name string, key Node, value Node, mapRep parquet.Repetition, fieldID int32) (*GroupNode, error) {
	if mapRep == parquet.Repetitions.Repeated {
		return nil, xerrors.Errorf("parquet: map repetition cannot be Repeated, got: %s", mapRep)
	}

	if key.RepetitionType() != parquet.Repetitions.Required {
		return nil, xerrors.Errorf("parquet: map key repetition must be Required, got: %s", key.RepetitionType())
	}

	if value != nil {
		if value.RepetitionType() == parquet.Repetitions.Repeated {
			return nil, xerrors.New("parquet: map value cannot have repetition Repeated")
		}
		switch value := value.(type) {
		case *PrimitiveNode:
			value.name = "value"
		case *GroupNode:
			value.name = "value"
		}
	}

	switch key := key.(type) {
	case *PrimitiveNode:
		key.name = "key"
	case *GroupNode:
		key.name = "key"
	}

	keyval := FieldList{key}
	if value != nil {
		keyval = append(keyval, value)
	}

	kvNode, err := NewGroupNode("key_value" /* name */, parquet.Repetitions.Repeated, keyval, -1 /* fieldID */)
	if err != nil {
		return nil, err
	}
	return NewGroupNodeLogical(name, mapRep, FieldList{kvNode}, MapLogicalType{}, fieldID)
}
