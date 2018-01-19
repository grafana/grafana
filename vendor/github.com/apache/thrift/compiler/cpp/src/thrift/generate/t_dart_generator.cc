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
static const string endl2 = "\n\n";

/**
 * Use the current Thrift version for static libraries.  When releasing, update
 * the version in these files.
 * - lib/dart/pubspec.yaml
 * - test/dart/test_client/pubspec.yaml
 * - tutorial/dart/client/pubspec.yaml
 * - tutorial/dart/console_client/pubspec.yaml
 * - tutorial/dart/server/pubspec.yaml
 * See https://thrift.apache.org/docs/committers/HowToVersion
 */
static const string dart_thrift_version = THRIFT_VERSION;

/* forward declarations */
string initial_caps_to_underscores(string name);

/**
 * Dart code generator
 *
 */
class t_dart_generator : public t_oop_generator {
public:
  t_dart_generator(t_program* program,
                  const std::map<std::string, std::string>& parsed_options,
                  const std::string& option_string)
    : t_oop_generator(program) {
    (void)option_string;
    std::map<std::string, std::string>::const_iterator iter;

    library_name_ = "";
    library_prefix_ = "";
    package_prefix_ = "";
    pubspec_lib_ = "";
    for( iter = parsed_options.begin(); iter != parsed_options.end(); ++iter) {
      if( iter->first.compare("library_name") == 0) {
        library_name_ = (iter->second);
      } else if( iter->first.compare("library_prefix") == 0) {
        library_prefix_ = (iter->second) + ".";
        package_prefix_ = replace_all(library_prefix_, ".", "/");
      } else if( iter->first.compare("pubspec_lib") == 0) {
        pubspec_lib_ = (iter->second);
      } else {
        throw "unknown option dart:" + iter->first;
      }
    }

    out_dir_base_ = "gen-dart";
  }

  void scope_up(std::ostream& out, std::string prefix=" ") {
    out << prefix << "{" << endl;
    indent_up();
  }

  void scope_down(std::ostream& out, std::string postfix=endl) {
    indent_down();
    indent(out) << "}" << postfix;
  }

  string replace_all(string contents, string search, string repl) {
    string str(contents);

    size_t slen = search.length();
    size_t rlen = repl.length();
    size_t incr = (rlen > 0) ? rlen : 1;

    if (slen > 0) {
      size_t found = str.find(search);
      while ((found != string::npos) && (found < str.length())) {
        str.replace(found, slen, repl);
        found = str.find(search, found + incr);
      }
    }

    return str;
  }


  /**
   * Init and close methods
   */

  void init_generator();
  void close_generator();

  void export_class_to_library(string file_name, string class_name);

  void generate_dart_library();
  void generate_dart_pubspec();

  void generate_consts(std::vector<t_const*> consts);

  /**
   * Program-level generation functions
   */

  void generate_typedef(t_typedef* ttypedef);
  void generate_enum(t_enum* tenum);
  void generate_struct(t_struct* tstruct);
  void generate_xception(t_struct* txception);
  void generate_service(t_service* tservice);

  void print_const_value(std::ofstream& out,
                         std::string name,
                         t_type* type,
                         t_const_value* value,
                         bool in_static,
                         bool defval = false);
  std::string render_const_value(ofstream& out,
                                 std::string name,
                                 t_type* type,
                                 t_const_value* value);

  /**
   * Service-level generation functions
   */

  void generate_dart_struct(t_struct* tstruct, bool is_exception);

  void generate_dart_struct_definition(std::ofstream& out,
                                       t_struct* tstruct,
                                       bool is_xception = false,
                                       bool is_result = false,
                                       string export_file_name = "");
  void generate_dart_struct_reader(std::ofstream& out, t_struct* tstruct);
  void generate_dart_validator(std::ofstream& out, t_struct* tstruct);
  void generate_dart_struct_result_writer(std::ofstream& out, t_struct* tstruct);
  void generate_dart_struct_writer(std::ofstream& out, t_struct* tstruct);
  void generate_dart_struct_tostring(std::ofstream& out, t_struct* tstruct);
  std::string get_dart_type_string(t_type* type);
  void generate_generic_field_getters(std::ofstream& out, t_struct* tstruct);
  void generate_generic_field_setters(std::ofstream& out, t_struct* tstruct);
  void generate_generic_isset_method(std::ofstream& out, t_struct* tstruct);
  void generate_dart_bean_boilerplate(std::ofstream& out, t_struct* tstruct);

  void generate_function_helpers(t_function* tfunction);
  std::string init_value(t_field* tfield);
  std::string get_cap_name(std::string name);
  std::string get_member_name(std::string name);
  std::string get_args_class_name(std::string name);
  std::string get_result_class_name(std::string name);
  std::string get_file_name(std::string name);
  std::string get_constants_class_name(std::string name);
  std::string generate_isset_check(t_field* field);
  std::string generate_isset_check(std::string field);
  void generate_isset_set(ofstream& out, t_field* field);

  void generate_service_interface(t_service* tservice);
  void generate_service_helpers(t_service* tservice);
  void generate_service_client(t_service* tservice);
  void generate_service_server(t_service* tservice);
  void generate_process_function(t_service* tservice, t_function* tfunction);

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

  void generate_dart_doc(std::ofstream& out, t_doc* tdoc);

  void generate_dart_doc(std::ofstream& out, t_function* tdoc);

  /**
   * Helper rendering functions
   */

  std::string find_library_name(t_program* program);
  std::string dart_library(string file_name);
  std::string service_imports();
  std::string dart_thrift_imports();
  std::string type_name(t_type* ttype);
  std::string base_type_name(t_base_type* tbase);
  std::string declare_field(t_field* tfield, bool init = false);
  std::string function_signature(t_function* tfunction);
  std::string argument_list(t_struct* tstruct);
  std::string type_to_enum(t_type* ttype);
  std::string get_ttype_class_name(t_type* ttype);

  bool type_can_be_null(t_type* ttype) {
    ttype = get_true_type(ttype);

    return ttype->is_container() || ttype->is_struct() || ttype->is_xception()
           || ttype->is_string();
  }

  vector<std::string> split(const string& s, char delim) {
    vector<std::string> elems;
    stringstream ss(s);
    string item;
    while (getline(ss, item, delim)) {
      elems.push_back(item);
    }
    return elems;
  }

  std::string constant_name(std::string name);

private:
  std::ofstream f_service_;

  std::string library_name_;
  std::string library_prefix_;
  std::string package_prefix_;
  std::string pubspec_lib_;

  std::string base_dir_;
  std::string src_dir_;
  std::string library_exports_;
};

/**
 * Prepares for file generation by opening up the necessary file output
 * streams.
 *
 * @param tprogram The program to generate
 */
void t_dart_generator::init_generator() {
  MKDIR(get_out_dir().c_str());

  if (library_name_.empty()) {
    library_name_ = find_library_name(program_);
  }

  string subdir = get_out_dir() + "/" + library_name_;
  MKDIR(subdir.c_str());
  base_dir_ = subdir;

  if (library_prefix_.empty()) {
    subdir += "/lib";
    MKDIR(subdir.c_str());
    subdir += "/src";
    MKDIR(subdir.c_str());
    src_dir_ = subdir;
  } else {
    src_dir_ = base_dir_;
  }
}

string t_dart_generator::find_library_name(t_program* program) {
  string name = program->get_namespace("dart");
  if (name.empty()) {
    name = program->get_name();
  }
  name = replace_all(name, ".", "_");
  name = replace_all(name, "-", "_");
  return name;
}

/**
 * The Dart library
 *
 * @return String of the library, e.g. "library myservice;"
 */
string t_dart_generator::dart_library(string file_name) {
  string out = "library " + library_prefix_ + library_name_;
  if (!file_name.empty()) {
    if (library_prefix_.empty()) {
      out += ".src." + file_name;
    } else {
      out += "." + file_name;
    }
  }
  return out + ";\n";
}

/**
 * Prints imports for services
 *
 * @return List of imports for services
 */
string t_dart_generator::service_imports() {
  return "import 'dart:async';" + endl;
}

/**
 * Prints standard dart imports
 *
 * @return List of imports necessary for thrift
 */
