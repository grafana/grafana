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

#include <cassert>

#include <string>
#include <fstream>
#include <iostream>
#include <vector>
#include <cctype>

#include <stdlib.h>
#include <sys/stat.h>
#include <sstream>

#include "thrift/platform.h"
#include "thrift/generate/t_oop_generator.h"

using std::map;
using std::ofstream;
using std::ostringstream;
using std::string;
using std::stringstream;
using std::vector;

static const string endl = "\n"; // avoid ostream << std::endl flushes

struct member_mapping_scope {
  void* scope_member;
  std::map<std::string, std::string> mapping_table;
};

class t_csharp_generator : public t_oop_generator {
public:
  t_csharp_generator(t_program* program,
                     const std::map<std::string, std::string>& parsed_options,
                     const std::string& option_string)
    : t_oop_generator(program) {
    (void)option_string;

    std::map<std::string, std::string>::const_iterator iter;

    async_ = false;
    nullable_ = false;
    hashcode_ = false;
    union_ = false;
    serialize_ = false;
    wcf_ = false;
    wcf_namespace_.clear();
    for( iter = parsed_options.begin(); iter != parsed_options.end(); ++iter) {
      if( iter->first.compare("async") == 0) {
        async_ = true;
      } else if( iter->first.compare("nullable") == 0) {
        nullable_ = true;
      } else if( iter->first.compare("hashcode") == 0) {
        hashcode_ = true;
      } else if( iter->first.compare("union") == 0) {
        union_ = true;
      } else if( iter->first.compare("serial") == 0) {
        serialize_ = true;
        wcf_namespace_ = iter->second; // since there can be only one namespace
      } else if( iter->first.compare("wcf") == 0) {
        wcf_ = true;
        wcf_namespace_ = iter->second;
      } else {
        throw "unknown option csharp:" + iter->first;
      }
    }

    out_dir_base_ = "gen-csharp";
  }
  void init_generator();
  void close_generator();

  void generate_consts(std::vector<t_const*> consts);

  void generate_typedef(t_typedef* ttypedef);
  void generate_enum(t_enum* tenum);
  void generate_struct(t_struct* tstruct);
  void generate_union(t_struct* tunion);
  void generate_xception(t_struct* txception);
  void generate_service(t_service* tservice);
  void generate_property(ofstream& out, t_field* tfield, bool isPublic, bool generateIsset);
  void generate_csharp_property(ofstream& out,
                                t_field* tfield,
                                bool isPublic,
                                bool includeIsset = true,
                                std::string fieldPrefix = "");
  bool print_const_value(std::ofstream& out,
                         std::string name,
                         t_type* type,
                         t_const_value* value,
                         bool in_static,
                         bool defval = false,
                         bool needtype = false);
  std::string render_const_value(std::ofstream& out,
                                 std::string name,
                                 t_type* type,
                                 t_const_value* value);
  void print_const_constructor(std::ofstream& out, std::vector<t_const*> consts);
  void print_const_def_value(std::ofstream& out,
                             std::string name,
                             t_type* type,
                             t_const_value* value);

  void generate_csharp_struct(t_struct* tstruct, bool is_exception);
  void generate_csharp_union(t_struct* tunion);
  void generate_csharp_struct_definition(std::ofstream& out,
                                         t_struct* tstruct,
                                         bool is_xception = false,
                                         bool in_class = false,
                                         bool is_result = false);
  void generate_csharp_union_definition(std::ofstream& out, t_struct* tunion);
  void generate_csharp_union_class(std::ofstream& out, t_struct* tunion, t_field* tfield);
  void generate_csharp_wcffault(std::ofstream& out, t_struct* tstruct);
  void generate_csharp_struct_reader(std::ofstream& out, t_struct* tstruct);
  void generate_csharp_struct_result_writer(std::ofstream& out, t_struct* tstruct);
  void generate_csharp_struct_writer(std::ofstream& out, t_struct* tstruct);
  void generate_csharp_struct_tostring(std::ofstream& out, t_struct* tstruct);
  void generate_csharp_struct_equals(std::ofstream& out, t_struct* tstruct);
  void generate_csharp_struct_hashcode(std::ofstream& out, t_struct* tstruct);
  void generate_csharp_union_reader(std::ofstream& out, t_struct* tunion);

  void generate_function_helpers(t_function* tfunction);
  void generate_service_interface(t_service* tservice);
  void generate_separate_service_interfaces(t_service* tservice);
  void generate_sync_service_interface(t_service* tservice);
  void generate_async_service_interface(t_service* tservice);
  void generate_combined_service_interface(t_service* tservice);
  void generate_silverlight_async_methods(t_service* tservice);
  void generate_service_helpers(t_service* tservice);
  void generate_service_client(t_service* tservice);
  void generate_service_server(t_service* tservice);
  void generate_service_server_sync(t_service* tservice);
  void generate_service_server_async(t_service* tservice);
  void generate_process_function(t_service* tservice, t_function* function);
  void generate_process_function_async(t_service* tservice, t_function* function);

  void generate_deserialize_field(std::ofstream& out,
                                  t_field* tfield,
                                  std::string prefix = "",
                                  bool is_propertyless = false);
  void generate_deserialize_struct(std::ofstream& out, t_struct* tstruct, std::string prefix = "");
  void generate_deserialize_container(std::ofstream& out, t_type* ttype, std::string prefix = "");
  void generate_deserialize_set_element(std::ofstream& out, t_set* tset, std::string prefix = "");
  void generate_deserialize_map_element(std::ofstream& out, t_map* tmap, std::string prefix = "");
  void generate_deserialize_list_element(std::ofstream& out, t_list* list, std::string prefix = "");
  void generate_serialize_field(std::ofstream& out,
                                t_field* tfield,
                                std::string prefix = "",
                                bool is_element = false,
                                bool is_propertyless = false);
  void generate_serialize_struct(std::ofstream& out, t_struct* tstruct, std::string prefix = "");
  void generate_serialize_container(std::ofstream& out, t_type* ttype, std::string prefix = "");
  void generate_serialize_map_element(std::ofstream& out,
                                      t_map* tmap,
                                      std::string iter,
                                      std::string map);
  void generate_serialize_set_element(std::ofstream& out, t_set* tmap, std::string iter);
  void generate_serialize_list_element(std::ofstream& out, t_list* tlist, std::string iter);

  void generate_csharp_doc(std::ofstream& out, t_field* field);
  void generate_csharp_doc(std::ofstream& out, t_doc* tdoc);
  void generate_csharp_doc(std::ofstream& out, t_function* tdoc);
  void generate_csharp_docstring_comment(std::ofstream& out, string contents);

  void start_csharp_namespace(std::ofstream& out);
  void end_csharp_namespace(std::ofstream& out);

  std::string csharp_type_usings();
  std::string csharp_thrift_usings();

  std::string type_name(t_type* ttype,
                        bool in_countainer = false,
                        bool in_init = false,
                        bool in_param = false,
                        bool is_required = false);
  std::string base_type_name(t_base_type* tbase,
                             bool in_container = false,
                             bool in_param = false,
                             bool is_required = false);
  std::string declare_field(t_field* tfield, bool init = false, std::string prefix = "");
  std::string function_signature_async_begin(t_function* tfunction, std::string prefix = "");
  std::string function_signature_async_end(t_function* tfunction, std::string prefix = "");
  std::string function_signature_async(t_function* tfunction, std::string prefix = "");
  std::string function_signature(t_function* tfunction, std::string prefix = "");
  std::string argument_list(t_struct* tstruct);
  std::string type_to_enum(t_type* ttype);
  std::string prop_name(t_field* tfield, bool suppress_mapping = false);
  std::string get_enum_class_name(t_type* type);

  bool field_has_default(t_field* tfield) { return tfield->get_value() != NULL; }

  bool field_is_required(t_field* tfield) { return tfield->get_req() == t_field::T_REQUIRED; }

  bool type_can_be_null(t_type* ttype) {
    while (ttype->is_typedef()) {
      ttype = ((t_typedef*)ttype)->get_type();
    }

    return ttype->is_container() || ttype->is_struct() || ttype->is_xception()
           || ttype->is_string();
  }

private:
  std::string namespace_name_;
  std::ofstream f_service_;
  std::string namespace_dir_;
  bool async_;
  bool nullable_;
  bool union_;
  bool hashcode_;
  bool serialize_;
  bool wcf_;
  std::string wcf_namespace_;

  std::map<std::string, int> csharp_keywords;
  std::vector<member_mapping_scope>  member_mapping_scopes;

  void init_keywords();
  std::string normalize_name(std::string name);
  std::string make_valid_csharp_identifier(std::string const& fromName);
  void prepare_member_name_mapping(t_struct* tstruct);
  void prepare_member_name_mapping(void* scope,
                                   const vector<t_field*>& members,
                                   const string& structname);
  void cleanup_member_name_mapping(void* scope);
  string get_mapped_member_name(string oldname);
};

void t_csharp_generator::init_generator() {
  MKDIR(get_out_dir().c_str());
  namespace_name_ = program_->get_namespace("csharp");

  string dir = namespace_name_;
  string subdir = get_out_dir().c_str();
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

  namespace_dir_ = subdir;
  init_keywords();

  while( ! member_mapping_scopes.empty()) {
    cleanup_member_name_mapping( member_mapping_scopes.back().scope_member);
  }

  pverbose("C# options:\n");
  pverbose("- async ...... %s\n", (async_ ? "ON" : "off"));
  pverbose("- nullable ... %s\n", (nullable_ ? "ON" : "off"));
  pverbose("- union ...... %s\n", (union_ ? "ON" : "off"));
  pverbose("- hashcode ... %s\n", (hashcode_ ? "ON" : "off"));
  pverbose("- serialize .. %s\n", (serialize_ ? "ON" : "off"));
  pverbose("- wcf ........ %s\n", (wcf_ ? "ON" : "off"));
}

std::string t_csharp_generator::normalize_name(std::string name) {
  string tmp(name);
  std::transform(tmp.begin(), tmp.end(), tmp.begin(), static_cast<int (*)(int)>(std::tolower));

  // un-conflict keywords by prefixing with "@"
  if (csharp_keywords.find(tmp) != csharp_keywords.end()) {
    return "@" + name;
  }

  // no changes necessary
  return name;
}

void t_csharp_generator::init_keywords() {
  csharp_keywords.clear();

  // C# keywords
  csharp_keywords["abstract"] = 1;
  csharp_keywords["as"] = 1;
  csharp_keywords["base"] = 1;
  csharp_keywords["bool"] = 1;
  csharp_keywords["break"] = 1;
  csharp_keywords["byte"] = 1;
  csharp_keywords["case"] = 1;
  csharp_keywords["catch"] = 1;
  csharp_keywords["char"] = 1;
  csharp_keywords["checked"] = 1;
  csharp_keywords["class"] = 1;
  csharp_keywords["const"] = 1;
  csharp_keywords["continue"] = 1;
  csharp_keywords["decimal"] = 1;
  csharp_keywords["default"] = 1;
  csharp_keywords["delegate"] = 1;
  csharp_keywords["do"] = 1;
  csharp_keywords["double"] = 1;
  csharp_keywords["else"] = 1;
  csharp_keywords["enum"] = 1;
  csharp_keywords["event"] = 1;
  csharp_keywords["explicit"] = 1;
  csharp_keywords["extern"] = 1;
  csharp_keywords["false"] = 1;
  csharp_keywords["finally"] = 1;
  csharp_keywords["fixed"] = 1;
  csharp_keywords["float"] = 1;
  csharp_keywords["for"] = 1;
  csharp_keywords["foreach"] = 1;
  csharp_keywords["goto"] = 1;
  csharp_keywords["if"] = 1;
  csharp_keywords["implicit"] = 1;
  csharp_keywords["in"] = 1;
  csharp_keywords["int"] = 1;
  csharp_keywords["interface"] = 1;
  csharp_keywords["internal"] = 1;
  csharp_keywords["is"] = 1;
  csharp_keywords["lock"] = 1;
  csharp_keywords["long"] = 1;
  csharp_keywords["namespace"] = 1;
  csharp_keywords["new"] = 1;
  csharp_keywords["null"] = 1;
  csharp_keywords["object"] = 1;
  csharp_keywords["operator"] = 1;
  csharp_keywords["out"] = 1;
  csharp_keywords["override"] = 1;
  csharp_keywords["params"] = 1;
  csharp_keywords["private"] = 1;
  csharp_keywords["protected"] = 1;
  csharp_keywords["public"] = 1;
  csharp_keywords["readonly"] = 1;
  csharp_keywords["ref"] = 1;
  csharp_keywords["return"] = 1;
  csharp_keywords["sbyte"] = 1;
  csharp_keywords["sealed"] = 1;
  csharp_keywords["short"] = 1;
  csharp_keywords["sizeof"] = 1;
  csharp_keywords["stackalloc"] = 1;
  csharp_keywords["static"] = 1;
  csharp_keywords["string"] = 1;
  csharp_keywords["struct"] = 1;
  csharp_keywords["switch"] = 1;
  csharp_keywords["this"] = 1;
  csharp_keywords["throw"] = 1;
  csharp_keywords["true"] = 1;
  csharp_keywords["try"] = 1;
  csharp_keywords["typeof"] = 1;
  csharp_keywords["uint"] = 1;
  csharp_keywords["ulong"] = 1;
  csharp_keywords["unchecked"] = 1;
  csharp_keywords["unsafe"] = 1;
  csharp_keywords["ushort"] = 1;
  csharp_keywords["using"] = 1;
  csharp_keywords["virtual"] = 1;
  csharp_keywords["void"] = 1;
  csharp_keywords["volatile"] = 1;
  csharp_keywords["while"] = 1;

  // C# contextual keywords
  csharp_keywords["add"] = 1;
  csharp_keywords["alias"] = 1;
  csharp_keywords["ascending"] = 1;
  csharp_keywords["async"] = 1;
  csharp_keywords["await"] = 1;
  csharp_keywords["descending"] = 1;
  csharp_keywords["dynamic"] = 1;
  csharp_keywords["from"] = 1;
  csharp_keywords["get"] = 1;
  csharp_keywords["global"] = 1;
  csharp_keywords["group"] = 1;
  csharp_keywords["into"] = 1;
  csharp_keywords["join"] = 1;
  csharp_keywords["let"] = 1;
  csharp_keywords["orderby"] = 1;
  csharp_keywords["partial"] = 1;
  csharp_keywords["remove"] = 1;
  csharp_keywords["select"] = 1;
  csharp_keywords["set"] = 1;
  csharp_keywords["value"] = 1;
  csharp_keywords["var"] = 1;
  csharp_keywords["where"] = 1;
  csharp_keywords["yield"] = 1;
}

