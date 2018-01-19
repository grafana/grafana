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

abstract class TProtocol {
  final TTransport transport;

  TProtocol(this.transport);

  /// Write
  void writeMessageBegin(TMessage message);
  void writeMessageEnd();

  void writeStructBegin(TStruct struct);
  void writeStructEnd();

  void writeFieldBegin(TField field);
  void writeFieldEnd();
  void writeFieldStop();

  void writeMapBegin(TMap map);
  void writeMapEnd();

  void writeListBegin(TList list);
  void writeListEnd();

  void writeSetBegin(TSet set);
  void writeSetEnd();

  void writeBool(bool b);

  void writeByte(int b);

  void writeI16(int i16);

  void writeI32(int i32);

  void writeI64(int i64);

  void writeDouble(double d);

  void writeString(String str);

  void writeBinary(Uint8List bytes);

  /// Read
  TMessage readMessageBegin();
  void readMessageEnd();

  TStruct readStructBegin();
  void readStructEnd();

  TField readFieldBegin();
  void readFieldEnd();

  TMap readMapBegin();
  void readMapEnd();

  TList readListBegin();
  void readListEnd();

  TSet readSetBegin();
  void readSetEnd();

  bool readBool();

  int readByte();

  int readI16();

  int readI32();

  int readI64();

  double readDouble();

  String readString();

  Uint8List readBinary();
}
