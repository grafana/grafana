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

/// Forward all operations to the wrapped protocol.  Used as a base class.
///
/// Adapted from the C# version.
class TProtocolDecorator extends TProtocol {
  final TProtocol _protocol;

  TProtocolDecorator(TProtocol protocol)
      : _protocol = protocol,
        super(protocol.transport);

  /// Write

  void writeMessageBegin(TMessage message) {
    _protocol.writeMessageBegin(message);
  }

  void writeMessageEnd() {
    _protocol.writeMessageEnd();
  }

  void writeStructBegin(TStruct struct) {
    _protocol.writeStructBegin(struct);
  }

  void writeStructEnd() {
    _protocol.writeStructEnd();
  }

  void writeFieldBegin(TField field) {
    _protocol.writeFieldBegin(field);
  }

  void writeFieldEnd() {
    _protocol.writeFieldEnd();
  }

  void writeFieldStop() {
    _protocol.writeFieldStop();
  }

  void writeMapBegin(TMap map) {
    _protocol.writeMapBegin(map);
  }

  void writeMapEnd() {
    _protocol.writeMapEnd();
  }

  void writeListBegin(TList list) {
    _protocol.writeListBegin(list);
  }

  void writeListEnd() {
    _protocol.writeListEnd();
  }

  void writeSetBegin(TSet set) {
    _protocol.writeSetBegin(set);
  }

  void writeSetEnd() {
    _protocol.writeSetEnd();
  }

  void writeBool(bool b) {
    _protocol.writeBool(b);
  }

  void writeByte(int b) {
    _protocol.writeByte(b);
  }

  void writeI16(int i16) {
    _protocol.writeI16(i16);
  }

  void writeI32(int i32) {
    _protocol.writeI32(i32);
  }

  void writeI64(int i64) {
    _protocol.writeI64(i64);
  }

  void writeDouble(double d) {
    _protocol.writeDouble(d);
  }

  void writeString(String str) {
    _protocol.writeString(str);
  }

  void writeBinary(Uint8List bytes) {
    _protocol.writeBinary(bytes);
  }

  /// Read
  TMessage readMessageBegin() => _protocol.readMessageBegin();
  void readMessageEnd() => _protocol.readMessageEnd();

  TStruct readStructBegin() => _protocol.readStructBegin();
  void readStructEnd() => _protocol.readStructEnd();

  TField readFieldBegin() => _protocol.readFieldBegin();
  void readFieldEnd() => _protocol.readFieldEnd();

  TMap readMapBegin() => _protocol.readMapBegin();
  void readMapEnd() => _protocol.readMapEnd();

  TList readListBegin() => _protocol.readListBegin();
  void readListEnd() => _protocol.readListEnd();

  TSet readSetBegin() => _protocol.readSetBegin();
  void readSetEnd() => _protocol.readSetEnd();

  bool readBool() => _protocol.readBool();

  int readByte() => _protocol.readByte();

  int readI16() => _protocol.readI16();

  int readI32() => _protocol.readI32();

  int readI64() => _protocol.readI64();

  double readDouble() => _protocol.readDouble();

  String readString() => _protocol.readString();

  Uint8List readBinary() => _protocol.readBinary();
}
