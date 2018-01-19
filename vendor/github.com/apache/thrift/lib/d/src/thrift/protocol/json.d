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
module thrift.protocol.json;

import std.algorithm;
import std.array;
import std.base64;
import std.conv;
import std.range;
import std.string : format;
import std.traits : isIntegral;
import std.typetuple : allSatisfy, TypeTuple;
import std.utf : toUTF8;
import thrift.protocol.base;
import thrift.transport.base;

alias Base64Impl!('+', '/', Base64.NoPadding) Base64NoPad;

/**
 * Implementation of the Thrift JSON protocol.
 */
final class TJsonProtocol(Transport = TTransport) if (
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

    context_ = new Context();
    reader_ = new LookaheadReader(trans);
  }

  Transport transport() @property {
    return trans_;
  }

  void reset() {
    destroy(contextStack_);
    context_ = new Context();
    reader_ = new LookaheadReader(trans_);
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
   * Note: For binary data, the limit applies to the length of the
   * Base64-encoded string data, not the resulting byte array.
   *
   * Defaults to zero (no limit).
   */
  int stringSizeLimit;

  /*
   * Writing methods.
   */

  void writeBool(bool b) {
    writeJsonInteger(b ? 1 : 0);
  }

  void writeByte(byte b) {
    writeJsonInteger(b);
  }

  void writeI16(short i16) {
    writeJsonInteger(i16);
  }

  void writeI32(int i32) {
    writeJsonInteger(i32);
  }

  void writeI64(long i64) {
    writeJsonInteger(i64);
  }

  void writeDouble(double dub) {
    context_.write(trans_);

    string value;
    if (dub is double.nan) {
      value = NAN_STRING;
    } else if (dub is double.infinity) {
      value = INFINITY_STRING;
    } else if (dub is -double.infinity) {
      value = NEG_INFINITY_STRING;
    }

    bool escapeNum = value !is null || context_.escapeNum;

    if (value is null) {
      /* precision is 17 */
      value = format("%.17g", dub);
    }

    if (escapeNum) trans_.write(STRING_DELIMITER);
    trans_.write(cast(ubyte[])value);
    if (escapeNum) trans_.write(STRING_DELIMITER);
  }

  void writeString(string str) {
    context_.write(trans_);
    trans_.write(STRING_DELIMITER);
    foreach (c; str) {
      writeJsonChar(c);
    }
    trans_.write(STRING_DELIMITER);
  }

  void writeBinary(ubyte[] buf) {
    context_.write(trans_);

    trans_.write(STRING_DELIMITER);
    ubyte[4] b;
    while (!buf.empty) {
      auto toWrite = take(buf, 3);
      Base64NoPad.encode(toWrite, b[]);
      trans_.write(b[0 .. toWrite.length + 1]);
      buf.popFrontN(toWrite.length);
    }
    trans_.write(STRING_DELIMITER);
  }

  void writeMessageBegin(TMessage msg) {
    writeJsonArrayBegin();
    writeJsonInteger(THRIFT_JSON_VERSION);
    writeString(msg.name);
    writeJsonInteger(cast(byte)msg.type);
    writeJsonInteger(msg.seqid);
  }

  void writeMessageEnd() {
    writeJsonArrayEnd();
  }

  void writeStructBegin(TStruct tstruct) {
    writeJsonObjectBegin();
  }

  void writeStructEnd() {
    writeJsonObjectEnd();
  }

  void writeFieldBegin(TField field) {
    writeJsonInteger(field.id);
    writeJsonObjectBegin();
    writeString(getNameFromTType(field.type));
  }

  void writeFieldEnd() {
    writeJsonObjectEnd();
  }

  void writeFieldStop() {}

  void writeListBegin(TList list) {
    writeJsonArrayBegin();
    writeString(getNameFromTType(list.elemType));
    writeJsonInteger(list.size);
  }

  void writeListEnd() {
    writeJsonArrayEnd();
  }

  void writeMapBegin(TMap map) {
    writeJsonArrayBegin();
    writeString(getNameFromTType(map.keyType));
    writeString(getNameFromTType(map.valueType));
    writeJsonInteger(map.size);
    writeJsonObjectBegin();
  }

  void writeMapEnd() {
    writeJsonObjectEnd();
    writeJsonArrayEnd();
  }

  void writeSetBegin(TSet set) {
    writeJsonArrayBegin();
    writeString(getNameFromTType(set.elemType));
    writeJsonInteger(set.size);
  }

  void writeSetEnd() {
    writeJsonArrayEnd();
  }


  /*
   * Reading methods.
   */

  bool readBool() {
    return readJsonInteger!byte() ? true : false;
  }

  byte readByte() {
    return readJsonInteger!byte();
  }

  short readI16() {
    return readJsonInteger!short();
  }

  int readI32() {
    return readJsonInteger!int();
  }

  long readI64() {
    return readJsonInteger!long();
  }

  double readDouble() {
    context_.read(reader_);

    if (reader_.peek() == STRING_DELIMITER) {
      auto str = readJsonString(true);
      if (str == NAN_STRING) {
        return double.nan;
      }
      if (str == INFINITY_STRING) {
        return double.infinity;
      }
      if (str == NEG_INFINITY_STRING) {
        return -double.infinity;
      }

      if (!context_.escapeNum) {
        // Throw exception -- we should not be in a string in this case
        throw new TProtocolException("Numeric data unexpectedly quoted",
          TProtocolException.Type.INVALID_DATA);
      }
      try {
        return to!double(str);
      } catch (ConvException e) {
        throw new TProtocolException(`Expected numeric value; got "` ~ str ~
          `".`, TProtocolException.Type.INVALID_DATA);
      }
    }
    else {
      if (context_.escapeNum) {
        // This will throw - we should have had a quote if escapeNum == true
        readJsonSyntaxChar(STRING_DELIMITER);
      }

      auto str = readJsonNumericChars();
      try {
        return to!double(str);
      } catch (ConvException e) {
        throw new TProtocolException(`Expected numeric value; got "` ~ str ~
          `".`, TProtocolException.Type.INVALID_DATA);
      }
    }
  }

  string readString() {
    return readJsonString(false);
  }

  ubyte[] readBinary() {
    return Base64NoPad.decode(readString());
  }

  TMessage readMessageBegin() {
    TMessage msg = void;

    readJsonArrayBegin();

    auto ver = readJsonInteger!short();
    if (ver != THRIFT_JSON_VERSION) {
      throw new TProtocolException("Message contained bad version.",
        TProtocolException.Type.BAD_VERSION);
    }

    msg.name = readString();
    msg.type = cast(TMessageType)readJsonInteger!byte();
    msg.seqid = readJsonInteger!short();

    return msg;
  }

  void readMessageEnd() {
    readJsonArrayEnd();
  }

  TStruct readStructBegin() {
    readJsonObjectBegin();
    return TStruct();
  }

  void readStructEnd() {
    readJsonObjectEnd();
  }

  TField readFieldBegin() {
    TField f = void;
    f.name = null;

    auto ch = reader_.peek();
    if (ch == OBJECT_END) {
      f.type = TType.STOP;
    } else {
      f.id = readJsonInteger!short();
      readJsonObjectBegin();
      f.type = getTTypeFromName(readString());
    }

    return f;
  }

  void readFieldEnd() {
    readJsonObjectEnd();
  }

  TList readListBegin() {
    readJsonArrayBegin();
    auto type = getTTypeFromName(readString());
    auto size = readContainerSize();
    return TList(type, size);
  }

  void readListEnd() {
    readJsonArrayEnd();
  }

  TMap readMapBegin() {
    readJsonArrayBegin();
    auto keyType = getTTypeFromName(readString());
    auto valueType = getTTypeFromName(readString());
    auto size = readContainerSize();
    readJsonObjectBegin();
    return TMap(keyType, valueType, size);
  }

  void readMapEnd() {
    readJsonObjectEnd();
    readJsonArrayEnd();
  }

  TSet readSetBegin() {
    readJsonArrayBegin();
    auto type = getTTypeFromName(readString());
    auto size = readContainerSize();
    return TSet(type, size);
  }

  void readSetEnd() {
    readJsonArrayEnd();
  }

private:
  void pushContext(Context c) {
    contextStack_ ~= context_;
    context_ = c;
  }

  void popContext() {
    context_ = contextStack_.back;
    contextStack_.popBack();
    contextStack_.assumeSafeAppend();
  }

  /*
   * Writing functions
   */

  // Write the character ch as a Json escape sequence ("\u00xx")
  void writeJsonEscapeChar(ubyte ch) {
    trans_.write(ESCAPE_PREFIX);
    trans_.write(ESCAPE_PREFIX);
    auto outCh = hexChar(cast(ubyte)(ch >> 4));
    trans_.write((&outCh)[0 .. 1]);
    outCh = hexChar(ch);
    trans_.write((&outCh)[0 .. 1]);
  }

  // Write the character ch as part of a Json string, escaping as appropriate.
  void writeJsonChar(ubyte ch) {
    if (ch >= 0x30) {
      if (ch == '\\') { // Only special character >= 0x30 is '\'
        trans_.write(BACKSLASH);
        trans_.write(BACKSLASH);
      } else {
        trans_.write((&ch)[0 .. 1]);
      }
    }
    else {
      auto outCh = kJsonCharTable[ch];
      // Check if regular character, backslash escaped, or Json escaped
      if (outCh == 1) {
        trans_.write((&ch)[0 .. 1]);
      } else if (outCh > 1) {
        trans_.write(BACKSLASH);
        trans_.write((&outCh)[0 .. 1]);
      } else {
        writeJsonEscapeChar(ch);
      }
    }
  }

  // Convert the given integer type to a Json number, or a string
  // if the context requires it (eg: key in a map pair).
  void writeJsonInteger(T)(T num) if (isIntegral!T) {
    context_.write(trans_);

    auto escapeNum = context_.escapeNum();
    if (escapeNum) trans_.write(STRING_DELIMITER);
    trans_.write(cast(ubyte[])to!string(num));
    if (escapeNum) trans_.write(STRING_DELIMITER);
  }

  void writeJsonObjectBegin() {
    context_.write(trans_);
    trans_.write(OBJECT_BEGIN);
    pushContext(new PairContext());
  }

  void writeJsonObjectEnd() {
    popContext();
    trans_.write(OBJECT_END);
  }

  void writeJsonArrayBegin() {
    context_.write(trans_);
    trans_.write(ARRAY_BEGIN);
    pushContext(new ListContext());
  }

  void writeJsonArrayEnd() {
    popContext();
    trans_.write(ARRAY_END);
  }

  /*
   * Reading functions
   */

  int readContainerSize() {
    auto size = readJsonInteger!int();
    if (size < 0) {
      throw new TProtocolException(TProtocolException.Type.NEGATIVE_SIZE);
    } else if (containerSizeLimit > 0 && size > containerSizeLimit) {
      throw new TProtocolException(TProtocolException.Type.SIZE_LIMIT);
    }
    return size;
  }

  void readJsonSyntaxChar(ubyte[1] ch) {
    return readSyntaxChar(reader_, ch);
  }

  wchar readJsonEscapeChar() {
    auto a = reader_.read();
    auto b = reader_.read();
    auto c = reader_.read();
    auto d = reader_.read();
    return cast(ushort)(
          (hexVal(a[0]) << 12) + (hexVal(b[0]) << 8) +
          (hexVal(c[0]) << 4) + hexVal(d[0])
        );
  }

  string readJsonString(bool skipContext = false) {
    if (!skipContext) context_.read(reader_);

    readJsonSyntaxChar(STRING_DELIMITER);
    auto buffer = appender!string();

    wchar[] wchs;
    int bytesRead;
    while (true) {
      auto ch = reader_.read();
      if (ch == STRING_DELIMITER) {
        break;
      }

      ++bytesRead;
      if (stringSizeLimit > 0 && bytesRead > stringSizeLimit) {
        throw new TProtocolException(TProtocolException.Type.SIZE_LIMIT);
      }

      if (ch == BACKSLASH) {
        ch = reader_.read();
        if (ch == ESCAPE_CHAR) {
          auto wch = readJsonEscapeChar();
          if (wch >= 0xD800 && wch <= 0xDBFF) {
            wchs ~= wch;
          } else if (wch >= 0xDC00 && wch <= 0xDFFF && wchs.length == 0) {
            throw new TProtocolException("Missing UTF-16 high surrogate.",
                                         TProtocolException.Type.INVALID_DATA);
          } else {
            wchs ~= wch;
            buffer.put(wchs.toUTF8);
            wchs = [];
          }
          continue;
        } else {
          auto pos = countUntil(kEscapeChars[], ch[0]);
          if (pos == -1) {
            throw new TProtocolException("Expected control char, got '" ~
              cast(char)ch[0] ~ "'.", TProtocolException.Type.INVALID_DATA);
          }
          ch = kEscapeCharVals[pos];
        }
      }
      if (wchs.length != 0) {
        throw new TProtocolException("Missing UTF-16 low surrogate.",
                                     TProtocolException.Type.INVALID_DATA);
      }
      buffer.put(ch[0]);
    }

    if (wchs.length != 0) {
      throw new TProtocolException("Missing UTF-16 low surrogate.",
                                   TProtocolException.Type.INVALID_DATA);
    }
    return buffer.data;
  }

  // Reads a sequence of characters, stopping at the first one that is not
  // a valid Json numeric character.
  string readJsonNumericChars() {
    string str;
    while (true) {
      auto ch = reader_.peek();
      if (!isJsonNumeric(ch[0])) {
        break;
      }
      reader_.read();
      str ~= ch;
    }
    return str;
  }

  // Reads a sequence of characters and assembles them into a number,
  // returning them via num
  T readJsonInteger(T)() if (isIntegral!T) {
    context_.read(reader_);
    if (context_.escapeNum()) {
      readJsonSyntaxChar(STRING_DELIMITER);
    }
    auto str = readJsonNumericChars();
    T num;
    try {
      num = to!T(str);
    } catch (ConvException e) {
      throw new TProtocolException(`Expected numeric value, got "` ~ str ~ `".`,
        TProtocolException.Type.INVALID_DATA);
    }
    if (context_.escapeNum()) {
      readJsonSyntaxChar(STRING_DELIMITER);
    }
    return num;
  }

  void readJsonObjectBegin() {
    context_.read(reader_);
    readJsonSyntaxChar(OBJECT_BEGIN);
    pushContext(new PairContext());
  }

  void readJsonObjectEnd() {
    readJsonSyntaxChar(OBJECT_END);
    popContext();
  }

  void readJsonArrayBegin() {
    context_.read(reader_);
    readJsonSyntaxChar(ARRAY_BEGIN);
    pushContext(new ListContext());
  }

  void readJsonArrayEnd() {
    readJsonSyntaxChar(ARRAY_END);
    popContext();
  }

  static {
    final class LookaheadReader {
      this(Transport trans) {
        trans_ = trans;
      }

      ubyte[1] read() {
        if (hasData_) {
          hasData_ = false;
        } else {
          trans_.readAll(data_);
        }
        return data_;
      }

      ubyte[1] peek() {
        if (!hasData_) {
          trans_.readAll(data_);
          hasData_ = true;
        }
        return data_;
      }

     private:
      Transport trans_;
      bool hasData_;
      ubyte[1] data_;
    }

    /*
     * Class to serve as base Json context and as base class for other context
     * implementations
     */
    class Context {
      /**
       * Write context data to the transport. Default is to do nothing.
       */
      void write(Transport trans) {}

      /**
       * Read context data from the transport. Default is to do nothing.
       */
      void read(LookaheadReader reader) {}

      /**
       * Return true if numbers need to be escaped as strings in this context.
       * Default behavior is to return false.
       */
      bool escapeNum() @property {
        return false;
      }
    }

    // Context class for object member key-value pairs
    class PairContext : Context {
      this() {
        first_ = true;
        colon_ = true;
      }

      override void write(Transport trans) {
        if (first_) {
          first_ = false;
          colon_ = true;
        } else {
          trans.write(colon_ ? PAIR_SEP : ELEM_SEP);
          colon_ = !colon_;
        }
      }

      override void read(LookaheadReader reader) {
        if (first_) {
          first_ = false;
          colon_ = true;
        } else {
          auto ch = (colon_ ? PAIR_SEP : ELEM_SEP);
          colon_ = !colon_;
          return readSyntaxChar(reader, ch);
        }
      }

      // Numbers must be turned into strings if they are the key part of a pair
      override bool escapeNum() @property {
        return colon_;
      }

    private:
      bool first_;
      bool colon_;
    }

    class ListContext : Context {
      this() {
        first_ = true;
      }

      override void write(Transport trans) {
        if (first_) {
          first_ = false;
        } else {
          trans.write(ELEM_SEP);
        }
      }

      override void read(LookaheadReader reader) {
        if (first_) {
          first_ = false;
        } else {
          readSyntaxChar(reader, ELEM_SEP);
        }
      }

    private:
      bool first_;
    }

    // Read 1 character from the transport trans and verify that it is the
    // expected character ch.
    // Throw a protocol exception if it is not.
    void readSyntaxChar(LookaheadReader reader, ubyte[1] ch) {
      auto ch2 = reader.read();
      if (ch2 != ch) {
        throw new TProtocolException("Expected '" ~ cast(char)ch[0] ~ "', got '" ~
          cast(char)ch2[0] ~ "'.", TProtocolException.Type.INVALID_DATA);
      }
    }
  }

  // Probably need to implement a better stack at some point.
  Context[] contextStack_;
  Context context_;

  Transport trans_;
  LookaheadReader reader_;
}

