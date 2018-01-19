/**
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

/**
 * All of the on-wire type codes.
 */
@:enum
abstract TCompactTypes(Int)  from Int to Int  {
    public static inline var STOP          = 0x00;
    public static inline var BOOLEAN_TRUE  = 0x01;
    public static inline var BOOLEAN_FALSE = 0x02;
    public static inline var BYTE          = 0x03;
    public static inline var I16           = 0x04;
    public static inline var I32           = 0x05;
    public static inline var I64           = 0x06;
    public static inline var DOUBLE        = 0x07;
    public static inline var BINARY        = 0x08;
    public static inline var LIST          = 0x09;
    public static inline var SET           = 0x0A;
    public static inline var MAP           = 0x0B;
    public static inline var STRUCT        = 0x0C;
}

