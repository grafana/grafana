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

#include <string>
#include <fstream>
#include <iostream>
#include <vector>

#include <stdlib.h>
#include <time.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sstream>

#include "thrift/platform.h"
#include "thrift/version.h"
#include "thrift/generate/t_oop_generator.h"

using std::map;
using std::ofstream;
using std::ostringstream;
using std::string;
using std::stringstream;
using std::vector;

static const string endl = "\n"; // avoid ostream << std::endl flushes

/**
 * Smalltalk code generator.
 *
 */
class t_st_generator : public t_oop_generator {
public:
  t_st_generator(t_program* program,
                 const std::map<std::string, std::string>& parsed_options,
                 const std::string& option_string)
    : t_oop_generator(program) {
    (void)option_string;
    std::map<std::string, std::string>::const_iterator iter;

    /* no options yet */
    for( iter = parsed_options.begin(); iter != parsed_options.end(); ++iter) {
      throw "unknown option st:" + iter->first;
    }

    out_dir_base_ = "gen-st";
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
  void generate_class_side_definition();
  void generate_force_consts();

  std::string render_const_value(t_type* type, t_const_value* value);

  /**
   * Struct generation code
   */

  void generate_st_struct(std::ofstream& out, t_struct* tstruct, bool is_exception);
  void generate_accessors(std::ofstream& out, t_struct* tstruct);

  /**
   * Service-level generation functions
   */

  void generate_service_client(t_service* tservice);

  void generate_send_method(t_function* tfunction);
  void generate_recv_method(t_function* tfunction);

  std::string map_reader(t_map* tmap);
  std::string list_reader(t_list* tlist);
  std::string set_reader(t_set* tset);
  std::string struct_reader(t_struct* tstruct, std::string clsName);

  std::string map_writer(t_map* tmap, std::string name);
  std::string list_writer(t_list* tlist, std::string name);
  std::string set_writer(t_set* tset, std::string name);
  std::string struct_writer(t_struct* tstruct, std::string fname);

  std::string write_val(t_type* t, std::string fname);
  std::string read_val(t_type* t);

  /**
   * Helper rendering functions
   */

  std::string st_autogen_comment();

  void st_class_def(std::ofstream& out, std::string name);
  void st_method(std::ofstream& out, std::string cls, std::string name);
  void st_method(std::ofstream& out, std::string cls, std::string name, std::string category);
  void st_close_method(std::ofstream& out);
  void st_class_method(std::ofstream& out, std::string cls, std::string name);
  void st_class_method(std::ofstream& out, std::string cls, std::string name, std::string category);
  void st_setter(std::ofstream& out, std::string cls, std::string name, std::string type);
  void st_getter(std::ofstream& out, std::string cls, std::string name);
  void st_accessors(std::ofstream& out, std::string cls, std::string name, std::string type);

  std::string class_name();
  static bool is_valid_namespace(const std::string& sub_namespace);
  std::string client_class_name();
  std::string prefix(std::string name);
  std::string declare_field(t_field* tfield);
  std::string type_name(t_type* ttype);

  std::string function_signature(t_function* tfunction);
  std::string argument_list(t_struct* tstruct);
  std::string function_types_comment(t_function* fn);

  std::string type_to_enum(t_type* ttype);
  std::string a_type(t_type* type);
  bool is_vowel(char c);
  std::string temp_name();
  std::string generated_category();

private:
  /**
   * File streams
   */
  int temporary_var;
  std::ofstream f_;
};

/**
 * Prepares for file generation by opening up the necessary file output
 * streams.
 *
 * @param tprogram The program to generate
 */
void t_st_generator::init_generator() {
  // Make output directory
  MKDIR(get_out_dir().c_str());

  temporary_var = 0;

  // Make output file
  string f_name = get_out_dir() + "/" + program_name_ + ".st";
  f_.open(f_name.c_str());

  // Print header
  f_ << st_autogen_comment() << endl;

  st_class_def(f_, program_name_);
  generate_class_side_definition();

  // Generate enums
  vector<t_enum*> enums = program_->get_enums();
  vector<t_enum*>::iterator en_iter;
  for (en_iter = enums.begin(); en_iter != enums.end(); ++en_iter) {
    generate_enum(*en_iter);
  }
}

string t_st_generator::class_name() {
  return capitalize(program_name_);
}

bool t_st_generator::is_valid_namespace(const std::string& sub_namespace) {
  return sub_namespace == "prefix" || sub_namespace == "category";
}

string t_st_generator::prefix(string class_name) {
  string prefix = program_->get_namespace("smalltalk.prefix");
  string name = capitalize(class_name);
  name = prefix.empty() ? name : (prefix + name);
  return name;
}

string t_st_generator::client_class_name() {
  return capitalize(service_name_) + "Client";
}

/**
 * Autogen'd comment
 */
string t_st_generator::st_autogen_comment() {
  return std::string("'") + "Autogenerated by Thrift Compiler (" + THRIFT_VERSION + ")\n" + "\n"
         + "DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING\n" + "'!\n";
}

void t_st_generator::generate_force_consts() {
  f_ << prefix(class_name()) << " enums keysAndValuesDo: [:k :v | " << prefix(class_name())
     << " enums at: k put: v value].!" << endl;

  f_ << prefix(class_name()) << " constants keysAndValuesDo: [:k :v | " << prefix(class_name())
     << " constants at: k put: v value].!" << endl;
}

void t_st_generator::close_generator() {
  generate_force_consts();
  f_.close();
}

string t_st_generator::generated_category() {
  string cat = program_->get_namespace("smalltalk.category");
  // For compatibility with the Thrift grammar, the category must
  // be punctuated by dots.  Replaces them with dashes here.
  for (string::iterator iter = cat.begin(); iter != cat.end(); ++iter) {
    if (*iter == '.') {
      *iter = '-';
    }
  }
  return cat.size() ? cat : "Generated-" + class_name();
}

/**
 * Generates a typedef. This is not done in Smalltalk, types are all implicit.
 *
 * @param ttypedef The type definition
 */
void t_st_generator::generate_typedef(t_typedef* ttypedef) {
  (void)ttypedef;
}

void t_st_generator::st_class_def(std::ofstream& out, string name) {
  out << "Object subclass: #" << prefix(name) << endl;
  indent_up();
  out << indent() << "instanceVariableNames: ''" << endl << indent() << "classVariableNames: ''"
      << endl << indent() << "poolDictionaries: ''" << endl << indent() << "category: '"
      << generated_category() << "'!" << endl << endl;
}

void t_st_generator::st_method(std::ofstream& out, string cls, string name) {
  st_method(out, cls, name, "as yet uncategorized");
}

void t_st_generator::st_class_method(std::ofstream& out, string cls, string name) {
  st_method(out, cls + " class", name);
}

void t_st_generator::st_class_method(std::ofstream& out, string cls, string name, string category) {
  st_method(out, cls, name, category);
}

void t_st_generator::st_method(std::ofstream& out, string cls, string name, string category) {
  char timestr[50];
  time_t rawtime;
  struct tm* tinfo;

  time(&rawtime);
  tinfo = localtime(&rawtime);
  strftime(timestr, 50, "%m/%d/%Y %H:%M", tinfo);

  out << "!" << prefix(cls) << " methodsFor: '" + category + "' stamp: 'thrift " << timestr
      << "'!\n" << name << endl;

  indent_up();
  out << indent();
}

void t_st_generator::st_close_method(std::ofstream& out) {
  out << "! !" << endl << endl;
  indent_down();
}

void t_st_generator::st_setter(std::ofstream& out,
                               string cls,
                               string name,
                               string type = "anObject") {
  st_method(out, cls, name + ": " + type);
  out << name << " := " + type;
  st_close_method(out);
}

void t_st_generator::st_getter(std::ofstream& out, string cls, string name) {
  st_method(out, cls, name + "");
  out << "^ " << name;
  st_close_method(out);
}

void t_st_generator::st_accessors(std::ofstream& out,
                                  string cls,
                                  string name,
                                  string type = "anObject") {
  st_setter(out, cls, name, type);
  st_getter(out, cls, name);
}

void t_st_generator::generate_class_side_definition() {
  f_ << prefix(class_name()) << " class" << endl << "\tinstanceVariableNames: 'constants enums'!"
     << endl << endl;

  st_accessors(f_, class_name() + " class", "enums");
  st_accessors(f_, class_name() + " class", "constants");

  f_ << prefix(class_name()) << " enums: Dictionary new!" << endl;
  f_ << prefix(class_name()) << " constants: Dictionary new!" << endl;

  f_ << endl;
}

/**
 * Generates code for an enumerated type. Done using a class to scope
 * the values.
 *
 * @param tenum The enumeration
 */
void t_st_generator::generate_enum(t_enum* tenum) {
  string cls_name = program_name_ + capitalize(tenum->get_name());

  f_ << prefix(class_name()) << " enums at: '" << tenum->get_name() << "' put: ["
     << "(Dictionary new " << endl;

  vector<t_enum_value*> constants = tenum->get_constants();
  vector<t_enum_value*>::iterator c_iter;
  for (c_iter = constants.begin(); c_iter != constants.end(); ++c_iter) {
    int value = (*c_iter)->get_value();
    f_ << "\tat: '" << (*c_iter)->get_name() << "' put: " << value << ";" << endl;
  }

  f_ << "\tyourself)]!" << endl << endl;
}

/**
 * Generate a constant value
 */
void t_st_generator::generate_const(t_const* tconst) {
  t_type* type = tconst->get_type();
  string name = tconst->get_name();
  t_const_value* value = tconst->get_value();

  f_ << prefix(class_name()) << " constants at: '" << name << "' put: ["
     << render_const_value(type, value) << "]!" << endl << endl;
}

/**
 * Prints the value of a constant with the given type. Note that type checking
 * is NOT performed in this function as it is always run beforehand using the
 * validate_types method in main.cc
 */
string t_st_generator::render_const_value(t_type* type, t_const_value* value) {
  type = get_true_type(type);
  std::ostringstream out;
  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_STRING:
      out << '"' << get_escaped_string(value) << '"';
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
    indent(out) << value->get_integer();
  } else if (type->is_struct() || type->is_xception()) {
    out << "(" << capitalize(type->get_name()) << " new " << endl;
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

      out << indent() << v_iter->first->get_string() << ": "
          << render_const_value(field_type, v_iter->second) << ";" << endl;
    }
    out << indent() << "yourself)";

