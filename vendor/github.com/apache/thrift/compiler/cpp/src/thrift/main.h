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

#ifndef T_MAIN_H
#define T_MAIN_H

#include <string>
#include <cstdio>

#include "thrift/logging.h"

#include "thrift/parse/t_const.h"
#include "thrift/parse/t_field.h"

/**
 * Defined in the flex library
 */

extern "C" { int yylex(void); }

int yyparse(void);

/**
 * Expected to be defined by Flex/Bison
 */
void yyerror(const char* fmt, ...);

/**
 * Check simple identifier names
 */
void validate_simple_identifier(const char* identifier);

/**
 * Check constant types
 */
void validate_const_type(t_const* c);

/**
 * Check constant types
 */
void validate_field_value(t_field* field, t_const_value* cv);

/**
 * Check members of a throws block
 */
bool validate_throws(t_struct* throws);

/**
 * Converts a string filename into a thrift program name
 */
std::string program_name(std::string filename);

/**
 * Gets the directory path of a filename
 */
std::string directory_name(std::string filename);

/**
 * Get the absolute path for an include file
 */
std::string include_file(std::string filename);

/**
 * Clears any previously stored doctext string.
 */
void clear_doctext();

/**
 * Cleans up text commonly found in doxygen-like comments
 */
char* clean_up_doctext(char* doctext);

/**
 * We are sure the program doctext candidate is really the program doctext.
 */
void declare_valid_program_doctext();

/**
 * Emits a warning on list<byte>, binary type is typically a much better choice.
 */
void check_for_list_of_bytes(t_type* list_elem_type);

/**
 * Emits a one-time warning on byte type, promoting the new i8 type instead
 */
void emit_byte_type_warning();

/**
 * Prints deprecation notice for old NS declarations that are no longer supported
 * If new_form is NULL, old_form is assumed to be a language identifier, such as "cpp"
 * If new_form is not NULL, both arguments are used exactly as given
 */
void error_unsupported_namespace_decl(const char* old_form, const char* new_form = NULL);

/**
 * Flex utilities
 */

extern int yylineno;
extern char yytext[];
extern std::FILE* yyin;

#endif
