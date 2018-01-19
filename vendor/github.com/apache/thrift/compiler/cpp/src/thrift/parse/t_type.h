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

#ifndef T_TYPE_H
#define T_TYPE_H

#include <string>
#include <map>
#include <cstring>
#include <stdint.h>
#include "thrift/parse/t_doc.h"

class t_program;

/**
 * Generic representation of a thrift type. These objects are used by the
 * parser module to build up a tree of object that are all explicitly typed.
 * The generic t_type class exports a variety of useful methods that are
 * used by the code generator to branch based upon different handling for the
 * various types.
 *
 */
class t_type : public t_doc {
public:
  virtual ~t_type() {}

  virtual void set_name(const std::string& name) { name_ = name; }

  virtual const std::string& get_name() const { return name_; }

  virtual bool is_void() const { return false; }
  virtual bool is_base_type() const { return false; }
  virtual bool is_string() const { return false; }
  virtual bool is_bool() const { return false; }
  virtual bool is_typedef() const { return false; }
  virtual bool is_enum() const { return false; }
  virtual bool is_struct() const { return false; }
  virtual bool is_xception() const { return false; }
  virtual bool is_container() const { return false; }
  virtual bool is_list() const { return false; }
  virtual bool is_set() const { return false; }
  virtual bool is_map() const { return false; }
  virtual bool is_service() const { return false; }

  t_program* get_program() { return program_; }

  const t_program* get_program() const { return program_; }

  t_type* get_true_type();
  const t_type* get_true_type() const;

  // This function will break (maybe badly) unless 0 <= num <= 16.
  static char nybble_to_xdigit(int num) {
    if (num < 10) {
      return '0' + num;
    } else {
      return 'A' + num - 10;
    }
  }

  static std::string byte_to_hex(uint8_t byte) {
    std::string rv;
    rv += nybble_to_xdigit(byte >> 4);
    rv += nybble_to_xdigit(byte & 0x0f);
    return rv;
  }

  std::map<std::string, std::string> annotations_;

protected:
  t_type() : program_(NULL) { ; }

  t_type(t_program* program) : program_(program) { ; }

  t_type(t_program* program, std::string name) : program_(program), name_(name) { ; }

  t_type(std::string name) : program_(NULL), name_(name) { ; }

  t_program* program_;
  std::string name_;
};

/**
 * Placeholder struct for returning the key and value of an annotation
 * during parsing.
 */
struct t_annotation {
  std::string key;
  std::string val;
};

#endif
