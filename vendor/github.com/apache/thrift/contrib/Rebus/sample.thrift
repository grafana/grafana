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


service BasicMathServer {
    oneway void DoTheMath( 1: i32 arg1,  2: i32 arg2)
    oneway void Ping(1: i64 value)
}

service BasicMathClient {
    oneway void ThreeResults( 1 : i32 added, 2 : i32 multiplied, 3 : i32 subtracted);
    oneway void FourResults(  1 : i32 added, 2 : i32 multiplied, 3 : i32 subtracted, 4 : i32 divided);
    oneway void Pong(1: i64 value)
}
