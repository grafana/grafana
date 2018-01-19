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

#include <sstream>
#include <string>
#include <fstream>
#include <iostream>
#include <vector>
#include <cctype>

#include <sys/stat.h>
#include <stdexcept>

#include "thrift/platform.h"
#include "thrift/generate/t_oop_generator.h"

using std::map;
using std::ofstream;
using std::ostringstream;
using std::string;
using std::stringstream;
using std::vector;

static const string endl = "\n"; // avoid ostream << std::endl flushes

/**
 * Java code generator.
 *
 */
class t_javame_generator : public t_oop_generator {
public:
  t_javame_generator(t_program* program,
                     const std::map<std::string, std::string>& parsed_options,
                     const std::string& option_string)
    : t_oop_generator(program) {
    (void)parsed_options;
    (void)option_string;
    std::map<std::string, std::string>::const_iterator iter;

    /* no options yet */
    for( iter = parsed_options.begin(); iter != parsed_options.end(); ++iter) {
      throw "unknown option javame:" + iter->first;
    }

    out_dir_base_ = "gen-javame";
  }

  /**
   * Init and close methods
   */

  void init_generator();
  void close_generator();

  void generate_consts(std::vector<t_const*> consts);

  /**
   * Program-level generation functions
   */

  void generate_typedef(t_typedef* ttypedef);
  void generate_enum(t_enum* tenum);
  void generate_struct(t_struct* tstruct);
  void generate_union(t_struct* tunion);
  void generate_xception(t_struct* txception);
  void generate_service(t_service* tservice);

  void print_const_value(std::ofstream& out,
                         std::string name,
                         t_type* type,
                         t_const_value* value,
                         bool in_static,
                         bool defval = false);
  std::string render_const_value(std::ofstream& out,
                                 std::string name,
                                 t_type* type,
                                 t_const_value* value);

  /**
   * Service-level generation functions
   */

  void generate_java_struct(t_struct* tstruct, bool is_exception);

  void generate_java_struct_definition(std::ofstream& out,
                                       t_struct* tstruct,
                                       bool is_xception = false,
                                       bool in_class = false,
                                       bool is_result = false);
  void generate_java_struct_equality(std::ofstream& out, t_struct* tstruct);
  void generate_java_struct_compare_to(std::ofstream& out, t_struct* tstruct);
  void generate_java_struct_reader(std::ofstream& out, t_struct* tstruct);
  void generate_java_validator(std::ofstream& out, t_struct* tstruct);
  void generate_java_struct_result_writer(std::ofstream& out, t_struct* tstruct);
  void generate_java_struct_writer(std::ofstream& out, t_struct* tstruct);
  void generate_java_struct_tostring(std::ofstream& out, t_struct* tstruct);
  void generate_java_struct_clear(std::ofstream& out, t_struct* tstruct);
  void generate_field_value_meta_data(std::ofstream& out, t_type* type);
  std::string get_java_type_string(t_type* type);
  void generate_reflection_setters(std::ostringstream& out,
                                   t_type* type,
                                   std::string field_name,
                                   std::string cap_name);
  void generate_reflection_getters(std::ostringstream& out,
                                   t_type* type,
                                   std::string field_name,
                                   std::string cap_name);
  void generate_generic_field_getters_setters(std::ofstream& out, t_struct* tstruct);
  void generate_java_bean_boilerplate(std::ofstream& out, t_struct* tstruct);

  void generate_function_helpers(t_function* tfunction);
  std::string get_cap_name(std::string name);
  std::string generate_isset_check(t_field* field);
  std::string generate_isset_check(std::string field);
  void generate_isset_set(ofstream& out, t_field* field);
  std::string isset_field_id(t_field* field);

  void generate_primitive_service_interface(t_service* tservice);
  void generate_service_interface(t_service* tservice);
  void generate_service_helpers(t_service* tservice);
  void generate_service_client(t_service* tservice);
  void generate_service_server(t_service* tservice);
  void generate_process_function(t_service* tservice, t_function* tfunction);

  void generate_java_union(t_struct* tstruct);
  void generate_union_constructor(ofstream& out, t_struct* tstruct);
  void generate_union_getters_and_setters(ofstream& out, t_struct* tstruct);
  void generate_union_abstract_methods(ofstream& out, t_struct* tstruct);
  void generate_check_type(ofstream& out, t_struct* tstruct);
  void generate_read_value(ofstream& out, t_struct* tstruct);
  void generate_write_value(ofstream& out, t_struct* tstruct);
  void generate_get_field_desc(ofstream& out, t_struct* tstruct);
  void generate_get_struct_desc(ofstream& out, t_struct* tstruct);
  void generate_get_field_name(ofstream& out, t_struct* tstruct);

  void generate_union_comparisons(ofstream& out, t_struct* tstruct);
  void generate_union_hashcode(ofstream& out, t_struct* tstruct);

  /**
   * Serialization constructs
   */

  void generate_deserialize_field(std::ofstream& out, t_field* tfield, std::string prefix = "");

  void generate_deserialize_struct(std::ofstream& out, t_struct* tstruct, std::string prefix = "");

  void generate_deserialize_container(std::ofstream& out, t_type* ttype, std::string prefix = "");

  void generate_deserialize_set_element(std::ofstream& out, t_set* tset, std::string prefix = "");

  void generate_deserialize_map_element(std::ofstream& out, t_map* tmap, std::string prefix = "");

  void generate_deserialize_list_element(std::ofstream& out,
                                         t_list* tlist,
                                         std::string prefix = "");

  void generate_serialize_field(std::ofstream& out, t_field* tfield, std::string prefix = "");

  void generate_serialize_struct(std::ofstream& out, t_struct* tstruct, std::string prefix = "");

  void generate_serialize_container(std::ofstream& out, t_type* ttype, std::string prefix = "");

  void generate_serialize_map_element(std::ofstream& out,
                                      t_map* tmap,
                                      std::string iter,
                                      std::string map);

  void generate_serialize_set_element(std::ofstream& out, t_set* tmap, std::string iter);

  void generate_serialize_list_element(std::ofstream& out, t_list* tlist, std::string iter);

  void generate_java_doc(std::ofstream& out, t_field* field);

  void generate_java_doc(std::ofstream& out, t_doc* tdoc);

  void generate_java_doc(std::ofstream& out, t_function* tdoc);

  void generate_java_docstring_comment(std::ofstream& out, string contents);

  void generate_deep_copy_container(std::ofstream& out,
                                    std::string source_name_p1,
                                    std::string source_name_p2,
                                    std::string result_name,
                                    t_type* type);
  void generate_deep_copy_non_container(std::ofstream& out,
                                        std::string source_name,
                                        std::string dest_name,
                                        t_type* type);

  bool has_bit_vector(t_struct* tstruct);

  /**
   * Helper rendering functions
   */

  std::string java_package();
  std::string java_type_imports();
  std::string java_thrift_imports();
  std::string type_name(t_type* ttype,
                        bool in_container = false,
                        bool in_init = false,
                        bool skip_generic = false);
  std::string base_type_name(t_base_type* tbase, bool in_container = false);
  std::string declare_field(t_field* tfield, bool init = false);
  std::string function_signature(t_function* tfunction, std::string prefix = "");
  std::string argument_list(t_struct* tstruct, bool include_types = true);
  std::string type_to_enum(t_type* ttype);
  std::string get_enum_class_name(t_type* type);
  void generate_struct_desc(ofstream& out, t_struct* tstruct);
  void generate_field_descs(ofstream& out, t_struct* tstruct);
  std::string box_type(t_type* type, string value);

  bool type_can_be_null(t_type* ttype) {
    ttype = get_true_type(ttype);

    return ttype->is_container() || ttype->is_struct() || ttype->is_xception() || ttype->is_string()
           || ttype->is_enum();
  }

  std::string constant_name(std::string name);

private:
  /**
   * File streams
   */

  std::string package_name_;
  std::ofstream f_service_;
  std::string package_dir_;
};

/**
 * Prepares for file generation by opening up the necessary file output
 * streams.
 *
 * @param tprogram The program to generate
 */
void t_javame_generator::init_generator() {
  // Make output directory
  MKDIR(get_out_dir().c_str());
  package_name_ = program_->get_namespace("java");

  string dir = package_name_;
  string subdir = get_out_dir();
  string::size_type loc;
  while ((loc = dir.find(".")) != string::npos) {
    subdir = subdir + "/" + dir.substr(0, loc);
    MKDIR(subdir.c_str());
    dir = dir.substr(loc + 1);
  }
  if (dir.size() > 0) {
    subdir = subdir + "/" + dir;
    MKDIR(subdir.c_str());
  }

  package_dir_ = subdir;
}

/**
 * Packages the generated file
 *
 * @return String of the package, i.e. "package org.apache.thriftdemo;"
 */
string t_javame_generator::java_package() {
  if (!package_name_.empty()) {
    return string("package ") + package_name_ + ";\n\n";
  }
  return "";
}

/**
 * Prints standard java imports
 *
 * @return List of imports for Java types that are used in here
 */
string t_javame_generator::java_type_imports() {
  return string() + "import java.util.Hashtable;\n" + "import java.util.Vector;\n"
         + "import java.util.Enumeration;\n\n";
}

/**
 * Prints standard java imports
 *
 * @return List of imports necessary for thrift
 */
string t_javame_generator::java_thrift_imports() {
  return string() + "import org.apache.thrift.*;\n" + "import org.apache.thrift.meta_data.*;\n"
         + "import org.apache.thrift.transport.*;\n" + "import org.apache.thrift.protocol.*;\n\n";
}

/**
 * Nothing in Java
 */
void t_javame_generator::close_generator() {
}

/**
 * Generates a typedef. This is not done in Java, since it does
 * not support arbitrary name replacements, and it'd be a wacky waste
 * of overhead to make wrapper classes.
 *
 * @param ttypedef The type definition
 */
void t_javame_generator::generate_typedef(t_typedef* ttypedef) {
  (void)ttypedef;
}

/**
 * Enums are a class with a set of static constants.
 *
 * @param tenum The enumeration
 */
void t_javame_generator::generate_enum(t_enum* tenum) {
  // Make output file
  string f_enum_name = package_dir_ + "/" + (tenum->get_name()) + ".java";
  ofstream f_enum;
  f_enum.open(f_enum_name.c_str());

  // Comment and package it
  f_enum << autogen_comment() << java_package();

  generate_java_doc(f_enum, tenum);
  indent(f_enum) << "public class " << tenum->get_name() << " implements org.apache.thrift.TEnum ";
  scope_up(f_enum);
  f_enum << endl;

  vector<t_enum_value*> constants = tenum->get_constants();
  vector<t_enum_value*>::iterator c_iter;
  for (c_iter = constants.begin(); c_iter != constants.end(); ++c_iter) {
    int value = (*c_iter)->get_value();
    generate_java_doc(f_enum, *c_iter);
    indent(f_enum) << "public static final " << tenum->get_name() << " " << (*c_iter)->get_name()
                   << " = new " << tenum->get_name() << "(" << value << ");" << endl;
  }
  f_enum << endl;

  // Field for thriftCode
  indent(f_enum) << "private final int value;" << endl << endl;

  indent(f_enum) << "private " << tenum->get_name() << "(int value) {" << endl;
  indent(f_enum) << "  this.value = value;" << endl;
  indent(f_enum) << "}" << endl << endl;

  indent(f_enum) << "/**" << endl;
  indent(f_enum) << " * Get the integer value of this enum value, as defined in the Thrift IDL."
                 << endl;
  indent(f_enum) << " */" << endl;
  indent(f_enum) << "public int getValue() {" << endl;
  indent(f_enum) << "  return value;" << endl;
  indent(f_enum) << "}" << endl << endl;

  indent(f_enum) << "/**" << endl;
  indent(f_enum) << " * Find a the enum type by its integer value, as defined in the Thrift IDL."
                 << endl;
  indent(f_enum) << " * @return null if the value is not found." << endl;
  indent(f_enum) << " */" << endl;
  indent(f_enum) << "public static " + tenum->get_name() + " findByValue(int value) { " << endl;

  indent_up();

  indent(f_enum) << "switch (value) {" << endl;
  indent_up();

  for (c_iter = constants.begin(); c_iter != constants.end(); ++c_iter) {
    int value = (*c_iter)->get_value();
    indent(f_enum) << "case " << value << ":" << endl;
    indent(f_enum) << "  return " << (*c_iter)->get_name() << ";" << endl;
  }

  indent(f_enum) << "default:" << endl;
  indent(f_enum) << "  return null;" << endl;

  indent_down();

  indent(f_enum) << "}" << endl;

  indent_down();

  indent(f_enum) << "}" << endl;

  scope_down(f_enum);

  f_enum.close();
}

/**
 * Generates a class that holds all the constants.
 */
void t_javame_generator::generate_consts(std::vector<t_const*> consts) {
  if (consts.empty()) {
    return;
  }

  string f_consts_name = package_dir_ + "/" + program_name_ + "Constants.java";
  ofstream f_consts;
  f_consts.open(f_consts_name.c_str());

  // Print header
  f_consts << autogen_comment() << java_package() << java_type_imports();

  f_consts << "public class " << program_name_ << "Constants {" << endl << endl;
  indent_up();
  vector<t_const*>::iterator c_iter;
  for (c_iter = consts.begin(); c_iter != consts.end(); ++c_iter) {
    print_const_value(f_consts,
                      (*c_iter)->get_name(),
                      (*c_iter)->get_type(),
                      (*c_iter)->get_value(),
                      false);
  }
  indent_down();
  indent(f_consts) << "}" << endl;
  f_consts.close();
}

