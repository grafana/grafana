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

package org.apache.thrift.protocol;

import java.io.UnsupportedEncodingException;
import java.nio.ByteBuffer;

import org.apache.thrift.TException;
import org.apache.thrift.transport.TTransport;

/**
 * Binary protocol implementation for thrift.
 *
 */
public class TBinaryProtocol extends TProtocol {
  private static final TStruct ANONYMOUS_STRUCT = new TStruct();
  private static final long NO_LENGTH_LIMIT = -1;

  protected static final int VERSION_MASK = 0xffff0000;
  protected static final int VERSION_1 = 0x80010000;

  /**
   * The maximum number of bytes to read from the transport for
   * variable-length fields (such as strings or binary) or {@link #NO_LENGTH_LIMIT} for
   * unlimited.
   */
  private final long stringLengthLimit_;

  /**
   * The maximum number of elements to read from the network for
   * containers (maps, sets, lists), or {@link #NO_LENGTH_LIMIT} for unlimited.
   */
  private final long containerLengthLimit_;

  protected boolean strictRead_;
  protected boolean strictWrite_;

  private final byte[] inoutTemp = new byte[8];

  /**
   * Factory
   */
  public static class Factory implements TProtocolFactory {
    protected long stringLengthLimit_;
    protected long containerLengthLimit_;
    protected boolean strictRead_;
    protected boolean strictWrite_;

    public Factory() {
      this(false, true);
    }

    public Factory(boolean strictRead, boolean strictWrite) {
      this(strictRead, strictWrite, NO_LENGTH_LIMIT, NO_LENGTH_LIMIT);
    }

    public Factory(long stringLengthLimit, long containerLengthLimit) {
      this(false, true, stringLengthLimit, containerLengthLimit);
    }

    public Factory(boolean strictRead, boolean strictWrite, long stringLengthLimit, long containerLengthLimit) {
      stringLengthLimit_ = stringLengthLimit;
      containerLengthLimit_ = containerLengthLimit;
      strictRead_ = strictRead;
      strictWrite_ = strictWrite;
    }

    public TProtocol getProtocol(TTransport trans) {
      return new TBinaryProtocol(trans, stringLengthLimit_, containerLengthLimit_, strictRead_, strictWrite_);
    }
  }

  /**
   * Constructor
   */
  public TBinaryProtocol(TTransport trans) {
    this(trans, false, true);
  }

  public TBinaryProtocol(TTransport trans, boolean strictRead, boolean strictWrite) {
    this(trans, NO_LENGTH_LIMIT, NO_LENGTH_LIMIT, strictRead, strictWrite);
  }

  public TBinaryProtocol(TTransport trans, long stringLengthLimit, long containerLengthLimit) {
    this(trans, stringLengthLimit, containerLengthLimit, false, true);
  }

  public TBinaryProtocol(TTransport trans, long stringLengthLimit, long containerLengthLimit, boolean strictRead, boolean strictWrite) {
    super(trans);
    stringLengthLimit_ = stringLengthLimit;
    containerLengthLimit_ = containerLengthLimit;
    strictRead_ = strictRead;
    strictWrite_ = strictWrite;
  }

