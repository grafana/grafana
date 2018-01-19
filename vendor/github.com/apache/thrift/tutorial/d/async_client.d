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
module async_client;

import std.exception;
import std.stdio;
import thrift.async.libevent;
import thrift.async.socket;
import thrift.base;
import thrift.codegen.async_client;
import thrift.protocol.binary;
import thrift.transport.buffered;

import tutorial.Calculator;
import tutorial.tutorial_types;

void main() {
  auto asyncManager = new TLibeventAsyncManager;

  // If we are done, gracefully stop the async manager to avoid hanging on
  // appplication shutdown.
  scope (exit) asyncManager.stop();

  auto socket = new TAsyncSocket(asyncManager, "localhost", 9090);
  auto client = new TAsyncClient!Calculator(
    socket,
    new TBufferedTransportFactory,
    new TBinaryProtocolFactory!TBufferedTransport
  );

  socket.open();

  // Invoke all the methods.
  auto pingResult = client.ping();

  auto addResult = client.add(1, 1);

  auto work = Work();
  work.op = Operation.DIVIDE;
  work.num1 = 1;
  work.num2 = 0;
  auto quotientResult = client.calculate(1, work);

  work.op = Operation.SUBTRACT;
  work.num1 = 15;
  work.num2 = 10;
  auto diffResult = client.calculate(1, work);

  auto logResult = client.getStruct(1);

  // Await the responses.
  pingResult.waitGet();
  writeln("ping()");

  int sum = addResult.waitGet();
  writefln("1 + 1 = %s", sum);

  try {
    quotientResult.waitGet();
    writeln("Whoa we can divide by 0");
  } catch (InvalidOperation io) {
    writeln("Invalid operation: " ~ io.why);
  }

  writefln("15 - 10 = %s", diffResult.waitGet());

  // TFuture is implicitly convertible to the result type via »alias this«,
  // for which it (eagerly, of course) awaits completion.
  writefln("Check log: %s", logResult.value);
}