/**
 * Prints the value of a constant with the given type. Note that type checking
 * is NOT performed in this function as it is always run beforehand using the
 * validate_types method in main.cc
 */
void t_javame_generator::print_const_value(std::ofstream& out,
                                           string name,
                                           t_type* type,
                                           t_const_value* value,
                                           bool in_static,
                                           bool defval) {
  type = get_true_type(type);

  indent(out);
  if (!defval) {
    out << (in_static ? "" : "public static final ") << type_name(type) << " ";
  }
  if (type->is_base_type()) {
    string v2 = render_const_value(out, name, type, value);
    out << name << " = " << v2 << ";" << endl << endl;
  } else if (type->is_enum()) {
    out << name << " = " << render_const_value(out, name, type, value) << ";" << endl << endl;
  } else if (type->is_struct() || type->is_xception()) {
    const vector<t_field*>& fields = ((t_struct*)type)->get_members();
    vector<t_field*>::const_iterator f_iter;
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    out << name << " = new " << type_name(type, false, true) << "();" << endl;
    if (!in_static) {
      indent(out) << "static {" << endl;
      indent_up();
    }
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      t_type* field_type = NULL;
      for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
        if ((*f_iter)->get_name() == v_iter->first->get_string()) {
          field_type = (*f_iter)->get_type();
        }
      }
      if (field_type == NULL) {
        throw "type error: " + type->get_name() + " has no field " + v_iter->first->get_string();
      }
      string val = render_const_value(out, name, field_type, v_iter->second);
      indent(out) << name << ".";
      std::string cap_name = get_cap_name(v_iter->first->get_string());
      out << "set" << cap_name << "(" << val << ");" << endl;
    }
    if (!in_static) {
      indent_down();
      indent(out) << "}" << endl;
    }
    out << endl;
  } else if (type->is_map()) {
    out << name << " = new " << type_name(type, false, true) << "();" << endl;
    if (!in_static) {
      indent(out) << "static {" << endl;
      indent_up();
    }
    t_type* ktype = ((t_map*)type)->get_key_type();
    t_type* vtype = ((t_map*)type)->get_val_type();
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      string key = render_const_value(out, name, ktype, v_iter->first);
      string val = render_const_value(out, name, vtype, v_iter->second);
      indent(out) << name << ".put(" << box_type(ktype, key) << ", " << box_type(vtype, val) << ");"
                  << endl;
    }
    if (!in_static) {
      indent_down();
      indent(out) << "}" << endl;
    }
    out << endl;
  } else if (type->is_list() || type->is_set()) {
    out << name << " = new " << type_name(type, false, true) << "();" << endl;
    if (!in_static) {
      indent(out) << "static {" << endl;
      indent_up();
    }
    t_type* etype;
    if (type->is_list()) {
      etype = ((t_list*)type)->get_elem_type();
    } else {
      etype = ((t_set*)type)->get_elem_type();
    }
    const vector<t_const_value*>& val = value->get_list();
    vector<t_const_value*>::const_iterator v_iter;
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      string val = render_const_value(out, name, etype, *v_iter);
      if (type->is_list()) {
        indent(out) << name << ".addElement(" << box_type(etype, val) << ");" << endl;
      } else {
        indent(out) << name << ".put(" << box_type(etype, val) << ", " << box_type(etype, val)
                    << ");" << endl;
      }
    }
    if (!in_static) {
      indent_down();
      indent(out) << "}" << endl;
    }
    out << endl;
  } else {
    throw "compiler error: no const of type " + type->get_name();
  }
}

string t_javame_generator::render_const_value(ofstream& out,
                                              string name,
                                              t_type* type,
                                              t_const_value* value) {
  (void)name;
  type = get_true_type(type);
  std::ostringstream render;

  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_STRING:
      render << '"' << get_escaped_string(value) << '"';
      break;
    case t_base_type::TYPE_BOOL:
      render << ((value->get_integer() > 0) ? "true" : "false");
      break;
    case t_base_type::TYPE_I8:
      render << "(byte)" << value->get_integer();
      break;
    case t_base_type::TYPE_I16:
      render << "(short)" << value->get_integer();
      break;
    case t_base_type::TYPE_I32:
      render << value->get_integer();
      break;
    case t_base_type::TYPE_I64:
      render << value->get_integer() << "L";
      break;
    case t_base_type::TYPE_DOUBLE:
      if (value->get_type() == t_const_value::CV_INTEGER) {
        render << "(double)" << value->get_integer();
      } else {
        render << value->get_double();
      }
      break;
    default:
      throw "compiler error: no const of base type " + t_base_type::t_base_name(tbase);
    }
  } else if (type->is_enum()) {
    render << type_name(type, false, false) << "." << value->get_identifier();
  } else {
    string t = tmp("tmp");
    print_const_value(out, t, type, value, true);
    render << t;
  }

  return render.str();
}

string t_javame_generator::box_type(t_type* type, string value) {
  if (type->is_base_type()) {
    switch (((t_base_type*)type)->get_base()) {
    case t_base_type::TYPE_BOOL:
      return "new Boolean(" + value + ")";
    case t_base_type::TYPE_I8:
      return "new Byte(" + value + ")";
    case t_base_type::TYPE_I16:
      return "new Short(" + value + ")";
    case t_base_type::TYPE_I32:
      return "new Integer(" + value + ")";
    case t_base_type::TYPE_I64:
      return "new Long(" + value + ")";
    case t_base_type::TYPE_DOUBLE:
      return "new Double(" + value + ")";
    default:
      break;
    }
  }
  return value;
}

/**
 * Generates a struct definition for a thrift data type. This will be a TBase
 * implementor.
 *
 * @param tstruct The struct definition
 */
void t_javame_generator::generate_struct(t_struct* tstruct) {
  if (tstruct->is_union()) {
    generate_java_union(tstruct);
  } else {
    generate_java_struct(tstruct, false);
  }
}

/**
 * Exceptions are structs, but they inherit from Exception
 *
 * @param tstruct The struct definition
 */
void t_javame_generator::generate_xception(t_struct* txception) {
  generate_java_struct(txception, true);
}

/**
 * Java struct definition.
 *
 * @param tstruct The struct definition
 */
void t_javame_generator::generate_java_struct(t_struct* tstruct, bool is_exception) {
  // Make output file
  string f_struct_name = package_dir_ + "/" + (tstruct->get_name()) + ".java";
  ofstream f_struct;
  f_struct.open(f_struct_name.c_str());

  f_struct << autogen_comment() << java_package() << java_type_imports() << java_thrift_imports();

  generate_java_struct_definition(f_struct, tstruct, is_exception);
  f_struct.close();
}

/**
 * Java union definition.
 *
 * @param tstruct The struct definition
 */
void t_javame_generator::generate_java_union(t_struct* tstruct) {
  // Make output file
  string f_struct_name = package_dir_ + "/" + (tstruct->get_name()) + ".java";
  ofstream f_struct;
  f_struct.open(f_struct_name.c_str());

  f_struct << autogen_comment() << java_package() << java_type_imports() << java_thrift_imports();

  generate_java_doc(f_struct, tstruct);

  bool is_final = (tstruct->annotations_.find("final") != tstruct->annotations_.end());

  indent(f_struct) << "public " << (is_final ? "final " : "") << "class " << tstruct->get_name()
                   << " extends TUnion ";

  scope_up(f_struct);

  generate_struct_desc(f_struct, tstruct);
  generate_field_descs(f_struct, tstruct);

  f_struct << endl;

  generate_union_constructor(f_struct, tstruct);

  f_struct << endl;

  generate_union_abstract_methods(f_struct, tstruct);

  f_struct << endl;

  generate_union_getters_and_setters(f_struct, tstruct);

  f_struct << endl;

  generate_union_comparisons(f_struct, tstruct);

  f_struct << endl;

  generate_union_hashcode(f_struct, tstruct);

  f_struct << endl;

  scope_down(f_struct);

  f_struct.close();
}

void t_javame_generator::generate_union_constructor(ofstream& out, t_struct* tstruct) {
  indent(out) << "public " << type_name(tstruct) << "() {" << endl;
  indent(out) << "  super();" << endl;
  indent(out) << "}" << endl << endl;

  indent(out) << "public " << type_name(tstruct) << "(_Fields setField, Object value) {" << endl;
  indent(out) << "  super(setField, value);" << endl;
  indent(out) << "}" << endl << endl;

  indent(out) << "public " << type_name(tstruct) << "(" << type_name(tstruct) << " other) {"
              << endl;
  indent(out) << "  super(other);" << endl;
  indent(out) << "}" << endl;

  indent(out) << "public " << tstruct->get_name() << " deepCopy() {" << endl;
  indent(out) << "  return new " << tstruct->get_name() << "(this);" << endl;
  indent(out) << "}" << endl << endl;

  // generate "constructors" for each field
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    indent(out) << "public static " << type_name(tstruct) << " " << (*m_iter)->get_name() << "("
                << type_name((*m_iter)->get_type()) << " value) {" << endl;
    indent(out) << "  " << type_name(tstruct) << " x = new " << type_name(tstruct) << "();" << endl;
    indent(out) << "  x.set" << get_cap_name((*m_iter)->get_name()) << "(value);" << endl;
    indent(out) << "  return x;" << endl;
    indent(out) << "}" << endl << endl;
  }
}

void t_javame_generator::generate_union_getters_and_setters(ofstream& out, t_struct* tstruct) {
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  bool first = true;
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    if (first) {
      first = false;
    } else {
      out << endl;
    }

    t_field* field = (*m_iter);

    generate_java_doc(out, field);
    indent(out) << "public " << type_name(field->get_type()) << " get"
                << get_cap_name(field->get_name()) << "() {" << endl;
    indent(out) << "  if (getSetField() == _Fields." << constant_name(field->get_name()) << ") {"
                << endl;
    indent(out) << "    return (" << type_name(field->get_type(), true) << ")getFieldValue();"
                << endl;
    indent(out) << "  } else {" << endl;
    indent(out) << "    throw new RuntimeException(\"Cannot get field '" << field->get_name()
                << "' because union is currently set to \" + getFieldDesc(getSetField()).name);"
                << endl;
    indent(out) << "  }" << endl;
    indent(out) << "}" << endl;

    out << endl;

    generate_java_doc(out, field);
    indent(out) << "public void set" << get_cap_name(field->get_name()) << "("
                << type_name(field->get_type()) << " value) {" << endl;
    if (type_can_be_null(field->get_type())) {
      indent(out) << "  if (value == null) throw new NullPointerException();" << endl;
    }
    indent(out) << "  setField_ = _Fields." << constant_name(field->get_name()) << ";" << endl;
    indent(out) << "  value_ = value;" << endl;
    indent(out) << "}" << endl;
  }
}

void t_javame_generator::generate_union_abstract_methods(ofstream& out, t_struct* tstruct) {
  generate_check_type(out, tstruct);
  out << endl;
  generate_read_value(out, tstruct);
  out << endl;
  generate_write_value(out, tstruct);
  out << endl;
  generate_get_field_desc(out, tstruct);
  out << endl;
  generate_get_struct_desc(out, tstruct);
  out << endl;
}

void t_javame_generator::generate_check_type(ofstream& out, t_struct* tstruct) {
  indent(out)
      << "protected void checkType(_Fields setField, Object value) throws ClassCastException {"
      << endl;
  indent_up();

  indent(out) << "switch (setField) {" << endl;
  indent_up();

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_field* field = (*m_iter);

    indent(out) << "case " << constant_name(field->get_name()) << ":" << endl;
    indent(out) << "  if (value instanceof " << type_name(field->get_type(), true, false, true)
                << ") {" << endl;
    indent(out) << "    break;" << endl;
    indent(out) << "  }" << endl;
    indent(out) << "  throw new ClassCastException(\"Was expecting value of type "
                << type_name(field->get_type(), true, false) << " for field '" << field->get_name()
                << "', but got \" + value.getClass().getSimpleName());" << endl;
    // do the real check here
  }

  indent(out) << "default:" << endl;
  indent(out) << "  throw new IllegalArgumentException(\"Unknown field id \" + setField);" << endl;

  indent_down();
  indent(out) << "}" << endl;

  indent_down();
  indent(out) << "}" << endl;
}

