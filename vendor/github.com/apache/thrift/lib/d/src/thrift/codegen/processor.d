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
module thrift.codegen.processor;

import std.algorithm : find;
import std.array : empty, front;
import std.conv : to;
import std.traits : ParameterTypeTuple, ReturnType, Unqual;
import std.typetuple : allSatisfy, TypeTuple;
import std.variant : Variant;
import thrift.base;
import thrift.codegen.base;
import thrift.internal.codegen;
import thrift.internal.ctfe;
import thrift.protocol.base;
import thrift.protocol.processor;

/**
 * Service processor for Interface, which implements TProcessor by
 * synchronously forwarding requests for the service methods to a handler
 * implementing Interface.
 *
 * The generated class implements TProcessor and additionally allows a
 * TProcessorEventHandler to be specified via the public eventHandler property.
 * The constructor takes a single argument of type Interface, which is the
 * handler to forward the requests to:
 * ---
 * this(Interface iface);
 * TProcessorEventHandler eventHandler;
 * ---
 *
 * If Interface is derived from another service BaseInterface, this class is
 * also derived from TServiceProcessor!BaseInterface.
 *
 * The optional Protocols template tuple parameter can be used to specify
 * one or more TProtocol implementations to specifically generate code for. If
 * the actual types of the protocols passed to process() at runtime match one
 * of the items from the list, the optimized code paths are taken, otherwise,
 * a generic TProtocol version is used as fallback. For cases where the input
 * and output protocols differ, TProtocolPair!(InputProtocol, OutputProtocol)
 * can be used in the Protocols list:
 * ---
 * interface FooService { void foo(); }
 * class FooImpl { override void foo {} }
 *
 * // Provides fast path if TBinaryProtocol!TBufferedTransport is used for
 * // both input and output:
 * alias TServiceProcessor!(FooService, TBinaryProtocol!TBufferedTransport)
 *   BinaryProcessor;
 *
 * auto proc = new BinaryProcessor(new FooImpl());
 *
 * // Low overhead.
 * proc.process(tBinaryProtocol(tBufferTransport(someSocket)));
 *
 * // Not in the specialization list – higher overhead.
 * proc.process(tBinaryProtocol(tFramedTransport(someSocket)));
 *
 * // Same as above, but optimized for the Compact protocol backed by a
 * // TPipedTransport for input and a TBufferedTransport for output.
 * alias TServiceProcessor!(FooService, TProtocolPair!(
 *   TCompactProtocol!TPipedTransport, TCompactProtocol!TBufferedTransport)
 * ) MixedProcessor;
 * ---
 */
