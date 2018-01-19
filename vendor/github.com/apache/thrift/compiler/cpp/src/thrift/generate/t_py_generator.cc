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

#include <string>
#include <fstream>
#include <iostream>
#include <vector>

#include <stdlib.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sstream>
#include <algorithm>
#include "thrift/platform.h"
#include "thrift/version.h"
#include "thrift/generate/t_generator.h"

using std::map;
using std::ofstream;
using std::ostringstream;
using std::string;
using std::stringstream;
using std::vector;

static const string endl = "\n"; // avoid ostream << std::endl flushes

/**
 * Python code generator.
 *
 */
class t_py_generator : public t_generator {
public:
  t_py_generator(t_program* program,
                 const std::map<std::string, std::string>& parsed_options,
                 const std::string& option_string)
    : t_generator(program) {
    std::map<std::string, std::string>::const_iterator iter;


    gen_newstyle_ = true;
    gen_utf8strings_ = true;
    gen_dynbase_ = false;
    gen_slots_ = false;
    gen_tornado_ = false;
    gen_twisted_ = false;
    gen_dynamic_ = false;
    coding_ = "";
    gen_dynbaseclass_ = "";
    gen_dynbaseclass_exc_ = "";
    gen_dynbaseclass_frozen_ = "";
    import_dynbase_ = "";
    package_prefix_ = "";
    for( iter = parsed_options.begin(); iter != parsed_options.end(); ++iter) {
      if( iter->first.compare("new_style") == 0) {
        pwarning(0, "new_style is enabled by default, so the option will be removed in the near future.\n");
      } else if( iter->first.compare("old_style") == 0) {
        gen_newstyle_ = false;
        pwarning(0, "old_style is deprecated and may be removed in the future.\n");
      } else if( iter->first.compare("utf8strings") == 0) {
        pwarning(0, "utf8strings is enabled by default, so the option will be removed in the near future.\n");
      } else if( iter->first.compare("no_utf8strings") == 0) {
        gen_utf8strings_ = false;
      } else if( iter->first.compare("slots") == 0) {
        gen_slots_ = true;
      } else if( iter->first.compare("package_prefix") == 0) {
        package_prefix_ = iter->second;
      } else if( iter->first.compare("dynamic") == 0) {
        gen_dynamic_ = true;
        gen_newstyle_ = false; // dynamic is newstyle
        if( gen_dynbaseclass_.empty()) {
          gen_dynbaseclass_ = "TBase";
        }
        if( gen_dynbaseclass_frozen_.empty()) {
          gen_dynbaseclass_frozen_ = "TFrozenBase";
        }
        if( gen_dynbaseclass_exc_.empty()) {
          gen_dynbaseclass_exc_ = "TExceptionBase";
        }
        if( import_dynbase_.empty()) {
          import_dynbase_ = "from thrift.protocol.TBase import TBase, TFrozenBase, TExceptionBase, TTransport\n";
        }
      } else if( iter->first.compare("dynbase") == 0) {
        gen_dynbase_ = true;
        gen_dynbaseclass_ = (iter->second);
      } else if( iter->first.compare("dynfrozen") == 0) {
        gen_dynbaseclass_frozen_ = (iter->second);
      } else if( iter->first.compare("dynexc") == 0) {
        gen_dynbaseclass_exc_ = (iter->second);
      } else if( iter->first.compare("dynimport") == 0) {
        gen_dynbase_ = true;
        import_dynbase_ = (iter->second);
      } else if( iter->first.compare("twisted") == 0) {
        gen_twisted_ = true;
      } else if( iter->first.compare("tornado") == 0) {
        gen_tornado_ = true;
      } else if( iter->first.compare("coding") == 0) {
        coding_ = iter->second;
      } else {
        throw "unknown option py:" + iter->first;
      }
    }

    if (gen_twisted_ && gen_tornado_) {
      throw "at most one of 'twisted' and 'tornado' are allowed";
    }

    copy_options_ = option_string;

    if (gen_twisted_) {
      out_dir_base_ = "gen-py.twisted";
    } else if (gen_tornado_) {
      out_dir_base_ = "gen-py.tornado";
    } else {
      out_dir_base_ = "gen-py";
    }
  }

  virtual std::string indent_str() const {
    return "    ";
  }

  /**
   * Init and close methods
   */

  void init_generator();
  void close_generator();

  /**
   * Program-level generation functions
   */

  void generate_typedef(t_typedef* ttypedef);
  void generate_enum(t_enum* tenum);
  void generate_const(t_const* tconst);
  void generate_struct(t_struct* tstruct);
  void generate_xception(t_struct* txception);
  void generate_service(t_service* tservice);

  std::string render_const_value(t_type* type, t_const_value* value);

  /**
   * Struct generation code
   */

  void generate_py_struct(t_struct* tstruct, bool is_exception);
  void generate_py_struct_definition(std::ofstream& out,
                                     t_struct* tstruct,
                                     bool is_xception = false);
  void generate_py_struct_reader(std::ofstream& out, t_struct* tstruct);
  void generate_py_struct_writer(std::ofstream& out, t_struct* tstruct);
  void generate_py_struct_required_validator(std::ofstream& out, t_struct* tstruct);
  void generate_py_function_helpers(t_function* tfunction);

  /**
   * Service-level generation functions
   */

  void generate_service_helpers(t_service* tservice);
  void generate_service_interface(t_service* tservice);
  void generate_service_client(t_service* tservice);
  void generate_service_remote(t_service* tservice);
  void generate_service_server(t_service* tservice);
  void generate_process_function(t_service* tservice, t_function* tfunction);

  /**
   * Serialization constructs
   */

  void generate_deserialize_field(std::ofstream& out,
                                  t_field* tfield,
                                  std::string prefix = "");

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
                                      std::string kiter,
                                      std::string viter);

  void generate_serialize_set_element(std::ofstream& out, t_set* tmap, std::string iter);

  void generate_serialize_list_element(std::ofstream& out, t_list* tlist, std::string iter);

  void generate_python_docstring(std::ofstream& out, t_struct* tstruct);

  void generate_python_docstring(std::ofstream& out, t_function* tfunction);

  void generate_python_docstring(std::ofstream& out,
                                 t_doc* tdoc,
                                 t_struct* tstruct,
                                 const char* subheader);

  void generate_python_docstring(std::ofstream& out, t_doc* tdoc);

  /**
   * Helper rendering functions
   */

  std::string py_autogen_comment();
  std::string py_imports();
  std::string render_includes();
  std::string declare_argument(t_field* tfield);
  std::string render_field_default_value(t_field* tfield);
  std::string type_name(t_type* ttype);
  std::string function_signature(t_function* tfunction, bool interface = false);
  std::string argument_list(t_struct* tstruct,
                            std::vector<std::string>* pre = NULL,
                            std::vector<std::string>* post = NULL);
  std::string type_to_enum(t_type* ttype);
  std::string type_to_spec_args(t_type* ttype);

  static bool is_valid_namespace(const std::string& sub_namespace) {
    return sub_namespace == "twisted";
  }

  static std::string get_real_py_module(const t_program* program, bool gen_twisted, std::string package_dir="") {
    if (gen_twisted) {
      std::string twisted_module = program->get_namespace("py.twisted");
      if (!twisted_module.empty()) {
        return twisted_module;
      }
    }

    std::string real_module = program->get_namespace("py");
    if (real_module.empty()) {
      return program->get_name();
    }
    return package_dir + real_module;
  }

  static bool is_immutable(t_type* ttype) {
    return ttype->annotations_.find("python.immutable") != ttype->annotations_.end();
  }

private:

  /**
   * True if we should generate new-style classes.
   */
  bool gen_newstyle_;

  /**
  * True if we should generate dynamic style classes.
  */
  bool gen_dynamic_;

  bool gen_dynbase_;
  std::string gen_dynbaseclass_;
  std::string gen_dynbaseclass_frozen_;
  std::string gen_dynbaseclass_exc_;

  std::string import_dynbase_;

  bool gen_slots_;

  std::string copy_options_;

  /**
   * True if we should generate Twisted-friendly RPC services.
   */
  bool gen_twisted_;

  /**
   * True if we should generate code for use with Tornado
   */
  bool gen_tornado_;

  /**
   * True if strings should be encoded using utf-8.
   */
  bool gen_utf8strings_;

  /**
   * specify generated file encoding
   * eg. # -*- coding: utf-8 -*-
   */
  string coding_;

  string package_prefix_;

  /**
   * File streams
   */

  std::ofstream f_types_;
  std::ofstream f_consts_;
  std::ofstream f_service_;

  std::string package_dir_;
  std::string module_;
};

/**
 * Prepares for file generation by opening up the necessary file output
 * streams.
 *
 * @param tprogram The program to generate
 */
void t_py_generator::init_generator() {
  // Make output directory
  string module = get_real_py_module(program_, gen_twisted_);
  package_dir_ = get_out_dir();
  module_ = module;
  while (true) {
    // TODO: Do better error checking here.
    MKDIR(package_dir_.c_str());
    std::ofstream init_py((package_dir_ + "/__init__.py").c_str(), std::ios_base::app);
    init_py.close();
    if (module.empty()) {
      break;
    }
    string::size_type pos = module.find('.');
    if (pos == string::npos) {
      package_dir_ += "/";
      package_dir_ += module;
      module.clear();
    } else {
      package_dir_ += "/";
      package_dir_ += module.substr(0, pos);
      module.erase(0, pos + 1);
    }
  }

  // Make output file
  string f_types_name = package_dir_ + "/" + "ttypes.py";
  f_types_.open(f_types_name.c_str());

  string f_consts_name = package_dir_ + "/" + "constants.py";
  f_consts_.open(f_consts_name.c_str());

  string f_init_name = package_dir_ + "/__init__.py";
  ofstream f_init;
  f_init.open(f_init_name.c_str());
  f_init << "__all__ = ['ttypes', 'constants'";
  vector<t_service*> services = program_->get_services();
  vector<t_service*>::iterator sv_iter;
  for (sv_iter = services.begin(); sv_iter != services.end(); ++sv_iter) {
    f_init << ", '" << (*sv_iter)->get_name() << "'";
  }
  f_init << "]" << endl;
  f_init.close();

  // Print header
  f_types_ << py_autogen_comment() << endl
           << py_imports() << endl
           << render_includes() << endl
           << "from thrift.transport import TTransport" << endl
           << import_dynbase_;

  f_consts_ <<
    py_autogen_comment() << endl <<
    py_imports() << endl <<
    "from .ttypes import *" << endl;
}

/**
 * Renders all the imports necessary for including another Thrift program
 */
string t_py_generator::render_includes() {
  const vector<t_program*>& includes = program_->get_includes();
  string result = "";
  for (size_t i = 0; i < includes.size(); ++i) {
    result += "import " + get_real_py_module(includes[i], gen_twisted_, package_prefix_) + ".ttypes\n";
  }
  return result;
}

