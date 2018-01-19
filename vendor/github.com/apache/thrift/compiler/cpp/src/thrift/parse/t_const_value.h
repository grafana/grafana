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

#ifndef T_CONST_VALUE_H
#define T_CONST_VALUE_H

#include "thrift/parse/t_enum.h"
#include <stdint.h>
#include <map>
#include <vector>
#include <string>

namespace plugin_output {
template <typename From, typename To>
void convert(From*, To&);
}

/**
 * A const value is something parsed that could be a map, set, list, struct
 * or whatever.
 *
 */
class t_const_value {
public:
  enum t_const_value_type { CV_INTEGER, CV_DOUBLE, CV_STRING, CV_MAP, CV_LIST, CV_IDENTIFIER };

  t_const_value() {}

  t_const_value(int64_t val) { set_integer(val); }

  t_const_value(std::string val) { set_string(val); }

  void set_string(std::string val) {
    valType_ = CV_STRING;
    stringVal_ = val;
  }

  std::string get_string() const { return stringVal_; }

  void set_integer(int64_t val) {
    valType_ = CV_INTEGER;
    intVal_ = val;
  }

  int64_t get_integer() const {
    if (valType_ == CV_IDENTIFIER) {
      if (enum_ == NULL) {
        throw "have identifier \"" + get_identifier() + "\", but unset enum on line!";
      }
      std::string identifier = get_identifier();
      std::string::size_type dot = identifier.rfind('.');
      if (dot != std::string::npos) {
        identifier = identifier.substr(dot + 1);
      }
      t_enum_value* val = enum_->get_constant_by_name(identifier);
      if (val == NULL) {
        throw "Unable to find enum value \"" + identifier + "\" in enum \"" + enum_->get_name()
            + "\"";
      }
      return val->get_value();
    } else {
      return intVal_;
    }
  }

  void set_double(double val) {
    valType_ = CV_DOUBLE;
    doubleVal_ = val;
  }

  double get_double() const { return doubleVal_; }

  void set_map() { valType_ = CV_MAP; }

  void add_map(t_const_value* key, t_const_value* val) { mapVal_[key] = val; }

  const std::map<t_const_value*, t_const_value*>& get_map() const { return mapVal_; }

  void set_list() { valType_ = CV_LIST; }

  void add_list(t_const_value* val) { listVal_.push_back(val); }

  const std::vector<t_const_value*>& get_list() const { return listVal_; }

  void set_identifier(std::string val) {
    valType_ = CV_IDENTIFIER;
    identifierVal_ = val;
  }

  std::string get_identifier() const { return identifierVal_; }

  std::string get_identifier_name() const {
    std::string ret = get_identifier();
    size_t s = ret.find('.');
    if (s == std::string::npos) {
      throw "error: identifier " + ret + " is unqualified!";
    }
    ret = ret.substr(s + 1);
    s = ret.find('.');
    if (s != std::string::npos) {
      ret = ret.substr(s + 1);
    }
    return ret;
  }

  std::string get_identifier_with_parent() const {
    std::string ret = get_identifier();
    size_t s = ret.find('.');
    if (s == std::string::npos) {
      throw "error: identifier " + ret + " is unqualified!";
    }
    size_t s2 = ret.find('.', s + 1);
    if (s2 != std::string::npos) {
      ret = ret.substr(s + 1);
    }
    return ret;
  }

  void set_enum(t_enum* tenum) { enum_ = tenum; }

  t_const_value_type get_type() const { return valType_; }

private:
  std::map<t_const_value*, t_const_value*> mapVal_;
  std::vector<t_const_value*> listVal_;
  std::string stringVal_;
  int64_t intVal_;
  double doubleVal_;
  std::string identifierVal_;
  t_enum* enum_;

  t_const_value_type valType_;

  // to read enum_
  template <typename From, typename To>
  friend void plugin_output::convert(From*, To&);
};

#endif