void t_csharp_generator::start_csharp_namespace(ofstream& out) {
  if (!namespace_name_.empty()) {
    out << "namespace " << namespace_name_ << "\n";
    scope_up(out);
  }
}

void t_csharp_generator::end_csharp_namespace(ofstream& out) {
  if (!namespace_name_.empty()) {
    scope_down(out);
  }
}

string t_csharp_generator::csharp_type_usings() {
  return string() + "using System;\n" + "using System.Collections;\n"
         + "using System.Collections.Generic;\n" + "using System.Text;\n" + "using System.IO;\n"
         + ((async_) ? "using System.Threading.Tasks;\n" : "") + "using Thrift;\n"
         + "using Thrift.Collections;\n" + ((serialize_ || wcf_) ? "#if !SILVERLIGHT\n" : "")
         + ((serialize_ || wcf_) ? "using System.Xml.Serialization;\n" : "")
         + ((serialize_ || wcf_) ? "#endif\n" : "") + (wcf_ ? "//using System.ServiceModel;\n" : "")
         + "using System.Runtime.Serialization;\n";
}

string t_csharp_generator::csharp_thrift_usings() {
  return string() + "using Thrift.Protocol;\n" + "using Thrift.Transport;\n";
}

void t_csharp_generator::close_generator() {
}
void t_csharp_generator::generate_typedef(t_typedef* ttypedef) {
  (void)ttypedef;
}

void t_csharp_generator::generate_enum(t_enum* tenum) {
  string f_enum_name = namespace_dir_ + "/" + (tenum->get_name()) + ".cs";
  ofstream f_enum;
  f_enum.open(f_enum_name.c_str());

  f_enum << autogen_comment() << endl;

  start_csharp_namespace(f_enum);

  generate_csharp_doc(f_enum, tenum);

  indent(f_enum) << "public enum " << tenum->get_name() << "\n";
  scope_up(f_enum);

  vector<t_enum_value*> constants = tenum->get_constants();
  vector<t_enum_value*>::iterator c_iter;
  for (c_iter = constants.begin(); c_iter != constants.end(); ++c_iter) {
    generate_csharp_doc(f_enum, *c_iter);

    int value = (*c_iter)->get_value();
    indent(f_enum) << (*c_iter)->get_name() << " = " << value << "," << endl;
  }

  scope_down(f_enum);

  end_csharp_namespace(f_enum);

  f_enum.close();
}

void t_csharp_generator::generate_consts(std::vector<t_const*> consts) {
  if (consts.empty()) {
    return;
  }
  string f_consts_name = namespace_dir_ + '/' + program_name_ + ".Constants.cs";
  ofstream f_consts;
  f_consts.open(f_consts_name.c_str());

  f_consts << autogen_comment() << csharp_type_usings() << endl;

  start_csharp_namespace(f_consts);

  indent(f_consts) << "public static class " << make_valid_csharp_identifier(program_name_)
                   << "Constants" << endl;
  scope_up(f_consts);

  vector<t_const*>::iterator c_iter;
  bool need_static_constructor = false;
  for (c_iter = consts.begin(); c_iter != consts.end(); ++c_iter) {
    generate_csharp_doc(f_consts, (*c_iter));
    if (print_const_value(f_consts,
                          (*c_iter)->get_name(),
                          (*c_iter)->get_type(),
                          (*c_iter)->get_value(),
                          false)) {
      need_static_constructor = true;
    }
  }

  if (need_static_constructor) {
    print_const_constructor(f_consts, consts);
  }

  scope_down(f_consts);
  end_csharp_namespace(f_consts);
  f_consts.close();
}

void t_csharp_generator::print_const_def_value(std::ofstream& out,
                                               string name,
                                               t_type* type,
                                               t_const_value* value) {
  if (type->is_struct() || type->is_xception()) {
    const vector<t_field*>& fields = ((t_struct*)type)->get_members();
    vector<t_field*>::const_iterator f_iter;
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    prepare_member_name_mapping((t_struct*)type);
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      t_field* field = NULL;
      for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
        if ((*f_iter)->get_name() == v_iter->first->get_string()) {
          field = (*f_iter);
        }
      }
      if (field == NULL) {
        throw "type error: " + type->get_name() + " has no field " + v_iter->first->get_string();
      }
      t_type* field_type = field->get_type();
      string val = render_const_value(out, name, field_type, v_iter->second);
      indent(out) << name << "." << prop_name(field) << " = " << val << ";" << endl;
    }
    cleanup_member_name_mapping((t_struct*)type);
  } else if (type->is_map()) {
    t_type* ktype = ((t_map*)type)->get_key_type();
    t_type* vtype = ((t_map*)type)->get_val_type();
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
      string key = render_const_value(out, name, ktype, v_iter->first);
      string val = render_const_value(out, name, vtype, v_iter->second);
      indent(out) << name << "[" << key << "]"
                  << " = " << val << ";" << endl;
    }
  } else if (type->is_list() || type->is_set()) {
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
      indent(out) << name << ".Add(" << val << ");" << endl;
    }
  }
}

void t_csharp_generator::print_const_constructor(std::ofstream& out, std::vector<t_const*> consts) {
  indent(out) << "static " << make_valid_csharp_identifier(program_name_).c_str() << "Constants()"
              << endl;
  scope_up(out);
  vector<t_const*>::iterator c_iter;
  for (c_iter = consts.begin(); c_iter != consts.end(); ++c_iter) {
    string name = (*c_iter)->get_name();
    t_type* type = (*c_iter)->get_type();
    t_const_value* value = (*c_iter)->get_value();

    print_const_def_value(out, name, type, value);
  }
  scope_down(out);
}

// it seems like all that methods that call this are using in_static to be the opposite of what it
// would imply
bool t_csharp_generator::print_const_value(std::ofstream& out,
                                           string name,
                                           t_type* type,
                                           t_const_value* value,
                                           bool in_static,
                                           bool defval,
                                           bool needtype) {
  indent(out);
  bool need_static_construction = !in_static;
  while (type->is_typedef()) {
    type = ((t_typedef*)type)->get_type();
  }

  if (!defval || needtype) {
    out << (in_static ? "" : type->is_base_type() ? "public const " : "public static ")
        << type_name(type) << " ";
  }
  if (type->is_base_type()) {
    string v2 = render_const_value(out, name, type, value);
    out << name << " = " << v2 << ";" << endl;
    need_static_construction = false;
  } else if (type->is_enum()) {
    out << name << " = " << type_name(type, false, true) << "." << value->get_identifier_name()
        << ";" << endl;
    need_static_construction = false;
  } else if (type->is_struct() || type->is_xception()) {
    out << name << " = new " << type_name(type) << "();" << endl;
  } else if (type->is_map()) {
    out << name << " = new " << type_name(type, true, true) << "();" << endl;
  } else if (type->is_list() || type->is_set()) {
    out << name << " = new " << type_name(type) << "();" << endl;
  }

  if (defval && !type->is_base_type() && !type->is_enum()) {
    print_const_def_value(out, name, type, value);
  }

  return need_static_construction;
}

std::string t_csharp_generator::render_const_value(ofstream& out,
                                                   string name,
                                                   t_type* type,
                                                   t_const_value* value) {
  (void)name;
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
    render << type->get_name() << "." << value->get_identifier_name();
  } else {
    string t = tmp("tmp");
    print_const_value(out, t, type, value, true, true, true);
    render << t;
  }

  return render.str();
}

void t_csharp_generator::generate_struct(t_struct* tstruct) {
  if (union_ && tstruct->is_union()) {
    generate_csharp_union(tstruct);
  } else {
    generate_csharp_struct(tstruct, false);
  }
}

void t_csharp_generator::generate_xception(t_struct* txception) {
  generate_csharp_struct(txception, true);
}

void t_csharp_generator::generate_csharp_struct(t_struct* tstruct, bool is_exception) {
  string f_struct_name = namespace_dir_ + "/" + (tstruct->get_name()) + ".cs";
  ofstream f_struct;

  f_struct.open(f_struct_name.c_str());

  f_struct << autogen_comment() << csharp_type_usings() << csharp_thrift_usings() << endl;

  generate_csharp_struct_definition(f_struct, tstruct, is_exception);

  f_struct.close();
}

void t_csharp_generator::generate_csharp_struct_definition(ofstream& out,
                                                           t_struct* tstruct,
                                                           bool is_exception,
                                                           bool in_class,
                                                           bool is_result) {

  if (!in_class) {
    start_csharp_namespace(out);
  }

  out << endl;

  generate_csharp_doc(out, tstruct);
  prepare_member_name_mapping(tstruct);

  indent(out) << "#if !SILVERLIGHT" << endl;
  indent(out) << "[Serializable]" << endl;
  indent(out) << "#endif" << endl;
  if ((serialize_ || wcf_) && !is_exception) {
    indent(out) << "[DataContract(Namespace=\"" << wcf_namespace_ << "\")]"
                << endl; // do not make exception classes directly WCF serializable, we provide a
                         // separate "fault" for that
  }
  bool is_final = (tstruct->annotations_.find("final") != tstruct->annotations_.end());

  indent(out) << "public " << (is_final ? "sealed " : "") << "partial class "
              << normalize_name(tstruct->get_name()) << " : ";

  if (is_exception) {
    out << "TException, ";
  }
  out << "TBase";

  out << endl;

  scope_up(out);

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  // make private members with public Properties
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    // if the field is requied, then we use auto-properties
    if (!field_is_required((*m_iter)) && (!nullable_ || field_has_default((*m_iter)))) {
      indent(out) << "private " << declare_field(*m_iter, false, "_") << endl;
    }
  }
  out << endl;

  bool has_non_required_fields = false;
  bool has_non_required_default_value_fields = false;
  bool has_required_fields = false;
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    generate_csharp_doc(out, *m_iter);
    generate_property(out, *m_iter, true, true);
    bool is_required = field_is_required((*m_iter));
    bool has_default = field_has_default((*m_iter));
    if (is_required) {
      has_required_fields = true;
    } else {
      if (has_default) {
        has_non_required_default_value_fields = true;
      }
      has_non_required_fields = true;
    }
  }

  bool generate_isset = (nullable_ && has_non_required_default_value_fields)
                        || (!nullable_ && has_non_required_fields);
  if (generate_isset) {
    out << endl;
    if (serialize_ || wcf_) {
      out << indent() << "[XmlIgnore] // XmlSerializer" << endl << indent()
          << "[DataMember(Order = 1)]  // XmlObjectSerializer, DataContractJsonSerializer, etc."
          << endl;
    }
    out << indent() << "public Isset __isset;" << endl << indent() << "#if !SILVERLIGHT" << endl
        << indent() << "[Serializable]" << endl << indent() << "#endif" << endl;
    if (serialize_ || wcf_) {
      indent(out) << "[DataContract]" << endl;
    }
    indent(out) << "public struct Isset {" << endl;
    indent_up();
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      bool is_required = field_is_required((*m_iter));
      bool has_default = field_has_default((*m_iter));
      // if it is required, don't need Isset for that variable
      // if it is not required, if it has a default value, we need to generate Isset
      // if we are not nullable, then we generate Isset
      if (!is_required && (!nullable_ || has_default)) {
        if (serialize_ || wcf_) {
          indent(out) << "[DataMember]" << endl;
        }
        indent(out) << "public bool " << normalize_name((*m_iter)->get_name()) << ";" << endl;
      }
    }

    indent_down();
    indent(out) << "}" << endl << endl;

    if (generate_isset && (serialize_ || wcf_)) {
      indent(out) << "#region XmlSerializer support" << endl << endl;

      for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
        bool is_required = field_is_required((*m_iter));
        bool has_default = field_has_default((*m_iter));
        // if it is required, don't need Isset for that variable
        // if it is not required, if it has a default value, we need to generate Isset
        // if we are not nullable, then we generate Isset
        if (!is_required && (!nullable_ || has_default)) {
          indent(out) << "public bool ShouldSerialize" << prop_name((*m_iter)) << "()" << endl;
          indent(out) << "{" << endl;
          indent_up();
          indent(out) << "return __isset." << normalize_name((*m_iter)->get_name()) << ";" << endl;
          indent_down();
          indent(out) << "}" << endl << endl;
        }
      }

      indent(out) << "#endregion XmlSerializer support" << endl << endl;
    }
  }

  // We always want a default, no argument constructor for Reading
  indent(out) << "public " << normalize_name(tstruct->get_name()) << "() {" << endl;
  indent_up();

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    t_type* t = (*m_iter)->get_type();
    while (t->is_typedef()) {
      t = ((t_typedef*)t)->get_type();
    }
    if ((*m_iter)->get_value() != NULL) {
      if (field_is_required((*m_iter))) {
        print_const_value(out, "this." + prop_name(*m_iter), t, (*m_iter)->get_value(), true, true);
      } else {
        print_const_value(out,
                          "this._" + (*m_iter)->get_name(),
                          t,
                          (*m_iter)->get_value(),
                          true,
                          true);
        // Optionals with defaults are marked set
        indent(out) << "this.__isset." << normalize_name((*m_iter)->get_name()) << " = true;"
                    << endl;
      }
    }
  }
  indent_down();
  indent(out) << "}" << endl << endl;

  if (has_required_fields) {
    indent(out) << "public " << tstruct->get_name() << "(";
    bool first = true;
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      if (field_is_required((*m_iter))) {
        if (first) {
          first = false;
        } else {
          out << ", ";
        }
        out << type_name((*m_iter)->get_type()) << " " << (*m_iter)->get_name();
      }
    }
    out << ") : this() {" << endl;
    indent_up();

    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      if (field_is_required((*m_iter))) {
        indent(out) << "this." << prop_name((*m_iter)) << " = " << (*m_iter)->get_name() << ";"
                    << endl;
      }
    }

    indent_down();
    indent(out) << "}" << endl << endl;
  }

  generate_csharp_struct_reader(out, tstruct);
  if (is_result) {
    generate_csharp_struct_result_writer(out, tstruct);
  } else {
    generate_csharp_struct_writer(out, tstruct);
  }
  if (hashcode_) {
    generate_csharp_struct_equals(out, tstruct);
    generate_csharp_struct_hashcode(out, tstruct);
  }
  generate_csharp_struct_tostring(out, tstruct);
  scope_down(out);
  out << endl;

  // generate a corresponding WCF fault to wrap the exception
  if ((serialize_ || wcf_) && is_exception) {
    generate_csharp_wcffault(out, tstruct);
  }

  cleanup_member_name_mapping(tstruct);
  if (!in_class) {
    end_csharp_namespace(out);
  }
}

