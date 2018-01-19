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
#ifndef THRIFT_PROTOCOL_THEADERPROTOCOL_CPP_
#define THRIFT_PROTOCOL_THEADERPROTOCOL_CPP_ 1

#include <thrift/protocol/THeaderProtocol.h>
#include <thrift/protocol/TCompactProtocol.h>
#include <thrift/protocol/TBinaryProtocol.h>
#include <thrift/TApplicationException.h>

#include <limits>

#include <boost/static_assert.hpp>
#include <boost/make_shared.hpp>

namespace apache {
namespace thrift {
namespace protocol {

void THeaderProtocol::resetProtocol() {
  if (proto_ && protoId_ == trans_->getProtocolId()) {
    return;
  }

  protoId_ = trans_->getProtocolId();

  switch (protoId_) {
  case T_BINARY_PROTOCOL:
    proto_ = boost::make_shared<TBinaryProtocolT<THeaderTransport> >(trans_);
    break;

  case T_COMPACT_PROTOCOL:
    proto_ = boost::make_shared<TCompactProtocolT<THeaderTransport> >(trans_);
    break;

  default:
    throw TApplicationException(TApplicationException::INVALID_PROTOCOL,
                                "Unknown protocol requested");
  }
}

uint32_t THeaderProtocol::writeMessageBegin(const std::string& name,
                                            const TMessageType messageType,
                                            const int32_t seqId) {
  resetProtocol(); // Reset in case we changed protocols
  trans_->setSequenceNumber(seqId);
  return proto_->writeMessageBegin(name, messageType, seqId);
}

uint32_t THeaderProtocol::writeMessageEnd() {
  return proto_->writeMessageEnd();
}

uint32_t THeaderProtocol::writeStructBegin(const char* name) {
  return proto_->writeStructBegin(name);
}

uint32_t THeaderProtocol::writeStructEnd() {
  return proto_->writeStructEnd();
}

uint32_t THeaderProtocol::writeFieldBegin(const char* name,
                                          const TType fieldType,
                                          const int16_t fieldId) {
  return proto_->writeFieldBegin(name, fieldType, fieldId);
}

uint32_t THeaderProtocol::writeFieldEnd() {
  return proto_->writeFieldEnd();
}

uint32_t THeaderProtocol::writeFieldStop() {
  return proto_->writeFieldStop();
}

uint32_t THeaderProtocol::writeMapBegin(const TType keyType,
                                        const TType valType,
                                        const uint32_t size) {
  return proto_->writeMapBegin(keyType, valType, size);
}

uint32_t THeaderProtocol::writeMapEnd() {
  return proto_->writeMapEnd();
}

uint32_t THeaderProtocol::writeListBegin(const TType elemType, const uint32_t size) {
  return proto_->writeListBegin(elemType, size);
}

uint32_t THeaderProtocol::writeListEnd() {
  return proto_->writeListEnd();
}

uint32_t THeaderProtocol::writeSetBegin(const TType elemType, const uint32_t size) {
  return proto_->writeSetBegin(elemType, size);
}

uint32_t THeaderProtocol::writeSetEnd() {
  return proto_->writeSetEnd();
}

uint32_t THeaderProtocol::writeBool(const bool value) {
  return proto_->writeBool(value);
}

uint32_t THeaderProtocol::writeByte(const int8_t byte) {
  return proto_->writeByte(byte);
}

uint32_t THeaderProtocol::writeI16(const int16_t i16) {
  return proto_->writeI16(i16);
}

uint32_t THeaderProtocol::writeI32(const int32_t i32) {
  return proto_->writeI32(i32);
}

uint32_t THeaderProtocol::writeI64(const int64_t i64) {
  return proto_->writeI64(i64);
}

uint32_t THeaderProtocol::writeDouble(const double dub) {
  return proto_->writeDouble(dub);
}

uint32_t THeaderProtocol::writeString(const std::string& str) {
  return proto_->writeString(str);
}

uint32_t THeaderProtocol::writeBinary(const std::string& str) {
  return proto_->writeBinary(str);
}

/**
 * Reading functions
 */

uint32_t THeaderProtocol::readMessageBegin(std::string& name,
                                           TMessageType& messageType,
                                           int32_t& seqId) {
  // Read the next frame, and change protocols if needed
  try {
    trans_->resetProtocol();
    resetProtocol();
  } catch (const TApplicationException& ex) {
    writeMessageBegin("", T_EXCEPTION, 0);
    ex.write((TProtocol*)this);
    writeMessageEnd();
    trans_->flush();

    // The framing is still good, but we don't know about this protocol.
    // In the future, this could be made a client-side only error if
    // connection pooling is used.
    throw ex;
  }
  return proto_->readMessageBegin(name, messageType, seqId);
}

uint32_t THeaderProtocol::readMessageEnd() {
  return proto_->readMessageEnd();
}

uint32_t THeaderProtocol::readStructBegin(std::string& name) {
  return proto_->readStructBegin(name);
}

uint32_t THeaderProtocol::readStructEnd() {
  return proto_->readStructEnd();
}

uint32_t THeaderProtocol::readFieldBegin(std::string& name, TType& fieldType, int16_t& fieldId) {
  return proto_->readFieldBegin(name, fieldType, fieldId);
}

uint32_t THeaderProtocol::readFieldEnd() {
  return proto_->readFieldEnd();
}

uint32_t THeaderProtocol::readMapBegin(TType& keyType, TType& valType, uint32_t& size) {
  return proto_->readMapBegin(keyType, valType, size);
}

uint32_t THeaderProtocol::readMapEnd() {
  return proto_->readMapEnd();
}

uint32_t THeaderProtocol::readListBegin(TType& elemType, uint32_t& size) {
  return proto_->readListBegin(elemType, size);
}

uint32_t THeaderProtocol::readListEnd() {
  return proto_->readListEnd();
}

uint32_t THeaderProtocol::readSetBegin(TType& elemType, uint32_t& size) {
  return proto_->readSetBegin(elemType, size);
}

uint32_t THeaderProtocol::readSetEnd() {
  return proto_->readSetEnd();
}

uint32_t THeaderProtocol::readBool(bool& value) {
  return proto_->readBool(value);
}

uint32_t THeaderProtocol::readByte(int8_t& byte) {
  return proto_->readByte(byte);
}

uint32_t THeaderProtocol::readI16(int16_t& i16) {
  return proto_->readI16(i16);
}

uint32_t THeaderProtocol::readI32(int32_t& i32) {
  return proto_->readI32(i32);
}

uint32_t THeaderProtocol::readI64(int64_t& i64) {
  return proto_->readI64(i64);
}

uint32_t THeaderProtocol::readDouble(double& dub) {
  return proto_->readDouble(dub);
}

uint32_t THeaderProtocol::readString(std::string& str) {
  return proto_->readString(str);
}

uint32_t THeaderProtocol::readBinary(std::string& binary) {
  return proto_->readBinary(binary);
}
}
}
} // apache::thrift::protocol

#endif // #ifndef THRIFT_PROTOCOL_THEADERPROTOCOL_CPP_
