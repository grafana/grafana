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
module thrift.codegen.async_client;

import std.conv : text, to;
import std.traits : ParameterStorageClass, ParameterStorageClassTuple,
  ParameterTypeTuple, ReturnType;
import thrift.base;
import thrift.async.base;
import thrift.codegen.base;
import thrift.codegen.client;
import thrift.internal.codegen;
import thrift.internal.ctfe;
import thrift.protocol.base;
import thrift.transport.base;
import thrift.util.cancellation;
import thrift.util.future;

/**
 * Asynchronous Thrift service client which returns the results as TFutures an
 * uses a TAsyncManager to perform the actual work.
 *
 * TAsyncClientBase serves as a supertype for all TAsyncClients for the same
 * service, which might be instantiated with different concrete protocol types
 * (there is no covariance for template type parameters), and extends
 * TFutureInterface!Interface. If Interface is derived from another service
 * BaseInterface, it also extends TAsyncClientBase!BaseInterface.
 *
 * TAsyncClient implements TAsyncClientBase and offers two constructors with
 * the following signatures:
 * ---
 * this(TAsyncTransport trans, TTransportFactory tf, TProtocolFactory pf);
 * this(TAsyncTransport trans, TTransportFactory itf, TTransportFactory otf,
 *   TProtocolFactory ipf, TProtocolFactory opf);
 * ---
 *
 * Again, if Interface represents a derived Thrift service,
 * TAsyncClient!Interface is also derived from TAsyncClient!BaseInterface.
 *
 * TAsyncClient can exclusively be used with TAsyncTransports, as it needs to
 * access the associated TAsyncManager. To set up any wrapper transports
 * (e.g. buffered, framed) on top of it and to instanciate the protocols to use,
 * TTransportFactory and TProtocolFactory instances are passed to the
 * constructors – the three argument constructor is a shortcut if the same
 * transport and protocol are to be used for both input and output, which is
 * the most common case.
 *
 * If the same transport factory is passed for both input and output transports,
 * only a single wrapper transport will be created and used for both directions.
 * This allows easy implementation of protocols like SSL.
 *
 * Just as TClient does, TAsyncClient also takes two optional template
 * arguments which can be used for specifying the actual TProtocol
 * implementation used for optimization purposes, as virtual calls can
 * completely be eliminated then. If the actual types of the protocols
 * instantiated by the factories used does not match the ones statically
 * specified in the template parameters, a TException is thrown during
 * construction.
 *
 * Example:
 * ---
 * // A simple Thrift service.
 * interface Foo { int foo(); }
 *
 * // Create a TAsyncSocketManager – thrift.async.libevent is used for this
 * // example.
 * auto manager = new TLibeventAsyncManager;
 *
 * // Set up an async transport to use.
 * auto socket = new TAsyncSocket(manager, host, port);
 *
 * // Create a client instance.
 * auto client = new TAsyncClient!Foo(
 *   socket,
 *   new TBufferedTransportFactory, // Wrap the socket in a TBufferedTransport.
 *   new TBinaryProtocolFactory!() // Use the Binary protocol.
 * );
 *
 * // Call foo and use the returned future.
 * auto result = client.foo();
 * pragma(msg, typeof(result)); // TFuture!int
 * int resultValue = result.waitGet(); // Waits until the result is available.
 * ---
 */
interface TAsyncClientBase(Interface) if (isBaseService!Interface) :
  TFutureInterface!Interface
{
  /**
   * The underlying TAsyncTransport used by this client instance.
   */
  TAsyncTransport transport() @property;
}

/// Ditto
interface TAsyncClientBase(Interface) if (isDerivedService!Interface) :
  TAsyncClientBase!(BaseService!Interface), TFutureInterface!Interface
{}

