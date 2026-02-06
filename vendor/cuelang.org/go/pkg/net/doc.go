// Copyright 2019 CUE Authors
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

// Package net provides net-related type definitions.
//
// The IP-related definitions can be represented as either a string or a list of
// byte values. To allow one format over an other these types can be further
// constraint using string or [...]. For instance,
//
//	// multicast defines a multicast IP address in string form.
//	multicast: net.MulticastIP & string
//
//	// unicast defines a global unicast IP address in list form.
//	unicast: net.GlobalUnicastIP & [...]
package net
