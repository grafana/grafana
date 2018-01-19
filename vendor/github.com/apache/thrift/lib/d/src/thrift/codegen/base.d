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
 * Code generation metadata and templates used for implementing struct
 * serialization.
 *
 * Many templates can be customized using field meta data, which is read from
 * a manifest constant member of the given type called fieldMeta (if present),
 * and is concatenated with the elements from the optional fieldMetaData
 * template alias parameter.
 *
 * Some code generation templates take account of the optional TVerboseCodegen
 * version declaration, which causes warning messages to be emitted if no
 * metadata for a field/method has been found and the default behavior is
 * used instead. If this version is not defined, the templates just silently
 * behave like the Thrift compiler does in this situation, i.e. automatically
 * assign negative ids (starting at -1) for fields and assume TReq.AUTO as
 * requirement level.
 */
// Implementation note: All the templates in here taking a field metadata
// parameter should ideally have a constraint that restricts the alias to
// TFieldMeta[]-typed values, but the is() expressions seems to always fail.
module thrift.codegen.base;

import std.algorithm : find;
import std.array : empty, front;
import std.conv : to;
import std.exception : enforce;
import std.traits : BaseTypeTuple, isPointer, isSomeFunction, PointerTarget,
  ReturnType;
import thrift.base;
import thrift.internal.codegen;
import thrift.protocol.base;
import thrift.util.hashset;

/*
 * Thrift struct/service meta data, which is used to store information from
 * the interface definition files not representable in plain D, i.e. field
 * requirement levels, Thrift field IDs, etc.
 */

/**
 * Struct field requirement levels.
 */
enum TReq {
  /// Detect the requiredness from the field type: if it is nullable, treat
  /// the field as optional, if it is non-nullable, treat the field as
  /// required. This is the default used for handling structs not generated
  /// from an IDL file, and never emitted by the Thrift compiler. TReq.AUTO
  /// shouldn't be specified explicitly.
  // Implementation note: thrift.codegen templates use
  // thrift.internal.codegen.memberReq to resolve AUTO to REQUIRED/OPTIONAL
  // instead of handling it directly.
  AUTO,

  /// The field is treated as optional when deserializing/receiving the struct
  /// and as required when serializing/sending. This is the Thrift default if
  /// neither "required" nor "optional" are specified in the IDL file.
  OPT_IN_REQ_OUT,

  /// The field is optional.
  OPTIONAL,

  /// The field is required.
  REQUIRED,

  /// Ignore the struct field when serializing/deserializing.
  IGNORE
}

/**
 * The way how methods are called.
 */
enum TMethodType {
  /// Called in the normal two-way scheme consisting of a request and a
  /// response.
  REGULAR,

  /// A fire-and-forget one-way method, where no response is sent and the
  /// client immediately returns.
  ONEWAY
}

/**
 * Compile-time metadata for a struct field.
 */
struct TFieldMeta {
  /// The name of the field. Used for matching a TFieldMeta with the actual
  /// D struct member during code generation.
  string name;

  /// The (Thrift) id of the field.
  short id;

  /// Whether the field is requried.
  TReq req;

  /// A code string containing a D expression for the default value, if there
  /// is one.
  string defaultValue;
}

/**
 * Compile-time metadata for a service method.
 */
struct TMethodMeta {
  /// The name of the method. Used for matching a TMethodMeta with the actual
  /// method during code generation.
  string name;

  /// Meta information for the parameteres.
  TParamMeta[] params;

  /// Specifies which exceptions can be thrown by the method. All other
  /// exceptions are converted to a TApplicationException instead.
  TExceptionMeta[] exceptions;

  /// The fundamental type of the method.
  TMethodType type;
}

/**
 * Compile-time metadata for a service method parameter.
 */
struct TParamMeta {
  /// The name of the parameter. Contrary to TFieldMeta, it only serves
  /// decorative purposes here.
  string name;

  /// The Thrift id of the parameter in the param struct.
  short id;

  /// A code string containing a D expression for the default value for the
  /// parameter, if any.
  string defaultValue;
}

/**
 * Compile-time metadata for a service method exception annotation.
 */
struct TExceptionMeta {
  /// The name of the exception »return value«. Contrary to TFieldMeta, it
  /// only serves decorative purposes here, as it is only used in code not
  /// visible to processor implementations/service clients.
  string name;

  /// The Thrift id of the exception field in the return value struct.
  short id;

  /// The name of the exception type.
  string type;
}