void t_csharp_generator::generate_csharp_wcffault(ofstream& out, t_struct* tstruct) {
  out << endl;
  indent(out) << "#if !SILVERLIGHT" << endl;
  indent(out) << "[Serializable]" << endl;
  indent(out) << "#endif" << endl;
  indent(out) << "[DataContract]" << endl;
  bool is_final = (tstruct->annotations_.find("final") != tstruct->annotations_.end());

  indent(out) << "public " << (is_final ? "sealed " : "") << "partial class " << tstruct->get_name()
              << "Fault" << endl;

  scope_up(out);

  const vector<t_field*>& members = tstruct->get_members();
  vector<t_field*>::const_iterator m_iter;

  // make private members with public Properties
  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    indent(out) << "private " << declare_field(*m_iter, false, "_") << endl;
  }
  out << endl;

  for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
    generate_property(out, *m_iter, true, false);
  }

  scope_down(out);
  out << endl;
}

void t_csharp_generator::generate_csharp_struct_reader(ofstream& out, t_struct* tstruct) {
  indent(out) << "public void Read (TProtocol iprot)" << endl;
  scope_up(out);

  out << indent() << "iprot.IncrementRecursionDepth();" << endl;
  out << indent() << "try" << endl;
  scope_up(out);

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  // Required variables aren't in __isset, so we need tmp vars to check them
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (field_is_required((*f_iter))) {
      indent(out) << "bool isset_" << (*f_iter)->get_name() << " = false;" << endl;
    }
  }

  indent(out) << "TField field;" << endl << indent() << "iprot.ReadStructBegin();" << endl;

  indent(out) << "while (true)" << endl;
  scope_up(out);

  indent(out) << "field = iprot.ReadFieldBegin();" << endl;

  indent(out) << "if (field.Type == TType.Stop) { " << endl;
  indent_up();
  indent(out) << "break;" << endl;
  indent_down();
  indent(out) << "}" << endl;

  indent(out) << "switch (field.ID)" << endl;

  scope_up(out);

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    bool is_required = field_is_required((*f_iter));
    indent(out) << "case " << (*f_iter)->get_key() << ":" << endl;
    indent_up();
    indent(out) << "if (field.Type == " << type_to_enum((*f_iter)->get_type()) << ") {" << endl;
    indent_up();

    generate_deserialize_field(out, *f_iter);
    if (is_required) {
      indent(out) << "isset_" << (*f_iter)->get_name() << " = true;" << endl;
    }

    indent_down();
    out << indent() << "} else { " << endl << indent() << "  TProtocolUtil.Skip(iprot, field.Type);"
        << endl << indent() << "}" << endl << indent() << "break;" << endl;
    indent_down();
  }

  indent(out) << "default: " << endl;
  indent_up();
  indent(out) << "TProtocolUtil.Skip(iprot, field.Type);" << endl;
  indent(out) << "break;" << endl;
  indent_down();

  scope_down(out);

  indent(out) << "iprot.ReadFieldEnd();" << endl;

  scope_down(out);

  indent(out) << "iprot.ReadStructEnd();" << endl;

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (field_is_required((*f_iter))) {
      indent(out) << "if (!isset_" << (*f_iter)->get_name() << ")" << endl;
      indent_up();
      indent(out) << "throw new TProtocolException(TProtocolException.INVALID_DATA);" << endl;
      indent_down();
    }
  }

  scope_down(out);
  out << indent() << "finally" << endl;
  scope_up(out);
  out << indent() << "iprot.DecrementRecursionDepth();" << endl;
  scope_down(out);

  indent_down();

  indent(out) << "}" << endl << endl;
}

void t_csharp_generator::generate_csharp_struct_writer(ofstream& out, t_struct* tstruct) {
  out << indent() << "public void Write(TProtocol oprot) {" << endl;
  indent_up();

  out << indent() << "oprot.IncrementRecursionDepth();" << endl;
  out << indent() << "try" << endl;
  scope_up(out);

  string name = tstruct->get_name();
  const vector<t_field*>& fields = tstruct->get_sorted_members();
  vector<t_field*>::const_iterator f_iter;

  indent(out) << "TStruct struc = new TStruct(\"" << name << "\");" << endl;
  indent(out) << "oprot.WriteStructBegin(struc);" << endl;

  if (fields.size() > 0) {
    indent(out) << "TField field = new TField();" << endl;
    for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
      bool is_required = field_is_required((*f_iter));
      bool has_default = field_has_default((*f_iter));
      if (nullable_ && !has_default && !is_required) {
        indent(out) << "if (" << prop_name((*f_iter)) << " != null) {" << endl;
        indent_up();
      } else if (!is_required) {
        bool null_allowed = type_can_be_null((*f_iter)->get_type());
        if (null_allowed) {
          indent(out) << "if (" << prop_name((*f_iter)) << " != null && __isset."
                      << normalize_name((*f_iter)->get_name()) << ") {" << endl;
          indent_up();
        } else {
          indent(out) << "if (__isset." << normalize_name((*f_iter)->get_name()) << ") {" << endl;
          indent_up();
        }
      }
      indent(out) << "field.Name = \"" << (*f_iter)->get_name() << "\";" << endl;
      indent(out) << "field.Type = " << type_to_enum((*f_iter)->get_type()) << ";" << endl;
      indent(out) << "field.ID = " << (*f_iter)->get_key() << ";" << endl;
      indent(out) << "oprot.WriteFieldBegin(field);" << endl;

      generate_serialize_field(out, *f_iter);

      indent(out) << "oprot.WriteFieldEnd();" << endl;
      if (!is_required) {
        indent_down();
        indent(out) << "}" << endl;
      }
    }
  }

  indent(out) << "oprot.WriteFieldStop();" << endl;
  indent(out) << "oprot.WriteStructEnd();" << endl;

  scope_down(out);
  out << indent() << "finally" << endl;
  scope_up(out);
  out << indent() << "oprot.DecrementRecursionDepth();" << endl;
  scope_down(out);

  indent_down();

  indent(out) << "}" << endl << endl;
}

void t_csharp_generator::generate_csharp_struct_result_writer(ofstream& out, t_struct* tstruct) {
  indent(out) << "public void Write(TProtocol oprot) {" << endl;
  indent_up();

  out << indent() << "oprot.IncrementRecursionDepth();" << endl;
  out << indent() << "try" << endl;
  scope_up(out);

  string name = tstruct->get_name();
  const vector<t_field*>& fields = tstruct->get_sorted_members();
  vector<t_field*>::const_iterator f_iter;

  indent(out) << "TStruct struc = new TStruct(\"" << name << "\");" << endl;
  indent(out) << "oprot.WriteStructBegin(struc);" << endl;

  if (fields.size() > 0) {
    indent(out) << "TField field = new TField();" << endl;
    bool first = true;
    for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
      if (first) {
        first = false;
        out << endl << indent() << "if ";
      } else {
        out << " else if ";
      }

      if (nullable_) {
        out << "(this." << prop_name((*f_iter)) << " != null) {" << endl;
      } else {
        out << "(this.__isset." << normalize_name((*f_iter)->get_name()) << ") {" << endl;
      }
      indent_up();

      bool null_allowed = !nullable_ && type_can_be_null((*f_iter)->get_type());
      if (null_allowed) {
        indent(out) << "if (" << prop_name(*f_iter) << " != null) {" << endl;
        indent_up();
      }

      indent(out) << "field.Name = \"" << prop_name(*f_iter) << "\";" << endl;
      indent(out) << "field.Type = " << type_to_enum((*f_iter)->get_type()) << ";" << endl;
      indent(out) << "field.ID = " << (*f_iter)->get_key() << ";" << endl;
      indent(out) << "oprot.WriteFieldBegin(field);" << endl;

      generate_serialize_field(out, *f_iter);

      indent(out) << "oprot.WriteFieldEnd();" << endl;

      if (null_allowed) {
        indent_down();
        indent(out) << "}" << endl;
      }

      indent_down();
      indent(out) << "}";
    }
  }

  out << endl << indent() << "oprot.WriteFieldStop();" << endl << indent()
      << "oprot.WriteStructEnd();" << endl;

  scope_down(out);
  out << indent() << "finally" << endl;
  scope_up(out);
  out << indent() << "oprot.DecrementRecursionDepth();" << endl;
  scope_down(out);

  indent_down();

  indent(out) << "}" << endl << endl;
}

void t_csharp_generator::generate_csharp_struct_tostring(ofstream& out, t_struct* tstruct) {
  indent(out) << "public override string ToString() {" << endl;
  indent_up();

  indent(out) << "StringBuilder __sb = new StringBuilder(\"" << tstruct->get_name() << "(\");"
              << endl;

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  bool useFirstFlag = false;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (!field_is_required((*f_iter))) {
      indent(out) << "bool __first = true;" << endl;
      useFirstFlag = true;
    }
    break;
  }

  bool had_required = false; // set to true after first required field has been processed

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    bool is_required = field_is_required((*f_iter));
    bool has_default = field_has_default((*f_iter));
    if (nullable_ && !has_default && !is_required) {
      indent(out) << "if (" << prop_name((*f_iter)) << " != null) {" << endl;
      indent_up();
    } else if (!is_required) {
      bool null_allowed = type_can_be_null((*f_iter)->get_type());
      if (null_allowed) {
        indent(out) << "if (" << prop_name((*f_iter)) << " != null && __isset."
                    << normalize_name((*f_iter)->get_name()) << ") {" << endl;
        indent_up();
      } else {
        indent(out) << "if (__isset." << normalize_name((*f_iter)->get_name()) << ") {" << endl;
        indent_up();
      }
    }

    if (useFirstFlag && (!had_required)) {
      indent(out) << "if(!__first) { __sb.Append(\", \"); }" << endl;
      if (!is_required) {
        indent(out) << "__first = false;" << endl;
      }
      indent(out) << "__sb.Append(\"" << prop_name((*f_iter)) << ": \");" << endl;
    } else {
      indent(out) << "__sb.Append(\", " << prop_name((*f_iter)) << ": \");" << endl;
    }

    t_type* ttype = (*f_iter)->get_type();
    if (ttype->is_xception() || ttype->is_struct()) {
      indent(out) << "__sb.Append(" << prop_name((*f_iter))
                  << "== null ? \"<null>\" : " << prop_name((*f_iter)) << ".ToString());" << endl;
    } else {
      indent(out) << "__sb.Append(" << prop_name((*f_iter)) << ");" << endl;
    }

    if (!is_required) {
      indent_down();
      indent(out) << "}" << endl;
    } else {
      had_required = true; // now __first must be false, so we don't need to check it anymore
    }
  }

  indent(out) << "__sb.Append(\")\");" << endl;
  indent(out) << "return __sb.ToString();" << endl;

  indent_down();
  indent(out) << "}" << endl << endl;
}