/**
 * Autogen'd comment
 */
string t_py_generator::py_autogen_comment() {
  string coding;
  if (!coding_.empty()) {
      coding = "# -*- coding: " + coding_ + " -*-\n";
  }
  return coding + std::string("#\n") + "# Autogenerated by Thrift Compiler (" + THRIFT_VERSION + ")\n"
         + "#\n" + "# DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING\n" + "#\n"
         + "#  options string: " + copy_options_ + "\n" + "#\n";
}

/**
 * Prints standard thrift imports
 */
string t_py_generator::py_imports() {
  ostringstream ss;
  ss << "from thrift.Thrift import TType, TMessageType, TFrozenDict, TException, "
        "TApplicationException"
     << endl
     << "from thrift.protocol.TProtocol import TProtocolException";
  if (gen_utf8strings_) {
    ss << endl << "import sys";
  }
  return ss.str();
}

/**
 * Closes the type files
 */
void t_py_generator::close_generator() {
  // Close types file
  f_types_.close();
  f_consts_.close();
}

/**
 * Generates a typedef. This is not done in Python, types are all implicit.
 *
 * @param ttypedef The type definition
 */
void t_py_generator::generate_typedef(t_typedef* ttypedef) {
  (void)ttypedef;
}

/**
 * Generates code for an enumerated type. Done using a class to scope
 * the values.
 *
 * @param tenum The enumeration
 */
void t_py_generator::generate_enum(t_enum* tenum) {
  std::ostringstream to_string_mapping, from_string_mapping;

  f_types_ << endl << endl << "class " << tenum->get_name() << (gen_newstyle_ ? "(object)" : "")
           << (gen_dynamic_ ? "(" + gen_dynbaseclass_ + ")" : "") << ":" << endl;
  indent_up();
  generate_python_docstring(f_types_, tenum);

  to_string_mapping << indent() << "_VALUES_TO_NAMES = {" << endl;
  from_string_mapping << indent() << "_NAMES_TO_VALUES = {" << endl;

  vector<t_enum_value*> constants = tenum->get_constants();
  vector<t_enum_value*>::iterator c_iter;
  for (c_iter = constants.begin(); c_iter != constants.end(); ++c_iter) {
    int value = (*c_iter)->get_value();
    indent(f_types_) << (*c_iter)->get_name() << " = " << value << endl;

    // Dictionaries to/from string names of enums
    to_string_mapping << indent() << indent() << value << ": \""
                      << escape_string((*c_iter)->get_name()) << "\"," << endl;
    from_string_mapping << indent() << indent() << '"' << escape_string((*c_iter)->get_name())
                        << "\": " << value << ',' << endl;
  }
  to_string_mapping << indent() << "}" << endl;
  from_string_mapping << indent() << "}" << endl;

  indent_down();
  f_types_ << endl;
  f_types_ << to_string_mapping.str() << endl << from_string_mapping.str();
}

/**
 * Generate a constant value
 */
void t_py_generator::generate_const(t_const* tconst) {
  t_type* type = tconst->get_type();
  string name = tconst->get_name();
  t_const_value* value = tconst->get_value();

  indent(f_consts_) << name << " = " << render_const_value(type, value);
  f_consts_ << endl;
}

/**
 * Prints the value of a constant with the given type. Note that type checking
 * is NOT performed in this function as it is always run beforehand using the
 * validate_types method in main.cc
 */
string t_py_generator::render_const_value(t_type* type, t_const_value* value) {
  type = get_true_type(type);
  std::ostringstream out;

  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_STRING:
      out << '"' << get_escaped_string(value) << '"';
      break;
    case t_base_type::TYPE_BOOL:
      out << (value->get_integer() > 0 ? "True" : "False");
      break;
    case t_base_type::TYPE_I8:
    case t_base_type::TYPE_I16:
    case t_base_type::TYPE_I32:
    case t_base_type::TYPE_I64:
      out << value->get_integer();
      break;
    case t_base_type::TYPE_DOUBLE:
      if (value->get_type() == t_const_value::CV_INTEGER) {
        out << value->get_integer();
      } else {
        out << value->get_double();
      }
      break;
    default:
      throw "compiler error: no const of base type " + t_base_type::t_base_name(tbase);
    }
  } else if (type->is_enum()) {
    out << value->get_integer();
  } else if (type->is_struct() || type->is_xception()) {
    out << type_name(type) << "(**{" << endl;
    indent_up();
    const vector<t_field*>& fields = ((t_struct*)type)->get_members();
    vector<t_field*>::const_iterator f_iter;
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
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
      indent(out) << render_const_value(g_type_string, v_iter->first) << ": "
          << render_const_value(field_type, v_iter->second) << "," << endl;
    }
    indent_down();
    indent(out) << "})";
  } else if (type->is_map()) {
    t_type* ktype = ((t_map*)type)->get_key_type();
    t_type* vtype = ((t_map*)type)->get_val_type();
    if (is_immutable(type)) {
      out << "TFrozenDict(";
    }
    out << "{" << endl;
    indent_up();
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      indent(out) << render_const_value(ktype, v_iter->first) << ": "
          << render_const_value(vtype, v_iter->second) << "," << endl;
    }
    indent_down();
    indent(out) << "}";
    if (is_immutable(type)) {
      out << ")";
    }
  } else if (type->is_list() || type->is_set()) {
    t_type* etype;
    if (type->is_list()) {
      etype = ((t_list*)type)->get_elem_type();
    } else {
      etype = ((t_set*)type)->get_elem_type();
    }
    if (type->is_set()) {
      if (is_immutable(type)) {
        out << "frozen";
      }
      out << "set(";
    }
    if (is_immutable(type) || type->is_set()) {
      out << "(" << endl;
    } else {
      out << "[" << endl;
    }
    indent_up();
    const vector<t_const_value*>& val = value->get_list();
    vector<t_const_value*>::const_iterator v_iter;
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      indent(out) << render_const_value(etype, *v_iter) << "," << endl;
    }
    indent_down();
    if (is_immutable(type) || type->is_set()) {
      indent(out) << ")";
    } else {
      indent(out) << "]";
    }
    if (type->is_set()) {
      out << ")";
    }
  } else {
    throw "CANNOT GENERATE CONSTANT FOR TYPE: " + type->get_name();
  }

  return out.str();
}

/**
 * Generates a python struct
 */
void t_py_generator::generate_struct(t_struct* tstruct) {
  generate_py_struct(tstruct, false);
}

/**
 * Generates a struct definition for a thrift exception. Basically the same
 * as a struct but extends the Exception class.
 *
 * @param txception The struct definition
 */
void t_py_generator::generate_xception(t_struct* txception) {
  generate_py_struct(txception, true);
}

/**
 * Generates a python struct
 */
void t_py_generator::generate_py_struct(t_struct* tstruct, bool is_exception) {
  generate_py_struct_definition(f_types_, tstruct, is_exception);
}

/**
 * Generates a struct definition for a thrift data type.
 *
 * @param tstruct The struct definition
 */
