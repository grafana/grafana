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

library thrift.src.browser;

import 'dart:async';
import 'dart:convert' show BASE64;
import 'dart:html' show CloseEvent;
import 'dart:html' show Event;
import 'dart:html' show MessageEvent;
import 'dart:html' show WebSocket;
import 'dart:typed_data' show Uint8List;

import 'package:thrift/thrift.dart';

/// A [TSocket] backed by a [WebSocket] from dart:html
class TWebSocket implements TSocket {
  final Uri url;

  final StreamController<TSocketState> _onStateController;
  Stream<TSocketState> get onState => _onStateController.stream;

  final StreamController<Object> _onErrorController;
  Stream<Object> get onError => _onErrorController.stream;

  final StreamController<Uint8List> _onMessageController;
  Stream<Uint8List> get onMessage => _onMessageController.stream;

  final List<Uint8List> _requests = [];

  TWebSocket(this.url)
      : _onStateController = new StreamController.broadcast(),
        _onErrorController = new StreamController.broadcast(),
        _onMessageController = new StreamController.broadcast() {
    if (url == null || !url.hasAuthority || !url.hasPort) {
      throw new ArgumentError('Invalid url');
    }
  }

  WebSocket _socket;

  bool get isOpen => _socket != null && _socket.readyState == WebSocket.OPEN;

  bool get isClosed =>
      _socket == null || _socket.readyState == WebSocket.CLOSED;

  Future open() {
    if (!isClosed) {
      throw new TTransportError(
          TTransportErrorType.ALREADY_OPEN, 'Socket already connected');
    }

    _socket = new WebSocket(url.toString());
    _socket.onError.listen(_onError);
    _socket.onOpen.listen(_onOpen);
    _socket.onClose.listen(_onClose);
    _socket.onMessage.listen(_onMessage);

    return _socket.onOpen.first;
  }

  Future close() {
    if (_socket != null) {
      _socket.close();
      return _socket.onClose.first;
    } else {
      return new Future.value();
    }
  }

  void send(Uint8List data) {
    _requests.add(data);
    _sendRequests();
  }

  void _sendRequests() {
    while (isOpen && _requests.isNotEmpty) {
      Uint8List data = _requests.removeAt(0);
      _socket.sendString(BASE64.encode(data));
    }
  }

  void _onOpen(Event event) {
    _onStateController.add(TSocketState.OPEN);
    _sendRequests();
  }

  void _onClose(CloseEvent event) {
    _socket = null;

    if (_requests.isNotEmpty) {
      _onErrorController
          .add(new StateError('Socket was closed with pending requests'));
    }
    _requests.clear();

    _onStateController.add(TSocketState.CLOSED);
  }

  void _onMessage(MessageEvent message) {
    try {
      Uint8List data =
          new Uint8List.fromList(BASE64.decode(message.data));
      _onMessageController.add(data);
    } on FormatException catch (_) {
      var error = new TProtocolError(TProtocolErrorType.INVALID_DATA,
          "Expected a Base 64 encoded string.");
      _onErrorController.add(error);
    }
  }

  void _onError(Event event) {
    close();
    _onErrorController.add(event.toString());
  }
}
