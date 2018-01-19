%{
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

/**
 * Thrift parser.
 *
 * This parser is used on a thrift definition file.
 *
 */

#define __STDC_LIMIT_MACROS
#define __STDC_FORMAT_MACROS
#include <stdio.h>
#ifndef _MSC_VER
#include <inttypes.h>
#else
#include <stdint.h>
#endif
#include <limits.h>
#ifdef _MSC_VER
#include "thrift/windows/config.h"
#endif
#include "thrift/main.h"
#include "thrift/common.h"
#include "thrift/globals.h"
#include "thrift/parse/t_program.h"
#include "thrift/parse/t_scope.h"

#ifdef _MSC_VER
//warning C4065: switch statement contains 'default' but no 'case' labels
#pragma warning(disable:4065)
#endif

/**
 * This global variable is used for automatic numbering of field indices etc.
 * when parsing the members of a struct. Field values are automatically
 * assigned starting from -1 and working their way down.
 */
int y_field_val = -1;
/**
 * This global variable is used for automatic numbering of enum values.
 * y_enum_val is the last value assigned; the next auto-assigned value will be
 * y_enum_val+1, and then it continues working upwards.  Explicitly specified
 * enum values reset y_enum_val to that value.
 */
int32_t y_enum_val = -1;
int g_arglist = 0;
const int struct_is_struct = 0;
const int struct_is_union = 1;

%}

/**
 * This structure is used by the parser to hold the data types associated with
 * various parse nodes.
 */
%union {
  char*          id;
  int64_t        iconst;
  double         dconst;
  bool           tbool;
  t_doc*         tdoc;
  t_type*        ttype;
  t_base_type*   tbase;
  t_typedef*     ttypedef;
  t_enum*        tenum;
  t_enum_value*  tenumv;
  t_const*       tconst;
  t_const_value* tconstv;
  t_struct*      tstruct;
  t_service*     tservice;
  t_function*    tfunction;
  t_field*       tfield;
  char*          dtext;
  t_field::e_req ereq;
  t_annotation*  tannot;
  t_field_id     tfieldid;
}

/**
 * Strings identifier
 */
%token<id>     tok_identifier
%token<id>     tok_literal
%token<dtext>  tok_doctext

/**
 * Constant values
 */
%token<iconst> tok_int_constant
%token<dconst> tok_dub_constant

/**
 * Header keywords
 */
%token tok_include
%token tok_namespace
%token tok_cpp_include
%token tok_cpp_type
%token tok_xsd_all
%token tok_xsd_optional
%token tok_xsd_nillable
%token tok_xsd_attrs

/**
 * Base datatype keywords
 */
%token tok_void
%token tok_bool
%token tok_string
%token tok_binary
%token tok_slist
%token tok_senum
%token tok_i8
%token tok_i16
%token tok_i32
%token tok_i64
%token tok_double

/**
 * Complex type keywords
 */
%token tok_map
%token tok_list
%token tok_set

/**
 * Function modifiers
 */
%token tok_oneway

/**
 * Thrift language keywords
 */
%token tok_typedef
%token tok_struct
%token tok_xception
%token tok_throws
%token tok_extends
%token tok_service
%token tok_enum
%token tok_const
%token tok_required
%token tok_optional
%token tok_union
%token tok_reference

/**
 * Grammar nodes
 */

%type<ttype>     BaseType
%type<ttype>     SimpleBaseType
%type<ttype>     ContainerType
%type<ttype>     SimpleContainerType
%type<ttype>     MapType
%type<ttype>     SetType
%type<ttype>     ListType

%type<tdoc>      Definition
%type<ttype>     TypeDefinition

%type<ttypedef>  Typedef

%type<ttype>     TypeAnnotations
%type<ttype>     TypeAnnotationList
%type<tannot>    TypeAnnotation
%type<id>        TypeAnnotationValue

%type<tfield>    Field
%type<tfieldid>  FieldIdentifier
%type<ereq>      FieldRequiredness
%type<ttype>     FieldType
%type<tconstv>   FieldValue
%type<tstruct>   FieldList
%type<tbool>     FieldReference

%type<tenum>     Enum
%type<tenum>     EnumDefList
%type<tenumv>    EnumDef
%type<tenumv>    EnumValue

%type<ttypedef>  Senum
%type<tbase>     SenumDefList
%type<id>        SenumDef