/**
 * TJsonProtocol construction helper to avoid having to explicitly specify
 * the transport type, i.e. to allow the constructor being called using IFTI
 * (see $(LINK2 http://d.puremagic.com/issues/show_bug.cgi?id=6082, D Bugzilla
 * enhancement requet 6082)).
 */
TJsonProtocol!Transport tJsonProtocol(Transport)(Transport trans,
  int containerSizeLimit = 0, int stringSizeLimit = 0
) if (isTTransport!Transport) {
  return new TJsonProtocol!Transport(trans, containerSizeLimit, stringSizeLimit);
}

unittest {
  import std.exception;
  import thrift.transport.memory;

  // Check the message header format.
  auto buf = new TMemoryBuffer;
  auto json = tJsonProtocol(buf);
  json.writeMessageBegin(TMessage("foo", TMessageType.CALL, 0));
  json.writeMessageEnd();

  auto header = new ubyte[13];
  buf.readAll(header);
  enforce(cast(char[])header == `[1,"foo",1,0]`);
}

unittest {
  import std.exception;
  import thrift.transport.memory;

  // Check that short binary data is read correctly (the Thrift JSON format
  // does not include padding chars in the Base64 encoded data).
  auto buf = new TMemoryBuffer;
  auto json = tJsonProtocol(buf);
  json.writeBinary([1, 2]);
  json.reset();
  enforce(json.readBinary() == [1, 2]);
}

