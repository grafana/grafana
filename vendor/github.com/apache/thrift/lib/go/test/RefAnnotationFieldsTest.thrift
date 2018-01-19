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

struct all_referenced {
 1: optional string s = "DEFAULT" (cpp.ref = ""),
 2: optional i64 i = 42 (cpp.ref = ""),
 3: optional bool b = false (cpp.ref = ""),
 4: optional string s2 (cpp.ref = ""),
 5: optional i64 i2 (cpp.ref = ""),
 6: optional bool b2 (cpp.ref = ""),
 7: optional structA aa (cpp.ref = ""),
 9: optional list<i64> l (cpp.ref = ""),
 10: optional list<i64> l2 = [1, 2] (cpp.ref = ""),
 11: optional map<i64, i64> m (cpp.ref = ""),
 12: optional map<i64, i64> m2 = {1:2, 3:4} (cpp.ref = ""),
 13: optional binary bin (cpp.ref = ""),
 14: optional binary bin2 = "asdf" (cpp.ref = ""),

 15: required string ref_s = "DEFAULT" (cpp.ref = ""),
 16: required i64 ref_i = 42 (cpp.ref = ""),
 17: required bool ref_b = false (cpp.ref = ""),
 18: required string ref_s2 (cpp.ref = ""),
 19: required i64 ref_i2 (cpp.ref = ""),
 20: required bool ref_b2 (cpp.ref = ""),
 21: required structA ref_aa (cpp.ref = ""),
 22: required list<i64> ref_l (cpp.ref = ""),
 23: required list<i64> ref_l2 = [1, 2] (cpp.ref = ""),
 24: required map<i64, i64> ref_m (cpp.ref = ""),
 25: required map<i64, i64> ref_m2 = {1:2, 3:4} (cpp.ref = ""),
 26: required binary ref_bin (cpp.ref = ""),
 27: required binary ref_bin2 = "asdf" (cpp.ref = ""),

}

struct structB {
 1: required structA required_struct_thing
 2: optional structA optional_struct_thing
}
