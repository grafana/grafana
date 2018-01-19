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

import org.apache.thrift.TException;

class TProtocolException extends TException {

    // WARNING: These are subject to be extended in the future, so we can't use enums
    // with Haxe 3.1.3 because of https://github.com/HaxeFoundation/haxe/issues/3649
    public static inline var UNKNOWN : Int = 0;
    public static inline var INVALID_DATA : Int = 1;
    public static inline var NEGATIVE_SIZE : Int = 2;
    public static inline var SIZE_LIMIT : Int = 3;
    public static inline var BAD_VERSION : Int = 4;
    public static inline var NOT_IMPLEMENTED : Int = 5;
    public static inline var DEPTH_LIMIT : Int = 6;

    public function new(error : Int = UNKNOWN, message : String = "") {
      super(message, error);
    }


} 