%type<tconst>    Const
%type<tconstv>   ConstValue
%type<tconstv>   ConstList
%type<tconstv>   ConstListContents
%type<tconstv>   ConstMap
%type<tconstv>   ConstMapContents

%type<iconst>    StructHead
%type<tstruct>   Struct
%type<tstruct>   Xception
%type<tservice>  Service

%type<tfunction> Function
%type<ttype>     FunctionType
%type<tservice>  FunctionList

%type<tstruct>   Throws
%type<tservice>  Extends
%type<tbool>     Oneway
%type<tbool>     XsdAll
%type<tbool>     XsdOptional
%type<tbool>     XsdNillable
%type<tstruct>   XsdAttributes
%type<id>        CppType

%type<dtext>     CaptureDocText

%%

/**
 * Thrift Grammar Implementation.
 *
 * For the most part this source file works its way top down from what you
 * might expect to find in a typical .thrift file, i.e. type definitions and
 * namespaces up top followed by service definitions using those types.
 */

Program:
  HeaderList DefinitionList
    {
      pdebug("Program -> Headers DefinitionList");
      if((g_program_doctext_candidate != NULL) && (g_program_doctext_status != ALREADY_PROCESSED))
      {
        g_program->set_doc(g_program_doctext_candidate);
        g_program_doctext_status = ALREADY_PROCESSED;
      }
      clear_doctext();
    }

CaptureDocText:
    {
      if (g_parse_mode == PROGRAM) {
        $$ = g_doctext;
        g_doctext = NULL;
      } else {
        $$ = NULL;
      }
    }

/* TODO(dreiss): Try to DestroyDocText in all sorts or random places. */
DestroyDocText:
    {
      if (g_parse_mode == PROGRAM) {
        clear_doctext();
      }
    }

/* We have to DestroyDocText here, otherwise it catches the doctext
   on the first real element. */
HeaderList:
  HeaderList DestroyDocText Header
    {
      pdebug("HeaderList -> HeaderList Header");
    }
|
    {
      pdebug("HeaderList -> ");
    }

Header:
  Include
    {
      pdebug("Header -> Include");
    }
| tok_namespace tok_identifier tok_identifier TypeAnnotations
    {
      pdebug("Header -> tok_namespace tok_identifier tok_identifier");
      declare_valid_program_doctext();
      if (g_parse_mode == PROGRAM) {
        g_program->set_namespace($2, $3);
      }
      if ($4 != NULL) {
        g_program->set_namespace_annotations($2, $4->annotations_);
        delete $4;
      }
    }
| tok_namespace '*' tok_identifier
    {
      pdebug("Header -> tok_namespace * tok_identifier");
      declare_valid_program_doctext();
      if (g_parse_mode == PROGRAM) {
        g_program->set_namespace("*", $3);
      }
    }
| tok_cpp_include tok_literal
    {
      pdebug("Header -> tok_cpp_include tok_literal");
      declare_valid_program_doctext();
      if (g_parse_mode == PROGRAM) {
        g_program->add_cpp_include($2);
      }
    }

Include:
  tok_include tok_literal
    {
      pdebug("Include -> tok_include tok_literal");
      declare_valid_program_doctext();
      if (g_parse_mode == INCLUDES) {
        std::string path = include_file(std::string($2));
        if (!path.empty()) {
          g_program->add_include(path, std::string($2));
        }
      }
    }

DefinitionList:
  DefinitionList CaptureDocText Definition
    {
      pdebug("DefinitionList -> DefinitionList Definition");
      if ($2 != NULL && $3 != NULL) {
        $3->set_doc($2);
      }
    }
|
    {
      pdebug("DefinitionList -> ");
    }

Definition:
  Const
    {
      pdebug("Definition -> Const");
      if (g_parse_mode == PROGRAM) {
        g_program->add_const($1);
      }
      $$ = $1;
    }
| TypeDefinition
    {
      pdebug("Definition -> TypeDefinition");
      if (g_parse_mode == PROGRAM) {
        g_scope->add_type($1->get_name(), $1);
        if (g_parent_scope != NULL) {
          g_parent_scope->add_type(g_parent_prefix + $1->get_name(), $1);
        }
        if (! g_program->is_unique_typename($1)) {
          yyerror("Type \"%s\" is already defined.", $1->get_name().c_str());
          exit(1);
        }
      }
      $$ = $1;
    }