    indent_down();
  } else if (type->is_map()) {
    t_type* ktype = ((t_map*)type)->get_key_type();
    t_type* vtype = ((t_map*)type)->get_val_type();
    out << "(Dictionary new" << endl;
    indent_up();
    indent_up();
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      out << indent() << indent();
      out << "at: " << render_const_value(ktype, v_iter->first);
      out << " put: ";
      out << render_const_value(vtype, v_iter->second);
      out << ";" << endl;
    }
    out << indent() << indent() << "yourself)";
    indent_down();
    indent_down();
  } else if (type->is_list() || type->is_set()) {
    t_type* etype;
    if (type->is_list()) {
      etype = ((t_list*)type)->get_elem_type();
    } else {
      etype = ((t_set*)type)->get_elem_type();
    }
    if (type->is_set()) {
      out << "(Set new" << endl;
    } else {
      out << "(OrderedCollection new" << endl;
    }
    indent_up();
    indent_up();
    const vector<t_const_value*>& val = value->get_list();
    vector<t_const_value*>::const_iterator v_iter;
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      out << indent() << indent();
      out << "add: " << render_const_value(etype, *v_iter);
      out << ";" << endl;
    }
    out << indent() << indent() << "yourself)";
    indent_down();
    indent_down();
  } else {
    throw "CANNOT GENERATE CONSTANT FOR TYPE: " + type->get_name();
  }
  return out.str();
}

