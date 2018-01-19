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
 *
 * Contains some contributions under the Thrift Software License.
 * Please see doc/old-thrift-license.txt in the Thrift distribution for
 * details.
 */

#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

#include <ctype.h>

#include "thrift/platform.h"
#include "thrift/generate/t_oop_generator.h"

using std::map;
using std::ofstream;
using std::ostringstream;
using std::string;
using std::stringstream;
using std::vector;

static const string endl = "\n"; // avoid ostream << std::endl flushes

/* forward declarations */
string initial_caps_to_underscores(string name);
string underscores_to_initial_caps(string name);
string to_upper_case(string name);
string to_lower_case(string name);

/**
 * C code generator, using glib for C typing.
 */
class t_c_glib_generator : public t_oop_generator {
public:
  /* constructor */
  t_c_glib_generator(t_program* program,
                     const map<string, string>& parsed_options,
                     const string& option_string)
    : t_oop_generator(program) {
    (void)option_string;
    std::map<std::string, std::string>::const_iterator iter;

    /* set the output directory */
    this->out_dir_base_ = "gen-c_glib";

    /* no options yet */
    for( iter = parsed_options.begin(); iter != parsed_options.end(); ++iter) {
      throw "unknown option c_glib:" + iter->first;
    }

    /* set the namespace */
    this->nspace = program_->get_namespace("c_glib");

    if (this->nspace.empty()) {
      this->nspace = "";
      this->nspace_u = "";
      this->nspace_uc = "";
      this->nspace_lc = "";
    } else {
      /* replace dots with underscores */
      char* tmp = strdup(this->nspace.c_str());
      for (unsigned int i = 0; i < strlen(tmp); i++) {
        if (tmp[i] == '.') {
          tmp[i] = '_';
        }
      }
      this->nspace = string(tmp, strlen(tmp));
      free(tmp);

      /* clean up the namespace for C.
       * An input of 'namespace foo' should result in:
       *  - nspace = foo       - for thrift objects and typedefs
       *  - nspace_u = Foo     - for internal GObject prefixes
       *  - nspace_uc = FOO_   - for macro prefixes
       *  - nspace_lc = foo_   - for filename and method prefixes
       * The underscores are there since uc and lc strings are used as file and
       * variable prefixes.
       */
      this->nspace_u = initial_caps_to_underscores(this->nspace);
      this->nspace_uc = to_upper_case(this->nspace_u) + "_";
      this->nspace_lc = to_lower_case(this->nspace_u) + "_";
    }
  }

  /* initialization and destruction */
  void init_generator();
  void close_generator();

  /* generation functions */
  void generate_typedef(t_typedef* ttypedef);
  void generate_enum(t_enum* tenum);
  void generate_consts(vector<t_const*> consts);
  void generate_struct(t_struct* tstruct);
  void generate_service(t_service* tservice);
  void generate_xception(t_struct* tstruct);

private:
  /* file streams */
  ofstream f_types_;
  ofstream f_types_impl_;
  ofstream f_header_;
  ofstream f_service_;

  /* namespace variables */
  string nspace;
  string nspace_u;
  string nspace_uc;
  string nspace_lc;

  /* helper functions */
  bool is_complex_type(t_type* ttype);
  bool is_numeric(t_type* ttype);
  string type_name(t_type* ttype, bool in_typedef = false, bool is_const = false);
  string property_type_name(t_type* ttype, bool in_typedef = false, bool is_const = false);
  string base_type_name(t_type* type);
  string type_to_enum(t_type* type);
  string constant_literal(t_type* type, t_const_value* value);
  string constant_value(string name, t_type* type, t_const_value* value);
  string constant_value_with_storage(string name, t_type* type, t_const_value* value);
  string function_signature(t_function* tfunction);
  string argument_list(t_struct* tstruct);
  string xception_list(t_struct* tstruct);
  string declare_field(t_field* tfield,
                       bool init = false,
                       bool pointer = false,
                       bool constant = false,
                       bool reference = false);
  void declare_local_variable(ofstream& out, t_type* ttype, string& base_name, bool for_hash_table);
  void declore_local_variable_for_write(ofstream& out, t_type* ttype, string& base_name);

  /* generation functions */
  void generate_const_initializer(string name,
                                  t_type* type,
                                  t_const_value* value,
                                  bool top_level = false);
  void generate_service_helpers(t_service* tservice);
  void generate_service_client(t_service* tservice);
  void generate_service_handler(t_service* tservice);
  void generate_service_processor(t_service* tservice);
  void generate_service_server(t_service* tservice);
  void generate_object(t_struct* tstruct);
  void generate_struct_writer(ofstream& out,
                              t_struct* tstruct,
                              string this_name,
                              string this_get = "",
                              bool is_function = true);
  void generate_struct_reader(ofstream& out,
                              t_struct* tstruct,
                              string this_name,
                              string this_get = "",
                              bool is_function = true);

  void generate_serialize_field(ofstream& out,
                                t_field* tfield,
                                string prefix,
                                string suffix,
                                int error_ret);
  void generate_serialize_struct(ofstream& out, t_struct* tstruct, string prefix, int error_ret);
  void generate_serialize_container(ofstream& out, t_type* ttype, string prefix, int error_ret);
  void generate_serialize_map_element(ofstream& out,
                                      t_map* tmap,
                                      string key,
                                      string value,
                                      int error_ret);
  void generate_serialize_set_element(ofstream& out, t_set* tset, string element, int error_ret);
  void generate_serialize_list_element(ofstream& out,
                                       t_list* tlist,
                                       string list,
                                       string index,
                                       int error_ret);

  void generate_deserialize_field(ofstream& out,
                                  t_field* tfield,
                                  string prefix,
                                  string suffix,
                                  int error_ret,
                                  bool allocate = true);
  void generate_deserialize_struct(ofstream& out,
                                   t_struct* tstruct,
                                   string prefix,
                                   int error_ret,
                                   bool allocate = true);
  void generate_deserialize_container(ofstream& out, t_type* ttype, string prefix, int error_ret);
  void generate_deserialize_map_element(ofstream& out, t_map* tmap, string prefix, int error_ret);
  void generate_deserialize_set_element(ofstream& out, t_set* tset, string prefix, int error_ret);
  void generate_deserialize_list_element(ofstream& out,
                                         t_list* tlist,
                                         string prefix,
                                         string index,
                                         int error_ret);

  string generate_new_hash_from_type(t_type* key, t_type* value);
  string generate_new_array_from_type(t_type* ttype);

  string generate_free_func_from_type(t_type* ttype);
  string generate_hash_func_from_type(t_type* ttype);
  string generate_cmp_func_from_type(t_type* ttype);
};

/**
 * Prepare for file generation by opening up the necessary file
 * output streams.
 */
void t_c_glib_generator::init_generator() {
  /* create output directory */
  MKDIR(get_out_dir().c_str());

  string program_name_u = initial_caps_to_underscores(program_name_);
  string program_name_uc = to_upper_case(program_name_u);
  string program_name_lc = to_lower_case(program_name_u);

  /* create output files */
  string f_types_name = get_out_dir() + this->nspace_lc + program_name_lc + "_types.h";
  f_types_.open(f_types_name.c_str());
  string f_types_impl_name = get_out_dir() + this->nspace_lc + program_name_lc + "_types.c";
  f_types_impl_.open(f_types_impl_name.c_str());

  /* add thrift boilerplate headers */
  f_types_ << autogen_comment();
  f_types_impl_ << autogen_comment();

  /* include inclusion guard */
  f_types_ << "#ifndef " << this->nspace_uc << program_name_uc << "_TYPES_H" << endl << "#define "
           << this->nspace_uc << program_name_uc << "_TYPES_H" << endl << endl;

  /* include base types */
  f_types_ << "/* base includes */" << endl << "#include <glib-object.h>" << endl
           << "#include <thrift/c_glib/thrift_struct.h>" << endl
           << "#include <thrift/c_glib/protocol/thrift_protocol.h>" << endl;

  /* include other thrift includes */
  const vector<t_program*>& includes = program_->get_includes();
  for (size_t i = 0; i < includes.size(); ++i) {
    f_types_ << "/* other thrift includes */" << endl << "#include \"" << this->nspace_lc
             << initial_caps_to_underscores(includes[i]->get_name()) << "_types.h\"" << endl;
  }
  f_types_ << endl;

  /* include custom headers */
  const vector<string>& c_includes = program_->get_c_includes();
  f_types_ << "/* custom thrift includes */" << endl;
  for (size_t i = 0; i < c_includes.size(); ++i) {
    if (c_includes[i][0] == '<') {
      f_types_ << "#include " << c_includes[i] << endl;
    } else {
      f_types_ << "#include \"" << c_includes[i] << "\"" << endl;
    }
  }
  f_types_ << endl;

  /* include math.h (for "INFINITY") in the implementation file, in case we
     encounter a struct with a member of type double */
  f_types_impl_ << endl << "#include <math.h>" << endl;

  // include the types file
  f_types_impl_ << endl << "#include \"" << this->nspace_lc << program_name_u << "_types.h\""
                << endl << "#include <thrift/c_glib/thrift.h>" << endl << endl;

  f_types_ << "/* begin types */" << endl << endl;
}

/**
 *  Finish up generation and close all file streams.
 */
void t_c_glib_generator::close_generator() {
  string program_name_uc = to_upper_case(initial_caps_to_underscores(program_name_));

  /* end the header inclusion guard */
  f_types_ << "#endif /* " << this->nspace_uc << program_name_uc << "_TYPES_H */" << endl;

  /* close output file */
  f_types_.close();
  f_types_impl_.close();
}

/**
 * Generates a Thrift typedef in C code.  For example:
 *
 * Thrift:
 * typedef map<i32,i32> SomeMap
 *
 * C:
 * typedef GHashTable * ThriftSomeMap;
 */
void t_c_glib_generator::generate_typedef(t_typedef* ttypedef) {
  f_types_ << indent() << "typedef " << type_name(ttypedef->get_type(), true) << " " << this->nspace
           << ttypedef->get_symbolic() << ";" << endl << endl;
}

/**
 * Generates a C enumeration.  For example:
 *
 * Thrift:
 * enum MyEnum {
 *   ONE = 1,
 *   TWO
 * }
 *
 * C:
 * enum _ThriftMyEnum {
 *   THRIFT_MY_ENUM_ONE = 1,
 *   THRIFT_MY_ENUM_TWO
 * };
 * typedef enum _ThriftMyEnum ThriftMyEnum;
 */
void t_c_glib_generator::generate_enum(t_enum* tenum) {
  string name = tenum->get_name();
  string name_uc = to_upper_case(initial_caps_to_underscores(name));

  f_types_ << indent() << "enum _" << this->nspace << name << " {" << endl;

  indent_up();

  vector<t_enum_value*> constants = tenum->get_constants();
  vector<t_enum_value*>::iterator c_iter;
  bool first = true;

  /* output each of the enumeration elements */
  for (c_iter = constants.begin(); c_iter != constants.end(); ++c_iter) {
    if (first) {
      first = false;
    } else {
      f_types_ << "," << endl;
    }

    f_types_ << indent() << this->nspace_uc << name_uc << "_" << (*c_iter)->get_name();
    f_types_ << " = " << (*c_iter)->get_value();
  }

  indent_down();
  f_types_ << endl << "};" << endl << "typedef enum _" << this->nspace << name << " "
           << this->nspace << name << ";" << endl << endl;

  f_types_ << "/* return the name of the constant */" << endl;
  f_types_ << "const char *" << endl;
  f_types_ << "toString_" << name << "(int value); " << endl << endl;
  ;
  f_types_impl_ << "/* return the name of the constant */" << endl;
  f_types_impl_ << "const char *" << endl;
  f_types_impl_ << "toString_" << name << "(int value) " << endl;
  f_types_impl_ << "{" << endl;
  f_types_impl_ << "  static __thread char buf[16] = {0};" << endl;
  f_types_impl_ << "  switch(value) {" << endl;
  std::set<int> done;
  for (c_iter = constants.begin(); c_iter != constants.end(); ++c_iter) {
    int value = (*c_iter)->get_value();
    // Skipping duplicate value
    if (done.find(value) == done.end()) {
      done.insert(value);
      f_types_impl_ << "  case " << this->nspace_uc << name_uc << "_" << (*c_iter)->get_name()
                    << ":"
                    << "return \"" << this->nspace_uc << name_uc << "_" << (*c_iter)->get_name()
                    << "\";" << endl;
    }
  }
  f_types_impl_ << "  default: g_snprintf(buf, 16, \"%d\", value); return buf;" << endl;
  f_types_impl_ << "  }" << endl;
  f_types_impl_ << "}" << endl << endl;
}

/**
 * Generates Thrift constants in C code.
 */
void t_c_glib_generator::generate_consts(vector<t_const*> consts) {
  f_types_ << "/* constants */" << endl;
  f_types_impl_ << "/* constants */" << endl;

  vector<t_const*>::iterator c_iter;
  for (c_iter = consts.begin(); c_iter != consts.end(); ++c_iter) {
    string name = (*c_iter)->get_name();
    string name_uc = to_upper_case(name);
    string name_lc = to_lower_case(name);
    t_type* type = (*c_iter)->get_type();
    t_const_value* value = (*c_iter)->get_value();

    if (is_complex_type(type)) {
      f_types_ << type_name(type) << indent() << this->nspace_lc << name_lc
               << "_constant();" << endl;
    }

    f_types_ << indent() << "#define " << this->nspace_uc << name_uc << " "
             << constant_value(name_lc, type, value) << endl;

    generate_const_initializer(name_lc, type, value, true);
  }

  f_types_ << endl;
  f_types_impl_ << endl;
}

/**
 * Generate Thrift structs in C code, as GObjects.  Example:
 *
 * Thrift:
 * struct Bonk
 * {
 *   1: string message,
 *   2: i32 type
 * }
 *
 * C GObject instance header:
 * struct _ThriftBonk
 * {
 *   GObject parent;
 *
 *   gchar * message;
 *   gint32 type;
 * };
 * typedef struct _ThriftBonk ThriftBonk
 * // ... additional GObject boilerplate ...
 */
void t_c_glib_generator::generate_struct(t_struct* tstruct) {
  f_types_ << "/* struct " << tstruct->get_name() << " */" << endl;
  generate_object(tstruct);
}

/**
 * Generate C code to represent Thrift services.  Creates a new GObject
 * which can be used to access the service.
 */
void t_c_glib_generator::generate_service(t_service* tservice) {
  string svcname_u = initial_caps_to_underscores(tservice->get_name());
  string svcname_uc = this->nspace_uc + to_upper_case(svcname_u);
  string filename = this->nspace_lc + to_lower_case(svcname_u);

  // make output files
  string f_header_name = get_out_dir() + filename + ".h";
  f_header_.open(f_header_name.c_str());

  string program_name_u = initial_caps_to_underscores(program_name_);
  string program_name_lc = to_lower_case(program_name_u);

  // add header file boilerplate
  f_header_ << autogen_comment();

  // add an inclusion guard
  f_header_ << "#ifndef " << svcname_uc << "_H" << endl << "#define " << svcname_uc << "_H" << endl
            << endl;

  // add standard includes
  f_header_ << "#include <thrift/c_glib/processor/thrift_dispatch_processor.h>" << endl << endl;
  f_header_ << "#include \"" << this->nspace_lc << program_name_lc << "_types.h\"" << endl;

  // if we are inheriting from another service, include its header
  t_service* extends_service = tservice->get_extends();
  if (extends_service != NULL) {
    f_header_ << "#include \"" << this->nspace_lc
              << to_lower_case(initial_caps_to_underscores(extends_service->get_name())) << ".h\""
              << endl;
  }
  f_header_ << endl;

  // create the service implementation
  string f_service_name = get_out_dir() + filename + ".c";
  f_service_.open(f_service_name.c_str());

  // add the boilerplace header
  f_service_ << autogen_comment();

  // include the headers
  f_service_ << "#include <string.h>" << endl << "#include <thrift/c_glib/thrift.h>" << endl
             << "#include <thrift/c_glib/thrift_application_exception.h>" << endl << "#include \""
             << filename << ".h\"" << endl << endl;

  // generate the service-helper classes
  generate_service_helpers(tservice);

  // generate the client objects
  generate_service_client(tservice);

  // generate the server objects
  generate_service_server(tservice);

  // end the header inclusion guard
  f_header_ << "#endif /* " << svcname_uc << "_H */" << endl;

  // close the files
  f_service_.close();
  f_header_.close();
}

/**
 *
 */
void t_c_glib_generator::generate_xception(t_struct* tstruct) {
  string name = tstruct->get_name();
  string name_u = initial_caps_to_underscores(name);
  string name_lc = to_lower_case(name_u);
  string name_uc = to_upper_case(name_u);

  generate_object(tstruct);

  f_types_ << "/* exception */" << endl
           << "typedef enum" << endl
           << "{" << endl;
  indent_up();
  f_types_ << indent() << this->nspace_uc << name_uc << "_ERROR_CODE" << endl;
  indent_down();
  f_types_ << "} " << this->nspace << name << "Error;" << endl
           << endl
           << "GQuark " << this->nspace_lc << name_lc
           << "_error_quark (void);" << endl
           << "#define " << this->nspace_uc << name_uc << "_ERROR ("
           << this->nspace_lc << name_lc << "_error_quark())" << endl
           << endl
           << endl;

  f_types_impl_ << "/* define the GError domain for exceptions */" << endl << "#define "
                << this->nspace_uc << name_uc << "_ERROR_DOMAIN \"" << this->nspace_lc << name_lc
                << "_error_quark\"" << endl << "GQuark" << endl << this->nspace_lc << name_lc
                << "_error_quark (void)" << endl << "{" << endl
                << "  return g_quark_from_static_string (" << this->nspace_uc << name_uc
                << "_ERROR_DOMAIN);" << endl << "}" << endl << endl;
}

/********************
 * HELPER FUNCTIONS *
 ********************/

/**
 * Returns true if ttype is not a primitive.
 */
bool t_c_glib_generator::is_complex_type(t_type* ttype) {
  ttype = get_true_type(ttype);

  return ttype->is_container() || ttype->is_struct() || ttype->is_xception();
}

bool t_c_glib_generator::is_numeric(t_type* ttype) {
  return ttype->is_enum() || (ttype->is_base_type() && !ttype->is_string());
}

/**
 * Maps a Thrift t_type to a C type.
 */
string t_c_glib_generator::type_name(t_type* ttype, bool in_typedef, bool is_const) {
  if (ttype->is_base_type()) {
    string bname = base_type_name(ttype);

    if (is_const) {
      return "const " + bname;
    } else {
      return bname;
    }
  }

  if (ttype->is_container()) {
    string cname;

    t_container* tcontainer = (t_container*)ttype;
    if (tcontainer->has_cpp_name()) {
      cname = tcontainer->get_cpp_name();
    } else if (ttype->is_map()) {
      cname = "GHashTable";
    } else if (ttype->is_set()) {
      // since a set requires unique elements, use a GHashTable, and
      // populate the keys and values with the same data, using keys for
      // the actual writes and reads.
      // TODO: discuss whether or not to implement TSet, THashSet or GHashSet
      cname = "GHashTable";
    } else if (ttype->is_list()) {
      t_type* etype = ((t_list*)ttype)->get_elem_type();
      if (etype->is_void()) {
        throw std::runtime_error("compiler error: list element type cannot be void");
      }
      // TODO: investigate other implementations besides GPtrArray
      cname = is_numeric(etype) ? "GArray" : "GPtrArray";
    }

    /* Omit the dereference operator if we are aliasing this type within a
       typedef, to allow the type to be used more naturally in client code;
       otherwise, include it */
    if (!in_typedef) {
      cname += " *";
    }

    if (is_const) {
      return "const " + cname;
    } else {
      return cname;
    }
  }

  // check for a namespace
  string pname = this->nspace + ttype->get_name();

  if (is_complex_type(ttype)) {
    pname += " *";
  }

  if (is_const) {
    return "const " + pname;
  } else {
    return pname;
  }
}

/**
 * Maps a Thrift primitive to the type needed to hold its value when used as an
 * object property.
 *
 * This method is needed because all integer properties of width less than 64
 * bits map to the same type, gint, as opposed to their width-specific type
 * (gint8, gint16 or gint32).
 */
string t_c_glib_generator::property_type_name(t_type* ttype, bool in_typedef, bool is_const) {
  string result;

  if (ttype->is_base_type()) {
    switch (((t_base_type*)ttype)->get_base()) {
    case t_base_type::TYPE_I8:
    case t_base_type::TYPE_I16:
    case t_base_type::TYPE_I32:
      if (is_const) {
        result = "const gint";
      } else {
        result = "gint";
      }
      break;

    default:
      result = type_name(ttype, in_typedef, is_const);
    }
  } else {
    result = type_name(ttype, in_typedef, is_const);
  }

  return result;
}

/**
 * Maps a Thrift primitive to a C primitive.
 */
string t_c_glib_generator::base_type_name(t_type* type) {
  if (type->is_enum()) {
    return type_name(type);
  }
  if (!type->is_base_type()) {
    throw std::invalid_argument("Only base types are suppported.");
  }
  t_base_type* base_type = reinterpret_cast<t_base_type*>(type);
  t_base_type::t_base tbase = base_type->get_base();
  switch (tbase) {
  case t_base_type::TYPE_VOID:
    return "void";
  case t_base_type::TYPE_STRING:
    if (base_type->is_binary()) {
      return "GByteArray *";
    } else {
      return "gchar *";
    }
  case t_base_type::TYPE_BOOL:
    return "gboolean";
  case t_base_type::TYPE_I8:
    return "gint8";
  case t_base_type::TYPE_I16:
    return "gint16";
  case t_base_type::TYPE_I32:
    return "gint32";
  case t_base_type::TYPE_I64:
    return "gint64";
  case t_base_type::TYPE_DOUBLE:
    return "gdouble";
  default:
    throw std::logic_error("compiler error: no C base type name for base type "
                           + t_base_type::t_base_name(tbase));
  }
}

/**
 * Returns a member of the ThriftType C enumeration in thrift_protocol.h
 * for a Thrift type.
 */
