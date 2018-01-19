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
 * Unless enforced by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
module async_test;

import core.atomic;
import core.sync.condition : Condition;
import core.sync.mutex : Mutex;
import core.thread : dur, Thread, ThreadGroup;
import std.conv : text;
import std.datetime;
import std.getopt;
import std.exception : collectException, enforce;
import std.parallelism : TaskPool;
import std.stdio;
import std.string;
import std.variant : Variant;
import thrift.base;
import thrift.async.base;
import thrift.async.libevent;
import thrift.async.socket;
import thrift.async.ssl;
import thrift.codegen.async_client;
import thrift.codegen.async_client_pool;
import thrift.codegen.base;
import thrift.codegen.processor;
import thrift.protocol.base;
import thrift.protocol.binary;
import thrift.server.base;
import thrift.server.simple;
import thrift.server.transport.socket;
import thrift.server.transport.ssl;
import thrift.transport.base;
import thrift.transport.buffered;
import thrift.transport.ssl;
import thrift.util.cancellation;

version (Posix) {
  import core.stdc.signal;
  import core.sys.posix.signal;

  // Disable SIGPIPE because SSL server will write to broken socket after
  // client disconnected (see TSSLSocket docs).
  shared static this() {
    signal(SIGPIPE, SIG_IGN);
  }
}

interface AsyncTest {
  string echo(string value);
  string delayedEcho(string value, long milliseconds);

  void fail(string reason);
  void delayedFail(string reason, long milliseconds);

  enum methodMeta = [
    TMethodMeta("fail", [], [TExceptionMeta("ate", 1, "AsyncTestException")]),
    TMethodMeta("delayedFail", [], [TExceptionMeta("ate", 1, "AsyncTestException")])
  ];
  alias .AsyncTestException AsyncTestException;
}

class AsyncTestException : TException {
  string reason;
  mixin TStructHelpers!();
}

void main(string[] args) {
  ushort port = 9090;
  ushort managerCount = 2;
  ushort serversPerManager = 5;
  ushort threadsPerServer = 10;
  uint iterations = 10;
  bool ssl;
  bool trace;

  getopt(args,
    "iterations", &iterations,
    "managers", &managerCount,
    "port", &port,
    "servers-per-manager", &serversPerManager,
    "ssl", &ssl,
    "threads-per-server", &threadsPerServer,
    "trace", &trace,
  );

  TTransportFactory clientTransportFactory;
  TSSLContext serverSSLContext;
  if (ssl) {
    auto clientSSLContext = new TSSLContext();
    with (clientSSLContext) {
      ciphers = "ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH";
      authenticate = true;
      loadTrustedCertificates("./trusted-ca-certificate.pem");
    }
    clientTransportFactory = new TAsyncSSLSocketFactory(clientSSLContext);

    serverSSLContext = new TSSLContext();
    with (serverSSLContext) {
      serverSide = true;
      loadCertificate("./server-certificate.pem");
      loadPrivateKey("./server-private-key.pem");
      ciphers = "ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH";
    }
  } else {
    clientTransportFactory = new TBufferedTransportFactory;
  }


  auto serverCancel = new TCancellationOrigin;
  scope(exit) {
    writeln("Triggering server shutdown...");
    serverCancel.trigger();
    writeln("done.");
  }

  auto managers = new TLibeventAsyncManager[managerCount];
  scope (exit) foreach (ref m; managers) destroy(m);

  auto clientsThreads = new ThreadGroup;
  foreach (managerIndex, ref manager; managers) {
    manager = new TLibeventAsyncManager;
    foreach (serverIndex; 0 .. serversPerManager) {
      auto currentPort = cast(ushort)
        (port + managerIndex * serversPerManager + serverIndex);

      // Start the server and wait until it is up and running.
      auto servingMutex = new Mutex;
      auto servingCondition = new Condition(servingMutex);
      auto handler = new PreServeNotifyHandler(servingMutex, servingCondition);
      synchronized (servingMutex) {
        (new ServerThread!TSimpleServer(currentPort, serverSSLContext, trace,
          serverCancel, handler)).start();
        servingCondition.wait();
      }

      // We only run the timing tests for the first server on each async
      // manager, so that we don't get spurious timing errors becaue of
      // ordering issues.
      auto runTimingTests = (serverIndex == 0);

      auto c = new ClientsThread(manager, currentPort, clientTransportFactory,
        threadsPerServer, iterations, runTimingTests, trace);
      clientsThreads.add(c);
      c.start();
    }
  }
  clientsThreads.joinAll();
}