/**
 * Generates a Smalltalk struct
 */
void t_st_generator::generate_struct(t_struct* tstruct) {
  generate_st_struct(f_, tstruct, false);
}

/**
 * Generates a struct definition for a thrift exception. Basically the same
 * as a struct but extends the Exception class.
 *
 * @param txception The struct definition
 */
void t_st_generator::generate_xception(t_struct* txception) {
  generate_st_struct(f_, txception, true);
}

/**
 * Generates a smalltalk class to represent a struct
 */
void t_st_generator::generate_st_struct(std::ofstream& out,
                                        t_struct* tstruct,
                                        bool is_exception = false) {
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  if (is_exception)
    out << "Error";
  else
    out << "Object";

  out << " subclass: #" << prefix(type_name(tstruct)) << endl << "\tinstanceVariableNames: '";

  if (members.size() > 0) {
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      if (m_iter != members.begin())
        out << " ";
      out << camelcase((*m_iter)->get_name());
    }
  }

  out << "'\n"
      << "\tclassVariableNames: ''\n"
      << "\tpoolDictionaries: ''\n"
      << "\tcategory: '" << generated_category() << "'!\n\n";

  generate_accessors(out, tstruct);
}

bool t_st_generator::is_vowel(char c) {
  switch (tolower(c)) {
  case 'a':
  case 'e':
  case 'i':
  case 'o':
  case 'u':
    return true;
  }
  return false;
}

