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
module client_pool_test;

import core.time : Duration, dur;
import core.thread : Thread;
import std.algorithm;
import std.array;
import std.conv;
import std.exception;
import std.getopt;
import std.range;
import std.stdio;
import std.typecons;
import thrift.base;
import thrift.async.libevent;
import thrift.async.socket;
import thrift.codegen.base;
import thrift.codegen.async_client;
import thrift.codegen.async_client_pool;
import thrift.codegen.client;
import thrift.codegen.client_pool;
import thrift.codegen.processor;
import thrift.protocol.binary;
import thrift.server.simple;
import thrift.server.transport.socket;
import thrift.transport.buffered;
import thrift.transport.socket;
import thrift.util.cancellation;
import thrift.util.future;

// We use this as our RPC-layer exception here to make sure socket/… problems
// (that would usually considered to be RPC layer faults) cause the tests to
// fail, even though we are testing the RPC exception handling.
class TestServiceException : TException {
  int port;
}

interface TestService {
  int getPort();
  alias .TestServiceException TestServiceException;
  enum methodMeta = [TMethodMeta("getPort", [],
    [TExceptionMeta("a", 1, "TestServiceException")])];
}

// Use some derived service, just to check that the pools handle inheritance
// correctly.
interface ExTestService : TestService {
  int[] getPortInArray();
  enum methodMeta = [TMethodMeta("getPortInArray", [],
    [TExceptionMeta("a", 1, "TestServiceException")])];
}

class ExTestHandler : ExTestService {
  this(ushort port, Duration delay, bool failing, bool trace) {
    this.port = port;
    this.delay = delay;
    this.failing = failing;
    this.trace = trace;
  }

  override int getPort() {
    if (trace) {
      stderr.writefln("getPort() called on %s (delay: %s, failing: %s)", port,
        delay, failing);
    }
    sleep();
    failIfEnabled();
    return port;
  }

  override int[] getPortInArray() {
    return [getPort()];
  }

  ushort port;
  Duration delay;
  bool failing;
  bool trace;

private:
  void sleep() {
    if (delay > dur!"hnsecs"(0)) Thread.sleep(delay);
  }

  void failIfEnabled() {
    if (!failing) return;

    auto e = new TestServiceException;
    e.port = port;
    throw e;
  }
}

class ServerThread : Thread {
  this(ExTestHandler handler, TCancellation cancellation) {
    super(&run);
    handler_ = handler;
    cancellation_ = cancellation;
  }
private:
  void run() {
    try {
      auto protocolFactory = new TBinaryProtocolFactory!();
      auto processor = new TServiceProcessor!ExTestService(handler_);
      auto serverTransport = new TServerSocket(handler_.port);
      serverTransport.recvTimeout = dur!"seconds"(3);
      auto transportFactory = new TBufferedTransportFactory;

      auto server = new TSimpleServer(
        processor, serverTransport, transportFactory, protocolFactory);
      server.serve(cancellation_);
    } catch (Exception e) {
      writefln("Server thread on port %s failed: %s", handler_.port, e);
    }
  }

  TCancellation cancellation_;
  ExTestHandler handler_;
}

void main(string[] args) {
  bool trace;
  ushort port = 9090;
  getopt(args, "port", &port, "trace", &trace);

  auto serverCancellation = new TCancellationOrigin;
  scope (exit) serverCancellation.trigger();

  immutable ports = cast(immutable)array(map!"cast(ushort)a"(iota(port, port + 6)));

version (none) {
  // Cannot use this due to multiple DMD @@BUG@@s:
  // 1. »function D main is a nested function and cannot be accessed from array«
  //    when calling array() on the result of the outer map() – would have to
  //    manually do the eager evaluation/array conversion.
  // 2. »Zip.opSlice cannot get frame pointer to map« for the delay argument,
  //    can be worked around by calling array() on the map result first.
  // 3. Even when using the workarounds for the last two points, the DMD-built
  //    executable crashes when building without (sic!) inlining enabled,
  //    the backtrace points into the first delegate literal.
  auto handlers = array(map!((args){
    return new ExTestHandler(args._0, args._1, args._2, trace);
  })(zip(
    ports,
    map!((a){ return dur!`msecs`(a); })([1, 10, 100, 1, 10, 100]),
    [false, false, false, true, true, true]
  )));
} else {
  auto handlers = [
    new ExTestHandler(cast(ushort)(port + 0), dur!"msecs"(1), false, trace),
    new ExTestHandler(cast(ushort)(port + 1), dur!"msecs"(10), false, trace),
    new ExTestHandler(cast(ushort)(port + 2), dur!"msecs"(100), false, trace),
    new ExTestHandler(cast(ushort)(port + 3), dur!"msecs"(1), true, trace),
    new ExTestHandler(cast(ushort)(port + 4), dur!"msecs"(10), true, trace),
    new ExTestHandler(cast(ushort)(port + 5), dur!"msecs"(100), true, trace)
  ];
}

  // Fire up the server threads.
  foreach (h; handlers) (new ServerThread(h, serverCancellation)).start();

  // Give the servers some time to get up. This should really be accomplished
  // via a barrier here and in the preServe() hook.
  Thread.sleep(dur!"msecs"(10));

  syncClientPoolTest(ports, handlers);
  asyncClientPoolTest(ports, handlers);
  asyncFastestClientPoolTest(ports, handlers);
  asyncAggregatorTest(ports, handlers);
}