/// Ditto
template TAsyncClient(Interface, InputProtocol = TProtocol, OutputProtocol = void) if (
  isService!Interface && isTProtocol!InputProtocol &&
  (isTProtocol!OutputProtocol || is(OutputProtocol == void))
) {
  mixin({
    static if (isDerivedService!Interface) {
      string code = "class TAsyncClient : " ~
        "TAsyncClient!(BaseService!Interface, InputProtocol, OutputProtocol), " ~
        "TAsyncClientBase!Interface {\n";
      code ~= q{
        this(TAsyncTransport trans, TTransportFactory tf, TProtocolFactory pf) {
          this(trans, tf, tf, pf, pf);
        }

        this(TAsyncTransport trans, TTransportFactory itf,
          TTransportFactory otf, TProtocolFactory ipf, TProtocolFactory opf
        ) {
          super(trans, itf, otf, ipf, opf);
          client_ = new typeof(client_)(iprot_, oprot_);
        }

        private TClient!(Interface, IProt, OProt) client_;
      };
    } else {
      string code = "class TAsyncClient : TAsyncClientBase!Interface {";
      code ~= q{
        alias InputProtocol IProt;
        static if (isTProtocol!OutputProtocol) {
          alias OutputProtocol OProt;
        } else {
          static assert(is(OutputProtocol == void));
          alias InputProtocol OProt;
        }

        this(TAsyncTransport trans, TTransportFactory tf, TProtocolFactory pf) {
          this(trans, tf, tf, pf, pf);
        }

        this(TAsyncTransport trans, TTransportFactory itf,
          TTransportFactory otf, TProtocolFactory ipf, TProtocolFactory opf
        ) {
          import std.exception;
          transport_ = trans;

          auto ip = itf.getTransport(trans);
          TTransport op = void;
          if (itf == otf) {
            op = ip;
          } else {
            op = otf.getTransport(trans);
          }

          auto iprot = ipf.getProtocol(ip);
          iprot_ = cast(IProt)iprot;
          enforce(iprot_, new TException(text("Input protocol not of the " ~
            "specified concrete type (", IProt.stringof, ").")));

          auto oprot = opf.getProtocol(op);
          oprot_ = cast(OProt)oprot;
          enforce(oprot_, new TException(text("Output protocol not of the " ~
            "specified concrete type (", OProt.stringof, ").")));

          client_ = new typeof(client_)(iprot_, oprot_);
        }

        override TAsyncTransport transport() @property {
          return transport_;
        }

        protected TAsyncTransport transport_;
        protected IProt iprot_;
        protected OProt oprot_;
        private TClient!(Interface, IProt, OProt) client_;
      };
    }

    foreach (methodName;
      FilterMethodNames!(Interface, __traits(derivedMembers, Interface))
    ) {
      string[] paramList;
      string[] paramNames;
      foreach (i, _; ParameterTypeTuple!(mixin("Interface." ~ methodName))) {
        immutable paramName = "param" ~ to!string(i + 1);
        immutable storage = ParameterStorageClassTuple!(
          mixin("Interface." ~ methodName))[i];

        paramList ~= ((storage & ParameterStorageClass.ref_) ? "ref " : "") ~
          "ParameterTypeTuple!(Interface." ~ methodName ~ ")[" ~
          to!string(i) ~ "] " ~ paramName;
        paramNames ~= paramName;
      }
      paramList ~= "TCancellation cancellation = null";

      immutable returnTypeCode = "ReturnType!(Interface." ~ methodName ~ ")";
      code ~= "TFuture!(" ~ returnTypeCode ~ ") " ~ methodName ~ "(" ~
        ctfeJoin(paramList) ~ ") {\n";

      // Create the future instance that will repesent the result.
      code ~= "auto promise = new TPromise!(" ~ returnTypeCode ~ ");\n";

      // Prepare delegate which executes the TClient method call.
      code ~= "auto work = {\n";
      code ~= "try {\n";
      code ~= "static if (is(ReturnType!(Interface." ~ methodName ~
        ") == void)) {\n";
      code ~= "client_." ~ methodName ~ "(" ~ ctfeJoin(paramNames) ~ ");\n";
      code ~= "promise.succeed();\n";
      code ~= "} else {\n";
      code ~= "auto result = client_." ~ methodName ~ "(" ~
        ctfeJoin(paramNames) ~ ");\n";
      code ~= "promise.succeed(result);\n";
      code ~= "}\n";
      code ~= "} catch (Exception e) {\n";
      code ~= "promise.fail(e);\n";
      code ~= "}\n";
      code ~= "};\n";

      // If the request is cancelled, set the result promise to cancelled
      // as well. This could be moved into an additional TAsyncWorkItem
      // delegate parameter.
      code ~= q{
        if (cancellation) {
          cancellation.triggering.addCallback({
            promise.cancel();
          });
        }
      };

      // Enqueue the work item and immediately return the promise (resp. its
      // future interface).
      code ~= "transport_.asyncManager.execute(transport_, work, cancellation);\n";
      code ~= "return promise;\n";
      code ~= "}\n";

    }

    code ~= "}\n";
    return code;
  }());
}
