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

class TBinaryProtocolFactory implements TProtocolFactory<TBinaryProtocol> {
  TBinaryProtocolFactory({this.strictRead: false, this.strictWrite: true});

  final bool strictRead;
  final bool strictWrite;

  TBinaryProtocol getProtocol(TTransport transport) {
    return new TBinaryProtocol(transport,
        strictRead: strictRead, strictWrite: strictWrite);
  }
}

/// Binary protocol implementation for Thrift.
///
/// Adapted from the C# version.
class TBinaryProtocol extends TProtocol {
  static const int VERSION_MASK = 0xffff0000;
  static const int VERSION_1 = 0x80010000;

  static const Utf8Codec _utf8Codec = const Utf8Codec();

  final bool strictRead;
  final bool strictWrite;

  TBinaryProtocol(TTransport transport,
      {this.strictRead: false, this.strictWrite: true})
      : super(transport);

  /// write
  void writeMessageBegin(TMessage message) {
    if (strictWrite) {
      int version = VERSION_1 | message.type;
      writeI32(version);
      writeString(message.name);
      writeI32(message.seqid);
    } else {
      writeString(message.name);
      writeByte(message.type);
      writeI32(message.seqid);
    }
  }

  void writeMessageEnd() {}

  void writeStructBegin(TStruct struct) {}

  void writeStructEnd() {}

  void writeFieldBegin(TField field) {
    writeByte(field.type);
    writeI16(field.id);
  }

  void writeFieldEnd() {}

  void writeFieldStop() {
    writeByte(TType.STOP);
  }

  void writeMapBegin(TMap map) {
    writeByte(map.keyType);
    writeByte(map.valueType);
    writeI32(map.length);
  }

  void writeMapEnd() {}

  void writeListBegin(TList list) {
    writeByte(list.elementType);
    writeI32(list.length);
  }

  void writeListEnd() {}

  void writeSetBegin(TSet set) {
    writeByte(set.elementType);
    writeI32(set.length);
  }

  void writeSetEnd() {}

  void writeBool(bool b) {
    if (b == null) b = false;
    writeByte(b ? 1 : 0);
  }

  final ByteData _byteOut = new ByteData(1);
  void writeByte(int byte) {
    if (byte == null) byte = 0;
    _byteOut.setUint8(0, byte);
    transport.write(_byteOut.buffer.asUint8List(), 0, 1);
  }

  final ByteData _i16Out = new ByteData(2);
  void writeI16(int i16) {
    if (i16 == null) i16 = 0;
    _i16Out.setInt16(0, i16);
    transport.write(_i16Out.buffer.asUint8List(), 0, 2);
  }

  final ByteData _i32Out = new ByteData(4);
  void writeI32(int i32) {
    if (i32 == null) i32 = 0;
    _i32Out.setInt32(0, i32);
    transport.write(_i32Out.buffer.asUint8List(), 0, 4);
  }

  final Uint8List _i64Out = new Uint8List(8);
  void writeI64(int i64) {
    if (i64 == null) i64 = 0;
    var i = new Int64(i64);
    var bts = i.toBytes();
    for (var j = 0; j < 8; j++) {
      _i64Out[j] = bts[8 - j - 1];
    }
    transport.write(_i64Out, 0, 8);
  }

  void writeString(String s) {
    var bytes = s != null ? _utf8Codec.encode(s) : new Uint8List.fromList([]);
    writeI32(bytes.length);
    transport.write(bytes, 0, bytes.length);
  }

  final ByteData _doubleOut = new ByteData(8);
  void writeDouble(double d) {
    if (d == null) d = 0.0;
    _doubleOut.setFloat64(0, d);
    transport.write(_doubleOut.buffer.asUint8List(), 0, 8);
  }

  void writeBinary(Uint8List bytes) {
    var length = bytes.length;
    writeI32(length);
    transport.write(bytes, 0, length);
  }

  /// read
  TMessage readMessageBegin() {
    String name;
    int type;
    int seqid;

    int size = readI32();
    if (size < 0) {
      int version = size & VERSION_MASK;
      if (version != VERSION_1) {
        throw new TProtocolError(TProtocolErrorType.BAD_VERSION,
            "Bad version in readMessageBegin: $version");
      }
      type = size & 0x000000ff;
      name = readString();
      seqid = readI32();
    } else {
      if (strictRead) {
        throw new TProtocolError(TProtocolErrorType.BAD_VERSION,
            "Missing version in readMessageBegin");
      }
      name = _readString(size);
      type = readByte();
      seqid = readI32();
    }
    return new TMessage(name, type, seqid);
  }

  void readMessageEnd() {}

  TStruct readStructBegin() {
    return new TStruct();
  }

  void readStructEnd() {}

  TField readFieldBegin() {
    String name = "";
    int type = readByte();
    int id = type != TType.STOP ? readI16() : 0;

    return new TField(name, type, id);
  }

  void readFieldEnd() {}

  TMap readMapBegin() {
    int keyType = readByte();
    int valueType = readByte();
    int length = readI32();

    return new TMap(keyType, valueType, length);
  }

  void readMapEnd() {}

  TList readListBegin() {
    int elementType = readByte();
    int length = readI32();

    return new TList(elementType, length);
  }

  void readListEnd() {}

  TSet readSetBegin() {
    int elementType = readByte();
    int length = readI32();

    return new TSet(elementType, length);
  }

  void readSetEnd() {}

  bool readBool() => readByte() == 1;

  final Uint8List _byteIn = new Uint8List(1);
  int readByte() {
    transport.readAll(_byteIn, 0, 1);
    return _byteIn.buffer.asByteData().getUint8(0);
  }

  final Uint8List _i16In = new Uint8List(2);
  int readI16() {
    transport.readAll(_i16In, 0, 2);
    return _i16In.buffer.asByteData().getInt16(0);
  }

  final Uint8List _i32In = new Uint8List(4);
  int readI32() {
    transport.readAll(_i32In, 0, 4);
    return _i32In.buffer.asByteData().getInt32(0);
  }

  final Uint8List _i64In = new Uint8List(8);
  int readI64() {
    transport.readAll(_i64In, 0, 8);
    var i = new Int64.fromBytesBigEndian(_i64In);
    return i.toInt();
  }

  final Uint8List _doubleIn = new Uint8List(8);
  double readDouble() {
    transport.readAll(_doubleIn, 0, 8);
    return _doubleIn.buffer.asByteData().getFloat64(0);
  }

  String readString() {
    int size = readI32();
    return _readString(size);
  }

  String _readString(int size) {
    Uint8List stringIn = new Uint8List(size);
    transport.readAll(stringIn, 0, size);
    return _utf8Codec.decode(stringIn);
  }

  Uint8List readBinary() {
    int length = readI32();
    Uint8List binaryIn = new Uint8List(length);
    transport.readAll(binaryIn, 0, length);
    return binaryIn;
  }
}
