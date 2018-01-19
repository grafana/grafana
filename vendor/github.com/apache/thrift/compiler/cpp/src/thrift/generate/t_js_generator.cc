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

#include <map>
#include <string>
#include <fstream>
#include <iostream>
#include <vector>
#include <list>
#include <cassert>

#include <stdlib.h>
#include <sys/stat.h>
#include <sstream>
#include "thrift/platform.h"
#include "thrift/version.h"

using std::map;
using std::ofstream;
using std::ostringstream;
using std::string;
using std::stringstream;
using std::vector;

static const string endl = "\n"; // avoid ostream << std::endl flushes

#include "thrift/generate/t_oop_generator.h"


/**
 * JS code generator.
 */
class t_js_generator : public t_oop_generator {
public:
  t_js_generator(t_program* program,
                 const std::map<std::string, std::string>& parsed_options,
                 const std::string& option_string)
    : t_oop_generator(program) {
    (void)option_string;
    std::map<std::string, std::string>::const_iterator iter;

    gen_node_ = false;
    gen_jquery_ = false;
    gen_ts_ = false;

    bool with_ns_ = false;

    for( iter = parsed_options.begin(); iter != parsed_options.end(); ++iter) {
      if( iter->first.compare("node") == 0) {
        gen_node_ = true;
      } else if( iter->first.compare("jquery") == 0) {
        gen_jquery_ = true;
      } else if( iter->first.compare("ts") == 0) {
        gen_ts_ = true;
      } else if( iter->first.compare("with_ns") == 0) {
        with_ns_ = true;
      } else {
        throw "unknown option js:" + iter->first;
      }
    }

    if (gen_node_ && gen_ts_) {
      throw "Invalid switch: [-gen js:node,ts] options not compatible";
    }

    if (gen_node_ && gen_jquery_) {
      throw "Invalid switch: [-gen js:node,jquery] options not compatible, try: [-gen js:node -gen "
            "js:jquery]";
    }

    if (!gen_node_ && with_ns_) {
      throw "Invalid switch: [-gen js:with_ns] is only valid when using node.js";
    }

    if (gen_node_) {
      out_dir_base_ = "gen-nodejs";
      no_ns_ = !with_ns_;
    } else {
      out_dir_base_ = "gen-js";
      no_ns_ = false;
    }

    escape_['\''] = "\\'";
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

  std::string render_recv_throw(std::string var);
  std::string render_recv_return(std::string var);

  std::string render_const_value(t_type* type, t_const_value* value);

  /**
   * Structs!
   */
  void generate_js_struct(t_struct* tstruct, bool is_exception);
  void generate_js_struct_definition(std::ofstream& out,
                                     t_struct* tstruct,
                                     bool is_xception = false,
                                     bool is_exported = true);
  void generate_js_struct_reader(std::ofstream& out, t_struct* tstruct);
  void generate_js_struct_writer(std::ofstream& out, t_struct* tstruct);
  void generate_js_function_helpers(t_function* tfunction);

  /**
   * Service-level generation functions
   */
  void generate_service_helpers(t_service* tservice);
  void generate_service_interface(t_service* tservice);
  void generate_service_rest(t_service* tservice);
  void generate_service_client(t_service* tservice);
  void generate_service_processor(t_service* tservice);
  void generate_process_function(t_service* tservice, t_function* tfunction);

  /**
   * Serialization constructs
   */

  void generate_deserialize_field(std::ofstream& out,
                                  t_field* tfield,
                                  std::string prefix = "",
                                  bool inclass = false);

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

  /**
   * Helper rendering functions
   */

  std::string js_includes();
  std::string render_includes();
  std::string declare_field(t_field* tfield, bool init = false, bool obj = false);
  std::string function_signature(t_function* tfunction,
                                 std::string prefix = "",
                                 bool include_callback = false);
  std::string argument_list(t_struct* tstruct, bool include_callback = false);
  std::string type_to_enum(t_type* ttype);
  std::string make_valid_nodeJs_identifier(std::string const& name);

  std::string autogen_comment() {
    return std::string("//\n") + "// Autogenerated by Thrift Compiler (" + THRIFT_VERSION + ")\n"
           + "//\n" + "// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING\n"
           + "//\n";
  }

  t_type* get_contained_type(t_type* t);

  std::vector<std::string> js_namespace_pieces(t_program* p) {
    std::string ns = p->get_namespace("js");

    std::string::size_type loc;
    std::vector<std::string> pieces;

    if (no_ns_) {
      return pieces;
    }

    if (ns.size() > 0) {
      while ((loc = ns.find(".")) != std::string::npos) {
        pieces.push_back(ns.substr(0, loc));
        ns = ns.substr(loc + 1);
      }
    }

    if (ns.size() > 0) {
      pieces.push_back(ns);
    }

    return pieces;
  }

  std::string js_type_namespace(t_program* p) {
    if (gen_node_) {
      if (p != NULL && p != program_) {
        return make_valid_nodeJs_identifier(p->get_name()) + "_ttypes.";
      }
      return "ttypes.";
    }
    return js_namespace(p);
  }

  std::string js_export_namespace(t_program* p) {
    if (gen_node_) {
      return "exports.";
    }
    return js_namespace(p);
  }

  bool has_js_namespace(t_program* p) {
    if (no_ns_) {
      return false;
    }
    std::string ns = p->get_namespace("js");
    return (ns.size() > 0);
  }

  std::string js_namespace(t_program* p) {
    if (no_ns_) {
      return "";
    }
    std::string ns = p->get_namespace("js");
    if (ns.size() > 0) {
      ns += ".";
    }

    return ns;
  }

  /**
   * TypeScript Definition File helper functions
   */

  string ts_function_signature(t_function* tfunction, bool include_callback);
  string ts_get_type(t_type* type);

  /**
   * Special indentation for TypeScript Definitions because of the module.
   * Returns the normal indentation + "  " if a module was defined.
   * @return string
   */
  string ts_indent() { return indent() + (!ts_module_.empty() ? "  " : ""); }

  /**
   * Returns "declare " if no module was defined.
   * @return string
   */
  string ts_declare() { return (ts_module_.empty() ? "declare " : ""); }

  /**
   * Returns "?" if the given field is optional.
   * @param t_field The field to check
   * @return string
   */
  string ts_get_req(t_field* field) { return (field->get_req() == t_field::T_OPTIONAL ? "?" : ""); }

  /**
   * Returns the documentation, if the provided documentable object has one.
   * @param t_doc The object to get the documentation from
   * @return string The documentation
   */
  string ts_print_doc(t_doc* tdoc) {
    string result = endl;

    if (tdoc->has_doc()) {
      std::stringstream doc(tdoc->get_doc());
      string item;

      result += ts_indent() + "/**" + endl;
      while (std::getline(doc, item)) {
        result += ts_indent() + " * " + item + endl;
      }
      result += ts_indent() + " */" + endl;
    }
    return result;
  }

private:
  /**
   * True if we should generate NodeJS-friendly RPC services.
   */
  bool gen_node_;

  /**
   * True if we should generate services that use jQuery ajax (async/sync).
   */
  bool gen_jquery_;

  /**
   * True if we should generate a TypeScript Definition File for each service.
   */
  bool gen_ts_;

  /**
   * The name of the defined module(s), for TypeScript Definition Files.
   */
  string ts_module_;

  /**
   * True if we should not generate namespace objects for node.
   */
  bool no_ns_;

  /**
   * File streams
   */
  std::ofstream f_types_;
  std::ofstream f_service_;
  std::ofstream f_types_ts_;
  std::ofstream f_service_ts_;
};

/**
 * Prepares for file generation by opening up the necessary file output
 * streams.
 *
 * @param tprogram The program to generate
 */
void t_js_generator::init_generator() {
  // Make output directory
  MKDIR(get_out_dir().c_str());

  string outdir = get_out_dir();

  // Make output file(s)
  string f_types_name = outdir + program_->get_name() + "_types.js";
  f_types_.open(f_types_name.c_str());

  if (gen_ts_) {
    string f_types_ts_name = outdir + program_->get_name() + "_types.d.ts";
    f_types_ts_.open(f_types_ts_name.c_str());
  }

  // Print header
  f_types_ << autogen_comment();

  if (gen_node_ && no_ns_) {
    f_types_ << "\"use strict\";" << endl << endl;
  }

  f_types_ << js_includes() << endl << render_includes() << endl;

  if (gen_ts_) {
    f_types_ts_ << autogen_comment() << endl;
  }

  if (gen_node_) {
    f_types_ << "var ttypes = module.exports = {};" << endl;
  }

  string pns;

  // setup the namespace
  // TODO should the namespace just be in the directory structure for node?
  vector<string> ns_pieces = js_namespace_pieces(program_);
  if (ns_pieces.size() > 0) {
    for (size_t i = 0; i < ns_pieces.size(); ++i) {
      pns += ((i == 0) ? "" : ".") + ns_pieces[i];
      f_types_ << "if (typeof " << pns << " === 'undefined') {" << endl;
      f_types_ << "  " << pns << " = {};" << endl;
      f_types_ << "}" << endl;
    }
    if (gen_ts_) {
      ts_module_ = pns;
      f_types_ts_ << "declare module " << ts_module_ << " {";
    }
  }
}

/**
 * Prints standard js imports
 */
string t_js_generator::js_includes() {
  if (gen_node_) {
    return string(
        "var thrift = require('thrift');\n"
        "var Thrift = thrift.Thrift;\n"
        "var Q = thrift.Q;\n");
  }

  return "";
}

/**
 * Renders all the imports necessary for including another Thrift program
 */
string t_js_generator::render_includes() {
  string result = "";

  if (gen_node_) {
    const vector<t_program*>& includes = program_->get_includes();
    for (size_t i = 0; i < includes.size(); ++i) {
      result += "var " + make_valid_nodeJs_identifier(includes[i]->get_name()) + "_ttypes = require('./" + includes[i]->get_name()
                + "_types');\n";
    }
    if (includes.size() > 0) {
      result += "\n";
    }
  }

  return result;
}

/**
 * Close up (or down) some filez.
 */
void t_js_generator::close_generator() {
  // Close types file(s)

  f_types_.close();

  if (gen_ts_) {
    if (!ts_module_.empty()) {
      f_types_ts_ << "}";
    }
    f_types_ts_.close();
  }
}

/**
 * Generates a typedef. This is not done in JS, types are all implicit.
 *
 * @param ttypedef The type definition
 */
void t_js_generator::generate_typedef(t_typedef* ttypedef) {
  (void)ttypedef;
}

/**
 * Generates code for an enumerated type. Since define is expensive to lookup
 * in JS, we use a global array for this.
 *
 * @param tenum The enumeration
 */
void t_js_generator::generate_enum(t_enum* tenum) {
  f_types_ << js_type_namespace(tenum->get_program()) << tenum->get_name() << " = {" << endl;

  if (gen_ts_) {
    f_types_ts_ << ts_print_doc(tenum) << ts_indent() << ts_declare() << "enum "
                << tenum->get_name() << " {" << endl;
  }

  indent_up();

  vector<t_enum_value*> constants = tenum->get_constants();
  vector<t_enum_value*>::iterator c_iter;
  for (c_iter = constants.begin(); c_iter != constants.end(); ++c_iter) {
    int value = (*c_iter)->get_value();
    if (gen_ts_) {
      f_types_ts_ << ts_indent() << (*c_iter)->get_name() << " = " << value << "," << endl;
      // add 'value: key' in addition to 'key: value' for TypeScript enums
      f_types_ << indent() << "'" << value << "' : '" << (*c_iter)->get_name() << "'," << endl;
    }
    f_types_ << indent() << "'" << (*c_iter)->get_name() << "' : " << value;
    if (c_iter != constants.end() - 1) {
      f_types_ << ",";
    }
    f_types_ << endl;
  }

  indent_down();

  f_types_ << "};" << endl;

  if (gen_ts_) {
    f_types_ts_ << ts_indent() << "}" << endl;
  }
}

/**
 * Generate a constant value
 */
void t_js_generator::generate_const(t_const* tconst) {
  t_type* type = tconst->get_type();
  string name = tconst->get_name();
  t_const_value* value = tconst->get_value();

  f_types_ << js_type_namespace(program_) << name << " = ";
  f_types_ << render_const_value(type, value) << ";" << endl;

  if (gen_ts_) {
    f_types_ts_ << ts_print_doc(tconst) << ts_indent() << ts_declare() << "var " << name << ": "
                << ts_get_type(type) << ";" << endl;
  }
}

/**
 * Prints the value of a constant with the given type. Note that type checking
 * is NOT performed in this function as it is always run beforehand using the
 * validate_types method in main.cc
 */
string t_js_generator::render_const_value(t_type* type, t_const_value* value) {
  std::ostringstream out;

  type = get_true_type(type);

  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_STRING:
      out << "'" << get_escaped_string(value) << "'";
      break;
    case t_base_type::TYPE_BOOL:
      out << (value->get_integer() > 0 ? "true" : "false");
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
    out << "new " << js_type_namespace(type->get_program()) << type->get_name() << "({" << endl;
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
      if (v_iter != val.begin())
        out << ",";
      out << render_const_value(g_type_string, v_iter->first);
      out << " : ";
      out << render_const_value(field_type, v_iter->second);
    }

