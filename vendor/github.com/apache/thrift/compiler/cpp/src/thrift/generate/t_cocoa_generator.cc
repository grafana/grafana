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
#include <sstream>
#include "thrift/platform.h"
#include "thrift/generate/t_oop_generator.h"

using std::map;
using std::ostream;
using std::ofstream;
using std::ostringstream;
using std::string;
using std::stringstream;
using std::vector;

static const string endl = "\n"; // avoid ostream << std::endl flushes

/**
 * Objective-C code generator.
 *
 * mostly copy/pasting/tweaking from mcslee's work.
 */
class t_cocoa_generator : public t_oop_generator {
public:
  t_cocoa_generator(t_program* program,
                    const std::map<std::string, std::string>& parsed_options,
                    const std::string& option_string)
    : t_oop_generator(program) {
    (void)option_string;
    std::map<std::string, std::string>::const_iterator iter;

    log_unexpected_ = false;
    validate_required_ = false;
    async_clients_ = false;
    promise_kit_ = false;
    debug_descriptions_ = false;
    pods_ = false;
    for( iter = parsed_options.begin(); iter != parsed_options.end(); ++iter) {
      if( iter->first.compare("log_unexpected") == 0) {
        log_unexpected_ = true;
      } else if( iter->first.compare("validate_required") == 0) {
        validate_required_ = true;
      } else if( iter->first.compare("async_clients") == 0) {
        async_clients_ = true;
      } else if( iter->first.compare("promise_kit") == 0) {
        promise_kit_ = true;
      } else if( iter->first.compare("debug_descriptions") == 0) {
        debug_descriptions_ = true;
      } else if( iter->first.compare("pods") == 0) {
        pods_ = true;
      } else {
        throw "unknown option cocoa:" + iter->first;
      }
    }

    out_dir_base_ = "gen-cocoa";
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
  void generate_xception(t_struct* txception);
  void generate_service(t_service* tservice);

  void print_const_value(ostream& out,
                         string name,
                         t_type* type,
                         t_const_value* value,
                         bool defval = false);
  std::string render_const_value(ostream& out,
                                 t_type* type,
                                 t_const_value* value,
                                 bool box_it = false);

  void generate_cocoa_struct(t_struct* tstruct, bool is_exception);
  void generate_cocoa_struct_interface(std::ofstream& out,
                                       t_struct* tstruct,
                                       bool is_xception = false);
  void generate_cocoa_struct_implementation(std::ofstream& out,
                                            t_struct* tstruct,
                                            bool is_xception = false,
                                            bool is_result = false);
  void generate_cocoa_struct_initializer_signature(std::ofstream& out, t_struct* tstruct);
  void generate_cocoa_struct_init_with_coder_method(ofstream& out,
                                                    t_struct* tstruct,
                                                    bool is_exception);
  void generate_cocoa_struct_encode_with_coder_method(ofstream& out,
                                                      t_struct* tstruct,
                                                      bool is_exception);
  void generate_cocoa_struct_copy_method(ofstream& out,
                                         t_struct* tstruct,
                                         bool is_exception);
  void generate_cocoa_struct_hash_method(ofstream& out, t_struct* tstruct);
  void generate_cocoa_struct_is_equal_method(ofstream& out,
                                             t_struct* tstruct,
                                             bool is_exception);
  void generate_cocoa_struct_field_accessor_implementations(std::ofstream& out,
                                                            t_struct* tstruct,
                                                            bool is_exception);
  void generate_cocoa_struct_reader(std::ofstream& out, t_struct* tstruct);
  void generate_cocoa_struct_result_writer(std::ofstream& out, t_struct* tstruct);
  void generate_cocoa_struct_writer(std::ofstream& out, t_struct* tstruct);
  void generate_cocoa_struct_validator(std::ofstream& out, t_struct* tstruct);
  void generate_cocoa_struct_description(std::ofstream& out, t_struct* tstruct);

  std::string function_result_helper_struct_type(t_service *tservice, t_function* tfunction);
  std::string function_args_helper_struct_type(t_service* tservice, t_function* tfunction);
  void generate_function_helpers(t_service *tservice, t_function* tfunction);

  /**
   * Service-level generation functions
   */

  void generate_cocoa_service_protocol(std::ofstream& out, t_service* tservice);
  void generate_cocoa_service_async_protocol(std::ofstream& out, t_service* tservice);

  void generate_cocoa_service_client_interface(std::ofstream& out, t_service* tservice);
  void generate_cocoa_service_client_async_interface(std::ofstream& out, t_service* tservice);

  void generate_cocoa_service_client_send_function_implementation(ofstream& out,
                                                                  t_service* tservice,
                                                                  t_function* tfunction,
                                                                  bool needs_protocol);
  void generate_cocoa_service_client_send_function_invocation(ofstream& out, t_function* tfunction);
  void generate_cocoa_service_client_send_async_function_invocation(ofstream& out,
                                                                    t_function* tfunction,
                                                                    string failureBlockName);
  void generate_cocoa_service_client_recv_function_implementation(ofstream& out,
                                                                  t_service* tservice,
                                                                  t_function* tfunction,
                                                                  bool needs_protocol);
  void generate_cocoa_service_client_implementation(std::ofstream& out, t_service* tservice);
  void generate_cocoa_service_client_async_implementation(std::ofstream& out, t_service* tservice);

  void generate_cocoa_service_server_interface(std::ofstream& out, t_service* tservice);
  void generate_cocoa_service_server_implementation(std::ofstream& out, t_service* tservice);
  void generate_cocoa_service_helpers(t_service* tservice);
  void generate_service_client(t_service* tservice);
  void generate_service_server(t_service* tservice);
  void generate_process_function(t_service* tservice, t_function* tfunction);

  /**
   * Serialization constructs
   */

  void generate_deserialize_field(std::ofstream& out, t_field* tfield, std::string fieldName);

  void generate_deserialize_struct(std::ofstream& out, t_struct* tstruct, std::string prefix = "");

  void generate_deserialize_container(std::ofstream& out, t_type* ttype, std::string prefix = "");

  void generate_deserialize_set_element(std::ofstream& out, t_set* tset, std::string prefix = "");

  void generate_deserialize_map_element(std::ofstream& out, t_map* tmap, std::string prefix = "");

  void generate_deserialize_list_element(std::ofstream& out,
                                         t_list* tlist,
                                         std::string prefix = "");

  void generate_serialize_field(std::ofstream& out, t_field* tfield, std::string prefix = "");

  void generate_serialize_struct(std::ofstream& out, t_struct* tstruct, std::string fieldName = "");

  void generate_serialize_container(std::ofstream& out, t_type* ttype, std::string prefix = "");

  void generate_serialize_map_element(std::ofstream& out,
                                      t_map* tmap,
                                      std::string iter,
                                      std::string map);

  void generate_serialize_set_element(std::ofstream& out, t_set* tmap, std::string iter);

  void generate_serialize_list_element(std::ofstream& out,
                                       t_list* tlist,
                                       std::string index,
                                       std::string listName);

  /**
   * Helper rendering functions
   */

  std::string cocoa_prefix();
  std::string cocoa_imports();
  std::string cocoa_thrift_imports();
  std::string type_name(t_type* ttype, bool class_ref = false, bool needs_mutable = false);
  std::string element_type_name(t_type* ttype);
  std::string base_type_name(t_base_type* tbase);
  std::string declare_property(t_field* tfield);
  std::string declare_property_isset(t_field* tfield);
  std::string declare_property_unset(t_field* tfield);
  std::string invalid_return_statement(t_function* tfunction);
  std::string function_signature(t_function* tfunction, bool include_error);
  std::string async_function_signature(t_function* tfunction, bool include_error);
  std::string promise_function_signature(t_function* tfunction);
  std::string argument_list(t_struct* tstruct, string protocol_name, bool include_error);
  std::string type_to_enum(t_type* ttype);
  std::string format_string_for_type(t_type* type);
  std::string format_cast_for_type(t_type* type);
  std::string call_field_setter(t_field* tfield, std::string fieldName);
  std::string box(t_type *ttype, std::string field_name);
  std::string unbox(t_type* ttype, std::string field_name);
  std::string getter_name(string field_name);
  std::string setter_name(string field_name);

  bool type_can_be_null(t_type* ttype) {
    ttype = get_true_type(ttype);

    return ttype->is_container() || ttype->is_struct() || ttype->is_xception()
           || ttype->is_string();
  }

private:
  std::string cocoa_prefix_;
  std::string constants_declarations_;
  int error_constant_;

  /**
   * File streams
   */

  std::ofstream f_header_;
  std::ofstream f_impl_;

  bool log_unexpected_;
  bool validate_required_;
  bool async_clients_;
  bool promise_kit_;
  bool debug_descriptions_;
  bool pods_;
};

/**
 * Prepares for file generation by opening up the necessary file output
 * streams.
 */
void t_cocoa_generator::init_generator() {
  // Make output directory
  MKDIR(get_out_dir().c_str());
  cocoa_prefix_ = program_->get_namespace("cocoa");

  // we have a .h header file...
  string f_header_name = cocoa_prefix_ + capitalize(program_name_) + ".h";
  string f_header_fullname = get_out_dir() + f_header_name;
  f_header_.open(f_header_fullname.c_str());

  f_header_ << autogen_comment() << endl;

  f_header_ << cocoa_imports() << cocoa_thrift_imports();

  // ...and a .m implementation file
  string f_impl_name = cocoa_prefix_ + capitalize(program_name_) + ".m";
  string f_impl_fullname = get_out_dir() + f_impl_name;
  f_impl_.open(f_impl_fullname.c_str());

  f_impl_ << autogen_comment() << endl;

  f_impl_ << cocoa_imports() << cocoa_thrift_imports() << "#import \"" << f_header_name << "\""
          << endl << endl;

  error_constant_ = 60000;
}

/**
 * Prints standard Cocoa imports
 *
 * @return List of imports for Cocoa libraries
 */
string t_cocoa_generator::cocoa_imports() {
  return string() + "#import <Foundation/Foundation.h>\n" + "\n";
}

/**
 * Prints thrift runtime imports
 *
 * @return List of imports necessary for thrift runtime
 */
string t_cocoa_generator::cocoa_thrift_imports() {

  vector<string> includes_list;
  includes_list.push_back("TProtocol.h");
  includes_list.push_back("TProtocolFactory.h");
  includes_list.push_back("TApplicationError.h");
  includes_list.push_back("TProtocolError.h");
  includes_list.push_back("TProtocolUtil.h");
  includes_list.push_back("TProcessor.h");
  includes_list.push_back("TBase.h");
  includes_list.push_back("TAsyncTransport.h");
  includes_list.push_back("TBaseClient.h");

  std::ostringstream includes;

  vector<string>::const_iterator i_iter;
  for (i_iter=includes_list.begin(); i_iter!=includes_list.end(); ++i_iter) {
    includes << "#import ";
    if (pods_) {
      includes << "<Thrift/" << *i_iter << ">";
    } else {
      includes << "\"" << *i_iter << "\"";
    }
    includes << endl;
  }

  includes << endl;

  if (promise_kit_) {
    includes << "#import ";
    if (pods_) {
      includes << "<PromiseKit/PromiseKit.h>";
    } else {
      includes << "\"PromiseKit.h\"";
    }
    includes << endl;
  }

  // Include other Thrift includes
  const vector<t_program*>& other_includes = program_->get_includes();
  for (size_t i = 0; i < other_includes.size(); ++i) {
    includes << "#import \""
             << other_includes[i]->get_namespace("cocoa")
             << capitalize(other_includes[i]->get_name())
             << ".h\"" << endl;
  }

  includes << endl;

  return includes.str();
}

/**
 * Finish up generation.
 */
void t_cocoa_generator::close_generator() {
  // stick our constants declarations at the end of the header file
  // since they refer to things we are defining.
  f_header_ << constants_declarations_ << endl;
}

/**
 * Generates a typedef. This is just a simple 1-liner in objective-c
 *
 * @param ttypedef The type definition
 */
void t_cocoa_generator::generate_typedef(t_typedef* ttypedef) {
  if (ttypedef->get_type()->is_map()) {
    t_map *map = (t_map *)ttypedef->get_type();
    if (map->get_key_type()->is_struct()) {
      f_header_ << indent() << "@class " << type_name(map->get_key_type(), true) << ";" << endl;
    }
    if (map->get_val_type()->is_struct()) {
      f_header_ << indent() << "@class " << type_name(map->get_val_type(), true) << ";" << endl;
    }
  }
  else if (ttypedef->get_type()->is_set()) {
    t_set *set = (t_set *)ttypedef->get_type();
    if (set->get_elem_type()->is_struct()) {
      f_header_ << indent() << "@class " << type_name(set->get_elem_type(), true) << ";" << endl;
    }
  }
  else if (ttypedef->get_type()->is_list()) {
    t_list *list = (t_list *)ttypedef->get_type();
    if (list->get_elem_type()->is_struct()) {
      f_header_ << indent() << "@class " << type_name(list->get_elem_type(), true) << ";" << endl;
    }
  }
  f_header_ << indent() << "typedef " << type_name(ttypedef->get_type()) << " " << cocoa_prefix_
            << ttypedef->get_symbolic() << ";" << endl << endl;
  if (ttypedef->get_type()->is_container()) {
    f_header_ << indent() << "typedef " << type_name(ttypedef->get_type(), false, true) << " " << cocoa_prefix_
              << "Mutable" << ttypedef->get_symbolic() << ";" << endl << endl;
  }
}

/**
 * Generates code for an enumerated type. In Objective-C, this is
 * essentially the same as the thrift definition itself, instead using
 * NS_ENUM keyword in Objective-C.  For namespace purposes, the name of
 * the enum is prefixed to each element in keeping with Cocoa & Swift
 * standards.
 *
 * @param tenum The enumeration
 */
void t_cocoa_generator::generate_enum(t_enum* tenum) {
  f_header_ << indent() << "typedef NS_ENUM(SInt32, " << cocoa_prefix_ << tenum->get_name() << ") {" << endl;
  indent_up();

  vector<t_enum_value*> constants = tenum->get_constants();
  vector<t_enum_value*>::iterator c_iter;
  bool first = true;
  for (c_iter = constants.begin(); c_iter != constants.end(); ++c_iter) {
    if (first) {
      first = false;
    } else {
      f_header_ << "," << endl;
    }
    f_header_ << indent() << cocoa_prefix_ << tenum->get_name() << (*c_iter)->get_name();
    f_header_ << " = " << (*c_iter)->get_value();
  }

  indent_down();
  f_header_ << endl << "};" << endl << endl;
}

/**
 * Generates a class that holds all the constants.
 */
void t_cocoa_generator::generate_consts(std::vector<t_const*> consts) {
  std::ostringstream const_interface;

  const_interface << "FOUNDATION_EXPORT NSString *" << cocoa_prefix_ << capitalize(program_name_) << "ErrorDomain;" << endl
                  << endl;


  bool needs_class = false;

  // Public constants for base types & strings
  vector<t_const*>::iterator c_iter;
  for (c_iter = consts.begin(); c_iter != consts.end(); ++c_iter) {
    t_type* type = (*c_iter)->get_type()->get_true_type();
    if (!type->is_container() && !type->is_struct()) {
      const_interface << "FOUNDATION_EXPORT " << type_name(type) << " "
                      << cocoa_prefix_ << capitalize((*c_iter)->get_name()) << ";" << endl;
    }
    else {
      needs_class = true;
    }
  }


  string constants_class_name = cocoa_prefix_ + capitalize(program_name_) + "Constants";

  if (needs_class) {

    const_interface << endl;

    const_interface << "@interface " << constants_class_name << " : NSObject ";
    scope_up(const_interface);
    scope_down(const_interface);

    // getter method for each constant defined.
    for (c_iter = consts.begin(); c_iter != consts.end(); ++c_iter) {
      string name = (*c_iter)->get_name();
      t_type* type = (*c_iter)->get_type()->get_true_type();
      if (type->is_container() || type->is_struct()) {
        t_type* type = (*c_iter)->get_type();
        const_interface << endl << "+ (" << type_name(type) << ") " << name << ";" << endl;
      }
    }

    const_interface << endl << "@end";
  }

  // this gets spit into the header file in ::close_generator
  constants_declarations_ = const_interface.str();

  f_impl_ << "NSString *" << cocoa_prefix_ << capitalize(program_name_) << "ErrorDomain = "
          << "@\"" << cocoa_prefix_ << capitalize(program_name_) << "ErrorDomain\";" << endl << endl;

  // variables in the .m hold all simple constant values
  for (c_iter = consts.begin(); c_iter != consts.end(); ++c_iter) {
    string name = (*c_iter)->get_name();
    t_type* type = (*c_iter)->get_type();
    f_impl_ << type_name(type) << " " << cocoa_prefix_ << name;
    t_type* ttype = type->get_true_type();
    if (!ttype->is_container() && !ttype->is_struct()) {
      f_impl_ << " = " << render_const_value(f_impl_, type, (*c_iter)->get_value());
    }
    f_impl_ << ";" << endl;
  }
  f_impl_ << endl;

  if (needs_class) {

    f_impl_ << "@implementation " << constants_class_name << endl << endl;

    // initialize complex constants when the class is loaded
    f_impl_ << "+ (void) initialize ";
    scope_up(f_impl_);

    for (c_iter = consts.begin(); c_iter != consts.end(); ++c_iter) {
      t_type* ttype = (*c_iter)->get_type()->get_true_type();
      if (ttype->is_container() || ttype->is_struct()) {
        f_impl_ << endl;
        print_const_value(f_impl_,
                          cocoa_prefix_ + (*c_iter)->get_name(),
                          (*c_iter)->get_type(),
                          (*c_iter)->get_value(),
                          false);
        f_impl_ << ";" << endl;
      }
    }
    scope_down(f_impl_);

    // getter method for each constant
    for (c_iter = consts.begin(); c_iter != consts.end(); ++c_iter) {
      string name = (*c_iter)->get_name();
      t_type* type = (*c_iter)->get_type()->get_true_type();
      if (type->is_container() || type->is_struct()) {
        f_impl_ << endl << "+ (" << type_name(type) << ") " << name << " ";
        scope_up(f_impl_);
        indent(f_impl_) << "return " << cocoa_prefix_ << name << ";" << endl;
        scope_down(f_impl_);
      }
    }

    f_impl_ << "@end" << endl << endl;
  }
}

/**
 * Generates a struct definition for a thrift data type. This is a class
 * with protected data members, read(), write(), and getters and setters.
 *
 * @param tstruct The struct definition
 */
void t_cocoa_generator::generate_struct(t_struct* tstruct) {
  generate_cocoa_struct_interface(f_header_, tstruct, false);
  generate_cocoa_struct_implementation(f_impl_, tstruct, false);
}

/**
 * Exceptions are structs, but they inherit from NSException
 *
 * @param tstruct The struct definition
 */
void t_cocoa_generator::generate_xception(t_struct* txception) {
  generate_cocoa_struct_interface(f_header_, txception, true);
  generate_cocoa_struct_implementation(f_impl_, txception, true);
}

/**
 * Generate the interface for a struct
 *
 * @param tstruct The struct definition
 */
void t_cocoa_generator::generate_cocoa_struct_interface(ofstream& out,
                                                        t_struct* tstruct,
                                                        bool is_exception) {

  if (is_exception) {
    out << "enum {" << endl
        << "  " << cocoa_prefix_ << capitalize(program_name_) << "Error" << tstruct->get_name() <<  " = -" << error_constant_++ << endl
        << "};" << endl
        << endl;
  }

  out << "@interface " << cocoa_prefix_ << tstruct->get_name() << " : ";

  if (is_exception) {
    out << "NSError ";
  } else {
    out << "NSObject ";
  }
  out << "<TBase, NSCoding, NSCopying> " << endl;

  out << endl;

  // properties
  const vector<t_field*>& members = tstruct->get_members();
  if (members.size() > 0) {
    vector<t_field*>::const_iterator m_iter;
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      out << indent() << declare_property(*m_iter) << endl;
      out << indent() << declare_property_isset(*m_iter) << endl;
      out << indent() << declare_property_unset(*m_iter) << endl;
      out << endl;
    }
  }