void t_javame_generator::generate_read_value(ofstream& out, t_struct* tstruct) {
  indent(out) << "protected Object readValue(TProtocol iprot, TField field) throws TException {"
              << endl;

  indent_up();

  indent(out) << "_Fields setField = _Fields.findByThriftId(field.id);" << endl;
  indent(out) << "if (setField != null) {" << endl;
  indent_up();
  indent(out) << "switch (setField) {" << endl;
  indent_up();

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_field* field = (*m_iter);

    indent(out) << "case " << constant_name(field->get_name()) << ":" << endl;
    indent_up();
    indent(out) << "if (field.type == " << constant_name(field->get_name()) << "_FIELD_DESC.type) {"
                << endl;
    indent_up();
    indent(out) << type_name(field->get_type(), true, false) << " " << field->get_name() << ";"
                << endl;
    generate_deserialize_field(out, field, "");
    indent(out) << "return " << field->get_name() << ";" << endl;
    indent_down();
    indent(out) << "} else {" << endl;
    indent(out) << "  TProtocolUtil.skip(iprot, field.type);" << endl;
    indent(out) << "  return null;" << endl;
    indent(out) << "}" << endl;
    indent_down();
  }

  indent(out) << "default:" << endl;
  indent(out) << "  throw new IllegalStateException(\"setField wasn't null, but didn't match any "
                 "of the case statements!\");" << endl;

  indent_down();
  indent(out) << "}" << endl;

  indent_down();
  indent(out) << "} else {" << endl;
  indent_up();
  indent(out) << "TProtocolUtil.skip(iprot, field.type);" << endl;
  indent(out) << "return null;" << endl;
  indent_down();
  indent(out) << "}" << endl;

  indent_down();
  indent(out) << "}" << endl;
}

void t_javame_generator::generate_write_value(ofstream& out, t_struct* tstruct) {
  indent(out) << "protected void writeValue(TProtocol oprot) throws TException {" << endl;

  indent_up();

  indent(out) << "switch (setField_) {" << endl;
  indent_up();

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_field* field = (*m_iter);

    indent(out) << "case " << constant_name(field->get_name()) << ":" << endl;
    indent_up();
    indent(out) << type_name(field->get_type(), true, false) << " " << field->get_name() << " = ("
                << type_name(field->get_type(), true, false) << ")value_;" << endl;
    generate_serialize_field(out, field, "");
    indent(out) << "return;" << endl;
    indent_down();
  }

  indent(out) << "default:" << endl;
  indent(out) << "  throw new IllegalStateException(\"Cannot write union with unknown field \" + "
                 "setField_);" << endl;

  indent_down();
  indent(out) << "}" << endl;

  indent_down();

  indent(out) << "}" << endl;
}

void t_javame_generator::generate_get_field_desc(ofstream& out, t_struct* tstruct) {
  indent(out) << "protected TField getFieldDesc(_Fields setField) {" << endl;
  indent_up();

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  indent(out) << "switch (setField) {" << endl;
  indent_up();

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_field* field = (*m_iter);
    indent(out) << "case " << constant_name(field->get_name()) << ":" << endl;
    indent(out) << "  return " << constant_name(field->get_name()) << "_FIELD_DESC;" << endl;
  }

  indent(out) << "default:" << endl;
  indent(out) << "  throw new IllegalArgumentException(\"Unknown field id \" + setField);" << endl;

  indent_down();
  indent(out) << "}" << endl;

  indent_down();
  indent(out) << "}" << endl;
}

void t_javame_generator::generate_get_struct_desc(ofstream& out, t_struct* tstruct) {
  (void)tstruct;
  indent(out) << "protected TStruct getStructDesc() {" << endl;
  indent(out) << "  return STRUCT_DESC;" << endl;
  indent(out) << "}" << endl;
}

void t_javame_generator::generate_union_comparisons(ofstream& out, t_struct* tstruct) {
  // equality
  indent(out) << "public boolean equals(Object other) {" << endl;
  indent(out) << "  if (other instanceof " << tstruct->get_name() << ") {" << endl;
  indent(out) << "    return equals((" << tstruct->get_name() << ")other);" << endl;
  indent(out) << "  } else {" << endl;
  indent(out) << "    return false;" << endl;
  indent(out) << "  }" << endl;
  indent(out) << "}" << endl;

  out << endl;

  indent(out) << "public boolean equals(" << tstruct->get_name() << " other) {" << endl;
  indent(out) << "  return other != null && getSetField() == other.getSetField() && "
                 "getFieldValue().equals(other.getFieldValue());" << endl;
  indent(out) << "}" << endl;
  out << endl;

  indent(out) << "public int compareTo(" << type_name(tstruct) << " other) {" << endl;
  indent(out) << "  int lastComparison = TBaseHelper.compareTo(getSetField(), other.getSetField());"
              << endl;
  indent(out) << "  if (lastComparison == 0) {" << endl;
  indent(out) << "    return TBaseHelper.compareTo(getFieldValue(), other.getFieldValue());"
              << endl;
  indent(out) << "  }" << endl;
  indent(out) << "  return lastComparison;" << endl;
  indent(out) << "}" << endl;
  out << endl;
}

void t_javame_generator::generate_union_hashcode(ofstream& out, t_struct* tstruct) {
  (void)tstruct;
  indent(out) << "/**" << endl;
  indent(out)
      << " * If you'd like this to perform more respectably, use the hashcode generator option."
      << endl;
  indent(out) << " */" << endl;
  indent(out) << "public int hashCode() {" << endl;
  indent(out) << "  return 0;" << endl;
  indent(out) << "}" << endl;
}

/**
 * Java struct definition. This has various parameters, as it could be
 * generated standalone or inside another class as a helper. If it
 * is a helper than it is a static class.
 *
 * @param tstruct      The struct definition
 * @param is_exception Is this an exception?
 * @param in_class     If inside a class, needs to be static class
 * @param is_result    If this is a result it needs a different writer
 */
void t_javame_generator::generate_java_struct_definition(ofstream& out,
                                                         t_struct* tstruct,
                                                         bool is_exception,
                                                         bool in_class,
                                                         bool is_result) {
  generate_java_doc(out, tstruct);

  bool is_final = (tstruct->annotations_.find("final") != tstruct->annotations_.end());

  indent(out) << "public " << (is_final ? "final " : "") << (in_class ? "static " : "") << "class "
              << tstruct->get_name() << " ";

  if (is_exception) {
    out << "extends Exception ";
  }
  out << "implements TBase ";

  scope_up(out);

  generate_struct_desc(out, tstruct);

  // Members are public for -java, private for -javabean
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  out << endl;

  generate_field_descs(out, tstruct);

  out << endl;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    indent(out) << "private ";
    out << declare_field(*m_iter, false) << endl;
  }

  // isset data
  if (members.size() > 0) {
    out << endl;

    indent(out) << "// isset id assignments" << endl;

    int i = 0;
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      if (!type_can_be_null((*m_iter)->get_type())) {
        indent(out) << "private static final int " << isset_field_id(*m_iter) << " = " << i << ";"
                    << endl;
        i++;
      }
    }

    if (i > 0) {
      indent(out) << "private boolean[] __isset_vector = new boolean[" << i << "];" << endl;
    }

    out << endl;
  }

  bool all_optional_members = true;

  // Default constructor
  indent(out) << "public " << tstruct->get_name() << "() {" << endl;
  indent_up();
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_type* t = get_true_type((*m_iter)->get_type());
    if ((*m_iter)->get_value() != NULL) {
      print_const_value(out,
                        "this." + (*m_iter)->get_name(),
                        t,
                        (*m_iter)->get_value(),
                        true,
                        true);
    }
    if ((*m_iter)->get_req() != t_field::T_OPTIONAL) {
      all_optional_members = false;
    }
  }
  indent_down();
  indent(out) << "}" << endl << endl;

  if (!members.empty() && !all_optional_members) {
    // Full constructor for all fields
    indent(out) << "public " << tstruct->get_name() << "(" << endl;
    indent_up();
    bool first = true;
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      if ((*m_iter)->get_req() != t_field::T_OPTIONAL) {
        if (!first) {
          out << "," << endl;
        }
        first = false;
        indent(out) << type_name((*m_iter)->get_type()) << " " << (*m_iter)->get_name();
      }
    }
    out << ")" << endl;
    indent_down();
    indent(out) << "{" << endl;
    indent_up();
    indent(out) << "this();" << endl;
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      if ((*m_iter)->get_req() != t_field::T_OPTIONAL) {
        indent(out) << "this." << (*m_iter)->get_name() << " = " << (*m_iter)->get_name() << ";"
                    << endl;
        generate_isset_set(out, (*m_iter));
      }
    }
    indent_down();
    indent(out) << "}" << endl << endl;
  }

  // copy constructor
  indent(out) << "/**" << endl;
  indent(out) << " * Performs a deep copy on <i>other</i>." << endl;
  indent(out) << " */" << endl;
  indent(out) << "public " << tstruct->get_name() << "(" << tstruct->get_name() << " other) {"
              << endl;
  indent_up();

  if (has_bit_vector(tstruct)) {
    indent(out) << "System.arraycopy(other.__isset_vector, 0, __isset_vector, 0, "
                   "other.__isset_vector.length);" << endl;
  }

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_field* field = (*m_iter);
    std::string field_name = field->get_name();
    t_type* type = field->get_type();
    bool can_be_null = type_can_be_null(type);

    if (can_be_null) {
      indent(out) << "if (other." << generate_isset_check(field) << ") {" << endl;
      indent_up();
    }

    if (type->is_container()) {
      generate_deep_copy_container(out, "other", field_name, "__this__" + field_name, type);
      indent(out) << "this." << field_name << " = __this__" << field_name << ";" << endl;
    } else {
      indent(out) << "this." << field_name << " = ";
      generate_deep_copy_non_container(out, "other." + field_name, field_name, type);
      out << ";" << endl;
    }

    if (can_be_null) {
      indent_down();
      indent(out) << "}" << endl;
    }
  }

  indent_down();
  indent(out) << "}" << endl << endl;

  // clone method, so that you can deep copy an object when you don't know its class.
  indent(out) << "public " << tstruct->get_name() << " deepCopy() {" << endl;
  indent(out) << "  return new " << tstruct->get_name() << "(this);" << endl;
  indent(out) << "}" << endl << endl;

  generate_java_struct_clear(out, tstruct);

  generate_java_bean_boilerplate(out, tstruct);
  generate_generic_field_getters_setters(out, tstruct);

  generate_java_struct_equality(out, tstruct);
  generate_java_struct_compare_to(out, tstruct);

  generate_java_struct_reader(out, tstruct);
  if (is_result) {
    generate_java_struct_result_writer(out, tstruct);
  } else {
    generate_java_struct_writer(out, tstruct);
  }
  generate_java_struct_tostring(out, tstruct);
  generate_java_validator(out, tstruct);
  scope_down(out);
  out << endl;
}

/**
 * Generates equals methods and a hashCode method for a structure.
 *
 * @param tstruct The struct definition
 */
void t_javame_generator::generate_java_struct_equality(ofstream& out, t_struct* tstruct) {
  out << indent() << "public boolean equals(Object that) {" << endl;
  indent_up();
  out << indent() << "if (that == null)" << endl << indent() << "  return false;" << endl
      << indent() << "if (that instanceof " << tstruct->get_name() << ")" << endl << indent()
      << "  return this.equals((" << tstruct->get_name() << ")that);" << endl << indent()
      << "return false;" << endl;
  scope_down(out);
  out << endl;

  out << indent() << "public boolean equals(" << tstruct->get_name() << " that) {" << endl;
  indent_up();
  out << indent() << "if (that == null)" << endl << indent() << "  return false;" << endl
      << indent() << "if (this == that)" << endl << indent() << "  return true;"  << endl;

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    out << endl;

    t_type* t = get_true_type((*m_iter)->get_type());
    // Most existing Thrift code does not use isset or optional/required,
    // so we treat "default" fields as required.
    bool is_optional = (*m_iter)->get_req() == t_field::T_OPTIONAL;
    bool can_be_null = type_can_be_null(t);
    string name = (*m_iter)->get_name();

    string this_present = "true";
    string that_present = "true";
    string unequal;

    if (is_optional || can_be_null) {
      this_present += " && this." + generate_isset_check(*m_iter);
      that_present += " && that." + generate_isset_check(*m_iter);
    }

    out << indent() << "boolean this_present_" << name << " = " << this_present << ";" << endl
        << indent() << "boolean that_present_" << name << " = " << that_present << ";" << endl
        << indent() << "if ("
        << "this_present_" << name << " || that_present_" << name << ") {" << endl;
    indent_up();
    out << indent() << "if (!("
        << "this_present_" << name << " && that_present_" << name << "))" << endl << indent()
        << "  return false;" << endl;

    if (t->is_base_type() && ((t_base_type*)t)->is_binary()) {
      unequal = "TBaseHelper.compareTo(this." + name + ", that." + name + ") != 0";
    } else if (can_be_null) {
      unequal = "!this." + name + ".equals(that." + name + ")";
    } else {
      unequal = "this." + name + " != that." + name;
    }

    out << indent() << "if (" << unequal << ")" << endl << indent() << "  return false;" << endl;

    scope_down(out);
  }
  out << endl;
  indent(out) << "return true;" << endl;
  scope_down(out);
  out << endl;

  out << indent() << "public int hashCode() {" << endl;
  indent_up();
  indent(out) << "return 0;" << endl;
  indent_down();
  indent(out) << "}" << endl << endl;
}

