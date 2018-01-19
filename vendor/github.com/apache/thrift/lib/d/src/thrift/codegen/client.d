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
module thrift.codegen.client;

import std.algorithm : find;
import std.array : empty, front;
import std.conv : to;
import std.traits : isSomeFunction, ParameterStorageClass,
  ParameterStorageClassTuple, ParameterTypeTuple, ReturnType;
import thrift.codegen.base;
import thrift.internal.codegen;
import thrift.internal.ctfe;
import thrift.protocol.base;

/**
 * Thrift service client, which implements an interface by synchronously
 * calling a server over a TProtocol.
 *
 * TClientBase simply extends Interface with generic input/output protocol
 * properties to serve as a supertype for all TClients for the same service,
 * which might be instantiated with different concrete protocol types (there
 * is no covariance for template type parameters). If Interface is derived
 * from another interface BaseInterface, it also extends
 * TClientBase!BaseInterface.
 *
 * TClient is the class that actually implements TClientBase. Just as
 * TClientBase, it is also derived from TClient!BaseInterface for inheriting
 * services.
 *
 * TClient takes two optional template arguments which can be used for
 * specifying the actual TProtocol implementation used for optimization
 * purposes, as virtual calls can completely be eliminated then. If
 * OutputProtocol is not specified, it is assumed to be the same as
 * InputProtocol. The protocol properties defined by TClientBase are exposed
 * with their concrete type (return type covariance).
 *
 * In addition to implementing TClientBase!Interface, TClient offers the
 * following constructors:
 * ---
 * this(InputProtocol iprot, OutputProtocol oprot);
 * // Only if is(InputProtocol == OutputProtocol), to use the same protocol
 * // for both input and output:
 * this(InputProtocol prot);
 * ---
 *
 * The sequence id of the method calls starts at zero and is automatically
 * incremented.
 */
interface TClientBase(Interface) if (isBaseService!Interface) : Interface {
  /**
   * The input protocol used by the client.
   */
  TProtocol inputProtocol() @property;

  /**
   * The output protocol used by the client.
   */
  TProtocol outputProtocol() @property;
}

/// Ditto
interface TClientBase(Interface) if (isDerivedService!Interface) :
  TClientBase!(BaseService!Interface), Interface {}