string t_dart_generator::dart_thrift_imports() {
  string imports = "import 'dart:typed_data' show Uint8List;" + endl +
                   "import 'package:thrift/thrift.dart';" + endl;

  // add import for this library
  if (package_prefix_.empty()) {
    imports += "import 'package:" + library_name_ + "/" + library_name_ + ".dart';" + endl;
  } else {
    imports += "import 'package:" + package_prefix_ + library_name_ + ".dart';" + endl;
  }

  // add imports for included thrift files
  const vector<t_program*>& includes = program_->get_includes();
  for (size_t i = 0; i < includes.size(); ++i) {
    string include_name = find_library_name(includes[i]);
    string named_import = "t_" + include_name;
    if (package_prefix_.empty()) {
      imports += "import 'package:" + include_name + "/" + include_name + ".dart' as " + named_import + ";" + endl;
    } else {
      imports += "import 'package:" + package_prefix_ + include_name + ".dart' as " + named_import + ";" + endl;
    }
  }

  return imports;
}

/**
 * Not used
 */
void t_dart_generator::close_generator() {
  generate_dart_library();

  if (library_prefix_.empty()) {
    generate_dart_pubspec();
  }
}

void t_dart_generator::generate_dart_library() {
  string f_library_name;
  if (library_prefix_.empty()) {
    f_library_name = base_dir_ + "/lib/" + library_name_ + ".dart";
  } else {
    f_library_name = get_out_dir() + "/" + library_name_ + ".dart";
  }

  ofstream f_library;
  f_library.open(f_library_name.c_str());

  f_library << autogen_comment() << endl;
  f_library << "library " << library_prefix_ << library_name_ << ";" << endl2;
  f_library << library_exports_;

  f_library.close();
}

void t_dart_generator::export_class_to_library(string file_name, string class_name) {
  string subdir;
  if (library_prefix_.empty()) {
    subdir = "src";
  } else {
    subdir = library_name_;
  }
  library_exports_ += "export '" + subdir + "/" + file_name + ".dart' show " + class_name + ";" + endl;
}

void t_dart_generator::generate_dart_pubspec() {
  string f_pubspec_name = base_dir_ + "/pubspec.yaml";
  ofstream f_pubspec;
  f_pubspec.open(f_pubspec_name.c_str());

  indent(f_pubspec) << "name: " << library_name_ << endl;
  indent(f_pubspec) << "version: 0.0.1" << endl;
  indent(f_pubspec) << "description: Autogenerated by Thrift Compiler" << endl;
  f_pubspec << endl;

  indent(f_pubspec) << "environment:" << endl;
  indent_up();
  indent(f_pubspec) << "sdk: ^1.12.0" << endl;
  indent_down();
  f_pubspec << endl;

  indent(f_pubspec) << "dependencies:" << endl;
  indent_up();

  if (pubspec_lib_.empty()) {
    // default to relative path within working directory, which works for tests
    indent(f_pubspec) << "thrift:  # ^" << dart_thrift_version << endl;
    indent_up();
    indent(f_pubspec) << "path: ../../../../lib/dart" << endl;
    indent_down();
  } else {
    const vector<std::string> lines = split(pubspec_lib_, '|');
    for (size_t line_index = 0; line_index < lines.size(); line_index++) {
      indent(f_pubspec) << lines[line_index] << endl;
    }
  }

  // add included thrift files as dependencies
  const vector<t_program*>& includes = program_->get_includes();
  for (size_t i = 0; i < includes.size(); ++i) {
    string include_name = find_library_name(includes[i]);
    indent(f_pubspec) << include_name << ":" << endl;
    indent_up();
    indent(f_pubspec) << "path: ../" << include_name << endl;
    indent_down();
  }

  indent_down();
  f_pubspec << endl;

  f_pubspec.close();
}

/**
 * Not used
 *
 * @param ttypedef The type definition
 */
void t_dart_generator::generate_typedef(t_typedef* ttypedef) {
  (void)ttypedef;
}

/**
 * Enums are a class with a set of static constants.
 *
 * @param tenum The enumeration
 */
void t_dart_generator::generate_enum(t_enum* tenum) {
  // Make output file
  string file_name = get_file_name(tenum->get_name());

  string f_enum_name = src_dir_ + "/" + file_name + ".dart";
  ofstream f_enum;
  f_enum.open(f_enum_name.c_str());

  // Comment and add library
  f_enum << autogen_comment() << dart_library(file_name) << endl;

  string class_name = tenum->get_name();
  export_class_to_library(file_name, class_name);
  f_enum << "class " << class_name;
  scope_up(f_enum);

  vector<t_enum_value*> constants = tenum->get_constants();
  vector<t_enum_value*>::iterator c_iter;
  for (c_iter = constants.begin(); c_iter != constants.end(); ++c_iter) {
    int value = (*c_iter)->get_value();
    indent(f_enum) << "static const int " << (*c_iter)->get_name() << " = " << value << ";"
                   << endl;
  }

  // Create a static Set with all valid values for this enum
  f_enum << endl;

  indent(f_enum) << "static final Set<int> VALID_VALUES = new Set.from([" << endl;
  indent_up();
  bool firstValue = true;
  for (c_iter = constants.begin(); c_iter != constants.end(); ++c_iter) {
    // populate set
    indent(f_enum) << (firstValue ? "" : ", ");
    f_enum << (*c_iter)->get_name() << endl;
    firstValue = false;
  }
  indent_down();
  indent(f_enum) << "]);" << endl;

  indent(f_enum) << "static final Map<int, String> VALUES_TO_NAMES = {" << endl;
  indent_up();
  firstValue = true;
  for (c_iter = constants.begin(); c_iter != constants.end(); ++c_iter) {
    indent(f_enum) << (firstValue ? "" : ", ");
    f_enum  << (*c_iter)->get_name() << ": '" << (*c_iter)->get_name() << "'" << endl;
    firstValue = false;
  }
  indent_down();
  indent(f_enum) << "};" << endl;

  scope_down(f_enum); // end class

  f_enum.close();
}

/**
 * Generates a class that holds all the constants.
 */
void t_dart_generator::generate_consts(std::vector<t_const*> consts) {
  if (consts.empty()) {
    return;
  }

  string class_name = get_constants_class_name(program_name_);
  string file_name = get_file_name(class_name);

  string f_consts_name = src_dir_ + "/" + file_name + ".dart";
  ofstream f_consts;
  f_consts.open(f_consts_name.c_str());

  // Print header
  f_consts << autogen_comment() << dart_library(file_name) << endl;
  f_consts << dart_thrift_imports() << endl;

  export_class_to_library(file_name, class_name);
  indent(f_consts) << "class " << class_name;
  scope_up(f_consts);

  vector<t_const*>::iterator c_iter;
  for (c_iter = consts.begin(); c_iter != consts.end(); ++c_iter) {
    print_const_value(f_consts,
                      (*c_iter)->get_name(),
                      (*c_iter)->get_type(),
                      (*c_iter)->get_value(),
                      false);
    f_consts << endl;
  }

  scope_down(f_consts);

  f_consts.close();
}

void t_dart_generator::print_const_value(std::ofstream& out,
                                        string name,
                                        t_type* type,
                                        t_const_value* value,
                                        bool in_static,
                                        bool defval) {
  type = get_true_type(type);

  indent(out);
  if (!defval) {
    out << (in_static ? "var " : "static final ");
  }
  if (type->is_base_type()) {
    if (!defval) {
      out << type_name(type) << " ";
    }
    string v2 = render_const_value(out, name, type, value);
    out << name;
    out << " = " << v2 << ";" << endl << endl;
  } else if (type->is_enum()) {
    if (!defval) {
      out << type_name(type) << " ";
    }
    out << name;
    out << " = " << value->get_integer() << ";" << endl << endl;
  } else if (type->is_struct() || type->is_xception()) {
    const vector<t_field*>& fields = ((t_struct*)type)->get_members();
    vector<t_field*>::const_iterator f_iter;
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    out << type_name(type) << " " << name << " = new " << type_name(type) << "()";
    indent_up();
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
      out << endl;
      indent(out) << ".." << v_iter->first->get_string() << " = " << val;
    }
    indent_down();
    out << ";" << endl;
  } else if (type->is_map()) {
    if (!defval) {
      out << type_name(type) << " ";
    }
    out << name << " =";
    scope_up(out);

    t_type* ktype = ((t_map*)type)->get_key_type();
    t_type* vtype = ((t_map*)type)->get_val_type();
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;

    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      string key = render_const_value(out, name, ktype, v_iter->first);
      string val = render_const_value(out, name, vtype, v_iter->second);
      indent(out) << key << ": " << val << "," << endl;
    }
    scope_down(out, ";" + endl);

    out << endl;
  } else if (type->is_list() || type->is_set()) {
    if (!defval) {
      out << type_name(type) << " ";
    }
    out << name << " = ";
    t_type* etype;
    if (type->is_list()) {
      out << "[" << endl;
      etype = ((t_list*)type)->get_elem_type();
    } else {
      out << "new " << type_name(type) << ".from([" << endl;
      etype = ((t_set*)type)->get_elem_type();
    }
    const vector<t_const_value*>& val = value->get_list();
    vector<t_const_value*>::const_iterator v_iter;

    indent_up();
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      string val = render_const_value(out, name, etype, *v_iter);
      indent(out) << val << "," << endl;
    }
    indent_down();

    if (type->is_list()) {
      indent(out) << "];" << endl;
    } else {
      indent(out) << "]);" << endl;
    }

  } else {
    throw "compiler error: no const of type " + type->get_name();
  }
}

