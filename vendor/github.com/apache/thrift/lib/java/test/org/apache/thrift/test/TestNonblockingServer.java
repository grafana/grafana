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

import org.apache.thrift.server.THsHaServer;
import org.apache.thrift.server.TNonblockingServer;
import org.apache.thrift.server.TServer;
import org.apache.thrift.server.THsHaServer.Args;
import org.apache.thrift.transport.TNonblockingServerSocket;
import org.apache.thrift.server.ServerTestBase.TestHandler;

import thrift.test.ThriftTest;


public class TestNonblockingServer extends TestServer {
  public static void main(String [] args) {
    try {
      int port = 9090;
      boolean hsha = false;

      for (int i = 0; i < args.length; i++) {
        if (args[i].equals("-p")) {
          port = Integer.valueOf(args[i++]);
        } else if (args[i].equals("-hsha")) {
          hsha = true;
        }
      }
      //@TODO add other protocol and transport types

      // Processor
      TestHandler testHandler =
        new TestHandler();
      ThriftTest.Processor testProcessor =
        new ThriftTest.Processor(testHandler);

      // Transport
      TNonblockingServerSocket tServerSocket =
        new TNonblockingServerSocket(new TNonblockingServerSocket.NonblockingAbstractServerSocketArgs().port(port));

      TServer serverEngine;

      if (hsha) {
        // HsHa Server
        serverEngine = new THsHaServer(new Args(tServerSocket).processor(testProcessor));
      } else {
        // Nonblocking Server
        serverEngine = new TNonblockingServer(new Args(tServerSocket).processor(testProcessor));
      }

      // Run it
      System.out.println("Starting the server on port " + port + "...");
      serverEngine.serve();

    } catch (Exception x) {
      x.printStackTrace();
    }
    System.out.println("done.");
  }
}
