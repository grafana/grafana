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
 * Contains <b>experimental</b> functionality for generating Thrift IDL files
 * (.thrift) from existing D data structures, i.e. the reverse of what the
 * Thrift compiler does.
 */
module thrift.codegen.idlgen;

import std.algorithm : find;
import std.array : empty, front;
import std.conv : to;
import std.traits : EnumMembers, isSomeFunction, OriginalType,
  ParameterTypeTuple, ReturnType;
import std.typetuple : allSatisfy, staticIndexOf, staticMap, NoDuplicates,
  TypeTuple;
import thrift.base;
import thrift.codegen.base;
import thrift.internal.codegen;
import thrift.internal.ctfe;
import thrift.util.hashset;

/**
 * True if the passed type is a Thrift entity (struct, exception, enum,
 * service).
 */
alias Any!(isStruct, isException, isEnum, isService) isThriftEntity;

/**
 * Returns an IDL string describing the passed »root« entities and all types
 * they depend on.
 */
template idlString(Roots...) if (allSatisfy!(isThriftEntity, Roots)) {
  enum idlString = idlStringImpl!Roots.result;
}

private {
  template idlStringImpl(Roots...) if (allSatisfy!(isThriftEntity, Roots)) {
    alias ForAllWithList!(
      ConfinedTuple!(StaticFilter!(isService, Roots)),
      AddBaseServices
    ) Services;

    alias TypeTuple!(
      StaticFilter!(isEnum, Roots),
      ForAllWithList!(
        ConfinedTuple!(
          StaticFilter!(Any!(isException, isStruct), Roots),
          staticMap!(CompositeTypeDeps, staticMap!(ServiceTypeDeps, Services))
        ),
        AddStructWithDeps
      )
    ) Types;

    enum result = ctfeJoin(
      [
        staticMap!(
          enumIdlString,
          StaticFilter!(isEnum, Types)
        ),
        staticMap!(
          structIdlString,
          StaticFilter!(Any!(isStruct, isException), Types)
        ),
        staticMap!(
          serviceIdlString,
          Services
        )
      ],
      "\n"
    );
  }

  template ServiceTypeDeps(T) if (isService!T) {
    alias staticMap!(
      PApply!(MethodTypeDeps, T),
      FilterMethodNames!(T, __traits(derivedMembers, T))
    ) ServiceTypeDeps;
  }

  template MethodTypeDeps(T, string name) if (
    isService!T && isSomeFunction!(MemberType!(T, name))
  ) {
    alias TypeTuple!(
      ReturnType!(MemberType!(T, name)),
      ParameterTypeTuple!(MemberType!(T, name)),
      ExceptionTypes!(T, name)
    ) MethodTypeDeps;
  }

  template ExceptionTypes(T, string name) if (
    isService!T && isSomeFunction!(MemberType!(T, name))
  ) {
    mixin({
      enum meta = find!`a.name == b`(getMethodMeta!T, name);
      if (meta.empty) return "alias TypeTuple!() ExceptionTypes;";

      string result = "alias TypeTuple!(";
      foreach (i, e; meta.front.exceptions) {
        if (i > 0) result ~= ", ";
        result ~= "mixin(`T." ~ e.type ~ "`)";
      }
      result ~= ") ExceptionTypes;";
      return result;
    }());
  }

  template AddBaseServices(T, List...) {
    static if (staticIndexOf!(T, List) == -1) {
      alias NoDuplicates!(BaseServices!T, List) AddBaseServices;
    } else {
      alias List AddStructWithDeps;
    }
  }

  unittest {
    interface A {}
    interface B : A {}
    interface C : B {}
    interface D : A {}

    static assert(is(AddBaseServices!(C) == TypeTuple!(A, B, C)));
    static assert(is(ForAllWithList!(ConfinedTuple!(C, D), AddBaseServices) ==
      TypeTuple!(A, D, B, C)));
  }

  template BaseServices(T, Rest...) if (isService!T) {
    static if (isDerivedService!T) {
      alias BaseServices!(BaseService!T, T, Rest) BaseServices;
    } else {
      alias TypeTuple!(T, Rest) BaseServices;
    }
  }

  template AddStructWithDeps(T, List...) {
    static if (staticIndexOf!(T, List) == -1) {
      // T is not already in the List, so add T and the types it depends on in
      // the front. Because with the Thrift compiler types can only depend on
      // other types that have already been defined, we collect all the
      // dependencies, prepend them to the list, and then prune the duplicates
      // (keeping the first occurrences). If this requirement should ever be
      // dropped from Thrift, this could be easily adapted to handle circular
      // dependencies by passing TypeTuple!(T, List) to ForAllWithList instead
      // of appending List afterwards, and removing the now unnecessary
      // NoDuplicates.
      alias NoDuplicates!(
        ForAllWithList!(
          ConfinedTuple!(
            staticMap!(
              CompositeTypeDeps,
              staticMap!(
                PApply!(MemberType, T),
                FieldNames!T
              )
            )
          ),
          .AddStructWithDeps,
          T
        ),
        List
      ) AddStructWithDeps;
    } else {
      alias List AddStructWithDeps;
    }
  }

  version (unittest) {
    struct A {}
    struct B {
      A a;
      int b;
      A c;
      string d;
    }
    struct C {
      B b;
      A a;
    }

    static assert(is(AddStructWithDeps!C == TypeTuple!(A, B, C)));

    struct D {
      C c;
      mixin TStructHelpers!([TFieldMeta("c", 0, TReq.IGNORE)]);
    }
    static assert(is(AddStructWithDeps!D == TypeTuple!(D)));
  }

  version (unittest) {
    // Circles in the type dependency graph are not allowed in Thrift, but make
    // sure we fail in a sane way instead of crashing the compiler.

    struct Rec1 {
      Rec2[] other;
    }

    struct Rec2 {
      Rec1[] other;
    }

    static assert(!__traits(compiles, AddStructWithDeps!Rec1));
  }

  /*
   * Returns the non-primitive types T directly depends on.
   *
   * For example, CompositeTypeDeps!int would yield an empty type tuple,
   * CompositeTypeDeps!SomeStruct would give SomeStruct, and
   * CompositeTypeDeps!(A[B]) both CompositeTypeDeps!A and CompositeTypeDeps!B.
   */
  template CompositeTypeDeps(T) {
    static if (is(FullyUnqual!T == bool) || is(FullyUnqual!T == byte) ||
      is(FullyUnqual!T == short) || is(FullyUnqual!T == int) ||
      is(FullyUnqual!T == long) || is(FullyUnqual!T : string) ||
      is(FullyUnqual!T == double) || is(FullyUnqual!T == void)
    ) {
      alias TypeTuple!() CompositeTypeDeps;
    } else static if (is(FullyUnqual!T _ : U[], U)) {
      alias CompositeTypeDeps!U CompositeTypeDeps;
    } else static if (is(FullyUnqual!T _ : HashSet!E, E)) {
      alias CompositeTypeDeps!E CompositeTypeDeps;
    } else static if (is(FullyUnqual!T _ : V[K], K, V)) {
      alias TypeTuple!(CompositeTypeDeps!K, CompositeTypeDeps!V) CompositeTypeDeps;
    } else static if (is(FullyUnqual!T == enum) || is(FullyUnqual!T == struct) ||
      is(FullyUnqual!T : TException)
    ) {
      alias TypeTuple!(FullyUnqual!T) CompositeTypeDeps;
    } else {
      static assert(false, "Cannot represent type in Thrift: " ~ T.stringof);
    }
  }
}