void t_csharp_generator::generate_csharp_union(t_struct* tunion) {
  string f_union_name = namespace_dir_ + "/" + (tunion->get_name()) + ".cs";
  ofstream f_union;

  f_union.open(f_union_name.c_str());

  f_union << autogen_comment() << csharp_type_usings() << csharp_thrift_usings() << endl;

  generate_csharp_union_definition(f_union, tunion);

  f_union.close();
}

void t_csharp_generator::generate_csharp_union_definition(std::ofstream& out, t_struct* tunion) {
  // Let's define the class first
  start_csharp_namespace(out);

  indent(out) << "public abstract partial class " << tunion->get_name() << " : TAbstractBase {"
              << endl;

  indent_up();

  indent(out) << "public abstract void Write(TProtocol protocol);" << endl;
  indent(out) << "public readonly bool Isset;" << endl;
  indent(out) << "public abstract object Data { get; }" << endl;

  indent(out) << "protected " << tunion->get_name() << "(bool isset) {" << endl;
  indent_up();
  indent(out) << "Isset = isset;" << endl;
  indent_down();
  indent(out) << "}" << endl << endl;

  indent(out) << "public class ___undefined : " << tunion->get_name() << " {" << endl;
  indent_up();

  indent(out) << "public override object Data { get { return null; } }" << endl;

  indent(out) << "public ___undefined() : base(false) {}" << endl << endl;

  indent(out) << "public override void Write(TProtocol protocol) {" << endl;
  indent_up();
  indent(out) << "throw new TProtocolException( TProtocolException.INVALID_DATA, \"Cannot persist "
                 "an union type which is not set.\");" << endl;
  indent_down();
  indent(out) << "}" << endl << endl;

  indent_down();
  indent(out) << "}" << endl << endl;

  const vector<t_field*>& fields = tunion->get_members();
  vector<t_field*>::const_iterator f_iter;

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    generate_csharp_union_class(out, tunion, (*f_iter));
  }

  generate_csharp_union_reader(out, tunion);

  indent_down();
  indent(out) << "}" << endl << endl;

  end_csharp_namespace(out);
}

void t_csharp_generator::generate_csharp_union_class(std::ofstream& out,
                                                     t_struct* tunion,
                                                     t_field* tfield) {
  indent(out) << "public class " << tfield->get_name() << " : " << tunion->get_name() << " {"
              << endl;
  indent_up();
  indent(out) << "private " << type_name(tfield->get_type()) << " _data;" << endl;
  indent(out) << "public override object Data { get { return _data; } }" << endl;
  indent(out) << "public " << tfield->get_name() << "(" << type_name(tfield->get_type())
              << " data) : base(true) {" << endl;
  indent_up();
  indent(out) << "this._data = data;" << endl;
  indent_down();
  indent(out) << "}" << endl;
  indent(out) << "public override void Write(TProtocol oprot) {" << endl;
  indent_up();

  out << indent() << "oprot.IncrementRecursionDepth();" << endl;
  out << indent() << "try" << endl;
  scope_up(out);

  indent(out) << "TStruct struc = new TStruct(\"" << tunion->get_name() << "\");" << endl;
  indent(out) << "oprot.WriteStructBegin(struc);" << endl;

  indent(out) << "TField field = new TField();" << endl;
  indent(out) << "field.Name = \"" << tfield->get_name() << "\";" << endl;
  indent(out) << "field.Type = " << type_to_enum(tfield->get_type()) << ";" << endl;
  indent(out) << "field.ID = " << tfield->get_key() << ";" << endl;
  indent(out) << "oprot.WriteFieldBegin(field);" << endl;

  generate_serialize_field(out, tfield, "_data", true, true);

  indent(out) << "oprot.WriteFieldEnd();" << endl;
  indent(out) << "oprot.WriteFieldStop();" << endl;
  indent(out) << "oprot.WriteStructEnd();" << endl;
  indent_down();

  scope_down(out);
  out << indent() << "finally" << endl;
  scope_up(out);
  out << indent() << "oprot.DecrementRecursionDepth();" << endl;
  scope_down(out);

  indent(out) << "}" << endl;

  indent_down();
  indent(out) << "}" << endl << endl;
}

void t_csharp_generator::generate_csharp_struct_equals(ofstream& out, t_struct* tstruct) {
  indent(out) << "public override bool Equals(object that) {" << endl;
  indent_up();

  indent(out) << "var other = that as " << type_name(tstruct) << ";" << endl;
  indent(out) << "if (other == null) return false;" << endl;
  indent(out) << "if (ReferenceEquals(this, other)) return true;" << endl;

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  bool first = true;

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (first) {
      first = false;
      indent(out) << "return ";
      indent_up();
    } else {
      out << endl;
      indent(out) << "&& ";
    }
    if (!field_is_required((*f_iter)) && !(nullable_ && !field_has_default((*f_iter)))) {
      out << "((__isset." << normalize_name((*f_iter)->get_name()) << " == other.__isset."
          << normalize_name((*f_iter)->get_name()) << ") && ((!__isset."
          << normalize_name((*f_iter)->get_name()) << ") || (";
    }
    t_type* ttype = (*f_iter)->get_type();
    if (ttype->is_container() || (ttype->is_base_type() && (((t_base_type*)ttype)->is_binary()))) {
      out << "TCollections.Equals(";
    } else {
      out << "System.Object.Equals(";
    }
    out << prop_name((*f_iter)) << ", other." << prop_name((*f_iter)) << ")";
    if (!field_is_required((*f_iter)) && !(nullable_ && !field_has_default((*f_iter)))) {
      out << ")))";
    }
  }
  if (first) {
    indent(out) << "return true;" << endl;
  } else {
    out << ";" << endl;
    indent_down();
  }

  indent_down();
  indent(out) << "}" << endl << endl;
}

void t_csharp_generator::generate_csharp_struct_hashcode(ofstream& out, t_struct* tstruct) {
  indent(out) << "public override int GetHashCode() {" << endl;
  indent_up();

  indent(out) << "int hashcode = 0;" << endl;
  indent(out) << "unchecked {" << endl;
  indent_up();

  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    t_type* ttype = (*f_iter)->get_type();
    indent(out) << "hashcode = (hashcode * 397) ^ ";
    if (field_is_required((*f_iter))) {
      out << "(";
    } else if (nullable_) {
      out << "(" << prop_name((*f_iter)) << " == null ? 0 : ";
    } else {
      out << "(!__isset." << normalize_name((*f_iter)->get_name()) << " ? 0 : ";
    }
    if (ttype->is_container()) {
      out << "(TCollections.GetHashCode(" << prop_name((*f_iter)) << "))";
    } else {
      out << "(" << prop_name((*f_iter)) << ".GetHashCode())";
    }
    out << ");" << endl;
  }

  indent_down();
  indent(out) << "}" << endl;
  indent(out) << "return hashcode;" << endl;

  indent_down();
  indent(out) << "}" << endl << endl;
}

void t_csharp_generator::generate_service(t_service* tservice) {
  string f_service_name = namespace_dir_ + "/" + service_name_ + ".cs";
  f_service_.open(f_service_name.c_str());

  f_service_ << autogen_comment() << csharp_type_usings() << csharp_thrift_usings() << endl;

  start_csharp_namespace(f_service_);

  indent(f_service_) << "public partial class " << normalize_name(service_name_) << " {" << endl;
  indent_up();

  generate_service_interface(tservice);
  generate_service_client(tservice);
  generate_service_server(tservice);
  generate_service_helpers(tservice);

  indent_down();

  indent(f_service_) << "}" << endl;
  end_csharp_namespace(f_service_);
  f_service_.close();
}

void t_csharp_generator::generate_service_interface(t_service* tservice) {
  generate_separate_service_interfaces(tservice);
}

void t_csharp_generator::generate_separate_service_interfaces(t_service* tservice) {
  generate_sync_service_interface(tservice);

  if (async_) {
    generate_async_service_interface(tservice);
  }

  generate_combined_service_interface(tservice);
}

void t_csharp_generator::generate_sync_service_interface(t_service* tservice) {
  string extends = "";
  string extends_iface = "";
  if (tservice->get_extends() != NULL) {
    extends = type_name(tservice->get_extends());
    extends_iface = " : " + extends + ".ISync";
  }

  generate_csharp_doc(f_service_, tservice);

  if (wcf_) {
    indent(f_service_) << "[ServiceContract(Namespace=\"" << wcf_namespace_ << "\")]" << endl;
  }
  indent(f_service_) << "public interface ISync" << extends_iface << " {" << endl;

  indent_up();
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    generate_csharp_doc(f_service_, *f_iter);

    // if we're using WCF, add the corresponding attributes
    if (wcf_) {
      indent(f_service_) << "[OperationContract]" << endl;

      const std::vector<t_field*>& xceptions = (*f_iter)->get_xceptions()->get_members();
      vector<t_field*>::const_iterator x_iter;
      for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
        indent(f_service_) << "[FaultContract(typeof("
          + type_name((*x_iter)->get_type(), false, false) + "Fault))]" << endl;
      }
    }

    indent(f_service_) << function_signature(*f_iter) << ";" << endl;
  }
  indent_down();
  f_service_ << indent() << "}" << endl << endl;
}

void t_csharp_generator::generate_async_service_interface(t_service* tservice) {
  string extends = "";
  string extends_iface = "";
  if (tservice->get_extends() != NULL) {
    extends = type_name(tservice->get_extends());
    extends_iface = " : " + extends + ".IAsync";
  }

  generate_csharp_doc(f_service_, tservice);

  if (wcf_) {
    indent(f_service_) << "[ServiceContract(Namespace=\"" << wcf_namespace_ << "\")]" << endl;
  }
  indent(f_service_) << "public interface IAsync" << extends_iface << " {" << endl;

  indent_up();
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    generate_csharp_doc(f_service_, *f_iter);

    // if we're using WCF, add the corresponding attributes
    if (wcf_) {
      indent(f_service_) << "[OperationContract]" << endl;

      const std::vector<t_field*>& xceptions = (*f_iter)->get_xceptions()->get_members();
      vector<t_field*>::const_iterator x_iter;
      for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
        indent(f_service_) << "[FaultContract(typeof("
          + type_name((*x_iter)->get_type(), false, false) + "Fault))]" << endl;
      }
    }

    indent(f_service_) << function_signature_async(*f_iter) << ";" << endl;
  }
  indent_down();
  f_service_ << indent() << "}" << endl << endl;
}

void t_csharp_generator::generate_combined_service_interface(t_service* tservice) {
  string extends_iface = " : ISync";

  if (async_) {
    extends_iface += ", IAsync";
  }

  generate_csharp_doc(f_service_, tservice);

  if (wcf_) {
    indent(f_service_) << "[ServiceContract(Namespace=\"" << wcf_namespace_ << "\")]" << endl;
  }

  indent(f_service_) << "public interface Iface" << extends_iface << " {" << endl;

  indent_up();

  // We need to generate extra old style async methods for silverlight. Since
  // this isn't something you'd want to implement server-side, just put them into
  // the main Iface interface.
  generate_silverlight_async_methods(tservice);

  indent_down();

  f_service_ << indent() << "}" << endl << endl;
}

void t_csharp_generator::generate_silverlight_async_methods(t_service* tservice) {
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    generate_csharp_doc(f_service_, *f_iter);

    // For backwards compatibility, include the Begin_, End_ methods if we're generating
    // with the async flag. I'm not sure this is necessary, so someone with more knowledge
    // can maybe remove these checks if they know it's safe.
    if (!async_) {
      indent(f_service_) << "#if SILVERLIGHT" << endl;
    }

    indent(f_service_) << function_signature_async_begin(*f_iter, "Begin_") << ";" << endl;
    indent(f_service_) << function_signature_async_end(*f_iter, "End_") << ";" << endl;

    if (!async_) {
      indent(f_service_) << "#endif" << endl;
    }
  }
}

void t_csharp_generator::generate_service_helpers(t_service* tservice) {
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;

  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    t_struct* ts = (*f_iter)->get_arglist();
    generate_csharp_struct_definition(f_service_, ts, false, true);
    generate_function_helpers(*f_iter);
  }
}