string t_dart_generator::render_const_value(ofstream& out,
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
      render << "'" << get_escaped_string(value) << "'";
      break;
    case t_base_type::TYPE_BOOL:
      render << ((value->get_integer() > 0) ? "true" : "false");
      break;
    case t_base_type::TYPE_I8:
    case t_base_type::TYPE_I16:
    case t_base_type::TYPE_I32:
    case t_base_type::TYPE_I64:
      render << value->get_integer();
      break;
    case t_base_type::TYPE_DOUBLE:
      if (value->get_type() == t_const_value::CV_INTEGER) {
        render << value->get_integer();
      } else {
        render << value->get_double();
      }
      break;
    default:
      throw "compiler error: no const of base type " + t_base_type::t_base_name(tbase);
    }
  } else if (type->is_enum()) {
    render << value->get_integer();
  } else {
    string t = tmp("tmp");
    print_const_value(out, t, type, value, true);
    out << endl;
    render << t;
  }

  return render.str();
}

/**
 * Generates a struct definition for a thrift data type. This is a class
 * with data members, read(), write(), and an inner Isset class.
 *
 * @param tstruct The struct definition
 */
void t_dart_generator::generate_struct(t_struct* tstruct) {
  generate_dart_struct(tstruct, false);
}

/**
 * Exceptions are structs, but they inherit from Exception
 *
 * @param tstruct The struct definition
 */
void t_dart_generator::generate_xception(t_struct* txception) {
  generate_dart_struct(txception, true);
}

/**
 * Dart struct definition.
 *
 * @param tstruct The struct definition
 */
void t_dart_generator::generate_dart_struct(t_struct* tstruct, bool is_exception) {
  string file_name = get_file_name(tstruct->get_name());
  string f_struct_name = src_dir_ + "/" + file_name + ".dart";
  ofstream f_struct;
  f_struct.open(f_struct_name.c_str());

  f_struct << autogen_comment() << dart_library(file_name) << endl;

  string imports;

  f_struct << dart_thrift_imports() << endl;

  generate_dart_struct_definition(f_struct, tstruct, is_exception, false, file_name);

  f_struct.close();
}

/**
 * Dart struct definition. This has various parameters, as it could be
 * generated standalone or inside another class as a helper. If it
 * is a helper than it is a static class.
 *
 * @param tstruct      The struct definition
 * @param is_exception Is this an exception?
 * @param in_class     If inside a class, needs to be static class
 * @param is_result    If this is a result it needs a different writer
 */
void t_dart_generator::generate_dart_struct_definition(ofstream& out,
                                                       t_struct* tstruct,
                                                       bool is_exception,
                                                       bool is_result,
                                                       string export_file_name) {
  generate_dart_doc(out, tstruct);

  string class_name = tstruct->get_name();
  if (!export_file_name.empty()) {
    export_class_to_library(export_file_name, class_name);
  }
  indent(out) << "class " << class_name << " ";

  if (is_exception) {
    out << "extends Error ";
  }
  out << "implements TBase";
  scope_up(out);

  indent(out) << "static final TStruct _STRUCT_DESC = new TStruct(\"" << class_name
              << "\");" << endl;

  // Members are public for -dart, private for -dartbean
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    indent(out) << "static final TField _" << constant_name((*m_iter)->get_name())
                << "_FIELD_DESC = new TField(\"" << (*m_iter)->get_name() << "\", "
                << type_to_enum((*m_iter)->get_type()) << ", " << (*m_iter)->get_key() << ");"
                << endl;
  }

  out << endl;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    generate_dart_doc(out, *m_iter);
    indent(out) << type_name((*m_iter)->get_type()) + " _"
                << get_member_name((*m_iter)->get_name()) << init_value(*m_iter) << ";" << endl;

    indent(out) << "static const int " << upcase_string((*m_iter)->get_name())
                << " = " << (*m_iter)->get_key() << ";" << endl;
  }

  out << endl;

  // Inner Isset class
  if (members.size() > 0) {
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      if (!type_can_be_null((*m_iter)->get_type())) {
        string field_name = get_member_name((*m_iter)->get_name());
        indent(out) << "bool __isset_" << field_name << " = false;" << endl;
      }
    }
  }

  out << endl;

  // Default constructor
  indent(out) << tstruct->get_name() << "()";
  scope_up(out);
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_type* t = get_true_type((*m_iter)->get_type());
    if ((*m_iter)->get_value() != NULL) {
      print_const_value(out,
                        "this." + get_member_name((*m_iter)->get_name()),
                        t,
                        (*m_iter)->get_value(),
                        true,
                        true);
    }
  }
  scope_down(out);
  out << endl;

  generate_dart_bean_boilerplate(out, tstruct);
  generate_generic_field_getters(out, tstruct);
  generate_generic_field_setters(out, tstruct);
  generate_generic_isset_method(out, tstruct);

  generate_dart_struct_reader(out, tstruct);
  if (is_result) {
    generate_dart_struct_result_writer(out, tstruct);
  } else {
    generate_dart_struct_writer(out, tstruct);
  }
  generate_dart_struct_tostring(out, tstruct);
  generate_dart_validator(out, tstruct);
  scope_down(out);
  out << endl;
}

/**
 * Generates a function to read all the fields of the struct.
 *
 * @param tstruct The struct definition
 */
void t_dart_generator::generate_dart_struct_reader(ofstream& out, t_struct* tstruct) {
  indent(out) << "read(TProtocol iprot)";
  scope_up(out);

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  // Declare stack tmp variables and read struct header
  indent(out) << "TField field;" << endl;
  indent(out) << "iprot.readStructBegin();" << endl;

  // Loop over reading in fields
  indent(out) << "while (true)";
  scope_up(out);

  // Read beginning field marker
  indent(out) << "field = iprot.readFieldBegin();" << endl;

  // Check for field STOP marker and break
  indent(out) << "if (field.type == TType.STOP)";
  scope_up(out);
  indent(out) << "break;" << endl;
  scope_down(out);

  // Switch statement on the field we are reading
  indent(out) << "switch (field.id)";
  scope_up(out);

  // Generate deserialization code for known cases
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    indent(out) << "case " << upcase_string((*f_iter)->get_name()) << ":" << endl;
    indent_up();

    indent(out) << "if (field.type == " << type_to_enum((*f_iter)->get_type()) << ")";
    scope_up(out);

    generate_deserialize_field(out, *f_iter, "this.");
    generate_isset_set(out, *f_iter);

    scope_down(out, " else");
    scope_up(out);
    indent(out) << "TProtocolUtil.skip(iprot, field.type);" << endl;
    scope_down(out);

    indent(out) << "break;" << endl;
    indent_down();
  }

  // In the default case we skip the field
  indent(out) << "default:" << endl;
  indent_up();
  indent(out) << "TProtocolUtil.skip(iprot, field.type);" << endl;
  indent(out) << "break;" << endl;
  indent_down();

  scope_down(out);

  // Read field end marker
  indent(out) << "iprot.readFieldEnd();" << endl;

  scope_down(out);

  indent(out) << "iprot.readStructEnd();" << endl2;

  // in non-beans style, check for required fields of primitive type
  // (which can be checked here but not in the general validate method)
  indent(out) << "// check for required fields of primitive type, which can't be "
                 "checked in the validate method" << endl;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if ((*f_iter)->get_req() == t_field::T_REQUIRED && !type_can_be_null((*f_iter)->get_type())) {
      string field_name = get_member_name((*f_iter)->get_name());
      indent(out) << "if (!__isset_" << field_name << ")";
      scope_up(out);
      indent(out) << "  throw new TProtocolError(TProtocolErrorType.UNKNOWN, \"Required field '"
          << field_name
          << "' was not found in serialized data! Struct: \" + toString());" << endl;
      scope_down(out, endl2);
    }
  }

  // performs various checks (e.g. check that all required fields are set)
  indent(out) << "validate();" << endl;

  scope_down(out, endl2);
}