  out << endl;

  // initializer for all fields
  if (!members.empty()) {
    generate_cocoa_struct_initializer_signature(out, tstruct);
    out << ";" << endl;
  }
  out << endl;

  out << "@end" << endl << endl;
}

/**
 * Generate signature for initializer of struct with a parameter for
 * each field.
 */
void t_cocoa_generator::generate_cocoa_struct_initializer_signature(ofstream& out,
                                                                    t_struct* tstruct) {
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;
  indent(out) << "- (instancetype) initWith";
  for (m_iter = members.begin(); m_iter != members.end();) {
    if (m_iter == members.begin()) {
      out << capitalize((*m_iter)->get_name());
    } else {
      out << (*m_iter)->get_name();
    }
    out << ": (" << type_name((*m_iter)->get_type()) << ") " << (*m_iter)->get_name();
    ++m_iter;
    if (m_iter != members.end()) {
      out << " ";
    }
  }
}

/**
 * Generate the initWithCoder method for this struct so it's compatible with
 * the NSCoding protocol
 */
void t_cocoa_generator::generate_cocoa_struct_init_with_coder_method(ofstream& out,
                                                                     t_struct* tstruct,
                                                                     bool is_exception) {

  indent(out) << "- (instancetype) initWithCoder: (NSCoder *) decoder" << endl;
  scope_up(out);

  if (is_exception) {
    // NSExceptions conform to NSCoding, so we can call super
    indent(out) << "self = [super initWithCoder: decoder];" << endl;
  } else {
    indent(out) << "self = [super init];" << endl;
  }

  indent(out) << "if (self) ";
  scope_up(out);

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_type* t = get_true_type((*m_iter)->get_type());
    out << indent() << "if ([decoder containsValueForKey: @\"" << (*m_iter)->get_name() << "\"])"
        << endl;
    scope_up(out);
    out << indent() << "_" << (*m_iter)->get_name() << " = ";
    if (type_can_be_null(t)) {
      out << "[decoder decodeObjectForKey: @\"" << (*m_iter)->get_name() << "\"];"
          << endl;
    } else if (t->is_enum()) {
      out << "[decoder decodeIntForKey: @\"" << (*m_iter)->get_name() << "\"];" << endl;
    } else {
      t_base_type::t_base tbase = ((t_base_type*)t)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_BOOL:
        out << "[decoder decodeBoolForKey: @\"" << (*m_iter)->get_name() << "\"];" << endl;
        break;
      case t_base_type::TYPE_I8:
        out << "[decoder decodeIntForKey: @\"" << (*m_iter)->get_name() << "\"];" << endl;
        break;
      case t_base_type::TYPE_I16:
        out << "[decoder decodeIntForKey: @\"" << (*m_iter)->get_name() << "\"];" << endl;
        break;
      case t_base_type::TYPE_I32:
        out << "[decoder decodeInt32ForKey: @\"" << (*m_iter)->get_name() << "\"];" << endl;
        break;
      case t_base_type::TYPE_I64:
        out << "[decoder decodeInt64ForKey: @\"" << (*m_iter)->get_name() << "\"];" << endl;
        break;
      case t_base_type::TYPE_DOUBLE:
        out << "[decoder decodeDoubleForKey: @\"" << (*m_iter)->get_name() << "\"];" << endl;
        break;
      default:
        throw "compiler error: don't know how to decode thrift type: "
            + t_base_type::t_base_name(tbase);
      }
    }
    out << indent() << "_" << (*m_iter)->get_name() << "IsSet = YES;" << endl;
    scope_down(out);
  }

  scope_down(out);

  out << indent() << "return self;" << endl;
  scope_down(out);
  out << endl;
}

/**
 * Generate the encodeWithCoder method for this struct so it's compatible with
 * the NSCoding protocol
 */
void t_cocoa_generator::generate_cocoa_struct_encode_with_coder_method(ofstream& out,
                                                                       t_struct* tstruct,
                                                                       bool is_exception) {

  indent(out) << "- (void) encodeWithCoder: (NSCoder *) encoder" << endl;
  scope_up(out);

  if (is_exception) {
    // NSExceptions conform to NSCoding, so we can call super
    out << indent() << "[super encodeWithCoder: encoder];" << endl;
  }

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_type* t = get_true_type((*m_iter)->get_type());
    out << indent() << "if (_" << (*m_iter)->get_name() << "IsSet)" << endl;
    scope_up(out);
    if (type_can_be_null(t)) {
      out << indent() << "[encoder encodeObject: _" << (*m_iter)->get_name() << " forKey: @\""
          << (*m_iter)->get_name() << "\"];" << endl;
    } else if (t->is_enum()) {
      out << indent() << "[encoder encodeInt: _" << (*m_iter)->get_name() << " forKey: @\""
          << (*m_iter)->get_name() << "\"];" << endl;
    } else {
      t_base_type::t_base tbase = ((t_base_type*)t)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_BOOL:
        out << indent() << "[encoder encodeBool: _" << (*m_iter)->get_name() << " forKey: @\""
            << (*m_iter)->get_name() << "\"];" << endl;
        break;
      case t_base_type::TYPE_I8:
        out << indent() << "[encoder encodeInt: _" << (*m_iter)->get_name() << " forKey: @\""
            << (*m_iter)->get_name() << "\"];" << endl;
        break;
      case t_base_type::TYPE_I16:
        out << indent() << "[encoder encodeInt: _" << (*m_iter)->get_name() << " forKey: @\""
            << (*m_iter)->get_name() << "\"];" << endl;
        break;
      case t_base_type::TYPE_I32:
        out << indent() << "[encoder encodeInt32: _" << (*m_iter)->get_name() << " forKey: @\""
            << (*m_iter)->get_name() << "\"];" << endl;
        break;
      case t_base_type::TYPE_I64:
        out << indent() << "[encoder encodeInt64: _" << (*m_iter)->get_name() << " forKey: @\""
            << (*m_iter)->get_name() << "\"];" << endl;
        break;
      case t_base_type::TYPE_DOUBLE:
        out << indent() << "[encoder encodeDouble: _" << (*m_iter)->get_name() << " forKey: @\""
            << (*m_iter)->get_name() << "\"];" << endl;
        break;
      default:
        throw "compiler error: don't know how to encode thrift type: "
            + t_base_type::t_base_name(tbase);
      }
    }
    scope_down(out);
  }

  scope_down(out);
  out << endl;
}

/**
 * Generate the copy method for this struct
 */
void t_cocoa_generator::generate_cocoa_struct_copy_method(ofstream& out, t_struct* tstruct, bool is_exception) {
  out << indent() << "- (instancetype) copyWithZone:(NSZone *)zone" << endl;
  scope_up(out);

  if (is_exception) {
    out << indent() << type_name(tstruct) << " val = [" << cocoa_prefix_ << tstruct->get_name() << " errorWithDomain: self.domain code: self.code userInfo: self.userInfo];" << endl;
  } else {
    out << indent() << type_name(tstruct) << " val = [" << cocoa_prefix_ << tstruct->get_name() << " new];" << endl;
  }

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_type* t = get_true_type((*m_iter)->get_type());
    out << indent() << "if (_" << (*m_iter)->get_name() << "IsSet)" << endl;
    scope_up(out);
    if (type_can_be_null(t)) {
      out << indent() << "val." << (*m_iter)->get_name() << " = [self." << (*m_iter)->get_name() << " copy];";
    } else {
      out << indent() << "val." << (*m_iter)->get_name() << " = self." << (*m_iter)->get_name() << ";";
    }
    out << endl;
    scope_down(out);
  }

  out << indent() << "return val;" << endl;

  scope_down(out);
  out << endl;
}

/**
 * Generate the hash method for this struct
 */
