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
 * Utilities for asynchronously querying multiple servers, building on
 * TAsyncClient.
 *
 * Terminology note: The names of the artifacts defined in this module are
 *   derived from »client pool«, because they operate on a pool of
 *   TAsyncClients. However, from a architectural point of view, they often
 *   represent a pool of hosts a Thrift client application communicates with
 *   using RPC calls.
 */
module thrift.codegen.async_client_pool;

import core.sync.mutex;
import core.time : Duration, dur;
import std.algorithm : map;
import std.array : array, empty;
import std.exception : enforce;
import std.traits : ParameterTypeTuple, ReturnType;
import thrift.base;
import thrift.codegen.base;
import thrift.codegen.async_client;
import thrift.internal.algorithm;
import thrift.internal.codegen;
import thrift.util.awaitable;
import thrift.util.cancellation;
import thrift.util.future;
import thrift.internal.resource_pool;

/**
 * Represents a generic client pool which implements TFutureInterface!Interface
 * using multiple TAsyncClients.
 */
interface TAsyncClientPoolBase(Interface) if (isService!Interface) :
  TFutureInterface!Interface
{
  /// Shorthand for the client type this pool operates on.
  alias TAsyncClientBase!Interface Client;

  /**
   * Adds a client to the pool.
   */
  void addClient(Client client);

  /**
   * Removes a client from the pool.
   *
   * Returns: Whether the client was found in the pool.
   */
  bool removeClient(Client client);

  /**
   * Called to determine whether an exception comes from a client from the
   * pool not working properly, or if it an exception thrown at the
   * application level.
   *
   * If the delegate returns true, the server/connection is considered to be
   * at fault, if it returns false, the exception is just passed on to the
   * caller.
   *
   * By default, returns true for instances of TTransportException and
   * TApplicationException, false otherwise.
   */
  bool delegate(Exception) rpcFaultFilter() const @property;
  void rpcFaultFilter(bool delegate(Exception)) @property; /// Ditto

  /**
   * Whether to open the underlying transports of a client before trying to
   * execute a method if they are not open. This is usually desirable
   * because it allows e.g. to automatically reconnect to a remote server
   * if the network connection is dropped.
   *
   * Defaults to true.
   */
  bool reopenTransports() const @property;
  void reopenTransports(bool) @property; /// Ditto
}

immutable bool delegate(Exception) defaultRpcFaultFilter;
static this() {
  defaultRpcFaultFilter = (Exception e) {
    import thrift.protocol.base;
    import thrift.transport.base;
    return (
      (cast(TTransportException)e !is null) ||
      (cast(TApplicationException)e !is null)
    );
  };
}

/**
 * A TAsyncClientPoolBase implementation which queries multiple servers in a
 * row until a request succeeds, the result of which is then returned.
 *
 * The definition of »success« can be customized using the rpcFaultFilter()
 * delegate property. If it is non-null and calling it for an exception set by
 * a failed method invocation returns true, the error is considered to be
 * caused by the RPC layer rather than the application layer, and the next
 * server in the pool is tried. If there are no more clients to try, the
 * operation is marked as failed with a TCompoundOperationException.
 *
 * If a TAsyncClient in the pool fails with an RPC exception for a number of
 * consecutive tries, it is temporarily disabled (not tried any longer) for
 * a certain duration. Both the limit and the timeout can be configured. If all
 * clients fail (and keepTrying is false), the operation fails with a
 * TCompoundOperationException which contains the collected RPC exceptions.
 */
