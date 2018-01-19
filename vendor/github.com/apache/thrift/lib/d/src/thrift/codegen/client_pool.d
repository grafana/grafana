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
module thrift.codegen.client_pool;

import core.time : dur, Duration, TickDuration;
import std.traits : ParameterTypeTuple, ReturnType;
import thrift.base;
import thrift.codegen.base;
import thrift.codegen.client;
import thrift.internal.codegen;
import thrift.internal.resource_pool;

/**
 * Manages a pool of TClients for the given interface, forwarding RPC calls to
 * members of the pool.
 *
 * If a request fails, another client from the pool is tried, and optionally,
 * a client is disabled for a configurable amount of time if it fails too
 * often. If all clients fail (and keepTrying is false), a
 * TCompoundOperationException is thrown, containing all the collected RPC
 * exceptions.
 */
class TClientPool(Interface) if (isService!Interface) : Interface {
  /// Shorthand for TClientBase!Interface, the client type this instance
  /// operates on.
  alias TClientBase!Interface Client;

  /**
   * Creates a new instance and adds the given clients to the pool.
   */
  this(Client[] clients) {
    pool_ = new TResourcePool!Client(clients);

    rpcFaultFilter = (Exception e) {
      import thrift.protocol.base;
      import thrift.transport.base;
      return (
        (cast(TTransportException)e !is null) ||
        (cast(TApplicationException)e !is null)
      );
    };
  }

  /**
   * Executes an operation on the first currently active client.
   *
   * If the operation fails (throws an exception for which rpcFaultFilter is
   * true), the failure is recorded and the next client in the pool is tried.
   *
   * Throws: Any non-rpc exception that occurs, a TCompoundOperationException
   *   if all clients failed with an rpc exception (if keepTrying is false).
   *
   * Example:
   * ---
   * interface Foo { string bar(); }
   * auto poolClient = tClientPool([tClient!Foo(someProtocol)]);
   * auto result = poolClient.execute((c){ return c.bar(); });
   * ---
   */
  ResultType execute(ResultType)(scope ResultType delegate(Client) work) {
    return executeOnPool!Client(work);
  }

  /**
   * Adds a client to the pool.
   */
  void addClient(Client client) {
    pool_.add(client);
  }

  /**
   * Removes a client from the pool.
   *
   * Returns: Whether the client was found in the pool.
   */
  bool removeClient(Client client) {
    return pool_.remove(client);
  }

  mixin(poolForwardCode!Interface());

  /// Whether to open the underlying transports of a client before trying to
  /// execute a method if they are not open. This is usually desirable
  /// because it allows e.g. to automatically reconnect to a remote server
  /// if the network connection is dropped.
  ///
  /// Defaults to true.
  bool reopenTransports = true;

  /// Called to determine whether an exception comes from a client from the
  /// pool not working properly, or if it an exception thrown at the
  /// application level.
  ///
  /// If the delegate returns true, the server/connection is considered to be
  /// at fault, if it returns false, the exception is just passed on to the
  /// caller.
  ///
  /// By default, returns true for instances of TTransportException and
  /// TApplicationException, false otherwise.
  bool delegate(Exception) rpcFaultFilter;

  /**
   * Whether to keep trying to find a working client if all have failed in a
   * row.
   *
   * Defaults to false.
   */
  bool keepTrying() const @property {
    return pool_.cycle;
  }

  /// Ditto
  void keepTrying(bool value) @property {
    pool_.cycle = value;
  }

  /**
   * Whether to use a random permutation of the client pool on every call to
   * execute(). This can be used e.g. as a simple form of load balancing.
   *
   * Defaults to true.
   */
  bool permuteClients() const @property {
    return pool_.permute;
  }

  /// Ditto
  void permuteClients(bool value) @property {
    pool_.permute = value;
  }

  /**
   * The number of consecutive faults after which a client is disabled until
   * faultDisableDuration has passed. 0 to never disable clients.
   *
   * Defaults to 0.
   */
  ushort faultDisableCount() @property {
    return pool_.faultDisableCount;
  }

  /// Ditto
  void faultDisableCount(ushort value) @property {
    pool_.faultDisableCount = value;
  }

  /**
   * The duration for which a client is no longer considered after it has
   * failed too often.
   *
   * Defaults to one second.
   */
  Duration faultDisableDuration() @property {
    return pool_.faultDisableDuration;
  }

  /// Ditto
  void faultDisableDuration(Duration value) @property {
    pool_.faultDisableDuration = value;
  }

protected:
  ResultType executeOnPool(ResultType)(scope ResultType delegate(Client) work) {
    auto clients = pool_[];
    if (clients.empty) {
      throw new TException("No clients available to try.");
    }

    while (true) {
      Exception[] rpcExceptions;
      while (!clients.empty) {
        auto c = clients.front;
        clients.popFront;
        try {
          scope (success) {
            pool_.recordSuccess(c);
          }

          if (reopenTransports) {
            c.inputProtocol.transport.open();
            c.outputProtocol.transport.open();
          }

          return work(c);
        } catch (Exception e) {
          if (rpcFaultFilter && rpcFaultFilter(e)) {
            pool_.recordFault(c);
            rpcExceptions ~= e;
          } else {
            // We are dealing with a normal exception thrown by the
            // server-side method, just pass it on. As far as we are
            // concerned, the method call succeeded.
            pool_.recordSuccess(c);
            throw e;
          }
        }
      }

      // If we get here, no client succeeded during the current iteration.
      Duration waitTime;
      Client dummy;
      if (clients.willBecomeNonempty(dummy, waitTime)) {
        if (waitTime > dur!"hnsecs"(0)) {
          import core.thread;
          Thread.sleep(waitTime);
        }
      } else {
        throw new TCompoundOperationException("All clients failed.",
          rpcExceptions);
      }
    }
  }

private:
  TResourcePool!Client pool_;
}

private {
  // Cannot use an anonymous delegate literal for this because they aren't
  // allowed in class scope.
  string poolForwardCode(Interface)() {
    string code = "";

    foreach (methodName; AllMemberMethodNames!Interface) {
      enum qn = "Interface." ~ methodName;
      code ~= "ReturnType!(" ~ qn ~ ") " ~ methodName ~
        "(ParameterTypeTuple!(" ~ qn ~ ") args) {\n";
      code ~= "return executeOnPool((Client c){ return c." ~
        methodName ~ "(args); });\n";
      code ~= "}\n";
    }

    return code;
  }
}

/**
 * TClientPool construction helper to avoid having to explicitly specify
 * the interface type, i.e. to allow the constructor being called using IFTI
 * (see $(DMDBUG 6082, D Bugzilla enhancement requet 6082)).
 */
TClientPool!Interface tClientPool(Interface)(
  TClientBase!Interface[] clients
) if (isService!Interface) {
  return new typeof(return)(clients);
}
