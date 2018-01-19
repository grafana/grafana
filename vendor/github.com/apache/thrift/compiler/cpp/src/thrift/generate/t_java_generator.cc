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

#include <cassert>
#include <ctime>

#include <sstream>
#include <string>
#include <fstream>
#include <iomanip>
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
using std::setfill;
using std::setw;
using std::string;
using std::stringstream;
using std::vector;

static const string endl = "\n"; // avoid ostream << std::endl flushes

/**
 * Java code generator.
 *
 */
class t_java_generator : public t_oop_generator {
public:
  t_java_generator(t_program* program,
                   const std::map<std::string, std::string>& parsed_options,
                   const std::string& option_string)
    : t_oop_generator(program) {
    (void)option_string;
    std::map<std::string, std::string>::const_iterator iter;

    bean_style_ = false;
    android_style_ = false;
    private_members_ = false;
    nocamel_style_ = false;
    fullcamel_style_ = false;
    android_legacy_ = false;
    sorted_containers_ = false;
    java5_ = false;
    reuse_objects_ = false;
    use_option_type_ = false;
    undated_generated_annotations_  = false;
    suppress_generated_annotations_ = false;
    for( iter = parsed_options.begin(); iter != parsed_options.end(); ++iter) {
      if( iter->first.compare("beans") == 0) {
        bean_style_ = true;
      } else if( iter->first.compare("android") == 0) {
        android_style_ = true;
      } else if( iter->first.compare("private-members") == 0) {
        private_members_ = true;
      } else if( iter->first.compare("nocamel") == 0) {
        nocamel_style_ = true;
      } else if( iter->first.compare("fullcamel") == 0) {
        fullcamel_style_ = true;
      } else if( iter->first.compare("android_legacy") == 0) {
        android_legacy_ = true;
      } else if( iter->first.compare("sorted_containers") == 0) {
        sorted_containers_ = true;
      } else if( iter->first.compare("java5") == 0) {
        java5_ = true;
      } else if( iter->first.compare("reuse-objects") == 0) {
        reuse_objects_ = true;
      } else if( iter->first.compare("option_type") == 0) {
        use_option_type_ = true;
      } else if( iter->first.compare("generated_annotations") == 0) {
        if( iter->second.compare("undated") == 0) {
          undated_generated_annotations_  = true;
        } else if(iter->second.compare("suppress") == 0) {
          suppress_generated_annotations_ = true;
        } else {
          throw "unknown option java:" + iter->first + "=" + iter->second;
        }
      } else {
        throw "unknown option java:" + iter->first;
      }
    }

    if (java5_) {
      android_legacy_ = true;
    }

    out_dir_base_ = (bean_style_ ? "gen-javabean" : "gen-java");
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
  std::string render_const_value(std::ofstream& out, t_type* type, t_const_value* value);

  /**
   * Service-level generation functions
   */

  void generate_java_struct(t_struct* tstruct, bool is_exception);

  void generate_java_struct_definition(std::ofstream& out,
                                       t_struct* tstruct,
                                       bool is_xception = false,
                                       bool in_class = false,
                                       bool is_result = false);
  void generate_java_struct_parcelable(std::ofstream& out, t_struct* tstruct);
  void generate_java_struct_equality(std::ofstream& out, t_struct* tstruct);
  void generate_java_struct_compare_to(std::ofstream& out, t_struct* tstruct);
  void generate_java_struct_reader(std::ofstream& out, t_struct* tstruct);
  void generate_java_validator(std::ofstream& out, t_struct* tstruct);
  void generate_java_struct_result_writer(std::ofstream& out, t_struct* tstruct);
  void generate_java_struct_writer(std::ofstream& out, t_struct* tstruct);
  void generate_java_struct_tostring(std::ofstream& out, t_struct* tstruct);
  void generate_java_struct_clear(std::ofstream& out, t_struct* tstruct);
  void generate_java_struct_write_object(std::ofstream& out, t_struct* tstruct);
  void generate_java_struct_read_object(std::ofstream& out, t_struct* tstruct);
  void generate_java_meta_data_map(std::ofstream& out, t_struct* tstruct);
  void generate_field_value_meta_data(std::ofstream& out, t_type* type);
  std::string get_java_type_string(t_type* type);
  void generate_java_struct_field_by_id(ofstream& out, t_struct* tstruct);
  void generate_reflection_setters(std::ostringstream& out,
                                   t_type* type,
                                   std::string field_name,
                                   std::string cap_name);
  void generate_reflection_getters(std::ostringstream& out,
                                   t_type* type,
                                   std::string field_name,
                                   std::string cap_name);
  void generate_generic_field_getters_setters(std::ofstream& out, t_struct* tstruct);
  void generate_generic_isset_method(std::ofstream& out, t_struct* tstruct);
  void generate_java_bean_boilerplate(std::ofstream& out, t_struct* tstruct);

  void generate_function_helpers(t_function* tfunction);
  std::string as_camel_case(std::string name, bool ucfirst = true);
  std::string get_rpc_method_name(std::string name);
  std::string get_cap_name(std::string name);
  std::string generate_isset_check(t_field* field);
  std::string generate_isset_check(std::string field);
  void generate_isset_set(ofstream& out, t_field* field, std::string prefix);
  std::string isset_field_id(t_field* field);

  void generate_service_interface(t_service* tservice);
  void generate_service_async_interface(t_service* tservice);
  void generate_service_helpers(t_service* tservice);
  void generate_service_client(t_service* tservice);
  void generate_service_async_client(t_service* tservice);
  void generate_service_server(t_service* tservice);
  void generate_service_async_server(t_service* tservice);
  void generate_process_function(t_service* tservice, t_function* tfunction);
  void generate_process_async_function(t_service* tservice, t_function* tfunction);

  void generate_java_union(t_struct* tstruct);
  void generate_union_constructor(ofstream& out, t_struct* tstruct);
  void generate_union_getters_and_setters(ofstream& out, t_struct* tstruct);
  void generate_union_is_set_methods(ofstream& out, t_struct* tstruct);
  void generate_union_abstract_methods(ofstream& out, t_struct* tstruct);
  void generate_check_type(ofstream& out, t_struct* tstruct);
  void generate_standard_scheme_read_value(ofstream& out, t_struct* tstruct);
  void generate_standard_scheme_write_value(ofstream& out, t_struct* tstruct);
  void generate_tuple_scheme_read_value(ofstream& out, t_struct* tstruct);
  void generate_tuple_scheme_write_value(ofstream& out, t_struct* tstruct);
  void generate_get_field_desc(ofstream& out, t_struct* tstruct);
  void generate_get_struct_desc(ofstream& out, t_struct* tstruct);
  void generate_get_field_name(ofstream& out, t_struct* tstruct);

  void generate_union_comparisons(ofstream& out, t_struct* tstruct);
  void generate_union_hashcode(ofstream& out, t_struct* tstruct);

  void generate_scheme_map(ofstream& out, t_struct* tstruct);
  void generate_standard_writer(ofstream& out, t_struct* tstruct, bool is_result);
  void generate_standard_reader(ofstream& out, t_struct* tstruct);
  void generate_java_struct_standard_scheme(ofstream& out, t_struct* tstruct, bool is_result);

  void generate_java_struct_tuple_scheme(ofstream& out, t_struct* tstruct);
  void generate_java_struct_tuple_reader(ofstream& out, t_struct* tstruct);
  void generate_java_struct_tuple_writer(ofstream& out, t_struct* tstruct);

  void generate_java_scheme_lookup(ofstream& out);

  void generate_javax_generated_annotation(ofstream& out);
  /**
   * Serialization constructs
   */

  void generate_deserialize_field(std::ofstream& out,
                                  t_field* tfield,
                                  std::string prefix = "",
                                  bool has_metadata = true);

  void generate_deserialize_struct(std::ofstream& out, t_struct* tstruct, std::string prefix = "");

  void generate_deserialize_container(std::ofstream& out,
                                      t_type* ttype,
                                      std::string prefix = "",
                                      bool has_metadata = true);

  void generate_deserialize_set_element(std::ofstream& out,
                                        t_set* tset,
                                        std::string prefix = "",
                                        std::string obj = "",
                                        bool has_metadata = true);

  void generate_deserialize_map_element(std::ofstream& out,
                                        t_map* tmap,
                                        std::string prefix = "",
                                        std::string obj = "",
                                        bool has_metadata = true);

  void generate_deserialize_list_element(std::ofstream& out,
                                         t_list* tlist,
                                         std::string prefix = "",
                                         std::string obj = "",
                                         bool has_metadata = true);

  void generate_serialize_field(std::ofstream& out,
                                t_field* tfield,
                                std::string prefix = "",
                                bool has_metadata = true);

  void generate_serialize_struct(std::ofstream& out, t_struct* tstruct, std::string prefix = "");

  void generate_serialize_container(std::ofstream& out,
                                    t_type* ttype,
                                    std::string prefix = "",
                                    bool has_metadata = true);

  void generate_serialize_map_element(std::ofstream& out,
                                      t_map* tmap,
                                      std::string iter,
                                      std::string map,
                                      bool has_metadata = true);

  void generate_serialize_set_element(std::ofstream& out,
                                      t_set* tmap,
                                      std::string iter,
                                      bool has_metadata = true);

  void generate_serialize_list_element(std::ofstream& out,
                                       t_list* tlist,
                                       std::string iter,
                                       bool has_metadata = true);

  void generate_deep_copy_container(std::ofstream& out,
                                    std::string source_name_p1,
                                    std::string source_name_p2,
                                    std::string result_name,
                                    t_type* type);
  void generate_deep_copy_non_container(std::ofstream& out,
                                        std::string source_name,
                                        std::string dest_name,
                                        t_type* type);

  enum isset_type { ISSET_NONE, ISSET_PRIMITIVE, ISSET_BITSET };
  isset_type needs_isset(t_struct* tstruct, std::string* outPrimitiveType = NULL);

  /**
   * Helper rendering functions
   */

  std::string java_package();
  std::string java_suppressions();
  std::string type_name(t_type* ttype,
                        bool in_container = false,
                        bool in_init = false,
                        bool skip_generic = false,
                        bool force_namespace = false);
  std::string base_type_name(t_base_type* tbase, bool in_container = false);
  std::string declare_field(t_field* tfield, bool init = false, bool comment = false);
  std::string function_signature(t_function* tfunction, std::string prefix = "");
  std::string function_signature_async(t_function* tfunction,
                                       bool use_base_method = false,
                                       std::string prefix = "");
  std::string argument_list(t_struct* tstruct, bool include_types = true);
  std::string async_function_call_arglist(t_function* tfunc,
                                          bool use_base_method = true,
                                          bool include_types = true);
  std::string async_argument_list(t_function* tfunct,
                                  t_struct* tstruct,
                                  t_type* ttype,
                                  bool include_types = false);
  std::string type_to_enum(t_type* ttype);
  void generate_struct_desc(ofstream& out, t_struct* tstruct);
  void generate_field_descs(ofstream& out, t_struct* tstruct);
  void generate_field_name_constants(ofstream& out, t_struct* tstruct);

  std::string make_valid_java_filename(std::string const& fromName);
  std::string make_valid_java_identifier(std::string const& fromName);

  bool type_can_be_null(t_type* ttype) {
    ttype = get_true_type(ttype);

    return ttype->is_container() || ttype->is_struct() || ttype->is_xception() || ttype->is_string()
           || ttype->is_enum();
  }

  bool is_deprecated(const std::map<std::string, std::string>& annotations) {
    return annotations.find("deprecated") != annotations.end();
  }

  std::string constant_name(std::string name);

private:
  /**
   * File streams
   */

  std::string package_name_;
  std::ofstream f_service_;
  std::string package_dir_;

  bool bean_style_;
  bool android_style_;
  bool private_members_;
  bool nocamel_style_;
  bool fullcamel_style_;
  bool android_legacy_;
  bool java5_;
  bool sorted_containers_;
  bool reuse_objects_;
  bool use_option_type_;
  bool undated_generated_annotations_;
  bool suppress_generated_annotations_;

};

/**
 * Prepares for file generation by opening up the necessary file output
 * streams.
 *
 * @param tprogram The program to generate
 */
void t_java_generator::init_generator() {
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
string t_java_generator::java_package() {
  if (!package_name_.empty()) {
    return string("package ") + package_name_ + ";\n\n";
  }
  return "";
}

string t_java_generator::java_suppressions() {
  return "@SuppressWarnings({\"cast\", \"rawtypes\", \"serial\", \"unchecked\", \"unused\"})\n";
}

/**
 * Nothing in Java
 */
void t_java_generator::close_generator() {
}

/**
 * Generates a typedef. This is not done in Java, since it does
 * not support arbitrary name replacements, and it'd be a wacky waste
 * of overhead to make wrapper classes.
 *
 * @param ttypedef The type definition
 */
void t_java_generator::generate_typedef(t_typedef* ttypedef) {
  (void)ttypedef;
}

/**
 * Enums are a class with a set of static constants.
 *
 * @param tenum The enumeration
 */
void t_java_generator::generate_enum(t_enum* tenum) {
  bool is_deprecated = this->is_deprecated(tenum->annotations_);
  // Make output file
  string f_enum_name = package_dir_ + "/" + make_valid_java_filename(tenum->get_name()) + ".java";
  ofstream f_enum;
  f_enum.open(f_enum_name.c_str());

  // Comment and package it
  f_enum << autogen_comment() << java_package() << endl;

  // Add java imports
  f_enum << string() + "import java.util.Map;\n" + "import java.util.HashMap;\n"
            + "import org.apache.thrift.TEnum;" << endl << endl;

  generate_java_doc(f_enum, tenum);
  if (is_deprecated) {
    indent(f_enum) << "@Deprecated" << endl;
  }
  indent(f_enum) << "public enum " << tenum->get_name() << " implements org.apache.thrift.TEnum ";
  scope_up(f_enum);

  vector<t_enum_value*> constants = tenum->get_constants();
  vector<t_enum_value*>::iterator c_iter;
  bool first = true;
  for (c_iter = constants.begin(); c_iter != constants.end(); ++c_iter) {
    int value = (*c_iter)->get_value();

    if (first) {
      first = false;
    } else {
      f_enum << "," << endl;
    }

    generate_java_doc(f_enum, *c_iter);
    if (this->is_deprecated((*c_iter)->annotations_)) {
      indent(f_enum) << "@Deprecated" << endl;
    }
    indent(f_enum) << (*c_iter)->get_name() << "(" << value << ")";
  }
  f_enum << ";" << endl << endl;

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
void t_java_generator::generate_consts(std::vector<t_const*> consts) {
  if (consts.empty()) {
    return;
  }

  string f_consts_name = package_dir_ + '/' + make_valid_java_filename(program_name_)
                         + "Constants.java";
  ofstream f_consts;
  f_consts.open(f_consts_name.c_str());

  // Print header
  f_consts << autogen_comment() << java_package() << java_suppressions();

  f_consts << "public class " << make_valid_java_identifier(program_name_) << "Constants {" << endl
           << endl;
  indent_up();
  vector<t_const*>::iterator c_iter;
  for (c_iter = consts.begin(); c_iter != consts.end(); ++c_iter) {
    generate_java_doc(f_consts, (*c_iter));
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
void t_java_generator::print_const_value(std::ofstream& out,
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
    string v2 = render_const_value(out, type, value);
    out << name << " = " << v2 << ";" << endl << endl;
  } else if (type->is_enum()) {
    out << name << " = " << render_const_value(out, type, value) << ";" << endl << endl;
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
      string val = render_const_value(out, field_type, v_iter->second);
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
      string key = render_const_value(out, ktype, v_iter->first);
      string val = render_const_value(out, vtype, v_iter->second);
      indent(out) << name << ".put(" << key << ", " << val << ");" << endl;
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
      string val = render_const_value(out, etype, *v_iter);
      indent(out) << name << ".add(" << val << ");" << endl;
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

string t_java_generator::render_const_value(ofstream& out, t_type* type, t_const_value* value) {
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
    std::string namespace_prefix = type->get_program()->get_namespace("java");
    if (namespace_prefix.length() > 0) {
      namespace_prefix += ".";
    }
    render << namespace_prefix << value->get_identifier_with_parent();
  } else {
    string t = tmp("tmp");
    print_const_value(out, t, type, value, true);
    render << t;
  }

  return render.str();
}

/**
 * Generates a struct definition for a thrift data type. This will be a org.apache.thrift.TBase
 * implementor.
 *
 * @param tstruct The struct definition
 */
void t_java_generator::generate_struct(t_struct* tstruct) {
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
void t_java_generator::generate_xception(t_struct* txception) {
  generate_java_struct(txception, true);
}

/**
 * Java struct definition.
 *
 * @param tstruct The struct definition
 */
void t_java_generator::generate_java_struct(t_struct* tstruct, bool is_exception) {
  // Make output file
  string f_struct_name = package_dir_ + "/" + make_valid_java_filename(tstruct->get_name())
                         + ".java";
  ofstream f_struct;
  f_struct.open(f_struct_name.c_str());

  f_struct << autogen_comment() << java_package() << java_suppressions();

  generate_java_struct_definition(f_struct, tstruct, is_exception);
  f_struct.close();
}

/**
 * Java union definition.
 *
 * @param tstruct The struct definition
 */
void t_java_generator::generate_java_union(t_struct* tstruct) {
  // Make output file
  string f_struct_name = package_dir_ + "/" + make_valid_java_filename(tstruct->get_name())
                         + ".java";
  ofstream f_struct;
  f_struct.open(f_struct_name.c_str());

  f_struct << autogen_comment() << java_package() << java_suppressions();

  generate_java_doc(f_struct, tstruct);

  bool is_final = (tstruct->annotations_.find("final") != tstruct->annotations_.end());
  bool is_deprecated = this->is_deprecated(tstruct->annotations_);

  if (is_deprecated) {
    indent(f_struct) << "@Deprecated" << endl;
  }
  indent(f_struct) << "public " << (is_final ? "final " : "") << "class " << tstruct->get_name()
                   << " extends org.apache.thrift.TUnion<" << tstruct->get_name() << ", "
                   << tstruct->get_name() << "._Fields> ";

  scope_up(f_struct);

  generate_struct_desc(f_struct, tstruct);
  generate_field_descs(f_struct, tstruct);

  f_struct << endl;

  generate_field_name_constants(f_struct, tstruct);

  f_struct << endl;

  generate_java_meta_data_map(f_struct, tstruct);

  generate_union_constructor(f_struct, tstruct);

  f_struct << endl;

  generate_union_abstract_methods(f_struct, tstruct);

  f_struct << endl;

  generate_java_struct_field_by_id(f_struct, tstruct);

  f_struct << endl;

  generate_union_getters_and_setters(f_struct, tstruct);

  f_struct << endl;

  generate_union_is_set_methods(f_struct, tstruct);

  f_struct << endl;

  generate_union_comparisons(f_struct, tstruct);

  f_struct << endl;

  generate_union_hashcode(f_struct, tstruct);

  f_struct << endl;

  generate_java_struct_write_object(f_struct, tstruct);

  f_struct << endl;

  generate_java_struct_read_object(f_struct, tstruct);

  f_struct << endl;

  scope_down(f_struct);

  f_struct.close();
}

void t_java_generator::generate_union_constructor(ofstream& out, t_struct* tstruct) {
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  indent(out) << "public " << type_name(tstruct) << "() {" << endl;
  indent_up();
  bool default_value = false;
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_type* type = get_true_type((*m_iter)->get_type());
    if ((*m_iter)->get_value() != NULL) {
      indent(out) << "super(_Fields." << constant_name((*m_iter)->get_name()) << ", "
                  << render_const_value(out, type, (*m_iter)->get_value()) << ");" << endl;
      default_value = true;
      break;
    }
  }
  if (default_value == false) {
    indent(out) << "super();" << endl;
  }
  indent_down();
  indent(out) << "}" << endl << endl;

  indent(out) << "public " << type_name(tstruct) << "(_Fields setField, java.lang.Object value) {" << endl;
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
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_type* type = (*m_iter)->get_type();
    indent(out) << "public static " << type_name(tstruct) << " " << (*m_iter)->get_name() << "("
                << type_name(type) << " value) {" << endl;
    indent(out) << "  " << type_name(tstruct) << " x = new " << type_name(tstruct) << "();" << endl;
    indent(out) << "  x.set" << get_cap_name((*m_iter)->get_name()) << "(value);" << endl;
    indent(out) << "  return x;" << endl;
    indent(out) << "}" << endl << endl;

    if (type->is_base_type() && ((t_base_type*)type)->is_binary()) {
      indent(out) << "public static " << type_name(tstruct) << " " << (*m_iter)->get_name()
                  << "(byte[] value) {" << endl;
      indent(out) << "  " << type_name(tstruct) << " x = new " << type_name(tstruct) << "();"
                  << endl;
      indent(out) << "  x.set" << get_cap_name((*m_iter)->get_name())
                  << "(java.nio.ByteBuffer.wrap(value.clone()));" << endl;
      indent(out) << "  return x;" << endl;
      indent(out) << "}" << endl << endl;
    }
  }
}

void t_java_generator::generate_union_getters_and_setters(ofstream& out, t_struct* tstruct) {
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
    t_type* type = field->get_type();
    std::string cap_name = get_cap_name(field->get_name());
    bool is_deprecated = this->is_deprecated(field->annotations_);

    generate_java_doc(out, field);
    if (type->is_base_type() && ((t_base_type*)type)->is_binary()) {
      if (is_deprecated) {
        indent(out) << "@Deprecated" << endl;
      }
      indent(out) << "public byte[] get" << cap_name << "() {" << endl;
      indent(out) << "  set" << cap_name << "(org.apache.thrift.TBaseHelper.rightSize(buffer"
                  << get_cap_name("for") << cap_name << "()));" << endl;
      indent(out) << "  java.nio.ByteBuffer b = buffer" << get_cap_name("for") << cap_name << "();" << endl;
      indent(out) << "  return b == null ? null : b.array();" << endl;
      indent(out) << "}" << endl;

      out << endl;

      indent(out) << "public java.nio.ByteBuffer buffer" << get_cap_name("for")
                  << get_cap_name(field->get_name()) << "() {" << endl;
      indent(out) << "  if (getSetField() == _Fields." << constant_name(field->get_name()) << ") {"
                  << endl;
      indent(out)
          << "    return org.apache.thrift.TBaseHelper.copyBinary((java.nio.ByteBuffer)getFieldValue());"
          << endl;
      indent(out) << "  } else {" << endl;
      indent(out) << "    throw new java.lang.RuntimeException(\"Cannot get field '" << field->get_name()
                  << "' because union is currently set to \" + getFieldDesc(getSetField()).name);"
                  << endl;
      indent(out) << "  }" << endl;
      indent(out) << "}" << endl;
    } else {
      if (is_deprecated) {
        indent(out) << "@Deprecated" << endl;
      }
      indent(out) << "public " << type_name(field->get_type()) << " get"
                  << get_cap_name(field->get_name()) << "() {" << endl;
      indent(out) << "  if (getSetField() == _Fields." << constant_name(field->get_name()) << ") {"
                  << endl;
      indent(out) << "    return (" << type_name(field->get_type(), true) << ")getFieldValue();"
                  << endl;
      indent(out) << "  } else {" << endl;
      indent(out) << "    throw new java.lang.RuntimeException(\"Cannot get field '" << field->get_name()
                  << "' because union is currently set to \" + getFieldDesc(getSetField()).name);"
                  << endl;
      indent(out) << "  }" << endl;
      indent(out) << "}" << endl;
    }

    out << endl;

    generate_java_doc(out, field);
    if (type->is_base_type() && ((t_base_type*)type)->is_binary()) {
      if (is_deprecated) {
        indent(out) << "@Deprecated" << endl;
      }
      indent(out) << "public void set" << get_cap_name(field->get_name()) << "(byte[] value) {"
                  << endl;
      indent(out) << "  set" << get_cap_name(field->get_name())
                  << "(java.nio.ByteBuffer.wrap(value.clone()));" << endl;
      indent(out) << "}" << endl;

      out << endl;
    }
    if (is_deprecated) {
      indent(out) << "@Deprecated" << endl;
    }
    indent(out) << "public void set" << get_cap_name(field->get_name()) << "("
                << type_name(field->get_type()) << " value) {" << endl;
    if (type_can_be_null(field->get_type())) {
      indent(out) << "  if (value == null) throw new java.lang.NullPointerException();" << endl;
    }
    indent(out) << "  setField_ = _Fields." << constant_name(field->get_name()) << ";" << endl;
    indent(out) << "  value_ = value;" << endl;
    indent(out) << "}" << endl;
  }
}

void t_java_generator::generate_union_is_set_methods(ofstream& out, t_struct* tstruct) {
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  bool first = true;
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    if (first) {
      first = false;
    } else {
      out << endl;
    }

    std::string field_name = (*m_iter)->get_name();

    indent(out) << "public boolean is" << get_cap_name("set") << get_cap_name(field_name) << "() {"
                << endl;
    indent_up();
    indent(out) << "return setField_ == _Fields." << constant_name(field_name) << ";" << endl;
    indent_down();
    indent(out) << "}" << endl << endl;
  }
}

void t_java_generator::generate_union_abstract_methods(ofstream& out, t_struct* tstruct) {
  generate_check_type(out, tstruct);
  out << endl;
  generate_standard_scheme_read_value(out, tstruct);
  out << endl;
  generate_standard_scheme_write_value(out, tstruct);
  out << endl;
  generate_tuple_scheme_read_value(out, tstruct);
  out << endl;
  generate_tuple_scheme_write_value(out, tstruct);
  out << endl;
  generate_get_field_desc(out, tstruct);
  out << endl;
  generate_get_struct_desc(out, tstruct);
  out << endl;
  indent(out) << "@Override" << endl;
  indent(out) << "protected _Fields enumForId(short id) {" << endl;
  indent(out) << "  return _Fields.findByThriftIdOrThrow(id);" << endl;
  indent(out) << "}" << endl;
}

void t_java_generator::generate_check_type(ofstream& out, t_struct* tstruct) {
  indent(out) << "@Override" << endl;
  indent(out)
      << "protected void checkType(_Fields setField, java.lang.Object value) throws java.lang.ClassCastException {"
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
    indent(out) << "  throw new java.lang.ClassCastException(\"Was expecting value of type "
                << type_name(field->get_type(), true, false) << " for field '" << field->get_name()
                << "', but got \" + value.getClass().getSimpleName());" << endl;
    // do the real check here
  }

  indent(out) << "default:" << endl;
  indent(out) << "  throw new java.lang.IllegalArgumentException(\"Unknown field id \" + setField);" << endl;

  indent_down();
  indent(out) << "}" << endl;

  indent_down();
  indent(out) << "}" << endl;
}

void t_java_generator::generate_standard_scheme_read_value(ofstream& out, t_struct* tstruct) {
  indent(out) << "@Override" << endl;
  indent(out) << "protected java.lang.Object standardSchemeReadValue(org.apache.thrift.protocol.TProtocol "
                 "iprot, org.apache.thrift.protocol.TField field) throws "
                 "org.apache.thrift.TException {" << endl;

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
    indent(out) << "  org.apache.thrift.protocol.TProtocolUtil.skip(iprot, field.type);" << endl;
    indent(out) << "  return null;" << endl;
    indent(out) << "}" << endl;
    indent_down();
  }

