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

#include <fstream>
#include <iostream>
#include <set>
#include <sstream>
#include <string>
#include <vector>

#include <sys/stat.h>

#include "thrift/platform.h"
#include "thrift/generate/t_oop_generator.h"

using std::map;
using std::ofstream;
using std::ostream;
using std::ostringstream;
using std::set;
using std::string;
using std::vector;

static const string endl = "\n"; // avoid ostream << std::endl flushes

/**
 * D code generator.
 *
 * generate_*() functions are called by the base class to emit code for the
 * given entity, print_*() functions write a piece of code to the passed
 * stream, and render_*() return a string containing the D representation of
 * the passed entity.
 */
class t_d_generator : public t_oop_generator {
public:
  t_d_generator(t_program* program,
                const std::map<string, string>& parsed_options,
                const string& option_string)
    : t_oop_generator(program) {
    (void)option_string;
    std::map<std::string, std::string>::const_iterator iter;

    /* no options yet */
    for( iter = parsed_options.begin(); iter != parsed_options.end(); ++iter) {
      throw "unknown option d:" + iter->first;
    }

    out_dir_base_ = "gen-d";
  }

protected:
  virtual void init_generator() {
    // Make output directory
    MKDIR(get_out_dir().c_str());

    string dir = program_->get_namespace("d");
    string subdir = get_out_dir();
    string::size_type loc;
    while ((loc = dir.find(".")) != string::npos) {
      subdir = subdir + "/" + dir.substr(0, loc);
      MKDIR(subdir.c_str());
      dir = dir.substr(loc + 1);
    }
    if (!dir.empty()) {
      subdir = subdir + "/" + dir;
      MKDIR(subdir.c_str());
    }

    package_dir_ = subdir + "/";

    // Make output file
    string f_types_name = package_dir_ + program_name_ + "_types.d";
    f_types_.open(f_types_name.c_str());

    // Print header
    f_types_ << autogen_comment() << "module " << render_package(*program_) << program_name_
             << "_types;" << endl << endl;

    print_default_imports(f_types_);

    // Include type modules from other imported programs.
    const vector<t_program*>& includes = program_->get_includes();
    for (size_t i = 0; i < includes.size(); ++i) {
      f_types_ << "import " << render_package(*(includes[i])) << includes[i]->get_name()
               << "_types;" << endl;
    }
    if (!includes.empty())
      f_types_ << endl;
  }

  virtual void close_generator() {
    // Close output file
    f_types_.close();
  }

  virtual void generate_consts(std::vector<t_const*> consts) {
    if (!consts.empty()) {
      string f_consts_name = package_dir_ + program_name_ + "_constants.d";
      ofstream f_consts;
      f_consts.open(f_consts_name.c_str());

      f_consts << autogen_comment() << "module " << render_package(*program_) << program_name_
               << "_constants;" << endl << endl;

      print_default_imports(f_consts);

      f_consts << "import " << render_package(*get_program()) << program_name_ << "_types;" << endl
               << endl;

      vector<t_const*>::iterator c_iter;
      for (c_iter = consts.begin(); c_iter != consts.end(); ++c_iter) {
        string name = (*c_iter)->get_name();
        t_type* type = (*c_iter)->get_type();
        indent(f_consts) << "immutable(" << render_type_name(type) << ") " << name << ";" << endl;
      }

      f_consts << endl << "static this() {" << endl;
      indent_up();

      bool first = true;
      for (c_iter = consts.begin(); c_iter != consts.end(); ++c_iter) {
        if (first) {
          first = false;
        } else {
          f_consts << endl;
        }
        t_type* type = (*c_iter)->get_type();
        indent(f_consts) << (*c_iter)->get_name() << " = ";
        if (!is_immutable_type(type)) {
          f_consts << "cast(immutable(" << render_type_name(type) << ")) ";
        }
        f_consts << render_const_value(type, (*c_iter)->get_value()) << ";" << endl;
      }
      indent_down();
      indent(f_consts) << "}" << endl;
    }
  }

  virtual void generate_typedef(t_typedef* ttypedef) {
    f_types_ << indent() << "alias " << render_type_name(ttypedef->get_type()) << " "
             << ttypedef->get_symbolic() << ";" << endl << endl;
  }

