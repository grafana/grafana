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

/*
Package debug provides APIs for conditional runtime assertions and debug logging.


Using Assert

To enable runtime assertions, build with the assert tag. When the assert tag is omitted,
the code for the assertion will be omitted from the binary.


Using Log

To enable runtime debug logs, build with the debug tag. When the debug tag is omitted,
the code for logging will be omitted from the binary.
*/
package debug
