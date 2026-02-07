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

package extensions

import (
	"encoding/json"
	"fmt"
	"reflect"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
)

// OpaqueType is a placeholder for a type from an external (usually
// non-Arrow) system that could not be interpreted.
type OpaqueType struct {
	arrow.ExtensionBase `json:"-"`

	TypeName   string `json:"type_name"`
	VendorName string `json:"vendor_name"`
}

// NewOpaqueType creates a new OpaqueType with the provided storage type, type name, and vendor name.
func NewOpaqueType(storageType arrow.DataType, name, vendorName string) *OpaqueType {
	return &OpaqueType{ExtensionBase: arrow.ExtensionBase{Storage: storageType},
		TypeName: name, VendorName: vendorName}
}

func (*OpaqueType) ArrayType() reflect.Type {
	return reflect.TypeOf(OpaqueArray{})
}

func (*OpaqueType) ExtensionName() string {
	return "arrow.opaque"
}

func (o *OpaqueType) String() string {
	return fmt.Sprintf("extension<%s[storage_type=%s, type_name=%s, vendor_name=%s]>",
		o.ExtensionName(), o.Storage, o.TypeName, o.VendorName)
}

func (o *OpaqueType) Serialize() string {
	data, _ := json.Marshal(o)
	return string(data)
}

func (*OpaqueType) Deserialize(storageType arrow.DataType, data string) (arrow.ExtensionType, error) {
	var out OpaqueType
	err := json.Unmarshal(unsafe.Slice(unsafe.StringData(data), len(data)), &out)
	if err != nil {
		return nil, err
	}

	switch {
	case out.TypeName == "":
		return nil, fmt.Errorf("%w: serialized JSON data for OpaqueType missing type_name",
			arrow.ErrInvalid)
	case out.VendorName == "":
		return nil, fmt.Errorf("%w: serialized JSON data for OpaqueType missing vendor_name",
			arrow.ErrInvalid)
	}

	out.ExtensionBase = arrow.ExtensionBase{Storage: storageType}
	return &out, nil
}

func (o *OpaqueType) ExtensionEquals(other arrow.ExtensionType) bool {
	if o.ExtensionName() != other.ExtensionName() {
		return false
	}

	rhs, ok := other.(*OpaqueType)
	if !ok {
		return false
	}

	return arrow.TypeEqual(o.Storage, rhs.Storage) &&
		o.TypeName == rhs.TypeName &&
		o.VendorName == rhs.VendorName
}

// OpaqueArray is a placeholder for data from an external (usually
// non-Arrow) system that could not be interpreted.
type OpaqueArray struct {
	array.ExtensionArrayBase
}

var (
	_ arrow.ExtensionType  = (*OpaqueType)(nil)
	_ array.ExtensionArray = (*OpaqueArray)(nil)
)