    out << "})";
  } else if (type->is_map()) {
    t_type* ktype = ((t_map*)type)->get_key_type();

    t_type* vtype = ((t_map*)type)->get_val_type();
    out << "{" << endl;
    indent_up();

    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      if (v_iter != val.begin())
        out << "," << endl;

      out << indent() << render_const_value(ktype, v_iter->first);

      out << " : ";
      out << render_const_value(vtype, v_iter->second);
    }

    indent_down();
    out << endl << "}";
  } else if (type->is_list() || type->is_set()) {
    t_type* etype;
    if (type->is_list()) {
      etype = ((t_list*)type)->get_elem_type();
    } else {
      etype = ((t_set*)type)->get_elem_type();
    }
    out << "[";
    const vector<t_const_value*>& val = value->get_list();
    vector<t_const_value*>::const_iterator v_iter;
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      if (v_iter != val.begin())
        out << ",";
      out << render_const_value(etype, *v_iter);
    }
    out << "]";
  }
  return out.str();
}

/**
 * Make a struct
 */
void t_js_generator::generate_struct(t_struct* tstruct) {
  generate_js_struct(tstruct, false);
}

/**
 * Generates a struct definition for a thrift exception. Basically the same
 * as a struct but extends the Exception class.
 *
 * @param txception The struct definition
 */
void t_js_generator::generate_xception(t_struct* txception) {
  generate_js_struct(txception, true);
}

/**
 * Structs can be normal or exceptions.
 */
void t_js_generator::generate_js_struct(t_struct* tstruct, bool is_exception) {
  generate_js_struct_definition(f_types_, tstruct, is_exception);
}

/**
 * Return type of contained elements for a container type. For maps
 * this is type of value (keys are always strings in js)
 */
t_type* t_js_generator::get_contained_type(t_type* t) {
  t_type* etype;
  if (t->is_list()) {
    etype = ((t_list*)t)->get_elem_type();
  } else if (t->is_set()) {
    etype = ((t_set*)t)->get_elem_type();
  } else {
    etype = ((t_map*)t)->get_val_type();
  }
  return etype;
}

/**
 * Generates a struct definition for a thrift data type. This is nothing in JS
 * where the objects are all just associative arrays (unless of course we
 * decide to start using objects for them...)
 *
 * @param tstruct The struct definition
 */