  virtual void generate_enum(t_enum* tenum) {
    vector<t_enum_value*> constants = tenum->get_constants();

    string enum_name = tenum->get_name();
    f_types_ << indent() << "enum " << enum_name << " {" << endl;

    indent_up();

    vector<t_enum_value*>::const_iterator c_iter;
    bool first = true;
    for (c_iter = constants.begin(); c_iter != constants.end(); ++c_iter) {
      if (first) {
        first = false;
      } else {
        f_types_ << "," << endl;
      }
      indent(f_types_) << (*c_iter)->get_name();
      f_types_ << " = " << (*c_iter)->get_value();
    }

    f_types_ << endl;
    indent_down();
    indent(f_types_) << "}" << endl;

    f_types_ << endl;
  }

  virtual void generate_struct(t_struct* tstruct) {
    print_struct_definition(f_types_, tstruct, false);
  }

  virtual void generate_xception(t_struct* txception) {
    print_struct_definition(f_types_, txception, true);
  }

  virtual void generate_service(t_service* tservice) {
    string svc_name = tservice->get_name();

    // Service implementation file includes
    string f_servicename = package_dir_ + svc_name + ".d";
    std::ofstream f_service;
    f_service.open(f_servicename.c_str());
    f_service << autogen_comment() << "module " << render_package(*program_) << svc_name << ";"
              << endl << endl;

    print_default_imports(f_service);

    f_service << "import " << render_package(*get_program()) << program_name_ << "_types;" << endl;

    t_service* extends_service = tservice->get_extends();
    if (extends_service != NULL) {
      f_service << "import " << render_package(*(extends_service->get_program()))
                << extends_service->get_name() << ";" << endl;
    }

    f_service << endl;

    string extends = "";
    if (tservice->get_extends() != NULL) {
      extends = " : " + render_type_name(tservice->get_extends());
    }

    f_service << indent() << "interface " << svc_name << extends << " {" << endl;
    indent_up();

    // Collect all the exception types service methods can throw so we can
    // emit the necessary aliases later.
    set<t_type*> exception_types;

    // Print the method signatures.
    vector<t_function*> functions = tservice->get_functions();
    vector<t_function*>::iterator fn_iter;
    for (fn_iter = functions.begin(); fn_iter != functions.end(); ++fn_iter) {
      f_service << indent();
      print_function_signature(f_service, *fn_iter);
      f_service << ";" << endl;

      const vector<t_field*>& exceptions = (*fn_iter)->get_xceptions()->get_members();
      vector<t_field*>::const_iterator ex_iter;
      for (ex_iter = exceptions.begin(); ex_iter != exceptions.end(); ++ex_iter) {
        exception_types.insert((*ex_iter)->get_type());
      }
    }

    // Alias the exception types into the current scope.
    if (!exception_types.empty())
      f_service << endl;
    set<t_type*>::const_iterator et_iter;
    for (et_iter = exception_types.begin(); et_iter != exception_types.end(); ++et_iter) {
      indent(f_service) << "alias " << render_package(*(*et_iter)->get_program())
                        << (*et_iter)->get_program()->get_name() << "_types"
                        << "." << (*et_iter)->get_name() << " " << (*et_iter)->get_name() << ";"
                        << endl;
    }

    // Write the method metadata.
    ostringstream meta;
    indent_up();
    bool first = true;
    for (fn_iter = functions.begin(); fn_iter != functions.end(); ++fn_iter) {
      if ((*fn_iter)->get_arglist()->get_members().empty()
          && (*fn_iter)->get_xceptions()->get_members().empty() && !(*fn_iter)->is_oneway()) {
        continue;
      }

      if (first) {
        first = false;
      } else {
        meta << ",";
      }

      meta << endl << indent() << "TMethodMeta(`" << (*fn_iter)->get_name() << "`, " << endl;
      indent_up();
      indent(meta) << "[";

      bool first = true;
      const vector<t_field*>& params = (*fn_iter)->get_arglist()->get_members();
      vector<t_field*>::const_iterator p_iter;
      for (p_iter = params.begin(); p_iter != params.end(); ++p_iter) {
        if (first) {
          first = false;
        } else {
          meta << ", ";
        }

        meta << "TParamMeta(`" << (*p_iter)->get_name() << "`, " << (*p_iter)->get_key();

        t_const_value* cv = (*p_iter)->get_value();
        if (cv != NULL) {
          meta << ", q{" << render_const_value((*p_iter)->get_type(), cv) << "}";
        }
        meta << ")";
      }

      meta << "]";

      if (!(*fn_iter)->get_xceptions()->get_members().empty() || (*fn_iter)->is_oneway()) {
        meta << "," << endl << indent() << "[";

        bool first = true;
        const vector<t_field*>& exceptions = (*fn_iter)->get_xceptions()->get_members();
        vector<t_field*>::const_iterator ex_iter;
        for (ex_iter = exceptions.begin(); ex_iter != exceptions.end(); ++ex_iter) {
          if (first) {
            first = false;
          } else {
            meta << ", ";
          }

          meta << "TExceptionMeta(`" << (*ex_iter)->get_name() << "`, " << (*ex_iter)->get_key()
               << ", `" << (*ex_iter)->get_type()->get_name() << "`)";
        }

        meta << "]";
      }

      if ((*fn_iter)->is_oneway()) {
        meta << "," << endl << indent() << "TMethodType.ONEWAY";
      }

      indent_down();
      meta << endl << indent() << ")";
    }
    indent_down();

    string meta_str(meta.str());
    if (!meta_str.empty()) {
      f_service << endl << indent() << "enum methodMeta = [" << meta_str << endl << indent() << "];"
                << endl;
    }

    indent_down();
    indent(f_service) << "}" << endl;

    // Server skeleton generation.
    string f_skeletonname = package_dir_ + svc_name + "_server.skeleton.d";
    std::ofstream f_skeleton;
    f_skeleton.open(f_skeletonname.c_str());
    print_server_skeleton(f_skeleton, tservice);
    f_skeleton.close();
  }

private:
  /**
   * Writes a server skeleton for the passed service to out.
   */
  void print_server_skeleton(ostream& out, t_service* tservice) {
    string svc_name = tservice->get_name();

    out << "/*" << endl
        << " * This auto-generated skeleton file illustrates how to build a server. If you" << endl
        << " * intend to customize it, you should edit a copy with another file name to " << endl
        << " * avoid overwriting it when running the generator again." << endl << " */" << endl
        << "module " << render_package(*tservice->get_program()) << svc_name << "_server;" << endl
        << endl << "import std.stdio;" << endl << "import thrift.codegen.processor;" << endl
        << "import thrift.protocol.binary;" << endl << "import thrift.server.simple;" << endl
        << "import thrift.server.transport.socket;" << endl << "import thrift.transport.buffered;"
        << endl << "import thrift.util.hashset;" << endl << endl << "import "
        << render_package(*tservice->get_program()) << svc_name << ";" << endl << "import "
        << render_package(*get_program()) << program_name_ << "_types;" << endl << endl << endl
        << "class " << svc_name << "Handler : " << svc_name << " {" << endl;

    indent_up();
    out << indent() << "this() {" << endl << indent() << "  // Your initialization goes here."
        << endl << indent() << "}" << endl << endl;

    vector<t_function*> functions = tservice->get_functions();
    vector<t_function*>::iterator f_iter;
    for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
      out << indent();
      print_function_signature(out, *f_iter);
      out << " {" << endl;

      indent_up();

      out << indent() << "// Your implementation goes here." << endl << indent() << "writeln(\""
          << (*f_iter)->get_name() << " called\");" << endl;

      t_base_type* rt = (t_base_type*)(*f_iter)->get_returntype();
      if (rt->get_base() != t_base_type::TYPE_VOID) {
        indent(out) << "return typeof(return).init;" << endl;
      }

      indent_down();

      out << indent() << "}" << endl << endl;
    }