/**
 * Returns an IDL string describing the passed service. IDL code for any type
 * dependcies is not included.
 */
template serviceIdlString(T) if (isService!T) {
  enum serviceIdlString = {
    string result = "service " ~ T.stringof;
    static if (isDerivedService!T) {
      result ~= " extends " ~ BaseService!T.stringof;
    }
    result ~= " {\n";

    foreach (methodName; FilterMethodNames!(T, __traits(derivedMembers, T))) {
      result ~= "  ";

      enum meta = find!`a.name == b`(T.methodMeta, methodName);

      static if (!meta.empty && meta.front.type == TMethodType.ONEWAY) {
        result ~= "oneway ";
      }

      alias ReturnType!(MemberType!(T, methodName)) RT;
      static if (is(RT == void)) {
        // We special-case this here instead of adding void to dToIdlType to
        // avoid accepting things like void[].
        result ~= "void ";
      } else {
        result ~= dToIdlType!RT ~ " ";
      }
      result ~= methodName ~ "(";

      short lastId;
      foreach (i, ParamType; ParameterTypeTuple!(MemberType!(T, methodName))) {
        static if (!meta.empty && i < meta.front.params.length) {
          enum havePM = true;
        } else {
          enum havePM = false;
        }

        short id;
        static if (havePM) {
          id = meta.front.params[i].id;
        } else {
          id = --lastId;
        }

        string paramName;
        static if (havePM) {
          paramName = meta.front.params[i].name;
        } else {
          paramName = "param" ~ to!string(i + 1);
        }

        result ~= to!string(id) ~ ": " ~ dToIdlType!ParamType ~ " " ~ paramName;

        static if (havePM && !meta.front.params[i].defaultValue.empty) {
          result ~= " = " ~ dToIdlConst(mixin(meta.front.params[i].defaultValue));
        } else {
          // Unfortunately, getting the default value for parameters from a
          // function alias isn't possible – we can't transfer the default
          // value to the IDL e.g. for interface Foo { void foo(int a = 5); }
          // without the user explicitly declaring it in metadata.
        }
        result ~= ", ";
      }
      result ~= ")";

      static if (!meta.empty && !meta.front.exceptions.empty) {
        result ~= " throws (";
        foreach (e; meta.front.exceptions) {
          result ~= to!string(e.id) ~ ": " ~ e.type ~ " " ~ e.name ~ ", ";
        }
        result ~= ")";
      }

      result ~= ",\n";
    }

    result ~= "}\n";
    return result;
  }();
}