// generates dart method to perform various checks
// (e.g. check that all required fields are set)
void t_dart_generator::generate_dart_validator(ofstream& out, t_struct* tstruct) {
  indent(out) << "validate()";
  scope_up(out);

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  indent(out) << "// check for required fields" << endl;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if ((*f_iter)->get_req() == t_field::T_REQUIRED) {
      string field_name = get_member_name((*f_iter)->get_name());
      if (type_can_be_null((*f_iter)->get_type())) {
        indent(out) << "if (" << field_name << " == null)";
        scope_up(out);
        indent(out) << "throw new TProtocolError(TProtocolErrorType.UNKNOWN, \"Required field '"
                    << field_name << "' was not present! Struct: \" + toString());"
                    << endl;
        scope_down(out);
      } else {
        indent(out) << "// alas, we cannot check '" << field_name
                    << "' because it's a primitive and you chose the non-beans generator." << endl;
      }
    }
  }

  // check that fields of type enum have valid values
  indent(out) << "// check that fields of type enum have valid values" << endl;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    t_field* field = (*f_iter);
    t_type* type = field->get_type();
    // if field is an enum, check that its value is valid
    if (type->is_enum()) {
      string field_name = get_member_name(field->get_name());
      indent(out) << "if (" << generate_isset_check(field) << " && !" << get_ttype_class_name(type)
                  << ".VALID_VALUES.contains(" << field_name << "))";
      scope_up(out);
      indent(out) << "throw new TProtocolError(TProtocolErrorType.UNKNOWN, \"The field '"
                  << field_name << "' has been assigned the invalid value "
                  << "$" << field_name << "\");" << endl;
      scope_down(out);
    }
  }

  scope_down(out, endl2);
}

/**
 * Generates a function to write all the fields of the struct
 *
 * @param tstruct The struct definition
 */
void t_dart_generator::generate_dart_struct_writer(ofstream& out, t_struct* tstruct) {
  out << indent() << "write(TProtocol oprot)";
  scope_up(out);

  const vector<t_field*>& fields = tstruct->get_sorted_members();
  vector<t_field*>::const_iterator f_iter;

  // performs various checks (e.g. check that all required fields are set)
  indent(out) << "validate();" << endl2;

  indent(out) << "oprot.writeStructBegin(_STRUCT_DESC);" << endl;

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    string field_name = get_member_name((*f_iter)->get_name());
    bool could_be_unset = (*f_iter)->get_req() == t_field::T_OPTIONAL;
    if (could_be_unset) {
      indent(out) << "if (" << generate_isset_check(*f_iter) << ")";
      scope_up(out);
    }
    bool null_allowed = type_can_be_null((*f_iter)->get_type());
    if (null_allowed) {
      indent(out) << "if (this." << field_name << " != null)";
      scope_up(out);
    }

    indent(out) << "oprot.writeFieldBegin(_" << constant_name((*f_iter)->get_name())
                << "_FIELD_DESC);" << endl;

    // Write field contents
    generate_serialize_field(out, *f_iter, "this.");

    // Write field closer
    indent(out) << "oprot.writeFieldEnd();" << endl;

    if (null_allowed) {
      scope_down(out);
    }
    if (could_be_unset) {
      scope_down(out);
    }
  }
  // Write the struct map
  indent(out) << "oprot.writeFieldStop();" << endl << indent() << "oprot.writeStructEnd();"
      << endl;

  scope_down(out, endl2);
}

/**
 * Generates a function to write all the fields of the struct,
 * which is a function result. These fields are only written
 * if they are set in the Isset array, and only one of them
 * can be set at a time.
 *
 * @param tstruct The struct definition
 */
void t_dart_generator::generate_dart_struct_result_writer(ofstream& out, t_struct* tstruct) {
  indent(out) << "write(TProtocol oprot)";
  scope_up(out);

  const vector<t_field*>& fields = tstruct->get_sorted_members();
  vector<t_field*>::const_iterator f_iter;

  indent(out) << "oprot.writeStructBegin(_STRUCT_DESC);" << endl2;

  bool first = true;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (first) {
      first = false;
      indent(out) << "if ";
    } else {
      out << " else if ";
    }

    out << "(this." << generate_isset_check(*f_iter) << ")";
    scope_up(out);

    indent(out) << "oprot.writeFieldBegin(_" << constant_name((*f_iter)->get_name())
                << "_FIELD_DESC);" << endl;

    // Write field contents
    generate_serialize_field(out, *f_iter, "this.");

    // Write field closer
    indent(out) << "oprot.writeFieldEnd();" << endl;

    scope_down(out, "");
  }
  out << endl;

  // Write the struct map
  indent(out) << "oprot.writeFieldStop();" << endl << indent()
      << "oprot.writeStructEnd();" << endl;

  scope_down(out, endl2);
}

void t_dart_generator::generate_generic_field_getters(std::ofstream& out,
                                                      t_struct* tstruct) {
  // create the getter
  indent(out) << "getFieldValue(int fieldID)";
  scope_up(out);

  indent(out) << "switch (fieldID)";
  scope_up(out);

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    t_field* field = *f_iter;
    std::string field_name = get_member_name(field->get_name());

    indent(out) << "case " << upcase_string(field_name) << ":" << endl;
    indent_up();
    indent(out) << "return this." << field_name << ";" << endl;
    indent_down();
  }

  indent(out) << "default:" << endl;
  indent_up();
  indent(out) << "throw new ArgumentError(\"Field $fieldID doesn't exist!\");" << endl;
  indent_down();

  scope_down(out);  // switch
  scope_down(out, endl2);  // method
}

void t_dart_generator::generate_generic_field_setters(std::ofstream& out,
                                                      t_struct* tstruct) {

  // create the setter
  indent(out) << "setFieldValue(int fieldID, Object value)";
  scope_up(out);

  indent(out) << "switch (fieldID)";
  scope_up(out);

  // build up the bodies of both the getter and setter at once
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    t_field* field = *f_iter;
    std::string field_name = get_member_name(field->get_name());

    indent(out) << "case " << upcase_string(field_name) << ":" << endl;
    indent_up();

    indent(out) << "if (value == null)";
    scope_up(out);
    indent(out) << "unset" << get_cap_name(field_name) << "();" << endl;

    scope_down(out, " else");
    scope_up(out);
    indent(out) << "this." << field_name << " = value;" << endl;
    scope_down(out);

    indent(out) << "break;" << endl;

    indent_down();
    out << endl;
  }

  indent(out) << "default:" << endl;
  indent_up();
  indent(out) << "throw new ArgumentError(\"Field $fieldID doesn't exist!\");" << endl;
  indent_down();

  scope_down(out);  // switch
  scope_down(out, endl2);  // method
}

// Creates a generic isSet method that takes the field number as argument
void t_dart_generator::generate_generic_isset_method(std::ofstream& out, t_struct* tstruct) {
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  // create the isSet method
  indent(out) << "// Returns true if field corresponding to fieldID is set (has been assigned a "
                 "value) and false otherwise" << endl;
  indent(out) << "bool isSet(int fieldID)";
  scope_up(out);

  indent(out) << "switch (fieldID)";
  scope_up(out);

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    t_field* field = *f_iter;
    indent(out) << "case " << upcase_string(field->get_name()) << ":" << endl;
    indent_up();
    indent(out) << "return " << generate_isset_check(field) << ";" << endl;
    indent_down();
  }

  indent(out) << "default:" << endl;
  indent_up();
  indent(out) << "throw new ArgumentError(\"Field $fieldID doesn't exist!\");" << endl;
  indent_down();

  scope_down(out);  // switch
  scope_down(out, endl2);  // method
}

/**
 * Generates a set of Dart Bean boilerplate functions (setters, getters, etc.)
 * for the given struct.
 *
 * @param tstruct The struct definition
 */
void t_dart_generator::generate_dart_bean_boilerplate(ofstream& out,
                                                    t_struct* tstruct) {
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    t_field* field = *f_iter;
    t_type* type = get_true_type(field->get_type());
    std::string field_name = get_member_name(field->get_name());
    std::string cap_name = get_cap_name(field_name);

    indent(out) << "// " << field_name << endl;

    // Simple getter
    generate_dart_doc(out, field);
    indent(out) << type_name(type) << " get " << field_name << " => this._" << field_name << ";" << endl2;

    // Simple setter
    generate_dart_doc(out, field);
    indent(out) << "set " << field_name << "(" << type_name(type) << " " << field_name << ")";
    scope_up(out);
    indent(out) << "this._" << field_name << " = " << field_name << ";" << endl;
    generate_isset_set(out, field);
    scope_down(out, endl2);

    // isSet method
    indent(out) << "bool is" << get_cap_name("set") << cap_name << "()";
    if (type_can_be_null(type)) {
      out << " => this." << field_name << " != null;" << endl2;
    } else {
      out << " => this.__isset_" << field_name << ";" << endl2;
    }

    // Unsetter
    indent(out) << "unset" << cap_name << "()";
    scope_up(out);
    if (type_can_be_null(type)) {
      indent(out) << "this." << field_name << " = null;" << endl;
    } else {
      indent(out) << "this.__isset_" << field_name << " = false;" << endl;
    }
    scope_down(out, endl2);
  }
}

