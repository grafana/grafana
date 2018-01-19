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
 * Program doctext.
 *
 * Seriously, this is the documentation for this whole program.
 */

namespace java thrift.test
namespace cpp thrift.test

// C++ comment
/* c style comment */

# the new unix comment

/** Some doc text goes here.  Wow I am [nesting these] (no more nesting.) */
enum Numberz
{

  /** This is how to document a parameter */
  ONE = 1,

  /** And this is a doc for a parameter that has no specific value assigned */
  TWO,

  THREE,
  FIVE = 5,
  SIX,
  EIGHT = 8
}

/** This is how you would do a typedef doc */
typedef i64 UserId

/** And this is where you would document a struct */
struct Xtruct
{

  /** And the members of a struct */
  1:  string string_thing

  /** doct text goes before a comma */
  4:  i8     byte_thing,

  9:  i32    i32_thing,
  11: i64    i64_thing
}

/**
 * You can document constants now too.  Yeehaw!
 */
const i32 INT32CONSTANT = 9853
const i16 INT16CONSTANT = 1616
/** Everyone get in on the docu-action! */
const map<string,string> MAPCONSTANT = {'hello':'world', 'goodnight':'moon'}

struct Xtruct2
{
  1: i8     byte_thing,
  2: Xtruct struct_thing,
  3: i32    i32_thing
}

/** Struct insanity */
struct Insanity
{

  /** This is doc for field 1 */
  1: map<Numberz, UserId> userMap,

  /** And this is doc for field 2 */
  2: list<Xtruct> xtructs
}

exception Xception {
  1: i32 errorCode,
  2: string message
}

exception Xception2 {
  1: i32 errorCode,
  2: Xtruct struct_thing
}

/* C1 */
/** Doc */
/* C2 */
/* C3 */
struct EmptyStruct {}

struct OneField {
  1: EmptyStruct field
}

/** This is where you would document a Service */
service ThriftTest
{

  /** And this is how you would document functions in a service */
  void         testVoid(),
  string       testString(1: string thing),
  i8           testByte(1: byte thing),
  i32          testI32(1: i32 thing),

  /** Like this one */
  i64          testI64(1: i64 thing),
  double       testDouble(1: double thing),
  Xtruct       testStruct(1: Xtruct thing),
  Xtruct2      testNest(1: Xtruct2 thing),
  map<i32,i32> testMap(1: map<i32,i32> thing),
  set<i32>     testSet(1: set<i32> thing),
  list<i32>    testList(1: list<i32> thing),

  /** This is an example of a function with params documented */
  Numberz      testEnum(

    /** This param is a thing */
    1: Numberz thing

  ),

  UserId       testTypedef(1: UserId thing),

  map<i32,map<i32,i32>> testMapMap(1: i32 hello),

  /* So you think you've got this all worked, out eh? */
  map<UserId, map<Numberz,Insanity>> testInsanity(1: Insanity argument),

}

/// This style of Doxy-comment doesn't work.
typedef i32 SorryNoGo

/**
 * This is a trivial example of a multiline docstring.
 */
typedef i32 TrivialMultiLine

/**
 * This is the canonical example
 * of a multiline docstring.
 */
typedef i32 StandardMultiLine

/**
 * The last line is non-blank.
 * I said non-blank! */
typedef i32 LastLine

/** Both the first line
 * are non blank. ;-)
 * and the last line */
typedef i32 FirstAndLastLine

/**
 *    INDENTED TITLE
 * The text is less indented.
 */
typedef i32 IndentedTitle

/**       First line indented.
 * Unfortunately, this does not get indented.
 */
typedef i32 FirstLineIndent


/**
 * void code_in_comment() {
 *   printf("hooray code!");
 * }
 */
typedef i32 CodeInComment

    /**
     * Indented Docstring.
     * This whole docstring is indented.
     *   This line is indented further.
     */
typedef i32 IndentedDocstring

/** Irregular docstring.
 * We will have to punt
  * on this thing */
typedef i32 Irregular1

/**
 * note the space
 * before these lines
* but not this
 * one
 */
typedef i32 Irregular2

/**
* Flush against
* the left.
*/
typedef i32 Flush

/**
  No stars in this one.
  It should still work fine, though.
    Including indenting.
    */
typedef i32 NoStars

/** Trailing whitespace   
Sloppy trailing whitespace   
is truncated.   */
typedef i32 TrailingWhitespace

/**
 * This is a big one.
 *
 * We'll have some blank lines in it.
 * 
 * void as_well_as(some code) {
 *   puts("YEEHAW!");
 * }
 */
typedef i32 BigDog

/**
*
*
*/
typedef i32 TotallyDegenerate

/**no room for newline here*/

/* * / */
typedef i32 TestFor3501a

/**
 * /
 */
typedef i32 TestFor3501b


/* Comment-end tokens can of course have more than one asterisk */
struct TestFor3709_00 { /* ? */ 1: i32 foo }
/* Comment-end tokens can of course have more than one asterisk **/
struct TestFor3709_01 { /* ? */ 1: i32 foo }
/* Comment-end tokens can of course have more than one asterisk ***/
struct TestFor3709_02 { /* ? */ 1: i32 foo }
/** Comment-end tokens can of course have more than one asterisk */
struct TestFor3709_03 { /* ? */ 1: i32 foo }
/** Comment-end tokens can of course have more than one asterisk **/
struct TestFor3709_04 { /* ? */ 1: i32 foo }
/** Comment-end tokens can of course have more than one asterisk ***/
struct TestFor3709_05 { /* ? */ 1: i32 foo }
/*** Comment-end tokens can of course have more than one asterisk */
struct TestFor3709_06 { /* ? */ 1: i32 foo }
/*** Comment-end tokens can of course have more than one asterisk **/
struct TestFor3709_07 { /* ? */ 1: i32 foo }
/*** Comment-end tokens can of course have more than one asterisk ***/
struct TestFor3709_08 { /* ? */ 1: i32 foo }

struct TestFor3709 {
  /** This is a comment */
  1: required string id,
  /** This is also a comment **/
  2: required string typeId,
  /** Yet another comment! */
  3: required i32 endTimestamp
}


/* THE END */
