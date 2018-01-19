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

extern int TTYPE_STOP;
extern int TTYPE_BOOL;
extern int TTYPE_BYTE;
extern int TTYPE_I16;
extern int TTYPE_I32;
extern int TTYPE_I64;
extern int TTYPE_DOUBLE;
extern int TTYPE_STRING;
extern int TTYPE_MAP;
extern int TTYPE_SET;
extern int TTYPE_LIST;
extern int TTYPE_STRUCT;

extern ID validate_method_id;
extern ID write_struct_begin_method_id;
extern ID write_struct_end_method_id;
extern ID write_field_begin_method_id;
extern ID write_field_end_method_id;
extern ID write_boolean_method_id;
extern ID write_byte_method_id;
extern ID write_i16_method_id;
extern ID write_i32_method_id;
extern ID write_i64_method_id;
extern ID write_double_method_id;
extern ID write_string_method_id;
extern ID write_binary_method_id;
extern ID write_map_begin_method_id;
extern ID write_map_end_method_id;
extern ID write_list_begin_method_id;
extern ID write_list_end_method_id;
extern ID write_set_begin_method_id;
extern ID write_set_end_method_id;
extern ID read_bool_method_id;
extern ID read_byte_method_id;
extern ID read_i16_method_id;
extern ID read_i32_method_id;
extern ID read_i64_method_id;
extern ID read_string_method_id;
extern ID read_binary_method_id;
extern ID read_double_method_id;
extern ID read_map_begin_method_id;
extern ID read_map_end_method_id;
extern ID read_list_begin_method_id;
extern ID read_list_end_method_id;
extern ID read_set_begin_method_id;
extern ID read_set_end_method_id;
extern ID read_struct_begin_method_id;
extern ID read_struct_end_method_id;
extern ID read_field_begin_method_id;
extern ID read_field_end_method_id;
extern ID keys_method_id;
extern ID entries_method_id;
extern ID write_field_stop_method_id;
extern ID skip_method_id;
extern ID write_method_id;
extern ID read_all_method_id;
extern ID read_into_buffer_method_id;
extern ID force_binary_encoding_id;
extern ID convert_to_utf8_byte_buffer_id;
extern ID convert_to_string_id;

extern ID fields_const_id;
extern ID transport_ivar_id;
extern ID strict_read_ivar_id;
extern ID strict_write_ivar_id;

extern VALUE type_sym;
extern VALUE name_sym;
extern VALUE key_sym;
extern VALUE value_sym;
extern VALUE element_sym;
extern VALUE class_sym;
extern VALUE binary_sym;

extern VALUE rb_cSet;
extern VALUE thrift_module;
extern VALUE thrift_types_module;
extern VALUE thrift_bytes_module;
extern VALUE class_thrift_protocol;
extern VALUE protocol_exception_class;