  indent(out) << "default:" << endl;
  indent(out) << "  throw new java.lang.IllegalStateException(\"setField wasn't null, but didn't match any "
                 "of the case statements!\");" << endl;

  indent_down();
  indent(out) << "}" << endl;

  indent_down();
  indent(out) << "} else {" << endl;
  indent_up();
  indent(out) << "org.apache.thrift.protocol.TProtocolUtil.skip(iprot, field.type);" << endl;
  indent(out) << "return null;" << endl;
  indent_down();
  indent(out) << "}" << endl;

  indent_down();
  indent(out) << "}" << endl;
}

void t_java_generator::generate_standard_scheme_write_value(ofstream& out, t_struct* tstruct) {
  indent(out) << "@Override" << endl;
  indent(out) << "protected void standardSchemeWriteValue(org.apache.thrift.protocol.TProtocol "
                 "oprot) throws org.apache.thrift.TException {" << endl;

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
  indent(out) << "  throw new java.lang.IllegalStateException(\"Cannot write union with unknown field \" + "
                 "setField_);" << endl;

  indent_down();
  indent(out) << "}" << endl;

  indent_down();

  indent(out) << "}" << endl;
}

void t_java_generator::generate_tuple_scheme_read_value(ofstream& out, t_struct* tstruct) {
  indent(out) << "@Override" << endl;
  indent(out) << "protected java.lang.Object tupleSchemeReadValue(org.apache.thrift.protocol.TProtocol "
                 "iprot, short fieldID) throws org.apache.thrift.TException {" << endl;

  indent_up();

  indent(out) << "_Fields setField = _Fields.findByThriftId(fieldID);" << endl;
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
    indent(out) << type_name(field->get_type(), true, false) << " " << field->get_name() << ";"
                << endl;
    generate_deserialize_field(out, field, "");
    indent(out) << "return " << field->get_name() << ";" << endl;
    indent_down();
  }

  indent(out) << "default:" << endl;
  indent(out) << "  throw new java.lang.IllegalStateException(\"setField wasn't null, but didn't match any "
                 "of the case statements!\");" << endl;

  indent_down();
  indent(out) << "}" << endl;

  indent_down();
  indent(out) << "} else {" << endl;
  indent_up();
  indent(out) << "throw new org.apache.thrift.protocol.TProtocolException(\"Couldn't find a field with field id \" + fieldID);"
              << endl;
  indent_down();
  indent(out) << "}" << endl;
  indent_down();
  indent(out) << "}" << endl;
}

void t_java_generator::generate_tuple_scheme_write_value(ofstream& out, t_struct* tstruct) {
  indent(out) << "@Override" << endl;
  indent(out) << "protected void tupleSchemeWriteValue(org.apache.thrift.protocol.TProtocol oprot) "
                 "throws org.apache.thrift.TException {" << endl;

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
  indent(out) << "  throw new java.lang.IllegalStateException(\"Cannot write union with unknown field \" + "
                 "setField_);" << endl;

  indent_down();
  indent(out) << "}" << endl;

  indent_down();

  indent(out) << "}" << endl;
}

void t_java_generator::generate_get_field_desc(ofstream& out, t_struct* tstruct) {
  indent(out) << "@Override" << endl;
  indent(out) << "protected org.apache.thrift.protocol.TField getFieldDesc(_Fields setField) {"
              << endl;
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
  indent(out) << "  throw new java.lang.IllegalArgumentException(\"Unknown field id \" + setField);" << endl;

  indent_down();
  indent(out) << "}" << endl;

  indent_down();
  indent(out) << "}" << endl;
}

void t_java_generator::generate_get_struct_desc(ofstream& out, t_struct* tstruct) {
  (void)tstruct;
  indent(out) << "@Override" << endl;
  indent(out) << "protected org.apache.thrift.protocol.TStruct getStructDesc() {" << endl;
  indent(out) << "  return STRUCT_DESC;" << endl;
  indent(out) << "}" << endl;
}

void t_java_generator::generate_union_comparisons(ofstream& out, t_struct* tstruct) {
  // equality
  indent(out) << "public boolean equals(java.lang.Object other) {" << endl;
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

  indent(out) << "@Override" << endl;
  indent(out) << "public int compareTo(" << type_name(tstruct) << " other) {" << endl;
  indent(out) << "  int lastComparison = org.apache.thrift.TBaseHelper.compareTo(getSetField(), "
                 "other.getSetField());" << endl;
  indent(out) << "  if (lastComparison == 0) {" << endl;
  indent(out) << "    return org.apache.thrift.TBaseHelper.compareTo(getFieldValue(), "
                 "other.getFieldValue());" << endl;
  indent(out) << "  }" << endl;
  indent(out) << "  return lastComparison;" << endl;
  indent(out) << "}" << endl;
  out << endl;
}

void t_java_generator::generate_union_hashcode(ofstream& out, t_struct* tstruct) {
  (void)tstruct;
  indent(out) << "@Override" << endl;
  indent(out) << "public int hashCode() {" << endl;
  indent(out) << "  java.util.List<java.lang.Object> list = new java.util.ArrayList<java.lang.Object>();" << endl;
  indent(out) << "  list.add(this.getClass().getName());" << endl;
  indent(out) << "  org.apache.thrift.TFieldIdEnum setField = getSetField();" << endl;
  indent(out) << "  if (setField != null) {" << endl;
  indent(out) << "    list.add(setField.getThriftFieldId());" << endl;
  indent(out) << "    java.lang.Object value = getFieldValue();" << endl;
  indent(out) << "    if (value instanceof org.apache.thrift.TEnum) {" << endl;
  indent(out) << "      list.add(((org.apache.thrift.TEnum)getFieldValue()).getValue());" << endl;
  indent(out) << "    } else {" << endl;
  indent(out) << "      list.add(value);" << endl;
  indent(out) << "    }" << endl;
  indent(out) << "  }" << endl;
  indent(out) << "  return list.hashCode();" << endl;
  indent(out) << "}";
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
void t_java_generator::generate_java_struct_definition(ofstream& out,
                                                       t_struct* tstruct,
                                                       bool is_exception,
                                                       bool in_class,
                                                       bool is_result) {
  generate_java_doc(out, tstruct);

  bool is_final = (tstruct->annotations_.find("final") != tstruct->annotations_.end());
  bool is_deprecated = this->is_deprecated(tstruct->annotations_);

  if (!in_class && !suppress_generated_annotations_) {
    generate_javax_generated_annotation(out);
  }

  if (is_deprecated) {
    indent(out) << "@Deprecated" << endl;
  }
  indent(out) << "public " << (is_final ? "final " : "") << (in_class ? "static " : "") << "class "
              << tstruct->get_name() << " ";

  if (is_exception) {
    out << "extends org.apache.thrift.TException ";
  }
  out << "implements org.apache.thrift.TBase<" << tstruct->get_name() << ", " << tstruct->get_name()
      << "._Fields>, java.io.Serializable, Cloneable, Comparable<" << tstruct->get_name() << ">";

  if (android_style_) {
    out << ", android.os.Parcelable";
  }

  out << " ";

  scope_up(out);

  generate_struct_desc(out, tstruct);

  // Members are public for -java, private for -javabean
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  out << endl;

  generate_field_descs(out, tstruct);

  out << endl;

  generate_scheme_map(out, tstruct);

  out << endl;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    if (bean_style_ || private_members_) {
      indent(out) << "private ";
    } else {
      generate_java_doc(out, *m_iter);
      indent(out) << "public ";
    }
    out << declare_field(*m_iter, false, true) << endl;
  }

  out << endl;

  if (android_style_) {
    generate_java_struct_parcelable(out, tstruct);
  }

  generate_field_name_constants(out, tstruct);

  // isset data
  if (members.size() > 0) {
    out << endl;

    indent(out) << "// isset id assignments" << endl;

    int i = 0;
    int optionals = 0;
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      if ((*m_iter)->get_req() == t_field::T_OPTIONAL) {
        optionals++;
      }
      if (!type_can_be_null((*m_iter)->get_type())) {
        indent(out) << "private static final int " << isset_field_id(*m_iter) << " = " << i << ";"
                    << endl;
        i++;
      }
    }

    std::string primitiveType;
    switch (needs_isset(tstruct, &primitiveType)) {
    case ISSET_NONE:
      break;
    case ISSET_PRIMITIVE:
      indent(out) << "private " << primitiveType << " __isset_bitfield = 0;" << endl;
      break;
    case ISSET_BITSET:
      indent(out) << "private java.util.BitSet __isset_bit_vector = new java.util.BitSet(" << i << ");" << endl;
      break;
    }

    if (optionals > 0) {
      std::string output_string = "private static final _Fields optionals[] = {";
      for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
        if ((*m_iter)->get_req() == t_field::T_OPTIONAL) {
          output_string = output_string + "_Fields." + constant_name((*m_iter)->get_name()) + ",";
        }
      }
      indent(out) << output_string.substr(0, output_string.length() - 1) << "};" << endl;
    }
  }

  generate_java_meta_data_map(out, tstruct);

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
        t_type* type = get_true_type((*m_iter)->get_type());
        if (type->is_base_type() && ((t_base_type*)type)->is_binary()) {
          indent(out) << "this." << (*m_iter)->get_name()
                      << " = org.apache.thrift.TBaseHelper.copyBinary(" << (*m_iter)->get_name()
                      << ");" << endl;
        } else {
          indent(out) << "this." << (*m_iter)->get_name() << " = " << (*m_iter)->get_name() << ";"
                      << endl;
        }
        generate_isset_set(out, (*m_iter), "");
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

  switch (needs_isset(tstruct)) {
  case ISSET_NONE:
    break;
  case ISSET_PRIMITIVE:
    indent(out) << "__isset_bitfield = other.__isset_bitfield;" << endl;
    break;
  case ISSET_BITSET:
    indent(out) << "__isset_bit_vector.clear();" << endl;
    indent(out) << "__isset_bit_vector.or(other.__isset_bit_vector);" << endl;
    break;
  }

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_field* field = (*m_iter);
    std::string field_name = field->get_name();
    t_type* type = field->get_type()->get_true_type();
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
  generate_generic_isset_method(out, tstruct);

  generate_java_struct_equality(out, tstruct);
  generate_java_struct_compare_to(out, tstruct);
  generate_java_struct_field_by_id(out, tstruct);

  generate_java_struct_reader(out, tstruct);
  if (is_result) {
    generate_java_struct_result_writer(out, tstruct);
  } else {
    generate_java_struct_writer(out, tstruct);
  }
  generate_java_struct_tostring(out, tstruct);
  generate_java_validator(out, tstruct);

  generate_java_struct_write_object(out, tstruct);
  generate_java_struct_read_object(out, tstruct);

  generate_java_struct_standard_scheme(out, tstruct, is_result);
  generate_java_struct_tuple_scheme(out, tstruct);
  generate_java_scheme_lookup(out);

  scope_down(out);
  out << endl;
}

/**
 * generates parcelable interface implementation
 */