string t_st_generator::a_type(t_type* type) {
  string prefix;

  if (is_vowel(type_name(type)[0]))
    prefix = "an";
  else
    prefix = "a";

  return prefix + capitalize(type_name(type));
}

void t_st_generator::generate_accessors(std::ofstream& out, t_struct* tstruct) {
  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;
  string type;
  string prefix;

  if (members.size() > 0) {
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      st_accessors(out,
                   capitalize(type_name(tstruct)),
                   camelcase((*m_iter)->get_name()),
                   a_type((*m_iter)->get_type()));
    }
    out << endl;
  }
}

/**
 * Generates a thrift service.
 *
 * @param tservice The service definition
 */
void t_st_generator::generate_service(t_service* tservice) {
  generate_service_client(tservice);
  // generate_service_server(tservice);
}

string t_st_generator::temp_name() {
  std::ostringstream out;
  out << "temp" << temporary_var++;
  return out.str();
}

string t_st_generator::map_writer(t_map* tmap, string fname) {
  std::ostringstream out;
  string key = temp_name();
  string val = temp_name();

  out << "[oprot writeMapBegin: (TMap new keyType: " << type_to_enum(tmap->get_key_type())
      << "; valueType: " << type_to_enum(tmap->get_val_type()) << "; size: " << fname << " size)."
      << endl;
  indent_up();

  out << indent() << fname << " keysAndValuesDo: [:" << key << " :" << val << " |" << endl;
  indent_up();

  out << indent() << write_val(tmap->get_key_type(), key) << "." << endl << indent()
      << write_val(tmap->get_val_type(), val);
  indent_down();

  out << "]." << endl << indent() << "oprot writeMapEnd] value";
  indent_down();

  return out.str();
}

string t_st_generator::map_reader(t_map* tmap) {
  std::ostringstream out;
  string desc = temp_name();
  string val = temp_name();

  out << "[|" << desc << " " << val << "| " << endl;
  indent_up();

  out << indent() << desc << " := iprot readMapBegin." << endl << indent() << val
      << " := Dictionary new." << endl << indent() << desc << " size timesRepeat: [" << endl;

  indent_up();
  out << indent() << val << " at: " << read_val(tmap->get_key_type())
      << " put: " << read_val(tmap->get_val_type());
  indent_down();

  out << "]." << endl << indent() << "iprot readMapEnd." << endl << indent() << val << "] value";
  indent_down();

  return out.str();
}

string t_st_generator::list_writer(t_list* tlist, string fname) {
  std::ostringstream out;
  string val = temp_name();

  out << "[oprot writeListBegin: (TList new elemType: " << type_to_enum(tlist->get_elem_type())
      << "; size: " << fname << " size)." << endl;
  indent_up();

  out << indent() << fname << " do: [:" << val << "|" << endl;
  indent_up();

  out << indent() << write_val(tlist->get_elem_type(), val) << endl;
  indent_down();

  out << "]." << endl << indent() << "oprot writeListEnd] value";
  indent_down();

  return out.str();
}

string t_st_generator::list_reader(t_list* tlist) {
  std::ostringstream out;
  string desc = temp_name();
  string val = temp_name();

  out << "[|" << desc << " " << val << "| " << desc << " := iprot readListBegin." << endl;
  indent_up();

  out << indent() << val << " := OrderedCollection new." << endl << indent() << desc
      << " size timesRepeat: [" << endl;

  indent_up();
  out << indent() << val << " add: " << read_val(tlist->get_elem_type());
  indent_down();

  out << "]." << endl << indent() << "iprot readListEnd." << endl << indent() << val << "] value";
  indent_down();

  return out.str();
}

