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

#ifndef _THRIFT_PROTOCOL_TPROTOCOLTAP_H_
#define _THRIFT_PROTOCOL_TPROTOCOLTAP_H_ 1

#include <thrift/protocol/TVirtualProtocol.h>

namespace apache {
namespace thrift {
namespace protocol {

using apache::thrift::transport::TTransport;

/**
 * Puts a wiretap on a protocol object.  Any reads to this class are passed
 * through to an enclosed protocol object, but also mirrored as write to a
 * second protocol object.
 *
 */
class TProtocolTap : public TVirtualProtocol<TProtocolTap> {
public:
  TProtocolTap(boost::shared_ptr<TProtocol> source, boost::shared_ptr<TProtocol> sink)
    : TVirtualProtocol<TProtocolTap>(source->getTransport()), source_(source), sink_(sink) {}

  uint32_t readMessageBegin(std::string& name, TMessageType& messageType, int32_t& seqid) {
    uint32_t rv = source_->readMessageBegin(name, messageType, seqid);
    sink_->writeMessageBegin(name, messageType, seqid);
    return rv;
  }

  uint32_t readMessageEnd() {
    uint32_t rv = source_->readMessageEnd();
    sink_->writeMessageEnd();
    return rv;
  }

  uint32_t readStructBegin(std::string& name) {
    uint32_t rv = source_->readStructBegin(name);
    sink_->writeStructBegin(name.c_str());
    return rv;
  }

  uint32_t readStructEnd() {
    uint32_t rv = source_->readStructEnd();
    sink_->writeStructEnd();
    return rv;
  }

  uint32_t readFieldBegin(std::string& name, TType& fieldType, int16_t& fieldId) {
    uint32_t rv = source_->readFieldBegin(name, fieldType, fieldId);
    if (fieldType == T_STOP) {
      sink_->writeFieldStop();
    } else {
      sink_->writeFieldBegin(name.c_str(), fieldType, fieldId);
    }
    return rv;
  }

  uint32_t readFieldEnd() {
    uint32_t rv = source_->readFieldEnd();
    sink_->writeFieldEnd();
    return rv;
  }

  uint32_t readMapBegin(TType& keyType, TType& valType, uint32_t& size) {
    uint32_t rv = source_->readMapBegin(keyType, valType, size);
    sink_->writeMapBegin(keyType, valType, size);
    return rv;
  }

  uint32_t readMapEnd() {
    uint32_t rv = source_->readMapEnd();
    sink_->writeMapEnd();
    return rv;
  }

  uint32_t readListBegin(TType& elemType, uint32_t& size) {
    uint32_t rv = source_->readListBegin(elemType, size);
    sink_->writeListBegin(elemType, size);
    return rv;
  }

  uint32_t readListEnd() {
    uint32_t rv = source_->readListEnd();
    sink_->writeListEnd();
    return rv;
  }

  uint32_t readSetBegin(TType& elemType, uint32_t& size) {
    uint32_t rv = source_->readSetBegin(elemType, size);
    sink_->writeSetBegin(elemType, size);
    return rv;
  }

  uint32_t readSetEnd() {
    uint32_t rv = source_->readSetEnd();
    sink_->writeSetEnd();
    return rv;
  }

  uint32_t readBool(bool& value) {
    uint32_t rv = source_->readBool(value);
    sink_->writeBool(value);
    return rv;
  }

  // Provide the default readBool() implementation for std::vector<bool>
  using TVirtualProtocol<TProtocolTap>::readBool;

  uint32_t readByte(int8_t& byte) {
    uint32_t rv = source_->readByte(byte);
    sink_->writeByte(byte);
    return rv;
  }

  uint32_t readI16(int16_t& i16) {
    uint32_t rv = source_->readI16(i16);
    sink_->writeI16(i16);
    return rv;
  }

  uint32_t readI32(int32_t& i32) {
    uint32_t rv = source_->readI32(i32);
    sink_->writeI32(i32);
    return rv;
  }

  uint32_t readI64(int64_t& i64) {
    uint32_t rv = source_->readI64(i64);
    sink_->writeI64(i64);
    return rv;
  }

  uint32_t readDouble(double& dub) {
    uint32_t rv = source_->readDouble(dub);
    sink_->writeDouble(dub);
    return rv;
  }

  uint32_t readString(std::string& str) {
    uint32_t rv = source_->readString(str);
    sink_->writeString(str);
    return rv;
  }

  uint32_t readBinary(std::string& str) {
    uint32_t rv = source_->readBinary(str);
    sink_->writeBinary(str);
    return rv;
  }

private:
  boost::shared_ptr<TProtocol> source_;
  boost::shared_ptr<TProtocol> sink_;
};
}
}
} // apache::thrift::protocol

#endif // #define _THRIFT_PROTOCOL_TPROTOCOLTAP_H_ 1