void t_cocoa_generator::generate_cocoa_struct_hash_method(ofstream& out, t_struct* tstruct) {
  indent(out) << "- (NSUInteger) hash" << endl;
  scope_up(out);
  out << indent() << "NSUInteger hash = 17;" << endl;

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_type* t = get_true_type((*m_iter)->get_type());
    out << indent() << "hash = (hash * 31) ^ _" << (*m_iter)->get_name()
        << "IsSet ? 2654435761 : 0;" << endl;
    out << indent() << "if (_" << (*m_iter)->get_name() << "IsSet)" << endl;
    scope_up(out);
    if (type_can_be_null(t)) {
      out << indent() << "hash = (hash * 31) ^ [_" << (*m_iter)->get_name() << " hash];" << endl;
    } else {
      out << indent() << "hash = (hash * 31) ^ [@(_" << (*m_iter)->get_name() << ") hash];"
          << endl;
    }
    scope_down(out);
  }

  out << indent() << "return hash;" << endl;
  scope_down(out);
  out << endl;
}

/**
 * Generate the isEqual method for this struct
 */
void t_cocoa_generator::generate_cocoa_struct_is_equal_method(ofstream& out, t_struct* tstruct, bool is_exception) {
  indent(out) << "- (BOOL) isEqual: (id) anObject" << endl;
  scope_up(out);

  indent(out) << "if (self == anObject) {" << endl;
  indent_up();
  indent(out) << "return YES;" << endl;
  indent_down();
  indent(out) << "}" << endl;

  string class_name = cocoa_prefix_ + tstruct->get_name();

  if (is_exception) {
    indent(out) << "if (![super isEqual:anObject]) {" << endl;
    indent_up();
    indent(out) << "return NO;" << endl;
    indent_down();
    indent(out) << "}" << endl << endl;
  }
  else {
    indent(out) << "if (![anObject isKindOfClass:[" << class_name << " class]]) {" << endl;
    indent_up();
    indent(out) << "return NO;" << endl;
    indent_down();
    indent(out) << "}" << endl;
  }

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  if (!members.empty()) {
    indent(out) << class_name << " *other = (" << class_name << " *)anObject;" << endl;

    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      t_type* t = get_true_type((*m_iter)->get_type());
      string name = (*m_iter)->get_name();
      if (type_can_be_null(t)) {
        out << indent() << "if ((_" << name << "IsSet != other->_" << name << "IsSet) ||" << endl
            << indent() << "    "
            << "(_" << name << "IsSet && "
            << "((_" << name << " || other->_" << name << ") && "
            << "![_" << name << " isEqual:other->_" << name << "]))) {" << endl;
      } else {
        out << indent() << "if ((_" << name << "IsSet != other->_" << name << "IsSet) ||" << endl
            << indent() << "    "
            << "(_" << name << "IsSet && "
            << "(_" << name << " != other->_" << name << "))) {" << endl;
      }
      indent_up();
      indent(out) << "return NO;" << endl;
      indent_down();
      indent(out) << "}" << endl;
    }
  }

  out << indent() << "return YES;" << endl;
  scope_down(out);
  out << endl;
}

/**
 * Generate struct implementation.
 *
 * @param tstruct      The struct definition
 * @param is_exception Is this an exception?
 * @param is_result    If this is a result it needs a different writer
 */
void t_cocoa_generator::generate_cocoa_struct_implementation(ofstream& out,
                                                             t_struct* tstruct,
                                                             bool is_exception,
                                                             bool is_result) {
  indent(out) << "@implementation " << cocoa_prefix_ << tstruct->get_name() << endl << endl;

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  // exceptions need to call the designated initializer on NSException
  if (is_exception) {
    out << indent() << "- (instancetype) init" << endl;
    scope_up(out);
    out << indent() << "return [super initWithDomain: " << cocoa_prefix_ << capitalize(program_name_) << "ErrorDomain" << endl
        << indent() << "                        code: " << cocoa_prefix_ << capitalize(program_name_) << "Error" << tstruct->get_name() << endl
        << indent() << "                    userInfo: nil];" << endl;
    scope_down(out);
    out << endl;
  } else {
    // struct

    // default initializer
    // setup instance variables with default values
    indent(out) << "- (instancetype) init" << endl;
    scope_up(out);
    indent(out) << "self = [super init];" << endl;
    indent(out) << "if (self)";
    scope_up(out);
    if (members.size() > 0) {
      for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
        t_type* t = get_true_type((*m_iter)->get_type());
        if ((*m_iter)->get_value() != NULL) {
          print_const_value(out,
                            "self." + (*m_iter)->get_name(),
                            t,
                            (*m_iter)->get_value(),
                            false);
        }
      }
    }
    scope_down(out);
    indent(out) << "return self;" << endl;
    scope_down(out);
    out << endl;
  }

  // initializer with all fields as params
  if (!members.empty()) {
    generate_cocoa_struct_initializer_signature(out, tstruct);
    out << endl;
    scope_up(out);
    if (is_exception) {
      out << indent() << "self = [self init];" << endl;
    } else {
      out << indent() << "self = [super init];" << endl;
    }

    indent(out) << "if (self)";
    scope_up(out);
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      out << indent() << "_" << (*m_iter)->get_name() << " = ";
      if (get_true_type((*m_iter)->get_type())->is_container()) {
        out << "[" << (*m_iter)->get_name() << " mutableCopy];" << endl;
      } else {
        out << (*m_iter)->get_name() << ";" << endl;
      }
      out << indent() << "_" << (*m_iter)->get_name() << "IsSet = YES;" << endl;
    }
    scope_down(out);

    out << indent() << "return self;" << endl;
    scope_down(out);
    out << endl;
  }

  // initWithCoder for NSCoding
  generate_cocoa_struct_init_with_coder_method(out, tstruct, is_exception);
  // encodeWithCoder for NSCoding
  generate_cocoa_struct_encode_with_coder_method(out, tstruct, is_exception);
  // hash and isEqual for NSObject
  generate_cocoa_struct_hash_method(out, tstruct);
  generate_cocoa_struct_is_equal_method(out, tstruct, is_exception);
  // copy for NSObject
  generate_cocoa_struct_copy_method(out, tstruct, is_exception);

  // the rest of the methods
  generate_cocoa_struct_field_accessor_implementations(out, tstruct, is_exception);
  generate_cocoa_struct_reader(out, tstruct);
  if (is_result) {
    generate_cocoa_struct_result_writer(out, tstruct);
  } else {
    generate_cocoa_struct_writer(out, tstruct);
  }
  generate_cocoa_struct_validator(out, tstruct);
  generate_cocoa_struct_description(out, tstruct);

  out << "@end" << endl << endl;
}

/**
 * Generates a function to read all the fields of the struct.
 *
 * @param tstruct The struct definition
 */
void t_cocoa_generator::generate_cocoa_struct_reader(ofstream& out, t_struct* tstruct) {
  out << "- (BOOL) read: (id <TProtocol>) inProtocol error: (NSError *__autoreleasing *)__thriftError" << endl;
  scope_up(out);

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  // Declare stack tmp variables
  indent(out) << "NSString * fieldName;" << endl;
  indent(out) << "SInt32 fieldType;" << endl;
  indent(out) << "SInt32 fieldID;" << endl;
  out << endl;

  indent(out) << "if (![inProtocol readStructBeginReturningName: NULL error: __thriftError]) return NO;" << endl;

  // Loop over reading in fields
  indent(out) << "while (true)" << endl;
  scope_up(out);

  // Read beginning field marker
  indent(out)
      << "if (![inProtocol readFieldBeginReturningName: &fieldName type: &fieldType fieldID: &fieldID error: __thriftError]) return NO;"
      << endl;

  // Check for field STOP marker and break
  indent(out) << "if (fieldType == TTypeSTOP) { " << endl;
  indent_up();
  indent(out) << "break;" << endl;
  indent_down();
  indent(out) << "}" << endl;

  // Switch statement on the field we are reading
  indent(out) << "switch (fieldID)" << endl;

  scope_up(out);

  // Generate deserialization code for known cases
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    indent(out) << "case " << (*f_iter)->get_key() << ":" << endl;
    indent_up();
    indent(out) << "if (fieldType == " << type_to_enum((*f_iter)->get_type()) << ") {" << endl;
    indent_up();

    generate_deserialize_field(out, *f_iter, "fieldValue");
    indent(out) << call_field_setter(*f_iter, "fieldValue") << endl;

    indent_down();
    out << indent() << "} else { " << endl;
    if (log_unexpected_) {
      out << indent() << "  NSLog(@\"%s: field ID %i has unexpected type %i.  Skipping.\", "
                         "__PRETTY_FUNCTION__, (int)fieldID, (int)fieldType);" << endl;
    }

    out << indent() << "  if (![TProtocolUtil skipType: fieldType onProtocol: inProtocol error: __thriftError]) return NO;" << endl;
    out << indent() << "}" << endl << indent() << "break;" << endl;
    indent_down();
  }

  // In the default case we skip the field
  out << indent() << "default:" << endl;
  if (log_unexpected_) {
    out << indent() << "  NSLog(@\"%s: unexpected field ID %i with type %i.  Skipping.\", "
                       "__PRETTY_FUNCTION__, (int)fieldID, (int)fieldType);" << endl;
  }

  out << indent() << "  if (![TProtocolUtil skipType: fieldType onProtocol: inProtocol error: __thriftError]) return NO;" << endl;

  out << indent() << "  break;" << endl;

  scope_down(out);

  // Read field end marker
  indent(out) << "if (![inProtocol readFieldEnd: __thriftError]) return NO;" << endl;

  scope_down(out);

  out << indent() << "if (![inProtocol readStructEnd: __thriftError]) return NO;" << endl;

  // performs various checks (e.g. check that all required fields are set)
  if (validate_required_) {
    out << indent() << "if (![self validate: __thriftError]) return NO;" << endl;
  }

  indent(out) << "return YES;" << endl;

  indent_down();
  out << indent() << "}" << endl << endl;
}

/**
 * Generates a function to write all the fields of the struct
 *
 * @param tstruct The struct definition
 */
void t_cocoa_generator::generate_cocoa_struct_writer(ofstream& out, t_struct* tstruct) {
  out << indent() << "- (BOOL) write: (id <TProtocol>) outProtocol error: (NSError *__autoreleasing *)__thriftError {" << endl;
  indent_up();

  string name = tstruct->get_name();
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  out << indent() << "if (![outProtocol writeStructBeginWithName: @\"" << name << "\" error: __thriftError]) return NO;" << endl;

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    out << indent() << "if (_" << (*f_iter)->get_name() << "IsSet) {" << endl;
    indent_up();
    bool null_allowed = type_can_be_null((*f_iter)->get_type());
    if (null_allowed) {
      out << indent() << "if (_" << (*f_iter)->get_name() << " != nil) {" << endl;
      indent_up();
    }

    indent(out) << "if (![outProtocol writeFieldBeginWithName: @\"" << (*f_iter)->get_name()
                << "\" type: " << type_to_enum((*f_iter)->get_type())
                << " fieldID: " << (*f_iter)->get_key() << " error: __thriftError]) return NO;" << endl;

    // Write field contents
    generate_serialize_field(out, *f_iter, "_" + (*f_iter)->get_name());

    // Write field closer
    indent(out) << "if (![outProtocol writeFieldEnd: __thriftError]) return NO;" << endl;

    if (null_allowed) {
      scope_down(out);
    }
    scope_down(out);
  }
  // Write the struct map
  out << indent() << "if (![outProtocol writeFieldStop: __thriftError]) return NO;" << endl
      << indent() << "if (![outProtocol writeStructEnd: __thriftError]) return NO;" << endl;

  indent(out) << "return YES;" << endl;

  indent_down();
  out << indent() << "}" << endl << endl;
}

/**
 * Generates a function to write all the fields of the struct, which
 * is a function result. These fields are only written if they are
 * set, and only one of them can be set at a time.
 *
 * @param tstruct The struct definition
 */
void t_cocoa_generator::generate_cocoa_struct_result_writer(ofstream& out, t_struct* tstruct) {
  out << indent() << "- (BOOL) write: (id <TProtocol>) outProtocol error: (NSError *__autoreleasing *)__thriftError {" << endl;
  indent_up();

  string name = tstruct->get_name();
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  out << indent() << "if (![outProtocol writeStructBeginWithName: @\"" << name << "\" error: __thriftError]) return NO;" << endl;

  bool first = true;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (first) {
      first = false;
      out << endl << indent() << "if ";
    } else {
      out << " else if ";
    }

    out << "(_" << (*f_iter)->get_name() << "IsSet) {" << endl;
    indent_up();

    bool null_allowed = type_can_be_null((*f_iter)->get_type());
    if (null_allowed) {
      out << indent() << "if (_" << (*f_iter)->get_name() << " != nil) {" << endl;
      indent_up();
    }

    indent(out) << "if (![outProtocol writeFieldBeginWithName: @\"" << (*f_iter)->get_name()
                << "\" type: " << type_to_enum((*f_iter)->get_type())
                << " fieldID: " << (*f_iter)->get_key() << " error: __thriftError]) return NO;" << endl;

    // Write field contents
    generate_serialize_field(out, *f_iter, "_" + (*f_iter)->get_name());

    // Write field closer
    indent(out) << "if (![outProtocol writeFieldEnd: __thriftError]) return NO;" << endl;

    if (null_allowed) {
      indent_down();
      indent(out) << "}" << endl;
    }

    indent_down();
    indent(out) << "}";
  }
  // Write the struct map
  out << endl << indent() << "if (![outProtocol writeFieldStop: __thriftError]) return NO;"
      << endl << indent() << "if (![outProtocol writeStructEnd: __thriftError]) return NO;"
      << endl;

  indent(out) << "return YES;" << endl;

  indent_down();
  out << indent() << "}" << endl << endl;
}

/**
 * Generates a function to perform various checks
 * (e.g. check that all required fields are set)
 *
 * @param tstruct The struct definition
 */
