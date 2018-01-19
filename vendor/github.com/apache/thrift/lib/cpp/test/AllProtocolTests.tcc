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

#ifndef _THRIFT_TEST_GENERICPROTOCOLTEST_TCC_
#define _THRIFT_TEST_GENERICPROTOCOLTEST_TCC_ 1

#include <limits>

#include <thrift/protocol/TBinaryProtocol.h>
#include <thrift/transport/TBufferTransports.h>
#include <thrift/Thrift.h>

#include "GenericHelpers.h"

using boost::shared_ptr;
using namespace apache::thrift;
using namespace apache::thrift::protocol;
using namespace apache::thrift::transport;

#define ERR_LEN 512
extern char errorMessage[ERR_LEN];

template <typename TProto, typename Val>
void testNaked(Val val) {
  shared_ptr<TTransport> transport(new TMemoryBuffer());
  shared_ptr<TProtocol> protocol(new TProto(transport));

  GenericIO::write(protocol, val);
  Val out;
  GenericIO::read(protocol, out);
  if (out != val) {
    THRIFT_SNPRINTF(errorMessage,
                    ERR_LEN,
                    "Invalid naked test (type: %s)",
                    ClassNames::getName<Val>());
    throw TException(errorMessage);
  }
}

template <typename TProto, TType type, typename Val>
void testField(const Val val) {
  shared_ptr<TTransport> transport(new TMemoryBuffer());
  shared_ptr<TProtocol> protocol(new TProto(transport));

  protocol->writeStructBegin("test_struct");
  protocol->writeFieldBegin("test_field", type, (int16_t)15);

  GenericIO::write(protocol, val);

  protocol->writeFieldEnd();
  protocol->writeStructEnd();

  std::string name;
  TType fieldType;
  int16_t fieldId;

  protocol->readStructBegin(name);
  protocol->readFieldBegin(name, fieldType, fieldId);

  if (fieldId != 15) {
    THRIFT_SNPRINTF(errorMessage, ERR_LEN, "Invalid ID (type: %s)", typeid(val).name());
    throw TException(errorMessage);
  }
  if (fieldType != type) {
    THRIFT_SNPRINTF(errorMessage, ERR_LEN, "Invalid Field Type (type: %s)", typeid(val).name());
    throw TException(errorMessage);
  }

  Val out;
  GenericIO::read(protocol, out);

  if (out != val) {
    THRIFT_SNPRINTF(errorMessage, ERR_LEN, "Invalid value read (type: %s)", typeid(val).name());
    throw TException(errorMessage);
  }

  protocol->readFieldEnd();
  protocol->readStructEnd();
}

template <typename TProto>
void testMessage() {
  struct TMessage {
    const char* name;
    TMessageType type;
    int32_t seqid;
  } messages[] = {{"short message name", T_CALL, 0},
                  {"1", T_REPLY, 12345},
                  {"loooooooooooooooooooooooooooooooooong", T_EXCEPTION, 1 << 16},
                  {"one way push", T_ONEWAY, 12},
                  {"Janky", T_CALL, 0}};
  const int messages_count = sizeof(messages) / sizeof(TMessage);

  for (int i = 0; i < messages_count; i++) {
    shared_ptr<TTransport> transport(new TMemoryBuffer());
    shared_ptr<TProtocol> protocol(new TProto(transport));

    protocol->writeMessageBegin(messages[i].name, messages[i].type, messages[i].seqid);
    protocol->writeMessageEnd();

    std::string name;
    TMessageType type;
    int32_t seqid;

    protocol->readMessageBegin(name, type, seqid);
    if (name != messages[i].name || type != messages[i].type || seqid != messages[i].seqid) {
      throw TException("readMessageBegin failed.");
    }
  }
}

