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
module thrift.async.libevent;

import core.atomic;
import core.time : Duration, dur;
import core.exception : onOutOfMemoryError;
import core.memory : GC;
import core.thread : Fiber, Thread;
import core.sync.condition;
import core.sync.mutex;
import core.stdc.stdlib : free, malloc;
import deimos.event2.event;
import std.array : empty, front, popFront;
import std.conv : text, to;
import std.exception : enforce;
import std.socket : Socket, socketPair;
import thrift.base;
import thrift.async.base;
import thrift.internal.socket;
import thrift.internal.traits;
import thrift.util.cancellation;

// To avoid DMD @@BUG6395@@.
import thrift.internal.algorithm;

/**
 * A TAsyncManager implementation based on libevent.
 *
 * The libevent loop for handling non-blocking sockets is run in a background
 * thread, which is lazily spawned. The thread is not daemonized to avoid
 * crashes on program shutdown, it is only stopped when the manager instance
 * is destroyed. So, to ensure a clean program teardown, either make sure this
 * instance gets destroyed (e.g. by using scope), or manually call stop() at
 * the end.
 */
class TLibeventAsyncManager : TAsyncSocketManager {
  this() {
    eventBase_ = event_base_new();

    // Set up the socket pair for transferring control messages to the event
    // loop.
    auto pair = socketPair();
    controlSendSocket_ = pair[0];
    controlReceiveSocket_ = pair[1];
    controlReceiveSocket_.blocking = false;

    // Register an event for receiving control messages.
    controlReceiveEvent_ = event_new(eventBase_, controlReceiveSocket_.handle,
      EV_READ | EV_PERSIST | EV_ET, assumeNothrow(&controlMsgReceiveCallback),
      cast(void*)this);
    event_add(controlReceiveEvent_, null);

    queuedCountMutex_ = new Mutex;
    zeroQueuedCondition_ = new Condition(queuedCountMutex_);
  }

  ~this() {
    // stop() should be safe to call, because either we don't have a worker
    // thread running and it is a no-op anyway, or it is guaranteed to be
    // still running (blocked in event_base_loop), and thus guaranteed not to
    // be garbage collected yet.
    stop(dur!"hnsecs"(0));

    event_free(controlReceiveEvent_);
    event_base_free(eventBase_);
    eventBase_ = null;
  }

  override void execute(TAsyncTransport transport, Work work,
    TCancellation cancellation = null
  ) {
    if (cancellation && cancellation.triggered) return;

    // Keep track that there is a new work item to be processed.
    incrementQueuedCount();

    ensureWorkerThreadRunning();

    // We should be able to send the control message as a whole – we currently
    // assume to be able to receive it at once as well. If this proves to be
    // unstable (e.g. send could possibly return early if the receiving buffer
    // is full and the blocking call gets interrupted by a signal), it could
    // be changed to a more sophisticated scheme.

    // Make sure the delegate context doesn't get GCd while the work item is
    // on the wire.
    GC.addRoot(work.ptr);

    // Send work message.
    sendControlMsg(ControlMsg(MsgType.WORK, work, transport));

    if (cancellation) {
      cancellation.triggering.addCallback({
        sendControlMsg(ControlMsg(MsgType.CANCEL, work, transport));
      });
    }
  }

  override void delay(Duration duration, void delegate() work) {
    incrementQueuedCount();

    ensureWorkerThreadRunning();

    const tv = toTimeval(duration);

    // DMD @@BUG@@: Cannot deduce T to void delegate() here.
    registerOneshotEvent!(void delegate())(
      -1, 0, assumeNothrow(&delayCallback), &tv,
      {
        work();
        decrementQueuedCount();
      }
    );
  }

  override bool stop(Duration waitFinishTimeout = dur!"hnsecs"(-1)) {
    bool cleanExit = true;

    synchronized (this) {
      if (workerThread_) {
        synchronized (queuedCountMutex_) {
          if (waitFinishTimeout > dur!"hnsecs"(0)) {
            if (queuedCount_ > 0) {
              zeroQueuedCondition_.wait(waitFinishTimeout);
            }
          } else if (waitFinishTimeout < dur!"hnsecs"(0)) {
            while (queuedCount_ > 0) zeroQueuedCondition_.wait();
          } else {
            // waitFinishTimeout is zero, immediately exit in all cases.
          }
          cleanExit = (queuedCount_ == 0);
        }

        event_base_loopbreak(eventBase_);
        sendControlMsg(ControlMsg(MsgType.SHUTDOWN));
        workerThread_.join();
        workQueues_ = null;
        // We have nuked all currently enqueued items, so set the count to
        // zero. This is safe to do without locking, since the worker thread
        // is down.
        queuedCount_ = 0;
        atomicStore(*(cast(shared)&workerThread_), cast(shared(Thread))null);
      }
    }

    return cleanExit;
  }