/**
 * Generates a toString() method for the given struct
 *
 * @param tstruct The struct definition
 */
void t_dart_generator::generate_dart_struct_tostring(ofstream& out,
                                                   t_struct* tstruct) {
  indent(out) << "String toString()";
  scope_up(out);

  indent(out) << "StringBuffer ret = new StringBuffer(\""
              << tstruct->get_name() << "(\");" << endl2;

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  bool first = true;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    bool could_be_unset = (*f_iter)->get_req() == t_field::T_OPTIONAL;
    if (could_be_unset) {
      indent(out) << "if (" << generate_isset_check(*f_iter) << ")";
      scope_up(out);
    }

    t_field* field = (*f_iter);
    std::string field_name = get_member_name(field->get_name());

    if (!first) {
      indent(out) << "ret.write(\", \");" << endl;
    }
    indent(out) << "ret.write(\"" << field_name << ":\");" << endl;
    bool can_be_null = type_can_be_null(field->get_type());
    if (can_be_null) {
      indent(out) << "if (this." << field_name << " == null)";
      scope_up(out);
      indent(out) << "ret.write(\"null\");" << endl;
      scope_down(out, " else");
      scope_up(out);
    }

    if (field->get_type()->is_base_type() && ((t_base_type*)(field->get_type()))->is_binary()) {
      indent(out) << "ret.write(\"BINARY\");" << endl;
    } else if (field->get_type()->is_enum()) {
      indent(out) << "String " << field_name << "_name = "
                  << get_ttype_class_name(field->get_type())
                  << ".VALUES_TO_NAMES[this." << field_name << "];" << endl;
      indent(out) << "if (" << field_name << "_name != null)";
      scope_up(out);
      indent(out) << "ret.write(" << field_name << "_name);" << endl;
      indent(out) << "ret.write(\" (\");" << endl;
      scope_down(out);
      indent(out) << "ret.write(this." << field_name << ");" << endl;
      indent(out) << "if (" << field_name << "_name != null)";
      scope_up(out);
      indent(out) << "ret.write(\")\");" << endl;
      scope_down(out);
    } else {
      indent(out) << "ret.write(this." << field_name << ");" << endl;
    }

    if (can_be_null) {
      scope_down(out);
    }
    if (could_be_unset) {
      scope_down(out);
    }

    out << endl;
    first = false;
  }

  indent(out) << "ret.write(\")\");" << endl2;

  indent(out) << "return ret.toString();" << endl;

  scope_down(out, endl2);
}

/**
 * Returns a string with the dart representation of the given thrift type
 * (e.g. for the type struct it returns "TType.STRUCT")
 */
std::string t_dart_generator::get_dart_type_string(t_type* type) {
  if (type->is_list()) {
    return "TType.LIST";
  } else if (type->is_map()) {
    return "TType.MAP";
  } else if (type->is_set()) {
    return "TType.SET";
  } else if (type->is_struct() || type->is_xception()) {
    return "TType.STRUCT";
  } else if (type->is_enum()) {
    return "TType.I32";
  } else if (type->is_typedef()) {
    return get_dart_type_string(((t_typedef*)type)->get_type());
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
                               + "\" passed to t_dart_generator::get_dart_type_string!");
      break; // This should never happen!
    }
  } else {
    throw std::runtime_error(
        "Unknown thrift type \"" + type->get_name()
        + "\" passed to t_dart_generator::get_dart_type_string!"); // This should never happen!
  }
}

void t_dart_generator::generate_service(t_service* tservice) {
  string file_name = get_file_name(service_name_);
  string f_service_name = src_dir_ + "/" + file_name + ".dart";
  f_service_.open(f_service_name.c_str());

  f_service_ << autogen_comment() << dart_library(file_name) << endl;
  f_service_ << service_imports() << dart_thrift_imports() << endl;
  f_service_ << endl;

  generate_service_interface(tservice);
  generate_service_client(tservice);
  generate_service_server(tservice);
  generate_service_helpers(tservice);

  f_service_.close();
}

/**
 * Generates a service interface definition.
 *
 * @param tservice The service to generate a header definition for
 */
void t_dart_generator::generate_service_interface(t_service* tservice) {
  string extends_iface = "";
  if (tservice->get_extends() != NULL) {
    extends_iface = " extends " + get_ttype_class_name(tservice->get_extends());
  }

  generate_dart_doc(f_service_, tservice);

  string class_name = service_name_;
  export_class_to_library(get_file_name(service_name_), class_name);
  indent(f_service_) << "abstract class " << class_name << extends_iface;
  scope_up(f_service_);

  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    f_service_ << endl;
    generate_dart_doc(f_service_, *f_iter);
    indent(f_service_) << function_signature(*f_iter) << ";" << endl;
  }

  scope_down(f_service_, endl2);
}

/**
 * Generates structs for all the service args and return types
 *
 * @param tservice The service
 */
void t_dart_generator::generate_service_helpers(t_service* tservice) {
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    t_struct* ts = (*f_iter)->get_arglist();
    generate_dart_struct_definition(f_service_, ts, false, false);
    generate_function_helpers(*f_iter);
  }
}

/**
 * Generates a service client definition.
 *
 * @param tservice The service to generate a server for.
 */
void t_dart_generator::generate_service_client(t_service* tservice) {
  string extends = "";
  string extends_client = "";
  if (tservice->get_extends() != NULL) {
    extends = get_ttype_class_name(tservice->get_extends());
    extends_client = " extends " + extends + "Client";
  }

  string class_name = service_name_ + "Client";
  export_class_to_library(get_file_name(service_name_), class_name);
  indent(f_service_) << "class " << class_name << extends_client
                     << " implements " << service_name_;
  scope_up(f_service_);
  f_service_ << endl;

  indent(f_service_) << class_name << "(TProtocol iprot, [TProtocol oprot = null])";

  if (!extends.empty()) {
    indent_up();
    f_service_ << endl;
    indent(f_service_) << ": super(iprot, oprot);" << endl;
    indent_down();
  } else {
    scope_up(f_service_);
    indent(f_service_) << "_iprot = iprot;" << endl;
    indent(f_service_) << "_oprot = (oprot == null) ? iprot : oprot;" << endl;
    scope_down(f_service_);
  }
  f_service_ << endl;

  if (extends.empty()) {
    indent(f_service_) << "TProtocol _iprot;" << endl2;
    indent(f_service_) << "TProtocol get iprot => _iprot;" << endl2;
    indent(f_service_) << "TProtocol _oprot;" << endl2;
    indent(f_service_) << "TProtocol get oprot => _oprot;" << endl2;
    indent(f_service_) << "int _seqid = 0;" << endl2;
    indent(f_service_) << "int get seqid => _seqid;" << endl2;
    indent(f_service_) << "int nextSeqid() => ++_seqid;" << endl2;
  }

  // Generate client method implementations
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::const_iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    // Open function
    indent(f_service_) << function_signature(*f_iter) << " async";
    scope_up(f_service_);

    // Get the struct of function call params
    t_struct* arg_struct = (*f_iter)->get_arglist();

    string argsname = get_args_class_name((*f_iter)->get_name());
    vector<t_field*>::const_iterator fld_iter;
    const vector<t_field*>& fields = arg_struct->get_members();

    // Serialize the request
    indent(f_service_) << "oprot.writeMessageBegin(new TMessage(\"" << (*f_iter)->get_name() << "\", "
               << ((*f_iter)->is_oneway() ? "TMessageType.ONEWAY" : "TMessageType.CALL")
               << ", nextSeqid()));" << endl;
    indent(f_service_) << argsname << " args = new " << argsname << "();" << endl;

    for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
      string arg_field_name = get_member_name((*fld_iter)->get_name());
      indent(f_service_) << "args." << arg_field_name << " = "
                 << arg_field_name << ";" << endl;
    }

    indent(f_service_) << "args.write(oprot);" << endl;
    indent(f_service_) << "oprot.writeMessageEnd();" << endl2;

    indent(f_service_) << "await oprot.transport.flush();" << endl2;

    if (!(*f_iter)->is_oneway()) {
      indent(f_service_) << "TMessage msg = iprot.readMessageBegin();" << endl;
      indent(f_service_) << "if (msg.type == TMessageType.EXCEPTION)";
      scope_up(f_service_);
      indent(f_service_) << "TApplicationError error = TApplicationError.read(iprot);" << endl;
      indent(f_service_) << "iprot.readMessageEnd();" << endl;
      indent(f_service_) << "throw error;" << endl;
      scope_down(f_service_, endl2);

      string result_class = get_result_class_name((*f_iter)->get_name());
      indent(f_service_) << result_class << " result = new " << result_class << "();" << endl;
      indent(f_service_) << "result.read(iprot);" << endl;
      indent(f_service_) << "iprot.readMessageEnd();" << endl;

      // Careful, only return _result if not a void function
      if (!(*f_iter)->get_returntype()->is_void()) {
        indent(f_service_) << "if (result." << generate_isset_check("success") << ")";
        scope_up(f_service_);
        indent(f_service_) << "return result.success;" << endl;
        scope_down(f_service_, endl2);
      }

      t_struct* xs = (*f_iter)->get_xceptions();
      const std::vector<t_field*>& xceptions = xs->get_members();
      vector<t_field*>::const_iterator x_iter;
      for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
        string result_field_name = get_member_name((*x_iter)->get_name());
        indent(f_service_) << "if (result." << result_field_name << " != null)";
        scope_up(f_service_);
        indent(f_service_) << "throw result." << result_field_name << ";" << endl;
        scope_down(f_service_);
      }

      // If you get here it's an exception, unless a void function
      if ((*f_iter)->get_returntype()->is_void()) {
        indent(f_service_) << "return;" << endl;
      } else {
        indent(f_service_) << "throw new TApplicationError(TApplicationErrorType.MISSING_RESULT, \""
                   << (*f_iter)->get_name() << " failed: unknown result\");" << endl;
      }
    }

    scope_down(f_service_, endl2);
  }

  scope_down(f_service_, endl2);
}