void t_java_generator::generate_java_struct_parcelable(ofstream& out, t_struct* tstruct) {
  string tname = tstruct->get_name();

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  out << indent() << "@Override" << endl << indent()
      << "public void writeToParcel(android.os.Parcel out, int flags) {" << endl;
  indent_up();
  string bitsetPrimitiveType = "";
  switch (needs_isset(tstruct, &bitsetPrimitiveType)) {
  case ISSET_NONE:
    break;
  case ISSET_PRIMITIVE:
    indent(out) << "//primitive bitfield of type: " << bitsetPrimitiveType << endl;
    if (bitsetPrimitiveType == "byte") {
      indent(out) << "out.writeByte(__isset_bitfield);" << endl;
    } else if (bitsetPrimitiveType == "short") {
      indent(out) << "out.writeInt(new Short(__isset_bitfield).intValue());" << endl;
    } else if (bitsetPrimitiveType == "int") {
      indent(out) << "out.writeInt(__isset_bitfield);" << endl;
    } else if (bitsetPrimitiveType == "long") {
      indent(out) << "out.writeLong(__isset_bitfield);" << endl;
    }
    out << endl;
    break;
  case ISSET_BITSET:
    indent(out) << "//BitSet" << endl;
    indent(out) << "out.writeSerializable(__isset_bit_vector);" << endl;
    out << endl;
    break;
  }
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_type* t = get_true_type((*m_iter)->get_type());
    string name = (*m_iter)->get_name();

    if (t->is_struct()) {
      indent(out) << "out.writeParcelable(" << name << ", flags);" << endl;
    } else if (type_name(t) == "float") {
      indent(out) << "out.writeFloat(" << name << ");" << endl;
    } else if (t->is_enum()) {
      indent(out) << "out.writeInt(" << name << " != null ? " << name << ".getValue() : -1);" << endl;
    } else if (t->is_list()) {
      if (((t_list*)t)->get_elem_type()->get_true_type()->is_struct()) {
        indent(out) << "out.writeTypedList(" << name << ");" << endl;
      } else {
        indent(out) << "out.writeList(" << name << ");" << endl;
      }
    } else if (t->is_map()) {
      indent(out) << "out.writeMap(" << name << ");" << endl;
    } else if (t->is_base_type()) {
      if (((t_base_type*)t)->is_binary()) {
        indent(out) << "out.writeInt(" << name << "!=null ? 1 : 0);" << endl;
        indent(out) << "if(" << name << " != null) { " << endl;
        indent_up();
        indent(out) << "out.writeByteArray(" << name << ".array(), " << name << ".position() + "
                    << name << ".arrayOffset(), " << name << ".limit() - " << name
                    << ".position() );" << endl;
        scope_down(out);
      } else {
        switch (((t_base_type*)t)->get_base()) {
        case t_base_type::TYPE_I16:
          indent(out) << "out.writeInt(new Short(" << name << ").intValue());" << endl;
          break;
        case t_base_type::TYPE_I32:
          indent(out) << "out.writeInt(" << name << ");" << endl;
          break;
        case t_base_type::TYPE_I64:
          indent(out) << "out.writeLong(" << name << ");" << endl;
          break;
        case t_base_type::TYPE_BOOL:
          indent(out) << "out.writeInt(" << name << " ? 1 : 0);" << endl;
          break;
        case t_base_type::TYPE_I8:
          indent(out) << "out.writeByte(" << name << ");" << endl;
          break;
        case t_base_type::TYPE_DOUBLE:
          indent(out) << "out.writeDouble(" << name << ");" << endl;
          break;
        case t_base_type::TYPE_STRING:
          indent(out) << "out.writeString(" << name << ");" << endl;
          break;
        case t_base_type::TYPE_VOID:
          break;
        }
      }
    }
  }
  scope_down(out);
  out << endl;

  out << indent() << "@Override" << endl << indent() << "public int describeContents() {" << endl;
  indent_up();
  out << indent() << "return 0;" << endl;
  scope_down(out);
  out << endl;

  indent(out) << "public " << tname << "(android.os.Parcel in) {" << endl;
  indent_up();
  // read in the required bitfield
  switch (needs_isset(tstruct, &bitsetPrimitiveType)) {
  case ISSET_NONE:
    break;
  case ISSET_PRIMITIVE:
    indent(out) << "//primitive bitfield of type: " << bitsetPrimitiveType << endl;
    if (bitsetPrimitiveType == "byte") {
      indent(out) << "__isset_bitfield = in.readByte();" << endl;
    } else if (bitsetPrimitiveType == "short") {
      indent(out) << "__isset_bitfield = (short) in.readInt();" << endl;
    } else if (bitsetPrimitiveType == "int") {
      indent(out) << "__isset_bitfield = in.readInt();" << endl;
    } else if (bitsetPrimitiveType == "long") {
      indent(out) << "__isset_bitfield = in.readLong();" << endl;
    }
    out << endl;
    break;
  case ISSET_BITSET:
    indent(out) << "//BitSet" << endl;
    indent(out) << "__isset_bit_vector = (java.util.BitSet) in.readSerializable();" << endl;
    out << endl;
    break;
  }
  // read all the fields
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_type* t = get_true_type((*m_iter)->get_type());
    string name = (*m_iter)->get_name();
    string prefix = "this." + name;

    if (t->is_struct()) {
      indent(out) << prefix << "= in.readParcelable(" << tname << ".class.getClassLoader());"
                  << endl;
    } else if (t->is_enum()) {
      indent(out) << prefix << " = " << type_name(t) << ".findByValue(in.readInt());" << endl;
    } else if (t->is_list()) {
      t_list* list = (t_list*)t;
      indent(out) << prefix << " = new " << type_name(t, false, true) << "();" << endl;
      if (list->get_elem_type()->get_true_type()->is_struct()) {
        indent(out) << "in.readTypedList(" << prefix << ", " << type_name(list->get_elem_type())
                    << ".CREATOR);" << endl;
      } else {
        indent(out) << "in.readList(" << prefix << ", " << tname << ".class.getClassLoader());"
                    << endl;
      }
    } else if (t->is_map()) {
      indent(out) << prefix << " = new " << type_name(t, false, true) << "();" << endl;
      indent(out) << " in.readMap(" << prefix << ", " << tname << ".class.getClassLoader());"
                  << endl;
    } else if (type_name(t) == "float") {
      indent(out) << prefix << " = in.readFloat();" << endl;
    } else if (t->is_base_type()) {
      t_base_type* bt = (t_base_type*)t;
      if (bt->is_binary()) {
        indent(out) << "if(in.readInt()==1) {" << endl;
        indent_up();
        indent(out) << prefix << " = java.nio.ByteBuffer.wrap(in.createByteArray());" << endl;
        scope_down(out);
      } else {
        switch (bt->get_base()) {
        case t_base_type::TYPE_I16:
          indent(out) << prefix << " = (short) in.readInt();" << endl;
          break;
        case t_base_type::TYPE_I32:
          indent(out) << prefix << " = in.readInt();" << endl;
          break;
        case t_base_type::TYPE_I64:
          indent(out) << prefix << " = in.readLong();" << endl;
          break;
        case t_base_type::TYPE_BOOL:
          indent(out) << prefix << " = (in.readInt()==1);" << endl;
          break;
        case t_base_type::TYPE_I8:
          indent(out) << prefix << " = in.readByte();" << endl;
          break;
        case t_base_type::TYPE_DOUBLE:
          indent(out) << prefix << " = in.readDouble();" << endl;
          break;
        case t_base_type::TYPE_STRING:
          indent(out) << prefix << "= in.readString();" << endl;
          break;
        case t_base_type::TYPE_VOID:
          break;
        }
      }
    }
  }

  scope_down(out);
  out << endl;

  indent(out) << "public static final android.os.Parcelable.Creator<" << tname
              << "> CREATOR = new android.os.Parcelable.Creator<" << tname << ">() {" << endl;
  indent_up();

  indent(out) << "@Override" << endl << indent() << "public " << tname << "[] newArray(int size) {"
              << endl;
  indent_up();
  indent(out) << "return new " << tname << "[size];" << endl;
  scope_down(out);
  out << endl;

  indent(out) << "@Override" << endl << indent() << "public " << tname
              << " createFromParcel(android.os.Parcel in) {" << endl;
  indent_up();
  indent(out) << "return new " << tname << "(in);" << endl;
  scope_down(out);

  indent_down();
  indent(out) << "};" << endl;
  out << endl;
}

/**
 * Generates equals methods and a hashCode method for a structure.
 *
 * @param tstruct The struct definition
 */
void t_java_generator::generate_java_struct_equality(ofstream& out, t_struct* tstruct) {
  out << indent() << "@Override" << endl << indent() << "public boolean equals(java.lang.Object that) {"
      << endl;
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
      unequal = "!this." + name + ".equals(that." + name + ")";
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

  const int MUL = 8191; // HashCode multiplier
  const int B_YES = 131071;
  const int B_NO = 524287;
  out << indent() << "@Override" << endl << indent() << "public int hashCode() {" << endl;
  indent_up();
  indent(out) << "int hashCode = 1;" << endl;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    out << endl;

    t_type* t = get_true_type((*m_iter)->get_type());
    bool is_optional = (*m_iter)->get_req() == t_field::T_OPTIONAL;
    bool can_be_null = type_can_be_null(t);
    string name = (*m_iter)->get_name();

    if (is_optional || can_be_null) {
      indent(out) << "hashCode = hashCode * " << MUL << " + ((" << generate_isset_check(*m_iter)
                  << ") ? " << B_YES << " : " << B_NO << ");" << endl;
    }

    if (is_optional || can_be_null) {
      indent(out) << "if (" + generate_isset_check(*m_iter) + ")" << endl;
      indent_up();
    }

    if (t->is_enum()) {
      indent(out) << "hashCode = hashCode * " << MUL << " + " << name << ".getValue();" << endl;
    } else if (t->is_base_type()) {
      switch(((t_base_type*)t)->get_base()) {
      case t_base_type::TYPE_STRING:
        indent(out) << "hashCode = hashCode * " << MUL << " + " << name << ".hashCode();" << endl;
        break;
      case t_base_type::TYPE_BOOL:
        indent(out) << "hashCode = hashCode * " << MUL << " + ((" << name << ") ? "
                    << B_YES << " : " << B_NO << ");" << endl;
        break;
      case t_base_type::TYPE_I8:
        indent(out) << "hashCode = hashCode * " << MUL << " + (int) (" << name << ");" << endl;
        break;
      case t_base_type::TYPE_I16:
      case t_base_type::TYPE_I32:
        indent(out) << "hashCode = hashCode * " << MUL << " + " << name << ";" << endl;
        break;
      case t_base_type::TYPE_I64:
      case t_base_type::TYPE_DOUBLE:
        indent(out) << "hashCode = hashCode * " << MUL << " + org.apache.thrift.TBaseHelper.hashCode(" << name << ");" << endl;
        break;
      case t_base_type::TYPE_VOID:
        throw std::logic_error("compiler error: a struct field cannot be void");
      default:
        throw std::logic_error("compiler error: the following base type has no hashcode generator: " +
               t_base_type::t_base_name(((t_base_type*)t)->get_base()));
      }
    } else {
      indent(out) << "hashCode = hashCode * " << MUL << " + " << name << ".hashCode();" << endl;
    }

    if (is_optional || can_be_null) {
      indent_down();
    }
  }

  out << endl;
  indent(out) << "return hashCode;" << endl;
  indent_down();
  indent(out) << "}" << endl << endl;
}