void syncClientPoolTest(const(ushort)[] ports, ExTestHandler[] handlers) {
  auto clients = array(map!((a){
    return cast(TClientBase!ExTestService)tClient!ExTestService(
      tBinaryProtocol(new TSocket("127.0.0.1", a))
    );
  })(ports));

  scope(exit) foreach (c; clients) c.outputProtocol.transport.close();

  // Try the case where the first client succeeds.
  {
    enforce(makePool(clients).getPort() == ports[0]);
  }

  // Try the case where all clients fail.
  {
    auto pool = makePool(clients[3 .. $]);
    auto e = cast(TCompoundOperationException)collectException(pool.getPort());
    enforce(e);
    enforce(equal(map!"a.port"(cast(TestServiceException[])e.exceptions),
      ports[3 .. $]));
  }

  // Try the case where the first clients fail, but a later one succeeds.
  {
    auto pool = makePool(clients[3 .. $] ~ clients[0 .. 3]);
    enforce(pool.getPortInArray() == [ports[0]]);
  }

  // Make sure a client is properly deactivated when it has failed too often.
  {
    auto pool = makePool(clients);
    pool.faultDisableCount = 1;
    pool.faultDisableDuration = dur!"msecs"(50);

    handlers[0].failing = true;
    enforce(pool.getPort() == ports[1]);

    handlers[0].failing = false;
    enforce(pool.getPort() == ports[1]);

    Thread.sleep(dur!"msecs"(50));
    enforce(pool.getPort() == ports[0]);
  }
}

auto makePool(TClientBase!ExTestService[] clients) {
  auto p = tClientPool(clients);
  p.permuteClients = false;
  p.rpcFaultFilter = (Exception e) {
    return (cast(TestServiceException)e !is null);
  };
  return p;
}


void asyncClientPoolTest(const(ushort)[] ports, ExTestHandler[] handlers) {
  auto manager = new TLibeventAsyncManager;
  scope (exit) manager.stop(dur!"hnsecs"(0));

  auto clients = makeAsyncClients(manager, ports);
  scope(exit) foreach (c; clients) c.transport.close();

  // Try the case where the first client succeeds.
  {
    enforce(makeAsyncPool(clients).getPort() == ports[0]);
  }

  // Try the case where all clients fail.
  {
    auto pool = makeAsyncPool(clients[3 .. $]);
    auto e = cast(TCompoundOperationException)collectException(pool.getPort().waitGet());
    enforce(e);
    enforce(equal(map!"a.port"(cast(TestServiceException[])e.exceptions),
      ports[3 .. $]));
  }

  // Try the case where the first clients fail, but a later one succeeds.
  {
    auto pool = makeAsyncPool(clients[3 .. $] ~ clients[0 .. 3]);
    enforce(pool.getPortInArray() == [ports[0]]);
  }

  // Make sure a client is properly deactivated when it has failed too often.
  {
    auto pool = makeAsyncPool(clients);
    pool.faultDisableCount = 1;
    pool.faultDisableDuration = dur!"msecs"(50);

    handlers[0].failing = true;
    enforce(pool.getPort() == ports[1]);

    handlers[0].failing = false;
    enforce(pool.getPort() == ports[1]);

    Thread.sleep(dur!"msecs"(50));
    enforce(pool.getPort() == ports[0]);
  }
}

auto makeAsyncPool(TAsyncClientBase!ExTestService[] clients) {
  auto p = tAsyncClientPool(clients);
  p.permuteClients = false;
  p.rpcFaultFilter = (Exception e) {
    return (cast(TestServiceException)e !is null);
  };
  return p;
}

