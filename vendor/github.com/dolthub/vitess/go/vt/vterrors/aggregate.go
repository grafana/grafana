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

package vterrors

import (
	"sort"
	"strings"

	vtrpcpb "github.com/dolthub/vitess/go/vt/proto/vtrpc"
)

// A list of all vtrpcpb.Code, ordered by priority. These priorities are
// used when aggregating multiple errors in VtGate.
// Higher priority error codes are more urgent for users to see. They are
// prioritized based on the following question: assuming a scatter query produced multiple
// errors, which of the errors is the most likely to give the user useful information
// about why the query failed and how they should proceed?
const (
	// Informational errors.
	PriorityOK = iota
	PriorityCanceled
	PriorityAlreadyExists
	PriorityOutOfRange
	// Potentially retryable errors.
	PriorityUnavailable
	PriorityDeadlineExceeded
	PriorityAborted
	PriorityFailedPrecondition
	// Permanent errors.
	PriorityResourceExhausted
	PriorityUnknown
	PriorityUnauthenticated
	PriorityPermissionDenied
	PriorityInvalidArgument
	PriorityNotFound
	PriorityUnimplemented
	// Serious errors.
	PriorityInternal
	PriorityDataLoss
)

var errorPriorities = map[vtrpcpb.Code]int{
	vtrpcpb.Code_OK:                  PriorityOK,
	vtrpcpb.Code_CANCELED:            PriorityCanceled,
	vtrpcpb.Code_UNKNOWN:             PriorityUnknown,
	vtrpcpb.Code_INVALID_ARGUMENT:    PriorityInvalidArgument,
	vtrpcpb.Code_DEADLINE_EXCEEDED:   PriorityDeadlineExceeded,
	vtrpcpb.Code_NOT_FOUND:           PriorityNotFound,
	vtrpcpb.Code_ALREADY_EXISTS:      PriorityAlreadyExists,
	vtrpcpb.Code_PERMISSION_DENIED:   PriorityPermissionDenied,
	vtrpcpb.Code_UNAUTHENTICATED:     PriorityUnauthenticated,
	vtrpcpb.Code_RESOURCE_EXHAUSTED:  PriorityResourceExhausted,
	vtrpcpb.Code_FAILED_PRECONDITION: PriorityFailedPrecondition,
	vtrpcpb.Code_ABORTED:             PriorityAborted,
	vtrpcpb.Code_OUT_OF_RANGE:        PriorityOutOfRange,
	vtrpcpb.Code_UNIMPLEMENTED:       PriorityUnimplemented,
	vtrpcpb.Code_INTERNAL:            PriorityInternal,
	vtrpcpb.Code_UNAVAILABLE:         PriorityUnavailable,
	vtrpcpb.Code_DATA_LOSS:           PriorityDataLoss,
}

// Aggregate aggregates several errors into a single one.
// The resulting error code will be the one with the highest
// priority as defined by the priority constants in this package.
func Aggregate(errors []error) error {
	if len(errors) == 0 {
		return nil
	}
	return New(aggregateCodes(errors), aggregateErrors(errors))
}

func aggregateCodes(errors []error) vtrpcpb.Code {
	highCode := vtrpcpb.Code_OK
	for _, e := range errors {
		code := Code(e)
		if errorPriorities[code] > errorPriorities[highCode] {
			highCode = code
		}
	}
	return highCode
}

// ConcatenateErrors aggregates an array of errors into a single error by string concatenation.
func aggregateErrors(errs []error) string {
	errStrs := make([]string, 0, len(errs))
	for _, e := range errs {
		errStrs = append(errStrs, e.Error())
	}
	// sort the error strings so we always have deterministic ordering
	sort.Strings(errStrs)
	return strings.Join(errStrs, "\n")
}
