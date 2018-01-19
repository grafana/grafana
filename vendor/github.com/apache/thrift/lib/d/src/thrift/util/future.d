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
module thrift.util.future;

import core.atomic;
import core.sync.condition;
import core.sync.mutex;
import core.time : Duration;
import std.array : empty, front, popFront;
import std.conv : to;
import std.exception : enforce;
import std.traits : BaseTypeTuple, isSomeFunction, ParameterTypeTuple, ReturnType;
import thrift.base;
import thrift.util.awaitable;
import thrift.util.cancellation;

/**
 * Represents an operation which is executed asynchronously and the result of
 * which will become available at some point in the future.
 *
 * Once a operation is completed, the result of the operation can be fetched
 * via the get() family of methods. There are three possible cases: Either the
 * operation succeeded, then its return value is returned, or it failed by
 * throwing, in which case the exception is rethrown, or it was cancelled
 * before, then a TCancelledException is thrown. There might be TFuture
 * implementations which never possibly enter the cancelled state.
 *
 * All methods are thread-safe, but keep in mind that any exception object or
 * result (if it is a reference type, of course) is shared between all
 * get()-family invocations.
 */
interface TFuture(ResultType) {
  /**
   * The status the operation is currently in.
   *
   * An operation starts out in RUNNING status, and changes state to one of the
   * others at most once afterwards.
   */
  TFutureStatus status() @property;

  /**
   * A TAwaitable triggered when the operation leaves the RUNNING status.
   */
  TAwaitable completion() @property;

  /**
   * Convenience shorthand for waiting until the result is available and then
   * get()ing it.
   *
   * If the operation has already completed, the result is immediately
   * returned.
   *
   * The result of this method is »alias this«'d to the interface, so that
   * TFuture can be used as a drop-in replacement for a simple value in
   * synchronous code.
   */
  final ResultType waitGet() {
    completion.wait();
    return get();
  }
  final @property auto waitGetProperty() { return waitGet(); }
  alias waitGetProperty this;

  /**
   * Convenience shorthand for waiting until the result is available and then
   * get()ing it.
   *
   * If the operation completes in time, returns its result (resp. throws an
   * exception for the failed/cancelled cases). If not, throws a
   * TFutureException.
   */
  final ResultType waitGet(Duration timeout) {
    enforce(completion.wait(timeout), new TFutureException(
      "Operation did not complete in time."));
    return get();
  }

  /**
   * Returns the result of the operation.
   *
   * Throws: TFutureException if the operation has been cancelled,
   *   TCancelledException if it is not yet done; the set exception if it
   *   failed.
   */
  ResultType get();

  /**
   * Returns the captured exception if the operation failed, or null otherwise.
   *
   * Throws: TFutureException if not yet done, TCancelledException if the
   *   operation has been cancelled.
   */
  Exception getException();
}

/**
 * The states the operation offering a future interface can be in.
 */
enum TFutureStatus : byte {
  RUNNING, /// The operation is still running.
  SUCCEEDED, /// The operation completed without throwing an exception.
  FAILED, /// The operation completed by throwing an exception.
  CANCELLED /// The operation was cancelled.
}

/**
 * A TFuture covering the simple but common case where the result is simply
 * set by a call to succeed()/fail().
 *
 * All methods are thread-safe, but usually, succeed()/fail() are only called
 * from a single thread (different from the thread(s) waiting for the result
 * using the TFuture interface, though).
 */
class TPromise(ResultType) : TFuture!ResultType {
  this() {
    statusMutex_ = new Mutex;
    completionEvent_ = new TOneshotEvent;
  }

  override S status() const @property {
    return atomicLoad(status_);
  }

  override TAwaitable completion() @property {
    return completionEvent_;
  }

  override ResultType get() {
    auto s = atomicLoad(status_);
    enforce(s != S.RUNNING,
      new TFutureException("Operation not yet completed."));

    if (s == S.CANCELLED) throw new TCancelledException;
    if (s == S.FAILED) throw exception_;

    static if (!is(ResultType == void)) {
      return result_;
    }
  }

  override Exception getException() {
    auto s = atomicLoad(status_);
    enforce(s != S.RUNNING,
      new TFutureException("Operation not yet completed."));

    if (s == S.CANCELLED) throw new TCancelledException;
    if (s == S.SUCCEEDED) return null;

    return exception_;
  }

  static if (!is(ResultType == void)) {
    /**
     * Sets the result of the operation, marks it as done, and notifies any
     * waiters.
     *
     * If the operation has been cancelled before, nothing happens.
     *
     * Throws: TFutureException if the operation is already completed.
     */
    void succeed(ResultType result) {
      synchronized (statusMutex_) {
        auto s = atomicLoad(status_);
        if (s == S.CANCELLED) return;

        enforce(s == S.RUNNING,
          new TFutureException("Operation already completed."));
        result_ = result;

        atomicStore(status_, S.SUCCEEDED);
      }

      completionEvent_.trigger();
    }
  } else {
    void succeed() {
      synchronized (statusMutex_) {
        auto s = atomicLoad(status_);
        if (s == S.CANCELLED) return;

        enforce(s == S.RUNNING,
          new TFutureException("Operation already completed."));

        atomicStore(status_, S.SUCCEEDED);
      }

      completionEvent_.trigger();
    }
  }