| Service
    {
      pdebug("Definition -> Service");
      if (g_parse_mode == PROGRAM) {
        g_scope->add_service($1->get_name(), $1);
        if (g_parent_scope != NULL) {
          g_parent_scope->add_service(g_parent_prefix + $1->get_name(), $1);
        }
        g_program->add_service($1);
        if (! g_program->is_unique_typename($1)) {
          yyerror("Type \"%s\" is already defined.", $1->get_name().c_str());
          exit(1);
        }
      }
      $$ = $1;
    }

TypeDefinition:
  Typedef
    {
      pdebug("TypeDefinition -> Typedef");
      if (g_parse_mode == PROGRAM) {
        g_program->add_typedef($1);
      }
    }
| Enum
    {
      pdebug("TypeDefinition -> Enum");
      if (g_parse_mode == PROGRAM) {
        g_program->add_enum($1);
      }
    }
| Senum
    {
      pdebug("TypeDefinition -> Senum");
      if (g_parse_mode == PROGRAM) {
        g_program->add_typedef($1);
      }
    }
| Struct
    {
      pdebug("TypeDefinition -> Struct");
      if (g_parse_mode == PROGRAM) {
        g_program->add_struct($1);
      }
    }
| Xception
    {
      pdebug("TypeDefinition -> Xception");
      if (g_parse_mode == PROGRAM) {
        g_program->add_xception($1);
      }
    }

CommaOrSemicolonOptional:
  ','
    {}
| ';'
    {}
|
    {}

Typedef:
  tok_typedef FieldType tok_identifier TypeAnnotations CommaOrSemicolonOptional
    {
      pdebug("TypeDef -> tok_typedef FieldType tok_identifier");
      validate_simple_identifier( $3);
      t_typedef *td = new t_typedef(g_program, $2, $3);
      $$ = td;
      if ($4 != NULL) {
        $$->annotations_ = $4->annotations_;
        delete $4;
      }
    }

Enum:
  tok_enum tok_identifier '{' EnumDefList '}' TypeAnnotations
    {
      pdebug("Enum -> tok_enum tok_identifier { EnumDefList }");
      $$ = $4;
      validate_simple_identifier( $2);
      $$->set_name($2);
      if ($6 != NULL) {
        $$->annotations_ = $6->annotations_;
        delete $6;
      }

      // make constants for all the enum values
      if (g_parse_mode == PROGRAM) {
        const std::vector<t_enum_value*>& enum_values = $$->get_constants();
        std::vector<t_enum_value*>::const_iterator c_iter;
        for (c_iter = enum_values.begin(); c_iter != enum_values.end(); ++c_iter) {
          std::string const_name = $$->get_name() + "." + (*c_iter)->get_name();
          t_const_value* const_val = new t_const_value((*c_iter)->get_value());
          const_val->set_enum($$);
          g_scope->add_constant(const_name, new t_const(g_type_i32, (*c_iter)->get_name(), const_val));
          if (g_parent_scope != NULL) {
            g_parent_scope->add_constant(g_parent_prefix + const_name, new t_const(g_type_i32, (*c_iter)->get_name(), const_val));
          }
        }
      }
    }

EnumDefList:
  EnumDefList EnumDef
    {
      pdebug("EnumDefList -> EnumDefList EnumDef");
      $$ = $1;
      $$->append($2);
    }
|
    {
      pdebug("EnumDefList -> ");
      $$ = new t_enum(g_program);
      y_enum_val = -1;
    }

EnumDef:
  CaptureDocText EnumValue TypeAnnotations CommaOrSemicolonOptional
    {
      pdebug("EnumDef -> EnumValue");
      $$ = $2;
      if ($1 != NULL) {
        $$->set_doc($1);
      }
	  if ($3 != NULL) {
        $$->annotations_ = $3->annotations_;
        delete $3;
      }
    }

EnumValue:
  tok_identifier '=' tok_int_constant
    {
      pdebug("EnumValue -> tok_identifier = tok_int_constant");
      if ($3 < INT32_MIN || $3 > INT32_MAX) {
        // Note: this used to be just a warning.  However, since thrift always
        // treats enums as i32 values, I'm changing it to a fatal error.
        // I doubt this will affect many people, but users who run into this
        // will have to update their thrift files to manually specify the
        // truncated i32 value that thrift has always been using anyway.
        failure("64-bit value supplied for enum %s will be truncated.", $1);
      }
      y_enum_val = static_cast<int32_t>($3);
      $$ = new t_enum_value($1, y_enum_val);
    }
 |
  tok_identifier
    {
      pdebug("EnumValue -> tok_identifier");
      validate_simple_identifier( $1);
      if (y_enum_val == INT32_MAX) {
        failure("enum value overflow at enum %s", $1);
      }
      ++y_enum_val;
      $$ = new t_enum_value($1, y_enum_val);
    }

