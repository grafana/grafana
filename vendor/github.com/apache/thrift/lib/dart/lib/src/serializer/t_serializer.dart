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

part of thrift;

class TSerializer {
  final message = new TMessage('Serializer', TMessageType.ONEWAY, 1);
  TBufferedTransport transport;
  TProtocol protocol;

  TSerializer({TProtocolFactory protocolFactory}) {
    this.transport = new TBufferedTransport();
    
    if (protocolFactory == null) {
      protocolFactory = new TBinaryProtocolFactory();
    }

    this.protocol = protocolFactory.getProtocol(this.transport);
  }

  Uint8List write(TBase base) {
    base.write(protocol);
    
    return transport.consumeWriteBuffer();
  }

  String writeString(TBase base) {
    base.write(protocol);
    
    Uint8List bytes = transport.consumeWriteBuffer();
    
    return BASE64.encode(bytes);
  }
}
