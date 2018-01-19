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

package org.apache.thrift.protocol;

@:enum
abstract TType(Int)  from Int to Int  {
    public static inline var STOP : Int   = 0;
    public static inline var VOID : Int   = 1;
    public static inline var BOOL : Int   = 2;
    public static inline var BYTE : Int   = 3;
    public static inline var DOUBLE : Int = 4;
    public static inline var I16 : Int    = 6;
    public static inline var I32 : Int    = 8;
    public static inline var I64 : Int    = 10;
    public static inline var STRING : Int = 11;
    public static inline var STRUCT : Int = 12;
    public static inline var MAP : Int    = 13;
    public static inline var SET : Int    = 14;
    public static inline var LIST : Int   = 15;
}
