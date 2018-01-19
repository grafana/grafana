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
 *
 * Contains some contributions under the Thrift Software License.
 * Please see doc/old-thrift-license.txt in the Thrift distribution for
 * details.
 */

using System;

namespace Thrift.Server
{
  /// <summary>
  /// Interface implemented by server users to handle events from the server
  /// </summary>
  public interface TServerEventHandler
  {
    /// <summary>
    /// Called before the server begins */
    /// </summary>
    void preServe();
    /// <summary>
    /// Called when a new client has connected and is about to being processing */
    /// </summary>
    Object createContext(Thrift.Protocol.TProtocol input, Thrift.Protocol.TProtocol output);
    /// <summary>
    /// Called when a client has finished request-handling to delete server context */
    /// </summary>
    void deleteContext(Object serverContext, Thrift.Protocol.TProtocol input, Thrift.Protocol.TProtocol output);
    /// <summary>
    /// Called when a client is about to call the processor */
    /// </summary>
    void processContext(Object serverContext, Thrift.Transport.TTransport transport);
  };
}
