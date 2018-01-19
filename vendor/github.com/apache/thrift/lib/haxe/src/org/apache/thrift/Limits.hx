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

package org.apache.thrift;

class Limits {

    // Haxe limits are not fixed values, they depend on the target platform
    // For example, neko limits an int to 31 bits instead of 32. So we detect
    // the values once during intialisation in order to
    // (a) get the right values for the current  platform, and
    // (b) prevent us from dependecies to a bunch of defines

    public static var I32_MAX = {
        var last : Int = 0;
        var next : Int = 0;
        for(bit in 0 ... 32) {
            last = next;
            next = last | (1 << bit);
            if(next < 0) {
                break;
            }
        }
        last; // final value
    }

    // add whatever you need
}