/**
 * A pair of two TPorotocols. To be used in places where a list of protocols
 * is expected, for specifying different protocols for input and output.
 */
struct TProtocolPair(InputProtocol, OutputProtocol) if (
  isTProtocol!InputProtocol && isTProtocol!OutputProtocol
) {}

/**
 * true if T is a TProtocolPair.
 */
template isTProtocolPair(T) {
  static if (is(T _ == TProtocolPair!(I, O), I, O)) {
    enum isTProtocolPair = true;
  } else {
    enum isTProtocolPair = false;
  }
}

unittest {
  static assert(isTProtocolPair!(TProtocolPair!(TProtocol, TProtocol)));
  static assert(!isTProtocolPair!TProtocol);
}

/**
 * true if T is a TProtocol or a TProtocolPair.
 */
template isTProtocolOrPair(T) {
  enum isTProtocolOrPair = isTProtocol!T || isTProtocolPair!T;
}

unittest {
  static assert(isTProtocolOrPair!TProtocol);
  static assert(isTProtocolOrPair!(TProtocolPair!(TProtocol, TProtocol)));
  static assert(!isTProtocolOrPair!void);
}

/**
 * true if T represents a Thrift service.
 */
template isService(T) {
  enum isService = isBaseService!T || isDerivedService!T;
}

/**
 * true if T represents a Thrift service not derived from another service.
 */
template isBaseService(T) {
  static if(is(T _ == interface) &&
    (!is(T TBases == super) || TBases.length == 0)
  ) {
    enum isBaseService = true;
  } else {
    enum isBaseService = false;
  }
}

/**
 * true if T represents a Thrift service derived from another service.
 */
template isDerivedService(T) {
  static if(is(T _ == interface) &&
    is(T TBases == super) && TBases.length == 1
  ) {
    enum isDerivedService = isService!(TBases[0]);
  } else {
    enum isDerivedService = false;
  }
}

/**
 * For derived services, gets the base service interface.
 */
template BaseService(T) if (isDerivedService!T) {
  alias BaseTypeTuple!T[0] BaseService;
}


/*
 * Code generation templates.
 */

/**
 * Mixin template defining additional helper methods for using a struct with
 * Thrift, and a member called isSetFlags if the struct contains any fields
 * for which an »is set« flag is needed.
 *
 * It can only be used inside structs or Exception classes.
 *
 * For example, consider the following struct definition:
 * ---
 * struct Foo {
 *   string a;
 *   int b;
 *   int c;
 *
 *   mixin TStructHelpers!([
 *     TFieldMeta("a", 1), // Implicitly optional (nullable).
 *     TFieldMeta("b", 2), // Implicitly required (non-nullable).
 *     TFieldMeta("c", 3, TReq.REQUIRED, "4")
 *   ]);
 * }
 * ---
 *
 * TStructHelper adds the following methods to the struct:
 * ---
 * /++
 *  + Sets member fieldName to the given value and marks it as set.
 *  +
 *  + Examples:
 *  + ---
 *  + auto f = Foo();
 *  + f.set!"b"(12345);
 *  + assert(f.isSet!"b");
 *  + ---
 *  +/
 * void set(string fieldName)(MemberType!(This, fieldName) value);
 *
 * /++
 *  + Resets member fieldName to the init property of its type and marks it as
 *  + not set.
 *  +
 *  + Examples:
 *  + ---
 *  + // Set f.b to some value.
 *  + auto f = Foo();
 *  + f.set!"b"(12345);
 *  +
 *  + f.unset!b();
 *  +
 *  + // f.b is now unset again.
 *  + assert(!f.isSet!"b");
 *  + ---
 *  +/
 * void unset(string fieldName)();
 *
 * /++
 *  + Returns whether member fieldName is set.
 *  +
 *  + Examples:
 *  + ---
 *  + auto f = Foo();
 *  + assert(!f.isSet!"b");
 *  + f.set!"b"(12345);
 *  + assert(f.isSet!"b");
 *  + ---
 *  +/
 * bool isSet(string fieldName)() const @property;
 *
 * /++
 *  + Returns a string representation of the struct.
 *  +
 *  + Examples:
 *  + ---
 *  + auto f = Foo();
 *  + f.a = "a string";
 *  + assert(f.toString() == `Foo("a string", 0 (unset), 4)`);
 *  + ---
 *  +/
 * string toString() const;
 *
 * /++
 *  + Deserializes the struct, setting its members to the values read from the
 *  + protocol. Forwards to readStruct(this, proto);
 *  +/
 * void read(Protocol)(Protocol proto) if (isTProtocol!Protocol);
 *
 * /++
 *  + Serializes the struct to the target protocol. Forwards to
 *  + writeStruct(this, proto);
 *  +/
 * void write(Protocol)(Protocol proto) const if (isTProtocol!Protocol);
 * ---
 *
 * Additionally, an opEquals() implementation is provided which simply
 * compares all fields, but disregards the is set struct, if any (the exact
 * signature obviously differs between structs and exception classes). The
 * metadata is stored in a manifest constant called fieldMeta.
 *
 * Note: To set the default values for fields where one has been specified in
 * the field metadata, a parameterless static opCall is generated, because D
 * does not allow parameterless (default) constructors for structs. Thus, be
 * always to use to initialize structs:
 * ---
 * Foo foo; // Wrong!
 * auto foo = Foo(); // Correct.
 * ---
 */
