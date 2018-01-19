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

class TDeserializer {
  final message = new TMessage('Deserializer', TMessageType.ONEWAY, 1);
  TBufferedTransport transport;
  TProtocol protocol;

  TDeserializer({TProtocolFactory protocolFactory}) {
    this.transport = new TBufferedTransport();
    
    if (protocolFactory == null) {
        protocolFactory = new TBinaryProtocolFactory();
    }
    
    this.protocol = protocolFactory.getProtocol(this.transport);
  }

  void read(TBase base, Uint8List data) {
    transport.writeAll(data);
    
    transport.flush();
    
    base.read(protocol);
  }

  void readString(TBase base, String data) {
    transport.writeAll(BASE64.decode(data));
    
    transport.flush();

    base.read(protocol);
  }
}