void t_js_generator::generate_js_struct_definition(ofstream& out,
                                                   t_struct* tstruct,
                                                   bool is_exception,
                                                   bool is_exported) {
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  if (gen_node_) {
    string prefix = has_js_namespace(tstruct->get_program()) ? js_namespace(tstruct->get_program()) : "var ";
    if (is_exported) {
      out << prefix << tstruct->get_name() << " = "
          << "module.exports." << tstruct->get_name() << " = function(args) {" << endl;
    } else {
      out << prefix << tstruct->get_name() << " = function(args) {"
          << endl;
    }
  } else {
    out << js_namespace(tstruct->get_program()) << tstruct->get_name() << " = function(args) {"
        << endl;
    if (gen_ts_) {
      f_types_ts_ << ts_print_doc(tstruct) << ts_indent() << ts_declare() << "class "
                  << tstruct->get_name() << (is_exception ? " extends Thrift.TException" : "")
                  << " {" << endl;
    }
  }

  indent_up();

  if (gen_node_ && is_exception) {
    out << indent() << "Thrift.TException.call(this, \"" << js_namespace(tstruct->get_program())
        << tstruct->get_name() << "\");" << endl;
    out << indent() << "this.name = \"" << js_namespace(tstruct->get_program())
        << tstruct->get_name() << "\";" << endl;
  }

  // members with arguments
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    string dval = declare_field(*m_iter, false, true);
    t_type* t = get_true_type((*m_iter)->get_type());
    if ((*m_iter)->get_value() != NULL && !(t->is_struct() || t->is_xception())) {
      dval = render_const_value((*m_iter)->get_type(), (*m_iter)->get_value());
      out << indent() << "this." << (*m_iter)->get_name() << " = " << dval << ";" << endl;
    } else {
      out << indent() << dval << ";" << endl;
    }
    if (gen_ts_) {
      f_types_ts_ << ts_indent() << (*m_iter)->get_name() << ": "
                  << ts_get_type((*m_iter)->get_type()) << ";" << endl;
    }
  }

  // Generate constructor from array
  if (members.size() > 0) {

    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      t_type* t = get_true_type((*m_iter)->get_type());
      if ((*m_iter)->get_value() != NULL && (t->is_struct() || t->is_xception())) {
        indent(out) << "this." << (*m_iter)->get_name() << " = "
                    << render_const_value(t, (*m_iter)->get_value()) << ";" << endl;
      }
    }

    // Early returns for exceptions
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      t_type* t = get_true_type((*m_iter)->get_type());
      if (t->is_xception()) {
        out << indent() << "if (args instanceof " << js_type_namespace(t->get_program())
            << t->get_name() << ") {" << endl << indent() << indent() << "this."
            << (*m_iter)->get_name() << " = args;" << endl << indent() << indent() << "return;"
            << endl << indent() << "}" << endl;
      }
    }

    out << indent() << "if (args) {" << endl;
    if (gen_ts_) {
      f_types_ts_ << endl << ts_indent() << "constructor(args?: { ";
    }

    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      t_type* t = get_true_type((*m_iter)->get_type());
      out << indent() << indent() << "if (args." << (*m_iter)->get_name() << " !== undefined && args." << (*m_iter)->get_name() << " !== null) {"
          << endl << indent() << indent() << indent() << "this." << (*m_iter)->get_name();

      if (t->is_struct()) {
        out << (" = new " + js_type_namespace(t->get_program()) + t->get_name() +
                "(args."+(*m_iter)->get_name() +");");
        out << endl;
      } else if (t->is_container()) {
        t_type* etype = get_contained_type(t);
        string copyFunc = t->is_map() ? "Thrift.copyMap" : "Thrift.copyList";
        string type_list = "";

        while (etype->is_container()) {
          if (type_list.length() > 0) {
            type_list += ", ";
          }
          type_list += etype->is_map() ? "Thrift.copyMap" : "Thrift.copyList";
          etype = get_contained_type(etype);
        }

        if (etype->is_struct()) {
          if (type_list.length() > 0) {
            type_list += ", ";
          }
          type_list += js_type_namespace(etype->get_program()) + etype->get_name();
        }
        else {
          if (type_list.length() > 0) {
            type_list += ", ";
          }
          type_list += "null";
        }

        out << (" = " + copyFunc + "(args." + (*m_iter)->get_name() +
                ", [" + type_list + "]);");
        out << endl;
      } else {
        out << " = args." << (*m_iter)->get_name() << ";" << endl;
      }

      if (!(*m_iter)->get_req()) {
        out << indent() << indent() << "} else {" << endl << indent() << indent() << indent()
            << "throw new Thrift.TProtocolException(Thrift.TProtocolExceptionType.UNKNOWN, "
               "'Required field " << (*m_iter)->get_name() << " is unset!');" << endl;
      }
      out << indent() << indent() << "}" << endl;
      if (gen_ts_) {
        f_types_ts_ << (*m_iter)->get_name() << ts_get_req(*m_iter) << ": "
                    << ts_get_type((*m_iter)->get_type()) << "; ";
      }
    }

    out << indent() << "}" << endl;
    if (gen_ts_) {
      f_types_ts_ << "});" << endl;
    }
  }

  indent_down();
  out << "};" << endl;
  if (gen_ts_) {
    f_types_ts_ << ts_indent() << "}" << endl;
  }

  if (is_exception) {
    out << "Thrift.inherits(" << js_namespace(tstruct->get_program()) << tstruct->get_name()
        << ", Thrift.TException);" << endl;
    out << js_namespace(tstruct->get_program()) << tstruct->get_name() << ".prototype.name = '"
        << tstruct->get_name() << "';" << endl;
  } else {
    // init prototype
    out << js_namespace(tstruct->get_program()) << tstruct->get_name() << ".prototype = {};"
        << endl;
  }

  generate_js_struct_reader(out, tstruct);
  generate_js_struct_writer(out, tstruct);
}

/**
 * Generates the read() method for a struct
 */
void t_js_generator::generate_js_struct_reader(ofstream& out, t_struct* tstruct) {
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  out << js_namespace(tstruct->get_program()) << tstruct->get_name()
      << ".prototype.read = function(input) {" << endl;

  indent_up();

  indent(out) << "input.readStructBegin();" << endl;

  // Loop over reading in fields
  indent(out) << "while (true)" << endl;

  scope_up(out);

  indent(out) << "var ret = input.readFieldBegin();" << endl;
  indent(out) << "var fname = ret.fname;" << endl;
  indent(out) << "var ftype = ret.ftype;" << endl;
  indent(out) << "var fid = ret.fid;" << endl;

  // Check for field STOP marker and break
  indent(out) << "if (ftype == Thrift.Type.STOP) {" << endl;
  indent_up();
  indent(out) << "break;" << endl;
  indent_down();
  indent(out) << "}" << endl;
  if (!fields.empty()) {
    // Switch statement on the field we are reading
    indent(out) << "switch (fid)" << endl;

    scope_up(out);

    // Generate deserialization code for known cases
    for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {

      indent(out) << "case " << (*f_iter)->get_key() << ":" << endl;
      indent(out) << "if (ftype == " << type_to_enum((*f_iter)->get_type()) << ") {" << endl;

      indent_up();
      generate_deserialize_field(out, *f_iter, "this.");
      indent_down();

      indent(out) << "} else {" << endl;

      indent(out) << "  input.skip(ftype);" << endl;

      out << indent() << "}" << endl << indent() << "break;" << endl;
    }
    if (fields.size() == 1) {
      // pseudo case to make jslint happy
      indent(out) << "case 0:" << endl;
      indent(out) << "  input.skip(ftype);" << endl;
      indent(out) << "  break;" << endl;
    }
    // In the default case we skip the field
    indent(out) << "default:" << endl;
    indent(out) << "  input.skip(ftype);" << endl;

    scope_down(out);
  } else {
    indent(out) << "input.skip(ftype);" << endl;
  }

  indent(out) << "input.readFieldEnd();" << endl;

  scope_down(out);

  indent(out) << "input.readStructEnd();" << endl;

  indent(out) << "return;" << endl;

  indent_down();
  out << indent() << "};" << endl << endl;
}

/**
 * Generates the write() method for a struct
 */
void t_js_generator::generate_js_struct_writer(ofstream& out, t_struct* tstruct) {
  string name = tstruct->get_name();
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  out << js_namespace(tstruct->get_program()) << tstruct->get_name()
      << ".prototype.write = function(output) {" << endl;

  indent_up();

  indent(out) << "output.writeStructBegin('" << name << "');" << endl;

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    out << indent() << "if (this." << (*f_iter)->get_name() << " !== null && this."
        << (*f_iter)->get_name() << " !== undefined) {" << endl;
    indent_up();

    indent(out) << "output.writeFieldBegin("
                << "'" << (*f_iter)->get_name() << "', " << type_to_enum((*f_iter)->get_type())
                << ", " << (*f_iter)->get_key() << ");" << endl;

    // Write field contents
    generate_serialize_field(out, *f_iter, "this.");

    indent(out) << "output.writeFieldEnd();" << endl;

    indent_down();
    indent(out) << "}" << endl;
  }

  out << indent() << "output.writeFieldStop();" << endl << indent() << "output.writeStructEnd();"
      << endl;

  out << indent() << "return;" << endl;

  indent_down();
  out << indent() << "};" << endl << endl;
}

