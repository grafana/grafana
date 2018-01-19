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

package org.apache.thrift.test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.thrift.protocol.TBinaryProtocol;
import org.apache.thrift.protocol.TCompactProtocol;
import org.apache.thrift.protocol.TJSONProtocol;
import org.apache.thrift.protocol.TProtocol;
import org.apache.thrift.protocol.TProtocolFactory;
import org.apache.thrift.server.ServerContext;
import org.apache.thrift.server.TServer;
import org.apache.thrift.server.TServer.Args;
import org.apache.thrift.server.TSimpleServer;
import org.apache.thrift.server.TThreadPoolServer;
import org.apache.thrift.server.ServerTestBase.TestHandler;
import org.apache.thrift.server.TServerEventHandler;
import org.apache.thrift.server.TThreadedSelectorServer;
import org.apache.thrift.server.TNonblockingServer;
import org.apache.thrift.transport.TFramedTransport;
import org.apache.thrift.transport.TFastFramedTransport;
import org.apache.thrift.transport.TServerSocket;
import org.apache.thrift.transport.TSSLTransportFactory;
import org.apache.thrift.transport.TTransport;
import org.apache.thrift.transport.TTransportFactory;
import org.apache.thrift.transport.TNonblockingServerSocket;


import thrift.test.Insanity;
import thrift.test.Numberz;
import thrift.test.ThriftTest;
import thrift.test.Xception;
import thrift.test.Xception2;
import thrift.test.Xtruct;
import thrift.test.Xtruct2;

public class TestServer {

  static class TestServerContext implements ServerContext {

        int connectionId;

        public TestServerContext(int connectionId) {
            this.connectionId = connectionId;
        }

        public int getConnectionId() {
            return connectionId;
        }

        public void setConnectionId(int connectionId) {
            this.connectionId = connectionId;
        }

  }

  static class TestServerEventHandler implements TServerEventHandler {

        private int nextConnectionId = 1;

        public void preServe() {
            System.out.println("TServerEventHandler.preServe - called only once before server starts accepting connections");
        }

        public ServerContext createContext(TProtocol input, TProtocol output) {
            //we can create some connection level data which is stored while connection is alive & served
            TestServerContext ctx = new TestServerContext(nextConnectionId++);
            System.out.println("TServerEventHandler.createContext - connection #"+ctx.getConnectionId()+" established");
            return ctx;
        }

        public void deleteContext(ServerContext serverContext, TProtocol input, TProtocol output) {
            TestServerContext ctx = (TestServerContext)serverContext;
            System.out.println("TServerEventHandler.deleteContext - connection #"+ctx.getConnectionId()+" terminated");
        }

        public void processContext(ServerContext serverContext, TTransport inputTransport, TTransport outputTransport) {
            TestServerContext ctx = (TestServerContext)serverContext;
            System.out.println("TServerEventHandler.processContext - connection #"+ctx.getConnectionId()+" is ready to process next request");
        }

  }

