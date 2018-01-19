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


public class WriteCountingTransport extends TTransport {
  public int writeCount = 0;
  private final TTransport trans;

  public WriteCountingTransport(TTransport underlying) {
    trans = underlying;
  }

  @Override
  public void close() {}

  @Override
  public boolean isOpen() {return true;}

  @Override
  public void open() throws TTransportException {}

  @Override
  public int read(byte[] buf, int off, int len) throws TTransportException {
    return 0;
  }

  @Override
  public void write(byte[] buf, int off, int len) throws TTransportException {
    writeCount ++;
    trans.write(buf, off, len);
  }

  @Override
  public void flush() throws TTransportException {
    trans.flush();
  }
}