void t_javame_generator::generate_java_struct_compare_to(ofstream& out, t_struct* tstruct) {
  indent(out) << "public int compareTo(Object otherObject) {" << endl;
  //  indent(out) << "public int compareTo(" << type_name(tstruct) << " other) {" << endl;
  indent_up();

  indent(out) << "if (!getClass().equals(otherObject.getClass())) {" << endl;
  indent(out) << "  return getClass().getName().compareTo(otherObject.getClass().getName());"
              << endl;
  indent(out) << "}" << endl;
  out << endl;
  indent(out) << type_name(tstruct) << " other = (" << type_name(tstruct) << ")otherObject;";

  indent(out) << "int lastComparison = 0;" << endl;
  out << endl;

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_field* field = *m_iter;
    indent(out) << "lastComparison = TBaseHelper.compareTo(" << generate_isset_check(field)
                << ", other." << generate_isset_check(field) << ");" << endl;
    indent(out) << "if (lastComparison != 0) {" << endl;
    indent(out) << "  return lastComparison;" << endl;
    indent(out) << "}" << endl;

    indent(out) << "if (" << generate_isset_check(field) << ") {" << endl;
    if (field->get_type()->is_struct() || field->get_type()->is_xception()) {
      indent(out) << "  lastComparison = this." << field->get_name() << ".compareTo(other."
                  << field->get_name() << ");" << endl;
    } else {
      indent(out) << "  lastComparison = TBaseHelper.compareTo(this." << field->get_name()
                  << ", other." << field->get_name() << ");" << endl;
    }

    indent(out) << "  if (lastComparison != 0) {" << endl;
    indent(out) << "    return lastComparison;" << endl;
    indent(out) << "  }" << endl;
    indent(out) << "}" << endl;
  }

  indent(out) << "return 0;" << endl;

  indent_down();
  indent(out) << "}" << endl << endl;
}

/**
 * Generates a function to read all the fields of the struct.
 *
 * @param tstruct The struct definition
 */
void t_javame_generator::generate_java_struct_reader(ofstream& out, t_struct* tstruct) {
  out << indent() << "public void read(TProtocol iprot) throws TException {" << endl;
  indent_up();

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  // Declare stack tmp variables and read struct header
  out << indent() << "TField field;" << endl << indent() << "iprot.readStructBegin();" << endl;

  // Loop over reading in fields
  indent(out) << "while (true)" << endl;
  scope_up(out);

  // Read beginning field marker
  indent(out) << "field = iprot.readFieldBegin();" << endl;

  // Check for field STOP marker and break
  indent(out) << "if (field.type == TType.STOP) { " << endl;
  indent_up();
  indent(out) << "break;" << endl;
  indent_down();
  indent(out) << "}" << endl;

  // Switch statement on the field we are reading
  indent(out) << "switch (field.id) {" << endl;

  indent_up();

  // Generate deserialization code for known cases
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    indent(out) << "case " << (*f_iter)->get_key() << ": // "
                << constant_name((*f_iter)->get_name()) << endl;
    indent_up();
    indent(out) << "if (field.type == " << type_to_enum((*f_iter)->get_type()) << ") {" << endl;
    indent_up();

    generate_deserialize_field(out, *f_iter, "this.");
    generate_isset_set(out, *f_iter);
    indent_down();
    out << indent() << "} else { " << endl << indent() << "  TProtocolUtil.skip(iprot, field.type);"
        << endl << indent() << "}" << endl << indent() << "break;" << endl;
    indent_down();
  }

  indent(out) << "default:" << endl;
  indent(out) << "  TProtocolUtil.skip(iprot, field.type);" << endl;

  indent_down();
  indent(out) << "}" << endl;

  // Read field end marker
  indent(out) << "iprot.readFieldEnd();" << endl;

  indent_down();
  indent(out) << "}" << endl;

  out << indent() << "iprot.readStructEnd();" << endl;

  // performs various checks (e.g. check that all required fields are set)
  indent(out) << "validate();" << endl;

  indent_down();
  out << indent() << "}" << endl << endl;
}

// generates java method to perform various checks
// (e.g. check that all required fields are set)
void t_javame_generator::generate_java_validator(ofstream& out, t_struct* tstruct) {
  indent(out) << "public void validate() throws TException {" << endl;
  indent_up();

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  out << indent() << "// check for required fields" << endl;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if ((*f_iter)->get_req() == t_field::T_REQUIRED) {
      out << indent() << "if (!" << generate_isset_check(*f_iter) << ") {" << endl << indent()
          << "  throw new TProtocolException(\"Required field '" << (*f_iter)->get_name()
          << "' is unset! Struct:\" + toString());" << endl << indent() << "}" << endl << endl;
    }
  }

  indent_down();
  indent(out) << "}" << endl << endl;
}

/**
 * Generates a function to write all the fields of the struct
 *
 * @param tstruct The struct definition
 */
void t_javame_generator::generate_java_struct_writer(ofstream& out, t_struct* tstruct) {
  out << indent() << "public void write(TProtocol oprot) throws TException {" << endl;
  indent_up();

  string name = tstruct->get_name();
  const vector<t_field*>& fields = tstruct->get_sorted_members();
  vector<t_field*>::const_iterator f_iter;

  // performs various checks (e.g. check that all required fields are set)
  indent(out) << "validate();" << endl << endl;

  indent(out) << "oprot.writeStructBegin(STRUCT_DESC);" << endl;

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    bool null_allowed = type_can_be_null((*f_iter)->get_type());
    if (null_allowed) {
      out << indent() << "if (this." << (*f_iter)->get_name() << " != null) {" << endl;
      indent_up();
    }
    bool optional = (*f_iter)->get_req() == t_field::T_OPTIONAL;
    if (optional) {
      indent(out) << "if (" << generate_isset_check((*f_iter)) << ") {" << endl;
      indent_up();
    }

    indent(out) << "oprot.writeFieldBegin(" << constant_name((*f_iter)->get_name())
                << "_FIELD_DESC);" << endl;

    // Write field contents
    generate_serialize_field(out, *f_iter, "this.");

    // Write field closer
    indent(out) << "oprot.writeFieldEnd();" << endl;

    if (optional) {
      indent_down();
      indent(out) << "}" << endl;
    }
    if (null_allowed) {
      indent_down();
      indent(out) << "}" << endl;
    }
  }
  // Write the struct map
  out << indent() << "oprot.writeFieldStop();" << endl << indent() << "oprot.writeStructEnd();"
      << endl;

  indent_down();
  out << indent() << "}" << endl << endl;
}

/**
 * Generates a function to write all the fields of the struct,
 * which is a function result. These fields are only written
 * if they are set in the Isset array, and only one of them
 * can be set at a time.
 *
 * @param tstruct The struct definition
 */
void t_javame_generator::generate_java_struct_result_writer(ofstream& out, t_struct* tstruct) {
  out << indent() << "public void write(TProtocol oprot) throws TException {" << endl;
  indent_up();

  string name = tstruct->get_name();
  const vector<t_field*>& fields = tstruct->get_sorted_members();
  vector<t_field*>::const_iterator f_iter;

  indent(out) << "oprot.writeStructBegin(STRUCT_DESC);" << endl;

  bool first = true;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (first) {
      first = false;
      out << endl << indent() << "if ";
    } else {
      out << " else if ";
    }

    out << "(this." << generate_isset_check(*f_iter) << ") {" << endl;

    indent_up();

    indent(out) << "oprot.writeFieldBegin(" << constant_name((*f_iter)->get_name())
                << "_FIELD_DESC);" << endl;

    // Write field contents
    generate_serialize_field(out, *f_iter, "this.");

    // Write field closer
    indent(out) << "oprot.writeFieldEnd();" << endl;

    indent_down();
    indent(out) << "}";
  }
  // Write the struct map
  out << endl << indent() << "oprot.writeFieldStop();" << endl << indent()
      << "oprot.writeStructEnd();" << endl;

  indent_down();
  out << indent() << "}" << endl << endl;
}

void t_javame_generator::generate_reflection_getters(ostringstream& out,
                                                     t_type* type,
                                                     string field_name,
                                                     string cap_name) {
  indent(out) << "case " << constant_name(field_name) << ":" << endl;
  indent_up();

  if (type->is_base_type() && !type->is_string()) {
    t_base_type* base_type = (t_base_type*)type;

    indent(out) << "return new " << type_name(type, true, false) << "("
                << (base_type->is_bool() ? "is" : "get") << cap_name << "());" << endl << endl;
  } else {
    indent(out) << "return get" << cap_name << "();" << endl << endl;
  }

  indent_down();
}

void t_javame_generator::generate_reflection_setters(ostringstream& out,
                                                     t_type* type,
                                                     string field_name,
                                                     string cap_name) {
  indent(out) << "case " << constant_name(field_name) << ":" << endl;
  indent_up();
  indent(out) << "if (value == null) {" << endl;
  indent(out) << "  unset" << get_cap_name(field_name) << "();" << endl;
  indent(out) << "} else {" << endl;
  indent(out) << "  set" << cap_name << "((" << type_name(type, true, false) << ")value);" << endl;
  indent(out) << "}" << endl;
  indent(out) << "break;" << endl << endl;

  indent_down();
}

void t_javame_generator::generate_generic_field_getters_setters(std::ofstream& out,
                                                                t_struct* tstruct) {
  (void)out;
  std::ostringstream getter_stream;
  std::ostringstream setter_stream;

  // build up the bodies of both the getter and setter at once
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    t_field* field = *f_iter;
    t_type* type = get_true_type(field->get_type());
    std::string field_name = field->get_name();
    std::string cap_name = get_cap_name(field_name);

    indent_up();
    generate_reflection_setters(setter_stream, type, field_name, cap_name);
    generate_reflection_getters(getter_stream, type, field_name, cap_name);
    indent_down();
  }
}

/**
 * Generates a set of Java Bean boilerplate functions (setters, getters, etc.)
 * for the given struct.
 *
 * @param tstruct The struct definition
 */
void t_javame_generator::generate_java_bean_boilerplate(ofstream& out, t_struct* tstruct) {
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    t_field* field = *f_iter;
    t_type* type = get_true_type(field->get_type());
    std::string field_name = field->get_name();
    std::string cap_name = get_cap_name(field_name);

    if (type->is_container()) {
      // Method to return the size of the collection
      indent(out) << "public int get" << cap_name;
      out << get_cap_name("size() {") << endl;

      indent_up();
      indent(out) << "return (this." << field_name << " == null) ? 0 : "
                  << "this." << field_name << ".size();" << endl;
      indent_down();
      indent(out) << "}" << endl << endl;
    }

    if (type->is_set() || type->is_list()) {

      t_type* element_type;
      if (type->is_set()) {
        element_type = ((t_set*)type)->get_elem_type();
      } else {
        element_type = ((t_list*)type)->get_elem_type();
      }

      // Iterator getter for sets and lists
      indent(out) << "public Enumeration get" << cap_name;
      out << get_cap_name("Enumeration() {") << endl;

      indent_up();
      indent(out) << "return (this." << field_name << " == null) ? null : "
                  << "this." << field_name << ".elements();" << endl;
      indent_down();
      indent(out) << "}" << endl << endl;

      // Add to set or list, create if the set/list is null
      indent(out);
      out << "public void add" << get_cap_name("to");
      out << cap_name << "(" << type_name(element_type) << " elem) {" << endl;

      indent_up();
      indent(out) << "if (this." << field_name << " == null) {" << endl;
      indent_up();
      indent(out) << "this." << field_name << " = new " << type_name(type, false, true) << "();"
                  << endl;
      indent_down();
      indent(out) << "}" << endl;
      if (type->is_set()) {
        indent(out) << "this." << field_name << ".put(" << box_type(element_type, "elem") << ", "
                    << box_type(element_type, "elem") << ");" << endl;
      } else {
        indent(out) << "this." << field_name << ".addElement(" << box_type(element_type, "elem")
                    << ");" << endl;
      }
      indent_down();
      indent(out) << "}" << endl << endl;

    } else if (type->is_map()) {
      // Put to map
      t_type* key_type = ((t_map*)type)->get_key_type();
      t_type* val_type = ((t_map*)type)->get_val_type();

      indent(out);
      out << "public void putTo" << cap_name << "(" << type_name(key_type, true) << " key, "
          << type_name(val_type, true) << " val) {" << endl;

      indent_up();
      indent(out) << "if (this." << field_name << " == null) {" << endl;
      indent_up();
      indent(out) << "this." << field_name << " = new " << type_name(type, false, true) << "();"
                  << endl;
      indent_down();
      indent(out) << "}" << endl;
      indent(out) << "this." << field_name << ".put(key, val);" << endl;
      indent_down();
      indent(out) << "}" << endl << endl;
    }

    // Simple getter
    generate_java_doc(out, field);
    indent(out) << "public " << type_name(type);
    if (type->is_base_type() && ((t_base_type*)type)->get_base() == t_base_type::TYPE_BOOL) {
      out << " is";
    } else {
      out << " get";
    }
    out << cap_name << "() {" << endl;
    indent_up();
    indent(out) << "return this." << field_name << ";" << endl;
    indent_down();
    indent(out) << "}" << endl << endl;

    // Simple setter
    generate_java_doc(out, field);
    indent(out) << "public ";
    out << "void";
    out << " set" << cap_name << "(" << type_name(type) << " " << field_name << ") {" << endl;
    indent_up();
    indent(out) << "this." << field_name << " = " << field_name << ";" << endl;
    generate_isset_set(out, field);

    indent_down();
    indent(out) << "}" << endl << endl;

    // Unsetter
    indent(out) << "public void unset" << cap_name << "() {" << endl;
    indent_up();
    if (type_can_be_null(type)) {
      indent(out) << "this." << field_name << " = null;" << endl;
    } else {
      indent(out) << "__isset_vector[" << isset_field_id(field) << "] = false;" << endl;
    }
    indent_down();
    indent(out) << "}" << endl << endl;

    // isSet method
    indent(out) << "/** Returns true if field " << field_name
                << " is set (has been assigned a value) and false otherwise */" << endl;
    indent(out) << "public boolean is" << get_cap_name("set") << cap_name << "() {" << endl;
    indent_up();
    if (type_can_be_null(type)) {
      indent(out) << "return this." << field_name << " != null;" << endl;
    } else {
      indent(out) << "return __isset_vector[" << isset_field_id(field) << "];" << endl;
    }
    indent_down();
    indent(out) << "}" << endl << endl;

    indent(out) << "public void set" << cap_name << get_cap_name("isSet") << "(boolean value) {"
                << endl;
    indent_up();
    if (type_can_be_null(type)) {
      indent(out) << "if (!value) {" << endl;
      indent(out) << "  this." << field_name << " = null;" << endl;
      indent(out) << "}" << endl;
    } else {
      indent(out) << "__isset_vector[" << isset_field_id(field) << "] = value;" << endl;
    }
    indent_down();
    indent(out) << "}" << endl << endl;
  }
}