void t_csharp_generator::generate_service_client(t_service* tservice) {
  string extends = "";
  string extends_client = "";
  if (tservice->get_extends() != NULL) {
    extends = type_name(tservice->get_extends());
    extends_client = extends + ".Client, ";
  } else {
    extends_client = "IDisposable, ";
  }

  generate_csharp_doc(f_service_, tservice);

  indent(f_service_) << "public class Client : " << extends_client << "Iface {" << endl;
  indent_up();
  indent(f_service_) << "public Client(TProtocol prot) : this(prot, prot)" << endl;
  scope_up(f_service_);
  scope_down(f_service_);
  f_service_ << endl;

  indent(f_service_) << "public Client(TProtocol iprot, TProtocol oprot)";
  if (!extends.empty()) {
    f_service_ << " : base(iprot, oprot)";
  }
  f_service_ << endl;

  scope_up(f_service_);
  if (extends.empty()) {
    f_service_ << indent() << "iprot_ = iprot;" << endl << indent() << "oprot_ = oprot;" << endl;
  }
  scope_down(f_service_);

  f_service_ << endl;

  if (extends.empty()) {
    f_service_ << indent() << "protected TProtocol iprot_;" << endl << indent()
               << "protected TProtocol oprot_;" << endl << indent() << "protected int seqid_;"
               << endl << endl;

    f_service_ << indent() << "public TProtocol InputProtocol" << endl;
    scope_up(f_service_);
    indent(f_service_) << "get { return iprot_; }" << endl;
    scope_down(f_service_);

    f_service_ << indent() << "public TProtocol OutputProtocol" << endl;
    scope_up(f_service_);
    indent(f_service_) << "get { return oprot_; }" << endl;
    scope_down(f_service_);
    f_service_ << endl << endl;

    indent(f_service_) << "#region \" IDisposable Support \"" << endl;
    indent(f_service_) << "private bool _IsDisposed;" << endl << endl;
    indent(f_service_) << "// IDisposable" << endl;
    indent(f_service_) << "public void Dispose()" << endl;
    scope_up(f_service_);
    indent(f_service_) << "Dispose(true);" << endl;
    scope_down(f_service_);
    indent(f_service_) << endl << endl;
    indent(f_service_) << "protected virtual void Dispose(bool disposing)" << endl;
    scope_up(f_service_);
    indent(f_service_) << "if (!_IsDisposed)" << endl;
    scope_up(f_service_);
    indent(f_service_) << "if (disposing)" << endl;
    scope_up(f_service_);
    indent(f_service_) << "if (iprot_ != null)" << endl;
    scope_up(f_service_);
    indent(f_service_) << "((IDisposable)iprot_).Dispose();" << endl;
    scope_down(f_service_);
    indent(f_service_) << "if (oprot_ != null)" << endl;
    scope_up(f_service_);
    indent(f_service_) << "((IDisposable)oprot_).Dispose();" << endl;
    scope_down(f_service_);
    scope_down(f_service_);
    scope_down(f_service_);
    indent(f_service_) << "_IsDisposed = true;" << endl;
    scope_down(f_service_);
    indent(f_service_) << "#endregion" << endl;
    f_service_ << endl << endl;
  }

  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::const_iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    string funname = (*f_iter)->get_name();

    indent(f_service_) << endl;

    if (!async_) {
      indent(f_service_) << "#if SILVERLIGHT" << endl;
    }
    // Begin_
    indent(f_service_) << "public " << function_signature_async_begin(*f_iter, "Begin_") << endl;
    scope_up(f_service_);
    indent(f_service_) << "return "
                       << "send_" << funname << "(callback, state";

    t_struct* arg_struct = (*f_iter)->get_arglist();
    prepare_member_name_mapping(arg_struct);

    const vector<t_field*>& fields = arg_struct->get_members();
    vector<t_field*>::const_iterator fld_iter;
    for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
      f_service_ << ", ";
      f_service_ << normalize_name((*fld_iter)->get_name());
    }
    f_service_ << ");" << endl;
    scope_down(f_service_);
    f_service_ << endl;

    // End
    indent(f_service_) << "public " << function_signature_async_end(*f_iter, "End_") << endl;
    scope_up(f_service_);
    indent(f_service_) << "oprot_.Transport.EndFlush(asyncResult);" << endl;
    if (!(*f_iter)->is_oneway()) {
      f_service_ << indent();
      if (!(*f_iter)->get_returntype()->is_void()) {
        f_service_ << "return ";
      }
      f_service_ << "recv_" << funname << "();" << endl;
    }
    scope_down(f_service_);
    f_service_ << endl;

    // async
    bool first;
    if (async_) {
      indent(f_service_) << "public async " << function_signature_async(*f_iter, "") << endl;
      scope_up(f_service_);

      if (!(*f_iter)->get_returntype()->is_void()) {
        indent(f_service_) << type_name((*f_iter)->get_returntype()) << " retval;" << endl;
        indent(f_service_) << "retval = ";
      } else {
        indent(f_service_);
      }
      f_service_ << "await Task.Run(() =>" << endl;
      scope_up(f_service_);
      indent(f_service_);
      if (!(*f_iter)->get_returntype()->is_void()) {
        f_service_ << "return ";
      }
      f_service_ << funname << "(";
      first = true;
      for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
        if (first) {
          first = false;
        } else {
          f_service_ << ", ";
        }
        f_service_ << (*fld_iter)->get_name();
      }
      f_service_ << ");" << endl;
      indent_down();
      indent(f_service_) << "});" << endl;
      if (!(*f_iter)->get_returntype()->is_void()) {
        indent(f_service_) << "return retval;" << endl;
      }
      scope_down(f_service_);
      f_service_ << endl;
    }

    if (!async_) {
      indent(f_service_) << "#endif" << endl << endl;
    }

    // "Normal" Synchronous invoke
    generate_csharp_doc(f_service_, *f_iter);
    indent(f_service_) << "public " << function_signature(*f_iter) << endl;
    scope_up(f_service_);

    if (!async_) {
      indent(f_service_) << "#if !SILVERLIGHT" << endl;
      indent(f_service_) << "send_" << funname << "(";

      first = true;
      for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
        if (first) {
          first = false;
        } else {
          f_service_ << ", ";
        }
        f_service_ << normalize_name((*fld_iter)->get_name());
      }
      f_service_ << ");" << endl;

      if (!(*f_iter)->is_oneway()) {
        f_service_ << indent();
        if (!(*f_iter)->get_returntype()->is_void()) {
          f_service_ << "return ";
        }
        f_service_ << "recv_" << funname << "();" << endl;
      }
      f_service_ << endl;

      indent(f_service_) << "#else" << endl;
    }

    // Silverlight synchronous invoke
    indent(f_service_) << "var asyncResult = Begin_" << funname << "(null, null";
    for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
      f_service_ << ", " << normalize_name((*fld_iter)->get_name());
    }
    f_service_ << ");" << endl;

    if (!(*f_iter)->is_oneway()) {
      f_service_ << indent();
      if (!(*f_iter)->get_returntype()->is_void()) {
        f_service_ << "return ";
      }
      f_service_ << "End_" << funname << "(asyncResult);" << endl;
    }
    f_service_ << endl;

    if (!async_) {
      indent(f_service_) << "#endif" << endl;
    }
    scope_down(f_service_);

    // Send
    t_function send_function(g_type_void,
                             string("send_") + (*f_iter)->get_name(),
                             (*f_iter)->get_arglist());

    string argsname = (*f_iter)->get_name() + "_args";

    if (!async_) {
      indent(f_service_) << "#if SILVERLIGHT" << endl;
    }
    indent(f_service_) << "public " << function_signature_async_begin(&send_function) << endl;
    if (!async_) {
      indent(f_service_) << "#else" << endl;
      indent(f_service_) << "public " << function_signature(&send_function) << endl;
      indent(f_service_) << "#endif" << endl;
    }
    scope_up(f_service_);

    f_service_ << indent() << "oprot_.WriteMessageBegin(new TMessage(\"" << funname << "\", "
               << ((*f_iter)->is_oneway() ? "TMessageType.Oneway" : "TMessageType.Call")
               << ", seqid_));" << endl << indent() << argsname << " args = new " << argsname
               << "();" << endl;

    for (fld_iter = fields.begin(); fld_iter != fields.end(); ++fld_iter) {
      f_service_ << indent() << "args." << prop_name(*fld_iter) << " = "
                 << normalize_name((*fld_iter)->get_name()) << ";" << endl;
    }

    f_service_ << indent() << "args.Write(oprot_);" << endl << indent()
               << "oprot_.WriteMessageEnd();" << endl;
    ;

    if (!async_) {
      indent(f_service_) << "#if SILVERLIGHT" << endl;
    }
    indent(f_service_) << "return oprot_.Transport.BeginFlush(callback, state);" << endl;
    if (!async_) {
      indent(f_service_) << "#else" << endl;
      indent(f_service_) << "oprot_.Transport.Flush();" << endl;
      indent(f_service_) << "#endif" << endl;
    }

    cleanup_member_name_mapping(arg_struct);
    scope_down(f_service_);
    f_service_ << endl;

    if (!(*f_iter)->is_oneway()) {
      string resultname = (*f_iter)->get_name() + "_result";

      t_struct noargs(program_);
      t_function recv_function((*f_iter)->get_returntype(),
                               string("recv_") + (*f_iter)->get_name(),
                               &noargs,
                               (*f_iter)->get_xceptions());
      indent(f_service_) << "public " << function_signature(&recv_function) << endl;
      scope_up(f_service_);

      t_struct* xs = (*f_iter)->get_xceptions();
      prepare_member_name_mapping(xs, xs->get_members(), resultname);

      f_service_ << indent() << "TMessage msg = iprot_.ReadMessageBegin();" << endl << indent()
                 << "if (msg.Type == TMessageType.Exception) {" << endl;
      indent_up();
      f_service_ << indent() << "TApplicationException x = TApplicationException.Read(iprot_);"
                 << endl << indent() << "iprot_.ReadMessageEnd();" << endl << indent() << "throw x;"
                 << endl;
      indent_down();
      f_service_ << indent() << "}" << endl << indent() << resultname << " result = new "
                 << resultname << "();" << endl << indent() << "result.Read(iprot_);" << endl
                 << indent() << "iprot_.ReadMessageEnd();" << endl;

      if (!(*f_iter)->get_returntype()->is_void()) {
        if (nullable_) {
          if (type_can_be_null((*f_iter)->get_returntype())) {
            f_service_ << indent() << "if (result.Success != null) {" << endl << indent()
                       << "  return result.Success;" << endl << indent() << "}" << endl;
          } else {
            f_service_ << indent() << "if (result.Success.HasValue) {" << endl << indent()
                       << "  return result.Success.Value;" << endl << indent() << "}" << endl;
          }
        } else {
          f_service_ << indent() << "if (result.__isset.success) {" << endl << indent()
                     << "  return result.Success;" << endl << indent() << "}" << endl;
        }
      }

      const std::vector<t_field*>& xceptions = xs->get_members();
      vector<t_field*>::const_iterator x_iter;
      for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
        if (nullable_) {
          f_service_ << indent() << "if (result." << prop_name(*x_iter) << " != null) {" << endl
                     << indent() << "  throw result." << prop_name(*x_iter) << ";" << endl
                     << indent() << "}" << endl;
        } else {
          f_service_ << indent() << "if (result.__isset." << normalize_name((*x_iter)->get_name())
                     << ") {" << endl << indent() << "  throw result." << prop_name(*x_iter) << ";"
                     << endl << indent() << "}" << endl;
        }
      }

      if ((*f_iter)->get_returntype()->is_void()) {
        indent(f_service_) << "return;" << endl;
      } else {
        f_service_ << indent()
                   << "throw new "
                      "TApplicationException(TApplicationException.ExceptionType.MissingResult, \""
                   << (*f_iter)->get_name() << " failed: unknown result\");" << endl;
      }

      cleanup_member_name_mapping((*f_iter)->get_xceptions());
      scope_down(f_service_);
      f_service_ << endl;
    }
  }

  indent_down();
  indent(f_service_) << "}" << endl;
}

void t_csharp_generator::generate_service_server(t_service* tservice) {
  if (async_) {
    generate_service_server_async(tservice);
    generate_service_server_sync(tservice);
  }
  else {
    generate_service_server_sync(tservice);
  }
}