Senum:
  tok_senum tok_identifier '{' SenumDefList '}' TypeAnnotations
    {
      pdebug("Senum -> tok_senum tok_identifier { SenumDefList }");
      validate_simple_identifier( $2);
      $$ = new t_typedef(g_program, $4, $2);
      if ($6 != NULL) {
        $$->annotations_ = $6->annotations_;
        delete $6;
      }
    }

SenumDefList:
  SenumDefList SenumDef
    {
      pdebug("SenumDefList -> SenumDefList SenumDef");
      $$ = $1;
      $$->add_string_enum_val($2);
    }
|
    {
      pdebug("SenumDefList -> ");
      $$ = new t_base_type("string", t_base_type::TYPE_STRING);
      $$->set_string_enum(true);
    }

SenumDef:
  tok_literal CommaOrSemicolonOptional
    {
      pdebug("SenumDef -> tok_literal");
      $$ = $1;
    }

Const:
  tok_const FieldType tok_identifier '=' ConstValue CommaOrSemicolonOptional
    {
      pdebug("Const -> tok_const FieldType tok_identifier = ConstValue");
      if (g_parse_mode == PROGRAM) {
        validate_simple_identifier( $3);
        g_scope->resolve_const_value($5, $2);
        $$ = new t_const($2, $3, $5);
        validate_const_type($$);

        g_scope->add_constant($3, $$);
        if (g_parent_scope != NULL) {
          g_parent_scope->add_constant(g_parent_prefix + $3, $$);
        }
      } else {
        $$ = NULL;
      }
    }

ConstValue:
  tok_int_constant
    {
      pdebug("ConstValue => tok_int_constant");
      $$ = new t_const_value();
      $$->set_integer($1);
      if (!g_allow_64bit_consts && ($1 < INT32_MIN || $1 > INT32_MAX)) {
        pwarning(1, "64-bit constant \"%" PRIi64"\" may not work in all languages.\n", $1);
      }
    }
| tok_dub_constant
    {
      pdebug("ConstValue => tok_dub_constant");
      $$ = new t_const_value();
      $$->set_double($1);
    }
| tok_literal
    {
      pdebug("ConstValue => tok_literal");
      $$ = new t_const_value($1);
    }
| tok_identifier
    {
      pdebug("ConstValue => tok_identifier");
      $$ = new t_const_value();
      $$->set_identifier($1);
    }
| ConstList
    {
      pdebug("ConstValue => ConstList");
      $$ = $1;
    }
| ConstMap
    {
      pdebug("ConstValue => ConstMap");
      $$ = $1;
    }

ConstList:
  '[' ConstListContents ']'
    {
      pdebug("ConstList => [ ConstListContents ]");
      $$ = $2;
    }

ConstListContents:
  ConstListContents ConstValue CommaOrSemicolonOptional
    {
      pdebug("ConstListContents => ConstListContents ConstValue CommaOrSemicolonOptional");
      $$ = $1;
      $$->add_list($2);
    }
|
    {
      pdebug("ConstListContents =>");
      $$ = new t_const_value();
      $$->set_list();
    }

ConstMap:
  '{' ConstMapContents '}'
    {
      pdebug("ConstMap => { ConstMapContents }");
      $$ = $2;
    }

ConstMapContents:
  ConstMapContents ConstValue ':' ConstValue CommaOrSemicolonOptional
    {
      pdebug("ConstMapContents => ConstMapContents ConstValue CommaOrSemicolonOptional");
      $$ = $1;
      $$->add_map($2, $4);
    }
|
    {
      pdebug("ConstMapContents =>");
      $$ = new t_const_value();
      $$->set_map();
    }

StructHead:
  tok_struct
    {
      $$ = struct_is_struct;
    }
| tok_union
    {
      $$ = struct_is_union;
    }

