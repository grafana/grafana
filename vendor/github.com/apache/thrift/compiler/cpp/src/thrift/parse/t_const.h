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

#ifndef T_CONST_H
#define T_CONST_H

#include "thrift/parse/t_type.h"
#include "thrift/parse/t_const_value.h"

/**
 * A const is a constant value defined across languages that has a type and
 * a value. The trick here is that the declared type might not match the type
 * of the value object, since that is not determined until after parsing the
 * whole thing out.
 *
 */
class t_const : public t_doc {
public:
  t_const(t_type* type, std::string name, t_const_value* value)
    : type_(type), name_(name), value_(value) {}

  t_type* get_type() const { return type_; }

  std::string get_name() const { return name_; }

  t_const_value* get_value() const { return value_; }

private:
  t_type* type_;
  std::string name_;
  t_const_value* value_;
};

#endif
