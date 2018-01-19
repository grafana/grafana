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

library thrift.src.console.t_web_socket;

import 'dart:async';
import 'dart:convert' show BASE64;
import 'dart:io';
import 'dart:typed_data' show Uint8List;

import 'package:thrift/thrift.dart';

/// A [TSocket] backed by a [WebSocket] from dart:io
class TWebSocket implements TSocket {
  final StreamController<TSocketState> _onStateController;
  Stream<TSocketState> get onState => _onStateController.stream;

  final StreamController<Object> _onErrorController;
  Stream<Object> get onError => _onErrorController.stream;

  final StreamController<Uint8List> _onMessageController;
  Stream<Uint8List> get onMessage => _onMessageController.stream;

  TWebSocket(WebSocket socket)
      : _onStateController = new StreamController.broadcast(),
        _onErrorController = new StreamController.broadcast(),
        _onMessageController = new StreamController.broadcast() {
    if (socket == null) {
      throw new ArgumentError.notNull('socket');
    }

    _socket = socket;
    _socket.listen(_onMessage, onError: _onError, onDone: close);
  }

  WebSocket _socket;

  bool get isOpen => _socket != null;

  bool get isClosed => _socket == null;

  Future open() async {
    _onStateController.add(TSocketState.OPEN);
  }

  Future close() async {
    if (_socket != null) {
      await _socket.close();
      _socket = null;
    }

    _onStateController.add(TSocketState.CLOSED);
  }

  void send(Uint8List data) {
    _socket.add(BASE64.encode(data));
  }

  void _onMessage(String message) {
    try {
      Uint8List data =
          new Uint8List.fromList(BASE64.decode(message));
      _onMessageController.add(data);
    } on FormatException catch (_) {
      var error = new TProtocolError(TProtocolErrorType.INVALID_DATA,
          "Expected a Base 64 encoded string.");
      _onErrorController.add(error);
    }
  }

  void _onError(Object error) {
    close();
    _onErrorController.add('$error');
  }
}
