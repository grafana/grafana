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
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import junit.framework.TestCase;

import org.apache.thrift.TException;
import org.apache.thrift.protocol.TBinaryProtocol;
import org.apache.thrift.server.ServerTestBase;
import org.apache.thrift.server.THsHaServer;
import org.apache.thrift.server.THsHaServer.Args;
import org.apache.thrift.transport.TNonblockingServerSocket;
import org.apache.thrift.transport.TNonblockingSocket;

import thrift.test.CompactProtoTestStruct;
import thrift.test.ExceptionWithAMap;
import thrift.test.Srv;
import thrift.test.Srv.Iface;

public class TestTAsyncClientManager extends TestCase {

  private THsHaServer server_;
  private Thread serverThread_;
  private TAsyncClientManager clientManager_;

  public void setUp() throws Exception {
    server_ = new THsHaServer(new Args(new TNonblockingServerSocket(
      new TNonblockingServerSocket.NonblockingAbstractServerSocketArgs().port(ServerTestBase.PORT))).
      processor(new Srv.Processor(new SrvHandler())));
    serverThread_ = new Thread(new Runnable() {
      public void run() {
        server_.serve();
      }
    });
    serverThread_.start();
    clientManager_ = new TAsyncClientManager();
    Thread.sleep(500);
  }

  public void tearDown() throws Exception {
    server_.stop();
    clientManager_.stop();
    serverThread_.join();
  }

  public void testBasicCall() throws Exception {
    Srv.AsyncClient client = getClient();
    basicCall(client);
  }

  public void testBasicCallWithTimeout() throws Exception {
    Srv.AsyncClient client = getClient();
    client.setTimeout(5000);
    basicCall(client);
  }

  private static abstract class ErrorCallTest<C extends TAsyncClient, R> {
    final void runTest() throws Exception {
      final CountDownLatch latch = new CountDownLatch(1);
      final AtomicReference<Exception> error = new AtomicReference<Exception>();
      C client = executeErroringCall(new AsyncMethodCallback<R>() {
        @Override
        public void onComplete(R response) {
          latch.countDown();
        }

        @Override
        public void onError(Exception exception) {
          error.set(exception);
          latch.countDown();
        }
      });
      latch.await(2, TimeUnit.SECONDS);
      assertTrue(client.hasError());
      Exception exception = error.get();
      assertNotNull(exception);
      assertSame(exception, client.getError());
      validateError(client, exception);
    }

    /**
     * Executes a call that is expected to raise an exception.
     *
     * @param callback The testing callback that should be installed.
     * @return The client the call was made against.
     * @throws Exception if there was a problem setting up the client or making the call.
     */
    abstract C executeErroringCall(AsyncMethodCallback<R> callback) throws Exception;

    /**
     * Further validates the properties of the error raised in the remote call and the state of the
     * client after that call.
     *
     * @param client The client returned from {@link #executeErroringCall(AsyncMethodCallback)}.
     * @param error The exception raised by the remote call.
     */
    abstract void validateError(C client, Exception error);
  }

  public void testUnexpectedRemoteExceptionCall() throws Exception {
    new ErrorCallTest<Srv.AsyncClient, Boolean>() {
      @Override
      Srv.AsyncClient executeErroringCall(AsyncMethodCallback<Boolean> callback) throws Exception {
        Srv.AsyncClient client = getClient();
        client.declaredExceptionMethod(false, callback);
        return client;
      }

      @Override
      void validateError(Srv.AsyncClient client, Exception error) {
        assertFalse(client.hasTimeout());
        assertTrue(error instanceof TException);
      }
    }.runTest();
  }

  public void testDeclaredRemoteExceptionCall() throws Exception {
    new ErrorCallTest<Srv.AsyncClient, Boolean>() {
      @Override
      Srv.AsyncClient executeErroringCall(AsyncMethodCallback<Boolean> callback) throws Exception {
        Srv.AsyncClient client = getClient();
        client.declaredExceptionMethod(true, callback);
        return client;
      }

      @Override
      void validateError(Srv.AsyncClient client, Exception error) {
        assertFalse(client.hasTimeout());
        assertEquals(ExceptionWithAMap.class, error.getClass());
        ExceptionWithAMap exceptionWithAMap = (ExceptionWithAMap) error;
        assertEquals("blah", exceptionWithAMap.getBlah());
        assertEquals(new HashMap<String, String>(), exceptionWithAMap.getMap_field());
      }
    }.runTest();
  }

  public void testTimeoutCall() throws Exception {
    new ErrorCallTest<Srv.AsyncClient, Integer>() {
      @Override
      Srv.AsyncClient executeErroringCall(AsyncMethodCallback<Integer> callback) throws Exception {
        Srv.AsyncClient client = getClient();
        client.setTimeout(100);
        client.primitiveMethod(callback);
        return client;
      }

      @Override
      void validateError(Srv.AsyncClient client, Exception error) {
        assertTrue(client.hasTimeout());
        assertTrue(error instanceof TimeoutException);
      }
    }.runTest();
  }

  public void testVoidCall() throws Exception {
    final CountDownLatch latch = new CountDownLatch(1);
    final AtomicBoolean returned = new AtomicBoolean(false);
    Srv.AsyncClient client = getClient();
    client.voidMethod(new FailureLessCallback<Void>() {
      @Override
      public void onComplete(Void response) {
        returned.set(true);
        latch.countDown();
      }
    });
    latch.await(1, TimeUnit.SECONDS);
    assertTrue(returned.get());
  }