  public static void main(String [] args) {
    try {
      int port = 9090;
      boolean ssl = false;
      String transport_type = "buffered";
      String protocol_type = "binary";
      String server_type = "thread-pool";
      String domain_socket = "";
      int string_limit = -1;
      int container_limit = -1;
      try {
        for (int i = 0; i < args.length; i++) {
          if (args[i].startsWith("--port")) {
            port = Integer.valueOf(args[i].split("=")[1]);
          } else if (args[i].startsWith("--server-type")) {
            server_type = args[i].split("=")[1];
            server_type.trim();
          } else if (args[i].startsWith("--port")) {
            port=Integer.parseInt(args[i].split("=")[1]);
          } else if (args[i].startsWith("--protocol")) {
            protocol_type = args[i].split("=")[1];
            protocol_type.trim();
          } else if (args[i].startsWith("--transport")) {
            transport_type = args[i].split("=")[1];
            transport_type.trim();
          } else if (args[i].equals("--ssl")) {
            ssl = true;
          } else if (args[i].startsWith("--string-limit")) {
            string_limit = Integer.valueOf(args[i].split("=")[1]);
          } else if (args[i].startsWith("--container-limit")) {
            container_limit = Integer.valueOf(args[i].split("=")[1]);
          } else if (args[i].equals("--help")) {
            System.out.println("Allowed options:");
            System.out.println("  --help\t\t\tProduce help message");
            System.out.println("  --port=arg (=" + port + ")\tPort number to connect");
            System.out.println("  --transport=arg (=" + transport_type + ")\n\t\t\t\tTransport: buffered, framed, fastframed");
            System.out.println("  --protocol=arg (=" + protocol_type + ")\tProtocol: binary, json, compact");
            System.out.println("  --ssl\t\t\tEncrypted Transport using SSL");
            System.out.println("  --server-type=arg (=" + server_type +")\n\t\t\t\tType of server: simple, thread-pool, nonblocking, threaded-selector");
            System.out.println("  --string-limit=arg (=" + string_limit + ")\tString read length limit");
            System.out.println("  --container-limit=arg (=" + container_limit + ")\tContainer read length limit");
            System.exit(0);
          }
        }
      } catch (Exception e) {
        System.err.println("Can not parse arguments! See --help");
        System.exit(1);
      }

      try {
        if (server_type.equals("simple")) {
        } else if (server_type.equals("thread-pool")) {
        } else if (server_type.equals("nonblocking")) {
          if (ssl == true) {
            throw new Exception("SSL is not supported over nonblocking servers!");
          }
        } else if (server_type.equals("threaded-selector")) {
          if (ssl == true) {
            throw new Exception("SSL is not supported over nonblocking servers!");
          }
        } else {
          throw new Exception("Unknown server type! " + server_type);
        }
        if (protocol_type.equals("binary")) {
        } else if (protocol_type.equals("json")) {
        } else if (protocol_type.equals("compact")) {
        } else {
          throw new Exception("Unknown protocol type! " + protocol_type);
        }
        if (transport_type.equals("buffered")) {
        } else if (transport_type.equals("framed")) {
        } else if (transport_type.equals("fastframed")) {
        } else {
          throw new Exception("Unknown transport type! " + transport_type);
        }
      } catch (Exception e) {
        System.err.println("Error: " + e.getMessage());
        System.exit(1);
      }

      // Processor
      TestHandler testHandler =
        new TestHandler();
      ThriftTest.Processor testProcessor =
        new ThriftTest.Processor(testHandler);

      // Protocol factory
      TProtocolFactory tProtocolFactory = null;
      if (protocol_type.equals("json")) {
        tProtocolFactory = new TJSONProtocol.Factory();
      } else if (protocol_type.equals("compact")) {
        tProtocolFactory = new TCompactProtocol.Factory(string_limit, container_limit);
      } else {
        tProtocolFactory = new TBinaryProtocol.Factory(string_limit, container_limit);
      }

      TTransportFactory tTransportFactory = null;

      if (transport_type.equals("framed")) {
        tTransportFactory = new TFramedTransport.Factory();
      } else if (transport_type.equals("fastframed")) {
        tTransportFactory = new TFastFramedTransport.Factory();
      } else { // .equals("buffered") => default value
        tTransportFactory = new TTransportFactory();
      }

      TServer serverEngine = null;


      if (server_type.equals("nonblocking") ||
          server_type.equals("threaded-selector")) {
        // Nonblocking servers
        TNonblockingServerSocket tNonblockingServerSocket =
          new TNonblockingServerSocket(new TNonblockingServerSocket.NonblockingAbstractServerSocketArgs().port(port));

        if (server_type.equals("nonblocking")) {
          // Nonblocking Server
          TNonblockingServer.Args tNonblockingServerArgs
              = new TNonblockingServer.Args(tNonblockingServerSocket);
          tNonblockingServerArgs.processor(testProcessor);
          tNonblockingServerArgs.protocolFactory(tProtocolFactory);
          tNonblockingServerArgs.transportFactory(tTransportFactory);

          serverEngine = new TNonblockingServer(tNonblockingServerArgs);
        } else { // server_type.equals("threaded-selector")
          // ThreadedSelector Server
          TThreadedSelectorServer.Args tThreadedSelectorServerArgs
              = new TThreadedSelectorServer.Args(tNonblockingServerSocket);
          tThreadedSelectorServerArgs.processor(testProcessor);
          tThreadedSelectorServerArgs.protocolFactory(tProtocolFactory);
          tThreadedSelectorServerArgs.transportFactory(tTransportFactory);

          serverEngine = new TThreadedSelectorServer(tThreadedSelectorServerArgs);
        }
      } else {
        // Blocking servers

        // SSL socket
        TServerSocket tServerSocket = null;
        if (ssl) {
          tServerSocket = TSSLTransportFactory.getServerSocket(port, 0);
        } else {
          tServerSocket = new TServerSocket(new TServerSocket.ServerSocketTransportArgs().port(port));
        }

        if (server_type.equals("simple")) {
          // Simple Server
          TServer.Args tServerArgs = new TServer.Args(tServerSocket);
          tServerArgs.processor(testProcessor);
          tServerArgs.protocolFactory(tProtocolFactory);
          tServerArgs.transportFactory(tTransportFactory);

          serverEngine = new TSimpleServer(tServerArgs);
        } else { // server_type.equals("threadpool")
          // ThreadPool Server
          TThreadPoolServer.Args tThreadPoolServerArgs
              = new TThreadPoolServer.Args(tServerSocket);
          tThreadPoolServerArgs.processor(testProcessor);
          tThreadPoolServerArgs.protocolFactory(tProtocolFactory);
          tThreadPoolServerArgs.transportFactory(tTransportFactory);

          serverEngine = new TThreadPoolServer(tThreadPoolServerArgs);
        }
      }


      //Set server event handler
      serverEngine.setServerEventHandler(new TestServerEventHandler());

      // Run it
      System.out.println("Starting the server on port " + port + "...");
      serverEngine.serve();

    } catch (Exception x) {
      x.printStackTrace();
    }
    System.out.println("done.");
  }
}
