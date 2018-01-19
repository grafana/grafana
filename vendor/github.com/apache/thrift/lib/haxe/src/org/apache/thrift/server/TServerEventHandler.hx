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

package org.apache.thrift.server;

import org.apache.thrift.*;
import org.apache.thrift.transport.*;
import org.apache.thrift.protocol.*;


// Interface implemented by server users to handle events from the server
interface TServerEventHandler {

    // Called before the server begins
    function preServe() : Void;

    // Called when a new client has connected and is about to being processing
    function createContext( input : TProtocol, output : TProtocol) : Dynamic;

    // Called when a client has finished request-handling to delete server context
    function deleteContext( serverContext : Dynamic, input : TProtocol, output : TProtocol) : Void;

    // Called when a client is about to call the processor
    function processContext( serverContext : Dynamic, transport : TTransport) : Void;
}
