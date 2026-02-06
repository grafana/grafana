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
	"encoding/json"
	"fmt"
	"strings"
)

// SlogTStructWrapper is a wrapper used by the compiler to wrap TStruct and
// TException to be better logged by slog.
type SlogTStructWrapper struct {
	Type  string  `json:"type"`
	Value TStruct `json:"value"`
}

var (
	_ fmt.Stringer   = SlogTStructWrapper{}
	_ json.Marshaler = SlogTStructWrapper{}
)

func (w SlogTStructWrapper) MarshalJSON() ([]byte, error) {
	// Use an alias to avoid infinite recursion
	type alias SlogTStructWrapper
	return json.Marshal(alias(w))
}

func (w SlogTStructWrapper) String() string {
	var sb strings.Builder
	sb.WriteString(w.Type)
	if err := json.NewEncoder(&sb).Encode(w.Value); err != nil {
		// Should not happen, but just in case
		return fmt.Sprintf("%s: %v", w.Type, w.Value)
	}
	// json encoder will write an additional \n at the end, get rid of it
	return strings.TrimSuffix(sb.String(), "\n")
}