string t_st_generator::set_writer(t_set* tset, string fname) {
  std::ostringstream out;
  string val = temp_name();

  out << "[oprot writeSetBegin: (TSet new elemType: " << type_to_enum(tset->get_elem_type())
      << "; size: " << fname << " size)." << endl;
  indent_up();

  out << indent() << fname << " do: [:" << val << "|" << endl;
  indent_up();

  out << indent() << write_val(tset->get_elem_type(), val) << endl;
  indent_down();

  out << "]." << endl << indent() << "oprot writeSetEnd] value";
  indent_down();

  return out.str();
}

string t_st_generator::set_reader(t_set* tset) {
  std::ostringstream out;
  string desc = temp_name();
  string val = temp_name();

  out << "[|" << desc << " " << val << "| " << desc << " := iprot readSetBegin." << endl;
  indent_up();

  out << indent() << val << " := Set new." << endl << indent() << desc << " size timesRepeat: ["
      << endl;

  indent_up();
  out << indent() << val << " add: " << read_val(tset->get_elem_type());
  indent_down();

  out << "]." << endl << indent() << "iprot readSetEnd." << endl << indent() << val << "] value";
  indent_down();

  return out.str();
}

string t_st_generator::struct_writer(t_struct* tstruct, string sname) {
  std::ostringstream out;
  const vector<t_field*>& fields = tstruct->get_sorted_members();
  vector<t_field*>::const_iterator fld_iter;

  out << "[oprot writeStructBegin: "
      << "(TStruct new name: '" + tstruct->get_name() + "')." << endl;
  indent_up();

  for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
    bool optional = (*fld_iter)->get_req() == t_field::T_OPTIONAL;
    string fname = camelcase((*fld_iter)->get_name());
    string accessor = sname + " " + camelcase(fname);

    if (optional) {
      out << indent() << accessor << " ifNotNil: [" << endl;
      indent_up();
    }

    out << indent() << "oprot writeFieldBegin: (TField new name: '" << fname
        << "'; type: " << type_to_enum((*fld_iter)->get_type())
        << "; id: " << (*fld_iter)->get_key() << ")." << endl;

    out << indent() << write_val((*fld_iter)->get_type(), accessor) << "." << endl << indent()
        << "oprot writeFieldEnd";

    if (optional) {
      out << "]";
      indent_down();
    }

    out << "." << endl;
  }

  out << indent() << "oprot writeFieldStop; writeStructEnd] value";
  indent_down();

  return out.str();
}

string t_st_generator::struct_reader(t_struct* tstruct, string clsName = "") {
  std::ostringstream out;
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator fld_iter;
  string val = temp_name();
  string desc = temp_name();
  string found = temp_name();

  if (clsName.size() == 0) {
    clsName = tstruct->get_name();
  }

  out << "[|" << desc << " " << val << "|" << endl;
  indent_up();

  // This is nasty, but without it we'll break things by prefixing TResult.
  string name = ((capitalize(clsName) == "TResult") ? capitalize(clsName) : prefix(clsName));
  out << indent() << val << " := " << name << " new." << endl;

  out << indent() << "iprot readStructBegin." << endl << indent() << "[" << desc
      << " := iprot readFieldBegin." << endl << indent() << desc
      << " type = TType stop] whileFalse: [|" << found << "|" << endl;
  indent_up();

  for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
    out << indent() << desc << " id = " << (*fld_iter)->get_key() << " ifTrue: [" << endl;
    indent_up();

    out << indent() << found << " := true." << endl << indent() << val << " "
        << camelcase((*fld_iter)->get_name()) << ": " << read_val((*fld_iter)->get_type());
    indent_down();

    out << "]." << endl;
  }

  out << indent() << found << " ifNil: [iprot skip: " << desc << " type]]." << endl;
  indent_down();

  out << indent() << "oprot readStructEnd." << endl << indent() << val << "] value";
  indent_down();

  return out.str();
}

