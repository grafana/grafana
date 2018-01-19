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

#include "thrift/common.h"
#include "thrift/parse/t_base_type.h"

t_type* g_type_void;
t_type* g_type_string;
t_type* g_type_binary;
t_type* g_type_slist;
t_type* g_type_bool;
t_type* g_type_i8;
t_type* g_type_i16;
t_type* g_type_i32;
t_type* g_type_i64;
t_type* g_type_double;

void initGlobals() {
  g_type_void = new t_base_type("void", t_base_type::TYPE_VOID);
  g_type_string = new t_base_type("string", t_base_type::TYPE_STRING);
  g_type_binary = new t_base_type("string", t_base_type::TYPE_STRING);
  ((t_base_type*)g_type_binary)->set_binary(true);
  g_type_slist = new t_base_type("string", t_base_type::TYPE_STRING);
  ((t_base_type*)g_type_slist)->set_string_list(true);
  g_type_bool = new t_base_type("bool", t_base_type::TYPE_BOOL);
  g_type_i8 = new t_base_type("i8", t_base_type::TYPE_I8);
  g_type_i16 = new t_base_type("i16", t_base_type::TYPE_I16);
  g_type_i32 = new t_base_type("i32", t_base_type::TYPE_I32);
  g_type_i64 = new t_base_type("i64", t_base_type::TYPE_I64);
  g_type_double = new t_base_type("double", t_base_type::TYPE_DOUBLE);
}

void clearGlobals() {
  delete g_type_void;
  delete g_type_string;
  delete g_type_bool;
  delete g_type_i8;
  delete g_type_i16;
  delete g_type_i32;
  delete g_type_i64;
  delete g_type_double;
}

/**
 * Those are not really needed for plugins but causes link errors without
 */

/**
 * The location of the last parsed doctext comment.
 */
int g_doctext_lineno;
int g_program_doctext_lineno = 0;
PROGDOCTEXT_STATUS g_program_doctext_status = INVALID;