template TServiceProcessor(Interface, Protocols...) if (
  isService!Interface && allSatisfy!(isTProtocolOrPair, Protocols)
) {
  mixin({
    static if (is(Interface BaseInterfaces == super) && BaseInterfaces.length > 0) {
      static assert(BaseInterfaces.length == 1,
        "Services cannot be derived from more than one parent.");

      string code = "class TServiceProcessor : " ~
        "TServiceProcessor!(BaseService!Interface) {\n";
      code ~= "private Interface iface_;\n";

      string constructorCode = "this(Interface iface) {\n";
      constructorCode ~= "super(iface);\n";
      constructorCode ~= "iface_ = iface;\n";
    } else {
      string code = "class TServiceProcessor : TProcessor {";
      code ~= q{
        override bool process(TProtocol iprot, TProtocol oprot,
          Variant context = Variant()
        ) {
          auto msg = iprot.readMessageBegin();

          void writeException(TApplicationException e) {
            oprot.writeMessageBegin(TMessage(msg.name, TMessageType.EXCEPTION,
              msg.seqid));
            e.write(oprot);
            oprot.writeMessageEnd();
            oprot.transport.writeEnd();
            oprot.transport.flush();
          }

          if (msg.type != TMessageType.CALL && msg.type != TMessageType.ONEWAY) {
            skip(iprot, TType.STRUCT);
            iprot.readMessageEnd();
            iprot.transport.readEnd();

            writeException(new TApplicationException(
              TApplicationException.Type.INVALID_MESSAGE_TYPE));
            return false;
          }

          auto dg = msg.name in processMap_;
          if (!dg) {
            skip(iprot, TType.STRUCT);
            iprot.readMessageEnd();
            iprot.transport.readEnd();

            writeException(new TApplicationException("Invalid method name: '" ~
              msg.name ~ "'.", TApplicationException.Type.INVALID_MESSAGE_TYPE));

            return false;
          }

          (*dg)(msg.seqid, iprot, oprot, context);
          return true;
        }

        TProcessorEventHandler eventHandler;

        alias void delegate(int, TProtocol, TProtocol, Variant) ProcessFunc;
        protected ProcessFunc[string] processMap_;
        private Interface iface_;
      };

      string constructorCode = "this(Interface iface) {\n";
      constructorCode ~= "iface_ = iface;\n";
    }

    // Generate the handling code for each method, consisting of the dispatch
    // function, registering it in the constructor, and the actual templated
    // handler function.
    foreach (methodName;
      FilterMethodNames!(Interface, __traits(derivedMembers, Interface))
    ) {
      // Register the processing function in the constructor.
      immutable procFuncName = "process_" ~ methodName;
      immutable dispatchFuncName = procFuncName ~ "_protocolDispatch";
      constructorCode ~= "processMap_[`" ~ methodName ~ "`] = &" ~
        dispatchFuncName ~ ";\n";

      bool methodMetaFound;
      TMethodMeta methodMeta;
      static if (is(typeof(Interface.methodMeta) : TMethodMeta[])) {
        enum meta = find!`a.name == b`(Interface.methodMeta, methodName);
        if (!meta.empty) {
          methodMetaFound = true;
          methodMeta = meta.front;
        }
      }

      // The dispatch function to call the specialized handler functions. We
      // test the protocols if they can be converted to one of the passed
      // protocol types, and if not, fall back to the generic TProtocol
      // version of the processing function.
      code ~= "void " ~ dispatchFuncName ~
        "(int seqid, TProtocol iprot, TProtocol oprot, Variant context) {\n";
      code ~= "foreach (Protocol; TypeTuple!(Protocols, TProtocol)) {\n";
      code ~= q{
        static if (is(Protocol _ : TProtocolPair!(I, O), I, O)) {
          alias I IProt;
          alias O OProt;
        } else {
          alias Protocol IProt;
          alias Protocol OProt;
        }
        auto castedIProt = cast(IProt)iprot;
        auto castedOProt = cast(OProt)oprot;
      };
      code ~= "if (castedIProt && castedOProt) {\n";
      code ~= procFuncName ~
        "!(IProt, OProt)(seqid, castedIProt, castedOProt, context);\n";
      code ~= "return;\n";
      code ~= "}\n";
      code ~= "}\n";
      code ~= "throw new TException(`Internal error: Null iprot/oprot " ~
        "passed to processor protocol dispatch function.`);\n";
      code ~= "}\n";

      // The actual handler function, templated on the input and output
      // protocol types.
      code ~= "void " ~ procFuncName ~ "(IProt, OProt)(int seqid, IProt " ~
        "iprot, OProt oprot, Variant connectionContext) " ~
        "if (isTProtocol!IProt && isTProtocol!OProt) {\n";
      code ~= "TArgsStruct!(Interface, `" ~ methodName ~ "`) args;\n";

      // Store the (qualified) method name in a manifest constant to avoid
      // having to litter the code below with lots of string manipulation.
      code ~= "enum methodName = `" ~ methodName ~ "`;\n";

      code ~= q{
        enum qName = Interface.stringof ~ "." ~ methodName;

        Variant callContext;
        if (eventHandler) {
          callContext = eventHandler.createContext(qName, connectionContext);
        }

        scope (exit) {
          if (eventHandler) {
            eventHandler.deleteContext(callContext, qName);
          }
        }

        if (eventHandler) eventHandler.preRead(callContext, qName);

        args.read(iprot);
        iprot.readMessageEnd();
        iprot.transport.readEnd();

        if (eventHandler) eventHandler.postRead(callContext, qName);
      };

      code ~= "TResultStruct!(Interface, `" ~ methodName ~ "`) result;\n";
      code ~= "try {\n";

      // Generate the parameter list to pass to the called iface function.
      string[] paramList;
      foreach (i, _; ParameterTypeTuple!(mixin("Interface." ~ methodName))) {
        string paramName;
        if (methodMetaFound && i < methodMeta.params.length) {
          paramName = methodMeta.params[i].name;
        } else {
          paramName = "param" ~ to!string(i + 1);
        }
        paramList ~= "args." ~ paramName;
      }

      immutable call = "iface_." ~ methodName ~ "(" ~ ctfeJoin(paramList) ~ ")";
      if (is(ReturnType!(mixin("Interface." ~ methodName)) == void)) {
        code ~= call ~ ";\n";
      } else {
        code ~= "result.set!`success`(" ~ call ~ ");\n";
      }

      // If this is not a oneway method, generate the receiving code.
      if (!methodMetaFound || methodMeta.type != TMethodType.ONEWAY) {
        if (methodMetaFound) {
          foreach (e; methodMeta.exceptions) {
            code ~= "} catch (Interface." ~ e.type ~ " " ~ e.name ~ ") {\n";
            code ~= "result.set!`" ~ e.name ~ "`(" ~ e.name ~ ");\n";
          }
        }
        code ~= "}\n";

        code ~= q{
          catch (Exception e) {
            if (eventHandler) {
              eventHandler.handlerError(callContext, qName, e);
            }

            auto x = new TApplicationException(to!string(e));
            oprot.writeMessageBegin(
              TMessage(methodName, TMessageType.EXCEPTION, seqid));
            x.write(oprot);
            oprot.writeMessageEnd();
            oprot.transport.writeEnd();
            oprot.transport.flush();
            return;
          }

          if (eventHandler) eventHandler.preWrite(callContext, qName);

          oprot.writeMessageBegin(TMessage(methodName,
            TMessageType.REPLY, seqid));
          result.write(oprot);
          oprot.writeMessageEnd();
          oprot.transport.writeEnd();
          oprot.transport.flush();

          if (eventHandler) eventHandler.postWrite(callContext, qName);
        };
      } else {
        // For oneway methods, we obviously cannot notify the client of any
        // exceptions, just call the event handler if one is set.
        code ~= "}\n";
        code ~= q{
          catch (Exception e) {
            if (eventHandler) {
              eventHandler.handlerError(callContext, qName, e);
            }
            return;
          }

          if (eventHandler) eventHandler.onewayComplete(callContext, qName);
        };
      }
      code ~= "}\n";

    }

    code ~= constructorCode ~ "}\n";
    code ~= "}\n";

    return code;
  }());
}

