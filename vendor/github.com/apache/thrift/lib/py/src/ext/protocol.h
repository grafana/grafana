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

#ifndef THRIFT_PY_PROTOCOL_H
#define THRIFT_PY_PROTOCOL_H

#include "ext/types.h"
#include <limits>
#include <stdint.h>

namespace apache {
namespace thrift {
namespace py {

template <typename Impl>
class ProtocolBase {

public:
  ProtocolBase()
    : stringLimit_(std::numeric_limits<int32_t>::max()),
      containerLimit_(std::numeric_limits<int32_t>::max()),
      output_(NULL) {}
  inline virtual ~ProtocolBase();

  bool prepareDecodeBufferFromTransport(PyObject* trans);

  PyObject* readStruct(PyObject* output, PyObject* klass, PyObject* spec_seq);

  bool prepareEncodeBuffer();

  bool encodeValue(PyObject* value, TType type, PyObject* typeargs);

  PyObject* getEncodedValue();

  long stringLimit() const { return stringLimit_; }
  void setStringLengthLimit(long limit) { stringLimit_ = limit; }

  long containerLimit() const { return containerLimit_; }
  void setContainerLengthLimit(long limit) { containerLimit_ = limit; }

protected:
  bool readBytes(char** output, int len);

  bool readByte(uint8_t& val) {
    char* buf;
    if (!readBytes(&buf, 1)) {
      return false;
    }
    val = static_cast<uint8_t>(buf[0]);
    return true;
  }

  bool writeBuffer(char* data, size_t len);

  void writeByte(uint8_t val) { writeBuffer(reinterpret_cast<char*>(&val), 1); }

  PyObject* decodeValue(TType type, PyObject* typeargs);

  bool skip(TType type);

  inline bool checkType(TType got, TType expected);
  inline bool checkLengthLimit(int32_t len, long limit);

  inline bool isUtf8(PyObject* typeargs);

private:
  Impl* impl() { return static_cast<Impl*>(this); }

  long stringLimit_;
  long containerLimit_;
  EncodeBuffer* output_;
  DecodeBuffer input_;
};
}
}
}

#include "ext/protocol.tcc"

#endif // THRIFT_PY_PROTOCOL_H