void t_java_generator::generate_java_struct_compare_to(ofstream& out, t_struct* tstruct) {
  indent(out) << "@Override" << endl;
  indent(out) << "public int compareTo(" << type_name(tstruct) << " other) {" << endl;
  indent_up();

  indent(out) << "if (!getClass().equals(other.getClass())) {" << endl;
  indent(out) << "  return getClass().getName().compareTo(other.getClass().getName());" << endl;
  indent(out) << "}" << endl;
  out << endl;

  indent(out) << "int lastComparison = 0;" << endl;
  out << endl;

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_field* field = *m_iter;
    indent(out) << "lastComparison = java.lang.Boolean.valueOf(" << generate_isset_check(field)
                << ").compareTo(other." << generate_isset_check(field) << ");" << endl;
    indent(out) << "if (lastComparison != 0) {" << endl;
    indent(out) << "  return lastComparison;" << endl;
    indent(out) << "}" << endl;

    indent(out) << "if (" << generate_isset_check(field) << ") {" << endl;
    indent(out) << "  lastComparison = org.apache.thrift.TBaseHelper.compareTo(this."
                << field->get_name() << ", other." << field->get_name() << ");" << endl;
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
void t_java_generator::generate_java_struct_reader(ofstream& out, t_struct* tstruct) {
  (void)tstruct;
  indent(out) << "public void read(org.apache.thrift.protocol.TProtocol iprot) throws "
                 "org.apache.thrift.TException {" << endl;
  indent_up();
  indent(out) << "scheme(iprot).read(iprot, this);" << endl;
  indent_down();
  indent(out) << "}" << endl << endl;
}

// generates java method to perform various checks
// (e.g. check that all required fields are set)
void t_java_generator::generate_java_validator(ofstream& out, t_struct* tstruct) {
  indent(out) << "public void validate() throws org.apache.thrift.TException {" << endl;
  indent_up();

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  out << indent() << "// check for required fields" << endl;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if ((*f_iter)->get_req() == t_field::T_REQUIRED) {
      if (bean_style_) {
        out << indent() << "if (!" << generate_isset_check(*f_iter) << ") {" << endl << indent()
            << "  throw new org.apache.thrift.protocol.TProtocolException(\"Required field '"
            << (*f_iter)->get_name() << "' is unset! Struct:\" + toString());" << endl << indent()
            << "}" << endl << endl;
      } else {
        if (type_can_be_null((*f_iter)->get_type())) {
          indent(out) << "if (" << (*f_iter)->get_name() << " == null) {" << endl;
          indent(out)
              << "  throw new org.apache.thrift.protocol.TProtocolException(\"Required field '"
              << (*f_iter)->get_name() << "' was not present! Struct: \" + toString());" << endl;
          indent(out) << "}" << endl;
        } else {
          indent(out) << "// alas, we cannot check '" << (*f_iter)->get_name()
                      << "' because it's a primitive and you chose the non-beans generator."
                      << endl;
        }
      }
    }
  }

  out << indent() << "// check for sub-struct validity" << endl;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    t_type* type = (*f_iter)->get_type();
    if (type->is_struct() && !((t_struct*)type)->is_union()) {
      out << indent() << "if (" << (*f_iter)->get_name() << " != null) {" << endl;
      out << indent() << "  " << (*f_iter)->get_name() << ".validate();" << endl;
      out << indent() << "}" << endl;
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
void t_java_generator::generate_java_struct_writer(ofstream& out, t_struct* tstruct) {
  (void)tstruct;
  indent(out) << "public void write(org.apache.thrift.protocol.TProtocol oprot) throws "
                 "org.apache.thrift.TException {" << endl;
  indent_up();
  indent(out) << "scheme(oprot).write(oprot, this);" << endl;

  indent_down();
  indent(out) << "}" << endl << endl;
}

/**
 * Generates a function to write all the fields of the struct,
 * which is a function result. These fields are only written
 * if they are set in the Isset array, and only one of them
 * can be set at a time.
 *
 * @param tstruct The struct definition
 */
void t_java_generator::generate_java_struct_result_writer(ofstream& out, t_struct* tstruct) {
  (void)tstruct;
  indent(out) << "public void write(org.apache.thrift.protocol.TProtocol oprot) throws "
                 "org.apache.thrift.TException {" << endl;
  indent_up();
  indent(out) << "scheme(oprot).write(oprot, this);" << endl;

  indent_down();
  indent(out) << "  }" << endl << endl;
}

void t_java_generator::generate_java_struct_field_by_id(ofstream& out, t_struct* tstruct) {
  (void)tstruct;
  indent(out) << "public _Fields fieldForId(int fieldId) {" << endl;
  indent(out) << "  return _Fields.findByThriftId(fieldId);" << endl;
  indent(out) << "}" << endl << endl;
}

void t_java_generator::generate_reflection_getters(ostringstream& out,
                                                   t_type* type,
                                                   string field_name,
                                                   string cap_name) {
  indent(out) << "case " << constant_name(field_name) << ":" << endl;
  indent_up();
  indent(out) << "return " << (type->is_bool() ? "is" : "get") << cap_name << "();" << endl << endl;
  indent_down();
}

void t_java_generator::generate_reflection_setters(ostringstream& out,
                                                   t_type* type,
                                                   string field_name,
                                                   string cap_name) {
  const bool is_binary = type->is_base_type() && ((t_base_type*)type)->is_binary();
  indent(out) << "case " << constant_name(field_name) << ":" << endl;
  indent_up();
  indent(out) << "if (value == null) {" << endl;
  indent(out) << "  unset" << get_cap_name(field_name) << "();" << endl;
  indent(out) << "} else {" << endl;
  if (is_binary) {
    indent_up();
    indent(out) << "if (value instanceof byte[]) {" << endl;
    indent(out) << "  set" << cap_name << "((byte[])value);" << endl;
    indent(out) << "} else {" << endl;
  }
  indent(out) << "  set" << cap_name << "((" << type_name(type, true, false) << ")value);" << endl;
  if (is_binary) {
    indent(out) << "}" << endl;
    indent_down();
  }
  indent(out) << "}" << endl;
  indent(out) << "break;" << endl << endl;

  indent_down();
}

void t_java_generator::generate_generic_field_getters_setters(std::ofstream& out,
                                                              t_struct* tstruct) {
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

  // create the setter

  indent(out) << "public void setFieldValue(_Fields field, java.lang.Object value) {" << endl;
  indent(out) << "  switch (field) {" << endl;
  out << setter_stream.str();
  indent(out) << "  }" << endl;
  indent(out) << "}" << endl << endl;

  // create the getter
  indent(out) << "public java.lang.Object getFieldValue(_Fields field) {" << endl;
  indent_up();
  indent(out) << "switch (field) {" << endl;
  out << getter_stream.str();
  indent(out) << "}" << endl;
  indent(out) << "throw new java.lang.IllegalStateException();" << endl;
  indent_down();
  indent(out) << "}" << endl << endl;
}

// Creates a generic isSet method that takes the field number as argument
void t_java_generator::generate_generic_isset_method(std::ofstream& out, t_struct* tstruct) {
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  // create the isSet method
  indent(out) << "/** Returns true if field corresponding to fieldID is set (has been assigned a "
                 "value) and false otherwise */" << endl;
  indent(out) << "public boolean isSet(_Fields field) {" << endl;
  indent_up();
  indent(out) << "if (field == null) {" << endl;
  indent(out) << "  throw new java.lang.IllegalArgumentException();" << endl;
  indent(out) << "}" << endl << endl;

  indent(out) << "switch (field) {" << endl;

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    t_field* field = *f_iter;
    indent(out) << "case " << constant_name(field->get_name()) << ":" << endl;
    indent_up();
    indent(out) << "return " << generate_isset_check(field) << ";" << endl;
    indent_down();
  }

  indent(out) << "}" << endl;
  indent(out) << "throw new java.lang.IllegalStateException();" << endl;
  indent_down();
  indent(out) << "}" << endl << endl;
}

/**
 * Generates a set of Java Bean boilerplate functions (setters, getters, etc.)
 * for the given struct.
 *
 * @param tstruct The struct definition
 */
void t_java_generator::generate_java_bean_boilerplate(ofstream& out, t_struct* tstruct) {
  isset_type issetType = needs_isset(tstruct);
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    t_field* field = *f_iter;
    t_type* type = get_true_type(field->get_type());
    std::string field_name = field->get_name();
    std::string cap_name = get_cap_name(field_name);
    bool optional = use_option_type_ && field->get_req() == t_field::T_OPTIONAL;
    bool is_deprecated = this->is_deprecated(field->annotations_);

    if (type->is_container()) {
      // Method to return the size of the collection
      if (optional) {
        if (is_deprecated) {
          indent(out) << "@Deprecated" << endl;
        }
        indent(out) << "public org.apache.thrift.Option<Integer> get" << cap_name;
        out << get_cap_name("size() {") << endl;

        indent_up();
        indent(out) << "if (this." << field_name << " == null) {" << endl;
        indent_up();
        indent(out) << "return org.apache.thrift.Option.none();" << endl;
        indent_down();
        indent(out) << "} else {" << endl;
        indent_up();
        indent(out) << "return org.apache.thrift.Option.some(this." << field_name << ".size());" << endl;
        indent_down();
        indent(out) << "}" << endl;
        indent_down();
        indent(out) << "}" << endl << endl;
      } else {
        if (is_deprecated) {
          indent(out) << "@Deprecated" << endl;
        }
        indent(out) << "public int get" << cap_name;
        out << get_cap_name("size() {") << endl;

        indent_up();
        indent(out) << "return (this." << field_name << " == null) ? 0 : "
                    << "this." << field_name << ".size();" << endl;
        indent_down();
        indent(out) << "}" << endl << endl;
      }
    }

    if (type->is_set() || type->is_list()) {
      t_type* element_type;
      if (type->is_set()) {
        element_type = ((t_set*)type)->get_elem_type();
      } else {
        element_type = ((t_list*)type)->get_elem_type();
      }

      // Iterator getter for sets and lists
      if (optional) {
        if (is_deprecated) {
          indent(out) << "@Deprecated" << endl;
        }
        indent(out) << "public org.apache.thrift.Option<java.util.Iterator<" << type_name(element_type, true, false)
                    << ">> get" << cap_name;
        out << get_cap_name("iterator() {") << endl;

        indent_up();
        indent(out) << "if (this." << field_name << " == null) {" << endl;
        indent_up();
        indent(out) << "return org.apache.thrift.Option.none();" << endl;
        indent_down();
        indent(out) << "} else {" << endl;
        indent_up();
        indent(out) << "return org.apache.thrift.Option.some(this." << field_name << ".iterator());" << endl;
        indent_down();
        indent(out) << "}" << endl;
        indent_down();
        indent(out) << "}" << endl << endl;
      } else {
        if (is_deprecated) {
          indent(out) << "@Deprecated" << endl;
        }
        indent(out) << "public java.util.Iterator<" << type_name(element_type, true, false)
                    << "> get" << cap_name;
        out << get_cap_name("iterator() {") << endl;

        indent_up();
        indent(out) << "return (this." << field_name << " == null) ? null : "
                    << "this." << field_name << ".iterator();" << endl;
        indent_down();
        indent(out) << "}" << endl << endl;
      }

      // Add to set or list, create if the set/list is null
      if (is_deprecated) {
        indent(out) << "@Deprecated" << endl;
      }
      indent(out) << "public void add" << get_cap_name("to");
      out << cap_name << "(" << type_name(element_type) << " elem) {" << endl;

      indent_up();
      indent(out) << "if (this." << field_name << " == null) {" << endl;
      indent_up();
      indent(out) << "this." << field_name << " = new " << type_name(type, false, true) << "();"
                  << endl;
      indent_down();
      indent(out) << "}" << endl;
      indent(out) << "this." << field_name << ".add(elem);" << endl;
      indent_down();
      indent(out) << "}" << endl << endl;
    } else if (type->is_map()) {
      // Put to map
      t_type* key_type = ((t_map*)type)->get_key_type();
      t_type* val_type = ((t_map*)type)->get_val_type();

      if (is_deprecated) {
        indent(out) << "@Deprecated" << endl;
      }
      indent(out) << "public void put" << get_cap_name("to");
      out << cap_name << "(" << type_name(key_type) << " key, " << type_name(val_type) << " val) {"
          << endl;

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
    if (type->is_base_type() && ((t_base_type*)type)->is_binary()) {
      if (is_deprecated) {
        indent(out) << "@Deprecated" << endl;
      }
      indent(out) << "public byte[] get" << cap_name << "() {" << endl;
      indent(out) << "  set" << cap_name << "(org.apache.thrift.TBaseHelper.rightSize("
                  << field_name << "));" << endl;
      indent(out) << "  return " << field_name << " == null ? null : " << field_name << ".array();"
                  << endl;
      indent(out) << "}" << endl << endl;

      indent(out) << "public java.nio.ByteBuffer buffer" << get_cap_name("for") << cap_name << "() {"
                  << endl;
      indent(out) << "  return org.apache.thrift.TBaseHelper.copyBinary(" << field_name << ");"
                  << endl;
      indent(out) << "}" << endl << endl;
    } else {
      if (optional) {
        if (is_deprecated) {
          indent(out) << "@Deprecated" << endl;
        }
        indent(out) << "public org.apache.thrift.Option<" << type_name(type, true) << ">";
        if (type->is_base_type() && ((t_base_type*)type)->get_base() == t_base_type::TYPE_BOOL) {
          out << " is";
        } else {
          out << " get";
        }
        out << cap_name << "() {" << endl;
        indent_up();

        indent(out) << "if (this.isSet" << cap_name << "()) {" << endl;
        indent_up();
        indent(out) << "return org.apache.thrift.Option.some(this." << field_name << ");" << endl;
        indent_down();
        indent(out) << "} else {" << endl;
        indent_up();
        indent(out) << "return org.apache.thrift.Option.none();" << endl;
        indent_down();
        indent(out) << "}" << endl;
        indent_down();
        indent(out) << "}" << endl << endl;
      } else {
        if (is_deprecated) {
          indent(out) << "@Deprecated" << endl;
        }
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
      }
    }

    // Simple setter
    generate_java_doc(out, field);
    if (type->is_base_type() && ((t_base_type*)type)->is_binary()) {
      if (is_deprecated) {
        indent(out) << "@Deprecated" << endl;
      }
      indent(out) << "public ";
      if (bean_style_) {
        out << "void";
      } else {
        out << type_name(tstruct);
      }
      out << " set" << cap_name << "(byte[] " << field_name << ") {" << endl;
      indent(out) << "  this." << field_name << " = " << field_name << " == null ? (java.nio.ByteBuffer)null"
                  << " : java.nio.ByteBuffer.wrap(" << field_name << ".clone());" << endl;
      if (!bean_style_) {
        indent(out) << "  return this;" << endl;
      }
      indent(out) << "}" << endl << endl;
    }
    if (is_deprecated) {
      indent(out) << "@Deprecated" << endl;
    }
    indent(out) << "public ";
    if (bean_style_) {
      out << "void";
    } else {
      out << type_name(tstruct);
    }
    out << " set" << cap_name << "(" << type_name(type) << " " << field_name << ") {" << endl;
    indent_up();
    indent(out) << "this." << field_name << " = ";
    if (type->is_base_type() && ((t_base_type*)type)->is_binary()) {
      out << "org.apache.thrift.TBaseHelper.copyBinary(" << field_name << ")";
    } else {
      out << field_name;
    }
    out << ";" << endl;
    generate_isset_set(out, field, "");
    if (!bean_style_) {
      indent(out) << "return this;" << endl;
    }

    indent_down();
    indent(out) << "}" << endl << endl;

    // Unsetter
    if (is_deprecated) {
      indent(out) << "@Deprecated" << endl;
    }
    indent(out) << "public void unset" << cap_name << "() {" << endl;
    indent_up();
    if (type_can_be_null(type)) {
      indent(out) << "this." << field_name << " = null;" << endl;
    } else if (issetType == ISSET_PRIMITIVE) {
      indent(out) << "__isset_bitfield = org.apache.thrift.EncodingUtils.clearBit(__isset_bitfield, "
                  << isset_field_id(field) << ");" << endl;
    } else {
      indent(out) << "__isset_bit_vector.clear(" << isset_field_id(field) << ");" << endl;
    }
    indent_down();
    indent(out) << "}" << endl << endl;

    // isSet method
    indent(out) << "/** Returns true if field " << field_name
                << " is set (has been assigned a value) and false otherwise */" << endl;
    if (is_deprecated) {
      indent(out) << "@Deprecated" << endl;
    }
    indent(out) << "public boolean is" << get_cap_name("set") << cap_name << "() {" << endl;
    indent_up();
    if (type_can_be_null(type)) {
      indent(out) << "return this." << field_name << " != null;" << endl;
    } else if (issetType == ISSET_PRIMITIVE) {
      indent(out) << "return org.apache.thrift.EncodingUtils.testBit(__isset_bitfield, " << isset_field_id(field)
                  << ");" << endl;
    } else {
      indent(out) << "return __isset_bit_vector.get(" << isset_field_id(field) << ");" << endl;
    }
    indent_down();
    indent(out) << "}" << endl << endl;

    if (is_deprecated) {
      indent(out) << "@Deprecated" << endl;
    }
    indent(out) << "public void set" << cap_name << get_cap_name("isSet") << "(boolean value) {"
                << endl;
    indent_up();
    if (type_can_be_null(type)) {
      indent(out) << "if (!value) {" << endl;
      indent(out) << "  this." << field_name << " = null;" << endl;
      indent(out) << "}" << endl;
    } else if (issetType == ISSET_PRIMITIVE) {
      indent(out) << "__isset_bitfield = org.apache.thrift.EncodingUtils.setBit(__isset_bitfield, "
                  << isset_field_id(field) << ", value);" << endl;
    } else {
      indent(out) << "__isset_bit_vector.set(" << isset_field_id(field) << ", value);" << endl;
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
void t_java_generator::generate_java_struct_tostring(ofstream& out, t_struct* tstruct) {
  out << indent() << "@Override" << endl << indent() << "public java.lang.String toString() {" << endl;
  indent_up();

  out << indent() << "java.lang.StringBuilder sb = new java.lang.StringBuilder(\"" << tstruct->get_name() << "(\");"
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

    if (get_true_type(field->get_type())->is_base_type()
        && ((t_base_type*)(get_true_type(field->get_type())))->is_binary()) {
      indent(out) << "org.apache.thrift.TBaseHelper.toString(this." << field->get_name() << ", sb);"
                  << endl;
    } else if ((field->get_type()->is_set())
               && (get_true_type(((t_set*)field->get_type())->get_elem_type())->is_base_type())
               && (((t_base_type*)get_true_type(((t_set*)field->get_type())->get_elem_type()))
                       ->is_binary())) {
      indent(out) << "org.apache.thrift.TBaseHelper.toString(this." << field->get_name() << ", sb);"
                  << endl;
    } else if ((field->get_type()->is_list())
               && (get_true_type(((t_list*)field->get_type())->get_elem_type())->is_base_type())
               && (((t_base_type*)get_true_type(((t_list*)field->get_type())->get_elem_type()))
                       ->is_binary())) {
      indent(out) << "org.apache.thrift.TBaseHelper.toString(this." << field->get_name() << ", sb);"
                  << endl;
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
 * Generates a static map with meta data to store information such as fieldID to
 * fieldName mapping
 *
 * @param tstruct The struct definition
 */
void t_java_generator::generate_java_meta_data_map(ofstream& out, t_struct* tstruct) {
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  // Static Map with fieldID -> org.apache.thrift.meta_data.FieldMetaData mappings
  indent(out)
      << "public static final java.util.Map<_Fields, org.apache.thrift.meta_data.FieldMetaData> metaDataMap;"
      << endl;
  indent(out) << "static {" << endl;
  indent_up();

  indent(out) << "java.util.Map<_Fields, org.apache.thrift.meta_data.FieldMetaData> tmpMap = new "
                 "java.util.EnumMap<_Fields, org.apache.thrift.meta_data.FieldMetaData>(_Fields.class);"
              << endl;

  // Populate map
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    t_field* field = *f_iter;
    std::string field_name = field->get_name();
    indent(out) << "tmpMap.put(_Fields." << constant_name(field_name)
                << ", new org.apache.thrift.meta_data.FieldMetaData(\"" << field_name << "\", ";

    // Set field requirement type (required, optional, etc.)
    if (field->get_req() == t_field::T_REQUIRED) {
      out << "org.apache.thrift.TFieldRequirementType.REQUIRED, ";
    } else if (field->get_req() == t_field::T_OPTIONAL) {
      out << "org.apache.thrift.TFieldRequirementType.OPTIONAL, ";
    } else {
      out << "org.apache.thrift.TFieldRequirementType.DEFAULT, ";
    }

    // Create value meta data
    generate_field_value_meta_data(out, field->get_type());
    out << "));" << endl;
  }

  indent(out) << "metaDataMap = java.util.Collections.unmodifiableMap(tmpMap);" << endl;

  indent(out) << "org.apache.thrift.meta_data.FieldMetaData.addStructMetaDataMap("
              << type_name(tstruct) << ".class, metaDataMap);" << endl;
  indent_down();
  indent(out) << "}" << endl << endl;
}

/**
 * Returns a string with the java representation of the given thrift type
 * (e.g. for the type struct it returns "org.apache.thrift.protocol.TType.STRUCT")
 */
std::string t_java_generator::get_java_type_string(t_type* type) {
  if (type->is_list()) {
    return "org.apache.thrift.protocol.TType.LIST";
  } else if (type->is_map()) {
    return "org.apache.thrift.protocol.TType.MAP";
  } else if (type->is_set()) {
    return "org.apache.thrift.protocol.TType.SET";
  } else if (type->is_struct() || type->is_xception()) {
    return "org.apache.thrift.protocol.TType.STRUCT";
  } else if (type->is_enum()) {
    return "org.apache.thrift.protocol.TType.ENUM";
  } else if (type->is_typedef()) {
    return get_java_type_string(((t_typedef*)type)->get_type());
  } else if (type->is_base_type()) {
    switch (((t_base_type*)type)->get_base()) {
    case t_base_type::TYPE_VOID:
      return "org.apache.thrift.protocol.TType.VOID";
      break;
    case t_base_type::TYPE_STRING:
      return "org.apache.thrift.protocol.TType.STRING";
      break;
    case t_base_type::TYPE_BOOL:
      return "org.apache.thrift.protocol.TType.BOOL";
      break;
    case t_base_type::TYPE_I8:
      return "org.apache.thrift.protocol.TType.BYTE";
      break;
    case t_base_type::TYPE_I16:
      return "org.apache.thrift.protocol.TType.I16";
      break;
    case t_base_type::TYPE_I32:
      return "org.apache.thrift.protocol.TType.I32";
      break;
    case t_base_type::TYPE_I64:
      return "org.apache.thrift.protocol.TType.I64";
      break;
    case t_base_type::TYPE_DOUBLE:
      return "org.apache.thrift.protocol.TType.DOUBLE";
      break;
    default:
      throw std::runtime_error("Unknown thrift type \"" + type->get_name()
                               + "\" passed to t_java_generator::get_java_type_string!");
      return "Unknown thrift type \"" + type->get_name()
             + "\" passed to t_java_generator::get_java_type_string!";
      break; // This should never happen!
    }
  } else {
    throw std::runtime_error("Unknown thrift type \"" + type->get_name()
                             + "\" passed to t_java_generator::get_java_type_string!");
    return "Unknown thrift type \"" + type->get_name()
           + "\" passed to t_java_generator::get_java_type_string!";
    // This should never happen!
  }
}

void t_java_generator::generate_field_value_meta_data(std::ofstream& out, t_type* type) {
  out << endl;
  indent_up();
  indent_up();
  if (type->is_struct() || type->is_xception()) {
    indent(out) << "new "
                   "org.apache.thrift.meta_data.StructMetaData(org.apache.thrift.protocol.TType."
                   "STRUCT, " << type_name(type) << ".class";
  } else if (type->is_container()) {
    if (type->is_list()) {
      indent(out)
          << "new org.apache.thrift.meta_data.ListMetaData(org.apache.thrift.protocol.TType.LIST, ";
      t_type* elem_type = ((t_list*)type)->get_elem_type();
      generate_field_value_meta_data(out, elem_type);
    } else if (type->is_set()) {
      indent(out)
          << "new org.apache.thrift.meta_data.SetMetaData(org.apache.thrift.protocol.TType.SET, ";
      t_type* elem_type = ((t_list*)type)->get_elem_type();
      generate_field_value_meta_data(out, elem_type);
    } else { // map
      indent(out)
          << "new org.apache.thrift.meta_data.MapMetaData(org.apache.thrift.protocol.TType.MAP, ";
      t_type* key_type = ((t_map*)type)->get_key_type();
      t_type* val_type = ((t_map*)type)->get_val_type();
      generate_field_value_meta_data(out, key_type);
      out << ", ";
      generate_field_value_meta_data(out, val_type);
    }
  } else if (type->is_enum()) {
    indent(out)
        << "new org.apache.thrift.meta_data.EnumMetaData(org.apache.thrift.protocol.TType.ENUM, "
        << type_name(type) << ".class";
  } else {
    indent(out) << "new org.apache.thrift.meta_data.FieldValueMetaData("
                << get_java_type_string(type);
    if (type->is_typedef()) {
      indent(out) << ", \"" << ((t_typedef*)type)->get_symbolic() << "\"";
    } else if (((t_base_type*)type)->is_binary()) {
      indent(out) << ", true";
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
void t_java_generator::generate_service(t_service* tservice) {
  // Make output file
  string f_service_name = package_dir_ + "/" + make_valid_java_filename(service_name_) + ".java";
  f_service_.open(f_service_name.c_str());

  f_service_ << autogen_comment() << java_package() << java_suppressions();

  if (!suppress_generated_annotations_) {
    generate_javax_generated_annotation(f_service_);
  }
  f_service_ << "public class " << service_name_ << " {" << endl << endl;
  indent_up();

  // Generate the three main parts of the service
  generate_service_interface(tservice);
  generate_service_async_interface(tservice);
  generate_service_client(tservice);
  generate_service_async_client(tservice);
  generate_service_server(tservice);
  generate_service_async_server(tservice);
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
void t_java_generator::generate_service_interface(t_service* tservice) {
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

void t_java_generator::generate_service_async_interface(t_service* tservice) {
  string extends = "";
  string extends_iface = "";
  if (tservice->get_extends() != NULL) {
    extends = type_name(tservice->get_extends());
    extends_iface = " extends " + extends + " .AsyncIface";
  }

  f_service_ << indent() << "public interface AsyncIface" << extends_iface << " {" << endl << endl;
  indent_up();
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    indent(f_service_) << "public " << function_signature_async(*f_iter, true)
                       << " throws org.apache.thrift.TException;" << endl << endl;
  }
  indent_down();
  f_service_ << indent() << "}" << endl << endl;
}

/**
 * Generates structs for all the service args and return types
 *
 * @param tservice The service
 */
void t_java_generator::generate_service_helpers(t_service* tservice) {
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
void t_java_generator::generate_service_client(t_service* tservice) {
  string extends = "";
  string extends_client = "";
  if (tservice->get_extends() == NULL) {
    extends_client = "org.apache.thrift.TServiceClient";
  } else {
    extends = type_name(tservice->get_extends());
    extends_client = extends + ".Client";
  }

  indent(f_service_) << "public static class Client extends " << extends_client
                     << " implements Iface {" << endl;
  indent_up();

  indent(f_service_)
      << "public static class Factory implements org.apache.thrift.TServiceClientFactory<Client> {"
      << endl;
  indent_up();
  indent(f_service_) << "public Factory() {}" << endl;
  indent(f_service_) << "public Client getClient(org.apache.thrift.protocol.TProtocol prot) {"
                     << endl;
  indent_up();
  indent(f_service_) << "return new Client(prot);" << endl;
  indent_down();
  indent(f_service_) << "}" << endl;
  indent(f_service_) << "public Client getClient(org.apache.thrift.protocol.TProtocol iprot, "
                        "org.apache.thrift.protocol.TProtocol oprot) {" << endl;
  indent_up();
  indent(f_service_) << "return new Client(iprot, oprot);" << endl;
  indent_down();
  indent(f_service_) << "}" << endl;
  indent_down();
  indent(f_service_) << "}" << endl << endl;

  indent(f_service_) << "public Client(org.apache.thrift.protocol.TProtocol prot)" << endl;
  scope_up(f_service_);
  indent(f_service_) << "super(prot, prot);" << endl;
  scope_down(f_service_);
  f_service_ << endl;

  indent(f_service_) << "public Client(org.apache.thrift.protocol.TProtocol iprot, "
                        "org.apache.thrift.protocol.TProtocol oprot) {" << endl;
  indent(f_service_) << "  super(iprot, oprot);" << endl;
  indent(f_service_) << "}" << endl << endl;

  // Generate client method implementations
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::const_iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    string funname = (*f_iter)->get_name();
    string sep = "_";
    string javaname = funname;
    if (fullcamel_style_) {
      sep = "";
      javaname = as_camel_case(funname);
    }

    // Open function
    indent(f_service_) << "public " << function_signature(*f_iter) << endl;
    scope_up(f_service_);
    indent(f_service_) << "send" << sep << javaname << "(";

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
      f_service_ << "recv" << sep << javaname << "();" << endl;
    }
    scope_down(f_service_);
    f_service_ << endl;

    t_function send_function(g_type_void,
                             string("send") + sep + javaname,
                             (*f_iter)->get_arglist());

    string argsname = (*f_iter)->get_name() + "_args";

    // Open function
    indent(f_service_) << "public " << function_signature(&send_function) << endl;
    scope_up(f_service_);

    // Serialize the request
    indent(f_service_) << argsname << " args = new " << argsname << "();" << endl;

    for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
      indent(f_service_) << "args.set" << get_cap_name((*fld_iter)->get_name()) << "("
                         << (*fld_iter)->get_name() << ");" << endl;
    }

    const string sendBaseName = (*f_iter)->is_oneway() ? "sendBaseOneway" : "sendBase";
    indent(f_service_) << sendBaseName << "(\"" << funname << "\", args);" << endl;

    scope_down(f_service_);
    f_service_ << endl;

    if (!(*f_iter)->is_oneway()) {
      string resultname = (*f_iter)->get_name() + "_result";

      t_struct noargs(program_);
      t_function recv_function((*f_iter)->get_returntype(),
                               string("recv") + sep + javaname,
                               &noargs,
                               (*f_iter)->get_xceptions());
      // Open function
      indent(f_service_) << "public " << function_signature(&recv_function) << endl;
      scope_up(f_service_);

      f_service_ << indent() << resultname << " result = new " << resultname << "();" << endl
                 << indent() << "receiveBase(result, \"" << funname << "\");" << endl;

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
        f_service_ << indent() << "throw new "
                                  "org.apache.thrift.TApplicationException(org.apache.thrift."
                                  "TApplicationException.MISSING_RESULT, \""
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

void t_java_generator::generate_service_async_client(t_service* tservice) {
  string extends = "org.apache.thrift.async.TAsyncClient";
  string extends_client = "";
  if (tservice->get_extends() != NULL) {
    extends = type_name(tservice->get_extends()) + ".AsyncClient";
  }

  indent(f_service_) << "public static class AsyncClient extends " << extends
                     << " implements AsyncIface {" << endl;
  indent_up();

  // Factory method
  indent(f_service_) << "public static class Factory implements "
                        "org.apache.thrift.async.TAsyncClientFactory<AsyncClient> {" << endl;
  indent(f_service_) << "  private org.apache.thrift.async.TAsyncClientManager clientManager;"
                     << endl;
  indent(f_service_) << "  private org.apache.thrift.protocol.TProtocolFactory protocolFactory;"
                     << endl;
  indent(f_service_) << "  public Factory(org.apache.thrift.async.TAsyncClientManager "
                        "clientManager, org.apache.thrift.protocol.TProtocolFactory "
                        "protocolFactory) {" << endl;
  indent(f_service_) << "    this.clientManager = clientManager;" << endl;
  indent(f_service_) << "    this.protocolFactory = protocolFactory;" << endl;
  indent(f_service_) << "  }" << endl;
  indent(f_service_) << "  public AsyncClient "
                        "getAsyncClient(org.apache.thrift.transport.TNonblockingTransport "
                        "transport) {" << endl;
  indent(f_service_) << "    return new AsyncClient(protocolFactory, clientManager, transport);"
                     << endl;
  indent(f_service_) << "  }" << endl;
  indent(f_service_) << "}" << endl << endl;

  indent(f_service_) << "public AsyncClient(org.apache.thrift.protocol.TProtocolFactory "
                        "protocolFactory, org.apache.thrift.async.TAsyncClientManager "
                        "clientManager, org.apache.thrift.transport.TNonblockingTransport "
                        "transport) {" << endl;
  indent(f_service_) << "  super(protocolFactory, clientManager, transport);" << endl;
  indent(f_service_) << "}" << endl << endl;

  // Generate client method implementations
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::const_iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    string funname = (*f_iter)->get_name();
    string sep = "_";
    string javaname = funname;
    if (fullcamel_style_) {
      sep = "";
      javaname = as_camel_case(javaname);
    }
    t_type* ret_type = (*f_iter)->get_returntype();
    t_struct* arg_struct = (*f_iter)->get_arglist();
    string funclassname = funname + "_call";
    const vector<t_field*>& fields = arg_struct->get_members();
    const std::vector<t_field*>& xceptions = (*f_iter)->get_xceptions()->get_members();
    vector<t_field*>::const_iterator fld_iter;
    string args_name = (*f_iter)->get_name() + "_args";
    string result_name = (*f_iter)->get_name() + "_result";

    // Main method body
    indent(f_service_) << "public " << function_signature_async(*f_iter, false)
                       << " throws org.apache.thrift.TException {" << endl;
    indent(f_service_) << "  checkReady();" << endl;
    indent(f_service_) << "  " << funclassname << " method_call = new " + funclassname + "("
                       << async_argument_list(*f_iter, arg_struct, ret_type)
                       << ", this, ___protocolFactory, ___transport);" << endl;
    indent(f_service_) << "  this.___currentMethod = method_call;" << endl;
    indent(f_service_) << "  ___manager.call(method_call);" << endl;
    indent(f_service_) << "}" << endl;

    f_service_ << endl;

    // TAsyncMethod object for this function call
    indent(f_service_) << "public static class " + funclassname
                          + " extends org.apache.thrift.async.TAsyncMethodCall<"
                          + type_name((*f_iter)->get_returntype(), true) + "> {" << endl;
    indent_up();

    // Member variables
    for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
      indent(f_service_) << "private " + type_name((*fld_iter)->get_type()) + " "
                            + (*fld_iter)->get_name() + ";" << endl;
    }

    // NOTE since we use a new Client instance to deserialize, let's keep seqid to 0 for now
    // indent(f_service_) << "private int seqid;" << endl << endl;

    // Constructor
    indent(f_service_) << "public " + funclassname + "("
                          + async_argument_list(*f_iter, arg_struct, ret_type, true)
                       << ", org.apache.thrift.async.TAsyncClient client, "
                          "org.apache.thrift.protocol.TProtocolFactory protocolFactory, "
                          "org.apache.thrift.transport.TNonblockingTransport transport) throws "
                          "org.apache.thrift.TException {" << endl;
    indent(f_service_) << "  super(client, protocolFactory, transport, resultHandler, "
                       << ((*f_iter)->is_oneway() ? "true" : "false") << ");" << endl;

    // Assign member variables
    for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
      indent(f_service_) << "  this." + (*fld_iter)->get_name() + " = " + (*fld_iter)->get_name()
                            + ";" << endl;
    }

    indent(f_service_) << "}" << endl << endl;

    indent(f_service_) << "public void write_args(org.apache.thrift.protocol.TProtocol prot) "
                          "throws org.apache.thrift.TException {" << endl;
    indent_up();

    // Serialize request
    // NOTE we are leaving seqid as 0, for now (see above)
    f_service_ << indent() << "prot.writeMessageBegin(new org.apache.thrift.protocol.TMessage(\""
               << funname << "\", org.apache.thrift.protocol."
               << ((*f_iter)->is_oneway() ? "TMessageType.ONEWAY" : "TMessageType.CALL") << ", 0));"
               << endl << indent() << args_name << " args = new " << args_name << "();" << endl;

    for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
      f_service_ << indent() << "args.set" << get_cap_name((*fld_iter)->get_name()) << "("
                 << (*fld_iter)->get_name() << ");" << endl;
    }

    f_service_ << indent() << "args.write(prot);" << endl << indent() << "prot.writeMessageEnd();"
               << endl;

    indent_down();
    indent(f_service_) << "}" << endl << endl;

    // Return method
    indent(f_service_) << "public " + type_name(ret_type, true) + " getResult() throws ";
    vector<t_field*>::const_iterator x_iter;
    for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
      f_service_ << type_name((*x_iter)->get_type(), false, false) + ", ";
    }
    f_service_ << "org.apache.thrift.TException {" << endl;

    indent_up();
    f_service_
        << indent()
        << "if (getState() != org.apache.thrift.async.TAsyncMethodCall.State.RESPONSE_READ) {"
        << endl << indent() << "  throw new java.lang.IllegalStateException(\"Method call not finished!\");"
        << endl << indent() << "}" << endl << indent()
        << "org.apache.thrift.transport.TMemoryInputTransport memoryTransport = new "
           "org.apache.thrift.transport.TMemoryInputTransport(getFrameBuffer().array());" << endl
        << indent() << "org.apache.thrift.protocol.TProtocol prot = "
                       "client.getProtocolFactory().getProtocol(memoryTransport);" << endl;
    indent(f_service_);
    if (ret_type->is_void()) { // NB: Includes oneways which always return void.
      f_service_ << "return null;" << endl;
    } else {
      f_service_ << "return (new Client(prot)).recv" + sep + javaname + "();" << endl;
    }

    // Close function
    indent_down();
    indent(f_service_) << "}" << endl;

    // Close class
    indent_down();
    indent(f_service_) << "}" << endl << endl;
  }

  // Close AsyncClient
  scope_down(f_service_);
  f_service_ << endl;
}

/**
 * Generates a service server definition.
 *
 * @param tservice The service to generate a server for.
 */
void t_java_generator::generate_service_server(t_service* tservice) {
  // Generate the dispatch methods
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;

  // Extends stuff
  string extends = "";
  string extends_processor = "";
  if (tservice->get_extends() == NULL) {
    extends_processor = "org.apache.thrift.TBaseProcessor<I>";
  } else {
    extends = type_name(tservice->get_extends());
    extends_processor = extends + ".Processor<I>";
  }

  // Generate the header portion
  indent(f_service_) << "public static class Processor<I extends Iface> extends "
                     << extends_processor << " implements org.apache.thrift.TProcessor {" << endl;
  indent_up();

  indent(f_service_)
      << "private static final org.slf4j.Logger _LOGGER = org.slf4j.LoggerFactory.getLogger(Processor.class.getName());"
      << endl;

  indent(f_service_) << "public Processor(I iface) {" << endl;
  indent(f_service_) << "  super(iface, getProcessMap(new java.util.HashMap<java.lang.String, "
                        "org.apache.thrift.ProcessFunction<I, ? extends "
                        "org.apache.thrift.TBase>>()));" << endl;
  indent(f_service_) << "}" << endl << endl;

  indent(f_service_) << "protected Processor(I iface, java.util.Map<java.lang.String, "
                        "org.apache.thrift.ProcessFunction<I, ? extends org.apache.thrift.TBase>> "
                        "processMap) {" << endl;
  indent(f_service_) << "  super(iface, getProcessMap(processMap));" << endl;
  indent(f_service_) << "}" << endl << endl;

  indent(f_service_) << "private static <I extends Iface> java.util.Map<java.lang.String,  "
                        "org.apache.thrift.ProcessFunction<I, ? extends org.apache.thrift.TBase>> "
                        "getProcessMap(java.util.Map<java.lang.String, org.apache.thrift.ProcessFunction<I, ? extends "
                        " org.apache.thrift.TBase>> processMap) {" << endl;
  indent_up();
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    indent(f_service_) << "processMap.put(\"" << (*f_iter)->get_name() << "\", new "
                       << (*f_iter)->get_name() << "());" << endl;
  }
  indent(f_service_) << "return processMap;" << endl;
  indent_down();
  indent(f_service_) << "}" << endl << endl;

  // Generate the process subfunctions
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    generate_process_function(tservice, *f_iter);
  }

  indent_down();
  indent(f_service_) << "}" << endl << endl;
}

/**
 * Generates a service server definition.
 *
 * @param tservice The service to generate a server for.
 */
void t_java_generator::generate_service_async_server(t_service* tservice) {
  // Generate the dispatch methods
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;

  // Extends stuff
  string extends = "";
  string extends_processor = "";
  if (tservice->get_extends() == NULL) {
    extends_processor = "org.apache.thrift.TBaseAsyncProcessor<I>";
  } else {
    extends = type_name(tservice->get_extends());
    extends_processor = extends + ".AsyncProcessor<I>";
  }

  // Generate the header portion
  indent(f_service_) << "public static class AsyncProcessor<I extends AsyncIface> extends "
                     << extends_processor << " {" << endl;
  indent_up();

  indent(f_service_) << "private static final org.slf4j.Logger _LOGGER = "
                        "org.slf4j.LoggerFactory.getLogger(AsyncProcessor.class.getName());" << endl;

  indent(f_service_) << "public AsyncProcessor(I iface) {" << endl;
  indent(f_service_) << "  super(iface, getProcessMap(new java.util.HashMap<java.lang.String, "
                        "org.apache.thrift.AsyncProcessFunction<I, ? extends "
                        "org.apache.thrift.TBase, ?>>()));" << endl;
  indent(f_service_) << "}" << endl << endl;

  indent(f_service_) << "protected AsyncProcessor(I iface, java.util.Map<java.lang.String,  "
                        "org.apache.thrift.AsyncProcessFunction<I, ? extends  "
                        "org.apache.thrift.TBase, ?>> processMap) {" << endl;
  indent(f_service_) << "  super(iface, getProcessMap(processMap));" << endl;
  indent(f_service_) << "}" << endl << endl;

  indent(f_service_) << "private static <I extends AsyncIface> java.util.Map<java.lang.String,  "
                        "org.apache.thrift.AsyncProcessFunction<I, ? extends  "
                        "org.apache.thrift.TBase,?>> getProcessMap(java.util.Map<java.lang.String,  "
                        "org.apache.thrift.AsyncProcessFunction<I, ? extends  "
                        "org.apache.thrift.TBase, ?>> processMap) {" << endl;
  indent_up();
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    indent(f_service_) << "processMap.put(\"" << (*f_iter)->get_name() << "\", new "
                       << (*f_iter)->get_name() << "());" << endl;
  }
  indent(f_service_) << "return processMap;" << endl;
  indent_down();
  indent(f_service_) << "}" << endl << endl;

  // Generate the process subfunctions
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    generate_process_async_function(tservice, *f_iter);
  }

  indent_down();
  indent(f_service_) << "}" << endl << endl;
}

/**
 * Generates a struct and helpers for a function.
 *
 * @param tfunction The function
 */
void t_java_generator::generate_function_helpers(t_function* tfunction) {
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
void t_java_generator::generate_process_async_function(t_service* tservice, t_function* tfunction) {
  string argsname = tfunction->get_name() + "_args";

  string resultname = tfunction->get_name() + "_result";
  if (tfunction->is_oneway()) {
    resultname = "org.apache.thrift.TBase";
  }

  string resulttype = type_name(tfunction->get_returntype(), true);

  (void)tservice;
  // Open class
  indent(f_service_) << "public static class " << tfunction->get_name()
                     << "<I extends AsyncIface> extends org.apache.thrift.AsyncProcessFunction<I, "
                     << argsname << ", " << resulttype << "> {" << endl;
  indent_up();

  indent(f_service_) << "public " << tfunction->get_name() << "() {" << endl;
  indent(f_service_) << "  super(\"" << tfunction->get_name() << "\");" << endl;
  indent(f_service_) << "}" << endl << endl;

  indent(f_service_) << "public " << argsname << " getEmptyArgsInstance() {" << endl;
  indent(f_service_) << "  return new " << argsname << "();" << endl;
  indent(f_service_) << "}" << endl << endl;

  indent(f_service_) << "public org.apache.thrift.async.AsyncMethodCallback<" << resulttype
                     << "> getResultHandler(final org.apache.thrift.server.AbstractNonblockingServer.AsyncFrameBuffer fb, final int seqid) {" << endl;
  indent_up();
  indent(f_service_) << "final org.apache.thrift.AsyncProcessFunction fcall = this;" << endl;
  indent(f_service_) << "return new org.apache.thrift.async.AsyncMethodCallback<" << resulttype
                     << ">() { " << endl;
  indent_up();
  indent(f_service_) << "public void onComplete(" << resulttype << " o) {" << endl;

  indent_up();
  if (!tfunction->is_oneway()) {
    indent(f_service_) << resultname << " result = new " << resultname << "();" << endl;

    if (!tfunction->get_returntype()->is_void()) {
      indent(f_service_) << "result.success = o;" << endl;
      // Set isset on success field
      if (!type_can_be_null(tfunction->get_returntype())) {
        indent(f_service_) << "result.set" << get_cap_name("success") << get_cap_name("isSet")
                           << "(true);" << endl;
      }
    }

    indent(f_service_) << "try {" << endl;
    indent(f_service_)
        << "  fcall.sendResponse(fb, result, org.apache.thrift.protocol.TMessageType.REPLY,seqid);"
        << endl;
    indent(f_service_) << "} catch (org.apache.thrift.transport.TTransportException e) {" << endl;
    indent_up();
    f_service_ << indent()
               << "_LOGGER.error(\"TTransportException writing to internal frame buffer\", e);"
               << endl
               << indent() << "fb.close();" << endl;
    indent_down();
    indent(f_service_) << "} catch (java.lang.Exception e) {" << endl;
    indent_up();
    f_service_ << indent() << "_LOGGER.error(\"Exception writing to internal frame buffer\", e);"
               << endl
               << indent() << "onError(e);" << endl;
    indent_down();
    indent(f_service_) << "}" << endl;
  }
  indent_down();
  indent(f_service_) << "}" << endl;

  indent(f_service_) << "public void onError(java.lang.Exception e) {" << endl;
  indent_up();

  if (tfunction->is_oneway()) {
    indent(f_service_) << "if (e instanceof org.apache.thrift.transport.TTransportException) {"
                       << endl;
    indent_up();

    f_service_ << indent() << "_LOGGER.error(\"TTransportException inside handler\", e);" << endl
               << indent() << "fb.close();" << endl;

    indent_down();
    indent(f_service_) << "} else {" << endl;
    indent_up();

    f_service_ << indent() << "_LOGGER.error(\"Exception inside oneway handler\", e);" << endl;

    indent_down();
    indent(f_service_) << "}" << endl;
  } else {
    indent(f_service_) << "byte msgType = org.apache.thrift.protocol.TMessageType.REPLY;" << endl;
    indent(f_service_) << "org.apache.thrift.TSerializable msg;" << endl;
    indent(f_service_) << resultname << " result = new " << resultname << "();" << endl;

    t_struct* xs = tfunction->get_xceptions();
    const std::vector<t_field*>& xceptions = xs->get_members();

    vector<t_field*>::const_iterator x_iter;
    if (xceptions.size() > 0) {
      for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
        if (x_iter == xceptions.begin())
          f_service_ << indent();
        string type = type_name((*x_iter)->get_type(), false, false);
        string name = (*x_iter)->get_name();
        f_service_ << "if (e instanceof " << type << ") {" << endl;
        indent_up();
        f_service_ << indent() << "result." << name << " = (" << type << ") e;" << endl
                   << indent() << "result.set" << get_cap_name(name) << get_cap_name("isSet")
                   << "(true);" << endl
                   << indent() << "msg = result;" << endl;
        indent_down();
        indent(f_service_) << "} else ";
      }
    } else {
      indent(f_service_);
    }
    f_service_ << "if (e instanceof org.apache.thrift.transport.TTransportException) {" << endl;
    indent_up();
    f_service_ << indent() << "_LOGGER.error(\"TTransportException inside handler\", e);" << endl
               << indent() << "fb.close();" << endl
               << indent() << "return;" << endl;
    indent_down();
    indent(f_service_) << "} else if (e instanceof org.apache.thrift.TApplicationException) {"
                       << endl;
    indent_up();
    f_service_ << indent() << "_LOGGER.error(\"TApplicationException inside handler\", e);" << endl
               << indent() << "msgType = org.apache.thrift.protocol.TMessageType.EXCEPTION;" << endl
               << indent() << "msg = (org.apache.thrift.TApplicationException)e;" << endl;
    indent_down();
    indent(f_service_) << "} else {" << endl;
    indent_up();
    f_service_ << indent() << "_LOGGER.error(\"Exception inside handler\", e);" << endl
               << indent() << "msgType = org.apache.thrift.protocol.TMessageType.EXCEPTION;" << endl
               << indent() << "msg = new "
                              "org.apache.thrift.TApplicationException(org.apache.thrift."
                              "TApplicationException.INTERNAL_ERROR, e.getMessage());"
               << endl;
    indent_down();
    f_service_ << indent() << "}" << endl
               << indent() << "try {" << endl
               << indent() << "  fcall.sendResponse(fb,msg,msgType,seqid);" << endl
               << indent() << "} catch (java.lang.Exception ex) {" << endl
               << indent() << "  _LOGGER.error(\"Exception writing to internal frame buffer\", ex);"
               << endl
               << indent() << "  fb.close();" << endl
               << indent() << "}" << endl;
  }
  indent_down();
  indent(f_service_) << "}" << endl;
  indent_down();
  indent(f_service_) << "};" << endl;
  indent_down();
  indent(f_service_) << "}" << endl << endl;

  indent(f_service_) << "protected boolean isOneway() {" << endl;
  indent(f_service_) << "  return " << ((tfunction->is_oneway()) ? "true" : "false") << ";" << endl;
  indent(f_service_) << "}" << endl << endl;

  indent(f_service_) << "public void start(I iface, " << argsname
                     << " args, org.apache.thrift.async.AsyncMethodCallback<" << resulttype
                     << "> resultHandler) throws org.apache.thrift.TException {" << endl;
  indent_up();

  // Generate the function call
  t_struct* arg_struct = tfunction->get_arglist();
  const std::vector<t_field*>& fields = arg_struct->get_members();
  vector<t_field*>::const_iterator f_iter;
  f_service_ << indent();

  f_service_ << "iface." << get_rpc_method_name(tfunction->get_name()) << "(";
  bool first = true;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (first) {
      first = false;
    } else {
      f_service_ << ", ";
    }
    f_service_ << "args." << (*f_iter)->get_name();
  }
  if (!first)
    f_service_ << ",";
  f_service_ << "resultHandler";
  f_service_ << ");" << endl;

  indent_down();
  indent(f_service_) << "}";

  // Close function
  f_service_ << endl;

  // Close class
  indent_down();
  f_service_ << indent() << "}" << endl << endl;
}