/**
 * Generates a thrift service.
 *
 * @param tservice The service definition
 */
void t_js_generator::generate_service(t_service* tservice) {
  string f_service_name = get_out_dir() + service_name_ + ".js";
  f_service_.open(f_service_name.c_str());

  if (gen_ts_) {
    string f_service_ts_name = get_out_dir() + service_name_ + ".d.ts";
    f_service_ts_.open(f_service_ts_name.c_str());
  }

  f_service_ << autogen_comment();

  if (gen_node_ && no_ns_) {
    f_service_ << "\"use strict\";" << endl << endl;
  }

  f_service_ << js_includes() << endl << render_includes() << endl;

  if (gen_ts_) {
    if (tservice->get_extends() != NULL) {
      f_service_ts_ << "/// <reference path=\"" << tservice->get_extends()->get_name()
                    << ".d.ts\" />" << endl;
    }
    f_service_ts_ << autogen_comment() << endl;
    if (!ts_module_.empty()) {
      f_service_ts_ << "declare module " << ts_module_ << " {";
    }
  }

  if (gen_node_) {
    if (tservice->get_extends() != NULL) {
      f_service_ << "var " << tservice->get_extends()->get_name() << " = require('./"
                 << tservice->get_extends()->get_name() << "');" << endl << "var "
                 << tservice->get_extends()->get_name()
                 << "Client = " << tservice->get_extends()->get_name() << ".Client;" << endl
                 << "var " << tservice->get_extends()->get_name()
                 << "Processor = " << tservice->get_extends()->get_name() << ".Processor;" << endl;
    }

    f_service_ << "var ttypes = require('./" + program_->get_name() + "_types');" << endl;
  }

  generate_service_helpers(tservice);
  generate_service_interface(tservice);
  generate_service_client(tservice);

  if (gen_node_) {
    generate_service_processor(tservice);
  }

  f_service_.close();
  if (gen_ts_) {
    if (!ts_module_.empty()) {
      f_service_ts_ << "}";
    }
    f_service_ts_.close();
  }
}

/**
 * Generates a service server definition.
 *
 * @param tservice The service to generate a server for.
 */
void t_js_generator::generate_service_processor(t_service* tservice) {
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;

  if (gen_node_) {
    string prefix = has_js_namespace(tservice->get_program()) ? js_namespace(tservice->get_program()) : "var ";
    f_service_ << prefix << service_name_ << "Processor = " << "exports.Processor = function(handler) ";
  } else {
    f_service_ << js_namespace(tservice->get_program()) << service_name_ << "Processor = "
             << "exports.Processor = function(handler) ";
  }

  scope_up(f_service_);

  f_service_ << indent() << "this._handler = handler;" << endl;

  scope_down(f_service_);
  f_service_ << ";" << endl;

  if (tservice->get_extends() != NULL) {
    indent(f_service_) << "Thrift.inherits(" << js_namespace(tservice->get_program())
                       << service_name_ << "Processor, " << tservice->get_extends()->get_name()
                       << "Processor);" << endl;
  }

  // Generate the server implementation
  indent(f_service_) << js_namespace(tservice->get_program()) << service_name_
                     << "Processor.prototype.process = function(input, output) ";

  scope_up(f_service_);

  f_service_ << indent() << "var r = input.readMessageBegin();" << endl << indent()
             << "if (this['process_' + r.fname]) {" << endl << indent()
             << "  return this['process_' + r.fname].call(this, r.rseqid, input, output);" << endl
             << indent() << "} else {" << endl << indent() << "  input.skip(Thrift.Type.STRUCT);"
             << endl << indent() << "  input.readMessageEnd();" << endl << indent()
             << "  var x = new "
                "Thrift.TApplicationException(Thrift.TApplicationExceptionType.UNKNOWN_METHOD, "
                "'Unknown function ' + r.fname);" << endl << indent()
             << "  output.writeMessageBegin(r.fname, Thrift.MessageType.EXCEPTION, r.rseqid);"
             << endl << indent() << "  x.write(output);" << endl << indent()
             << "  output.writeMessageEnd();" << endl << indent() << "  output.flush();" << endl
             << indent() << "}" << endl;

  scope_down(f_service_);
  f_service_ << ";" << endl;

  // Generate the process subfunctions
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    generate_process_function(tservice, *f_iter);
  }
}

/**
 * Generates a process function definition.
 *
 * @param tfunction The function to write a dispatcher for
 */
void t_js_generator::generate_process_function(t_service* tservice, t_function* tfunction) {
  indent(f_service_) << js_namespace(tservice->get_program()) << service_name_
                     << "Processor.prototype.process_" + tfunction->get_name()
                        + " = function(seqid, input, output) ";

  scope_up(f_service_);

  string argsname = js_namespace(program_) + service_name_ + "_" + tfunction->get_name() + "_args";
  string resultname = js_namespace(program_) + service_name_ + "_" + tfunction->get_name()
                      + "_result";

  f_service_ << indent() << "var args = new " << argsname << "();" << endl << indent()
             << "args.read(input);" << endl << indent() << "input.readMessageEnd();" << endl;

  // Generate the function call
  t_struct* arg_struct = tfunction->get_arglist();
  const std::vector<t_field*>& fields = arg_struct->get_members();
  vector<t_field*>::const_iterator f_iter;

  // Shortcut out here for oneway functions
  if (tfunction->is_oneway()) {
    indent(f_service_) << "this._handler." << tfunction->get_name() << "(";

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
    scope_down(f_service_);
    f_service_ << ";" << endl;
    return;
  }

  f_service_ << indent() << "if (this._handler." << tfunction->get_name()
             << ".length === " << fields.size() << ") {" << endl;
  indent_up();
  indent(f_service_) << "Q.fcall(this._handler." << tfunction->get_name();

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    f_service_ << ", args." << (*f_iter)->get_name();
  }

  f_service_ << ")" << endl;
  indent_up();
  indent(f_service_) << ".then(function(result) {" << endl;
  indent_up();
  f_service_ << indent() << "var result_obj = new " << resultname << "({success: result});" << endl
             << indent() << "output.writeMessageBegin(\"" << tfunction->get_name()
             << "\", Thrift.MessageType.REPLY, seqid);" << endl << indent()
             << "result_obj.write(output);" << endl << indent() << "output.writeMessageEnd();" << endl
             << indent() << "output.flush();" << endl;
  indent_down();
  indent(f_service_) << "}, function (err) {" << endl;
  indent_up();
  indent(f_service_) << "var result;" << endl;

  bool has_exception = false;
  t_struct* exceptions = tfunction->get_xceptions();
  if (exceptions) {
    const vector<t_field*>& members = exceptions->get_members();
    for (vector<t_field*>::const_iterator it = members.begin(); it != members.end(); ++it) {
      t_type* t = get_true_type((*it)->get_type());
      if (t->is_xception()) {
        if (!has_exception) {
          has_exception = true;
          indent(f_service_) << "if (err instanceof " << js_type_namespace(t->get_program())
                             << t->get_name();
        } else {
          f_service_ << " || err instanceof " << js_type_namespace(t->get_program())
                     << t->get_name();
        }
      }
    }
  }

  if (has_exception) {
    f_service_ << ") {" << endl;
    indent_up();
    f_service_ << indent() << "result = new " << resultname << "(err);" << endl << indent()
               << "output.writeMessageBegin(\"" << tfunction->get_name()
               << "\", Thrift.MessageType.REPLY, seqid);" << endl;

    indent_down();
    indent(f_service_) << "} else {" << endl;
    indent_up();
  }

  f_service_ << indent() << "result = new "
                            "Thrift.TApplicationException(Thrift.TApplicationExceptionType.UNKNOWN,"
                            " err.message);" << endl << indent() << "output.writeMessageBegin(\""
             << tfunction->get_name() << "\", Thrift.MessageType.EXCEPTION, seqid);" << endl;

  if (has_exception) {
    indent_down();
    indent(f_service_) << "}" << endl;
  }

  f_service_ << indent() << "result.write(output);" << endl << indent()
             << "output.writeMessageEnd();" << endl << indent() << "output.flush();" << endl;
  indent_down();
  indent(f_service_) << "});" << endl;
  indent_down();
  indent_down();
  indent(f_service_) << "} else {" << endl;
  indent_up();
  indent(f_service_) << "this._handler." << tfunction->get_name() << "(";

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    f_service_ << "args." << (*f_iter)->get_name() << ", ";
  }

  f_service_ << "function (err, result) {" << endl;
  indent_up();
  indent(f_service_) << "var result_obj;" << endl;

  indent(f_service_) << "if ((err === null || typeof err === 'undefined')";
  if (has_exception) {
    const vector<t_field*>& members = exceptions->get_members();
    for (vector<t_field*>::const_iterator it = members.begin(); it != members.end(); ++it) {
      t_type* t = get_true_type((*it)->get_type());
      if (t->is_xception()) {
        f_service_ << " || err instanceof " << js_type_namespace(t->get_program()) << t->get_name();
      }
    }
  }
  f_service_ << ") {" << endl;
  indent_up();
  f_service_ << indent() << "result_obj = new " << resultname
             << "((err !== null || typeof err === 'undefined') ? err : {success: result});" << endl << indent()
             << "output.writeMessageBegin(\"" << tfunction->get_name()
             << "\", Thrift.MessageType.REPLY, seqid);" << endl;
  indent_down();
  indent(f_service_) << "} else {" << endl;
  indent_up();
  f_service_ << indent() << "result_obj = new "
                            "Thrift.TApplicationException(Thrift.TApplicationExceptionType.UNKNOWN,"
                            " err.message);" << endl << indent() << "output.writeMessageBegin(\""
             << tfunction->get_name() << "\", Thrift.MessageType.EXCEPTION, seqid);" << endl;
  indent_down();
  f_service_ << indent() << "}" << endl << indent() << "result_obj.write(output);" << endl << indent()
             << "output.writeMessageEnd();" << endl << indent() << "output.flush();" << endl;

  indent_down();
  indent(f_service_) << "});" << endl;
  indent_down();
  indent(f_service_) << "}" << endl;
  indent_down();
  indent(f_service_) << "};" << endl;
}