/**
 * Generates a service server definition.
 *
 * @param tservice The service to generate a server for.
 */
void t_dart_generator::generate_service_server(t_service* tservice) {
  // Generate the dispatch methods
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;

  // typedef
  indent(f_service_) << "typedef void ProcessFunction(int seqid, TProtocol iprot, TProtocol oprot);" << endl2;

  // Extends stuff
  string extends = "";
  string extends_processor = "";
  if (tservice->get_extends() != NULL) {
    extends = get_ttype_class_name(tservice->get_extends());
    extends_processor = " extends " + extends + "Processor";
  }

  // Generate the header portion
  string class_name =  service_name_ + "Processor";
  export_class_to_library(get_file_name(service_name_), class_name);
  indent(f_service_) << "class " << class_name << extends_processor << " implements TProcessor";
  scope_up(f_service_);

  indent(f_service_) << class_name << "(" << service_name_ << " iface)";
  if (!extends.empty()) {
    indent_up();
    f_service_ << endl;
    indent(f_service_) << ": super(iface)";
    indent_down();
  }
  scope_up(f_service_);

  if (extends.empty()) {
    indent(f_service_) << "iface_ = iface;" << endl;
  }

  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    indent(f_service_) << "PROCESS_MAP[\"" << (*f_iter)->get_name()
               << "\"] = " << get_member_name((*f_iter)->get_name()) << ";" << endl;
  }
  scope_down(f_service_, endl2);

  indent(f_service_) << service_name_ << " iface_;" << endl;

  if (extends.empty()) {
    indent(f_service_) << "final Map<String, ProcessFunction> PROCESS_MAP = {};" << endl;
  }

  f_service_ << endl;

  // Generate the server implementation
  indent(f_service_) << "bool process(TProtocol iprot, TProtocol oprot)";
  scope_up(f_service_);
  indent(f_service_) << "TMessage msg = iprot.readMessageBegin();" << endl;
  indent(f_service_) << "ProcessFunction fn = PROCESS_MAP[msg.name];" << endl;
  indent(f_service_) << "if (fn == null)";
  scope_up(f_service_);
  indent(f_service_) << "TProtocolUtil.skip(iprot, TType.STRUCT);" << endl;
  indent(f_service_) << "iprot.readMessageEnd();" << endl;
  indent(f_service_) << "TApplicationError x = new TApplicationError(TApplicationErrorType.UNKNOWN_METHOD, "
         "\"Invalid method name: '\"+msg.name+\"'\");" << endl;
  indent(f_service_) << "oprot.writeMessageBegin(new TMessage(msg.name, TMessageType.EXCEPTION, msg.seqid));" << endl;
  indent(f_service_) << "x.write(oprot);" << endl;
  indent(f_service_) << "oprot.writeMessageEnd();" << endl;
  indent(f_service_) << "oprot.transport.flush();" << endl;
  indent(f_service_) << "return true;" << endl;
  scope_down(f_service_);
  indent(f_service_) << "fn(msg.seqid, iprot, oprot);" << endl;
  indent(f_service_) << "return true;" << endl;
  scope_down(f_service_, endl2); // process function

  // Generate the process subfunctions
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    generate_process_function(tservice, *f_iter);
  }

  scope_down(f_service_, endl2); // class
}

/**
 * Generates a struct and helpers for a function.
 *
 * @param tfunction The function
 */
void t_dart_generator::generate_function_helpers(t_function* tfunction) {
  if (tfunction->is_oneway()) {
    return;
  }

  t_struct result(program_, get_result_class_name(tfunction->get_name()));
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

  generate_dart_struct_definition(f_service_, &result, false, true);
}

/**
 * Generates a process function definition.
 *
 * @param tfunction The function to write a dispatcher for
 */
void t_dart_generator::generate_process_function(t_service* tservice, t_function* tfunction) {
  (void)tservice;

  bool await_result = (!tfunction->is_oneway() && !tfunction->get_returntype()->is_void());

  indent(f_service_) << get_member_name(tfunction->get_name()) << "(int seqid, TProtocol iprot, TProtocol oprot)";
  if (await_result) {
    f_service_ << " async";
  }
  scope_up(f_service_);

  string argsname = get_args_class_name(tfunction->get_name());
  string resultname = get_result_class_name(tfunction->get_name());

  indent(f_service_) << argsname << " args = new " << argsname << "();" << endl;
  indent(f_service_) << "args.read(iprot);" << endl;
  indent(f_service_) << "iprot.readMessageEnd();" << endl;

  t_struct* xs = tfunction->get_xceptions();
  const std::vector<t_field*>& xceptions = xs->get_members();
  vector<t_field*>::const_iterator x_iter;

  if (!tfunction->is_oneway()) {
    indent(f_service_) << resultname << " result = new " << resultname << "();" << endl;
  }

  if (!tfunction->is_oneway() && xceptions.size() > 0) {
    indent(f_service_) << "try";
    scope_up(f_service_);
  }

  // Generate the function call
  t_struct* arg_struct = tfunction->get_arglist();
  const std::vector<t_field*>& fields = arg_struct->get_members();
  vector<t_field*>::const_iterator f_iter;

  f_service_ << indent();
  if (await_result) {
    f_service_ << "result.success = await ";
  }
  f_service_ << "iface_." << get_member_name(tfunction->get_name()) << "(";
  bool first = true;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (first) {
      first = false;
    } else {
      f_service_ << ", ";
    }
    f_service_ << "args." << get_member_name((*f_iter)->get_name());
  }
  f_service_ << ");" << endl;

  if (!tfunction->is_oneway() && xceptions.size() > 0) {
    for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
      string result_field_name = get_member_name((*x_iter)->get_name());
      scope_down(f_service_, "");
      f_service_ << " on " << type_name((*x_iter)->get_type())
              << " catch(" << result_field_name << ")";
      scope_up(f_service_);
      if (!tfunction->is_oneway()) {
        indent(f_service_) << "result." << result_field_name << " = "
                   << result_field_name << ";" << endl;
      }
    }
    scope_down(f_service_, " ");
    f_service_ << "catch (th)";
    scope_up(f_service_);
    indent(f_service_) << "// Internal error" << endl;
    indent(f_service_) << "TApplicationError x = new "
               "TApplicationError(TApplicationErrorType.INTERNAL_ERROR, \"Internal error processing "
               << tfunction->get_name() << "\");" << endl;
    indent(f_service_) << "oprot.writeMessageBegin(new TMessage(\"" << tfunction->get_name()
               << "\", TMessageType.EXCEPTION, seqid));" << endl;
    indent(f_service_) << "x.write(oprot);" << endl;
    indent(f_service_) << "oprot.writeMessageEnd();" << endl;
    indent(f_service_) << "oprot.transport.flush();" << endl;
    indent(f_service_) << "return;" << endl;
    scope_down(f_service_);
  }

  if (tfunction->is_oneway()) {
    indent(f_service_) << "return;" << endl;
  } else {
    indent(f_service_) << "oprot.writeMessageBegin(new TMessage(\"" << tfunction->get_name()
               << "\", TMessageType.REPLY, seqid));" << endl;
    indent(f_service_) << "result.write(oprot);" << endl;
    indent(f_service_) << "oprot.writeMessageEnd();" << endl;
    indent(f_service_) << "oprot.transport.flush();" << endl;
  }

  scope_down(f_service_, endl2);
}