string t_c_glib_generator::type_to_enum(t_type* type) {
  type = get_true_type(type);

  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();

    switch (tbase) {
    case t_base_type::TYPE_VOID:
      throw "NO T_VOID CONSTRUCT";
    case t_base_type::TYPE_STRING:
      return "T_STRING";
    case t_base_type::TYPE_BOOL:
      return "T_BOOL";
    case t_base_type::TYPE_I8:
      return "T_BYTE";
    case t_base_type::TYPE_I16:
      return "T_I16";
    case t_base_type::TYPE_I32:
      return "T_I32";
    case t_base_type::TYPE_I64:
      return "T_I64";
    case t_base_type::TYPE_DOUBLE:
      return "T_DOUBLE";
    }
  } else if (type->is_enum()) {
    return "T_I32";
  } else if (type->is_struct()) {
    return "T_STRUCT";
  } else if (type->is_xception()) {
    return "T_STRUCT";
  } else if (type->is_map()) {
    return "T_MAP";
  } else if (type->is_set()) {
    return "T_SET";
  } else if (type->is_list()) {
    return "T_LIST";
  }

  throw "INVALID TYPE IN type_to_enum: " + type->get_name();
}

/**
 * Returns a Thrift constant formatted as a literal for inclusion in C code.
 */
string t_c_glib_generator::constant_literal(t_type* type, t_const_value* value) {
  ostringstream render;

  if (type->is_base_type()) {
    /* primitives */
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();

    switch (tbase) {
    case t_base_type::TYPE_STRING:
      render << "\"" + value->get_string() + "\"";
      break;
    case t_base_type::TYPE_BOOL:
      render << ((value->get_integer() != 0) ? "TRUE" : "FALSE");
      break;
    case t_base_type::TYPE_I8:
    case t_base_type::TYPE_I16:
    case t_base_type::TYPE_I32:
    case t_base_type::TYPE_I64:
      render << value->get_integer();
      break;
    case t_base_type::TYPE_DOUBLE:
      render << value->get_double();
      break;
    default:
      throw "compiler error: no const of base type " + t_base_type::t_base_name(tbase);
    }
  } else {
    t_const_value::t_const_value_type value_type = value->get_type();

    switch (value_type) {
    case t_const_value::CV_IDENTIFIER:
      render << value->get_integer();
      break;
    case t_const_value::CV_LIST:
      render << "{ ";
      {
        t_type* elem_type = ((t_list*)type)->get_elem_type();
        const vector<t_const_value*>& list = value->get_list();
        vector<t_const_value*>::const_iterator list_iter;

        if (list.size() > 0) {
          list_iter = list.begin();
          render << constant_literal(elem_type, *list_iter);

          while (++list_iter != list.end()) {
            render << ", " << constant_literal(elem_type, *list_iter);
          }
        }
      }
      render << " }";
      break;
    case t_const_value::CV_MAP:
    default:
      render << "NULL /* not supported */";
    }
  }

  return render.str();
}

/**
 * Returns C code that represents a Thrift constant.
 */
string t_c_glib_generator::constant_value(string name, t_type* type, t_const_value* value) {
  ostringstream render;

  if (type->is_base_type()) {
    /* primitives */
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_STRING:
      render << "g_strdup (\"" + value->get_string() + "\")";
      break;
    case t_base_type::TYPE_BOOL:
      render << ((value->get_integer() != 0) ? 1 : 0);
      break;
    case t_base_type::TYPE_I8:
    case t_base_type::TYPE_I16:
    case t_base_type::TYPE_I32:
      render << value->get_integer();
      break;
    case t_base_type::TYPE_I64:
      render << "G_GINT64_CONSTANT (" << value->get_integer() << ")";
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
    render << "(" << type_name(type) << ")" << value->get_integer();
  } else if (is_complex_type(type)) {
    render << "(" << this->nspace_lc << to_lower_case(name) << "_constant())";
  } else {
    render << "NULL /* not supported */";
  }

  return render.str();
}

/**
 * Renders a function signature of the form 'type name(args)'
 *
 * @param tfunction Function definition
 * @return String of rendered function definition
 */
string t_c_glib_generator::function_signature(t_function* tfunction) {
  t_type* ttype = tfunction->get_returntype();
  t_struct* arglist = tfunction->get_arglist();
  t_struct* xlist = tfunction->get_xceptions();
  string fname = initial_caps_to_underscores(tfunction->get_name());

  bool has_return = !ttype->is_void();
  bool has_args = arglist->get_members().size() == 0;
  bool has_xceptions = xlist->get_members().size() == 0;
  return "gboolean " + this->nspace_lc + fname + " (" + this->nspace + service_name_ + "If * iface"
         + (has_return ? ", " + type_name(ttype) + "* _return" : "")
         + (has_args ? "" : (", " + argument_list(arglist)))
         + (has_xceptions ? "" : (", " + xception_list(xlist))) + ", GError ** error)";
}

/**
 * Renders a field list
 *
 * @param tstruct The struct definition
 * @return Comma sepearated list of all field names in that struct
 */
string t_c_glib_generator::argument_list(t_struct* tstruct) {
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
    result += type_name((*f_iter)->get_type(), false, true) + " " + (*f_iter)->get_name();
  }
  return result;
}

/**
 * Renders mutable exception lists
 *
 * @param tstruct The struct definition
 * @return Comma sepearated list of all field names in that struct
 */
string t_c_glib_generator::xception_list(t_struct* tstruct) {
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
    result += type_name((*f_iter)->get_type(), false, false) + "* " + (*f_iter)->get_name();
  }
  return result;
}

/**
 * Declares a field, including any necessary initialization.
 */
string t_c_glib_generator::declare_field(t_field* tfield,
                                         bool init,
                                         bool pointer,
                                         bool constant,
                                         bool reference) {
  string result = "";
  if (constant) {
    result += "const ";
  }
  result += type_name(tfield->get_type());
  if (pointer) {
    result += "*";
  }
  if (reference) {
    result += "*";
  }
  result += " " + tfield->get_name();
  if (init) {
    t_type* type = get_true_type(tfield->get_type());

    if (type->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        break;
      case t_base_type::TYPE_BOOL:
      case t_base_type::TYPE_I8:
      case t_base_type::TYPE_I16:
      case t_base_type::TYPE_I32:
      case t_base_type::TYPE_I64:
        result += " = 0";
        break;
      case t_base_type::TYPE_DOUBLE:
        result += " = (gdouble) 0";
        break;
      case t_base_type::TYPE_STRING:
        result += " = NULL";
        break;
      default:
        throw "compiler error: no C intializer for base type " + t_base_type::t_base_name(tbase);
      }
    } else if (type->is_enum()) {
      result += " = (" + type_name(type) + ") 0";
    } else if (type->is_struct() || type->is_container()) {
      result += " = NULL";
    }
  }

  if (!reference) {
    result += ";";
  }

  return result;
}

string t_c_glib_generator::constant_value_with_storage(string fname,
                                                       t_type* etype,
                                                       t_const_value* value) {
  ostringstream render;
  if (is_numeric(etype)) {
    render << "    " << type_name(etype) << " *" << fname << " = "
           << "g_new (" << base_type_name(etype) << ", 1);" << endl
           << "    *" << fname << " = " << constant_value(fname, (t_type*)etype, value) << ";"
           << endl;
  } else {
    render << "    " << type_name(etype) << " " << fname << " = "
           << constant_value(fname, (t_type*)etype, value) << ";" << endl;
  }
  return render.str();
}

/**
 * Generates C code that initializes complex constants.
 */
void t_c_glib_generator::generate_const_initializer(string name,
                                                    t_type* type,
                                                    t_const_value* value,
                                                    bool top_level) {
  string name_u = initial_caps_to_underscores(name);
  string name_lc = to_lower_case(name_u);
  string type_u = initial_caps_to_underscores(type->get_name());
  string type_uc = to_upper_case(type_u);
  string maybe_static = top_level ? "" : "static ";

  if (type->is_struct() || type->is_xception()) {
    const vector<t_field*>& fields = ((t_struct*)type)->get_members();
    vector<t_field*>::const_iterator f_iter;
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    ostringstream initializers;

    // initialize any constants that may be referenced by this initializer
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      t_type* field_type = NULL;
      string field_name = "";

      for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
        if ((*f_iter)->get_name() == v_iter->first->get_string()) {
          field_type = (*f_iter)->get_type();
          field_name = (*f_iter)->get_name();
          break;
        }
      }
      if (field_type == NULL) {
        throw "type error: " + type->get_name() + " has no field "
          + v_iter->first->get_string();
      }
      field_name = tmp(field_name);

      generate_const_initializer(name + "_constant_" + field_name,
                                 field_type,
                                 v_iter->second);
      initializers << "    constant->" << v_iter->first->get_string() << " = "
                   << constant_value(name + "_constant_" + field_name,
                                     field_type,
                                     v_iter->second) << ";" << endl
                   << "    constant->__isset_" << v_iter->first->get_string()
                   << " = TRUE;" << endl;
    }

    // implement the initializer
    f_types_impl_ << maybe_static << this->nspace << type->get_name() << " *"
                  << endl
                  << this->nspace_lc << name_lc << "_constant (void)" << endl;
    scope_up(f_types_impl_);
    f_types_impl_ << indent() << "static " << this->nspace << type->get_name()
                  << " *constant = NULL;" << endl
                  << indent() << "if (constant == NULL)" << endl;
    scope_up(f_types_impl_);
    f_types_impl_ << indent() << "constant = g_object_new (" << this->nspace_uc
                  << "TYPE_" << type_uc << ", NULL);" << endl
                  << initializers.str();
    scope_down(f_types_impl_);

    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      t_type* field_type = NULL;
      string field_name = "";

      for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
        if ((*f_iter)->get_name() == v_iter->first->get_string()) {
          field_type = (*f_iter)->get_type();
          field_name = (*f_iter)->get_name();
          break;
        }
      }
      if (field_type == NULL) {
        throw "type error: " + type->get_name() + " has no field "
          + v_iter->first->get_string();
      }
      field_name = tmp(field_name);
    }

    f_types_impl_ << indent() << "return constant;" << endl;
    scope_down(f_types_impl_);
    f_types_impl_ << endl;
  } else if (type->is_list()) {
    string list_type = "GPtrArray *";
    string free_func
        = generate_free_func_from_type(reinterpret_cast<t_list*>(type)->get_elem_type());
    string list_initializer = "g_ptr_array_new_with_free_func (" + free_func + ");";
    string list_appender = "g_ptr_array_add";
    bool list_variable = false;

    t_type* etype = ((t_list*)type)->get_elem_type();
    const vector<t_const_value*>& val = value->get_list();
    vector<t_const_value*>::const_iterator v_iter;
    ostringstream initializers;
    ostringstream appenders;

    list_initializer = generate_new_array_from_type(etype);
    if (etype->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)etype)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        throw "compiler error: cannot determine array type";
      case t_base_type::TYPE_BOOL:
      case t_base_type::TYPE_I8:
      case t_base_type::TYPE_I16:
      case t_base_type::TYPE_I32:
      case t_base_type::TYPE_I64:
      case t_base_type::TYPE_DOUBLE:
        list_type = "GArray *";
        list_appender = "g_array_append_val";
        list_variable = true;
        break;
      case t_base_type::TYPE_STRING:
        break;
      default:
        throw "compiler error: no array info for type";
      }
    } else if (etype->is_enum()) {
      list_type = "GArray *";
      list_appender = "g_array_append_val";
      list_variable = true;
    }

    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      string fname = tmp(name);

      generate_const_initializer(fname, etype, (*v_iter));
      if (list_variable) {
        initializers << "    " << type_name(etype) << " " << fname << " = "
                     << constant_value(fname, (t_type*)etype, (*v_iter)) << ";"
                     << endl;
        appenders << "    " << list_appender << "(constant, " << fname << ");"
                  << endl;
      } else {
        appenders << "    " << list_appender << "(constant, "
                  << constant_value(fname, (t_type*)etype, (*v_iter)) << ");"
                  << endl;
      }
    }

    f_types_impl_ << maybe_static << list_type << endl
                  << this->nspace_lc << name_lc << "_constant (void)" << endl;
    scope_up(f_types_impl_);
    f_types_impl_ << indent() << "static " << list_type << " constant = NULL;"
                  << endl
                  << indent() << "if (constant == NULL)" << endl;
    scope_up(f_types_impl_);
    if (!initializers.str().empty()) {
      f_types_impl_ << initializers.str()
                    << endl;
    }
    f_types_impl_ << indent() << "constant = " << list_initializer << endl
                  << appenders.str();
    scope_down(f_types_impl_);
    f_types_impl_ << indent() << "return constant;" << endl;
    scope_down(f_types_impl_);
    f_types_impl_ << endl;
  } else if (type->is_set()) {
    t_type* etype = ((t_set*)type)->get_elem_type();
    const vector<t_const_value*>& val = value->get_list();
    vector<t_const_value*>::const_iterator v_iter;
    ostringstream initializers;
    ostringstream appenders;

    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      string fname = tmp(name);
      string ptr = is_numeric(etype) ? "*" : "";
      generate_const_initializer(fname, etype, (*v_iter));
      initializers << constant_value_with_storage(fname, (t_type*)etype, *v_iter);
      appenders << "    g_hash_table_insert (constant, " << fname << ", 0);" << endl;
    }

    f_types_impl_ << maybe_static << "GHashTable *" << endl
                  << this->nspace_lc << name_lc << "_constant (void)" << endl;
    scope_up(f_types_impl_);
    f_types_impl_ << indent() << "static GHashTable *constant = NULL;" << endl
                  << indent() << "if (constant == NULL)" << endl;
    scope_up(f_types_impl_);
    f_types_impl_ << initializers.str() << endl
                  << indent() << "constant = " << generate_new_hash_from_type(etype, NULL) << endl
                  << appenders.str();
    scope_down(f_types_impl_);
    f_types_impl_ << indent() << "return constant;" << endl;
    scope_down(f_types_impl_);
    f_types_impl_ << endl;
  } else if (type->is_map()) {
    t_type* ktype = ((t_map*)type)->get_key_type();
    t_type* vtype = ((t_map*)type)->get_val_type();
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    ostringstream initializers;
    ostringstream appenders;

    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      string fname = tmp(name);
      string kname = fname + "key";
      string vname = fname + "val";
      generate_const_initializer(kname, ktype, v_iter->first);
      generate_const_initializer(vname, vtype, v_iter->second);

      initializers << constant_value_with_storage(kname, (t_type*)ktype, v_iter->first);
      initializers << constant_value_with_storage(vname, (t_type*)vtype, v_iter->second);
      appenders << "    g_hash_table_insert (constant, " << kname << ", " << vname << ");" << endl;
    }

    f_types_impl_ << maybe_static << "GHashTable *" << endl
                  << this->nspace_lc << name_lc << "_constant (void)" << endl;
    scope_up(f_types_impl_);
    f_types_impl_ << indent() << "static GHashTable *constant = NULL;" << endl
                  << indent() << "if (constant == NULL)" << endl;
    scope_up(f_types_impl_);
    f_types_impl_ << initializers.str() << endl
                  << indent() << "constant = " << generate_new_hash_from_type(ktype, vtype) << endl
                  << appenders.str();
    scope_down(f_types_impl_);
    f_types_impl_ << indent() << "return constant;" << endl;
    scope_down(f_types_impl_);
    f_types_impl_ << endl;
  }
}

/**
 * Generates helper classes for a service, consisting of a ThriftStruct subclass
 * for the arguments to and the result from each method.
 *
 * @param tservice The service for which to generate helper classes
 */
void t_c_glib_generator::generate_service_helpers(t_service* tservice) {
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator function_iter;

  // Iterate through the service's methods
  for (function_iter = functions.begin(); function_iter != functions.end(); ++function_iter) {
    string function_name = (*function_iter)->get_name();
    t_struct* arg_list = (*function_iter)->get_arglist();
    string arg_list_name_orig = arg_list->get_name();

    // Generate the arguments class
    arg_list->set_name(tservice->get_name() + underscores_to_initial_caps(function_name) + "Args");
    generate_struct(arg_list);

    arg_list->set_name(arg_list_name_orig);

    // Generate the result class
    if (!(*function_iter)->is_oneway()) {
      t_struct result(program_,
                      tservice->get_name() + underscores_to_initial_caps(function_name) + "Result");
      t_field success((*function_iter)->get_returntype(), "success", 0);
      success.set_req(t_field::T_OPTIONAL);
      if (!(*function_iter)->get_returntype()->is_void()) {
        result.append(&success);
      }

      t_struct* xs = (*function_iter)->get_xceptions();
      const vector<t_field*>& fields = xs->get_members();
      vector<t_field*>::const_iterator field_iter;
      for (field_iter = fields.begin(); field_iter != fields.end(); ++field_iter) {
        (*field_iter)->set_req(t_field::T_OPTIONAL);
        result.append(*field_iter);
      }

      generate_struct(&result);
    }
  }
}

/**
 * Generates C code that represents a Thrift service client.
 */
