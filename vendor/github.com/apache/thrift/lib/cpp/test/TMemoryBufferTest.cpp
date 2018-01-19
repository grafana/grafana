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

#include <boost/test/auto_unit_test.hpp>
#include <iostream>
#include <climits>
#include <vector>
#include <thrift/transport/TBufferTransports.h>
#include <thrift/protocol/TBinaryProtocol.h>
#include "gen-cpp/ThriftTest_types.h"

BOOST_AUTO_TEST_SUITE(TMemoryBufferTest)

using apache::thrift::protocol::TBinaryProtocol;
using apache::thrift::transport::TMemoryBuffer;
using apache::thrift::transport::TTransportException;
using boost::shared_ptr;
using std::cout;
using std::endl;
using std::string;

BOOST_AUTO_TEST_CASE(test_read_write_grow) {
  // Added to test the fix for THRIFT-1248
  TMemoryBuffer uut;
  const int maxSize = 65536;
  uint8_t verify[maxSize];
  std::vector<uint8_t> buf;
  buf.resize(maxSize);

  for (uint32_t i = 0; i < maxSize; ++i) {
    buf[i] = static_cast<uint8_t>(i);
  }

  for (uint32_t i = 1; i < maxSize; i *= 2) {
    uut.write(&buf[0], i);
  }

  for (uint32_t i = 1; i < maxSize; i *= 2) {
    uut.read(verify, i);
    BOOST_CHECK_EQUAL(0, ::memcmp(verify, &buf[0], i));
  }
}

BOOST_AUTO_TEST_CASE(test_roundtrip) {
  shared_ptr<TMemoryBuffer> strBuffer(new TMemoryBuffer());
  shared_ptr<TBinaryProtocol> binaryProtcol(new TBinaryProtocol(strBuffer));

  thrift::test::Xtruct a;
  a.i32_thing = 10;
  a.i64_thing = 30;
  a.string_thing = "holla back a";

  a.write(binaryProtcol.get());
  std::string serialized = strBuffer->getBufferAsString();

  shared_ptr<TMemoryBuffer> strBuffer2(new TMemoryBuffer());
  shared_ptr<TBinaryProtocol> binaryProtcol2(new TBinaryProtocol(strBuffer2));

  strBuffer2->resetBuffer((uint8_t*)serialized.data(), static_cast<uint32_t>(serialized.length()));
  thrift::test::Xtruct a2;
  a2.read(binaryProtcol2.get());

  BOOST_CHECK(a == a2);
}

BOOST_AUTO_TEST_CASE(test_copy) {
  string* str1 = new string("abcd1234");
  const char* data1 = str1->data();
  TMemoryBuffer buf((uint8_t*)str1->data(),
                    static_cast<uint32_t>(str1->length()),
                    TMemoryBuffer::COPY);
  delete str1;
  string* str2 = new string("plsreuse");
  bool obj_reuse = (str1 == str2);
  bool dat_reuse = (data1 == str2->data());
  BOOST_TEST_MESSAGE("Object reuse: " << obj_reuse << "   Data reuse: " << dat_reuse
                << ((obj_reuse && dat_reuse) ? "   YAY!" : ""));
  delete str2;

  string str3 = "wxyz", str4 = "6789";
  buf.readAppendToString(str3, 4);
  buf.readAppendToString(str4, INT_MAX);

  BOOST_CHECK(str3 == "wxyzabcd");
  BOOST_CHECK(str4 == "67891234");
}

BOOST_AUTO_TEST_CASE(test_exceptions) {
  char data[] = "foo\0bar";

  TMemoryBuffer buf1((uint8_t*)data, 7, TMemoryBuffer::OBSERVE);
  string str = buf1.getBufferAsString();
  BOOST_CHECK(str.length() == 7);

  buf1.resetBuffer();

  BOOST_CHECK_THROW(buf1.write((const uint8_t*)"foo", 3), TTransportException);

  TMemoryBuffer buf2((uint8_t*)data, 7, TMemoryBuffer::COPY);
  BOOST_CHECK_NO_THROW(buf2.write((const uint8_t*)"bar", 3));
}

BOOST_AUTO_TEST_SUITE_END()