string t_st_generator::write_val(t_type* t, string fname) {
  t = get_true_type(t);

  if (t->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)t)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_DOUBLE:
      return "iprot writeDouble: " + fname + " asFloat";
      break;
    case t_base_type::TYPE_I8:
    case t_base_type::TYPE_I16:
    case t_base_type::TYPE_I32:
    case t_base_type::TYPE_I64:
      return "iprot write" + capitalize(type_name(t)) + ": " + fname + " asInteger";
    default:
      return "iprot write" + capitalize(type_name(t)) + ": " + fname;
    }
  } else if (t->is_map()) {
    return map_writer((t_map*)t, fname);
  } else if (t->is_struct() || t->is_xception()) {
    return struct_writer((t_struct*)t, fname);
  } else if (t->is_list()) {
    return list_writer((t_list*)t, fname);
  } else if (t->is_set()) {
    return set_writer((t_set*)t, fname);
  } else if (t->is_enum()) {
    return "iprot writeI32: " + fname;
  } else {
    throw "Sorry, I don't know how to write this: " + type_name(t);
  }
}

string t_st_generator::read_val(t_type* t) {
  t = get_true_type(t);

  if (t->is_base_type()) {
    return "iprot read" + capitalize(type_name(t));
  } else if (t->is_map()) {
    return map_reader((t_map*)t);
  } else if (t->is_struct() || t->is_xception()) {
    return struct_reader((t_struct*)t);
  } else if (t->is_list()) {
    return list_reader((t_list*)t);
  } else if (t->is_set()) {
    return set_reader((t_set*)t);
  } else if (t->is_enum()) {
    return "iprot readI32";
  } else {
    throw "Sorry, I don't know how to read this: " + type_name(t);
  }
}

void t_st_generator::generate_send_method(t_function* function) {
  string funname = function->get_name();
  string signature = function_signature(function);
  t_struct* arg_struct = function->get_arglist();
  const vector<t_field*>& fields = arg_struct->get_members();
  vector<t_field*>::const_iterator fld_iter;

  st_method(f_, client_class_name(), "send" + capitalize(signature));
  f_ << "oprot writeMessageBegin:" << endl;
  indent_up();

  f_ << indent() << "(TCallMessage new" << endl;
  indent_up();

  f_ << indent() << "name: '" << funname << "'; " << endl << indent() << "seqid: self nextSeqid)."
     << endl;
  indent_down();
  indent_down();

  f_ << indent() << "oprot writeStructBegin: "
     << "(TStruct new name: '" + capitalize(camelcase(funname)) + "_args')." << endl;

  for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
    string fname = camelcase((*fld_iter)->get_name());

    f_ << indent() << "oprot writeFieldBegin: (TField new name: '" << fname
       << "'; type: " << type_to_enum((*fld_iter)->get_type()) << "; id: " << (*fld_iter)->get_key()
       << ")." << endl;

    f_ << indent() << write_val((*fld_iter)->get_type(), fname) << "." << endl << indent()
       << "oprot writeFieldEnd." << endl;
  }

  f_ << indent() << "oprot writeFieldStop; writeStructEnd; writeMessageEnd." << endl;
  f_ << indent() << "oprot transport flush";

  st_close_method(f_);
}

// We only support receiving TResult structures (so this won't work on the server side)
void t_st_generator::generate_recv_method(t_function* function) {
  string funname = camelcase(function->get_name());
  string signature = function_signature(function);

  t_struct result(program_, "TResult");
  t_field success(function->get_returntype(), "success", 0);
  result.append(&success);

  t_struct* xs = function->get_xceptions();
  const vector<t_field*>& fields = xs->get_members();
  vector<t_field*>::const_iterator f_iter;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    // duplicate the field, but call it "exception"... we don't need a dynamic name
    t_field* exception = new t_field((*f_iter)->get_type(), "exception", (*f_iter)->get_key());
    result.append(exception);
  }

  st_method(f_, client_class_name(), "recv" + capitalize(funname));
  f_ << "| f msg res | " << endl << indent() << "msg := oprot readMessageBegin." << endl << indent()
     << "self validateRemoteMessage: msg." << endl << indent()
     << "res := " << struct_reader(&result) << "." << endl << indent() << "oprot readMessageEnd."
     << endl << indent() << "oprot transport flush." << endl << indent()
     << "res exception ifNotNil: [res exception signal]." << endl << indent() << "^ res";
  st_close_method(f_);
}