void t_c_glib_generator::generate_service_client(t_service* tservice) {
  /* get some C friendly service names */
  string service_name_lc = to_lower_case(initial_caps_to_underscores(service_name_));
  string service_name_uc = to_upper_case(service_name_lc);

  string parent_service_name;
  string parent_service_name_lc;
  string parent_service_name_uc;

  string parent_class_name = "GObject";
  string parent_type_name = "G_TYPE_OBJECT";

  // The service this service extends, or NULL if it extends no
  // service
  t_service* extends_service = tservice->get_extends();
  if (extends_service) {
    // The name of the parent service
    parent_service_name = extends_service->get_name();
    parent_service_name_lc = to_lower_case(initial_caps_to_underscores(parent_service_name));
    parent_service_name_uc = to_upper_case(parent_service_name_lc);

    // The names of the client class' parent class and type
    parent_class_name = this->nspace + parent_service_name + "Client";
    parent_type_name = this->nspace_uc + "TYPE_" + parent_service_name_uc + "_CLIENT";
  }

  // The base service (the topmost in the "extends" hierarchy), on
  // whose client class the "input_protocol" and "output_protocol"
  // properties are defined
  t_service* base_service = tservice;
  while (base_service->get_extends()) {
    base_service = base_service->get_extends();
  }

  string base_service_name = base_service->get_name();
  string base_service_name_lc = to_lower_case(initial_caps_to_underscores(base_service_name));
  string base_service_name_uc = to_upper_case(base_service_name_lc);

  // Generate the client interface dummy object in the header.
  f_header_ << "/* " << service_name_ << " service interface */" << endl << "typedef struct _"
            << this->nspace << service_name_ << "If " << this->nspace << service_name_ << "If; "
            << " /* dummy object */" << endl << endl;

  // Generate the client interface object in the header.
  f_header_ << "struct _" << this->nspace << service_name_ << "IfInterface" << endl << "{" << endl
            << "  GTypeInterface parent;" << endl << endl;

  /* write out the functions for this interface */
  indent_up();
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::const_iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    /* make the function name C friendly */
    string funname = initial_caps_to_underscores((*f_iter)->get_name());
    t_type* ttype = (*f_iter)->get_returntype();
    t_struct* arglist = (*f_iter)->get_arglist();
    t_struct* xlist = (*f_iter)->get_xceptions();
    bool has_return = !ttype->is_void();
    bool has_args = arglist->get_members().size() == 0;
    bool has_xceptions = xlist->get_members().size() == 0;

    string params = "(" + this->nspace + service_name_ + "If *iface"
                    + (has_return ? ", " + type_name(ttype) + "* _return" : "")
                    + (has_args ? "" : (", " + argument_list(arglist)))
                    + (has_xceptions ? "" : (", " + xception_list(xlist))) + ", GError **error)";

    indent(f_header_) << "gboolean (*" << funname << ") " << params << ";" << endl;
  }
  indent_down();

  f_header_ << "};" << endl << "typedef struct _" << this->nspace << service_name_ << "IfInterface "
            << this->nspace << service_name_ << "IfInterface;" << endl << endl;

  // generate all the interface boilerplate
  f_header_ << "GType " << this->nspace_lc << service_name_lc << "_if_get_type (void);" << endl
            << "#define " << this->nspace_uc << "TYPE_" << service_name_uc << "_IF "
            << "(" << this->nspace_lc << service_name_lc << "_if_get_type())" << endl << "#define "
            << this->nspace_uc << service_name_uc << "_IF(obj) "
            << "(G_TYPE_CHECK_INSTANCE_CAST ((obj), " << this->nspace_uc << "TYPE_"
            << service_name_uc << "_IF, " << this->nspace << service_name_ << "If))" << endl
            << "#define " << this->nspace_uc << "IS_" << service_name_uc << "_IF(obj) "
            << "(G_TYPE_CHECK_INSTANCE_TYPE ((obj), " << this->nspace_uc << "TYPE_"
            << service_name_uc << "_IF))" << endl << "#define " << this->nspace_uc
            << service_name_uc << "_IF_GET_INTERFACE(inst) (G_TYPE_INSTANCE_GET_INTERFACE ((inst), "
            << this->nspace_uc << "TYPE_" << service_name_uc << "_IF, " << this->nspace
            << service_name_ << "IfInterface))" << endl << endl;

  // write out all the interface function prototypes
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    /* make the function name C friendly */
    string funname = initial_caps_to_underscores((*f_iter)->get_name());
    t_type* ttype = (*f_iter)->get_returntype();
    t_struct* arglist = (*f_iter)->get_arglist();
    t_struct* xlist = (*f_iter)->get_xceptions();
    bool has_return = !ttype->is_void();
    bool has_args = arglist->get_members().size() == 0;
    bool has_xceptions = xlist->get_members().size() == 0;

    string params = "(" + this->nspace + service_name_ + "If *iface"
                    + (has_return ? ", " + type_name(ttype) + "* _return" : "")
                    + (has_args ? "" : (", " + argument_list(arglist)))
                    + (has_xceptions ? "" : (", " + xception_list(xlist))) + ", GError **error)";

    f_header_ << "gboolean " << this->nspace_lc << service_name_lc << "_if_" << funname << " "
              << params << ";" << endl;
  }
  f_header_ << endl;

  // Generate the client object instance definition in the header.
  f_header_ << "/* " << service_name_ << " service client */" << endl << "struct _" << this->nspace
            << service_name_ << "Client" << endl << "{" << endl << "  " << parent_class_name
            << " parent;" << endl;
  if (!extends_service) {
    // Define "input_protocol" and "output_protocol" properties only
    // for base services; child service-client classes will inherit
    // these
    f_header_ << endl << "  ThriftProtocol *input_protocol;" << endl
              << "  ThriftProtocol *output_protocol;" << endl;
  }
  f_header_ << "};" << endl << "typedef struct _" << this->nspace << service_name_ << "Client "
            << this->nspace << service_name_ << "Client;" << endl << endl;

  // Generate the class definition in the header.
  f_header_ << "struct _" << this->nspace << service_name_ << "ClientClass" << endl << "{" << endl
            << "  " << parent_class_name << "Class parent;" << endl << "};" << endl
            << "typedef struct _" << this->nspace << service_name_ << "ClientClass " << this->nspace
            << service_name_ << "ClientClass;" << endl << endl;

  // Create all the GObject boilerplate
  f_header_ << "GType " << this->nspace_lc << service_name_lc << "_client_get_type (void);" << endl
            << "#define " << this->nspace_uc << "TYPE_" << service_name_uc << "_CLIENT "
            << "(" << this->nspace_lc << service_name_lc << "_client_get_type())" << endl
            << "#define " << this->nspace_uc << service_name_uc << "_CLIENT(obj) "
            << "(G_TYPE_CHECK_INSTANCE_CAST ((obj), " << this->nspace_uc << "TYPE_"
            << service_name_uc << "_CLIENT, " << this->nspace << service_name_ << "Client))" << endl
            << "#define " << this->nspace_uc << service_name_uc << "_CLIENT_CLASS(c) "
            << "(G_TYPE_CHECK_CLASS_CAST ((c), " << this->nspace_uc << "TYPE_" << service_name_uc
            << "_CLIENT, " << this->nspace << service_name_ << "ClientClass))" << endl << "#define "
            << this->nspace_uc << service_name_uc << "_IS_CLIENT(obj) "
            << "(G_TYPE_CHECK_INSTANCE_TYPE ((obj), " << this->nspace_uc << "TYPE_"
            << service_name_uc << "_CLIENT))" << endl << "#define " << this->nspace_uc
            << service_name_uc << "_IS_CLIENT_CLASS(c) "
            << "(G_TYPE_CHECK_CLASS_TYPE ((c), " << this->nspace_uc << "TYPE_" << service_name_uc
            << "_CLIENT))" << endl << "#define " << this->nspace_uc << service_name_uc
            << "_CLIENT_GET_CLASS(obj) "
            << "(G_TYPE_INSTANCE_GET_CLASS ((obj), " << this->nspace_uc << "TYPE_"
            << service_name_uc << "_CLIENT, " << this->nspace << service_name_ << "ClientClass))"
            << endl << endl;

  /* write out the function prototypes */
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    /* make the function name C friendly */
    string funname = to_lower_case(initial_caps_to_underscores((*f_iter)->get_name()));

    t_function service_function((*f_iter)->get_returntype(),
                                service_name_lc + string("_client_") + funname,
                                (*f_iter)->get_arglist(),
                                (*f_iter)->get_xceptions());
    indent(f_header_) << function_signature(&service_function) << ";" << endl;

    t_function send_function(g_type_void,
                             service_name_lc + string("_client_send_") + funname,
                             (*f_iter)->get_arglist());
    indent(f_header_) << function_signature(&send_function) << ";" << endl;

    // implement recv if not a oneway service
    if (!(*f_iter)->is_oneway()) {
      t_struct noargs(program_);
      t_function recv_function((*f_iter)->get_returntype(),
                               service_name_lc + string("_client_recv_") + funname,
                               &noargs,
                               (*f_iter)->get_xceptions());
      indent(f_header_) << function_signature(&recv_function) << ";" << endl;
    }
  }

  /* write out the get/set function prototypes */
  f_header_ << "void " + service_name_lc + "_client_set_property (GObject *object, guint "
                                           "property_id, const GValue *value, GParamSpec *pspec);"
            << endl;
  f_header_ << "void " + service_name_lc + "_client_get_property (GObject *object, guint "
                                           "property_id, GValue *value, GParamSpec *pspec);"
            << endl;

  f_header_ << endl;
  // end of header code

  // Generate interface method implementations
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    /* make the function name C friendly */
    string funname = initial_caps_to_underscores((*f_iter)->get_name());
    t_type* ttype = (*f_iter)->get_returntype();
    t_struct* arglist = (*f_iter)->get_arglist();
    t_struct* xlist = (*f_iter)->get_xceptions();
    bool has_return = !ttype->is_void();
    bool has_args = arglist->get_members().size() == 0;
    bool has_xceptions = xlist->get_members().size() == 0;

    string params = "(" + this->nspace + service_name_ + "If *iface"
                    + (has_return ? ", " + type_name(ttype) + "* _return" : "")
                    + (has_args ? "" : (", " + argument_list(arglist)))
                    + (has_xceptions ? "" : (", " + xception_list(xlist))) + ", GError **error)";

    string params_without_type = string("iface, ") + (has_return ? "_return, " : "");

    const vector<t_field*>& fields = arglist->get_members();
    vector<t_field*>::const_iterator f_iter_field;
    for (f_iter_field = fields.begin(); f_iter_field != fields.end(); ++f_iter_field) {
      params_without_type += (*f_iter_field)->get_name();
      params_without_type += ", ";
    }

    const vector<t_field*>& xceptions = xlist->get_members();
    vector<t_field*>::const_iterator x_iter;
    for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
      params_without_type += (*x_iter)->get_name();
      params_without_type += ", ";
    }

    f_service_ << "gboolean" << endl << this->nspace_lc << service_name_lc << "_if_" << funname
               << " " << params << endl << "{" << endl << "  return " << this->nspace_uc
               << service_name_uc << "_IF_GET_INTERFACE (iface)->" << funname << " ("
               << params_without_type << "error);" << endl << "}" << endl << endl;
  }

  // Generate interface boilerplate
  f_service_ << "GType" << endl << this->nspace_lc << service_name_lc << "_if_get_type (void)"
             << endl << "{" << endl << "  static GType type = 0;" << endl << "  if (type == 0)"
             << endl << "  {" << endl << "    static const GTypeInfo type_info =" << endl << "    {"
             << endl << "      sizeof (" << this->nspace << service_name_ << "IfInterface)," << endl
             << "      NULL,  /* base_init */" << endl << "      NULL,  /* base_finalize */" << endl
             << "      NULL,  /* class_init */" << endl << "      NULL,  /* class_finalize */"
             << endl << "      NULL,  /* class_data */" << endl
             << "      0,     /* instance_size */" << endl << "      0,     /* n_preallocs */"
             << endl << "      NULL,  /* instance_init */" << endl
             << "      NULL   /* value_table */" << endl << "    };" << endl
             << "    type = g_type_register_static (G_TYPE_INTERFACE," << endl
             << "                                   \"" << this->nspace << service_name_ << "If\","
             << endl << "                                   &type_info, 0);" << endl << "  }"
             << endl << "  return type;" << endl << "}" << endl << endl;

  // Generate client boilerplate
  f_service_ << "static void " << endl << this->nspace_lc << service_name_lc
             << "_if_interface_init (" << this->nspace << service_name_ << "IfInterface *iface);"
             << endl << endl << "G_DEFINE_TYPE_WITH_CODE (" << this->nspace << service_name_
             << "Client, " << this->nspace_lc << service_name_lc << "_client," << endl
             << "                         " << parent_type_name << ", " << endl
             << "                         G_IMPLEMENT_INTERFACE (" << this->nspace_uc << "TYPE_"
             << service_name_uc << "_IF," << endl
             << "                                                " << this->nspace_lc
             << service_name_lc << "_if_interface_init))" << endl << endl;

  // Generate property-related code only for base services---child
  // service-client classes have only properties inherited from their
  // parent class
  if (!extends_service) {
    // Generate client properties
    f_service_ << "enum _" << this->nspace << service_name_ << "ClientProperties" << endl << "{"
               << endl << "  PROP_0," << endl << "  PROP_" << this->nspace_uc << service_name_uc
               << "_CLIENT_INPUT_PROTOCOL," << endl << "  PROP_" << this->nspace_uc
               << service_name_uc << "_CLIENT_OUTPUT_PROTOCOL" << endl << "};" << endl << endl;

    // generate property setter
    f_service_ << "void" << endl << this->nspace_lc << service_name_lc << "_client_set_property ("
               << "GObject *object, guint property_id, const GValue *value, "
               << "GParamSpec *pspec)" << endl << "{" << endl << "  " << this->nspace
               << service_name_ << "Client *client = " << this->nspace_uc << service_name_uc
               << "_CLIENT (object);" << endl << endl << "  THRIFT_UNUSED_VAR (pspec);" << endl
               << endl << "  switch (property_id)" << endl << "  {" << endl << "    case PROP_"
               << this->nspace_uc << service_name_uc << "_CLIENT_INPUT_PROTOCOL:" << endl
               << "      client->input_protocol = g_value_get_object (value);" << endl
               << "      break;" << endl << "    case PROP_" << this->nspace_uc << service_name_uc
               << "_CLIENT_OUTPUT_PROTOCOL:" << endl
               << "      client->output_protocol = g_value_get_object (value);" << endl
               << "      break;" << endl << "  }" << endl << "}" << endl << endl;

    // generate property getter
    f_service_ << "void" << endl << this->nspace_lc << service_name_lc << "_client_get_property ("
               << "GObject *object, guint property_id, GValue *value, "
               << "GParamSpec *pspec)" << endl << "{" << endl << "  " << this->nspace
               << service_name_ << "Client *client = " << this->nspace_uc << service_name_uc
               << "_CLIENT (object);" << endl << endl << "  THRIFT_UNUSED_VAR (pspec);" << endl
               << endl << "  switch (property_id)" << endl << "  {" << endl << "    case PROP_"
               << this->nspace_uc << service_name_uc << "_CLIENT_INPUT_PROTOCOL:" << endl
               << "      g_value_set_object (value, client->input_protocol);" << endl
               << "      break;" << endl << "    case PROP_" << this->nspace_uc << service_name_uc
               << "_CLIENT_OUTPUT_PROTOCOL:" << endl
               << "      g_value_set_object (value, client->output_protocol);" << endl
               << "      break;" << endl << "  }" << endl << "}" << endl << endl;
  }

  // Generate client method implementations
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    string name = (*f_iter)->get_name();
    string funname = initial_caps_to_underscores(name);

    // Get the struct of function call params and exceptions
    t_struct* arg_struct = (*f_iter)->get_arglist();

    // Function for sending
    t_function send_function(g_type_void,
                             service_name_lc + string("_client_send_") + funname,
                             (*f_iter)->get_arglist());

    // Open the send function
    indent(f_service_) << function_signature(&send_function) << endl;
    scope_up(f_service_);

    string reqType = (*f_iter)->is_oneway() ? "T_ONEWAY" : "T_CALL";

    // Serialize the request
    f_service_ << indent() << "gint32 cseqid = 0;" << endl << indent()
               << "ThriftProtocol * protocol = " << this->nspace_uc << base_service_name_uc
               << "_CLIENT (iface)->output_protocol;" << endl << endl << indent()
               << "if (thrift_protocol_write_message_begin (protocol, \"" << name << "\", "
               << reqType << ", cseqid, error) < 0)" << endl << indent() << "  return FALSE;"
               << endl << endl;

    generate_struct_writer(f_service_, arg_struct, "", "", false);

    f_service_ << indent() << "if (thrift_protocol_write_message_end (protocol, error) < 0)" << endl
               << indent() << "  return FALSE;" << endl << indent()
               << "if (!thrift_transport_flush (protocol->transport, error))" << endl << indent()
               << "  return FALSE;" << endl << indent()
               << "if (!thrift_transport_write_end (protocol->transport, error))" << endl
               << indent() << "  return FALSE;" << endl << endl << indent() << "return TRUE;"
               << endl;

    scope_down(f_service_);
    f_service_ << endl;

    // Generate recv function only if not an async function
    if (!(*f_iter)->is_oneway()) {
      t_struct noargs(program_);
      t_function recv_function((*f_iter)->get_returntype(),
                               service_name_lc + string("_client_recv_") + funname,
                               &noargs,
                               (*f_iter)->get_xceptions());
      // Open function
      indent(f_service_) << function_signature(&recv_function) << endl;
      scope_up(f_service_);

      f_service_ << indent() << "gint32 rseqid;" << endl
                 << indent() << "gchar * fname = NULL;" << endl
                 << indent() << "ThriftMessageType mtype;" << endl
                 << indent() << "ThriftProtocol * protocol = "
                 << this->nspace_uc << base_service_name_uc
                 << "_CLIENT (iface)->input_protocol;" << endl
                 << indent() << "ThriftApplicationException *xception;" << endl
                 << endl
                 << indent() << "if (thrift_protocol_read_message_begin "
                    "(protocol, &fname, &mtype, &rseqid, error) < 0) {" << endl;
      indent_up();
      f_service_ << indent() << "if (fname) g_free (fname);" << endl
                 << indent() << "return FALSE;" << endl;
      indent_down();
      f_service_ << indent() << "}" << endl
                 << endl
                 << indent() << "if (mtype == T_EXCEPTION) {" << endl;
      indent_up();
      f_service_ << indent() << "if (fname) g_free (fname);" << endl
                 << indent() << "xception = g_object_new "
                    "(THRIFT_TYPE_APPLICATION_EXCEPTION, NULL);" << endl
                 << indent() << "thrift_struct_read (THRIFT_STRUCT (xception), "
                    "protocol, NULL);" << endl
                 << indent() << "thrift_protocol_read_message_end "
                    "(protocol, NULL);" << endl
                 << indent() << "thrift_transport_read_end "
                    "(protocol->transport, NULL);" << endl
                 << indent() << "g_set_error (error, "
                    "THRIFT_APPLICATION_EXCEPTION_ERROR,xception->type, "
                    "\"application error: %s\", xception->message);" << endl
                 << indent() << "g_object_unref (xception);" << endl
                 << indent() << "return FALSE;" << endl;
      indent_down();
      f_service_ << indent() << "} else if (mtype != T_REPLY) {" << endl;
      indent_up();
      f_service_ << indent() << "if (fname) g_free (fname);" << endl
                 << indent() << "thrift_protocol_skip (protocol, T_STRUCT, "
                    "NULL);" << endl
                 << indent() << "thrift_protocol_read_message_end (protocol, "
                    "NULL);" << endl
                 << indent() << "thrift_transport_read_end ("
                    "protocol->transport, NULL);" << endl
                 << indent() << "g_set_error (error, "
                    "THRIFT_APPLICATION_EXCEPTION_ERROR, "
                    "THRIFT_APPLICATION_EXCEPTION_ERROR_INVALID_MESSAGE_TYPE, "
                    "\"invalid message type %d, expected T_REPLY\", mtype);"
                 << endl
                 << indent() << "return FALSE;" << endl;
      indent_down();
      f_service_ << indent() << "} else if (strncmp (fname, \"" << name
                 << "\", " << name.length() << ") != 0) {" << endl;
      indent_up();
      f_service_ << indent() << "thrift_protocol_skip (protocol, T_STRUCT, "
                    "NULL);" << endl
                 << indent() << "thrift_protocol_read_message_end (protocol,"
                    "error);" << endl
                 << indent() << "thrift_transport_read_end ("
                    "protocol->transport, error);" << endl
                 << indent() << "g_set_error (error, "
                    "THRIFT_APPLICATION_EXCEPTION_ERROR, "
                    "THRIFT_APPLICATION_EXCEPTION_ERROR_WRONG_METHOD_NAME, "
                    "\"wrong method name %s, expected " << name
                    << "\", fname);" << endl
                 << indent() << "if (fname) g_free (fname);" << endl
                 << indent() << "return FALSE;" << endl;
      indent_down();
      f_service_ << indent() << "}" << endl
                 << indent() << "if (fname) g_free (fname);" << endl
                 << endl;

      t_struct* xs = (*f_iter)->get_xceptions();
      const std::vector<t_field*>& xceptions = xs->get_members();
      vector<t_field*>::const_iterator x_iter;

      {
        t_struct result(program_, tservice->get_name() + "_" + (*f_iter)->get_name() + "_result");
        t_field success((*f_iter)->get_returntype(), "*_return", 0);
        if (!(*f_iter)->get_returntype()->is_void()) {
          result.append(&success);
        }

        // add readers for exceptions, dereferencing the pointer.
        for (x_iter = xceptions.begin(); x_iter != xceptions.end(); x_iter++) {
          t_field* xception = new t_field((*x_iter)->get_type(),
                                          "*" + (*x_iter)->get_name(),
                                          (*x_iter)->get_key());
          result.append(xception);
        }

        generate_struct_reader(f_service_, &result, "", "", false);
      }

      f_service_ << indent() << "if (thrift_protocol_read_message_end (protocol, error) < 0)"
                 << endl << indent() << "  return FALSE;" << endl << endl << indent()
                 << "if (!thrift_transport_read_end (protocol->transport, error))" << endl
                 << indent() << "  return FALSE;" << endl << endl;

      // copy over any throw exceptions and return failure
      for (x_iter = xceptions.begin(); x_iter != xceptions.end(); x_iter++) {
        f_service_ << indent() << "if (*" << (*x_iter)->get_name() << " != NULL)" << endl
                   << indent() << "{" << endl << indent() << "    g_set_error (error, "
                   << this->nspace_uc
                   << to_upper_case(initial_caps_to_underscores((*x_iter)->get_type()->get_name()))
                   << "_ERROR, " << this->nspace_uc
                   << to_upper_case(initial_caps_to_underscores((*x_iter)->get_type()->get_name()))
                   << "_ERROR_CODE, \"" << (*x_iter)->get_type()->get_name() << "\");" << endl
                   << indent() << "    return FALSE;" << endl << indent() << "}" << endl;
      }
      // Close function
      indent(f_service_) << "return TRUE;" << endl;
      scope_down(f_service_);
      f_service_ << endl;
    }

    // Open function
    t_function service_function((*f_iter)->get_returntype(),
                                service_name_lc + string("_client_") + funname,
                                (*f_iter)->get_arglist(),
                                (*f_iter)->get_xceptions());
    indent(f_service_) << function_signature(&service_function) << endl;
    scope_up(f_service_);

    // wrap each function
    f_service_ << indent() << "if (!" << this->nspace_lc << service_name_lc << "_client_send_"
               << funname << " (iface";

    // Declare the function arguments
    const vector<t_field*>& fields = arg_struct->get_members();
    vector<t_field*>::const_iterator fld_iter;
    for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
      f_service_ << ", " << (*fld_iter)->get_name();
    }
    f_service_ << ", error))" << endl << indent() << "  return FALSE;" << endl;

    // if not oneway, implement recv
    if (!(*f_iter)->is_oneway()) {
      string ret = (*f_iter)->get_returntype()->is_void() ? "" : "_return, ";

      const vector<t_field*>& xceptions = (*f_iter)->get_xceptions()->get_members();
      vector<t_field*>::const_iterator x_iter;
      for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
        ret += (*x_iter)->get_name();
        ret += ", ";
      }

      f_service_ << indent() << "if (!" << this->nspace_lc << service_name_lc << "_client_recv_"
                 << funname << " (iface, " << ret << "error))" << endl << indent()
                 << "  return FALSE;" << endl;
    }

    // return TRUE which means all functions were called OK
    indent(f_service_) << "return TRUE;" << endl;
    scope_down(f_service_);
    f_service_ << endl;
  }

  // create the interface initializer
  f_service_ << "static void" << endl
             << this->nspace_lc << service_name_lc << "_if_interface_init ("
             << this->nspace << service_name_ << "IfInterface *iface)" << endl;
  scope_up(f_service_);
  if (functions.size() > 0) {
    for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
      /* make the function name C friendly */
      string funname = initial_caps_to_underscores((*f_iter)->get_name());

      f_service_ << indent() << "iface->" << funname << " = " << this->nspace_lc
                 << service_name_lc << "_client_" << funname << ";" << endl;
    }
  }
  else {
    f_service_ << indent() << "THRIFT_UNUSED_VAR (iface);" << endl;
  }
  scope_down(f_service_);
  f_service_ << endl;

  // create the client instance initializer
  f_service_ << "static void" << endl
             << this->nspace_lc << service_name_lc << "_client_init ("
             << this->nspace << service_name_ << "Client *client)" << endl;
  scope_up(f_service_);
  if (!extends_service) {
    f_service_ << indent() << "client->input_protocol = NULL;" << endl
               << indent() << "client->output_protocol = NULL;" << endl;
  }
  else {
    f_service_ << indent() << "THRIFT_UNUSED_VAR (client);" << endl;
  }
  scope_down(f_service_);
  f_service_ << endl;

  // create the client class initializer
  f_service_ << "static void" << endl << this->nspace_lc << service_name_lc
             << "_client_class_init (" << this->nspace << service_name_ << "ClientClass *cls)"
             << endl << "{" << endl;
  if (!extends_service) {
    f_service_ << "  GObjectClass *gobject_class = G_OBJECT_CLASS (cls);" << endl
               << "  GParamSpec *param_spec;" << endl << endl
               << "  gobject_class->set_property = " << this->nspace_lc << service_name_lc
               << "_client_set_property;" << endl
               << "  gobject_class->get_property = " << this->nspace_lc << service_name_lc
               << "_client_get_property;" << endl << endl
               << "  param_spec = g_param_spec_object (\"input_protocol\"," << endl
               << "                                    \"input protocol (construct)\"," << endl
               << "                                    \"Set the client input protocol\"," << endl
               << "                                    THRIFT_TYPE_PROTOCOL," << endl
               << "                                    G_PARAM_READWRITE);" << endl
               << "  g_object_class_install_property (gobject_class," << endl
               << "                                   PROP_" << this->nspace_uc << service_name_uc
               << "_CLIENT_INPUT_PROTOCOL, param_spec);" << endl << endl
               << "  param_spec = g_param_spec_object (\"output_protocol\"," << endl
               << "                                    \"output protocol (construct)\"," << endl
               << "                                    \"Set the client output protocol\"," << endl
               << "                                    THRIFT_TYPE_PROTOCOL," << endl
               << "                                    G_PARAM_READWRITE);" << endl
               << "  g_object_class_install_property (gobject_class," << endl
               << "                                   PROP_" << this->nspace_uc << service_name_uc
               << "_CLIENT_OUTPUT_PROTOCOL, param_spec);" << endl;
  }
  else {
    f_service_ << "  THRIFT_UNUSED_VAR (cls);" << endl;
  }
  f_service_ << "}" << endl << endl;
}

/**
 * Generates C code that represents a Thrift service handler.
 *
 * @param tservice The service for which to generate a handler.
 */