/**
 * Generates a process function definition.
 *
 * @param tfunction The function to write a dispatcher for
 */
void t_java_generator::generate_process_function(t_service* tservice, t_function* tfunction) {
  string argsname = tfunction->get_name() + "_args";
  string resultname = tfunction->get_name() + "_result";
  if (tfunction->is_oneway()) {
    resultname = "org.apache.thrift.TBase";
  }

  (void)tservice;
  // Open class
  indent(f_service_) << "public static class " << tfunction->get_name()
                     << "<I extends Iface> extends org.apache.thrift.ProcessFunction<I, "
                     << argsname << "> {" << endl;
  indent_up();

  indent(f_service_) << "public " << tfunction->get_name() << "() {" << endl;
  indent(f_service_) << "  super(\"" << tfunction->get_name() << "\");" << endl;
  indent(f_service_) << "}" << endl << endl;

  indent(f_service_) << "public " << argsname << " getEmptyArgsInstance() {" << endl;
  indent(f_service_) << "  return new " << argsname << "();" << endl;
  indent(f_service_) << "}" << endl << endl;

  indent(f_service_) << "protected boolean isOneway() {" << endl;
  indent(f_service_) << "  return " << ((tfunction->is_oneway()) ? "true" : "false") << ";" << endl;
  indent(f_service_) << "}" << endl << endl;

  indent(f_service_) << "public " << resultname << " getResult(I iface, " << argsname
                     << " args) throws org.apache.thrift.TException {" << endl;
  indent_up();
  if (!tfunction->is_oneway()) {
    indent(f_service_) << resultname << " result = new " << resultname << "();" << endl;
  }

  t_struct* xs = tfunction->get_xceptions();
  const std::vector<t_field*>& xceptions = xs->get_members();
  vector<t_field*>::const_iterator x_iter;

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
  f_service_ << "iface." << get_rpc_method_name(tfunction->get_name()) << "(";
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
    indent(f_service_) << "result.set" << get_cap_name("success") << get_cap_name("isSet")
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
    f_service_ << endl;
  }

  if (tfunction->is_oneway()) {
    indent(f_service_) << "return null;" << endl;
  } else {
    indent(f_service_) << "return result;" << endl;
  }
  indent_down();
  indent(f_service_) << "}";

  // Close function
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
void t_java_generator::generate_deserialize_field(ofstream& out,
                                                  t_field* tfield,
                                                  string prefix,
                                                  bool has_metadata) {
  t_type* type = get_true_type(tfield->get_type());

  if (type->is_void()) {
    throw "CANNOT GENERATE DESERIALIZE CODE FOR void TYPE: " + prefix + tfield->get_name();
  }

  string name = prefix + tfield->get_name();

  if (type->is_struct() || type->is_xception()) {
    generate_deserialize_struct(out, (t_struct*)type, name);
  } else if (type->is_container()) {
    generate_deserialize_container(out, type, name, has_metadata);
  } else if (type->is_base_type()) {
    indent(out) << name << " = iprot.";

    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_VOID:
      throw "compiler error: cannot serialize void field in a struct: " + name;
      break;
    case t_base_type::TYPE_STRING:
      if (((t_base_type*)type)->is_binary()) {
        out << "readBinary();";
      } else {
        out << "readString();";
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
                << type_name(tfield->get_type(), true, false, false, true)
                   + ".findByValue(iprot.readI32());" << endl;
  } else {
    printf("DO NOT KNOW HOW TO DESERIALIZE FIELD '%s' TYPE '%s'\n",
           tfield->get_name().c_str(),
           type_name(type).c_str());
  }
}

/**
 * Generates an unserializer for a struct, invokes read()
 */
void t_java_generator::generate_deserialize_struct(ofstream& out,
                                                   t_struct* tstruct,
                                                   string prefix) {

  if (reuse_objects_) {
    indent(out) << "if (" << prefix << " == null) {" << endl;
    indent_up();
  }
  indent(out) << prefix << " = new " << type_name(tstruct) << "();" << endl;
  if (reuse_objects_) {
    indent_down();
    indent(out) << "}" << endl;
  }
  indent(out) << prefix << ".read(iprot);" << endl;
}

/**
 * Deserializes a container by reading its size and then iterating
 */
void t_java_generator::generate_deserialize_container(ofstream& out,
                                                      t_type* ttype,
                                                      string prefix,
                                                      bool has_metadata) {

  scope_up(out);

  string obj;

  if (ttype->is_map()) {
    obj = tmp("_map");
  } else if (ttype->is_set()) {
    obj = tmp("_set");
  } else if (ttype->is_list()) {
    obj = tmp("_list");
  }

  if (has_metadata) {
    // Declare variables, read header
    if (ttype->is_map()) {
      indent(out) << "org.apache.thrift.protocol.TMap " << obj << " = iprot.readMapBegin();"
                  << endl;
    } else if (ttype->is_set()) {
      indent(out) << "org.apache.thrift.protocol.TSet " << obj << " = iprot.readSetBegin();"
                  << endl;
    } else if (ttype->is_list()) {
      indent(out) << "org.apache.thrift.protocol.TList " << obj << " = iprot.readListBegin();"
                  << endl;
    }
  } else {
    // Declare variables, read header
    if (ttype->is_map()) {
      indent(out) << "org.apache.thrift.protocol.TMap " << obj
                  << " = new org.apache.thrift.protocol.TMap("
                  << type_to_enum(((t_map*)ttype)->get_key_type()) << ", "
                  << type_to_enum(((t_map*)ttype)->get_val_type()) << ", "
                  << "iprot.readI32());" << endl;
    } else if (ttype->is_set()) {
      indent(out) << "org.apache.thrift.protocol.TSet " << obj
                  << " = new org.apache.thrift.protocol.TSet("
                  << type_to_enum(((t_set*)ttype)->get_elem_type()) << ", iprot.readI32());"
                  << endl;
    } else if (ttype->is_list()) {
      indent(out) << "org.apache.thrift.protocol.TList " << obj
                  << " = new org.apache.thrift.protocol.TList("
                  << type_to_enum(((t_set*)ttype)->get_elem_type()) << ", iprot.readI32());"
                  << endl;
    }
  }

  if (reuse_objects_) {
    indent(out) << "if (" << prefix << " == null) {" << endl;
    indent_up();
  }

  out << indent() << prefix << " = new " << type_name(ttype, false, true);

  // size the collection correctly
  if (sorted_containers_ && (ttype->is_map() || ttype->is_set())) {
    // TreeSet and TreeMap don't have any constructor which takes a capactity as an argument
    out << "();" << endl;
  } else {
    out << "(" << (ttype->is_list() ? "" : "2*") << obj << ".size"
        << ");" << endl;
  }

  if (reuse_objects_) {
    indent_down();
    indent(out) << "}" << endl;
  }

  if (ttype->is_map()) {
    generate_deserialize_map_element(out, (t_map*)ttype, prefix, obj, has_metadata);
  } else if (ttype->is_set()) {
    generate_deserialize_set_element(out, (t_set*)ttype, prefix, obj, has_metadata);
  } else if (ttype->is_list()) {
    generate_deserialize_list_element(out, (t_list*)ttype, prefix, obj, has_metadata);
  }

  scope_down(out);

  if (has_metadata) {
    // Read container end
    if (ttype->is_map()) {
      indent(out) << "iprot.readMapEnd();" << endl;
    } else if (ttype->is_set()) {
      indent(out) << "iprot.readSetEnd();" << endl;
    } else if (ttype->is_list()) {
      indent(out) << "iprot.readListEnd();" << endl;
    }
  }
  scope_down(out);
}

/**
 * Generates code to deserialize a map
 */
void t_java_generator::generate_deserialize_map_element(ofstream& out,
                                                        t_map* tmap,
                                                        string prefix,
                                                        string obj,
                                                        bool has_metadata) {
  string key = tmp("_key");
  string val = tmp("_val");
  t_field fkey(tmap->get_key_type(), key);
  t_field fval(tmap->get_val_type(), val);

  indent(out) << declare_field(&fkey, reuse_objects_, false) << endl;
  indent(out) << declare_field(&fval, reuse_objects_, false) << endl;

  // For loop iterates over elements
  string i = tmp("_i");
  indent(out) << "for (int " << i << " = 0; " << i << " < " << obj << ".size"
              << "; "
              << "++" << i << ")" << endl;

  scope_up(out);

  generate_deserialize_field(out, &fkey, "", has_metadata);
  generate_deserialize_field(out, &fval, "", has_metadata);

  indent(out) << prefix << ".put(" << key << ", " << val << ");" << endl;

  if (reuse_objects_ && !get_true_type(fkey.get_type())->is_base_type()) {
    indent(out) << key << " = null;" << endl;
  }

  if (reuse_objects_ && !get_true_type(fval.get_type())->is_base_type()) {
    indent(out) << val << " = null;" << endl;
  }
}

/**
 * Deserializes a set element
 */
void t_java_generator::generate_deserialize_set_element(ofstream& out,
                                                        t_set* tset,
                                                        string prefix,
                                                        string obj,
                                                        bool has_metadata) {
  string elem = tmp("_elem");
  t_field felem(tset->get_elem_type(), elem);

  indent(out) << declare_field(&felem, reuse_objects_, false) << endl;

  // For loop iterates over elements
  string i = tmp("_i");
  indent(out) << "for (int " << i << " = 0; " << i << " < " << obj << ".size"
              << "; "
              << "++" << i << ")" << endl;
  scope_up(out);

  generate_deserialize_field(out, &felem, "", has_metadata);

  indent(out) << prefix << ".add(" << elem << ");" << endl;

  if (reuse_objects_ && !get_true_type(felem.get_type())->is_base_type()) {
    indent(out) << elem << " = null;" << endl;
  }
}

/**
 * Deserializes a list element
 */
void t_java_generator::generate_deserialize_list_element(ofstream& out,
                                                         t_list* tlist,
                                                         string prefix,
                                                         string obj,
                                                         bool has_metadata) {
  string elem = tmp("_elem");
  t_field felem(tlist->get_elem_type(), elem);

  indent(out) << declare_field(&felem, reuse_objects_, false) << endl;

  // For loop iterates over elements
  string i = tmp("_i");
  indent(out) << "for (int " << i << " = 0; " << i << " < " << obj << ".size"
              << "; "
              << "++" << i << ")" << endl;
  scope_up(out);

  generate_deserialize_field(out, &felem, "", has_metadata);

  indent(out) << prefix << ".add(" << elem << ");" << endl;

  if (reuse_objects_ && !get_true_type(felem.get_type())->is_base_type()) {
    indent(out) << elem << " = null;" << endl;
  }
}

/**
 * Serializes a field of any type.
 *
 * @param tfield The field to serialize
 * @param prefix Name to prepend to field name
 */
void t_java_generator::generate_serialize_field(ofstream& out,
                                                t_field* tfield,
                                                string prefix,
                                                bool has_metadata) {
  t_type* type = get_true_type(tfield->get_type());

  // Do nothing for void types
  if (type->is_void()) {
    throw "CANNOT GENERATE SERIALIZE CODE FOR void TYPE: " + prefix + tfield->get_name();
  }

  if (type->is_struct() || type->is_xception()) {
    generate_serialize_struct(out, (t_struct*)type, prefix + tfield->get_name());
  } else if (type->is_container()) {
    generate_serialize_container(out, type, prefix + tfield->get_name(), has_metadata);
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
      out << "writeI32(struct." << name << ");";
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
void t_java_generator::generate_serialize_struct(ofstream& out, t_struct* tstruct, string prefix) {
  (void)tstruct;
  out << indent() << prefix << ".write(oprot);" << endl;
}

/**
 * Serializes a container by writing its size then the elements.
 *
 * @param ttype  The type of container
 * @param prefix String prefix for fields
 */
void t_java_generator::generate_serialize_container(ofstream& out,
                                                    t_type* ttype,
                                                    string prefix,
                                                    bool has_metadata) {
  scope_up(out);

  if (has_metadata) {
    if (ttype->is_map()) {
      indent(out) << "oprot.writeMapBegin(new org.apache.thrift.protocol.TMap("
                  << type_to_enum(((t_map*)ttype)->get_key_type()) << ", "
                  << type_to_enum(((t_map*)ttype)->get_val_type()) << ", " << prefix << ".size()));"
                  << endl;
    } else if (ttype->is_set()) {
      indent(out) << "oprot.writeSetBegin(new org.apache.thrift.protocol.TSet("
                  << type_to_enum(((t_set*)ttype)->get_elem_type()) << ", " << prefix
                  << ".size()));" << endl;
    } else if (ttype->is_list()) {
      indent(out) << "oprot.writeListBegin(new org.apache.thrift.protocol.TList("
                  << type_to_enum(((t_list*)ttype)->get_elem_type()) << ", " << prefix
                  << ".size()));" << endl;
    }
  } else {
    indent(out) << "oprot.writeI32(" << prefix << ".size());" << endl;
  }

  string iter = tmp("_iter");
  if (ttype->is_map()) {
    indent(out) << "for (java.util.Map.Entry<" << type_name(((t_map*)ttype)->get_key_type(), true, false)
                << ", " << type_name(((t_map*)ttype)->get_val_type(), true, false) << "> " << iter
                << " : " << prefix << ".entrySet())";
  } else if (ttype->is_set()) {
    indent(out) << "for (" << type_name(((t_set*)ttype)->get_elem_type()) << " " << iter << " : "
                << prefix << ")";
  } else if (ttype->is_list()) {
    indent(out) << "for (" << type_name(((t_list*)ttype)->get_elem_type()) << " " << iter << " : "
                << prefix << ")";
  }

  out << endl;
  scope_up(out);
  if (ttype->is_map()) {
    generate_serialize_map_element(out, (t_map*)ttype, iter, prefix, has_metadata);
  } else if (ttype->is_set()) {
    generate_serialize_set_element(out, (t_set*)ttype, iter, has_metadata);
  } else if (ttype->is_list()) {
    generate_serialize_list_element(out, (t_list*)ttype, iter, has_metadata);
  }
  scope_down(out);

  if (has_metadata) {
    if (ttype->is_map()) {
      indent(out) << "oprot.writeMapEnd();" << endl;
    } else if (ttype->is_set()) {
      indent(out) << "oprot.writeSetEnd();" << endl;
    } else if (ttype->is_list()) {
      indent(out) << "oprot.writeListEnd();" << endl;
    }
  }

  scope_down(out);
}

/**
 * Serializes the members of a map.
 */
void t_java_generator::generate_serialize_map_element(ofstream& out,
                                                      t_map* tmap,
                                                      string iter,
                                                      string map,
                                                      bool has_metadata) {
  (void)map;
  t_field kfield(tmap->get_key_type(), iter + ".getKey()");
  generate_serialize_field(out, &kfield, "", has_metadata);
  t_field vfield(tmap->get_val_type(), iter + ".getValue()");
  generate_serialize_field(out, &vfield, "", has_metadata);
}

/**
 * Serializes the members of a set.
 */
void t_java_generator::generate_serialize_set_element(ofstream& out,
                                                      t_set* tset,
                                                      string iter,
                                                      bool has_metadata) {
  t_field efield(tset->get_elem_type(), iter);
  generate_serialize_field(out, &efield, "", has_metadata);
}

/**
 * Serializes the members of a list.
 */
void t_java_generator::generate_serialize_list_element(ofstream& out,
                                                       t_list* tlist,
                                                       string iter,
                                                       bool has_metadata) {
  t_field efield(tlist->get_elem_type(), iter);
  generate_serialize_field(out, &efield, "", has_metadata);
}

/**
 * Returns a Java type name
 *
 * @param ttype The type
 * @param container Is the type going inside a container?
 * @return Java type name, i.e. java.util.HashMap<Key,Value>
 */
string t_java_generator::type_name(t_type* ttype,
                                   bool in_container,
                                   bool in_init,
                                   bool skip_generic,
                                   bool force_namespace) {
  // In Java typedefs are just resolved to their real type
  ttype = get_true_type(ttype);
  string prefix;

  if (ttype->is_base_type()) {
    return base_type_name((t_base_type*)ttype, in_container);
  } else if (ttype->is_map()) {
    t_map* tmap = (t_map*)ttype;
    if (in_init) {
      if (sorted_containers_) {
        prefix = "java.util.TreeMap";
      } else {
        prefix = "java.util.HashMap";
      }
    } else {
      prefix = "java.util.Map";
    }
    return prefix + (skip_generic ? "" : "<" + type_name(tmap->get_key_type(), true) + ","
                                         + type_name(tmap->get_val_type(), true) + ">");
  } else if (ttype->is_set()) {
    t_set* tset = (t_set*)ttype;
    if (in_init) {
      if (sorted_containers_) {
        prefix = "java.util.TreeSet";
      } else {
        prefix = "java.util.HashSet";
      }
    } else {
      prefix = "java.util.Set";
    }
    return prefix + (skip_generic ? "" : "<" + type_name(tset->get_elem_type(), true) + ">");
  } else if (ttype->is_list()) {
    t_list* tlist = (t_list*)ttype;
    if (in_init) {
      prefix = "java.util.ArrayList";
    } else {
      prefix = "java.util.List";
    }
    return prefix + (skip_generic ? "" : "<" + type_name(tlist->get_elem_type(), true) + ">");
  }

  // Check for namespacing
  t_program* program = ttype->get_program();
  if ((program != NULL) && ((program != program_) || force_namespace)) {
    string package = program->get_namespace("java");
    if (!package.empty()) {
      return package + "." + ttype->get_name();
    }
  }

  return ttype->get_name();
}

/**
 * Returns the Java type that corresponds to the thrift type.
 *
 * @param tbase The base type
 * @param container Is it going in a Java container?
 */
string t_java_generator::base_type_name(t_base_type* type, bool in_container) {
  t_base_type::t_base tbase = type->get_base();

  switch (tbase) {
  case t_base_type::TYPE_VOID:
    return (in_container ? "Void" : "void");
  case t_base_type::TYPE_STRING:
    if (type->is_binary()) {
      return "java.nio.ByteBuffer";
    } else {
      return "java.lang.String";
    }
  case t_base_type::TYPE_BOOL:
    return (in_container ? "java.lang.Boolean" : "boolean");
  case t_base_type::TYPE_I8:
    return (in_container ? "java.lang.Byte" : "byte");
  case t_base_type::TYPE_I16:
    return (in_container ? "java.lang.Short" : "short");
  case t_base_type::TYPE_I32:
    return (in_container ? "java.lang.Integer" : "int");
  case t_base_type::TYPE_I64:
    return (in_container ? "java.lang.Long" : "long");
  case t_base_type::TYPE_DOUBLE:
    return (in_container ? "java.lang.Double" : "double");
  default:
    throw "compiler error: no Java name for base type " + t_base_type::t_base_name(tbase);
  }
}

/**
 * Declares a field, which may include initialization as necessary.
 *
 * @param tfield The field
 * @param init Whether to initialize the field
 */
string t_java_generator::declare_field(t_field* tfield, bool init, bool comment) {
  // TODO(mcslee): do we ever need to initialize the field?
  string result = type_name(tfield->get_type()) + " " + tfield->get_name();
  if (init) {
    t_type* ttype = get_true_type(tfield->get_type());
    if (ttype->is_base_type() && tfield->get_value() != NULL) {
      ofstream dummy;
      result += " = " + render_const_value(dummy, ttype, tfield->get_value());
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
      result += " = null";
    } else if (ttype->is_container()) {
      result += " = new " + type_name(ttype, false, true) + "()";
    } else {
      result += " = new " + type_name(ttype, false, true) + "()";
      ;
    }
  }
  result += ";";
  if (comment) {
    result += " // ";
    if (tfield->get_req() == t_field::T_OPTIONAL) {
      result += "optional";
    } else {
      result += "required";
    }
  }
  return result;
}

/**
 * Renders a function signature of the form 'type name(args)'
 *
 * @param tfunction Function definition
 * @return String of rendered function definition
 */
string t_java_generator::function_signature(t_function* tfunction, string prefix) {
  t_type* ttype = tfunction->get_returntype();
  std::string fn_name = get_rpc_method_name(tfunction->get_name());
  std::string result = type_name(ttype) + " " + prefix + fn_name + "("
                       + argument_list(tfunction->get_arglist()) + ") throws ";
  t_struct* xs = tfunction->get_xceptions();
  const std::vector<t_field*>& xceptions = xs->get_members();
  vector<t_field*>::const_iterator x_iter;
  for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
    result += type_name((*x_iter)->get_type(), false, false) + ", ";
  }
  result += "org.apache.thrift.TException";
  return result;
}

/**
 * Renders a function signature of the form 'void name(args, resultHandler)'
 *
 * @params tfunction Function definition
 * @return String of rendered function definition
 */
string t_java_generator::function_signature_async(t_function* tfunction,
                                                  bool use_base_method,
                                                  string prefix) {
  std::string arglist = async_function_call_arglist(tfunction, use_base_method, true);

  std::string ret_type = "";
  if (use_base_method) {
    ret_type += "AsyncClient.";
  }
  ret_type += tfunction->get_name() + "_call";

  std::string fn_name = get_rpc_method_name(tfunction->get_name());

  std::string result = prefix + "void " + fn_name + "(" + arglist + ")";
  return result;
}

string t_java_generator::async_function_call_arglist(t_function* tfunc,
                                                     bool use_base_method,
                                                     bool include_types) {
  (void)use_base_method;
  std::string arglist = "";
  if (tfunc->get_arglist()->get_members().size() > 0) {
    arglist = argument_list(tfunc->get_arglist(), include_types) + ", ";
  }

  if (include_types) {
    arglist += "org.apache.thrift.async.AsyncMethodCallback<";
    arglist += type_name(tfunc->get_returntype(), true) + "> ";
  }
  arglist += "resultHandler";

  return arglist;
}

/**
 * Renders a comma separated field list, with type names
 */
string t_java_generator::argument_list(t_struct* tstruct, bool include_types) {
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

string t_java_generator::async_argument_list(t_function* tfunct,
                                             t_struct* tstruct,
                                             t_type* ttype,
                                             bool include_types) {
  (void)tfunct;
  (void)ttype;
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
  if (!first) {
    result += ", ";
  }
  if (include_types) {
    result += "org.apache.thrift.async.AsyncMethodCallback<";
    result += type_name(tfunct->get_returntype(), true) + "> ";
  }
  result += "resultHandler";
  return result;
}

/**
 * Converts the parse type to a Java enum string for the given type.
 */
string t_java_generator::type_to_enum(t_type* type) {
  type = get_true_type(type);

  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_VOID:
      throw "NO T_VOID CONSTRUCT";
    case t_base_type::TYPE_STRING:
      return "org.apache.thrift.protocol.TType.STRING";
    case t_base_type::TYPE_BOOL:
      return "org.apache.thrift.protocol.TType.BOOL";
    case t_base_type::TYPE_I8:
      return "org.apache.thrift.protocol.TType.BYTE";
    case t_base_type::TYPE_I16:
      return "org.apache.thrift.protocol.TType.I16";
    case t_base_type::TYPE_I32:
      return "org.apache.thrift.protocol.TType.I32";
    case t_base_type::TYPE_I64:
      return "org.apache.thrift.protocol.TType.I64";
    case t_base_type::TYPE_DOUBLE:
      return "org.apache.thrift.protocol.TType.DOUBLE";
    }
  } else if (type->is_enum()) {
    return "org.apache.thrift.protocol.TType.I32";
  } else if (type->is_struct() || type->is_xception()) {
    return "org.apache.thrift.protocol.TType.STRUCT";
  } else if (type->is_map()) {
    return "org.apache.thrift.protocol.TType.MAP";
  } else if (type->is_set()) {
    return "org.apache.thrift.protocol.TType.SET";
  } else if (type->is_list()) {
    return "org.apache.thrift.protocol.TType.LIST";
  }

  throw "INVALID TYPE IN type_to_enum: " + type->get_name();
}

/**
 * Takes a name and produes a valid Java source file name from it
 *
 * @param fromName The name which shall become a valid Java source file name
 * @return The produced identifier
 */
std::string t_java_generator::make_valid_java_filename(std::string const& fromName) {
  // if any further rules apply to source file names in Java, modify as necessary
  return make_valid_java_identifier(fromName);
}

/**
 * Takes a name and produes a valid Java identifier from it
 *
 * @param fromName The name which shall become a valid Java identifier
 * @return The produced identifier
 */
std::string t_java_generator::make_valid_java_identifier(std::string const& fromName) {
  std::string str = fromName;
  if (str.empty()) {
    return str;
  }

  // tests rely on this
  assert(('A' < 'Z') && ('a' < 'z') && ('0' < '9'));

  // if the first letter is a number, we add an additional underscore in front of it
  char c = str.at(0);
  if (('0' <= c) && (c <= '9')) {
    str = "_" + str;
  }

  // following chars: letter, number or underscore
  for (size_t i = 0; i < str.size(); ++i) {
    c = str.at(i);
    if ((('A' > c) || (c > 'Z')) && (('a' > c) || (c > 'z')) && (('0' > c) || (c > '9'))
        && ('_' != c)) {
      str.replace(i, 1, "_");
    }
  }

  return str;
}

std::string t_java_generator::as_camel_case(std::string name, bool ucfirst) {
  std::string new_name;
  size_t i = 0;
  for (i = 0; i < name.size(); i++) {
    if (name[i] != '_')
      break;
  }
  if (ucfirst) {
    new_name += toupper(name[i++]);
  } else {
    new_name += tolower(name[i++]);
  }
  for (; i < name.size(); i++) {
    if (name[i] == '_') {
      if (i < name.size() - 1) {
        i++;
        new_name += toupper(name[i]);
      }
    } else {
      new_name += name[i];
    }
  }
  return new_name;
}

std::string t_java_generator::get_rpc_method_name(std::string name) {
  if (fullcamel_style_) {
    return as_camel_case(name, false);
  } else {
    return name;
  }
}

/**
 * Applies the correct style to a string based on the value of nocamel_style_
 * and/or fullcamel_style_
 */
std::string t_java_generator::get_cap_name(std::string name) {
  if (nocamel_style_) {
    return "_" + name;
  } else if (fullcamel_style_) {
    return as_camel_case(name);
  } else {
    name[0] = toupper(name[0]);
    return name;
  }
}

string t_java_generator::constant_name(string name) {
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

void t_java_generator::generate_deep_copy_container(ofstream& out,
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

  bool copy_construct_container;
  if (container->is_map()) {
    t_map* tmap = (t_map*)container;
    copy_construct_container = tmap->get_key_type()->is_base_type()
                               && tmap->get_val_type()->is_base_type();
  } else {
    t_type* elem_type = container->is_list() ? ((t_list*)container)->get_elem_type()
                                             : ((t_set*)container)->get_elem_type();
    copy_construct_container = elem_type->is_base_type();
  }

  if (copy_construct_container) {
    // deep copy of base types can be done much more efficiently than iterating over all the
    // elements manually
    indent(out) << type_name(type, true, false) << " " << result_name << " = new "
                << type_name(container, false, true) << "(" << source_name << ");" << endl;
    return;
  }

  std::string capacity;
  if (!(sorted_containers_ && (container->is_map() || container->is_set()))) {
    // unsorted containers accept a capacity value
    capacity = source_name + ".size()";
  }
  indent(out) << type_name(type, true, false) << " " << result_name << " = new "
              << type_name(container, false, true) << "(" << capacity << ");" << endl;

  std::string iterator_element_name = source_name_p1 + "_element";
  std::string result_element_name = result_name + "_copy";

  if (container->is_map()) {
    t_type* key_type = ((t_map*)container)->get_key_type();
    t_type* val_type = ((t_map*)container)->get_val_type();

    indent(out) << "for (java.util.Map.Entry<" << type_name(key_type, true, false) << ", "
                << type_name(val_type, true, false) << "> " << iterator_element_name << " : "
                << source_name << ".entrySet()) {" << endl;
    indent_up();

    out << endl;

    indent(out) << type_name(key_type, true, false) << " " << iterator_element_name
                << "_key = " << iterator_element_name << ".getKey();" << endl;
    indent(out) << type_name(val_type, true, false) << " " << iterator_element_name
                << "_value = " << iterator_element_name << ".getValue();" << endl;

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

    indent(out) << "for (" << type_name(elem_type, true, false) << " " << iterator_element_name
                << " : " << source_name << ") {" << endl;

    indent_up();

    if (elem_type->is_container()) {
      // recursive deep copy
      generate_deep_copy_container(out, iterator_element_name, "", result_element_name, elem_type);
      indent(out) << result_name << ".add(" << result_element_name << ");" << endl;
    } else {
      // iterative copy
      if (((t_base_type*)elem_type)->is_binary()) {
        indent(out) << "java.nio.ByteBuffer temp_binary_element = ";
        generate_deep_copy_non_container(out,
                                         iterator_element_name,
                                         "temp_binary_element",
                                         elem_type);
        out << ";" << endl;
        indent(out) << result_name << ".add(temp_binary_element);" << endl;
      } else {
        indent(out) << result_name << ".add(";
        generate_deep_copy_non_container(out, iterator_element_name, result_name, elem_type);
        out << ");" << endl;
      }
    }

    indent_down();

    indent(out) << "}" << endl;
  }
}

void t_java_generator::generate_deep_copy_non_container(ofstream& out,
                                                        std::string source_name,
                                                        std::string dest_name,
                                                        t_type* type) {
  (void)dest_name;
  if (type->is_base_type() || type->is_enum() || type->is_typedef()) {
    if (((t_base_type*)type)->is_binary()) {
      out << "org.apache.thrift.TBaseHelper.copyBinary(" << source_name << ")";
    } else {
      // everything else can be copied directly
      out << source_name;
    }
  } else {
    out << "new " << type_name(type, true, true) << "(" << source_name << ")";
  }
}

std::string t_java_generator::generate_isset_check(t_field* field) {
  return generate_isset_check(field->get_name());
}

std::string t_java_generator::isset_field_id(t_field* field) {
  return "__" + upcase_string(field->get_name() + "_isset_id");
}

std::string t_java_generator::generate_isset_check(std::string field_name) {
  return "is" + get_cap_name("set") + get_cap_name(field_name) + "()";
}

void t_java_generator::generate_isset_set(ofstream& out, t_field* field, string prefix) {
  if (!type_can_be_null(field->get_type())) {
    indent(out) << prefix << "set" << get_cap_name(field->get_name()) << get_cap_name("isSet")
                << "(true);" << endl;
  }
}

void t_java_generator::generate_struct_desc(ofstream& out, t_struct* tstruct) {
  indent(out) << "private static final org.apache.thrift.protocol.TStruct STRUCT_DESC = new "
                 "org.apache.thrift.protocol.TStruct(\"" << tstruct->get_name() << "\");" << endl;
}

void t_java_generator::generate_field_descs(ofstream& out, t_struct* tstruct) {
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    indent(out) << "private static final org.apache.thrift.protocol.TField "
                << constant_name((*m_iter)->get_name())
                << "_FIELD_DESC = new org.apache.thrift.protocol.TField(\"" << (*m_iter)->get_name()
                << "\", " << type_to_enum((*m_iter)->get_type()) << ", "
                << "(short)" << (*m_iter)->get_key() << ");" << endl;
  }
}

void t_java_generator::generate_scheme_map(ofstream& out, t_struct* tstruct) {
  indent(out) << "private static final org.apache.thrift.scheme.SchemeFactory STANDARD_SCHEME_FACTORY = new "
      << tstruct->get_name() << "StandardSchemeFactory();" << endl;
  indent(out) << "private static final org.apache.thrift.scheme.SchemeFactory TUPLE_SCHEME_FACTORY = new "
      << tstruct->get_name() << "TupleSchemeFactory();" << endl;
}

void t_java_generator::generate_field_name_constants(ofstream& out, t_struct* tstruct) {
  indent(out) << "/** The set of fields this struct contains, along with convenience methods for "
                 "finding and manipulating them. */" << endl;
  indent(out) << "public enum _Fields implements org.apache.thrift.TFieldIdEnum {" << endl;

  indent_up();
  bool first = true;
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    if (!first) {
      out << "," << endl;
    }
    first = false;
    generate_java_doc(out, *m_iter);
    indent(out) << constant_name((*m_iter)->get_name()) << "((short)" << (*m_iter)->get_key()
                << ", \"" << (*m_iter)->get_name() << "\")";
  }

  out << ";" << endl << endl;

  indent(out)
      << "private static final java.util.Map<java.lang.String, _Fields> byName = new java.util.HashMap<java.lang.String, _Fields>();"
      << endl;
  out << endl;

  indent(out) << "static {" << endl;
  indent(out) << "  for (_Fields field : java.util.EnumSet.allOf(_Fields.class)) {" << endl;
  indent(out) << "    byName.put(field.getFieldName(), field);" << endl;
  indent(out) << "  }" << endl;
  indent(out) << "}" << endl << endl;

  indent(out) << "/**" << endl;
  indent(out) << " * Find the _Fields constant that matches fieldId, or null if its not found."
              << endl;
  indent(out) << " */" << endl;
  indent(out) << "public static _Fields findByThriftId(int fieldId) {" << endl;
  indent_up();
  indent(out) << "switch(fieldId) {" << endl;
  indent_up();

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    indent(out) << "case " << (*m_iter)->get_key() << ": // "
                << constant_name((*m_iter)->get_name()) << endl;
    indent(out) << "  return " << constant_name((*m_iter)->get_name()) << ";" << endl;
  }

  indent(out) << "default:" << endl;
  indent(out) << "  return null;" << endl;

  indent_down();
  indent(out) << "}" << endl;

  indent_down();
  indent(out) << "}" << endl << endl;

  indent(out) << "/**" << endl;
  indent(out) << " * Find the _Fields constant that matches fieldId, throwing an exception" << endl;
  indent(out) << " * if it is not found." << endl;
  indent(out) << " */" << endl;
  indent(out) << "public static _Fields findByThriftIdOrThrow(int fieldId) {" << endl;
  indent(out) << "  _Fields fields = findByThriftId(fieldId);" << endl;
  indent(out) << "  if (fields == null) throw new java.lang.IllegalArgumentException(\"Field \" + fieldId + "
                 "\" doesn't exist!\");" << endl;
  indent(out) << "  return fields;" << endl;
  indent(out) << "}" << endl << endl;

  indent(out) << "/**" << endl;
  indent(out) << " * Find the _Fields constant that matches name, or null if its not found."
              << endl;
  indent(out) << " */" << endl;
  indent(out) << "public static _Fields findByName(java.lang.String name) {" << endl;
  indent(out) << "  return byName.get(name);" << endl;
  indent(out) << "}" << endl << endl;

  indent(out) << "private final short _thriftId;" << endl;
  indent(out) << "private final java.lang.String _fieldName;" << endl << endl;

  indent(out) << "_Fields(short thriftId, java.lang.String fieldName) {" << endl;
  indent(out) << "  _thriftId = thriftId;" << endl;
  indent(out) << "  _fieldName = fieldName;" << endl;
  indent(out) << "}" << endl << endl;

  indent(out) << "public short getThriftFieldId() {" << endl;
  indent(out) << "  return _thriftId;" << endl;
  indent(out) << "}" << endl << endl;

  indent(out) << "public java.lang.String getFieldName() {" << endl;
  indent(out) << "  return _fieldName;" << endl;
  indent(out) << "}" << endl;

  indent_down();

  indent(out) << "}" << endl;
}