  public void writeMessageBegin(TMessage message) throws TException {
    if (strictWrite_) {
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

  public void writeMessageEnd() {}

  public void writeStructBegin(TStruct struct) {}

  public void writeStructEnd() {}

  public void writeFieldBegin(TField field) throws TException {
    writeByte(field.type);
    writeI16(field.id);
  }

  public void writeFieldEnd() {}

  public void writeFieldStop() throws TException {
    writeByte(TType.STOP);
  }

  public void writeMapBegin(TMap map) throws TException {
    writeByte(map.keyType);
    writeByte(map.valueType);
    writeI32(map.size);
  }

  public void writeMapEnd() {}

  public void writeListBegin(TList list) throws TException {
    writeByte(list.elemType);
    writeI32(list.size);
  }

  public void writeListEnd() {}

  public void writeSetBegin(TSet set) throws TException {
    writeByte(set.elemType);
    writeI32(set.size);
  }

  public void writeSetEnd() {}

  public void writeBool(boolean b) throws TException {
    writeByte(b ? (byte)1 : (byte)0);
  }

  public void writeByte(byte b) throws TException {
    inoutTemp[0] = b;
    trans_.write(inoutTemp, 0, 1);
  }

  public void writeI16(short i16) throws TException {
    inoutTemp[0] = (byte)(0xff & (i16 >> 8));
    inoutTemp[1] = (byte)(0xff & (i16));
    trans_.write(inoutTemp, 0, 2);
  }

  public void writeI32(int i32) throws TException {
    inoutTemp[0] = (byte)(0xff & (i32 >> 24));
    inoutTemp[1] = (byte)(0xff & (i32 >> 16));
    inoutTemp[2] = (byte)(0xff & (i32 >> 8));
    inoutTemp[3] = (byte)(0xff & (i32));
    trans_.write(inoutTemp, 0, 4);
  }

  public void writeI64(long i64) throws TException {
    inoutTemp[0] = (byte)(0xff & (i64 >> 56));
    inoutTemp[1] = (byte)(0xff & (i64 >> 48));
    inoutTemp[2] = (byte)(0xff & (i64 >> 40));
    inoutTemp[3] = (byte)(0xff & (i64 >> 32));
    inoutTemp[4] = (byte)(0xff & (i64 >> 24));
    inoutTemp[5] = (byte)(0xff & (i64 >> 16));
    inoutTemp[6] = (byte)(0xff & (i64 >> 8));
    inoutTemp[7] = (byte)(0xff & (i64));
    trans_.write(inoutTemp, 0, 8);
  }

  public void writeDouble(double dub) throws TException {
    writeI64(Double.doubleToLongBits(dub));
  }

  public void writeString(String str) throws TException {
    try {
      byte[] dat = str.getBytes("UTF-8");
      writeI32(dat.length);
      trans_.write(dat, 0, dat.length);
    } catch (UnsupportedEncodingException uex) {
      throw new TException("JVM DOES NOT SUPPORT UTF-8");
    }
  }

  public void writeBinary(ByteBuffer bin) throws TException {
    int length = bin.limit() - bin.position();
    writeI32(length);
    trans_.write(bin.array(), bin.position() + bin.arrayOffset(), length);
  }

  /**
   * Reading methods.
   */

  public TMessage readMessageBegin() throws TException {
    int size = readI32();
    if (size < 0) {
      int version = size & VERSION_MASK;
      if (version != VERSION_1) {
        throw new TProtocolException(TProtocolException.BAD_VERSION, "Bad version in readMessageBegin");
      }
      return new TMessage(readString(), (byte)(size & 0x000000ff), readI32());
    } else {
      if (strictRead_) {
        throw new TProtocolException(TProtocolException.BAD_VERSION, "Missing version in readMessageBegin, old client?");
      }
      return new TMessage(readStringBody(size), readByte(), readI32());
    }
  }

  public void readMessageEnd() {}

  public TStruct readStructBegin() {
    return ANONYMOUS_STRUCT;
  }

  public void readStructEnd() {}

  public TField readFieldBegin() throws TException {
    byte type = readByte();
    short id = type == TType.STOP ? 0 : readI16();
    return new TField("", type, id);
  }

  public void readFieldEnd() {}

  public TMap readMapBegin() throws TException {
    TMap map = new TMap(readByte(), readByte(), readI32());
    checkContainerReadLength(map.size);
    return map;
  }

  public void readMapEnd() {}

  public TList readListBegin() throws TException {
    TList list = new TList(readByte(), readI32());
    checkContainerReadLength(list.size);
    return list;
  }

  public void readListEnd() {}

  public TSet readSetBegin() throws TException {
    TSet set = new TSet(readByte(), readI32());
    checkContainerReadLength(set.size);
    return set;
  }

  public void readSetEnd() {}

  public boolean readBool() throws TException {
    return (readByte() == 1);
  }

  public byte readByte() throws TException {
    if (trans_.getBytesRemainingInBuffer() >= 1) {
      byte b = trans_.getBuffer()[trans_.getBufferPosition()];
      trans_.consumeBuffer(1);
      return b;
    }
    readAll(inoutTemp, 0, 1);
    return inoutTemp[0];
  }

  public short readI16() throws TException {
    byte[] buf = inoutTemp;
    int off = 0;

    if (trans_.getBytesRemainingInBuffer() >= 2) {
      buf = trans_.getBuffer();
      off = trans_.getBufferPosition();
      trans_.consumeBuffer(2);
    } else {
      readAll(inoutTemp, 0, 2);
    }

    return
      (short)
      (((buf[off] & 0xff) << 8) |
       ((buf[off+1] & 0xff)));
  }

  public int readI32() throws TException {
    byte[] buf = inoutTemp;
    int off = 0;

    if (trans_.getBytesRemainingInBuffer() >= 4) {
      buf = trans_.getBuffer();
      off = trans_.getBufferPosition();
      trans_.consumeBuffer(4);
    } else {
      readAll(inoutTemp, 0, 4);
    }
    return
      ((buf[off] & 0xff) << 24) |
      ((buf[off+1] & 0xff) << 16) |
      ((buf[off+2] & 0xff) <<  8) |
      ((buf[off+3] & 0xff));
  }

  public long readI64() throws TException {
    byte[] buf = inoutTemp;
    int off = 0;

    if (trans_.getBytesRemainingInBuffer() >= 8) {
      buf = trans_.getBuffer();
      off = trans_.getBufferPosition();
      trans_.consumeBuffer(8);
    } else {
      readAll(inoutTemp, 0, 8);
    }

    return
      ((long)(buf[off]   & 0xff) << 56) |
      ((long)(buf[off+1] & 0xff) << 48) |
      ((long)(buf[off+2] & 0xff) << 40) |
      ((long)(buf[off+3] & 0xff) << 32) |
      ((long)(buf[off+4] & 0xff) << 24) |
      ((long)(buf[off+5] & 0xff) << 16) |
      ((long)(buf[off+6] & 0xff) <<  8) |
      ((long)(buf[off+7] & 0xff));
  }

  public double readDouble() throws TException {
    return Double.longBitsToDouble(readI64());
  }

  public String readString() throws TException {
    int size = readI32();

    checkStringReadLength(size);

    if (trans_.getBytesRemainingInBuffer() >= size) {
      try {
        String s = new String(trans_.getBuffer(), trans_.getBufferPosition(), size, "UTF-8");
        trans_.consumeBuffer(size);
        return s;
      } catch (UnsupportedEncodingException e) {
        throw new TException("JVM DOES NOT SUPPORT UTF-8");
      }
    }

    return readStringBody(size);
  }

  public String readStringBody(int size) throws TException {
    try {
      byte[] buf = new byte[size];
      trans_.readAll(buf, 0, size);
      return new String(buf, "UTF-8");
    } catch (UnsupportedEncodingException uex) {
      throw new TException("JVM DOES NOT SUPPORT UTF-8");
    }
  }

  public ByteBuffer readBinary() throws TException {
    int size = readI32();

    checkStringReadLength(size);

    if (trans_.getBytesRemainingInBuffer() >= size) {
      ByteBuffer bb = ByteBuffer.wrap(trans_.getBuffer(), trans_.getBufferPosition(), size);
      trans_.consumeBuffer(size);
      return bb;
    }

    byte[] buf = new byte[size];
    trans_.readAll(buf, 0, size);
    return ByteBuffer.wrap(buf);
  }

  private void checkStringReadLength(int length) throws TProtocolException {
    if (length < 0) {
      throw new TProtocolException(TProtocolException.NEGATIVE_SIZE,
                                   "Negative length: " + length);
    }
    if (stringLengthLimit_ != NO_LENGTH_LIMIT && length > stringLengthLimit_) {
      throw new TProtocolException(TProtocolException.SIZE_LIMIT,
                                   "Length exceeded max allowed: " + length);
    }
  }

  private void checkContainerReadLength(int length) throws TProtocolException {
    if (length < 0) {
      throw new TProtocolException(TProtocolException.NEGATIVE_SIZE,
                                   "Negative length: " + length);
    }
    if (containerLengthLimit_ != NO_LENGTH_LIMIT && length > containerLengthLimit_) {
      throw new TProtocolException(TProtocolException.SIZE_LIMIT,
                                   "Length exceeded max allowed: " + length);
    }
  }

  private int readAll(byte[] buf, int off, int len) throws TException {
    return trans_.readAll(buf, off, len);
  }
}