Struct:
  StructHead tok_identifier XsdAll '{' FieldList '}' TypeAnnotations
    {
      pdebug("Struct -> tok_struct tok_identifier { FieldList }");
      validate_simple_identifier( $2);
      $5->set_xsd_all($3);
      $5->set_union($1 == struct_is_union);
      $$ = $5;
      $$->set_name($2);
      if ($7 != NULL) {
        $$->annotations_ = $7->annotations_;
        delete $7;
      }
    }

XsdAll:
  tok_xsd_all
    {
      $$ = true;
    }
|
    {
      $$ = false;
    }

XsdOptional:
  tok_xsd_optional
    {
      $$ = true;
    }
|
    {
      $$ = false;
    }

XsdNillable:
  tok_xsd_nillable
    {
      $$ = true;
    }
|
    {
      $$ = false;
    }

XsdAttributes:
  tok_xsd_attrs '{' FieldList '}'
    {
      $$ = $3;
    }
|
    {
      $$ = NULL;
    }

Xception:
  tok_xception tok_identifier '{' FieldList '}' TypeAnnotations
    {
      pdebug("Xception -> tok_xception tok_identifier { FieldList }");
      validate_simple_identifier( $2);
      $4->set_name($2);
      $4->set_xception(true);
      $$ = $4;
      if ($6 != NULL) {
        $$->annotations_ = $6->annotations_;
        delete $6;
      }
    }

Service:
  tok_service tok_identifier Extends '{' FlagArgs FunctionList UnflagArgs '}' TypeAnnotations
    {
      pdebug("Service -> tok_service tok_identifier { FunctionList }");
      validate_simple_identifier( $2);
      $$ = $6;
      $$->set_name($2);
      $$->set_extends($3);
      if ($9 != NULL) {
        $$->annotations_ = $9->annotations_;
        delete $9;
      }
    }

FlagArgs:
    {
       g_arglist = 1;
    }

UnflagArgs:
    {
       g_arglist = 0;
    }

Extends:
  tok_extends tok_identifier
    {
      pdebug("Extends -> tok_extends tok_identifier");
      $$ = NULL;
      if (g_parse_mode == PROGRAM) {
        $$ = g_scope->get_service($2);
        if ($$ == NULL) {
          yyerror("Service \"%s\" has not been defined.", $2);
          exit(1);
        }
      }
    }
|
    {
      $$ = NULL;
    }

FunctionList:
  FunctionList Function
    {
      pdebug("FunctionList -> FunctionList Function");
      $$ = $1;
      $1->add_function($2);
    }
|
    {
      pdebug("FunctionList -> ");
      $$ = new t_service(g_program);
    }

Function:
  CaptureDocText Oneway FunctionType tok_identifier '(' FieldList ')' Throws TypeAnnotations CommaOrSemicolonOptional
    {
      validate_simple_identifier( $4);
      $6->set_name(std::string($4) + "_args");
      $$ = new t_function($3, $4, $6, $8, $2);
      if ($1 != NULL) {
        $$->set_doc($1);
      }
      if ($9 != NULL) {
        $$->annotations_ = $9->annotations_;
        delete $9;
      }
    }

Oneway:
  tok_oneway
    {
      $$ = true;
    }
|
    {
      $$ = false;
    }

Throws:
  tok_throws '(' FieldList ')'
    {
      pdebug("Throws -> tok_throws ( FieldList )");
      $$ = $3;
      if (g_parse_mode == PROGRAM && !validate_throws($$)) {
        yyerror("Throws clause may not contain non-exception types");
        exit(1);
      }
    }
|
    {
      $$ = new t_struct(g_program);
    }

FieldList:
  FieldList Field
    {
      pdebug("FieldList -> FieldList , Field");
      $$ = $1;
      if (!($$->append($2))) {
        yyerror("\"%d: %s\" - field identifier/name has already been used", $2->get_key(), $2->get_name().c_str());
        exit(1);
      }
    }
|
    {
      pdebug("FieldList -> ");
      y_field_val = -1;
      $$ = new t_struct(g_program);
    }

