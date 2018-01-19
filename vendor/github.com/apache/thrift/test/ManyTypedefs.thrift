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

// This is to make sure you don't mess something up when you change typedef code.
// Generate it with the old and new thrift and make sure they are the same.
/*
rm -rf gen-* orig-*
mkdir old new
thrift --gen cpp --gen java --gen php --gen phpi --gen py --gen rb --gen xsd --gen perl --gen ocaml --gen erl --gen hs --strict ManyTypedefs.thrift
mv gen-* old
../compiler/cpp/thrift --gen cpp --gen java --gen php --gen phpi --gen py --gen rb --gen xsd --gen perl --gen ocaml --gen erl --gen hs --strict ManyTypedefs.thrift
mv gen-* new
diff -ur old new
rm -rf old new
# There should be no output.
*/

typedef i32 int32
typedef list<map<int32, string>> biglist

struct struct1 {
  1: int32 myint;
  2: biglist mylist;
}

exception exception1 {
  1: biglist alist;
  2: struct1 mystruct;
}

service AService {
  struct1 method1(1: int32 myint) throws (1: exception1 exn);
  biglist method2();
}