mixin template TStructHelpers(alias fieldMetaData = cast(TFieldMeta[])null) if (
  is(typeof(fieldMetaData) : TFieldMeta[])
) {
  import std.algorithm : any;
  import thrift.codegen.base;
  import thrift.internal.codegen : isNullable, MemberType, mergeFieldMeta,
    FieldNames;
  import thrift.protocol.base : TProtocol, isTProtocol;

  alias typeof(this) This;
  static assert(is(This == struct) || is(This : Exception),
    "TStructHelpers can only be used inside a struct or an Exception class.");

  static if (TIsSetFlags!(This, fieldMetaData).tupleof.length > 0) {
    // If we need to keep isSet flags around, create an instance of the
    // container struct.
    TIsSetFlags!(This, fieldMetaData) isSetFlags;
    enum fieldMeta = fieldMetaData ~ [TFieldMeta("isSetFlags", 0, TReq.IGNORE)];
  } else {
    enum fieldMeta = fieldMetaData;
  }

  void set(string fieldName)(MemberType!(This, fieldName) value) if (
    is(MemberType!(This, fieldName))
  ) {
    __traits(getMember, this, fieldName) = value;
    static if (is(typeof(mixin("this.isSetFlags." ~ fieldName)) : bool)) {
      __traits(getMember, this.isSetFlags, fieldName) = true;
    }
  }

  void unset(string fieldName)() if (is(MemberType!(This, fieldName))) {
    static if (is(typeof(mixin("this.isSetFlags." ~ fieldName)) : bool)) {
      __traits(getMember, this.isSetFlags, fieldName) = false;
    }
    __traits(getMember, this, fieldName) = MemberType!(This, fieldName).init;
  }

  bool isSet(string fieldName)() const @property if (
    is(MemberType!(This, fieldName))
  ) {
    static if (isNullable!(MemberType!(This, fieldName))) {
      return __traits(getMember, this, fieldName) !is null;
    } else static if (is(typeof(mixin("this.isSetFlags." ~ fieldName)) : bool)) {
      return __traits(getMember, this.isSetFlags, fieldName);
    } else {
      // This is a required field, which is always set.
      return true;
    }
  }

  static if (is(This _ == class)) {
    override string toString() const {
      return thriftToStringImpl();
    }

    override bool opEquals(Object other) const {
      auto rhs = cast(This)other;
      if (rhs) {
        return thriftOpEqualsImpl(rhs);
      }

      return (cast()super).opEquals(other);
    }

    override size_t toHash() const {
      return thriftToHashImpl();
    }
  } else {
    string toString() const {
      return thriftToStringImpl();
    }

    bool opEquals(ref const This other) const {
      return thriftOpEqualsImpl(other);
    }

    size_t toHash() const @safe nothrow {
      return thriftToHashImpl();
    }
  }

  private string thriftToStringImpl() const {
    import std.conv : to;
    string result = This.stringof ~ "(";
    mixin({
      string code = "";
      bool first = true;
      foreach (name; FieldNames!(This, fieldMeta)) {
        if (first) {
          first = false;
        } else {
          code ~= "result ~= `, `;\n";
        }
        code ~= "result ~= `" ~ name ~ ": ` ~ to!string(cast()this." ~ name ~ ");\n";
        code ~= "if (!isSet!q{" ~ name ~ "}) {\n";
        code ~= "result ~= ` (unset)`;\n";
        code ~= "}\n";
      }
      return code;
    }());
    result ~= ")";
    return result;
  }

  private bool thriftOpEqualsImpl(const ref This rhs) const {
    foreach (name; FieldNames!This) {
      if (mixin("this." ~ name) != mixin("rhs." ~ name)) return false;
    }
    return true;
  }

  private size_t thriftToHashImpl() const @trusted nothrow {
    size_t hash = 0;
    foreach (i, _; this.tupleof) {
      auto val = this.tupleof[i];
      hash += typeid(val).getHash(&val);
    }
    return hash;
  }

  static if (any!`!a.defaultValue.empty`(mergeFieldMeta!(This, fieldMetaData))) {
    static if (is(This _ == class)) {
      this() {
        mixin(thriftFieldInitCode!(mergeFieldMeta!(This, fieldMetaData))("this"));
      }
    } else {
      // DMD @@BUG@@: Have to use auto here to avoid »no size yet for forward
      // reference« errors.
      static auto opCall() {
        auto result = This.init;
        mixin(thriftFieldInitCode!(mergeFieldMeta!(This, fieldMetaData))("result"));
        return result;
      }
    }
  }

  void read(Protocol)(Protocol proto) if (isTProtocol!Protocol) {
    // Need to explicitly specify fieldMetaData here, since it isn't already
    // picked up in some situations (e.g. the TArgs struct for methods with
    // multiple parameters in async_test_servers) otherwise. Due to a DMD
    // @@BUG@@, we need to explicitly specify the other template parameters
    // as well.
    readStruct!(This, Protocol, fieldMetaData, false)(this, proto);
  }

  void write(Protocol)(Protocol proto) const if (isTProtocol!Protocol) {
    writeStruct!(This, Protocol, fieldMetaData, false)(this, proto);
  }
}

