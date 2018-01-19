/**
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

#include <ruby.h>
#include <bytes.h>
#include <struct.h>
#include <binary_protocol_accelerated.h>
#include <compact_protocol.h>
#include <memory_buffer.h>

// cached classes/modules
VALUE rb_cSet;
VALUE thrift_module;
VALUE thrift_bytes_module;
VALUE thrift_types_module;

// TType constants
int TTYPE_STOP;
int TTYPE_BOOL;
int TTYPE_BYTE;
int TTYPE_I16;
int TTYPE_I32;
int TTYPE_I64;
int TTYPE_DOUBLE;
int TTYPE_STRING;
int TTYPE_MAP;
int TTYPE_SET;
int TTYPE_LIST;
int TTYPE_STRUCT;

// method ids
ID validate_method_id;
ID write_struct_begin_method_id;
ID write_struct_end_method_id;
ID write_field_begin_method_id;
ID write_field_end_method_id;
ID write_boolean_method_id;
ID write_byte_method_id;
ID write_i16_method_id;
ID write_i32_method_id;
ID write_i64_method_id;
ID write_double_method_id;
ID write_string_method_id;
ID write_binary_method_id;
ID write_map_begin_method_id;
ID write_map_end_method_id;
ID write_list_begin_method_id;
ID write_list_end_method_id;
ID write_set_begin_method_id;
ID write_set_end_method_id;
ID read_bool_method_id;
ID read_byte_method_id;
ID read_i16_method_id;
ID read_i32_method_id;
ID read_i64_method_id;
ID read_string_method_id;
ID read_binary_method_id;
ID read_double_method_id;
ID read_map_begin_method_id;
ID read_map_end_method_id;
ID read_list_begin_method_id;
ID read_list_end_method_id;
ID read_set_begin_method_id;
ID read_set_end_method_id;
ID read_struct_begin_method_id;
ID read_struct_end_method_id;
ID read_field_begin_method_id;
ID read_field_end_method_id;
ID keys_method_id;
ID entries_method_id;
ID write_field_stop_method_id;
ID skip_method_id;
ID write_method_id;
ID read_all_method_id;
ID read_into_buffer_method_id;
ID force_binary_encoding_id;
ID convert_to_utf8_byte_buffer_id;
ID convert_to_string_id;

// constant ids
ID fields_const_id;
ID transport_ivar_id;
ID strict_read_ivar_id;
ID strict_write_ivar_id;

// cached symbols
VALUE type_sym;
VALUE name_sym;
VALUE key_sym;
VALUE value_sym;
VALUE element_sym;
VALUE class_sym;
VALUE binary_sym;
VALUE protocol_exception_class;

void Init_thrift_native() {
  // cached classes
  thrift_module = rb_const_get(rb_cObject, rb_intern("Thrift"));
  thrift_bytes_module = rb_const_get(thrift_module, rb_intern("Bytes"));
  thrift_types_module = rb_const_get(thrift_module, rb_intern("Types"));
  rb_cSet = rb_const_get(rb_cObject, rb_intern("Set"));
  protocol_exception_class = rb_const_get(thrift_module, rb_intern("ProtocolException"));

  // Init ttype constants
  TTYPE_BOOL = FIX2INT(rb_const_get(thrift_types_module, rb_intern("BOOL")));
  TTYPE_BYTE = FIX2INT(rb_const_get(thrift_types_module, rb_intern("BYTE")));
  TTYPE_I16 = FIX2INT(rb_const_get(thrift_types_module, rb_intern("I16")));
  TTYPE_I32 = FIX2INT(rb_const_get(thrift_types_module, rb_intern("I32")));
  TTYPE_I64 = FIX2INT(rb_const_get(thrift_types_module, rb_intern("I64")));
  TTYPE_DOUBLE = FIX2INT(rb_const_get(thrift_types_module, rb_intern("DOUBLE")));
  TTYPE_STRING = FIX2INT(rb_const_get(thrift_types_module, rb_intern("STRING")));
  TTYPE_MAP = FIX2INT(rb_const_get(thrift_types_module, rb_intern("MAP")));
  TTYPE_SET = FIX2INT(rb_const_get(thrift_types_module, rb_intern("SET")));
  TTYPE_LIST = FIX2INT(rb_const_get(thrift_types_module, rb_intern("LIST")));
  TTYPE_STRUCT = FIX2INT(rb_const_get(thrift_types_module, rb_intern("STRUCT")));

  // method ids
  validate_method_id = rb_intern("validate");
  write_struct_begin_method_id = rb_intern("write_struct_begin");
  write_struct_end_method_id = rb_intern("write_struct_end");
  write_field_begin_method_id = rb_intern("write_field_begin");
  write_field_end_method_id = rb_intern("write_field_end");
  write_boolean_method_id = rb_intern("write_bool");
  write_byte_method_id = rb_intern("write_byte");
  write_i16_method_id = rb_intern("write_i16");
  write_i32_method_id = rb_intern("write_i32");
  write_i64_method_id = rb_intern("write_i64");
  write_double_method_id = rb_intern("write_double");
  write_string_method_id = rb_intern("write_string");
  write_binary_method_id = rb_intern("write_binary");
  write_map_begin_method_id = rb_intern("write_map_begin");
  write_map_end_method_id = rb_intern("write_map_end");
  write_list_begin_method_id = rb_intern("write_list_begin");
  write_list_end_method_id = rb_intern("write_list_end");
  write_set_begin_method_id = rb_intern("write_set_begin");
  write_set_end_method_id = rb_intern("write_set_end");
  read_bool_method_id = rb_intern("read_bool");
  read_byte_method_id = rb_intern("read_byte");
  read_i16_method_id = rb_intern("read_i16");
  read_i32_method_id = rb_intern("read_i32");
  read_i64_method_id = rb_intern("read_i64");
  read_string_method_id = rb_intern("read_string");
  read_binary_method_id = rb_intern("read_binary");
  read_double_method_id = rb_intern("read_double");
  read_map_begin_method_id = rb_intern("read_map_begin");
  read_map_end_method_id = rb_intern("read_map_end");  
  read_list_begin_method_id = rb_intern("read_list_begin");
  read_list_end_method_id = rb_intern("read_list_end");
  read_set_begin_method_id = rb_intern("read_set_begin");
  read_set_end_method_id = rb_intern("read_set_end");
  read_struct_begin_method_id = rb_intern("read_struct_begin");
  read_struct_end_method_id = rb_intern("read_struct_end");
  read_field_begin_method_id = rb_intern("read_field_begin");
  read_field_end_method_id = rb_intern("read_field_end");
  keys_method_id = rb_intern("keys");
  entries_method_id = rb_intern("entries");
  write_field_stop_method_id = rb_intern("write_field_stop");
  skip_method_id = rb_intern("skip");
  write_method_id = rb_intern("write");
  read_all_method_id = rb_intern("read_all");
  read_into_buffer_method_id = rb_intern("read_into_buffer");
  force_binary_encoding_id = rb_intern("force_binary_encoding");
  convert_to_utf8_byte_buffer_id = rb_intern("convert_to_utf8_byte_buffer");
  convert_to_string_id = rb_intern("convert_to_string");

  // constant ids
  fields_const_id = rb_intern("FIELDS");
  transport_ivar_id = rb_intern("@trans");
  strict_read_ivar_id = rb_intern("@strict_read");
  strict_write_ivar_id = rb_intern("@strict_write");  

  // cached symbols
  type_sym = ID2SYM(rb_intern("type"));
  name_sym = ID2SYM(rb_intern("name"));
  key_sym = ID2SYM(rb_intern("key"));
  value_sym = ID2SYM(rb_intern("value"));
  element_sym = ID2SYM(rb_intern("element"));
  class_sym = ID2SYM(rb_intern("class"));
  binary_sym = ID2SYM(rb_intern("binary"));

  Init_struct();
  Init_binary_protocol_accelerated();
  Init_compact_protocol();
  Init_memory_buffer();
}
