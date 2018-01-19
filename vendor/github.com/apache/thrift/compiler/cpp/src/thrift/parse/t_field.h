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

#ifndef T_FIELD_H
#define T_FIELD_H

#include <map>
#include <string>
#include <sstream>

#include "thrift/parse/t_doc.h"
#include "thrift/parse/t_type.h"

// Forward declare for xsd_attrs
class t_struct;

/**
 * Class to represent a field in a thrift structure. A field has a data type,
 * a symbolic name, and a numeric identifier.
 *
 */
class t_field : public t_doc {
public:
  t_field(t_type* type, std::string name)
    : type_(type),
      name_(name),
      key_(0),
      value_(NULL),
      xsd_optional_(false),
      xsd_nillable_(false),
      xsd_attrs_(NULL),
      reference_(false) {}

  t_field(t_type* type, std::string name, int32_t key)
    : type_(type),
      name_(name),
      key_(key),
      req_(T_OPT_IN_REQ_OUT),
      value_(NULL),
      xsd_optional_(false),
      xsd_nillable_(false),
      xsd_attrs_(NULL),
      reference_(false) {}

  ~t_field() {}

  t_type* get_type() { return type_; }

  const t_type* get_type() const { return type_; }

  const std::string& get_name() const { return name_; }

  int32_t get_key() const { return key_; }

  enum e_req { T_REQUIRED, T_OPTIONAL, T_OPT_IN_REQ_OUT };

  void set_req(e_req req) { req_ = req; }

  e_req get_req() const { return req_; }

  void set_value(t_const_value* value) { value_ = value; }

  t_const_value* get_value() { return value_; }

  const t_const_value* get_value() const { return value_; }

  void set_xsd_optional(bool xsd_optional) { xsd_optional_ = xsd_optional; }

  bool get_xsd_optional() const { return xsd_optional_; }

  void set_xsd_nillable(bool xsd_nillable) { xsd_nillable_ = xsd_nillable; }

  bool get_xsd_nillable() const { return xsd_nillable_; }

  void set_xsd_attrs(t_struct* xsd_attrs) { xsd_attrs_ = xsd_attrs; }

  t_struct* get_xsd_attrs() { return xsd_attrs_; }

  /**
   * Comparator to sort fields in ascending order by key.
   * Make this a functor instead of a function to help GCC inline it.
   * The arguments are (const) references to const pointers to const t_fields.
   */
  struct key_compare {
    bool operator()(t_field const* const& a, t_field const* const& b) {
      return a->get_key() < b->get_key();
    }
  };

  std::map<std::string, std::string> annotations_;

  bool get_reference() { return reference_; }

  void set_reference(bool reference) { reference_ = reference; }

private:
  t_type* type_;
  std::string name_;
  int32_t key_;
  e_req req_;
  t_const_value* value_;

  bool xsd_optional_;
  bool xsd_nillable_;
  t_struct* xsd_attrs_;
  bool reference_;
};

/**
 * A simple struct for the parser to use to store a field ID, and whether or
 * not it was specified by the user or automatically chosen.
 */
struct t_field_id {
  int32_t value;
  bool auto_assigned;
};

#endif
