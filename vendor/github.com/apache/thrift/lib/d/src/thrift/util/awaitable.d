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
module thrift.util.awaitable;

import core.sync.condition;
import core.sync.mutex;
import core.time : Duration;
import std.exception : enforce;
import std.socket/+ : Socket, socketPair+/; // DMD @@BUG314@@
import thrift.base;

// To avoid DMD @@BUG6395@@.
import thrift.internal.algorithm;

/**
 * An event that can occur at some point in the future and which can be
 * awaited, either by blocking until it occurs, or by registering a callback
 * delegate.
 */
interface TAwaitable {
  /**
   * Waits until the event occurs.
   *
   * Calling wait() for an event that has already occurred is a no-op.
   */
  void wait();

  /**
   * Waits until the event occurs or the specified timeout expires.
   *
   * Calling wait() for an event that has already occurred is a no-op.
   *
   * Returns: Whether the event was triggered before the timeout expired.
   */
  bool wait(Duration timeout);

  /**
   * Registers a callback that is called if the event occurs.
   *
   * The delegate will likely be invoked from a different thread, and is
   * expected not to perform expensive work as it will usually be invoked
   * synchronously by the notifying thread. The order in which registered
   * callbacks are invoked is not specified.
   *
   * The callback must never throw, but nothrow semantics are difficult to
   * enforce, so currently exceptions are just swallowed by
   * TAwaitable implementations.
   *
   * If the event has already occurred, the delegate is immediately executed
   * in the current thread.
   */
  void addCallback(void delegate() dg);

  /**
   * Removes a previously added callback.
   *
   * Returns: Whether the callback could be found in the list, i.e. whether it
   *   was previously added.
   */
  bool removeCallback(void delegate() dg);
}

/**
 * A simple TAwaitable event triggered by just calling a trigger() method.
 */
class TOneshotEvent : TAwaitable {
  this() {
    mutex_ = new Mutex;
    condition_ = new Condition(mutex_);
  }

  override void wait() {
    synchronized (mutex_) {
      while (!triggered_) condition_.wait();
    }
  }

  override bool wait(Duration timeout) {
    synchronized (mutex_) {
      if (triggered_) return true;
      condition_.wait(timeout);
      return triggered_;
    }
  }

  override void addCallback(void delegate() dg) {
    mutex_.lock();
    scope (failure) mutex_.unlock();

    callbacks_ ~= dg;

    if (triggered_) {
      mutex_.unlock();
      dg();
      return;
    }

    mutex_.unlock();
  }

  override bool removeCallback(void delegate() dg) {
    synchronized (mutex_) {
      auto oldLength = callbacks_.length;
      callbacks_ = removeEqual(callbacks_, dg);
      return callbacks_.length < oldLength;
    }
  }

  /**
   * Triggers the event.
   *
   * Any registered event callbacks are executed synchronously before the
   * function returns.
   */
  void trigger() {
    synchronized (mutex_) {
      if (!triggered_) {
        triggered_ = true;
        condition_.notifyAll();
        foreach (c; callbacks_) c();
      }
    }
  }

private:
  bool triggered_;
  Mutex mutex_;
  Condition condition_;
  void delegate()[] callbacks_;
}

/**
 * Translates TAwaitable events into dummy messages on a socket that can be
 * used e.g. to wake up from a select() call.
 */
final class TSocketNotifier {
  this() {
    auto socks = socketPair();
    foreach (s; socks) s.blocking = false;
    sendSocket_ = socks[0];
    recvSocket_ = socks[1];
  }

  /**
   * The socket the messages will be sent to.
   */
  Socket socket() @property {
    return recvSocket_;
  }

  /**
   * Atatches the socket notifier to the specified awaitable, causing it to
   * write a byte to the notification socket when the awaitable callbacks are
   * invoked.
   *
   * If the event has already been triggered, the dummy byte is written
   * immediately to the socket.
   *
   * A socket notifier can only be attached to a single awaitable at a time.
   *
   * Throws: TException if the socket notifier is already attached.
   */
  void attach(TAwaitable awaitable) {
    enforce(!awaitable_, new TException("Already attached."));
    awaitable.addCallback(&notify);
    awaitable_ = awaitable;
  }

  /**
   * Detaches the socket notifier from the awaitable it is currently attached
   * to.
   *
   * Throws: TException if the socket notifier is not currently attached.
   */
  void detach() {
    enforce(awaitable_, new TException("Not attached."));

    // Soak up any not currently read notification bytes.
    ubyte[1] dummy = void;
    while (recvSocket_.receive(dummy) != Socket.ERROR) {}

    auto couldRemove = awaitable_.removeCallback(&notify);
    assert(couldRemove);
    awaitable_ = null;
  }

private:
  void notify() {
    ubyte[1] zero;
    sendSocket_.send(zero);
  }

  TAwaitable awaitable_;
  Socket sendSocket_;
  Socket recvSocket_;
}