// DMD @@BUG@@: Having this inside TStructHelpers leads to weird lookup errors
// (e.g. for std.arry.empty).
string thriftFieldInitCode(alias fieldMeta)(string thisName) {
  string code = "";
  foreach (field; fieldMeta) {
    if (field.defaultValue.empty) continue;
    code ~= thisName ~ "." ~ field.name ~ " = " ~ field.defaultValue ~ ";\n";
  }
  return code;
}

unittest {
  // Cannot make this nested in the unittest block due to a »no size yet for
  // forward reference« error.
  static struct Foo {
    string a;
    int b;
    int c;

    mixin TStructHelpers!([
      TFieldMeta("a", 1),
      TFieldMeta("b", 2, TReq.OPT_IN_REQ_OUT),
      TFieldMeta("c", 3, TReq.REQUIRED, "4")
    ]);
  }

  auto f = Foo();

  f.set!"b"(12345);
  assert(f.isSet!"b");
  f.unset!"b"();
  assert(!f.isSet!"b");
  f.set!"b"(12345);
  assert(f.isSet!"b");
  f.unset!"b"();

  f.a = "a string";
  assert(f.toString() == `Foo(a: a string, b: 0 (unset), c: 4)`);
}


/**
 * Generates an eponymous struct with boolean flags for the non-required
 * non-nullable fields of T.
 *
 * Nullable fields are just set to null to signal »not set«, so no flag is
 * emitted for them, even if they are optional.
 *
 * In most cases, you do not want to use this directly, but via TStructHelpers
 * instead.
 */
template TIsSetFlags(T, alias fieldMetaData) {
  mixin({
    string code = "struct TIsSetFlags {\n";
    foreach (meta; fieldMetaData) {
      code ~= "static if (!is(MemberType!(T, `" ~ meta.name ~ "`))) {\n";
      code ~= q{
        static assert(false, "Field '" ~ meta.name ~
          "' referenced in metadata not present in struct '" ~ T.stringof ~ "'.");
      };
      code ~= "}";
      if (meta.req == TReq.OPTIONAL || meta.req == TReq.OPT_IN_REQ_OUT) {
        code ~= "else static if (!isNullable!(MemberType!(T, `" ~ meta.name ~ "`))) {\n";
        code ~= "  bool " ~ meta.name ~ ";\n";
        code ~= "}\n";
      }
    }
    code ~= "}";
    return code;
  }());
}

/**
 * Deserializes a Thrift struct from a protocol.
 *
 * Using the Protocol template parameter, the concrete TProtocol to use can be
 * be specified. If the pointerStruct parameter is set to true, the struct
 * fields are expected to be pointers to the actual data. This is used
 * internally (combined with TPResultStruct) and usually should not be used in
 * user code.
 *
 * This is a free function to make it possible to read exisiting structs from
 * the wire without altering their definitions.
 */