/**
 * A struct representing the arguments of a Thrift method call.
 *
 * There should usually be no reason to use this directly without the help of
 * TServiceProcessor, but it is documented publicly to help debugging in case
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
 * alias TArgsStruct!(Foo, "bar") FooBarArgs;
 * ---
 *
 * The definition of FooBarArgs is equivalent to:
 * ---
 * struct FooBarArgs {
 *   string a;
 *   bool b;
 *
 *   mixin TStructHelpers!([TFieldMeta("a", 1, TReq.OPT_IN_REQ_OUT),
 *     TFieldMeta("b", 2, TReq.OPT_IN_REQ_OUT)]);
 * }
 * ---
 *
 * If the TVerboseCodegen version is defined, a warning message is issued at
 * compilation if no TMethodMeta for Interface.methodName is found.
 */
template TArgsStruct(Interface, string methodName) {
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

      // Unqual!() is needed to generate mutable fields for ref const()
      // struct parameters.
      memberCode ~= "Unqual!(ParameterTypeTuple!(Interface." ~ methodName ~
        ")[" ~ to!string(i) ~ "])" ~ memberName ~ ";\n";

      fieldMetaCodes ~= "TFieldMeta(`" ~ memberName ~ "`, " ~ memberId ~
        ", TReq.OPT_IN_REQ_OUT)";
    }

    string code = "struct TArgsStruct {\n";
    code ~= memberCode;
    version (TVerboseCodegen) {
      if (!methodMetaFound &&
        ParameterTypeTuple!(mixin("Interface." ~ methodName)).length > 0)
      {
        code ~= "pragma(msg, `[thrift.codegen.processor.TArgsStruct] Warning: No " ~
          "meta information for method '" ~ methodName ~ "' in service '" ~
          Interface.stringof ~ "' found.`);\n";
      }
    }
    immutable fieldMetaCode =
      fieldMetaCodes.empty ? "" : "[" ~ ctfeJoin(fieldMetaCodes) ~ "]";
    code ~= "mixin TStructHelpers!(" ~ fieldMetaCode  ~ ");\n";
    code ~= "}\n";
    return code;
  }());
}

/**
 * A struct representing the result of a Thrift method call.
 *
 * It contains a field called "success" for the return value of the function
 * (with id 0), and additional fields for the exceptions declared for the
 * method, if any.
 *
 * There should usually be no reason to use this directly without the help of
 * TServiceProcessor, but it is documented publicly to help debugging in case
 * of CTFE errors.
 *
 * Consider the following example:
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
 * alias TResultStruct!(Foo, "bar") FooBarResult;
 * ---
 *
 * The definition of FooBarResult is equivalent to:
 * ---
 * struct FooBarResult {
 *   int success;
 *   FooException fooe;
 *
 *   mixin(TStructHelpers!([TFieldMeta("success", 0, TReq.OPTIONAL),
 *     TFieldMeta("fooe", 1, TReq.OPTIONAL)]));
 * }
 * ---
 *
 * If the TVerboseCodegen version is defined, a warning message is issued at
 * compilation if no TMethodMeta for Interface.methodName is found.
 */
template TResultStruct(Interface, string methodName) {
  static assert(is(typeof(mixin("Interface." ~ methodName))),
    "Could not find method '" ~ methodName ~ "' in '" ~ Interface.stringof ~ "'.");

  mixin({
    string code = "struct TResultStruct {\n";

    string[] fieldMetaCodes;

    static if (!is(ReturnType!(mixin("Interface." ~ methodName)) == void)) {
      code ~= "ReturnType!(Interface." ~ methodName ~ ") success;\n";
      fieldMetaCodes ~= "TFieldMeta(`success`, 0, TReq.OPTIONAL)";
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
        code ~= "pragma(msg, `[thrift.codegen.processor.TResultStruct] Warning: No " ~
          "meta information for method '" ~ methodName ~ "' in service '" ~
          Interface.stringof ~ "' found.`);\n";
      }
    }

    immutable fieldMetaCode =
      fieldMetaCodes.empty ? "" : "[" ~ ctfeJoin(fieldMetaCodes) ~ "]";
    code ~= "mixin TStructHelpers!(" ~ fieldMetaCode  ~ ");\n";
    code ~= "}\n";
    return code;
  }());
}
