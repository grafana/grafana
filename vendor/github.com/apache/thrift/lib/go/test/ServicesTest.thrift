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

# We are only testing that generated code compiles, no correctness checking is done

exception moderate_disaster {
  1: i32 errorCode,
  2: string message
}

exception total_disaster {
  1: string message
  2: optional bool president_was_woken_up = false
}

struct struct_a {
  1: required i64 whatever
}

service a_serv {
    void voidfunc(),
    void void_with_1ex() throws(1: moderate_disaster err1)
    void void_with_2ex() throws(1: moderate_disaster err1, 2:total_disaster err2)

    string stringfunc()
    string stringfunc_1ex() throws(1: moderate_disaster err1)
    string stringfunc_2ex() throws(1: moderate_disaster err1, 2:total_disaster err2)

    i64 i64func()
    i64 i64func_1ex() throws(1: moderate_disaster err1)
    i64 i64func_2ex() throws(1: moderate_disaster err1, 2:total_disaster err2)

    list<string> list_of_strings_func()
    list<string> list_of_strings_func_1ex() throws(1: moderate_disaster err1)
    list<string> list_of_strings_func_2ex() throws(1: moderate_disaster err1, 2:total_disaster err2)

    map<i64,string> map_func()
    map<i64,string> map_func_1ex() throws(1: moderate_disaster err1)
    map<i64,string> map_func_2ex() throws(1: moderate_disaster err1, 2:total_disaster err2)

    struct_a struct_a_func()
    struct_a struct_a_func_1ex() throws(1: moderate_disaster err1)
    struct_a struct_a_func_2ex() throws(1: moderate_disaster err1, 2:total_disaster err2)

    void voidfunc_1int(1: i64 i),
    void void_with_1ex_1int(1: i64 i) throws(1: moderate_disaster err1)
    void void_with_2ex_1int(1: i64 i) throws(1: moderate_disaster err1, 2:total_disaster err2)

    string stringfunc_1int(1: i64 i)
    string stringfunc_1ex_1int(1: i64 i) throws(1: moderate_disaster err1)
    string stringfunc_2ex_1int(1: i64 i) throws(1: moderate_disaster err1, 2:total_disaster err2)

    i64 i64func_1int(1: i64 i)
    i64 i64func_1ex_1int(1: i64 i) throws(1: moderate_disaster err1)
    i64 i64func_2ex_1int(1: i64 i) throws(1: moderate_disaster err1, 2:total_disaster err2)

    list<string> list_of_strings_func_1int(1: i64 i)
    list<string> list_of_strings_func_1ex_1int(1: i64 i) throws(1: moderate_disaster err1)
    list<string> list_of_strings_func_2ex_1int(1: i64 i) throws(1: moderate_disaster err1, 2:total_disaster err2)

    map<i64,string> map_func_1int(1: i64 i)
    map<i64,string> map_func_1ex_1int(1: i64 i) throws(1: moderate_disaster err1)
    map<i64,string> map_func_2ex_1int(1: i64 i) throws(1: moderate_disaster err1, 2:total_disaster err2)

    struct_a struct_a_func_1int(1: i64 i)
    struct_a struct_a_func_1ex_1int(1: i64 i) throws(1: moderate_disaster err1)
    struct_a struct_a_func_2ex_1int(1: i64 i) throws(1: moderate_disaster err1, 2:total_disaster err2)

    void voidfunc_1int_1s(1: i64 i, 2: string s),
    void void_with_1ex_1int_1s(1: i64 i, 2: string s) throws(1: moderate_disaster err1)
    void void_with_2ex_1int_1s(1: i64 i, 2: string s) throws(1: moderate_disaster err1, 2:total_disaster err2)

    string stringfunc_1int_1s(1: i64 i, 2: string s)
    string stringfunc_1ex_1int_1s(1: i64 i, 2: string s) throws(1: moderate_disaster err1)
    string stringfunc_2ex_1int_1s(1: i64 i, 2: string s) throws(1: moderate_disaster err1, 2:total_disaster err2)

    i64 i64func_1int_1s(1: i64 i, 2: string s)
    i64 i64func_1ex_1int_1s(1: i64 i, 2: string s) throws(1: moderate_disaster err1)
    i64 i64func_2ex_1int_1s(1: i64 i, 2: string s) throws(1: moderate_disaster err1, 2:total_disaster err2)

    list<string> list_of_strings_func_1int_1s(1: i64 i, 2: string s)
    list<string> list_of_strings_func_1ex_1int_1s(1: i64 i, 2: string s) throws(1: moderate_disaster err1)
    list<string> list_of_strings_func_2ex_1int_1s(1: i64 i, 2: string s) throws(1: moderate_disaster err1, 2:total_disaster err2)

    map<i64,string> map_func_1int_1s(1: i64 i, 2: string s)
    map<i64,string> map_func_1ex_1int_1s(1: i64 i, 2: string s) throws(1: moderate_disaster err1)
    map<i64,string> map_func_2ex_1int_1s(1: i64 i, 2: string s) throws(1: moderate_disaster err1, 2:total_disaster err2)

    struct_a struct_a_func_1int_1s(1: i64 i, 2: string s)
    struct_a struct_a_func_1ex_1int_1s(1: i64 i, 2: string s) throws(1: moderate_disaster err1)
    struct_a struct_a_func_2ex_1int_1s(1: i64 i, 2: string s) throws(1: moderate_disaster err1, 2:total_disaster err2)

    struct_a struct_a_func_1struct_a(1: struct_a st)

}
