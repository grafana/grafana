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

#ifndef THRIFT_TPROTOCOLDECORATOR_H_
#define THRIFT_TPROTOCOLDECORATOR_H_ 1

#include <thrift/protocol/TProtocol.h>
#include <boost/shared_ptr.hpp>

namespace apache {
namespace thrift {
namespace protocol {
using boost::shared_ptr;

/**
 * <code>TProtocolDecorator</code> forwards all requests to an enclosed
 * <code>TProtocol</code> instance, providing a way to author concise
 * concrete decorator subclasses.
 *
 * <p>See p.175 of Design Patterns (by Gamma et al.)</p>
 *
 * @see apache::thrift::protocol::TMultiplexedProtocol
 */
class TProtocolDecorator : public TProtocol {
public:
  virtual ~TProtocolDecorator() {}

  // Desc: Initializes the protocol decorator object.
  TProtocolDecorator(shared_ptr<TProtocol> proto)
    : TProtocol(proto->getTransport()), protocol(proto) {}

  virtual uint32_t writeMessageBegin_virt(const std::string& name,
                                          const TMessageType messageType,
                                          const int32_t seqid) {
    return protocol->writeMessageBegin(name, messageType, seqid);
  }
  virtual uint32_t writeMessageEnd_virt() { return protocol->writeMessageEnd(); }
  virtual uint32_t writeStructBegin_virt(const char* name) {
    return protocol->writeStructBegin(name);
  }
  virtual uint32_t writeStructEnd_virt() { return protocol->writeStructEnd(); }

  virtual uint32_t writeFieldBegin_virt(const char* name,
                                        const TType fieldType,
                                        const int16_t fieldId) {
    return protocol->writeFieldBegin(name, fieldType, fieldId);
  }

  virtual uint32_t writeFieldEnd_virt() { return protocol->writeFieldEnd(); }
  virtual uint32_t writeFieldStop_virt() { return protocol->writeFieldStop(); }

  virtual uint32_t writeMapBegin_virt(const TType keyType,
                                      const TType valType,
                                      const uint32_t size) {
    return protocol->writeMapBegin(keyType, valType, size);
  }

  virtual uint32_t writeMapEnd_virt() { return protocol->writeMapEnd(); }

  virtual uint32_t writeListBegin_virt(const TType elemType, const uint32_t size) {
    return protocol->writeListBegin(elemType, size);
  }
  virtual uint32_t writeListEnd_virt() { return protocol->writeListEnd(); }

  virtual uint32_t writeSetBegin_virt(const TType elemType, const uint32_t size) {
    return protocol->writeSetBegin(elemType, size);
  }
  virtual uint32_t writeSetEnd_virt() { return protocol->writeSetEnd(); }

  virtual uint32_t writeBool_virt(const bool value) { return protocol->writeBool(value); }
  virtual uint32_t writeByte_virt(const int8_t byte) { return protocol->writeByte(byte); }
  virtual uint32_t writeI16_virt(const int16_t i16) { return protocol->writeI16(i16); }
  virtual uint32_t writeI32_virt(const int32_t i32) { return protocol->writeI32(i32); }
  virtual uint32_t writeI64_virt(const int64_t i64) { return protocol->writeI64(i64); }

  virtual uint32_t writeDouble_virt(const double dub) { return protocol->writeDouble(dub); }
  virtual uint32_t writeString_virt(const std::string& str) { return protocol->writeString(str); }
  virtual uint32_t writeBinary_virt(const std::string& str) { return protocol->writeBinary(str); }

  virtual uint32_t readMessageBegin_virt(std::string& name,
                                         TMessageType& messageType,
                                         int32_t& seqid) {
    return protocol->readMessageBegin(name, messageType, seqid);
  }
  virtual uint32_t readMessageEnd_virt() { return protocol->readMessageEnd(); }

  virtual uint32_t readStructBegin_virt(std::string& name) {
    return protocol->readStructBegin(name);
  }
  virtual uint32_t readStructEnd_virt() { return protocol->readStructEnd(); }

  virtual uint32_t readFieldBegin_virt(std::string& name, TType& fieldType, int16_t& fieldId) {
    return protocol->readFieldBegin(name, fieldType, fieldId);
  }
  virtual uint32_t readFieldEnd_virt() { return protocol->readFieldEnd(); }

  virtual uint32_t readMapBegin_virt(TType& keyType, TType& valType, uint32_t& size) {
    return protocol->readMapBegin(keyType, valType, size);
  }
  virtual uint32_t readMapEnd_virt() { return protocol->readMapEnd(); }

  virtual uint32_t readListBegin_virt(TType& elemType, uint32_t& size) {
    return protocol->readListBegin(elemType, size);
  }
  virtual uint32_t readListEnd_virt() { return protocol->readListEnd(); }

  virtual uint32_t readSetBegin_virt(TType& elemType, uint32_t& size) {
    return protocol->readSetBegin(elemType, size);
  }
  virtual uint32_t readSetEnd_virt() { return protocol->readSetEnd(); }

  virtual uint32_t readBool_virt(bool& value) { return protocol->readBool(value); }
  virtual uint32_t readBool_virt(std::vector<bool>::reference value) {
    return protocol->readBool(value);
  }

  virtual uint32_t readByte_virt(int8_t& byte) { return protocol->readByte(byte); }

  virtual uint32_t readI16_virt(int16_t& i16) { return protocol->readI16(i16); }
  virtual uint32_t readI32_virt(int32_t& i32) { return protocol->readI32(i32); }
  virtual uint32_t readI64_virt(int64_t& i64) { return protocol->readI64(i64); }

  virtual uint32_t readDouble_virt(double& dub) { return protocol->readDouble(dub); }

  virtual uint32_t readString_virt(std::string& str) { return protocol->readString(str); }
  virtual uint32_t readBinary_virt(std::string& str) { return protocol->readBinary(str); }

private:
  shared_ptr<TProtocol> protocol;
};
}
}
}

#endif // THRIFT_TPROTOCOLDECORATOR_H_
