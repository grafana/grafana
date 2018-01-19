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
module thrift.protocol.processor;

// Use selective import once DMD @@BUG314@@ is fixed.
import std.variant /+ : Variant +/;
import thrift.protocol.base;
import thrift.transport.base;

/**
 * A processor is a generic object which operates upon an input stream and
 * writes to some output stream.
 *
 * The definition of this object is loose, though the typical case is for some
 * sort of server that either generates responses to an input stream or
 * forwards data from one pipe onto another.
 *
 * An implementation can optionally allow one or more TProcessorEventHandlers
 * to be attached, providing an interface to hook custom code into the
 * handling process, which can be used e.g. for gathering statistics.
 */
interface TProcessor {
  ///
  bool process(TProtocol iprot, TProtocol oprot,
    Variant connectionContext = Variant()
  ) in {
    assert(iprot);
    assert(oprot);
  }

  ///
  final bool process(TProtocol prot, Variant connectionContext = Variant()) {
    return process(prot, prot, connectionContext);
  }
}

/**
 * Handles events from a processor.
 */
interface TProcessorEventHandler {
  /**
   * Called before calling other callback methods.
   *
   * Expected to return some sort of »call context«, which is passed to all
   * other callbacks for that function invocation.
   */
  Variant createContext(string methodName, Variant connectionContext);

  /**
   * Called when handling the method associated with a context has been
   * finished – can be used to perform clean up work.
   */
  void deleteContext(Variant callContext, string methodName);

  /**
   * Called before reading arguments.
   */
  void preRead(Variant callContext, string methodName);

  /**
   * Called between reading arguments and calling the handler.
   */
  void postRead(Variant callContext, string methodName);

  /**
   * Called between calling the handler and writing the response.
   */
  void preWrite(Variant callContext, string methodName);

  /**
   * Called after writing the response.
   */
  void postWrite(Variant callContext, string methodName);

  /**
   * Called when handling a one-way function call is completed successfully.
   */
  void onewayComplete(Variant callContext, string methodName);

  /**
   * Called if the handler throws an undeclared exception.
   */
  void handlerError(Variant callContext, string methodName, Exception e);
}

struct TConnectionInfo {
  /// The input and output protocols.
  TProtocol input;
  TProtocol output; /// Ditto.

  /// The underlying transport used for the connection
  /// This is the transport that was returned by TServerTransport.accept(),
  /// and it may be different than the transport pointed to by the input and
  /// output protocols.
  TTransport transport;
}

interface TProcessorFactory {
  /**
   * Get the TProcessor to use for a particular connection.
   *
   * This method is always invoked in the same thread that the connection was
   * accepted on, which is always the same thread for all current server
   * implementations.
   */
  TProcessor getProcessor(ref const(TConnectionInfo) connInfo);
}

/**
 * The default processor factory which always returns the same instance.
 */
class TSingletonProcessorFactory : TProcessorFactory {
  /**
   * Creates a new instance.
   *
   * Params:
   *   processor = The processor object to return from getProcessor().
   */
  this(TProcessor processor) {
    processor_ = processor;
  }

  override TProcessor getProcessor(ref const(TConnectionInfo) connInfo) {
    return processor_;
  }

private:
  TProcessor processor_;
}
