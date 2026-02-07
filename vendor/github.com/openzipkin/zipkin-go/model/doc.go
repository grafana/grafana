// Copyright 2022 The OpenZipkin Authors
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

/*
Package model contains the Zipkin V2 model which is used by the Zipkin Go
tracer implementation.

Third party instrumentation libraries can use the model and transport packages
found in this Zipkin Go library to directly interface with the Zipkin Server or
Zipkin Collectors without the need to use the tracer implementation itself.
*/
package model
