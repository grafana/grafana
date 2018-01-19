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
package org.apache.thrift.transport;

public final class TMemoryInputTransport extends TTransport {

  private byte[] buf_;
  private int pos_;
  private int endPos_;

  public TMemoryInputTransport() {
  }

  public TMemoryInputTransport(byte[] buf) {
    reset(buf);
  }

  public TMemoryInputTransport(byte[] buf, int offset, int length) {
    reset(buf, offset, length);
  }

  public void reset(byte[] buf) {
    reset(buf, 0, buf.length);
  }

  public void reset(byte[] buf, int offset, int length) {
    buf_ = buf;
    pos_ = offset;
    endPos_ = offset + length;
  }

  public void clear() {
    buf_ = null;
  }

  @Override
  public void close() {}

  @Override
  public boolean isOpen() {
    return true;
  }

  @Override
  public void open() throws TTransportException {}

  @Override
  public int read(byte[] buf, int off, int len) throws TTransportException {
    int bytesRemaining = getBytesRemainingInBuffer();
    int amtToRead = (len > bytesRemaining ? bytesRemaining : len);
    if (amtToRead > 0) {
      System.arraycopy(buf_, pos_, buf, off, amtToRead);
      consumeBuffer(amtToRead);
    }
    return amtToRead;
  }

  @Override
  public void write(byte[] buf, int off, int len) throws TTransportException {
    throw new UnsupportedOperationException("No writing allowed!");
  }

  @Override
  public byte[] getBuffer() {
    return buf_;
  }

  public int getBufferPosition() {
    return pos_;
  }

  public int getBytesRemainingInBuffer() {
    return endPos_ - pos_;
  }

  public void consumeBuffer(int len) {
    pos_ += len;
  }

}
