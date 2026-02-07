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
	vtrpcpb "github.com/dolthub/vitess/go/vt/proto/vtrpc"
)

// This file contains the necessary methods to send and receive errors
// as payloads of proto3 structures. It converts vtError to and from
// *vtrpcpb.RPCError. Use these methods when a RPC call can return both
// data and an error.

// FromVTRPC recovers a vtError from a *vtrpcpb.RPCError (which is how vtError
// is transmitted across proto3 RPC boundaries).
func FromVTRPC(rpcErr *vtrpcpb.RPCError) error {
	if rpcErr == nil {
		return nil
	}
	code := rpcErr.Code
	if code == vtrpcpb.Code_OK {
		code = LegacyErrorCodeToCode(rpcErr.LegacyCode)
	}
	return New(code, rpcErr.Message)
}

// ToVTRPC converts from vtError to a vtrpcpb.RPCError.
func ToVTRPC(err error) *vtrpcpb.RPCError {
	if err == nil {
		return nil
	}
	code := Code(err)
	return &vtrpcpb.RPCError{
		LegacyCode: CodeToLegacyErrorCode(code),
		Code:       code,
		Message:    err.Error(),
	}
}