template <typename TProto>
void testProtocol(const char* protoname) {
  try {
    testNaked<TProto, int8_t>((int8_t)123);

    for (int32_t i = 0; i < 128; i++) {
      testField<TProto, T_BYTE, int8_t>((int8_t)i);
      testField<TProto, T_BYTE, int8_t>((int8_t)-i);
    }

    testNaked<TProto, int16_t>((int16_t)0);
    testNaked<TProto, int16_t>((int16_t)1);
    testNaked<TProto, int16_t>((int16_t)15000);
    testNaked<TProto, int16_t>((int16_t)0x7fff);
    testNaked<TProto, int16_t>((int16_t)-1);
    testNaked<TProto, int16_t>((int16_t)-15000);
    testNaked<TProto, int16_t>((int16_t)-0x7fff);
    testNaked<TProto, int16_t>((std::numeric_limits<int16_t>::min)());
    testNaked<TProto, int16_t>((std::numeric_limits<int16_t>::max)());

    testField<TProto, T_I16, int16_t>((int16_t)0);
    testField<TProto, T_I16, int16_t>((int16_t)1);
    testField<TProto, T_I16, int16_t>((int16_t)7);
    testField<TProto, T_I16, int16_t>((int16_t)150);
    testField<TProto, T_I16, int16_t>((int16_t)15000);
    testField<TProto, T_I16, int16_t>((int16_t)0x7fff);
    testField<TProto, T_I16, int16_t>((int16_t)-1);
    testField<TProto, T_I16, int16_t>((int16_t)-7);
    testField<TProto, T_I16, int16_t>((int16_t)-150);
    testField<TProto, T_I16, int16_t>((int16_t)-15000);
    testField<TProto, T_I16, int16_t>((int16_t)-0x7fff);

    testNaked<TProto, int32_t>(0);
    testNaked<TProto, int32_t>(1);
    testNaked<TProto, int32_t>(15000);
    testNaked<TProto, int32_t>(0xffff);
    testNaked<TProto, int32_t>(-1);
    testNaked<TProto, int32_t>(-15000);
    testNaked<TProto, int32_t>(-0xffff);
    testNaked<TProto, int32_t>((std::numeric_limits<int32_t>::min)());
    testNaked<TProto, int32_t>((std::numeric_limits<int32_t>::max)());

    testField<TProto, T_I32, int32_t>(0);
    testField<TProto, T_I32, int32_t>(1);
    testField<TProto, T_I32, int32_t>(7);
    testField<TProto, T_I32, int32_t>(150);
    testField<TProto, T_I32, int32_t>(15000);
    testField<TProto, T_I32, int32_t>(31337);
    testField<TProto, T_I32, int32_t>(0xffff);
    testField<TProto, T_I32, int32_t>(0xffffff);
    testField<TProto, T_I32, int32_t>(-1);
    testField<TProto, T_I32, int32_t>(-7);
    testField<TProto, T_I32, int32_t>(-150);
    testField<TProto, T_I32, int32_t>(-15000);
    testField<TProto, T_I32, int32_t>(-0xffff);
    testField<TProto, T_I32, int32_t>(-0xffffff);
    testNaked<TProto, int64_t>((std::numeric_limits<int32_t>::min)());
    testNaked<TProto, int64_t>((std::numeric_limits<int32_t>::max)());
    testNaked<TProto, int64_t>((std::numeric_limits<int32_t>::min)() + 10);
    testNaked<TProto, int64_t>((std::numeric_limits<int32_t>::max)() - 16);
    testNaked<TProto, int64_t>((std::numeric_limits<int64_t>::min)());
    testNaked<TProto, int64_t>((std::numeric_limits<int64_t>::max)());

    testNaked<TProto, int64_t>(0);
    for (int64_t i = 0; i < 62; i++) {
      testNaked<TProto, int64_t>(1L << i);
      testNaked<TProto, int64_t>(-(1L << i));
    }

    testField<TProto, T_I64, int64_t>(0);
    for (int i = 0; i < 62; i++) {
      testField<TProto, T_I64, int64_t>(1L << i);
      testField<TProto, T_I64, int64_t>(-(1L << i));
    }

    testNaked<TProto, double>(123.456);

    testNaked<TProto, std::string>("");
    testNaked<TProto, std::string>("short");
    testNaked<TProto, std::string>("borderlinetiny");
    testNaked<TProto, std::string>("a bit longer than the smallest possible");
    testNaked<TProto, std::string>("\x1\x2\x3\x4\x5\x6\x7\x8\x9\xA"); // kinda binary test

    testField<TProto, T_STRING, std::string>("");
    testField<TProto, T_STRING, std::string>("short");
    testField<TProto, T_STRING, std::string>("borderlinetiny");
    testField<TProto, T_STRING, std::string>("a bit longer than the smallest possible");

    testMessage<TProto>();

    printf("%s => OK\n", protoname);
  } catch (TException e) {
    THRIFT_SNPRINTF(errorMessage, ERR_LEN, "%s => Test FAILED: %s", protoname, e.what());
    throw TException(errorMessage);
  }
}

#endif
