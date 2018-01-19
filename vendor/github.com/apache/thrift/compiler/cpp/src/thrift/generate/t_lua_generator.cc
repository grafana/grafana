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
#include "thrift/platform.h"
#include "thrift/generate/t_oop_generator.h"

using std::ofstream;
using std::string;
using std::vector;
using std::map;

static const string endl = "\n"; // avoid ostream << std::endl flushes

/**
 * LUA code generator.
 *
 */
class t_lua_generator : public t_oop_generator {
public:
  t_lua_generator(t_program* program,
                  const std::map<std::string, std::string>& parsed_options,
                  const std::string& option_string)
    : t_oop_generator(program) {
    (void)option_string;
    std::map<std::string, std::string>::const_iterator iter;

    gen_requires_ = true;
    for( iter = parsed_options.begin(); iter != parsed_options.end(); ++iter) {
      if( iter->first.compare("omit_requires") == 0) {
        gen_requires_ = false;
      } else {
        throw "unknown option lua:" + iter->first;
      }
    }

    out_dir_base_ = "gen-lua";
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

private:
  /**
   * True iff we should generate lua require statements.
   */
  bool gen_requires_;

  /**
   * Struct-level generation functions
   */
  void generate_lua_struct_definition(std::ofstream& out,
                                      t_struct* tstruct,
                                      bool is_xception = false);
  void generate_lua_struct_reader(std::ofstream& out, t_struct* tstruct);
  void generate_lua_struct_writer(std::ofstream& out, t_struct* tstruct);

  /**
   * Service-level generation functions
   */
  void generate_service_client(std::ofstream& out, t_service* tservice);
  void generate_service_interface(std::ofstream& out, t_service* tservice);
  void generate_service_processor(std::ofstream& out, t_service* tservice);
  void generate_process_function(std::ofstream& out, t_service* tservice, t_function* tfunction);
  void generate_service_helpers(ofstream& out, t_service* tservice);
  void generate_function_helpers(ofstream& out, t_function* tfunction);

  /**
   * Deserialization (Read)
   */
  void generate_deserialize_field(std::ofstream& out,
                                  t_field* tfield,
                                  bool local,
                                  std::string prefix = "");

  void generate_deserialize_struct(std::ofstream& out,
                                   t_struct* tstruct,
                                   bool local,
                                   std::string prefix = "");

  void generate_deserialize_container(std::ofstream& out,
                                      t_type* ttype,
                                      bool local,
                                      std::string prefix = "");

  void generate_deserialize_set_element(std::ofstream& out, t_set* tset, std::string prefix = "");

  void generate_deserialize_map_element(std::ofstream& out, t_map* tmap, std::string prefix = "");

  void generate_deserialize_list_element(std::ofstream& out,
                                         t_list* tlist,
                                         std::string prefix = "");

  /**
   * Serialization (Write)
   */
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
  std::string lua_includes();
  std::string function_signature(t_function* tfunction, std::string prefix = "");
  std::string argument_list(t_struct* tstruct, std::string prefix = "");
  std::string type_to_enum(t_type* ttype);
  static std::string get_namespace(const t_program* program);

  std::string autogen_comment() {
    return std::string("--\n") + "-- Autogenerated by Thrift\n" + "--\n"
           + "-- DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING\n" + "-- @"
                                                                                       "generated\n"
           + "--\n";
  }

  /**
   * File streams
   */
  std::ofstream f_types_;
  std::ofstream f_consts_;
  std::ofstream f_service_;
};

/**
 * Init and close methods
 */
void t_lua_generator::init_generator() {
  // Make output directory
  string outdir = get_out_dir();
  MKDIR(outdir.c_str());

  // Make output files
  string cur_namespace = get_namespace(program_);
  string f_consts_name = outdir + cur_namespace + "constants.lua";
  f_consts_.open(f_consts_name.c_str());
  string f_types_name = outdir + cur_namespace + "ttypes.lua";
  f_types_.open(f_types_name.c_str());

  // Add headers
  f_consts_ << autogen_comment() << lua_includes();
  f_types_ << autogen_comment() << lua_includes();
  if (gen_requires_) {
    f_types_ << endl << "require '" << cur_namespace << "constants'";
  }
}

void t_lua_generator::close_generator() {
  // Close types file
  f_types_.close();
  f_consts_.close();
}

/**
 * Generate a typedef (essentially a constant)
 */
void t_lua_generator::generate_typedef(t_typedef* ttypedef) {
  f_types_ << endl << endl << indent() << ttypedef->get_symbolic() << " = "
           << ttypedef->get_type()->get_name();
}

/**
 * Generates code for an enumerated type (table)
 */
void t_lua_generator::generate_enum(t_enum* tenum) {
  f_types_ << endl << endl << tenum->get_name() << " = {" << endl;

  vector<t_enum_value*> constants = tenum->get_constants();
  vector<t_enum_value*>::iterator c_iter;
  for (c_iter = constants.begin(); c_iter != constants.end();) {
    int32_t value = (*c_iter)->get_value();

    f_types_ << "  " << (*c_iter)->get_name() << " = " << value;
    ++c_iter;
    if (c_iter != constants.end()) {
      f_types_ << ",";
    }
    f_types_ << endl;
  }
  f_types_ << "}";
}

/**
 * Generate a constant (non-local) value
 */
void t_lua_generator::generate_const(t_const* tconst) {
  t_type* type = tconst->get_type();
  string name = tconst->get_name();
  t_const_value* value = tconst->get_value();

  f_consts_ << endl << endl << name << " = ";
  f_consts_ << render_const_value(type, value);
}

/**
 * Prints the value of a constant with the given type.
 */
string t_lua_generator::render_const_value(t_type* type, t_const_value* value) {
  std::ostringstream out;

  type = get_true_type(type);
  if (type->is_base_type()) {
    t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
    switch (tbase) {
    case t_base_type::TYPE_STRING:
      out << "'" << value->get_string() << "'";
      break;
    case t_base_type::TYPE_BOOL:
      out << (value->get_integer() > 0 ? "true" : "false");
      break;
    case t_base_type::TYPE_I8:
    case t_base_type::TYPE_I16:
    case t_base_type::TYPE_I32:
      out << value->get_integer();
      break;
    case t_base_type::TYPE_I64:
      out << "lualongnumber.new('" << value->get_string() << "')";
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
    out << type->get_name() << " = {" << endl;
    indent_up();

    const vector<t_field*>& fields = ((t_struct*)type)->get_members();
    vector<t_field*>::const_iterator f_iter;
    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    for (v_iter = val.begin(); v_iter != val.end();) {
      t_type* field_type = NULL;
      for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
        if ((*f_iter)->get_name() == v_iter->first->get_string()) {
          field_type = (*f_iter)->get_type();
        }
      }
      if (field_type == NULL) {
        throw "type error: " + type->get_name() + " has no field " + v_iter->first->get_string();
      }

      indent(out);
      out << render_const_value(g_type_string, v_iter->first);
      out << " = ";
      out << render_const_value(field_type, v_iter->second);
      ++v_iter;
      if (v_iter != val.end()) {
        out << ",";
      }
    }

    out << "}";
    indent_down();
  } else if (type->is_map()) {
    out << type->get_name() << "{" << endl;
    indent_up();

    t_type* ktype = ((t_map*)type)->get_key_type();
    t_type* vtype = ((t_map*)type)->get_val_type();

    const map<t_const_value*, t_const_value*>& val = value->get_map();
    map<t_const_value*, t_const_value*>::const_iterator v_iter;
    for (v_iter = val.begin(); v_iter != val.end();) {
      indent(out) << "[" << render_const_value(ktype, v_iter->first)
                  << "] = " << render_const_value(vtype, v_iter->second);
      ++v_iter;
      if (v_iter != val.end()) {
        out << ",";
      }
      out << endl;
    }
    indent_down();
    indent(out) << "}";
  } else if (type->is_list() || type->is_set()) {
    t_type* etype;
    if (type->is_list()) {
      etype = ((t_list*)type)->get_elem_type();
    } else {
      etype = ((t_set*)type)->get_elem_type();
    }
    out << type->get_name() << " = {" << endl;
    const vector<t_const_value*>& val = value->get_list();
    vector<t_const_value*>::const_iterator v_iter;
    for (v_iter = val.begin(); v_iter != val.end();) {
      indent(out);
      out << "[" << render_const_value(etype, *v_iter) << "]";
      if (type->is_set()) {
        out << " = true";
      } else {
        out << " = false";
      }
      ++v_iter;
      if (v_iter != val.end()) {
        out << "," << endl;
      }
    }
    out << "}";
  }
  return out.str();
}

/**
 * Generate a thrift struct
 */
void t_lua_generator::generate_struct(t_struct* tstruct) {
  generate_lua_struct_definition(f_types_, tstruct, false);
}

/**
 * Generate a thrift exception
 */
void t_lua_generator::generate_xception(t_struct* txception) {
  generate_lua_struct_definition(f_types_, txception, true);
}

/**
 * Generate a thrift struct or exception (lua table)
 */
void t_lua_generator::generate_lua_struct_definition(ofstream& out,
                                                     t_struct* tstruct,
                                                     bool is_exception) {
  vector<t_field*>::const_iterator m_iter;
  const vector<t_field*>& members = tstruct->get_members();

  indent(out) << endl << endl << tstruct->get_name();
  if (is_exception) {
    out << " = TException:new{" << endl << indent() << "  __type = '" << tstruct->get_name() << "'";
    if (members.size() > 0) {
      out << ",";
    }
    out << endl;
  } else {
    out << " = __TObject:new{" << endl;
  }
  indent_up();
  for (m_iter = members.begin(); m_iter != members.end();) {
    indent(out);
    out << (*m_iter)->get_name();
    ++m_iter;
    if (m_iter != members.end()) {
      out << "," << endl;
    }
  }
  indent_down();
  indent(out);
  out << endl << "}";

  generate_lua_struct_reader(out, tstruct);
  generate_lua_struct_writer(out, tstruct);
}

/**
 * Generate a struct/exception reader
 */
void t_lua_generator::generate_lua_struct_reader(ofstream& out, t_struct* tstruct) {
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  // function
  indent(out) << endl << endl << "function " << tstruct->get_name() << ":read(iprot)" << endl;
  indent_up();

  indent(out) << "iprot:readStructBegin()" << endl;

  // while: Read in fields
  indent(out) << "while true do" << endl;
  indent_up();

  // if: Check what to read
  indent(out) << "local fname, ftype, fid = iprot:readFieldBegin()" << endl;
  indent(out) << "if ftype == TType.STOP then" << endl;
  indent_up();
  indent(out) << "break" << endl;

  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    indent_down();
    indent(out) << "elseif fid == " << (*f_iter)->get_key() << " then" << endl;
    indent_up();
    indent(out) << "if ftype == " << type_to_enum((*f_iter)->get_type()) << " then" << endl;
    indent_up();

    // Read field contents
    generate_deserialize_field(out, *f_iter, false, "self.");

    indent_down();
    indent(out) << "else" << endl;
    indent(out) << "  iprot:skip(ftype)" << endl;
    indent(out) << "end" << endl;
  }

