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

import org.apache.thrift.transport.TTransport;


/**
* Binary Protocol Factory
*/
class TBinaryProtocolFactory implements TProtocolFactory {

    private var strictRead_ : Bool = false;
    private var strictWrite_ : Bool = true;

    public function new( strictRead : Bool = false, strictWrite : Bool = true) {
        strictRead_  = strictRead;
        strictWrite_ = strictWrite;
    }

    public function getProtocol( trans : TTransport) : TProtocol  {
        return new TBinaryProtocol( trans, strictRead_, strictWrite_);
    }
}



    