    indent_down();
    out << "}" << endl << endl;

    out << indent() << "void main() {" << endl;
    indent_up();
    out << indent() << "auto protocolFactory = new TBinaryProtocolFactory!();" << endl << indent()
        << "auto processor = new TServiceProcessor!" << svc_name << "(new " << svc_name
        << "Handler);" << endl << indent() << "auto serverTransport = new TServerSocket(9090);"
        << endl << indent() << "auto transportFactory = new TBufferedTransportFactory;" << endl
        << indent() << "auto server = new TSimpleServer(" << endl << indent()
        << "  processor, serverTransport, transportFactory, protocolFactory);" << endl << indent()
        << "server.serve();" << endl;
    indent_down();
    out << "}" << endl;
  }

  /**
   * Writes the definition of a struct or an exception type to out.
   */
  void print_struct_definition(ostream& out, t_struct* tstruct, bool is_exception) {
    const vector<t_field*>& members = tstruct->get_members();

    if (is_exception) {
      indent(out) << "class " << tstruct->get_name() << " : TException {" << endl;
    } else {
      indent(out) << "struct " << tstruct->get_name() << " {" << endl;
    }
    indent_up();

    // Declare all fields.
    vector<t_field*>::const_iterator m_iter;
    for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
      indent(out) << render_type_name((*m_iter)->get_type()) << " " << (*m_iter)->get_name() << ";"
                  << endl;
    }

    if (!members.empty())
      indent(out) << endl;
    indent(out) << "mixin TStructHelpers!(";

    if (!members.empty()) {
      // If there are any fields, construct the TFieldMeta array to pass to
      // TStructHelpers. We can't just pass an empty array if not because []
      // doesn't pass the TFieldMeta[] constraint.
      out << "[";
      indent_up();

      bool first = true;
      vector<t_field*>::const_iterator m_iter;
      for (m_iter = members.begin(); m_iter != members.end(); ++m_iter) {
        if (first) {
          first = false;
        } else {
          out << ",";
        }
        out << endl;

        indent(out) << "TFieldMeta(`" << (*m_iter)->get_name() << "`, " << (*m_iter)->get_key();

        t_const_value* cv = (*m_iter)->get_value();
        t_field::e_req req = (*m_iter)->get_req();
        out << ", " << render_req(req);
        if (cv != NULL) {
          out << ", q{" << render_const_value((*m_iter)->get_type(), cv) << "}";
        }
        out << ")";
      }

      indent_down();
      out << endl << indent() << "]";
    }

    out << ");" << endl;

    indent_down();
    indent(out) << "}" << endl << endl;
  }

  /**
   * Prints the D function signature (including return type) for the given
   * method.
   */
  void print_function_signature(ostream& out, t_function* fn) {
    out << render_type_name(fn->get_returntype()) << " " << fn->get_name() << "(";

    const vector<t_field*>& fields = fn->get_arglist()->get_members();
    vector<t_field*>::const_iterator f_iter;
    bool first = true;
    for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
      if (first) {
        first = false;
      } else {
        out << ", ";
      }
      out << render_type_name((*f_iter)->get_type(), true) << " " << (*f_iter)->get_name();
    }

    out << ")";
  }

  /**
   * Returns the D representation of value. The result is guaranteed to be a
   * single expression; for complex types, immediately called delegate
   * literals are used to achieve this.
   */
  string render_const_value(t_type* type, t_const_value* value) {
    // Resolve any typedefs.
    type = get_true_type(type);

    ostringstream out;
    if (type->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_STRING:
        out << '"' << get_escaped_string(value) << '"';
        break;
      case t_base_type::TYPE_BOOL:
        out << ((value->get_integer() > 0) ? "true" : "false");
        break;
      case t_base_type::TYPE_I8:
      case t_base_type::TYPE_I16:
        out << "cast(" << render_type_name(type) << ")" << value->get_integer();
        break;
      case t_base_type::TYPE_I32:
        out << value->get_integer();
        break;
      case t_base_type::TYPE_I64:
        out << value->get_integer() << "L";
        break;
      case t_base_type::TYPE_DOUBLE:
        if (value->get_type() == t_const_value::CV_INTEGER) {
          out << value->get_integer();
        } else {
          out << value->get_double();
        }
        break;
      default:
        throw "Compiler error: No const of base type " + t_base_type::t_base_name(tbase);
      }
    } else if (type->is_enum()) {
      out << "cast(" << render_type_name(type) << ")" << value->get_integer();
    } else {
      out << "{" << endl;
      indent_up();

      indent(out) << render_type_name(type) << " v;" << endl;
      if (type->is_struct() || type->is_xception()) {
        indent(out) << "v = " << (type->is_xception() ? "new " : "") << render_type_name(type)
                    << "();" << endl;

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
            throw "Type error: " + type->get_name() + " has no field "
                + v_iter->first->get_string();
          }
          string val = render_const_value(field_type, v_iter->second);
          indent(out) << "v.set!`" << v_iter->first->get_string() << "`(" << val << ");" << endl;
        }
      } else if (type->is_map()) {
        t_type* ktype = ((t_map*)type)->get_key_type();
        t_type* vtype = ((t_map*)type)->get_val_type();
        const map<t_const_value*, t_const_value*>& val = value->get_map();
        map<t_const_value*, t_const_value*>::const_iterator v_iter;
        for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
          string key = render_const_value(ktype, v_iter->first);
          string val = render_const_value(vtype, v_iter->second);
          indent(out) << "v[";
          if (!is_immutable_type(ktype)) {
            out << "cast(immutable(" << render_type_name(ktype) << "))";
          }
          out << key << "] = " << val << ";" << endl;
        }
      } else if (type->is_list()) {
        t_type* etype = ((t_list*)type)->get_elem_type();
        const vector<t_const_value*>& val = value->get_list();
        vector<t_const_value*>::const_iterator v_iter;
        for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
          string val = render_const_value(etype, *v_iter);
          indent(out) << "v ~= " << val << ";" << endl;
        }
      } else if (type->is_set()) {
        t_type* etype = ((t_set*)type)->get_elem_type();
        const vector<t_const_value*>& val = value->get_list();
        vector<t_const_value*>::const_iterator v_iter;
        for (v_iter = val.begin(); v_iter != val.end(); ++v_iter) {
          string val = render_const_value(etype, *v_iter);
          indent(out) << "v ~= " << val << ";" << endl;
        }
      } else {
        throw "Compiler error: Invalid type in render_const_value: " + type->get_name();
      }
      indent(out) << "return v;" << endl;

      indent_down();
      indent(out) << "}()";
    }

    return out.str();
  }

  /**
   * Returns the D package to which modules for program are written (with a
   * trailing dot, if not empty).
   */
  string render_package(const t_program& program) const {
    string package = program.get_namespace("d");
    if (package.size() == 0)
      return "";
    return package + ".";
  }

  /**
   * Returns the name of the D repesentation of ttype.
   *
   * If isArg is true, a const reference to the type will be returned for
   * structs.
   */
  string render_type_name(const t_type* ttype, bool isArg = false) const {
    if (ttype->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)ttype)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        return "void";
      case t_base_type::TYPE_STRING:
        return "string";
      case t_base_type::TYPE_BOOL:
        return "bool";
      case t_base_type::TYPE_I8:
        return "byte";
      case t_base_type::TYPE_I16:
        return "short";
      case t_base_type::TYPE_I32:
        return "int";
      case t_base_type::TYPE_I64:
        return "long";
      case t_base_type::TYPE_DOUBLE:
        return "double";
      default:
        throw "Compiler error: No D type name for base type " + t_base_type::t_base_name(tbase);
      }
    }

    if (ttype->is_container()) {
      t_container* tcontainer = (t_container*)ttype;
      if (tcontainer->has_cpp_name()) {
        return tcontainer->get_cpp_name();
      } else if (ttype->is_map()) {
        t_map* tmap = (t_map*)ttype;
        t_type* ktype = tmap->get_key_type();

        string name = render_type_name(tmap->get_val_type()) + "[";
        if (!is_immutable_type(ktype)) {
          name += "immutable(";
        }
        name += render_type_name(ktype);
        if (!is_immutable_type(ktype)) {
          name += ")";
        }
        name += "]";
        return name;
      } else if (ttype->is_set()) {
        t_set* tset = (t_set*)ttype;
        return "HashSet!(" + render_type_name(tset->get_elem_type()) + ")";
      } else if (ttype->is_list()) {
        t_list* tlist = (t_list*)ttype;
        return render_type_name(tlist->get_elem_type()) + "[]";
      }
    }

    if (ttype->is_struct() && isArg) {
      return "ref const(" + ttype->get_name() + ")";
    } else {
      return ttype->get_name();
    }
  }

  /**
   * Returns the D TReq enum member corresponding to req.
   */
  string render_req(t_field::e_req req) const {
    switch (req) {
    case t_field::T_OPT_IN_REQ_OUT:
      return "TReq.OPT_IN_REQ_OUT";
    case t_field::T_OPTIONAL:
      return "TReq.OPTIONAL";
    case t_field::T_REQUIRED:
      return "TReq.REQUIRED";
    default: {
      std::stringstream ss;
      ss << "Compiler error: Invalid requirement level " << req;
      throw ss.str();
    }
    }
  }

  /**
   * Writes the default list of imports (which are written to every generated
   * module) to f.
   */
  void print_default_imports(ostream& out) {
    indent(out) << "import thrift.base;" << endl << "import thrift.codegen.base;" << endl
                << "import thrift.util.hashset;" << endl << endl;
  }

  /**
   * Returns whether type is »intrinsically immutable«, in the sense that
   * a value of that type is implicitly castable to immutable(type), and it is
   * allowed for AA keys without an immutable() qualifier.
   */
  bool is_immutable_type(t_type* type) const {
    t_type* ttype = get_true_type(type);
    return ttype->is_base_type() || ttype->is_enum();
  }

  /*
   * File streams, stored here to avoid passing them as parameters to every
   * function.
   */
  ofstream f_types_;
  ofstream f_header_;

  string package_dir_;
};

THRIFT_REGISTER_GENERATOR(d, "D", "")
