// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

library thrift.test.transport.t_socket_transport_test;

import 'dart:async';
import 'dart:convert' show Utf8Codec, BASE64;
import 'dart:typed_data' show Uint8List;

import 'package:mockito/mockito.dart';
import 'package:test/test.dart';
import 'package:thrift/thrift.dart';

void main() {
  const utf8Codec = const Utf8Codec();

  final requestText = 'my test request';
  final requestBytes = new Uint8List.fromList(utf8Codec.encode(requestText));
  final requestBase64 = BASE64.encode(requestBytes);

  final responseText = 'response 1';
  final responseBytes = new Uint8List.fromList(utf8Codec.encode(responseText));
  final responseBase64 = BASE64.encode(responseBytes);

  final framedResponseBase64 =
      BASE64.encode(_getFramedResponse(responseBytes));

  group('TClientSocketTransport', () {
    FakeSocket socket;
    TTransport transport;

    setUp(() async {
      socket = new FakeSocket(sync: false);
      await socket.open();
      transport = new TClientSocketTransport(socket);
      await transport.open();
      transport.writeAll(requestBytes);
    });

    test('Test client sending data over transport', () async {
      expect(socket.sendPayload, isNull);

      Future responseReady = transport.flush();

      // allow microtask events to finish
      await new Future.value();

      expect(socket.sendPayload, isNotNull);
      expect(socket.sendPayload, requestBytes);

      // simulate a response
      socket.receiveFakeMessage(responseBase64);

      await responseReady;
      var buffer = new Uint8List(responseBytes.length);
      transport.readAll(buffer, 0, responseBytes.length);
      var bufferText = utf8Codec.decode(buffer);

      expect(bufferText, responseText);
    });
  }, timeout: new Timeout(new Duration(seconds: 1)));

  group('TClientSocketTransport with FramedTransport', () {
    FakeSocket socket;
    TTransport transport;

    setUp(() async {
      socket = new FakeSocket(sync: true);
      await socket.open();

      transport = new TFramedTransport(new TClientSocketTransport(socket));
      await transport.open();
      transport.writeAll(requestBytes);
    });

    test('Test client sending data over framed transport', () async {
      String bufferText;

      Future responseReady = transport.flush().then((_) {
        var buffer = new Uint8List(responseBytes.length);
        transport.readAll(buffer, 0, responseBytes.length);
        bufferText = utf8Codec.decode(buffer);
      });

      // simulate a response
      socket.receiveFakeMessage(framedResponseBase64);

      await responseReady;
      expect(bufferText, responseText);
    });
  }, timeout: new Timeout(new Duration(seconds: 1)));

  group('TAsyncClientSocketTransport', () {
    FakeSocket socket;
    FakeProtocolFactory protocolFactory;
    TTransport transport;

    setUp(() async {
      socket = new FakeSocket(sync: true);
      await socket.open();

      protocolFactory = new FakeProtocolFactory();
      protocolFactory.message = new TMessage('foo', TMessageType.CALL, 123);
      transport = new TAsyncClientSocketTransport(
          socket, new TMessageReader(protocolFactory),
          responseTimeout: Duration.ZERO);
      await transport.open();
      transport.writeAll(requestBytes);
    });

    test('Test response correlates to correct request', () async {
      String bufferText;

      Future responseReady = transport.flush().then((_) {
        var buffer = new Uint8List(responseBytes.length);
        transport.readAll(buffer, 0, responseBytes.length);
        bufferText = utf8Codec.decode(buffer);
      });

      // simulate a response
      protocolFactory.message = new TMessage('foo', TMessageType.REPLY, 123);
      socket.receiveFakeMessage(responseBase64);

      // simulate a second response
      var response2Text = 'response 2';
      var response2Bytes =
          new Uint8List.fromList(utf8Codec.encode(response2Text));
      var response2Base64 = BASE64.encode(response2Bytes);
      protocolFactory.message = new TMessage('foo2', TMessageType.REPLY, 124);
      socket.receiveFakeMessage(response2Base64);

      await responseReady;
      expect(bufferText, responseText);
    });

    test('Test response timeout', () async {
      Future responseReady = transport.flush();
      expect(responseReady, throwsA(new isInstanceOf<TimeoutException>()));
    });
  }, timeout: new Timeout(new Duration(seconds: 1)));

  group('TAsyncClientSocketTransport with TFramedTransport', () {
    FakeSocket socket;
    FakeProtocolFactory protocolFactory;
    TTransport transport;

    setUp(() async {
      socket = new FakeSocket(sync: true);
      await socket.open();

      protocolFactory = new FakeProtocolFactory();
      protocolFactory.message = new TMessage('foo', TMessageType.CALL, 123);
      var messageReader = new TMessageReader(protocolFactory,
          byteOffset: TFramedTransport.headerByteCount);

      transport = new TFramedTransport(new TAsyncClientSocketTransport(
          socket, messageReader,
          responseTimeout: Duration.ZERO));
      await transport.open();
      transport.writeAll(requestBytes);
    });

    test('Test async client sending data over framed transport', () async {
      String bufferText;

      Future responseReady = transport.flush().then((_) {
        var buffer = new Uint8List(responseBytes.length);
        transport.readAll(buffer, 0, responseBytes.length);
        bufferText = utf8Codec.decode(buffer);
      });

      // simulate a response
      protocolFactory.message = new TMessage('foo', TMessageType.REPLY, 123);
      socket.receiveFakeMessage(framedResponseBase64);

      await responseReady;
      expect(bufferText, responseText);
    });
  }, timeout: new Timeout(new Duration(seconds: 1)));

  group('TServerTransport', () {
    test('Test server transport listens to socket', () async {
      var socket = new FakeSocket();
      await socket.open();
      expect(socket.isOpen, isTrue);

      var transport = new TServerSocketTransport(socket);
      expect(transport.hasReadData, isFalse);

      socket.receiveFakeMessage(requestBase64);

      // allow microtask events to finish
      await new Future.value();

      expect(transport.hasReadData, isTrue);

      var buffer = new Uint8List(requestBytes.length);
      transport.readAll(buffer, 0, requestBytes.length);

      var bufferText = utf8Codec.decode(buffer);
      expect(bufferText, requestText);
    });

    test('Test server sending data over transport', () async {
      var socket = new FakeSocket();
      await socket.open();

      var transport = new TServerSocketTransport(socket);

      transport.writeAll(responseBytes);
      expect(socket.sendPayload, isNull);

      transport.flush();

      // allow microtask events to finish
      await new Future.value();

      expect(socket.sendPayload, isNotNull);
      expect(socket.sendPayload, responseBytes);
    });
  }, timeout: new Timeout(new Duration(seconds: 1)));
}