  // end if
  indent_down();
  indent(out) << "else" << endl;
  indent(out) << "  iprot:skip(ftype)" << endl;
  indent(out) << "end" << endl;
  indent(out) << "iprot:readFieldEnd()" << endl;

  // end while
  indent_down();
  indent(out) << "end" << endl;
  indent(out) << "iprot:readStructEnd()" << endl;

  // end function
  indent_down();
  indent(out);
  out << "end";
}

/**
 * Generate a struct/exception writer
 */
void t_lua_generator::generate_lua_struct_writer(ofstream& out, t_struct* tstruct) {
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator f_iter;

  // function
  indent(out) << endl << endl << "function " << tstruct->get_name() << ":write(oprot)" << endl;
  indent_up();

  indent(out) << "oprot:writeStructBegin('" << tstruct->get_name() << "')" << endl;
  for (f_iter = fields.begin(); f_iter != fields.end(); ++f_iter) {
    // To check element of self whether nil or not.
    // avoid the value(false) of BOOL is lost.
    indent(out) << "if self." << (*f_iter)->get_name() << " ~= nil then" << endl;
    indent_up();
    indent(out) << "oprot:writeFieldBegin('" << (*f_iter)->get_name() << "', "
                << type_to_enum((*f_iter)->get_type()) << ", " << (*f_iter)->get_key() << ")"
                << endl;

    // Write field contents
    generate_serialize_field(out, *f_iter, "self.");

    indent(out) << "oprot:writeFieldEnd()" << endl;
    indent_down();
    indent(out) << "end" << endl;
  }
  indent(out) << "oprot:writeFieldStop()" << endl;
  indent(out) << "oprot:writeStructEnd()" << endl;

  // end function
  indent_down();
  indent(out);
  out << "end";
}

