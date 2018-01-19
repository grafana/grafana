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
module server;

import std.conv : to;
import std.stdio;
import thrift.codegen.processor;
import thrift.protocol.binary;
import thrift.server.simple;
import thrift.server.transport.socket;
import thrift.transport.buffered;

import share.SharedService;
import share.shared_types;
import tutorial.Calculator;
import tutorial.tutorial_types;

/**
 * The actual implementation of the Calculator interface that is called by
 * the server to answer the requests.
 */
class CalculatorHandler : Calculator {
  void ping() {
    writeln("ping()");
  }

  int add(int n1, int n2) {
    writefln("add(%s,%s)", n1, n2);
    return n1 + n2;
  }

  int calculate(int logid, ref const(Work) work) {
    writefln("calculate(%s, {%s, %s, %s})", logid, work.op, work.num1, work.num2);
    int val;

    switch (work.op) {
    case Operation.ADD:
      val = work.num1 + work.num2;
      break;
    case Operation.SUBTRACT:
      val = work.num1 - work.num2;
      break;
    case Operation.MULTIPLY:
      val = work.num1 * work.num2;
      break;
    case Operation.DIVIDE:
      if (work.num2 == 0) {
        auto io = new InvalidOperation();
        io.whatOp = work.op;
        io.why = "Cannot divide by 0";
        throw io;
      }
      val = work.num1 / work.num2;
      break;
    default:
      auto io = new InvalidOperation();
      io.whatOp = work.op;
      io.why = "Invalid Operation";
      throw io;
    }

    auto ss = SharedStruct();
    ss.key = logid;
    ss.value = to!string(val);
    log[logid] = ss;

    return val;
  }

  SharedStruct getStruct(int logid) {
    writefln("getStruct(%s)", logid);
    return log[logid];
  }

  void zip() {
    writeln("zip()");
  }

protected:
  SharedStruct[int] log;
}

void main() {
  auto protocolFactory = new TBinaryProtocolFactory!();
  auto processor = new TServiceProcessor!Calculator(new CalculatorHandler);
  auto serverTransport = new TServerSocket(9090);
  auto transportFactory = new TBufferedTransportFactory;

  auto server = new TSimpleServer(
    processor, serverTransport, transportFactory, protocolFactory);

  writeln("Starting the server on port 9090...");
  server.serve();
  writeln("done.");
}
