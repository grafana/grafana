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
import 'package:shared/shared.dart';

TProtocol _protocol;
TProcessor _processor;
WebSocket _webSocket;

main(List<String> args) {
  Logger.root.level = Level.ALL;
  Logger.root.onRecord.listen((LogRecord rec) {
    print('${rec.level.name}: ${rec.time}: ${rec.message}');
  });

  var parser = new ArgParser();
  parser.addOption('port', defaultsTo: '9090', help: 'The port to listen on');
  parser.addOption('type',
      defaultsTo: 'ws',
      allowed: ['ws', 'tcp'],
      help: 'The type of socket',
      allowedHelp: {'ws': 'WebSocket', 'tcp': 'TCP Socket'});

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
  String socketType = results['type'];

  if (socketType == 'tcp') {
    _runTcpServer(port);
  } else if (socketType == 'ws') {
    _runWebSocketServer(port);
  }
}

Future _runWebSocketServer(int port) async {
  var httpServer = await HttpServer.bind('127.0.0.1', port);
  print('listening for WebSocket connections on $port');

  httpServer.listen((HttpRequest request) async {
    if (request.uri.path == '/ws') {
      _webSocket = await WebSocketTransformer.upgrade(request);
      await _initProcessor(new TWebSocket(_webSocket));
    } else {
      print('Invalid path: ${request.uri.path}');
    }
  });
}

Future _runTcpServer(int port) async {
  var serverSocket = await ServerSocket.bind('127.0.0.1', port);
  print('listening for TCP connections on $port');

  Socket socket = await serverSocket.first;
  await _initProcessor(new TTcpSocket(socket));
}

Future _initProcessor(TSocket socket) async {
  TServerSocketTransport transport = new TServerSocketTransport(socket);
  transport.onIncomingMessage.listen(_processMessage);
  _processor = new CalculatorProcessor(new CalculatorServer());
  _protocol = new TBinaryProtocol(transport);
  await _protocol.transport.open();

  print('connected');
}

Future _processMessage(_) async {
  _processor.process(_protocol, _protocol);
}

class CalculatorServer implements Calculator {
  final Map<int, SharedStruct> _log = {};

  Future ping() async {
    print('ping()');
  }

  Future<int> add(int num1, int num2) async {
    print('add($num1, $num2)');

    return num1 + num2;
  }

  Future<int> calculate(int logid, Work work) async {
    print('calulate($logid, ${work.toString()})');

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
          var x = new InvalidOperation();
          x.whatOp = work.op;
          x.why = 'Cannot divide by 0';
          throw x;
        }
        val = (work.num1 / work.num2).floor();
        break;
    }

    var log = new SharedStruct();
    log.key = logid;
    log.value = '$val "${work.comment}"';
    this._log[logid] = log;

    return val;
  }

  Future zip() async {
    print('zip()');
  }

  Future<SharedStruct> getStruct(int key) async {
    print('getStruct($key)');

    return _log[key];
  }
}