/**
 * Generates a toString() method for the given struct
 *
 * @param tstruct The struct definition
 */
void t_javame_generator::generate_java_struct_tostring(ofstream& out, t_struct* tstruct) {
  out << indent() << "public String toString() {" << endl;
  indent_up();

  out << indent() << "StringBuffer sb = new StringBuffer(\"" << tstruct->get_name() << "(\");"
      << endl;
  out << indent() << "boolean first = true;" << endl << endl;

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  bool first = true;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    bool could_be_unset = (*f_iter)->get_req() == t_field::T_OPTIONAL;
    if (could_be_unset) {
      indent(out) << "if (" << generate_isset_check(*f_iter) << ") {" << endl;
      indent_up();
    }

    t_field* field = (*f_iter);

    if (!first) {
      indent(out) << "if (!first) sb.append(\", \");" << endl;
    }
    indent(out) << "sb.append(\"" << (*f_iter)->get_name() << ":\");" << endl;
    bool can_be_null = type_can_be_null(field->get_type());
    if (can_be_null) {
      indent(out) << "if (this." << (*f_iter)->get_name() << " == null) {" << endl;
      indent(out) << "  sb.append(\"null\");" << endl;
      indent(out) << "} else {" << endl;
      indent_up();
    }

    if (field->get_type()->is_base_type() && ((t_base_type*)(field->get_type()))->is_binary()) {
      indent(out) << "TBaseHelper.toString(this." << field->get_name() << ", sb);" << endl;
    } else {
      indent(out) << "sb.append(this." << (*f_iter)->get_name() << ");" << endl;
    }

    if (can_be_null) {
      indent_down();
      indent(out) << "}" << endl;
    }
    indent(out) << "first = false;" << endl;

    if (could_be_unset) {
      indent_down();
      indent(out) << "}" << endl;
    }
    first = false;
  }
  out << indent() << "sb.append(\")\");" << endl << indent() << "return sb.toString();" << endl;

  indent_down();
  indent(out) << "}" << endl << endl;
}

/**
 * Returns a string with the java representation of the given thrift type
 * (e.g. for the type struct it returns "TType.STRUCT")
 */
std::string t_javame_generator::get_java_type_string(t_type* type) {
  if (type->is_list()) {
    return "TType.LIST";
  } else if (type->is_map()) {
    return "TType.MAP";
  } else if (type->is_set()) {
    return "TType.SET";
  } else if (type->is_struct() || type->is_xception()) {
    return "TType.STRUCT";
  } else if (type->is_enum()) {
    return "TType.ENUM";
  } else if (type->is_typedef()) {
    return get_java_type_string(((t_typedef*)type)->get_type());
  } else if (type->is_base_type()) {
    switch (((t_base_type*)type)->get_base()) {
    case t_base_type::TYPE_VOID:
      return "TType.VOID";
      break;
    case t_base_type::TYPE_STRING:
      return "TType.STRING";
      break;
    case t_base_type::TYPE_BOOL:
      return "TType.BOOL";
      break;
    case t_base_type::TYPE_I8:
      return "TType.BYTE";
      break;
    case t_base_type::TYPE_I16:
      return "TType.I16";
      break;
    case t_base_type::TYPE_I32:
      return "TType.I32";
      break;
    case t_base_type::TYPE_I64:
      return "TType.I64";
      break;
    case t_base_type::TYPE_DOUBLE:
      return "TType.DOUBLE";
      break;
    default:
      throw std::runtime_error("Unknown thrift type \"" + type->get_name()
                               + "\" passed to t_javame_generator::get_java_type_string!");
      break; // This should never happen!
    }
  } else {
    throw std::runtime_error(
        "Unknown thrift type \"" + type->get_name()
        + "\" passed to t_javame_generator::get_java_type_string!"); // This should never happen!
  }
}

void t_javame_generator::generate_field_value_meta_data(std::ofstream& out, t_type* type) {
  out << endl;
  indent_up();
  indent_up();
  if (type->is_struct() || type->is_xception()) {
    indent(out) << "new StructMetaData(TType.STRUCT, " << type_name(type) << ".class";
  } else if (type->is_container()) {
    if (type->is_list()) {
      indent(out) << "new ListMetaData(TType.LIST, ";
      t_type* elem_type = ((t_list*)type)->get_elem_type();
      generate_field_value_meta_data(out, elem_type);
    } else if (type->is_set()) {
      indent(out) << "new SetMetaData(TType.SET, ";
      t_type* elem_type = ((t_list*)type)->get_elem_type();
      generate_field_value_meta_data(out, elem_type);
    } else { // map
      indent(out) << "new MapMetaData(TType.MAP, ";
      t_type* key_type = ((t_map*)type)->get_key_type();
      t_type* val_type = ((t_map*)type)->get_val_type();
      generate_field_value_meta_data(out, key_type);
      out << ", ";
      generate_field_value_meta_data(out, val_type);
    }
  } else if (type->is_enum()) {
    indent(out) << "new EnumMetaData(TType.ENUM, " << type_name(type) << ".class";
  } else {
    indent(out) << "new FieldValueMetaData(" << get_java_type_string(type);
    if (type->is_typedef()) {
      indent(out) << ", \"" << ((t_typedef*)type)->get_symbolic() << "\"";
    }
  }
  out << ")";
  indent_down();
  indent_down();
}

/**
 * Generates a thrift service. In C++, this comprises an entirely separate
 * header and source file. The header file defines the methods and includes
 * the data types defined in the main header file, and the implementation
 * file contains implementations of the basic printer and default interfaces.
 *
 * @param tservice The service definition
 */
void t_javame_generator::generate_service(t_service* tservice) {
  // Make output file
  string f_service_name = package_dir_ + "/" + service_name_ + ".java";
  f_service_.open(f_service_name.c_str());

  f_service_ << autogen_comment() << java_package() << java_type_imports() << java_thrift_imports();

  f_service_ << "public class " << service_name_ << " {" << endl << endl;
  indent_up();

  // Generate the three main parts of the service
  generate_service_interface(tservice);
  generate_service_client(tservice);
  generate_service_server(tservice);
  generate_service_helpers(tservice);

  indent_down();
  f_service_ << "}" << endl;
  f_service_.close();
}

/**
 * Generates a service interface definition.
 *
 * @param tservice The service to generate a header definition for
 */
void t_javame_generator::generate_primitive_service_interface(t_service* tservice) {
  f_service_ << indent() << "public interface Iface extends " << service_name_ << "Iface { }"
             << endl << endl;

  string f_interface_name = package_dir_ + "/" + service_name_ + "Iface.java";
  std::ofstream f_iface;
  f_iface.open(f_interface_name.c_str());

  string extends_iface = "";
  if (tservice->get_extends() != NULL) {
    extends_iface = " extends " + type_name(tservice->get_extends()) + "Iface";
  }

  f_iface << autogen_comment() << java_package() << java_type_imports() << java_thrift_imports();
  generate_java_doc(f_iface, tservice);
  f_iface << "public interface " << service_name_ << "Iface" << extends_iface << " {" << endl
          << endl;
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    generate_java_doc(f_iface, *f_iter);
    f_iface << "  public " << function_signature(*f_iter) << ";" << endl << endl;
  }
  f_iface << "}" << endl << endl;
}

/**
 * Generates a service interface definition.
 *
 * @param tservice The service to generate a header definition for
 */
void t_javame_generator::generate_service_interface(t_service* tservice) {
  string extends = "";
  string extends_iface = "";
  if (tservice->get_extends() != NULL) {
    extends = type_name(tservice->get_extends());
    extends_iface = " extends " + extends + ".Iface";
  }

  generate_java_doc(f_service_, tservice);
  f_service_ << indent() << "public interface Iface" << extends_iface << " {" << endl << endl;
  indent_up();
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    generate_java_doc(f_service_, *f_iter);
    indent(f_service_) << "public " << function_signature(*f_iter) << ";" << endl << endl;
  }
  indent_down();
  f_service_ << indent() << "}" << endl << endl;
}

/**
 * Generates structs for all the service args and return types
 *
 * @param tservice The service
 */
void t_javame_generator::generate_service_helpers(t_service* tservice) {
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    t_struct* ts = (*f_iter)->get_arglist();
    generate_java_struct_definition(f_service_, ts, false, true);
    generate_function_helpers(*f_iter);
  }
}

/**
 * Generates a service client definition.
 *
 * @param tservice The service to generate a server for.
 */
void t_javame_generator::generate_service_client(t_service* tservice) {
  string extends = "";
  string extends_client = "";
  if (tservice->get_extends() != NULL) {
    extends = type_name(tservice->get_extends());
    extends_client = " extends " + extends + ".Client";
  }

  indent(f_service_) << "public static class Client" << extends_client
                     << " implements TServiceClient, Iface {" << endl;
  indent_up();

  indent(f_service_) << "public Client(TProtocol prot)" << endl;
  scope_up(f_service_);
  indent(f_service_) << "this(prot, prot);" << endl;
  scope_down(f_service_);
  f_service_ << endl;

  indent(f_service_) << "public Client(TProtocol iprot, TProtocol oprot)" << endl;
  scope_up(f_service_);
  if (extends.empty()) {
    f_service_ << indent() << "iprot_ = iprot;" << endl << indent() << "oprot_ = oprot;" << endl;
  } else {
    f_service_ << indent() << "super(iprot, oprot);" << endl;
  }
  scope_down(f_service_);
  f_service_ << endl;

  if (extends.empty()) {
    f_service_ << indent() << "protected TProtocol iprot_;" << endl << indent()
               << "protected TProtocol oprot_;" << endl << endl << indent()
               << "protected int seqid_;" << endl << endl;

    indent(f_service_) << "public TProtocol getInputProtocol()" << endl;
    scope_up(f_service_);
    indent(f_service_) << "return this.iprot_;" << endl;
    scope_down(f_service_);
    f_service_ << endl;

    indent(f_service_) << "public TProtocol getOutputProtocol()" << endl;
    scope_up(f_service_);
    indent(f_service_) << "return this.oprot_;" << endl;
    scope_down(f_service_);
    f_service_ << endl;
  }

  // Generate client method implementations
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::const_iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    string funname = (*f_iter)->get_name();

    // Open function
    indent(f_service_) << "public " << function_signature(*f_iter) << endl;
    scope_up(f_service_);
    indent(f_service_) << "send_" << funname << "(";

    // Get the struct of function call params
    t_struct* arg_struct = (*f_iter)->get_arglist();

    // Declare the function arguments
    const vector<t_field*>& fields = arg_struct->get_members();
    vector<t_field*>::const_iterator fld_iter;
    bool first = true;
    for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
      if (first) {
        first = false;
      } else {
        f_service_ << ", ";
      }
      f_service_ << (*fld_iter)->get_name();
    }
    f_service_ << ");" << endl;

    if (!(*f_iter)->is_oneway()) {
      f_service_ << indent();
      if (!(*f_iter)->get_returntype()->is_void()) {
        f_service_ << "return ";
      }
      f_service_ << "recv_" << funname << "();" << endl;
    }
    scope_down(f_service_);
    f_service_ << endl;

    t_function send_function(g_type_void,
                             string("send_") + (*f_iter)->get_name(),
                             (*f_iter)->get_arglist());

    string argsname = (*f_iter)->get_name() + "_args";

    // Open function
    indent(f_service_) << "public " << function_signature(&send_function) << endl;
    scope_up(f_service_);

    // Serialize the request
    f_service_ << indent() << "oprot_.writeMessageBegin(new TMessage(\"" << funname << "\", "
               << ((*f_iter)->is_oneway() ? "TMessageType.ONEWAY" : "TMessageType.CALL")
               << ", ++seqid_));" << endl << indent() << argsname << " args = new " << argsname
               << "();" << endl;

    for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
      f_service_ << indent() << "args.set" << get_cap_name((*fld_iter)->get_name()) << "("
                 << (*fld_iter)->get_name() << ");" << endl;
    }

    f_service_ << indent() << "args.write(oprot_);" << endl << indent()
               << "oprot_.writeMessageEnd();" << endl << indent()
               << "oprot_.getTransport().flush();" << endl;

    scope_down(f_service_);
    f_service_ << endl;

    if (!(*f_iter)->is_oneway()) {
      string resultname = (*f_iter)->get_name() + "_result";

      t_struct noargs(program_);
      t_function recv_function((*f_iter)->get_returntype(),
                               string("recv_") + (*f_iter)->get_name(),
                               &noargs,
                               (*f_iter)->get_xceptions());
      // Open function
      indent(f_service_) << "public " << function_signature(&recv_function) << endl;
      scope_up(f_service_);

      f_service_ << indent() << "TMessage msg = iprot_.readMessageBegin();" << endl << indent()
                 << "if (msg.type == TMessageType.EXCEPTION) {" << endl << indent()
                 << "  TApplicationException x = TApplicationException.read(iprot_);" << endl
                 << indent() << "  iprot_.readMessageEnd();" << endl << indent() << "  throw x;"
                 << endl << indent() << "}" << endl << indent() << "if (msg.seqid != seqid_) {"
                 << endl << indent()
                 << "  throw new TApplicationException(TApplicationException.BAD_SEQUENCE_ID, \""
                 << (*f_iter)->get_name() << " failed: out of sequence response\");" << endl
                 << indent() << "}" << endl << indent() << resultname << " result = new "
                 << resultname << "();" << endl << indent() << "result.read(iprot_);" << endl
                 << indent() << "iprot_.readMessageEnd();" << endl;

      // Careful, only return _result if not a void function
      if (!(*f_iter)->get_returntype()->is_void()) {
        f_service_ << indent() << "if (result." << generate_isset_check("success") << ") {" << endl
                   << indent() << "  return result.success;" << endl << indent() << "}" << endl;
      }

      t_struct* xs = (*f_iter)->get_xceptions();
      const std::vector<t_field*>& xceptions = xs->get_members();
      vector<t_field*>::const_iterator x_iter;
      for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
        f_service_ << indent() << "if (result." << (*x_iter)->get_name() << " != null) {" << endl
                   << indent() << "  throw result." << (*x_iter)->get_name() << ";" << endl
                   << indent() << "}" << endl;
      }

      // If you get here it's an exception, unless a void function
      if ((*f_iter)->get_returntype()->is_void()) {
        indent(f_service_) << "return;" << endl;
      } else {
        f_service_ << indent()
                   << "throw new TApplicationException(TApplicationException.MISSING_RESULT, \""
                   << (*f_iter)->get_name() << " failed: unknown result\");" << endl;
      }

      // Close function
      scope_down(f_service_);
      f_service_ << endl;
    }
  }

  indent_down();
  indent(f_service_) << "}" << endl;
}