t_java_generator::isset_type t_java_generator::needs_isset(t_struct* tstruct,
                                                           std::string* outPrimitiveType) {
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  int count = 0;
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    if (!type_can_be_null(get_true_type((*m_iter)->get_type()))) {
      count++;
    }
  }
  if (count == 0) {
    return ISSET_NONE;
  } else if (count <= 64) {
    if (outPrimitiveType != NULL) {
      if (count <= 8)
        *outPrimitiveType = "byte";
      else if (count <= 16)
        *outPrimitiveType = "short";
      else if (count <= 32)
        *outPrimitiveType = "int";
      else if (count <= 64)
        *outPrimitiveType = "long";
    }
    return ISSET_PRIMITIVE;
  } else {
    return ISSET_BITSET;
  }
}

void t_java_generator::generate_java_struct_clear(std::ofstream& out, t_struct* tstruct) {
  if (!java5_) {
    indent(out) << "@Override" << endl;
  }
  indent(out) << "public void clear() {" << endl;

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  indent_up();
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_field* field = *m_iter;
    t_type* t = get_true_type(field->get_type());

    if (field->get_value() != NULL) {
      print_const_value(out, "this." + field->get_name(), t, field->get_value(), true, true);
      continue;
    }

    if (type_can_be_null(t)) {

      if (reuse_objects_ && (t->is_container() || t->is_struct())) {
        indent(out) << "if (this." << field->get_name() << " != null) {" << endl;
        indent_up();
        indent(out) << "this." << field->get_name() << ".clear();" << endl;
        indent_down();
        indent(out) << "}" << endl;

      } else {

        indent(out) << "this." << field->get_name() << " = null;" << endl;
      }
      continue;
    }

    // must be a base type
    // means it also needs to be explicitly unset
    indent(out) << "set" << get_cap_name(field->get_name()) << get_cap_name("isSet") << "(false);"
                << endl;
    t_base_type* base_type = (t_base_type*)t;

    switch (base_type->get_base()) {
    case t_base_type::TYPE_I8:
    case t_base_type::TYPE_I16:
    case t_base_type::TYPE_I32:
    case t_base_type::TYPE_I64:
      indent(out) << "this." << field->get_name() << " = 0;" << endl;
      break;
    case t_base_type::TYPE_DOUBLE:
      indent(out) << "this." << field->get_name() << " = 0.0;" << endl;
      break;
    case t_base_type::TYPE_BOOL:
      indent(out) << "this." << field->get_name() << " = false;" << endl;
      break;
    default:
      throw "unsupported type: " + base_type->get_name() + " for field " + field->get_name();
    }
  }
  indent_down();

  indent(out) << "}" << endl << endl;
}