/**
 * Deserializes a field of any type.
 *
 * @param tfield The field
 * @param prefix The variable name or container for this field
 */
void t_dart_generator::generate_deserialize_field(ofstream& out, t_field* tfield, string prefix) {
  t_type* type = get_true_type(tfield->get_type());
  string field_name = get_member_name(tfield->get_name());

  if (type->is_void()) {
    throw "CANNOT GENERATE DESERIALIZE CODE FOR void TYPE: " + prefix + field_name;
  }

  string name = prefix + field_name;

  if (type->is_struct() || type->is_xception()) {
    generate_deserialize_struct(out, (t_struct*)type, name);
  } else if (type->is_container()) {
    generate_deserialize_container(out, type, name);
  } else if (type->is_base_type() || type->is_enum()) {

    indent(out) << name << " = iprot.";

    if (type->is_base_type()) {
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
        throw "compiler error: no Dart name for base type " + t_base_type::t_base_name(tbase);
      }
    } else if (type->is_enum()) {
      out << "readI32();";
    }
    out << endl;
  } else {
    printf("DO NOT KNOW HOW TO DESERIALIZE FIELD '%s' TYPE '%s'\n",
           field_name.c_str(),
           type_name(type).c_str());
  }
}

/**
 * Generates an unserializer for a struct, invokes read()
 */
void t_dart_generator::generate_deserialize_struct(ofstream& out, t_struct* tstruct, string prefix) {
  indent(out) << prefix << " = new " << type_name(tstruct) << "();" << endl;
  indent(out) << prefix << ".read(iprot);" << endl;
}

/**
 * Deserializes a container by reading its size and then iterating
 */
void t_dart_generator::generate_deserialize_container(ofstream& out, t_type* ttype, string prefix) {
  indent(out);
  scope_up(out, "");

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

  indent(out) << prefix << " = new " << type_name(ttype) << "();" << endl;

  // For loop iterates over elements
  string i = tmp("_i");
  indent(out) << "for (int " << i << " = 0; " << i << " < " << obj << ".length"
              << "; "
              << "++" << i << ")";
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
void t_dart_generator::generate_deserialize_map_element(ofstream& out, t_map* tmap, string prefix) {
  string key = tmp("_key");
  string val = tmp("_val");
  t_field fkey(tmap->get_key_type(), key);
  t_field fval(tmap->get_val_type(), val);

  indent(out) << declare_field(&fkey) << endl;
  indent(out) << declare_field(&fval) << endl;

  generate_deserialize_field(out, &fkey);
  generate_deserialize_field(out, &fval);

  indent(out) << prefix << "[" << key << "] = " << val << ";" << endl;
}

/**
 * Deserializes a set element
 */
void t_dart_generator::generate_deserialize_set_element(ofstream& out, t_set* tset, string prefix) {
  string elem = tmp("_elem");
  t_field felem(tset->get_elem_type(), elem);

  indent(out) << declare_field(&felem) << endl;

  generate_deserialize_field(out, &felem);

  indent(out) << prefix << ".add(" << elem << ");" << endl;
}

/**
 * Deserializes a list element
 */
void t_dart_generator::generate_deserialize_list_element(ofstream& out,
                                                        t_list* tlist,
                                                        string prefix) {
  string elem = tmp("_elem");
  t_field felem(tlist->get_elem_type(), elem);

  indent(out) << declare_field(&felem) << endl;

  generate_deserialize_field(out, &felem);

  indent(out) << prefix << ".add(" << elem << ");" << endl;
}

/**
 * Serializes a field of any type.
 *
 * @param tfield The field to serialize
 * @param prefix Name to prepend to field name
 */
void t_dart_generator::generate_serialize_field(ofstream& out, t_field* tfield, string prefix) {
  t_type* type = get_true_type(tfield->get_type());
  string field_name = get_member_name(tfield->get_name());

  // Do nothing for void types
  if (type->is_void()) {
    throw "CANNOT GENERATE SERIALIZE CODE FOR void TYPE: " + prefix + field_name;
  }

  if (type->is_struct() || type->is_xception()) {
    generate_serialize_struct(out, (t_struct*)type, prefix + field_name);
  } else if (type->is_container()) {
    generate_serialize_container(out, type, prefix + field_name);
  } else if (type->is_base_type() || type->is_enum()) {

    string name = prefix + field_name;
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
        throw "compiler error: no Dart name for base type " + t_base_type::t_base_name(tbase);
      }
    } else if (type->is_enum()) {
      out << "writeI32(" << name << ");";
    }
    out << endl;
  } else {
    printf("DO NOT KNOW HOW TO SERIALIZE FIELD '%s%s' TYPE '%s'\n",
           prefix.c_str(),
           field_name.c_str(),
           type_name(type).c_str());
  }
}

/**
 * Serializes all the members of a struct.
 *
 * @param tstruct The struct to serialize
 * @param prefix  String prefix to attach to all fields
 */
void t_dart_generator::generate_serialize_struct(ofstream& out, t_struct* tstruct, string prefix) {
  (void)tstruct;
  indent(out) << prefix << ".write(oprot);" << endl;
}

/**
 * Serializes a container by writing its size then the elements.
 *
 * @param ttype  The type of container
 * @param prefix String prefix for fields
 */
