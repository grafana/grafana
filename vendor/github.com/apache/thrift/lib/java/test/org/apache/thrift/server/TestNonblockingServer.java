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


import org.apache.thrift.TProcessor;
import org.apache.thrift.protocol.TProtocol;
import org.apache.thrift.protocol.TProtocolFactory;
import org.apache.thrift.server.TNonblockingServer.Args;
import org.apache.thrift.transport.TFramedTransport;
import org.apache.thrift.transport.TNonblockingServerSocket;
import org.apache.thrift.transport.TSocket;
import org.apache.thrift.transport.TTransport;
import org.apache.thrift.transport.TTransportException;
import org.apache.thrift.transport.TTransportFactory;

import thrift.test.ThriftTest;

public class TestNonblockingServer extends ServerTestBase {

  private Thread serverThread;
  private TServer server;
  private static final int NUM_QUERIES = 1000;

  protected TServer getServer(TProcessor processor, TNonblockingServerSocket socket, TProtocolFactory protoFactory, TTransportFactory factory) {
    final Args args = new Args(socket).processor(processor).protocolFactory(protoFactory);
    if (factory != null) {
      args.transportFactory(factory);
    }
    return new TNonblockingServer(args);
  }

  @Override
  public void startServer(final TProcessor processor, final TProtocolFactory protoFactory, final TTransportFactory factory) throws Exception {
    serverThread = new Thread() {
      public void run() {
        try {
          // Transport
          TNonblockingServerSocket tServerSocket =
            new TNonblockingServerSocket(new TNonblockingServerSocket.NonblockingAbstractServerSocketArgs().port(PORT));

          server = getServer(processor, tServerSocket, protoFactory, factory);

          // Run it
          System.out.println("Starting the server on port " + PORT + "...");
          server.serve();
        } catch (Exception e) {
          e.printStackTrace();
          fail();
        }
      }
    };
    serverThread.start();
    Thread.sleep(1000);
  }

  @Override
  public void stopServer() throws Exception {
    server.stop();
    try {
      serverThread.join();
    } catch (InterruptedException e) {}
  }

  @Override
  public TTransport getClientTransport(TTransport underlyingTransport) throws Exception {
    return new TFramedTransport(underlyingTransport);
  }


  public void testCleanupAllSelectionKeys() throws Exception {
    for (TProtocolFactory protoFactory : getProtocols()) {
      TestHandler handler = new TestHandler();
      ThriftTest.Processor processor = new ThriftTest.Processor(handler);

      startServer(processor, protoFactory);

      TSocket socket = new TSocket(HOST, PORT);
      socket.setTimeout(SOCKET_TIMEOUT);
      TTransport transport = getClientTransport(socket);

      TProtocol protocol = protoFactory.getProtocol(transport);
      ThriftTest.Client testClient = new ThriftTest.Client(protocol);

      open(transport);

      for (int i = 0; i < NUM_QUERIES; ++i) {
        testClient.testI32(1);
      }
      server.stop();
      for (int i = 0; i < NUM_QUERIES; ++i) {
        try {
          testClient.testI32(1);
        } catch(TTransportException e) {
          System.err.println(e);
          e.printStackTrace();
          if (e.getCause() instanceof java.net.SocketTimeoutException) {
            fail("timed out when it should have thrown another kind of error!");
          }
        }
      }

      transport.close();
      stopServer();
    }
  }
}