class FakeSocket extends TSocket {
  final StreamController<TSocketState> _onStateController;
  Stream<TSocketState> get onState => _onStateController.stream;

  final StreamController<Object> _onErrorController;
  Stream<Object> get onError => _onErrorController.stream;

  final StreamController<Uint8List> _onMessageController;
  Stream<Uint8List> get onMessage => _onMessageController.stream;

  FakeSocket({bool sync: false})
      : _onStateController = new StreamController.broadcast(sync: sync),
        _onErrorController = new StreamController.broadcast(sync: sync),
        _onMessageController = new StreamController.broadcast(sync: sync);

  bool _isOpen;

  bool get isOpen => _isOpen;

  bool get isClosed => !isOpen;

  Future open() async {
    _isOpen = true;
    _onStateController.add(TSocketState.OPEN);
  }

  Future close() async {
    _isOpen = false;
    _onStateController.add(TSocketState.CLOSED);
  }

  Uint8List _sendPayload;
  Uint8List get sendPayload => _sendPayload;

  void send(Uint8List data) {
    if (!isOpen) throw new StateError('The socket is not open');

    _sendPayload = data;
  }

  void receiveFakeMessage(String base64) {
    if (!isOpen) throw new StateError('The socket is not open');

    var message =
        new Uint8List.fromList(BASE64.decode(base64));
    _onMessageController.add(message);
  }
}

class FakeProtocolFactory implements TProtocolFactory {
  FakeProtocolFactory();

  TMessage message;

  getProtocol(TTransport transport) => new FakeProtocol(message);
}

class FakeProtocol extends Mock implements TProtocol {
  FakeProtocol(this._message);

  TMessage _message;

  readMessageBegin() => _message;
}

Uint8List _getFramedResponse(Uint8List responseBytes) {
  var byteOffset = TFramedTransport.headerByteCount;
  var response = new Uint8List(byteOffset + responseBytes.length);

  response.buffer.asByteData().setInt32(0, responseBytes.length);
  response.setAll(byteOffset, responseBytes);

  return response;
}
