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

namespace java thrift.test

struct Integer {
  1: i32 val
}

struct String {
  1: string val
}

struct Boolean {
  1: bool val
}

struct Double {
  1: double val
}

struct Long {
  1: i64 val
}

struct Byte {
  1: byte val
}

struct Float {
  1: double val
}

struct List {
  1: list<string> vals
}

struct ArrayList {
  1: list<string> vals
}

struct SortedMap {
  1: map<string, string> vals
}

struct TreeMap {
  1: map<string, string> vals
}

struct HashMap {
  1: map<string, String> vals
}

struct Map {
  1: map<double, Double> vals
}

struct Object {
  1: Integer integer,
  2: String str,
  3: Boolean boolean_field,
  4: Double dbl,
  5: Byte bite,
  6: map<i32, Integer> intmap,
  7: Map somemap,
}

exception Exception {
  1: string msg
}

service AsyncNonblockingService {
  Object mymethod(
    1: Integer integer,
    2: String str,
    3: Boolean boolean_field,
    4: Double dbl,
    5: Byte bite,
    6: map<i32, Integer> intmap,
    7: Map somemap,
  ) throws (1:Exception ex);
}