void readStruct(T, Protocol, alias fieldMetaData = cast(TFieldMeta[])null,
  bool pointerStruct = false)(auto ref T s, Protocol p) if (isTProtocol!Protocol)
{
  mixin({
    string code;

    // Check that all fields for which there is meta info are actually in the
    // passed struct type.
    foreach (field; mergeFieldMeta!(T, fieldMetaData)) {
      code ~= "static assert(is(MemberType!(T, `" ~ field.name ~ "`)));\n";
    }

    // Returns the code string for reading a value of type F off the wire and
    // assigning it to v. The level parameter is used to make sure that there
    // are no conflicting variable names on recursive calls.
    string readValueCode(ValueType)(string v, size_t level = 0) {
      // Some non-ambigous names to use (shadowing is not allowed in D).
      immutable i = "i" ~ to!string(level);
      immutable elem = "elem" ~ to!string(level);
      immutable key = "key" ~ to!string(level);
      immutable list = "list" ~ to!string(level);
      immutable map = "map" ~ to!string(level);
      immutable set = "set" ~ to!string(level);
      immutable value = "value" ~ to!string(level);

      alias FullyUnqual!ValueType F;

      static if (is(F == bool)) {
        return v ~ " = p.readBool();";
      } else static if (is(F == byte)) {
        return v ~ " = p.readByte();";
      } else static if (is(F == double)) {
        return v ~ " = p.readDouble();";
      } else static if (is(F == short)) {
        return v ~ " = p.readI16();";
      } else static if (is(F == int)) {
        return v ~ " = p.readI32();";
      } else static if (is(F == long)) {
        return v ~ " = p.readI64();";
      } else static if (is(F : string)) {
        return v ~ " = p.readString();";
      } else static if (is(F == enum)) {
        return v ~ " = cast(typeof(" ~ v ~ "))p.readI32();";
      } else static if (is(F _ : E[], E)) {
        return "{\n" ~
          "auto " ~ list ~ " = p.readListBegin();\n" ~
          // TODO: Check element type here?
          v ~ " = new typeof(" ~ v ~ "[0])[" ~ list ~ ".size];\n" ~
          "foreach (" ~ i ~ "; 0 .. " ~ list ~ ".size) {\n" ~
            readValueCode!E(v ~ "[" ~ i ~ "]", level + 1) ~ "\n" ~
          "}\n" ~
          "p.readListEnd();\n" ~
        "}";
      } else static if (is(F _ : V[K], K, V)) {
        return "{\n" ~
          "auto " ~ map ~ " = p.readMapBegin();" ~
          v ~ " = null;\n" ~
          // TODO: Check key/value types here?
          "foreach (" ~ i ~ "; 0 .. " ~ map ~ ".size) {\n" ~
            "FullyUnqual!(typeof(" ~ v ~ ".keys[0])) " ~ key ~ ";\n" ~
            readValueCode!K(key, level + 1) ~ "\n" ~
            "typeof(" ~ v ~ ".values[0]) " ~ value ~ ";\n" ~
            readValueCode!V(value, level + 1) ~ "\n" ~
            v ~ "[cast(typeof(" ~ v ~ ".keys[0]))" ~ key ~ "] = " ~ value ~ ";\n" ~
          "}\n" ~
          "p.readMapEnd();" ~
        "}";
      } else static if (is(F _ : HashSet!(E), E)) {
        return "{\n" ~
          "auto " ~ set ~ " = p.readSetBegin();" ~
          // TODO: Check element type here?
          v ~ " = new typeof(" ~ v ~ ")();\n" ~
          "foreach (" ~ i ~ "; 0 .. " ~ set ~ ".size) {\n" ~
            "typeof(" ~ v ~ "[][0]) " ~ elem ~ ";\n" ~
            readValueCode!E(elem, level + 1) ~ "\n" ~
            v ~ " ~= " ~ elem ~ ";\n" ~
          "}\n" ~
          "p.readSetEnd();" ~
        "}";
      } else static if (is(F == struct) || is(F : TException)) {
        static if (is(F == struct)) {
          auto result = v ~ " = typeof(" ~ v ~ ")();\n";
        } else {
          auto result = v ~ " = new typeof(" ~ v ~ ")();\n";
        }

        static if (__traits(compiles, F.init.read(TProtocol.init))) {
          result ~= v ~ ".read(p);";
        } else {
          result ~= "readStruct(" ~ v ~ ", p);";
        }
        return result;
      } else {
        static assert(false, "Cannot represent type in Thrift: " ~ F.stringof);
      }
    }

    string readFieldCode(FieldType)(string name, short id, TReq req) {
      static if (pointerStruct && isPointer!FieldType) {
        immutable v = "(*s." ~ name ~ ")";
        alias PointerTarget!FieldType F;
      } else {
        immutable v = "s." ~ name;
        alias FieldType F;
      }

      string code = "case " ~ to!string(id) ~ ":\n";
      code ~= "if (f.type == " ~ dToTTypeString!F ~ ") {\n";
      code ~= readValueCode!F(v) ~ "\n";
      if (req == TReq.REQUIRED) {
        // For required fields, set the corresponding local isSet variable.
        code ~= "isSet_" ~ name ~ " = true;\n";
      } else if (!isNullable!F){
        code ~= "s.isSetFlags." ~ name ~ " = true;\n";
      }
      code ~= "} else skip(p, f.type);\n";
      code ~= "break;\n";
      return code;
    }

    // Code for the local boolean flags used to make sure required fields have
    // been found.
    string isSetFlagCode = "";

    // Code for checking whether the flags for the required fields are true.
    string isSetCheckCode = "";

    /// Code for the case statements storing the fields to the result struct.
    string readMembersCode = "";

    // The last automatically assigned id – fields with no meta information
    // are assigned (in lexical order) descending negative ids, starting with
    // -1, just like the Thrift compiler does.
    short lastId;

    foreach (name; FieldNames!T) {
      enum req = memberReq!(T, name, fieldMetaData);
      if (req == TReq.REQUIRED) {
        // For required fields, generate local bool flags to keep track
        // whether the field has been encountered.
        immutable n = "isSet_" ~ name;
        isSetFlagCode ~= "bool " ~ n ~ ";\n";
        isSetCheckCode ~= "enforce(" ~ n ~ ", new TProtocolException(" ~
          "`Required field '" ~ name ~ "' not found in serialized data`, " ~
          "TProtocolException.Type.INVALID_DATA));\n";
      }

      enum meta = find!`a.name == b`(mergeFieldMeta!(T, fieldMetaData), name);
      static if (meta.empty) {
        --lastId;
        version (TVerboseCodegen) {
          code ~= "pragma(msg, `[thrift.codegen.base.readStruct] Warning: No " ~
            "meta information for field '" ~ name ~ "' in struct '" ~
            T.stringof ~ "'. Assigned id: " ~ to!string(lastId) ~ ".`);\n";
        }
        readMembersCode ~= readFieldCode!(MemberType!(T, name))(
          name, lastId, req);
      } else static if (req != TReq.IGNORE) {
        readMembersCode ~= readFieldCode!(MemberType!(T, name))(
          name, meta.front.id, req);
      }
    }

    code ~= isSetFlagCode;
    code ~= "p.readStructBegin();\n";
    code ~= "while (true) {\n";
    code ~= "auto f = p.readFieldBegin();\n";
    code ~= "if (f.type == TType.STOP) break;\n";
    code ~= "switch(f.id) {\n";
    code ~= readMembersCode;
    code ~= "default: skip(p, f.type);\n";
    code ~= "}\n";
    code ~= "p.readFieldEnd();\n";
    code ~= "}\n";
    code ~= "p.readStructEnd();\n";
    code ~= isSetCheckCode;

    return code;
  }());
}