void t_c_glib_generator::generate_service_handler(t_service* tservice) {
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::const_iterator function_iter;

  string service_name_lc = to_lower_case(initial_caps_to_underscores(service_name_));
  string service_name_uc = to_upper_case(service_name_lc);

  string class_name = this->nspace + service_name_ + "Handler";
  string class_name_lc = to_lower_case(initial_caps_to_underscores(class_name));
  string class_name_uc = to_upper_case(class_name_lc);

  string parent_class_name;
  string parent_type_name;

  string args_indent;

  // The service this service extends, or NULL if it extends no service
  t_service* extends_service = tservice->get_extends();

  // Determine the name of our parent service (if any) and the handler class'
  // parent class name and type
  if (extends_service) {
    string parent_service_name = extends_service->get_name();
    string parent_service_name_lc = to_lower_case(initial_caps_to_underscores(parent_service_name));
    string parent_service_name_uc = to_upper_case(parent_service_name_lc);

    parent_class_name = this->nspace + parent_service_name + "Handler";
    parent_type_name = this->nspace_uc + "TYPE_" + parent_service_name_uc + "_HANDLER";
  } else {
    parent_class_name = "GObject";
    parent_type_name = "G_TYPE_OBJECT";
  }

  // Generate the handler class' definition in the header file

  // Generate the handler instance definition
  f_header_ << "/* " << service_name_ << " handler (abstract base class) */" << endl << "struct _"
            << class_name << endl << "{" << endl;
  indent_up();
  f_header_ << indent() << parent_class_name << " parent;" << endl;
  indent_down();
  f_header_ << "};" << endl << "typedef struct _" << class_name << " " << class_name << ";" << endl
            << endl;

  // Generate the handler class definition, including its class members
  // (methods)
  f_header_ << "struct _" << class_name << "Class" << endl << "{" << endl;
  indent_up();
  f_header_ << indent() << parent_class_name << "Class parent;" << endl << endl;

  for (function_iter = functions.begin(); function_iter != functions.end(); ++function_iter) {
    string method_name = initial_caps_to_underscores((*function_iter)->get_name());
    t_type* return_type = (*function_iter)->get_returntype();
    t_struct* arg_list = (*function_iter)->get_arglist();
    t_struct* x_list = (*function_iter)->get_xceptions();
    bool has_return = !return_type->is_void();
    bool has_args = arg_list->get_members().size() == 0;
    bool has_xceptions = x_list->get_members().size() == 0;

    string params = "(" + this->nspace + service_name_ + "If *iface"
                    + (has_return ? ", " + type_name(return_type) + "* _return" : "")
                    + (has_args ? "" : (", " + argument_list(arg_list)))
                    + (has_xceptions ? "" : (", " + xception_list(x_list))) + ", GError **error)";

    indent(f_header_) << "gboolean (*" << method_name << ") " << params << ";" << endl;
  }
  indent_down();

  f_header_ << "};" << endl << "typedef struct _" << class_name << "Class " << class_name
            << "Class;" << endl << endl;

  // Generate the remaining header boilerplate
  f_header_ << "GType " << class_name_lc << "_get_type (void);" << endl << "#define "
            << this->nspace_uc << "TYPE_" << service_name_uc << "_HANDLER "
            << "(" << class_name_lc << "_get_type())" << endl << "#define " << class_name_uc
            << "(obj) "
            << "(G_TYPE_CHECK_INSTANCE_CAST ((obj), " << this->nspace_uc << "TYPE_"
            << service_name_uc << "_HANDLER, " << class_name << "))" << endl << "#define "
            << this->nspace_uc << "IS_" << service_name_uc << "_HANDLER(obj) "
            << "(G_TYPE_CHECK_INSTANCE_TYPE ((obj), " << this->nspace_uc << "TYPE_"
            << service_name_uc << "_HANDLER))" << endl << "#define " << class_name_uc
            << "_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), " << this->nspace_uc << "TYPE_"
            << service_name_uc << "_HANDLER, " << class_name << "Class))" << endl << "#define "
            << this->nspace_uc << "IS_" << service_name_uc << "_HANDLER_CLASS(c) "
            << "(G_TYPE_CHECK_CLASS_TYPE ((c), " << this->nspace_uc << "TYPE_" << service_name_uc
            << "_HANDLER))" << endl << "#define " << this->nspace_uc << service_name_uc
            << "_HANDLER_GET_CLASS(obj) "
            << "(G_TYPE_INSTANCE_GET_CLASS ((obj), " << this->nspace_uc << "TYPE_"
            << service_name_uc << "_HANDLER, " << class_name << "Class))" << endl << endl;

  // Generate the handler class' method definitions
  for (function_iter = functions.begin(); function_iter != functions.end(); ++function_iter) {
    string method_name = initial_caps_to_underscores((*function_iter)->get_name());
    t_type* return_type = (*function_iter)->get_returntype();
    t_struct* arg_list = (*function_iter)->get_arglist();
    t_struct* x_list = (*function_iter)->get_xceptions();
    bool has_return = !return_type->is_void();
    bool has_args = arg_list->get_members().size() == 0;
    bool has_xceptions = x_list->get_members().size() == 0;

    string params = "(" + this->nspace + service_name_ + "If *iface"
                    + (has_return ? ", " + type_name(return_type) + "* _return" : "")
                    + (has_args ? "" : (", " + argument_list(arg_list)))
                    + (has_xceptions ? "" : (", " + xception_list(x_list))) + ", GError **error)";

    f_header_ << "gboolean " << class_name_lc << "_" << method_name << " " << params << ";" << endl;
  }
  f_header_ << endl;

  // Generate the handler's implementation in the implementation file

  // Generate the implementation boilerplate
  f_service_ << "static void" << endl << class_name_lc << "_" << service_name_lc
             << "_if_interface_init (" << this->nspace << service_name_ << "IfInterface *iface);"
             << endl << endl;

  args_indent = string(25, ' ');
  f_service_ << "G_DEFINE_TYPE_WITH_CODE (" << class_name << ", " << endl << args_indent
             << class_name_lc << "," << endl << args_indent << parent_type_name << "," << endl
             << args_indent << "G_IMPLEMENT_INTERFACE (" << this->nspace_uc << "TYPE_"
             << service_name_uc << "_IF," << endl;
  args_indent += string(23, ' ');
  f_service_ << args_indent << class_name_lc << "_" << service_name_lc << "_if_interface_init))"
             << endl << endl;

  // Generate the handler method implementations
  for (function_iter = functions.begin(); function_iter != functions.end(); ++function_iter) {
    string function_name = (*function_iter)->get_name();
    string method_name = initial_caps_to_underscores(function_name);
    t_type* return_type = (*function_iter)->get_returntype();
    t_struct* arg_list = (*function_iter)->get_arglist();
    t_struct* x_list = (*function_iter)->get_xceptions();

    const vector<t_field*>& args = arg_list->get_members();
    const vector<t_field*>& xceptions = x_list->get_members();

    vector<t_field*>::const_iterator field_iter;

    t_function implementing_function(return_type,
                                     service_name_lc + "_handler_" + method_name,
                                     arg_list,
                                     x_list,
                                     (*function_iter)->is_oneway());

    indent(f_service_) << function_signature(&implementing_function) << endl;
    scope_up(f_service_);
    f_service_ << indent() << "g_return_val_if_fail (" << this->nspace_uc << "IS_"
               << service_name_uc << "_HANDLER (iface), FALSE);" << endl << endl << indent()
               << "return " << class_name_uc << "_GET_CLASS (iface)"
               << "->" << method_name << " (iface, ";

    if (!return_type->is_void()) {
      f_service_ << "_return, ";
    }
    for (field_iter = args.begin(); field_iter != args.end(); ++field_iter) {
      f_service_ << (*field_iter)->get_name() << ", ";
    }
    for (field_iter = xceptions.begin(); field_iter != xceptions.end(); ++field_iter) {
      f_service_ << (*field_iter)->get_name() << ", ";
    }
    f_service_ << "error);" << endl;
    scope_down(f_service_);
    f_service_ << endl;
  }

  // Generate the handler interface initializer
  f_service_ << "static void" << endl << class_name_lc << "_" << service_name_lc
             << "_if_interface_init (" << this->nspace << service_name_ << "IfInterface *iface)"
             << endl;
  scope_up(f_service_);
  if (functions.size() > 0) {
    for (function_iter = functions.begin(); function_iter != functions.end(); ++function_iter) {
      string method_name = initial_caps_to_underscores((*function_iter)->get_name());

      f_service_ << indent() << "iface->" << method_name << " = " << class_name_lc << "_"
                 << method_name << ";" << endl;
    }
  }
  else {
    f_service_ << "THRIFT_UNUSED_VAR (iface);" << endl;
  }
  scope_down(f_service_);
  f_service_ << endl;

  // Generate the handler instance initializer
  f_service_ << "static void" << endl << class_name_lc << "_init (" << class_name << " *self)"
             << endl;
  scope_up(f_service_);
  f_service_ << indent() << "THRIFT_UNUSED_VAR (self);" << endl;
  scope_down(f_service_);
  f_service_ << endl;

  // Generate the handler class initializer
  f_service_ << "static void" << endl
             << class_name_lc << "_class_init (" << class_name << "Class *cls)"
             << endl;
  scope_up(f_service_);
  if (functions.size() > 0) {
    for (function_iter = functions.begin();
         function_iter != functions.end();
         ++function_iter) {
      string function_name = (*function_iter)->get_name();
      string method_name = initial_caps_to_underscores(function_name);

      // All methods are pure virtual and must be implemented by subclasses
      f_service_ << indent() << "cls->" << method_name << " = NULL;" << endl;
    }
  }
  else {
    f_service_ << indent() << "THRIFT_UNUSED_VAR (cls);" << endl;
  }
  scope_down(f_service_);
  f_service_ << endl;
}

/**
 * Generates C code that represents a Thrift service processor.
 *
 * @param tservice The service for which to generate a processor
 */