void t_cocoa_generator::generate_cocoa_struct_validator(ofstream& out, t_struct* tstruct) {
  out << indent() << "- (BOOL) validate: (NSError *__autoreleasing *)__thriftError {" << endl;
  indent_up();

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  out << indent() << "// check for required fields" << endl;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    t_field* field = (*f_iter);
    if ((*f_iter)->get_req() == t_field::T_REQUIRED) {
      out << indent() << "if (!_" << field->get_name() << "IsSet) ";
      scope_up(out);
      indent(out) << "if (__thriftError) ";
      scope_up(out);
      out << indent() << "*__thriftError = [NSError errorWithDomain: TProtocolErrorDomain" << endl
          << indent() << "                                     code: TProtocolErrorUnknown" << endl
          << indent() << "                                 userInfo: @{TProtocolErrorExtendedErrorKey: @(TProtocolExtendedErrorMissingRequiredField)," << endl
          << indent() << "                                             TProtocolErrorFieldNameKey: @\"" << (*f_iter)->get_name() << "\"}];" << endl;
      scope_down(out);
      scope_down(out);
    }
  }
  indent(out) << "return YES;" << endl;
  indent_down();
  out << indent() << "}" << endl << endl;
}

/**
 * Generate property accessor methods for all fields in the struct.
 * getter, setter, isset getter.
 *
 * @param tstruct The struct definition
 */
void t_cocoa_generator::generate_cocoa_struct_field_accessor_implementations(ofstream& out,
                                                                             t_struct* tstruct,
                                                                             bool is_exception) {
  (void)is_exception;
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    t_field* field = *f_iter;
    t_type* type = get_true_type(field->get_type());
    std::string field_name = field->get_name();
    std::string cap_name = field_name;
    cap_name[0] = toupper(cap_name[0]);

    // Simple setter
    indent(out) << "- (void) set" << cap_name << ": (" << type_name(type, false, true) << ") " << field_name
                << " {" << endl;
    indent_up();
    indent(out) << "_" << field_name << " = " << field_name << ";" << endl;
    indent(out) << "_" << field_name << "IsSet = YES;" << endl;
    indent_down();
    indent(out) << "}" << endl << endl;

    // Unsetter - do we need this?
    indent(out) << "- (void) unset" << cap_name << " {" << endl;
    indent_up();
    if (type_can_be_null(type)) {
      indent(out) << "_" << field_name << " = nil;" << endl;
    }
    indent(out) << "_" << field_name << "IsSet = NO;" << endl;
    indent_down();
    indent(out) << "}" << endl << endl;
  }
}

/**
 * Generates a description method for the given struct
 *
 * @param tstruct The struct definition
 */
void t_cocoa_generator::generate_cocoa_struct_description(ofstream& out, t_struct* tstruct) {

  // Allow use of debugDescription so the app can add description via a cateogory/extension
  if (debug_descriptions_) {
    out << indent() << "- (NSString *) debugDescription {" << endl;
  }
  else {
    out << indent() << "- (NSString *) description {" << endl;
  }
  indent_up();

  out << indent() << "NSMutableString * ms = [NSMutableString stringWithString: @\""
      << cocoa_prefix_ << tstruct->get_name() << "(\"];" << endl;

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  bool first = true;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (first) {
      first = false;
      indent(out) << "[ms appendString: @\"" << (*f_iter)->get_name() << ":\"];" << endl;
    } else {
      indent(out) << "[ms appendString: @\"," << (*f_iter)->get_name() << ":\"];" << endl;
    }
    t_type* ttype = (*f_iter)->get_type();
    indent(out) << "[ms appendFormat: @\"" << format_string_for_type(ttype) << "\", "
                << format_cast_for_type(ttype) << "_" << (*f_iter)->get_name() << "];" << endl;
  }
  out << indent() << "[ms appendString: @\")\"];" << endl << indent()
      << "return [NSString stringWithString: ms];" << endl;

  indent_down();
  indent(out) << "}" << endl << endl;
}

/**
 * Generates a thrift service.  In Objective-C this consists of a
 * protocol definition, a client interface and a client implementation.
 *
 * @param tservice The service definition
 */
void t_cocoa_generator::generate_service(t_service* tservice) {
  generate_cocoa_service_protocol(f_header_, tservice);
  generate_cocoa_service_client_interface(f_header_, tservice);
  generate_cocoa_service_server_interface(f_header_, tservice);
  generate_cocoa_service_helpers(tservice);
  generate_cocoa_service_client_implementation(f_impl_, tservice);
  generate_cocoa_service_server_implementation(f_impl_, tservice);
  if (async_clients_) {
    generate_cocoa_service_async_protocol(f_header_, tservice);
    generate_cocoa_service_client_async_interface(f_header_, tservice);
    generate_cocoa_service_client_async_implementation(f_impl_, tservice);
  }
}

/**
 * Generates structs for all the service return types
 *
 * @param tservice The service
 */
void t_cocoa_generator::generate_cocoa_service_helpers(t_service* tservice) {
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {

    t_struct* ts = (*f_iter)->get_arglist();

    string qname = function_args_helper_struct_type(tservice, *f_iter);

    t_struct qname_ts = t_struct(ts->get_program(), qname);

    const vector<t_field*>& members = ts->get_members();
    vector<t_field*>::const_iterator m_iter;
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      qname_ts.append(*m_iter);
    }

    generate_cocoa_struct_interface(f_impl_, &qname_ts, false);
    generate_cocoa_struct_implementation(f_impl_, &qname_ts, false, false);
    generate_function_helpers(tservice, *f_iter);
  }
}

string t_cocoa_generator::function_result_helper_struct_type(t_service *tservice, t_function* tfunction) {
  if (tfunction->is_oneway()) {
    return tservice->get_name() + "_" + tfunction->get_name();
  } else {
    return tservice->get_name() + "_" + tfunction->get_name() + "_result";
  }
}

string t_cocoa_generator::function_args_helper_struct_type(t_service *tservice, t_function* tfunction) {
  return tservice->get_name() + "_" + tfunction->get_name() + "_args";
}

/**
 * Generates a struct and helpers for a function.
 *
 * @param tfunction The function
 */
void t_cocoa_generator::generate_function_helpers(t_service *tservice, t_function* tfunction) {
  if (tfunction->is_oneway()) {
    return;
  }

  // create a result struct with a success field of the return type,
  // and a field for each type of exception thrown
  t_struct result(program_, function_result_helper_struct_type(tservice, tfunction));
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

  // generate the result struct
  generate_cocoa_struct_interface(f_impl_, &result, false);
  generate_cocoa_struct_implementation(f_impl_, &result, false, true);
}

/**
 * Generates a service protocol definition.
 *
 * @param tservice The service to generate a protocol definition for
 */
void t_cocoa_generator::generate_cocoa_service_protocol(ofstream& out, t_service* tservice) {
  out << "@protocol " << cocoa_prefix_ << tservice->get_name() << " <NSObject>" << endl;

  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    out << "- " << function_signature(*f_iter, true) << ";"
        << "  // throws ";
    t_struct* xs = (*f_iter)->get_xceptions();
    const std::vector<t_field*>& xceptions = xs->get_members();
    vector<t_field*>::const_iterator x_iter;
    for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
      out << type_name((*x_iter)->get_type()) + ", ";
    }
    out << "TException" << endl;
  }
  out << "@end" << endl << endl;
}

/**
 * Generates an asynchronous service protocol definition.
 *
 * @param tservice The service to generate a protocol definition for
 */
void t_cocoa_generator::generate_cocoa_service_async_protocol(ofstream& out, t_service* tservice) {
  out << "@protocol " << cocoa_prefix_ << tservice->get_name() << "Async"
      << " <NSObject>" << endl;

  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    out << "- " << async_function_signature(*f_iter, false) << ";" << endl;
    if (promise_kit_) {
      out << "- " << promise_function_signature(*f_iter) << ";" << endl;
    }
  }
  out << "@end" << endl << endl;
}

/**
 * Generates a service client interface definition.
 *
 * @param tservice The service to generate a client interface definition for
 */
void t_cocoa_generator::generate_cocoa_service_client_interface(ofstream& out,
                                                                t_service* tservice) {
  out << "@interface " << cocoa_prefix_ << tservice->get_name() << "Client : TBaseClient <"
      << cocoa_prefix_ << tservice->get_name() << "> " << endl;

  out << "- (id) initWithProtocol: (id <TProtocol>) protocol;" << endl;
  out << "- (id) initWithInProtocol: (id <TProtocol>) inProtocol outProtocol: (id <TProtocol>) "
         "outProtocol;" << endl;
  out << "@end" << endl << endl;
}

/**
 * Generates a service client interface definition.
 *
 * @param tservice The service to generate a client interface definition for
 */
void t_cocoa_generator::generate_cocoa_service_client_async_interface(ofstream& out,
                                                                      t_service* tservice) {
  out << "@interface " << cocoa_prefix_ << tservice->get_name() << "ClientAsync : TBaseClient <"
      << cocoa_prefix_ << tservice->get_name() << "Async> " << endl
      << endl;

  out << "- (id) initWithProtocolFactory: (id <TProtocolFactory>) protocolFactory "
      << "transportFactory: (id <TAsyncTransportFactory>) transportFactory;" << endl;
  out << "@end" << endl << endl;
}

/**
 * Generates a service server interface definition. In other words, the TProcess implementation for
 *the
 * service definition.
 *
 * @param tservice The service to generate a client interface definition for
 */
void t_cocoa_generator::generate_cocoa_service_server_interface(ofstream& out,
                                                                t_service* tservice) {
  out << "@interface " << cocoa_prefix_ << tservice->get_name()
      << "Processor : NSObject <TProcessor> " << endl;

  out << "- (id) initWith" << tservice->get_name() << ": (id <" << cocoa_prefix_
      << tservice->get_name() << ">) service;" << endl;
  out << "- (id<" << cocoa_prefix_ << tservice->get_name() << ">) service;" << endl;

  out << "@end" << endl << endl;
}

void t_cocoa_generator::generate_cocoa_service_client_send_function_implementation(
    ofstream& out,
    t_service *tservice,
    t_function* tfunction,
    bool needs_protocol) {
  string funname = tfunction->get_name();

  t_function send_function(g_type_bool,
                           string("send_") + tfunction->get_name(),
                           tfunction->get_arglist());

  string argsname = function_args_helper_struct_type(tservice, tfunction);

  // Open function
  indent(out) << "- (BOOL) send_" << tfunction->get_name() << argument_list(tfunction->get_arglist(), needs_protocol ? "outProtocol" : "", true) << endl;
  scope_up(out);

  // Serialize the request
  out << indent() << "if (![outProtocol writeMessageBeginWithName: @\"" << funname << "\""
      << (tfunction->is_oneway() ? " type: TMessageTypeONEWAY" : " type: TMessageTypeCALL")
      << " sequenceID: 0 error: __thriftError]) return NO;" << endl;

  out << indent() << "if (![outProtocol writeStructBeginWithName: @\"" << argsname
                  << "\" error: __thriftError]) return NO;" << endl;

  // write out function parameters
  t_struct* arg_struct = tfunction->get_arglist();
  const vector<t_field*>& fields = arg_struct->get_members();
  vector<t_field*>::const_iterator fld_iter;
  for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
    string fieldName = (*fld_iter)->get_name();
    if (type_can_be_null((*fld_iter)->get_type())) {
      out << indent() << "if (" << fieldName << " != nil)";
      scope_up(out);
    }
    out << indent() << "if (![outProtocol writeFieldBeginWithName: @\"" << fieldName
        << "\""
           " type: " << type_to_enum((*fld_iter)->get_type())
        << " fieldID: " << (*fld_iter)->get_key() << " error: __thriftError]) return NO;" << endl;

    generate_serialize_field(out, *fld_iter, fieldName);

    out << indent() << "if (![outProtocol writeFieldEnd: __thriftError]) return NO;" << endl;

    if (type_can_be_null((*fld_iter)->get_type())) {
      indent_down();
      out << indent() << "}" << endl;
    }
  }

  out << indent() << "if (![outProtocol writeFieldStop: __thriftError]) return NO;" << endl;
  out << indent() << "if (![outProtocol writeStructEnd: __thriftError]) return NO;" << endl;
  out << indent() << "if (![outProtocol writeMessageEnd: __thriftError]) return NO;" << endl;
  out << indent() << "return YES;" << endl;
  scope_down(out);
  out << endl;
}

void t_cocoa_generator::generate_cocoa_service_client_recv_function_implementation(
    ofstream& out,
    t_service* tservice,
    t_function* tfunction,
    bool needs_protocol) {


  // Open function
  indent(out) << "- (BOOL) recv_" << tfunction->get_name();
  if (!tfunction->get_returntype()->is_void()) {
    out << ": (" << type_name(tfunction->get_returntype(), false, true) << " *) result ";
    if (needs_protocol) {
      out << "protocol";
    } else {
      out << "error";
    }
  }
  if (needs_protocol) {
    out << ": (id<TProtocol>) inProtocol error";
  }
  out << ": (NSError *__autoreleasing *)__thriftError" << endl;
  scope_up(out);

  // TODO(mcslee): Message validation here, was the seqid etc ok?

  // check for an exception
  out << indent() << "NSError *incomingException = [self checkIncomingMessageException: inProtocol];" << endl
      << indent() << "if (incomingException)";
  scope_up(out);
  out << indent() << "if (__thriftError)";
  scope_up(out);
  out << indent() << "*__thriftError = incomingException;" << endl;
  scope_down(out);
  out << indent() << "return NO;" << endl;
  scope_down(out);

  // FIXME - could optimize here to reduce creation of temporary objects.
  string resultname = function_result_helper_struct_type(tservice, tfunction);
  out << indent() << cocoa_prefix_ << resultname << " * resulter = [" << cocoa_prefix_ << resultname << " new];" << endl;
  indent(out) << "if (![resulter read: inProtocol error: __thriftError]) return NO;" << endl;
  indent(out) << "if (![inProtocol readMessageEnd: __thriftError]) return NO;" << endl;

  // Careful, only return _result if not a void function
  if (!tfunction->get_returntype()->is_void()) {
    out << indent() << "if (resulter.successIsSet)";
    scope_up(out);
    out << indent() << "*result = resulter.success;" << endl;
    out << indent() << "return YES;" << endl;
    scope_down(out);
  }

  t_struct* xs = tfunction->get_xceptions();
  const std::vector<t_field*>& xceptions = xs->get_members();
  vector<t_field*>::const_iterator x_iter;
  for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
    out << indent() << "if (resulter." << (*x_iter)->get_name() << "IsSet)";
    scope_up(out);
    out << indent() << "if (__thriftError)";
    scope_up(out);
    out << indent() << "*__thriftError = [resulter " << (*x_iter)->get_name() << "];" << endl;
    scope_down(out);
    out << indent() << "return NO;" << endl;
    scope_down(out);
  }

  // If you get here it's an exception, unless a void function
  if (tfunction->get_returntype()->is_void()) {
    indent(out) << "return YES;" << endl;
  } else {
    out << indent() << "if (__thriftError)";
    scope_up(out);
    out << indent() << "*__thriftError = [NSError errorWithDomain: TApplicationErrorDomain" << endl
        << indent() << "                                     code: TApplicationErrorMissingResult" << endl
        << indent() << "                                 userInfo: @{TApplicationErrorMethodKey: @\""
        << tfunction->get_name() << "\"}];" << endl;
    scope_down(out);
    out << indent() << "return NO;" << endl;
  }

  // Close function
  scope_down(out);
  out << endl;
}