/**
 * Returns an IDL string describing the passed enum. IDL code for any type
 * dependcies is not included.
 */
template enumIdlString(T) if (isEnum!T) {
  enum enumIdlString = {
    static assert(is(OriginalType!T : long),
      "Can only have integer enums in Thrift (not " ~ OriginalType!T.stringof ~
      ", for " ~ T.stringof ~ ").");

    string result = "enum " ~ T.stringof ~ " {\n";

    foreach (name; __traits(derivedMembers, T)) {
      result ~= "  " ~ name ~ " = " ~ dToIdlConst(GetMember!(T, name)) ~ ",\n";
    }

    result ~= "}\n";
    return result;
  }();
}

/**
 * Returns an IDL string describing the passed struct. IDL code for any type
 * dependcies is not included.
 */
template structIdlString(T) if (isStruct!T || isException!T) {
  enum structIdlString = {
    mixin({
      string code = "";
      foreach (field; getFieldMeta!T) {
        code ~= "static assert(is(MemberType!(T, `" ~ field.name ~ "`)));\n";
      }
      return code;
    }());

    string result;
    static if (isException!T) {
      result = "exception ";
    } else {
      result = "struct ";
    }
    result ~= T.stringof ~ " {\n";

    // The last automatically assigned id – fields with no meta information
    // are assigned (in lexical order) descending negative ids, starting with
    // -1, just like the Thrift compiler does.
    short lastId;

    foreach (name; FieldNames!T) {
      enum meta = find!`a.name == b`(getFieldMeta!T, name);

      static if (meta.empty || meta.front.req != TReq.IGNORE) {
        short id;
        static if (meta.empty) {
          id = --lastId;
        } else {
          id = meta.front.id;
        }

        result ~= "  " ~ to!string(id) ~ ":";
        static if (!meta.empty) {
          result ~= dToIdlReq(meta.front.req);
        }
        result ~= " " ~ dToIdlType!(MemberType!(T, name)) ~ " " ~ name;

        static if (!meta.empty && !meta.front.defaultValue.empty) {
          result ~= " = " ~ dToIdlConst(mixin(meta.front.defaultValue));
        } else static if (__traits(compiles, fieldInitA!(T, name))) {
          static if (is(typeof(fieldInitA!(T, name))) &&
            !is(typeof(fieldInitA!(T, name)) == void)
          ) {
            result ~= " = " ~ dToIdlConst(fieldInitA!(T, name));
          }
        } else static if (is(typeof(fieldInitB!(T, name))) &&
          !is(typeof(fieldInitB!(T, name)) == void)
        ) {
          result ~= " = " ~ dToIdlConst(fieldInitB!(T, name));
        }
        result ~= ",\n";
      }
    }

    result ~= "}\n";
    return result;
  }();
}

