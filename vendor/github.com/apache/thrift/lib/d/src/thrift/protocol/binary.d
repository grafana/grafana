/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
module thrift.protocol.binary;

import std.array : uninitializedArray;
import std.typetuple : allSatisfy, TypeTuple;
import thrift.protocol.base;
import thrift.transport.base;
import thrift.internal.endian;

/**
 * TProtocol implementation of the Binary Thrift protocol.
 */
final class TBinaryProtocol(Transport = TTransport) if (
  isTTransport!Transport
) : TProtocol {

  /**
   * Constructs a new instance.
   *
   * Params:
   *   trans = The transport to use.
   *   containerSizeLimit = If positive, the container size is limited to the
   *     given number of items.
   *   stringSizeLimit = If positive, the string length is limited to the
   *     given number of bytes.
   *   strictRead = If false, old peers which do not include the protocol
   *     version are tolerated.
   *   strictWrite = Whether to include the protocol version in the header.
   */
  this(Transport trans, int containerSizeLimit = 0, int stringSizeLimit = 0,
    bool strictRead = false, bool strictWrite = true
  ) {
    trans_ = trans;
    this.containerSizeLimit = containerSizeLimit;
    this.stringSizeLimit = stringSizeLimit;
    this.strictRead = strictRead;
    this.strictWrite = strictWrite;
  }

  Transport transport() @property {
    return trans_;
  }

  void reset() {}

  /**
   * If false, old peers which do not include the protocol version in the
   * message header are tolerated.
   *
   * Defaults to false.
   */
  bool strictRead;

  /**
   * Whether to include the protocol version in the message header (older
   * versions didn't).
   *
   * Defaults to true.
   */
  bool strictWrite;

  /**
   * If positive, limits the number of items of deserialized containers to the
   * given amount.
   *
   * This is useful to avoid allocating excessive amounts of memory when broken
   * data is received. If the limit is exceeded, a SIZE_LIMIT-type
   * TProtocolException is thrown.
   *
   * Defaults to zero (no limit).
   */
  int containerSizeLimit;

  /**
   * If positive, limits the length of deserialized strings/binary data to the
   * given number of bytes.
   *
   * This is useful to avoid allocating excessive amounts of memory when broken
   * data is received. If the limit is exceeded, a SIZE_LIMIT-type
   * TProtocolException is thrown.
   *
   * Defaults to zero (no limit).
   */
  int stringSizeLimit;

  /*
   * Writing methods.
   */

  void writeBool(bool b) {
    writeByte(b ? 1 : 0);
  }

  void writeByte(byte b) {
    trans_.write((cast(ubyte*)&b)[0 .. 1]);
  }

  void writeI16(short i16) {
    short net = hostToNet(i16);
    trans_.write((cast(ubyte*)&net)[0 .. 2]);
  }

  void writeI32(int i32) {
    int net = hostToNet(i32);
    trans_.write((cast(ubyte*)&net)[0 .. 4]);
  }

  void writeI64(long i64) {
    long net = hostToNet(i64);
    trans_.write((cast(ubyte*)&net)[0 .. 8]);
  }

  void writeDouble(double dub) {
    static assert(double.sizeof == ulong.sizeof);
    auto bits = hostToNet(*cast(ulong*)(&dub));
    trans_.write((cast(ubyte*)&bits)[0 .. 8]);
  }

  void writeString(string str) {
    writeBinary(cast(ubyte[])str);
  }

  void writeBinary(ubyte[] buf) {
    assert(buf.length <= int.max);
    writeI32(cast(int)buf.length);
    trans_.write(buf);
  }

  void writeMessageBegin(TMessage message) {
    if (strictWrite) {
      int versn = VERSION_1 | message.type;
      writeI32(versn);
      writeString(message.name);
      writeI32(message.seqid);
    } else {
      writeString(message.name);
      writeByte(message.type);
      writeI32(message.seqid);
    }
  }
  void writeMessageEnd() {}

  void writeStructBegin(TStruct tstruct) {}
  void writeStructEnd() {}

  void writeFieldBegin(TField field) {
    writeByte(field.type);
    writeI16(field.id);
  }
  void writeFieldEnd() {}

  void writeFieldStop() {
    writeByte(TType.STOP);
  }

  void writeListBegin(TList list) {
    assert(list.size <= int.max);
    writeByte(list.elemType);
    writeI32(cast(int)list.size);
  }
  void writeListEnd() {}

  void writeMapBegin(TMap map) {
    assert(map.size <= int.max);
    writeByte(map.keyType);
    writeByte(map.valueType);
    writeI32(cast(int)map.size);
  }
  void writeMapEnd() {}

  void writeSetBegin(TSet set) {
    assert(set.size <= int.max);
    writeByte(set.elemType);
    writeI32(cast(int)set.size);
  }
  void writeSetEnd() {}


  /*
   * Reading methods.
   */

  bool readBool() {
    return readByte() != 0;
  }

  byte readByte() {
    ubyte[1] b = void;
    trans_.readAll(b);
    return cast(byte)b[0];
  }

  short readI16() {
    IntBuf!short b = void;
    trans_.readAll(b.bytes);
    return netToHost(b.value);
  }

  int readI32() {
    IntBuf!int b = void;
    trans_.readAll(b.bytes);
    return netToHost(b.value);
  }

  long readI64() {
    IntBuf!long b = void;
    trans_.readAll(b.bytes);
    return netToHost(b.value);
  }

  double readDouble() {
    IntBuf!long b = void;
    trans_.readAll(b.bytes);
    b.value = netToHost(b.value);
    return *cast(double*)(&b.value);
  }

  string readString() {
    return cast(string)readBinary();
  }

  ubyte[] readBinary() {
    return readBinaryBody(readSize(stringSizeLimit));
  }

  TMessage readMessageBegin() {
    TMessage msg = void;

    int size = readI32();
    if (size < 0) {
      int versn = size & VERSION_MASK;
      if (versn != VERSION_1) {
        throw new TProtocolException("Bad protocol version.",
          TProtocolException.Type.BAD_VERSION);
      }

      msg.type = cast(TMessageType)(size & MESSAGE_TYPE_MASK);
      msg.name = readString();
      msg.seqid = readI32();
    } else {
      if (strictRead) {
        throw new TProtocolException(
          "Protocol version missing, old client?",
          TProtocolException.Type.BAD_VERSION);
      } else {
        if (size < 0) {
          throw new TProtocolException(TProtocolException.Type.NEGATIVE_SIZE);
        }
        msg.name = cast(string)readBinaryBody(size);
        msg.type = cast(TMessageType)(readByte());
        msg.seqid = readI32();
      }
    }

    return msg;
  }
  void readMessageEnd() {}

  TStruct readStructBegin() {
    return TStruct();
  }
  void readStructEnd() {}

  TField readFieldBegin() {
    TField f = void;
    f.name = null;
    f.type = cast(TType)readByte();
    if (f.type == TType.STOP) return f;
    f.id = readI16();
    return f;
  }
  void readFieldEnd() {}

  TList readListBegin() {
    return TList(cast(TType)readByte(), readSize(containerSizeLimit));
  }
  void readListEnd() {}

  TMap readMapBegin() {
    return TMap(cast(TType)readByte(), cast(TType)readByte(),
      readSize(containerSizeLimit));
  }
  void readMapEnd() {}

  TSet readSetBegin() {
    return TSet(cast(TType)readByte(), readSize(containerSizeLimit));
  }
  void readSetEnd() {}

private:
  ubyte[] readBinaryBody(int size) {
    if (size == 0) {
      return null;
    }

    auto buf = uninitializedArray!(ubyte[])(size);
    trans_.readAll(buf);
    return buf;
  }

  int readSize(int limit) {
    auto size = readI32();
    if (size < 0) {
      throw new TProtocolException(TProtocolException.Type.NEGATIVE_SIZE);
    } else if (limit > 0 && size > limit) {
      throw new TProtocolException(TProtocolException.Type.SIZE_LIMIT);
    }
    return size;
  }

  enum MESSAGE_TYPE_MASK = 0x000000ff;
  enum VERSION_MASK = 0xffff0000;
  enum VERSION_1 = 0x80010000;

  Transport trans_;
}

