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
import java.util.Stack;

import org.apache.thrift.TException;
import org.apache.thrift.transport.TTransport;

/**
 * JSON protocol implementation for thrift.
 *
 * This protocol is write-only and produces a simple output format
 * suitable for parsing by scripting languages.  It should not be
 * confused with the full-featured TJSONProtocol.
 *
 */
public class TSimpleJSONProtocol extends TProtocol {

  /**
   * Factory
   */
  public static class Factory implements TProtocolFactory {
    public TProtocol getProtocol(TTransport trans) {
      return new TSimpleJSONProtocol(trans);
    }
  }

  private static final byte[] COMMA = new byte[] {','};
  private static final byte[] COLON = new byte[] {':'};
  private static final byte[] LBRACE = new byte[] {'{'};
  private static final byte[] RBRACE = new byte[] {'}'};
  private static final byte[] LBRACKET = new byte[] {'['};
  private static final byte[] RBRACKET = new byte[] {']'};
  private static final char QUOTE = '"';

  private static final TStruct ANONYMOUS_STRUCT = new TStruct();
  private static final TField ANONYMOUS_FIELD = new TField();
  private static final TMessage EMPTY_MESSAGE = new TMessage();
  private static final TSet EMPTY_SET = new TSet();
  private static final TList EMPTY_LIST = new TList();
  private static final TMap EMPTY_MAP = new TMap();
  private static final String LIST = "list";
  private static final String SET = "set";
  private static final String MAP = "map";

  protected class Context {
    protected void write() throws TException {}

    /**
     * Returns whether the current value is a key in a map
     */
    protected boolean isMapKey() { return  false; }
  }

  protected class ListContext extends Context {
    protected boolean first_ = true;

    protected void write() throws TException {
      if (first_) {
        first_ = false;
      } else {
        trans_.write(COMMA);
      }
    }
  }

  protected class StructContext extends Context {
    protected boolean first_ = true;
    protected boolean colon_ = true;

    protected void write() throws TException {
      if (first_) {
        first_ = false;
        colon_ = true;
      } else {
        trans_.write(colon_ ? COLON : COMMA);
        colon_ = !colon_;
      }
    }
  }

  protected class MapContext extends StructContext {
    protected boolean isKey = true;

    @Override
    protected void write() throws TException {
      super.write();
      isKey = !isKey;
    }

    protected boolean isMapKey() {
      // we want to coerce map keys to json strings regardless
      // of their type
      return isKey;
    }
  }

  protected final Context BASE_CONTEXT = new Context();

  /**
   * Stack of nested contexts that we may be in.
   */
  protected Stack<Context> writeContextStack_ = new Stack<Context>();

  /**
   * Current context that we are in
   */
  protected Context writeContext_ = BASE_CONTEXT;

  /**
   * Push a new write context onto the stack.
   */
  protected void pushWriteContext(Context c) {
    writeContextStack_.push(writeContext_);
    writeContext_ = c;
  }

  /**
   * Pop the last write context off the stack
   */
  protected void popWriteContext() {
    writeContext_ = writeContextStack_.pop();
  }

  /**
   * Reset the write context stack to its initial state.
   */
  protected void resetWriteContext() {
    while (!writeContextStack_.isEmpty()) {
      popWriteContext();
    }
  }

  /**
   * Used to make sure that we are not encountering a map whose keys are containers
   */
  protected void assertContextIsNotMapKey(String invalidKeyType) throws CollectionMapKeyException {
    if (writeContext_.isMapKey()) {
      throw new CollectionMapKeyException("Cannot serialize a map with keys that are of type " + invalidKeyType);
    }
  }

  /**
   * Constructor
   */
  public TSimpleJSONProtocol(TTransport trans) {
    super(trans);
  }

  public void writeMessageBegin(TMessage message) throws TException {
    resetWriteContext(); // THRIFT-3743
    trans_.write(LBRACKET);
    pushWriteContext(new ListContext());
    writeString(message.name);
    writeByte(message.type);
    writeI32(message.seqid);
  }

  public void writeMessageEnd() throws TException {
    popWriteContext();
    trans_.write(RBRACKET);
  }

  public void writeStructBegin(TStruct struct) throws TException {
    writeContext_.write();
    trans_.write(LBRACE);
    pushWriteContext(new StructContext());
  }

  public void writeStructEnd() throws TException {
    popWriteContext();
    trans_.write(RBRACE);
  }

  public void writeFieldBegin(TField field) throws TException {
    // Note that extra type information is omitted in JSON!
    writeString(field.name);
  }

  public void writeFieldEnd() {}

  public void writeFieldStop() {}

  public void writeMapBegin(TMap map) throws TException {
    assertContextIsNotMapKey(MAP);
    writeContext_.write();
    trans_.write(LBRACE);
    pushWriteContext(new MapContext());
    // No metadata!
  }

  public void writeMapEnd() throws TException {
    popWriteContext();
    trans_.write(RBRACE);
  }

  public void writeListBegin(TList list) throws TException {
    assertContextIsNotMapKey(LIST);
    writeContext_.write();
    trans_.write(LBRACKET);
    pushWriteContext(new ListContext());
    // No metadata!
  }

