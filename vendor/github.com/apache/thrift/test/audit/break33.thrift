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

//break33 - derived1_function1 exception type changed.

namespace cpp test

//Constants
const i32 const1 = 123;
const double const2 = 23.3;
const map<string,string> const3 = {"hello":"world", "thrift":"audit"};


//Exception
exception test_exception1 {
    1: i32 code;
    2: string json;
}
exception test_exception2 {
    1: i32 code;
    2: string json;
}

//Enums

enum test_enum1 {
    enum1_value0 = 0,
    enum1_value1 = 1,
    enum1_value2 = 2,
    enum1_value5 = 5,
    enum1_value7 = 7,
    enum1_value8 = 8
}

enum test_enum2 {
    enum2_value0 = 0,
    enum2_value1 = 1,
    enum2_value2 = 2,
    enum2_value3 = 3
}

enum test_enum3 {
    enum3_value1 = 0,
    enum3_value2 = 1
}

struct test_struct1 {
    1: i16 struct1_member1,
    2: i32 struct1_member2,
    3: i64 struct1_member3,
    4: double struct1_member4 = 2.5,
    5: string struct1_member5 = "Audit test",
    6: bool struct1_member6,
    7: byte struct1_member7,
    8: binary struct1_member8,
    9: test_enum1 struct1_member9
}

struct test_struct2 {
    1: list<i16> struct2_member1,
    2: list<i32> struct2_member2,
    3: list<i64> struct2_member3 = [23, 32 ],
    4: list<double> struct2_member4,
    5: list<string> struct2_member5,
    6: list<bool> struct2_member6,
    7: list<byte> struct2_member7,
    8: list<binary> struct2_member8,
    9: list<test_enum1> struct2_member9
}

struct test_struct3 {
    1: map<i16, i32> struct3_member1 = {1:2, 3:4},
    2: map<i64, double> struct3_member2 = {10:1.1, 20:2.1},
    3: map<string, bool> struct3_member3,
    4: map<byte, test_enum1> struct3_member4,
    5: map<test_enum2, test_enum3 > struct3_member5,
    7: map<double, string> struct3_member7
}

struct test_struct4 {
    1: i32 struct4_member1,
    2: optional i32 struct4_member2
}

struct test_struct5{
    1: double struct5_member1,
    2: string struct5_member2 = "Thrift Audit Test"
}
struct test_struct6 {
    1: i32 struct6_member1,
    2: required i32 struct6_member2
}

service base {
    oneway void base_oneway(
        1: i32 arg1),

    void base_function1(
        1: i16 function1_arg1,
        2: i32 function1_arg2,
        3: i64 function1_arg3,
        4: double function1_arg4,
        5: string function1_arg5,
        6: bool function1_arg6,
        7: test_enum1 function1_arg7,
        8: test_struct1 function1_arg8),

    void base_function2(
        1: list<i16> function2_arg1,
        2: list<i32> function2_arg2,
        3: list<i64> function2_arg3,
        4: list<double> function2_arg4,
        5: list<string> function2_arg5,
        6: list<bool> function2_arg6,
        7: list<byte> function2_arg7,
        8: list<test_enum1> function2_arg8,
        9: list<test_struct1> function2_arg9) throws (1:test_exception2 e),

    void base_function3(),

}

service derived1 extends base {
    
    test_enum1 derived1_function1(
        1: i64 function1_arg1,
        2: double function1_arg2,
        3: test_enum1 function1_arg3) throws (1:test_exception1 e),

    i64 derived1_function2(
        1: list<i64> function2_arg1,
        2: list<double> function2_arg2,
        3: list<string> function2_arg3,
        4: list<byte> function2_arg4,
        5: list<test_enum1> function2_arg5) throws (1:test_exception2 e),

    double derived1_function3(
        1: string function3_arg1,
        2: bool function3_arg2) throws (1:test_exception2 e),

    string derived1_function4(
        1: string function4_arg1,
        2: bool function4_arg2) throws (1:test_exception2 e),


    bool derived1_function5(
        1: map<i64, double> function5_arg1,
        2: map<string, bool> function5_arg2,
        3: map<test_enum1, test_enum2> function5_arg3) throws (1:test_exception2 e),

    test_struct1 derived1_function6(
        1: double function6_arg1) throws (1:test_exception2 e),
}

service derived2 extends base {

    list<i32> derived2_function1(
        1: i32 function1_arg1) throws (1:test_exception2 e),
    
    list<test_enum1> derived2_function2(
        1:i64 function2_arg2) throws (1:test_exception2 e),

    list<test_struct1> derived2_function3(
        1:double function3_arg1) throws(1:test_exception2 e),

    map<double, string> derived2_function4(
        1:string function4_arg1) throws(1:test_exception2 e),

    map<test_enum1, test_enum2> derived2_function5(
        1:bool function5_arg1) throws(1:test_exception2 e),

    map<test_struct1, test_struct2> derived2_function6(
        1:bool function6_arg1) throws(1:test_exception2 e),
    
}
