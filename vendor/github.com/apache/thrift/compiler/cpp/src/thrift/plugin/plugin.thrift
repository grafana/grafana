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

namespace as3 org.apache.thrift.plugin
namespace cpp apache.thrift.plugin
namespace csharp Thrift.Plugin
namespace d thrift.plugin
namespace delphi Thrift.Plugin
namespace erl thrift.plugin
namespace go thrift
namespace haxe org.apache.thrift.plugin
namespace hs Thrift.Plugin
namespace java org.apache.thrift.plugin
namespace ocaml Thrift
namespace perl Thrift.Plugin
namespace php thrift.plugin
namespace py thrift.plugin
namespace rb Thrift

typedef i64 t_program_id
typedef i64 t_type_id
typedef i64 t_const_id
typedef i64 t_service_id

enum t_base {
    TYPE_VOID
    TYPE_STRING
    TYPE_BOOL
    TYPE_I8
    TYPE_I16
    TYPE_I32
    TYPE_I64
    TYPE_DOUBLE
    TYPE_BINARY
}

struct TypeMetadata {
  1: required string name
  2: required t_program_id program_id
  99: optional map<string, string> annotations
  100: optional string doc
}

struct t_base_type {
  1: required TypeMetadata metadata
  2: required t_base value
}

struct t_list {
  1: required TypeMetadata metadata
  2: optional string cpp_name
  3: required t_type_id elem_type
}

struct t_set {
  1: required TypeMetadata metadata
  2: optional string cpp_name
  3: required t_type_id elem_type
}

struct t_map {
  1: required TypeMetadata metadata
  2: optional string cpp_name
  3: required t_type_id key_type
  4: required t_type_id val_type
}

struct t_typedef {
  1: required TypeMetadata metadata
  2: required t_type_id type
  3: required string symbolic
  4: required bool forward
}

struct t_enum_value {
  1: required string name
  2: required i32 value
  99: optional map<string, string> annotations
  100: optional string doc
}
struct t_enum {
  1: required TypeMetadata metadata
  2: required list<t_enum_value> constants
}

enum Requiredness {
  T_REQUIRED = 0
  T_OPTIONAL = 1
  T_OPT_IN_REQ_OUT = 2
}

union t_const_value {
  1: optional map<t_const_value, t_const_value> map_val
  2: optional list<t_const_value> list_val
  3: optional string string_val
  4: optional i64 integer_val
  5: optional double double_val
  6: optional string identifier_val
  7: optional t_type_id enum_val
}
struct t_const {
  1: required string name
  2: required t_type_id type
  3: required t_const_value value
  100: optional string doc
}
struct t_struct {
  1: required TypeMetadata metadata
  2: required list<t_field> members
  3: required bool is_union
  4: required bool is_xception
}
struct t_field {
  1: required string name
  2: required t_type_id type
  3: required i32 key
  4: required Requiredness req
  5: optional t_const_value value
  10: required bool reference
  99: optional map<string, string> annotations
  100: optional string doc
}
struct t_function {
  1: required string name
  2: required t_type_id returntype
  3: required t_type_id arglist
  4: required t_type_id xceptions
  5: required bool is_oneway
  100: optional string doc
}
struct t_service {
  1: required TypeMetadata metadata
  2: required list<t_function> functions
  3: optional t_service_id extends_
}
union t_type {
  1: optional t_base_type base_type_val
  2: optional t_typedef typedef_val
  3: optional t_enum enum_val
  4: optional t_struct struct_val
  5: optional t_struct xception_val
  6: optional t_list list_val
  7: optional t_set set_val
  8: optional t_map map_val
  9: optional t_service service_val
}
struct t_scope {
  1: required list<t_type_id> types
  2: required list<t_const_id> constants
  3: required list<t_service_id> services
}

struct TypeRegistry {
  1: required map<t_type_id, t_type> types
  2: required map<t_const_id, t_const> constants
  3: required map<t_service_id, t_service> services
}

struct t_program {
  1: required string name
  2: required t_program_id program_id
  3: required string path
  4: required string namespace_
  5: required string out_path
  6: required bool out_path_is_absolute
  8: required list<t_program> includes
  9: required string include_prefix
  10: required t_scope scope

  11: required list<t_type_id> typedefs
  12: required list<t_type_id> enums
  13: required list<t_const_id> consts
  14: required list<t_type_id> objects
  15: required list<t_service_id> services

  16: required map<string, string> namespaces
  17: required list<string> cpp_includes
  18: required list<string> c_includes
  100: optional string doc
}

struct GeneratorInput {
  1: required t_program program
  2: required TypeRegistry type_registry
  3: required map<string, string> parsed_options
}
