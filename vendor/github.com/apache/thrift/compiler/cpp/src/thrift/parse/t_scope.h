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

#ifndef T_SCOPE_H
#define T_SCOPE_H

#include <map>
#include <string>
#include <sstream>

#include "thrift/parse/t_type.h"
#include "thrift/parse/t_service.h"
#include "thrift/parse/t_const.h"
#include "thrift/parse/t_const_value.h"
#include "thrift/parse/t_base_type.h"
#include "thrift/parse/t_map.h"
#include "thrift/parse/t_list.h"

namespace plugin_output {
template <typename From, typename To>
void convert(From*, To&);
}

/**
 * This represents a variable scope used for looking up predefined types and
 * services. Typically, a scope is associated with a t_program. Scopes are not
 * used to determine code generation, but rather to resolve identifiers at
 * parse time.
 *
 */
class t_scope {
public:
  t_scope() {}

  void add_type(std::string name, t_type* type) { types_[name] = type; }

  t_type* get_type(std::string name) { return types_[name]; }

  void add_service(std::string name, t_service* service) { services_[name] = service; }

  t_service* get_service(std::string name) { return services_[name]; }

  void add_constant(std::string name, t_const* constant) {
    if (constants_.find(name) != constants_.end()) {
      throw "Enum " + name + " is already defined!";
    } else {
      constants_[name] = constant;
    }
  }

  t_const* get_constant(std::string name) { return constants_[name]; }

  void print() {
    std::map<std::string, t_type*>::iterator iter;
    for (iter = types_.begin(); iter != types_.end(); ++iter) {
      printf("%s => %s\n", iter->first.c_str(), iter->second->get_name().c_str());
    }
  }

  void resolve_const_value(t_const_value* const_val, t_type* ttype) {
    if (ttype->is_map()) {
      const std::map<t_const_value*, t_const_value*>& map = const_val->get_map();
      std::map<t_const_value*, t_const_value*>::const_iterator v_iter;
      for (v_iter = map.begin(); v_iter != map.end(); ++v_iter) {
        resolve_const_value(v_iter->first, ((t_map*)ttype)->get_key_type());
        resolve_const_value(v_iter->second, ((t_map*)ttype)->get_val_type());
      }
    } else if (ttype->is_list() || ttype->is_set()) {
      const std::vector<t_const_value*>& val = const_val->get_list();
      std::vector<t_const_value*>::const_iterator v_iter;
      for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
        resolve_const_value((*v_iter), ((t_list*)ttype)->get_elem_type());
      }
    } else if (ttype->is_struct()) {
      t_struct* tstruct = (t_struct*)ttype;
      const std::map<t_const_value*, t_const_value*>& map = const_val->get_map();
      std::map<t_const_value*, t_const_value*>::const_iterator v_iter;
      for (v_iter = map.begin(); v_iter != map.end(); ++v_iter) {
        t_field* field = tstruct->get_field_by_name(v_iter->first->get_string());
        if (field == NULL) {
          throw "No field named \"" + v_iter->first->get_string()
              + "\" was found in struct of type \"" + tstruct->get_name() + "\"";
        }
        resolve_const_value(v_iter->second, field->get_type());
      }
    } else if (const_val->get_type() == t_const_value::CV_IDENTIFIER) {
      if (ttype->is_enum()) {
        const_val->set_enum((t_enum*)ttype);
      } else {
        t_const* constant = get_constant(const_val->get_identifier());
        if (constant == NULL) {
          throw "No enum value or constant found named \"" + const_val->get_identifier() + "\"!";
        }

        // Resolve typedefs to the underlying type
        t_type* const_type = constant->get_type()->get_true_type();

        if (const_type->is_base_type()) {
          switch (((t_base_type*)const_type)->get_base()) {
          case t_base_type::TYPE_I16:
          case t_base_type::TYPE_I32:
          case t_base_type::TYPE_I64:
          case t_base_type::TYPE_BOOL:
          case t_base_type::TYPE_I8:
            const_val->set_integer(constant->get_value()->get_integer());
            break;
          case t_base_type::TYPE_STRING:
            const_val->set_string(constant->get_value()->get_string());
            break;
          case t_base_type::TYPE_DOUBLE:
            const_val->set_double(constant->get_value()->get_double());
            break;
          case t_base_type::TYPE_VOID:
            throw "Constants cannot be of type VOID";
          }
        } else if (const_type->is_map()) {
          const std::map<t_const_value*, t_const_value*>& map = constant->get_value()->get_map();
          std::map<t_const_value*, t_const_value*>::const_iterator v_iter;

          const_val->set_map();
          for (v_iter = map.begin(); v_iter != map.end(); ++v_iter) {
            const_val->add_map(v_iter->first, v_iter->second);
          }
        } else if (const_type->is_list()) {
          const std::vector<t_const_value*>& val = constant->get_value()->get_list();
          std::vector<t_const_value*>::const_iterator v_iter;

          const_val->set_list();
          for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
            const_val->add_list(*v_iter);
          }
        }
      }
    } else if (ttype->is_enum()) {
      // enum constant with non-identifier value. set the enum and find the
      // value's name.
      t_enum* tenum = (t_enum*)ttype;
      t_enum_value* enum_value = tenum->get_constant_by_value(const_val->get_integer());
      if (enum_value == NULL) {
        std::ostringstream valstm;
        valstm << const_val->get_integer();
        throw "Couldn't find a named value in enum " + tenum->get_name() + " for value "
            + valstm.str();
      }
      const_val->set_identifier(tenum->get_name() + "." + enum_value->get_name());
      const_val->set_enum(tenum);
    }
  }

private:
  // Map of names to types
  std::map<std::string, t_type*> types_;

  // Map of names to constants
  std::map<std::string, t_const*> constants_;

  // Map of names to services
  std::map<std::string, t_service*> services_;

  // to list map entries
  template <typename From, typename To>
    friend void plugin_output::convert(From*, To&);
};

#endif