/**
 * Generates helper functions for a service.
 *
 * @param tservice The service to generate a header definition for
 */
void t_js_generator::generate_service_helpers(t_service* tservice) {
  // Do not generate TS definitions for helper functions
  bool gen_ts_tmp = gen_ts_;
  gen_ts_ = false;

  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;

  f_service_ << "//HELPER FUNCTIONS AND STRUCTURES" << endl << endl;

  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    t_struct* ts = (*f_iter)->get_arglist();
    string name = ts->get_name();
    ts->set_name(service_name_ + "_" + name);
    generate_js_struct_definition(f_service_, ts, false, false);
    generate_js_function_helpers(*f_iter);
    ts->set_name(name);
  }

  gen_ts_ = gen_ts_tmp;
}

/**
 * Generates a struct and helpers for a function.
 *
 * @param tfunction The function
 */
void t_js_generator::generate_js_function_helpers(t_function* tfunction) {
  t_struct result(program_, service_name_ + "_" + tfunction->get_name() + "_result");
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

  generate_js_struct_definition(f_service_, &result, false, false);
}

/**
 * Generates a service interface definition.
 *
 * @param tservice The service to generate a header definition for
 */
void t_js_generator::generate_service_interface(t_service* tservice) {
  (void)tservice;
}

/**
 * Generates a REST interface
 */
void t_js_generator::generate_service_rest(t_service* tservice) {
  (void)tservice;
}

/**
 * Generates a service client definition.
 *
 * @param tservice The service to generate a server for.
 */