void t_c_glib_generator::generate_service_processor(t_service* tservice) {
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::const_iterator function_iter;

  string service_name_lc = to_lower_case(initial_caps_to_underscores(service_name_));
  string service_name_uc = to_upper_case(service_name_lc);

  string class_name = this->nspace + service_name_ + "Processor";
  string class_name_lc = to_lower_case(initial_caps_to_underscores(class_name));
  string class_name_uc = to_upper_case(class_name_lc);

  string parent_class_name;
  string parent_type_name;

  string handler_class_name = this->nspace + service_name_ + "Handler";
  string handler_class_name_lc = initial_caps_to_underscores(handler_class_name);

  string process_function_type_name = class_name + "ProcessFunction";
  string process_function_def_type_name =
    class_name_lc + "_process_function_def";

  string function_name;
  string args_indent;

  // The service this service extends, or NULL if it extends no service
  t_service* extends_service = tservice->get_extends();

  // Determine the name of our parent service (if any) and the
  // processor class' parent class name and type
  if (extends_service) {
    string parent_service_name = extends_service->get_name();
    string parent_service_name_lc = to_lower_case(initial_caps_to_underscores(parent_service_name));
    string parent_service_name_uc = to_upper_case(parent_service_name_lc);

    parent_class_name = this->nspace + parent_service_name + "Processor";
    parent_type_name = this->nspace_uc + "TYPE_" + parent_service_name_uc + "_PROCESSOR";
  } else {
    parent_class_name = "ThriftDispatchProcessor";
    parent_type_name = "THRIFT_TYPE_DISPATCH_PROCESSOR";
  }

  // Generate the processor class' definition in the header file

  // Generate the processor instance definition
  f_header_ << "/* " << service_name_ << " processor */" << endl << "struct _" << class_name << endl
            << "{" << endl;
  indent_up();
  f_header_ << indent() << parent_class_name << " parent;" << endl << endl << indent()
            << "/* protected */" << endl << indent()
            << this->nspace + service_name_ + "Handler *handler;" << endl << indent()
            << "GHashTable *process_map;" << endl;
  indent_down();
  f_header_ << "};" << endl << "typedef struct _" << class_name << " " << class_name << ";" << endl
            << endl;

  // Generate the processor class definition
  f_header_ << "struct _" << class_name << "Class" << endl << "{" << endl;
  indent_up();
  f_header_ << indent() << parent_class_name << "Class parent;" << endl << endl << indent()
            << "/* protected */" << endl << indent()
            << "gboolean (*dispatch_call) (ThriftDispatchProcessor *processor," << endl;
  args_indent = indent() + string(27, ' ');
  f_header_ << args_indent << "ThriftProtocol *in," << endl << args_indent << "ThriftProtocol *out,"
            << endl << args_indent << "gchar *fname," << endl << args_indent << "gint32 seqid,"
            << endl << args_indent << "GError **error);" << endl;
  indent_down();
  f_header_ << "};" << endl << "typedef struct _" << class_name << "Class " << class_name
            << "Class;" << endl << endl;

  // Generate the remaining header boilerplate
  f_header_ << "GType " << class_name_lc << "_get_type (void);" << endl << "#define "
            << this->nspace_uc << "TYPE_" << service_name_uc << "_PROCESSOR "
            << "(" << class_name_lc << "_get_type())" << endl << "#define " << class_name_uc
            << "(obj) "
            << "(G_TYPE_CHECK_INSTANCE_CAST ((obj), " << this->nspace_uc << "TYPE_"
            << service_name_uc << "_PROCESSOR, " << class_name << "))" << endl << "#define "
            << this->nspace_uc << "IS_" << service_name_uc << "_PROCESSOR(obj) "
            << "(G_TYPE_CHECK_INSTANCE_TYPE ((obj), " << this->nspace_uc << "TYPE_"
            << service_name_uc << "_PROCESSOR))" << endl << "#define " << class_name_uc
            << "_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), " << this->nspace_uc << "TYPE_"
            << service_name_uc << "_PROCESSOR, " << class_name << "Class))" << endl << "#define "
            << this->nspace_uc << "IS_" << service_name_uc << "_PROCESSOR_CLASS(c) "
            << "(G_TYPE_CHECK_CLASS_TYPE ((c), " << this->nspace_uc << "TYPE_" << service_name_uc
            << "_PROCESSOR))" << endl << "#define " << this->nspace_uc << service_name_uc
            << "_PROCESSOR_GET_CLASS(obj) "
            << "(G_TYPE_INSTANCE_GET_CLASS ((obj), " << this->nspace_uc << "TYPE_"
            << service_name_uc << "_PROCESSOR, " << class_name << "Class))" << endl << endl;

  // Generate the processor's implementation in the implementation file

  // Generate the processor's properties enum
  f_service_ << "enum _" << class_name << "Properties" << endl << "{" << endl;
  indent_up();
  f_service_ << indent() << "PROP_" << class_name_uc << "_0," << endl << indent() << "PROP_"
             << class_name_uc << "_HANDLER" << endl;
  indent_down();
  f_service_ << "};" << endl << endl;

  // Generate the implementation boilerplate
  args_indent = string(15, ' ');
  f_service_ << "G_DEFINE_TYPE (" << class_name << "," << endl << args_indent << class_name_lc
             << "," << endl << args_indent << parent_type_name << ")" << endl << endl;

  // Generate the processor's processing-function type
  args_indent = string(process_function_type_name.length() + 23, ' ');
  f_service_ << "typedef gboolean (* " << process_function_type_name << ") ("
             << class_name << " *, " << endl
             << args_indent << "gint32," << endl
             << args_indent << "ThriftProtocol *," << endl
             << args_indent << "ThriftProtocol *," << endl
             << args_indent << "GError **);" << endl
             << endl;

  // Generate the processor's processing-function-definition type
  f_service_ << "typedef struct" << endl
             << "{" << endl;
  indent_up();
  f_service_ << indent() << "gchar *name;" << endl
             << indent() << process_function_type_name << " function;" << endl;
  indent_down();
  f_service_ << "} " << process_function_def_type_name << ";" << endl
             << endl;

  // Generate forward declarations of the processor's processing functions so we
  // can refer to them in the processing-function-definition struct below and
  // keep all of the processor's declarations in one place
  for (function_iter = functions.begin();
       function_iter != functions.end();
       ++function_iter) {
    function_name = class_name_lc + "_process_"
      + initial_caps_to_underscores((*function_iter)->get_name());

    args_indent = string(function_name.length() + 2, ' ');
    f_service_ << "static gboolean" << endl
               << function_name << " ("
               << class_name << " *," << endl
               << args_indent << "gint32," << endl
               << args_indent << "ThriftProtocol *," << endl
               << args_indent << "ThriftProtocol *," << endl
               << args_indent << "GError **);" << endl;
  }
  f_service_ << endl;

  // Generate the processor's processing-function definitions, if the service
  // defines any methods
  if (functions.size() > 0) {
    f_service_ << indent() << "static " << process_function_def_type_name
               << endl
               << indent() << class_name_lc << "_process_function_defs["
               << functions.size() << "] = {" << endl;
    indent_up();
    for (function_iter = functions.begin();
         function_iter != functions.end();
         ++function_iter) {
      string service_function_name = (*function_iter)->get_name();
      string process_function_name = class_name_lc + "_process_"
        + initial_caps_to_underscores(service_function_name);

      f_service_ << indent() << "{" << endl;
      indent_up();
      f_service_ << indent() << "\"" << service_function_name << "\"," << endl
                 << indent() << process_function_name << endl;
      indent_down();
      f_service_ << indent() << "}"
                 << (function_iter == --functions.end() ? "" : ",") << endl;
    }
    indent_down();
    f_service_ << indent() << "};" << endl
               << endl;
  }

  // Generate the processor's processing functions
  for (function_iter = functions.begin(); function_iter != functions.end(); ++function_iter) {
    string service_function_name = (*function_iter)->get_name();
    string service_function_name_ic = underscores_to_initial_caps(service_function_name);
    string service_function_name_lc = initial_caps_to_underscores(service_function_name);
    string service_function_name_uc = to_upper_case(service_function_name_lc);

    t_type* return_type = (*function_iter)->get_returntype();
    bool has_return_value = !return_type->is_void();

    t_struct* arg_list = (*function_iter)->get_arglist();
    const vector<t_field*>& args = arg_list->get_members();
    vector<t_field*>::const_iterator arg_iter;

    const vector<t_field*>& xceptions = (*function_iter)->get_xceptions()->get_members();
    vector<t_field*>::const_iterator xception_iter;

    string args_class_name = this->nspace + service_name_ + service_function_name_ic + "Args";
    string args_class_type = this->nspace_uc + "TYPE_" + service_name_uc + "_"
                             + service_function_name_uc + "_ARGS";

    string result_class_name = this->nspace + service_name_ + service_function_name_ic + "Result";
    string result_class_type = this->nspace_uc + "TYPE_" + service_name_uc + "_"
                               + service_function_name_uc + "_RESULT";

    string handler_function_name = handler_class_name_lc + "_" + service_function_name_lc;

    function_name = class_name_lc + "_process_"
                    + initial_caps_to_underscores(service_function_name);

    args_indent = string(function_name.length() + 2, ' ');
    f_service_ << "static gboolean" << endl << function_name << " (" << class_name << " *self,"
               << endl << args_indent << "gint32 sequence_id," << endl << args_indent
               << "ThriftProtocol *input_protocol," << endl << args_indent
               << "ThriftProtocol *output_protocol," << endl << args_indent << "GError **error)"
               << endl;
    scope_up(f_service_);
    f_service_ << indent() << "gboolean result = TRUE;" << endl
               << indent() << "ThriftTransport * transport;" << endl
               << indent() << "ThriftApplicationException *xception;" << endl
               << indent() << args_class_name + " * args =" << endl;
    indent_up();
    f_service_ << indent() << "g_object_new (" << args_class_type << ", NULL);" << endl << endl;
    indent_down();
    if ((*function_iter)->is_oneway()) {
      f_service_ << indent() << "THRIFT_UNUSED_VAR (sequence_id);" << endl << indent()
                 << "THRIFT_UNUSED_VAR (output_protocol);" << endl << endl;
    }
    f_service_ << indent() << "g_object_get (input_protocol, \"transport\", "
               << "&transport, NULL);" << endl << endl;

    // Read the method's arguments from the caller
    f_service_ << indent() << "if ((thrift_struct_read (THRIFT_STRUCT (args), "
               << "input_protocol, error) != -1) &&" << endl << indent()
               << "    (thrift_protocol_read_message_end (input_protocol, "
               << "error) != -1) &&" << endl << indent()
               << "    (thrift_transport_read_end (transport, error) != FALSE))" << endl;
    scope_up(f_service_);

    for (arg_iter = args.begin(); arg_iter != args.end(); ++arg_iter) {
      f_service_ << indent() << property_type_name((*arg_iter)->get_type()) << " "
                 << (*arg_iter)->get_name() << ";" << endl;
    }
    for (xception_iter = xceptions.begin(); xception_iter != xceptions.end(); ++xception_iter) {
      f_service_ << indent() << type_name((*xception_iter)->get_type()) << " "
                 << initial_caps_to_underscores((*xception_iter)->get_name()) << " = NULL;" << endl;
    }
    if (has_return_value) {
      f_service_ << indent() << property_type_name(return_type) << " return_value;" << endl;
    }
    if (!(*function_iter)->is_oneway()) {
      f_service_ << indent() << result_class_name << " * result_struct;" << endl;
    }
    f_service_ << endl;

    if (args.size() > 0) {
      f_service_ << indent() << "g_object_get (args," << endl;
      args_indent = indent() + string(14, ' ');
      for (arg_iter = args.begin(); arg_iter != args.end(); ++arg_iter) {
        string arg_name = (*arg_iter)->get_name();

        f_service_ << args_indent << "\"" << arg_name << "\", &" << arg_name << "," << endl;
      }
      f_service_ << args_indent << "NULL);" << endl << endl;
    }

    if (!(*function_iter)->is_oneway()) {
      f_service_ << indent() << "g_object_unref (transport);" << endl << indent()
                 << "g_object_get (output_protocol, \"transport\", "
                 << "&transport, NULL);" << endl << endl << indent()
                 << "result_struct = g_object_new (" << result_class_type << ", NULL);" << endl;
      if (has_return_value) {
        f_service_ << indent() << "g_object_get (result_struct, "
                                  "\"success\", &return_value, NULL);" << endl;
      }
      f_service_ << endl;
    }

    // Pass the arguments to the corresponding method in the handler
    f_service_ << indent() << "if (" << handler_function_name << " (" << this->nspace_uc
               << service_name_uc << "_IF (self->handler)," << endl;
    args_indent = indent() + string(handler_function_name.length() + 6, ' ');
    if (has_return_value) {
      string return_type_name = type_name(return_type);

      f_service_ << args_indent;

      // Cast return_value if it was declared as a type other than the return
      // value's actual type---this is true for integer values 32 bits or fewer
      // in width, for which GLib requires a plain gint type be used when
      // storing or retrieving as an object property
      if (return_type_name != property_type_name(return_type)) {
        if (return_type_name[return_type_name.length() - 1] != '*') {
          return_type_name += ' ';
        }
        return_type_name += '*';

        f_service_ << "(" << return_type_name << ")";
      }

      f_service_ << "&return_value," << endl;
    }
    for (arg_iter = args.begin(); arg_iter != args.end(); ++arg_iter) {
      f_service_ << args_indent << (*arg_iter)->get_name() << "," << endl;
    }
    for (xception_iter = xceptions.begin(); xception_iter != xceptions.end(); ++xception_iter) {
      f_service_ << args_indent << "&" << initial_caps_to_underscores((*xception_iter)->get_name())
                 << "," << endl;
    }
    f_service_ << args_indent << "error) == TRUE)" << endl;
    scope_up(f_service_);

    // The handler reported success; return the result, if any, to the caller
    if (!(*function_iter)->is_oneway()) {
      if (has_return_value) {
        f_service_ << indent() << "g_object_set (result_struct, \"success\", ";
        if (type_name(return_type) != property_type_name(return_type)) {
          // Roundtrip cast to fix the position of sign bit.
          f_service_ << "(" << property_type_name(return_type) << ")"
                     << "(" << type_name(return_type) << ")";
        }
        f_service_ << "return_value, "
                   << "NULL);" << endl;

        // Deallocate (or unref) return_value
        return_type = get_true_type(return_type);
        if (return_type->is_base_type()) {
          t_base_type* base_type = ((t_base_type*)return_type);

          if (base_type->get_base() == t_base_type::TYPE_STRING) {
            f_service_ << indent() << "if (return_value != NULL)" << endl;
            indent_up();
            if (base_type->is_binary()) {
              f_service_ << indent() << "g_byte_array_unref (return_value);" << endl;
            } else {
              f_service_ << indent() << "g_free (return_value);" << endl;
            }
            indent_down();
          }
        } else if (return_type->is_container()) {
          f_service_ << indent() << "if (return_value != NULL)" << endl;
          indent_up();

          if (return_type->is_list()) {
            t_type* elem_type = ((t_list*)return_type)->get_elem_type();

            f_service_ << indent();
            if (is_numeric(elem_type)) {
              f_service_ << "g_array_unref";
            } else {
              f_service_ << "g_ptr_array_unref";
            }
            f_service_ << " (return_value);" << endl;
          } else if (return_type->is_map() || return_type->is_set()) {
            f_service_ << indent() << "g_hash_table_unref (return_value);" << endl;
          }

          indent_down();
        } else if (return_type->is_struct()) {
          f_service_ << indent() << "if (return_value != NULL)" << endl;
          indent_up();
          f_service_ << indent() << "g_object_unref (return_value);" << endl;
          indent_down();
        }

        f_service_ << endl;
      }
      f_service_ << indent() << "result =" << endl;
      indent_up();
      f_service_ << indent() << "((thrift_protocol_write_message_begin (output_protocol," << endl;
      args_indent = indent() + string(39, ' ');
      f_service_ << args_indent << "\"" << service_function_name << "\"," << endl << args_indent
                 << "T_REPLY," << endl << args_indent << "sequence_id," << endl << args_indent
                 << "error) != -1) &&" << endl << indent()
                 << " (thrift_struct_write (THRIFT_STRUCT (result_struct)," << endl;
      args_indent = indent() + string(23, ' ');
      f_service_ << args_indent << "output_protocol," << endl << args_indent << "error) != -1));"
                 << endl;
      indent_down();
    }
    scope_down(f_service_);
    f_service_ << indent() << "else" << endl;
    scope_up(f_service_);

    // The handler reported failure; check to see if an application-defined
    // exception was raised and if so, return it to the caller
    f_service_ << indent();
    if (xceptions.size() > 0) {
      for (xception_iter = xceptions.begin(); xception_iter != xceptions.end(); ++xception_iter) {
        f_service_ << "if (" << initial_caps_to_underscores((*xception_iter)->get_name())
                   << " != NULL)" << endl;
        scope_up(f_service_);
        f_service_ << indent() << "g_object_set (result_struct," << endl;
        args_indent = indent() + string(14, ' ');
        f_service_ << args_indent << "\"" << (*xception_iter)->get_name() << "\", "
                   << (*xception_iter)->get_name() << "," << endl << args_indent << "NULL);" << endl
                   << endl;
        f_service_ << indent() << "result =" << endl;
        indent_up();
        f_service_ << indent() << "((thrift_protocol_write_message_begin (output_protocol," << endl;
        args_indent = indent() + string(39, ' ');
        f_service_ << args_indent << "\"" << service_function_name << "\"," << endl << args_indent
                   << "T_REPLY," << endl << args_indent << "sequence_id," << endl << args_indent
                   << "error) != -1) &&" << endl << indent()
                   << " (thrift_struct_write (THRIFT_STRUCT (result_struct)," << endl;
        args_indent = indent() + string(23, ' ');
        f_service_ << args_indent << "output_protocol," << endl << args_indent << "error) != -1));"
                   << endl;
        indent_down();
        scope_down(f_service_);
        f_service_ << indent() << "else" << endl;
      }

      scope_up(f_service_);
      f_service_ << indent();
    }

    // If the handler reported failure but raised no application-defined
    // exception, return a Thrift application exception with the information
    // returned via GLib's own error-reporting mechanism
    f_service_ << "if (*error == NULL)" << endl;
    indent_up();
    f_service_ << indent() << "g_warning (\"" << service_name_ << "."
               << (*function_iter)->get_name() << " implementation returned FALSE \"" << endl
               << indent() << string(11, ' ') << "\"but did not set an error\");" << endl << endl;
    indent_down();
    f_service_ << indent() << "xception =" << endl;
    indent_up();
    f_service_ << indent() << "g_object_new (THRIFT_TYPE_APPLICATION_EXCEPTION," << endl;
    args_indent = indent() + string(14, ' ');
    f_service_ << args_indent << "\"type\",    *error != NULL ? (*error)->code :" << endl
               << args_indent << string(11, ' ') << "THRIFT_APPLICATION_EXCEPTION_ERROR_UNKNOWN,"
               << endl << args_indent << "\"message\", *error != NULL ? (*error)->message : NULL,"
               << endl << args_indent << "NULL);" << endl;
    indent_down();
    f_service_ << indent() << "g_clear_error (error);" << endl << endl << indent()
               << "result =" << endl;
    indent_up();
    f_service_ << indent() << "((thrift_protocol_write_message_begin (output_protocol," << endl;
    args_indent = indent() + string(39, ' ');
    f_service_ << args_indent << "\"" << service_function_name << "\"," << endl << args_indent
               << "T_EXCEPTION," << endl << args_indent << "sequence_id," << endl << args_indent
               << "error) != -1) &&" << endl << indent()
               << " (thrift_struct_write (THRIFT_STRUCT (xception)," << endl;
    args_indent = indent() + string(23, ' ');
    f_service_ << args_indent << "output_protocol," << endl << args_indent << "error) != -1));"
               << endl;
    indent_down();
    f_service_ << endl << indent() << "g_object_unref (xception);" << endl;

    if (xceptions.size() > 0) {
      scope_down(f_service_);
    }
    scope_down(f_service_);
    f_service_ << endl;

    // Dellocate or unref retrieved argument values as necessary
    for (arg_iter = args.begin(); arg_iter != args.end(); ++arg_iter) {
      string arg_name = (*arg_iter)->get_name();
      t_type* arg_type = get_true_type((*arg_iter)->get_type());

      if (arg_type->is_base_type()) {
        t_base_type* base_type = ((t_base_type*)arg_type);

        if (base_type->get_base() == t_base_type::TYPE_STRING) {
          f_service_ << indent() << "if (" << arg_name << " != NULL)" << endl;
          indent_up();
          if (base_type->is_binary()) {
            f_service_ << indent() << "g_byte_array_unref (" << arg_name << ");" << endl;
          } else {
            f_service_ << indent() << "g_free (" << arg_name << ");" << endl;
          }
          indent_down();
        }
      } else if (arg_type->is_container()) {
        f_service_ << indent() << "if (" << arg_name << " != NULL)" << endl;
        indent_up();

        if (arg_type->is_list()) {
          t_type* elem_type = ((t_list*)arg_type)->get_elem_type();

          f_service_ << indent();
          if (is_numeric(elem_type)) {
            f_service_ << "g_array_unref";
          } else {
            f_service_ << "g_ptr_array_unref";
          }
          f_service_ << " (" << arg_name << ");" << endl;
        } else if (arg_type->is_map() || arg_type->is_set()) {
          f_service_ << indent() << "g_hash_table_unref (" << arg_name << ");" << endl;
        }

        indent_down();
      } else if (arg_type->is_struct()) {
        f_service_ << indent() << "if (" << arg_name << " != NULL)" << endl;
        indent_up();
        f_service_ << indent() << "g_object_unref (" << arg_name << ");" << endl;
        indent_down();
      }
    }

    if (!(*function_iter)->is_oneway()) {
      f_service_ << indent() << "g_object_unref (result_struct);" << endl << endl << indent()
                 << "if (result == TRUE)" << endl;
      indent_up();
      f_service_ << indent() << "result =" << endl;
      indent_up();
      f_service_ << indent() << "((thrift_protocol_write_message_end "
                 << "(output_protocol, error) != -1) &&" << endl << indent()
                 << " (thrift_transport_write_end (transport, error) "
                 << "!= FALSE) &&" << endl << indent()
                 << " (thrift_transport_flush (transport, error) "
                 << "!= FALSE));" << endl;
      indent_down();
      indent_down();
    }
    scope_down(f_service_);
    f_service_ << indent() << "else" << endl;
    indent_up();
    f_service_ << indent() << "result = FALSE;" << endl;
    indent_down();

    f_service_ << endl << indent() << "g_object_unref (transport);" << endl << indent()
               << "g_object_unref (args);" << endl << endl << indent() << "return result;" << endl;
    scope_down(f_service_);

    f_service_ << endl;
  }

  // Generate the processor's dispatch_call implementation
  function_name = class_name_lc + "_dispatch_call";
  args_indent = indent() + string(function_name.length() + 2, ' ');
  f_service_ << "static gboolean" << endl << function_name
             << " (ThriftDispatchProcessor *dispatch_processor," << endl << args_indent
             << "ThriftProtocol *input_protocol," << endl << args_indent
             << "ThriftProtocol *output_protocol," << endl << args_indent << "gchar *method_name,"
             << endl << args_indent << "gint32 sequence_id," << endl << args_indent
             << "GError **error)" << endl;
  scope_up(f_service_);
  f_service_ << indent() << class_name_lc << "_process_function_def *"
             << "process_function_def;" << endl;
  f_service_ << indent() << "gboolean dispatch_result = FALSE;" << endl << endl << indent()
             << class_name << " *self = " << class_name_uc << " (dispatch_processor);" << endl;
  f_service_ << indent() << parent_class_name << "Class "
                                                 "*parent_class =" << endl;
  indent_up();
  f_service_ << indent() << "g_type_class_peek_parent (" << class_name_uc << "_GET_CLASS (self));"
             << endl;
  indent_down();
  f_service_ << endl
             << indent() << "process_function_def = "
             << "g_hash_table_lookup (self->process_map, method_name);" << endl
             << indent() << "if (process_function_def != NULL)" << endl;
  scope_up(f_service_);
  args_indent = indent() + string(53, ' ');
  f_service_ << indent() << "g_free (method_name);" << endl
             << indent() << "dispatch_result = "
             << "(*process_function_def->function) (self," << endl
             << args_indent << "sequence_id," << endl
             << args_indent << "input_protocol," << endl
             << args_indent << "output_protocol," << endl
             << args_indent << "error);" << endl;
  scope_down(f_service_);
  f_service_ << indent() << "else" << endl;
  scope_up(f_service_);

  // Method name not recognized; chain up to our parent processor---note the
  // top-most implementation of this method, in ThriftDispatchProcessor itself,
  // will return an application exception to the caller if no class in the
  // hierarchy recognizes the method name
  f_service_ << indent() << "dispatch_result = parent_class->dispatch_call "
                            "(dispatch_processor," << endl;
  args_indent = indent() + string(47, ' ');
  f_service_ << args_indent << "input_protocol," << endl << args_indent << "output_protocol,"
             << endl << args_indent << "method_name," << endl << args_indent << "sequence_id,"
             << endl << args_indent << "error);" << endl;
  scope_down(f_service_);
  f_service_ << endl << indent() << "return dispatch_result;" << endl;
  scope_down(f_service_);
  f_service_ << endl;

  // Generate the processor's property setter
  function_name = class_name_lc + "_set_property";
  args_indent = string(function_name.length() + 2, ' ');
  f_service_ << "static void" << endl << function_name << " (GObject *object," << endl
             << args_indent << "guint property_id," << endl << args_indent << "const GValue *value,"
             << endl << args_indent << "GParamSpec *pspec)" << endl;
  scope_up(f_service_);
  f_service_ << indent() << class_name << " *self = " << class_name_uc << " (object);" << endl
             << endl << indent() << "switch (property_id)" << endl;
  scope_up(f_service_);
  f_service_ << indent() << "case PROP_" << class_name_uc << "_HANDLER:" << endl;
  indent_up();
  f_service_ << indent() << "if (self->handler != NULL)" << endl;
  indent_up();
  f_service_ << indent() << "g_object_unref (self->handler);" << endl;
  indent_down();
  f_service_ << indent() << "self->handler = g_value_get_object (value);" << endl << indent()
             << "g_object_ref (self->handler);" << endl;
  if (extends_service) {
    // Chain up to set the handler in every superclass as well
    f_service_ << endl << indent() << "G_OBJECT_CLASS (" << class_name_lc << "_parent_class)->"
               << endl;
    indent_up();
    f_service_ << indent() << "set_property (object, property_id, value, pspec);" << endl;
    indent_down();
  }
  f_service_ << indent() << "break;" << endl;
  indent_down();
  f_service_ << indent() << "default:" << endl;
  indent_up();
  f_service_ << indent() << "G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);"
             << endl << indent() << "break;" << endl;
  indent_down();
  scope_down(f_service_);
  scope_down(f_service_);
  f_service_ << endl;

  // Generate processor's property getter
  function_name = class_name_lc + "_get_property";
  args_indent = string(function_name.length() + 2, ' ');
  f_service_ << "static void" << endl << function_name << " (GObject *object," << endl
             << args_indent << "guint property_id," << endl << args_indent << "GValue *value,"
             << endl << args_indent << "GParamSpec *pspec)" << endl;
  scope_up(f_service_);
  f_service_ << indent() << class_name << " *self = " << class_name_uc << " (object);" << endl
             << endl << indent() << "switch (property_id)" << endl;
  scope_up(f_service_);
  f_service_ << indent() << "case PROP_" << class_name_uc << "_HANDLER:" << endl;
  indent_up();
  f_service_ << indent() << "g_value_set_object (value, self->handler);" << endl << indent()
             << "break;" << endl;
  indent_down();
  f_service_ << indent() << "default:" << endl;
  indent_up();
  f_service_ << indent() << "G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);"
             << endl << indent() << "break;" << endl;
  indent_down();
  scope_down(f_service_);
  scope_down(f_service_);
  f_service_ << endl;

  // Generator the processor's dispose function
  f_service_ << "static void" << endl << class_name_lc << "_dispose (GObject *gobject)" << endl;
  scope_up(f_service_);
  f_service_ << indent() << class_name << " *self = " << class_name_uc << " (gobject);" << endl
             << endl << indent() << "if (self->handler != NULL)" << endl;
  scope_up(f_service_);
  f_service_ << indent() << "g_object_unref (self->handler);" << endl << indent()
             << "self->handler = NULL;" << endl;
  scope_down(f_service_);
  f_service_ << endl << indent() << "G_OBJECT_CLASS (" << class_name_lc << "_parent_class)"
                                                                           "->dispose (gobject);"
             << endl;
  scope_down(f_service_);
  f_service_ << endl;

  // Generate processor finalize function
  f_service_ << "static void" << endl << class_name_lc << "_finalize (GObject *gobject)" << endl;
  scope_up(f_service_);
  f_service_ << indent() << this->nspace << service_name_ << "Processor *self = " << this->nspace_uc
             << service_name_uc << "_PROCESSOR (gobject);" << endl << endl << indent()
             << "thrift_safe_hash_table_destroy (self->process_map);" << endl << endl << indent()
             << "G_OBJECT_CLASS (" << class_name_lc << "_parent_class)"
                                                       "->finalize (gobject);" << endl;
  scope_down(f_service_);
  f_service_ << endl;

  // Generate processor instance initializer
  f_service_ << "static void" << endl << class_name_lc << "_init (" << class_name << " *self)"
             << endl;
  scope_up(f_service_);
  if (functions.size() > 0) {
    f_service_ << indent() << "guint index;" << endl
               << endl;
  }
  f_service_ << indent() << "self->handler = NULL;" << endl << indent()
             << "self->process_map = "
                "g_hash_table_new (g_str_hash, g_str_equal);" << endl;
  if (functions.size() > 0) {
    args_indent = string(21, ' ');
    f_service_ << endl
               << indent() << "for (index = 0; index < "
               << functions.size() << "; index += 1)" << endl;
    indent_up();
    f_service_ << indent() << "g_hash_table_insert (self->process_map," << endl
               << indent() << args_indent
               << class_name_lc << "_process_function_defs[index].name," << endl
               << indent() << args_indent
               << "&" << class_name_lc << "_process_function_defs[index]" << ");"
               << endl;
    indent_down();
  }
  scope_down(f_service_);
  f_service_ << endl;

  // Generate processor class initializer
  f_service_ << "static void" << endl << class_name_lc << "_class_init (" << class_name
             << "Class *cls)" << endl;
  scope_up(f_service_);
  f_service_ << indent() << "GObjectClass *gobject_class = G_OBJECT_CLASS (cls);" << endl
             << indent() << "ThriftDispatchProcessorClass *dispatch_processor_class =" << endl;
  indent_up();
  f_service_ << indent() << "THRIFT_DISPATCH_PROCESSOR_CLASS (cls);" << endl;
  indent_down();
  f_service_ << indent() << "GParamSpec *param_spec;" << endl << endl << indent()
             << "gobject_class->dispose = " << class_name_lc << "_dispose;" << endl << indent()
             << "gobject_class->finalize = " << class_name_lc << "_finalize;" << endl << indent()
             << "gobject_class->set_property = " << class_name_lc << "_set_property;" << endl
             << indent() << "gobject_class->get_property = " << class_name_lc << "_get_property;"
             << endl << endl << indent()
             << "dispatch_processor_class->dispatch_call = " << class_name_lc << "_dispatch_call;"
             << endl << indent() << "cls->dispatch_call = " << class_name_lc << "_dispatch_call;"
             << endl << endl << indent() << "param_spec = g_param_spec_object (\"handler\","
             << endl;
  args_indent = indent() + string(34, ' ');
  f_service_ << args_indent << "\"Service handler implementation\"," << endl << args_indent
             << "\"The service handler implementation \"" << endl << args_indent
             << "\"to which method calls are dispatched.\"," << endl << args_indent
             << this->nspace_uc + "TYPE_" + service_name_uc + "_HANDLER," << endl << args_indent
             << "G_PARAM_READWRITE);" << endl;
  f_service_ << indent() << "g_object_class_install_property (gobject_class," << endl;
  args_indent = indent() + string(33, ' ');
  f_service_ << args_indent << "PROP_" << class_name_uc << "_HANDLER," << endl << args_indent
             << "param_spec);" << endl;
  scope_down(f_service_);
}

/**
 * Generates C code that represents a Thrift service server.
 */
void t_c_glib_generator::generate_service_server(t_service* tservice) {
  (void)tservice;
  // Generate the service's handler class
  generate_service_handler(tservice);

  // Generate the service's processor class
  generate_service_processor(tservice);
}

/**
 * Generates C code to represent a THrift structure as a GObject.
 */