  override void addOneshotListener(Socket socket, TAsyncEventType eventType,
     TSocketEventListener listener
  ) {
    addOneshotListenerImpl(socket, eventType, null, listener);
  }

  override void addOneshotListener(Socket socket, TAsyncEventType eventType,
    Duration timeout, TSocketEventListener listener
  ) {
    if (timeout <= dur!"hnsecs"(0)) {
      addOneshotListenerImpl(socket, eventType, null, listener);
    } else {
      // This is not really documented well, but libevent does not require to
      // keep the timeval around after the event was added.
      auto tv = toTimeval(timeout);
      addOneshotListenerImpl(socket, eventType, &tv, listener);
    }
  }

private:
  alias void delegate() Work;

  void addOneshotListenerImpl(Socket socket, TAsyncEventType eventType,
     const(timeval)* timeout, TSocketEventListener listener
  ) {
    registerOneshotEvent(socket.handle, libeventEventType(eventType),
      assumeNothrow(&socketCallback), timeout, listener);
  }

  void registerOneshotEvent(T)(evutil_socket_t fd, short type,
    event_callback_fn callback, const(timeval)* timeout, T payload
  ) {
    // Create a copy of the payload on the C heap.
    auto payloadMem = malloc(payload.sizeof);
    if (!payloadMem) onOutOfMemoryError();
    (cast(T*)payloadMem)[0 .. 1] = payload;
    GC.addRange(payloadMem, payload.sizeof);

    auto result = event_base_once(eventBase_, fd, type, callback,
      payloadMem, timeout);

    // Assuming that we didn't get our arguments wrong above, the only other
    // situation in which event_base_once can fail is when it can't allocate
    // memory.
    if (result != 0) onOutOfMemoryError();
  }

  enum MsgType : ubyte {
    SHUTDOWN,
    WORK,
    CANCEL
  }

  struct ControlMsg {
    MsgType type;
    Work work;
    TAsyncTransport transport;
  }

  /**
   * Starts the worker thread if it is not already running.
   */
  void ensureWorkerThreadRunning() {
    // Technically, only half barriers would be required here, but adding the
    // argument seems to trigger a DMD template argument deduction @@BUG@@.
    if (!atomicLoad(*(cast(shared)&workerThread_))) {
      synchronized (this) {
        if (!workerThread_) {
          auto thread = new Thread({ event_base_loop(eventBase_, 0); });
          thread.start();
          atomicStore(*(cast(shared)&workerThread_), cast(shared)thread);
        }
      }
    }
  }

  /**
   * Sends a control message to the worker thread.
   */
  void sendControlMsg(const(ControlMsg) msg) {
    auto result = controlSendSocket_.send((&msg)[0 .. 1]);
    enum size = msg.sizeof;
    enforce(result == size, new TException(text(
      "Sending control message of type ", msg.type, " failed (", result,
      " bytes instead of ", size, " transmitted).")));
  }

  /**
   * Receives messages from the control message socket and acts on them. Called
   * from the worker thread.
   */
  void receiveControlMsg() {
    // Read as many new work items off the socket as possible (at least one
    // should be available, as we got notified by libevent).
    ControlMsg msg;
    ptrdiff_t bytesRead;
    while (true) {
      bytesRead = controlReceiveSocket_.receive(cast(ubyte[])((&msg)[0 .. 1]));

      if (bytesRead < 0) {
        auto errno = getSocketErrno();
        if (errno != WOULD_BLOCK_ERRNO) {
          logError("Reading control message, some work item will possibly " ~
            "never be executed: %s", socketErrnoString(errno));
        }
      }
      if (bytesRead != msg.sizeof) break;

      // Everything went fine, we received a new control message.
      final switch (msg.type) {
        case MsgType.SHUTDOWN:
          // The message was just intended to wake us up for shutdown.
          break;

        case MsgType.CANCEL:
          // When processing a cancellation, we must not touch the first item,
          // since it is already being processed.
          auto queue = workQueues_[msg.transport];
          if (queue.length > 0) {
            workQueues_[msg.transport] = [queue[0]] ~
              removeEqual(queue[1 .. $], msg.work);
          }
          break;

        case MsgType.WORK:
          // Now that the work item is back in the D world, we don't need the
          // extra GC root for the context pointer anymore (see execute()).
          GC.removeRoot(msg.work.ptr);

          // Add the work item to the queue and execute it.
          auto queue = msg.transport in workQueues_;
          if (queue is null || (*queue).empty) {
            // If the queue is empty, add the new work item to the queue as well,
            // but immediately start executing it.
            workQueues_[msg.transport] = [msg.work];
            executeWork(msg.transport, msg.work);
          } else {
            (*queue) ~= msg.work;
          }
          break;
      }
    }

    // If the last read was successful, but didn't read enough bytes, we got
    // a problem.
    if (bytesRead > 0) {
      logError("Unexpected partial control message read (%s byte(s) " ~
        "instead of %s), some work item will possibly never be executed.",
        bytesRead, msg.sizeof);
    }
  }