void t_csharp_generator::generate_service_server_sync(t_service* tservice) {
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;

  string extends = "";
  string extends_processor = "";
  if (tservice->get_extends() != NULL) {
    extends = type_name(tservice->get_extends());
    extends_processor = extends + ".Processor, ";
  }

  indent(f_service_) << "public class Processor : " << extends_processor << "TProcessor {" << endl;
  indent_up();

  indent(f_service_) << "public Processor(ISync iface)";

  if (!extends.empty()) {
    f_service_ << " : base(iface)";
  }
  f_service_ << endl;
  scope_up(f_service_);
  f_service_ << indent() << "iface_ = iface;" << endl;

  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    f_service_ << indent() << "processMap_[\"" << (*f_iter)->get_name()
      << "\"] = " << (*f_iter)->get_name() << "_Process;" << endl;
  }

  scope_down(f_service_);
  f_service_ << endl;

  if (extends.empty()) {
    f_service_
      << indent()
      << "protected delegate void ProcessFunction(int seqid, TProtocol iprot, TProtocol oprot);"
      << endl;
  }

  f_service_ << indent() << "private ISync iface_;" << endl;

  if (extends.empty()) {
    f_service_ << indent() << "protected Dictionary<string, ProcessFunction> processMap_ = new "
      "Dictionary<string, ProcessFunction>();" << endl;
  }

  f_service_ << endl;

  if (extends.empty()) {
    indent(f_service_) << "public bool Process(TProtocol iprot, TProtocol oprot)" << endl;
  }
  else {
    indent(f_service_) << "public new bool Process(TProtocol iprot, TProtocol oprot)" << endl;
  }
  scope_up(f_service_);

  f_service_ << indent() << "try" << endl;
  scope_up(f_service_);

  f_service_ << indent() << "TMessage msg = iprot.ReadMessageBegin();" << endl;

  f_service_
    << indent() << "ProcessFunction fn;" << endl << indent()
    << "processMap_.TryGetValue(msg.Name, out fn);" << endl << indent() << "if (fn == null) {"
    << endl << indent() << "  TProtocolUtil.Skip(iprot, TType.Struct);" << endl << indent()
    << "  iprot.ReadMessageEnd();" << endl << indent()
    << "  TApplicationException x = new TApplicationException "
    "(TApplicationException.ExceptionType.UnknownMethod, \"Invalid method name: '\" + "
    "msg.Name + \"'\");" << endl << indent()
    << "  oprot.WriteMessageBegin(new TMessage(msg.Name, TMessageType.Exception, msg.SeqID));"
    << endl << indent() << "  x.Write(oprot);" << endl << indent() << "  oprot.WriteMessageEnd();"
    << endl << indent() << "  oprot.Transport.Flush();" << endl << indent() << "  return true;"
    << endl << indent() << "}" << endl << indent() << "fn(msg.SeqID, iprot, oprot);" << endl;

  scope_down(f_service_);

  f_service_ << indent() << "catch (IOException)" << endl;
  scope_up(f_service_);
  f_service_ << indent() << "return false;" << endl;
  scope_down(f_service_);

  f_service_ << indent() << "return true;" << endl;

  scope_down(f_service_);
  f_service_ << endl;

  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    generate_process_function(tservice, *f_iter);
  }

  indent_down();
  indent(f_service_) << "}" << endl << endl;
}

void t_csharp_generator::generate_service_server_async(t_service* tservice) {
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;

  string extends = "";
  string extends_processor = "";
  if (tservice->get_extends() != NULL) {
    extends = type_name(tservice->get_extends());
    extends_processor = extends + ".Processor, ";
  }

  indent(f_service_) << "public class AsyncProcessor : " << extends_processor << "TAsyncProcessor {" << endl;
  indent_up();

  indent(f_service_) << "public AsyncProcessor(IAsync iface)";
  if (!extends.empty()) {
    f_service_ << " : base(iface)";
  }
  f_service_ << endl;
  scope_up(f_service_);
  f_service_ << indent() << "iface_ = iface;" << endl;

  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    f_service_ << indent() << "processMap_[\"" << (*f_iter)->get_name()
      << "\"] = " << (*f_iter)->get_name() << "_ProcessAsync;" << endl;
  }

  scope_down(f_service_);
  f_service_ << endl;

  if (extends.empty()) {
    f_service_
      << indent()
      << "protected delegate Task ProcessFunction(int seqid, TProtocol iprot, TProtocol oprot);"
      << endl;
  }

  f_service_ << indent() << "private IAsync iface_;" << endl;

  if (extends.empty()) {
    f_service_ << indent() << "protected Dictionary<string, ProcessFunction> processMap_ = new "
      "Dictionary<string, ProcessFunction>();" << endl;
  }

  f_service_ << endl;

  if (extends.empty()) {
    indent(f_service_) << "public async Task<bool> ProcessAsync(TProtocol iprot, TProtocol oprot)" << endl;
  }
  else {
    indent(f_service_) << "public new async Task<bool> ProcessAsync(TProtocol iprot, TProtocol oprot)" << endl;
  }
  scope_up(f_service_);

  f_service_ << indent() << "try" << endl;
  scope_up(f_service_);

  f_service_ << indent() << "TMessage msg = iprot.ReadMessageBegin();" << endl;

  f_service_
    << indent() << "ProcessFunction fn;" << endl << indent()
    << "processMap_.TryGetValue(msg.Name, out fn);" << endl << indent() << "if (fn == null) {"
    << endl << indent() << "  TProtocolUtil.Skip(iprot, TType.Struct);" << endl << indent()
    << "  iprot.ReadMessageEnd();" << endl << indent()
    << "  TApplicationException x = new TApplicationException "
    "(TApplicationException.ExceptionType.UnknownMethod, \"Invalid method name: '\" + "
    "msg.Name + \"'\");" << endl << indent()
    << "  oprot.WriteMessageBegin(new TMessage(msg.Name, TMessageType.Exception, msg.SeqID));"
    << endl << indent() << "  x.Write(oprot);" << endl << indent() << "  oprot.WriteMessageEnd();"
    << endl << indent() << "  oprot.Transport.Flush();" << endl << indent() << "  return true;"
    << endl << indent() << "}" << endl << indent() << "await fn(msg.SeqID, iprot, oprot);" << endl;

  scope_down(f_service_);

  f_service_ << indent() << "catch (IOException)" << endl;
  scope_up(f_service_);
  f_service_ << indent() << "return false;" << endl;
  scope_down(f_service_);

  f_service_ << indent() << "return true;" << endl;

  scope_down(f_service_);
  f_service_ << endl;

  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    generate_process_function_async(tservice, *f_iter);
  }

  indent_down();
  indent(f_service_) << "}" << endl << endl;
}

void t_csharp_generator::generate_function_helpers(t_function* tfunction) {
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

  generate_csharp_struct_definition(f_service_, &result, false, true, true);
}

void t_csharp_generator::generate_process_function(t_service* tservice, t_function* tfunction) {
  (void)tservice;
  indent(f_service_) << "public void " << tfunction->get_name()
                     << "_Process(int seqid, TProtocol iprot, TProtocol oprot)" << endl;
  scope_up(f_service_);

  string argsname = tfunction->get_name() + "_args";
  string resultname = tfunction->get_name() + "_result";

  f_service_ << indent() << argsname << " args = new " << argsname << "();" << endl
             << indent() << "args.Read(iprot);" << endl
             << indent() << "iprot.ReadMessageEnd();" << endl;

  t_struct* xs = tfunction->get_xceptions();
  const std::vector<t_field*>& xceptions = xs->get_members();
  vector<t_field*>::const_iterator x_iter;

  if (!tfunction->is_oneway()) {
    f_service_ << indent() << resultname << " result = new " << resultname << "();" << endl;
  }

  f_service_ << indent() << "try" << endl
             << indent() << "{" << endl;
  indent_up();

  if (xceptions.size() > 0) {
    f_service_ << indent() << "try" << endl
               << indent() << "{" << endl;
    indent_up();
  }

  t_struct* arg_struct = tfunction->get_arglist();
  const std::vector<t_field*>& fields = arg_struct->get_members();
  vector<t_field*>::const_iterator f_iter;

  f_service_ << indent();
  if (!tfunction->is_oneway() && !tfunction->get_returntype()->is_void()) {
    f_service_ << "result.Success = ";
  }
  f_service_ << "iface_." << normalize_name(tfunction->get_name()) << "(";
  bool first = true;
  prepare_member_name_mapping(arg_struct);
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (first) {
      first = false;
    } else {
      f_service_ << ", ";
    }
    f_service_ << "args." << prop_name(*f_iter);
    if (nullable_ && !type_can_be_null((*f_iter)->get_type())) {
      f_service_ << ".Value";
    }
  }
  cleanup_member_name_mapping(arg_struct);
  f_service_ << ");" << endl;

  prepare_member_name_mapping(xs, xs->get_members(), resultname);
  if (xceptions.size() > 0) {
    indent_down();
    f_service_ << indent() << "}" << endl;
    for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
      f_service_ << indent() << "catch (" << type_name((*x_iter)->get_type(), false, false) << " "
                 << (*x_iter)->get_name() << ")" << endl
                 << indent() << "{" << endl;
      if (!tfunction->is_oneway()) {
        indent_up();
        f_service_ << indent() << "result." << prop_name(*x_iter) << " = " << (*x_iter)->get_name()
                   << ";" << endl;
        indent_down();
      }
      f_service_ << indent() << "}" << endl;
    }
  }
  if (!tfunction->is_oneway()) {
    f_service_ << indent() << "oprot.WriteMessageBegin(new TMessage(\"" << tfunction->get_name()
               << "\", TMessageType.Reply, seqid)); " << endl;
    f_service_ << indent() << "result.Write(oprot);" << endl;
  }
  indent_down();

  cleanup_member_name_mapping(xs);

  f_service_ << indent() << "}" << endl
             << indent() << "catch (TTransportException)" << endl
             << indent() << "{" << endl
             << indent() << "  throw;" << endl
             << indent() << "}" << endl
             << indent() << "catch (Exception ex)" << endl
             << indent() << "{" << endl
             << indent() << "  Console.Error.WriteLine(\"Error occurred in processor:\");" << endl
             << indent() << "  Console.Error.WriteLine(ex.ToString());" << endl;

  if (tfunction->is_oneway()) {
    f_service_ << indent() << "}" << endl;
  } else {
    f_service_ << indent() << "  TApplicationException x = new TApplicationException" << indent()
               << "(TApplicationException.ExceptionType.InternalError,\" Internal error.\");"
               << endl
               << indent() << "  oprot.WriteMessageBegin(new TMessage(\"" << tfunction->get_name()
               << "\", TMessageType.Exception, seqid));" << endl
               << indent() << "  x.Write(oprot);" << endl
               << indent() << "}" << endl;
    f_service_ << indent() << "oprot.WriteMessageEnd();" << endl
               << indent() << "oprot.Transport.Flush();" << endl;
  }

  scope_down(f_service_);

  f_service_ << endl;
}

void t_csharp_generator::generate_process_function_async(t_service* tservice, t_function* tfunction) {
  (void)tservice;
  indent(f_service_) << "public async Task " << tfunction->get_name()
    << "_ProcessAsync(int seqid, TProtocol iprot, TProtocol oprot)" << endl;
  scope_up(f_service_);

  string argsname = tfunction->get_name() + "_args";
  string resultname = tfunction->get_name() + "_result";

  f_service_ << indent() << argsname << " args = new " << argsname << "();" << endl
    << indent() << "args.Read(iprot);" << endl
    << indent() << "iprot.ReadMessageEnd();" << endl;

  t_struct* xs = tfunction->get_xceptions();
  const std::vector<t_field*>& xceptions = xs->get_members();
  vector<t_field*>::const_iterator x_iter;

  if (!tfunction->is_oneway()) {
    f_service_ << indent() << resultname << " result = new " << resultname << "();" << endl;
  }

  f_service_ << indent() << "try" << endl
    << indent() << "{" << endl;
  indent_up();

  if (xceptions.size() > 0) {
    f_service_ << indent() << "try" << endl
      << indent() << "{" << endl;
    indent_up();
  }

  t_struct* arg_struct = tfunction->get_arglist();
  const std::vector<t_field*>& fields = arg_struct->get_members();
  vector<t_field*>::const_iterator f_iter;

  f_service_ << indent();
  if (!tfunction->is_oneway() && !tfunction->get_returntype()->is_void()) {
    f_service_ << "result.Success = ";
  }
  f_service_ << "await iface_." << normalize_name(tfunction->get_name()) << "Async(";
  bool first = true;
  prepare_member_name_mapping(arg_struct);
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    if (first) {
      first = false;
    }
    else {
      f_service_ << ", ";
    }
    f_service_ << "args." << prop_name(*f_iter);
    if (nullable_ && !type_can_be_null((*f_iter)->get_type())) {
      f_service_ << ".Value";
    }
  }
  cleanup_member_name_mapping(arg_struct);
  f_service_ << ");" << endl;

  prepare_member_name_mapping(xs, xs->get_members(), resultname);
  if (xceptions.size() > 0) {
    indent_down();
    f_service_ << indent() << "}" << endl;
    for (x_iter = xceptions.begin(); x_iter != xceptions.end(); ++x_iter) {
      f_service_ << indent() << "catch (" << type_name((*x_iter)->get_type(), false, false) << " "
        << (*x_iter)->get_name() << ")" << endl
        << indent() << "{" << endl;
      if (!tfunction->is_oneway()) {
        indent_up();
        f_service_ << indent() << "result." << prop_name(*x_iter) << " = " << (*x_iter)->get_name()
          << ";" << endl;
        indent_down();
      }
      f_service_ << indent() << "}" << endl;
    }
  }
  if (!tfunction->is_oneway()) {
    f_service_ << indent() << "oprot.WriteMessageBegin(new TMessage(\"" << tfunction->get_name()
      << "\", TMessageType.Reply, seqid)); " << endl;
    f_service_ << indent() << "result.Write(oprot);" << endl;
  }
  indent_down();

  cleanup_member_name_mapping(xs);

  f_service_ << indent() << "}" << endl
    << indent() << "catch (TTransportException)" << endl
    << indent() << "{" << endl
    << indent() << "  throw;" << endl
    << indent() << "}" << endl
    << indent() << "catch (Exception ex)" << endl
    << indent() << "{" << endl
    << indent() << "  Console.Error.WriteLine(\"Error occurred in processor:\");" << endl
    << indent() << "  Console.Error.WriteLine(ex.ToString());" << endl;

  if (tfunction->is_oneway()) {
    f_service_ << indent() << "}" << endl;
  }
  else {
    f_service_ << indent() << "  TApplicationException x = new TApplicationException" << indent()
      << "(TApplicationException.ExceptionType.InternalError,\" Internal error.\");"
      << endl
      << indent() << "  oprot.WriteMessageBegin(new TMessage(\"" << tfunction->get_name()
      << "\", TMessageType.Exception, seqid));" << endl
      << indent() << "  x.Write(oprot);" << endl
      << indent() << "}" << endl;
    f_service_ << indent() << "oprot.WriteMessageEnd();" << endl
      << indent() << "oprot.Transport.Flush();" << endl;
  }

  scope_down(f_service_);

  f_service_ << endl;
}

