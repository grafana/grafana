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

import org.apache.thrift.protocol.TProtocol;
import org.apache.thrift.transport.TTransport;

/**
 * Interface that can handle events from the server core. To
 * use this you should subclass it and implement the methods that you care
 * about. Your subclass can also store local data that you may care about,
 * such as additional "arguments" to these methods (stored in the object
 * instance's state).
 */
public interface TServerEventHandler {

  /**
   * Called before the server begins.
   */
  void preServe();

  /**
   * Called when a new client has connected and is about to being processing.
   */
  ServerContext createContext(TProtocol input,
                              TProtocol output);

  /**
   * Called when a client has finished request-handling to delete server
   * context.
   */
  void deleteContext(ServerContext serverContext,
                             TProtocol input,
                             TProtocol output);

  /**
   * Called when a client is about to call the processor.
   */
  void processContext(ServerContext serverContext,
                              TTransport inputTransport, TTransport outputTransport);

}