/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.apache.thrift;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.SocketChannel;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;


/**
 * This class uses a single thread to set up non-blocking sockets to a set
 * of remote servers (hostname and port pairs), and sends a same request to
 * all these servers. It then fetches responses from servers.
 *
 * Parameters:
 *   int maxRecvBufBytesPerServer - an upper limit for receive buffer size
 * per server (in byte). If a response from a server exceeds this limit, the
 * client will not allocate memory or read response data for it.
 *
 *   int fetchTimeoutSeconds - time limit for fetching responses from all
 * servers (in second). After the timeout, the fetch job is stopped and
 * available responses are returned.
 *
 *   ByteBuffer requestBuf - request message that is sent to all servers.
 *
 * Output:
 *   Responses are stored in an array of ByteBuffers. Index of elements in
 * this array corresponds to index of servers in the server list. Content in
 * a ByteBuffer may be in one of the following forms:
 *   1. First 4 bytes form an integer indicating length of following data,
 * then followed by the data.
 *   2. First 4 bytes form an integer indicating length of following data,
 * then followed by nothing - this happens when the response data size
 * exceeds maxRecvBufBytesPerServer, and the client will not read any
 * response data.
 *   3. No data in the ByteBuffer - this happens when the server does not
 * return any response within fetchTimeoutSeconds.
 *
 *   In some special cases (no servers are given, fetchTimeoutSeconds less
 * than or equal to 0, requestBuf is null), the return is null.
 *
 * Note:
 *   It assumes all remote servers are TNonblockingServers and use
 * TFramedTransport.
 *
 */
public class TNonblockingMultiFetchClient {
  
  private static final Logger LOGGER = LoggerFactory.getLogger(
    TNonblockingMultiFetchClient.class.getName()
  );

  // if the size of the response msg exceeds this limit (in byte), we will
  // not read the msg
  private int maxRecvBufBytesPerServer;

  // time limit for fetching data from all servers (in second)
  private int fetchTimeoutSeconds;

  // store request that will be sent to servers  
  private ByteBuffer requestBuf;
  private ByteBuffer requestBufDuplication;

  // a list of remote servers
  private List<InetSocketAddress> servers;

  // store fetch results
  private TNonblockingMultiFetchStats stats;
  private ByteBuffer[] recvBuf;

  public TNonblockingMultiFetchClient(int maxRecvBufBytesPerServer,
    int fetchTimeoutSeconds, ByteBuffer requestBuf,
    List<InetSocketAddress> servers) {
    this.maxRecvBufBytesPerServer = maxRecvBufBytesPerServer;
    this.fetchTimeoutSeconds = fetchTimeoutSeconds;
    this.requestBuf = requestBuf;
    this.servers = servers;
      
    stats = new TNonblockingMultiFetchStats();
    recvBuf = null;
  }

  public synchronized int getMaxRecvBufBytesPerServer() {
    return maxRecvBufBytesPerServer;
  }

  public synchronized int getFetchTimeoutSeconds() {
    return fetchTimeoutSeconds;
  }

  /**
   * return a duplication of requestBuf, so that requestBuf will not
   * be modified by others.
   */
  public synchronized ByteBuffer getRequestBuf() {
    if (requestBuf == null) {
      return null;
    } else {
      if (requestBufDuplication == null) {
        requestBufDuplication = requestBuf.duplicate();
      }
      return requestBufDuplication;  
    }
  }

  public synchronized List<InetSocketAddress> getServerList() {
    if (servers == null) {
      return null;
    }
    return Collections.unmodifiableList(servers);
  }

  public synchronized TNonblockingMultiFetchStats getFetchStats() {
    return stats;
  }

  /**
   * main entry function for fetching from servers
   */
  public synchronized ByteBuffer[] fetch() {
    // clear previous results
    recvBuf = null;
    stats.clear();

    if (servers == null || servers.size() == 0 ||
        requestBuf == null || fetchTimeoutSeconds <= 0) {
      return recvBuf;
    }

    ExecutorService executor = Executors.newSingleThreadExecutor();
    MultiFetch multiFetch = new MultiFetch();
    FutureTask<?> task = new FutureTask(multiFetch, null);
    executor.execute(task);
    try {
      task.get(fetchTimeoutSeconds, TimeUnit.SECONDS);
    } catch(InterruptedException ie) {
      // attempt to cancel execution of the task.
      task.cancel(true);
      LOGGER.error("interrupted during fetch: "+ie.toString());
    } catch(ExecutionException ee) {
      // attempt to cancel execution of the task.
      task.cancel(true);
      LOGGER.error("exception during fetch: "+ee.toString());
    } catch(TimeoutException te) {
      // attempt to cancel execution of the task.  
      task.cancel(true);
      LOGGER.error("timeout for fetch: "+te.toString());
    }

    executor.shutdownNow();
    multiFetch.close();
    return recvBuf;
  }

  /**
   * Private class that does real fetch job.
   * Users are not allowed to directly use this class, as its run()
   * function may run forever.
   */
  private class MultiFetch implements Runnable {
    private Selector selector;