  /**
   * Marks the operation as failed with the specified exception and notifies
   * any waiters.
   *
   * If the operation was already cancelled, nothing happens.
   *
   * Throws: TFutureException if the operation is already completed.
   */
  void fail(Exception exception) {
    synchronized (statusMutex_) {
      auto status = atomicLoad(status_);
      if (status == S.CANCELLED) return;

      enforce(status == S.RUNNING,
        new TFutureException("Operation already completed."));
      exception_ = exception;

      atomicStore(status_, S.FAILED);
    }

    completionEvent_.trigger();
  }


  /**
   * Marks this operation as completed and takes over the outcome of another
   * TFuture of the same type.
   *
   * If this operation was already cancelled, nothing happens. If the other
   * operation was cancelled, this operation is marked as failed with a
   * TCancelledException.
   *
   * Throws: TFutureException if the passed in future was not completed or
   *   this operation is already completed.
   */
  void complete(TFuture!ResultType future) {
    synchronized (statusMutex_) {
      auto status = atomicLoad(status_);
      if (status == S.CANCELLED) return;
      enforce(status == S.RUNNING,
        new TFutureException("Operation already completed."));

      enforce(future.status != S.RUNNING, new TFutureException(
        "The passed TFuture is not yet completed."));

      status = future.status;
      if (status == S.CANCELLED) {
        status = S.FAILED;
        exception_ = new TCancelledException;
      } else if (status == S.FAILED) {
        exception_ = future.getException();
      } else static if (!is(ResultType == void)) {
        result_ = future.get();
      }

      atomicStore(status_, status);
    }

    completionEvent_.trigger();
  }

  /**
   * Marks this operation as cancelled and notifies any waiters.
   *
   * If the operation is already completed, nothing happens.
   */
  void cancel() {
    synchronized (statusMutex_) {
      auto status = atomicLoad(status_);
      if (status == S.RUNNING) atomicStore(status_, S.CANCELLED);
    }

    completionEvent_.trigger();
  }

private:
  // Convenience alias because TFutureStatus is ubiquitous in this class.
  alias TFutureStatus S;

  // The status the promise is currently in.
  shared S status_;

  union {
    static if (!is(ResultType == void)) {
      // Set if status_ is SUCCEEDED.
      ResultType result_;
    }
    // Set if status_ is FAILED.
    Exception exception_;
  }

  // Protects status_.
  // As for result_ and exception_: They are only set once, while status_ is
  // still RUNNING, so given that the operation has already completed, reading
  // them is safe without holding some kind of lock.
  Mutex statusMutex_;

  // Triggered when the event completes.
  TOneshotEvent completionEvent_;
}

///
class TFutureException : TException {
  ///
  this(string msg = "", string file = __FILE__, size_t line = __LINE__,
    Throwable next = null)
  {
    super(msg, file, line, next);
  }
}

/**
 * Creates an interface that is similar to a given one, but accepts an
 * additional, optional TCancellation parameter each method, and returns
 * TFutures instead of plain return values.
 *
 * For example, given the following declarations:
 * ---
 * interface Foo {
 *   void bar();
 *   string baz(int a);
 * }
 * alias TFutureInterface!Foo FutureFoo;
 * ---
 *
 * FutureFoo would be equivalent to:
 * ---
 * interface FutureFoo {
 *   TFuture!void bar(TCancellation cancellation = null);
 *   TFuture!string baz(int a, TCancellation cancellation = null);
 * }
 * ---
 */
template TFutureInterface(Interface) if (is(Interface _ == interface)) {
  mixin({
    string code = "interface TFutureInterface \n";

    static if (is(Interface Bases == super) && Bases.length > 0) {
      code ~= ": ";
      foreach (i; 0 .. Bases.length) {
        if (i > 0) code ~= ", ";
        code ~= "TFutureInterface!(BaseTypeTuple!Interface[" ~ to!string(i) ~ "]) ";
      }
    }

    code ~= "{\n";

    foreach (methodName; __traits(derivedMembers, Interface)) {
      enum qn = "Interface." ~ methodName;
      static if (isSomeFunction!(mixin(qn))) {
        code ~= "TFuture!(ReturnType!(" ~ qn ~ ")) " ~ methodName ~
          "(ParameterTypeTuple!(" ~ qn ~ "), TCancellation cancellation = null);\n";
      }
    }

    code ~= "}\n";
    return code;
  }());
}

