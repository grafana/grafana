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

package sql

import (
	"math"
	"reflect"
	"strings"
)

// ExternalStoredProcedureRegistry manages a collection of ExternalStoredProcedures and encapsulates
// the logic for looking up external stored procedures based on name and number of arguments.
type ExternalStoredProcedureRegistry struct {
	procedures map[string]map[int]ExternalStoredProcedureDetails
}

// NewExternalStoredProcedureRegistry creates a new, empty instance of ExternalStoredProcedureRegistry.
func NewExternalStoredProcedureRegistry() ExternalStoredProcedureRegistry {
	return ExternalStoredProcedureRegistry{
		procedures: make(map[string]map[int]ExternalStoredProcedureDetails),
	}
}

// Register adds an external stored procedure to this registry.
func (epd *ExternalStoredProcedureRegistry) Register(procedureDetails ExternalStoredProcedureDetails) {
	numOfParams := epd.countNumberOfParams(procedureDetails)

	if _, ok := epd.procedures[procedureDetails.Name]; !ok {
		epd.procedures[procedureDetails.Name] = make(map[int]ExternalStoredProcedureDetails)
	}
	epd.procedures[procedureDetails.Name][numOfParams] = procedureDetails
}

// LookupByName returns all stored procedure variants registered with the specified name, no matter
// how many parameters they require. If no external stored procedures are registered with the specified
// name, nil is returned, with no error. If an unexpected error occurs, it is returned as the error
// parameter.
func (epd *ExternalStoredProcedureRegistry) LookupByName(name string) ([]ExternalStoredProcedureDetails, error) {
	procedureVariants, ok := epd.procedures[strings.ToLower(name)]
	if !ok {
		return nil, nil
	}

	procedures := make([]ExternalStoredProcedureDetails, 0, len(procedureVariants))
	for _, procedure := range procedureVariants {
		procedures = append(procedures, procedure)
	}
	return procedures, nil
}

// LookupByNameAndParamCount returns the external stored procedure registered with the specified name
// and able to accept the specified number of parameters. If no external stored procedures are
// registered with the specified name and able to accept the specified number of parameters, nil
// is returned with no error. If an unexpected error occurs, it is returned as the error param.
func (epd *ExternalStoredProcedureRegistry) LookupByNameAndParamCount(name string, numOfParams int) (*ExternalStoredProcedureDetails, error) {
	procedureVariants, ok := epd.procedures[strings.ToLower(name)]
	if !ok {
		return nil, nil
	}

	// If we find an exact match on param count, return that stored procedure
	procedure, ok := procedureVariants[numOfParams]
	if ok {
		return &procedure, nil
	}

	// Otherwise, find the largest param length and return that stored procedure
	var largestParamLen int
	var largestParamProc ExternalStoredProcedureDetails
	for paramLen, procedure := range procedureVariants {
		if largestParamLen < paramLen {
			largestParamProc = procedure
			largestParamLen = paramLen
		}
	}
	return &largestParamProc, nil
}

// countNumberOfParams returns the number of parameters accepted by the specified external stored
// procedure, including allowing variadic return types to expand to accept at most MaxInt parameters.
func (epd *ExternalStoredProcedureRegistry) countNumberOfParams(externalProcedure ExternalStoredProcedureDetails) int {
	funcVal := reflect.ValueOf(externalProcedure.Function)
	funcType := funcVal.Type()

	// Return MaxInt for variadic types, since they can accommodate any number of params
	if funcVal.Type().IsVariadic() {
		return math.MaxInt
	}

	// We subtract one because ctx is required to always be the first parameter to a function, but
	// customers won't actually pass that in to the stored procedure.
	return funcType.NumIn() - 1
}