private {
  // This very convoluted way of doing things was chosen because putting the
  // static if directly into structIdlString caused »not evaluatable at compile
  // time« errors to slip through even though typeof() was used, resp. the
  // condition to be true even though the value couldn't actually be read at
  // compile time due to a @@BUG@@ in DMD 2.055.
  // The extra »compiled« field in fieldInitA is needed because we must not try
  // to use != if !is compiled as well (but was false), e.g. for floating point
  // types.
  template fieldInitA(T, string name) {
    static if (mixin("T.init." ~ name) !is MemberType!(T, name).init) {
      enum fieldInitA = mixin("T.init." ~ name);
    }
  }

  template fieldInitB(T, string name) {
    static if (mixin("T.init." ~ name) != MemberType!(T, name).init) {
      enum fieldInitB = mixin("T.init." ~ name);
    }
  }

  template dToIdlType(T) {
    static if (is(FullyUnqual!T == bool)) {
      enum dToIdlType = "bool";
    } else static if (is(FullyUnqual!T == byte)) {
      enum dToIdlType = "byte";
    } else static if (is(FullyUnqual!T == double)) {
      enum dToIdlType = "double";
    } else static if (is(FullyUnqual!T == short)) {
      enum dToIdlType = "i16";
    } else static if (is(FullyUnqual!T == int)) {
      enum dToIdlType = "i32";
    } else static if (is(FullyUnqual!T == long)) {
      enum dToIdlType = "i64";
    } else static if (is(FullyUnqual!T : string)) {
      enum dToIdlType = "string";
    } else static if (is(FullyUnqual!T _ : U[], U)) {
      enum dToIdlType = "list<" ~ dToIdlType!U ~ ">";
    } else static if (is(FullyUnqual!T _ : V[K], K, V)) {
      enum dToIdlType = "map<" ~ dToIdlType!K ~ ", " ~ dToIdlType!V ~ ">";
    } else static if (is(FullyUnqual!T _ : HashSet!E, E)) {
      enum dToIdlType = "set<" ~ dToIdlType!E ~ ">";
    } else static if (is(FullyUnqual!T == struct) || is(FullyUnqual!T == enum) ||
      is(FullyUnqual!T : TException)
    ) {
      enum dToIdlType = FullyUnqual!(T).stringof;
    } else {
      static assert(false, "Cannot represent type in Thrift: " ~ T.stringof);
    }
  }

  string dToIdlReq(TReq req) {
    switch (req) {
      case TReq.REQUIRED: return " required";
      case TReq.OPTIONAL: return " optional";
      default: return "";
    }
  }

  string dToIdlConst(T)(T value) {
    static if (is(FullyUnqual!T == bool)) {
      return value ? "1" : "0";
    } else static if (is(FullyUnqual!T == byte) ||
      is(FullyUnqual!T == short) || is(FullyUnqual!T == int) ||
      is(FullyUnqual!T == long)
    ) {
      return to!string(value);
    } else static if (is(FullyUnqual!T : string)) {
      return `"` ~ to!string(value) ~ `"`;
    } else static if (is(FullyUnqual!T == double)) {
      return ctfeToString(value);
    } else static if (is(FullyUnqual!T _ : U[], U) ||
      is(FullyUnqual!T _ : HashSet!E, E)
    ) {
      string result = "[";
      foreach (e; value) {
        result ~= dToIdlConst(e) ~ ", ";
      }
      result ~= "]";
      return result;
    } else static if (is(FullyUnqual!T _ : V[K], K, V)) {
      string result = "{";
      foreach (key, val; value) {
        result ~= dToIdlConst(key) ~ ": " ~ dToIdlConst(val) ~ ", ";
      }
      result ~= "}";
      return result;
    } else static if (is(FullyUnqual!T == enum)) {
      import std.conv;
      import std.traits;
      return to!string(cast(OriginalType!T)value);
    } else static if (is(FullyUnqual!T == struct) ||
      is(FullyUnqual!T : TException)
    ) {
      string result = "{";
      foreach (name; __traits(derivedMembers, T)) {
        static if (memberReq!(T, name) != TReq.IGNORE) {
          result ~= name ~ ": " ~ dToIdlConst(mixin("value." ~ name)) ~ ", ";
        }
      }
      result ~= "}";
      return result;
    } else {
      static assert(false, "Cannot represent type in Thrift: " ~ T.stringof);
    }
  }
}

