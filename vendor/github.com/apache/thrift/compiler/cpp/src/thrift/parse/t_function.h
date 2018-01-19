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

#ifndef T_FUNCTION_H
#define T_FUNCTION_H

#include <string>
#include "thrift/parse/t_type.h"
#include "thrift/parse/t_struct.h"
#include "thrift/parse/t_doc.h"

/**
 * Representation of a function. Key parts are return type, function name,
 * optional modifiers, and an argument list, which is implemented as a thrift
 * struct.
 *
 */
class t_function : public t_doc {
public:
  t_function(t_type* returntype, std::string name, t_struct* arglist, bool oneway = false)
    : returntype_(returntype), name_(name), arglist_(arglist), oneway_(oneway) {
    xceptions_ = new t_struct(NULL);
    if (oneway_ && (!returntype_->is_void())) {
      pwarning(1, "Oneway methods should return void.\n");
    }
  }

  t_function(t_type* returntype,
             std::string name,
             t_struct* arglist,
             t_struct* xceptions,
             bool oneway = false)
    : returntype_(returntype),
      name_(name),
      arglist_(arglist),
      xceptions_(xceptions),
      oneway_(oneway) {
    if (oneway_ && !xceptions_->get_members().empty()) {
      throw std::string("Oneway methods can't throw exceptions.");
    }
    if (oneway_ && (!returntype_->is_void())) {
      pwarning(1, "Oneway methods should return void.\n");
    }
  }

  ~t_function() {}

  t_type* get_returntype() const { return returntype_; }

  const std::string& get_name() const { return name_; }

  t_struct* get_arglist() const { return arglist_; }

  t_struct* get_xceptions() const { return xceptions_; }

  bool is_oneway() const { return oneway_; }

  std::map<std::string, std::string> annotations_;

private:
  t_type* returntype_;
  std::string name_;
  t_struct* arglist_;
  t_struct* xceptions_;
  bool oneway_;
};

#endif