/**
 * Generate a thrift service
 */
void t_lua_generator::generate_service(t_service* tservice) {
  // Get output directory
  string outdir = get_out_dir();

  // Open the file for writing
  string cur_ns = get_namespace(program_);
  string f_service_name = outdir + cur_ns + tservice->get_name() + ".lua";
  f_service_.open(f_service_name.c_str());

  // Headers
  f_service_ << autogen_comment() << lua_includes();
  if (gen_requires_) {
    f_service_ << endl << "require '" << cur_ns << "ttypes'" << endl;

    if (tservice->get_extends() != NULL) {
      f_service_ << "require '" << get_namespace(tservice->get_extends()->get_program())
                 << tservice->get_extends()->get_name() << "'" << endl;
    }
  }

  f_service_ << endl;

  generate_service_client(f_service_, tservice);
  generate_service_interface(f_service_, tservice);
  generate_service_processor(f_service_, tservice);
  generate_service_helpers(f_service_, tservice);

  // Close the file
  f_service_.close();
}

void t_lua_generator::generate_service_interface(ofstream& out, t_service* tservice) {
  string classname = tservice->get_name() + "Iface";
  t_service* extends_s = tservice->get_extends();

  // Interface object definition
  out << classname << " = ";
  if (extends_s) {
    out << extends_s->get_name() << "Iface:new{" << endl;
  } else {
    out << "__TObject:new{" << endl;
  }
  out << "  __type = '" << classname << "'" << endl << "}" << endl << endl;
}

