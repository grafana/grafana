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
module thrift.server.simple;

import std.variant : Variant;
import thrift.base;
import thrift.protocol.base;
import thrift.protocol.processor;
import thrift.server.base;
import thrift.server.transport.base;
import thrift.transport.base;
import thrift.util.cancellation;

/**
 * The most basic server.
 *
 * It is single-threaded and after it accepts a connections, it processes
 * requests on it until it closes, then waiting for the next connection.
 *
 * It is not so much of use in production than it is for writing unittests, or
 * as an example on how to provide a custom TServer implementation.
 */
class TSimpleServer : TServer {
  ///
  this(
    TProcessor processor,
    TServerTransport serverTransport,
    TTransportFactory transportFactory,
    TProtocolFactory protocolFactory
  ) {
    super(processor, serverTransport, transportFactory, protocolFactory);
  }

  ///
  this(
    TProcessorFactory processorFactory,
    TServerTransport serverTransport,
    TTransportFactory transportFactory,
    TProtocolFactory protocolFactory
  ) {
    super(processorFactory, serverTransport, transportFactory, protocolFactory);
  }

  ///
  this(
    TProcessor processor,
    TServerTransport serverTransport,
    TTransportFactory inputTransportFactory,
    TTransportFactory outputTransportFactory,
    TProtocolFactory inputProtocolFactory,
    TProtocolFactory outputProtocolFactory
  ) {
    super(processor, serverTransport, inputTransportFactory,
      outputTransportFactory, inputProtocolFactory, outputProtocolFactory);
  }

  this(
    TProcessorFactory processorFactory,
    TServerTransport serverTransport,
    TTransportFactory inputTransportFactory,
    TTransportFactory outputTransportFactory,
    TProtocolFactory inputProtocolFactory,
    TProtocolFactory outputProtocolFactory
  ) {
    super(processorFactory, serverTransport, inputTransportFactory,
      outputTransportFactory, inputProtocolFactory, outputProtocolFactory);
  }

  override void serve(TCancellation cancellation = null) {
    serverTransport_.listen();

    if (eventHandler) eventHandler.preServe();

    while (true) {
      TTransport client;
      TTransport inputTransport;
      TTransport outputTransport;
      TProtocol inputProtocol;
      TProtocol outputProtocol;

      try {
        client = serverTransport_.accept(cancellation);
        scope(failure) client.close();

        inputTransport = inputTransportFactory_.getTransport(client);
        scope(failure) inputTransport.close();

        outputTransport = outputTransportFactory_.getTransport(client);
        scope(failure) outputTransport.close();

        inputProtocol = inputProtocolFactory_.getProtocol(inputTransport);
        outputProtocol = outputProtocolFactory_.getProtocol(outputTransport);
      } catch (TCancelledException tcx) {
        break;
      } catch (TTransportException ttx) {
        logError("TServerTransport failed on accept: %s", ttx);
        continue;
      } catch (TException tx) {
        logError("Caught TException on accept: %s", tx);
        continue;
      }

      auto info = TConnectionInfo(inputProtocol, outputProtocol, client);
      auto processor = processorFactory_.getProcessor(info);

      Variant connectionContext;
      if (eventHandler) {
        connectionContext =
          eventHandler.createContext(inputProtocol, outputProtocol);
      }

      try {
        while (true) {
          if (eventHandler) {
            eventHandler.preProcess(connectionContext, client);
          }

          if (!processor.process(inputProtocol, outputProtocol,
            connectionContext) || !inputProtocol.transport.peek()
          ) {
            // Something went fundamentlly wrong or there is nothing more to
            // process, close the connection.
            break;
          }
        }
      } catch (TTransportException ttx) {
        logError("Client died: %s", ttx);
      } catch (Exception e) {
        logError("Uncaught exception: %s", e);
      }

      if (eventHandler) {
        eventHandler.deleteContext(connectionContext, inputProtocol,
          outputProtocol);
      }

      try {
        inputTransport.close();
      } catch (TTransportException ttx) {
        logError("Input close failed: %s", ttx);
      }
      try {
        outputTransport.close();
      } catch (TTransportException ttx) {
        logError("Output close failed: %s", ttx);
      }
      try {
        client.close();
      } catch (TTransportException ttx) {
        logError("Client close failed: %s", ttx);
      }
    }

    try {
      serverTransport_.close();
    } catch (TServerTransportException e) {
      logError("Server transport failed to close(): %s", e);
    }
  }
}

unittest {
  import thrift.internal.test.server;
  testServeCancel!TSimpleServer();
}