/**
 * Generates a service server definition.
 *
 * @param tservice The service to generate a server for.
 */
void t_javame_generator::generate_service_server(t_service* tservice) {
  // Generate the dispatch methods
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;

  // Extends stuff
  string extends = "";
  string extends_processor = "";
  if (tservice->get_extends() != NULL) {
    extends = type_name(tservice->get_extends());
    extends_processor = " extends " + extends + ".Processor";
  }

  // Generate the header portion
  indent(f_service_) << "public static class Processor" << extends_processor
                     << " implements TProcessor {" << endl;
  indent_up();

  indent(f_service_) << "public Processor(Iface iface)" << endl;
  scope_up(f_service_);
  if (!extends.empty()) {
    f_service_ << indent() << "super(iface);" << endl;
  }
  f_service_ << indent() << "iface_ = iface;" << endl;

  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    f_service_ << indent() << "processMap_.put(\"" << (*f_iter)->get_name() << "\", new "
               << (*f_iter)->get_name() << "());" << endl;
  }

  scope_down(f_service_);
  f_service_ << endl;

  if (extends.empty()) {
    f_service_
        << indent() << "protected static interface ProcessFunction {" << endl << indent()
        << "  public void process(int seqid, TProtocol iprot, TProtocol oprot) throws TException;"
        << endl << indent() << "}" << endl << endl;
  }

  f_service_ << indent() << "private Iface iface_;" << endl;

  if (extends.empty()) {
    f_service_ << indent() << "protected final Hashtable processMap_ = new Hashtable();" << endl;
  }

  f_service_ << endl;

  // Generate the server implementation
  indent(f_service_) << "public boolean process(TProtocol iprot, TProtocol oprot) throws TException"
                     << endl;
  scope_up(f_service_);

  f_service_ << indent() << "TMessage msg = iprot.readMessageBegin();" << endl;

  // TODO(mcslee): validate message, was the seqid etc. legit?

  f_service_
      << indent() << "ProcessFunction fn = (ProcessFunction)processMap_.get(msg.name);" << endl
      << indent() << "if (fn == null) {" << endl << indent()
      << "  TProtocolUtil.skip(iprot, TType.STRUCT);" << endl << indent()
      << "  iprot.readMessageEnd();" << endl << indent()
      << "  TApplicationException x = new "
         "TApplicationException(TApplicationException.UNKNOWN_METHOD, \"Invalid method name: "
         "'\"+msg.name+\"'\");" << endl << indent()
      << "  oprot.writeMessageBegin(new TMessage(msg.name, TMessageType.EXCEPTION, msg.seqid));"
      << endl << indent() << "  x.write(oprot);" << endl << indent() << "  oprot.writeMessageEnd();"
      << endl << indent() << "  oprot.getTransport().flush();" << endl << indent()
      << "  return true;" << endl << indent() << "}" << endl << indent()
      << "fn.process(msg.seqid, iprot, oprot);" << endl;

  f_service_ << indent() << "return true;" << endl;

  scope_down(f_service_);
  f_service_ << endl;

  // Generate the process subfunctions
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    generate_process_function(tservice, *f_iter);
  }

  indent_down();
  indent(f_service_) << "}" << endl << endl;
}

/**
 * Generates a struct and helpers for a function.
 *
 * @param tfunction The function
 */
void t_javame_generator::generate_function_helpers(t_function* tfunction) {
  if (tfunction->is_oneway()) {
    return;
  }

  t_struct result(program_, tfunction->get_name() + "_result");
  t_field success(tfunction->get_returntype(), "success", 0);
  if (!tfunction->get_returntype()->is_void()) {
    result.append(&success);
  }

  t_struct* xs = tfunction->get_xceptions();
  const vector<t_field*>& fields = xs->get_members();
  vector<t_field*>::const_iterator f_iter;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    result.append(*f_iter);
  }

  generate_java_struct_definition(f_service_, &result, false, true, true);
}

/**
 * Generates a process function definition.
 *
 * @param tfunction The function to write a dispatcher for
 */
void t_javame_generator::generate_process_function(t_service* tservice, t_function* tfunction) {
  (void)tservice;
  // Open class
  indent(f_service_) << "private class " << tfunction->get_name() << " implements ProcessFunction {"
                     << endl;
  indent_up();

  // Open function
  indent(f_service_)
      << "public void process(int seqid, TProtocol iprot, TProtocol oprot) throws TException"
      << endl;
  scope_up(f_service_);

  string argsname = tfunction->get_name() + "_args";
  string resultname = tfunction->get_name() + "_result";

  f_service_ << indent() << argsname << " args = new " << argsname << "();" << endl << indent()
             << "try {" << endl;
  indent_up();
  f_service_ << indent() << "args.read(iprot);" << endl;
  indent_down();
  f_service_ << indent() << "} catch (TProtocolException e) {" << endl;
  indent_up();
  f_service_ << indent() << "iprot.readMessageEnd();" << endl << indent()
             << "TApplicationException x = new "
                "TApplicationException(TApplicationException.PROTOCOL_ERROR, e.getMessage());"
             << endl << indent() << "oprot.writeMessageBegin(new TMessage(\""
             << tfunction->get_name() << "\", TMessageType.EXCEPTION, seqid));" << endl << indent()
             << "x.write(oprot);" << endl << indent() << "oprot.writeMessageEnd();" << endl
             << indent() << "oprot.getTransport().flush();" << endl << indent() << "return;"
             << endl;
  indent_down();
  f_service_ << indent() << "}" << endl;
  f_service_ << indent() << "iprot.readMessageEnd();" << endl;

  t_struct* xs = tfunction->get_xceptions();
  const std::vector<t_field*>& xceptions = xs->get_members();
  vector<t_field*>::const_iterator x_iter;

  // Declare result for non oneway function
  if (!tfunction->is_oneway()) {
    f_service_ << indent() << resultname << " result = new " << resultname << "();" << endl;
  }

  // Try block for a function with exceptions
  if (xceptions.size() > 0) {
    f_service_ << indent() << "try {" << endl;
    indent_up();
  }

  // Generate the function call
  t_struct* arg_struct = tfunction->get_arglist();
  const std::vector<t_field*>& fields = arg_struct->get_members();
  vector<t_field*>::const_iterator f_iter;

  f_service_ << indent();
  if (!tfunction->is_oneway() && !tfunction->get_returntype()->is_void()) {
    f_service_ << "result.success = ";
  }
  f_service_ << "iface_." << tfunction->get_name() << "(";
  bool first = true;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (first) {
      first = false;
    } else {
      f_service_ << ", ";
    }
    f_service_ << "args." << (*f_iter)->get_name();
  }
  f_service_ << ");" << endl;

  // Set isset on success field
  if (!tfunction->is_oneway() && !tfunction->get_returntype()->is_void()
      && !type_can_be_null(tfunction->get_returntype())) {
    f_service_ << indent() << "result.set" << get_cap_name("success") << get_cap_name("isSet")
               << "(true);" << endl;
  }

  if (!tfunction->is_oneway() && xceptions.size() > 0) {
    indent_down();
    f_service_ << indent() << "}";
    for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
      f_service_ << " catch (" << type_name((*x_iter)->get_type(), false, false) << " "
                 << (*x_iter)->get_name() << ") {" << endl;
      if (!tfunction->is_oneway()) {
        indent_up();
        f_service_ << indent() << "result." << (*x_iter)->get_name() << " = "
                   << (*x_iter)->get_name() << ";" << endl;
        indent_down();
        f_service_ << indent() << "}";
      } else {
        f_service_ << "}";
      }
    }
    f_service_ << " catch (Throwable th) {" << endl;
    indent_up();
    f_service_ << indent() << "TApplicationException x = new "
                              "TApplicationException(TApplicationException.INTERNAL_ERROR, "
                              "\"Internal error processing " << tfunction->get_name() << "\");"
               << endl << indent() << "oprot.writeMessageBegin(new TMessage(\""
               << tfunction->get_name() << "\", TMessageType.EXCEPTION, seqid));" << endl
               << indent() << "x.write(oprot);" << endl << indent() << "oprot.writeMessageEnd();"
               << endl << indent() << "oprot.getTransport().flush();" << endl << indent()
               << "return;" << endl;
    indent_down();
    f_service_ << indent() << "}" << endl;
  }

  // Shortcut out here for oneway functions
  if (tfunction->is_oneway()) {
    f_service_ << indent() << "return;" << endl;
    scope_down(f_service_);

    // Close class
    indent_down();
    f_service_ << indent() << "}" << endl << endl;
    return;
  }

  f_service_ << indent() << "oprot.writeMessageBegin(new TMessage(\"" << tfunction->get_name()
             << "\", TMessageType.REPLY, seqid));" << endl << indent() << "result.write(oprot);"
             << endl << indent() << "oprot.writeMessageEnd();" << endl << indent()
             << "oprot.getTransport().flush();" << endl;

  // Close function
  scope_down(f_service_);
  f_service_ << endl;

  // Close class
  indent_down();
  f_service_ << indent() << "}" << endl << endl;
}

/**
 * Deserializes a field of any type.
 *
 * @param tfield The field
 * @param prefix The variable name or container for this field
 */
void t_javame_generator::generate_deserialize_field(ofstream& out, t_field* tfield, string prefix) {
  t_type* type = get_true_type(tfield->get_type());

  if (type->is_void()) {
    throw "CANNOT GENERATE DESERIALIZE CODE FOR void TYPE: " + prefix + tfield->get_name();
  }

  string name = prefix + tfield->get_name();

  if (type->is_struct() || type->is_xception()) {
    generate_deserialize_struct(out, (t_struct*)type, name);
  } else if (type->is_container()) {
    generate_deserialize_container(out, type, name);
  } else if (type->is_base_type()) {
    indent(out) << name << " = iprot.";

    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_VOID:
      throw "compiler error: cannot serialize void field in a struct: " + name;
      break;
    case t_base_type::TYPE_STRING:
      if (!((t_base_type*)type)->is_binary()) {
        out << "readString();";
      } else {
        out << "readBinary();";
      }
      break;
    case t_base_type::TYPE_BOOL:
      out << "readBool();";
      break;
    case t_base_type::TYPE_I8:
      out << "readByte();";
      break;
    case t_base_type::TYPE_I16:
      out << "readI16();";
      break;
    case t_base_type::TYPE_I32:
      out << "readI32();";
      break;
    case t_base_type::TYPE_I64:
      out << "readI64();";
      break;
    case t_base_type::TYPE_DOUBLE:
      out << "readDouble();";
      break;
    default:
      throw "compiler error: no Java name for base type " + t_base_type::t_base_name(tbase);
    }
    out << endl;
  } else if (type->is_enum()) {
    indent(out) << name << " = "
                << type_name(tfield->get_type(), true, false) + ".findByValue(iprot.readI32());"
                << endl;
  } else {
    printf("DO NOT KNOW HOW TO DESERIALIZE FIELD '%s' TYPE '%s'\n",
           tfield->get_name().c_str(),
           type_name(type).c_str());
  }
}