  public void testOnewayCall() throws Exception {
    final CountDownLatch latch = new CountDownLatch(1);
    final AtomicBoolean returned = new AtomicBoolean(false);
    Srv.AsyncClient client = getClient();
    client.onewayMethod(new FailureLessCallback<Void>() {
      @Override
      public void onComplete(Void response) {
        returned.set(true);
        latch.countDown();
      }
    });
    latch.await(1, TimeUnit.SECONDS);
    assertTrue(returned.get());
  }

  public void testParallelCalls() throws Exception {
    // make multiple calls with deserialization in the selector thread (repro Eric's issue)
    int numThreads = 50;
    int numCallsPerThread = 100;
    List<JankyRunnable> runnables = new ArrayList<JankyRunnable>();
    List<Thread> threads = new ArrayList<Thread>();
    for (int i = 0; i < numThreads; i++) {
      JankyRunnable runnable = new JankyRunnable(numCallsPerThread);
      Thread thread = new Thread(runnable);
      thread.start();
      threads.add(thread);
      runnables.add(runnable);
    }
    for (Thread thread : threads) {
      thread.join();
    }
    int numSuccesses = 0;
    for (JankyRunnable runnable : runnables) {
      numSuccesses += runnable.getNumSuccesses();
    }
    assertEquals(numThreads * numCallsPerThread, numSuccesses);
  }

  private Srv.AsyncClient getClient() throws IOException {
    TNonblockingSocket clientSocket = new TNonblockingSocket(ServerTestBase.HOST, ServerTestBase.PORT);
    return new Srv.AsyncClient(new TBinaryProtocol.Factory(), clientManager_, clientSocket);
  }

  private void basicCall(Srv.AsyncClient client) throws Exception {
    final CountDownLatch latch = new CountDownLatch(1);
    final AtomicBoolean returned = new AtomicBoolean(false);
    client.Janky(1, new FailureLessCallback<Integer>() {
      @Override
      public void onComplete(Integer response) {
        assertEquals(3, response.intValue());
        returned.set(true);
        latch.countDown();
      }

      @Override
      public void onError(Exception exception) {
        try {
          StringWriter sink = new StringWriter();
          exception.printStackTrace(new PrintWriter(sink, true));
          fail("unexpected onError with exception " + sink.toString());
        } finally {
          latch.countDown();
        }
      }
    });
    latch.await(100, TimeUnit.SECONDS);
    assertTrue(returned.get());
  }

  public class SrvHandler implements Iface {
    // Use this method for a standard call testing
    @Override
    public int Janky(int arg) throws TException {
      assertEquals(1, arg);
      return 3;
    }

    // Using this method for timeout testing - sleeps for 1 second before returning
    @Override
    public int primitiveMethod() throws TException {
      try {
        Thread.sleep(1000);
      } catch (InterruptedException e) {
        e.printStackTrace();
      }
      return 0;
    }

    @Override
    public void methodWithDefaultArgs(int something) throws TException { }

    @Override
    public CompactProtoTestStruct structMethod() throws TException {
      return null;
    }

    @Override
    public void voidMethod() throws TException {
    }

    @Override
    public void onewayMethod() throws TException {
    }

    @Override
    public boolean declaredExceptionMethod(boolean shouldThrowDeclared) throws TException {
      if (shouldThrowDeclared) {
        throw new ExceptionWithAMap("blah", new HashMap<String, String>());
      } else {
        throw new TException("Unexpected!");
      }
    }
  }

  private static abstract class FailureLessCallback<T> implements AsyncMethodCallback<T> {
    @Override
    public void onError(Exception exception) {
      fail(exception);
    }
  }

  private static void fail(Exception exception) {
    StringWriter sink = new StringWriter();
    exception.printStackTrace(new PrintWriter(sink, true));
    fail("unexpected error " + sink.toString());
  }

  private class JankyRunnable implements Runnable {
    private int numCalls_;
    private int numSuccesses_ = 0;
    private Srv.AsyncClient client_;

    public JankyRunnable(int numCalls) throws Exception {
      numCalls_ = numCalls;
      client_ = getClient();
      client_.setTimeout(20000);
    }

    public int getNumSuccesses() {
      return numSuccesses_;
    }

    public void run() {
      for (int i = 0; i < numCalls_ && !client_.hasError(); i++) {
        final int iteration = i;
        try {
          // connect an async client
          final CountDownLatch latch = new CountDownLatch(1);
          final AtomicBoolean returned = new AtomicBoolean(false);
          client_.Janky(1, new AsyncMethodCallback<Integer>() {

            @Override
            public void onComplete(Integer result) {
              assertEquals(3, result.intValue());
              returned.set(true);
              latch.countDown();
            }

            @Override
            public void onError(Exception exception) {
              try {
                StringWriter sink = new StringWriter();
                exception.printStackTrace(new PrintWriter(sink, true));
                fail("unexpected onError on iteration " + iteration + ": " + sink.toString());
              } finally {
                latch.countDown();
              }
            }
          });

          boolean calledBack = latch.await(30, TimeUnit.SECONDS);
          assertTrue("wasn't called back in time on iteration " + iteration, calledBack);
          assertTrue("onComplete not called on iteration " + iteration, returned.get());
          this.numSuccesses_++;
        } catch (Exception e) {
          fail(e);
        }
      }
    }
  }
}
