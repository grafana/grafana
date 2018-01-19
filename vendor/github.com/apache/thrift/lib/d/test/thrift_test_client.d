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
module thrift_test_client;

import std.conv;
import std.datetime;
import std.exception : enforce;
import std.getopt;
import std.stdio;
import std.string;
import std.traits;
import thrift.base;
import thrift.codegen.client;
import thrift.protocol.base;
import thrift.protocol.binary;
import thrift.protocol.compact;
import thrift.protocol.json;
import thrift.transport.base;
import thrift.transport.buffered;
import thrift.transport.framed;
import thrift.transport.http;
import thrift.transport.socket;
import thrift.transport.ssl;
import thrift.util.hashset;

import thrift_test_common;
import thrift.test.ThriftTest;
import thrift.test.ThriftTest_types;

enum TransportType {
  buffered,
  framed,
  http,
  raw
}

TProtocol createProtocol(T)(T trans, ProtocolType type) {
  final switch (type) {
    case ProtocolType.binary:
      return tBinaryProtocol(trans);
    case ProtocolType.compact:
      return tCompactProtocol(trans);
    case ProtocolType.json:
      return tJsonProtocol(trans);
  }
}

void main(string[] args) {
  string host = "localhost";
  ushort port = 9090;
  uint numTests = 1;
  bool ssl;
  ProtocolType protocolType;
  TransportType transportType;
  bool trace;

  getopt(args,
    "numTests|n", &numTests,
    "protocol", &protocolType,
    "ssl", &ssl,
    "transport", &transportType,
    "trace", &trace,
    "port", &port,
    "host", (string _, string value) {
      auto parts = split(value, ":");
      if (parts.length > 1) {
        // IPv6 addresses can contain colons, so take the last part for the
        // port.
        host = join(parts[0 .. $ - 1], ":");
        port = to!ushort(parts[$ - 1]);
      } else {
        host = value;
      }
    }
  );
  port = to!ushort(port);

  TSocket socket;
  if (ssl) {
    auto sslContext = new TSSLContext();
    sslContext.ciphers = "ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH";
    sslContext.authenticate = true;
    sslContext.loadTrustedCertificates("../../../test/keys/CA.pem");
    socket = new TSSLSocket(sslContext, host, port);
  } else {
    socket = new TSocket(host, port);
  }

  TProtocol protocol;
  final switch (transportType) {
    case TransportType.buffered:
      protocol = createProtocol(new TBufferedTransport(socket), protocolType);
      break;
    case TransportType.framed:
      protocol = createProtocol(new TFramedTransport(socket), protocolType);
      break;
    case TransportType.http:
      protocol = createProtocol(
        new TClientHttpTransport(socket, host, "/service"), protocolType);
      break;
    case TransportType.raw:
      protocol = createProtocol(socket, protocolType);
      break;
  }

  auto client = tClient!ThriftTest(protocol);

  ulong time_min;
  ulong time_max;
  ulong time_tot;

  StopWatch sw;
  foreach(test; 0 .. numTests) {
    sw.start();

    protocol.transport.open();

    if (trace) writefln("Test #%s, connect %s:%s", test + 1, host, port);

    if (trace) write("testVoid()");
    client.testVoid();
    if (trace) writeln(" = void");

    if (trace) write("testString(\"Test\")");
    string s = client.testString("Test");
    if (trace) writefln(" = \"%s\"", s);
    enforce(s == "Test");

    if (trace) write("testByte(1)");
    byte u8 = client.testByte(1);
    if (trace) writefln(" = %s", u8);
    enforce(u8 == 1);

    if (trace) write("testI32(-1)");
    int i32 = client.testI32(-1);
    if (trace) writefln(" = %s", i32);
    enforce(i32 == -1);

    if (trace) write("testI64(-34359738368)");
    long i64 = client.testI64(-34359738368L);
    if (trace) writefln(" = %s", i64);
    enforce(i64 == -34359738368L);

    if (trace) write("testDouble(-5.2098523)");
    double dub = client.testDouble(-5.2098523);
    if (trace) writefln(" = %s", dub);
    enforce(dub == -5.2098523);

	// TODO: add testBinary() call
	
    Xtruct out1;
    out1.string_thing = "Zero";
    out1.byte_thing = 1;
    out1.i32_thing = -3;
    out1.i64_thing = -5;
    if (trace) writef("testStruct(%s)", out1);
    auto in1 = client.testStruct(out1);
    if (trace) writefln(" = %s", in1);
    enforce(in1 == out1);

    if (trace) write("testNest({1, {\"Zero\", 1, -3, -5}), 5}");
    Xtruct2 out2;
    out2.byte_thing = 1;
    out2.struct_thing = out1;
    out2.i32_thing = 5;
    auto in2 = client.testNest(out2);
    in1 = in2.struct_thing;
    if (trace) writefln(" = {%s, {\"%s\", %s, %s, %s}, %s}", in2.byte_thing,
      in1.string_thing, in1.byte_thing, in1.i32_thing, in1.i64_thing,
      in2.i32_thing);
    enforce(in2 == out2);

    int[int] mapout;
    for (int i = 0; i < 5; ++i) {
      mapout[i] = i - 10;
    }
    if (trace) writef("testMap({%s})", mapout);
    auto mapin = client.testMap(mapout);
    if (trace) writefln(" = {%s}", mapin);
    enforce(mapin == mapout);

    auto setout = new HashSet!int;
    for (int i = -2; i < 3; ++i) {
      setout ~= i;
    }
    if (trace) writef("testSet(%s)", setout);
    auto setin = client.testSet(setout);
    if (trace) writefln(" = %s", setin);
    enforce(setin == setout);

    int[] listout;
    for (int i = -2; i < 3; ++i) {
      listout ~= i;
    }
    if (trace) writef("testList(%s)", listout);
    auto listin = client.testList(listout);
    if (trace) writefln(" = %s", listin);
    enforce(listin == listout);

    {
      if (trace) write("testEnum(ONE)");
      auto ret = client.testEnum(Numberz.ONE);
      if (trace) writefln(" = %s", ret);
      enforce(ret == Numberz.ONE);

      if (trace) write("testEnum(TWO)");
      ret = client.testEnum(Numberz.TWO);
      if (trace) writefln(" = %s", ret);
      enforce(ret == Numberz.TWO);

      if (trace) write("testEnum(THREE)");
      ret = client.testEnum(Numberz.THREE);
      if (trace) writefln(" = %s", ret);
      enforce(ret == Numberz.THREE);

      if (trace) write("testEnum(FIVE)");
      ret = client.testEnum(Numberz.FIVE);
      if (trace) writefln(" = %s", ret);
      enforce(ret == Numberz.FIVE);

      if (trace) write("testEnum(EIGHT)");
      ret = client.testEnum(Numberz.EIGHT);
      if (trace) writefln(" = %s", ret);
      enforce(ret == Numberz.EIGHT);
    }

    if (trace) write("testTypedef(309858235082523)");
    UserId uid = client.testTypedef(309858235082523L);
    if (trace) writefln(" = %s", uid);
    enforce(uid == 309858235082523L);

    if (trace) write("testMapMap(1)");
    auto mm = client.testMapMap(1);
    if (trace) writefln(" = {%s}", mm);
    // Simply doing == doesn't seem to work for nested AAs.
    foreach (key, value; mm) {
      enforce(testMapMapReturn[key] == value);
    }
    foreach (key, value; testMapMapReturn) {
      enforce(mm[key] == value);
    }

    Insanity insane;
    insane.userMap[Numberz.FIVE] = 5000;
    Xtruct truck;
    truck.string_thing = "Truck";
    truck.byte_thing = 8;
    truck.i32_thing = 8;
    truck.i64_thing = 8;
    insane.xtructs ~= truck;
    if (trace) write("testInsanity()");
    auto whoa = client.testInsanity(insane);
    if (trace) writefln(" = %s", whoa);

    // Commented for now, this is cumbersome to write without opEqual getting
    // called on AA comparison.
    // enforce(whoa == testInsanityReturn);

    {
      try {
        if (trace) write("client.testException(\"Xception\") =>");
        client.testException("Xception");
        if (trace) writeln("  void\nFAILURE");
        throw new Exception("testException failed.");
      } catch (Xception e) {
        if (trace) writefln("  {%s, \"%s\"}", e.errorCode, e.message);
      }

      try {
        if (trace) write("client.testException(\"TException\") =>");
        client.testException("Xception");
        if (trace) writeln("  void\nFAILURE");
        throw new Exception("testException failed.");
      } catch (TException e) {
        if (trace) writefln("  {%s}", e.msg);
      }

      try {
        if (trace) write("client.testException(\"success\") =>");
        client.testException("success");
        if (trace) writeln("  void");
      } catch (Exception e) {
        if (trace) writeln("  exception\nFAILURE");
        throw new Exception("testException failed.");
      }
    }

    {
      try {
        if (trace) write("client.testMultiException(\"Xception\", \"test 1\") =>");
        auto result = client.testMultiException("Xception", "test 1");
        if (trace) writeln("  result\nFAILURE");
        throw new Exception("testMultiException failed.");
      } catch (Xception e) {
        if (trace) writefln("  {%s, \"%s\"}", e.errorCode, e.message);
      }

      try {
        if (trace) write("client.testMultiException(\"Xception2\", \"test 2\") =>");
        auto result = client.testMultiException("Xception2", "test 2");
        if (trace) writeln("  result\nFAILURE");
        throw new Exception("testMultiException failed.");
      } catch (Xception2 e) {
        if (trace) writefln("  {%s, {\"%s\"}}",
          e.errorCode, e.struct_thing.string_thing);
      }

      try {
        if (trace) writef("client.testMultiException(\"success\", \"test 3\") =>");
        auto result = client.testMultiException("success", "test 3");
        if (trace) writefln("  {{\"%s\"}}", result.string_thing);
      } catch (Exception e) {
        if (trace) writeln("  exception\nFAILURE");
        throw new Exception("testMultiException failed.");
      }
    }

    // Do not run oneway test when doing multiple iterations, as it blocks the
    // server for three seconds.
    if (numTests == 1) {
      if (trace) writef("client.testOneway(3) =>");
      auto onewayWatch = StopWatch(AutoStart.yes);
      client.testOneway(3);
      onewayWatch.stop();
      if (onewayWatch.peek().msecs > 200) {
        if (trace) {
          writefln("  FAILURE - took %s ms", onewayWatch.peek().usecs / 1000.0);
        }
        throw new Exception("testOneway failed.");
      } else {
        if (trace) {
          writefln("  success - took %s ms", onewayWatch.peek().usecs / 1000.0);
        }
      }

      // Redo a simple test after the oneway to make sure we aren't "off by
      // one", which would be the case if the server treated oneway methods
      // like normal ones.
      if (trace) write("re-test testI32(-1)");
      i32 = client.testI32(-1);
      if (trace) writefln(" = %s", i32);
    }

    // Time metering.
    sw.stop();

    immutable tot = sw.peek().usecs;
    if (trace) writefln("Total time: %s us\n", tot);

    time_tot += tot;
    if (time_min == 0 || tot < time_min) {
      time_min = tot;
    }
    if (tot > time_max) {
      time_max = tot;
    }
    protocol.transport.close();

    sw.reset();
  }

  writeln("All tests done.");

  if (numTests > 1) {
    auto time_avg = time_tot / numTests;
    writefln("Min time: %s us", time_min);
    writefln("Max time: %s us", time_max);
    writefln("Avg time: %s us", time_avg);
  }
}