/**
 * Serializes a struct to the target protocol.
 *
 * Using the Protocol template parameter, the concrete TProtocol to use can be
 * be specified. If the pointerStruct parameter is set to true, the struct
 * fields are expected to be pointers to the actual data. This is used
 * internally (combined with TPargsStruct) and usually should not be used in
 * user code.
 *
 * This is a free function to make it possible to read exisiting structs from
 * the wire without altering their definitions.
 */
void writeStruct(T, Protocol, alias fieldMetaData = cast(TFieldMeta[])null,
  bool pointerStruct = false) (const T s, Protocol p) if (isTProtocol!Protocol)
{
  mixin({
    // Check that all fields for which there is meta info are actually in the
    // passed struct type.
    string code = "";
    foreach (field; mergeFieldMeta!(T, fieldMetaData)) {
      code ~= "static assert(is(MemberType!(T, `" ~ field.name ~ "`)));\n";
    }

    // Check that required nullable members are non-null.
    // WORKAROUND: To stop LDC from emitting the manifest constant »meta« below
    // into the writeStruct function body this is inside the string mixin
    // block – the code wouldn't depend on it (this is an LDC bug, and because
    // of it a new array would be allocated on each method invocation at runtime).
    foreach (name; StaticFilter!(
      Compose!(isNullable, PApply!(MemberType, T)),
      FieldNames!T
    )) {
       static if (memberReq!(T, name, fieldMetaData) == TReq.REQUIRED) {
         code ~= "enforce(__traits(getMember, s, `" ~ name ~ "`) !is null,
           new TException(`Required field '" ~ name ~ "' is null.`));\n";
       }
    }

    return code;
  }());

  p.writeStructBegin(TStruct(T.stringof));
  mixin({
    string writeValueCode(ValueType)(string v, size_t level = 0) {
      // Some non-ambigous names to use (shadowing is not allowed in D).
      immutable elem = "elem" ~ to!string(level);
      immutable key = "key" ~ to!string(level);
      immutable value = "value" ~ to!string(level);

      alias FullyUnqual!ValueType F;
      static if (is(F == bool)) {
        return "p.writeBool(" ~ v ~ ");";
      } else static if (is(F == byte)) {
        return "p.writeByte(" ~ v ~ ");";
      } else static if (is(F == double)) {
        return "p.writeDouble(" ~ v ~ ");";
      } else static if (is(F == short)) {
        return "p.writeI16(" ~ v ~ ");";
      } else static if (is(F == int)) {
        return "p.writeI32(" ~ v ~ ");";
      } else static if (is(F == long)) {
        return "p.writeI64(" ~ v ~ ");";
      } else static if (is(F : string)) {
        return "p.writeString(" ~ v ~ ");";
      } else static if (is(F == enum)) {
        return "p.writeI32(cast(int)" ~ v ~ ");";
      } else static if (is(F _ : E[], E)) {
        return "p.writeListBegin(TList(" ~ dToTTypeString!E ~ ", " ~ v ~
          ".length));\n" ~
          "foreach (" ~ elem ~ "; " ~ v ~ ") {\n" ~
            writeValueCode!E(elem, level + 1) ~ "\n" ~
          "}\n" ~
          "p.writeListEnd();";
      } else static if (is(F _ : V[K], K, V)) {
        return "p.writeMapBegin(TMap(" ~ dToTTypeString!K ~ ", " ~
          dToTTypeString!V ~ ", " ~ v ~ ".length));\n" ~
          "foreach (" ~ key ~ ", " ~ value ~ "; " ~ v ~ ") {\n" ~
            writeValueCode!K(key, level + 1) ~ "\n" ~
            writeValueCode!V(value, level + 1) ~ "\n" ~
          "}\n" ~
          "p.writeMapEnd();";
      } else static if (is(F _ : HashSet!E, E)) {
        return "p.writeSetBegin(TSet(" ~ dToTTypeString!E ~ ", " ~ v ~
          ".length));\n" ~
          "foreach (" ~ elem ~ "; " ~ v ~ "[]) {\n" ~
            writeValueCode!E(elem, level + 1) ~ "\n" ~
          "}\n" ~
          "p.writeSetEnd();";
      } else static if (is(F == struct) || is(F : TException)) {
        static if (__traits(compiles, F.init.write(TProtocol.init))) {
          return v ~ ".write(p);";
        } else {
          return "writeStruct(" ~ v ~ ", p);";
        }
      } else {
        static assert(false, "Cannot represent type in Thrift: " ~ F.stringof);
      }
    }

    string writeFieldCode(FieldType)(string name, short id, TReq req) {
      string code;
      if (!pointerStruct && req == TReq.OPTIONAL) {
        code ~= "if (s.isSet!`" ~ name ~ "`) {\n";
      }

      static if (pointerStruct && isPointer!FieldType) {
        immutable v = "(*s." ~ name ~ ")";
        alias PointerTarget!FieldType F;
      } else {
        immutable v = "s." ~ name;
        alias FieldType F;
      }

      code ~= "p.writeFieldBegin(TField(`" ~ name ~ "`, " ~ dToTTypeString!F ~
        ", " ~ to!string(id) ~ "));\n";
      code ~= writeValueCode!F(v) ~ "\n";
      code ~= "p.writeFieldEnd();\n";

      if (!pointerStruct && req == TReq.OPTIONAL) {
        code ~= "}\n";
      }
      return code;
    }

    // The last automatically assigned id – fields with no meta information
    // are assigned (in lexical order) descending negative ids, starting with
    // -1, just like the Thrift compiler does.
    short lastId;

    string code = "";
    foreach (name; FieldNames!T) {
      alias MemberType!(T, name) F;
      enum req = memberReq!(T, name, fieldMetaData);
      enum meta = find!`a.name == b`(mergeFieldMeta!(T, fieldMetaData), name);
      if (meta.empty) {
        --lastId;
        version (TVerboseCodegen) {
          code ~= "pragma(msg, `[thrift.codegen.base.writeStruct] Warning: No " ~
            "meta information for field '" ~ name ~ "' in struct '" ~
            T.stringof ~ "'. Assigned id: " ~ to!string(lastId) ~ ".`);\n";
        }
        code ~= writeFieldCode!F(name, lastId, req);
      } else if (req != TReq.IGNORE) {
        code ~= writeFieldCode!F(name, meta.front.id, req);
      }
    }

    return code;
  }());
  p.writeFieldStop();
  p.writeStructEnd();
}