Field:
  CaptureDocText FieldIdentifier FieldRequiredness FieldType FieldReference tok_identifier FieldValue XsdOptional XsdNillable XsdAttributes TypeAnnotations CommaOrSemicolonOptional
    {
      pdebug("tok_int_constant : Field -> FieldType tok_identifier");
      if ($2.auto_assigned) {
        pwarning(1, "No field key specified for %s, resulting protocol may have conflicts or not be backwards compatible!\n", $6);
        if (g_strict >= 192) {
          yyerror("Implicit field keys are deprecated and not allowed with -strict");
          exit(1);
        }
      }
      validate_simple_identifier($6);
      $$ = new t_field($4, $6, $2.value);
      $$->set_reference($5);
      $$->set_req($3);
      if ($7 != NULL) {
        g_scope->resolve_const_value($7, $4);
        validate_field_value($$, $7);
        $$->set_value($7);
      }
      $$->set_xsd_optional($8);
      $$->set_xsd_nillable($9);
      if ($1 != NULL) {
        $$->set_doc($1);
      }
      if ($10 != NULL) {
        $$->set_xsd_attrs($10);
      }
      if ($11 != NULL) {
        $$->annotations_ = $11->annotations_;
        delete $11;
      }
    }

FieldIdentifier:
  tok_int_constant ':'
    {
      if ($1 <= 0) {
        if (g_allow_neg_field_keys) {
          /*
           * g_allow_neg_field_keys exists to allow users to add explicitly
           * specified key values to old .thrift files without breaking
           * protocol compatibility.
           */
          if ($1 != y_field_val) {
            /*
             * warn if the user-specified negative value isn't what
             * thrift would have auto-assigned.
             */
            pwarning(1, "Nonpositive field key (%" PRIi64") differs from what would be "
                     "auto-assigned by thrift (%d).\n", $1, y_field_val);
          }
          /*
           * Leave $1 as-is, and update y_field_val to be one less than $1.
           * The FieldList parsing will catch any duplicate key values.
           */
          y_field_val = static_cast<int32_t>($1 - 1);
          $$.value = static_cast<int32_t>($1);
          $$.auto_assigned = false;
        } else {
          pwarning(1, "Nonpositive value (%d) not allowed as a field key.\n",
                   $1);
          $$.value = y_field_val--;
          $$.auto_assigned = true;
        }
      } else {
        $$.value = static_cast<int32_t>($1);
        $$.auto_assigned = false;
      }
      if( (SHRT_MIN > $$.value) || ($$.value > SHRT_MAX)) {
        pwarning(1, "Field key (%d) exceeds allowed range (%d..%d).\n",
                 $$.value, SHRT_MIN, SHRT_MAX);
      }
    }
|
    {
      $$.value = y_field_val--;
      $$.auto_assigned = true;
      if( (SHRT_MIN > $$.value) || ($$.value > SHRT_MAX)) {
        pwarning(1, "Field key (%d) exceeds allowed range (%d..%d).\n",
                 $$.value, SHRT_MIN, SHRT_MAX);
      }
    }

FieldReference:
  tok_reference
    {
      $$ = true;
    }
|
   {
     $$ = false;
   }

FieldRequiredness:
  tok_required
    {
      $$ = t_field::T_REQUIRED;
    }
| tok_optional
    {
      if (g_arglist) {
        if (g_parse_mode == PROGRAM) {
          pwarning(1, "optional keyword is ignored in argument lists.\n");
        }
        $$ = t_field::T_OPT_IN_REQ_OUT;
      } else {
        $$ = t_field::T_OPTIONAL;
      }
    }
|
    {
      $$ = t_field::T_OPT_IN_REQ_OUT;
    }

FieldValue:
  '=' ConstValue
    {
      if (g_parse_mode == PROGRAM) {
        $$ = $2;
      } else {
        $$ = NULL;
      }
    }
|
    {
      $$ = NULL;
    }

FunctionType:
  FieldType
    {
      pdebug("FunctionType -> FieldType");
      $$ = $1;
    }
| tok_void
    {
      pdebug("FunctionType -> tok_void");
      $$ = g_type_void;
    }

FieldType:
  tok_identifier
    {
      pdebug("FieldType -> tok_identifier");
      if (g_parse_mode == INCLUDES) {
        // Ignore identifiers in include mode
        $$ = NULL;
      } else {
        // Lookup the identifier in the current scope
        $$ = g_scope->get_type($1);
        if ($$ == NULL) {
          /*
           * Either this type isn't yet declared, or it's never
             declared.  Either way allow it and we'll figure it out
             during generation.
           */
          $$ = new t_typedef(g_program, $1, true);
        }
      }
    }
