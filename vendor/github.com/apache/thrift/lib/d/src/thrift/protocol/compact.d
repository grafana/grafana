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
module thrift.protocol.compact;

import std.array : uninitializedArray;
import std.typetuple : allSatisfy, TypeTuple;
import thrift.protocol.base;
import thrift.transport.base;
import thrift.internal.endian;

/**
 * D implementation of the Compact protocol.
 *
 * See THRIFT-110 for a protocol description. This implementation is based on
 * the C++ one.
 */
final class TCompactProtocol(Transport = TTransport) if (
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
   */
  this(Transport trans, int containerSizeLimit = 0, int stringSizeLimit = 0) {
    trans_ = trans;
    this.containerSizeLimit = containerSizeLimit;
    this.stringSizeLimit = stringSizeLimit;
  }

  Transport transport() @property {
    return trans_;
  }

  void reset() {
    lastFieldId_ = 0;
    fieldIdStack_ = null;
    booleanField_ = TField.init;
    hasBoolValue_ = false;
  }

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
    if (booleanField_.name !is null) {
      // we haven't written the field header yet
      writeFieldBeginInternal(booleanField_,
        b ? CType.BOOLEAN_TRUE : CType.BOOLEAN_FALSE);
      booleanField_.name = null;
    } else {
      // we're not part of a field, so just write the value
      writeByte(b ? CType.BOOLEAN_TRUE : CType.BOOLEAN_FALSE);
    }
  }

  void writeByte(byte b) {
    trans_.write((cast(ubyte*)&b)[0..1]);
  }

  void writeI16(short i16) {
    writeVarint32(i32ToZigzag(i16));
  }

  void writeI32(int i32) {
    writeVarint32(i32ToZigzag(i32));
  }

  void writeI64(long i64) {
    writeVarint64(i64ToZigzag(i64));
  }

  void writeDouble(double dub) {
    ulong bits = hostToLe(*cast(ulong*)(&dub));
    trans_.write((cast(ubyte*)&bits)[0 .. 8]);
  }

  void writeString(string str) {
    writeBinary(cast(ubyte[])str);
  }

  void writeBinary(ubyte[] buf) {
    assert(buf.length <= int.max);
    writeVarint32(cast(int)buf.length);
    trans_.write(buf);
  }

  void writeMessageBegin(TMessage msg) {
    writeByte(cast(byte)PROTOCOL_ID);
    writeByte(cast(byte)((VERSION_N & VERSION_MASK) |
                         ((cast(int)msg.type << TYPE_SHIFT_AMOUNT) & TYPE_MASK)));
    writeVarint32(msg.seqid);
    writeString(msg.name);
  }
  void writeMessageEnd() {}

  void writeStructBegin(TStruct tstruct) {
    fieldIdStack_ ~= lastFieldId_;
    lastFieldId_ = 0;
  }

  void writeStructEnd() {
    lastFieldId_ = fieldIdStack_[$ - 1];
    fieldIdStack_ = fieldIdStack_[0 .. $ - 1];
    fieldIdStack_.assumeSafeAppend();
  }

  void writeFieldBegin(TField field) {
    if (field.type == TType.BOOL) {
      booleanField_.name = field.name;
      booleanField_.type = field.type;
      booleanField_.id = field.id;
    } else {
      return writeFieldBeginInternal(field);
    }
  }
  void writeFieldEnd() {}

  void writeFieldStop() {
    writeByte(TType.STOP);
  }

  void writeListBegin(TList list) {
    writeCollectionBegin(list.elemType, list.size);
  }
  void writeListEnd() {}

  void writeMapBegin(TMap map) {
    if (map.size == 0) {
      writeByte(0);
    } else {
      assert(map.size <= int.max);
      writeVarint32(cast(int)map.size);
      writeByte(cast(byte)(toCType(map.keyType) << 4 | toCType(map.valueType)));
    }
  }
  void writeMapEnd() {}

  void writeSetBegin(TSet set) {
    writeCollectionBegin(set.elemType, set.size);
  }
  void writeSetEnd() {}


  /*
   * Reading methods.
   */

  bool readBool() {
    if (hasBoolValue_ == true) {
      hasBoolValue_ = false;
      return boolValue_;
    }

    return readByte() == CType.BOOLEAN_TRUE;
  }

  byte readByte() {
    ubyte[1] b = void;
    trans_.readAll(b);
    return cast(byte)b[0];
  }

  short readI16() {
    return cast(short)zigzagToI32(readVarint32());
  }

  int readI32() {
    return zigzagToI32(readVarint32());
  }

  long readI64() {
    return zigzagToI64(readVarint64());
  }

  double readDouble() {
    IntBuf!long b = void;
    trans_.readAll(b.bytes);
    b.value = leToHost(b.value);
    return *cast(double*)(&b.value);
  }

  string readString() {
    return cast(string)readBinary();
  }

  ubyte[] readBinary() {
    auto size = readVarint32();
    checkSize(size, stringSizeLimit);

    if (size == 0) {
      return null;
    }

    auto buf = uninitializedArray!(ubyte[])(size);
    trans_.readAll(buf);
    return buf;
  }

  TMessage readMessageBegin() {
    TMessage msg = void;

    auto protocolId = readByte();
    if (protocolId != cast(byte)PROTOCOL_ID) {
      throw new TProtocolException("Bad protocol identifier",
        TProtocolException.Type.BAD_VERSION);
    }

    auto versionAndType = readByte();
    auto ver = versionAndType & VERSION_MASK;
    if (ver != VERSION_N) {
      throw new TProtocolException("Bad protocol version",
        TProtocolException.Type.BAD_VERSION);
    }

    msg.type = cast(TMessageType)((versionAndType >> TYPE_SHIFT_AMOUNT) & TYPE_BITS);
    msg.seqid = readVarint32();
    msg.name = readString();

    return msg;
  }
  void readMessageEnd() {}

  TStruct readStructBegin() {
    fieldIdStack_ ~= lastFieldId_;
    lastFieldId_ = 0;
    return TStruct();
  }

  void readStructEnd() {
    lastFieldId_ = fieldIdStack_[$ - 1];
    fieldIdStack_ = fieldIdStack_[0 .. $ - 1];
  }

  TField readFieldBegin() {
    TField f = void;
    f.name = null;

    auto bite = readByte();
    auto type = cast(CType)(bite & 0x0f);

    if (type == CType.STOP) {
      // Struct stop byte, nothing more to do.
      f.id = 0;
      f.type = TType.STOP;
      return f;
    }

    // Mask off the 4 MSB of the type header, which could contain a field id
    // delta.
    auto modifier = cast(short)((bite & 0xf0) >> 4);
    if (modifier > 0) {
      f.id = cast(short)(lastFieldId_ + modifier);
    } else {
      // Delta encoding not used, just read the id as usual.
      f.id = readI16();
    }
    f.type = getTType(type);

    if (type == CType.BOOLEAN_TRUE || type == CType.BOOLEAN_FALSE) {
      // For boolean fields, the value is encoded in the type – keep it around
      // for the readBool() call.
      hasBoolValue_ = true;
      boolValue_ = (type == CType.BOOLEAN_TRUE ? true : false);
    }

    lastFieldId_ = f.id;
    return f;
  }
  void readFieldEnd() {}

  TList readListBegin() {
    auto sizeAndType = readByte();

    auto lsize = (sizeAndType >> 4) & 0xf;
    if (lsize == 0xf) {
      lsize = readVarint32();
    }
    checkSize(lsize, containerSizeLimit);

    TList l = void;
    l.elemType = getTType(cast(CType)(sizeAndType & 0x0f));
    l.size = cast(size_t)lsize;

    return l;
  }
  void readListEnd() {}

  TMap readMapBegin() {
    TMap m = void;

    auto size = readVarint32();
    ubyte kvType;
    if (size != 0) {
      kvType = readByte();
    }
    checkSize(size, containerSizeLimit);

    m.size = size;
    m.keyType = getTType(cast(CType)(kvType >> 4));
    m.valueType = getTType(cast(CType)(kvType & 0xf));

    return m;
  }
  void readMapEnd() {}

  TSet readSetBegin() {
    auto sizeAndType = readByte();

    auto lsize = (sizeAndType >> 4) & 0xf;
    if (lsize == 0xf) {
      lsize = readVarint32();
    }
    checkSize(lsize, containerSizeLimit);

    TSet s = void;
    s.elemType = getTType(cast(CType)(sizeAndType & 0xf));
    s.size = cast(size_t)lsize;

    return s;
  }
  void readSetEnd() {}

