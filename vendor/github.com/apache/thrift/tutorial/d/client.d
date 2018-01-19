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
module client;

import std.stdio;
import thrift.base;
import thrift.codegen.client;
import thrift.protocol.binary;
import thrift.transport.buffered;
import thrift.transport.socket;

import tutorial.Calculator;
import tutorial.tutorial_types;

void main() {
  auto socket = new TSocket("localhost", 9090);
  auto transport = new TBufferedTransport(socket);
  auto protocol = tBinaryProtocol(transport);
  auto client = tClient!Calculator(protocol);

  transport.open();

  client.ping();
  writeln("ping()");

  int sum = client.add(1, 1);
  writefln("1 + 1 = %s", sum);

  auto work = Work();
  work.op = Operation.DIVIDE;
  work.num1 = 1;
  work.num2 = 0;
  try {
    int quotient = client.calculate(1, work);
    writeln("Whoa we can divide by 0");
  } catch (InvalidOperation io) {
    writeln("Invalid operation: " ~ io.why);
  }

  work.op = Operation.SUBTRACT;
  work.num1 = 15;
  work.num2 = 10;
  int diff = client.calculate(1, work);
  writefln("15 - 10 = %s", diff);

  auto log = client.getStruct(1);
  writefln("Check log: %s", log.value);
}