/// Ditto
template TClient(Interface, InputProtocol = TProtocol, OutputProtocol = void) if (
  isService!Interface && isTProtocol!InputProtocol &&
  (isTProtocol!OutputProtocol || is(OutputProtocol == void))
) {
  mixin({
    static if (isDerivedService!Interface) {
      string code = "class TClient : TClient!(BaseService!Interface, " ~
        "InputProtocol, OutputProtocol), TClientBase!Interface {\n";
      code ~= q{
        this(IProt iprot, OProt oprot) {
          super(iprot, oprot);
        }

        static if (is(IProt == OProt)) {
          this(IProt prot) {
            super(prot);
          }
        }

        // DMD @@BUG@@: If these are not present in this class (would be)
        // inherited anyway, »not implemented« errors are raised.
        override IProt inputProtocol() @property {
          return super.inputProtocol;
        }
        override OProt outputProtocol() @property {
          return super.outputProtocol;
        }
      };
    } else {
      string code = "class TClient : TClientBase!Interface {";
      code ~= q{
        alias InputProtocol IProt;
        static if (isTProtocol!OutputProtocol) {
          alias OutputProtocol OProt;
        } else {
          static assert(is(OutputProtocol == void));
          alias InputProtocol OProt;
        }

        this(IProt iprot, OProt oprot) {
          iprot_ = iprot;
          oprot_ = oprot;
        }

        static if (is(IProt == OProt)) {
          this(IProt prot) {
            this(prot, prot);
          }
        }

        IProt inputProtocol() @property {
          return iprot_;
        }

        OProt outputProtocol() @property {
          return oprot_;
        }

        protected IProt iprot_;
        protected OProt oprot_;
        protected int seqid_;
      };
    }

    foreach (methodName; __traits(derivedMembers, Interface)) {
      static if (isSomeFunction!(mixin("Interface." ~ methodName))) {
        bool methodMetaFound;
        TMethodMeta methodMeta;
        static if (is(typeof(Interface.methodMeta) : TMethodMeta[])) {
          enum meta = find!`a.name == b`(Interface.methodMeta, methodName);
          if (!meta.empty) {
            methodMetaFound = true;
            methodMeta = meta.front;
          }
        }

        // Generate the code for sending.
        string[] paramList;
        string paramAssignCode;
        foreach (i, _; ParameterTypeTuple!(mixin("Interface." ~ methodName))) {
          // Use the param name speficied in the meta information if any –
          // just cosmetics in this case.
          string paramName;
          if (methodMetaFound && i < methodMeta.params.length) {
            paramName = methodMeta.params[i].name;
          } else {
            paramName = "param" ~ to!string(i + 1);
          }

          immutable storage = ParameterStorageClassTuple!(
            mixin("Interface." ~ methodName))[i];
          paramList ~= ((storage & ParameterStorageClass.ref_) ? "ref " : "") ~
            "ParameterTypeTuple!(Interface." ~ methodName ~ ")[" ~
            to!string(i) ~ "] " ~ paramName;
          paramAssignCode ~= "args." ~ paramName ~ " = &" ~ paramName ~ ";\n";
        }
        code ~= "ReturnType!(Interface." ~ methodName ~ ") " ~ methodName ~
          "(" ~ ctfeJoin(paramList) ~ ") {\n";

        code ~= "immutable methodName = `" ~ methodName ~ "`;\n";

        immutable paramStructType =
          "TPargsStruct!(Interface, `" ~ methodName ~ "`)";
        code ~= paramStructType ~ " args = " ~ paramStructType ~ "();\n";
        code ~= paramAssignCode;
        code ~= "oprot_.writeMessageBegin(TMessage(`" ~ methodName ~ "`, ";
        code ~= ((methodMetaFound && methodMeta.type == TMethodType.ONEWAY)
                 ? "TMessageType.ONEWAY" : "TMessageType.CALL");
        code ~= ", ++seqid_));\n";
        code ~= "args.write(oprot_);\n";
        code ~= "oprot_.writeMessageEnd();\n";
        code ~= "oprot_.transport.flush();\n";

        // If this is not a oneway method, generate the receiving code.
        if (!methodMetaFound || methodMeta.type != TMethodType.ONEWAY) {
          code ~= "TPresultStruct!(Interface, `" ~ methodName ~ "`) result;\n";

          if (!is(ReturnType!(mixin("Interface." ~ methodName)) == void)) {
            code ~= "ReturnType!(Interface." ~ methodName ~ ") _return;\n";
            code ~= "result.success = &_return;\n";
          }

          // TODO: The C++ implementation checks for matching method name here,
          // should we do as well?
          code ~= q{
            auto msg = iprot_.readMessageBegin();
            scope (exit) {
              iprot_.readMessageEnd();
              iprot_.transport.readEnd();
            }

            if (msg.type == TMessageType.EXCEPTION) {
              auto x = new TApplicationException(null);
              x.read(iprot_);
              iprot_.transport.readEnd();
              throw x;
            }
            if (msg.type != TMessageType.REPLY) {
              skip(iprot_, TType.STRUCT);
              iprot_.transport.readEnd();
            }
            if (msg.seqid != seqid_) {
              throw new TApplicationException(
                methodName ~ " failed: Out of sequence response.",
                TApplicationException.Type.BAD_SEQUENCE_ID
              );
            }
            result.read(iprot_);
          };

          if (methodMetaFound) {
            foreach (e; methodMeta.exceptions) {
              code ~= "if (result.isSet!`" ~ e.name ~ "`) throw result." ~
                e.name ~ ";\n";
            }
          }

          if (!is(ReturnType!(mixin("Interface." ~ methodName)) == void)) {
            code ~= q{
              if (result.isSet!`success`) return _return;
              throw new TApplicationException(
                methodName ~ " failed: Unknown result.",
                TApplicationException.Type.MISSING_RESULT
              );
            };
          }
        }
        code ~= "}\n";
      }
    }

    code ~= "}\n";
    return code;
  }());
}

