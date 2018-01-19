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
module thrift.util.cancellation;

import core.atomic;
import thrift.base;
import thrift.util.awaitable;

/**
 * A cancellation request for asynchronous or blocking synchronous operations.
 *
 * It is passed to the entity creating an operation, which will usually monitor
 * it either by polling or by adding event handlers, and cancel the operation
 * if it is triggered.
 *
 * For synchronous operations, this usually means either throwing a
 * TCancelledException or immediately returning, depending on whether
 * cancellation is an expected part of the task outcome or not. For
 * asynchronous operations, cancellation typically entails stopping background
 * work and cancelling a result future, if not already completed.
 *
 * An operation accepting a TCancellation does not need to guarantee that it
 * will actually be able to react to the cancellation request.
 */
interface TCancellation {
  /**
   * Whether the cancellation request has been triggered.
   */
  bool triggered() const @property;

  /**
   * Throws a TCancelledException if the cancellation request has already been
   * triggered.
   */
  void throwIfTriggered() const;

  /**
   * A TAwaitable that can be used to wait for cancellation triggering.
   */
  TAwaitable triggering() @property;
}

/**
 * The origin of a cancellation request, which provides a way to actually
 * trigger it.
 *
 * This design allows operations to pass the TCancellation on to sub-tasks,
 * while making sure that the cancellation can only be triggered by the
 * »outermost« instance waiting for the result.
 */
final class TCancellationOrigin : TCancellation {
  this() {
    event_ = new TOneshotEvent;
  }

  /**
   * Triggers the cancellation request.
   */
  void trigger() {
    atomicStore(triggered_, true);
    event_.trigger();
  }

  /+override+/ bool triggered() const @property {
    return atomicLoad(triggered_);
  }

  /+override+/ void throwIfTriggered() const {
    if (triggered) throw new TCancelledException;
  }

  /+override+/ TAwaitable triggering() @property {
    return event_;
  }

private:
  shared bool triggered_;
  TOneshotEvent event_;
}

///
class TCancelledException : TException {
  ///
  this(string msg = null, string file = __FILE__, size_t line = __LINE__,
    Throwable next = null
  ) {
    super(msg ? msg : "The operation has been cancelled.", file, line, next);
  }
}