auto makeAsyncClients(TLibeventAsyncManager manager, in ushort[] ports) {
  // DMD @@BUG@@ workaround: Using array on the lazyHandlers map result leads
  // to »function D main is a nested function and cannot be accessed from array«.
  // Thus, we manually do the array conversion.
  auto lazyClients = map!((a){
    return new TAsyncClient!ExTestService(
      new TAsyncSocket(manager, "127.0.0.1", a),
      new TBufferedTransportFactory,
      new TBinaryProtocolFactory!(TBufferedTransport)
    );
  })(ports);
  TAsyncClientBase!ExTestService[] clients;
  foreach (c; lazyClients) clients ~= c;
  return clients;
}


void asyncFastestClientPoolTest(const(ushort)[] ports, ExTestHandler[] handlers) {
  auto manager = new TLibeventAsyncManager;
  scope (exit) manager.stop(dur!"hnsecs"(0));

  auto clients = makeAsyncClients(manager, ports);
  scope(exit) foreach (c; clients) c.transport.close();

  // Make sure the fastest client wins, even if they are called in some other
  // order.
  {
    auto result = makeAsyncFastestPool(array(retro(clients))).getPort().waitGet();
    enforce(result == ports[0]);
  }

  // Try the case where all clients fail.
  {
    auto pool = makeAsyncFastestPool(clients[3 .. $]);
    auto e = cast(TCompoundOperationException)collectException(pool.getPort().waitGet());
    enforce(e);
    enforce(equal(map!"a.port"(cast(TestServiceException[])e.exceptions),
      ports[3 .. $]));
  }

  // Try the case where the first clients fail, but a later one succeeds.
  {
    auto pool = makeAsyncFastestPool(clients[1 .. $]);
    enforce(pool.getPortInArray() == [ports[1]]);
  }
}

auto makeAsyncFastestPool(TAsyncClientBase!ExTestService[] clients) {
  auto p = tAsyncFastestClientPool(clients);
  p.rpcFaultFilter = (Exception e) {
    return (cast(TestServiceException)e !is null);
  };
  return p;
}


void asyncAggregatorTest(const(ushort)[] ports, ExTestHandler[] handlers) {
  auto manager = new TLibeventAsyncManager;
  scope (exit) manager.stop(dur!"hnsecs"(0));

  auto clients = makeAsyncClients(manager, ports);
  scope(exit) foreach (c; clients) c.transport.close();

  auto aggregator = tAsyncAggregator(
    cast(TAsyncClientBase!ExTestService[])clients);

  // Test aggregator range interface.
  {
    auto range = aggregator.getPort().range(dur!"msecs"(50));
    enforce(equal(range, ports[0 .. 2][]));
    enforce(equal(map!"a.port"(cast(TestServiceException[])range.exceptions),
      ports[3 .. $ - 1]));
    enforce(range.completedCount == 4);
  }

  // Test default accumulator for scalars.
  {
    auto fullResult = aggregator.getPort().accumulate();
    enforce(fullResult.waitGet() == ports[0 .. 3]);

    auto partialResult = aggregator.getPort().accumulate();
    Thread.sleep(dur!"msecs"(20));
    enforce(partialResult.finishGet() == ports[0 .. 2]);

  }

  // Test default accumulator for arrays.
  {
    auto fullResult = aggregator.getPortInArray().accumulate();
    enforce(fullResult.waitGet() == ports[0 .. 3]);

    auto partialResult = aggregator.getPortInArray().accumulate();
    Thread.sleep(dur!"msecs"(20));
    enforce(partialResult.finishGet() == ports[0 .. 2]);
  }

  // Test custom accumulator.
  {
    auto fullResult = aggregator.getPort().accumulate!(function(int[] results){
      return reduce!"a + b"(results);
    })();
    enforce(fullResult.waitGet() == ports[0] + ports[1] + ports[2]);

    auto partialResult = aggregator.getPort().accumulate!(
      function(int[] results, Exception[] exceptions) {
        // Return a tuple of the parameters so we can check them outside of
        // this function (to verify the values, we need access to »ports«, but
        // due to DMD @@BUG5710@@, we can't use a delegate literal).f
        return tuple(results, exceptions);
      }
    )();
    Thread.sleep(dur!"msecs"(20));
    auto resultTuple = partialResult.finishGet();
    enforce(resultTuple._0 == ports[0 .. 2]);
    enforce(equal(map!"a.port"(cast(TestServiceException[])resultTuple._1),
      ports[3 .. $ - 1]));
  }
}
