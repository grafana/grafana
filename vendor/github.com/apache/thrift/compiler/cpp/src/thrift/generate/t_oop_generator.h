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

#ifndef T_OOP_GENERATOR_H
#define T_OOP_GENERATOR_H

#include <string>
#include <iostream>

#include "thrift/common.h"
#include "thrift/generate/t_generator.h"

#include <algorithm>

/**
 * Class with utility methods shared across common object oriented languages.
 * Specifically, most of this stuff is for C++/Java.
 *
 */
class t_oop_generator : public t_generator {
public:
  t_oop_generator(t_program* program) : t_generator(program) {}

  /**
   * Scoping, using curly braces!
   */

  void scope_up(std::ostream& out) {
    indent(out) << "{" << std::endl;
    indent_up();
  }

  void scope_down(std::ostream& out) {
    indent_down();
    indent(out) << "}" << std::endl;
  }

  std::string upcase_string(std::string original) {
    std::transform(original.begin(), original.end(), original.begin(), (int (*)(int))toupper);
    return original;
  }

  virtual std::string get_enum_class_name(t_type* type) {
    std::string package = "";
    t_program* program = type->get_program();
    if (program != NULL && program != program_) {
      package = program->get_namespace("java") + ".";
    }
    return package + type->get_name();
  }

  virtual void generate_java_docstring_comment(std::ofstream& out, std::string contents) {
    generate_docstring_comment(out, "/**\n", " * ", contents, " */\n");
  }

  virtual void generate_java_doc(std::ofstream& out, t_field* field) {
    if (field->get_type()->is_enum()) {
      std::string combined_message = field->get_doc() + "\n@see "
                                     + get_enum_class_name(field->get_type());
      generate_java_docstring_comment(out, combined_message);
    } else {
      generate_java_doc(out, (t_doc*)field);
    }
  }

  /**
   * Emits a JavaDoc comment if the provided object has a doc in Thrift
   */
  virtual void generate_java_doc(std::ofstream& out, t_doc* tdoc) {
    if (tdoc->has_doc()) {
      generate_java_docstring_comment(out, tdoc->get_doc());
    }
  }

  /**
   * Emits a JavaDoc comment if the provided function object has a doc in Thrift
   */
  virtual void generate_java_doc(std::ofstream& out, t_function* tfunction) {
    if (tfunction->has_doc()) {
      std::stringstream ss;
      ss << tfunction->get_doc();
      const std::vector<t_field*>& fields = tfunction->get_arglist()->get_members();
      std::vector<t_field*>::const_iterator p_iter;
      for (p_iter = fields.begin(); p_iter != fields.end(); ++p_iter) {
        t_field* p = *p_iter;
        ss << "\n@param " << p->get_name();
        if (p->has_doc()) {
          ss << " " << p->get_doc();
        }
      }
      generate_docstring_comment(out, "/**\n", " * ", ss.str(), " */\n");
    }
  }
};

#endif