/**
 * TClient construction helper to avoid having to explicitly specify
 * the protocol types, i.e. to allow the constructor being called using IFTI
 * (see $(DMDBUG 6082, D Bugzilla enhancement requet 6082)).
 */
TClient!(Interface, Prot) tClient(Interface, Prot)(Prot prot) if (
  isService!Interface && isTProtocol!Prot
) {
  return new TClient!(Interface, Prot)(prot);
}

/// Ditto
TClient!(Interface, IProt, Oprot) tClient(Interface, IProt, OProt)
  (IProt iprot, OProt oprot) if (
  isService!Interface && isTProtocol!IProt && isTProtocol!OProt
) {
  return new TClient!(Interface, IProt, OProt)(iprot, oprot);
}

/**
 * Represents the arguments of a Thrift method call, as pointers to the (const)
 * parameter type to avoid copying.
 *
 * There should usually be no reason to use this struct directly without the
 * help of TClient, but it is documented publicly to help debugging in case
 * of CTFE errors.
 *
 * Consider this example:
 * ---
 * interface Foo {
 *   int bar(string a, bool b);
 *
 *   enum methodMeta = [
 *     TMethodMeta("bar", [TParamMeta("a", 1), TParamMeta("b", 2)])
 *   ];
 * }
 *
 * alias TPargsStruct!(Foo, "bar") FooBarPargs;
 * ---
 *
 * The definition of FooBarPargs is equivalent to (ignoring the necessary
 * metadata to assign the field IDs):
 * ---
 * struct FooBarPargs {
 *   const(string)* a;
 *   const(bool)* b;
 *
 *   void write(Protocol)(Protocol proto) const if (isTProtocol!Protocol);
 * }
 * ---
 */
template TPargsStruct(Interface, string methodName) {
  static assert(is(typeof(mixin("Interface." ~ methodName))),
    "Could not find method '" ~ methodName ~ "' in '" ~ Interface.stringof ~ "'.");
  mixin({
    bool methodMetaFound;
    TMethodMeta methodMeta;
    static if (is(typeof(Interface.methodMeta) : TMethodMeta[])) {
      auto meta = find!`a.name == b`(Interface.methodMeta, methodName);
      if (!meta.empty) {
        methodMetaFound = true;
        methodMeta = meta.front;
      }
    }

    string memberCode;
    string[] fieldMetaCodes;
    foreach (i, _; ParameterTypeTuple!(mixin("Interface." ~ methodName))) {
      // If we have no meta information, just use param1, param2, etc. as
      // field names, it shouldn't really matter anyway. 1-based »indexing«
      // is used to match the common scheme in the Thrift world.
      string memberId;
      string memberName;
      if (methodMetaFound && i < methodMeta.params.length) {
        memberId = to!string(methodMeta.params[i].id);
        memberName = methodMeta.params[i].name;
      } else {
        memberId = to!string(i + 1);
        memberName = "param" ~ to!string(i + 1);
      }

      // Workaround for DMD @@BUG@@ 6056: make an intermediary alias for the
      // parameter type, and declare the member using const(memberNameType)*.
      memberCode ~= "alias ParameterTypeTuple!(Interface." ~ methodName ~
        ")[" ~ to!string(i) ~ "] " ~ memberName ~ "Type;\n";
      memberCode ~= "const(" ~ memberName ~ "Type)* " ~ memberName ~ ";\n";

      fieldMetaCodes ~= "TFieldMeta(`" ~ memberName ~ "`, " ~ memberId ~
        ", TReq.OPT_IN_REQ_OUT)";
    }

    string code = "struct TPargsStruct {\n";
    code ~= memberCode;
    version (TVerboseCodegen) {
      if (!methodMetaFound &&
        ParameterTypeTuple!(mixin("Interface." ~ methodName)).length > 0)
      {
        code ~= "pragma(msg, `[thrift.codegen.base.TPargsStruct] Warning: No " ~
          "meta information for method '" ~ methodName ~ "' in service '" ~
          Interface.stringof ~ "' found.`);\n";
      }
    }
    code ~= "void write(P)(P proto) const if (isTProtocol!P) {\n";
    code ~= "writeStruct!(typeof(this), P, [" ~ ctfeJoin(fieldMetaCodes) ~
      "], true)(this, proto);\n";
    code ~= "}\n";
    code ~= "}\n";
    return code;
  }());
}

