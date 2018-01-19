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
module thrift_test_server;

import core.thread : dur, Thread;
import std.algorithm;
import std.exception : enforce;
import std.getopt;
import std.parallelism : totalCPUs;
import std.string;
import std.stdio;
import std.typetuple : TypeTuple, staticMap;
import thrift.base;
import thrift.codegen.processor;
import thrift.protocol.base;
import thrift.protocol.binary;
import thrift.protocol.compact;
import thrift.protocol.json;
import thrift.server.base;
import thrift.server.transport.socket;
import thrift.server.transport.ssl;
import thrift.transport.base;
import thrift.transport.buffered;
import thrift.transport.framed;
import thrift.transport.http;
import thrift.transport.ssl;
import thrift.util.hashset;
import test_utils;

import thrift_test_common;
import thrift.test.ThriftTest_types;
import thrift.test.ThriftTest;

class TestHandler : ThriftTest {
  this(bool trace) {
    trace_ = trace;
  }

  override void testVoid() {
    if (trace_) writeln("testVoid()");
  }

  override string testString(string thing) {
    if (trace_) writefln("testString(\"%s\")", thing);
    return thing;
  }

  override byte testByte(byte thing) {
    if (trace_) writefln("testByte(%s)", thing);
    return thing;
  }

  override int testI32(int thing) {
    if (trace_) writefln("testI32(%s)", thing);
    return thing;
  }

  override long testI64(long thing) {
    if (trace_) writefln("testI64(%s)", thing);
    return thing;
  }

  override double testDouble(double thing) {
    if (trace_) writefln("testDouble(%s)", thing);
    return thing;
  }

  override string testBinary(string thing) {
    if (trace_) writefln("testBinary(\"%s\")", thing);
    return thing;
  }

  override bool testBool(bool thing) {
    if (trace_) writefln("testBool(\"%s\")", thing);
    return thing;
  }

  override Xtruct testStruct(ref const(Xtruct) thing) {
    if (trace_) writefln("testStruct({\"%s\", %s, %s, %s})",
      thing.string_thing, thing.byte_thing, thing.i32_thing, thing.i64_thing);
    return thing;
  }

  override Xtruct2 testNest(ref const(Xtruct2) nest) {
    auto thing = nest.struct_thing;
    if (trace_) writefln("testNest({%s, {\"%s\", %s, %s, %s}, %s})",
      nest.byte_thing, thing.string_thing, thing.byte_thing, thing.i32_thing,
      thing.i64_thing, nest.i32_thing);
    return nest;
  }

  override int[int] testMap(int[int] thing) {
    if (trace_) writefln("testMap({%s})", thing);
    return thing;
  }

  override HashSet!int testSet(HashSet!int thing) {
    if (trace_) writefln("testSet({%s})",
      join(map!`to!string(a)`(thing[]), ", "));
    return thing;
  }

  override int[] testList(int[] thing) {
    if (trace_) writefln("testList(%s)", thing);
    return thing;
  }

  override Numberz testEnum(Numberz thing) {
    if (trace_) writefln("testEnum(%s)", thing);
    return thing;
  }

  override UserId testTypedef(UserId thing) {
    if (trace_) writefln("testTypedef(%s)", thing);
    return thing;
  }

  override string[string] testStringMap(string[string] thing) {
    if (trace_) writefln("testStringMap(%s)", thing);
    return thing;
  }

  override int[int][int] testMapMap(int hello) {
    if (trace_) writefln("testMapMap(%s)", hello);
    return testMapMapReturn;
  }

  override Insanity[Numberz][UserId] testInsanity(ref const(Insanity) argument) {
    if (trace_) writeln("testInsanity()");
    Insanity[Numberz][UserId] ret;
    Insanity[Numberz] m1;
    Insanity[Numberz] m2;
    Insanity tmp;
    tmp = cast(Insanity)argument;
    m1[Numberz.TWO] = tmp;
    m1[Numberz.THREE] = tmp;
    m2[Numberz.SIX] = Insanity();
    ret[1] = m1;
    ret[2] = m2;
    return ret;
  }

  override Xtruct testMulti(byte arg0, int arg1, long arg2, string[short] arg3,
    Numberz arg4, UserId arg5)
  {
    if (trace_) writeln("testMulti()");
    return Xtruct("Hello2", arg0, arg1, arg2);
  }