version (unittest) {
  enum Foo {
    a = 1,
    b = 10,
    c = 5
  }

  static assert(enumIdlString!Foo ==
`enum Foo {
  a = 1,
  b = 10,
  c = 5,
}
`);
}


version (unittest) {
  struct WithoutMeta {
    string a;
    int b;
  }

  struct WithDefaults {
    string a = "asdf";
    double b = 3.1415;
    WithoutMeta c;

    mixin TStructHelpers!([
      TFieldMeta("c", 1, TReq.init, `WithoutMeta("foo", 3)`)
    ]);
  }

  // These are from DebugProtoTest.thrift.
  struct OneOfEach {
    bool im_true;
    bool im_false;
    byte a_bite;
    short integer16;
    int integer32;
    long integer64;
    double double_precision;
    string some_characters;
    string zomg_unicode;
    bool what_who;
    string base64;
    byte[] byte_list;
    short[] i16_list;
    long[] i64_list;

    mixin TStructHelpers!([
      TFieldMeta(`im_true`, 1),
      TFieldMeta(`im_false`, 2),
      TFieldMeta(`a_bite`, 3, TReq.OPT_IN_REQ_OUT, q{cast(byte)127}),
      TFieldMeta(`integer16`, 4, TReq.OPT_IN_REQ_OUT, q{cast(short)32767}),
      TFieldMeta(`integer32`, 5),
      TFieldMeta(`integer64`, 6, TReq.OPT_IN_REQ_OUT, q{10000000000L}),
      TFieldMeta(`double_precision`, 7),
      TFieldMeta(`some_characters`, 8),
      TFieldMeta(`zomg_unicode`, 9),
      TFieldMeta(`what_who`, 10),
      TFieldMeta(`base64`, 11),
      TFieldMeta(`byte_list`, 12, TReq.OPT_IN_REQ_OUT, q{{
        byte[] v;
        v ~= cast(byte)1;
        v ~= cast(byte)2;
        v ~= cast(byte)3;
        return v;
      }()}),
      TFieldMeta(`i16_list`, 13, TReq.OPT_IN_REQ_OUT, q{{
        short[] v;
        v ~= cast(short)1;
        v ~= cast(short)2;
        v ~= cast(short)3;
        return v;
      }()}),
      TFieldMeta(`i64_list`, 14, TReq.OPT_IN_REQ_OUT, q{{
        long[] v;
        v ~= 1L;
        v ~= 2L;
        v ~= 3L;
        return v;
      }()})
    ]);
  }

  struct Bonk {
    int type;
    string message;

    mixin TStructHelpers!([
      TFieldMeta(`type`, 1),
      TFieldMeta(`message`, 2)
    ]);
  }

  struct HolyMoley {
    OneOfEach[] big;
    HashSet!(string[]) contain;
    Bonk[][string] bonks;

    mixin TStructHelpers!([
      TFieldMeta(`big`, 1),
      TFieldMeta(`contain`, 2),
      TFieldMeta(`bonks`, 3)
    ]);
  }

  static assert(structIdlString!WithoutMeta ==
`struct WithoutMeta {
  -1: string a,
  -2: i32 b,
}
`);

import std.algorithm;
  static assert(structIdlString!WithDefaults.startsWith(
`struct WithDefaults {
  -1: string a = "asdf",
  -2: double b = 3.141`));

  static assert(structIdlString!WithDefaults.endsWith(
`1: WithoutMeta c = {a: "foo", b: 3, },
}
`));

  static assert(structIdlString!OneOfEach ==
`struct OneOfEach {
  1: bool im_true,
  2: bool im_false,
  3: byte a_bite = 127,
  4: i16 integer16 = 32767,
  5: i32 integer32,
  6: i64 integer64 = 10000000000,
  7: double double_precision,
  8: string some_characters,
  9: string zomg_unicode,
  10: bool what_who,
  11: string base64,
  12: list<byte> byte_list = [1, 2, 3, ],
  13: list<i16> i16_list = [1, 2, 3, ],
  14: list<i64> i64_list = [1, 2, 3, ],
}
`);

  static assert(structIdlString!Bonk ==
`struct Bonk {
  1: i32 type,
  2: string message,
}
`);

  static assert(structIdlString!HolyMoley ==
`struct HolyMoley {
  1: list<OneOfEach> big,
  2: set<list<string>> contain,
  3: map<string, list<Bonk>> bonks,
}
`);
}

