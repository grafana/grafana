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
module thrift.server.transport.base;

import thrift.base;
import thrift.transport.base;
import thrift.util.cancellation;

/**
 * Some kind of I/O device enabling servers to listen for incoming client
 * connections and communicate with them via a TTransport interface.
 */
interface TServerTransport {
  /**
   * Starts listening for server connections.
   *
   * Just as simliar functions commonly found in socket libraries, this
   * function does not block.
   *
   * If the socket is already listening, nothing happens.
   *
   * Throws: TServerTransportException if listening failed or the transport
   *   was already listening.
   */
  void listen();

  /**
   * Closes the server transport, causing it to stop listening.
   *
   * Throws: TServerTransportException if the transport was not listening.
   */
  void close();

  /**
   * Returns whether the server transport is currently listening.
   */
  bool isListening() @property;

  /**
   * Accepts a client connection and returns an opened TTransport for it,
   * never returning null.
   *
   * Blocks until a client connection is available.
   *
   * Params:
   *   cancellation = If triggered, requests the call to stop blocking and
   *     return with a TCancelledException. Implementations are free to
   *     ignore this if they cannot provide a reasonable.
   *
   * Throws: TServerTransportException if accepting failed,
   *   TCancelledException if it was cancelled.
   */
  TTransport accept(TCancellation cancellation = null) out (result) {
    assert(result !is null);
  }
}

/**
 * Server transport exception.
 */
class TServerTransportException : TException {
  /**
   * Error codes for the various types of exceptions.
   */
  enum Type {
    ///
    UNKNOWN,

    /// The server socket is not listening, but excepted to be.
    NOT_LISTENING,

    /// The server socket is already listening, but expected not to be.
    ALREADY_LISTENING,

    /// An operation on the primary underlying resource, e.g. a socket used
    /// for accepting connections, failed.
    RESOURCE_FAILED
  }

  ///
  this(Type type, string file = __FILE__, size_t line = __LINE__, Throwable next = null) {
    string msg = "TTransportException: ";
    switch (type) {
      case Type.UNKNOWN: msg ~= "Unknown server transport exception"; break;
      case Type.NOT_LISTENING: msg ~= "Server transport not listening"; break;
      case Type.ALREADY_LISTENING: msg ~= "Server transport already listening"; break;
      case Type.RESOURCE_FAILED: msg ~= "An underlying resource failed"; break;
      default: msg ~= "(Invalid exception type)"; break;
    }

    this(msg, type, file, line, next);
  }

  ///
  this(string msg, string file = __FILE__, size_t line = __LINE__,
    Throwable next = null)
  {
    this(msg, Type.UNKNOWN, file, line, next);
  }

  ///
  this(string msg, Type type, string file = __FILE__, size_t line = __LINE__,
    Throwable next = null)
  {
    super(msg, file, line, next);
    type_ = type;
  }

  ///
  Type type() const nothrow @property {
    return type_;
  }

protected:
  Type type_;
}