void t_js_generator::generate_service_client(t_service* tservice) {
  if (gen_node_) {
    string prefix = has_js_namespace(tservice->get_program()) ? js_namespace(tservice->get_program()) : "var ";
    f_service_ << prefix << service_name_ << "Client = "
               << "exports.Client = function(output, pClass) {" << endl;
  } else {
    f_service_ << js_namespace(tservice->get_program()) << service_name_
               << "Client = function(input, output) {" << endl;
    if (gen_ts_) {
      f_service_ts_ << ts_print_doc(tservice) << ts_indent() << ts_declare() << "class "
                    << service_name_ << "Client ";
      if (tservice->get_extends() != NULL) {
        f_service_ts_ << "extends " << tservice->get_extends()->get_name() << "Client ";
      }
      f_service_ts_ << "{" << endl;
    }
  }

  indent_up();

  if (gen_node_) {
    f_service_ << indent() << "  this.output = output;" << endl << indent()
               << "  this.pClass = pClass;" << endl << indent() << "  this._seqid = 0;" << endl
               << indent() << "  this._reqs = {};" << endl;
  } else {
    f_service_ << indent() << "  this.input = input;" << endl << indent()
               << "  this.output = (!output) ? input : output;" << endl << indent()
               << "  this.seqid = 0;" << endl;
    if (gen_ts_) {
      f_service_ts_ << ts_indent() << "input: Thrift.TJSONProtocol;" << endl << ts_indent()
                    << "output: Thrift.TJSONProtocol;" << endl << ts_indent() << "seqid: number;"
                    << endl << endl << ts_indent()
                    << "constructor(input: Thrift.TJSONProtocol, output?: Thrift.TJSONProtocol);"
                    << endl;
    }
  }

  indent_down();

  f_service_ << indent() << "};" << endl;

  if (tservice->get_extends() != NULL) {
    indent(f_service_) << "Thrift.inherits(" << js_namespace(tservice->get_program())
                       << service_name_ << "Client, "
                       << js_namespace(tservice->get_extends()->get_program())
                       << tservice->get_extends()->get_name() << "Client);" << endl;
  } else {
    // init prototype
    indent(f_service_) << js_namespace(tservice->get_program()) << service_name_
                       << "Client.prototype = {};" << endl;
  }

  // utils for multiplexed services
  if (gen_node_) {
    indent(f_service_) << js_namespace(tservice->get_program()) << service_name_
                       << "Client.prototype.seqid = function() { return this._seqid; };" << endl
                       << js_namespace(tservice->get_program()) << service_name_
                       << "Client.prototype.new_seqid = function() { return this._seqid += 1; };"
                       << endl;
  }
  // Generate client method implementations
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::const_iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    t_struct* arg_struct = (*f_iter)->get_arglist();
    const vector<t_field*>& fields = arg_struct->get_members();
    vector<t_field*>::const_iterator fld_iter;
    string funname = (*f_iter)->get_name();
    string arglist = argument_list(arg_struct);

    // Open function
    f_service_ << js_namespace(tservice->get_program()) << service_name_ << "Client.prototype."
               << function_signature(*f_iter, "", true) << " {" << endl;

    indent_up();

    if (gen_ts_) {
      f_service_ts_ << ts_print_doc(*f_iter) <<
          // function definition without callback
          ts_indent() << ts_function_signature(*f_iter, false) << endl << ts_print_doc(*f_iter) <<
          // overload with callback
          ts_indent() << ts_function_signature(*f_iter, true) << endl;
    }

    if (gen_node_) { // Node.js output      ./gen-nodejs
      f_service_ << indent() << "this._seqid = this.new_seqid();" << endl << indent()
                 << "if (callback === undefined) {" << endl;
      indent_up();
      f_service_ << indent() << "var _defer = Q.defer();" << endl << indent()
                 << "this._reqs[this.seqid()] = function(error, result) {" << endl;
      indent_up();
      indent(f_service_) << "if (error) {" << endl;
      indent_up();
      indent(f_service_) << "_defer.reject(error);" << endl;
      indent_down();
      indent(f_service_) << "} else {" << endl;
      indent_up();
      indent(f_service_) << "_defer.resolve(result);" << endl;
      indent_down();
      indent(f_service_) << "}" << endl;
      indent_down();
      indent(f_service_) << "};" << endl;
      f_service_ << indent() << "this.send_" << funname << "(" << arglist << ");" << endl
                 << indent() << "return _defer.promise;" << endl;
      indent_down();
      indent(f_service_) << "} else {" << endl;
      indent_up();
      f_service_ << indent() << "this._reqs[this.seqid()] = callback;" << endl << indent()
                 << "this.send_" << funname << "(" << arglist << ");" << endl;
      indent_down();
      indent(f_service_) << "}" << endl;
    } else if (gen_jquery_) { // jQuery output       ./gen-js
      f_service_ << indent() << "if (callback === undefined) {" << endl;
      indent_up();
      f_service_ << indent() << "this.send_" << funname << "(" << arglist << ");" << endl;
      if (!(*f_iter)->is_oneway()) {
        f_service_ << indent();
        if (!(*f_iter)->get_returntype()->is_void()) {
          f_service_ << "return ";
        }
        f_service_ << "this.recv_" << funname << "();" << endl;
      }
      indent_down();
      f_service_ << indent() << "} else {" << endl;
      indent_up();
      f_service_ << indent() << "var postData = this.send_" << funname << "(" << arglist
                 << (arglist.empty() ? "" : ", ") << "true);" << endl;
      f_service_ << indent() << "return this.output.getTransport()" << endl;
      indent_up();
      f_service_ << indent() << ".jqRequest(this, postData, arguments, this.recv_" << funname
                 << ");" << endl;
      indent_down();
      indent_down();
      f_service_ << indent() << "}" << endl;
    } else { // Standard JavaScript ./gen-js
      f_service_ << indent() << "this.send_" << funname << "(" << arglist
                 << (arglist.empty() ? "" : ", ") << "callback); " << endl;
      if (!(*f_iter)->is_oneway()) {
        f_service_ << indent() << "if (!callback) {" << endl;
        f_service_ << indent();
        if (!(*f_iter)->get_returntype()->is_void()) {
          f_service_ << "  return ";
        }
        f_service_ << "this.recv_" << funname << "();" << endl;
        f_service_ << indent() << "}" << endl;
      }
    }

    indent_down();

    f_service_ << "};" << endl << endl;

    // Send function
    f_service_ << js_namespace(tservice->get_program()) << service_name_ << "Client.prototype.send_"
               << function_signature(*f_iter, "", !gen_node_) << " {" << endl;

    indent_up();

    std::string outputVar;
    if (gen_node_) {
      f_service_ << indent() << "var output = new this.pClass(this.output);" << endl;
      outputVar = "output";
    } else {
      outputVar = "this.output";
    }

    std::string argsname = js_namespace(program_) + service_name_ + "_" + (*f_iter)->get_name()
                           + "_args";

    std::string messageType = (*f_iter)->is_oneway() ? "Thrift.MessageType.ONEWAY"
                                                     : "Thrift.MessageType.CALL";

    // Serialize the request header
    if (gen_node_) {
      f_service_ << indent() << outputVar << ".writeMessageBegin('" << (*f_iter)->get_name()
                 << "', " << messageType << ", this.seqid());" << endl;
    } else {
      f_service_ << indent() << outputVar << ".writeMessageBegin('" << (*f_iter)->get_name()
                 << "', " << messageType << ", this.seqid);" << endl;
    }

    f_service_ << indent() << "var args = new " << argsname << "();" << endl;

    for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
      f_service_ << indent() << "args." << (*fld_iter)->get_name() << " = "
                 << (*fld_iter)->get_name() << ";" << endl;
    }

    // Write to the stream
    f_service_ << indent() << "args.write(" << outputVar << ");" << endl << indent() << outputVar
               << ".writeMessageEnd();" << endl;

    if (gen_node_) {
      f_service_ << indent() << "return this.output.flush();" << endl;
    } else {
      if (gen_jquery_) {
        f_service_ << indent() << "return this.output.getTransport().flush(callback);" << endl;
      } else {
        f_service_ << indent() << "if (callback) {" << endl;
        f_service_ << indent() << "  var self = this;" << endl;
        f_service_ << indent() << "  this.output.getTransport().flush(true, function() {" << endl;
        f_service_ << indent() << "    var result = null;" << endl;
        f_service_ << indent() << "    try {" << endl;
        f_service_ << indent() << "      result = self.recv_" << funname << "();" << endl;
        f_service_ << indent() << "    } catch (e) {" << endl;
        f_service_ << indent() << "      result = e;" << endl;
        f_service_ << indent() << "    }" << endl;
        f_service_ << indent() << "    callback(result);" << endl;
        f_service_ << indent() << "  });" << endl;
        f_service_ << indent() << "} else {" << endl;
        f_service_ << indent() << "  return this.output.getTransport().flush();" << endl;
        f_service_ << indent() << "}" << endl;
      }
    }

    indent_down();

    f_service_ << "};" << endl;

    if (!(*f_iter)->is_oneway()) {
      std::string resultname = js_namespace(tservice->get_program()) + service_name_ + "_"
                               + (*f_iter)->get_name() + "_result";

      if (gen_node_) {
        // Open function
        f_service_ << endl << js_namespace(tservice->get_program()) << service_name_
                   << "Client.prototype.recv_" << (*f_iter)->get_name()
                   << " = function(input,mtype,rseqid) {" << endl;
      } else {
        t_struct noargs(program_);

        t_function recv_function((*f_iter)->get_returntype(),
                                 string("recv_") + (*f_iter)->get_name(),
                                 &noargs);
        // Open function
        f_service_ << endl << js_namespace(tservice->get_program()) << service_name_
                   << "Client.prototype." << function_signature(&recv_function) << " {" << endl;
      }

      indent_up();

      std::string inputVar;
      if (gen_node_) {
        inputVar = "input";
      } else {
        inputVar = "this.input";
      }

      if (gen_node_) {
        f_service_ << indent() << "var callback = this._reqs[rseqid] || function() {};" << endl
                   << indent() << "delete this._reqs[rseqid];" << endl;
      } else {
        f_service_ << indent() << "var ret = this.input.readMessageBegin();" << endl << indent()
                   << "var fname = ret.fname;" << endl << indent() << "var mtype = ret.mtype;"
                   << endl << indent() << "var rseqid = ret.rseqid;" << endl;
      }

      f_service_ << indent() << "if (mtype == Thrift.MessageType.EXCEPTION) {" << endl << indent()
                 << "  var x = new Thrift.TApplicationException();" << endl << indent()
                 << "  x.read(" << inputVar << ");" << endl << indent() << "  " << inputVar
                 << ".readMessageEnd();" << endl << indent() << "  " << render_recv_throw("x")
                 << endl << indent() << "}" << endl;

      f_service_ << indent() << "var result = new " << resultname << "();" << endl << indent()
                 << "result.read(" << inputVar << ");" << endl;

      f_service_ << indent() << inputVar << ".readMessageEnd();" << endl << endl;

      t_struct* xs = (*f_iter)->get_xceptions();
      const std::vector<t_field*>& xceptions = xs->get_members();
      vector<t_field*>::const_iterator x_iter;
      for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
        f_service_ << indent() << "if (null !== result." << (*x_iter)->get_name() << ") {" << endl
                   << indent() << "  " << render_recv_throw("result." + (*x_iter)->get_name())
                   << endl << indent() << "}" << endl;
      }

      // Careful, only return result if not a void function
      if (!(*f_iter)->get_returntype()->is_void()) {
        f_service_ << indent() << "if (null !== result.success) {" << endl << indent() << "  "
                   << render_recv_return("result.success") << endl << indent() << "}" << endl;
        f_service_ << indent()
                   << render_recv_throw("'" + (*f_iter)->get_name() + " failed: unknown result'")
                   << endl;
      } else {
        if (gen_node_) {
          indent(f_service_) << "callback(null);" << endl;
        } else {
          indent(f_service_) << "return;" << endl;
        }
      }

      // Close function
      indent_down();
      f_service_ << "};" << endl;
    }
  }

  if (gen_ts_) {
    f_service_ts_ << ts_indent() << "}" << endl;
  }
}

std::string t_js_generator::render_recv_throw(std::string var) {
  if (gen_node_) {
    return "return callback(" + var + ");";
  } else {
    return "throw " + var + ";";
  }
}

std::string t_js_generator::render_recv_return(std::string var) {
  if (gen_node_) {
    return "return callback(null, " + var + ");";
  } else {
    return "return " + var + ";";
  }
}

/**
 * Deserializes a field of any type.
 */
void t_js_generator::generate_deserialize_field(ofstream& out,
                                                t_field* tfield,
                                                string prefix,
                                                bool inclass) {
  (void)inclass;
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
    indent(out) << name << " = input.";

    if (type->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        throw "compiler error: cannot serialize void field in a struct: " + name;
        break;
      case t_base_type::TYPE_STRING:
        out << (((t_base_type*)type)->is_binary() ? "readBinary()" : "readString()");
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
        throw "compiler error: no JS name for base type " + t_base_type::t_base_name(tbase);
      }
    } else if (type->is_enum()) {
      out << "readI32()";
    }

    if (!gen_node_) {
      out << ".value";
    }

    out << ";" << endl;
  } else {
    printf("DO NOT KNOW HOW TO DESERIALIZE FIELD '%s' TYPE '%s'\n",
           tfield->get_name().c_str(),
           type->get_name().c_str());
  }
}

