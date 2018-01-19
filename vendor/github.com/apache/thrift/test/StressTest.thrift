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

namespace cpp test.stress
namespace d thrift.test.stress
namespace go stress

service Service {

  void echoVoid(),
  i8 echoByte(1: i8 arg),
  i32 echoI32(1: i32 arg),
  i64 echoI64(1: i64 arg),
  string echoString(1: string arg),
  list<i8>  echoList(1: list<i8> arg),
  set<i8>  echoSet(1: set<i8> arg),
  map<i8, i8>  echoMap(1: map<i8, i8> arg),
}