unittest {
  import std.exception;
  import thrift.transport.memory;

  auto buf = new TMemoryBuffer(cast(ubyte[])"\"\\u0e01 \\ud835\\udd3e\"");
  auto json = tJsonProtocol(buf);
  auto str = json.readString();
  enforce(str == "ก 𝔾");
}

unittest {
  // Thrown if low surrogate is missing.
  import std.exception;
  import thrift.transport.memory;

  auto buf = new TMemoryBuffer(cast(ubyte[])"\"\\u0e01 \\ud835\"");
  auto json = tJsonProtocol(buf);
  assertThrown!TProtocolException(json.readString());
}

unittest {
  // Thrown if high surrogate is missing.
  import std.exception;
  import thrift.transport.memory;

  auto buf = new TMemoryBuffer(cast(ubyte[])"\"\\u0e01 \\udd3e\"");
  auto json = tJsonProtocol(buf);
  assertThrown!TProtocolException(json.readString());
}

unittest {
  import thrift.internal.test.protocol;
  testContainerSizeLimit!(TJsonProtocol!())();
  testStringSizeLimit!(TJsonProtocol!())();
}

/**
 * TProtocolFactory creating a TJsonProtocol instance for passed in
 * transports.
 *
 * The optional Transports template tuple parameter can be used to specify
 * one or more TTransport implementations to specifically instantiate
 * TJsonProtocol for. If the actual transport types encountered at
 * runtime match one of the transports in the list, a specialized protocol
 * instance is created. Otherwise, a generic TTransport version is used.
 */