void t_csharp_generator::generate_csharp_union_reader(std::ofstream& out, t_struct* tunion) {
  // Thanks to THRIFT-1768, we don't need to check for required fields in the union
  const vector<t_field*>& fields = tunion->get_members();
  vector<t_field*>::const_iterator f_iter;

  indent(out) << "public static " << tunion->get_name() << " Read(TProtocol iprot)" << endl;
  scope_up(out);

  out << indent() << "iprot.IncrementRecursionDepth();" << endl;
  out << indent() << "try" << endl;
  scope_up(out);

  indent(out) << tunion->get_name() << " retval;" << endl;
  indent(out) << "iprot.ReadStructBegin();" << endl;
  indent(out) << "TField field = iprot.ReadFieldBegin();" << endl;
  // we cannot have the first field be a stop -- we must have a single field defined
  indent(out) << "if (field.Type == TType.Stop)" << endl;
  scope_up(out);
  indent(out) << "iprot.ReadFieldEnd();" << endl;
  indent(out) << "retval = new ___undefined();" << endl;
  scope_down(out);
  indent(out) << "else" << endl;
  scope_up(out);
  indent(out) << "switch (field.ID)" << endl;
  scope_up(out);

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    indent(out) << "case " << (*f_iter)->get_key() << ":" << endl;
    indent_up();
    indent(out) << "if (field.Type == " << type_to_enum((*f_iter)->get_type()) << ") {" << endl;
    indent_up();

    indent(out) << type_name((*f_iter)->get_type()) << " temp;" << endl;
    generate_deserialize_field(out, (*f_iter), "temp", true);
    indent(out) << "retval = new " << (*f_iter)->get_name() << "(temp);" << endl;

    indent_down();
    out << indent() << "} else { " << endl << indent() << "  TProtocolUtil.Skip(iprot, field.Type);"
        << endl << indent() << "  retval = new ___undefined();" << endl << indent() << "}" << endl
        << indent() << "break;" << endl;
    indent_down();
  }

  indent(out) << "default: " << endl;
  indent_up();
  indent(out) << "TProtocolUtil.Skip(iprot, field.Type);" << endl << indent()
              << "retval = new ___undefined();" << endl;
  indent(out) << "break;" << endl;
  indent_down();

  scope_down(out);

  indent(out) << "iprot.ReadFieldEnd();" << endl;

  indent(out) << "if (iprot.ReadFieldBegin().Type != TType.Stop)" << endl;
  scope_up(out);
  indent(out) << "throw new TProtocolException(TProtocolException.INVALID_DATA);" << endl;
  scope_down(out);

  // end of else for TStop
  scope_down(out);
  indent(out) << "iprot.ReadStructEnd();" << endl;
  indent(out) << "return retval;" << endl;
  indent_down();

  scope_down(out);
  out << indent() << "finally" << endl;
  scope_up(out);
  out << indent() << "iprot.DecrementRecursionDepth();" << endl;
  scope_down(out);

  indent(out) << "}" << endl << endl;
}

void t_csharp_generator::generate_deserialize_field(ofstream& out,
                                                    t_field* tfield,
                                                    string prefix,
                                                    bool is_propertyless) {
  t_type* type = tfield->get_type();
  while (type->is_typedef()) {
    type = ((t_typedef*)type)->get_type();
  }

  if (type->is_void()) {
    throw "CANNOT GENERATE DESERIALIZE CODE FOR void TYPE: " + prefix + tfield->get_name();
  }

  string name = prefix + (is_propertyless ? "" : prop_name(tfield));

  if (type->is_struct() || type->is_xception()) {
    generate_deserialize_struct(out, (t_struct*)type, name);
  } else if (type->is_container()) {
    generate_deserialize_container(out, type, name);
  } else if (type->is_base_type() || type->is_enum()) {
    indent(out) << name << " = ";

    if (type->is_enum()) {
      out << "(" << type_name(type, false, true) << ")";
    }

    out << "iprot.";

    if (type->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        throw "compiler error: cannot serialize void field in a struct: " + name;
        break;
      case t_base_type::TYPE_STRING:
        if (((t_base_type*)type)->is_binary()) {
          out << "ReadBinary();";
        } else {
          out << "ReadString();";
        }
        break;
      case t_base_type::TYPE_BOOL:
        out << "ReadBool();";
        break;
      case t_base_type::TYPE_I8:
        out << "ReadByte();";
        break;
      case t_base_type::TYPE_I16:
        out << "ReadI16();";
        break;
      case t_base_type::TYPE_I32:
        out << "ReadI32();";
        break;
      case t_base_type::TYPE_I64:
        out << "ReadI64();";
        break;
      case t_base_type::TYPE_DOUBLE:
        out << "ReadDouble();";
        break;
      default:
        throw "compiler error: no C# name for base type " + t_base_type::t_base_name(tbase);
      }
    } else if (type->is_enum()) {
      out << "ReadI32();";
    }
    out << endl;
  } else {
    printf("DO NOT KNOW HOW TO DESERIALIZE FIELD '%s' TYPE '%s'\n",
           tfield->get_name().c_str(),
           type_name(type).c_str());
  }
}

void t_csharp_generator::generate_deserialize_struct(ofstream& out,
                                                     t_struct* tstruct,
                                                     string prefix) {
  if (union_ && tstruct->is_union()) {
    out << indent() << prefix << " = " << type_name(tstruct) << ".Read(iprot);" << endl;
  } else {
    out << indent() << prefix << " = new " << type_name(tstruct) << "();" << endl << indent()
        << prefix << ".Read(iprot);" << endl;
  }
}

void t_csharp_generator::generate_deserialize_container(ofstream& out,
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

  indent(out) << prefix << " = new " << type_name(ttype, false, true) << "();" << endl;
  if (ttype->is_map()) {
    out << indent() << "TMap " << obj << " = iprot.ReadMapBegin();" << endl;
  } else if (ttype->is_set()) {
    out << indent() << "TSet " << obj << " = iprot.ReadSetBegin();" << endl;
  } else if (ttype->is_list()) {
    out << indent() << "TList " << obj << " = iprot.ReadListBegin();" << endl;
  }

  string i = tmp("_i");
  indent(out) << "for( int " << i << " = 0; " << i << " < " << obj << ".Count"
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

  if (ttype->is_map()) {
    indent(out) << "iprot.ReadMapEnd();" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "iprot.ReadSetEnd();" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "iprot.ReadListEnd();" << endl;
  }

  scope_down(out);
}

void t_csharp_generator::generate_deserialize_map_element(ofstream& out,
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

  indent(out) << prefix << "[" << key << "] = " << val << ";" << endl;
}

void t_csharp_generator::generate_deserialize_set_element(ofstream& out,
                                                          t_set* tset,
                                                          string prefix) {
  string elem = tmp("_elem");
  t_field felem(tset->get_elem_type(), elem);

  indent(out) << declare_field(&felem) << endl;

  generate_deserialize_field(out, &felem);

  indent(out) << prefix << ".Add(" << elem << ");" << endl;
}

void t_csharp_generator::generate_deserialize_list_element(ofstream& out,
                                                           t_list* tlist,
                                                           string prefix) {
  string elem = tmp("_elem");
  t_field felem(tlist->get_elem_type(), elem);

  indent(out) << declare_field(&felem) << endl;

  generate_deserialize_field(out, &felem);

  indent(out) << prefix << ".Add(" << elem << ");" << endl;
}

void t_csharp_generator::generate_serialize_field(ofstream& out,
                                                  t_field* tfield,
                                                  string prefix,
                                                  bool is_element,
                                                  bool is_propertyless) {
  t_type* type = tfield->get_type();
  while (type->is_typedef()) {
    type = ((t_typedef*)type)->get_type();
  }

  string name = prefix + (is_propertyless ? "" : prop_name(tfield));

  if (type->is_void()) {
    throw "CANNOT GENERATE SERIALIZE CODE FOR void TYPE: " + name;
  }

  if (type->is_struct() || type->is_xception()) {
    generate_serialize_struct(out, (t_struct*)type, name);
  } else if (type->is_container()) {
    generate_serialize_container(out, type, name);
  } else if (type->is_base_type() || type->is_enum()) {
    indent(out) << "oprot.";

    string nullable_name = nullable_ && !is_element && !field_is_required(tfield) ? name + ".Value"
                                                                                  : name;

    if (type->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        throw "compiler error: cannot serialize void field in a struct: " + name;
        break;
      case t_base_type::TYPE_STRING:
        if (((t_base_type*)type)->is_binary()) {
          out << "WriteBinary(";
        } else {
          out << "WriteString(";
        }
        out << name << ");";
        break;
      case t_base_type::TYPE_BOOL:
        out << "WriteBool(" << nullable_name << ");";
        break;
      case t_base_type::TYPE_I8:
        out << "WriteByte(" << nullable_name << ");";
        break;
      case t_base_type::TYPE_I16:
        out << "WriteI16(" << nullable_name << ");";
        break;
      case t_base_type::TYPE_I32:
        out << "WriteI32(" << nullable_name << ");";
        break;
      case t_base_type::TYPE_I64:
        out << "WriteI64(" << nullable_name << ");";
        break;
      case t_base_type::TYPE_DOUBLE:
        out << "WriteDouble(" << nullable_name << ");";
        break;
      default:
        throw "compiler error: no C# name for base type " + t_base_type::t_base_name(tbase);
      }
    } else if (type->is_enum()) {
      out << "WriteI32((int)" << nullable_name << ");";
    }
    out << endl;
  } else {
    printf("DO NOT KNOW HOW TO SERIALIZE '%s%s' TYPE '%s'\n",
           prefix.c_str(),
           tfield->get_name().c_str(),
           type_name(type).c_str());
  }
}

void t_csharp_generator::generate_serialize_struct(ofstream& out,
                                                   t_struct* tstruct,
                                                   string prefix) {
  (void)tstruct;
  out << indent() << prefix << ".Write(oprot);" << endl;
}

void t_csharp_generator::generate_serialize_container(ofstream& out, t_type* ttype, string prefix) {
  scope_up(out);

  if (ttype->is_map()) {
    indent(out) << "oprot.WriteMapBegin(new TMap(" << type_to_enum(((t_map*)ttype)->get_key_type())
                << ", " << type_to_enum(((t_map*)ttype)->get_val_type()) << ", " << prefix
                << ".Count));" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "oprot.WriteSetBegin(new TSet(" << type_to_enum(((t_set*)ttype)->get_elem_type())
                << ", " << prefix << ".Count));" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "oprot.WriteListBegin(new TList("
                << type_to_enum(((t_list*)ttype)->get_elem_type()) << ", " << prefix << ".Count));"
                << endl;
  }

  string iter = tmp("_iter");
  if (ttype->is_map()) {
    indent(out) << "foreach (" << type_name(((t_map*)ttype)->get_key_type()) << " " << iter
                << " in " << prefix << ".Keys)";
  } else if (ttype->is_set()) {
    indent(out) << "foreach (" << type_name(((t_set*)ttype)->get_elem_type()) << " " << iter
                << " in " << prefix << ")";
  } else if (ttype->is_list()) {
    indent(out) << "foreach (" << type_name(((t_list*)ttype)->get_elem_type()) << " " << iter
                << " in " << prefix << ")";
  }

  out << endl;
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
    indent(out) << "oprot.WriteMapEnd();" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "oprot.WriteSetEnd();" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "oprot.WriteListEnd();" << endl;
  }

  scope_down(out);
}

void t_csharp_generator::generate_serialize_map_element(ofstream& out,
                                                        t_map* tmap,
                                                        string iter,
                                                        string map) {
  t_field kfield(tmap->get_key_type(), iter);
  generate_serialize_field(out, &kfield, "", true);
  t_field vfield(tmap->get_val_type(), map + "[" + iter + "]");
  generate_serialize_field(out, &vfield, "", true);
}

void t_csharp_generator::generate_serialize_set_element(ofstream& out, t_set* tset, string iter) {
  t_field efield(tset->get_elem_type(), iter);
  generate_serialize_field(out, &efield, "", true);
}

void t_csharp_generator::generate_serialize_list_element(ofstream& out,
                                                         t_list* tlist,
                                                         string iter) {
  t_field efield(tlist->get_elem_type(), iter);
  generate_serialize_field(out, &efield, "", true);
}

