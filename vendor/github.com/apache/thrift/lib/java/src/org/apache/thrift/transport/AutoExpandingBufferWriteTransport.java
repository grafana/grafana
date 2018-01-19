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

/**
 * TTransport for writing to an AutoExpandingBuffer.
 */
public final class AutoExpandingBufferWriteTransport extends TTransport {

  private final AutoExpandingBuffer buf;
  private int pos;

  public AutoExpandingBufferWriteTransport(int initialCapacity, double growthCoefficient) {
    this.buf = new AutoExpandingBuffer(initialCapacity, growthCoefficient);
    this.pos = 0;
  }

  @Override
  public void close() {}

  @Override
  public boolean isOpen() {return true;}

  @Override
  public void open() throws TTransportException {}

  @Override
  public int read(byte[] buf, int off, int len) throws TTransportException {
    throw new UnsupportedOperationException();
  }

  @Override
  public void write(byte[] toWrite, int off, int len) throws TTransportException {
    buf.resizeIfNecessary(pos + len);
    System.arraycopy(toWrite, off, buf.array(), pos, len);
    pos += len;
  }

  public AutoExpandingBuffer getBuf() {
    return buf;
  }

  public int getPos() {
    return pos;
  }

  public void reset() {
    pos = 0;
  }
}
