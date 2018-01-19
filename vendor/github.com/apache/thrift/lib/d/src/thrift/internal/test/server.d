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
module thrift.internal.test.server;

import core.sync.condition;
import core.sync.mutex;
import core.thread : Thread;
import std.datetime;
import std.exception : enforce;
import std.typecons : WhiteHole;
import std.variant : Variant;
import thrift.protocol.base;
import thrift.protocol.binary;
import thrift.protocol.processor;
import thrift.server.base;
import thrift.server.transport.socket;
import thrift.transport.base;
import thrift.util.cancellation;

version(unittest):

/**
 * Tests if serving is stopped correctly if the cancellation passed to serve()
 * is triggered.
 *
 * Because the tests are run many times in a loop, this is indirectly also a
 * test whether socket, etc. handles are cleaned up correctly, because the
 * application will likely run out of handles otherwise.
 */
void testServeCancel(Server)(void delegate(Server) serverSetup = null) if (
  is(Server : TServer)
) {
  auto proc = new WhiteHole!TProcessor;
  auto tf = new TTransportFactory;
  auto pf = new TBinaryProtocolFactory!();

  // Need a special case for TNonblockingServer which doesn't use
  // TServerTransport.
  static if (__traits(compiles, new Server(proc, 0, tf, pf))) {
    auto server = new Server(proc, 0, tf, pf);
  } else {
    auto server = new Server(proc, new TServerSocket(0), tf, pf);
  }

  // On Windows, we use TCP sockets to replace socketpair(). Since they stay
  // in TIME_WAIT for some time even if they are properly closed, we have to use
  // a lower number of iterations to avoid running out of ports/buffer space.
  version (Windows) {
    enum ITERATIONS = 100;
  } else {
    enum ITERATIONS = 10000;
  }

  if (serverSetup) serverSetup(server);

  auto servingMutex = new Mutex;
  auto servingCondition = new Condition(servingMutex);
  auto doneMutex = new Mutex;
  auto doneCondition = new Condition(doneMutex);

  class CancellingHandler : TServerEventHandler {
    void preServe() {
      synchronized (servingMutex) {
        servingCondition.notifyAll();
      }
    }
    Variant createContext(TProtocol input, TProtocol output) { return Variant.init; }
    void deleteContext(Variant serverContext, TProtocol input, TProtocol output) {}
    void preProcess(Variant serverContext, TTransport transport) {}
  }
  server.eventHandler = new CancellingHandler;

  foreach (i; 0 .. ITERATIONS) {
    synchronized (servingMutex) {
      auto cancel = new TCancellationOrigin;
      synchronized (doneMutex) {
        auto serverThread = new Thread({
          server.serve(cancel);
          synchronized (doneMutex) {
            doneCondition.notifyAll();
          }
        });
        serverThread.isDaemon = true;
        serverThread.start();

        servingCondition.wait();

        cancel.trigger();
        enforce(doneCondition.wait(dur!"msecs"(3*1000)));
        serverThread.join();
      }
    }
  }
}
