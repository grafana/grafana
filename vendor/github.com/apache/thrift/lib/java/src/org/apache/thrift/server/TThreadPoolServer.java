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

import java.util.Random;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import org.apache.thrift.TException;
import org.apache.thrift.TProcessor;
import org.apache.thrift.protocol.TProtocol;
import org.apache.thrift.transport.TSaslTransportException;
import org.apache.thrift.transport.TServerTransport;
import org.apache.thrift.transport.TTransport;
import org.apache.thrift.transport.TTransportException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


/**
 * Server which uses Java's built in ThreadPool management to spawn off
 * a worker pool that
 *
 */
public class TThreadPoolServer extends TServer {
  private static final Logger LOGGER = LoggerFactory.getLogger(TThreadPoolServer.class.getName());

  public static class Args extends AbstractServerArgs<Args> {
    public int minWorkerThreads = 5;
    public int maxWorkerThreads = Integer.MAX_VALUE;
    public ExecutorService executorService;
    public int stopTimeoutVal = 60;
    public TimeUnit stopTimeoutUnit = TimeUnit.SECONDS;
    public int requestTimeout = 20;
    public TimeUnit requestTimeoutUnit = TimeUnit.SECONDS;
    public int beBackoffSlotLength = 100;
    public TimeUnit beBackoffSlotLengthUnit = TimeUnit.MILLISECONDS;

    public Args(TServerTransport transport) {
      super(transport);
    }

    public Args minWorkerThreads(int n) {
      minWorkerThreads = n;
      return this;
    }

    public Args maxWorkerThreads(int n) {
      maxWorkerThreads = n;
      return this;
    }

    public Args stopTimeoutVal(int n) {
      stopTimeoutVal = n;
      return this;
    }

    public Args requestTimeout(int n) {
      requestTimeout = n;
      return this;
    }

    public Args requestTimeoutUnit(TimeUnit tu) {
      requestTimeoutUnit = tu;
      return this;
    }
    //Binary exponential backoff slot length
    public Args beBackoffSlotLength(int n) {
      beBackoffSlotLength = n;
      return this;
    }

    //Binary exponential backoff slot time unit
    public Args beBackoffSlotLengthUnit(TimeUnit tu) {
      beBackoffSlotLengthUnit = tu;
      return this;
    }

    public Args executorService(ExecutorService executorService) {
      this.executorService = executorService;
      return this;
    }
  }

  // Executor service for handling client connections
  private ExecutorService executorService_;

  private final TimeUnit stopTimeoutUnit;

  private final long stopTimeoutVal;

  private final TimeUnit requestTimeoutUnit;

  private final long requestTimeout;

  private final long beBackoffSlotInMillis;

  private Random random = new Random(System.currentTimeMillis());

  public TThreadPoolServer(Args args) {
    super(args);

    stopTimeoutUnit = args.stopTimeoutUnit;
    stopTimeoutVal = args.stopTimeoutVal;
    requestTimeoutUnit = args.requestTimeoutUnit;
    requestTimeout = args.requestTimeout;
    beBackoffSlotInMillis = args.beBackoffSlotLengthUnit.toMillis(args.beBackoffSlotLength);

    executorService_ = args.executorService != null ?
        args.executorService : createDefaultExecutorService(args);
  }

  private static ExecutorService createDefaultExecutorService(Args args) {
    SynchronousQueue<Runnable> executorQueue =
      new SynchronousQueue<Runnable>();
    return new ThreadPoolExecutor(args.minWorkerThreads,
                                  args.maxWorkerThreads,
                                  args.stopTimeoutVal,
                                  TimeUnit.SECONDS,
                                  executorQueue);
  }