void t_dart_generator::generate_serialize_container(ofstream& out, t_type* ttype, string prefix) {
  indent(out);
  scope_up(out, "");

  if (ttype->is_map()) {
    string iter = tmp("_key");
    indent(out) << "oprot.writeMapBegin(new TMap(" << type_to_enum(((t_map*)ttype)->get_key_type())
                << ", " << type_to_enum(((t_map*)ttype)->get_val_type()) << ", " << prefix << ".length));"
                << endl;
  } else if (ttype->is_set()) {
    indent(out) << "oprot.writeSetBegin(new TSet(" << type_to_enum(((t_set*)ttype)->get_elem_type())
                << ", " << prefix << ".length));" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "oprot.writeListBegin(new TList("
                << type_to_enum(((t_list*)ttype)->get_elem_type()) << ", " << prefix << ".length));"
                << endl;
  }

  string iter = tmp("elem");
  if (ttype->is_map()) {
    indent(out) << "for (var " << iter << " in " << prefix << ".keys)";
  } else if (ttype->is_set() || ttype->is_list()) {
    indent(out) << "for (var " << iter << " in " << prefix << ")";
  }

  scope_up(out);

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
void t_dart_generator::generate_serialize_map_element(ofstream& out,
                                                     t_map* tmap,
                                                     string iter,
                                                     string map) {
  t_field kfield(tmap->get_key_type(), iter);
  generate_serialize_field(out, &kfield, "");
  t_field vfield(tmap->get_val_type(), map + "[" + iter + "]");
  generate_serialize_field(out, &vfield, "");
}

/**
 * Serializes the members of a set.
 */
void t_dart_generator::generate_serialize_set_element(ofstream& out, t_set* tset, string iter) {
  t_field efield(tset->get_elem_type(), iter);
  generate_serialize_field(out, &efield, "");
}

/**
 * Serializes the members of a list.
 */
void t_dart_generator::generate_serialize_list_element(ofstream& out, t_list* tlist, string iter) {
  t_field efield(tlist->get_elem_type(), iter);
  generate_serialize_field(out, &efield, "");
}

/**
 * Returns a Dart type name
 *
 * @param ttype The type
 * @return Dart type name, i.e. Map<Key, Value>
 */
string t_dart_generator::type_name(t_type* ttype) {
  ttype = get_true_type(ttype);

  if (ttype->is_base_type()) {
    return base_type_name((t_base_type*)ttype);
  } else if (ttype->is_enum()) {
    return "int";
  } else if (ttype->is_map()) {
    t_map* tmap = (t_map*)ttype;
    return "Map<" + type_name(tmap->get_key_type()) + ", "
                  + type_name(tmap->get_val_type()) + ">";
  } else if (ttype->is_set()) {
    t_set* tset = (t_set*)ttype;
    return "Set<" + type_name(tset->get_elem_type()) + ">";
  } else if (ttype->is_list()) {
    t_list* tlist = (t_list*)ttype;
    return "List<" + type_name(tlist->get_elem_type()) + ">";
  }

  return get_ttype_class_name(ttype);
}

/**
 * Returns the Dart type that corresponds to the thrift type.
 *
 * @param tbase The base type
 */
string t_dart_generator::base_type_name(t_base_type* type) {
  t_base_type::t_base tbase = type->get_base();

  switch (tbase) {
  case t_base_type::TYPE_VOID:
    return "void";
  case t_base_type::TYPE_STRING:
    if (type->is_binary()) {
      return "Uint8List";
    } else {
      return "String";
    }
  case t_base_type::TYPE_BOOL:
    return "bool";
  case t_base_type::TYPE_I8:
  case t_base_type::TYPE_I16:
  case t_base_type::TYPE_I32:
  case t_base_type::TYPE_I64:
    return "int";
  case t_base_type::TYPE_DOUBLE:
    return "double";
  default:
    throw "compiler error: no Dart name for base type " + t_base_type::t_base_name(tbase);
  }
}

/**
 * Declares a field, which may include initialization as necessary.
 *
 * @param ttype The type
 */
string t_dart_generator::declare_field(t_field* tfield, bool init) {
  string field_name = get_member_name(tfield->get_name());
  string result = type_name(tfield->get_type()) + " " + field_name;
  if (init) {
    t_type* ttype = get_true_type(tfield->get_type());
    if (ttype->is_base_type() && tfield->get_value() != NULL) {
      ofstream dummy;
      result += " = " + render_const_value(dummy, field_name, ttype, tfield->get_value());
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
        result += " = 0.0";
        break;
      }

    } else if (ttype->is_enum()) {
      result += " = 0";
    } else if (ttype->is_container()) {
      result += " = new " + type_name(ttype) + "()";
    } else {
      result += " = new " + type_name(ttype) + "()";
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
string t_dart_generator::function_signature(t_function* tfunction) {
  std::string arguments = argument_list(tfunction->get_arglist());

  std::string returntype;
  if (tfunction->get_returntype()->is_void()) {
    returntype = "Future";
  } else {
    returntype = "Future<" + type_name(tfunction->get_returntype()) + ">";
  }

  std::string result = returntype + " " + get_member_name(tfunction->get_name()) +
                       "(" + arguments + ")";
  return result;
}

/**
 * Renders a comma separated field list, with type names
 */
string t_dart_generator::argument_list(t_struct* tstruct) {
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
    string field_name = get_member_name((*f_iter)->get_name());
    result += type_name((*f_iter)->get_type()) + " " + field_name;
  }
  return result;
}

/**
 * Converts the parse type to a C++ enum string for the given type.
 */
string t_dart_generator::type_to_enum(t_type* type) {
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

std::string t_dart_generator::init_value(t_field* field) {
  // Do not initialize optional fields
  if (field->get_req() == t_field::T_OPTIONAL) {
    return "";
  }

  t_type* ttype = field->get_type();

  // Get the actual type for a typedef
  if (ttype->is_typedef()) {
    ttype = ((t_typedef*)ttype)->get_type();
  }

  // Only consider base types for default initialization
  if (!ttype->is_base_type()) {
    return "";
  }
  t_base_type::t_base tbase = ((t_base_type*)ttype)->get_base();

  // Initialize bools, ints, and doubles with sane defaults
  string result;
  switch (tbase) {
  case t_base_type::TYPE_BOOL:
    result = " = false";
    break;
  case t_base_type::TYPE_I8:
  case t_base_type::TYPE_I16:
  case t_base_type::TYPE_I32:
  case t_base_type::TYPE_I64:
    result = " = 0";
    break;
  case t_base_type::TYPE_DOUBLE:
    result = " = 0.0";
    break;
  case t_base_type::TYPE_VOID:
  case t_base_type::TYPE_STRING:
    result = "";
    break;
  }

  return result;
}

std::string t_dart_generator::get_cap_name(std::string name) {
  name[0] = toupper(name[0]);
  return name;
}

std::string t_dart_generator::get_member_name(std::string name) {
  name[0] = tolower(name[0]);
  return name;
}

std::string t_dart_generator::get_args_class_name(std::string name) {
  return name + "_args";
}

std::string t_dart_generator::get_result_class_name(std::string name) {
  return name + "_result";
}

std::string t_dart_generator::get_file_name(std::string name) {
  // e.g. change APIForFileIO to api_for_file_io

  string ret;
  const char* tmp = name.c_str();
  bool is_prev_lc = true;
  bool is_current_lc = tmp[0] == tolower(tmp[0]);
  bool is_next_lc = false;

  for (unsigned int i = 0; i < name.length(); i++) {
    char lc = tolower(tmp[i]);

    if (i == name.length() - 1) {
      is_next_lc = false;
    } else {
      is_next_lc = (tmp[i+1] == tolower(tmp[i+1]));
    }

    if (i != 0 && !is_current_lc && (is_prev_lc || is_next_lc)) {
      ret += "_";
    }
    ret += lc;

    is_prev_lc = is_current_lc;
    is_current_lc = is_next_lc;
  }

  return ret;
}

std::string t_dart_generator::get_constants_class_name(std::string name) {
  // e.g. change my_great_model to MyGreatModelConstants
  string ret;
  const char* tmp = name.c_str();
  bool is_prev_underscore = true;

  for (unsigned int i = 0; i < name.length(); i++) {
    if (tmp[i] == '_') {
      is_prev_underscore = true;
    } else {
      if (is_prev_underscore) {
        ret += toupper(tmp[i]);
      } else {
        ret += tmp[i];
      }

      is_prev_underscore = false;
    }
  }

  return ret + "Constants";
}

string t_dart_generator::constant_name(string name) {
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

/**
 * Emits a doc comment if the provided object has a doc in Thrift
 */
void t_dart_generator::generate_dart_doc(ofstream& out, t_doc* tdoc) {
  if (tdoc->has_doc()) {
    generate_docstring_comment(out, "", "/// ", tdoc->get_doc(), "");
  }
}

/**
 * Emits a doc comment if the provided function object has a doc in Thrift
 */
void t_dart_generator::generate_dart_doc(ofstream& out, t_function* tfunction) {
  if (tfunction->has_doc()) {
    stringstream ss;
    ss << tfunction->get_doc();
    const vector<t_field*>& fields = tfunction->get_arglist()->get_members();
    vector<t_field*>::const_iterator p_iter;
    for (p_iter = fields.begin(); p_iter != fields.end(); ++p_iter) {
      t_field* p = *p_iter;
      string field_name = get_member_name(p->get_name());
      ss << "\n@param " << field_name;
      if (p->has_doc()) {
        ss << " " << p->get_doc();
      }
    }
    generate_docstring_comment(out, "", "/// ", ss.str(), "");
  }
}

std::string t_dart_generator::generate_isset_check(t_field* field) {
  string field_name = get_member_name(field->get_name());
  return generate_isset_check(field_name);
}

std::string t_dart_generator::generate_isset_check(std::string field_name) {
  return "is" + get_cap_name("set") + get_cap_name(field_name) + "()";
}

void t_dart_generator::generate_isset_set(ofstream& out, t_field* field) {
  if (!type_can_be_null(field->get_type())) {
    string field_name = get_member_name(field->get_name());
    indent(out) << "this.__isset_" << field_name << " = true;" << endl;
  }
}

std::string t_dart_generator::get_ttype_class_name(t_type* ttype) {
  if (program_ == ttype->get_program()) {
    return ttype->get_name();
  } else {
    string named_import = "t_" + find_library_name(ttype->get_program());
    return named_import + "." + ttype->get_name();
  }
}

THRIFT_REGISTER_GENERATOR(
    dart,
    "Dart",
    "    library_name:    Optional override for library name.\n"
    "    library_prefix:  Generate code that can be used within an existing library.\n"
    "                     Use a dot-separated string, e.g. \"my_parent_lib.src.gen\"\n"
    "    pubspec_lib:     Optional override for thrift lib dependency in pubspec.yaml,\n"
    "                     e.g. \"thrift: 0.x.x\".  Use a pipe delimiter to separate lines,\n"
    "                     e.g. \"thrift:|  git:|    url: git@foo.com\"\n"
)
