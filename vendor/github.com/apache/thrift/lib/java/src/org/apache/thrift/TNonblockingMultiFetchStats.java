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

/**
 * This class keeps track of statistics for TNonblockinMultiFetchClient.
 */
public class TNonblockingMultiFetchStats {
  private int    numTotalServers;
  private int    numReadCompletedServers;
  private int    numConnectErrorServers;
  private int    totalRecvBufBytes;
  private int    maxResponseBytes;
  private int    numOverflowedRecvBuf;
  private int    numInvalidFrameSize;
  // time from the beginning of fetch() function to the reading finish
  // time of the last socket (in milli-second)
  private long   readTime;

  public TNonblockingMultiFetchStats() {
    clear();
  }

  public void clear() {
    numTotalServers = 0;
    numReadCompletedServers = 0;
    numConnectErrorServers = 0;
    totalRecvBufBytes = 0;
    maxResponseBytes = 0;
    numOverflowedRecvBuf = 0;
    numInvalidFrameSize = 0;
    readTime = 0;
  }

  public String toString() {
    String stats = String.format("numTotalServers=%d, " +
      "numReadCompletedServers=%d, numConnectErrorServers=%d, " +
      "numUnresponsiveServers=%d, totalRecvBufBytes=%fM, " +
      "maxResponseBytes=%d, numOverflowedRecvBuf=%d, " +
      "numInvalidFrameSize=%d, readTime=%dms",
      numTotalServers, numReadCompletedServers, numConnectErrorServers,
      (numTotalServers-numReadCompletedServers-numConnectErrorServers),
      totalRecvBufBytes/1024.0/1024, maxResponseBytes, numOverflowedRecvBuf,
      numInvalidFrameSize, readTime);
    return stats;
  }

  public void setNumTotalServers(int val)    { numTotalServers = val; }
  public void setMaxResponseBytes(int val)   { maxResponseBytes = val; }
  public void setReadTime(long val)          { readTime = val; }
  public void incNumReadCompletedServers()   { numReadCompletedServers++; }
  public void incNumConnectErrorServers()    { numConnectErrorServers++; }
  public void incNumOverflowedRecvBuf()      { numOverflowedRecvBuf++; }
  public void incTotalRecvBufBytes(int val)  { totalRecvBufBytes += val; }
  public void incNumInvalidFrameSize()       { numInvalidFrameSize++; }

  public int getMaxResponseBytes()        { return maxResponseBytes; }
  public int getNumReadCompletedServers() { return numReadCompletedServers; }
  public int getNumConnectErrorServers()  { return numConnectErrorServers; }
  public int getNumTotalServers()         { return numTotalServers; }
  public int getNumOverflowedRecvBuf()    { return numOverflowedRecvBuf;}
  public int getTotalRecvBufBytes()       { return totalRecvBufBytes;}
  public int getNumInvalidFrameSize()     { return numInvalidFrameSize; }
  public long getReadTime()               { return readTime; }
}