void t_lua_generator::generate_service_client(ofstream& out, t_service* tservice) {
  string classname = tservice->get_name() + "Client";
  t_service* extends_s = tservice->get_extends();

  // Client object definition
  out << classname << " = __TObject.new(";
  if (extends_s != NULL) {
    out << extends_s->get_name() << "Client";
  } else {
    out << "__TClient";
  }
  out << ", {" << endl << "  __type = '" << classname << "'" << endl << "})" << endl;

  // Send/Recv functions
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::const_iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    string sig = function_signature(*f_iter);
    string funcname = (*f_iter)->get_name();

    // Wrapper function
    indent(out) << endl << "function " << classname << ":" << sig << endl;
    indent_up();

    indent(out) << "self:send_" << sig << endl << indent();
    if (!(*f_iter)->is_oneway()) {
      if (!(*f_iter)->get_returntype()->is_void()) {
        out << "return ";
      }
      out << "self:recv_" << sig << endl;
    }

    indent_down();
    indent(out) << "end" << endl;

    // Send function
    indent(out) << endl << "function " << classname << ":send_" << sig << endl;
    indent_up();

    indent(out) << "self.oprot:writeMessageBegin('" << funcname << "', "
                << ((*f_iter)->is_oneway() ? "TMessageType.ONEWAY" : "TMessageType.CALL")
                << ", self._seqid)" << endl;
    indent(out) << "local args = " << funcname << "_args:new{}" << endl;

    // Set the args
    const vector<t_field*>& args = (*f_iter)->get_arglist()->get_members();
    vector<t_field*>::const_iterator fld_iter;
    for (fld_iter = args.begin(); fld_iter != args.end(); ++fld_iter) {
      std::string argname = (*fld_iter)->get_name();
      indent(out) << "args." << argname << " = " << argname << endl;
    }

    indent(out) << "args:write(self.oprot)" << endl;
    indent(out) << "self.oprot:writeMessageEnd()" << endl;
    indent(out) << "self.oprot.trans:flush()" << endl;

    indent_down();
    indent(out) << "end" << endl;

    // Recv function
    if (!(*f_iter)->is_oneway()) {
      indent(out) << endl << "function " << classname << ":recv_" << sig << endl;
      indent_up();

      out << indent() << "local fname, mtype, rseqid = self.iprot:"
          << "readMessageBegin()" << endl << indent() << "if mtype == TMessageType.EXCEPTION then"
          << endl << indent() << "  local x = TApplicationException:new{}" << endl << indent()
          << "  x:read(self.iprot)" << endl << indent() << "  self.iprot:readMessageEnd()" << endl
          << indent() << "  error(x)" << endl << indent() << "end" << endl << indent()
          << "local result = " << funcname << "_result:new{}" << endl << indent()
          << "result:read(self.iprot)" << endl << indent() << "self.iprot:readMessageEnd()" << endl;

      // Return the result if it's not a void function
      if (!(*f_iter)->get_returntype()->is_void()) {
        out << indent() << "if result.success ~= nil then" << endl << indent() << "  return result.success"
            << endl;

        // Throw custom exceptions
        const std::vector<t_field*>& xf = (*f_iter)->get_xceptions()->get_members();
        vector<t_field*>::const_iterator x_iter;
        for (x_iter = xf.begin(); x_iter != xf.end(); ++x_iter) {
          out << indent() << "elseif result." << (*x_iter)->get_name() << " then" << endl
              << indent() << "  error(result." << (*x_iter)->get_name() << ")" << endl;
        }

        out << indent() << "end" << endl << indent()
            << "error(TApplicationException:new{errorCode = "
            << "TApplicationException.MISSING_RESULT})" << endl;
      }

      indent_down();
      indent(out) << "end" << endl;
    }
  }
}