private:
  void writeFieldBeginInternal(TField field, byte typeOverride = -1) {
    // If there's a type override, use that.
    auto typeToWrite = (typeOverride == -1 ? toCType(field.type) : typeOverride);

    // check if we can use delta encoding for the field id
    if (field.id > lastFieldId_ && (field.id - lastFieldId_) <= 15) {
      // write them together
      writeByte(cast(byte)((field.id - lastFieldId_) << 4 | typeToWrite));
    } else {
      // write them separate
      writeByte(cast(byte)typeToWrite);
      writeI16(field.id);
    }

    lastFieldId_ = field.id;
  }


  void writeCollectionBegin(TType elemType, size_t size) {
    if (size <= 14) {
      writeByte(cast(byte)(size << 4 | toCType(elemType)));
    } else {
      assert(size <= int.max);
      writeByte(cast(byte)(0xf0 | toCType(elemType)));
      writeVarint32(cast(int)size);
    }
  }

  void writeVarint32(uint n) {
    ubyte[5] buf = void;
    ubyte wsize;

    while (true) {
      if ((n & ~0x7F) == 0) {
        buf[wsize++] = cast(ubyte)n;
        break;
      } else {
        buf[wsize++] = cast(ubyte)((n & 0x7F) | 0x80);
        n >>= 7;
      }
    }

    trans_.write(buf[0 .. wsize]);
  }

  /*
   * Write an i64 as a varint. Results in 1-10 bytes on the wire.
   */
  void writeVarint64(ulong n) {
    ubyte[10] buf = void;
    ubyte wsize;

    while (true) {
      if ((n & ~0x7FL) == 0) {
        buf[wsize++] = cast(ubyte)n;
        break;
      } else {
        buf[wsize++] = cast(ubyte)((n & 0x7F) | 0x80);
        n >>= 7;
      }
    }

    trans_.write(buf[0 .. wsize]);
  }

  /*
   * Convert l into a zigzag long. This allows negative numbers to be
   * represented compactly as a varint.
   */
  ulong i64ToZigzag(long l) {
    return (l << 1) ^ (l >> 63);
  }

  /*
   * Convert n into a zigzag int. This allows negative numbers to be
   * represented compactly as a varint.
   */
  uint i32ToZigzag(int n) {
    return (n << 1) ^ (n >> 31);
  }

  CType toCType(TType type) {
    final switch (type) {
      case TType.STOP:
        return CType.STOP;
      case TType.BOOL:
        return CType.BOOLEAN_TRUE;
      case TType.BYTE:
        return CType.BYTE;
      case TType.DOUBLE:
        return CType.DOUBLE;
      case TType.I16:
        return CType.I16;
      case TType.I32:
        return CType.I32;
      case TType.I64:
        return CType.I64;
      case TType.STRING:
        return CType.BINARY;
      case TType.STRUCT:
        return CType.STRUCT;
      case TType.MAP:
        return CType.MAP;
      case TType.SET:
        return CType.SET;
      case TType.LIST:
        return CType.LIST;
      case TType.VOID:
        assert(false, "Invalid type passed.");
    }
  }

  int readVarint32() {
    return cast(int)readVarint64();
  }

  long readVarint64() {
    ulong val;
    ubyte shift;
    ubyte[10] buf = void;  // 64 bits / (7 bits/byte) = 10 bytes.
    auto bufSize = buf.sizeof;
    auto borrowed = trans_.borrow(buf.ptr, bufSize);

    ubyte rsize;

    if (borrowed) {
      // Fast path.
      while (true) {
        auto bite = borrowed[rsize];
        rsize++;
        val |= cast(ulong)(bite & 0x7f) << shift;
        shift += 7;
        if (!(bite & 0x80)) {
          trans_.consume(rsize);
          return val;
        }
        // Have to check for invalid data so we don't crash.
        if (rsize == buf.sizeof) {
          throw new TProtocolException(TProtocolException.Type.INVALID_DATA,
            "Variable-length int over 10 bytes.");
        }
      }
    } else {
      // Slow path.
      while (true) {
        ubyte[1] bite;
        trans_.readAll(bite);
        ++rsize;

        val |= cast(ulong)(bite[0] & 0x7f) << shift;
        shift += 7;
        if (!(bite[0] & 0x80)) {
          return val;
        }

        // Might as well check for invalid data on the slow path too.
        if (rsize >= buf.sizeof) {
          throw new TProtocolException(TProtocolException.Type.INVALID_DATA,
            "Variable-length int over 10 bytes.");
        }
      }
    }
  }

  /*
   * Convert from zigzag int to int.
   */
  int zigzagToI32(uint n) {
    return (n >> 1) ^ -(n & 1);
  }

  /*
   * Convert from zigzag long to long.
   */
  long zigzagToI64(ulong n) {
    return (n >> 1) ^ -(n & 1);
  }

  TType getTType(CType type) {
    final switch (type) {
      case CType.STOP:
        return TType.STOP;
      case CType.BOOLEAN_FALSE:
        return TType.BOOL;
      case CType.BOOLEAN_TRUE:
        return TType.BOOL;
      case CType.BYTE:
        return TType.BYTE;
      case CType.I16:
        return TType.I16;
      case CType.I32:
        return TType.I32;
      case CType.I64:
        return TType.I64;
      case CType.DOUBLE:
        return TType.DOUBLE;
      case CType.BINARY:
        return TType.STRING;
      case CType.LIST:
        return TType.LIST;
      case CType.SET:
        return TType.SET;
      case CType.MAP:
        return TType.MAP;
      case CType.STRUCT:
        return TType.STRUCT;
    }
  }

  void checkSize(int size, int limit) {
    if (size < 0) {
      throw new TProtocolException(TProtocolException.Type.NEGATIVE_SIZE);
    } else if (limit > 0 && size > limit) {
      throw new TProtocolException(TProtocolException.Type.SIZE_LIMIT);
    }
  }

  enum PROTOCOL_ID = 0x82;
  enum VERSION_N = 1;
  enum VERSION_MASK = 0b0001_1111;
  enum TYPE_MASK = 0b1110_0000;
  enum TYPE_BITS = 0b0000_0111;
  enum TYPE_SHIFT_AMOUNT = 5;

  // Probably need to implement a better stack at some point.
  short[] fieldIdStack_;
  short lastFieldId_;

  TField booleanField_;

  bool hasBoolValue_;
  bool boolValue_;

  Transport trans_;
}