void t_c_glib_generator::generate_object(t_struct* tstruct) {
  string name = tstruct->get_name();
  string name_u = initial_caps_to_underscores(name);
  string name_uc = to_upper_case(name_u);

  string class_name = this->nspace + name;
  string class_name_lc = to_lower_case(initial_caps_to_underscores(class_name));
  string class_name_uc = to_upper_case(class_name_lc);

  string function_name;
  string args_indent;

  // write the instance definition
  f_types_ << "struct _" << this->nspace << name << endl << "{ " << endl
           << "  ThriftStruct parent; " << endl << endl << "  /* public */" << endl;

  // for each field, add a member variable
  vector<t_field*>::const_iterator m_iter;
  const vector<t_field*>& members = tstruct->get_members();
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_type* t = get_true_type((*m_iter)->get_type());
    f_types_ << "  " << type_name(t) << " " << (*m_iter)->get_name() << ";" << endl;
    if ((*m_iter)->get_req() != t_field::T_REQUIRED) {
      f_types_ << "  gboolean __isset_" << (*m_iter)->get_name() << ";" << endl;
    }
  }

  // close the structure definition and create a typedef
  f_types_ << "};" << endl << "typedef struct _" << this->nspace << name << " " << this->nspace
           << name << ";" << endl << endl;

  // write the class definition
  f_types_ << "struct _" << this->nspace << name << "Class" << endl << "{" << endl
           << "  ThriftStructClass parent;" << endl << "};" << endl << "typedef struct _"
           << this->nspace << name << "Class " << this->nspace << name << "Class;" << endl << endl;

  // write the standard GObject boilerplate
  f_types_ << "GType " << this->nspace_lc << name_u << "_get_type (void);" << endl << "#define "
           << this->nspace_uc << "TYPE_" << name_uc << " (" << this->nspace_lc << name_u
           << "_get_type())" << endl << "#define " << this->nspace_uc << name_uc
           << "(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), " << this->nspace_uc << "TYPE_" << name_uc
           << ", " << this->nspace << name << "))" << endl << "#define " << this->nspace_uc
           << name_uc << "_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), " << this->nspace_uc << "_TYPE_"
           << name_uc << ", " << this->nspace << name << "Class))" << endl << "#define "
           << this->nspace_uc << "IS_" << name_uc << "(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), "
           << this->nspace_uc << "TYPE_" << name_uc << "))" << endl << "#define " << this->nspace_uc
           << "IS_" << name_uc << "_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), " << this->nspace_uc
           << "TYPE_" << name_uc << "))" << endl << "#define " << this->nspace_uc << name_uc
           << "_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), " << this->nspace_uc << "TYPE_"
           << name_uc << ", " << this->nspace << name << "Class))" << endl << endl;

  // start writing the object implementation .c file

  // generate properties enum
  if (members.size() > 0) {
    f_types_impl_ << "enum _" << class_name << "Properties" << endl << "{" << endl;
    indent_up();
    f_types_impl_ << indent() << "PROP_" << class_name_uc << "_0";
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      string member_name_uc
          = to_upper_case(to_lower_case(initial_caps_to_underscores((*m_iter)->get_name())));

      f_types_impl_ << "," << endl << indent() << "PROP_" << class_name_uc << "_" << member_name_uc;
    }
    f_types_impl_ << endl;
    indent_down();
    f_types_impl_ << "};" << endl << endl;
  }

  // generate struct I/O methods
  string this_get = this->nspace + name + " * this_object = " + this->nspace_uc + name_uc
                    + "(object);";
  generate_struct_reader(f_types_impl_, tstruct, "this_object->", this_get);
  generate_struct_writer(f_types_impl_, tstruct, "this_object->", this_get);

  // generate property setter and getter
  if (members.size() > 0) {
    // generate property setter
    function_name = class_name_lc + "_set_property";
    args_indent = string(function_name.length() + 2, ' ');
    f_types_impl_ << "static void" << endl << function_name << " (GObject *object," << endl
                  << args_indent << "guint property_id," << endl << args_indent
                  << "const GValue *value," << endl << args_indent << "GParamSpec *pspec)" << endl;
    scope_up(f_types_impl_);
    f_types_impl_ << indent() << class_name << " *self = " << class_name_uc << " (object);" << endl
                  << endl << indent() << "switch (property_id)" << endl;
    scope_up(f_types_impl_);
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      t_field* member = (*m_iter);
      string member_name = member->get_name();
      string member_name_uc
          = to_upper_case(to_lower_case(initial_caps_to_underscores(member_name)));
      t_type* member_type = get_true_type(member->get_type());

      string property_identifier = "PROP_" + class_name_uc + "_" + member_name_uc;

      f_types_impl_ << indent() << "case " << property_identifier + ":" << endl;
      indent_up();

      if (member_type->is_base_type()) {
        t_base_type* base_type = ((t_base_type*)member_type);
        string assign_function_name;

        if (base_type->get_base() == t_base_type::TYPE_STRING) {
          string release_function_name;

          f_types_impl_ << indent() << "if (self->" << member_name << " != NULL)" << endl;
          indent_up();

          if (base_type->is_binary()) {
            release_function_name = "g_byte_array_unref";
            assign_function_name = "g_value_dup_boxed";
          } else {
            release_function_name = "g_free";
            assign_function_name = "g_value_dup_string";
          }

          f_types_impl_ << indent() << release_function_name << " (self->" << member_name << ");"
                        << endl;
          indent_down();
        } else {
          switch (base_type->get_base()) {
          case t_base_type::TYPE_BOOL:
            assign_function_name = "g_value_get_boolean";
            break;

          case t_base_type::TYPE_I8:
          case t_base_type::TYPE_I16:
          case t_base_type::TYPE_I32:
            assign_function_name = "g_value_get_int";
            break;

          case t_base_type::TYPE_I64:
            assign_function_name = "g_value_get_int64";
            break;

          case t_base_type::TYPE_DOUBLE:
            assign_function_name = "g_value_get_double";
            break;

          default:
            throw "compiler error: "
                  "unrecognized base type \"" + base_type->get_name() + "\" "
                                                                        "for struct member \""
                + member_name + "\"";
            break;
          }
        }

        f_types_impl_ << indent() << "self->" << member_name << " = " << assign_function_name
                      << " (value);" << endl;
      } else if (member_type->is_enum()) {
        f_types_impl_ << indent() << "self->" << member_name << " = g_value_get_int (value);"
                      << endl;
      } else if (member_type->is_container()) {
        string release_function_name;
        string assign_function_name;

        if (member_type->is_list()) {
          t_type* elem_type = ((t_list*)member_type)->get_elem_type();

          // Lists of base types other than strings are represented as GArrays;
          // all others as GPtrArrays
          if (is_numeric(elem_type)) {
            release_function_name = "g_array_unref";
          } else {
            release_function_name = "g_ptr_array_unref";
          }

          assign_function_name = "g_value_dup_boxed";
        } else if (member_type->is_set() || member_type->is_map()) {
          release_function_name = "g_hash_table_unref";
          assign_function_name = "g_value_dup_boxed";
        }

        f_types_impl_ << indent() << "if (self->" << member_name << " != NULL)" << endl;
        indent_up();
        f_types_impl_ << indent() << release_function_name << " (self->" << member_name << ");"
                      << endl;
        indent_down();
        f_types_impl_ << indent() << "self->" << member_name << " = " << assign_function_name
                      << " (value);" << endl;
      } else if (member_type->is_struct() || member_type->is_xception()) {
        f_types_impl_ << indent() << "if (self->" << member_name << " != NULL)" << endl;
        indent_up();
        f_types_impl_ << indent() << "g_object_unref (self->" << member_name << ");" << endl;
        indent_down();
        f_types_impl_ << indent() << "self->" << member_name << " = g_value_dup_object (value);"
                      << endl;
      }

      if (member->get_req() != t_field::T_REQUIRED) {
        f_types_impl_ << indent() << "self->__isset_" << member_name << " = TRUE;" << endl;
      }

      f_types_impl_ << indent() << "break;" << endl << endl;
      indent_down();
    }
    f_types_impl_ << indent() << "default:" << endl;
    indent_up();
    f_types_impl_ << indent() << "G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);"
                  << endl << indent() << "break;" << endl;
    indent_down();
    scope_down(f_types_impl_);
    scope_down(f_types_impl_);
    f_types_impl_ << endl;

    // generate property getter
    function_name = class_name_lc + "_get_property";
    args_indent = string(function_name.length() + 2, ' ');
    f_types_impl_ << "static void" << endl << function_name << " (GObject *object," << endl
                  << args_indent << "guint property_id," << endl << args_indent << "GValue *value,"
                  << endl << args_indent << "GParamSpec *pspec)" << endl;
    scope_up(f_types_impl_);
    f_types_impl_ << indent() << class_name << " *self = " << class_name_uc << " (object);" << endl
                  << endl << indent() << "switch (property_id)" << endl;
    scope_up(f_types_impl_);
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      t_field* member = (*m_iter);
      string member_name = (*m_iter)->get_name();
      string member_name_uc
          = to_upper_case(to_lower_case(initial_caps_to_underscores(member_name)));
      t_type* member_type = get_true_type(member->get_type());

      string property_identifier = "PROP_" + class_name_uc + "_" + member_name_uc;

      string setter_function_name;

      if (member_type->is_base_type()) {
        t_base_type* base_type = ((t_base_type*)member_type);

        switch (base_type->get_base()) {
        case t_base_type::TYPE_BOOL:
          setter_function_name = "g_value_set_boolean";
          break;

        case t_base_type::TYPE_I8:
        case t_base_type::TYPE_I16:
        case t_base_type::TYPE_I32:
          setter_function_name = "g_value_set_int";
          break;

        case t_base_type::TYPE_I64:
          setter_function_name = "g_value_set_int64";
          break;

        case t_base_type::TYPE_DOUBLE:
          setter_function_name = "g_value_set_double";
          break;

        case t_base_type::TYPE_STRING:
          if (base_type->is_binary()) {
            setter_function_name = "g_value_set_boxed";
          } else {
            setter_function_name = "g_value_set_string";
          }
          break;

        default:
          throw "compiler error: "
                "unrecognized base type \"" + base_type->get_name() + "\" "
                                                                      "for struct member \""
              + member_name + "\"";
          break;
        }
      } else if (member_type->is_enum()) {
        setter_function_name = "g_value_set_int";
      } else if (member_type->is_struct() || member_type->is_xception()) {
        setter_function_name = "g_value_set_object";
      } else if (member_type->is_container()) {
        setter_function_name = "g_value_set_boxed";
      } else {
        throw "compiler error: "
              "unrecognized type for struct member \"" + member_name + "\"";
      }

      f_types_impl_ << indent() << "case " << property_identifier + ":" << endl;
      indent_up();
      f_types_impl_ << indent() << setter_function_name << " (value, self->" << member_name << ");"
                    << endl << indent() << "break;" << endl << endl;
      indent_down();
    }
    f_types_impl_ << indent() << "default:" << endl;
    indent_up();
    f_types_impl_ << indent() << "G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);"
                  << endl << indent() << "break;" << endl;
    indent_down();
    scope_down(f_types_impl_);
    scope_down(f_types_impl_);
    f_types_impl_ << endl;
  }

  // generate the instance init function

  f_types_impl_ << "static void " << endl << this->nspace_lc << name_u << "_instance_init ("
                << this->nspace << name << " * object)" << endl << "{" << endl;
  indent_up();

  // generate default-value structures for container-type members
  bool constant_declaration_output = false;
  bool string_list_constant_output = false;
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_field* member = *m_iter;
    t_const_value* member_value = member->get_value();

    if (member_value != NULL) {
      string member_name = member->get_name();
      t_type* member_type = get_true_type(member->get_type());

      if (member_type->is_list()) {
        const vector<t_const_value*>& list = member_value->get_list();
        t_type* elem_type = ((t_list*)member_type)->get_elem_type();

        // Generate an array with the list literal
        indent(f_types_impl_) << "static " << type_name(elem_type, false, true) << " __default_"
                              << member_name << "[" << list.size() << "] = " << endl;
        indent_up();
        f_types_impl_ << indent() << constant_literal(member_type, member_value) << ";" << endl;
        indent_down();

        constant_declaration_output = true;

        // If we are generating values for a pointer array (i.e. a list of
        // strings), set a flag so we know to also declare an index variable to
        // use in pre-populating the array
        if (elem_type->is_string()) {
          string_list_constant_output = true;
        }
      }

      // TODO: Handle container types other than list
    }
  }
  if (constant_declaration_output) {
    if (string_list_constant_output) {
      indent(f_types_impl_) << "unsigned int list_index;" << endl;
    }

    f_types_impl_ << endl;
  }

  // satisfy compilers with -Wall turned on
  indent(f_types_impl_) << "/* satisfy -Wall */" << endl << indent()
                        << "THRIFT_UNUSED_VAR (object);" << endl;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_type* t = get_true_type((*m_iter)->get_type());
    if (t->is_base_type()) {
      string dval = " = ";
      if (t->is_enum()) {
        dval += "(" + type_name(t) + ")";
      }
      t_const_value* cv = (*m_iter)->get_value();
      if (cv != NULL) {
        dval += constant_value("", t, cv);
      } else {
        dval += t->is_string() ? "NULL" : "0";
      }
      indent(f_types_impl_) << "object->" << (*m_iter)->get_name() << dval << ";" << endl;
    } else if (t->is_struct()) {
      string name = (*m_iter)->get_name();
      string type_name_uc
          = to_upper_case(initial_caps_to_underscores((*m_iter)->get_type()->get_name()));
      indent(f_types_impl_) << "object->" << name << " = g_object_new (" << this->nspace_uc
                            << "TYPE_" << type_name_uc << ", NULL);" << endl;
    } else if (t->is_xception()) {
      string name = (*m_iter)->get_name();
      indent(f_types_impl_) << "object->" << name << " = NULL;" << endl;
    } else if (t->is_container()) {
      string name = (*m_iter)->get_name();
      string init_function;
      t_type* etype = NULL;

      if (t->is_map()) {
        t_type* key = ((t_map*)t)->get_key_type();
        t_type* value = ((t_map*)t)->get_val_type();
        init_function = generate_new_hash_from_type(key, value);
      } else if (t->is_set()) {
        etype = ((t_set*)t)->get_elem_type();
        init_function = generate_new_hash_from_type(etype, NULL);
      } else if (t->is_list()) {
        etype = ((t_list*)t)->get_elem_type();
        init_function = generate_new_array_from_type(etype);
      }

      indent(f_types_impl_) << "object->" << name << " = " << init_function << endl;

      // Pre-populate the container with the specified default values, if any
      if ((*m_iter)->get_value()) {
        t_const_value* member_value = (*m_iter)->get_value();

        if (t->is_list()) {
          const vector<t_const_value*>& list = member_value->get_list();

          if (is_numeric(etype)) {
            indent(f_types_impl_) <<
              "g_array_append_vals (object->" << name << ", &__default_" <<
              name << ", " << list.size() << ");" << endl;
          }
          else {
            indent(f_types_impl_) <<
              "for (list_index = 0; list_index < " << list.size() << "; " <<
              "list_index += 1)" << endl;
            indent_up();
            indent(f_types_impl_) <<
              "g_ptr_array_add (object->" << name << "," << endl <<
              indent() << string(17, ' ') << "g_strdup (__default_" <<
              name << "[list_index]));" << endl;
            indent_down();
          }
        }

        // TODO: Handle container types other than list
      }
    }

    /* if not required, initialize the __isset variable */
    if ((*m_iter)->get_req() != t_field::T_REQUIRED) {
      indent(f_types_impl_) << "object->__isset_" << (*m_iter)->get_name() << " = FALSE;" << endl;
    }
  }

  indent_down();
  f_types_impl_ << "}" << endl << endl;

  /* create the destructor */
  f_types_impl_ << "static void " << endl << this->nspace_lc << name_u
                << "_finalize (GObject *object)" << endl << "{" << endl;
  indent_up();

  f_types_impl_ << indent() << this->nspace << name << " *tobject = " << this->nspace_uc << name_uc
                << " (object);" << endl << endl;

  f_types_impl_ << indent() << "/* satisfy -Wall in case we don't use tobject */" << endl
                << indent() << "THRIFT_UNUSED_VAR (tobject);" << endl;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_type* t = get_true_type((*m_iter)->get_type());
    if (t->is_container()) {
      string name = (*m_iter)->get_name();
      if (t->is_map() || t->is_set()) {
        f_types_impl_ << indent() << "if (tobject->" << name << " != NULL)" << endl;
        f_types_impl_ << indent() << "{" << endl;
        indent_up();
        f_types_impl_ << indent() << "g_hash_table_destroy (tobject->" << name << ");" << endl;
        f_types_impl_ << indent() << "tobject->" << name << " = NULL;" << endl;
        indent_down();
        f_types_impl_ << indent() << "}" << endl;
      } else if (t->is_list()) {
        t_type* etype = ((t_list*)t)->get_elem_type();
        string destructor_function = "g_ptr_array_unref";

        if (etype->is_base_type()) {
          t_base_type::t_base tbase = ((t_base_type*)etype)->get_base();
          switch (tbase) {
          case t_base_type::TYPE_VOID:
            throw "compiler error: cannot determine array type";
          case t_base_type::TYPE_BOOL:
          case t_base_type::TYPE_I8:
          case t_base_type::TYPE_I16:
          case t_base_type::TYPE_I32:
          case t_base_type::TYPE_I64:
          case t_base_type::TYPE_DOUBLE:
            destructor_function = "g_array_unref";
            break;
          case t_base_type::TYPE_STRING:
            break;
          default:
            throw "compiler error: no array info for type";
          }
        } else if (etype->is_enum()) {
          destructor_function = "g_array_unref";
        }

        f_types_impl_ << indent() << "if (tobject->" << name << " != NULL)" << endl;
        f_types_impl_ << indent() << "{" << endl;
        indent_up();
        f_types_impl_ << indent() << destructor_function << " (tobject->" << name << ");" << endl;
        f_types_impl_ << indent() << "tobject->" << name << " = NULL;" << endl;
        indent_down();
        f_types_impl_ << indent() << "}" << endl;
      }
    } else if (t->is_struct() || t->is_xception()) {
      string name = (*m_iter)->get_name();
      // TODO: g_clear_object needs glib >= 2.28
      // f_types_impl_ << indent() << "g_clear_object (&(tobject->" << name << "));" << endl;
      // does g_object_unref the trick?
      f_types_impl_ << indent() << "if (tobject->" << name << " != NULL)" << endl;
      f_types_impl_ << indent() << "{" << endl;
      indent_up();
      f_types_impl_ << indent() << "g_object_unref(tobject->" << name << ");" << endl;
      f_types_impl_ << indent() << "tobject->" << name << " = NULL;" << endl;
      indent_down();
      f_types_impl_ << indent() << "}" << endl;
    } else if (t->is_string()) {
      string name = (*m_iter)->get_name();
      f_types_impl_ << indent() << "if (tobject->" << name << " != NULL)" << endl;
      f_types_impl_ << indent() << "{" << endl;
      indent_up();
      f_types_impl_ << indent() << generate_free_func_from_type(t) << "(tobject->" << name << ");"
                    << endl;
      f_types_impl_ << indent() << "tobject->" << name << " = NULL;" << endl;
      indent_down();
      f_types_impl_ << indent() << "}" << endl;
    }
  }

  indent_down();
  f_types_impl_ << "}" << endl << endl;

  // generate the class init function

  f_types_impl_ << "static void" << endl << class_name_lc << "_class_init (" << class_name
                << "Class * cls)" << endl;
  scope_up(f_types_impl_);

  f_types_impl_ << indent() << "GObjectClass *gobject_class = G_OBJECT_CLASS (cls);" << endl
                << indent() << "ThriftStructClass *struct_class = "
                << "THRIFT_STRUCT_CLASS (cls);" << endl << endl << indent()
                << "struct_class->read = " << class_name_lc << "_read;" << endl << indent()
                << "struct_class->write = " << class_name_lc << "_write;" << endl << endl
                << indent() << "gobject_class->finalize = " << class_name_lc << "_finalize;"
                << endl;
  if (members.size() > 0) {
    f_types_impl_ << indent() << "gobject_class->get_property = " << class_name_lc
                  << "_get_property;" << endl << indent()
                  << "gobject_class->set_property = " << class_name_lc << "_set_property;" << endl;

    // install a property for each member
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      t_field* member = (*m_iter);
      string member_name = member->get_name();
      string member_name_uc
          = to_upper_case(to_lower_case(initial_caps_to_underscores(member_name)));
      t_type* member_type = get_true_type(member->get_type());
      t_const_value* member_value = member->get_value();

      string property_identifier = "PROP_" + class_name_uc + "_" + member_name_uc;

      f_types_impl_ << endl << indent() << "g_object_class_install_property" << endl;
      indent_up();
      args_indent = indent() + ' ';
      f_types_impl_ << indent() << "(gobject_class," << endl << args_indent << property_identifier
                    << "," << endl << args_indent;

      if (member_type->is_base_type()) {
        t_base_type::t_base base_type = ((t_base_type*)member_type)->get_base();

        if (base_type == t_base_type::TYPE_STRING) {
          if (((t_base_type*)member_type)->is_binary()) {
            args_indent += string(20, ' ');
            f_types_impl_ << "g_param_spec_boxed (\"" << member_name << "\"," << endl << args_indent
                          << "NULL," << endl << args_indent << "NULL," << endl << args_indent
                          << "G_TYPE_BYTE_ARRAY," << endl << args_indent << "G_PARAM_READWRITE));"
                          << endl;
          } else {
            args_indent += string(21, ' ');
            f_types_impl_ << "g_param_spec_string (\"" << member_name << "\"," << endl
                          << args_indent << "NULL," << endl << args_indent << "NULL," << endl
                          << args_indent
                          << ((member_value != NULL) ? "\"" + member_value->get_string() + "\""
                                                     : "NULL") << "," << endl << args_indent
                          << "G_PARAM_READWRITE));" << endl;
          }
        } else if (base_type == t_base_type::TYPE_BOOL) {
          args_indent += string(22, ' ');
          f_types_impl_ << "g_param_spec_boolean (\"" << member_name << "\"," << endl << args_indent
                        << "NULL," << endl << args_indent << "NULL," << endl << args_indent
                        << (((member_value != NULL) && (member_value->get_integer() != 0))
                                ? "TRUE"
                                : "FALSE") << "," << endl << args_indent << "G_PARAM_READWRITE));"
                        << endl;
        } else if ((base_type == t_base_type::TYPE_I8) || (base_type == t_base_type::TYPE_I16)
                   || (base_type == t_base_type::TYPE_I32) || (base_type == t_base_type::TYPE_I64)
                   || (base_type == t_base_type::TYPE_DOUBLE)) {
          string param_spec_function_name = "g_param_spec_int";
          string min_value;
          string max_value;
          ostringstream default_value;

          switch (base_type) {
          case t_base_type::TYPE_I8:
            min_value = "G_MININT8";
            max_value = "G_MAXINT8";
            break;

          case t_base_type::TYPE_I16:
            min_value = "G_MININT16";
            max_value = "G_MAXINT16";
            break;

          case t_base_type::TYPE_I32:
            min_value = "G_MININT32";
            max_value = "G_MAXINT32";
            break;

          case t_base_type::TYPE_I64:
            param_spec_function_name = "g_param_spec_int64";
            min_value = "G_MININT64";
            max_value = "G_MAXINT64";
            break;

          case t_base_type::TYPE_DOUBLE:
            param_spec_function_name = "g_param_spec_double";
            min_value = "-INFINITY";
            max_value = "INFINITY";
            break;

          default:
            throw "compiler error: "
                  "unrecognized base type \"" + member_type->get_name() + "\" "
                                                                          "for struct member \""
                + member_name + "\"";
            break;
          }

          if (member_value != NULL) {
            default_value << (base_type == t_base_type::TYPE_DOUBLE ? member_value->get_double()
                                                                    : member_value->get_integer());
          } else {
            default_value << "0";
          }

          args_indent += string(param_spec_function_name.length() + 2, ' ');
          f_types_impl_ << param_spec_function_name << " (\"" << member_name << "\"," << endl
                        << args_indent << "NULL," << endl << args_indent << "NULL," << endl
                        << args_indent << min_value << "," << endl << args_indent << max_value
                        << "," << endl << args_indent << default_value.str() << "," << endl
                        << args_indent << "G_PARAM_READWRITE));" << endl;
        }

        indent_down();
      } else if (member_type->is_enum()) {
        t_enum_value* enum_min_value = ((t_enum*)member_type)->get_min_value();
        t_enum_value* enum_max_value = ((t_enum*)member_type)->get_max_value();
        int min_value = (enum_min_value != NULL) ? enum_min_value->get_value() : 0;
        int max_value = (enum_max_value != NULL) ? enum_max_value->get_value() : 0;

        args_indent += string(18, ' ');
        f_types_impl_ << "g_param_spec_int (\"" << member_name << "\"," << endl << args_indent
                      << "NULL," << endl << args_indent << "NULL," << endl << args_indent
                      << min_value << "," << endl << args_indent << max_value << "," << endl
                      << args_indent << min_value << "," << endl << args_indent
                      << "G_PARAM_READWRITE));" << endl;
        indent_down();
      } else if (member_type->is_struct() || member_type->is_xception()) {
        string param_type = this->nspace_uc + "TYPE_"
                            + to_upper_case(initial_caps_to_underscores(member_type->get_name()));

        args_indent += string(20, ' ');
        f_types_impl_ << "g_param_spec_object (\"" << member_name << "\"," << endl << args_indent
                      << "NULL," << endl << args_indent << "NULL," << endl << args_indent
                      << param_type << "," << endl << args_indent << "G_PARAM_READWRITE));" << endl;
        indent_down();
      } else if (member_type->is_list()) {
        t_type* elem_type = ((t_list*)member_type)->get_elem_type();
        string param_type;

        if (elem_type->is_base_type() && !elem_type->is_string()) {
          param_type = "G_TYPE_ARRAY";
        } else {
          param_type = "G_TYPE_PTR_ARRAY";
        }

        args_indent += string(20, ' ');
        f_types_impl_ << "g_param_spec_boxed (\"" << member_name << "\"," << endl << args_indent
                      << "NULL," << endl << args_indent << "NULL," << endl << args_indent
                      << param_type << "," << endl << args_indent << "G_PARAM_READWRITE));" << endl;
        indent_down();
      } else if (member_type->is_set() || member_type->is_map()) {
        args_indent += string(20, ' ');
        f_types_impl_ << "g_param_spec_boxed (\"" << member_name << "\"," << endl << args_indent
                      << "NULL," << endl << args_indent << "NULL," << endl << args_indent
                      << "G_TYPE_HASH_TABLE," << endl << args_indent << "G_PARAM_READWRITE));"
                      << endl;
        indent_down();
      }
    }
  }
  scope_down(f_types_impl_);
  f_types_impl_ << endl;

  f_types_impl_ << "GType" << endl << this->nspace_lc << name_u << "_get_type (void)" << endl << "{"
                << endl << "  static GType type = 0;" << endl << endl << "  if (type == 0) " << endl
                << "  {" << endl << "    static const GTypeInfo type_info = " << endl << "    {"
                << endl << "      sizeof (" << this->nspace << name << "Class)," << endl
                << "      NULL, /* base_init */" << endl << "      NULL, /* base_finalize */"
                << endl << "      (GClassInitFunc) " << this->nspace_lc << name_u << "_class_init,"
                << endl << "      NULL, /* class_finalize */" << endl
                << "      NULL, /* class_data */" << endl << "      sizeof (" << this->nspace
                << name << ")," << endl << "      0, /* n_preallocs */" << endl
                << "      (GInstanceInitFunc) " << this->nspace_lc << name_u << "_instance_init,"
                << endl << "      NULL, /* value_table */" << endl << "    };" << endl << endl
                << "    type = g_type_register_static (THRIFT_TYPE_STRUCT, " << endl
                << "                                   \"" << this->nspace << name << "Type\","
                << endl << "                                   &type_info, 0);" << endl << "  }"
                << endl << endl << "  return type;" << endl << "}" << endl << endl;
}