void t_py_generator::generate_py_struct_definition(ofstream& out,
                                                   t_struct* tstruct,
                                                   bool is_exception) {
  const vector<t_field*>& members = tstruct->get_members();
  const vector<t_field*>& sorted_members = tstruct->get_sorted_members();
  vector<t_field*>::const_iterator m_iter;

  out << endl << endl << "class " << tstruct->get_name();
  if (is_exception) {
    if (gen_dynamic_) {
      out << "(" << gen_dynbaseclass_exc_ << ")";
    } else {
      out << "(TException)";
    }
  } else if (gen_dynamic_) {
    if (is_immutable(tstruct)) {
      out << "(" << gen_dynbaseclass_frozen_ << ")";
    } else  {
      out << "(" << gen_dynbaseclass_ << ")";
    }
  } else if (gen_newstyle_) {
    out << "(object)";
  }
  out << ":" << endl;
  indent_up();
  generate_python_docstring(out, tstruct);

  out << endl;

  /*
     Here we generate the structure specification for the fastbinary codec.
     These specifications have the following structure:
     thrift_spec -> tuple of item_spec
     item_spec -> None | (tag, type_enum, name, spec_args, default)
     tag -> integer
     type_enum -> TType.I32 | TType.STRING | TType.STRUCT | ...
     name -> string_literal
     default -> None  # Handled by __init__
     spec_args -> None  # For simple types
                | (type_enum, spec_args)  # Value type for list/set
                | (type_enum, spec_args, type_enum, spec_args)
                  # Key and value for map
                | (class_name, spec_args_ptr) # For struct/exception
     class_name -> identifier  # Basically a pointer to the class
     spec_args_ptr -> expression  # just class_name.spec_args

     TODO(dreiss): Consider making this work for structs with negative tags.
  */

  if (gen_slots_) {
    indent(out) << "__slots__ = (" << endl;
    indent_up();
    for (m_iter = sorted_members.begin(); m_iter != sorted_members.end(); ++m_iter) {
      indent(out) << "'" << (*m_iter)->get_name() << "'," << endl;
    }
    indent_down();
    indent(out) << ")" << endl << endl;
  }

  // TODO(dreiss): Look into generating an empty tuple instead of None
  // for structures with no members.
  // TODO(dreiss): Test encoding of structs where some inner structs
  // don't have thrift_spec.
  if (sorted_members.empty() || (sorted_members[0]->get_key() >= 0)) {
    indent(out) << "thrift_spec = (" << endl;
    indent_up();

    int sorted_keys_pos = 0;
    for (m_iter = sorted_members.begin(); m_iter != sorted_members.end(); ++m_iter) {

      for (; sorted_keys_pos != (*m_iter)->get_key(); sorted_keys_pos++) {
        indent(out) << "None,  # " << sorted_keys_pos << endl;
      }

      indent(out) << "(" << (*m_iter)->get_key() << ", " << type_to_enum((*m_iter)->get_type())
                  << ", "
                  << "'" << (*m_iter)->get_name() << "'"
                  << ", " << type_to_spec_args((*m_iter)->get_type()) << ", "
                  << render_field_default_value(*m_iter) << ", "
                  << "),"
                  << "  # " << sorted_keys_pos << endl;

      sorted_keys_pos++;
    }

    indent_down();
    indent(out) << ")" << endl;
  } else {
    indent(out) << "thrift_spec = None" << endl;
  }

  if (members.size() > 0) {
    out << endl;
    out << indent() << "def __init__(self,";

    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      // This fills in default values, as opposed to nulls
      out << " " << declare_argument(*m_iter) << ",";
    }

    out << "):" << endl;

    indent_up();

    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      // Initialize fields
      t_type* type = (*m_iter)->get_type();
      if (!type->is_base_type() && !type->is_enum() && (*m_iter)->get_value() != NULL) {
        indent(out) << "if " << (*m_iter)->get_name() << " is "
                    << "self.thrift_spec[" << (*m_iter)->get_key() << "][4]:" << endl;
        indent_up();
        indent(out) << (*m_iter)->get_name() << " = " << render_field_default_value(*m_iter)
                    << endl;
        indent_down();
      }

      if (is_immutable(tstruct)) {
        if (gen_newstyle_ || gen_dynamic_) {
          indent(out) << "super(" << tstruct->get_name() << ", self).__setattr__('"
                      << (*m_iter)->get_name() << "', " << (*m_iter)->get_name() << ")" << endl;
        } else {
          indent(out) << "self.__dict__['" << (*m_iter)->get_name()
                      << "'] = " << (*m_iter)->get_name() << endl;
        }
      } else {
        indent(out) << "self." << (*m_iter)->get_name() << " = " << (*m_iter)->get_name() << endl;
      }
    }

    indent_down();
  }

  if (is_immutable(tstruct)) {
    out << endl;
    out << indent() << "def __setattr__(self, *args):" << endl
        << indent() << indent_str() << "raise TypeError(\"can't modify immutable instance\")" << endl
        << endl;
    out << indent() << "def __delattr__(self, *args):" << endl
        << indent() << indent_str() << "raise TypeError(\"can't modify immutable instance\")" << endl
        << endl;

    // Hash all of the members in order, and also hash in the class
    // to avoid collisions for stuff like single-field structures.
    out << indent() << "def __hash__(self):" << endl
        << indent() << indent_str() << "return hash(self.__class__) ^ hash((";

    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      out << "self." << (*m_iter)->get_name() << ", ";
    }

    out << "))" << endl;
  }

  if (!gen_dynamic_) {
    out << endl;
    generate_py_struct_reader(out, tstruct);
    generate_py_struct_writer(out, tstruct);
  }

  // For exceptions only, generate a __str__ method. This is
  // because when raised exceptions are printed to the console, __repr__
  // isn't used. See python bug #5882
  if (is_exception) {
    out << endl;
    out << indent() << "def __str__(self):" << endl
        << indent() << indent_str() << "return repr(self)" << endl;
  }

  if (!gen_slots_) {
    out << endl;
    // Printing utilities so that on the command line thrift
    // structs look pretty like dictionaries
    indent(out) << "def __repr__(self):" << endl;
    indent_up();
    out << indent() << "L = ['%s=%r' % (key, value)" << endl
        << indent() << "     for key, value in self.__dict__.items()]" << endl
        << indent() << "return '%s(%s)' % (self.__class__.__name__, ', '.join(L))" << endl
        << endl;
    indent_down();

    // Equality and inequality methods that compare by value
    out << indent() << "def __eq__(self, other):" << endl;
    indent_up();
    out << indent() << "return isinstance(other, self.__class__) and "
                       "self.__dict__ == other.__dict__" << endl;
    indent_down();
    out << endl;

    out << indent() << "def __ne__(self, other):" << endl;
    indent_up();

    out << indent() << "return not (self == other)" << endl;
    indent_down();
  } else if (!gen_dynamic_) {
    out << endl;
    // no base class available to implement __eq__ and __repr__ and __ne__ for us
    // so we must provide one that uses __slots__
    indent(out) << "def __repr__(self):" << endl;
    indent_up();
    out << indent() << "L = ['%s=%r' % (key, getattr(self, key))" << endl
        << indent() << "     for key in self.__slots__]" << endl
        << indent() << "return '%s(%s)' % (self.__class__.__name__, ', '.join(L))" << endl
        << endl;
    indent_down();

    // Equality method that compares each attribute by value and type, walking __slots__
    out << indent() << "def __eq__(self, other):" << endl;
    indent_up();
    out << indent() << "if not isinstance(other, self.__class__):" << endl
        << indent() << indent_str() << "return False" << endl
        << indent() << "for attr in self.__slots__:" << endl
        << indent() << indent_str() << "my_val = getattr(self, attr)" << endl
        << indent() << indent_str() << "other_val = getattr(other, attr)" << endl
        << indent() << indent_str() << "if my_val != other_val:" << endl
        << indent() << indent_str() << indent_str() << "return False" << endl
        << indent() << "return True" << endl
        << endl;
    indent_down();

    out << indent() << "def __ne__(self, other):" << endl
        << indent() << indent_str() << "return not (self == other)" << endl;
  }
  indent_down();
}

/**
 * Generates the read method for a struct
 */
void t_py_generator::generate_py_struct_reader(ofstream& out, t_struct* tstruct) {
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  if (is_immutable(tstruct)) {
    out << indent() << "@classmethod" << endl << indent() << "def read(cls, iprot):" << endl;
  } else {
    indent(out) << "def read(self, iprot):" << endl;
  }
  indent_up();

  const char* id = is_immutable(tstruct) ? "cls" : "self";

  indent(out) << "if iprot._fast_decode is not None "
                 "and isinstance(iprot.trans, TTransport.CReadableTransport) "
                 "and "
              << id << ".thrift_spec is not None:" << endl;
  indent_up();

  if (is_immutable(tstruct)) {
    indent(out) << "return iprot._fast_decode(None, iprot, (cls, cls.thrift_spec))" << endl;
  } else {
    indent(out) << "iprot._fast_decode(self, iprot, (self.__class__, self.thrift_spec))" << endl;
    indent(out) << "return" << endl;
  }
  indent_down();

  indent(out) << "iprot.readStructBegin()" << endl;

  // Loop over reading in fields
  indent(out) << "while True:" << endl;
  indent_up();

  // Read beginning field marker
  indent(out) << "(fname, ftype, fid) = iprot.readFieldBegin()" << endl;

  // Check for field STOP marker and break
  indent(out) << "if ftype == TType.STOP:" << endl;
  indent_up();
  indent(out) << "break" << endl;
  indent_down();

  // Switch statement on the field we are reading
  bool first = true;

  // Generate deserialization code for known cases
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (first) {
      first = false;
      out << indent() << "if ";
    } else {
      out << indent() << "elif ";
    }
    out << "fid == " << (*f_iter)->get_key() << ":" << endl;
    indent_up();
    indent(out) << "if ftype == " << type_to_enum((*f_iter)->get_type()) << ":" << endl;
    indent_up();
    if (is_immutable(tstruct)) {
      generate_deserialize_field(out, *f_iter);
    } else {
      generate_deserialize_field(out, *f_iter, "self.");
    }
    indent_down();
    out << indent() << "else:" << endl << indent() << indent_str() << "iprot.skip(ftype)" << endl;
    indent_down();
  }

  // In the default case we skip the field
  out << indent() << "else:" << endl << indent() << indent_str() << "iprot.skip(ftype)" << endl;

  // Read field end marker
  indent(out) << "iprot.readFieldEnd()" << endl;

  indent_down();

  indent(out) << "iprot.readStructEnd()" << endl;

  if (is_immutable(tstruct)) {
    indent(out) << "return cls(" << endl;
    indent_up();
    for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
      indent(out) << (*f_iter)->get_name() << "=" << (*f_iter)->get_name() << "," << endl;
    }
    indent_down();
    indent(out) << ")" << endl;
  }

  indent_down();
  out << endl;
}

void t_py_generator::generate_py_struct_writer(ofstream& out, t_struct* tstruct) {
  string name = tstruct->get_name();
  const vector<t_field*>& fields = tstruct->get_sorted_members();
  vector<t_field*>::const_iterator f_iter;

  indent(out) << "def write(self, oprot):" << endl;
  indent_up();

  indent(out) << "if oprot._fast_encode is not None and self.thrift_spec is not None:" << endl;
  indent_up();

  indent(out)
      << "oprot.trans.write(oprot._fast_encode(self, (self.__class__, self.thrift_spec)))"
      << endl;
  indent(out) << "return" << endl;
  indent_down();

  indent(out) << "oprot.writeStructBegin('" << name << "')" << endl;

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    // Write field header
    indent(out) << "if self." << (*f_iter)->get_name() << " is not None:" << endl;
    indent_up();
    indent(out) << "oprot.writeFieldBegin("
                << "'" << (*f_iter)->get_name() << "', " << type_to_enum((*f_iter)->get_type())
                << ", " << (*f_iter)->get_key() << ")" << endl;

    // Write field contents
    generate_serialize_field(out, *f_iter, "self.");

    // Write field closer
    indent(out) << "oprot.writeFieldEnd()" << endl;

    indent_down();
  }

  // Write the struct map
  out << indent() << "oprot.writeFieldStop()" << endl << indent() << "oprot.writeStructEnd()"
      << endl;

  out << endl;

  indent_down();
  generate_py_struct_required_validator(out, tstruct);
}

void t_py_generator::generate_py_struct_required_validator(ofstream& out, t_struct* tstruct) {
  indent(out) << "def validate(self):" << endl;
  indent_up();

  const vector<t_field*>& fields = tstruct->get_members();

  if (fields.size() > 0) {
    vector<t_field*>::const_iterator f_iter;

    for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
      t_field* field = (*f_iter);
      if (field->get_req() == t_field::T_REQUIRED) {
        indent(out) << "if self." << field->get_name() << " is None:" << endl;
        indent(out) << indent_str() << "raise TProtocolException(message='Required field "
                    << field->get_name() << " is unset!')" << endl;
      }
    }
  }

  indent(out) << "return" << endl;
  indent_down();
}

/**
 * Generates a thrift service.
 *
 * @param tservice The service definition
 */
void t_py_generator::generate_service(t_service* tservice) {
  string f_service_name = package_dir_ + "/" + service_name_ + ".py";
  f_service_.open(f_service_name.c_str());

  f_service_ << py_autogen_comment() << endl << py_imports() << endl;

  if (tservice->get_extends() != NULL) {
    f_service_ << "import "
               << get_real_py_module(tservice->get_extends()->get_program(), gen_twisted_, package_prefix_) << "."
               << tservice->get_extends()->get_name() << endl;
  }

  f_service_ << "import logging" << endl
             << "from .ttypes import *" << endl
             << "from thrift.Thrift import TProcessor" << endl
             << "from thrift.transport import TTransport" << endl
             << import_dynbase_;

  if (gen_twisted_) {
    f_service_ << "from zope.interface import Interface, implements" << endl
               << "from twisted.internet import defer" << endl
               << "from thrift.transport import TTwisted" << endl;
  } else if (gen_tornado_) {
    f_service_ << "from tornado import gen" << endl;
    f_service_ << "from tornado import concurrent" << endl;
  }

  // Generate the three main parts of the service
  generate_service_interface(tservice);
  generate_service_client(tservice);
  generate_service_server(tservice);
  generate_service_helpers(tservice);
  generate_service_remote(tservice);

  // Close service file
  f_service_.close();
}

/**
 * Generates helper functions for a service.
 *
 * @param tservice The service to generate a header definition for
 */