class TJsonProtocolFactory(Transports...) if (
  allSatisfy!(isTTransport, Transports)
) : TProtocolFactory {
  TProtocol getProtocol(TTransport trans) const {
    foreach (Transport; TypeTuple!(Transports, TTransport)) {
      auto concreteTrans = cast(Transport)trans;
      if (concreteTrans) {
        auto p = new TJsonProtocol!Transport(concreteTrans);
        return p;
      }
    }
    throw new TProtocolException(
      "Passed null transport to TJsonProtocolFactoy.");
  }
}

private {
  immutable ubyte[1] OBJECT_BEGIN = '{';
  immutable ubyte[1] OBJECT_END = '}';
  immutable ubyte[1] ARRAY_BEGIN = '[';
  immutable ubyte[1] ARRAY_END = ']';
  immutable ubyte[1] NEWLINE = '\n';
  immutable ubyte[1] PAIR_SEP = ':';
  immutable ubyte[1] ELEM_SEP = ',';
  immutable ubyte[1] BACKSLASH = '\\';
  immutable ubyte[1] STRING_DELIMITER = '"';
  immutable ubyte[1] ZERO_CHAR = '0';
  immutable ubyte[1] ESCAPE_CHAR = 'u';
  immutable ubyte[4] ESCAPE_PREFIX = cast(ubyte[4])r"\u00";

  enum THRIFT_JSON_VERSION = 1;

  immutable NAN_STRING = "NaN";
  immutable INFINITY_STRING = "Infinity";
  immutable NEG_INFINITY_STRING = "-Infinity";

  string getNameFromTType(TType typeID) {
    final switch (typeID) {
      case TType.BOOL:
        return "tf";
      case TType.BYTE:
        return "i8";
      case TType.I16:
        return "i16";
      case TType.I32:
        return "i32";
      case TType.I64:
        return "i64";
      case TType.DOUBLE:
        return "dbl";
      case TType.STRING:
        return "str";
      case TType.STRUCT:
        return "rec";
      case TType.MAP:
        return "map";
      case TType.LIST:
        return "lst";
      case TType.SET:
        return "set";
      case TType.STOP: goto case;
      case TType.VOID:
        assert(false, "Invalid type passed.");
    }
  }

  TType getTTypeFromName(string name) {
    TType result;
    if (name.length > 1) {
      switch (name[0]) {
        case 'd':
          result = TType.DOUBLE;
          break;
        case 'i':
          switch (name[1]) {
            case '8':
              result = TType.BYTE;
              break;
            case '1':
              result = TType.I16;
              break;
            case '3':
              result = TType.I32;
              break;
            case '6':
              result = TType.I64;
              break;
            default:
              // Do nothing.
          }
          break;
        case 'l':
          result = TType.LIST;
          break;
        case 'm':
          result = TType.MAP;
          break;
        case 'r':
          result = TType.STRUCT;
          break;
        case 's':
          if (name[1] == 't') {
            result = TType.STRING;
          }
          else if (name[1] == 'e') {
            result = TType.SET;
          }
          break;
        case 't':
          result = TType.BOOL;
          break;
        default:
          // Do nothing.
      }
    }
    if (result == TType.STOP) {
      throw new TProtocolException("Unrecognized type",
        TProtocolException.Type.NOT_IMPLEMENTED);
    }
    return result;
  }

  // This table describes the handling for the first 0x30 characters
  //  0 : escape using "\u00xx" notation
  //  1 : just output index
  // <other> : escape using "\<other>" notation
  immutable ubyte[0x30] kJsonCharTable = [
  //  0   1   2   3   4   5   6   7   8   9   A   B   C   D   E   F
      0,  0,  0,  0,  0,  0,  0,  0,'b','t','n',  0,'f','r',  0,  0, // 0
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, // 1
      1,  1,'"',  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1, // 2
  ];

  // This string's characters must match up with the elements in kEscapeCharVals.
  // I don't have '/' on this list even though it appears on www.json.org --
  // it is not in the RFC
  immutable kEscapeChars = cast(ubyte[7]) `"\\bfnrt`;

  // The elements of this array must match up with the sequence of characters in
  // kEscapeChars
  immutable ubyte[7] kEscapeCharVals = [
    '"', '\\', '\b', '\f', '\n', '\r', '\t',
  ];

  // Return the integer value of a hex character ch.
  // Throw a protocol exception if the character is not [0-9a-f].
  ubyte hexVal(ubyte ch) {
    if ((ch >= '0') && (ch <= '9')) {
      return cast(ubyte)(ch - '0');
    } else if ((ch >= 'a') && (ch <= 'f')) {
      return cast(ubyte)(ch - 'a' + 10);
    }
    else {
      throw new TProtocolException("Expected hex val ([0-9a-f]), got '" ~
        ch ~ "'.", TProtocolException.Type.INVALID_DATA);
    }
  }

  // Return the hex character representing the integer val. The value is masked
  // to make sure it is in the correct range.
  ubyte hexChar(ubyte val) {
    val &= 0x0F;
    if (val < 10) {
      return cast(ubyte)(val + '0');
    } else {
      return cast(ubyte)(val - 10 + 'a');
    }
  }

  // Return true if the character ch is in [-+0-9.Ee]; false otherwise
  bool isJsonNumeric(ubyte ch) {
    switch (ch) {
      case '+':
      case '-':
      case '.':
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
      case 'E':
      case 'e':
        return true;
      default:
        return false;
    }
  }
}
