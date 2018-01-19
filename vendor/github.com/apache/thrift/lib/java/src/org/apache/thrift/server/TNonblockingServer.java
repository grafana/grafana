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

import org.apache.thrift.transport.TNonblockingServerTransport;
import org.apache.thrift.transport.TNonblockingTransport;
import org.apache.thrift.transport.TTransportException;

import java.io.IOException;
import java.nio.channels.SelectionKey;
import java.util.Iterator;

/**
 * A nonblocking TServer implementation. This allows for fairness amongst all
 * connected clients in terms of invocations.
 *
 * This server is inherently single-threaded. If you want a limited thread pool
 * coupled with invocation-fairness, see THsHaServer.
 *
 * To use this server, you MUST use a TFramedTransport at the outermost
 * transport, otherwise this server will be unable to determine when a whole
 * method call has been read off the wire. Clients must also use TFramedTransport.
 */
public class TNonblockingServer extends AbstractNonblockingServer {

  public static class Args extends AbstractNonblockingServerArgs<Args> {
    public Args(TNonblockingServerTransport transport) {
      super(transport);
    }
  }

  private SelectAcceptThread selectAcceptThread_;

  public TNonblockingServer(AbstractNonblockingServerArgs args) {
    super(args);
  }


  /**
   * Start the selector thread to deal with accepts and client messages.
   *
   * @return true if everything went ok, false if we couldn't start for some
   * reason.
   */
  @Override
  protected boolean startThreads() {
    // start the selector
    try {
      selectAcceptThread_ = new SelectAcceptThread((TNonblockingServerTransport)serverTransport_);
      selectAcceptThread_.start();
      return true;
    } catch (IOException e) {
      LOGGER.error("Failed to start selector thread!", e);
      return false;
    }
  }

  @Override
  protected void waitForShutdown() {
    joinSelector();
  }

  /**
   * Block until the selector thread exits.
   */
  protected void joinSelector() {
    // wait until the selector thread exits
    try {
      selectAcceptThread_.join();
    } catch (InterruptedException e) {
      // for now, just silently ignore. technically this means we'll have less of
      // a graceful shutdown as a result.
    }
  }

  /**
   * Stop serving and shut everything down.
   */
  @Override
  public void stop() {
    stopped_ = true;
    if (selectAcceptThread_ != null) {
      selectAcceptThread_.wakeupSelector();
    }
  }

  /**
   * Perform an invocation. This method could behave several different ways
   * - invoke immediately inline, queue for separate execution, etc.
   */
  @Override
  protected boolean requestInvoke(FrameBuffer frameBuffer) {
    frameBuffer.invoke();
    return true;
  }


  public boolean isStopped() {
    return selectAcceptThread_.isStopped();
  }

  /**
   * The thread that will be doing all the selecting, managing new connections
   * and those that still need to be read.
   */
  protected class SelectAcceptThread extends AbstractSelectThread {

    // The server transport on which new client transports will be accepted
    private final TNonblockingServerTransport serverTransport;

    /**
     * Set up the thread that will handle the non-blocking accepts, reads, and
     * writes.
     */
    public SelectAcceptThread(final TNonblockingServerTransport serverTransport)
    throws IOException {
      this.serverTransport = serverTransport;
      serverTransport.registerSelector(selector);
    }

    public boolean isStopped() {
      return stopped_;
    }

    /**
     * The work loop. Handles both selecting (all IO operations) and managing
     * the selection preferences of all existing connections.
     */
    public void run() {
      try {
        if (eventHandler_ != null) {
          eventHandler_.preServe();
        }

        while (!stopped_) {
          select();
          processInterestChanges();
        }
        for (SelectionKey selectionKey : selector.keys()) {
          cleanupSelectionKey(selectionKey);
        }
      } catch (Throwable t) {
        LOGGER.error("run() exiting due to uncaught error", t);
      } finally {
        try {
          selector.close();
        } catch (IOException e) {
          LOGGER.error("Got an IOException while closing selector!", e);
        }
        stopped_ = true;
      }
    }

    /**
     * Select and process IO events appropriately:
     * If there are connections to be accepted, accept them.
     * If there are existing connections with data waiting to be read, read it,
     * buffering until a whole frame has been read.
     * If there are any pending responses, buffer them until their target client
     * is available, and then send the data.
     */
    private void select() {
      try {
        // wait for io events.
        selector.select();

        // process the io events we received
        Iterator<SelectionKey> selectedKeys = selector.selectedKeys().iterator();
        while (!stopped_ && selectedKeys.hasNext()) {
          SelectionKey key = selectedKeys.next();
          selectedKeys.remove();

          // skip if not valid
          if (!key.isValid()) {
            cleanupSelectionKey(key);
            continue;
          }

          // if the key is marked Accept, then it has to be the server
          // transport.
          if (key.isAcceptable()) {
            handleAccept();
          } else if (key.isReadable()) {
            // deal with reads
            handleRead(key);
          } else if (key.isWritable()) {
            // deal with writes
            handleWrite(key);
          } else {
            LOGGER.warn("Unexpected state in select! " + key.interestOps());
          }
        }
      } catch (IOException e) {
        LOGGER.warn("Got an IOException while selecting!", e);
      }
    }

    protected FrameBuffer createFrameBuffer(final TNonblockingTransport trans,
        final SelectionKey selectionKey,
        final AbstractSelectThread selectThread) {
        return processorFactory_.isAsyncProcessor() ?
                  new AsyncFrameBuffer(trans, selectionKey, selectThread) :
                  new FrameBuffer(trans, selectionKey, selectThread);
    }

    /**
     * Accept a new connection.
     */
    private void handleAccept() throws IOException {
      SelectionKey clientKey = null;
      TNonblockingTransport client = null;
      try {
        // accept the connection
        client = (TNonblockingTransport)serverTransport.accept();
        clientKey = client.registerSelector(selector, SelectionKey.OP_READ);

        // add this key to the map
          FrameBuffer frameBuffer = createFrameBuffer(client, clientKey, SelectAcceptThread.this);

          clientKey.attach(frameBuffer);
      } catch (TTransportException tte) {
        // something went wrong accepting.
        LOGGER.warn("Exception trying to accept!", tte);
        tte.printStackTrace();
        if (clientKey != null) cleanupSelectionKey(clientKey);
        if (client != null) client.close();
      }
    }
  } // SelectAcceptThread
}