void t_lua_generator::generate_service_processor(ofstream& out, t_service* tservice) {
  string classname = tservice->get_name() + "Processor";
  t_service* extends_s = tservice->get_extends();

  // Define processor table
  out << endl << classname << " = __TObject.new(";
  if (extends_s != NULL) {
    out << extends_s << "Processor" << endl;
  } else {
    out << "__TProcessor" << endl;
  }
  out << ", {" << endl << " __type = '" << classname << "'" << endl << "})" << endl;

  // Process function
  indent(out) << endl << "function " << classname << ":process(iprot, oprot, server_ctx)" << endl;
  indent_up();

  indent(out) << "local name, mtype, seqid = iprot:readMessageBegin()" << endl;
  indent(out) << "local func_name = 'process_' .. name" << endl;
  indent(out) << "if not self[func_name] or ttype(self[func_name]) ~= 'function' then";
  indent_up();
  out << endl << indent() << "iprot:skip(TType.STRUCT)" << endl << indent()
      << "iprot:readMessageEnd()" << endl << indent() << "x = TApplicationException:new{" << endl
      << indent() << "  errorCode = TApplicationException.UNKNOWN_METHOD" << endl << indent() << "}"
      << endl << indent() << "oprot:writeMessageBegin(name, TMessageType.EXCEPTION, "
      << "seqid)" << endl << indent() << "x:write(oprot)" << endl << indent()
      << "oprot:writeMessageEnd()" << endl << indent() << "oprot.trans:flush()" << endl;
  indent_down();
  indent(out) << "else" << endl << indent()
              << "  self[func_name](self, seqid, iprot, oprot, server_ctx)" << endl << indent()
              << "end" << endl;

  indent_down();
  indent(out) << "end" << endl;

  // Generate the process subfunctions
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    generate_process_function(out, tservice, *f_iter);
  }
}

