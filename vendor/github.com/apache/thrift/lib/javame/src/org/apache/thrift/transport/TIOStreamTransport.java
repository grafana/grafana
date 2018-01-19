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

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * This is the most commonly used base transport. It takes an InputStream
 * and an OutputStream and uses those to perform all transport operations.
 * This allows for compatibility with all the nice constructs Java already
 * has to provide a variety of types of streams.
 *
 */
public class TIOStreamTransport extends TTransport {


  /** Underlying inputStream */
  protected InputStream inputStream_ = null;

  /** Underlying outputStream */
  protected OutputStream outputStream_ = null;

  /**
   * Subclasses can invoke the default constructor and then assign the input
   * streams in the open method.
   */
  protected TIOStreamTransport() {}

  /**
   * Input stream constructor.
   *
   * @param is Input stream to read from
   */
  public TIOStreamTransport(InputStream is) {
    inputStream_ = is;
  }

  /**
   * Output stream constructor.
   *
   * @param os Output stream to read from
   */
  public TIOStreamTransport(OutputStream os) {
    outputStream_ = os;
  }

  /**
   * Two-way stream constructor.
   *
   * @param is Input stream to read from
   * @param os Output stream to read from
   */
  public TIOStreamTransport(InputStream is, OutputStream os) {
    inputStream_ = is;
    outputStream_ = os;
  }

  /**
   * The streams must already be open at construction time, so this should
   * always return true.
   *
   * @return true
   */
  public boolean isOpen() {
    return true;
  }

  /**
   * The streams must already be open. This method does nothing.
   */
  public void open() throws TTransportException {}

  /**
   * Closes both the input and output streams.
   */
  public void close() {
    if (inputStream_ != null) {
      try {
        inputStream_.close();
      } catch (IOException iox) {
      }
      inputStream_ = null;
    }
    if (outputStream_ != null) {
      try {
        outputStream_.close();
      } catch (IOException iox) {
      }
      outputStream_ = null;
    }
  }

  /**
   * Reads from the underlying input stream if not null.
   */
  public int read(byte[] buf, int off, int len) throws TTransportException {
    if (inputStream_ == null) {
      throw new TTransportException(TTransportException.NOT_OPEN, "Cannot read from null inputStream");
    }
    try {
      return inputStream_.read(buf, off, len);
    } catch (IOException iox) {
      throw new TTransportException(TTransportException.UNKNOWN, iox);
    }
  }

  /**
   * Writes to the underlying output stream if not null.
   */
  public void write(byte[] buf, int off, int len) throws TTransportException {
    if (outputStream_ == null) {
      throw new TTransportException(TTransportException.NOT_OPEN, "Cannot write to null outputStream");
    }
    try {
      outputStream_.write(buf, off, len);
    } catch (IOException iox) {
      throw new TTransportException(TTransportException.UNKNOWN, iox);
    }
  }

  /**
   * Flushes the underlying output stream if not null.
   */
  public void flush() throws TTransportException {
    if (outputStream_ == null) {
      throw new TTransportException(TTransportException.NOT_OPEN, "Cannot flush null outputStream");
    }
    try {
      outputStream_.flush();
    } catch (IOException iox) {
      throw new TTransportException(TTransportException.UNKNOWN, iox);
    }
  }
}
