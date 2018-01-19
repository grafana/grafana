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

package org.apache.thrift.transport;

import java.util.ArrayList;
import java.util.List;

import org.apache.thrift.TProcessor;
import org.apache.thrift.protocol.TBinaryProtocol;
import org.apache.thrift.protocol.TProtocolFactory;
import org.apache.thrift.server.ServerTestBase;
import org.apache.thrift.server.TServer;
import org.apache.thrift.server.TSimpleServer;
import org.apache.thrift.server.TServer.Args;

public class TestTSSLTransportFactory extends ServerTestBase {
  private Thread serverThread;
  private TServer server;

  private static final List<TProtocolFactory> protocols = new ArrayList<TProtocolFactory>();
  static {
    // TODO: Only supported on TBinaryProtocol. Doesn't work for TCompactProtocol
    protocols.add(new TBinaryProtocol.Factory());
  }

  @Override
  public TTransport getClientTransport(TTransport underlyingTransport)
  throws Exception {
    return TSSLTransportFactory.getClientSocket(HOST, PORT);
  }

  @Override
  public void startServer(final TProcessor processor, final TProtocolFactory protoFactory, final TTransportFactory factory)
  throws Exception {
    serverThread = new Thread() {
      public void run() {
        try {
          TServerTransport serverTransport = TSSLTransportFactory.getServerSocket(PORT);
          final Args args = new Args(serverTransport).processor(processor);
          server = new TSimpleServer(args);
          server.serve();
        } catch (TTransportException e) {
          e.printStackTrace();
          assert false;
        }
      }
    };

    serverThread.start();
    Thread.sleep(1000);
  }

  @Override
  public void stopServer() throws Exception {
    server.stop();
    serverThread.join();
  }

  @Override
  public void open(TTransport transport) throws Exception {}

  @Override
  public List<TProtocolFactory> getProtocols() {
    return protocols;
  }

  @Override
  public void testTransportFactory() throws Exception {
    // this test doesn't really apply to this suite, so let's skip it.
  }
}