/**
 * Generates an invocation of a given 'send_' function.
 *
 * @param tfunction The service to generate an implementation for
 */
void t_cocoa_generator::generate_cocoa_service_client_send_function_invocation(
                                                                               ofstream& out,
                                                                               t_function* tfunction) {

  t_struct* arg_struct = tfunction->get_arglist();
  const vector<t_field*>& fields = arg_struct->get_members();
  vector<t_field*>::const_iterator fld_iter;
  out << indent() << "if (![self send_" << tfunction->get_name();
  bool first = true;
  for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
    string fieldName = (*fld_iter)->get_name();
    out << " ";
    if (first) {
      first = false;
      out << ": " << fieldName;
    } else {
      out << fieldName << ": " << fieldName;
    }
  }
  if (!fields.empty()) {
    out << " error";
  }
  out << ": __thriftError]) " << invalid_return_statement(tfunction) << endl;
}

/**
 * Generates an invocation of a given 'send_' function.
 *
 * @param tfunction The service to generate an implementation for
 */
void t_cocoa_generator::generate_cocoa_service_client_send_async_function_invocation(
                                                                                     ofstream& out,
                                                                                     t_function* tfunction,
                                                                                     string failureBlockName) {

  t_struct* arg_struct = tfunction->get_arglist();
  const vector<t_field*>& fields = arg_struct->get_members();
  vector<t_field*>::const_iterator fld_iter;
  out << indent() << "if (![self send_" << tfunction->get_name();
  bool first = true;
  for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
    string fieldName = (*fld_iter)->get_name();
    out << " ";
    if (first) {
      first = false;
      out << ": " << fieldName;
    } else {
      out << fieldName << ": " << fieldName;
    }
  }
  if (!fields.empty()) {
    out << " protocol";
  }
  out << ": protocol error: &thriftError]) ";
  scope_up(out);
  out << indent() << failureBlockName << "(thriftError);" << endl
      << indent() << "return;" << endl;
  scope_down(out);
}

/**
 * Generates a service client implementation.
 *
 * @param tservice The service to generate an implementation for
 */
void t_cocoa_generator::generate_cocoa_service_client_implementation(ofstream& out,
                                                                     t_service* tservice) {

  string name = cocoa_prefix_ + tservice->get_name() + "Client";

  out << "@interface " << name << " () ";
  scope_up(out);
  out << endl;
  out << indent() << "id<TProtocol> inProtocol;" << endl;
  out << indent() << "id<TProtocol> outProtocol;" << endl;
  out << endl;
  scope_down(out);
  out << endl;
  out << "@end" << endl << endl;

  out << "@implementation " << name << endl;

  // initializers
  out << "- (id) initWithProtocol: (id <TProtocol>) protocol" << endl;
  scope_up(out);
  out << indent() << "return [self initWithInProtocol: protocol outProtocol: protocol];" << endl;
  scope_down(out);
  out << endl;

  out << "- (id) initWithInProtocol: (id <TProtocol>) anInProtocol outProtocol: (id <TProtocol>) "
         "anOutProtocol" << endl;
  scope_up(out);
  out << indent() << "self = [super init];" << endl;
  out << indent() << "if (self) ";
  scope_up(out);
  out << indent() << "inProtocol = anInProtocol;" << endl;
  out << indent() << "outProtocol = anOutProtocol;" << endl;
  scope_down(out);
  out << indent() << "return self;" << endl;
  scope_down(out);
  out << endl;

  // generate client method implementations
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::const_iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {

    generate_cocoa_service_client_send_function_implementation(out, tservice, *f_iter, false);

    if (!(*f_iter)->is_oneway()) {
      generate_cocoa_service_client_recv_function_implementation(out, tservice, *f_iter, false);
    }

    // Open function
    indent(out) << "- " << function_signature(*f_iter, true) << endl;
    scope_up(out);
    generate_cocoa_service_client_send_function_invocation(out, *f_iter);

    out << indent() << "if (![[outProtocol transport] flush: __thriftError]) " << invalid_return_statement(*f_iter) << endl;
    if (!(*f_iter)->is_oneway()) {
      if ((*f_iter)->get_returntype()->is_void()) {
        out << indent() << "if (![self recv_" << (*f_iter)->get_name() << ": __thriftError]) return NO;" << endl;
        out << indent() << "return YES;" << endl;
      } else {
        out << indent() << type_name((*f_iter)->get_returntype(), false, true) << " __result;" << endl
            << indent() << "if (![self recv_" << (*f_iter)->get_name() << ": &__result error: __thriftError]) "
            << invalid_return_statement(*f_iter) << endl;
        if (type_can_be_null((*f_iter)->get_returntype())) {
          out << indent() << "return __result;" << endl;
        } else {
          out << indent() << "return @(__result);" << endl;
        }
      }
    }
    else {
      out << indent() << "return YES;" << endl;
    }
    scope_down(out);
    out << endl;
  }

  out << "@end" << endl << endl;
}

/**
 * Generates a service client implementation for its asynchronous interface.
 *
 * @param tservice The service to generate an implementation for
 */
void t_cocoa_generator::generate_cocoa_service_client_async_implementation(ofstream& out,
                                                                           t_service* tservice) {

  string name = cocoa_prefix_ + tservice->get_name() + "ClientAsync";

  out << "@interface " << name << " () ";
  scope_up(out);
  out << endl;
  out << indent() << "id<TProtocolFactory> protocolFactory;" << endl;
  out << indent() << "id<TAsyncTransportFactory> transportFactory;" << endl;
  out << endl;
  scope_down(out);
  out << endl;
  out << "@end" << endl << endl;


  out << "@implementation " << name << endl
      << endl << "- (id) initWithProtocolFactory: (id <TProtocolFactory>) aProtocolFactory "
                 "transportFactory: (id <TAsyncTransportFactory>) aTransportFactory;" << endl;

  scope_up(out);
  out << indent() << "self = [super init];" << endl;
  out << indent() << "if (self) {" << endl;
  out << indent() << "  protocolFactory = aProtocolFactory;" << endl;
  out << indent() << "  transportFactory = aTransportFactory;" << endl;
  out << indent() << "}" << endl;
  out << indent() << "return self;" << endl;
  scope_down(out);
  out << endl;

  // generate client method implementations
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::const_iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {

    generate_cocoa_service_client_send_function_implementation(out, tservice, *f_iter, true);

    if (!(*f_iter)->is_oneway()) {
      generate_cocoa_service_client_recv_function_implementation(out, tservice, *f_iter, true);
    }

    // Open function
    indent(out) << "- " << async_function_signature(*f_iter, false) << endl;
    scope_up(out);

    out << indent() << "NSError *thriftError;" << endl
        << indent() << "id<TAsyncTransport> transport = [transportFactory newTransport];" << endl
        << indent() << "id<TProtocol> protocol = [protocolFactory newProtocolOnTransport:transport];" << endl
        << endl;

    generate_cocoa_service_client_send_async_function_invocation(out, *f_iter, "failureBlock");

    out << indent() << "[transport flushWithCompletion:^{" << endl;
    indent_up();

    if (!(*f_iter)->is_oneway()) {
      out << indent() << "NSError *thriftError;" << endl;

      if (!(*f_iter)->get_returntype()->is_void()) {
        out << indent() << type_name((*f_iter)->get_returntype()) << " result;" << endl;
      }
      out << indent() << "if (![self recv_" << (*f_iter)->get_name();
      if (!(*f_iter)->get_returntype()->is_void()) {
        out << ": &result protocol";
      }
      out << ": protocol error: &thriftError]) ";
      scope_up(out);
      out << indent() << "failureBlock(thriftError);" << endl
          << indent() << "return;" << endl;
      scope_down(out);
    }

    out << indent() << "responseBlock(";
    if (!(*f_iter)->is_oneway() && !(*f_iter)->get_returntype()->is_void()) {
      out << "result";
    }
    out << ");" << endl;

    indent_down();

    out << indent() << "} failure:failureBlock];" << endl;

    scope_down(out);

    out << endl;

    // Promise function
    if (promise_kit_) {

      indent(out) << "- " << promise_function_signature(*f_iter) << endl;
      scope_up(out);

      out << indent() << "return [AnyPromise promiseWithResolverBlock:^(PMKResolver resolver) {" << endl;
      indent_up();

      out << indent() << "NSError *thriftError;" << endl
          << indent() << "id<TAsyncTransport> transport = [transportFactory newTransport];" << endl
          << indent() << "id<TProtocol> protocol = [protocolFactory newProtocolOnTransport:transport];" << endl
          << endl;

      generate_cocoa_service_client_send_async_function_invocation(out, *f_iter, "resolver");

      out << indent() << "[transport flushWithCompletion:^{" << endl;
      indent_up();

      if (!(*f_iter)->is_oneway()) {
        out << indent() << "NSError *thriftError;" << endl;

        if (!(*f_iter)->get_returntype()->is_void()) {
          out << indent() << type_name((*f_iter)->get_returntype()) << " result;" << endl;
        }
        out << indent() << "if (![self recv_" << (*f_iter)->get_name();
        if (!(*f_iter)->get_returntype()->is_void()) {
          out << ": &result protocol";
        }
        out << ": protocol error: &thriftError]) ";
        scope_up(out);
        out << indent() << "resolver(thriftError);" << endl
            << indent() << "return;" << endl;
        scope_down(out);
      }

      out << indent() << "resolver(";
      if ((*f_iter)->is_oneway() || (*f_iter)->get_returntype()->is_void()) {
        out << "@YES";
      } else if (type_can_be_null((*f_iter)->get_returntype())) {
        out << "result";
      } else {
        out << "@(result)";
      }
      out << ");" << endl;

      indent_down();

      out << indent() << "} failure:^(NSError *error) {" << endl;
      indent_up();
      out << indent() << "resolver(error);" << endl;
      indent_down();
      out << indent() << "}];" << endl;

      indent_down();
      out << indent() << "}];" << endl;

      scope_down(out);

      out << endl;

    }

  }

  out << "@end" << endl << endl;
}

/**
 * Generates a service server implementation.  In other words the actual TProcessor implementation
 * for the service.
 *
 * @param tservice The service to generate an implementation for
 */
