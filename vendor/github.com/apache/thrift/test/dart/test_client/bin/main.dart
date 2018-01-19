/// Licensed to the Apache Software Foundation (ASF) under one
/// or more contributor license agreements. See the NOTICE file
/// distributed with this work for additional information
/// regarding copyright ownership. The ASF licenses this file
/// to you under the Apache License, Version 2.0 (the
/// 'License'); you may not use this file except in compliance
/// with the License. You may obtain a copy of the License at
///
/// http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
/// KIND, either express or implied. See the License for the
/// specific language governing permissions and limitations
/// under the License.

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:args/args.dart';
import 'package:collection/collection.dart';
import 'package:http/http.dart' as http;
import 'package:thrift/thrift.dart';
import 'package:thrift/thrift_console.dart';
import 'package:thrift_test/thrift_test.dart';

const TEST_BASETYPES = 1; // 0000 0001
const TEST_STRUCTS = 2; // 0000 0010
const TEST_CONTAINERS = 4; // 0000 0100
const TEST_EXCEPTIONS = 8; // 0000 1000
const TEST_UNKNOWN = 64; // 0100 0000 (Failed to prepare environemt etc.)
const TEST_TIMEOUT = 128; // 1000 0000
const TEST_NOTUSED = 48; // 0011 0000 (reserved bits)

typedef Future FutureFunction();

class TTest {
  final int errorCode;
  final String name;
  final FutureFunction func;

  TTest(this.errorCode, this.name, this.func);
}

class TTestError extends Error {
  final actual;
  final expected;

  TTestError(this.actual, this.expected);

  String toString() => '$actual != $expected';
}

List<TTest> _tests;
ThriftTestClient client;
bool verbose;

/// Adapted from TestClient.php
main(List<String> args) async {
  ArgResults results = _parseArgs(args);

  if (results == null) {
    exit(TEST_UNKNOWN);
  }

  verbose = results['verbose'] == true;

  await _initTestClient(
      host: results['host'],
      port: int.parse(results['port']),
      transportType: results['transport'],
      protocolType: results['protocol']).catchError((e) {
    stdout.writeln('Error:');
    stdout.writeln('$e');
    if (e is Error) {
      stdout.writeln('${e.stackTrace}');
    }
    exit(TEST_UNKNOWN);
  });

  // run tests
  _tests = _createTests();

  int result = 0;

  for (TTest test in _tests) {
    if (verbose) stdout.write('${test.name}... ');
    try {
      await test.func();
      if (verbose) stdout.writeln('success!');
    } catch (e) {
      if (verbose) stdout.writeln('$e');
      result = result | test.errorCode;
    }
  }

  exit(result);
}

ArgResults _parseArgs(List<String> args) {
  var parser = new ArgParser();
  parser.addOption('host', defaultsTo: 'localhost', help: 'The server host');
  parser.addOption('port', defaultsTo: '9090', help: 'The port to connect to');
  parser.addOption('transport',
      defaultsTo: 'buffered',
      allowed: ['buffered', 'framed', 'http'],
      help: 'The transport name',
      allowedHelp: {
        'buffered': 'TBufferedTransport',
        'framed': 'TFramedTransport'
      });
  parser.addOption('protocol',
      defaultsTo: 'binary',
      allowed: ['binary', 'compact', 'json'],
      help: 'The protocol name',
      allowedHelp: {
        'binary': 'TBinaryProtocol',
        'compact': 'TCompactProtocol',
        'json': 'TJsonProtocol'
      });
  parser.addFlag('verbose', defaultsTo: false);

  ArgResults results;
  try {
    results = parser.parse(args);
  } catch (e) {
    stdout.writeln('$e\n');
  }

  if (results == null) stdout.write(parser.usage);

  return results;
}

TProtocolFactory getProtocolFactory(String protocolType) {
  if (protocolType == 'binary') {
    return new TBinaryProtocolFactory();
  } else if (protocolType == 'compact') {
    return new TCompactProtocolFactory();
  } else if (protocolType == 'json') {
    return new TJsonProtocolFactory();
  }

  throw new ArgumentError.value(protocolType);
}

Future _initTestClient(
    {String host, int port, String transportType, String protocolType}) async {
  TTransport transport;
  var protocolFactory = getProtocolFactory(protocolType);

  if (transportType == 'http') {
    var httpClient = new http.IOClient();
    var uri = Uri.parse('http://$host:$port');
    var config = new THttpConfig(uri, {});
    transport = new THttpClientTransport(httpClient, config);
  } else {
    var socket = await Socket.connect(host, port);
    transport = new TClientSocketTransport(new TTcpSocket(socket));
    if (transportType == 'framed') {
      transport = new TFramedTransport(transport);
    }
  }

  var protocol = protocolFactory.getProtocol(transport);
  client = new ThriftTestClient(protocol);

  await transport.open();
}