    /**
     * main entry function for fetching.
     *
     * Server responses are stored in TNonblocingMultiFetchClient.recvBuf,
     * and fetch statistics is in TNonblockingMultiFetchClient.stats.
     *
     * Sanity check for parameters has been done in
     * TNonblockingMultiFetchClient before calling this function.
     */
    public void run() {
      long t1 = System.currentTimeMillis();

      int numTotalServers = servers.size();
      stats.setNumTotalServers(numTotalServers);

      // buffer for receiving response from servers
      recvBuf                     = new ByteBuffer[numTotalServers];
      // buffer for sending request
      ByteBuffer sendBuf[]        = new ByteBuffer[numTotalServers];
      long numBytesRead[]         = new long[numTotalServers];
      int frameSize[]             = new int[numTotalServers];
      boolean hasReadFrameSize[]  = new boolean[numTotalServers];

      try {
        selector = Selector.open();
      } catch (IOException e) {
        LOGGER.error("selector opens error: "+e.toString());
        return;
      }

      for (int i = 0; i < numTotalServers; i++) {
        // create buffer to send request to server.
        sendBuf[i] = requestBuf.duplicate();
        // create buffer to read response's frame size from server
        recvBuf[i] = ByteBuffer.allocate(4);
        stats.incTotalRecvBufBytes(4);

        InetSocketAddress server = servers.get(i);
        SocketChannel s = null;
        SelectionKey key = null;
        try {
          s = SocketChannel.open();
          s.configureBlocking(false);
          // now this method is non-blocking
          s.connect(server);
          key = s.register(selector, s.validOps());
          // attach index of the key
          key.attach(i);
        } catch (Exception e) {
          stats.incNumConnectErrorServers();  
          String err = String.format("set up socket to server %s error: %s",
            server.toString(), e.toString());
          LOGGER.error(err);
          // free resource
          if (s != null) {
            try {s.close();} catch (Exception ex) {}
          }            
          if (key != null) {
             key.cancel();
          }
        }
      }

      // wait for events
      while (stats.getNumReadCompletedServers() +
        stats.getNumConnectErrorServers() < stats.getNumTotalServers()) {
        // if the thread is interrupted (e.g., task is cancelled)  
        if (Thread.currentThread().isInterrupted()) {
          return;
        }

        try{
          selector.select();
        } catch (Exception e) {
          LOGGER.error("selector selects error: "+e.toString());
          continue;
        }

        Iterator<SelectionKey> it = selector.selectedKeys().iterator();
        while (it.hasNext()) {
          SelectionKey selKey = it.next();
          it.remove();

          // get previously attached index
          int index = (Integer)selKey.attachment();

          if (selKey.isValid() && selKey.isConnectable()) {
            // if this socket throws an exception (e.g., connection refused),
            // print error msg and skip it.
            try {
              SocketChannel sChannel = (SocketChannel)selKey.channel();
              sChannel.finishConnect();
            } catch (Exception e) {
              stats.incNumConnectErrorServers();
              String err = String.format("socket %d connects to server %s " +
                "error: %s",
                index, servers.get(index).toString(), e.toString());
              LOGGER.error(err);
            }
          }

          if (selKey.isValid() && selKey.isWritable()) {
            if (sendBuf[index].hasRemaining()) {
              // if this socket throws an exception, print error msg and
              // skip it.
              try {
                SocketChannel sChannel = (SocketChannel)selKey.channel();
                sChannel.write(sendBuf[index]);
              } catch (Exception e) {
                String err = String.format("socket %d writes to server %s " +
                  "error: %s",
                  index, servers.get(index).toString(), e.toString());
                LOGGER.error(err);
              }
            }
          }

          if (selKey.isValid() && selKey.isReadable()) {
            // if this socket throws an exception, print error msg and
            // skip it.
            try {
              SocketChannel sChannel = (SocketChannel)selKey.channel();
              int bytesRead = sChannel.read(recvBuf[index]);

              if (bytesRead > 0) {
                numBytesRead[index] += bytesRead;

                if (!hasReadFrameSize[index] &&
                    recvBuf[index].remaining()==0) {
                  // if the frame size has been read completely, then prepare
                  // to read the actual frame.
                  frameSize[index] = recvBuf[index].getInt(0);

                  if (frameSize[index] <= 0) {
                    stats.incNumInvalidFrameSize();
                    String err = String.format("Read an invalid frame size %d"
                      + " from %s. Does the server use TFramedTransport? ",
                      frameSize[index], servers.get(index).toString());
                    LOGGER.error(err);
                    sChannel.close();
                    continue;
                  }

                  if (frameSize[index] + 4 > stats.getMaxResponseBytes()) {
                    stats.setMaxResponseBytes(frameSize[index]+4);
                  }

                  if (frameSize[index] + 4 > maxRecvBufBytesPerServer) {
                    stats.incNumOverflowedRecvBuf();
                    String err = String.format("Read frame size %d from %s,"
                      + " total buffer size would exceed limit %d",
                      frameSize[index], servers.get(index).toString(),
                      maxRecvBufBytesPerServer);
                    LOGGER.error(err);                      
                    sChannel.close();
                    continue;
                  }

                  // reallocate buffer for actual frame data
                  recvBuf[index] = ByteBuffer.allocate(frameSize[index] + 4);
                  recvBuf[index].putInt(frameSize[index]);

                  stats.incTotalRecvBufBytes(frameSize[index]);
                  hasReadFrameSize[index] = true;
                }

                if (hasReadFrameSize[index] &&
                  numBytesRead[index] >= frameSize[index]+4) {
                  // has read all data
                  sChannel.close();
                  stats.incNumReadCompletedServers();
                  long t2 = System.currentTimeMillis();
                  stats.setReadTime(t2-t1);
                }
              }
            } catch (Exception e) {
              String err = String.format("socket %d reads from server %s " +
                "error: %s",
                index, servers.get(index).toString(), e.toString());
              LOGGER.error(err);
            }
          }
        }
      }
    }

    /**
     * dispose any resource allocated
     */
    public void close() {
      try {
        if (selector.isOpen()) {
          Iterator<SelectionKey> it = selector.keys().iterator();
          while (it.hasNext()) {
            SelectionKey selKey = it.next();
            SocketChannel sChannel = (SocketChannel)selKey.channel();
            sChannel.close();
          }

          selector.close();
        }
      } catch (IOException e) {
        LOGGER.error("free resource error: "+e.toString());
      }
    }
  }
}