unittest {
  // Ensure that the generated code at least compiles for the basic field type
  // combinations. Functionality checks are covered by the rest of the test
  // suite.

  static struct Test {
    // Non-nullable.
    int a1;
    int a2;
    int a3;
    int a4;

    // Nullable.
    string b1;
    string b2;
    string b3;
    string b4;

    mixin TStructHelpers!([
      TFieldMeta("a1", 1, TReq.OPT_IN_REQ_OUT),
      TFieldMeta("a2", 2, TReq.OPTIONAL),
      TFieldMeta("a3", 3, TReq.REQUIRED),
      TFieldMeta("a4", 4, TReq.IGNORE),
      TFieldMeta("b1", 5, TReq.OPT_IN_REQ_OUT),
      TFieldMeta("b2", 6, TReq.OPTIONAL),
      TFieldMeta("b3", 7, TReq.REQUIRED),
      TFieldMeta("b4", 8, TReq.IGNORE),
    ]);
  }

  static assert(__traits(compiles, { Test t; t.read(cast(TProtocol)null); }));
  static assert(__traits(compiles, { Test t; t.write(cast(TProtocol)null); }));
}

// Ensure opEquals and toHash consistency.
unittest {
  struct TestEquals {
    int a1;

    mixin TStructHelpers!([
      TFieldMeta("a1", 1, TReq.OPT_IN_REQ_OUT),
    ]);
  }

  TestEquals a, b;
  assert(a == b);
  assert(a.toHash() == b.toHash());

  a.a1 = 42;
  assert(a != b);
  assert(a.toHash() != b.toHash());

  b.a1 = 42;
  assert(a == b);
  assert(a.toHash() == b.toHash());
}

