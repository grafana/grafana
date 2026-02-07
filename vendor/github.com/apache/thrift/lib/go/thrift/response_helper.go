/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package thrift

import (
	"context"
)

// See https://godoc.org/context#WithValue on why do we need the unexported typedefs.
type responseHelperKey struct{}

// TResponseHelper defines a object with a set of helper functions that can be
// retrieved from the context object passed into server handler functions.
//
// Use GetResponseHelper to retrieve the injected TResponseHelper implementation
// from the context object.
//
// The zero value of TResponseHelper is valid with all helper functions being
// no-op.
type TResponseHelper struct {
	// THeader related functions
	*THeaderResponseHelper
}

// THeaderResponseHelper defines THeader related TResponseHelper functions.
//
// The zero value of *THeaderResponseHelper is valid with all helper functions
// being no-op.
type THeaderResponseHelper struct {
	proto *THeaderProtocol
}

// NewTHeaderResponseHelper creates a new THeaderResponseHelper from the
// underlying TProtocol.
func NewTHeaderResponseHelper(proto TProtocol) *THeaderResponseHelper {
	if hp, ok := proto.(*THeaderProtocol); ok {
		return &THeaderResponseHelper{
			proto: hp,
		}
	}
	return nil
}

// SetHeader sets a response header.
//
// It's no-op if the underlying protocol/transport does not support THeader.
func (h *THeaderResponseHelper) SetHeader(key, value string) {
	if h != nil && h.proto != nil {
		h.proto.SetWriteHeader(key, value)
	}
}

// ClearHeaders clears all the response headers previously set.
//
// It's no-op if the underlying protocol/transport does not support THeader.
func (h *THeaderResponseHelper) ClearHeaders() {
	if h != nil && h.proto != nil {
		h.proto.ClearWriteHeaders()
	}
}

// GetResponseHelper retrieves the TResponseHelper implementation injected into
// the context object.
//
// If no helper was found in the context object, a nop helper with ok == false
// will be returned.
func GetResponseHelper(ctx context.Context) (helper TResponseHelper, ok bool) {
	if v := ctx.Value(responseHelperKey{}); v != nil {
		helper, ok = v.(TResponseHelper)
	}
	return
}

// SetResponseHelper injects TResponseHelper into the context object.
func SetResponseHelper(ctx context.Context, helper TResponseHelper) context.Context {
	return context.WithValue(ctx, responseHelperKey{}, helper)
}