/**
 * TBinaryProtocol construction helper to avoid having to explicitly specify
 * the transport type, i.e. to allow the constructor being called using IFTI
 * (see $(LINK2 http://d.puremagic.com/issues/show_bug.cgi?id=6082, D Bugzilla
 * enhancement requet 6082)).
 */
TBinaryProtocol!Transport tBinaryProtocol(Transport)(Transport trans,
  int containerSizeLimit = 0, int stringSizeLimit = 0,
  bool strictRead = false, bool strictWrite = true
) if (isTTransport!Transport) {
  return new TBinaryProtocol!Transport(trans, containerSizeLimit,
    stringSizeLimit, strictRead, strictWrite);
}

unittest {
  import std.exception;
  import thrift.transport.memory;

  // Check the message header format.
  auto buf = new TMemoryBuffer;
  auto binary = tBinaryProtocol(buf);
  binary.writeMessageBegin(TMessage("foo", TMessageType.CALL, 0));

  auto header = new ubyte[15];
  buf.readAll(header);
  enforce(header == [
    128, 1, 0, 1, // Version 1, TMessageType.CALL
    0, 0, 0, 3, // Method name length
    102, 111, 111, // Method name ("foo")
    0, 0, 0, 0, // Sequence id
  ]);
}

unittest {
  import thrift.internal.test.protocol;
  testContainerSizeLimit!(TBinaryProtocol!())();
  testStringSizeLimit!(TBinaryProtocol!())();
}

/**
 * TProtocolFactory creating a TBinaryProtocol instance for passed in
 * transports.
 *
 * The optional Transports template tuple parameter can be used to specify
 * one or more TTransport implementations to specifically instantiate
 * TBinaryProtocol for. If the actual transport types encountered at
 * runtime match one of the transports in the list, a specialized protocol
 * instance is created. Otherwise, a generic TTransport version is used.
 */
class TBinaryProtocolFactory(Transports...) if (
  allSatisfy!(isTTransport, Transports)
) : TProtocolFactory {
  ///
  this (int containerSizeLimit = 0, int stringSizeLimit = 0,
    bool strictRead = false, bool strictWrite = true
  ) {
    strictRead_ = strictRead;
    strictWrite_ = strictWrite;
    containerSizeLimit_ = containerSizeLimit;
    stringSizeLimit_ = stringSizeLimit;
  }

  TProtocol getProtocol(TTransport trans) const {
    foreach (Transport; TypeTuple!(Transports, TTransport)) {
      auto concreteTrans = cast(Transport)trans;
      if (concreteTrans) {
        return new TBinaryProtocol!Transport(concreteTrans,
          containerSizeLimit_, stringSizeLimit_, strictRead_, strictWrite_);
      }
    }
    throw new TProtocolException(
      "Passed null transport to TBinaryProtocolFactoy.");
  }

protected:
  bool strictRead_;
  bool strictWrite_;
  int containerSizeLimit_;
  int stringSizeLimit_;
}
