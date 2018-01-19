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
import 'dart:convert' show Encoding;
import 'dart:convert' show Utf8Codec, BASE64;
import 'dart:typed_data' show Uint8List;

import 'package:http/http.dart' show BaseRequest;
import 'package:http/http.dart' show Client;
import 'package:http/http.dart' show Response;
import 'package:http/http.dart' show StreamedResponse;
import 'package:test/test.dart';
import 'package:thrift/thrift.dart';

void main() {
  const utf8Codec = const Utf8Codec();

  group('THttpClientTransport', () {
    FakeHttpClient client;
    THttpClientTransport transport;

    setUp(() {
      client = new FakeHttpClient(sync: false);
      var config = new THttpConfig(Uri.parse('http://localhost'), {});
      transport = new THttpClientTransport(client, config);
    });

    test('Test transport sends body', () async {
      var expectedText = 'my request';
      transport.writeAll(utf8Codec.encode(expectedText));

      expect(client.postRequest, isEmpty);

      await transport.flush();

      expect(client.postRequest, isNotEmpty);

      var requestText =
          utf8Codec.decode(BASE64.decode(client.postRequest));
      expect(requestText, expectedText);
    });

    test('Test transport receives response', () async {
      var expectedText = 'my response';
      var expectedBytes = utf8Codec.encode(expectedText);
      client.postResponse = BASE64.encode(expectedBytes);

      transport.writeAll(utf8Codec.encode('my request'));
      expect(transport.hasReadData, isFalse);

      await transport.flush();

      expect(transport.hasReadData, isTrue);

      var buffer = new Uint8List(expectedBytes.length);
      transport.readAll(buffer, 0, expectedBytes.length);

      var bufferText = utf8Codec.decode(buffer);
      expect(bufferText, expectedText);
    });
  });

  group('THttpClientTransport with multiple messages', () {
    FakeHttpClient client;
    THttpClientTransport transport;

    setUp(() {
      client = new FakeHttpClient(sync: true);
      var config = new THttpConfig(Uri.parse('http://localhost'), {});
      transport = new THttpClientTransport(client, config);
    });

    test('Test read correct buffer after flush', () async {
      String bufferText;
      var expectedText = 'response 1';
      var expectedBytes = utf8Codec.encode(expectedText);

      // prepare a response
      transport.writeAll(utf8Codec.encode('request 1'));
      client.postResponse = BASE64.encode(expectedBytes);

      Future responseReady = transport.flush().then((_) {
        var buffer = new Uint8List(expectedBytes.length);
        transport.readAll(buffer, 0, expectedBytes.length);
        bufferText = utf8Codec.decode(buffer);
      });

      // prepare a second response
      transport.writeAll(utf8Codec.encode('request 2'));
      var response2Bytes = utf8Codec.encode('response 2');
      client.postResponse = BASE64.encode(response2Bytes);
      await transport.flush();

      await responseReady;
      expect(bufferText, expectedText);
    });
  });
}

class FakeHttpClient implements Client {
  String postResponse = '';
  String postRequest = '';

  final bool sync;

  FakeHttpClient({this.sync: false});

  Future<Response> post(url,
      {Map<String, String> headers, body, Encoding encoding}) {
    postRequest = body;
    var response = new Response(postResponse, 200);

    if (sync) {
      return new Future.sync(() => response);
    } else {
      return new Future.value(response);
    }
  }

  Future<Response> head(url, {Map<String, String> headers}) =>
      throw new UnimplementedError();

  Future<Response> get(url, {Map<String, String> headers}) =>
      throw new UnimplementedError();

  Future<Response> put(url,
          {Map<String, String> headers, body, Encoding encoding}) =>
      throw new UnimplementedError();

  Future<Response> patch(url,
          {Map<String, String> headers, body, Encoding encoding}) =>
      throw new UnimplementedError();

  Future<Response> delete(url, {Map<String, String> headers}) =>
      throw new UnimplementedError();

  Future<String> read(url, {Map<String, String> headers}) =>
      throw new UnimplementedError();

  Future<Uint8List> readBytes(url, {Map<String, String> headers}) =>
      throw new UnimplementedError();

  Future<StreamedResponse> send(BaseRequest request) =>
      throw new UnimplementedError();

  void close() => throw new UnimplementedError();
}