void t_py_generator::generate_service_helpers(t_service* tservice) {
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;

  f_service_ << endl << "# HELPER FUNCTIONS AND STRUCTURES" << endl;

  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    t_struct* ts = (*f_iter)->get_arglist();
    generate_py_struct_definition(f_service_, ts, false);
    generate_py_function_helpers(*f_iter);
  }
}

/**
 * Generates a struct and helpers for a function.
 *
 * @param tfunction The function
 */
void t_py_generator::generate_py_function_helpers(t_function* tfunction) {
  if (!tfunction->is_oneway()) {
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
    generate_py_struct_definition(f_service_, &result, false);
  }
}

/**
 * Generates a service interface definition.
 *
 * @param tservice The service to generate a header definition for
 */
void t_py_generator::generate_service_interface(t_service* tservice) {
  string extends = "";
  string extends_if = "";
  if (tservice->get_extends() != NULL) {
    extends = type_name(tservice->get_extends());
    extends_if = "(" + extends + ".Iface)";
  } else {
    if (gen_twisted_) {
      extends_if = "(Interface)";
    } else if (gen_newstyle_ || gen_dynamic_ || gen_tornado_) {
      extends_if = "(object)";
    }
  }

  f_service_ << endl << endl << "class Iface" << extends_if << ":" << endl;
  indent_up();
  generate_python_docstring(f_service_, tservice);
  vector<t_function*> functions = tservice->get_functions();
  if (functions.empty()) {
    f_service_ << indent() << "pass" << endl;
  } else {
    vector<t_function*>::iterator f_iter;
    bool first = true;
    for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
      if (first) {
        first = false;
      } else {
        f_service_ << endl;
      }
      f_service_ << indent() << "def " << function_signature(*f_iter, true) << ":" << endl;
      indent_up();
      generate_python_docstring(f_service_, (*f_iter));
      f_service_ << indent() << "pass" << endl;
      indent_down();
    }
  }

  indent_down();
}

/**
 * Generates a service client definition.
 *
 * @param tservice The service to generate a server for.
 */
void t_py_generator::generate_service_client(t_service* tservice) {
  string extends = "";
  string extends_client = "";
  if (tservice->get_extends() != NULL) {
    extends = type_name(tservice->get_extends());
    if (gen_twisted_) {
      extends_client = "(" + extends + ".Client)";
    } else {
      extends_client = extends + ".Client, ";
    }
  } else {
    if (gen_twisted_ && (gen_newstyle_ || gen_dynamic_)) {
      extends_client = "(object)";
    }
  }

  f_service_ << endl << endl;

  if (gen_twisted_) {
    f_service_ << "class Client" << extends_client << ":" << endl
               << indent_str() << "implements(Iface)" << endl
               << endl;
  } else {
    f_service_ << "class Client(" << extends_client << "Iface):" << endl;
  }
  indent_up();
  generate_python_docstring(f_service_, tservice);

  // Constructor function
  if (gen_twisted_) {
    f_service_ << indent() << "def __init__(self, transport, oprot_factory):" << endl;
  } else if (gen_tornado_) {
    f_service_ << indent()
               << "def __init__(self, transport, iprot_factory, oprot_factory=None):" << endl;
  } else {
    f_service_ << indent() << "def __init__(self, iprot, oprot=None):" << endl;
  }
  indent_up();
  if (extends.empty()) {
    if (gen_twisted_) {
      f_service_ << indent() << "self._transport = transport" << endl
                 << indent() << "self._oprot_factory = oprot_factory" << endl
                 << indent() << "self._seqid = 0" << endl
                 << indent() << "self._reqs = {}" << endl;
    } else if (gen_tornado_) {
      f_service_ << indent() << "self._transport = transport" << endl
                 << indent() << "self._iprot_factory = iprot_factory" << endl
                 << indent() << "self._oprot_factory = (oprot_factory if oprot_factory is not None"
                 << endl
                 << indent() << "                       else iprot_factory)" << endl
                 << indent() << "self._seqid = 0" << endl
                 << indent() << "self._reqs = {}" << endl
                 << indent() << "self._transport.io_loop.spawn_callback(self._start_receiving)"
                 << endl;
    } else {
      f_service_ << indent() << "self._iprot = self._oprot = iprot" << endl
                 << indent() << "if oprot is not None:" << endl
                 << indent() << indent_str() << "self._oprot = oprot" << endl
                 << indent() << "self._seqid = 0" << endl;
    }
  } else {
    if (gen_twisted_) {
      f_service_ << indent() << extends
                 << ".Client.__init__(self, transport, oprot_factory)" << endl;
    } else if (gen_tornado_) {
      f_service_ << indent() << extends
                 << ".Client.__init__(self, transport, iprot_factory, oprot_factory)" << endl;
    } else {
      f_service_ << indent() << extends << ".Client.__init__(self, iprot, oprot)" << endl;
    }
  }
  indent_down();

  if (gen_tornado_ && extends.empty()) {
    f_service_ << endl <<
      indent() << "@gen.engine" << endl <<
      indent() << "def _start_receiving(self):" << endl;
    indent_up();
    indent(f_service_) << "while True:" << endl;
    indent_up();
    f_service_ << indent() << "try:" << endl
               << indent() << indent_str() << "frame = yield self._transport.readFrame()" << endl
               << indent() << "except TTransport.TTransportException as e:" << endl
               << indent() << indent_str() << "for future in self._reqs.values():" << endl
               << indent() << indent_str() << indent_str() << "future.set_exception(e)" << endl
               << indent() << indent_str() << "self._reqs = {}" << endl
               << indent() << indent_str() << "return" << endl
               << indent() << "tr = TTransport.TMemoryBuffer(frame)" << endl
               << indent() << "iprot = self._iprot_factory.getProtocol(tr)" << endl
               << indent() << "(fname, mtype, rseqid) = iprot.readMessageBegin()" << endl
               << indent() << "method = getattr(self, 'recv_' + fname)" << endl
               << indent() << "future = self._reqs.pop(rseqid, None)" << endl
               << indent() << "if not future:" << endl
               << indent() << indent_str() << "# future has already been discarded" << endl
               << indent() << indent_str() << "continue" << endl
               << indent() << "try:" << endl
               << indent() << indent_str() << "result = method(iprot, mtype, rseqid)" << endl
               << indent() << "except Exception as e:" << endl
               << indent() << indent_str() << "future.set_exception(e)" << endl
               << indent() << "else:" << endl
               << indent() << indent_str() << "future.set_result(result)" << endl;
    indent_down();
    indent_down();
  }

  // Generate client method implementations
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::const_iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    t_struct* arg_struct = (*f_iter)->get_arglist();
    const vector<t_field*>& fields = arg_struct->get_members();
    vector<t_field*>::const_iterator fld_iter;
    string funname = (*f_iter)->get_name();

    f_service_ << endl;
    // Open function
    indent(f_service_) << "def " << function_signature(*f_iter, false) << ":" << endl;
    indent_up();
    generate_python_docstring(f_service_, (*f_iter));
    if (gen_twisted_) {
      indent(f_service_) << "seqid = self._seqid = self._seqid + 1" << endl;
      indent(f_service_) << "self._reqs[seqid] = defer.Deferred()" << endl << endl;
      indent(f_service_) << "d = defer.maybeDeferred(self.send_" << funname;

    } else if (gen_tornado_) {
      indent(f_service_) << "self._seqid += 1" << endl;
      if (!(*f_iter)->is_oneway()) {
        indent(f_service_) << "future = self._reqs[self._seqid] = concurrent.Future()" << endl;
      }
      indent(f_service_) << "self.send_" << funname << "(";

    } else {
      indent(f_service_) << "self.send_" << funname << "(";
    }

    bool first = true;
    if (gen_twisted_) {
      // we need a leading comma if there are args, since it's called as maybeDeferred(funcname,
      // arg)
      first = false;
    }
    for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
      if (first) {
        first = false;
      } else {
        f_service_ << ", ";
      }
      f_service_ << (*fld_iter)->get_name();
    }

    f_service_ << ")" << endl;

    if (!(*f_iter)->is_oneway()) {
      if (gen_twisted_) {
        // nothing. See the next block.
      } else if (gen_tornado_) {
        indent(f_service_) << "return future" << endl;
      } else {
        f_service_ << indent();
        if (!(*f_iter)->get_returntype()->is_void()) {
          f_service_ << "return ";
        }
        f_service_ << "self.recv_" << funname << "()" << endl;
      }
    }
    indent_down();

    if (gen_twisted_) {
      // This block injects the body of the send_<> method for twisted (and a cb/eb pair)
      indent_up();
      indent(f_service_) << "d.addCallbacks(" << endl;

      indent_up();
      f_service_ << indent() << "callback=self.cb_send_" << funname << "," << endl << indent()
                 << "callbackArgs=(seqid,)," << endl << indent() << "errback=self.eb_send_"
                 << funname << "," << endl << indent() << "errbackArgs=(seqid,))" << endl;
      indent_down();

      indent(f_service_) << "return d" << endl;
      indent_down();
      f_service_ << endl;

      indent(f_service_) << "def cb_send_" << funname << "(self, _, seqid):" << endl;
      indent_up();
      if ((*f_iter)->is_oneway()) {
        // if one-way, fire the deferred & remove it from _reqs
        f_service_ << indent() << "d = self._reqs.pop(seqid)" << endl << indent()
                   << "d.callback(None)" << endl << indent() << "return d" << endl;
      } else {
        f_service_ << indent() << "return self._reqs[seqid]" << endl;
      }
      indent_down();
      f_service_ << endl;

      // add an errback to fail the request if the call to send_<> raised an exception
      indent(f_service_) << "def eb_send_" << funname << "(self, f, seqid):" << endl;
      indent_up();
      f_service_ << indent() << "d = self._reqs.pop(seqid)" << endl << indent() << "d.errback(f)"
                 << endl << indent() << "return d" << endl;
      indent_down();
    }

    f_service_ << endl;
    indent(f_service_) << "def send_" << function_signature(*f_iter, false) << ":" << endl;
    indent_up();

    std::string argsname = (*f_iter)->get_name() + "_args";
    std::string messageType = (*f_iter)->is_oneway() ? "TMessageType.ONEWAY" : "TMessageType.CALL";

    // Serialize the request header
    if (gen_twisted_ || gen_tornado_) {
      f_service_ << indent() << "oprot = self._oprot_factory.getProtocol(self._transport)" << endl
                 << indent() << "oprot.writeMessageBegin('" << (*f_iter)->get_name() << "', "
                 << messageType << ", self._seqid)" << endl;
    } else {
      f_service_ << indent() << "self._oprot.writeMessageBegin('" << (*f_iter)->get_name() << "', "
                 << messageType << ", self._seqid)" << endl;
    }

    f_service_ << indent() << "args = " << argsname << "()" << endl;

    for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
      f_service_ << indent() << "args." << (*fld_iter)->get_name() << " = "
                 << (*fld_iter)->get_name() << endl;
    }

    // Write to the stream
    if (gen_twisted_ || gen_tornado_) {
      f_service_ << indent() << "args.write(oprot)" << endl << indent() << "oprot.writeMessageEnd()"
                 << endl << indent() << "oprot.trans.flush()" << endl;
    } else {
      f_service_ << indent() << "args.write(self._oprot)" << endl << indent()
                 << "self._oprot.writeMessageEnd()" << endl << indent()
                 << "self._oprot.trans.flush()" << endl;
    }

    indent_down();

    if (!(*f_iter)->is_oneway()) {
      std::string resultname = (*f_iter)->get_name() + "_result";
      // Open function
      f_service_ << endl;
      if (gen_twisted_ || gen_tornado_) {
        f_service_ << indent() << "def recv_" << (*f_iter)->get_name()
                   << "(self, iprot, mtype, rseqid):" << endl;
      } else {
        t_struct noargs(program_);
        t_function recv_function((*f_iter)->get_returntype(),
                                 string("recv_") + (*f_iter)->get_name(),
                                 &noargs);
        f_service_ << indent() << "def " << function_signature(&recv_function) << ":" << endl;
      }
      indent_up();

      // TODO(mcslee): Validate message reply here, seq ids etc.

      if (gen_twisted_) {
        f_service_ << indent() << "d = self._reqs.pop(rseqid)" << endl;
      } else if (gen_tornado_) {
      } else {
        f_service_ << indent() << "iprot = self._iprot" << endl << indent()
                   << "(fname, mtype, rseqid) = iprot.readMessageBegin()" << endl;
      }

      f_service_ << indent() << "if mtype == TMessageType.EXCEPTION:" << endl
                 << indent() << indent_str() << "x = TApplicationException()" << endl;

      if (gen_twisted_) {
        f_service_ << indent() << indent_str() << "x.read(iprot)" << endl << indent()
                   << indent_str() << "iprot.readMessageEnd()" << endl << indent() << indent_str() << "return d.errback(x)"
                   << endl << indent() << "result = " << resultname << "()" << endl << indent()
                   << "result.read(iprot)" << endl << indent() << "iprot.readMessageEnd()" << endl;
      } else {
        f_service_ << indent() << indent_str() << "x.read(iprot)" << endl << indent()
                   << indent_str() << "iprot.readMessageEnd()" << endl << indent() << indent_str() << "raise x" << endl
                   << indent() << "result = " << resultname << "()" << endl << indent()
                   << "result.read(iprot)" << endl << indent() << "iprot.readMessageEnd()" << endl;
      }

      // Careful, only return _result if not a void function
      if (!(*f_iter)->get_returntype()->is_void()) {
        f_service_ << indent() << "if result.success is not None:" << endl;
        if (gen_twisted_) {
          f_service_ << indent() << indent_str() << "return d.callback(result.success)" << endl;
        } else {
          f_service_ << indent() << indent_str() << "return result.success" << endl;
        }
      }

      t_struct* xs = (*f_iter)->get_xceptions();
      const std::vector<t_field*>& xceptions = xs->get_members();
      vector<t_field*>::const_iterator x_iter;
      for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
        f_service_ << indent() << "if result." << (*x_iter)->get_name() << " is not None:" << endl;
        if (gen_twisted_) {
          f_service_ << indent() << indent_str() << "return d.errback(result." << (*x_iter)->get_name() << ")"
                     << endl;
        } else {
          f_service_ << indent() << indent_str() << "raise result." << (*x_iter)->get_name() << "" << endl;
        }
      }

      // Careful, only return _result if not a void function
      if ((*f_iter)->get_returntype()->is_void()) {
        if (gen_twisted_) {
          f_service_ << indent() << "return d.callback(None)" << endl;
        } else {
          f_service_ << indent() << "return" << endl;
        }
      } else {
        if (gen_twisted_) {
          f_service_
              << indent()
              << "return d.errback(TApplicationException(TApplicationException.MISSING_RESULT, \""
              << (*f_iter)->get_name() << " failed: unknown result\"))" << endl;
        } else {
          f_service_ << indent()
                     << "raise TApplicationException(TApplicationException.MISSING_RESULT, \""
                     << (*f_iter)->get_name() << " failed: unknown result\")" << endl;
        }
      }

      // Close function
      indent_down();
    }
  }

  indent_down();
}