/**
 * Generates an unserializer for a variable. This makes two key assumptions,
 * first that there is a const char* variable named data that points to the
 * buffer for deserialization, and that there is a variable protocol which
 * is a reference to a TProtocol serialization object.
 */
void t_js_generator::generate_deserialize_struct(ofstream& out, t_struct* tstruct, string prefix) {
  out << indent() << prefix << " = new " << js_type_namespace(tstruct->get_program())
      << tstruct->get_name() << "();" << endl << indent() << prefix << ".read(input);" << endl;
}

void t_js_generator::generate_deserialize_container(ofstream& out, t_type* ttype, string prefix) {
  string size = tmp("_size");
  string ktype = tmp("_ktype");
  string vtype = tmp("_vtype");
  string etype = tmp("_etype");
  string rtmp3 = tmp("_rtmp3");

  t_field fsize(g_type_i32, size);
  t_field fktype(g_type_i8, ktype);
  t_field fvtype(g_type_i8, vtype);
  t_field fetype(g_type_i8, etype);

  out << indent() << "var " << size << " = 0;" << endl;
  out << indent() << "var " << rtmp3 << ";" << endl;

  // Declare variables, read header
  if (ttype->is_map()) {
    out << indent() << prefix << " = {};" << endl << indent() << "var " << ktype << " = 0;" << endl
        << indent() << "var " << vtype << " = 0;" << endl;

    out << indent() << rtmp3 << " = input.readMapBegin();" << endl;
    out << indent() << ktype << " = " << rtmp3 << ".ktype;" << endl;
    out << indent() << vtype << " = " << rtmp3 << ".vtype;" << endl;
    out << indent() << size << " = " << rtmp3 << ".size;" << endl;

  } else if (ttype->is_set()) {

    out << indent() << prefix << " = [];" << endl << indent() << "var " << etype << " = 0;" << endl
        << indent() << rtmp3 << " = input.readSetBegin();" << endl << indent() << etype << " = "
        << rtmp3 << ".etype;" << endl << indent() << size << " = " << rtmp3 << ".size;" << endl;

  } else if (ttype->is_list()) {

    out << indent() << prefix << " = [];" << endl << indent() << "var " << etype << " = 0;" << endl
        << indent() << rtmp3 << " = input.readListBegin();" << endl << indent() << etype << " = "
        << rtmp3 << ".etype;" << endl << indent() << size << " = " << rtmp3 << ".size;" << endl;
  }

  // For loop iterates over elements
  string i = tmp("_i");
  indent(out) << "for (var " << i << " = 0; " << i << " < " << size << "; ++" << i << ")" << endl;

  scope_up(out);

  if (ttype->is_map()) {
    if (!gen_node_) {
      out << indent() << "if (" << i << " > 0 ) {" << endl << indent()
          << "  if (input.rstack.length > input.rpos[input.rpos.length -1] + 1) {" << endl
          << indent() << "    input.rstack.pop();" << endl << indent() << "  }" << endl << indent()
          << "}" << endl;
    }

    generate_deserialize_map_element(out, (t_map*)ttype, prefix);
  } else if (ttype->is_set()) {
    generate_deserialize_set_element(out, (t_set*)ttype, prefix);
  } else if (ttype->is_list()) {
    generate_deserialize_list_element(out, (t_list*)ttype, prefix);
  }

  scope_down(out);

  // Read container end
  if (ttype->is_map()) {
    indent(out) << "input.readMapEnd();" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "input.readSetEnd();" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "input.readListEnd();" << endl;
  }
}

/**
 * Generates code to deserialize a map
 */
void t_js_generator::generate_deserialize_map_element(ofstream& out, t_map* tmap, string prefix) {
  string key = tmp("key");
  string val = tmp("val");
  t_field fkey(tmap->get_key_type(), key);
  t_field fval(tmap->get_val_type(), val);

  indent(out) << declare_field(&fkey, false, false) << ";" << endl;
  indent(out) << declare_field(&fval, false, false) << ";" << endl;

  generate_deserialize_field(out, &fkey);
  generate_deserialize_field(out, &fval);

  indent(out) << prefix << "[" << key << "] = " << val << ";" << endl;
}

void t_js_generator::generate_deserialize_set_element(ofstream& out, t_set* tset, string prefix) {
  string elem = tmp("elem");
  t_field felem(tset->get_elem_type(), elem);

  indent(out) << "var " << elem << " = null;" << endl;

  generate_deserialize_field(out, &felem);

  indent(out) << prefix << ".push(" << elem << ");" << endl;
}

void t_js_generator::generate_deserialize_list_element(ofstream& out,
                                                       t_list* tlist,
                                                       string prefix) {
  string elem = tmp("elem");
  t_field felem(tlist->get_elem_type(), elem);

  indent(out) << "var " << elem << " = null;" << endl;

  generate_deserialize_field(out, &felem);

  indent(out) << prefix << ".push(" << elem << ");" << endl;
}

/**
 * Serializes a field of any type.
 *
 * @param tfield The field to serialize
 * @param prefix Name to prepend to field name
 */
void t_js_generator::generate_serialize_field(ofstream& out, t_field* tfield, string prefix) {
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

    string name = tfield->get_name();

    // Hack for when prefix is defined (always a hash ref)
    if (!prefix.empty())
      name = prefix + tfield->get_name();

    indent(out) << "output.";

    if (type->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        throw "compiler error: cannot serialize void field in a struct: " + name;
        break;
      case t_base_type::TYPE_STRING:
        out << (((t_base_type*)type)->is_binary() ? "writeBinary(" : "writeString(") << name << ")";
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
        throw "compiler error: no JS name for base type " + t_base_type::t_base_name(tbase);
      }
    } else if (type->is_enum()) {
      out << "writeI32(" << name << ")";
    }
    out << ";" << endl;

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
void t_js_generator::generate_serialize_struct(ofstream& out, t_struct* tstruct, string prefix) {
  (void)tstruct;
  indent(out) << prefix << ".write(output);" << endl;
}

/**
 * Writes out a container
 */
void t_js_generator::generate_serialize_container(ofstream& out, t_type* ttype, string prefix) {
  if (ttype->is_map()) {
    indent(out) << "output.writeMapBegin(" << type_to_enum(((t_map*)ttype)->get_key_type()) << ", "
                << type_to_enum(((t_map*)ttype)->get_val_type()) << ", "
                << "Thrift.objectLength(" << prefix << "));" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "output.writeSetBegin(" << type_to_enum(((t_set*)ttype)->get_elem_type()) << ", "
                << prefix << ".length);" << endl;

  } else if (ttype->is_list()) {

    indent(out) << "output.writeListBegin(" << type_to_enum(((t_list*)ttype)->get_elem_type())
                << ", " << prefix << ".length);" << endl;
  }

  if (ttype->is_map()) {
    string kiter = tmp("kiter");
    string viter = tmp("viter");
    indent(out) << "for (var " << kiter << " in " << prefix << ")" << endl;
    scope_up(out);
    indent(out) << "if (" << prefix << ".hasOwnProperty(" << kiter << "))" << endl;
    scope_up(out);
    indent(out) << "var " << viter << " = " << prefix << "[" << kiter << "];" << endl;
    generate_serialize_map_element(out, (t_map*)ttype, kiter, viter);
    scope_down(out);
    scope_down(out);

  } else if (ttype->is_set()) {
    string iter = tmp("iter");
    indent(out) << "for (var " << iter << " in " << prefix << ")" << endl;
    scope_up(out);
    indent(out) << "if (" << prefix << ".hasOwnProperty(" << iter << "))" << endl;
    scope_up(out);
    indent(out) << iter << " = " << prefix << "[" << iter << "];" << endl;
    generate_serialize_set_element(out, (t_set*)ttype, iter);
    scope_down(out);
    scope_down(out);

  } else if (ttype->is_list()) {
    string iter = tmp("iter");
    indent(out) << "for (var " << iter << " in " << prefix << ")" << endl;
    scope_up(out);
    indent(out) << "if (" << prefix << ".hasOwnProperty(" << iter << "))" << endl;
    scope_up(out);
    indent(out) << iter << " = " << prefix << "[" << iter << "];" << endl;
    generate_serialize_list_element(out, (t_list*)ttype, iter);
    scope_down(out);
    scope_down(out);
  }

  if (ttype->is_map()) {
    indent(out) << "output.writeMapEnd();" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "output.writeSetEnd();" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "output.writeListEnd();" << endl;
  }
}