void t_cocoa_generator::generate_cocoa_service_server_implementation(ofstream& out,
                                                                     t_service* tservice) {

  string name = cocoa_prefix_ + tservice->get_name() + "Processor";

  out << "@interface " << name << " () ";

  scope_up(out);
  out << indent() << "id <" << cocoa_prefix_ << tservice->get_name() << "> service;" << endl;
  out << indent() << "NSDictionary * methodMap;" << endl;
  scope_down(out);

  out << "@end" << endl << endl;

  out << "@implementation " << name << endl;

  // initializer
  out << endl;
  out << "- (id) initWith" << tservice->get_name() << ": (id <" << cocoa_prefix_ << tservice->get_name() << ">) aService" << endl;
  scope_up(out);
  out << indent() << "self = [super init];" << endl;
  out << indent() << "if (self) ";
  scope_up(out);
  out << indent() << "service = aService;" << endl;
  out << indent() << "methodMap = [NSMutableDictionary dictionary];" << endl;

  // generate method map for routing incoming calls
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::const_iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    string funname = (*f_iter)->get_name();
    scope_up(out);
    out << indent() << "SEL s = @selector(process_" << funname << "_withSequenceID:inProtocol:outProtocol:error:);" << endl;
    out << indent() << "NSMethodSignature * sig = [self methodSignatureForSelector: s];" << endl;
    out << indent() << "NSInvocation * invocation = [NSInvocation invocationWithMethodSignature: sig];" << endl;
    out << indent() << "[invocation setSelector: s];" << endl;
    out << indent() << "[invocation retainArguments];" << endl;
    out << indent() << "[methodMap setValue: invocation forKey: @\"" << funname << "\"];" << endl;
    scope_down(out);
  }
  scope_down(out);
  out << indent() << "return self;" << endl;
  scope_down(out);

  // implementation of the 'service' method which returns the service associated with this
  // processor
  out << endl;
  out << indent() << "- (id<" << cocoa_prefix_ << tservice->get_name() << ">) service" << endl;
  out << indent() << "{" << endl;
  out << indent() << "  return service;" << endl;
  out << indent() << "}" << endl;

  // implementation of the TProcess method, which dispatches the incoming call using the method map
  out << endl;
  out << indent() << "- (BOOL) processOnInputProtocol: (id <TProtocol>) inProtocol" << endl;
  out << indent() << "                 outputProtocol: (id <TProtocol>) outProtocol" << endl;
  out << indent() << "                          error: (NSError *__autoreleasing *)__thriftError" << endl;
  out << indent() << "{" << endl;
  out << indent() << "  NSString * messageName;" << endl;
  out << indent() << "  SInt32 messageType;" << endl;
  out << indent() << "  SInt32 seqID;" << endl;
  out << indent() << "  if (![inProtocol readMessageBeginReturningName: &messageName" << endl;
  out << indent() << "                                       type: &messageType" << endl;
  out << indent() << "                                 sequenceID: &seqID" << endl;
  out << indent() << "                                      error: __thriftError]) return NO;" << endl;
  out << indent() << "  NSInvocation * invocation = [methodMap valueForKey: messageName];" << endl;
  out << indent() << "  if (invocation == nil) {" << endl;
  out << indent() << "    if (![TProtocolUtil skipType: TTypeSTRUCT onProtocol: inProtocol error: __thriftError]) return NO;" << endl;
  out << indent() << "    if (![inProtocol readMessageEnd: __thriftError]) return NO;" << endl;
  out << indent() << "    NSError * x = [NSError errorWithDomain: TApplicationErrorDomain" << endl;
  out << indent() << "                                      code: TApplicationErrorUnknownMethod" << endl;
  out << indent() << "                                  userInfo: @{TApplicationErrorMethodKey: messageName}];" << endl;
  out << indent() << "    if (![outProtocol writeMessageBeginWithName: messageName" << endl;
  out << indent() << "                                           type: TMessageTypeEXCEPTION" << endl;
  out << indent() << "                                     sequenceID: seqID" << endl;
  out << indent() << "                                          error: __thriftError]) return NO;" << endl;
  out << indent() << "    if (![x write: outProtocol error: __thriftError]) return NO;" << endl;
  out << indent() << "    if (![outProtocol writeMessageEnd: __thriftError]) return NO;" << endl;
  out << indent() << "    if (![[outProtocol transport] flush: __thriftError]) return NO;" << endl;
  out << indent() << "    return YES;" << endl;
  out << indent() << "  }" << endl;
  out << indent() << "  // NSInvocation does not conform to NSCopying protocol" << endl;
  out << indent() << "  NSInvocation * i = [NSInvocation invocationWithMethodSignature: "
                     "[invocation methodSignature]];" << endl;
  out << indent() << "  [i setSelector: [invocation selector]];" << endl;
  out << indent() << "  [i setArgument: &seqID atIndex: 2];" << endl;
  out << indent() << "  [i setArgument: &inProtocol atIndex: 3];" << endl;
  out << indent() << "  [i setArgument: &outProtocol atIndex: 4];" << endl;
  out << indent() << "  [i setArgument: &__thriftError atIndex: 5];" << endl;
  out << indent() << "  [i setTarget: self];" << endl;
  out << indent() << "  [i invoke];" << endl;
  out << indent() << "  return YES;" << endl;
  out << indent() << "}" << endl;

  // generate a process_XXXX method for each service function, which reads args, calls the service,
  // and writes results
  functions = tservice->get_functions();
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    out << endl;
    string funname = (*f_iter)->get_name();
    out << indent() << "- (BOOL) process_" << funname
        << "_withSequenceID: (SInt32) seqID inProtocol: (id<TProtocol>) inProtocol outProtocol: "
           "(id<TProtocol>) outProtocol error:(NSError *__autoreleasing *)__thriftError" << endl;
    scope_up(out);
    string argstype = cocoa_prefix_ + function_args_helper_struct_type(tservice, *f_iter);
    out << indent() << argstype << " * args = [" << argstype << " new];" << endl;
    out << indent() << "if (![args read: inProtocol error: __thriftError]) return NO;" << endl;
    out << indent() << "if (![inProtocol readMessageEnd: __thriftError]) return NO;" << endl;

    // prepare the result if not oneway
    if (!(*f_iter)->is_oneway()) {
      string resulttype = cocoa_prefix_ + function_result_helper_struct_type(tservice, *f_iter);
      out << indent() << resulttype << " * result = [" << resulttype << " new];" << endl;
    }

    // make the call to the actual service object
    out << indent();
    if ((*f_iter)->get_returntype()->is_void()) {
      out << "BOOL";
    } else if (type_can_be_null((*f_iter)->get_returntype())) {
      out << type_name((*f_iter)->get_returntype(), false, true);
    } else {
      out << "NSNumber *";
    }
    out << " serviceResult = ";
    if ((*f_iter)->get_returntype()->get_true_type()->is_container()) {
      out << "(" << type_name((*f_iter)->get_returntype(), false, true) << ")";
    }
    out << "[service " << funname;
    // supplying arguments
    t_struct* arg_struct = (*f_iter)->get_arglist();
    const vector<t_field*>& fields = arg_struct->get_members();
    vector<t_field*>::const_iterator fld_iter;
    bool first = true;
    for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
      string fieldName = (*fld_iter)->get_name();
      if (first) {
        first = false;
        out << ": [args " << fieldName << "]";
      } else {
        out << " " << fieldName << ": [args " << fieldName << "]";
      }
    }
    if (!fields.empty()) {
      out << " error";
    }
    out << ": __thriftError];" << endl;
    out << indent() << "if (!serviceResult) return NO;" << endl;
    if (!(*f_iter)->get_returntype()->is_void()) {
      out << indent() << "[result setSuccess: " << unbox((*f_iter)->get_returntype(), "serviceResult") << "];" << endl;
    }

    // write out the result if not oneway
    if (!(*f_iter)->is_oneway()) {
      out << indent() << "if (![outProtocol writeMessageBeginWithName: @\"" << funname << "\"" << endl;
      out << indent() << "                                       type: TMessageTypeREPLY" << endl;
      out << indent() << "                                 sequenceID: seqID" << endl;
      out << indent() << "                                      error: __thriftError]) return NO;" << endl;
      out << indent() << "if (![result write: outProtocol error: __thriftError]) return NO;" << endl;
      out << indent() << "if (![outProtocol writeMessageEnd: __thriftError]) return NO;" << endl;
      out << indent() << "if (![[outProtocol transport] flush: __thriftError]) return NO;" << endl;
    }
    out << indent() << "return YES;" << endl;

    scope_down(out);
  }

  out << "@end" << endl << endl;
}

/**
 * Deserializes a field of any type.
 *
 * @param tfield The field
 * @param fieldName The variable name for this field
 */
void t_cocoa_generator::generate_deserialize_field(ofstream& out,
                                                   t_field* tfield,
                                                   string fieldName) {
  t_type* type = get_true_type(tfield->get_type());

  if (type->is_void()) {
    throw "CANNOT GENERATE DESERIALIZE CODE FOR void TYPE: " + tfield->get_name();
  }

  if (type->is_struct() || type->is_xception()) {
    generate_deserialize_struct(out, (t_struct*)type, fieldName);
  } else if (type->is_container()) {
    generate_deserialize_container(out, type, fieldName);
  } else if (type->is_base_type() || type->is_enum()) {
    indent(out) << type_name(type) << " " << fieldName << ";" << endl;
    indent(out) << "if (![inProtocol ";

    if (type->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        throw "compiler error: cannot serialize void field in a struct: " + tfield->get_name();
        break;
      case t_base_type::TYPE_STRING:
        if (((t_base_type*)type)->is_binary()) {
          out << "readBinary:&" << fieldName << " error: __thriftError]";
        } else {
          out << "readString:&" << fieldName << " error: __thriftError]";
        }
        break;
      case t_base_type::TYPE_BOOL:
        out << "readBool:&" << fieldName << " error: __thriftError]";
        break;
      case t_base_type::TYPE_I8:
        out << "readByte:(UInt8 *)&" << fieldName << " error: __thriftError]";
        break;
      case t_base_type::TYPE_I16:
        out << "readI16:&" << fieldName << " error: __thriftError]";
        break;
      case t_base_type::TYPE_I32:
        out << "readI32:&" << fieldName << " error: __thriftError]";
        break;
      case t_base_type::TYPE_I64:
        out << "readI64:&" << fieldName << " error: __thriftError]";
        break;
      case t_base_type::TYPE_DOUBLE:
        out << "readDouble:&" << fieldName << " error: __thriftError]";
        break;
      default:
        throw "compiler error: no Objective-C name for base type "
            + t_base_type::t_base_name(tbase);
      }
    } else if (type->is_enum()) {
      out << "readI32:&" << fieldName << " error: __thriftError]";
    }
    out << ") return NO;" << endl;
  } else {
    printf("DO NOT KNOW HOW TO DESERIALIZE FIELD '%s' TYPE '%s'\n",
           tfield->get_name().c_str(),
           type_name(type).c_str());
  }
}

/**
 * Generates an unserializer for a struct, allocates the struct and invokes read:
 */
void t_cocoa_generator::generate_deserialize_struct(ofstream& out,
                                                    t_struct* tstruct,
                                                    string fieldName) {
  indent(out) << type_name(tstruct) << fieldName << " = [[" << type_name(tstruct, true)
              << " alloc] init];" << endl;
  indent(out) << "if (![" << fieldName << " read: inProtocol error: __thriftError]) return NO;" << endl;
}

/**
 * Deserializes a container by reading its size and then iterating
 */
void t_cocoa_generator::generate_deserialize_container(ofstream& out,
                                                       t_type* ttype,
                                                       string fieldName) {
  string size = tmp("_size");
  indent(out) << "SInt32 " << size << ";" << endl;

  // Declare variables, read header
  if (ttype->is_map()) {
    indent(out) << "if (![inProtocol readMapBeginReturningKeyType: NULL valueType: NULL size: &" << size << " error: __thriftError]) return NO;" << endl;
    indent(out) << "NSMutableDictionary * " << fieldName
                << " = [[NSMutableDictionary alloc] initWithCapacity: " << size << "];" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "if (![inProtocol readSetBeginReturningElementType: NULL size: &" << size << " error: __thriftError]) return NO;"
                << endl;
    indent(out) << "NSMutableSet * " << fieldName
                << " = [[NSMutableSet alloc] initWithCapacity: " << size << "];" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "if (![inProtocol readListBeginReturningElementType: NULL size: &" << size << " error: __thriftError]) return NO;"
                << endl;
    indent(out) << "NSMutableArray * " << fieldName
                << " = [[NSMutableArray alloc] initWithCapacity: " << size << "];" << endl;
  }
  // FIXME - the code above does not verify that the element types of
  // the containers being read match the element types of the
  // containers we are reading into.  Does that matter?

  // For loop iterates over elements
  string i = tmp("_i");
  indent(out) << "int " << i << ";" << endl << indent() << "for (" << i << " = 0; " << i << " < "
              << size << "; "
              << "++" << i << ")" << endl;

  scope_up(out);

  if (ttype->is_map()) {
    generate_deserialize_map_element(out, (t_map*)ttype, fieldName);
  } else if (ttype->is_set()) {
    generate_deserialize_set_element(out, (t_set*)ttype, fieldName);
  } else if (ttype->is_list()) {
    generate_deserialize_list_element(out, (t_list*)ttype, fieldName);
  }

  scope_down(out);

  // Read container end
  if (ttype->is_map()) {
    indent(out) << "if (![inProtocol readMapEnd: __thriftError]) return NO;" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "if (![inProtocol readSetEnd: __thriftError]) return NO;" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "if (![inProtocol readListEnd: __thriftError]) return NO;" << endl;
  }
}

/**
 * Take a variable of a given type and wrap it in code to make it
 * suitable for putting into a container, if necessary.  Basically,
 * wrap scaler primitives in NSNumber objects.
 */
string t_cocoa_generator::box(t_type* ttype, string field_name) {

  ttype = get_true_type(ttype);
  if (ttype->is_enum()) {
    return "@(" + field_name + ")";
  } else if (ttype->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)ttype)->get_base();
    switch (tbase) {
      case t_base_type::TYPE_VOID:
        throw "can't box void";
      case t_base_type::TYPE_BOOL:
      case t_base_type::TYPE_I8:
      case t_base_type::TYPE_I16:
      case t_base_type::TYPE_I32:
      case t_base_type::TYPE_I64:
      case t_base_type::TYPE_DOUBLE:
        return "@(" + field_name + ")";
      default:
        break;
    }
  }

  // do nothing
  return field_name;
}

/**
 * Extracts the actual value from a boxed value
 */
string t_cocoa_generator::unbox(t_type* ttype, string field_name) {
  ttype = get_true_type(ttype);
  if (ttype->is_enum()) {
    return "[" + field_name + " intValue]";
  } else if (ttype->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)ttype)->get_base();
    switch (tbase) {
      case t_base_type::TYPE_VOID:
        throw "can't unbox void";
      case t_base_type::TYPE_BOOL:
        return "[" + field_name + " boolValue]";
      case t_base_type::TYPE_I8:
        return "((SInt8)[" + field_name + " charValue])";
      case t_base_type::TYPE_I16:
        return "((SInt16)[" + field_name + " shortValue])";
      case t_base_type::TYPE_I32:
        return "((SInt32)[" + field_name + " longValue])";
      case t_base_type::TYPE_I64:
        return "((SInt64)[" + field_name + " longLongValue])";
      case t_base_type::TYPE_DOUBLE:
        return "[" + field_name + " doubleValue]";
      default:
        break;
    }
  }

  // do nothing
  return field_name;
}

/**
 * Generates code to deserialize a map element
 */
void t_cocoa_generator::generate_deserialize_map_element(ofstream& out,
                                                         t_map* tmap,
                                                         string fieldName) {
  string key = tmp("_key");
  string val = tmp("_val");
  t_type* keyType = tmap->get_key_type();
  t_type* valType = tmap->get_val_type();
  t_field fkey(keyType, key);
  t_field fval(valType, val);

  generate_deserialize_field(out, &fkey, key);
  generate_deserialize_field(out, &fval, val);

  indent(out) << "[" << fieldName << " setObject: " << box(valType, val)
              << " forKey: " << box(keyType, key) << "];" << endl;
}