/**
 * Generates a command line tool for making remote requests
 *
 * @param tservice The service to generate a remote for.
 */
void t_py_generator::generate_service_remote(t_service* tservice) {
  vector<t_function*> functions = tservice->get_functions();
  // Get all function from parents
  t_service* parent = tservice->get_extends();
  while (parent != NULL) {
    vector<t_function*> p_functions = parent->get_functions();
    functions.insert(functions.end(), p_functions.begin(), p_functions.end());
    parent = parent->get_extends();
  }
  vector<t_function*>::iterator f_iter;

  string f_remote_name = package_dir_ + "/" + service_name_ + "-remote";
  ofstream f_remote;
  f_remote.open(f_remote_name.c_str());

  f_remote <<
    "#!/usr/bin/env python" << endl <<
    py_autogen_comment() << endl <<
    "import sys" << endl <<
    "import pprint" << endl <<
    "if sys.version_info[0] > 2:" << endl <<
    indent_str() << "from urllib.parse import urlparse" << endl <<
    "else:" << endl <<
    indent_str() << "from urlparse import urlparse" << endl <<
    "from thrift.transport import TTransport, TSocket, TSSLSocket, THttpClient" << endl <<
    "from thrift.protocol.TBinaryProtocol import TBinaryProtocol" << endl <<
    endl;

  f_remote <<
    "from " << module_ << " import " << service_name_ << endl <<
    "from " << module_ << ".ttypes import *" << endl <<
    endl;

  f_remote <<
    "if len(sys.argv) <= 1 or sys.argv[1] == '--help':" << endl <<
    indent_str() << "print('')" << endl <<
    indent_str() << "print('Usage: ' + sys.argv[0] + ' [-h host[:port]] [-u url] [-f[ramed]] [-s[sl]] [-novalidate] [-ca_certs certs] [-keyfile keyfile] [-certfile certfile] function [arg1 [arg2...]]')" << endl <<
    indent_str() << "print('')" << endl <<
    indent_str() << "print('Functions:')" << endl;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    f_remote << indent_str() << "print('  " << (*f_iter)->get_returntype()->get_name() << " "
             << (*f_iter)->get_name() << "(";
    t_struct* arg_struct = (*f_iter)->get_arglist();
    const std::vector<t_field*>& args = arg_struct->get_members();
    vector<t_field*>::const_iterator a_iter;
    std::vector<t_field*>::size_type num_args = args.size();
    bool first = true;
    for (std::vector<t_field*>::size_type i = 0; i < num_args; ++i) {
      if (first) {
        first = false;
      } else {
        f_remote << ", ";
      }
      f_remote << args[i]->get_type()->get_name() << " " << args[i]->get_name();
    }
    f_remote << ")')" << endl;
  }
  f_remote << indent_str() << "print('')" << endl << indent_str() << "sys.exit(0)" << endl << endl;

  f_remote << "pp = pprint.PrettyPrinter(indent=2)" << endl
           << "host = 'localhost'" << endl
           << "port = 9090" << endl
           << "uri = ''" << endl
           << "framed = False" << endl
           << "ssl = False" << endl
           << "validate = True" << endl
           << "ca_certs = None" << endl
           << "keyfile = None" << endl
           << "certfile = None" << endl
           << "http = False" << endl
           << "argi = 1" << endl
           << endl
           << "if sys.argv[argi] == '-h':" << endl
           << indent_str() << "parts = sys.argv[argi + 1].split(':')" << endl
           << indent_str() << "host = parts[0]" << endl
           << indent_str() << "if len(parts) > 1:" << endl
           << indent_str() << indent_str() << "port = int(parts[1])" << endl
           << indent_str() << "argi += 2" << endl
           << endl
           << "if sys.argv[argi] == '-u':" << endl
           << indent_str() << "url = urlparse(sys.argv[argi + 1])" << endl
           << indent_str() << "parts = url[1].split(':')" << endl
           << indent_str() << "host = parts[0]" << endl
           << indent_str() << "if len(parts) > 1:" << endl
           << indent_str() << indent_str() << "port = int(parts[1])" << endl
           << indent_str() << "else:" << endl
           << indent_str() << indent_str() << "port = 80" << endl
           << indent_str() << "uri = url[2]" << endl
           << indent_str() << "if url[4]:" << endl
           << indent_str() << indent_str() << "uri += '?%s' % url[4]" << endl
           << indent_str() << "http = True" << endl
           << indent_str() << "argi += 2" << endl
           << endl
           << "if sys.argv[argi] == '-f' or sys.argv[argi] == '-framed':" << endl
           << indent_str() << "framed = True" << endl
           << indent_str() << "argi += 1" << endl
           << endl
           << "if sys.argv[argi] == '-s' or sys.argv[argi] == '-ssl':" << endl
           << indent_str() << "ssl = True" << endl
           << indent_str() << "argi += 1" << endl
           << endl
           << "if sys.argv[argi] == '-novalidate':" << endl
           << indent_str() << "validate = False" << endl
           << indent_str() << "argi += 1" << endl
           << endl
           << "if sys.argv[argi] == '-ca_certs':" << endl
           << indent_str() << "ca_certs = sys.argv[argi+1]" << endl
           << indent_str() << "argi += 2" << endl
           << endl
           << "if sys.argv[argi] == '-keyfile':" << endl
           << indent_str() << "keyfile = sys.argv[argi+1]" << endl
           << indent_str() << "argi += 2" << endl
           << endl
           << "if sys.argv[argi] == '-certfile':" << endl
           << indent_str() << "certfile = sys.argv[argi+1]" << endl
           << indent_str() << "argi += 2" << endl
           << endl
           << "cmd = sys.argv[argi]" << endl
           << "args = sys.argv[argi + 1:]" << endl
           << endl
           << "if http:" << endl
           << indent_str() << "transport = THttpClient.THttpClient(host, port, uri)" << endl
           << "else:" << endl
           << indent_str() << "if ssl:" << endl
           << indent_str() << indent_str() << "socket = TSSLSocket.TSSLSocket(host, port, "
              "validate=validate, ca_certs=ca_certs, keyfile=keyfile, certfile=certfile)"
           << endl
           << indent_str() << "else:" << endl
           << indent_str() << indent_str() << "socket = TSocket.TSocket(host, port)" << endl
           << indent_str() << "if framed:" << endl
           << indent_str() << indent_str() << "transport = TTransport.TFramedTransport(socket)" << endl
           << indent_str() << "else:" << endl
           << indent_str() << indent_str() << "transport = TTransport.TBufferedTransport(socket)" << endl
           << "protocol = TBinaryProtocol(transport)" << endl
           << "client = " << service_name_ << ".Client(protocol)" << endl
           << "transport.open()" << endl
           << endl;

  // Generate the dispatch methods
  bool first = true;

  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    if (first) {
      first = false;
    } else {
      f_remote << "el";
    }

    t_struct* arg_struct = (*f_iter)->get_arglist();
    const std::vector<t_field*>& args = arg_struct->get_members();
    vector<t_field*>::const_iterator a_iter;
    std::vector<t_field*>::size_type num_args = args.size();

    f_remote << "if cmd == '" << (*f_iter)->get_name() << "':" << endl;
    indent_up();
    f_remote << indent() << "if len(args) != " << num_args << ":" << endl
             << indent() << indent_str() << "print('" << (*f_iter)->get_name() << " requires " << num_args
             << " args')" << endl
             << indent() << indent_str() << "sys.exit(1)" << endl
             << indent() << "pp.pprint(client." << (*f_iter)->get_name() << "(";
    indent_down();
    bool first_arg = true;
    for (std::vector<t_field*>::size_type i = 0; i < num_args; ++i) {
      if (first_arg)
        first_arg = false;
      else
        f_remote << " ";
      if (args[i]->get_type()->is_string()) {
        f_remote << "args[" << i << "],";
      } else {
        f_remote << "eval(args[" << i << "]),";
      }
    }
    f_remote << "))" << endl;

    f_remote << endl;
  }

  if (functions.size() > 0) {
    f_remote << "else:" << endl;
    f_remote << indent_str() << "print('Unrecognized method %s' % cmd)" << endl;
    f_remote << indent_str() << "sys.exit(1)" << endl;
    f_remote << endl;
  }

  f_remote << "transport.close()" << endl;

  // Close service file
  f_remote.close();