// generates java method to serialize (in the Java sense) the object
void t_java_generator::generate_java_struct_write_object(ofstream& out, t_struct* tstruct) {
  (void)tstruct;
  indent(out)
      << "private void writeObject(java.io.ObjectOutputStream out) throws java.io.IOException {"
      << endl;
  indent(out) << "  try {" << endl;
  indent(out) << "    write(new org.apache.thrift.protocol.TCompactProtocol(new "
                 "org.apache.thrift.transport.TIOStreamTransport(out)));" << endl;
  indent(out) << "  } catch (org.apache.thrift.TException te) {" << endl;
  indent(out) << "    throw new java.io.IOException(te" << (android_legacy_ ? ".getMessage()" : "")
              << ");" << endl;
  indent(out) << "  }" << endl;
  indent(out) << "}" << endl << endl;
}

// generates java method to serialize (in the Java sense) the object
void t_java_generator::generate_java_struct_read_object(ofstream& out, t_struct* tstruct) {
  indent(out) << "private void readObject(java.io.ObjectInputStream in) throws "
                 "java.io.IOException, java.lang.ClassNotFoundException {" << endl;
  indent(out) << "  try {" << endl;
  if (!tstruct->is_union()) {
    switch (needs_isset(tstruct)) {
    case ISSET_NONE:
      break;
    case ISSET_PRIMITIVE:
      indent(out) << "    // it doesn't seem like you should have to do this, but java "
                     "serialization is wacky, and doesn't call the default constructor." << endl;
      indent(out) << "    __isset_bitfield = 0;" << endl;
      break;
    case ISSET_BITSET:
      indent(out) << "    // it doesn't seem like you should have to do this, but java "
                     "serialization is wacky, and doesn't call the default constructor." << endl;
      indent(out) << "    __isset_bit_vector = new java.util.BitSet(1);" << endl;
      break;
    }
  }
  indent(out) << "    read(new org.apache.thrift.protocol.TCompactProtocol(new "
                 "org.apache.thrift.transport.TIOStreamTransport(in)));" << endl;
  indent(out) << "  } catch (org.apache.thrift.TException te) {" << endl;
  indent(out) << "    throw new java.io.IOException(te" << (android_legacy_ ? ".getMessage()" : "")
              << ");" << endl;
  indent(out) << "  }" << endl;
  indent(out) << "}" << endl << endl;
}

