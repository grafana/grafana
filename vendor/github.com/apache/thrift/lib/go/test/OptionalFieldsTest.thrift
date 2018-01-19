#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#

struct structA {
 1: required i64 sa_i
}

struct all_optional {
 1: optional string s = "DEFAULT",
 2: optional i64 i = 42,
 3: optional bool b = false,
 4: optional string s2,
 5: optional i64 i2,
 6: optional bool b2,
 7: optional structA aa,
 9: optional list<i64> l,
 10: optional list<i64> l2 = [1, 2],
 11: optional map<i64, i64> m,
 12: optional map<i64, i64> m2 = {1:2, 3:4},
 13: optional binary bin,
 14: optional binary bin2 = "asdf",
}

struct structB {
 1: required structA required_struct_thing
 2: optional structA optional_struct_thing
}

struct structC {
 1: string s,
 2: required i32 i,
 3: optional bool b,
 4: required string s2,
}