/**
 * Generates an unserializer for a struct, invokes read()
 */
void t_javame_generator::generate_deserialize_struct(ofstream& out,
                                                     t_struct* tstruct,
                                                     string prefix) {
  out << indent() << prefix << " = new " << type_name(tstruct) << "();" << endl << indent()
      << prefix << ".read(iprot);" << endl;
}

/**
 * Deserializes a container by reading its size and then iterating
 */
void t_javame_generator::generate_deserialize_container(ofstream& out,
                                                        t_type* ttype,
                                                        string prefix) {
  scope_up(out);

  string obj;

  if (ttype->is_map()) {
    obj = tmp("_map");
  } else if (ttype->is_set()) {
    obj = tmp("_set");
  } else if (ttype->is_list()) {
    obj = tmp("_list");
  }

  // Declare variables, read header
  if (ttype->is_map()) {
    indent(out) << "TMap " << obj << " = iprot.readMapBegin();" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "TSet " << obj << " = iprot.readSetBegin();" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "TList " << obj << " = iprot.readListBegin();" << endl;
  }

  indent(out) << prefix << " = new " << type_name(ttype, false, true)
              // size the collection correctly
              << "(" << (ttype->is_list() ? "" : "2*") << obj << ".size"
              << ");" << endl;

  // For loop iterates over elements
  string i = tmp("_i");
  indent(out) << "for (int " << i << " = 0; " << i << " < " << obj << ".size"
              << "; "
              << "++" << i << ")" << endl;

  scope_up(out);

  if (ttype->is_map()) {
    generate_deserialize_map_element(out, (t_map*)ttype, prefix);
  } else if (ttype->is_set()) {
    generate_deserialize_set_element(out, (t_set*)ttype, prefix);
  } else if (ttype->is_list()) {
    generate_deserialize_list_element(out, (t_list*)ttype, prefix);
  }

  scope_down(out);

  // Read container end
  if (ttype->is_map()) {
    indent(out) << "iprot.readMapEnd();" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "iprot.readSetEnd();" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "iprot.readListEnd();" << endl;
  }

  scope_down(out);
}

/**
 * Generates code to deserialize a map
 */
void t_javame_generator::generate_deserialize_map_element(ofstream& out,
                                                          t_map* tmap,
                                                          string prefix) {
  string key = tmp("_key");
  string val = tmp("_val");
  t_field fkey(tmap->get_key_type(), key);
  t_field fval(tmap->get_val_type(), val);

  indent(out) << declare_field(&fkey) << endl;
  indent(out) << declare_field(&fval) << endl;

  generate_deserialize_field(out, &fkey);
  generate_deserialize_field(out, &fval);

  indent(out) << prefix << ".put(" << box_type(tmap->get_key_type(), key) << ", "
              << box_type(tmap->get_val_type(), val) << ");" << endl;
}

/**
 * Deserializes a set element
 */
void t_javame_generator::generate_deserialize_set_element(ofstream& out,
                                                          t_set* tset,
                                                          string prefix) {
  string elem = tmp("_elem");
  t_field felem(tset->get_elem_type(), elem);

  indent(out) << declare_field(&felem) << endl;

  generate_deserialize_field(out, &felem);

  indent(out) << prefix << ".put(" << box_type(tset->get_elem_type(), elem) << ", "
              << box_type(tset->get_elem_type(), elem) << ");" << endl;
}

/**
 * Deserializes a list element
 */
void t_javame_generator::generate_deserialize_list_element(ofstream& out,
                                                           t_list* tlist,
                                                           string prefix) {
  string elem = tmp("_elem");
  t_field felem(tlist->get_elem_type(), elem);

  indent(out) << declare_field(&felem) << endl;

  generate_deserialize_field(out, &felem);

  indent(out) << prefix << ".addElement(" << box_type(tlist->get_elem_type(), elem) << ");" << endl;
}

/**
 * Serializes a field of any type.
 *
 * @param tfield The field to serialize
 * @param prefix Name to prepend to field name
 */
void t_javame_generator::generate_serialize_field(ofstream& out, t_field* tfield, string prefix) {
  t_type* type = get_true_type(tfield->get_type());

  // Do nothing for void types
  if (type->is_void()) {
    throw "CANNOT GENERATE SERIALIZE CODE FOR void TYPE: " + prefix + tfield->get_name();
  }

  if (type->is_struct() || type->is_xception()) {
    generate_serialize_struct(out, (t_struct*)type, prefix + tfield->get_name());
  } else if (type->is_container()) {
    generate_serialize_container(out, type, prefix + tfield->get_name());
  } else if (type->is_enum()) {
    indent(out) << "oprot.writeI32(" << prefix + tfield->get_name() << ".getValue());" << endl;
  } else if (type->is_base_type()) {
    string name = prefix + tfield->get_name();
    indent(out) << "oprot.";

    if (type->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        throw "compiler error: cannot serialize void field in a struct: " + name;
        break;
      case t_base_type::TYPE_STRING:
        if (((t_base_type*)type)->is_binary()) {
          out << "writeBinary(" << name << ");";
        } else {
          out << "writeString(" << name << ");";
        }
        break;
      case t_base_type::TYPE_BOOL:
        out << "writeBool(" << name << ");";
        break;
      case t_base_type::TYPE_I8:
        out << "writeByte(" << name << ");";
        break;
      case t_base_type::TYPE_I16:
        out << "writeI16(" << name << ");";
        break;
      case t_base_type::TYPE_I32:
        out << "writeI32(" << name << ");";
        break;
      case t_base_type::TYPE_I64:
        out << "writeI64(" << name << ");";
        break;
      case t_base_type::TYPE_DOUBLE:
        out << "writeDouble(" << name << ");";
        break;
      default:
        throw "compiler error: no Java name for base type " + t_base_type::t_base_name(tbase);
      }
    } else if (type->is_enum()) {
      out << "writeI32(" << name << ");";
    }
    out << endl;
  } else {
    printf("DO NOT KNOW HOW TO SERIALIZE FIELD '%s%s' TYPE '%s'\n",
           prefix.c_str(),
           tfield->get_name().c_str(),
           type_name(type).c_str());
  }
}

/**
 * Serializes all the members of a struct.
 *
 * @param tstruct The struct to serialize
 * @param prefix  String prefix to attach to all fields
 */
void t_javame_generator::generate_serialize_struct(ofstream& out,
                                                   t_struct* tstruct,
                                                   string prefix) {
  (void)tstruct;
  out << indent() << prefix << ".write(oprot);" << endl;
}

/**
 * Serializes a container by writing its size then the elements.
 *
 * @param ttype  The type of container
 * @param prefix String prefix for fields
 */
void t_javame_generator::generate_serialize_container(ofstream& out, t_type* ttype, string prefix) {
  scope_up(out);

  if (ttype->is_map()) {
    indent(out) << "oprot.writeMapBegin(new TMap(" << type_to_enum(((t_map*)ttype)->get_key_type())
                << ", " << type_to_enum(((t_map*)ttype)->get_val_type()) << ", " << prefix
                << ".size()));" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "oprot.writeSetBegin(new TSet(" << type_to_enum(((t_set*)ttype)->get_elem_type())
                << ", " << prefix << ".size()));" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "oprot.writeListBegin(new TList("
                << type_to_enum(((t_list*)ttype)->get_elem_type()) << ", " << prefix << ".size()));"
                << endl;
  }

  string iter = tmp("_iter");
  if (ttype->is_map()) {
    string enumer = iter + "_enum";
    string key_type = type_name(((t_map*)ttype)->get_key_type(), true, false);
    indent(out) << "for (Enumeration " << enumer << " = " << prefix << ".keys(); " << enumer
                << ".hasMoreElements(); ) ";
    scope_up(out);
    indent(out) << key_type << " " << iter << " = (" << key_type << ")" << enumer
                << ".nextElement();" << endl;
  } else if (ttype->is_set()) {
    string enumer = iter + "_enum";
    string ele_type = type_name(((t_list*)ttype)->get_elem_type(), true);
    indent(out) << "for (Enumeration " << enumer << " = " << prefix << ".keys(); " << enumer
                << ".hasMoreElements(); ) ";
    scope_up(out);
    indent(out) << ele_type << " " << iter << " = (" << ele_type << ")" << enumer
                << ".nextElement();" << endl;
  } else if (ttype->is_list()) {
    string enumer = iter + "_enum";
    indent(out) << "for (Enumeration " << enumer << " = " << prefix << ".elements(); " << enumer
                << ".hasMoreElements(); ) ";
    scope_up(out);
    string ele_type = type_name(((t_list*)ttype)->get_elem_type(), true);
    indent(out) << ele_type << " " << iter << " = (" << ele_type << ")" << enumer
                << ".nextElement();" << endl;
  }

  if (ttype->is_map()) {
    generate_serialize_map_element(out, (t_map*)ttype, iter, prefix);
  } else if (ttype->is_set()) {
    generate_serialize_set_element(out, (t_set*)ttype, iter);
  } else if (ttype->is_list()) {
    generate_serialize_list_element(out, (t_list*)ttype, iter);
  }
  scope_down(out);

  if (ttype->is_map()) {
    indent(out) << "oprot.writeMapEnd();" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "oprot.writeSetEnd();" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "oprot.writeListEnd();" << endl;
  }

  scope_down(out);
}

/**
 * Serializes the members of a map.
 */
void t_javame_generator::generate_serialize_map_element(ofstream& out,
                                                        t_map* tmap,
                                                        string iter,
                                                        string map) {
  t_field kfield(tmap->get_key_type(), iter);
  generate_serialize_field(out, &kfield, "");
  string val_type = type_name(tmap->get_val_type(), true, false);
  t_field vfield(tmap->get_val_type(), "((" + val_type + ")" + map + ".get(" + iter + "))");
  generate_serialize_field(out, &vfield, "");
}

/**
 * Serializes the members of a set.
 */
void t_javame_generator::generate_serialize_set_element(ofstream& out, t_set* tset, string iter) {
  t_field efield(tset->get_elem_type(), iter);
  generate_serialize_field(out, &efield, "");
}

/**
 * Serializes the members of a list.
 */
void t_javame_generator::generate_serialize_list_element(ofstream& out,
                                                         t_list* tlist,
                                                         string iter) {
  t_field efield(tlist->get_elem_type(), iter);
  generate_serialize_field(out, &efield, "");
}

/**
 * Returns a Java type name
 *
 * @param ttype The type
 * @param container Is the type going inside a container?
 * @return Java type name, i.e. Vector
 */
string t_javame_generator::type_name(t_type* ttype,
                                     bool in_container,
                                     bool in_init,
                                     bool skip_generic) {
  (void)in_init;
  (void)skip_generic;
  // In Java typedefs are just resolved to their real type
  ttype = get_true_type(ttype);
  string prefix;

  if (ttype->is_base_type()) {
    return base_type_name((t_base_type*)ttype, in_container);
  } else if (ttype->is_map()) {
    return "Hashtable";
  } else if (ttype->is_set()) {
    return "Hashtable";
  } else if (ttype->is_list()) {
    return "Vector";
  }

  // Check for namespacing
  t_program* program = ttype->get_program();
  if (program != NULL && program != program_) {
    string package = program->get_namespace("java");
    if (!package.empty()) {
      return package + "." + ttype->get_name();
    }
  }

  return ttype->get_name();
}

/**
 * Returns the C++ type that corresponds to the thrift type.
 *
 * @param tbase The base type
 * @param container Is it going in a Java container?
 */
string t_javame_generator::base_type_name(t_base_type* type, bool in_container) {
  t_base_type::t_base tbase = type->get_base();

  switch (tbase) {
  case t_base_type::TYPE_VOID:
    return "void";
  case t_base_type::TYPE_STRING:
    if (!type->is_binary()) {
      return "String";
    } else {
      return "byte[]";
    }
  case t_base_type::TYPE_BOOL:
    return (in_container ? "Boolean" : "boolean");
  case t_base_type::TYPE_I8:
    return (in_container ? "Byte" : "byte");
  case t_base_type::TYPE_I16:
    return (in_container ? "Short" : "short");
  case t_base_type::TYPE_I32:
    return (in_container ? "Integer" : "int");
  case t_base_type::TYPE_I64:
    return (in_container ? "Long" : "long");
  case t_base_type::TYPE_DOUBLE:
    return (in_container ? "Double" : "double");
  default:
    throw "compiler error: no Java name for base type " + t_base_type::t_base_name(tbase);
  }
}

/**
 * Declares a field, which may include initialization as necessary.
 *
 * @param ttype The type
 */
