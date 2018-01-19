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

#ifndef STATSPROCESSOR_H
#define STATSPROCESSOR_H

#include <boost/shared_ptr.hpp>
#include <thrift/transport/TTransport.h>
#include <thrift/protocol/TProtocol.h>
#include <TProcessor.h>

namespace apache {
namespace thrift {
namespace processor {

/*
 * Class for keeping track of function call statistics and printing them if desired
 *
 */
class StatsProcessor : public apache::thrift::TProcessor {
public:
  StatsProcessor(bool print, bool frequency) : print_(print), frequency_(frequency) {}
  virtual ~StatsProcessor(){};

  virtual bool process(boost::shared_ptr<apache::thrift::protocol::TProtocol> piprot,
                       boost::shared_ptr<apache::thrift::protocol::TProtocol> poprot,
                       void* serverContext) {

    piprot_ = piprot;

    std::string fname;
    apache::thrift::protocol::TMessageType mtype;
    int32_t seqid;

    piprot_->readMessageBegin(fname, mtype, seqid);
    if (mtype != apache::thrift::protocol::T_CALL && mtype != apache::thrift::protocol::T_ONEWAY) {
      if (print_) {
        printf("Unknown message type\n");
      }
      throw apache::thrift::TException("Unexpected message type");
    }
    if (print_) {
      printf("%s (", fname.c_str());
    }
    if (frequency_) {
      if (frequency_map_.find(fname) != frequency_map_.end()) {
        frequency_map_[fname]++;
      } else {
        frequency_map_[fname] = 1;
      }
    }

    apache::thrift::protocol::TType ftype;
    int16_t fid;

    while (true) {
      piprot_->readFieldBegin(fname, ftype, fid);
      if (ftype == apache::thrift::protocol::T_STOP) {
        break;
      }

      printAndPassToBuffer(ftype);
      if (print_) {
        printf(", ");
      }
    }

    if (print_) {
      printf("\b\b)\n");
    }
    return true;
  }

  const std::map<std::string, int64_t>& get_frequency_map() { return frequency_map_; }

protected:
  void printAndPassToBuffer(apache::thrift::protocol::TType ftype) {
    switch (ftype) {
    case apache::thrift::protocol::T_BOOL: {
      bool boolv;
      piprot_->readBool(boolv);
      if (print_) {
        printf("%d", boolv);
      }
    } break;
    case apache::thrift::protocol::T_BYTE: {
      int8_t bytev;
      piprot_->readByte(bytev);
      if (print_) {
        printf("%d", bytev);
      }
    } break;
    case apache::thrift::protocol::T_I16: {
      int16_t i16;
      piprot_->readI16(i16);
      if (print_) {
        printf("%d", i16);
      }
    } break;
    case apache::thrift::protocol::T_I32: {
      int32_t i32;
      piprot_->readI32(i32);
      if (print_) {
        printf("%d", i32);
      }
    } break;
    case apache::thrift::protocol::T_I64: {
      int64_t i64;
      piprot_->readI64(i64);
      if (print_) {
        printf("%ld", i64);
      }
    } break;
    case apache::thrift::protocol::T_DOUBLE: {
      double dub;
      piprot_->readDouble(dub);
      if (print_) {
        printf("%f", dub);
      }
    } break;
    case apache::thrift::protocol::T_STRING: {
      std::string str;
      piprot_->readString(str);
      if (print_) {
        printf("%s", str.c_str());
      }
    } break;
    case apache::thrift::protocol::T_STRUCT: {
      std::string name;
      int16_t fid;
      apache::thrift::protocol::TType ftype;
      piprot_->readStructBegin(name);
      if (print_) {
        printf("<");
      }
      while (true) {
        piprot_->readFieldBegin(name, ftype, fid);
        if (ftype == apache::thrift::protocol::T_STOP) {
          break;
        }
        printAndPassToBuffer(ftype);
        if (print_) {
          printf(",");
        }
        piprot_->readFieldEnd();
      }
      piprot_->readStructEnd();
      if (print_) {
        printf("\b>");
      }
    } break;
    case apache::thrift::protocol::T_MAP: {
      apache::thrift::protocol::TType keyType;
      apache::thrift::protocol::TType valType;
      uint32_t i, size;
      piprot_->readMapBegin(keyType, valType, size);
      if (print_) {
        printf("{");
      }
      for (i = 0; i < size; i++) {
        printAndPassToBuffer(keyType);
        if (print_) {
          printf("=>");
        }
        printAndPassToBuffer(valType);
        if (print_) {
          printf(",");
        }
      }
      piprot_->readMapEnd();
      if (print_) {
        printf("\b}");
      }
    } break;
    case apache::thrift::protocol::T_SET: {
      apache::thrift::protocol::TType elemType;
      uint32_t i, size;
      piprot_->readSetBegin(elemType, size);
      if (print_) {
        printf("{");
      }
      for (i = 0; i < size; i++) {
        printAndPassToBuffer(elemType);
        if (print_) {
          printf(",");
        }
      }
      piprot_->readSetEnd();
      if (print_) {
        printf("\b}");
      }
    } break;
    case apache::thrift::protocol::T_LIST: {
      apache::thrift::protocol::TType elemType;
      uint32_t i, size;
      piprot_->readListBegin(elemType, size);
      if (print_) {
        printf("[");
      }
      for (i = 0; i < size; i++) {
        printAndPassToBuffer(elemType);
        if (print_) {
          printf(",");
        }
      }
      piprot_->readListEnd();
      if (print_) {
        printf("\b]");
      }
    } break;
    default:
      break;
    }
  }

  boost::shared_ptr<apache::thrift::protocol::TProtocol> piprot_;
  std::map<std::string, int64_t> frequency_map_;

  bool print_;
  bool frequency_;
};
}
}
} // apache::thrift::processor

#endif
