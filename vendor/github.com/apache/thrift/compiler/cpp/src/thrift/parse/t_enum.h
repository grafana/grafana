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

#ifndef T_ENUM_H
#define T_ENUM_H

#include <vector>

#include "thrift/parse/t_enum_value.h"
#include "thrift/parse/t_type.h"

/**
 * An enumerated type. A list of constant objects with a name for the type.
 *
 */
class t_enum : public t_type {
public:
  t_enum(t_program* program) : t_type(program) {}

  void set_name(const std::string& name) { name_ = name; }

  void append(t_enum_value* constant) { constants_.push_back(constant); }

  const std::vector<t_enum_value*>& get_constants() const { return constants_; }

  t_enum_value* get_constant_by_name(const std::string& name) {
    const std::vector<t_enum_value*>& enum_values = get_constants();
    std::vector<t_enum_value*>::const_iterator c_iter;
    for (c_iter = enum_values.begin(); c_iter != enum_values.end(); ++c_iter) {
      if ((*c_iter)->get_name() == name) {
        return *c_iter;
      }
    }
    return NULL;
  }

  t_enum_value* get_constant_by_value(int64_t value) {
    const std::vector<t_enum_value*>& enum_values = get_constants();
    std::vector<t_enum_value*>::const_iterator c_iter;
    for (c_iter = enum_values.begin(); c_iter != enum_values.end(); ++c_iter) {
      if ((*c_iter)->get_value() == value) {
        return *c_iter;
      }
    }
    return NULL;
  }

  t_enum_value* get_min_value() {
    const std::vector<t_enum_value*>& enum_values = get_constants();
    std::vector<t_enum_value*>::const_iterator c_iter;
    t_enum_value* min_value;
    if (enum_values.size() == 0) {
      min_value = NULL;
    } else {
      int min_value_value;
      min_value = enum_values.front();
      min_value_value = min_value->get_value();
      for (c_iter = enum_values.begin(); c_iter != enum_values.end(); ++c_iter) {
        if ((*c_iter)->get_value() < min_value_value) {
          min_value = (*c_iter);
          min_value_value = min_value->get_value();
        }
      }
    }
    return min_value;
  }

  t_enum_value* get_max_value() {
    const std::vector<t_enum_value*>& enum_values = get_constants();
    std::vector<t_enum_value*>::const_iterator c_iter;
    t_enum_value* max_value;
    if (enum_values.size() == 0) {
      max_value = NULL;
    } else {
      int max_value_value;
      max_value = enum_values.back();
      max_value_value = max_value->get_value();
      for (c_iter = enum_values.begin(); c_iter != enum_values.end(); ++c_iter) {
        if ((*c_iter)->get_value() > max_value_value) {
          max_value = (*c_iter);
          max_value_value = max_value->get_value();
        }
      }
    }
    return max_value;
  }

  bool is_enum() const { return true; }

private:
  std::vector<t_enum_value*> constants_;
};

#endif