/**
 * Serializes the members of a map.
 *
 */
void t_js_generator::generate_serialize_map_element(ofstream& out,
                                                    t_map* tmap,
                                                    string kiter,
                                                    string viter) {
  t_field kfield(tmap->get_key_type(), kiter);
  generate_serialize_field(out, &kfield);

  t_field vfield(tmap->get_val_type(), viter);
  generate_serialize_field(out, &vfield);
}

/**
 * Serializes the members of a set.
 */
void t_js_generator::generate_serialize_set_element(ofstream& out, t_set* tset, string iter) {
  t_field efield(tset->get_elem_type(), iter);
  generate_serialize_field(out, &efield);
}

/**
 * Serializes the members of a list.
 */
void t_js_generator::generate_serialize_list_element(ofstream& out, t_list* tlist, string iter) {
  t_field efield(tlist->get_elem_type(), iter);
  generate_serialize_field(out, &efield);
}

/**
 * Declares a field, which may include initialization as necessary.
 *
 * @param ttype The type
 */
string t_js_generator::declare_field(t_field* tfield, bool init, bool obj) {
  string result = "this." + tfield->get_name();

  if (!obj) {
    result = "var " + tfield->get_name();
  }

  if (init) {
    t_type* type = get_true_type(tfield->get_type());
    if (type->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        break;
      case t_base_type::TYPE_STRING:
      case t_base_type::TYPE_BOOL:
      case t_base_type::TYPE_I8:
      case t_base_type::TYPE_I16:
      case t_base_type::TYPE_I32:
      case t_base_type::TYPE_I64:
      case t_base_type::TYPE_DOUBLE:
        result += " = null";
        break;
      default:
        throw "compiler error: no JS initializer for base type " + t_base_type::t_base_name(tbase);
      }
    } else if (type->is_enum()) {
      result += " = null";
    } else if (type->is_map()) {
      result += " = null";
    } else if (type->is_container()) {
      result += " = null";
    } else if (type->is_struct() || type->is_xception()) {
      if (obj) {
        result += " = new " + js_type_namespace(type->get_program()) + type->get_name() + "()";
      } else {
        result += " = null";
      }
    }
  } else {
    result += " = null";
  }
  return result;
}

/**
 * Renders a function signature of the form 'type name(args)'
 *
 * @param tfunction Function definition
 * @return String of rendered function definition
 */
string t_js_generator::function_signature(t_function* tfunction,
                                          string prefix,
                                          bool include_callback) {

  string str;

  str = prefix + tfunction->get_name() + " = function(";

  str += argument_list(tfunction->get_arglist(), include_callback);

  str += ")";
  return str;
}

/**
 * Renders a field list
 */
string t_js_generator::argument_list(t_struct* tstruct, bool include_callback) {
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
    result += (*f_iter)->get_name();
  }

  if (include_callback) {
    if (!fields.empty()) {
      result += ", ";
    }
    result += "callback";
  }

  return result;
}

/**
 * Converts the parse type to a C++ enum string for the given type.
 */
string t_js_generator::type_to_enum(t_type* type) {
  type = get_true_type(type);

  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_VOID:
      throw "NO T_VOID CONSTRUCT";
    case t_base_type::TYPE_STRING:
      return "Thrift.Type.STRING";
    case t_base_type::TYPE_BOOL:
      return "Thrift.Type.BOOL";
    case t_base_type::TYPE_I8:
      return "Thrift.Type.BYTE";
    case t_base_type::TYPE_I16:
      return "Thrift.Type.I16";
    case t_base_type::TYPE_I32:
      return "Thrift.Type.I32";
    case t_base_type::TYPE_I64:
      return "Thrift.Type.I64";
    case t_base_type::TYPE_DOUBLE:
      return "Thrift.Type.DOUBLE";
    }
  } else if (type->is_enum()) {
    return "Thrift.Type.I32";
  } else if (type->is_struct() || type->is_xception()) {
    return "Thrift.Type.STRUCT";
  } else if (type->is_map()) {
    return "Thrift.Type.MAP";
  } else if (type->is_set()) {
    return "Thrift.Type.SET";
  } else if (type->is_list()) {
    return "Thrift.Type.LIST";
  }

  throw "INVALID TYPE IN type_to_enum: " + type->get_name();
}

/**
 * Converts a t_type to a TypeScript type (string).
 * @param t_type Type to convert to TypeScript
 * @return String TypeScript type
 */
string t_js_generator::ts_get_type(t_type* type) {
  std::string ts_type;

  type = get_true_type(type);

  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_STRING:
      ts_type = "string";
      break;
    case t_base_type::TYPE_BOOL:
      ts_type = "boolean";
      break;
    case t_base_type::TYPE_I8:
      ts_type = "any";
      break;
    case t_base_type::TYPE_I16:
    case t_base_type::TYPE_I32:
    case t_base_type::TYPE_I64:
    case t_base_type::TYPE_DOUBLE:
      ts_type = "number";
      break;
    case t_base_type::TYPE_VOID:
      ts_type = "void";
    }
  } else if (type->is_enum() || type->is_struct() || type->is_xception()) {
    std::string type_name;
    if (type->get_program()) {
      type_name = js_namespace(type->get_program());
    }
    type_name.append(type->get_name());
    ts_type = type_name;
  } else if (type->is_list() || type->is_set()) {
    t_type* etype;

    if (type->is_list()) {
      etype = ((t_list*)type)->get_elem_type();
    } else {
      etype = ((t_set*)type)->get_elem_type();
    }

    ts_type = ts_get_type(etype) + "[]";
  } else if (type->is_map()) {
    string ktype = ts_get_type(((t_map*)type)->get_key_type());
    string vtype = ts_get_type(((t_map*)type)->get_val_type());


    if (ktype == "number" || ktype == "string" ) {
      ts_type = "{ [k: " + ktype + "]: " + vtype + "; }";
    } else if ((((t_map*)type)->get_key_type())->is_enum()) {
      // Not yet supported (enum map): https://github.com/Microsoft/TypeScript/pull/2652
      //ts_type = "{ [k: " + ktype + "]: " + vtype + "; }";
      ts_type = "{ [k: number /*" + ktype + "*/]: " + vtype + "; }";
    } else {
      ts_type = "any";
    }
  }

  return ts_type;
}

/**
 * Renders a TypeScript function signature of the form 'name(args: types): type;'
 *
 * @param t_function Function definition
 * @param bool in-/exclude the callback argument
 * @return String of rendered function definition
 */
std::string t_js_generator::ts_function_signature(t_function* tfunction, bool include_callback) {
  string str;
  const vector<t_field*>& fields = tfunction->get_arglist()->get_members();
  vector<t_field*>::const_iterator f_iter;

  str = tfunction->get_name() + "(";

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    str += (*f_iter)->get_name() + ts_get_req(*f_iter) + ": " + ts_get_type((*f_iter)->get_type());

    if (f_iter + 1 != fields.end() || (include_callback && fields.size() > 0)) {
      str += ", ";
    }
  }

  if (include_callback) {
    str += "callback: Function): ";

    if (gen_jquery_) {
      str += "JQueryXHR;";
    } else {
      str += "void;";
    }
  } else {
    str += "): " + ts_get_type(tfunction->get_returntype()) + ";";
  }

  return str;
}

/**
 * Takes a name and produces a valid NodeJS identifier from it
 *
 * @param name The name which shall become a valid NodeJS identifier
 * @return The modified name with the updated identifier
 */
std::string t_js_generator::make_valid_nodeJs_identifier(std::string const& name) {
  std::string str = name;
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
        && ('_' != c) && ('$' != c)) {
      str.replace(i, 1, "_");
    }
  }

  return str;
}

THRIFT_REGISTER_GENERATOR(js,
                          "Javascript",
                          "    jquery:          Generate jQuery compatible code.\n"
                          "    node:            Generate node.js compatible code.\n"
                          "    ts:              Generate TypeScript definition files.\n"
                          "    with_ns:         Create global namespace objects when using node.js\n")
