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

#ifndef T_STRUCT_H
#define T_STRUCT_H

#include <algorithm>
#include <vector>
#include <utility>
#include <string>

#include "thrift/parse/t_type.h"
#include "thrift/parse/t_field.h"

// Forward declare that puppy
class t_program;

/**
 * A struct is a container for a set of member fields that has a name. Structs
 * are also used to implement exception types.
 *
 */
class t_struct : public t_type {
public:
  typedef std::vector<t_field*> members_type;

  t_struct(t_program* program)
    : t_type(program),
      is_xception_(false),
      is_union_(false),
      members_validated(false),
      members_with_value(0),
      xsd_all_(false) {}

  t_struct(t_program* program, const std::string& name)
    : t_type(program, name),
      is_xception_(false),
      is_union_(false),
      members_validated(false),
      members_with_value(0),
      xsd_all_(false) {}

  void set_name(const std::string& name) {
    name_ = name;
    validate_union_members();
  }

  void set_xception(bool is_xception) { is_xception_ = is_xception; }

  void validate_union_member(t_field* field) {
    if (is_union_ && (!name_.empty())) {

      // 1) unions can't have required fields
      // 2) union members are implicitly optional, otherwise bugs like THRIFT-3650 wait to happen
      if (field->get_req() != t_field::T_OPTIONAL) {
        // no warning on default requiredness, but do warn on anything else that is explicitly asked for
        if(field->get_req() != t_field::T_OPT_IN_REQ_OUT) {
          pwarning(1,
                   "Union %s field %s: union members must be optional, ignoring specified requiredness.\n",
                   name_.c_str(),
                   field->get_name().c_str());
        }
        field->set_req(t_field::T_OPTIONAL);
      }

      // unions may have up to one member defaulted, but not more
      if (field->get_value() != NULL) {
        if (1 < ++members_with_value) {
          throw "Error: Field " + field->get_name() + " provides another default value for union "
              + name_;
        }
      }
    }
  }

  void validate_union_members() {
    if (is_union_ && (!name_.empty()) && (!members_validated)) {
      members_type::const_iterator m_iter;
      for (m_iter = members_in_id_order_.begin(); m_iter != members_in_id_order_.end(); ++m_iter) {
        validate_union_member(*m_iter);
      }
      members_validated = true;
    }
  }

  void set_union(bool is_union) {
    is_union_ = is_union;
    validate_union_members();
  }

  void set_xsd_all(bool xsd_all) { xsd_all_ = xsd_all; }

  bool get_xsd_all() const { return xsd_all_; }

  bool append(t_field* elem) {
    typedef members_type::iterator iter_type;
    std::pair<iter_type, iter_type> bounds = std::equal_range(members_in_id_order_.begin(),
                                                              members_in_id_order_.end(),
                                                              elem,
                                                              t_field::key_compare());
    if (bounds.first != bounds.second) {
      return false;
    }
    // returns false when there is a conflict of field names
    if (get_field_by_name(elem->get_name()) != NULL) {
      return false;
    }
    members_.push_back(elem);
    members_in_id_order_.insert(bounds.second, elem);
    validate_union_member(elem);
    return true;
  }

  const members_type& get_members() const { return members_; }

  const members_type& get_sorted_members() { return members_in_id_order_; }

  bool is_struct() const { return !is_xception_; }

  bool is_xception() const { return is_xception_; }

  bool is_union() const { return is_union_; }

  t_field* get_field_by_name(std::string field_name) {
    members_type::const_iterator m_iter;
    for (m_iter = members_in_id_order_.begin(); m_iter != members_in_id_order_.end(); ++m_iter) {
      if ((*m_iter)->get_name() == field_name) {
        return *m_iter;
      }
    }
    return NULL;
  }

  const t_field* get_field_by_name(std::string field_name) const {
    members_type::const_iterator m_iter;
    for (m_iter = members_in_id_order_.begin(); m_iter != members_in_id_order_.end(); ++m_iter) {
      if ((*m_iter)->get_name() == field_name) {
        return *m_iter;
      }
    }
    return NULL;
  }

private:
  members_type members_;
  members_type members_in_id_order_;
  bool is_xception_;
  bool is_union_;
  bool members_validated;
  int members_with_value;

  bool xsd_all_;
};

#endif