/**
 * TCompactProtocol construction helper to avoid having to explicitly specify
 * the transport type, i.e. to allow the constructor being called using IFTI
 * (see $(LINK2 http://d.puremagic.com/issues/show_bug.cgi?id=6082, D Bugzilla
 * enhancement requet 6082)).
 */
TCompactProtocol!Transport tCompactProtocol(Transport)(Transport trans,
  int containerSizeLimit = 0, int stringSizeLimit = 0
) if (isTTransport!Transport)
{
  return new TCompactProtocol!Transport(trans,
    containerSizeLimit, stringSizeLimit);
}

private {
  enum CType : ubyte {
    STOP = 0x0,
    BOOLEAN_TRUE = 0x1,
    BOOLEAN_FALSE = 0x2,
    BYTE = 0x3,
    I16 = 0x4,
    I32 = 0x5,
    I64 = 0x6,
    DOUBLE = 0x7,
    BINARY = 0x8,
    LIST = 0x9,
    SET = 0xa,
    MAP = 0xb,
    STRUCT = 0xc
  }
  static assert(CType.max <= 0xf,
    "Compact protocol wire type representation must fit into 4 bits.");
}

unittest {
  import std.exception;
  import thrift.transport.memory;

  // Check the message header format.
  auto buf = new TMemoryBuffer;
  auto compact = tCompactProtocol(buf);
  compact.writeMessageBegin(TMessage("foo", TMessageType.CALL, 0));

  auto header = new ubyte[7];
  buf.readAll(header);
  enforce(header == [
    130, // Protocol id.
    33, // Version/type byte.
    0, // Sequence id.
    3, 102, 111, 111 // Method name.
  ]);
}