  override void testException(string arg) {
    if (trace_) writefln("testException(%s)", arg);
    if (arg == "Xception") {
      auto e = new Xception();
      e.errorCode = 1001;
      e.message = arg;
      throw e;
    } else if (arg == "TException") {
      throw new TException();
    } else if (arg == "ApplicationException") {
      throw new TException();
    }
  }

  override Xtruct testMultiException(string arg0, string arg1) {
    if (trace_) writefln("testMultiException(%s, %s)", arg0, arg1);

    if (arg0 == "Xception") {
      auto e = new Xception();
      e.errorCode = 1001;
      e.message = "This is an Xception";
      throw e;
    } else if (arg0 == "Xception2") {
      auto e = new Xception2();
      e.errorCode = 2002;
      e.struct_thing.string_thing = "This is an Xception2";
      throw e;
    } else {
      return Xtruct(arg1);
    }
  }

  override void testOneway(int sleepFor) {
    if (trace_) writefln("testOneway(%s): Sleeping...", sleepFor);
    Thread.sleep(dur!"seconds"(sleepFor));
    if (trace_) writefln("testOneway(%s): done sleeping!", sleepFor);
  }

private:
  bool trace_;
}

void main(string[] args) {
  ushort port = 9090;
  ServerType serverType;
  ProtocolType protocolType;
  size_t numIOThreads = 1;
  TransportType transportType;
  bool ssl;
  bool trace;
  size_t taskPoolSize = totalCPUs;

  getopt(args, "port", &port, "protocol", &protocolType, "server-type",
    &serverType, "ssl", &ssl, "num-io-threads", &numIOThreads,
    "task-pool-size", &taskPoolSize, "trace", &trace,
    "transport", &transportType);

  if (serverType == ServerType.nonblocking ||
    serverType == ServerType.pooledNonblocking
  ) {
    enforce(transportType == TransportType.framed,
      "Need to use framed transport with non-blocking server.");
    enforce(!ssl, "The non-blocking server does not support SSL yet.");

    // Don't wrap the contents into another layer of framing.
    transportType = TransportType.raw;
  }

  version (ThriftTestTemplates) {
    // Only exercise the specialized template code paths if explicitly enabled
    // to reduce memory consumption on regular test suite runs – there should
    // not be much that can go wrong with that specifically anyway.
    alias TypeTuple!(TBufferedTransport, TFramedTransport, TServerHttpTransport)
      AvailableTransports;
    alias TypeTuple!(
      staticMap!(TBinaryProtocol, AvailableTransports),
      staticMap!(TCompactProtocol, AvailableTransports)
    ) AvailableProtocols;
  } else {
    alias TypeTuple!() AvailableTransports;
    alias TypeTuple!() AvailableProtocols;
  }

  TProtocolFactory protocolFactory;
  final switch (protocolType) {
    case ProtocolType.binary:
      protocolFactory = new TBinaryProtocolFactory!AvailableTransports;
      break;
    case ProtocolType.compact:
      protocolFactory = new TCompactProtocolFactory!AvailableTransports;
      break;
    case ProtocolType.json:
      protocolFactory = new TJsonProtocolFactory!AvailableTransports;
      break;
  }

  auto processor = new TServiceProcessor!(ThriftTest, AvailableProtocols)(
    new TestHandler(trace));

  TServerSocket serverSocket;
  if (ssl) {
    auto sslContext = new TSSLContext();
    sslContext.serverSide = true;
    sslContext.loadCertificate("../../../test/keys/server.crt");
    sslContext.loadPrivateKey("../../../test/keys/server.key");
    sslContext.ciphers = "ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH";
    serverSocket = new TSSLServerSocket(port, sslContext);
  } else {
    serverSocket = new TServerSocket(port);
  }

  auto transportFactory = createTransportFactory(transportType);

  auto server = createServer(serverType, numIOThreads, taskPoolSize,
    processor, serverSocket, transportFactory, protocolFactory);

  writefln("Starting %s/%s %s ThriftTest server %son port %s...", protocolType,
    transportType, serverType, ssl ? "(using SSL) ": "", port);
  server.serve();
  writeln("done.");
}