string t_javame_generator::declare_field(t_field* tfield, bool init) {
  // TODO(mcslee): do we ever need to initialize the field?
  string result = type_name(tfield->get_type()) + " " + tfield->get_name();
  if (init) {
    t_type* ttype = get_true_type(tfield->get_type());
    if (ttype->is_base_type() && tfield->get_value() != NULL) {
      ofstream dummy;
      result += " = " + render_const_value(dummy, tfield->get_name(), ttype, tfield->get_value());
    } else if (ttype->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)ttype)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        throw "NO T_VOID CONSTRUCT";
      case t_base_type::TYPE_STRING:
        result += " = null";
        break;
      case t_base_type::TYPE_BOOL:
        result += " = false";
        break;
      case t_base_type::TYPE_I8:
      case t_base_type::TYPE_I16:
      case t_base_type::TYPE_I32:
      case t_base_type::TYPE_I64:
        result += " = 0";
        break;
      case t_base_type::TYPE_DOUBLE:
        result += " = (double)0";
        break;
      }

    } else if (ttype->is_enum()) {
      result += " = 0";
    } else if (ttype->is_container()) {
      result += " = new " + type_name(ttype, false, true) + "()";
    } else {
      result += " = new " + type_name(ttype, false, true) + "()";
      ;
    }
  }
  return result + ";";
}

/**
 * Renders a function signature of the form 'type name(args)'
 *
 * @param tfunction Function definition
 * @return String of rendered function definition
 */
string t_javame_generator::function_signature(t_function* tfunction, string prefix) {
  t_type* ttype = tfunction->get_returntype();
  std::string result = type_name(ttype) + " " + prefix + tfunction->get_name() + "("
                       + argument_list(tfunction->get_arglist()) + ") throws ";
  t_struct* xs = tfunction->get_xceptions();
  const std::vector<t_field*>& xceptions = xs->get_members();
  vector<t_field*>::const_iterator x_iter;
  for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
    result += type_name((*x_iter)->get_type(), false, false) + ", ";
  }
  result += "TException";
  return result;
}

/**
 * Renders a comma separated field list, with type names
 */
string t_javame_generator::argument_list(t_struct* tstruct, bool include_types) {
  string result = "";

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  bool first = true;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (first) {
      first = false;
    } else {
      result += ", ";
    }
    if (include_types) {
      result += type_name((*f_iter)->get_type()) + " ";
    }
    result += (*f_iter)->get_name();
  }
  return result;
}

/**
 * Converts the parse type to a C++ enum string for the given type.
 */
string t_javame_generator::type_to_enum(t_type* type) {
  type = get_true_type(type);

  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_VOID:
      throw "NO T_VOID CONSTRUCT";
    case t_base_type::TYPE_STRING:
      return "TType.STRING";
    case t_base_type::TYPE_BOOL:
      return "TType.BOOL";
    case t_base_type::TYPE_I8:
      return "TType.BYTE";
    case t_base_type::TYPE_I16:
      return "TType.I16";
    case t_base_type::TYPE_I32:
      return "TType.I32";
    case t_base_type::TYPE_I64:
      return "TType.I64";
    case t_base_type::TYPE_DOUBLE:
      return "TType.DOUBLE";
    }
  } else if (type->is_enum()) {
    return "TType.I32";
  } else if (type->is_struct() || type->is_xception()) {
    return "TType.STRUCT";
  } else if (type->is_map()) {
    return "TType.MAP";
  } else if (type->is_set()) {
    return "TType.SET";
  } else if (type->is_list()) {
    return "TType.LIST";
  }

  throw "INVALID TYPE IN type_to_enum: " + type->get_name();
}

/**
 * Applies the correct style to a string based on the value of nocamel_style_
 */
std::string t_javame_generator::get_cap_name(std::string name) {
  name[0] = toupper(name[0]);
  return name;
}

string t_javame_generator::constant_name(string name) {
  string constant_name;

  bool is_first = true;
  bool was_previous_char_upper = false;
  for (string::iterator iter = name.begin(); iter != name.end(); ++iter) {
    string::value_type character = (*iter);

    bool is_upper = isupper(character);

    if (is_upper && !is_first && !was_previous_char_upper) {
      constant_name += '_';
    }
    constant_name += toupper(character);

    is_first = false;
    was_previous_char_upper = is_upper;
  }

  return constant_name;
}

void t_javame_generator::generate_java_docstring_comment(ofstream& out, string contents) {
  generate_docstring_comment(out, "/**\n", " * ", contents, " */\n");
}

void t_javame_generator::generate_java_doc(ofstream& out, t_field* field) {
  if (field->get_type()->is_enum()) {
    string combined_message = field->get_doc() + "\n@see " + get_enum_class_name(field->get_type());
    generate_java_docstring_comment(out, combined_message);
  } else {
    generate_java_doc(out, (t_doc*)field);
  }
}

/**
 * Emits a JavaDoc comment if the provided object has a doc in Thrift
 */
void t_javame_generator::generate_java_doc(ofstream& out, t_doc* tdoc) {
  if (tdoc->has_doc()) {
    generate_java_docstring_comment(out, tdoc->get_doc());
  }
}

/**
 * Emits a JavaDoc comment if the provided function object has a doc in Thrift
 */
void t_javame_generator::generate_java_doc(ofstream& out, t_function* tfunction) {
  if (tfunction->has_doc()) {
    stringstream ss;
    ss << tfunction->get_doc();
    const vector<t_field*>& fields = tfunction->get_arglist()->get_members();
    vector<t_field*>::const_iterator p_iter;
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

void t_javame_generator::generate_deep_copy_container(ofstream& out,
                                                      std::string source_name_p1,
                                                      std::string source_name_p2,
                                                      std::string result_name,
                                                      t_type* type) {

  t_container* container = (t_container*)type;
  std::string source_name;
  if (source_name_p2 == "")
    source_name = source_name_p1;
  else
    source_name = source_name_p1 + "." + source_name_p2;

  indent(out) << type_name(type, true, false) << " " << result_name << " = new "
              << type_name(container, false, true) << "();" << endl;

  std::string iterator_element_name = source_name_p1 + "_element";
  std::string enumeration_name = source_name_p1 + "_enum";
  std::string result_element_name = result_name + "_copy";

  if (container->is_map()) {
    t_type* key_type = ((t_map*)container)->get_key_type();
    t_type* val_type = ((t_map*)container)->get_val_type();

    indent(out) << "for (Enumeration " << enumeration_name << " = " << source_name << ".keys(); "
                << enumeration_name << ".hasMoreElements(); ) {" << endl;
    indent_up();

    out << endl;

    indent(out) << type_name(key_type, true, false) << " " << iterator_element_name << "_key = ("
                << type_name(key_type, true, false) << ")" << enumeration_name << ".nextElement();"
                << endl;
    indent(out) << type_name(val_type, true, false) << " " << iterator_element_name << "_value = ("
                << type_name(val_type, true, false) << ")" << source_name << ".get("
                << iterator_element_name << "_key);" << endl;

    out << endl;

    if (key_type->is_container()) {
      generate_deep_copy_container(out,
                                   iterator_element_name + "_key",
                                   "",
                                   result_element_name + "_key",
                                   key_type);
    } else {
      indent(out) << type_name(key_type, true, false) << " " << result_element_name << "_key = ";
      generate_deep_copy_non_container(out,
                                       iterator_element_name + "_key",
                                       result_element_name + "_key",
                                       key_type);
      out << ";" << endl;
    }

    out << endl;

    if (val_type->is_container()) {
      generate_deep_copy_container(out,
                                   iterator_element_name + "_value",
                                   "",
                                   result_element_name + "_value",
                                   val_type);
    } else {
      indent(out) << type_name(val_type, true, false) << " " << result_element_name << "_value = ";
      generate_deep_copy_non_container(out,
                                       iterator_element_name + "_value",
                                       result_element_name + "_value",
                                       val_type);
      out << ";" << endl;
    }

    out << endl;

    indent(out) << result_name << ".put(" << result_element_name << "_key, " << result_element_name
                << "_value);" << endl;

    indent_down();
    indent(out) << "}" << endl;

  } else {
    t_type* elem_type;

    if (container->is_set()) {
      elem_type = ((t_set*)container)->get_elem_type();
    } else {
      elem_type = ((t_list*)container)->get_elem_type();
    }

    indent(out) << "for (Enumeration " << enumeration_name << " = " << source_name
                << ".elements(); " << enumeration_name << ".hasMoreElements(); ) {" << endl;
    indent_up();
    indent(out) << type_name(elem_type, true, false) << " " << iterator_element_name << " = ("
                << type_name(elem_type, true, false) << ")" << enumeration_name << ".nextElement();"
                << endl;
    if (elem_type->is_container()) {
      // recursive deep copy
      generate_deep_copy_container(out, iterator_element_name, "", result_element_name, elem_type);
      if (elem_type->is_list()) {
        indent(out) << result_name << ".addElement(" << result_element_name << ");" << endl;
      } else {
        indent(out) << result_name << ".put(" << result_element_name << ", " << result_element_name
                    << ");" << endl;
      }
    } else {
      // iterative copy
      if (((t_base_type*)elem_type)->is_binary()) {
        indent(out) << type_name(elem_type, true, false) << " temp_binary_element = ";
        generate_deep_copy_non_container(out,
                                         iterator_element_name,
                                         "temp_binary_element",
                                         elem_type);
        out << ";" << endl;
        if (elem_type->is_list()) {
          indent(out) << result_name << ".addElement(temp_binary_element);" << endl;
        } else {
          indent(out) << result_name << ".put(temp_binary_element, temp_binary_element);" << endl;
        }
      } else {
        indent(out) << result_name << ".addElement(";
        generate_deep_copy_non_container(out, iterator_element_name, result_name, elem_type);
        out << ");" << endl;
      }
    }

    indent_down();

    indent(out) << "}" << endl;
  }
}

void t_javame_generator::generate_deep_copy_non_container(ofstream& out,
                                                          std::string source_name,
                                                          std::string dest_name,
                                                          t_type* type) {
  if (type->is_base_type() || type->is_enum() || type->is_typedef()) {
    // binary fields need to be copied with System.arraycopy
    if (((t_base_type*)type)->is_binary()) {
      out << "new byte[" << source_name << ".length];" << endl;
      indent(out) << "System.arraycopy(" << source_name << ", 0, " << dest_name << ", 0, "
                  << source_name << ".length)";
    }
    // everything else can be copied directly
    else
      out << source_name;
  } else {
    out << "new " << type_name(type, true, true) << "(" << source_name << ")";
  }
}

std::string t_javame_generator::generate_isset_check(t_field* field) {
  return generate_isset_check(field->get_name());
}

std::string t_javame_generator::isset_field_id(t_field* field) {
  return "__" + upcase_string(field->get_name() + "_isset_id");
}

std::string t_javame_generator::generate_isset_check(std::string field_name) {
  return "is" + get_cap_name("set") + get_cap_name(field_name) + "()";
}

void t_javame_generator::generate_isset_set(ofstream& out, t_field* field) {
  if (!type_can_be_null(field->get_type())) {
    indent(out) << "set" << get_cap_name(field->get_name()) << get_cap_name("isSet") << "(true);"
                << endl;
  }
}

std::string t_javame_generator::get_enum_class_name(t_type* type) {
  string package = "";
  t_program* program = type->get_program();
  if (program != NULL && program != program_) {
    package = program->get_namespace("java") + ".";
  }
  return package + type->get_name();
}

void t_javame_generator::generate_struct_desc(ofstream& out, t_struct* tstruct) {
  indent(out) << "private static final TStruct STRUCT_DESC = new TStruct(\"" << tstruct->get_name()
              << "\");" << endl;
}

void t_javame_generator::generate_field_descs(ofstream& out, t_struct* tstruct) {
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    indent(out) << "private static final TField " << constant_name((*m_iter)->get_name())
                << "_FIELD_DESC = new TField(\"" << (*m_iter)->get_name() << "\", "
                << type_to_enum((*m_iter)->get_type()) << ", "
                << "(short)" << (*m_iter)->get_key() << ");" << endl;
  }
}

bool t_javame_generator::has_bit_vector(t_struct* tstruct) {
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    if (!type_can_be_null(get_true_type((*m_iter)->get_type()))) {
      return true;
    }
  }
  return false;
}

void t_javame_generator::generate_java_struct_clear(std::ofstream& out, t_struct* tstruct) {
  indent(out) << "public void clear() {" << endl;

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  indent_up();
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_type* t = get_true_type((*m_iter)->get_type());
    if ((*m_iter)->get_value() != NULL) {
      print_const_value(out,
                        "this." + (*m_iter)->get_name(),
                        t,
                        (*m_iter)->get_value(),
                        true,
                        true);
    } else {
      if (type_can_be_null(t)) {
        indent(out) << "this." << (*m_iter)->get_name() << " = null;" << endl;
      } else {
        // must be a base type
        // means it also needs to be explicitly unset
        indent(out) << "set" << get_cap_name((*m_iter)->get_name()) << get_cap_name("isSet")
                    << "(false);" << endl;
        switch (((t_base_type*)t)->get_base()) {
        case t_base_type::TYPE_I8:
        case t_base_type::TYPE_I16:
        case t_base_type::TYPE_I32:
        case t_base_type::TYPE_I64:
          indent(out) << "this." << (*m_iter)->get_name() << " = 0;" << endl;
          break;
        case t_base_type::TYPE_DOUBLE:
          indent(out) << "this." << (*m_iter)->get_name() << " = 0.0;" << endl;
          break;
        case t_base_type::TYPE_BOOL:
          indent(out) << "this." << (*m_iter)->get_name() << " = false;" << endl;
          break;
        default: // prevent gcc compiler warning
          break;
        }
      }
    }
  }
  indent_down();

  indent(out) << "}" << endl << endl;
}

THRIFT_REGISTER_GENERATOR(javame, "Java ME", "")