void t_java_generator::generate_standard_reader(ofstream& out, t_struct* tstruct) {
  out << indent() << "public void read(org.apache.thrift.protocol.TProtocol iprot, "
      << tstruct->get_name() << " struct) throws org.apache.thrift.TException {" << endl;
  indent_up();

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  // Declare stack tmp variables and read struct header
  out << indent() << "org.apache.thrift.protocol.TField schemeField;" << endl << indent()
      << "iprot.readStructBegin();" << endl;

  // Loop over reading in fields
  indent(out) << "while (true)" << endl;
  scope_up(out);

  // Read beginning field marker
  indent(out) << "schemeField = iprot.readFieldBegin();" << endl;

  // Check for field STOP marker and break
  indent(out) << "if (schemeField.type == org.apache.thrift.protocol.TType.STOP) { " << endl;
  indent_up();
  indent(out) << "break;" << endl;
  indent_down();
  indent(out) << "}" << endl;

  // Switch statement on the field we are reading
  indent(out) << "switch (schemeField.id) {" << endl;

  indent_up();

  // Generate deserialization code for known cases
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    indent(out) << "case " << (*f_iter)->get_key() << ": // "
                << constant_name((*f_iter)->get_name()) << endl;
    indent_up();
    indent(out) << "if (schemeField.type == " << type_to_enum((*f_iter)->get_type()) << ") {"
                << endl;
    indent_up();

    generate_deserialize_field(out, *f_iter, "struct.", true);
    indent(out) << "struct."
                << "set" << get_cap_name((*f_iter)->get_name()) << get_cap_name("isSet")
                << "(true);" << endl;
    indent_down();
    out << indent() << "} else { " << endl << indent()
        << "  org.apache.thrift.protocol.TProtocolUtil.skip(iprot, schemeField.type);" << endl
        << indent() << "}" << endl << indent() << "break;" << endl;
    indent_down();
  }

  indent(out) << "default:" << endl;
  indent(out) << "  org.apache.thrift.protocol.TProtocolUtil.skip(iprot, schemeField.type);"
              << endl;

  indent_down();
  indent(out) << "}" << endl;

  // Read field end marker
  indent(out) << "iprot.readFieldEnd();" << endl;

  indent_down();
  indent(out) << "}" << endl;

  out << indent() << "iprot.readStructEnd();" << endl;

  // in non-beans style, check for required fields of primitive type
  // (which can be checked here but not in the general validate method)
  if (!bean_style_) {
    out << endl << indent() << "// check for required fields of primitive type, which can't be "
                               "checked in the validate method" << endl;
    for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
      if ((*f_iter)->get_req() == t_field::T_REQUIRED && !type_can_be_null((*f_iter)->get_type())) {
        out << indent() << "if (!struct." << generate_isset_check(*f_iter) << ") {" << endl
            << indent()
            << "  throw new org.apache.thrift.protocol.TProtocolException(\"Required field '"
            << (*f_iter)->get_name()
            << "' was not found in serialized data! Struct: \" + toString());" << endl << indent()
            << "}" << endl;
      }
    }
  }

  // performs various checks (e.g. check that all required fields are set)
  indent(out) << "struct.validate();" << endl;

  indent_down();
  out << indent() << "}" << endl;
}

void t_java_generator::generate_standard_writer(ofstream& out, t_struct* tstruct, bool is_result) {
  indent_up();
  out << indent() << "public void write(org.apache.thrift.protocol.TProtocol oprot, "
      << tstruct->get_name() << " struct) throws org.apache.thrift.TException {" << endl;
  indent_up();
  const vector<t_field*>& fields = tstruct->get_sorted_members();
  vector<t_field*>::const_iterator f_iter;

  // performs various checks (e.g. check that all required fields are set)
  indent(out) << "struct.validate();" << endl << endl;

  indent(out) << "oprot.writeStructBegin(STRUCT_DESC);" << endl;

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    bool null_allowed = type_can_be_null((*f_iter)->get_type());
    if (null_allowed) {
      out << indent() << "if (struct." << (*f_iter)->get_name() << " != null) {" << endl;
      indent_up();
    }
    bool optional = ((*f_iter)->get_req() == t_field::T_OPTIONAL) || (is_result && !null_allowed);
    if (optional) {
      indent(out) << "if ("
                  << "struct." << generate_isset_check((*f_iter)) << ") {" << endl;
      indent_up();
    }

    indent(out) << "oprot.writeFieldBegin(" << constant_name((*f_iter)->get_name())
                << "_FIELD_DESC);" << endl;

    // Write field contents
    generate_serialize_field(out, *f_iter, "struct.", true);

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
  indent_down();
}

void t_java_generator::generate_java_struct_standard_scheme(ofstream& out,
                                                            t_struct* tstruct,
                                                            bool is_result) {
  indent(out) << "private static class " << tstruct->get_name()
              << "StandardSchemeFactory implements org.apache.thrift.scheme.SchemeFactory {" << endl;
  indent_up();
  indent(out) << "public " << tstruct->get_name() << "StandardScheme getScheme() {" << endl;
  indent_up();
  indent(out) << "return new " << tstruct->get_name() << "StandardScheme();" << endl;
  indent_down();
  indent(out) << "}" << endl;
  indent_down();
  indent(out) << "}" << endl << endl;

  out << indent() << "private static class " << tstruct->get_name()
      << "StandardScheme extends org.apache.thrift.scheme.StandardScheme<" << tstruct->get_name() << "> {" << endl << endl;
  indent_up();
  generate_standard_reader(out, tstruct);
  indent_down();
  out << endl;
  generate_standard_writer(out, tstruct, is_result);

  out << indent() << "}" << endl << endl;
}

void t_java_generator::generate_java_struct_tuple_reader(ofstream& out, t_struct* tstruct) {
  indent(out) << "@Override" << endl;
  indent(out) << "public void read(org.apache.thrift.protocol.TProtocol prot, "
              << tstruct->get_name() << " struct) throws org.apache.thrift.TException {" << endl;
  indent_up();
  indent(out) << "org.apache.thrift.protocol.TTupleProtocol iprot = (org.apache.thrift.protocol.TTupleProtocol) prot;" << endl;
  int optional_count = 0;
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if ((*f_iter)->get_req() == t_field::T_OPTIONAL
        || (*f_iter)->get_req() == t_field::T_OPT_IN_REQ_OUT) {
      optional_count++;
    }
    if ((*f_iter)->get_req() == t_field::T_REQUIRED) {
      generate_deserialize_field(out, (*f_iter), "struct.", false);
      indent(out) << "struct.set" << get_cap_name((*f_iter)->get_name()) << get_cap_name("isSet")
                  << "(true);" << endl;
    }
  }
  if (optional_count > 0) {
    indent(out) << "java.util.BitSet incoming = iprot.readBitSet(" << optional_count << ");" << endl;
    int i = 0;
    for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
      if ((*f_iter)->get_req() == t_field::T_OPTIONAL
          || (*f_iter)->get_req() == t_field::T_OPT_IN_REQ_OUT) {
        indent(out) << "if (incoming.get(" << i << ")) {" << endl;
        indent_up();
        generate_deserialize_field(out, (*f_iter), "struct.", false);
        indent(out) << "struct.set" << get_cap_name((*f_iter)->get_name()) << get_cap_name("isSet")
                    << "(true);" << endl;
        indent_down();
        indent(out) << "}" << endl;
        i++;
      }
    }
  }
  indent_down();
  indent(out) << "}" << endl;
}

void t_java_generator::generate_java_struct_tuple_writer(ofstream& out, t_struct* tstruct) {
  indent(out) << "@Override" << endl;
  indent(out) << "public void write(org.apache.thrift.protocol.TProtocol prot, "
              << tstruct->get_name() << " struct) throws org.apache.thrift.TException {" << endl;
  indent_up();
  indent(out) << "org.apache.thrift.protocol.TTupleProtocol oprot = (org.apache.thrift.protocol.TTupleProtocol) prot;" << endl;

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  bool has_optional = false;
  int optional_count = 0;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if ((*f_iter)->get_req() == t_field::T_OPTIONAL
        || (*f_iter)->get_req() == t_field::T_OPT_IN_REQ_OUT) {
      optional_count++;
      has_optional = true;
    }
    if ((*f_iter)->get_req() == t_field::T_REQUIRED) {
      generate_serialize_field(out, (*f_iter), "struct.", false);
    }
  }
  if (has_optional) {
    indent(out) << "java.util.BitSet optionals = new java.util.BitSet();" << endl;
    int i = 0;
    for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
      if ((*f_iter)->get_req() == t_field::T_OPTIONAL
          || (*f_iter)->get_req() == t_field::T_OPT_IN_REQ_OUT) {
        indent(out) << "if (struct." << generate_isset_check((*f_iter)) << ") {" << endl;
        indent_up();
        indent(out) << "optionals.set(" << i << ");" << endl;
        indent_down();
        indent(out) << "}" << endl;
        i++;
      }
    }

    indent(out) << "oprot.writeBitSet(optionals, " << optional_count << ");" << endl;
    int j = 0;
    for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
      if ((*f_iter)->get_req() == t_field::T_OPTIONAL
          || (*f_iter)->get_req() == t_field::T_OPT_IN_REQ_OUT) {
        indent(out) << "if (struct." << generate_isset_check(*f_iter) << ") {" << endl;
        indent_up();
        generate_serialize_field(out, (*f_iter), "struct.", false);
        indent_down();
        indent(out) << "}" << endl;
        j++;
      }
    }
  }
  indent_down();
  indent(out) << "}" << endl;
}

void t_java_generator::generate_java_struct_tuple_scheme(ofstream& out, t_struct* tstruct) {
  indent(out) << "private static class " << tstruct->get_name()
              << "TupleSchemeFactory implements org.apache.thrift.scheme.SchemeFactory {" << endl;
  indent_up();
  indent(out) << "public " << tstruct->get_name() << "TupleScheme getScheme() {" << endl;
  indent_up();
  indent(out) << "return new " << tstruct->get_name() << "TupleScheme();" << endl;
  indent_down();
  indent(out) << "}" << endl;
  indent_down();
  indent(out) << "}" << endl << endl;
  out << indent() << "private static class " << tstruct->get_name()
      << "TupleScheme extends org.apache.thrift.scheme.TupleScheme<" << tstruct->get_name() << "> {" << endl << endl;
  indent_up();
  generate_java_struct_tuple_writer(out, tstruct);
  out << endl;
  generate_java_struct_tuple_reader(out, tstruct);
  indent_down();
  out << indent() << "}" << endl << endl;
}

void t_java_generator::generate_java_scheme_lookup(ofstream& out) {
  indent(out) << "private static <S extends org.apache.thrift.scheme.IScheme> S scheme("
      << "org.apache.thrift.protocol.TProtocol proto) {" << endl;
  indent_up();
  indent(out) << "return (org.apache.thrift.scheme.StandardScheme.class.equals(proto.getScheme()) "
      << "? STANDARD_SCHEME_FACTORY "
      << ": TUPLE_SCHEME_FACTORY"
      << ").getScheme();" << endl;
  indent_down();
  indent(out) << "}" << endl;
}

void t_java_generator::generate_javax_generated_annotation(ofstream& out) {
  time_t seconds = time(NULL);
  struct tm* now = localtime(&seconds);
  indent(out) << "@javax.annotation.Generated(value = \"" << autogen_summary() << "\"";
  if (undated_generated_annotations_) {
    out << ")" << endl;
  } else {
    indent(out) << ", date = \"" << (now->tm_year + 1900) << "-" << setfill('0') << setw(2)
                << (now->tm_mon + 1) << "-" << setfill('0') << setw(2) << now->tm_mday
                << "\")" << endl;
  }
}

THRIFT_REGISTER_GENERATOR(
    java,
    "Java",
    "    beans:           Members will be private, and setter methods will return void.\n"
    "    private-members: Members will be private, but setter methods will return 'this' like "
    "usual.\n"
    "    nocamel:         Do not use CamelCase field accessors with beans.\n"
    "    fullcamel:       Convert underscored_accessor_or_service_names to camelCase.\n"
    "    android:         Generated structures are Parcelable.\n"
    "    android_legacy:  Do not use java.io.IOException(throwable) (available for Android 2.3 and "
    "above).\n"
    "    option_type:     Wrap optional fields in an Option type.\n"
    "    java5:           Generate Java 1.5 compliant code (includes android_legacy flag).\n"
    "    reuse-objects:   Data objects will not be allocated, but existing instances will be used "
    "(read and write).\n"
    "    sorted_containers:\n"
    "                     Use TreeSet/TreeMap instead of HashSet/HashMap as a implementation of "
    "set/map.\n"
    "    generated_annotations=[undated|suppress]:\n"
    "                     undated: suppress the date at @Generated annotations\n"
    "                     suppress: suppress @Generated annotations entirely\n")
