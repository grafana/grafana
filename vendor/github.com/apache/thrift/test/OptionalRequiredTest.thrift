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
 *
 * Contains some contributions under the Thrift Software License.
 * Please see doc/old-thrift-license.txt in the Thrift distribution for
 * details.
 */

namespace c_glib TTest
namespace cpp thrift.test
namespace java thrift.test

struct OldSchool {
  1: i16    im_int;
  2: string im_str;
  3: list<map<i32,string>> im_big;
}

struct Simple {
  1: /* :) */ i16 im_default;
  2: required i16 im_required;
  3: optional i16 im_optional;
}

struct Tricky1 {
  1: /* :) */ i16 im_default;
}

struct Tricky2 {
  1: optional i16 im_optional;
}

struct Tricky3 {
  1: required i16 im_required;
}

struct OptionalDefault {
  1: optional i16 opt_int = 1234;
  2: optional string opt_str = "default";
}

struct Complex {
  1:          i16 cp_default;
  2: required i16 cp_required;
  3: optional i16 cp_optional;
  4:          map<i16,Simple> the_map;
  5: required Simple req_simp;
  6: optional Simple opt_simp;
}

struct ManyOpt {
  1: optional i32 opt1;
  2: optional i32 opt2;
  3: optional i32 opt3;
  4:          i32 def4;
  5: optional i32 opt5;
  6: optional i32 opt6;
}

struct JavaTestHelper {
  1: required i32    req_int;
  2: optional i32    opt_int;
  3: required string req_obj;
  4: optional string opt_obj;
  5: required binary req_bin;
  6: optional binary opt_bin;
}

struct Binaries {
  4: binary bin;
  5: required binary req_bin;
  6: optional binary opt_bin;
}
