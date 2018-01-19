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
package org.apache.thrift.async;

import java.io.IOException;
import java.io.Serializable;
import java.nio.channels.ClosedSelectorException;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.spi.SelectorProvider;
import java.util.Comparator;
import java.util.Iterator;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.TimeoutException;

import org.apache.thrift.TException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Contains selector thread which transitions method call objects
 */
public class TAsyncClientManager {
  private static final Logger LOGGER = LoggerFactory.getLogger(TAsyncClientManager.class.getName());

  private final SelectThread selectThread;
  private final ConcurrentLinkedQueue<TAsyncMethodCall> pendingCalls = new ConcurrentLinkedQueue<TAsyncMethodCall>();

  public TAsyncClientManager() throws IOException {
    this.selectThread = new SelectThread();
    selectThread.start();
  }

  public void call(TAsyncMethodCall method) throws TException {
    if (!isRunning()) {
      throw new TException("SelectThread is not running");
    }
    method.prepareMethodCall();
    pendingCalls.add(method);
    selectThread.getSelector().wakeup();
  }

  public void stop() {
    selectThread.finish();
  }

  public boolean isRunning() {
    return selectThread.isAlive();
  }

  private class SelectThread extends Thread {
    private final Selector selector;
    private volatile boolean running;
    private final TreeSet<TAsyncMethodCall> timeoutWatchSet = new TreeSet<TAsyncMethodCall>(new TAsyncMethodCallTimeoutComparator());

    public SelectThread() throws IOException {
      this.selector = SelectorProvider.provider().openSelector();
      this.running = true;
      this.setName("TAsyncClientManager#SelectorThread " + this.getId());

      // We don't want to hold up the JVM when shutting down
      setDaemon(true);
    }

    public Selector getSelector() {
      return selector;
    }

    public void finish() {
      running = false;
      selector.wakeup();
    }

    public void run() {
      while (running) {
        try {
          try {
            if (timeoutWatchSet.size() == 0) {
              // No timeouts, so select indefinitely
              selector.select();
            } else {
              // We have a timeout pending, so calculate the time until then and select appropriately
              long nextTimeout = timeoutWatchSet.first().getTimeoutTimestamp();
              long selectTime = nextTimeout - System.currentTimeMillis();
              if (selectTime > 0) {
                // Next timeout is in the future, select and wake up then
                selector.select(selectTime);
              } else {
                // Next timeout is now or in past, select immediately so we can time out
                selector.selectNow();
              }
            }
          } catch (IOException e) {
            LOGGER.error("Caught IOException in TAsyncClientManager!", e);
          }
          transitionMethods();
          timeoutMethods();
          startPendingMethods();
        } catch (Exception exception) {
          LOGGER.error("Ignoring uncaught exception in SelectThread", exception);
        }
      }

      try {
        selector.close();
      } catch (IOException ex) {
        LOGGER.warn("Could not close selector. This may result in leaked resources!", ex);
      }
    }

    // Transition methods for ready keys
    private void transitionMethods() {
      try {
        Iterator<SelectionKey> keys = selector.selectedKeys().iterator();
        while (keys.hasNext()) {
          SelectionKey key = keys.next();
          keys.remove();
          if (!key.isValid()) {
            // this can happen if the method call experienced an error and the
            // key was cancelled. can also happen if we timeout a method, which
            // results in a channel close.
            // just skip
            continue;
          }
          TAsyncMethodCall methodCall = (TAsyncMethodCall)key.attachment();
          methodCall.transition(key);

          // If done or error occurred, remove from timeout watch set
          if (methodCall.isFinished() || methodCall.getClient().hasError()) {
            timeoutWatchSet.remove(methodCall);
          }
        }
      } catch (ClosedSelectorException e) {
        LOGGER.error("Caught ClosedSelectorException in TAsyncClientManager!", e);
      }
    }

    // Timeout any existing method calls
    private void timeoutMethods() {
      Iterator<TAsyncMethodCall> iterator = timeoutWatchSet.iterator();
      long currentTime = System.currentTimeMillis();
      while (iterator.hasNext()) {
        TAsyncMethodCall methodCall = iterator.next();
        if (currentTime >= methodCall.getTimeoutTimestamp()) {
          iterator.remove();
          methodCall.onError(new TimeoutException("Operation " + methodCall.getClass() + " timed out after " + (currentTime - methodCall.getStartTime()) + " ms."));
        } else {
          break;
        }
      }
    }

    // Start any new calls
    private void startPendingMethods() {
      TAsyncMethodCall methodCall;
      while ((methodCall = pendingCalls.poll()) != null) {
        // Catch registration errors. method will catch transition errors and cleanup.
        try {
          methodCall.start(selector);

          // If timeout specified and first transition went smoothly, add to timeout watch set
          TAsyncClient client = methodCall.getClient();
          if (client.hasTimeout() && !client.hasError()) {
            timeoutWatchSet.add(methodCall);
          }
        } catch (Exception exception) {
          LOGGER.warn("Caught exception in TAsyncClientManager!", exception);
          methodCall.onError(exception);
        }
      }
    }
  }

  /** Comparator used in TreeSet */
  private static class TAsyncMethodCallTimeoutComparator implements Comparator<TAsyncMethodCall>, Serializable {
    public int compare(TAsyncMethodCall left, TAsyncMethodCall right) {
      if (left.getTimeoutTimestamp() == right.getTimeoutTimestamp()) {
        return (int)(left.getSequenceId() - right.getSequenceId());
      } else {
        return (int)(left.getTimeoutTimestamp() - right.getTimeoutTimestamp());
      }
    }
  }
}
