//  Copyright (c) 2023 Couchbase, Inc.
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

//go:build !vectors
// +build !vectors

package mapping

func NewVectorFieldMapping() *FieldMapping {
	return nil
}

func NewVectorBase64FieldMapping() *FieldMapping {
	return nil
}

func (fm *FieldMapping) processVector(propertyMightBeVector interface{},
	pathString string, path []string, indexes []uint64, context *walkContext) bool {
	return false
}

func (fm *FieldMapping) processVectorBase64(propertyMightBeVector interface{},
	pathString string, path []string, indexes []uint64, context *walkContext) {

}

// -----------------------------------------------------------------------------
// document validation functions

func validateFieldMapping(field *FieldMapping, path []string,
	fieldAliasCtx map[string]*FieldMapping) error {
	return validateFieldType(field)
}