version (unittest) {
  class ExceptionWithAMap : TException {
    string blah;
    string[string] map_field;

    mixin TStructHelpers!([
      TFieldMeta(`blah`, 1),
      TFieldMeta(`map_field`, 2)
    ]);
  }

  interface Srv {
    void voidMethod();
    int primitiveMethod();
    OneOfEach structMethod();
    void methodWithDefaultArgs(int something);
    void onewayMethod();
    void exceptionMethod();

    alias .ExceptionWithAMap ExceptionWithAMap;

    enum methodMeta = [
      TMethodMeta(`methodWithDefaultArgs`,
        [TParamMeta(`something`, 1, q{2})]
      ),
      TMethodMeta(`onewayMethod`,
        [],
        [],
        TMethodType.ONEWAY
      ),
      TMethodMeta(`exceptionMethod`,
        [],
        [
          TExceptionMeta("a", 1, "ExceptionWithAMap"),
          TExceptionMeta("b", 2, "ExceptionWithAMap")
        ]
      )
    ];
  }

  interface ChildSrv : Srv {
    int childMethod(int arg);
  }

  static assert(idlString!ChildSrv ==
`exception ExceptionWithAMap {
  1: string blah,
  2: map<string, string> map_field,
}

struct OneOfEach {
  1: bool im_true,
  2: bool im_false,
  3: byte a_bite = 127,
  4: i16 integer16 = 32767,
  5: i32 integer32,
  6: i64 integer64 = 10000000000,
  7: double double_precision,
  8: string some_characters,
  9: string zomg_unicode,
  10: bool what_who,
  11: string base64,
  12: list<byte> byte_list = [1, 2, 3, ],
  13: list<i16> i16_list = [1, 2, 3, ],
  14: list<i64> i64_list = [1, 2, 3, ],
}

service Srv {
  void voidMethod(),
  i32 primitiveMethod(),
  OneOfEach structMethod(),
  void methodWithDefaultArgs(1: i32 something = 2, ),
  oneway void onewayMethod(),
  void exceptionMethod() throws (1: ExceptionWithAMap a, 2: ExceptionWithAMap b, ),
}

service ChildSrv extends Srv {
  i32 childMethod(-1: i32 param1, ),
}
`);
}