#ifndef _MSC_VER

  // Make file executable, love that bitwise OR action
  chmod(f_remote_name.c_str(),
        S_IRUSR | S_IWUSR | S_IXUSR
#ifndef _WIN32
        | S_IRGRP | S_IXGRP | S_IROTH | S_IXOTH
#endif
        );

#endif // _MSC_VER
}

/**
 * Generates a service server definition.
 *
 * @param tservice The service to generate a server for.
 */
void t_py_generator::generate_service_server(t_service* tservice) {
  // Generate the dispatch methods
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;

  string extends = "";
  string extends_processor = "";
  if (tservice->get_extends() != NULL) {
    extends = type_name(tservice->get_extends());
    extends_processor = extends + ".Processor, ";
  }

  f_service_ << endl << endl;

  // Generate the header portion
  if (gen_twisted_) {
    f_service_ << "class Processor(" << extends_processor << "TProcessor):" << endl
               << indent_str() << "implements(Iface)" << endl << endl;
  } else {
    f_service_ << "class Processor(" << extends_processor << "Iface, TProcessor):" << endl;
  }

  indent_up();

  indent(f_service_) << "def __init__(self, handler):" << endl;
  indent_up();
  if (extends.empty()) {
    if (gen_twisted_) {
      f_service_ << indent() << "self._handler = Iface(handler)" << endl;
    } else {
      f_service_ << indent() << "self._handler = handler" << endl;
    }

    f_service_ << indent() << "self._processMap = {}" << endl;
  } else {
    if (gen_twisted_) {
      f_service_ << indent() << extends << ".Processor.__init__(self, Iface(handler))" << endl;
    } else {
      f_service_ << indent() << extends << ".Processor.__init__(self, handler)" << endl;
    }
  }
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    f_service_ << indent() << "self._processMap[\"" << (*f_iter)->get_name()
               << "\"] = Processor.process_" << (*f_iter)->get_name() << endl;
  }
  indent_down();
  f_service_ << endl;

  // Generate the server implementation
  f_service_ << indent() << "def process(self, iprot, oprot):" << endl;
  indent_up();

  f_service_ << indent() << "(name, type, seqid) = iprot.readMessageBegin()" << endl;

  // TODO(mcslee): validate message

  // HOT: dictionary function lookup
  f_service_ << indent() << "if name not in self._processMap:" << endl;
  indent_up();
  f_service_ << indent() << "iprot.skip(TType.STRUCT)" << endl
             << indent() << "iprot.readMessageEnd()" << endl
             << indent()
             << "x = TApplicationException(TApplicationException.UNKNOWN_METHOD, 'Unknown "
                "function %s' % (name))"
             << endl
             << indent() << "oprot.writeMessageBegin(name, TMessageType.EXCEPTION, seqid)" << endl
             << indent() << "x.write(oprot)" << endl
             << indent() << "oprot.writeMessageEnd()" << endl
             << indent() << "oprot.trans.flush()" << endl;

  if (gen_twisted_) {
    f_service_ << indent() << "return defer.succeed(None)" << endl;
  } else {
    f_service_ << indent() << "return" << endl;
  }
  indent_down();

  f_service_ << indent() << "else:" << endl;

  if (gen_twisted_ || gen_tornado_) {
    f_service_ << indent() << indent_str()
               << "return self._processMap[name](self, seqid, iprot, oprot)" << endl;
  } else {
    f_service_ << indent() << indent_str() << "self._processMap[name](self, seqid, iprot, oprot)"
               << endl;

    // Read end of args field, the T_STOP, and the struct close
    f_service_ << indent() << "return True" << endl;
  }

  indent_down();

  // Generate the process subfunctions
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    f_service_ << endl;
    generate_process_function(tservice, *f_iter);
  }

  indent_down();
}

/**
 * Generates a process function definition.
 *
 * @param tfunction The function to write a dispatcher for
 */
void t_py_generator::generate_process_function(t_service* tservice, t_function* tfunction) {
  (void)tservice;
  // Open function
  if (gen_tornado_) {
    f_service_ << indent() << "@gen.coroutine" << endl << indent() << "def process_"
               << tfunction->get_name() << "(self, seqid, iprot, oprot):" << endl;
  } else {
    f_service_ << indent() << "def process_" << tfunction->get_name()
               << "(self, seqid, iprot, oprot):" << endl;
  }

  indent_up();

  string argsname = tfunction->get_name() + "_args";
  string resultname = tfunction->get_name() + "_result";

  f_service_ << indent() << "args = " << argsname << "()" << endl << indent() << "args.read(iprot)"
             << endl << indent() << "iprot.readMessageEnd()" << endl;

  t_struct* xs = tfunction->get_xceptions();
  const std::vector<t_field*>& xceptions = xs->get_members();
  vector<t_field*>::const_iterator x_iter;

  // Declare result for non oneway function
  if (!tfunction->is_oneway()) {
    f_service_ << indent() << "result = " << resultname << "()" << endl;
  }

  if (gen_twisted_) {
    // TODO: Propagate arbitrary exception raised by handler to client as does plain "py"

    // Generate the function call
    t_struct* arg_struct = tfunction->get_arglist();
    const std::vector<t_field*>& fields = arg_struct->get_members();
    vector<t_field*>::const_iterator f_iter;

    f_service_ << indent() << "d = defer.maybeDeferred(self._handler." << tfunction->get_name()
               << ", ";
    bool first = true;
    for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
      if (first) {
        first = false;
      } else {
        f_service_ << ", ";
      }
      f_service_ << "args." << (*f_iter)->get_name();
    }
    f_service_ << ")" << endl;

    // Shortcut out here for oneway functions
    if (tfunction->is_oneway()) {
      f_service_ << indent() << "return d" << endl;
      indent_down();
      f_service_ << endl;
      return;
    }

    f_service_ << indent() << "d.addCallback(self.write_results_success_" << tfunction->get_name()
               << ", result, seqid, oprot)" << endl;

    if (xceptions.size() > 0) {
      f_service_ << indent() << "d.addErrback(self.write_results_exception_"
                 << tfunction->get_name() << ", result, seqid, oprot)" << endl;
    }

    f_service_ << indent() << "return d" << endl;

    indent_down();
    f_service_ << endl;

    indent(f_service_) << "def write_results_success_" << tfunction->get_name()
                       << "(self, success, result, seqid, oprot):" << endl;
    indent_up();
    f_service_ << indent() << "result.success = success" << endl << indent()
               << "oprot.writeMessageBegin(\"" << tfunction->get_name()
               << "\", TMessageType.REPLY, seqid)" << endl << indent() << "result.write(oprot)"
               << endl << indent() << "oprot.writeMessageEnd()" << endl << indent()
               << "oprot.trans.flush()" << endl;
    indent_down();

    // Try block for a function with exceptions
    if (!tfunction->is_oneway() && xceptions.size() > 0) {
      f_service_ << endl;
      indent(f_service_) << "def write_results_exception_" << tfunction->get_name()
                         << "(self, error, result, seqid, oprot):" << endl;
      indent_up();
      f_service_ << indent() << "try:" << endl;

      // Kinda absurd
      f_service_ << indent() << indent_str() << "error.raiseException()" << endl;
      for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
        f_service_ <<
          indent() << "except " << type_name((*x_iter)->get_type()) << " as " << (*x_iter)->get_name() << ":" << endl;
        if (!tfunction->is_oneway()) {
          indent_up();
          f_service_ << indent() << "result." << (*x_iter)->get_name() << " = "
                     << (*x_iter)->get_name() << endl;
          indent_down();
        } else {
          f_service_ << indent() << "pass" << endl;
        }
      }
      f_service_ << indent() << "oprot.writeMessageBegin(\"" << tfunction->get_name()
                 << "\", TMessageType.REPLY, seqid)" << endl << indent() << "result.write(oprot)"
                 << endl << indent() << "oprot.writeMessageEnd()" << endl << indent()
                 << "oprot.trans.flush()" << endl;
      indent_down();
    }

  } else if (gen_tornado_) {
    // TODO: Propagate arbitrary exception raised by handler to client as does plain "py"

    // Generate the function call
    t_struct* arg_struct = tfunction->get_arglist();
    const std::vector<t_field*>& fields = arg_struct->get_members();
    vector<t_field*>::const_iterator f_iter;

    if (xceptions.size() > 0) {
      f_service_ << indent() << "try:" << endl;
      indent_up();
    }
    f_service_ << indent();
    if (!tfunction->is_oneway() && !tfunction->get_returntype()->is_void()) {
      f_service_ << "result.success = ";
    }
    f_service_ << "yield gen.maybe_future(self._handler." << tfunction->get_name() << "(";
    bool first = true;
    for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
      if (first) {
        first = false;
      } else {
        f_service_ << ", ";
      }
      f_service_ << "args." << (*f_iter)->get_name();
    }
    f_service_ << "))" << endl;

    if (!tfunction->is_oneway() && xceptions.size() > 0) {
      indent_down();
      for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
        f_service_ << indent() << "except " << type_name((*x_iter)->get_type()) << " as "
                   << (*x_iter)->get_name() << ":" << endl;
        if (!tfunction->is_oneway()) {
          indent_up();
          f_service_ << indent() << "result." << (*x_iter)->get_name() << " = "
                     << (*x_iter)->get_name() << endl;
          indent_down();
        } else {
          f_service_ << indent() << "pass" << endl;
        }
      }
    }

    if (!tfunction->is_oneway()) {
      f_service_ << indent() << "oprot.writeMessageBegin(\"" << tfunction->get_name()
                 << "\", TMessageType.REPLY, seqid)" << endl << indent() << "result.write(oprot)"
                 << endl << indent() << "oprot.writeMessageEnd()" << endl << indent()
                 << "oprot.trans.flush()" << endl;
    }

    // Close function
    indent_down();

  } else { // py
    // Try block for a function with exceptions
    // It also catches arbitrary exceptions raised by handler method to propagate them to the client
    f_service_ << indent() << "try:" << endl;
    indent_up();

    // Generate the function call
    t_struct* arg_struct = tfunction->get_arglist();
    const std::vector<t_field*>& fields = arg_struct->get_members();
    vector<t_field*>::const_iterator f_iter;

    f_service_ << indent();
    if (!tfunction->is_oneway() && !tfunction->get_returntype()->is_void()) {
      f_service_ << "result.success = ";
    }
    f_service_ << "self._handler." << tfunction->get_name() << "(";
    bool first = true;
    for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
      if (first) {
        first = false;
      } else {
        f_service_ << ", ";
      }
      f_service_ << "args." << (*f_iter)->get_name();
    }
    f_service_ << ")" << endl;
    if (!tfunction->is_oneway()) {
      f_service_  << indent() << "msg_type = TMessageType.REPLY" << endl;
    }

    indent_down();
    f_service_ << indent()
               << "except (TTransport.TTransportException, KeyboardInterrupt, SystemExit):" << endl
               << indent() << indent_str() << "raise" << endl;

    if (!tfunction->is_oneway()) {
      for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
        f_service_ << indent() << "except " << type_name((*x_iter)->get_type()) << " as "
                   << (*x_iter)->get_name() << ":" << endl;
        if (!tfunction->is_oneway()) {
          indent_up();
          f_service_ << indent() << "msg_type = TMessageType.REPLY" << endl;
          f_service_ << indent() << "result." << (*x_iter)->get_name() << " = "
                     << (*x_iter)->get_name() << endl;
          indent_down();
        } else {
          f_service_ << indent() << "pass" << endl;
        }
      }

      f_service_ << indent() << "except Exception as ex:" << endl
                 << indent() << indent_str() << "msg_type = TMessageType.EXCEPTION" << endl
                 << indent() << indent_str() << "logging.exception(ex)" << endl
                 << indent()
                 << indent_str() << "result = TApplicationException(TApplicationException.INTERNAL_ERROR, "
                    "'Internal error')" << endl
                 << indent() << "oprot.writeMessageBegin(\"" << tfunction->get_name()
                 << "\", msg_type, seqid)" << endl
                 << indent() << "result.write(oprot)" << endl
                 << indent() << "oprot.writeMessageEnd()" << endl
                 << indent() << "oprot.trans.flush()" << endl;
    } else {
      f_service_ << indent() << "except:" << endl
                 << indent() << indent_str() << "pass" << endl;
    }

    // Close function
    indent_down();
  }
}

