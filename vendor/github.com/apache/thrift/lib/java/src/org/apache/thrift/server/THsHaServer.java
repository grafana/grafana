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


package org.apache.thrift.server;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import org.apache.thrift.transport.TNonblockingServerTransport;

/**
 * An extension of the TNonblockingServer to a Half-Sync/Half-Async server.
 * Like TNonblockingServer, it relies on the use of TFramedTransport.
 */
public class THsHaServer extends TNonblockingServer {

  public static class Args extends AbstractNonblockingServerArgs<Args> {
    public int minWorkerThreads = 5;
    public int maxWorkerThreads = Integer.MAX_VALUE;
    private int stopTimeoutVal = 60;
    private TimeUnit stopTimeoutUnit = TimeUnit.SECONDS;
    private ExecutorService executorService = null;

    public Args(TNonblockingServerTransport transport) {
      super(transport);
    }


    /**
     * Sets the min and max threads.
     *
     * @deprecated use {@link #minWorkerThreads(int)} and {@link #maxWorkerThreads(int)}  instead.
     */
    @Deprecated
    public Args workerThreads(int n) {
      minWorkerThreads = n;
      maxWorkerThreads = n;
      return this;
    }

    /**
     * @return what the min threads was set to.
     * @deprecated use {@link #getMinWorkerThreads()} and {@link #getMaxWorkerThreads()} instead.
     */
    @Deprecated
    public int getWorkerThreads() {
      return minWorkerThreads;
    }

    public Args minWorkerThreads(int n) {
      minWorkerThreads = n;
      return this;
    }

    public Args maxWorkerThreads(int n) {
      maxWorkerThreads = n;
      return this;
    }

    public int getMinWorkerThreads() {
      return minWorkerThreads;
    }

    public int getMaxWorkerThreads() {
      return maxWorkerThreads;
    }

    public int getStopTimeoutVal() {
      return stopTimeoutVal;
    }

    public Args stopTimeoutVal(int stopTimeoutVal) {
      this.stopTimeoutVal = stopTimeoutVal;
      return this;
    }

    public TimeUnit getStopTimeoutUnit() {
      return stopTimeoutUnit;
    }

    public Args stopTimeoutUnit(TimeUnit stopTimeoutUnit) {
      this.stopTimeoutUnit = stopTimeoutUnit;
      return this;
    }

    public ExecutorService getExecutorService() {
      return executorService;
    }

    public Args executorService(ExecutorService executorService) {
      this.executorService = executorService;
      return this;
    }
  }


  // This wraps all the functionality of queueing and thread pool management
  // for the passing of Invocations from the Selector to workers.
  private final ExecutorService invoker;

  private final Args args;

  /**
   * Create the server with the specified Args configuration
   */
  public THsHaServer(Args args) {
    super(args);

    invoker = args.executorService == null ? createInvokerPool(args) : args.executorService;
    this.args = args;
  }

  /**
   * {@inheritDoc}
   */
  @Override
  protected void waitForShutdown() {
    joinSelector();
    gracefullyShutdownInvokerPool();
  }

  /**
   * Helper to create an invoker pool
   */
  protected static ExecutorService createInvokerPool(Args options) {
    int minWorkerThreads = options.minWorkerThreads;
    int maxWorkerThreads = options.maxWorkerThreads;
    int stopTimeoutVal = options.stopTimeoutVal;
    TimeUnit stopTimeoutUnit = options.stopTimeoutUnit;

    LinkedBlockingQueue<Runnable> queue = new LinkedBlockingQueue<Runnable>();
    ExecutorService invoker = new ThreadPoolExecutor(minWorkerThreads,
      maxWorkerThreads, stopTimeoutVal, stopTimeoutUnit, queue);

    return invoker;
  }


  protected void gracefullyShutdownInvokerPool() {
    // try to gracefully shut down the executor service
    invoker.shutdown();

    // Loop until awaitTermination finally does return without a interrupted
    // exception. If we don't do this, then we'll shut down prematurely. We want
    // to let the executorService clear it's task queue, closing client sockets
    // appropriately.
    long timeoutMS = args.stopTimeoutUnit.toMillis(args.stopTimeoutVal);
    long now = System.currentTimeMillis();
    while (timeoutMS >= 0) {
      try {
        invoker.awaitTermination(timeoutMS, TimeUnit.MILLISECONDS);
        break;
      } catch (InterruptedException ix) {
        long newnow = System.currentTimeMillis();
        timeoutMS -= (newnow - now);
        now = newnow;
      }
    }
  }

  /**
   * We override the standard invoke method here to queue the invocation for
   * invoker service instead of immediately invoking. The thread pool takes care
   * of the rest.
   */
  @Override
  protected boolean requestInvoke(FrameBuffer frameBuffer) {
    try {
      Runnable invocation = getRunnable(frameBuffer);
      invoker.execute(invocation);
      return true;
    } catch (RejectedExecutionException rx) {
      LOGGER.warn("ExecutorService rejected execution!", rx);
      return false;
    }
  }

  protected Runnable getRunnable(FrameBuffer frameBuffer){
    return new Invocation(frameBuffer);
  }
}