void t_lua_generator::generate_process_function(ofstream& out,
                                                t_service* tservice,
                                                t_function* tfunction) {
  string classname = tservice->get_name() + "Processor";
  string argsname = tfunction->get_name() + "_args";
  string resultname = tfunction->get_name() + "_result";
  string fn_name = tfunction->get_name();

  indent(out) << endl << "function " << classname << ":process_" << fn_name
              << "(seqid, iprot, oprot, server_ctx)" << endl;
  indent_up();

  // Read the request
  out << indent() << "local args = " << argsname << ":new{}" << endl << indent()
      << "local reply_type = TMessageType.REPLY" << endl << indent() << "args:read(iprot)" << endl
      << indent() << "iprot:readMessageEnd()" << endl << indent() << "local result = " << resultname
      << ":new{}" << endl << indent() << "local status, res = pcall(self.handler." << fn_name
      << ", self.handler";

  // Print arguments
  t_struct* args = tfunction->get_arglist();
  if (args->get_members().size() > 0) {
    out << ", " << argument_list(args, "args.");
  }

  // Check for errors
  out << ")" << endl << indent() << "if not status then" << endl << indent()
      << "  reply_type = TMessageType.EXCEPTION" << endl << indent()
      << "  result = TApplicationException:new{message = res}" << endl;

  // Handle custom exceptions
  const std::vector<t_field*>& xf = tfunction->get_xceptions()->get_members();
  if (xf.size() > 0) {
    vector<t_field*>::const_iterator x_iter;
    for (x_iter = xf.begin(); x_iter != xf.end(); ++x_iter) {
      out << indent() << "elseif ttype(res) == '" << (*x_iter)->get_type()->get_name() << "' then"
          << endl << indent() << "  result." << (*x_iter)->get_name() << " = res" << endl;
    }
  }

  // Set the result and write the reply
  out << indent() << "else" << endl << indent() << "  result.success = res" << endl << indent()
      << "end" << endl << indent() << "oprot:writeMessageBegin('" << fn_name << "', reply_type, "
      << "seqid)" << endl << indent() << "result:write(oprot)" << endl << indent()
      << "oprot:writeMessageEnd()" << endl << indent() << "oprot.trans:flush()" << endl;

  indent_down();
  indent(out) << "end" << endl;
}

// Service helpers
void t_lua_generator::generate_service_helpers(ofstream& out, t_service* tservice) {
  vector<t_function*> functions = tservice->get_functions();
  vector<t_function*>::iterator f_iter;

  out << endl << "-- HELPER FUNCTIONS AND STRUCTURES";
  for (f_iter = functions.begin(); f_iter != functions.end(); ++f_iter) {
    t_struct* ts = (*f_iter)->get_arglist();
    generate_lua_struct_definition(out, ts, false);
    generate_function_helpers(out, *f_iter);
  }
}

void t_lua_generator::generate_function_helpers(ofstream& out, t_function* tfunction) {
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
    generate_lua_struct_definition(out, &result, false);
  }
}

/**
 * Deserialize (Read)
 */