/**
 * Deserializes a field of any type.
 */
void t_py_generator::generate_deserialize_field(ofstream& out,
                                                t_field* tfield,
                                                string prefix) {
  t_type* type = get_true_type(tfield->get_type());

  if (type->is_void()) {
    throw "CANNOT GENERATE DESERIALIZE CODE FOR void TYPE: " + prefix + tfield->get_name();
  }

  string name = prefix + tfield->get_name();

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
      case t_base_type::TYPE_STRING:
        if (((t_base_type*)type)->is_binary()) {
          out << "readBinary()";
        } else if(!gen_utf8strings_) {
          out << "readString()";
        } else {
          out << "readString().decode('utf-8') if sys.version_info[0] == 2 else iprot.readString()";
        }
        break;
      case t_base_type::TYPE_BOOL:
        out << "readBool()";
        break;
      case t_base_type::TYPE_I8:
        out << "readByte()";
        break;
      case t_base_type::TYPE_I16:
        out << "readI16()";
        break;
      case t_base_type::TYPE_I32:
        out << "readI32()";
        break;
      case t_base_type::TYPE_I64:
        out << "readI64()";
        break;
      case t_base_type::TYPE_DOUBLE:
        out << "readDouble()";
        break;
      default:
        throw "compiler error: no Python name for base type " + t_base_type::t_base_name(tbase);
      }
    } else if (type->is_enum()) {
      out << "readI32()";
    }
    out << endl;

  } else {
    printf("DO NOT KNOW HOW TO DESERIALIZE FIELD '%s' TYPE '%s'\n",
           tfield->get_name().c_str(),
           type->get_name().c_str());
  }
}

/**
 * Generates an unserializer for a struct, calling read()
 */
void t_py_generator::generate_deserialize_struct(ofstream& out, t_struct* tstruct, string prefix) {
  if (is_immutable(tstruct)) {
    out << indent() << prefix << " = " << type_name(tstruct) << ".read(iprot)" << endl;
  } else {
    out << indent() << prefix << " = " << type_name(tstruct) << "()" << endl
        << indent() << prefix << ".read(iprot)" << endl;
  }
}

/**
 * Serialize a container by writing out the header followed by
 * data and then a footer.
 */
void t_py_generator::generate_deserialize_container(ofstream& out, t_type* ttype, string prefix) {
  string size = tmp("_size");
  string ktype = tmp("_ktype");
  string vtype = tmp("_vtype");
  string etype = tmp("_etype");

  t_field fsize(g_type_i32, size);
  t_field fktype(g_type_i8, ktype);
  t_field fvtype(g_type_i8, vtype);
  t_field fetype(g_type_i8, etype);

  // Declare variables, read header
  if (ttype->is_map()) {
    out << indent() << prefix << " = {}" << endl << indent() << "(" << ktype << ", " << vtype
        << ", " << size << ") = iprot.readMapBegin()" << endl;
  } else if (ttype->is_set()) {
    out << indent() << prefix << " = set()" << endl << indent() << "(" << etype << ", " << size
        << ") = iprot.readSetBegin()" << endl;
  } else if (ttype->is_list()) {
    out << indent() << prefix << " = []" << endl << indent() << "(" << etype << ", " << size
        << ") = iprot.readListBegin()" << endl;
  }

  // For loop iterates over elements
  string i = tmp("_i");
  indent(out) <<
    "for " << i << " in range(" << size << "):" << endl;

  indent_up();

  if (ttype->is_map()) {
    generate_deserialize_map_element(out, (t_map*)ttype, prefix);
  } else if (ttype->is_set()) {
    generate_deserialize_set_element(out, (t_set*)ttype, prefix);
  } else if (ttype->is_list()) {
    generate_deserialize_list_element(out, (t_list*)ttype, prefix);
  }

  indent_down();

  // Read container end
  if (ttype->is_map()) {
    indent(out) << "iprot.readMapEnd()" << endl;
    if (is_immutable(ttype)) {
      indent(out) << prefix << " = TFrozenDict(" << prefix << ")" << endl;
    }
  } else if (ttype->is_set()) {
    indent(out) << "iprot.readSetEnd()" << endl;
    if (is_immutable(ttype)) {
      indent(out) << prefix << " = frozenset(" << prefix << ")" << endl;
    }
  } else if (ttype->is_list()) {
    if (is_immutable(ttype)) {
      indent(out) << prefix << " = tuple(" << prefix << ")" << endl;
    }
    indent(out) << "iprot.readListEnd()" << endl;
  }
}

/**
 * Generates code to deserialize a map
 */
void t_py_generator::generate_deserialize_map_element(ofstream& out, t_map* tmap, string prefix) {
  string key = tmp("_key");
  string val = tmp("_val");
  t_field fkey(tmap->get_key_type(), key);
  t_field fval(tmap->get_val_type(), val);

  generate_deserialize_field(out, &fkey);
  generate_deserialize_field(out, &fval);

  indent(out) << prefix << "[" << key << "] = " << val << endl;
}

/**
 * Write a set element
 */
void t_py_generator::generate_deserialize_set_element(ofstream& out, t_set* tset, string prefix) {
  string elem = tmp("_elem");
  t_field felem(tset->get_elem_type(), elem);

  generate_deserialize_field(out, &felem);

  indent(out) << prefix << ".add(" << elem << ")" << endl;
}

/**
 * Write a list element
 */
void t_py_generator::generate_deserialize_list_element(ofstream& out,
                                                       t_list* tlist,
                                                       string prefix) {
  string elem = tmp("_elem");
  t_field felem(tlist->get_elem_type(), elem);

  generate_deserialize_field(out, &felem);

  indent(out) << prefix << ".append(" << elem << ")" << endl;
}

/**
 * Serializes a field of any type.
 *
 * @param tfield The field to serialize
 * @param prefix Name to prepend to field name
 */
void t_py_generator::generate_serialize_field(ofstream& out, t_field* tfield, string prefix) {
  t_type* type = get_true_type(tfield->get_type());

  // Do nothing for void types
  if (type->is_void()) {
    throw "CANNOT GENERATE SERIALIZE CODE FOR void TYPE: " + prefix + tfield->get_name();
  }

  if (type->is_struct() || type->is_xception()) {
    generate_serialize_struct(out, (t_struct*)type, prefix + tfield->get_name());
  } else if (type->is_container()) {
    generate_serialize_container(out, type, prefix + tfield->get_name());
  } else if (type->is_base_type() || type->is_enum()) {

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
          out << "writeBinary(" << name << ")";
        } else if (!gen_utf8strings_) {
          out << "writeString(" << name << ")";
        } else {
          out << "writeString(" << name << ".encode('utf-8') if sys.version_info[0] == 2 else " << name << ")";
        }
        break;
      case t_base_type::TYPE_BOOL:
        out << "writeBool(" << name << ")";
        break;
      case t_base_type::TYPE_I8:
        out << "writeByte(" << name << ")";
        break;
      case t_base_type::TYPE_I16:
        out << "writeI16(" << name << ")";
        break;
      case t_base_type::TYPE_I32:
        out << "writeI32(" << name << ")";
        break;
      case t_base_type::TYPE_I64:
        out << "writeI64(" << name << ")";
        break;
      case t_base_type::TYPE_DOUBLE:
        out << "writeDouble(" << name << ")";
        break;
      default:
        throw "compiler error: no Python name for base type " + t_base_type::t_base_name(tbase);
      }
    } else if (type->is_enum()) {
      out << "writeI32(" << name << ")";
    }
    out << endl;
  } else {
    printf("DO NOT KNOW HOW TO SERIALIZE FIELD '%s%s' TYPE '%s'\n",
           prefix.c_str(),
           tfield->get_name().c_str(),
           type->get_name().c_str());
  }
}