/**
 * Deserializes a set element
 */
void t_cocoa_generator::generate_deserialize_set_element(ofstream& out,
                                                         t_set* tset,
                                                         string fieldName) {
  string elem = tmp("_elem");
  t_type* type = tset->get_elem_type();
  t_field felem(type, elem);

  generate_deserialize_field(out, &felem, elem);

  indent(out) << "[" << fieldName << " addObject: " << box(type, elem) << "];" << endl;
}

/**
 * Deserializes a list element
 */
void t_cocoa_generator::generate_deserialize_list_element(ofstream& out,
                                                          t_list* tlist,
                                                          string fieldName) {
  string elem = tmp("_elem");
  t_type* type = tlist->get_elem_type();
  t_field felem(type, elem);

  generate_deserialize_field(out, &felem, elem);

  indent(out) << "[" << fieldName << " addObject: " << box(type, elem) << "];" << endl;
}

/**
 * Serializes a field of any type.
 *
 * @param tfield The field to serialize
 * @param fieldName Name to of the variable holding the field
 */
void t_cocoa_generator::generate_serialize_field(ofstream& out, t_field* tfield, string fieldName) {
  t_type* type = get_true_type(tfield->get_type());

  // Do nothing for void types
  if (type->is_void()) {
    throw "CANNOT GENERATE SERIALIZE CODE FOR void TYPE: " + tfield->get_name();
  }

  if (type->is_struct() || type->is_xception()) {
    generate_serialize_struct(out, (t_struct*)type, fieldName);
  } else if (type->is_container()) {
    generate_serialize_container(out, type, fieldName);
  } else if (type->is_base_type() || type->is_enum()) {
    indent(out) << "if (![outProtocol ";

    if (type->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        throw "compiler error: cannot serialize void field in a struct: " + fieldName;
        break;
      case t_base_type::TYPE_STRING:
        if (((t_base_type*)type)->is_binary()) {
          out << "writeBinary: " << fieldName << " error: __thriftError]";
        } else {
          out << "writeString: " << fieldName << " error: __thriftError]";
        }
        break;
      case t_base_type::TYPE_BOOL:
        out << "writeBool: " << fieldName << " error: __thriftError]";
        break;
      case t_base_type::TYPE_I8:
        out << "writeByte: (UInt8)" << fieldName << " error: __thriftError]";
        break;
      case t_base_type::TYPE_I16:
        out << "writeI16: " << fieldName << " error: __thriftError]";
        break;
      case t_base_type::TYPE_I32:
        out << "writeI32: " << fieldName << " error: __thriftError]";
        break;
      case t_base_type::TYPE_I64:
        out << "writeI64: " << fieldName << " error: __thriftError]";
        break;
      case t_base_type::TYPE_DOUBLE:
        out << "writeDouble: " << fieldName << " error: __thriftError]";
        break;
      default:
        throw "compiler error: no Objective-C name for base type "
            + t_base_type::t_base_name(tbase);
      }
    } else if (type->is_enum()) {
      out << "writeI32: " << fieldName << " error: __thriftError]";
    }
    out << ") return NO;" << endl;
  } else {
    printf("DO NOT KNOW HOW TO SERIALIZE FIELD '%s' TYPE '%s'\n",
           tfield->get_name().c_str(),
           type_name(type).c_str());
  }
}

/**
 * Serialize a struct.
 *
 * @param tstruct The struct to serialize
 * @param fieldName Name of variable holding struct
 */
void t_cocoa_generator::generate_serialize_struct(ofstream& out,
                                                  t_struct* tstruct,
                                                  string fieldName) {
  (void)tstruct;
  out << indent() << "if (![" << fieldName << " write: outProtocol error: __thriftError]) return NO;" << endl;
}

/**
 * Serializes a container by writing its size then the elements.
 *
 * @param ttype  The type of container
 * @param fieldName Name of variable holding container
 */
void t_cocoa_generator::generate_serialize_container(ofstream& out,
                                                     t_type* ttype,
                                                     string fieldName) {
  scope_up(out);

  if (ttype->is_map()) {
    indent(out) << "if (![outProtocol writeMapBeginWithKeyType: "
                << type_to_enum(((t_map*)ttype)->get_key_type())
                << " valueType: " << type_to_enum(((t_map*)ttype)->get_val_type()) << " size: (SInt32)["
                << fieldName << " count] error: __thriftError]) return NO;" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "if (![outProtocol writeSetBeginWithElementType: "
                << type_to_enum(((t_set*)ttype)->get_elem_type()) << " size: (SInt32)[" << fieldName
                << " count] error: __thriftError]) return NO;" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "if (![outProtocol writeListBeginWithElementType: "
                << type_to_enum(((t_list*)ttype)->get_elem_type()) << " size: (SInt32)[" << fieldName
                << " count] error: __thriftError]) return NO;" << endl;
  }

  string iter = tmp("_iter");
  string key;
  if (ttype->is_map()) {
    key = tmp("key");
    indent(out) << "NSEnumerator * " << iter << " = [" << fieldName << " keyEnumerator];" << endl;
    indent(out) << "id " << key << ";" << endl;
    indent(out) << "while ((" << key << " = [" << iter << " nextObject]))" << endl;
  } else if (ttype->is_set()) {
    key = tmp("obj");
    indent(out) << "NSEnumerator * " << iter << " = [" << fieldName << " objectEnumerator];"
                << endl;
    indent(out) << "id " << key << ";" << endl;
    indent(out) << "while ((" << key << " = [" << iter << " nextObject]))" << endl;
  } else if (ttype->is_list()) {
    key = tmp("idx");
    indent(out) << "int " << key << ";" << endl;
    indent(out) << "for (" << key << " = 0; " << key << " < [" << fieldName << " count]; " << key
                << "++)" << endl;
  }

  scope_up(out);

  if (ttype->is_map()) {
    generate_serialize_map_element(out, (t_map*)ttype, key, fieldName);
  } else if (ttype->is_set()) {
    generate_serialize_set_element(out, (t_set*)ttype, key);
  } else if (ttype->is_list()) {
    generate_serialize_list_element(out, (t_list*)ttype, key, fieldName);
  }

  scope_down(out);

  if (ttype->is_map()) {
    indent(out) << "if (![outProtocol writeMapEnd: __thriftError]) return NO;" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "if (![outProtocol writeSetEnd: __thriftError]) return NO;" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "if (![outProtocol writeListEnd: __thriftError]) return NO;" << endl;
  }

  scope_down(out);
}

/**
 * Serializes the members of a map.
 */
void t_cocoa_generator::generate_serialize_map_element(ofstream& out,
                                                       t_map* tmap,
                                                       string key,
                                                       string mapName) {
  t_field kfield(tmap->get_key_type(), key);
  generate_serialize_field(out, &kfield, unbox(kfield.get_type(), key));
  t_field vfield(tmap->get_val_type(), "[" + mapName + " objectForKey: " + key + "]");
  generate_serialize_field(out, &vfield, unbox(vfield.get_type(), vfield.get_name()));
}

/**
 * Serializes the members of a set.
 */
void t_cocoa_generator::generate_serialize_set_element(ofstream& out,
                                                       t_set* tset,
                                                       string elementName) {
  t_field efield(tset->get_elem_type(), elementName);
  generate_serialize_field(out, &efield, unbox(efield.get_type(), elementName));
}

/**
 * Serializes the members of a list.
 */
void t_cocoa_generator::generate_serialize_list_element(ofstream& out,
                                                        t_list* tlist,
                                                        string index,
                                                        string listName) {
  t_field efield(tlist->get_elem_type(), "[" + listName + " objectAtIndex: " + index + "]");
  generate_serialize_field(out, &efield, unbox(efield.get_type(), efield.get_name()));
}

/**
 * Returns an Objective-C name
 *
 * @param ttype The type
 * @param class_ref Do we want a Class reference istead of a type reference?
 * @return Objective-C type name, i.e. NSDictionary<Key,Value> *
 */
string t_cocoa_generator::type_name(t_type* ttype, bool class_ref, bool needs_mutable) {
  if (ttype->is_typedef()) {
    string name = (needs_mutable && ttype->get_true_type()->is_container()) ? "Mutable" + ttype->get_name() : ttype->get_name();
    t_program* program = ttype->get_program();
    return program ? (program->get_namespace("cocoa") + name) : name;
  }

  string result;
  if (ttype->is_base_type()) {
    return base_type_name((t_base_type*)ttype);
  } else if (ttype->is_enum()) {
    return cocoa_prefix_ + ttype->get_name();
  } else if (ttype->is_map()) {
    t_map *map = (t_map *)ttype;
    result = needs_mutable ? "NSMutableDictionary" : "NSDictionary";
    result += "<" + element_type_name(map->get_key_type()) + ", " + element_type_name(map->get_val_type()) + ">";
  } else if (ttype->is_set()) {
    t_set *set = (t_set *)ttype;
    result = needs_mutable ? "NSMutableSet" : "NSSet";
    result += "<" + element_type_name(set->get_elem_type()) + ">";
  } else if (ttype->is_list()) {
    t_list *list = (t_list *)ttype;
    result = needs_mutable ? "NSMutableArray" : "NSArray";
    result += "<" + element_type_name(list->get_elem_type()) + ">";
  } else {
    // Check for prefix
    t_program* program = ttype->get_program();
    if (program != NULL) {
      result = program->get_namespace("cocoa") + ttype->get_name();
    } else {
      result = ttype->get_name();
    }
  }

  if (!class_ref) {
    result += " *";
  }
  return result;
}

/**
 * Returns an Objective-C type name for container types
 *
 * @param ttype the type
 */
string t_cocoa_generator::element_type_name(t_type* etype) {

  t_type* ttype = etype->get_true_type();

  if (etype->is_typedef() && type_can_be_null(ttype)) {
    return type_name(etype);
  }

  string result;
  if (ttype->is_base_type()) {
    t_base_type* tbase = (t_base_type*)ttype;
    switch (tbase->get_base()) {
    case t_base_type::TYPE_STRING:
      if (tbase->is_binary()) {
        result = "NSData *";
      }
      else {
        result = "NSString *";
      }
      break;
    default:
      result = "NSNumber *";
      break;
    }
  } else if (ttype->is_enum()) {
      result = "NSNumber *";
  } else if (ttype->is_map()) {
    t_map *map = (t_map *)ttype;
    result = "NSDictionary<" + element_type_name(map->get_key_type()) + ", " + element_type_name(map->get_val_type()) + "> *";
  } else if (ttype->is_set()) {
    t_set *set = (t_set *)ttype;
    result = "NSSet<" + element_type_name(set->get_elem_type()) + "> *";
  } else if (ttype->is_list()) {
    t_list *list = (t_list *)ttype;
    result = "NSArray<" + element_type_name(list->get_elem_type()) + "> *";
  } else if (ttype->is_struct() || ttype->is_xception()) {
    result = cocoa_prefix_ + ttype->get_name() + " *";
  }

  return result;
}

/**
 * Returns the Objective-C type that corresponds to the thrift type.
 *
 * @param tbase The base type
 */
string t_cocoa_generator::base_type_name(t_base_type* type) {
  t_base_type::t_base tbase = type->get_base();

  switch (tbase) {
  case t_base_type::TYPE_VOID:
    return "void";
  case t_base_type::TYPE_STRING:
    if (type->is_binary()) {
      return "NSData *";
    } else {
      return "NSString *";
    }
  case t_base_type::TYPE_BOOL:
    return "BOOL";
  case t_base_type::TYPE_I8:
    return "SInt8";
  case t_base_type::TYPE_I16:
    return "SInt16";
  case t_base_type::TYPE_I32:
    return "SInt32";
  case t_base_type::TYPE_I64:
    return "SInt64";
  case t_base_type::TYPE_DOUBLE:
    return "double";
  default:
    throw "compiler error: no Objective-C name for base type " + t_base_type::t_base_name(tbase);
  }
}

/**
 * Prints the value of a constant with the given type. Note that type checking
 * is NOT performed in this function as it is always run beforehand using the
 * validate_types method in main.cc
 */
void t_cocoa_generator::print_const_value(ostream& out,
                                          string name,
                                          t_type* type,
                                          t_const_value* value,
                                          bool defval) {
  type = get_true_type(type);

  if (type->is_base_type()) {
    string v2 = render_const_value(out, type, value);
    indent(out);
    if (defval)
      out << type_name(type) << " ";
    out << name << " = " << v2 << ";" << endl << endl;
  } else if (type->is_enum()) {
    indent(out);
    if (defval)
      out << type_name(type) << " ";
    out << name << " = " << render_const_value(out, type, value) << ";" << endl << endl;
  } else if (type->is_struct() || type->is_xception()) {
    indent(out);
    const vector<t_field*>& fields = ((t_struct*)type)->get_members();
    vector<t_field*>::const_iterator f_iter;
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    if (defval)
      out << type_name(type) << " ";
    out << name << " = [" << type_name(type, true) << " new];"
        << endl;
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
      std::string cap_name = capitalize(v_iter->first->get_string());
      indent(out) << "[" << name << " set" << cap_name << ":" << val << "];" << endl;
    }
  } else if (type->is_map()) {
    ostringstream mapout;
    indent(mapout);
    t_type* ktype = ((t_map*)type)->get_key_type();
    t_type* vtype = ((t_map*)type)->get_val_type();
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    if (defval)
      mapout << type_name(type) << " ";
    mapout << name << " = @{";
    for (v_iter = val.begin(); v_iter != val.end();) {
      mapout << render_const_value(out, ktype, v_iter->first, true) << ": "
          << render_const_value(out, vtype, v_iter->second, true);
      if (++v_iter != val.end()) {
        mapout << ", ";
      }
    }
    mapout << "}";
    out << mapout.str();
  } else if (type->is_list()) {
    ostringstream listout;
    indent(listout);
    t_type* etype = ((t_list*)type)->get_elem_type();
    const vector<t_const_value*>& val = value->get_list();
    vector<t_const_value*>::const_iterator v_iter;
    if (defval)
      listout << type_name(type) << " ";
    listout << name << " = @[";
    for (v_iter = val.begin(); v_iter != val.end();) {
      listout << render_const_value(out, etype, *v_iter, true);
      if (++v_iter != val.end()) {
        listout << ", ";
      }
    }
    listout << "]";
    out << listout.str();
  } else if (type->is_set()) {
    ostringstream setout;
    indent(setout);
    t_type* etype = ((t_set*)type)->get_elem_type();
    const vector<t_const_value*>& val = value->get_list();
    vector<t_const_value*>::const_iterator v_iter;
    if (defval)
      setout << type_name(type) << " ";
    setout << name << " = [NSSet setWithArray:@[";
    for (v_iter = val.begin(); v_iter != val.end();) {
      setout << render_const_value(out, etype, *v_iter, true);
      if (++v_iter != val.end()) {
        setout << ", ";
      }
    }
    setout << "]]";
    out << setout.str();
  } else {
    throw "compiler error: no const of type " + type->get_name();
  }
}

