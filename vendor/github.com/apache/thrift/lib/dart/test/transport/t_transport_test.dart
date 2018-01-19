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

import 'package:test/test.dart';
import 'package:thrift/thrift.dart';

/// Common transport tests
void main() {
  group('TTransportFactory', () {
    test('transport is returned from base factory', () async {
      TTransport result;
      TTransport transport = null;

      var factory = new TTransportFactory();

      result = await factory.getTransport(transport);
      expect(result, isNull);

      transport = new TBufferedTransport();
      result = await factory.getTransport(transport);

      expect(result, transport);
    });
  });
}
