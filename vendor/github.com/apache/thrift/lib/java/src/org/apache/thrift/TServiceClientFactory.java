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

import org.apache.thrift.protocol.TProtocol;

/**
 * A TServiceClientFactory provides a general way to get a TServiceClient
 * connected to a remote TService via a protocol.
 * @param <T>
 */
public interface TServiceClientFactory<T extends TServiceClient> {
  /**
   * Get a brand-new T using <i>prot</i> as both the input and output protocol.
   * @param prot
   * @return A brand-new T using <i>prot</i> as both the input and output protocol.
   */
  public T getClient(TProtocol prot);

  /**
   * Get a brand new T using the specified input and output protocols. The
   * input and output protocols may be the same instance.
   * @param iprot
   * @param oprot
   * @return a brand new T using the specified input and output protocols
   */
  public T getClient(TProtocol iprot, TProtocol oprot);
}
