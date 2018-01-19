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

#ifndef THRIFT_PY_COMPACT_H
#define THRIFT_PY_COMPACT_H

#include <Python.h>
#include "ext/protocol.h"
#include "ext/endian.h"
#include <stdint.h>
#include <stack>

namespace apache {
namespace thrift {
namespace py {

class CompactProtocol : public ProtocolBase<CompactProtocol> {
public:
  CompactProtocol() { readBool_.exists = false; }

  virtual ~CompactProtocol() {}

  void writeI8(int8_t val) { writeBuffer(reinterpret_cast<char*>(&val), 1); }

  void writeI16(int16_t val) { writeVarint(toZigZag(val)); }

  int writeI32(int32_t val) { return writeVarint(toZigZag(val)); }

  void writeI64(int64_t val) { writeVarint64(toZigZag64(val)); }

  void writeDouble(double dub) {
    union {
      double f;
      int64_t t;
    } transfer;
    transfer.f = htolell(dub);
    writeBuffer(reinterpret_cast<char*>(&transfer.t), sizeof(int64_t));
  }

  void writeBool(int v) { writeByte(static_cast<uint8_t>(v ? CT_BOOLEAN_TRUE : CT_BOOLEAN_FALSE)); }

  void writeString(PyObject* value, int32_t len) {
    writeVarint(len);
    writeBuffer(PyBytes_AS_STRING(value), len);
  }

  bool writeListBegin(PyObject* value, const SetListTypeArgs& args, int32_t len) {
    int ctype = toCompactType(args.element_type);
    if (len <= 14) {
      writeByte(static_cast<uint8_t>(len << 4 | ctype));
    } else {
      writeByte(0xf0 | ctype);
      writeVarint(len);
    }
    return true;
  }

  bool writeMapBegin(PyObject* value, const MapTypeArgs& args, int32_t len) {
    if (len == 0) {
      writeByte(0);
      return true;
    }
    int ctype = toCompactType(args.ktag) << 4 | toCompactType(args.vtag);
    writeVarint(len);
    writeByte(ctype);
    return true;
  }

  bool writeStructBegin() {
    writeTags_.push(0);
    return true;
  }
  bool writeStructEnd() {
    writeTags_.pop();
    return true;
  }

  bool writeField(PyObject* value, const StructItemSpec& spec) {
    if (spec.type == T_BOOL) {
      doWriteFieldBegin(spec, PyObject_IsTrue(value) ? CT_BOOLEAN_TRUE : CT_BOOLEAN_FALSE);
      return true;
    } else {
      doWriteFieldBegin(spec, toCompactType(spec.type));
      return encodeValue(value, spec.type, spec.typeargs);
    }
  }

  void writeFieldStop() { writeByte(0); }

  bool readBool(bool& val) {
    if (readBool_.exists) {
      readBool_.exists = false;
      val = readBool_.value;
      return true;
    }
    char* buf;
    if (!readBytes(&buf, 1)) {
      return false;
    }
    val = buf[0] == CT_BOOLEAN_TRUE;
    return true;
  }
  bool readI8(int8_t& val) {
    char* buf;
    if (!readBytes(&buf, 1)) {
      return false;
    }
    val = buf[0];
    return true;
  }

  bool readI16(int16_t& val) {
    uint16_t uval;
    if (readVarint<uint16_t, 3>(uval)) {
      val = fromZigZag<int16_t, uint16_t>(uval);
      return true;
    }
    return false;
  }

  bool readI32(int32_t& val) {
    uint32_t uval;
    if (readVarint<uint32_t, 5>(uval)) {
      val = fromZigZag<int32_t, uint32_t>(uval);
      return true;
    }
    return false;
  }

  bool readI64(int64_t& val) {
    uint64_t uval;
    if (readVarint<uint64_t, 10>(uval)) {
      val = fromZigZag<int64_t, uint64_t>(uval);
      return true;
    }
    return false;
  }

  bool readDouble(double& val) {
    union {
      int64_t f;
      double t;
    } transfer;

    char* buf;
    if (!readBytes(&buf, 8)) {
      return false;
    }
    transfer.f = letohll(*reinterpret_cast<int64_t*>(buf));
    val = transfer.t;
    return true;
  }

  int32_t readString(char** buf) {
    uint32_t len;
    if (!readVarint<uint32_t, 5>(len) || !checkLengthLimit(len, stringLimit())) {
      return -1;
    }
    if (len == 0) {
      return 0;
    }
    if (!readBytes(buf, len)) {
      return -1;
    }
    return len;
  }

  int32_t readListBegin(TType& etype) {
    uint8_t b;
    if (!readByte(b)) {
      return -1;
    }
    etype = getTType(b & 0xf);
    if (etype == -1) {
      return -1;
    }
    uint32_t len = (b >> 4) & 0xf;
    if (len == 15 && !readVarint<uint32_t, 5>(len)) {
      return -1;
    }
    if (!checkLengthLimit(len, containerLimit())) {
      return -1;
    }
    return len;
  }

