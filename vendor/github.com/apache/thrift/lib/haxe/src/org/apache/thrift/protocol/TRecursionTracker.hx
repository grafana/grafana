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

import org.apache.thrift.*;


class TRecursionTracker {

    // default
    private static inline var DEFAULT_RECURSION_DEPTH : Int = 64;

    // limit and actual value
    public var recursionLimit : Int = DEFAULT_RECURSION_DEPTH;
    private var recursionDepth : Int = 0;

    public function IncrementRecursionDepth() : Void
    {
        if (recursionDepth < recursionLimit)
            ++recursionDepth;
        else
            throw new TProtocolException(TProtocolException.DEPTH_LIMIT, "Depth limit exceeded");
    }

    public function DecrementRecursionDepth() : Void
    {
        --recursionDepth;
    }


}
