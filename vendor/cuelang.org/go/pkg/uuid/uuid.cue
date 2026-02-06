// Copyright 2021 CUE Authors
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

package uuid

// Predefined namespaces
ns: {
	DNS:  "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
	URL:  "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
	OID:  "6ba7b812-9dad-11d1-80b4-00c04fd430c8"
	X500: "6ba7b814-9dad-11d1-80b4-00c04fd430c8"
	Nil:  "00000000-0000-0000-0000-000000000000"
}

// Invalid UUID
variants: Invalid: 0
// The variant specified in RFC4122
variants: RFC4122: 1
// Reserved, NCS backward compatibility.
variants: Reserved: 2
// Reserved, Microsoft Corporation backward compatibility.
variants: Microsoft: 3
// Reserved for future definition.
variants: Future: 4