void t_lua_generator::generate_deserialize_field(ofstream& out,
                                                 t_field* tfield,
                                                 bool local,
                                                 string prefix) {
  t_type* type = get_true_type(tfield->get_type());

  if (type->is_void()) {
    throw "CANNOT GENERATE DESERIALIZE CODE FOR void TYPE: " + prefix + tfield->get_name();
  }

  string name = prefix + tfield->get_name();

  if (type->is_struct() || type->is_xception()) {
    generate_deserialize_struct(out, (t_struct*)type, local, name);
  } else if (type->is_container()) {
    generate_deserialize_container(out, type, local, name);
  } else if (type->is_base_type() || type->is_enum()) {
    indent(out) << (local ? "local " : "") << name << " = iprot:";

    if (type->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        throw "compiler error: cannot serialize void field in a struct: " + name;
        break;
      case t_base_type::TYPE_STRING:
        out << "readString()";
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
        throw "compiler error: no PHP name for base type " + t_base_type::t_base_name(tbase);
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

void t_lua_generator::generate_deserialize_struct(ofstream& out,
                                                  t_struct* tstruct,
                                                  bool local,
                                                  string prefix) {
  indent(out) << (local ? "local " : "") << prefix << " = " << tstruct->get_name() << ":new{}"
              << endl << indent() << prefix << ":read(iprot)" << endl;
}

void t_lua_generator::generate_deserialize_container(ofstream& out,
                                                     t_type* ttype,
                                                     bool local,
                                                     string prefix) {
  string size = tmp("_size");
  string ktype = tmp("_ktype");
  string vtype = tmp("_vtype");
  string etype = tmp("_etype");

  t_field fsize(g_type_i32, size);
  t_field fktype(g_type_i8, ktype);
  t_field fvtype(g_type_i8, vtype);
  t_field fetype(g_type_i8, etype);

  // Declare variables, read header
  indent(out) << (local ? "local " : "") << prefix << " = {}" << endl;
  if (ttype->is_map()) {
    indent(out) << "local " << ktype << ", " << vtype << ", " << size << " = iprot:readMapBegin() "
                << endl;
  } else if (ttype->is_set()) {
    indent(out) << "local " << etype << ", " << size << " = iprot:readSetBegin()" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "local " << etype << ", " << size << " = iprot:readListBegin()" << endl;
  }

  // Deserialize
  indent(out) << "for _i=1," << size << " do" << endl;
  indent_up();

  if (ttype->is_map()) {
    generate_deserialize_map_element(out, (t_map*)ttype, prefix);
  } else if (ttype->is_set()) {
    generate_deserialize_set_element(out, (t_set*)ttype, prefix);
  } else if (ttype->is_list()) {
    generate_deserialize_list_element(out, (t_list*)ttype, prefix);
  }

  indent_down();
  indent(out) << "end" << endl;

  // Read container end
  if (ttype->is_map()) {
    indent(out) << "iprot:readMapEnd()" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "iprot:readSetEnd()" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "iprot:readListEnd()" << endl;
  }
}

void t_lua_generator::generate_deserialize_map_element(ofstream& out, t_map* tmap, string prefix) {
  // A map is represented by a table indexable by any lua type
  string key = tmp("_key");
  string val = tmp("_val");
  t_field fkey(tmap->get_key_type(), key);
  t_field fval(tmap->get_val_type(), val);

  generate_deserialize_field(out, &fkey, true);
  generate_deserialize_field(out, &fval, true);

  indent(out) << prefix << "[" << key << "] = " << val << endl;
}

void t_lua_generator::generate_deserialize_set_element(ofstream& out, t_set* tset, string prefix) {
  // A set is represented by a table indexed by the value
  string elem = tmp("_elem");
  t_field felem(tset->get_elem_type(), elem);

  generate_deserialize_field(out, &felem, true);

  indent(out) << prefix << "[" << elem << "] = " << elem << endl;
}

void t_lua_generator::generate_deserialize_list_element(ofstream& out,
                                                        t_list* tlist,
                                                        string prefix) {
  // A list is represented by a table indexed by integer values
  // LUA natively provides all of the functions required to maintain a list
  string elem = tmp("_elem");
  t_field felem(tlist->get_elem_type(), elem);

  generate_deserialize_field(out, &felem, true);

  indent(out) << "table.insert(" << prefix << ", " << elem << ")" << endl;
}

/**
 * Serialize (Write)
 */
void t_lua_generator::generate_serialize_field(ofstream& out, t_field* tfield, string prefix) {
  t_type* type = get_true_type(tfield->get_type());
  string name = prefix + tfield->get_name();

  // Do nothing for void types
  if (type->is_void()) {
    throw "CANNOT GENERATE SERIALIZE CODE FOR void TYPE: " + name;
  }

  if (type->is_struct() || type->is_xception()) {
    generate_serialize_struct(out, (t_struct*)type, name);
  } else if (type->is_container()) {
    generate_serialize_container(out, type, name);
  } else if (type->is_base_type() || type->is_enum()) {
    indent(out) << "oprot:";

    if (type->is_base_type()) {
      t_base_type::t_base tbase = ((t_base_type*)type)->get_base();
      switch (tbase) {
      case t_base_type::TYPE_VOID:
        throw "compiler error: cannot serialize void field in a struct: " + name;
        break;
      case t_base_type::TYPE_STRING:
        out << "writeString(" << name << ")";
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
        throw "compiler error: no PHP name for base type " + t_base_type::t_base_name(tbase);
      }
    } else if (type->is_enum()) {
      out << "writeI32(" << name << ")";
    }
    out << endl;
  } else {
    printf("DO NOT KNOW HOW TO SERIALIZE FIELD '%s' TYPE '%s'\n",
           name.c_str(),
           type->get_name().c_str());
  }
}

void t_lua_generator::generate_serialize_struct(ofstream& out, t_struct* tstruct, string prefix) {
  (void)tstruct;
  indent(out) << prefix << ":write(oprot)" << endl;
}

void t_lua_generator::generate_serialize_container(ofstream& out, t_type* ttype, string prefix) {
  // Begin writing
  if (ttype->is_map()) {
    indent(out) << "oprot:writeMapBegin(" << type_to_enum(((t_map*)ttype)->get_key_type()) << ", "
                << type_to_enum(((t_map*)ttype)->get_val_type()) << ", "
                << "ttable_size(" << prefix << "))" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "oprot:writeSetBegin(" << type_to_enum(((t_set*)ttype)->get_elem_type()) << ", "
                << "ttable_size(" << prefix << "))" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "oprot:writeListBegin(" << type_to_enum(((t_list*)ttype)->get_elem_type())
                << ", "
                << "#" << prefix << ")" << endl;
  }

  // Serialize
  if (ttype->is_map()) {
    string kiter = tmp("kiter");
    string viter = tmp("viter");
    indent(out) << "for " << kiter << "," << viter << " in pairs(" << prefix << ") do" << endl;
    indent_up();
    generate_serialize_map_element(out, (t_map*)ttype, kiter, viter);
    indent_down();
    indent(out) << "end" << endl;
  } else if (ttype->is_set()) {
    string iter = tmp("iter");
    indent(out) << "for " << iter << ",_ in pairs(" << prefix << ") do" << endl;
    indent_up();
    generate_serialize_set_element(out, (t_set*)ttype, iter);
    indent_down();
    indent(out) << "end" << endl;
  } else if (ttype->is_list()) {
    string iter = tmp("iter");
    indent(out) << "for _," << iter << " in ipairs(" << prefix << ") do" << endl;
    indent_up();
    generate_serialize_list_element(out, (t_list*)ttype, iter);
    indent_down();
    indent(out) << "end" << endl;
  }

  // Finish writing
  if (ttype->is_map()) {
    indent(out) << "oprot:writeMapEnd()" << endl;
  } else if (ttype->is_set()) {
    indent(out) << "oprot:writeSetEnd()" << endl;
  } else if (ttype->is_list()) {
    indent(out) << "oprot:writeListEnd()" << endl;
  }
}

void t_lua_generator::generate_serialize_map_element(ofstream& out,
                                                     t_map* tmap,
                                                     string kiter,
                                                     string viter) {
  t_field kfield(tmap->get_key_type(), kiter);
  generate_serialize_field(out, &kfield, "");

  t_field vfield(tmap->get_val_type(), viter);
  generate_serialize_field(out, &vfield, "");
}

void t_lua_generator::generate_serialize_set_element(ofstream& out, t_set* tset, string iter) {
  t_field efield(tset->get_elem_type(), iter);
  generate_serialize_field(out, &efield, "");
}

void t_lua_generator::generate_serialize_list_element(ofstream& out, t_list* tlist, string iter) {
  t_field efield(tlist->get_elem_type(), iter);
  generate_serialize_field(out, &efield, "");
}

/**
 *  Helper rendering functions
 */
string t_lua_generator::lua_includes() {
  if (gen_requires_) {
    return "\n\nrequire 'Thrift'";
  } else {
    return "";
  }
}

string t_lua_generator::get_namespace(const t_program* program) {
  std::string real_module = program->get_namespace("lua");
  if (real_module.empty()) {
    return program->get_name() + "_";
  }
  return real_module + "_";
}

string t_lua_generator::function_signature(t_function* tfunction, string prefix) {
  (void)prefix;
  std::string ret = tfunction->get_name() + "(" + argument_list(tfunction->get_arglist()) + ")";
  return ret;
}

string t_lua_generator::argument_list(t_struct* tstruct, string prefix) {
  const vector<t_field*>& fields = tstruct->get_members();
  vector<t_field*>::const_iterator fld_iter;
  std::string ret = "";
  for (fld_iter = fields.begin(); fld_iter != fields.end();) {
    ret += prefix + (*fld_iter)->get_name();
    ++fld_iter;
    if (fld_iter != fields.end()) {
      ret += ", ";
    }
  }
  return ret;
}

string t_lua_generator::type_to_enum(t_type* type) {
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

THRIFT_REGISTER_GENERATOR(
    lua,
    "Lua",
    "    omit_requires:   Suppress generation of require 'somefile'.\n")
