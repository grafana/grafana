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

#ifndef _THRIFT_TEST_GENERICHELPERS_H_
#define _THRIFT_TEST_GENERICHELPERS_H_ 1

#include <thrift/protocol/TBinaryProtocol.h>
#include <thrift/transport/TBufferTransports.h>
#include <thrift/Thrift.h>

using boost::shared_ptr;
using namespace apache::thrift::protocol;

/* ClassName Helper for cleaner exceptions */
class ClassNames {
public:
  template <typename T>
  static const char* getName() {
    return "Unknown type";
  }
};

template <>
const char* ClassNames::getName<int8_t>() {
  return "byte";
}
template <>
const char* ClassNames::getName<int16_t>() {
  return "short";
}
template <>
const char* ClassNames::getName<int32_t>() {
  return "int";
}
template <>
const char* ClassNames::getName<int64_t>() {
  return "long";
}
template <>
const char* ClassNames::getName<double>() {
  return "double";
}
template <>
const char* ClassNames::getName<std::string>() {
  return "string";
}

/* Generic Protocol I/O function for tests */
class GenericIO {
public:
  /* Write functions */

  static uint32_t write(shared_ptr<TProtocol> proto, const int8_t& val) {
    return proto->writeByte(val);
  }

  static uint32_t write(shared_ptr<TProtocol> proto, const int16_t& val) {
    return proto->writeI16(val);
  }

  static uint32_t write(shared_ptr<TProtocol> proto, const int32_t& val) {
    return proto->writeI32(val);
  }

  static uint32_t write(shared_ptr<TProtocol> proto, const double& val) {
    return proto->writeDouble(val);
  }

  static uint32_t write(shared_ptr<TProtocol> proto, const int64_t& val) {
    return proto->writeI64(val);
  }

  static uint32_t write(shared_ptr<TProtocol> proto, const std::string& val) {
    return proto->writeString(val);
  }

  /* Read functions */

  static uint32_t read(shared_ptr<TProtocol> proto, int8_t& val) { return proto->readByte(val); }

  static uint32_t read(shared_ptr<TProtocol> proto, int16_t& val) { return proto->readI16(val); }

  static uint32_t read(shared_ptr<TProtocol> proto, int32_t& val) { return proto->readI32(val); }

  static uint32_t read(shared_ptr<TProtocol> proto, int64_t& val) { return proto->readI64(val); }

  static uint32_t read(shared_ptr<TProtocol> proto, double& val) { return proto->readDouble(val); }

  static uint32_t read(shared_ptr<TProtocol> proto, std::string& val) {
    return proto->readString(val);
  }
};

#endif