void t_csharp_generator::generate_property(ofstream& out,
                                           t_field* tfield,
                                           bool isPublic,
                                           bool generateIsset) {
  generate_csharp_property(out, tfield, isPublic, generateIsset, "_");
}
void t_csharp_generator::generate_csharp_property(ofstream& out,
                                                  t_field* tfield,
                                                  bool isPublic,
                                                  bool generateIsset,
                                                  std::string fieldPrefix) {
  if ((serialize_ || wcf_) && isPublic) {
    indent(out) << "[DataMember(Order = 0)]" << endl;
  }
  bool has_default = field_has_default(tfield);
  bool is_required = field_is_required(tfield);
  if ((nullable_ && !has_default) || (is_required)) {
    indent(out) << (isPublic ? "public " : "private ")
                << type_name(tfield->get_type(), false, false, true, is_required) << " "
                << prop_name(tfield) << " { get; set; }" << endl;
  } else {
    indent(out) << (isPublic ? "public " : "private ")
                << type_name(tfield->get_type(), false, false, true) << " " << prop_name(tfield)
                << endl;
    scope_up(out);
    indent(out) << "get" << endl;
    scope_up(out);
    bool use_nullable = false;
    if (nullable_) {
      t_type* ttype = tfield->get_type();
      while (ttype->is_typedef()) {
        ttype = ((t_typedef*)ttype)->get_type();
      }
      if (ttype->is_base_type()) {
        use_nullable = ((t_base_type*)ttype)->get_base() != t_base_type::TYPE_STRING;
      }
    }
    indent(out) << "return " << fieldPrefix + tfield->get_name() << ";" << endl;
    scope_down(out);
    indent(out) << "set" << endl;
    scope_up(out);
    if (use_nullable) {
      if (generateIsset) {
        indent(out) << "__isset." << normalize_name(tfield->get_name()) << " = value.HasValue;"
                    << endl;
      }
      indent(out) << "if (value.HasValue) this." << fieldPrefix + tfield->get_name()
                  << " = value.Value;" << endl;
    } else {
      if (generateIsset) {
        indent(out) << "__isset." << normalize_name(tfield->get_name()) << " = true;" << endl;
      }
      indent(out) << "this." << fieldPrefix + tfield->get_name() << " = value;" << endl;
    }
    scope_down(out);
    scope_down(out);
  }
  out << endl;
}

std::string t_csharp_generator::make_valid_csharp_identifier(std::string const& fromName) {
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

void t_csharp_generator::cleanup_member_name_mapping(void* scope) {
  if( member_mapping_scopes.empty()) {
    throw "internal error: cleanup_member_name_mapping() no scope active";
  }

  member_mapping_scope& active = member_mapping_scopes.back();
  if (active.scope_member != scope) {
    throw "internal error: cleanup_member_name_mapping() called for wrong struct";
  }

  member_mapping_scopes.pop_back();
}

string t_csharp_generator::get_mapped_member_name(string name) {
  if( ! member_mapping_scopes.empty()) {
    member_mapping_scope& active = member_mapping_scopes.back();
    map<string, string>::iterator iter = active.mapping_table.find(name);
    if (active.mapping_table.end() != iter) {
      return iter->second;
    }
  }

  pverbose("no mapping for member %s\n", name.c_str());
  return name;
}

void t_csharp_generator::prepare_member_name_mapping(t_struct* tstruct) {
  prepare_member_name_mapping(tstruct, tstruct->get_members(), tstruct->get_name());
}

void t_csharp_generator::prepare_member_name_mapping(void* scope,
                                                     const vector<t_field*>& members,
                                                     const string& structname) {
  // begin new scope
  member_mapping_scope dummy;
  member_mapping_scopes.push_back(dummy);
  member_mapping_scope& active = member_mapping_scopes.back();
  active.scope_member = scope;

  // current C# generator policy:
  // - prop names are always rendered with an Uppercase first letter
  // - struct names are used as given
  std::set<std::string> used_member_names;
  vector<t_field*>::const_iterator iter;

  // prevent name conflicts with struct (CS0542 error)
  used_member_names.insert(structname);

  // prevent name conflicts with known methods (THRIFT-2942)
  used_member_names.insert("Read");
  used_member_names.insert("Write");

  for (iter = members.begin(); iter != members.end(); ++iter) {
    string oldname = (*iter)->get_name();
    string newname = prop_name(*iter, true);
    while (true) {

      // new name conflicts with another member
      if (used_member_names.find(newname) != used_member_names.end()) {
        pverbose("struct %s: member %s conflicts with another member\n",
                 structname.c_str(),
                 newname.c_str());
        newname += '_';
        continue;
      }

      // add always, this helps us to detect edge cases like
      // different spellings ("foo" and "Foo") within the same struct
      pverbose("struct %s: member mapping %s => %s\n",
               structname.c_str(),
               oldname.c_str(),
               newname.c_str());
      active.mapping_table[oldname] = newname;
      used_member_names.insert(newname);
      break;
    }
  }
}

std::string t_csharp_generator::prop_name(t_field* tfield, bool suppress_mapping) {
  string name(tfield->get_name());
  if (suppress_mapping) {
    name[0] = toupper(name[0]);
  } else {
    name = get_mapped_member_name(name);
  }
  return name;
}

string t_csharp_generator::type_name(t_type* ttype,
                                     bool in_container,
                                     bool in_init,
                                     bool in_param,
                                     bool is_required) {
  (void)in_init;
  while (ttype->is_typedef()) {
    ttype = ((t_typedef*)ttype)->get_type();
  }

  if (ttype->is_base_type()) {
    return base_type_name((t_base_type*)ttype, in_container, in_param, is_required);
  } else if (ttype->is_map()) {
    t_map* tmap = (t_map*)ttype;
    return "Dictionary<" + type_name(tmap->get_key_type(), true) + ", "
           + type_name(tmap->get_val_type(), true) + ">";
  } else if (ttype->is_set()) {
    t_set* tset = (t_set*)ttype;
    return "THashSet<" + type_name(tset->get_elem_type(), true) + ">";
  } else if (ttype->is_list()) {
    t_list* tlist = (t_list*)ttype;
    return "List<" + type_name(tlist->get_elem_type(), true) + ">";
  }

  t_program* program = ttype->get_program();
  string postfix = (!is_required && nullable_ && in_param && ttype->is_enum()) ? "?" : "";
  if (program != NULL && program != program_) {
    string ns = program->get_namespace("csharp");
    if (!ns.empty()) {
      return ns + "." + normalize_name(ttype->get_name()) + postfix;
    }
  }

  return normalize_name(ttype->get_name()) + postfix;
}

string t_csharp_generator::base_type_name(t_base_type* tbase,
                                          bool in_container,
                                          bool in_param,
                                          bool is_required) {
  (void)in_container;
  string postfix = (!is_required && nullable_ && in_param) ? "?" : "";
  switch (tbase->get_base()) {
  case t_base_type::TYPE_VOID:
    return "void";
  case t_base_type::TYPE_STRING:
    if (tbase->is_binary()) {
      return "byte[]";
    } else {
      return "string";
    }
  case t_base_type::TYPE_BOOL:
    return "bool" + postfix;
  case t_base_type::TYPE_I8:
    return "sbyte" + postfix;
  case t_base_type::TYPE_I16:
    return "short" + postfix;
  case t_base_type::TYPE_I32:
    return "int" + postfix;
  case t_base_type::TYPE_I64:
    return "long" + postfix;
  case t_base_type::TYPE_DOUBLE:
    return "double" + postfix;
  default:
    throw "compiler error: no C# name for base type " + t_base_type::t_base_name(tbase->get_base());
  }
}

string t_csharp_generator::declare_field(t_field* tfield, bool init, std::string prefix) {
  string result = type_name(tfield->get_type()) + " " + prefix + tfield->get_name();
  if (init) {
    t_type* ttype = tfield->get_type();
    while (ttype->is_typedef()) {
      ttype = ((t_typedef*)ttype)->get_type();
    }
    if (ttype->is_base_type() && field_has_default(tfield)) {
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
      result += " = (" + type_name(ttype, false, true) + ")0";
    } else if (ttype->is_container()) {
      result += " = new " + type_name(ttype, false, true) + "()";
    } else {
      result += " = new " + type_name(ttype, false, true) + "()";
    }
  }
  return result + ";";
}

string t_csharp_generator::function_signature(t_function* tfunction, string prefix) {
  t_type* ttype = tfunction->get_returntype();
  return type_name(ttype) + " " + normalize_name(prefix + tfunction->get_name()) + "("
         + argument_list(tfunction->get_arglist()) + ")";
}

string t_csharp_generator::function_signature_async_begin(t_function* tfunction, string prefix) {
  string comma = (tfunction->get_arglist()->get_members().size() > 0 ? ", " : "");
  return "IAsyncResult " + normalize_name(prefix + tfunction->get_name())
         + "(AsyncCallback callback, object state" + comma + argument_list(tfunction->get_arglist())
         + ")";
}

string t_csharp_generator::function_signature_async_end(t_function* tfunction, string prefix) {
  t_type* ttype = tfunction->get_returntype();
  return type_name(ttype) + " " + normalize_name(prefix + tfunction->get_name())
         + "(IAsyncResult asyncResult)";
}

string t_csharp_generator::function_signature_async(t_function* tfunction, string prefix) {
  t_type* ttype = tfunction->get_returntype();
  string task = "Task";
  if (!ttype->is_void())
    task += "<" + type_name(ttype) + ">";
  return task + " " + normalize_name(prefix + tfunction->get_name()) + "Async("
         + argument_list(tfunction->get_arglist()) + ")";
}

string t_csharp_generator::argument_list(t_struct* tstruct) {
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
    result += type_name((*f_iter)->get_type()) + " " + normalize_name((*f_iter)->get_name());
  }
  return result;
}

string t_csharp_generator::type_to_enum(t_type* type) {
  while (type->is_typedef()) {
    type = ((t_typedef*)type)->get_type();
  }

  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_VOID:
      throw "NO T_VOID CONSTRUCT";
    case t_base_type::TYPE_STRING:
      return "TType.String";
    case t_base_type::TYPE_BOOL:
      return "TType.Bool";
    case t_base_type::TYPE_I8:
      return "TType.Byte";
    case t_base_type::TYPE_I16:
      return "TType.I16";
    case t_base_type::TYPE_I32:
      return "TType.I32";
    case t_base_type::TYPE_I64:
      return "TType.I64";
    case t_base_type::TYPE_DOUBLE:
      return "TType.Double";
    }
  } else if (type->is_enum()) {
    return "TType.I32";
  } else if (type->is_struct() || type->is_xception()) {
    return "TType.Struct";
  } else if (type->is_map()) {
    return "TType.Map";
  } else if (type->is_set()) {
    return "TType.Set";
  } else if (type->is_list()) {
    return "TType.List";
  }

  throw "INVALID TYPE IN type_to_enum: " + type->get_name();
}

void t_csharp_generator::generate_csharp_docstring_comment(ofstream& out, string contents) {
  generate_docstring_comment(out, "/// <summary>\n", "/// ", contents, "/// </summary>\n");
}

void t_csharp_generator::generate_csharp_doc(ofstream& out, t_field* field) {
  if (field->get_type()->is_enum()) {
    string combined_message = field->get_doc() + "\n<seealso cref=\""
                              + get_enum_class_name(field->get_type()) + "\"/>";
    generate_csharp_docstring_comment(out, combined_message);
  } else {
    generate_csharp_doc(out, (t_doc*)field);
  }
}

void t_csharp_generator::generate_csharp_doc(ofstream& out, t_doc* tdoc) {
  if (tdoc->has_doc()) {
    generate_csharp_docstring_comment(out, tdoc->get_doc());
  }
}

void t_csharp_generator::generate_csharp_doc(ofstream& out, t_function* tfunction) {
  if (tfunction->has_doc()) {
    stringstream ps;
    const vector<t_field*>& fields = tfunction->get_arglist()->get_members();
    vector<t_field*>::const_iterator p_iter;
    for (p_iter = fields.begin(); p_iter != fields.end(); ++p_iter) {
      t_field* p = *p_iter;
      ps << "\n<param name=\"" << p->get_name() << "\">";
      if (p->has_doc()) {
        std::string str = p->get_doc();
        str.erase(std::remove(str.begin(), str.end(), '\n'),
                  str.end()); // remove the newlines that appear from the parser
        ps << str;
      }
      ps << "</param>";
    }
    generate_docstring_comment(out,
                               "",
                               "/// ",
                               "<summary>\n" + tfunction->get_doc() + "</summary>" + ps.str(),
                               "");
  }
}

std::string t_csharp_generator::get_enum_class_name(t_type* type) {
  string package = "";
  t_program* program = type->get_program();
  if (program != NULL && program != program_) {
    package = program->get_namespace("csharp") + ".";
  }
  return package + type->get_name();
}


THRIFT_REGISTER_GENERATOR(
    csharp,
    "C#",
    "    async:           Adds Async support using Task.Run.\n"
    "    wcf:             Adds bindings for WCF to generated classes.\n"
    "    serial:          Add serialization support to generated classes.\n"
    "    nullable:        Use nullable types for properties.\n"
    "    hashcode:        Generate a hashcode and equals implementation for classes.\n"
    "    union:           Use new union typing, which includes a static read function for union "
    "types.\n")