private {
  /*
   * Returns a D code string containing the matching TType value for a passed
   * D type, e.g. dToTTypeString!byte == "TType.BYTE".
   */
  template dToTTypeString(T) {
    static if (is(FullyUnqual!T == bool)) {
      enum dToTTypeString = "TType.BOOL";
    } else static if (is(FullyUnqual!T == byte)) {
      enum dToTTypeString = "TType.BYTE";
    } else static if (is(FullyUnqual!T == double)) {
      enum dToTTypeString = "TType.DOUBLE";
    } else static if (is(FullyUnqual!T == short)) {
      enum dToTTypeString = "TType.I16";
    } else static if (is(FullyUnqual!T == int)) {
      enum dToTTypeString = "TType.I32";
    } else static if (is(FullyUnqual!T == long)) {
      enum dToTTypeString = "TType.I64";
    } else static if (is(FullyUnqual!T : string)) {
      enum dToTTypeString = "TType.STRING";
    } else static if (is(FullyUnqual!T == enum)) {
      enum dToTTypeString = "TType.I32";
    } else static if (is(FullyUnqual!T _ : U[], U)) {
      enum dToTTypeString = "TType.LIST";
    } else static if (is(FullyUnqual!T _ : V[K], K, V)) {
      enum dToTTypeString = "TType.MAP";
    } else static if (is(FullyUnqual!T _ : HashSet!E, E)) {
      enum dToTTypeString = "TType.SET";
    } else static if (is(FullyUnqual!T == struct)) {
      enum dToTTypeString = "TType.STRUCT";
    } else static if (is(FullyUnqual!T : TException)) {
      enum dToTTypeString = "TType.STRUCT";
    } else {
      static assert(false, "Cannot represent type in Thrift: " ~ T.stringof);
    }
  }
}