string t_st_generator::function_types_comment(t_function* fn) {
  std::ostringstream out;
  const vector<t_field*>& fields = fn->get_arglist()->get_members();
  vector<t_field*>::const_iterator f_iter;

  out << "\"";

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    out << camelcase((*f_iter)->get_name()) << ": " << type_name((*f_iter)->get_type());
    if ((f_iter + 1) != fields.end()) {
      out << ", ";
    }
  }

  out << "\"";

  return out.str();
}

/**
 * Generates a service client definition.
 *
 * @param tservice The service to generate a server for.
 */
void t_st_generator::generate_service_client(t_service* tservice) {
  string extends = "";
  string extends_client = "TClient";
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;

  if (tservice->get_extends() != NULL) {
    extends = type_name(tservice->get_extends());
    extends_client = extends + "Client";
  }

  f_ << extends_client << " subclass: #" << prefix(client_class_name()) << endl
     << "\tinstanceVariableNames: ''\n"
     << "\tclassVariableNames: ''\n"
     << "\tpoolDictionaries: ''\n"
     << "\tcategory: '" << generated_category() << "'!\n\n";

  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    string funname = camelcase((*f_iter)->get_name());
    string signature = function_signature(*f_iter);

    st_method(f_, client_class_name(), signature);
    f_ << function_types_comment(*f_iter) << endl << indent() << "self send"
       << capitalize(signature) << "." << endl;

    if (!(*f_iter)->is_oneway()) {
      f_ << indent() << "^ self recv" << capitalize(funname) << " success " << endl;
    }

    st_close_method(f_);

    generate_send_method(*f_iter);
    if (!(*f_iter)->is_oneway()) {
      generate_recv_method(*f_iter);
    }
  }
}

/**
 * Renders a function signature of the form 'type name(args)'
 *
 * @param tfunction Function definition
 * @return String of rendered function definition
 */
string t_st_generator::function_signature(t_function* tfunction) {
  return camelcase(tfunction->get_name()) + capitalize(argument_list(tfunction->get_arglist()));
}

/**
 * Renders a field list
 */
string t_st_generator::argument_list(t_struct* tstruct) {
  string result = "";

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;
  bool first = true;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (first) {
      first = false;
    } else {
      result += " ";
    }
    string name = camelcase((*f_iter)->get_name());
    result += name + ": " + name;
  }
  return result;
}

string t_st_generator::type_name(t_type* ttype) {
  string prefix = "";
  t_program* program = ttype->get_program();
  if (program != NULL && program != program_) {
    if (!ttype->is_service()) {
      prefix = program->get_name() + "_types.";
    }
  }

  string name = ttype->get_name();
  if (ttype->is_struct() || ttype->is_xception()) {
    name = capitalize(ttype->get_name());
  }

  return prefix + name;
}

/* Convert t_type to Smalltalk type code */
string t_st_generator::type_to_enum(t_type* type) {
  type = get_true_type(type);

  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_VOID:
      throw "NO T_VOID CONSTRUCT";
    case t_base_type::TYPE_STRING:
      return "TType string";
    case t_base_type::TYPE_BOOL:
      return "TType bool";
    case t_base_type::TYPE_I8:
      return "TType byte";
    case t_base_type::TYPE_I16:
      return "TType i16";
    case t_base_type::TYPE_I32:
      return "TType i32";
    case t_base_type::TYPE_I64:
      return "TType i64";
    case t_base_type::TYPE_DOUBLE:
      return "TType double";
    }
  } else if (type->is_enum()) {
    return "TType i32";
  } else if (type->is_struct() || type->is_xception()) {
    return "TType struct";
  } else if (type->is_map()) {
    return "TType map";
  } else if (type->is_set()) {
    return "TType set";
  } else if (type->is_list()) {
    return "TType list";
  }

  throw "INVALID TYPE IN type_to_enum: " + type->get_name();
}

THRIFT_REGISTER_GENERATOR(st, "Smalltalk", "")