  int32_t readMapBegin(TType& ktype, TType& vtype) {
    uint32_t len;
    if (!readVarint<uint32_t, 5>(len) || !checkLengthLimit(len, containerLimit())) {
      return -1;
    }
    if (len != 0) {
      uint8_t kvType;
      if (!readByte(kvType)) {
        return -1;
      }
      ktype = getTType(kvType >> 4);
      vtype = getTType(kvType & 0xf);
      if (ktype == -1 || vtype == -1) {
        return -1;
      }
    }
    return len;
  }

  bool readStructBegin() {
    readTags_.push(0);
    return true;
  }
  bool readStructEnd() {
    readTags_.pop();
    return true;
  }
  bool readFieldBegin(TType& type, int16_t& tag);

  bool skipBool() {
    bool val;
    return readBool(val);
  }
#define SKIPBYTES(n)                                                                               \
  do {                                                                                             \
    if (!readBytes(&dummy_buf_, (n))) {                                                            \
      return false;                                                                                \
    }                                                                                              \
    return true;                                                                                   \
  } while (0)
  bool skipByte() { SKIPBYTES(1); }
  bool skipDouble() { SKIPBYTES(8); }
  bool skipI16() {
    int16_t val;
    return readI16(val);
  }
  bool skipI32() {
    int32_t val;
    return readI32(val);
  }
  bool skipI64() {
    int64_t val;
    return readI64(val);
  }
  bool skipString() {
    uint32_t len;
    if (!readVarint<uint32_t, 5>(len)) {
      return false;
    }
    SKIPBYTES(len);
  }
#undef SKIPBYTES

private:
  enum Types {
    CT_STOP = 0x00,
    CT_BOOLEAN_TRUE = 0x01,
    CT_BOOLEAN_FALSE = 0x02,
    CT_BYTE = 0x03,
    CT_I16 = 0x04,
    CT_I32 = 0x05,
    CT_I64 = 0x06,
    CT_DOUBLE = 0x07,
    CT_BINARY = 0x08,
    CT_LIST = 0x09,
    CT_SET = 0x0A,
    CT_MAP = 0x0B,
    CT_STRUCT = 0x0C
  };

  static const uint8_t TTypeToCType[];

  TType getTType(uint8_t type);

  int toCompactType(TType type) {
    int i = static_cast<int>(type);
    return i < 16 ? TTypeToCType[i] : -1;
  }

  uint32_t toZigZag(int32_t val) { return (val >> 31) ^ (val << 1); }

  uint64_t toZigZag64(int64_t val) { return (val >> 63) ^ (val << 1); }

  int writeVarint(uint32_t val) {
    int cnt = 1;
    while (val & ~0x7fU) {
      writeByte(static_cast<char>((val & 0x7fU) | 0x80U));
      val >>= 7;
      ++cnt;
    }
    writeByte(static_cast<char>(val));
    return cnt;
  }

  int writeVarint64(uint64_t val) {
    int cnt = 1;
    while (val & ~0x7fULL) {
      writeByte(static_cast<char>((val & 0x7fULL) | 0x80ULL));
      val >>= 7;
      ++cnt;
    }
    writeByte(static_cast<char>(val));
    return cnt;
  }

  template <typename T, int Max>
  bool readVarint(T& result) {
    uint8_t b;
    T val = 0;
    int shift = 0;
    for (int i = 0; i < Max; ++i) {
      if (!readByte(b)) {
        return false;
      }
      if (b & 0x80) {
        val |= static_cast<T>(b & 0x7f) << shift;
      } else {
        val |= static_cast<T>(b) << shift;
        result = val;
        return true;
      }
      shift += 7;
    }
    PyErr_Format(PyExc_OverflowError, "varint exceeded %d bytes", Max);
    return false;
  }

  template <typename S, typename U>
  S fromZigZag(U val) {
    return (val >> 1) ^ static_cast<U>(-static_cast<S>(val & 1));
  }

  void doWriteFieldBegin(const StructItemSpec& spec, int ctype) {
    int diff = spec.tag - writeTags_.top();
    if (diff > 0 && diff <= 15) {
      writeByte(static_cast<uint8_t>(diff << 4 | ctype));
    } else {
      writeByte(static_cast<uint8_t>(ctype));
      writeI16(spec.tag);
    }
    writeTags_.top() = spec.tag;
  }

  std::stack<int> writeTags_;
  std::stack<int> readTags_;
  struct {
    bool exists;
    bool value;
  } readBool_;
  char* dummy_buf_;
};
}
}
}
#endif // THRIFT_PY_COMPACT_H