/**
 * Generates functions to write Thrift structures to a stream.
 */
void t_c_glib_generator::generate_struct_writer(ofstream& out,
                                                t_struct* tstruct,
                                                string this_name,
                                                string this_get,
                                                bool is_function) {
  string name = tstruct->get_name();
  string name_u = initial_caps_to_underscores(name);
  string name_uc = to_upper_case(name_u);

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  int error_ret = 0;

  if (is_function) {
    error_ret = -1;
    indent(out) << "static gint32" << endl << this->nspace_lc << name_u
                << "_write (ThriftStruct *object, ThriftProtocol *protocol, GError **error)"
                << endl;
  }
  indent(out) << "{" << endl;
  indent_up();

  out << indent() << "gint32 ret;" << endl << indent() << "gint32 xfer = 0;" << endl << endl;

  indent(out) << this_get << endl;
  // satisfy -Wall in the case of an empty struct
  if (!this_get.empty()) {
    indent(out) << "THRIFT_UNUSED_VAR (this_object);" << endl;
  }

  out << indent() << "if ((ret = thrift_protocol_write_struct_begin (protocol, \"" << name
      << "\", error)) < 0)" << endl << indent() << "  return " << error_ret << ";" << endl
      << indent() << "xfer += ret;" << endl;

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if ((*f_iter)->get_req() == t_field::T_OPTIONAL) {
      indent(out) << "if (this_object->__isset_" << (*f_iter)->get_name() << " == TRUE) {" << endl;
      indent_up();
    }

    out << indent() << "if ((ret = thrift_protocol_write_field_begin (protocol, "
        << "\"" << (*f_iter)->get_name() << "\", " << type_to_enum((*f_iter)->get_type()) << ", "
        << (*f_iter)->get_key() << ", error)) < 0)" << endl << indent() << "  return " << error_ret
        << ";" << endl << indent() << "xfer += ret;" << endl;
    generate_serialize_field(out, *f_iter, this_name, "", error_ret);
    out << indent() << "if ((ret = thrift_protocol_write_field_end (protocol, error)) < 0)" << endl
        << indent() << "  return " << error_ret << ";" << endl << indent() << "xfer += ret;"
        << endl;

    if ((*f_iter)->get_req() == t_field::T_OPTIONAL) {
      indent_down();
      indent(out) << "}" << endl;
    }
  }

  // write the struct map
  out << indent() << "if ((ret = thrift_protocol_write_field_stop (protocol, error)) < 0)" << endl
      << indent() << "  return " << error_ret << ";" << endl << indent() << "xfer += ret;" << endl
      << indent() << "if ((ret = thrift_protocol_write_struct_end (protocol, error)) < 0)" << endl
      << indent() << "  return " << error_ret << ";" << endl << indent() << "xfer += ret;" << endl
      << endl;

  if (is_function) {
    indent(out) << "return xfer;" << endl;
  }

  indent_down();
  indent(out) << "}" << endl << endl;
}

/**
 * Generates code to read Thrift structures from a stream.
 */
void t_c_glib_generator::generate_struct_reader(ofstream& out,
                                                t_struct* tstruct,
                                                string this_name,
                                                string this_get,
                                                bool is_function) {
  string name = tstruct->get_name();
  string name_u = initial_caps_to_underscores(name);
  string name_uc = to_upper_case(name_u);
  int error_ret = 0;
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  if (is_function) {
    error_ret = -1;
    indent(out) << "/* reads a " << name_u << " object */" << endl << "static gint32" << endl
                << this->nspace_lc << name_u
                << "_read (ThriftStruct *object, ThriftProtocol *protocol, GError **error)" << endl;
  }

  indent(out) << "{" << endl;
  indent_up();

  // declare stack temp variables
  out << indent() << "gint32 ret;" << endl << indent() << "gint32 xfer = 0;" << endl << indent()
      << "gchar *name = NULL;" << endl << indent() << "ThriftType ftype;" << endl << indent()
      << "gint16 fid;" << endl << indent() << "guint32 len = 0;" << endl << indent()
      << "gpointer data = NULL;" << endl << indent() << this_get << endl;

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if ((*f_iter)->get_req() == t_field::T_REQUIRED) {
      indent(out) << "gboolean isset_" << (*f_iter)->get_name() << " = FALSE;" << endl;
    }
  }

  out << endl;

  // satisfy -Wall in case we don't use some variables
  out << indent() << "/* satisfy -Wall in case these aren't used */" << endl << indent()
      << "THRIFT_UNUSED_VAR (len);" << endl << indent() << "THRIFT_UNUSED_VAR (data);" << endl;

  if (!this_get.empty()) {
    out << indent() << "THRIFT_UNUSED_VAR (this_object);" << endl;
  }
  out << endl;

  // read the beginning of the structure marker
  out << indent() << "/* read the struct begin marker */" << endl << indent()
      << "if ((ret = thrift_protocol_read_struct_begin (protocol, &name, error)) < 0)" << endl
      << indent() << "{" << endl << indent() << "  if (name) g_free (name);" << endl << indent()
      << "  return " << error_ret << ";" << endl << indent() << "}" << endl << indent()
      << "xfer += ret;" << endl << indent() << "if (name) g_free (name);" << endl << indent()
      << "name = NULL;" << endl << endl;

  // read the struct fields
  out << indent() << "/* read the struct fields */" << endl << indent() << "while (1)" << endl;
  scope_up(out);

  // read beginning field marker
  out << indent() << "/* read the beginning of a field */" << endl << indent()
      << "if ((ret = thrift_protocol_read_field_begin (protocol, &name, &ftype, &fid, error)) < 0)"
      << endl << indent() << "{" << endl << indent() << "  if (name) g_free (name);" << endl
      << indent() << "  return " << error_ret << ";" << endl << indent() << "}" << endl << indent()
      << "xfer += ret;" << endl << indent() << "if (name) g_free (name);" << endl << indent()
      << "name = NULL;" << endl << endl;

  // check for field STOP marker
  out << indent() << "/* break if we get a STOP field */" << endl << indent()
      << "if (ftype == T_STOP)" << endl << indent() << "{" << endl << indent() << "  break;" << endl
      << indent() << "}" << endl << endl;

  // switch depending on the field type
  indent(out) << "switch (fid)" << endl;

  // start switch
  scope_up(out);

  // generate deserialization code for known types
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    indent(out) << "case " << (*f_iter)->get_key() << ":" << endl;
    indent_up();
    indent(out) << "if (ftype == " << type_to_enum((*f_iter)->get_type()) << ")" << endl;
    indent(out) << "{" << endl;

    indent_up();
    // generate deserialize field
    generate_deserialize_field(out, *f_iter, this_name, "", error_ret, false);
    indent_down();

    out << indent() << "} else {" << endl << indent()
        << "  if ((ret = thrift_protocol_skip (protocol, ftype, error)) < 0)" << endl << indent()
        << "    return " << error_ret << ";" << endl << indent() << "  xfer += ret;" << endl
        << indent() << "}" << endl << indent() << "break;" << endl;
    indent_down();
  }

  // create the default case
  out << indent() << "default:" << endl << indent()
      << "  if ((ret = thrift_protocol_skip (protocol, ftype, error)) < 0)" << endl << indent()
      << "    return " << error_ret << ";" << endl << indent() << "  xfer += ret;" << endl
      << indent() << "  break;" << endl;

  // end switch
  scope_down(out);

  // read field end marker
  out << indent() << "if ((ret = thrift_protocol_read_field_end (protocol, error)) < 0)" << endl
      << indent() << "  return " << error_ret << ";" << endl << indent() << "xfer += ret;" << endl;

  // end while loop
  scope_down(out);
  out << endl;

  // read the end of the structure
  out << indent() << "if ((ret = thrift_protocol_read_struct_end (protocol, error)) < 0)" << endl
      << indent() << "  return " << error_ret << ";" << endl << indent() << "xfer += ret;" << endl
      << endl;

  // if a required field is missing, throw an error
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if ((*f_iter)->get_req() == t_field::T_REQUIRED) {
      out << indent() << "if (!isset_" << (*f_iter)->get_name() << ")" << endl << indent() << "{"
          << endl << indent() << "  g_set_error (error, THRIFT_PROTOCOL_ERROR," << endl << indent()
          << "               THRIFT_PROTOCOL_ERROR_INVALID_DATA," << endl << indent()
          << "               \"missing field\");" << endl << indent() << "  return -1;" << endl
          << indent() << "}" << endl << endl;
    }
  }

  if (is_function) {
    indent(out) << "return xfer;" << endl;
  }

  // end the function/structure
  indent_down();
  indent(out) << "}" << endl << endl;
}

void t_c_glib_generator::generate_serialize_field(ofstream& out,
                                                  t_field* tfield,
                                                  string prefix,
                                                  string suffix,
                                                  int error_ret) {
  t_type* type = get_true_type(tfield->get_type());
  string name = prefix + tfield->get_name() + suffix;

  if (type->is_void()) {
    throw "CANNOT GENERATE SERIALIZE CODE FOR void TYPE: " + name;
  }

  if (type->is_struct() || type->is_xception()) {
    generate_serialize_struct(out, (t_struct*)type, name, error_ret);
  } else if (type->is_container()) {
    generate_serialize_container(out, type, name, error_ret);
  } else if (type->is_base_type() || type->is_enum()) {
    indent(out) << "if ((ret = thrift_protocol_write_";

    if (type->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        throw "compiler error: cannot serialize void field in a struct: " + name;
        break;
      case t_base_type::TYPE_BOOL:
        out << "bool (protocol, " << name;
        break;
      case t_base_type::TYPE_I8:
        out << "byte (protocol, " << name;
        break;
      case t_base_type::TYPE_I16:
        out << "i16 (protocol, " << name;
        break;
      case t_base_type::TYPE_I32:
        out << "i32 (protocol, " << name;
        break;
      case t_base_type::TYPE_I64:
        out << "i64 (protocol, " << name;
        break;
      case t_base_type::TYPE_DOUBLE:
        out << "double (protocol, " << name;
        break;
      case t_base_type::TYPE_STRING:
        if (((t_base_type*)type)->is_binary()) {
          out << "binary (protocol, " << name << " ? ((GByteArray *) " << name << ")->data : NULL, "
              << name << " ? ((GByteArray *) " << name << ")->len : 0";
        } else {
          out << "string (protocol, " << name;
        }
        break;
      default:
        throw "compiler error: no C writer for base type " + t_base_type::t_base_name(tbase) + name;
      }
    } else {
      out << "i32 (protocol, (gint32) " << name;
    }
    out << ", error)) < 0)" << endl
        << indent() << "  return " << error_ret << ";" << endl
        << indent() << "xfer += ret;" << endl << endl;
  } else {
    throw std::logic_error("DO NOT KNOW HOW TO SERIALIZE FIELD '" + name + "' TYPE '"
                           + type_name(type));
  }
}

void t_c_glib_generator::generate_serialize_struct(ofstream& out,
                                                   t_struct* tstruct,
                                                   string prefix,
                                                   int error_ret) {
  (void)tstruct;
  out << indent() << "if ((ret = thrift_struct_write (THRIFT_STRUCT (" << prefix
      << "), protocol, error)) < 0)" << endl << indent() << "  return " << error_ret << ";" << endl
      << indent() << "xfer += ret;" << endl << endl;
}

void t_c_glib_generator::generate_serialize_container(ofstream& out,
                                                      t_type* ttype,
                                                      string prefix,
                                                      int error_ret) {
  scope_up(out);

  if (ttype->is_map()) {
    t_type* tkey = ((t_map*)ttype)->get_key_type();
    t_type* tval = ((t_map*)ttype)->get_val_type();
    string tkey_name = type_name(tkey);
    string tval_name = type_name(tval);
    string tkey_ptr;
    string tval_ptr;
    string keyname = tmp("key");
    string valname = tmp("val");

    declore_local_variable_for_write(out, tkey, keyname);
    declore_local_variable_for_write(out, tval, valname);

    /* If either the key or value type is a typedef, find its underlying type so
       we can correctly determine how to generate a pointer to it */
    tkey = get_true_type(tkey);
    tval = get_true_type(tval);

    tkey_ptr = tkey->is_string() || !tkey->is_base_type() ? "" : "*";
    tval_ptr = tval->is_string() || !tval->is_base_type() ? "" : "*";

    /*
     * Some ugliness here.  To maximize backwards compatibility, we
     * avoid using GHashTableIter and instead get a GList of all keys,
     * then copy it into a array on the stack, and free it.
     * This is because we may exit early before we get a chance to free the
     * GList.
     */
    out << indent() << "GList *key_list = NULL, *iter = NULL;" << endl
        << indent() << tkey_name << tkey_ptr << "* keys;" << endl
        << indent() << "int i = 0, key_count;" << endl
        << endl
        << indent() << "if ((ret = thrift_protocol_write_map_begin (protocol, "
        << type_to_enum(tkey) << ", " << type_to_enum(tval) << ", " << prefix << " ? "
        << "(gint32) g_hash_table_size ((GHashTable *) " << prefix << ") : 0"
        << ", error)) < 0)" << endl;
    indent_up();
    out << indent() << "return " << error_ret << ";" << endl;
    indent_down();
    out << indent() << "xfer += ret;" << endl
        << indent() << "if (" << prefix << ")" << endl
        << indent() << "  g_hash_table_foreach ((GHashTable *) " << prefix
        << ", thrift_hash_table_get_keys, &key_list);" << endl
        << indent() << "key_count = g_list_length (key_list);" << endl
        << indent() << "keys = g_newa (" << tkey_name << tkey_ptr
        << ", key_count);" << endl
        << indent() << "for (iter = g_list_first (key_list); iter; "
           "iter = iter->next)" << endl;
    indent_up();
    out << indent() << "keys[i++] = (" << tkey_name << tkey_ptr
        << ") iter->data;" << endl;
    indent_down();
    out << indent() << "g_list_free (key_list);" << endl
        << endl
        << indent() << "for (i = 0; i < key_count; ++i)" << endl;
    scope_up(out);
    out << indent() << keyname << " = keys[i];" << endl
        << indent() << valname << " = (" << tval_name << tval_ptr
        << ") g_hash_table_lookup (((GHashTable *) " << prefix
        << "), (gpointer) " << keyname << ");" << endl
        << endl;
    generate_serialize_map_element(out,
                                   (t_map*)ttype,
                                   tkey_ptr + " " + keyname,
                                   tval_ptr + " " + valname,
                                   error_ret);
    scope_down(out);
    out << indent() << "if ((ret = thrift_protocol_write_map_end (protocol, "
           "error)) < 0)" << endl;
    indent_up();
    out << indent() << "return " << error_ret << ";" << endl;
    indent_down();
    out << indent() << "xfer += ret;" << endl;
  } else if (ttype->is_set()) {
    t_type* telem = ((t_set*)ttype)->get_elem_type();
    string telem_name = type_name(telem);
    string telem_ptr = telem->is_string() || !telem->is_base_type() ? "" : "*";
    out << indent() << "GList *key_list = NULL, *iter = NULL;" << endl
        << indent() << telem_name << telem_ptr << "* keys;" << endl
        << indent() << "int i = 0, key_count;" << endl
        << indent() << telem_name << telem_ptr << " elem;" << endl
        << indent() << "gpointer value;" << endl
        << indent() << "THRIFT_UNUSED_VAR (value);" << endl
        << endl
        << indent() << "if ((ret = thrift_protocol_write_set_begin (protocol, "
        << type_to_enum(telem) << ", " << prefix << " ? "
        << "(gint32) g_hash_table_size ((GHashTable *) " << prefix << ") : 0"
        << ", error)) < 0)" << endl;
    indent_up();
    out << indent() << "return " << error_ret << ";" << endl;
    indent_down();
    out << indent() << "xfer += ret;" << endl
        << indent() << "if (" << prefix << ")" << endl
        << indent() << "  g_hash_table_foreach ((GHashTable *) " << prefix
        << ", thrift_hash_table_get_keys, &key_list);" << endl
        << indent() << "key_count = g_list_length (key_list);" << endl
        << indent() << "keys = g_newa (" << telem_name << telem_ptr
        << ", key_count);" << endl
        << indent() << "for (iter = g_list_first (key_list); iter; "
           "iter = iter->next)" << endl;
    indent_up();
    out << indent() << "keys[i++] = (" << telem_name << telem_ptr
        << ") iter->data;" << endl;
    indent_down();
    out << indent() << "g_list_free (key_list);" << endl
        << endl
        << indent() << "for (i = 0; i < key_count; ++i)" << endl;
    scope_up(out);
    out << indent() << "elem = keys[i];" << endl
        << indent() << "value = (gpointer) g_hash_table_lookup "
           "(((GHashTable *) " << prefix << "), (gpointer) elem);" << endl
        << endl;
    generate_serialize_set_element(out,
                                   (t_set*)ttype,
                                   telem_ptr + "elem",
                                   error_ret);
    scope_down(out);
    out << indent() << "if ((ret = thrift_protocol_write_set_end (protocol, "
           "error)) < 0)" << endl;
    indent_up();
    out << indent() << "return " << error_ret << ";" << endl;
    indent_down();
    out << indent() << "xfer += ret;" << endl;
  } else if (ttype->is_list()) {
    string length = "(" + prefix + " ? " + prefix + "->len : 0)";
    string i = tmp("i");
    out << indent() << "guint " << i << ";" << endl
        << endl
        << indent() << "if ((ret = thrift_protocol_write_list_begin (protocol, "
        << type_to_enum(((t_list*)ttype)->get_elem_type()) << ", (gint32) "
        << length << ", error)) < 0)" << endl;
    indent_up();
    out << indent() << "return " << error_ret << ";" << endl;
    indent_down();
    out << indent() << "xfer += ret;" << endl
        << indent() << "for (" << i << " = 0; " << i << " < " << length << "; "
        << i << "++)" << endl;
    scope_up(out);
    generate_serialize_list_element(out, (t_list*)ttype, prefix, i, error_ret);
    scope_down(out);
    out << indent() << "if ((ret = thrift_protocol_write_list_end (protocol, "
           "error)) < 0)" << endl;
    indent_up();
    out << indent() << "return " << error_ret << ";" << endl;
    indent_down();
    out << indent() << "xfer += ret;" << endl;
  }

  scope_down(out);
}

void t_c_glib_generator::generate_serialize_map_element(ofstream& out,
                                                        t_map* tmap,
                                                        string key,
                                                        string value,
                                                        int error_ret) {
  t_field kfield(tmap->get_key_type(), key);
  generate_serialize_field(out, &kfield, "", "", error_ret);

  t_field vfield(tmap->get_val_type(), value);
  generate_serialize_field(out, &vfield, "", "", error_ret);
}

