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

// Package textproto converts text protobuffer files to and from CUE.
//
// Note that textproto is an unofficial standard and that there are no
// specifications: the recommended packages are the de facto standard for the
// relevant programming languages and the recommended implementations may vary
// considerably between them.
//
// Also, the standard text proto parsing libraries are rather buggy. Please
// verify that a parsing issues is not related these libraries before filing
// bugs with CUE.
//
// API Status: DRAFT: API may change without notice.
package textproto