class AsyncTestHandler : AsyncTest {
  this(bool trace) {
    trace_ = trace;
  }

  override string echo(string value) {
    if (trace_) writefln(`echo("%s")`, value);
    return value;
  }

  override string delayedEcho(string value, long milliseconds) {
    if (trace_) writef(`delayedEcho("%s", %s ms)... `, value, milliseconds);
    Thread.sleep(dur!"msecs"(milliseconds));
    if (trace_) writeln("returning.");

    return value;
  }

  override void fail(string reason) {
    if (trace_) writefln(`fail("%s")`, reason);
    auto ate = new AsyncTestException;
    ate.reason = reason;
    throw ate;
  }

  override void delayedFail(string reason, long milliseconds) {
    if (trace_) writef(`delayedFail("%s", %s ms)... `, reason, milliseconds);
    Thread.sleep(dur!"msecs"(milliseconds));
    if (trace_) writeln("returning.");

    auto ate = new AsyncTestException;
    ate.reason = reason;
    throw ate;
  }

private:
  bool trace_;
  AsyncTestException ate_;
}

class PreServeNotifyHandler : TServerEventHandler {
  this(Mutex servingMutex, Condition servingCondition) {
    servingMutex_ = servingMutex;
    servingCondition_ = servingCondition;
  }

  void preServe() {
    synchronized (servingMutex_) {
      servingCondition_.notifyAll();
    }
  }
  Variant createContext(TProtocol input, TProtocol output) { return Variant.init; }
  void deleteContext(Variant serverContext, TProtocol input, TProtocol output) {}
  void preProcess(Variant serverContext, TTransport transport) {}

private:
  Mutex servingMutex_;
  Condition servingCondition_;
}

class ServerThread(ServerType) : Thread {
  this(ushort port, TSSLContext sslContext, bool trace,
    TCancellation cancellation, TServerEventHandler eventHandler
  ) {
    port_ = port;
    sslContext_ = sslContext;
    trace_ = trace;
    cancellation_ = cancellation;
    eventHandler_ = eventHandler;

    super(&run);
  }

  void run() {
    TServerSocket serverSocket;
    if (sslContext_) {
      serverSocket = new TSSLServerSocket(port_, sslContext_);
    } else {
      serverSocket = new TServerSocket(port_);
    }
    auto transportFactory = new TBufferedTransportFactory;
    auto protocolFactory = new TBinaryProtocolFactory!();
    auto processor = new TServiceProcessor!AsyncTest(new AsyncTestHandler(trace_));

    auto server = new ServerType(processor, serverSocket, transportFactory,
      protocolFactory);
    server.eventHandler = eventHandler_;

    writefln("Starting server on port %s...", port_);
    server.serve(cancellation_);
    writefln("Server thread on port %s done.", port_);
  }

private:
  ushort port_;
  bool trace_;
  TCancellation cancellation_;
  TSSLContext sslContext_;
  TServerEventHandler eventHandler_;
}

class ClientsThread : Thread {
  this(TAsyncSocketManager manager, ushort port, TTransportFactory tf,
    ushort threads, uint iterations, bool runTimingTests, bool trace
  ) {
    manager_ = manager;
    port_ = port;
    transportFactory_ = tf;
    threads_ = threads;
    iterations_ = iterations;
    runTimingTests_ = runTimingTests;
    trace_ = trace;
    super(&run);
  }