final class TAsyncClientPool(Interface) if (isService!Interface) :
  TAsyncClientPoolBase!Interface
{
  ///
  this(Client[] clients) {
    pool_ = new TResourcePool!Client(clients);
    rpcFaultFilter_ = defaultRpcFaultFilter;
    reopenTransports_ = true;
  }

  /+override+/ void addClient(Client client) {
    pool_.add(client);
  }

  /+override+/ bool removeClient(Client client) {
    return pool_.remove(client);
  }

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
  ushort faultDisableCount() const @property {
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
  Duration faultDisableDuration() const @property {
    return pool_.faultDisableDuration;
  }

  /// Ditto
  void faultDisableDuration(Duration value) @property {
    pool_.faultDisableDuration = value;
  }

  /+override+/ bool delegate(Exception) rpcFaultFilter() const @property {
    return rpcFaultFilter_;
  }

  /+override+/ void rpcFaultFilter(bool delegate(Exception) value) @property {
    rpcFaultFilter_ = value;
  }

  /+override+/ bool reopenTransports() const @property {
    return reopenTransports_;
  }

  /+override+/ void reopenTransports(bool value) @property {
    reopenTransports_ = value;
  }

  mixin(fallbackPoolForwardCode!Interface());

protected:
  // The actual worker implementation to which RPC method calls are forwarded.
  auto executeOnPool(string method, Args...)(Args args,
    TCancellation cancellation
  ) {
    auto clients = pool_[];
    if (clients.empty) {
      throw new TException("No clients available to try.");
    }

    auto promise = new TPromise!(ReturnType!(MemberType!(Interface, method)));
    Exception[] rpcExceptions;

    void tryNext() {
      while (clients.empty) {
        Client next;
        Duration waitTime;
        if (clients.willBecomeNonempty(next, waitTime)) {
          if (waitTime > dur!"hnsecs"(0)) {
            if (waitTime < dur!"usecs"(10)) {
              import core.thread;
              Thread.sleep(waitTime);
            } else {
              next.transport.asyncManager.delay(waitTime, { tryNext(); });
              return;
            }
          }
        } else {
          promise.fail(new TCompoundOperationException("All clients failed.",
            rpcExceptions));
          return;
        }
      }

      auto client = clients.front;
      clients.popFront;

      if (reopenTransports) {
        if (!client.transport.isOpen) {
          try {
            client.transport.open();
          } catch (Exception e) {
            pool_.recordFault(client);
            tryNext();
            return;
          }
        }
      }

      auto future = mixin("client." ~ method)(args, cancellation);
      future.completion.addCallback({
        if (future.status == TFutureStatus.CANCELLED) {
          promise.cancel();
          return;
        }

        auto e = future.getException();
        if (e) {
          if (rpcFaultFilter_ && rpcFaultFilter_(e)) {
            pool_.recordFault(client);
            rpcExceptions ~= e;
            tryNext();
            return;
          }
        }
        pool_.recordSuccess(client);
        promise.complete(future);
      });
    }

    tryNext();
    return promise;
  }

private:
  TResourcePool!Client pool_;
  bool delegate(Exception) rpcFaultFilter_;
  bool reopenTransports_;
}

/**
 * TAsyncClientPool construction helper to avoid having to explicitly
 * specify the interface type, i.e. to allow the constructor being called
 * using IFTI (see $(DMDBUG 6082, D Bugzilla enhancement request 6082)).
 */
TAsyncClientPool!Interface tAsyncClientPool(Interface)(
  TAsyncClientBase!Interface[] clients
) if (isService!Interface) {
  return new typeof(return)(clients);
}

private {
  // Cannot use an anonymous delegate literal for this because they aren't
  // allowed in class scope.
  string fallbackPoolForwardCode(Interface)() {
    string code = "";

    foreach (methodName; AllMemberMethodNames!Interface) {
      enum qn = "Interface." ~ methodName;
      code ~= "TFuture!(ReturnType!(" ~ qn ~ ")) " ~ methodName ~
        "(ParameterTypeTuple!(" ~ qn ~ ") args, TCancellation cancellation = null) {\n";
      code ~= "return executeOnPool!(`" ~ methodName ~ "`)(args, cancellation);\n";
      code ~= "}\n";
    }

    return code;
  }
}

/**
 * A TAsyncClientPoolBase implementation which queries multiple servers at
 * the same time and returns the first success response.
 *
 * The definition of »success« can be customized using the rpcFaultFilter()
 * delegate property. If it is non-null and calling it for an exception set by
 * a failed method invocation returns true, the error is considered to be
 * caused by the RPC layer rather than the application layer, and the next
 * server in the pool is tried. If all clients fail, the operation is marked
 * as failed with a TCompoundOperationException.
 */
final class TAsyncFastestClientPool(Interface) if (isService!Interface) :
  TAsyncClientPoolBase!Interface
{
  ///
  this(Client[] clients) {
    clients_ = clients;
    rpcFaultFilter_ = defaultRpcFaultFilter;
    reopenTransports_ = true;
  }

  /+override+/ void addClient(Client client) {
    clients_ ~= client;
  }

  /+override+/ bool removeClient(Client client) {
    auto oldLength = clients_.length;
    clients_ = removeEqual(clients_, client);
    return clients_.length < oldLength;
  }


  /+override+/ bool delegate(Exception) rpcFaultFilter() const @property {
    return rpcFaultFilter_;
  }

  /+override+/ void rpcFaultFilter(bool delegate(Exception) value) @property {
    rpcFaultFilter_ = value;
  }

  /+override+/bool reopenTransports() const @property {
    return reopenTransports_;
  }

  /+override+/ void reopenTransports(bool value) @property {
    reopenTransports_ = value;
  }

  mixin(fastestPoolForwardCode!Interface());

private:
  Client[] clients_;
  bool delegate(Exception) rpcFaultFilter_;
  bool reopenTransports_;
}

/**
 * TAsyncFastestClientPool construction helper to avoid having to explicitly
 * specify the interface type, i.e. to allow the constructor being called
 * using IFTI (see $(DMDBUG 6082, D Bugzilla enhancement request 6082)).
 */
TAsyncFastestClientPool!Interface tAsyncFastestClientPool(Interface)(
  TAsyncClientBase!Interface[] clients
) if (isService!Interface) {
  return new typeof(return)(clients);
}

private {
  // Cannot use an anonymous delegate literal for this because they aren't
  // allowed in class scope.
  string fastestPoolForwardCode(Interface)() {
    string code = "";

    foreach (methodName; AllMemberMethodNames!Interface) {
      enum qn = "Interface." ~ methodName;
      code ~= "TFuture!(ReturnType!(" ~ qn ~ ")) " ~ methodName ~
        "(ParameterTypeTuple!(" ~ qn ~ ") args, " ~
        "TCancellation cancellation = null) {\n";
      code ~= "enum methodName = `" ~ methodName ~ "`;\n";
      code ~= q{
        alias ReturnType!(MemberType!(Interface, methodName)) ResultType;

        auto childCancellation = new TCancellationOrigin;

        TFuture!ResultType[] futures;
        futures.reserve(clients_.length);

        foreach (c; clients_) {
          if (reopenTransports) {
            if (!c.transport.isOpen) {
              try {
                c.transport.open();
              } catch (Exception e) {
                continue;
              }
            }
          }
          futures ~= mixin("c." ~ methodName)(args, childCancellation);
        }

        return new FastestPoolJob!(ResultType)(
          futures, rpcFaultFilter, cancellation, childCancellation);
      };
      code ~= "}\n";
    }

    return code;
  }

  final class FastestPoolJob(Result) : TFuture!Result {
    this(TFuture!Result[] poolFutures, bool delegate(Exception) rpcFaultFilter,
      TCancellation cancellation, TCancellationOrigin childCancellation
    ) {
      resultPromise_ = new TPromise!Result;
      poolFutures_ = poolFutures;
      rpcFaultFilter_ = rpcFaultFilter;
      childCancellation_ = childCancellation;

      foreach (future; poolFutures) {
        future.completion.addCallback({
          auto f = future;
          return { completionCallback(f); };
        }());
        if (future.status != TFutureStatus.RUNNING) {
          // If the current future is already completed, we are done, don't
          // bother adding callbacks for the others (they would just return
          // immediately after acquiring the lock).
          return;
        }
      }

      if (cancellation) {
        cancellation.triggering.addCallback({
          resultPromise_.cancel();
          childCancellation.trigger();
        });
      }
    }

    TFutureStatus status() const @property {
      return resultPromise_.status;
    }

    TAwaitable completion() @property {
      return resultPromise_.completion;
    }

    Result get() {
      return resultPromise_.get();
    }

    Exception getException() {
      return resultPromise_.getException();
    }

  private:
    void completionCallback(TFuture!Result future) {
      synchronized {
        if (future.status == TFutureStatus.CANCELLED) {
          assert(resultPromise_.status != TFutureStatus.RUNNING);
          return;
        }

        if (resultPromise_.status != TFutureStatus.RUNNING) {
          // The operation has already been completed. This can happen if
          // another client completed first, but this callback was already
          // waiting for the lock when it called cancel().
          return;
        }

        if (future.status == TFutureStatus.FAILED) {
          auto e = future.getException();
          if (rpcFaultFilter_ && rpcFaultFilter_(e)) {
            rpcExceptions_ ~= e;

            if (rpcExceptions_.length == poolFutures_.length) {
              resultPromise_.fail(new TCompoundOperationException(
                "All child operations failed, unable to retrieve a result.",
                rpcExceptions_
              ));
            }

            return;
          }
        }

        // Store the result to the target promise.
        resultPromise_.complete(future);

        // Cancel the other futures, we would just discard their results.
        // Note: We do this after we have stored the results to our promise,
        // see the assert at the top of the function.
        childCancellation_.trigger();
      }
    }

    TPromise!Result resultPromise_;
    TFuture!Result[] poolFutures_;
    Exception[] rpcExceptions_;
    bool delegate(Exception) rpcFaultFilter_;
    TCancellationOrigin childCancellation_;
  }
}

/**
 * Allows easily aggregating results from a number of TAsyncClients.
 *
 * Contrary to TAsync{Fallback, Fastest}ClientPool, this class does not
 * simply implement TFutureInterface!Interface. It manages a pool of clients,
 * but allows the user to specify a custom accumulator function to use or to
 * iterate over the results using a TFutureAggregatorRange.
 *
 * For each service method, TAsyncAggregator offers a method
 * accepting the same arguments, and an optional TCancellation instance, just
 * like with TFutureInterface. The return type, however, is a proxy object
 * that offers the following methods:
 * ---
 * /++
 *  + Returns a thrift.util.future.TFutureAggregatorRange for the results of
 *  + the client pool method invocations.
 *  +
 *  + The [] (slicing) operator can also be used to obtain the range.
 *  +
 *  + Params:
 *  +   timeout = A timeout to pass to the TFutureAggregatorRange constructor,
 *  +     defaults to zero (no timeout).
 *  +/
 * TFutureAggregatorRange!ReturnType range(Duration timeout = dur!"hnsecs"(0));
 * auto opSlice() { return range(); } /// Ditto
 *
 * /++
 *  + Returns a future that gathers the results from the clients in the pool
 *  + and invokes a user-supplied accumulator function on them, returning its
 *  + return value to the client.
 *  +
 *  + In addition to the TFuture!AccumulatedType interface (where
 *  + AccumulatedType is the return type of the accumulator function), the
 *  + returned object also offers two additional methods, finish() and
 *  + finishGet(): By default, the accumulator functions is called after all
 *  + the results from the pool clients have become available. Calling finish()
 *  + causes the accumulator future to stop waiting for other results and
 *  + immediately invoking the accumulator function on the results currently
 *  + available. If all results are already available, finish() is a no-op.
 *  + finishGet() is a convenience shortcut for combining it with
 *  + a call to get() immediately afterwards, like waitGet() is for wait().
 *  +
 *  + The acc alias can point to any callable accepting either an array of
 *  + return values or an array of return values and an array of exceptions;
 *  + see isAccumulator!() for details. The default accumulator concatenates
 *  + return values that can be concatenated with each others (e.g. arrays),
 *  + and simply returns an array of values otherwise, failing with a
 *  + TCompoundOperationException no values were returned.
 *  +
 *  + The accumulator function is not executed in any of the async manager
 *  + worker threads associated with the async clients, but instead it is
 *  + invoked when the actual result is requested for the first time after the
 *  + operation has been completed. This also includes checking the status
 *  + of the operation once it is no longer running, since the accumulator
 *  + has to be run to determine whether the operation succeeded or failed.
 *  +/
 * auto accumulate(alias acc = defaultAccumulator)() if (isAccumulator!acc);
 * ---
 *
 * Example:
 * ---
 * // Some Thrift service.
 * interface Foo {
 *   int foo(string name);
 *   byte[] bar();
 * }
 *
 * // Create the aggregator pool – client0, client1, client2 are some
 * // TAsyncClient!Foo instances, but in theory could also be other
 * // TFutureInterface!Foo implementations (e.g. some async client pool).
 * auto pool = new TAsyncAggregator!Foo([client0, client1, client2]);
 *
 * foreach (val; pool.foo("baz").range(dur!"seconds"(1))) {
 *   // Process all the results that are available before a second has passed,
 *   // in the order they arrive.
 *   writeln(val);
 * }
 *
 * auto sumRoots = pool.foo("baz").accumulate!((int[] vals, Exceptions[] exs){
 *   if (vals.empty) {
 *     throw new TCompoundOperationException("All clients failed", exs);
 *   }
 *
 *   // Just to illustrate that the type of the values can change, convert the
 *   // numbers to double and sum up their roots.
 *   double result = 0;
 *   foreach (v; vals) result += sqrt(cast(double)v);
 *   return result;
 * })();
 *
 * // Wait up to three seconds for the result, and then accumulate what has
 * // arrived so far.
 * sumRoots.completion.wait(dur!"seconds"(3));
 * writeln(sumRoots.finishGet());
 *
 * // For scalars, the default accumulator returns an array of the values.
 * pragma(msg, typeof(pool.foo("").accumulate().get()); // int[].
 *
 * // For lists, etc., it concatenates the results together.
 * pragma(msg, typeof(pool.bar().accumulate().get())); // byte[].
 * ---
 *
 * Note: For the accumulate!() interface, you might currently hit a »cannot use
 * local '…' as parameter to non-global template accumulate«-error, see
 * $(DMDBUG 5710, DMD issue 5710). If your accumulator function does not need
 * to access the surrounding scope, you might want to use a function literal
 * instead of a delegate to avoid the issue.
 */
class TAsyncAggregator(Interface) if (isBaseService!Interface) {
  /// Shorthand for the client type this instance operates on.
  alias TAsyncClientBase!Interface Client;

  ///
  this(Client[] clients) {
    clients_ = clients;
  }

  /// Whether to open the underlying transports of a client before trying to
  /// execute a method if they are not open. This is usually desirable
  /// because it allows e.g. to automatically reconnect to a remote server
  /// if the network connection is dropped.
  ///
  /// Defaults to true.
  bool reopenTransports = true;

  mixin AggregatorOpDispatch!();

private:
  Client[] clients_;
}

/// Ditto
class TAsyncAggregator(Interface) if (isDerivedService!Interface) :
  TAsyncAggregator!(BaseService!Interface)
{
  /// Shorthand for the client type this instance operates on.
  alias TAsyncClientBase!Interface Client;

  ///
  this(Client[] clients) {
    super(cast(TAsyncClientBase!(BaseService!Interface)[])clients);
  }

  mixin AggregatorOpDispatch!();
}

/**
 * Whether fun is a valid accumulator function for values of type ValueType.
 *
 * For this to be true, fun must be a callable matching one of the following
 * argument lists:
 * ---
 * fun(ValueType[] values);
 * fun(ValueType[] values, Exception[] exceptions);
 * ---
 *
 * The second version is passed the collected array exceptions from all the
 * clients in the pool.
 *
 * The return value of the accumulator function is passed to the client (via
 * the result future). If it throws an exception, the operation is marked as
 * failed with the given exception instead.
 */
template isAccumulator(ValueType, alias fun) {
  enum isAccumulator = is(typeof(fun(cast(ValueType[])[]))) ||
    is(typeof(fun(cast(ValueType[])[], cast(Exception[])[])));
}

/**
 * TAsyncAggregator construction helper to avoid having to explicitly
 * specify the interface type, i.e. to allow the constructor being called
 * using IFTI (see $(DMDBUG 6082, D Bugzilla enhancement request 6082)).
 */
TAsyncAggregator!Interface tAsyncAggregator(Interface)(
  TAsyncClientBase!Interface[] clients
) if (isService!Interface) {
  return new typeof(return)(clients);
}

private {
  mixin template AggregatorOpDispatch() {
    auto opDispatch(string name, Args...)(Args args) if (
      is(typeof(mixin("Interface.init." ~ name)(args)))
    ) {
      alias ReturnType!(MemberType!(Interface, name)) ResultType;

      auto childCancellation = new TCancellationOrigin;

      TFuture!ResultType[] futures;
      futures.reserve(clients_.length);

      foreach (c; cast(Client[])clients_) {
        if (reopenTransports) {
          if (!c.transport.isOpen) {
            try {
              c.transport.open();
            } catch (Exception e) {
              continue;
            }
          }
        }
        futures ~= mixin("c." ~ name)(args, childCancellation);
      }

      return AggregationResult!ResultType(futures, childCancellation);
    }
  }

  struct AggregationResult(T) {
    auto opSlice() {
      return range();
    }

    auto range(Duration timeout = dur!"hnsecs"(0)) {
      return tFutureAggregatorRange(futures_, childCancellation_, timeout);
    }

    auto accumulate(alias acc = defaultAccumulator)() if (isAccumulator!(T, acc)) {
      return new AccumulatorJob!(T, acc)(futures_, childCancellation_);
    }

  private:
    TFuture!T[] futures_;
    TCancellationOrigin childCancellation_;
  }

  auto defaultAccumulator(T)(T[] values, Exception[] exceptions) {
    if (values.empty) {
      throw new TCompoundOperationException("All clients failed",
        exceptions);
    }

    static if (is(typeof(T.init ~ T.init))) {
      import std.algorithm;
      return reduce!"a ~ b"(values);
    } else {
      return values;
    }
  }

  final class AccumulatorJob(T, alias accumulator) if (
    isAccumulator!(T, accumulator)
  ) : TFuture!(AccumulatorResult!(T, accumulator)) {
    this(TFuture!T[] futures, TCancellationOrigin childCancellation) {
      futures_ = futures;
      childCancellation_ = childCancellation;
      resultMutex_ = new Mutex;
      completionEvent_ = new TOneshotEvent;

      foreach (future; futures) {
        future.completion.addCallback({
          auto f = future;
          return {
            synchronized (resultMutex_) {
              if (f.status == TFutureStatus.CANCELLED) {
                if (!finished_) {
                  status_ = TFutureStatus.CANCELLED;
                  finished_ = true;
                }
                return;
              }

              if (f.status == TFutureStatus.FAILED) {
                exceptions_ ~= f.getException();
              } else {
                results_ ~= f.get();
              }

              if (results_.length + exceptions_.length == futures_.length) {
                finished_ = true;
                completionEvent_.trigger();
              }
            }
          };
        }());
      }
    }

    TFutureStatus status() @property {
      synchronized (resultMutex_) {
        if (!finished_) return TFutureStatus.RUNNING;
        if (status_ != TFutureStatus.RUNNING) return status_;

        try {
          result_ = invokeAccumulator!accumulator(results_, exceptions_);
          status_ = TFutureStatus.SUCCEEDED;
        } catch (Exception e) {
          exception_ = e;
          status_ = TFutureStatus.FAILED;
        }

        return status_;
      }
    }

    TAwaitable completion() @property {
      return completionEvent_;
    }

    AccumulatorResult!(T, accumulator) get() {
      auto s = status;

      enforce(s != TFutureStatus.RUNNING,
        new TFutureException("Operation not yet completed."));

      if (s == TFutureStatus.CANCELLED) throw new TCancelledException;
      if (s == TFutureStatus.FAILED) throw exception_;
      return result_;
    }

    Exception getException() {
      auto s = status;
      enforce(s != TFutureStatus.RUNNING,
        new TFutureException("Operation not yet completed."));

      if (s == TFutureStatus.CANCELLED) throw new TCancelledException;

      if (s == TFutureStatus.SUCCEEDED) {
        return null;
      }
      return exception_;
    }

    void finish() {
      synchronized (resultMutex_) {
        if (!finished_) {
          finished_ = true;
          childCancellation_.trigger();
          completionEvent_.trigger();
        }
      }
    }

    auto finishGet() {
      finish();
      return get();
    }

  private:
    TFuture!T[] futures_;
    TCancellationOrigin childCancellation_;

    bool finished_;
    T[] results_;
    Exception[] exceptions_;

    TFutureStatus status_;
    Mutex resultMutex_;
    union {
      AccumulatorResult!(T, accumulator) result_;
      Exception exception_;
    }
    TOneshotEvent completionEvent_;
  }

  auto invokeAccumulator(alias accumulator, T)(
    T[] values, Exception[] exceptions
  ) if (
    isAccumulator!(T, accumulator)
  ) {
    static if (is(typeof(accumulator(values, exceptions)))) {
      return accumulator(values, exceptions);
    } else {
      return accumulator(values);
    }
  }

  template AccumulatorResult(T, alias acc) {
    alias typeof(invokeAccumulator!acc(cast(T[])[], cast(Exception[])[]))
      AccumulatorResult;
  }
}
