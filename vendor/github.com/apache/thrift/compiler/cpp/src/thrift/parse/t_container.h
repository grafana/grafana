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

#ifndef T_CONTAINER_H
#define T_CONTAINER_H

#include "thrift/parse/t_type.h"

class t_container : public t_type {
public:
  t_container() : cpp_name_(), has_cpp_name_(false) {}

  virtual ~t_container() {}

  void set_cpp_name(std::string cpp_name) {
    cpp_name_ = cpp_name;
    has_cpp_name_ = true;
  }

  bool has_cpp_name() const { return has_cpp_name_; }

  std::string get_cpp_name() const { return cpp_name_; }

  bool is_container() const { return true; }

private:
  std::string cpp_name_;
  bool has_cpp_name_;
};

#endif
