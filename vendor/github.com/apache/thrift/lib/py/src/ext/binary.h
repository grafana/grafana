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

#ifndef THRIFT_PY_BINARY_H
#define THRIFT_PY_BINARY_H

#include <Python.h>
#include "ext/protocol.h"
#include "ext/endian.h"
#include <stdint.h>

namespace apache {
namespace thrift {
namespace py {

class BinaryProtocol : public ProtocolBase<BinaryProtocol> {
public:
  virtual ~BinaryProtocol() {}

  void writeI8(int8_t val) { writeBuffer(reinterpret_cast<char*>(&val), sizeof(int8_t)); }

  void writeI16(int16_t val) {
    int16_t net = static_cast<int16_t>(htons(val));
    writeBuffer(reinterpret_cast<char*>(&net), sizeof(int16_t));
  }

  void writeI32(int32_t val) {
    int32_t net = static_cast<int32_t>(htonl(val));
    writeBuffer(reinterpret_cast<char*>(&net), sizeof(int32_t));
  }

  void writeI64(int64_t val) {
    int64_t net = static_cast<int64_t>(htonll(val));
    writeBuffer(reinterpret_cast<char*>(&net), sizeof(int64_t));
  }

  void writeDouble(double dub) {
    // Unfortunately, bitwise_cast doesn't work in C.  Bad C!
    union {
      double f;
      int64_t t;
    } transfer;
    transfer.f = dub;
    writeI64(transfer.t);
  }

  void writeBool(int v) { writeByte(static_cast<uint8_t>(v)); }

  void writeString(PyObject* value, int32_t len) {
    writeI32(len);
    writeBuffer(PyBytes_AS_STRING(value), len);
  }

  bool writeListBegin(PyObject* value, const SetListTypeArgs& parsedargs, int32_t len) {
    writeByte(parsedargs.element_type);
    writeI32(len);
    return true;
  }

  bool writeMapBegin(PyObject* value, const MapTypeArgs& parsedargs, int32_t len) {
    writeByte(parsedargs.ktag);
    writeByte(parsedargs.vtag);
    writeI32(len);
    return true;
  }

  bool writeStructBegin() { return true; }
  bool writeStructEnd() { return true; }
  bool writeField(PyObject* value, const StructItemSpec& parsedspec) {
    writeByte(static_cast<uint8_t>(parsedspec.type));
    writeI16(parsedspec.tag);
    return encodeValue(value, parsedspec.type, parsedspec.typeargs);
  }

  void writeFieldStop() { writeByte(static_cast<uint8_t>(T_STOP)); }

  bool readBool(bool& val) {
    char* buf;
    if (!readBytes(&buf, 1)) {
      return false;
    }
    val = buf[0] == 1;
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
    char* buf;
    if (!readBytes(&buf, sizeof(int16_t))) {
      return false;
    }
    val = static_cast<int16_t>(ntohs(*reinterpret_cast<int16_t*>(buf)));
    return true;
  }

  bool readI32(int32_t& val) {
    char* buf;
    if (!readBytes(&buf, sizeof(int32_t))) {
      return false;
    }
    val = static_cast<int32_t>(ntohl(*reinterpret_cast<int32_t*>(buf)));
    return true;
  }

  bool readI64(int64_t& val) {
    char* buf;
    if (!readBytes(&buf, sizeof(int64_t))) {
      return false;
    }
    val = static_cast<int64_t>(ntohll(*reinterpret_cast<int64_t*>(buf)));
    return true;
  }

  bool readDouble(double& val) {
    union {
      int64_t f;
      double t;
    } transfer;

    if (!readI64(transfer.f)) {
      return false;
    }
    val = transfer.t;
    return true;
  }

  int32_t readString(char** buf) {
    int32_t len = 0;
    if (!readI32(len) || !checkLengthLimit(len, stringLimit()) || !readBytes(buf, len)) {
      return -1;
    }
    return len;
  }

  int32_t readListBegin(TType& etype) {
    int32_t len;
    uint8_t b = 0;
    if (!readByte(b) || !readI32(len) || !checkLengthLimit(len, containerLimit())) {
      return -1;
    }
    etype = static_cast<TType>(b);
    return len;
  }

  int32_t readMapBegin(TType& ktype, TType& vtype) {
    int32_t len;
    uint8_t k, v;
    if (!readByte(k) || !readByte(v) || !readI32(len) || !checkLengthLimit(len, containerLimit())) {
      return -1;
    }
    ktype = static_cast<TType>(k);
    vtype = static_cast<TType>(v);
    return len;
  }

  bool readStructBegin() { return true; }
  bool readStructEnd() { return true; }

  bool readFieldBegin(TType& type, int16_t& tag);

#define SKIPBYTES(n)                                                                               \
  do {                                                                                             \
    if (!readBytes(&dummy_buf_, (n))) {                                                            \
      return false;                                                                                \
    }                                                                                              \
    return true;                                                                                   \
  } while (0)

  bool skipBool() { SKIPBYTES(1); }
  bool skipByte() { SKIPBYTES(1); }
  bool skipI16() { SKIPBYTES(2); }
  bool skipI32() { SKIPBYTES(4); }
  bool skipI64() { SKIPBYTES(8); }
  bool skipDouble() { SKIPBYTES(8); }
  bool skipString() {
    int32_t len;
    if (!readI32(len)) {
      return false;
    }
    SKIPBYTES(len);
  }
#undef SKIPBYTES

private:
  char* dummy_buf_;
};
}
}
}
#endif // THRIFT_PY_BINARY_H