unittest {
  import thrift.internal.test.protocol;
  testContainerSizeLimit!(TCompactProtocol!())();
  testStringSizeLimit!(TCompactProtocol!())();
}

/**
 * TProtocolFactory creating a TCompactProtocol instance for passed in
 * transports.
 *
 * The optional Transports template tuple parameter can be used to specify
 * one or more TTransport implementations to specifically instantiate
 * TCompactProtocol for. If the actual transport types encountered at
 * runtime match one of the transports in the list, a specialized protocol
 * instance is created. Otherwise, a generic TTransport version is used.
 */
class TCompactProtocolFactory(Transports...) if (
  allSatisfy!(isTTransport, Transports)
) : TProtocolFactory {
  ///
  this(int containerSizeLimit = 0, int stringSizeLimit = 0) {
    containerSizeLimit_ = 0;
    stringSizeLimit_ = 0;
  }

  TProtocol getProtocol(TTransport trans) const {
    foreach (Transport; TypeTuple!(Transports, TTransport)) {
      auto concreteTrans = cast(Transport)trans;
      if (concreteTrans) {
        return new TCompactProtocol!Transport(concreteTrans);
      }
    }
    throw new TProtocolException(
      "Passed null transport to TCompactProtocolFactory.");
  }

  int containerSizeLimit_;
  int stringSizeLimit_;
}