List<TTest> _createTests() {
  List<TTest> tests = [];

  var xtruct = new Xtruct()
    ..string_thing = 'Zero'
    ..byte_thing = 1
    ..i32_thing = -3
    ..i64_thing = -5;

  tests.add(new TTest(TEST_BASETYPES, 'testVoid', () async {
    await client.testVoid();
  }));

  tests.add(new TTest(TEST_BASETYPES, 'testString', () async {
    var input = 'Test';
    var result = await client.testString(input);
    if (result != input) throw new TTestError(result, input);
  }));

  tests.add(new TTest(TEST_BASETYPES, 'testBool', () async {
    var input = true;
    var result = await client.testBool(input);
    if (result != input) throw new TTestError(result, input);
  }));

  tests.add(new TTest(TEST_BASETYPES, 'testByte', () async {
    var input = 64;
    var result = await client.testByte(input);
    if (result != input) throw new TTestError(result, input);
  }));

  tests.add(new TTest(TEST_BASETYPES, 'testI32', () async {
    var input = 2147483647;
    var result = await client.testI32(input);
    if (result != input) throw new TTestError(result, input);
  }));

  tests.add(new TTest(TEST_BASETYPES, 'testI64', () async {
    var input = 9223372036854775807;
    var result = await client.testI64(input);
    if (result != input) throw new TTestError(result, input);
  }));

  tests.add(new TTest(TEST_BASETYPES, 'testDouble', () async {
    var input = 3.1415926;
    var result = await client.testDouble(input);
    if (result != input) throw new TTestError(result, input);
  }));

  tests.add(new TTest(TEST_BASETYPES, 'testBinary', () async {
    var utf8Codec = const Utf8Codec();
    var input = utf8Codec.encode('foo');
    var result = await client.testBinary(input);
    var equality = const ListEquality();
    if (!equality.equals(result, input)) throw new TTestError(result, input);
  }));

  tests.add(new TTest(TEST_CONTAINERS, 'testStruct', () async {
    var result = await client.testStruct(xtruct);
    if ('$result' != '$xtruct') throw new TTestError(result, xtruct);
  }));

  tests.add(new TTest(TEST_CONTAINERS, 'testNest', () async {
    var input = new Xtruct2()
      ..byte_thing = 1
      ..struct_thing = xtruct
      ..i32_thing = -3;

    var result = await client.testNest(input);
    if ('$result' != '$input') throw new TTestError(result, input);
  }));

  tests.add(new TTest(TEST_CONTAINERS, 'testMap', () async {
    Map<int, int> input = {1: -10, 2: -9, 3: -8, 4: -7, 5: -6};

    var result = await client.testMap(input);
    var equality = const MapEquality();
    if (!equality.equals(result, input)) throw new TTestError(result, input);
  }));

  tests.add(new TTest(TEST_CONTAINERS, 'testSet', () async {
    var input = new Set<int>.from([-2, -1, 0, 1, 2]);
    var result = await client.testSet(input);
    var equality = const SetEquality();
    if (!equality.equals(result, input)) throw new TTestError(result, input);
  }));

  tests.add(new TTest(TEST_CONTAINERS, 'testList', () async {
    var input = [-2, -1, 0, 1, 2];
    var result = await client.testList(input);
    var equality = const ListEquality();
    if (!equality.equals(result, input)) throw new TTestError(result, input);
  }));

  tests.add(new TTest(TEST_CONTAINERS, 'testEnum', () async {
    await _testEnum(Numberz.ONE);
    await _testEnum(Numberz.TWO);
    await _testEnum(Numberz.THREE);
    await _testEnum(Numberz.FIVE);
    await _testEnum(Numberz.EIGHT);
  }));

  tests.add(new TTest(TEST_BASETYPES, 'testTypedef', () async {
    var input = 309858235082523;
    var result = await client.testTypedef(input);
    if (result != input) throw new TTestError(result, input);
  }));

  tests.add(new TTest(TEST_CONTAINERS, 'testMapMap', () async {
    Map<int, Map<int, int>> result = await client.testMapMap(1);
    if (result.isEmpty || result[result.keys.first].isEmpty) {
      throw new TTestError(result, 'Map<int, Map<int, int>>');
    }
  }));

  tests.add(new TTest(TEST_CONTAINERS, 'testInsanity', () async {
    var input = new Insanity();
    input.userMap = {Numberz.FIVE: 5000};
    input.xtructs = [xtruct];

    Map<int, Map<int, Insanity>> result = await client.testInsanity(input);
    if (result.isEmpty || result[result.keys.first].isEmpty) {
      throw new TTestError(result, 'Map<int, Map<int, Insanity>>');
    }
  }));

  tests.add(new TTest(TEST_CONTAINERS, 'testMulti', () async {
    var input = new Xtruct()
      ..string_thing = 'Hello2'
      ..byte_thing = 123
      ..i32_thing = 456
      ..i64_thing = 789;

    var result = await client.testMulti(input.byte_thing, input.i32_thing,
        input.i64_thing, {1: 'one'}, Numberz.EIGHT, 5678);
    if ('$result' != '$input') throw new TTestError(result, input);
  }));

  tests.add(new TTest(TEST_EXCEPTIONS, 'testException', () async {
    try {
      await client.testException('Xception');
    } on Xception catch (_) {
      return;
    }

    throw new TTestError(null, 'Xception');
  }));

  tests.add(new TTest(TEST_EXCEPTIONS, 'testMultiException', () async {
    try {
      await client.testMultiException('Xception2', 'foo');
    } on Xception2 catch (_) {
      return;
    }

    throw new TTestError(null, 'Xception2');
  }));

  return tests;
}

Future _testEnum(int input) async {
  var result = await client.testEnum(input);
  if (result != input) throw new TTestError(result, input);
}
