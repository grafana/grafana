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
package org.apache.thrift.async;

/**
 * A handler interface asynchronous clients can implement to receive future
 * notice of the results of an asynchronous method call.
 *
 * @param <T> The return type of the asynchronously invoked method.
 */
public interface AsyncMethodCallback<T> {
  /**
   * This method will be called when the remote side has completed invoking
   * your method call and the result is fully read. For {@code oneway} method
   * calls, this method will be called as soon as we have completed writing out
   * the request.
   *
   * @param response The return value of the asynchronously invoked method;
   *                 {@code null} for void methods which includes
   *                 {@code oneway} methods.
   */
  void onComplete(T response);

  /**
   * This method will be called when there is either an unexpected client-side
   * exception like an IOException or else when the remote method raises an
   * exception, either declared in the IDL or due to an unexpected server-side
   * error.
   *
   * @param exception The exception encountered processing the the asynchronous
   *                  method call, may be a local exception or an unmarshalled
   *                  remote exception.
   */
  void onError(Exception exception);
}
