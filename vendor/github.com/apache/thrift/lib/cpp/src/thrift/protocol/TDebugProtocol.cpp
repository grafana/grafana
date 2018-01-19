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

#include <thrift/protocol/TDebugProtocol.h>

#include <cassert>
#include <cctype>
#include <cstdio>
#include <stdexcept>
#include <boost/static_assert.hpp>
#include <boost/lexical_cast.hpp>

using std::string;

static string byte_to_hex(const uint8_t byte) {
  char buf[3];
  int ret = std::sprintf(buf, "%02x", (int)byte);
  THRIFT_UNUSED_VARIABLE(ret);
  assert(ret == 2);
  assert(buf[2] == '\0');
  return buf;
}

namespace apache {
namespace thrift {
namespace protocol {

string TDebugProtocol::fieldTypeName(TType type) {
  switch (type) {
  case T_STOP:
    return "stop";
  case T_VOID:
    return "void";
  case T_BOOL:
    return "bool";
  case T_BYTE:
    return "byte";
  case T_I16:
    return "i16";
  case T_I32:
    return "i32";
  case T_U64:
    return "u64";
  case T_I64:
    return "i64";
  case T_DOUBLE:
    return "double";
  case T_STRING:
    return "string";
  case T_STRUCT:
    return "struct";
  case T_MAP:
    return "map";
  case T_SET:
    return "set";
  case T_LIST:
    return "list";
  case T_UTF8:
    return "utf8";
  case T_UTF16:
    return "utf16";
  default:
    return "unknown";
  }
}

void TDebugProtocol::indentUp() {
  indent_str_ += string(indent_inc, ' ');
}

void TDebugProtocol::indentDown() {
  if (indent_str_.length() < (string::size_type)indent_inc) {
    throw TProtocolException(TProtocolException::INVALID_DATA);
  }
  indent_str_.erase(indent_str_.length() - indent_inc);
}

uint32_t TDebugProtocol::writePlain(const string& str) {
  if (str.length() > (std::numeric_limits<uint32_t>::max)())
    throw TProtocolException(TProtocolException::SIZE_LIMIT);
  trans_->write((uint8_t*)str.data(), static_cast<uint32_t>(str.length()));
  return static_cast<uint32_t>(str.length());
}

uint32_t TDebugProtocol::writeIndented(const string& str) {
  if (str.length() > (std::numeric_limits<uint32_t>::max)())
    throw TProtocolException(TProtocolException::SIZE_LIMIT);
  if (indent_str_.length() > (std::numeric_limits<uint32_t>::max)())
    throw TProtocolException(TProtocolException::SIZE_LIMIT);
  uint64_t total_len = indent_str_.length() + str.length();
  if (total_len > (std::numeric_limits<uint32_t>::max)())
    throw TProtocolException(TProtocolException::SIZE_LIMIT);
  trans_->write((uint8_t*)indent_str_.data(), static_cast<uint32_t>(indent_str_.length()));
  trans_->write((uint8_t*)str.data(), static_cast<uint32_t>(str.length()));
  return static_cast<uint32_t>(indent_str_.length() + str.length());
}

uint32_t TDebugProtocol::startItem() {
  uint32_t size;

  switch (write_state_.back()) {
  case UNINIT:
    // XXX figure out what to do here.
    // throw TProtocolException(TProtocolException::INVALID_DATA);
    // return writeIndented(str);
    return 0;
  case STRUCT:
    return 0;
  case SET:
    return writeIndented("");
  case MAP_KEY:
    return writeIndented("");
  case MAP_VALUE:
    return writePlain(" -> ");
  case LIST:
    size = writeIndented("[" + boost::lexical_cast<string>(list_idx_.back()) + "] = ");
    list_idx_.back()++;
    return size;
  default:
    throw std::logic_error("Invalid enum value.");
  }
}

uint32_t TDebugProtocol::endItem() {
  // uint32_t size;

  switch (write_state_.back()) {
  case UNINIT:
    // XXX figure out what to do here.
    // throw TProtocolException(TProtocolException::INVALID_DATA);
    // return writeIndented(str);
    return 0;
  case STRUCT:
    return writePlain(",\n");
  case SET:
    return writePlain(",\n");
  case MAP_KEY:
    write_state_.back() = MAP_VALUE;
    return 0;
  case MAP_VALUE:
    write_state_.back() = MAP_KEY;
    return writePlain(",\n");
  case LIST:
    return writePlain(",\n");
  default:
    throw std::logic_error("Invalid enum value.");
  }
}

uint32_t TDebugProtocol::writeItem(const std::string& str) {
  uint32_t size = 0;
  size += startItem();
  size += writePlain(str);
  size += endItem();
  return size;
}

uint32_t TDebugProtocol::writeMessageBegin(const std::string& name,
                                           const TMessageType messageType,
                                           const int32_t seqid) {
  (void)seqid;
  string mtype;
  switch (messageType) {
  case T_CALL:
    mtype = "call";
    break;
  case T_REPLY:
    mtype = "reply";
    break;
  case T_EXCEPTION:
    mtype = "exn";
    break;
  case T_ONEWAY:
    mtype = "oneway";
    break;
  }

  uint32_t size = writeIndented("(" + mtype + ") " + name + "(");
  indentUp();
  return size;
}

uint32_t TDebugProtocol::writeMessageEnd() {
  indentDown();
  return writeIndented(")\n");
}

uint32_t TDebugProtocol::writeStructBegin(const char* name) {
  uint32_t size = 0;
  size += startItem();
  size += writePlain(string(name) + " {\n");
  indentUp();
  write_state_.push_back(STRUCT);
  return size;
}

uint32_t TDebugProtocol::writeStructEnd() {
  indentDown();
  write_state_.pop_back();
  uint32_t size = 0;
  size += writeIndented("}");
  size += endItem();
  return size;
}

uint32_t TDebugProtocol::writeFieldBegin(const char* name,
                                         const TType fieldType,
                                         const int16_t fieldId) {
  // sprintf(id_str, "%02d", fieldId);
  string id_str = boost::lexical_cast<string>(fieldId);
  if (id_str.length() == 1)
    id_str = '0' + id_str;

  return writeIndented(id_str + ": " + name + " (" + fieldTypeName(fieldType) + ") = ");
}

uint32_t TDebugProtocol::writeFieldEnd() {
  assert(write_state_.back() == STRUCT);
  return 0;
}

uint32_t TDebugProtocol::writeFieldStop() {
  return 0;
  // writeIndented("***STOP***\n");
}

uint32_t TDebugProtocol::writeMapBegin(const TType keyType,
                                       const TType valType,
                                       const uint32_t size) {
  // TODO(dreiss): Optimize short maps?
  uint32_t bsize = 0;
  bsize += startItem();
  bsize += writePlain(
      "map<" + fieldTypeName(keyType) + "," + fieldTypeName(valType) + ">"
      "[" + boost::lexical_cast<string>(size) + "] {\n");
  indentUp();
  write_state_.push_back(MAP_KEY);
  return bsize;
}

uint32_t TDebugProtocol::writeMapEnd() {
  indentDown();
  write_state_.pop_back();
  uint32_t size = 0;
  size += writeIndented("}");
  size += endItem();
  return size;
}

uint32_t TDebugProtocol::writeListBegin(const TType elemType, const uint32_t size) {
  // TODO(dreiss): Optimize short arrays.
  uint32_t bsize = 0;
  bsize += startItem();
  bsize += writePlain(
      "list<" + fieldTypeName(elemType) + ">"
      "[" + boost::lexical_cast<string>(size) + "] {\n");
  indentUp();
  write_state_.push_back(LIST);
  list_idx_.push_back(0);
  return bsize;
}

uint32_t TDebugProtocol::writeListEnd() {
  indentDown();
  write_state_.pop_back();
  list_idx_.pop_back();
  uint32_t size = 0;
  size += writeIndented("}");
  size += endItem();
  return size;
}

uint32_t TDebugProtocol::writeSetBegin(const TType elemType, const uint32_t size) {
  // TODO(dreiss): Optimize short sets.
  uint32_t bsize = 0;
  bsize += startItem();
  bsize += writePlain(
      "set<" + fieldTypeName(elemType) + ">"
      "[" + boost::lexical_cast<string>(size) + "] {\n");
  indentUp();
  write_state_.push_back(SET);
  return bsize;
}

uint32_t TDebugProtocol::writeSetEnd() {
  indentDown();
  write_state_.pop_back();
  uint32_t size = 0;
  size += writeIndented("}");
  size += endItem();
  return size;
}

uint32_t TDebugProtocol::writeBool(const bool value) {
  return writeItem(value ? "true" : "false");
}

uint32_t TDebugProtocol::writeByte(const int8_t byte) {
  return writeItem("0x" + byte_to_hex(byte));
}

uint32_t TDebugProtocol::writeI16(const int16_t i16) {
  return writeItem(boost::lexical_cast<string>(i16));
}

uint32_t TDebugProtocol::writeI32(const int32_t i32) {
  return writeItem(boost::lexical_cast<string>(i32));
}

uint32_t TDebugProtocol::writeI64(const int64_t i64) {
  return writeItem(boost::lexical_cast<string>(i64));
}

uint32_t TDebugProtocol::writeDouble(const double dub) {
  return writeItem(boost::lexical_cast<string>(dub));
}

uint32_t TDebugProtocol::writeString(const string& str) {
  // XXX Raw/UTF-8?

  string to_show = str;
  if (to_show.length() > (string::size_type)string_limit_) {
    to_show = str.substr(0, string_prefix_size_);
    to_show += "[...](" + boost::lexical_cast<string>(str.length()) + ")";
  }

  string output = "\"";

  for (string::const_iterator it = to_show.begin(); it != to_show.end(); ++it) {
    if (*it == '\\') {
      output += "\\\\";
    } else if (*it == '"') {
      output += "\\\"";
      // passing characters <0 to std::isprint causes asserts. isprint takes an
      // int, so we need to be careful of sign extension
    } else if (std::isprint((unsigned char)*it)) {
      output += *it;
    } else {
      switch (*it) {
      case '\a':
        output += "\\a";
        break;
      case '\b':
        output += "\\b";
        break;
      case '\f':
        output += "\\f";
        break;
      case '\n':
        output += "\\n";
        break;
      case '\r':
        output += "\\r";
        break;
      case '\t':
        output += "\\t";
        break;
      case '\v':
        output += "\\v";
        break;
      default:
        output += "\\x";
        output += byte_to_hex(*it);
      }
    }
  }

  output += '\"';
  return writeItem(output);
}

uint32_t TDebugProtocol::writeBinary(const string& str) {
  // XXX Hex?
  return TDebugProtocol::writeString(str);
}
}
}
} // apache::thrift::protocol