  public void writeListEnd() throws TException {
    popWriteContext();
    trans_.write(RBRACKET);
  }

  public void writeSetBegin(TSet set) throws TException {
    assertContextIsNotMapKey(SET);
    writeContext_.write();
    trans_.write(LBRACKET);
    pushWriteContext(new ListContext());
    // No metadata!
  }

  public void writeSetEnd() throws TException {
    popWriteContext();
    trans_.write(RBRACKET);
  }

  public void writeBool(boolean b) throws TException {
    writeByte(b ? (byte)1 : (byte)0);
  }

  public void writeByte(byte b) throws TException {
    writeI32(b);
  }

  public void writeI16(short i16) throws TException {
    writeI32(i16);
  }

  public void writeI32(int i32) throws TException {
    if(writeContext_.isMapKey()) {
      writeString(Integer.toString(i32));
    } else {
      writeContext_.write();
      _writeStringData(Integer.toString(i32));
    }
  }

  public void _writeStringData(String s) throws TException {
    try {
      byte[] b = s.getBytes("UTF-8");
      trans_.write(b);
    } catch (UnsupportedEncodingException uex) {
      throw new TException("JVM DOES NOT SUPPORT UTF-8");
    }
  }

  public void writeI64(long i64) throws TException {
    if(writeContext_.isMapKey()) {
      writeString(Long.toString(i64));
    } else {
      writeContext_.write();
      _writeStringData(Long.toString(i64));
    }
  }

  public void writeDouble(double dub) throws TException {
    if(writeContext_.isMapKey()) {
      writeString(Double.toString(dub));
    } else {
      writeContext_.write();
      _writeStringData(Double.toString(dub));
    }
  }

  public void writeString(String str) throws TException {
    writeContext_.write();
    int length = str.length();
    StringBuffer escape = new StringBuffer(length + 16);
    escape.append(QUOTE);
    for (int i = 0; i < length; ++i) {
      char c = str.charAt(i);
      switch (c) {
      case '"':
      case '\\':
        escape.append('\\');
        escape.append(c);
        break;
      case '\b':
        escape.append('\\');
        escape.append('b');
        break;
      case '\f':
        escape.append('\\');
        escape.append('f');
        break;
      case '\n':
        escape.append('\\');
        escape.append('n');
        break;
      case '\r':
        escape.append('\\');
        escape.append('r');
        break;
      case '\t':
        escape.append('\\');
        escape.append('t');
        break;
      default:
        // Control characters! According to JSON RFC u0020 (space)
        if (c < ' ') {
          String hex = Integer.toHexString(c);
          escape.append('\\');
          escape.append('u');
          for (int j = 4; j > hex.length(); --j) {
            escape.append('0');
          }
          escape.append(hex);
        } else {
          escape.append(c);
        }
        break;
      }
    }
    escape.append(QUOTE);
    _writeStringData(escape.toString());
  }

  public void writeBinary(ByteBuffer bin) throws TException {
    try {
      // TODO(mcslee): Fix this
      writeString(new String(bin.array(), bin.position() + bin.arrayOffset(), bin.limit() - bin.position() - bin.arrayOffset(), "UTF-8"));
    } catch (UnsupportedEncodingException uex) {
      throw new TException("JVM DOES NOT SUPPORT UTF-8");
    }
  }

  /**
   * Reading methods.
   */

  public TMessage readMessageBegin() throws TException {
    // TODO(mcslee): implement
    return EMPTY_MESSAGE;
  }

  public void readMessageEnd() {}

  public TStruct readStructBegin() {
    // TODO(mcslee): implement
    return ANONYMOUS_STRUCT;
  }

  public void readStructEnd() {}

  public TField readFieldBegin() throws TException {
    // TODO(mcslee): implement
    return ANONYMOUS_FIELD;
  }

  public void readFieldEnd() {}

  public TMap readMapBegin() throws TException {
    // TODO(mcslee): implement
    return EMPTY_MAP;
  }

  public void readMapEnd() {}

  public TList readListBegin() throws TException {
    // TODO(mcslee): implement
    return EMPTY_LIST;
  }

  public void readListEnd() {}

  public TSet readSetBegin() throws TException {
    // TODO(mcslee): implement
    return EMPTY_SET;
  }

  public void readSetEnd() {}

  public boolean readBool() throws TException {
    return (readByte() == 1);
  }

  public byte readByte() throws TException {
    // TODO(mcslee): implement
    return 0;
  }

  public short readI16() throws TException {
    // TODO(mcslee): implement
    return 0;
  }

  public int readI32() throws TException {
    // TODO(mcslee): implement
    return 0;
  }

  public long readI64() throws TException {
    // TODO(mcslee): implement
    return 0;
  }

  public double readDouble() throws TException {
    // TODO(mcslee): implement
    return 0;
  }

  public String readString() throws TException {
    // TODO(mcslee): implement
    return "";
  }

  public String readStringBody(int size) throws TException {
    // TODO(mcslee): implement
    return "";
  }

  public ByteBuffer readBinary() throws TException {
    // TODO(mcslee): implement
    return ByteBuffer.wrap(new byte[0]);
  }

  public static class CollectionMapKeyException extends TException {
    public CollectionMapKeyException(String message) {
      super(message);
    }
  }
}
