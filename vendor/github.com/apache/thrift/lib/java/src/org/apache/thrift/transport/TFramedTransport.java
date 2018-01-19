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

import org.apache.thrift.TByteArrayOutputStream;

/**
 * TFramedTransport is a buffered TTransport that ensures a fully read message
 * every time by preceding messages with a 4-byte frame size.
 */
public class TFramedTransport extends TTransport {

  protected static final int DEFAULT_MAX_LENGTH = 16384000;

  private int maxLength_;

  /**
   * Underlying transport
   */
  private TTransport transport_ = null;

  /**
   * Buffer for output
   */
  private final TByteArrayOutputStream writeBuffer_ =
    new TByteArrayOutputStream(1024);

  /**
   * Buffer for input
   */
  private TMemoryInputTransport readBuffer_ = new TMemoryInputTransport(new byte[0]);

  public static class Factory extends TTransportFactory {
    private int maxLength_;

    public Factory() {
      maxLength_ = TFramedTransport.DEFAULT_MAX_LENGTH;
    }

    public Factory(int maxLength) {
      maxLength_ = maxLength;
    }

    @Override
    public TTransport getTransport(TTransport base) {
      return new TFramedTransport(base, maxLength_);
    }
  }

  /**
   * Constructor wraps around another transport
   */
  public TFramedTransport(TTransport transport, int maxLength) {
    transport_ = transport;
    maxLength_ = maxLength;
  }

  public TFramedTransport(TTransport transport) {
    transport_ = transport;
    maxLength_ = TFramedTransport.DEFAULT_MAX_LENGTH;
  }

  public void open() throws TTransportException {
    transport_.open();
  }

  public boolean isOpen() {
    return transport_.isOpen();
  }

  public void close() {
    transport_.close();
  }

  public int read(byte[] buf, int off, int len) throws TTransportException {
    if (readBuffer_ != null) {
      int got = readBuffer_.read(buf, off, len);
      if (got > 0) {
        return got;
      }
    }

    // Read another frame of data
    readFrame();

    return readBuffer_.read(buf, off, len);
  }

  @Override
  public byte[] getBuffer() {
    return readBuffer_.getBuffer();
  }

  @Override
  public int getBufferPosition() {
    return readBuffer_.getBufferPosition();
  }

  @Override
  public int getBytesRemainingInBuffer() {
    return readBuffer_.getBytesRemainingInBuffer();
  }

  @Override
  public void consumeBuffer(int len) {
    readBuffer_.consumeBuffer(len);
  }

  private final byte[] i32buf = new byte[4];

  private void readFrame() throws TTransportException {
    transport_.readAll(i32buf, 0, 4);
    int size = decodeFrameSize(i32buf);

    if (size < 0) {
      close();
      throw new TTransportException(TTransportException.CORRUPTED_DATA, "Read a negative frame size (" + size + ")!");
    }

    if (size > maxLength_) {
      close();
      throw new TTransportException(TTransportException.CORRUPTED_DATA,
          "Frame size (" + size + ") larger than max length (" + maxLength_ + ")!");
    }

    byte[] buff = new byte[size];
    transport_.readAll(buff, 0, size);
    readBuffer_.reset(buff);
  }

  public void write(byte[] buf, int off, int len) throws TTransportException {
    writeBuffer_.write(buf, off, len);
  }

  @Override
  public void flush() throws TTransportException {
    byte[] buf = writeBuffer_.get();
    int len = writeBuffer_.len();
    writeBuffer_.reset();

    encodeFrameSize(len, i32buf);
    transport_.write(i32buf, 0, 4);
    transport_.write(buf, 0, len);
    transport_.flush();
  }

  public static final void encodeFrameSize(final int frameSize, final byte[] buf) {
    buf[0] = (byte)(0xff & (frameSize >> 24));
    buf[1] = (byte)(0xff & (frameSize >> 16));
    buf[2] = (byte)(0xff & (frameSize >> 8));
    buf[3] = (byte)(0xff & (frameSize));
  }

  public static final int decodeFrameSize(final byte[] buf) {
    return
      ((buf[0] & 0xff) << 24) |
      ((buf[1] & 0xff) << 16) |
      ((buf[2] & 0xff) <<  8) |
      ((buf[3] & 0xff));
  }
}