  /**
   * Executes the given work item and all others enqueued for the same
   * transport in a new fiber. Called from the worker thread.
   */
  void executeWork(TAsyncTransport transport, Work work) {
    (new Fiber({
      auto item = work;
      while (true) {
        try {
          // Execute the actual work. It will possibly add listeners to the
          // event loop and yield away if it has to wait for blocking
          // operations. It is quite possible that another fiber will modify
          // the work queue for the current transport.
          item();
        } catch (Exception e) {
          // This should never happen, just to be sure the worker thread
          // doesn't stop working in mysterious ways because of an unhandled
          // exception.
          logError("Exception thrown by work item: %s", e);
        }

        // Remove the item from the work queue.
        // Note: Due to the value semantics of array slices, we have to
        // re-lookup this on every iteration. This could be solved, but I'd
        // rather replace this directly with a queue type once one becomes
        // available in Phobos.
        auto queue = workQueues_[transport];
        assert(queue.front == item);
        queue.popFront();
        workQueues_[transport] = queue;

        // Now that the work item is done, no longer count it as queued.
        decrementQueuedCount();

        if (queue.empty) break;

        // If the queue is not empty, execute the next waiting item.
        item = queue.front;
      }
    })).call();
  }

  /**
   * Increments the amount of queued items.
   */
  void incrementQueuedCount() {
    synchronized (queuedCountMutex_) {
      ++queuedCount_;
    }
  }

  /**
   * Decrements the amount of queued items.
   */
  void decrementQueuedCount() {
    synchronized (queuedCountMutex_) {
      assert(queuedCount_ > 0);
      --queuedCount_;
      if (queuedCount_ == 0) {
        zeroQueuedCondition_.notifyAll();
      }
    }
  }

  static extern(C) void controlMsgReceiveCallback(evutil_socket_t, short,
    void *managerThis
  ) {
    (cast(TLibeventAsyncManager)managerThis).receiveControlMsg();
  }

  static extern(C) void socketCallback(evutil_socket_t, short flags,
    void *arg
  ) {
    auto reason = (flags & EV_TIMEOUT) ? TAsyncEventReason.TIMED_OUT :
      TAsyncEventReason.NORMAL;
    (*(cast(TSocketEventListener*)arg))(reason);
    GC.removeRange(arg);
    destroy(arg);
    free(arg);
  }

  static extern(C) void delayCallback(evutil_socket_t, short flags,
    void *arg
  ) {
    assert(flags & EV_TIMEOUT);
    (*(cast(void delegate()*)arg))();
    GC.removeRange(arg);
    destroy(arg);
    free(arg);
  }

  Thread workerThread_;

  event_base* eventBase_;

  /// The socket used for receiving new work items in the event loop. Paired
  /// with controlSendSocket_. Invalid (i.e. TAsyncWorkItem.init) items are
  /// ignored and can be used to wake up the worker thread.
  Socket controlReceiveSocket_;
  event* controlReceiveEvent_;

  /// The socket used to send new work items to the event loop. It is
  /// expected that work items can always be read at once from it, i.e. that
  /// there will never be short reads.
  Socket controlSendSocket_;

  /// Queued up work delegates for async transports. This also includes
  /// currently active ones, they are removed from the queue on completion,
  /// which is relied on by the control message receive fiber (the main one)
  /// to decide whether to immediately start executing items or not.
  // TODO: This should really be of some queue type, not an array slice, but
  // std.container doesn't have anything.
  Work[][TAsyncTransport] workQueues_;

  /// The total number of work items not yet finished (queued and currently
  /// executed) and delays not yet executed.
  uint queuedCount_;

  /// Protects queuedCount_.
  Mutex queuedCountMutex_;

  /// Triggered when queuedCount_ reaches zero, protected by queuedCountMutex_.
  Condition zeroQueuedCondition_;
}

private {
  timeval toTimeval(const(Duration) dur) {
    timeval tv;
    dur.split!("seconds", "usecs")(tv.tv_sec, tv.tv_usec);
    return tv;
  }

  /**
   * Returns the libevent flags combination to represent a given TAsyncEventType.
   */
  short libeventEventType(TAsyncEventType type) {
    final switch (type) {
      case TAsyncEventType.READ:
        return EV_READ | EV_ET;
      case TAsyncEventType.WRITE:
        return EV_WRITE | EV_ET;
    }
  }
}
