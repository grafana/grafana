/// Licensed to the Apache Software Foundation (ASF) under one
/// or more contributor license agreements. See the NOTICE file
/// distributed with this work for additional information
/// regarding copyright ownership. The ASF licenses this file
/// to you under the Apache License, Version 2.0 (the
/// "License"); you may not use this file except in compliance
/// with the License. You may obtain a copy of the License at
///
/// http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
/// KIND, either express or implied. See the License for the
/// specific language governing permissions and limitations
/// under the License.

import 'dart:async';
import 'dart:io';

import 'package:args/args.dart';
import 'package:logging/logging.dart';
import 'package:thrift/thrift.dart';
import 'package:thrift/thrift_console.dart';
import 'package:tutorial/tutorial.dart';

TTransport _transport;
Calculator _calculator;
int logid = 0;

const Map<String, int> operationLookup = const {
  '+': Operation.ADD,
  '-': Operation.SUBTRACT,
  '*': Operation.MULTIPLY,
  '/': Operation.DIVIDE
};

main(List<String> args) {
  Logger.root.level = Level.ALL;
  Logger.root.onRecord.listen((LogRecord rec) {
    print('${rec.level.name}: ${rec.time}: ${rec.message}');
  });

  var parser = new ArgParser();
  parser.addOption('port', defaultsTo: '9090', help: 'The port to connect to');

  ArgResults results;
  try {
    results = parser.parse(args);
  } catch (e) {
    results = null;
  }

  if (results == null) {
    print(parser.usage);
    exit(0);
  }

  int port = int.parse(results['port']);

  _initConnection(port).then((_) => _run());
}

Future _initConnection(int port) async {
  var socket = await Socket.connect('127.0.0.1', port);
  _transport = new TAsyncClientSocketTransport(
      new TTcpSocket(socket), new TMessageReader(new TBinaryProtocolFactory()));
  TProtocol protocol = new TBinaryProtocol(_transport);
  await _transport.open();

  _calculator = new CalculatorClient(protocol);
}

Future _run() async {
  _help();

  while (true) {
    stdout.write("> ");
    var input = stdin.readLineSync();
    var parts = input.split(' ');
    var command = parts[0];
    var args = parts.length > 1 ? parts.sublist(1) : [];

    switch (command) {
      case 'ping':
        await _ping();
        break;

      case 'add':
        await _add(int.parse(args[0]), int.parse(args[1]));
        break;

      case 'calc':
        int op = operationLookup[args[1]];
        if (!Operation.VALID_VALUES.contains(op)) {
          stdout.writeln('Unknown operator ${args[1]}');
          break;
        }

        var work = new Work()
          ..num1 = int.parse(args[0])
          ..op = op
          ..num2 = int.parse(args[2])
          ..comment = args.length > 3 ? args[3] : '';

        await _calc(work);
        break;

      case 'struct':
        await _struct(int.parse(args[0]));
        break;

      case 'help':
      default:
        _help();
        break;
    }
  }
}

void _help() {
  stdout.writeln('Commands:');
  stdout.writeln('  help');
  stdout.writeln('  ping');
  stdout.writeln('  add x y');
  stdout.writeln('  calc x op y [comment]');
  stdout.writeln('  struct id');
  stdout.writeln('');
}

Future _ping() async {
  await _calculator.ping();
  stdout.writeln('ping succeeded');
}

Future _add(int x, int y) async {
  int result = await _calculator.add(x, y);
  stdout.writeln('= $result');
}

Future _calc(Work work) async {
  int result = await _calculator.calculate(logid++, work);
  stdout.writeln('= $result');
}

Future _struct(int key) async {
  var struct = await _calculator.getStruct(key);
  stdout.writeln(struct.toString());
}