  void run() {
    auto transport = new TAsyncSocket(manager_, "localhost", port_);

    {
      auto client = new TAsyncClient!AsyncTest(
        transport,
        transportFactory_,
        new TBinaryProtocolFactory!()
      );
      transport.open();
      auto clientThreads = new ThreadGroup;
      foreach (clientId; 0 .. threads_) {
        clientThreads.create({
          auto c = clientId;
          return {
            foreach (i; 0 .. iterations_) {
              immutable id = text(port_, ":", c, ":", i);

              {
                if (trace_) writefln(`Calling echo("%s")... `, id);
                auto a = client.echo(id);
                enforce(a == id);
                if (trace_) writefln(`echo("%s") done.`, id);
              }

              {
                if (trace_) writefln(`Calling fail("%s")... `, id);
                auto a = cast(AsyncTestException)collectException(client.fail(id).waitGet());
                enforce(a && a.reason == id);
                if (trace_) writefln(`fail("%s") done.`, id);
              }
            }
          };
        }());
      }
      clientThreads.joinAll();
      transport.close();
    }

    if (runTimingTests_) {
      auto client = new TAsyncClient!AsyncTest(
        transport,
        transportFactory_,
        new TBinaryProtocolFactory!TBufferedTransport
      );

      // Temporarily redirect error logs to stdout, as SSL errors on the server
      // side are expected when the client terminates aburptly (as is the case
      // in the timeout test).
      auto oldErrorLogSink = g_errorLogSink;
      g_errorLogSink = g_infoLogSink;
      scope (exit) g_errorLogSink = oldErrorLogSink;

      foreach (i; 0 .. iterations_) {
        transport.open();

        immutable id = text(port_, ":", i);

        {
          if (trace_) writefln(`Calling delayedEcho("%s", 100 ms)...`, id);
          auto a = client.delayedEcho(id, 100);
          enforce(!a.completion.wait(dur!"usecs"(1)),
            text("wait() succeeded early (", a.get(), ", ", id, ")."));
          enforce(!a.completion.wait(dur!"usecs"(1)),
            text("wait() succeeded early (", a.get(), ", ", id, ")."));
          enforce(a.completion.wait(dur!"msecs"(200)),
            text("wait() didn't succeed as expected (", id, ")."));
          enforce(a.get() == id);
          if (trace_) writefln(`... delayedEcho("%s") done.`, id);
        }

        {
          if (trace_) writefln(`Calling delayedFail("%s", 100 ms)... `, id);
          auto a = client.delayedFail(id, 100);
          enforce(!a.completion.wait(dur!"usecs"(1)),
            text("wait() succeeded early (", id, ", ", collectException(a.get()), ")."));
          enforce(!a.completion.wait(dur!"usecs"(1)),
            text("wait() succeeded early (", id, ", ", collectException(a.get()), ")."));
          enforce(a.completion.wait(dur!"msecs"(200)),
            text("wait() didn't succeed as expected (", id, ")."));
          auto e = cast(AsyncTestException)collectException(a.get());
          enforce(e && e.reason == id);
          if (trace_) writefln(`... delayedFail("%s") done.`, id);
        }

        {
          transport.recvTimeout = dur!"msecs"(50);

          if (trace_) write(`Calling delayedEcho("socketTimeout", 100 ms)... `);
          auto a = client.delayedEcho("socketTimeout", 100);
          auto e = cast(TTransportException)collectException(a.waitGet());
          enforce(e, text("Operation didn't fail as expected (", id, ")."));
          enforce(e.type == TTransportException.Type.TIMED_OUT,
            text("Wrong timeout exception type (", id, "): ", e));
          if (trace_) writeln(`timed out as expected.`);

          // Wait until the server thread reset before the next iteration.
          Thread.sleep(dur!"msecs"(50));
          transport.recvTimeout = dur!"hnsecs"(0);
        }

        transport.close();
      }
    }

    writefln("Clients thread for port %s done.", port_);
  }

  TAsyncSocketManager manager_;
  ushort port_;
  TTransportFactory transportFactory_;
  ushort threads_;
  uint iterations_;
  bool runTimingTests_;
  bool trace_;
}