| BaseType
    {
      pdebug("FieldType -> BaseType");
      $$ = $1;
    }
| ContainerType
    {
      pdebug("FieldType -> ContainerType");
      $$ = $1;
    }

BaseType: SimpleBaseType TypeAnnotations
    {
      pdebug("BaseType -> SimpleBaseType TypeAnnotations");
      if ($2 != NULL) {
        $$ = new t_base_type(*static_cast<t_base_type*>($1));
        $$->annotations_ = $2->annotations_;
        delete $2;
      } else {
        $$ = $1;
      }
    }

SimpleBaseType:
  tok_string
    {
      pdebug("BaseType -> tok_string");
      $$ = g_type_string;
    }
| tok_binary
    {
      pdebug("BaseType -> tok_binary");
      $$ = g_type_binary;
    }
| tok_slist
    {
      pdebug("BaseType -> tok_slist");
      $$ = g_type_slist;
    }
| tok_bool
    {
      pdebug("BaseType -> tok_bool");
      $$ = g_type_bool;
    }
| tok_i8
    {
      pdebug("BaseType -> tok_i8");
      $$ = g_type_i8;
    }
| tok_i16
    {
      pdebug("BaseType -> tok_i16");
      $$ = g_type_i16;
    }
| tok_i32
    {
      pdebug("BaseType -> tok_i32");
      $$ = g_type_i32;
    }
| tok_i64
    {
      pdebug("BaseType -> tok_i64");
      $$ = g_type_i64;
    }
| tok_double
    {
      pdebug("BaseType -> tok_double");
      $$ = g_type_double;
    }

ContainerType: SimpleContainerType TypeAnnotations
    {
      pdebug("ContainerType -> SimpleContainerType TypeAnnotations");
      $$ = $1;
      if ($2 != NULL) {
        $$->annotations_ = $2->annotations_;
        delete $2;
      }
    }

SimpleContainerType:
  MapType
    {
      pdebug("SimpleContainerType -> MapType");
      $$ = $1;
    }
| SetType
    {
      pdebug("SimpleContainerType -> SetType");
      $$ = $1;
    }
| ListType
    {
      pdebug("SimpleContainerType -> ListType");
      $$ = $1;
    }

MapType:
  tok_map CppType '<' FieldType ',' FieldType '>'
    {
      pdebug("MapType -> tok_map <FieldType, FieldType>");
      $$ = new t_map($4, $6);
      if ($2 != NULL) {
        ((t_container*)$$)->set_cpp_name(std::string($2));
      }
    }

SetType:
  tok_set CppType '<' FieldType '>'
    {
      pdebug("SetType -> tok_set<FieldType>");
      $$ = new t_set($4);
      if ($2 != NULL) {
        ((t_container*)$$)->set_cpp_name(std::string($2));
      }
    }

ListType:
  tok_list '<' FieldType '>' CppType
    {
      pdebug("ListType -> tok_list<FieldType>");
      check_for_list_of_bytes($3);
      $$ = new t_list($3);
      if ($5 != NULL) {
        ((t_container*)$$)->set_cpp_name(std::string($5));
      }
    }

CppType:
  tok_cpp_type tok_literal
    {
      $$ = $2;
    }
|
    {
      $$ = NULL;
    }

TypeAnnotations:
  '(' TypeAnnotationList ')'
    {
      pdebug("TypeAnnotations -> ( TypeAnnotationList )");
      $$ = $2;
    }
|
    {
      $$ = NULL;
    }

TypeAnnotationList:
  TypeAnnotationList TypeAnnotation
    {
      pdebug("TypeAnnotationList -> TypeAnnotationList , TypeAnnotation");
      $$ = $1;
      $$->annotations_[$2->key] = $2->val;
      delete $2;
    }
|
    {
      /* Just use a dummy structure to hold the annotations. */
      $$ = new t_struct(g_program);
    }

TypeAnnotation:
  tok_identifier TypeAnnotationValue CommaOrSemicolonOptional
    {
      pdebug("TypeAnnotation -> TypeAnnotationValue");
      $$ = new t_annotation;
      $$->key = $1;
      $$->val = $2;
    }

TypeAnnotationValue:
  '=' tok_literal
    {
      pdebug("TypeAnnotationValue -> = tok_literal");
      $$ = $2;
    }
|
    {
      pdebug("TypeAnnotationValue ->");
      $$ = strdup("1");
    }

%%