  public void serve() {
    try {
      serverTransport_.listen();
    } catch (TTransportException ttx) {
      LOGGER.error("Error occurred during listening.", ttx);
      return;
    }

    // Run the preServe event
    if (eventHandler_ != null) {
      eventHandler_.preServe();
    }

    stopped_ = false;
    setServing(true);
    int failureCount = 0;
    while (!stopped_) {
      try {
        TTransport client = serverTransport_.accept();
        WorkerProcess wp = new WorkerProcess(client);

        int retryCount = 0;
        long remainTimeInMillis = requestTimeoutUnit.toMillis(requestTimeout);
        while(true) {
          try {
            executorService_.execute(wp);
            break;
          } catch(Throwable t) {
            if (t instanceof RejectedExecutionException) {
              retryCount++;
              try {
                if (remainTimeInMillis > 0) {
                  //do a truncated 20 binary exponential backoff sleep
                  long sleepTimeInMillis = ((long) (random.nextDouble() *
                      (1L << Math.min(retryCount, 20)))) * beBackoffSlotInMillis;
                  sleepTimeInMillis = Math.min(sleepTimeInMillis, remainTimeInMillis);
                  TimeUnit.MILLISECONDS.sleep(sleepTimeInMillis);
                  remainTimeInMillis = remainTimeInMillis - sleepTimeInMillis;
                } else {
                  client.close();
                  wp = null;
                  LOGGER.warn("Task has been rejected by ExecutorService " + retryCount
                      + " times till timedout, reason: " + t);
                  break;
                }
              } catch (InterruptedException e) {
                LOGGER.warn("Interrupted while waiting to place client on executor queue.");
                Thread.currentThread().interrupt();
                break;
              }
            } else if (t instanceof Error) {
              LOGGER.error("ExecutorService threw error: " + t, t);
              throw (Error)t;
            } else {
              //for other possible runtime errors from ExecutorService, should also not kill serve
              LOGGER.warn("ExecutorService threw error: " + t, t);
              break;
            }
          }
        }
      } catch (TTransportException ttx) {
        if (!stopped_) {
          ++failureCount;
          LOGGER.warn("Transport error occurred during acceptance of message.", ttx);
        }
      }
    }

    executorService_.shutdown();

    // Loop until awaitTermination finally does return without a interrupted
    // exception. If we don't do this, then we'll shut down prematurely. We want
    // to let the executorService clear it's task queue, closing client sockets
    // appropriately.
    long timeoutMS = stopTimeoutUnit.toMillis(stopTimeoutVal);
    long now = System.currentTimeMillis();
    while (timeoutMS >= 0) {
      try {
        executorService_.awaitTermination(timeoutMS, TimeUnit.MILLISECONDS);
        break;
      } catch (InterruptedException ix) {
        long newnow = System.currentTimeMillis();
        timeoutMS -= (newnow - now);
        now = newnow;
      }
    }
    setServing(false);
  }

  public void stop() {
    stopped_ = true;
    serverTransport_.interrupt();
  }

  private class WorkerProcess implements Runnable {

    /**
     * Client that this services.
     */
    private TTransport client_;

    /**
     * Default constructor.
     *
     * @param client Transport to process
     */
    private WorkerProcess(TTransport client) {
      client_ = client;
    }

    /**
     * Loops on processing a client forever
     */
    public void run() {
      TProcessor processor = null;
      TTransport inputTransport = null;
      TTransport outputTransport = null;
      TProtocol inputProtocol = null;
      TProtocol outputProtocol = null;

      TServerEventHandler eventHandler = null;
      ServerContext connectionContext = null;

      try {
        processor = processorFactory_.getProcessor(client_);
        inputTransport = inputTransportFactory_.getTransport(client_);
        outputTransport = outputTransportFactory_.getTransport(client_);
        inputProtocol = inputProtocolFactory_.getProtocol(inputTransport);
        outputProtocol = outputProtocolFactory_.getProtocol(outputTransport);	  

        eventHandler = getEventHandler();
        if (eventHandler != null) {
          connectionContext = eventHandler.createContext(inputProtocol, outputProtocol);
        }
        // we check stopped_ first to make sure we're not supposed to be shutting
        // down. this is necessary for graceful shutdown.
        while (true) {

            if (eventHandler != null) {
              eventHandler.processContext(connectionContext, inputTransport, outputTransport);
            }

            if(stopped_ || !processor.process(inputProtocol, outputProtocol)) {
              break;
            }
        }
      } catch (TSaslTransportException ttx) {
        // Something thats not SASL was in the stream, continue silently 
      } catch (TTransportException ttx) {
        // Assume the client died and continue silently
      } catch (TException tx) {
        LOGGER.error("Thrift error occurred during processing of message.", tx);
      } catch (Exception x) {
        LOGGER.error("Error occurred during processing of message.", x);
      } finally {
        if (eventHandler != null) {
          eventHandler.deleteContext(connectionContext, inputProtocol, outputProtocol);
        }
        if (inputTransport != null) {
          inputTransport.close();
        }
        if (outputTransport != null) {
          outputTransport.close();
        }
        if (client_.isOpen()) {
          client_.close();
        }
      }
    }
  }
}