/**
 * An input range that aggregates results from multiple asynchronous operations,
 * returning them in the order they arrive.
 *
 * Additionally, a timeout can be set after which results from not yet finished
 * futures will no longer be waited for, e.g. to ensure the time it takes to
 * iterate over a set of results is limited.
 */
final class TFutureAggregatorRange(T) {
  /**
   * Constructs a new instance.
   *
   * Params:
   *   futures = The set of futures to collect results from.
   *   timeout = If positive, not yet finished futures will be cancelled and
   *     their results will not be taken into account.
   */
  this(TFuture!T[] futures, TCancellationOrigin childCancellation,
    Duration timeout = dur!"hnsecs"(0)
  ) {
    if (timeout > dur!"hnsecs"(0)) {
      timeoutSysTick_ = TickDuration.currSystemTick +
        TickDuration.from!"hnsecs"(timeout.total!"hnsecs");
    } else {
      timeoutSysTick_ = TickDuration(0);
    }

    queueMutex_ = new Mutex;
    queueNonEmptyCondition_ = new Condition(queueMutex_);
    futures_ = futures;
    childCancellation_ = childCancellation;

    foreach (future; futures_) {
      future.completion.addCallback({
        auto f = future;
        return {
          if (f.status == TFutureStatus.CANCELLED) return;
          assert(f.status != TFutureStatus.RUNNING);

          synchronized (queueMutex_) {
            completedQueue_ ~= f;

            if (completedQueue_.length == 1) {
              queueNonEmptyCondition_.notifyAll();
            }
          }
        };
      }());
    }
  }

  /**
   * Whether the range is empty.
   *
   * This is the case if the results from the completed futures not having
   * failed have already been popped and either all future have been finished
   * or the timeout has expired.
   *
   * Potentially blocks until a new result is available or the timeout has
   * expired.
   */
  bool empty() @property {
    if (finished_) return true;
    if (bufferFilled_) return false;

    while (true) {
      TFuture!T future;
      synchronized (queueMutex_) {
        // The while loop is just being cautious about spurious wakeups, in
        // case they should be possible.
        while (completedQueue_.empty) {
          auto remaining = to!Duration(timeoutSysTick_ -
            TickDuration.currSystemTick);

          if (remaining <= dur!"hnsecs"(0)) {
            // No time left, but still no element received – we are empty now.
            finished_ = true;
            childCancellation_.trigger();
            return true;
          }

          queueNonEmptyCondition_.wait(remaining);
        }

        future = completedQueue_.front;
        completedQueue_.popFront();
      }

      ++completedCount_;
      if (completedCount_ == futures_.length) {
        // This was the last future in the list, there is no possibility
        // another result could ever become available.
        finished_ = true;
      }

      if (future.status == TFutureStatus.FAILED) {
        // This one failed, loop again and try getting another item from
        // the queue.
        exceptions_ ~= future.getException();
      } else {
        resultBuffer_ = future.get();
        bufferFilled_ = true;
        return false;
      }
    }
  }

  /**
   * Returns the first element from the range.
   *
   * Potentially blocks until a new result is available or the timeout has
   * expired.
   *
   * Throws: TException if the range is empty.
   */
  T front() {
    enforce(!empty, new TException(
      "Cannot get front of an empty future aggregator range."));
    return resultBuffer_;
  }

  /**
   * Removes the first element from the range.
   *
   * Potentially blocks until a new result is available or the timeout has
   * expired.
   *
   * Throws: TException if the range is empty.
   */
  void popFront() {
    enforce(!empty, new TException(
      "Cannot pop front of an empty future aggregator range."));
    bufferFilled_ = false;
  }

  /**
   * The number of futures the result of which has been returned or which have
   * failed so far.
   */
  size_t completedCount() @property const {
    return completedCount_;
  }

  /**
   * The exceptions collected from failed TFutures so far.
   */
  Exception[] exceptions() @property {
    return exceptions_;
  }

private:
  TFuture!T[] futures_;
  TCancellationOrigin childCancellation_;

  // The system tick this operation will time out, or zero if no timeout has
  // been set.
  TickDuration timeoutSysTick_;

  bool finished_;

  bool bufferFilled_;
  T resultBuffer_;

  Exception[] exceptions_;
  size_t completedCount_;

  // The queue of completed futures. This (and the associated condition) are
  // the only parts of this class that are accessed by multiple threads.
  TFuture!T[] completedQueue_;
  Mutex queueMutex_;
  Condition queueNonEmptyCondition_;
}

/**
 * TFutureAggregatorRange construction helper to avoid having to explicitly
 * specify the value type, i.e. to allow the constructor being called using IFTI
 * (see $(DMDBUG 6082, D Bugzilla enhancement requet 6082)).
 */
TFutureAggregatorRange!T tFutureAggregatorRange(T)(TFuture!T[] futures,
  TCancellationOrigin childCancellation, Duration timeout = dur!"hnsecs"(0)
) {
  return new TFutureAggregatorRange!T(futures, childCancellation, timeout);
}