void t_c_glib_generator::generate_serialize_set_element(ofstream& out,
                                                        t_set* tset,
                                                        string element,
                                                        int error_ret) {
  t_field efield(tset->get_elem_type(), element);
  generate_serialize_field(out, &efield, "", "", error_ret);
}

void t_c_glib_generator::generate_serialize_list_element(ofstream& out,
                                                         t_list* tlist,
                                                         string list,
                                                         string index,
                                                         int error_ret) {
  t_type* ttype = get_true_type(tlist->get_elem_type());

  // cast to non-const
  string cast = "";
  string name = "g_ptr_array_index ((GPtrArray *) " + list + ", " + index + ")";

  if (ttype->is_void()) {
    throw std::runtime_error("compiler error: list element type cannot be void");
  } else if (is_numeric(ttype)) {
    name = "g_array_index (" + list + ", " + base_type_name(ttype) + ", " + index + ")";
  } else if (ttype->is_string()) {
    cast = "(gchar*)";
  } else if (ttype->is_map() || ttype->is_set()) {
    cast = "(GHashTable*)";
  } else if (ttype->is_list()) {
    t_type* etype = ((t_list*)ttype)->get_elem_type();
    if (etype->is_void()) {
      throw std::runtime_error("compiler error: list element type cannot be void");
    }
    cast = is_numeric(etype) ? "(GArray*)" : "(GPtrArray*)";
  }

  t_field efield(ttype, "(" + cast + name + ")");
  generate_serialize_field(out, &efield, "", "", error_ret);
}

/* deserializes a field of any type. */
void t_c_glib_generator::generate_deserialize_field(ofstream& out,
                                                    t_field* tfield,
                                                    string prefix,
                                                    string suffix,
                                                    int error_ret,
                                                    bool allocate) {
  t_type* type = get_true_type(tfield->get_type());

  if (type->is_void()) {
    throw std::runtime_error("CANNOT GENERATE DESERIALIZE CODE FOR void TYPE: " + prefix
                             + tfield->get_name());
  }

  string name = prefix + tfield->get_name() + suffix;

  if (type->is_struct() || type->is_xception()) {
    generate_deserialize_struct(out, (t_struct*)type, name, error_ret, allocate);
  } else if (type->is_container()) {
    generate_deserialize_container(out, type, name, error_ret);
  } else if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    if (tbase == t_base_type::TYPE_STRING) {
      indent(out) << "if (" << name << " != NULL)" << endl << indent() << "{" << endl;
      indent_up();
      indent(out) << "g_free(" << name << ");" << endl << indent() << name << " = NULL;" << endl;
      indent_down();
      indent(out) << "}" << endl << endl;
    }
    indent(out) << "if ((ret = thrift_protocol_read_";

    switch (tbase) {
    case t_base_type::TYPE_VOID:
      throw "compiler error: cannot serialize void field in a struct: " + name;
      break;
    case t_base_type::TYPE_STRING:
      if (((t_base_type*)type)->is_binary()) {
        out << "binary (protocol, &data, &len";
      } else {
        out << "string (protocol, &" << name;
      }
      break;
    case t_base_type::TYPE_BOOL:
      out << "bool (protocol, &" << name;
      break;
    case t_base_type::TYPE_I8:
      out << "byte (protocol, &" << name;
      break;
    case t_base_type::TYPE_I16:
      out << "i16 (protocol, &" << name;
      break;
    case t_base_type::TYPE_I32:
      out << "i32 (protocol, &" << name;
      break;
    case t_base_type::TYPE_I64:
      out << "i64 (protocol, &" << name;
      break;
    case t_base_type::TYPE_DOUBLE:
      out << "double (protocol, &" << name;
      break;
    default:
      throw "compiler error: no C reader for base type " + t_base_type::t_base_name(tbase) + name;
    }
    out << ", error)) < 0)" << endl;
    out << indent() << "  return " << error_ret << ";" << endl << indent() << "xfer += ret;"
        << endl;

    // load the byte array with the data
    if (tbase == t_base_type::TYPE_STRING && ((t_base_type*)type)->is_binary()) {
      indent(out) << name << " = g_byte_array_new();" << endl;
      indent(out) << "g_byte_array_append (" << name << ", (guint8 *) data, (guint) len);" << endl;
      indent(out) << "g_free (data);" << endl;
    }
  } else if (type->is_enum()) {
    string t = tmp("ecast");
    out << indent() << "gint32 " << t << ";" << endl << indent()
        << "if ((ret = thrift_protocol_read_i32 (protocol, &" << t << ", error)) < 0)" << endl
        << indent() << "  return " << error_ret << ";" << endl << indent() << "xfer += ret;" << endl
        << indent() << name << " = (" << type_name(type) << ")" << t << ";" << endl;
  } else {
    throw std::logic_error("DO NOT KNOW HOW TO SERIALIZE FIELD '" + tfield->get_name() + "' TYPE '"
                           + type_name(type));
  }

  // if the type is not required and this is a thrift struct (no prefix),
  // set the isset variable.  if the type is required, then set the
  // local variable indicating the value was set, so that we can do    // validation later.
  if (tfield->get_req() != t_field::T_REQUIRED && prefix != "") {
    indent(out) << prefix << "__isset_" << tfield->get_name() << suffix << " = TRUE;" << endl;
  } else if (tfield->get_req() == t_field::T_REQUIRED && prefix != "") {
    indent(out) << "isset_" << tfield->get_name() << " = TRUE;" << endl;
  }
}

void t_c_glib_generator::generate_deserialize_struct(ofstream& out,
                                                     t_struct* tstruct,
                                                     string prefix,
                                                     int error_ret,
                                                     bool allocate) {
  string name_uc = to_upper_case(initial_caps_to_underscores(tstruct->get_name()));
  if (tstruct->is_xception()) {
    out << indent() << "/* This struct is an exception */" << endl;
    allocate = true;
  }

  if (allocate) {
    out << indent() << "if ( " << prefix << " != NULL)" << endl << indent() << "{" << endl;
    indent_up();
    out << indent() << "g_object_unref (" << prefix << ");" << endl;
    indent_down();
    out << indent() << "}" << endl << indent() << prefix << " = g_object_new (" << this->nspace_uc
        << "TYPE_" << name_uc << ", NULL);" << endl;
  }
  out << indent() << "if ((ret = thrift_struct_read (THRIFT_STRUCT (" << prefix
      << "), protocol, error)) < 0)" << endl << indent() << "{" << endl;
  indent_up();
  if (allocate) {
    indent(out) << "g_object_unref (" << prefix << ");" << endl;
    if (tstruct->is_xception()) {
      indent(out) << prefix << " = NULL;" << endl;
    }
  }
  out << indent() << "return " << error_ret << ";" << endl;
  indent_down();
  out << indent() << "}" << endl << indent() << "xfer += ret;" << endl;
}

void t_c_glib_generator::generate_deserialize_container(ofstream& out,
                                                        t_type* ttype,
                                                        string prefix,
                                                        int error_ret) {
  scope_up(out);

  if (ttype->is_map()) {
    out << indent() << "guint32 size;" << endl
        << indent() << "guint32 i;" << endl
        << indent() << "ThriftType key_type;" << endl
        << indent() << "ThriftType value_type;" << endl
        << endl
        << indent() << "/* read the map begin marker */" << endl
        << indent() << "if ((ret = thrift_protocol_read_map_begin (protocol, "
           "&key_type, &value_type, &size, error)) < 0)" << endl;
    indent_up();
    out << indent() << "return " << error_ret << ";" << endl;
    indent_down();
    out << indent() << "xfer += ret;" << endl
        << endl;

    // iterate over map elements
    out << indent() << "/* iterate through each of the map's fields */" << endl
        << indent() << "for (i = 0; i < size; i++)" << endl;
    scope_up(out);
    generate_deserialize_map_element(out, (t_map*)ttype, prefix, error_ret);
    scope_down(out);
    out << endl;

    // read map end
    out << indent() << "/* read the map end marker */" << endl
        << indent() << "if ((ret = thrift_protocol_read_map_end (protocol, "
           "error)) < 0)" << endl;
    indent_up();
    out << indent() << "return " << error_ret << ";" << endl;
    indent_down();
    out << indent() << "xfer += ret;" << endl;
  } else if (ttype->is_set()) {
    out << indent() << "guint32 size;" << endl
        << indent() << "guint32 i;" << endl
        << indent() << "ThriftType element_type;" << endl
        << endl
        << indent() << "if ((ret = thrift_protocol_read_set_begin (protocol, "
           "&element_type, &size, error)) < 0)" << endl;
    indent_up();
    out << indent() << "return " << error_ret << ";" << endl;
    indent_down();
    out << indent() << "xfer += ret;" << endl
        << endl;

    // iterate over the elements
    out << indent() << "/* iterate through the set elements */" << endl
        << indent() << "for (i = 0; i < size; ++i)" << endl;
    scope_up(out);
    generate_deserialize_set_element(out, (t_set*)ttype, prefix, error_ret);
    scope_down(out);

    // read set end
    out << indent() << "if ((ret = thrift_protocol_read_set_end (protocol, "
           "error)) < 0)" << endl;
    indent_up();
    out << indent() << "return " << error_ret << ";" << endl;
    indent_down();
    out << indent() << "xfer += ret;" << endl
        << endl;
  } else if (ttype->is_list()) {
    out << indent() << "guint32 size;" << endl
        << indent() << "guint32 i;" << endl
        << indent() << "ThriftType element_type;" << endl
        << endl
        << indent() << "if ((ret = thrift_protocol_read_list_begin (protocol, "
           "&element_type,&size, error)) < 0)" << endl;
    indent_up();
    out << indent() << "return " << error_ret << ";" << endl;
    indent_down();
    out << indent() << "xfer += ret;" << endl
        << endl;

    // iterate over the elements
    out << indent() << "/* iterate through list elements */" << endl
        << indent() << "for (i = 0; i < size; i++)" << endl;
    scope_up(out);
    generate_deserialize_list_element(out,
                                      (t_list*)ttype,
                                      prefix,
                                      "i",
                                      error_ret);
    scope_down(out);

    // read list end
    out << indent() << "if ((ret = thrift_protocol_read_list_end (protocol, "
           "error)) < 0)" << endl;
    indent_up();
    out << indent() << "return " << error_ret << ";" << endl;
    indent_down();
    out << indent() << "xfer += ret;" << endl;
  }

  scope_down(out);
}

void t_c_glib_generator::declare_local_variable(ofstream& out, t_type* ttype, string& name, bool for_hash_table) {
  string tname = type_name(ttype);

  /* If the given type is a typedef, find its underlying type so we
     can correctly determine how to generate a pointer to it */
  ttype = get_true_type(ttype);
  string ptr = !is_numeric(ttype) ? "" : "*";

  if (ttype->is_map()) {
    t_map* tmap = (t_map*)ttype;
    out << indent() << tname << ptr << " " << name << " = "
        << generate_new_hash_from_type(tmap->get_key_type(), tmap->get_val_type()) << endl;
  } else if (ttype->is_list()) {
    t_list* tlist = (t_list*)ttype;
    out << indent() << tname << ptr << " " << name << " = "
        << generate_new_array_from_type(tlist->get_elem_type()) << endl;
  } else if (for_hash_table && ttype->is_enum()) {
    out << indent() << tname << " " << name << ";" << endl;
  } else {
    out << indent() << tname << ptr << " " << name
        << (ptr != "" ? " = g_new (" + tname + ", 1)" : " = NULL") << ";" << endl;
  }
}

void t_c_glib_generator::declore_local_variable_for_write(ofstream& out,
                                                          t_type* ttype,
                                                          string& name) {
  string tname = type_name(ttype);
  ttype = get_true_type(ttype);
  string ptr = ttype->is_string() || !ttype->is_base_type() ? " " : "* ";
  string init_val = ttype->is_enum() ? "" : " = NULL";
  out << indent() << tname << ptr << name << init_val << ";" << endl;
}

void t_c_glib_generator::generate_deserialize_map_element(ofstream& out,
                                                          t_map* tmap,
                                                          string prefix,
                                                          int error_ret) {
  t_type* tkey = tmap->get_key_type();
  t_type* tval = tmap->get_val_type();
  string keyname = tmp("key");
  string valname = tmp("val");

  declare_local_variable(out, tkey, keyname, true);
  declare_local_variable(out, tval, valname, true);

  /* If either the key or value type is a typedef, find its underlying
     type so we can correctly determine how to generate a pointer to
     it */
  tkey = get_true_type(tkey);
  tval = get_true_type(tval);

  string tkey_ptr = tkey->is_string() || !tkey->is_base_type() ? "" : "*";
  string tval_ptr = tval->is_string() || !tval->is_base_type() ? "" : "*";

  // deserialize the fields of the map element
  t_field fkey(tkey, tkey_ptr + keyname);
  generate_deserialize_field(out, &fkey, "", "", error_ret);
  t_field fval(tval, tval_ptr + valname);
  generate_deserialize_field(out, &fval, "", "", error_ret);

  indent(out) << "if (" << prefix << " && " << keyname << ")" << endl;
  indent_up();
  indent(out) << "g_hash_table_insert ((GHashTable *)" << prefix << ", (gpointer) " << keyname
              << ", (gpointer) " << valname << ");" << endl;
  indent_down();
}

void t_c_glib_generator::generate_deserialize_set_element(ofstream& out,
                                                          t_set* tset,
                                                          string prefix,
                                                          int error_ret) {
  t_type* telem = tset->get_elem_type();
  string elem = tmp("_elem");
  string telem_ptr = telem->is_string() || !telem->is_base_type() ? "" : "*";

  declare_local_variable(out, telem, elem, true);

  t_field felem(telem, telem_ptr + elem);
  generate_deserialize_field(out, &felem, "", "", error_ret);

  indent(out) << "if (" << prefix << " && " << elem << ")" << endl;
  indent_up();
  indent(out) << "g_hash_table_insert ((GHashTable *) " << prefix << ", (gpointer) " << elem
              << ", (gpointer) " << elem << ");" << endl;
  indent_down();
}

void t_c_glib_generator::generate_deserialize_list_element(ofstream& out,
                                                           t_list* tlist,
                                                           string prefix,
                                                           string index,
                                                           int error_ret) {
  (void)index;
  t_type* ttype = get_true_type(tlist->get_elem_type());
  string elem = tmp("_elem");
  string telem_ptr = !is_numeric(ttype) ? "" : "*";

  declare_local_variable(out, ttype, elem, false);

  t_field felem(ttype, telem_ptr + elem);
  generate_deserialize_field(out, &felem, "", "", error_ret);

  if (ttype->is_void()) {
    throw std::runtime_error("compiler error: list element type cannot be void");
  } else if (is_numeric(ttype)) {
    indent(out) << "g_array_append_vals (" << prefix << ", " << elem << ", 1);" << endl;
  } else {
    indent(out) << "g_ptr_array_add (" << prefix << ", " << elem << ");" << endl;
  }
}

string t_c_glib_generator::generate_free_func_from_type(t_type* ttype) {
  if (ttype == NULL)
    return "NULL";

  if (ttype->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)ttype)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_VOID:
      throw "compiler error: cannot determine hash type";
      break;
    case t_base_type::TYPE_BOOL:
    case t_base_type::TYPE_I8:
    case t_base_type::TYPE_I16:
    case t_base_type::TYPE_I32:
    case t_base_type::TYPE_I64:
    case t_base_type::TYPE_DOUBLE:
      return "g_free";
    case t_base_type::TYPE_STRING:
      if (((t_base_type*)ttype)->is_binary()) {
        return "thrift_string_free";
      }
      return "g_free";
    default:
      throw "compiler error: no hash table info for type";
    }
  } else if (ttype->is_enum()) {
    return "NULL";
  } else if (ttype->is_map() || ttype->is_set()) {
    return "(GDestroyNotify) thrift_safe_hash_table_destroy";
  } else if (ttype->is_struct()) {
    return "g_object_unref";
  } else if (ttype->is_list()) {
    t_type* etype = ((t_list*)ttype)->get_elem_type();
    if (etype->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)etype)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        throw "compiler error: cannot determine array type";
        break;
      case t_base_type::TYPE_BOOL:
      case t_base_type::TYPE_I8:
      case t_base_type::TYPE_I16:
      case t_base_type::TYPE_I32:
      case t_base_type::TYPE_I64:
      case t_base_type::TYPE_DOUBLE:
        return "(GDestroyNotify) g_array_unref";
      case t_base_type::TYPE_STRING:
        return "(GDestroyNotify) g_ptr_array_unref";
      default:
        throw "compiler error: no array info for type";
      }
    } else if (etype->is_container() || etype->is_struct()) {
      return "(GDestroyNotify) g_ptr_array_unref";
      ;
    } else if (etype->is_enum()) {
      return "(GDestroyNotify) g_array_unref";
    }
    printf("Type not expected inside the array: %s\n", etype->get_name().c_str());
    throw "Type not expected inside array";
  } else if (ttype->is_typedef()) {
    return generate_free_func_from_type(((t_typedef*)ttype)->get_type());
  }
  printf("Type not expected: %s\n", ttype->get_name().c_str());
  throw "Type not expected";
}

string t_c_glib_generator::generate_hash_func_from_type(t_type* ttype) {
  if (ttype == NULL)
    return "NULL";

  if (ttype->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)ttype)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_VOID:
      throw "compiler error: cannot determine hash type";
      break;
    case t_base_type::TYPE_BOOL:
      return "thrift_boolean_hash";
    case t_base_type::TYPE_I8:
      return "thrift_int8_hash";
    case t_base_type::TYPE_I16:
      return "thrift_int16_hash";
    case t_base_type::TYPE_I32:
      return "g_int_hash";
    case t_base_type::TYPE_I64:
      return "g_int64_hash";
    case t_base_type::TYPE_DOUBLE:
      return "g_double_hash";
    case t_base_type::TYPE_STRING:
      return "g_str_hash";
    default:
      throw "compiler error: no hash table info for type";
    }
  } else if (ttype->is_enum()) {
    return "g_direct_hash";
  } else if (ttype->is_container() || ttype->is_struct()) {
    return "g_direct_hash";
  } else if (ttype->is_typedef()) {
    return generate_hash_func_from_type(((t_typedef*)ttype)->get_type());
  }
  printf("Type not expected: %s\n", ttype->get_name().c_str());
  throw "Type not expected";
}

string t_c_glib_generator::generate_cmp_func_from_type(t_type* ttype) {
  if (ttype == NULL)
    return "NULL";

  if (ttype->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)ttype)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_VOID:
      throw "compiler error: cannot determine hash type";
      break;
    case t_base_type::TYPE_BOOL:
      return "thrift_boolean_equal";
    case t_base_type::TYPE_I8:
      return "thrift_int8_equal";
    case t_base_type::TYPE_I16:
      return "thrift_int16_equal";
    case t_base_type::TYPE_I32:
      return "g_int_equal";
    case t_base_type::TYPE_I64:
      return "g_int64_equal";
    case t_base_type::TYPE_DOUBLE:
      return "g_double_equal";
    case t_base_type::TYPE_STRING:
      return "g_str_equal";
    default:
      throw "compiler error: no hash table info for type";
    }
  } else if (ttype->is_enum()) {
    return "g_direct_equal";
  } else if (ttype->is_container() || ttype->is_struct()) {
    return "g_direct_equal";
  } else if (ttype->is_typedef()) {
    return generate_cmp_func_from_type(((t_typedef*)ttype)->get_type());
  }
  printf("Type not expected: %s\n", ttype->get_name().c_str());
  throw "Type not expected";
}

string t_c_glib_generator::generate_new_hash_from_type(t_type* key, t_type* value) {
  string hash_func = generate_hash_func_from_type(key);
  string cmp_func = generate_cmp_func_from_type(key);
  string key_free_func = generate_free_func_from_type(key);
  string value_free_func = generate_free_func_from_type(value);

  return "g_hash_table_new_full (" + hash_func + ", " + cmp_func + ", " + key_free_func + ", "
         + value_free_func + ");";
}

string t_c_glib_generator::generate_new_array_from_type(t_type* ttype) {
  if (ttype->is_void()) {
    throw std::runtime_error("compiler error: cannot determine array type");
  } else if (is_numeric(ttype)) {
    return "g_array_new (0, 1, sizeof (" + base_type_name(ttype) + "));";
  } else {
    string free_func = generate_free_func_from_type(ttype);
    return "g_ptr_array_new_with_free_func (" + free_func + ");";
  }
}

/***************************************
 * UTILITY FUNCTIONS                   *
 ***************************************/

/**
 * Upper case a string.  Wraps boost's string utility.
 */
string to_upper_case(string name) {
  string s(name);
  std::transform(s.begin(), s.end(), s.begin(), ::toupper);
  return s;
  //  return boost::to_upper_copy (name);
}

/**
 * Lower case a string.  Wraps boost's string utility.
 */
string to_lower_case(string name) {
  string s(name);
  std::transform(s.begin(), s.end(), s.begin(), ::tolower);
  return s;
  //  return boost::to_lower_copy (name);
}

/**
 * Makes a string friendly to C code standards by lowercasing and adding
 * underscores, with the exception of the first character.  For example:
 *
 * Input: "ZomgCamelCase"
 * Output: "zomg_camel_case"
 */
string initial_caps_to_underscores(string name) {
  string ret;
  const char* tmp = name.c_str();
  int pos = 0;

  /* the first character isn't underscored if uppercase, just lowercased */
  ret += tolower(tmp[pos]);
  pos++;
  for (unsigned int i = pos; i < name.length(); i++) {
    char lc = tolower(tmp[i]);
    if (lc != tmp[i]) {
      ret += '_';
    }
    ret += lc;
  }

  return ret;
}

/**
 * Performs the reverse operation of initial_caps_to_underscores: The first
 * character of the string is made uppercase, along with each character that
 * follows an underscore (which is removed). Useful for converting Thrift
 * service-method names into GObject-style class names.
 *
 * Input: "zomg_camel_case"
 * Output: "ZomgCamelCase"
 */
string underscores_to_initial_caps(string name) {
  string ret;
  const char* tmp = name.c_str();
  bool uppercase_next = true;

  for (unsigned int i = 0; i < name.length(); i++) {
    char c = tmp[i];
    if (c == '_') {
      uppercase_next = true;
    } else {
      if (uppercase_next) {
        ret += toupper(c);
        uppercase_next = false;
      } else {
        ret += c;
      }
    }
  }

  return ret;
}

/* register this generator with the main program */
THRIFT_REGISTER_GENERATOR(c_glib, "C, using GLib", "")
