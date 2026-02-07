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

package encryption

import (
	"encoding/binary"
	"fmt"
	"unsafe"
)

// StringKeyIDRetriever implements the KeyRetriever interface GetKey
// to allow setting in keys with a string id.
type StringKeyIDRetriever map[string]string

// PutKey adds a key with the given string ID that can be retrieved
func (s StringKeyIDRetriever) PutKey(keyID, key string) {
	s[keyID] = key
}

// GetKey expects the keymetadata to match one of the keys that were added
// with PutKey and panics if the key cannot be found.
func (s StringKeyIDRetriever) GetKey(keyMetadata []byte) string {
	k, ok := s[*(*string)(unsafe.Pointer(&keyMetadata))]
	if !ok {
		panic(fmt.Errorf("parquet: key missing for id %s", keyMetadata))
	}
	return k
}

// IntegerKeyIDRetriever is used for using unsigned 32bit integers as key ids.
type IntegerKeyIDRetriever map[uint32]string

// PutKey adds keys with uint32 IDs
func (i IntegerKeyIDRetriever) PutKey(keyID uint32, key string) {
	i[keyID] = key
}

// GetKey expects the key metadata bytes to be a little endian uint32 which
// is then used to retrieve the key bytes. Panics if the key id cannot be found.
func (i IntegerKeyIDRetriever) GetKey(keyMetadata []byte) string {
	keyID := binary.LittleEndian.Uint32(keyMetadata)
	k, ok := i[keyID]
	if !ok {
		panic(fmt.Errorf("parquet: key missing for id %d", keyID))
	}
	return k
}