/**
 * Serializes all the members of a struct.
 *
 * @param tstruct The struct to serialize
 * @param prefix  String prefix to attach to all fields
 */
void t_py_generator::generate_serialize_struct(ofstream& out, t_struct* tstruct, string prefix) {
  (void)tstruct;
  indent(out) << prefix << ".write(oprot)" << endl;
}

void t_py_generator::generate_serialize_container(ofstream& out, t_type* ttype, string prefix) {
  if (ttype->is_map()) {
    indent(out) << "oprot.writeMapBegin(" << type_to_enum(((t_map*)ttype)->get_key_type()) << ", "
                << type_to_enum(((t_map*)ttype)->get_val_type()) << ", "
                << "len(" << prefix << "))" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "oprot.writeSetBegin(" << type_to_enum(((t_set*)ttype)->get_elem_type()) << ", "
                << "len(" << prefix << "))" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "oprot.writeListBegin(" << type_to_enum(((t_list*)ttype)->get_elem_type())
                << ", "
                << "len(" << prefix << "))" << endl;
  }

  if (ttype->is_map()) {
    string kiter = tmp("kiter");
    string viter = tmp("viter");
    indent(out) << "for " << kiter << ", " << viter << " in " << prefix << ".items():" << endl;
    indent_up();
    generate_serialize_map_element(out, (t_map*)ttype, kiter, viter);
    indent_down();
  } else if (ttype->is_set()) {
    string iter = tmp("iter");
    indent(out) << "for " << iter << " in " << prefix << ":" << endl;
    indent_up();
    generate_serialize_set_element(out, (t_set*)ttype, iter);
    indent_down();
  } else if (ttype->is_list()) {
    string iter = tmp("iter");
    indent(out) << "for " << iter << " in " << prefix << ":" << endl;
    indent_up();
    generate_serialize_list_element(out, (t_list*)ttype, iter);
    indent_down();
  }

  if (ttype->is_map()) {
    indent(out) << "oprot.writeMapEnd()" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "oprot.writeSetEnd()" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "oprot.writeListEnd()" << endl;
  }
}

/**
 * Serializes the members of a map.
 *
 */
void t_py_generator::generate_serialize_map_element(ofstream& out,
                                                    t_map* tmap,
                                                    string kiter,
                                                    string viter) {
  t_field kfield(tmap->get_key_type(), kiter);
  generate_serialize_field(out, &kfield, "");

  t_field vfield(tmap->get_val_type(), viter);
  generate_serialize_field(out, &vfield, "");
}

/**
 * Serializes the members of a set.
 */
void t_py_generator::generate_serialize_set_element(ofstream& out, t_set* tset, string iter) {
  t_field efield(tset->get_elem_type(), iter);
  generate_serialize_field(out, &efield, "");
}

/**
 * Serializes the members of a list.
 */
void t_py_generator::generate_serialize_list_element(ofstream& out, t_list* tlist, string iter) {
  t_field efield(tlist->get_elem_type(), iter);
  generate_serialize_field(out, &efield, "");
}

/**
 * Generates the docstring for a given struct.
 */
void t_py_generator::generate_python_docstring(ofstream& out, t_struct* tstruct) {
  generate_python_docstring(out, tstruct, tstruct, "Attributes");
}

/**
 * Generates the docstring for a given function.
 */
void t_py_generator::generate_python_docstring(ofstream& out, t_function* tfunction) {
  generate_python_docstring(out, tfunction, tfunction->get_arglist(), "Parameters");
}

/**
 * Generates the docstring for a struct or function.
 */
void t_py_generator::generate_python_docstring(ofstream& out,
                                               t_doc* tdoc,
                                               t_struct* tstruct,
                                               const char* subheader) {
  bool has_doc = false;
  stringstream ss;
  if (tdoc->has_doc()) {
    has_doc = true;
    ss << tdoc->get_doc();
  }

  const vector<t_field*>& fields = tstruct->get_members();
  if (fields.size() > 0) {
    if (has_doc) {
      ss << endl;
    }
    has_doc = true;
    ss << subheader << ":\n";
    vector<t_field*>::const_iterator p_iter;
    for (p_iter = fields.begin(); p_iter != fields.end(); ++p_iter) {
      t_field* p = *p_iter;
      ss << " - " << p->get_name();
      if (p->has_doc()) {
        ss << ": " << p->get_doc();
      } else {
        ss << endl;
      }
    }
  }

  if (has_doc) {
    generate_docstring_comment(out, "\"\"\"\n", "", ss.str(), "\"\"\"\n");
  }
}

/**
 * Generates the docstring for a generic object.
 */
void t_py_generator::generate_python_docstring(ofstream& out, t_doc* tdoc) {
  if (tdoc->has_doc()) {
    generate_docstring_comment(out, "\"\"\"\n", "", tdoc->get_doc(), "\"\"\"\n");
  }
}

/**
 * Declares an argument, which may include initialization as necessary.
 *
 * @param tfield The field
 */
string t_py_generator::declare_argument(t_field* tfield) {
  std::ostringstream result;
  result << tfield->get_name() << "=";
  if (tfield->get_value() != NULL) {
    result << "thrift_spec[" << tfield->get_key() << "][4]";
  } else {
    result << "None";
  }
  return result.str();
}

/**
 * Renders a field default value, returns None otherwise.
 *
 * @param tfield The field
 */
string t_py_generator::render_field_default_value(t_field* tfield) {
  t_type* type = get_true_type(tfield->get_type());
  if (tfield->get_value() != NULL) {
    return render_const_value(type, tfield->get_value());
  } else {
    return "None";
  }
}

/**
 * Renders a function signature of the form 'type name(args)'
 *
 * @param tfunction Function definition
 * @return String of rendered function definition
 */
string t_py_generator::function_signature(t_function* tfunction, bool interface) {
  vector<string> pre;
  vector<string> post;
  string signature = tfunction->get_name() + "(";

  if (!(gen_twisted_ && interface)) {
    pre.push_back("self");
  }

  signature += argument_list(tfunction->get_arglist(), &pre, &post) + ")";
  return signature;
}

/**
 * Renders a field list
 */
string t_py_generator::argument_list(t_struct* tstruct, vector<string>* pre, vector<string>* post) {
  string result = "";

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  vector<string>::const_iterator s_iter;
  bool first = true;
  if (pre) {
    for (s_iter = pre->begin(); s_iter != pre->end(); ++s_iter) {
      if (first) {
        first = false;
      } else {
        result += ", ";
      }
      result += *s_iter;
    }
  }
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (first) {
      first = false;
    } else {
      result += ", ";
    }
    result += (*f_iter)->get_name();
  }
  if (post) {
    for (s_iter = post->begin(); s_iter != post->end(); ++s_iter) {
      if (first) {
        first = false;
      } else {
        result += ", ";
      }
      result += *s_iter;
    }
  }
  return result;
}

string t_py_generator::type_name(t_type* ttype) {
  while (ttype->is_typedef()) {
    ttype = ((t_typedef*)ttype)->get_type();
  }

  t_program* program = ttype->get_program();
  if (ttype->is_service()) {
    return get_real_py_module(program, gen_twisted_, package_prefix_) + "." + ttype->get_name();
  }
  if (program != NULL && program != program_) {
    return get_real_py_module(program, gen_twisted_, package_prefix_) + ".ttypes." + ttype->get_name();
  }
  return ttype->get_name();
}

/**
 * Converts the parse type to a Python tyoe
 */
string t_py_generator::type_to_enum(t_type* type) {
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

/** See the comment inside generate_py_struct_definition for what this is. */
string t_py_generator::type_to_spec_args(t_type* ttype) {
  while (ttype->is_typedef()) {
    ttype = ((t_typedef*)ttype)->get_type();
  }

  if (ttype->is_base_type() && reinterpret_cast<t_base_type*>(ttype)->is_binary()) {
    return  "'BINARY'";
  } else if (gen_utf8strings_ && ttype->is_base_type()
             && reinterpret_cast<t_base_type*>(ttype)->is_string()) {
    return "'UTF8'";
  } else if (ttype->is_base_type() || ttype->is_enum()) {
    return  "None";
  } else if (ttype->is_struct() || ttype->is_xception()) {
    return "(" + type_name(ttype) + ", " + type_name(ttype) + ".thrift_spec)";
  } else if (ttype->is_map()) {
    return "(" + type_to_enum(((t_map*)ttype)->get_key_type()) + ", "
           + type_to_spec_args(((t_map*)ttype)->get_key_type()) + ", "
           + type_to_enum(((t_map*)ttype)->get_val_type()) + ", "
           + type_to_spec_args(((t_map*)ttype)->get_val_type()) + ", "
           + (is_immutable(ttype) ? "True" : "False") + ")";

  } else if (ttype->is_set()) {
    return "(" + type_to_enum(((t_set*)ttype)->get_elem_type()) + ", "
           + type_to_spec_args(((t_set*)ttype)->get_elem_type()) + ", "
           + (is_immutable(ttype) ? "True" : "False") + ")";

  } else if (ttype->is_list()) {
    return "(" + type_to_enum(((t_list*)ttype)->get_elem_type()) + ", "
           + type_to_spec_args(((t_list*)ttype)->get_elem_type()) + ", "
           + (is_immutable(ttype) ? "True" : "False") + ")";
  }

  throw "INVALID TYPE IN type_to_spec_args: " + ttype->get_name();
}

THRIFT_REGISTER_GENERATOR(
    py,
    "Python",
    "    twisted:         Generate Twisted-friendly RPC services.\n"
    "    tornado:         Generate code for use with Tornado.\n"
    "    no_utf8strings:  Do not Encode/decode strings using utf8 in the generated code. Basically no effect for Python 3.\n"
    "    coding=CODING:   Add file encoding declare in generated file.\n"
    "    slots:           Generate code using slots for instance members.\n"
    "    dynamic:         Generate dynamic code, less code generated but slower.\n"
    "    dynbase=CLS      Derive generated classes from class CLS instead of TBase.\n"
    "    dynfrozen=CLS    Derive generated immutable classes from class CLS instead of TFrozenBase.\n"
    "    dynexc=CLS       Derive generated exceptions from CLS instead of TExceptionBase.\n"
    "    dynimport='from foo.bar import CLS'\n"
    "                     Add an import line to generated code to find the dynbase class.\n"
    "    package_prefix='top.package.'\n"
    "                     Package prefix for generated files.\n"
    "    old_style:       Deprecated. Generate old-style classes.\n")