/**
 * Represents the result of a Thrift method call, using a pointer to the return
 * value to avoid copying.
 *
 * There should usually be no reason to use this struct directly without the
 * help of TClient, but it is documented publicly to help debugging in case
 * of CTFE errors.
 *
 * Consider this example:
 * ---
 * interface Foo {
 *   int bar(string a);
 *
 *   alias .FooException FooException;
 *
 *   enum methodMeta = [
 *     TMethodMeta("bar",
 *       [TParamMeta("a", 1)],
 *       [TExceptionMeta("fooe", 1, "FooException")]
 *     )
 *   ];
 * }
 * alias TPresultStruct!(Foo, "bar") FooBarPresult;
 * ---
 *
 * The definition of FooBarPresult is equivalent to (ignoring the necessary
 * metadata to assign the field IDs):
 * ---
 * struct FooBarPresult {
 *   int* success;
 *   Foo.FooException fooe;
 *
 *   struct IsSetFlags {
 *     bool success;
 *   }
 *   IsSetFlags isSetFlags;
 *
 *   bool isSet(string fieldName)() const @property;
 *   void read(Protocol)(Protocol proto) if (isTProtocol!Protocol);
 * }
 * ---
 */
template TPresultStruct(Interface, string methodName) {
  static assert(is(typeof(mixin("Interface." ~ methodName))),
    "Could not find method '" ~ methodName ~ "' in '" ~ Interface.stringof ~ "'.");

  mixin({
    string code = "struct TPresultStruct {\n";

    string[] fieldMetaCodes;

    alias ReturnType!(mixin("Interface." ~ methodName)) ResultType;
    static if (!is(ResultType == void)) {
      code ~= q{
        ReturnType!(mixin("Interface." ~ methodName))* success;
      };
      fieldMetaCodes ~= "TFieldMeta(`success`, 0, TReq.OPTIONAL)";

      static if (!isNullable!ResultType) {
        code ~= q{
          struct IsSetFlags {
            bool success;
          }
          IsSetFlags isSetFlags;
        };
        fieldMetaCodes ~= "TFieldMeta(`isSetFlags`, 0, TReq.IGNORE)";
      }
    }

    bool methodMetaFound;
    static if (is(typeof(Interface.methodMeta) : TMethodMeta[])) {
      auto meta = find!`a.name == b`(Interface.methodMeta, methodName);
      if (!meta.empty) {
        foreach (e; meta.front.exceptions) {
          code ~= "Interface." ~ e.type ~ " " ~ e.name ~ ";\n";
          fieldMetaCodes ~= "TFieldMeta(`" ~ e.name ~ "`, " ~ to!string(e.id) ~
            ", TReq.OPTIONAL)";
        }
        methodMetaFound = true;
      }
    }

    version (TVerboseCodegen) {
      if (!methodMetaFound &&
        ParameterTypeTuple!(mixin("Interface." ~ methodName)).length > 0)
      {
        code ~= "pragma(msg, `[thrift.codegen.base.TPresultStruct] Warning: No " ~
          "meta information for method '" ~ methodName ~ "' in service '" ~
          Interface.stringof ~ "' found.`);\n";
      }
    }

    code ~= q{
      bool isSet(string fieldName)() const @property if (
        is(MemberType!(typeof(this), fieldName))
      ) {
        static if (fieldName == "success") {
          static if (isNullable!(typeof(*success))) {
            return *success !is null;
          } else {
            return isSetFlags.success;
          }
        } else {
          // We are dealing with an exception member, which, being a nullable
          // type (exceptions are always classes), has no isSet flag.
          return __traits(getMember, this, fieldName) !is null;
        }
      }
    };

    code ~= "void read(P)(P proto) if (isTProtocol!P) {\n";
    code ~= "readStruct!(typeof(this), P, [" ~ ctfeJoin(fieldMetaCodes) ~
      "], true)(this, proto);\n";
    code ~= "}\n";
    code ~= "}\n";
    return code;
  }());
}
