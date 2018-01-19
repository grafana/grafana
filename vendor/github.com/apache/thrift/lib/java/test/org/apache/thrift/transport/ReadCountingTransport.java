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


public class ReadCountingTransport extends TTransport {
  public int readCount = 0;
  private TTransport trans;
  private boolean open = true;

  public ReadCountingTransport(TTransport underlying) {
    trans = underlying;
  }

  @Override
  public void close() {
    open = false;
  }

  @Override
  public boolean isOpen() {
    return open;
  }

  @Override
  public void open() throws TTransportException {
    open = true;
  }

  @Override
  public int read(byte[] buf, int off, int len) throws TTransportException {
    if (!isOpen()) {
      throw new TTransportException(TTransportException.NOT_OPEN, "Transport is closed");
    }
    readCount++;
    return trans.read(buf, off, len);
  }

  @Override
  public void write(byte[] buf, int off, int len) throws TTransportException {
    if (!isOpen()) {
      throw new TTransportException(TTransportException.NOT_OPEN, "Transport is closed");
    }
  }
}
