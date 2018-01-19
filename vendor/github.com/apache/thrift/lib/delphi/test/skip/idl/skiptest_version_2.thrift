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


// version 2 of the interface

namespace * Skiptest.Two

const i32 SKIPTESTSERVICE_VERSION = 2

struct Pong {
  1 : optional i32 version1
  2 : optional i16 version2
}

struct Ping {
  1 : optional i32 version1
  10 : optional bool boolVal
  11 : optional byte byteVal
  12 : optional double dbVal
  13 : optional i16 i16Val
  14 : optional i32 i32Val
  15 : optional i64 i64Val
  16 : optional string strVal
  17 : optional Pong structVal
  18 : optional map< list< Pong>, set< string>> mapVal
}

exception PingFailed {
  1 : optional i32 pingErrorCode
}

exception PongFailed {
  222 : optional i32 pongErrorCode
  10 : optional bool boolVal
  11 : optional byte byteVal
  12 : optional double dbVal
  13 : optional i16 i16Val
  14 : optional i32 i32Val
  15 : optional i64 i64Val
  16 : optional string strVal
  17 : optional Pong structVal
  18 : optional map< list< Pong>, set< string>> mapVal
}


service SkipTestService {
  Ping PingPong( 1: Ping ping, 3: Pong pong) throws (1: PingFailed pif, 444: PongFailed pof);
}


// EOF