string t_cocoa_generator::render_const_value(ostream& out,
                                             t_type* type,
                                             t_const_value* value,
                                             bool box_it) {
  type = get_true_type(type);
  std::ostringstream render;

  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_STRING:
      // We must handle binary constant but the syntax of IDL defines
      // nothing about binary constant.
      //   if ((t_base_type*)type)->is_binary())
      //      // binary code
      render << "@\"" << get_escaped_string(value) << '"';
      break;
    case t_base_type::TYPE_BOOL:
      render << ((value->get_integer() > 0) ? "YES" : "NO");
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
    out << ";" << endl;
    render << t;
  }

  if (box_it) {
    return box(type, render.str());
  }
  return render.str();
}

#if 0
/**
ORIGINAL
 * Spit out code that evaluates to the specified constant value.
 */
string t_cocoa_generator::render_const_value(string name,
                                             t_type* type,
                                             t_const_value* value,
                                             bool box_it) {
  type = get_true_type(type);
  std::ostringstream render;

  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_STRING:
      render << "@\"" << get_escaped_string(value) << '"';
      break;
    case t_base_type::TYPE_BOOL:
      render << ((value->get_integer() > 0) ? "YES" : "NO");
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
  } else if (type->is_struct() || type->is_xception()) {
    const vector<t_field*>& fields = ((t_struct*)type)->get_members();
    vector<t_field*>::const_iterator f_iter;
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    if (val.size() > 0)
      render << "[[" << type_name(type, true) << " alloc] initWith";
    else
      render << "[[" << type_name(type, true) << " alloc] init";
    bool first = true;
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      // FIXME The generated code does not match with initWithXXX
      //       initializer and causes compile error.
      //       Try: test/DebugProtoTest.thrift and test/SmallTest.thrift
      t_type* field_type = NULL;
      for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
        if ((*f_iter)->get_name() == v_iter->first->get_string()) {
          field_type = (*f_iter)->get_type();
        }
      }
      if (field_type == NULL) {
        throw "type error: " + type->get_name() + " has no field " + v_iter->first->get_string();
      }
      if (first) {
        render << capitalize(v_iter->first->get_string());
        first = false;
      } else {
        render << " " << v_iter->first->get_string();
      }
      render << ": " << render_const_value(name, field_type, v_iter->second);
    }
    render << "]";
  } else if (type->is_map()) {
    render << "[[NSDictionary alloc] initWithObjectsAndKeys: ";
    t_type* ktype = ((t_map*)type)->get_key_type();
    t_type* vtype = ((t_map*)type)->get_val_type();
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    bool first = true;
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      string key = render_const_value(name, ktype, v_iter->first, true);
      string val = render_const_value(name, vtype, v_iter->second, true);
      if (first) {
        first = false;
      } else {
        render << ", ";
      }
      render << val << ", " << key;
    }
    if (first)
      render << " nil]";
    else
      render << ", nil]";
  } else if (type->is_list()) {
    render << "[[NSArray alloc] initWithObjects: ";
    t_type * etype = ((t_list*)type)->get_elem_type();
    const vector<t_const_value*>& val = value->get_list();
    bool first = true;
    vector<t_const_value*>::const_iterator v_iter;
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      if (first) {
        first = false;
      } else {
        render << ", ";
      }
      render << render_const_value(name, etype, *v_iter, true);
    }
    if (first)
      render << " nil]";
    else
      render << ", nil]";
  } else if (type->is_set()) {
    render << "[[NSSet alloc] initWithObjects: ";
    t_type * etype = ((t_set*)type)->get_elem_type();
    const vector<t_const_value*>& val = value->get_list();
    bool first = true;
    vector<t_const_value*>::const_iterator v_iter;
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      if (first) {
        first = false;
      } else {
        render << ", ";
      }
      render << render_const_value(name, etype, *v_iter, true);
    }
    if (first)
      render << " nil]";
    else
      render << ", nil]";
  } else {
    throw "don't know how to render constant for type: " + type->get_name();
  }

  if (box_it) {
    return box(type, render.str());
  }

  return render.str();
}
#endif

/**
 * Declares an Objective-C 2.0 property.
 *
 * @param tfield The field to declare a property for
 */
string t_cocoa_generator::declare_property(t_field* tfield) {
  std::ostringstream render;
  render << "@property (";

  if (type_can_be_null(tfield->get_type())) {
    render << "strong, ";
  } else {
    render << "assign, ";
  }

  render << "nonatomic) " << type_name(tfield->get_type(), false, true) << " "
  << tfield->get_name() << ";";

  // Check if the property name is an Objective-C return +1 count signal
  if ((tfield->get_name().length() >= 3 && tfield->get_name().substr(0,3) == "new") ||
      (tfield->get_name().length() >= 6 && tfield->get_name().substr(0,6) == "create") ||
      (tfield->get_name().length() >= 5 && tfield->get_name().substr(0,5) == "alloc")) {
    // Let Objective-C know not to return +1 for object pointers
    if (type_can_be_null(tfield->get_type())) {
      render << endl;
      render << "- (" + type_name(tfield->get_type()) + ") " + decapitalize(tfield->get_name()) + " __attribute__((objc_method_family(none)));";
    }
  }

  return render.str();
}

/**
 * Declares an Objective-C 2.0 property.
 *
 * @param tfield The field to declare a property for
 */
string t_cocoa_generator::declare_property_isset(t_field* tfield) {
  return "@property (assign, nonatomic) BOOL " + decapitalize(tfield->get_name()) + "IsSet;";
}

/**
 * Declares property unset method.
 *
 * @param tfield The field to declare a property for
 */
string t_cocoa_generator::declare_property_unset(t_field* tfield) {
  return "- (void) unset" + capitalize(tfield->get_name()) + ";";
}

/**
 * Renders the early out return statement
 *
 * @param tfunction Function definition
 * @return String of rendered invalid return statment
 */
string t_cocoa_generator::invalid_return_statement(t_function *tfunction) {
  if ((tfunction->get_returntype()->is_void())) {
    return "return NO;";
  }
  return "return nil;";
}

/**
 * Renders a function signature
 *
 * @param tfunction Function definition
 * @return String of rendered function definition
 */
string t_cocoa_generator::function_signature(t_function* tfunction, bool include_error) {
  t_type* ttype = tfunction->get_returntype();
  string result;
  if (ttype->is_void()) {
    result = "(BOOL)";
  }
  else if (type_can_be_null(ttype)) {
    result = "(" + type_name(ttype) + ")";
  }
  else {
    result = "(NSNumber *)";
  }
  result += " " + tfunction->get_name() + argument_list(tfunction->get_arglist(), "", include_error);
  return result;
}

/**
 * Renders a function signature that returns asynchronously instead of
 * literally returning.
 *
 * @param tfunction Function definition
 * @return String of rendered function definition
 */
string t_cocoa_generator::async_function_signature(t_function* tfunction, bool include_error) {
  t_type* ttype = tfunction->get_returntype();
  t_struct* targlist = tfunction->get_arglist();
  string response_param = "void (^)(" + ((ttype->is_void()) ? "" : type_name(ttype)) + ")";
  std::string result = "(void) " + tfunction->get_name() + argument_list(tfunction->get_arglist(), "", include_error)
  + (targlist->get_members().size() ? " response" : "") + ": ("
  + response_param + ") responseBlock "
  + "failure : (TAsyncFailureBlock) failureBlock";
  return result;
}

/**
 * Renders a function signature that returns a promise instead of
 * literally returning.
 *
 * @param tfunction Function definition
 * @return String of rendered function definition
 */
string t_cocoa_generator::promise_function_signature(t_function* tfunction) {
  return "(AnyPromise *) " + tfunction->get_name() + argument_list(tfunction->get_arglist(), "", false);
}

/**
 * Renders a colon separated list of types and names, suitable for an
 * objective-c parameter list
 */
string t_cocoa_generator::argument_list(t_struct* tstruct, string protocol_name, bool include_error) {
  string result = "";
  bool include_protocol = !protocol_name.empty();

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  bool first = true;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    string argPrefix = "";
    if (first) {
      first = false;
    } else {
      argPrefix = (*f_iter)->get_name();
      result += " ";
    }
    result += argPrefix + ": (" + type_name((*f_iter)->get_type()) + ") " + (*f_iter)->get_name();
  }
  if (include_protocol) {
    if (!first) {
      result += " protocol";
    }
    result += ": (id<TProtocol>) " + protocol_name;
    first = false;
  }
  if (include_error) {
    if (!first) {
      result += " error";
    }
    result += ": (NSError *__autoreleasing *)__thriftError";
    first = false;
  }
  return result;
}

/**
 * Converts the parse type to an Objective-C enum string for the given type.
 */
string t_cocoa_generator::type_to_enum(t_type* type) {
  type = get_true_type(type);

  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_VOID:
      throw "NO T_VOID CONSTRUCT";
    case t_base_type::TYPE_STRING:
      return "TTypeSTRING";
    case t_base_type::TYPE_BOOL:
      return "TTypeBOOL";
    case t_base_type::TYPE_I8:
      return "TTypeBYTE";
    case t_base_type::TYPE_I16:
      return "TTypeI16";
    case t_base_type::TYPE_I32:
      return "TTypeI32";
    case t_base_type::TYPE_I64:
      return "TTypeI64";
    case t_base_type::TYPE_DOUBLE:
      return "TTypeDOUBLE";
    }
  } else if (type->is_enum()) {
    return "TTypeI32";
  } else if (type->is_struct() || type->is_xception()) {
    return "TTypeSTRUCT";
  } else if (type->is_map()) {
    return "TTypeMAP";
  } else if (type->is_set()) {
    return "TTypeSET";
  } else if (type->is_list()) {
    return "TTypeLIST";
  }

  throw "INVALID TYPE IN type_to_enum: " + type->get_name();
}

/**
 * Returns a format string specifier for the supplied parse type.
 */
string t_cocoa_generator::format_string_for_type(t_type* type) {
  type = get_true_type(type);

  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_VOID:
      throw "NO T_VOID CONSTRUCT";
    case t_base_type::TYPE_STRING:
      return "\\\"%@\\\"";
    case t_base_type::TYPE_BOOL:
      return "%i";
    case t_base_type::TYPE_I8:
      return "%i";
    case t_base_type::TYPE_I16:
      return "%hi";
    case t_base_type::TYPE_I32:
      return "%i";
    case t_base_type::TYPE_I64:
      return "%qi";
    case t_base_type::TYPE_DOUBLE:
      return "%f";
    }
  } else if (type->is_enum()) {
    return "%i";
  } else if (type->is_struct() || type->is_xception()) {
    return "%@";
  } else if (type->is_map()) {
    return "%@";
  } else if (type->is_set()) {
    return "%@";
  } else if (type->is_list()) {
    return "%@";
  }

  throw "INVALID TYPE IN format_string_for_type: " + type->get_name();
}

/**
 * Returns a format cast for the supplied parse type.
 */
string t_cocoa_generator::format_cast_for_type(t_type* type) {
  type = get_true_type(type);

  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_VOID:
      throw "NO T_VOID CONSTRUCT";
    case t_base_type::TYPE_STRING:
      return ""; // "\\\"%@\\\"";
    case t_base_type::TYPE_BOOL:
      return ""; // "%i";
    case t_base_type::TYPE_I8:
      return ""; // "%i";
    case t_base_type::TYPE_I16:
      return ""; // "%hi";
    case t_base_type::TYPE_I32:
      return "(int)"; // "%i";
    case t_base_type::TYPE_I64:
      return ""; // "%qi";
    case t_base_type::TYPE_DOUBLE:
      return ""; // "%f";
    }
  } else if (type->is_enum()) {
    return "(int)"; // "%i";
  } else if (type->is_struct() || type->is_xception()) {
    return ""; // "%@";
  } else if (type->is_map()) {
    return ""; // "%@";
  } else if (type->is_set()) {
    return ""; // "%@";
  } else if (type->is_list()) {
    return ""; // "%@";
  }

  throw "INVALID TYPE IN format_cast_for_type: " + type->get_name();
}

/**
 * Generate a call to a field's setter.
 *
 * @param tfield Field the setter is being called on
 * @param fieldName Name of variable to pass to setter
 */

string t_cocoa_generator::call_field_setter(t_field* tfield, string fieldName) {
  return "self." + tfield->get_name() + " = " + fieldName + ";";
}

THRIFT_REGISTER_GENERATOR(
    cocoa,
    "Cocoa",
    "    log_unexpected:  Log every time an unexpected field ID or type is encountered.\n"
    "    debug_descriptions:\n"
    "                     Allow use of debugDescription so the app can add description via a cateogory/extension\n"
    "    validate_required:\n"
    "                     Throws exception if any required field is not set.\n"
    "    async_clients:   Generate clients which invoke asynchronously via block syntax.\n"
    "    pods:            Generate imports in Cocopods framework format.\n"
    "    promise_kit:     Generate clients which invoke asynchronously via promises.\n")
