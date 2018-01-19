package org.apache.thrift.transport;

import java.nio.BufferOverflowException;
import java.nio.BufferUnderflowException;
import java.nio.ByteBuffer;

/**
 * ByteBuffer-backed implementation of TTransport.
 */
public final class TByteBuffer extends TTransport {
  private final ByteBuffer byteBuffer;

  /**
   * Creates a new TByteBuffer wrapping a given NIO ByteBuffer.
   */
  public TByteBuffer(ByteBuffer byteBuffer) {
    this.byteBuffer = byteBuffer;
  }

  @Override
  public boolean isOpen() {
    return true;
  }

  @Override
  public void open() {
  }

  @Override
  public void close() {
  }

  @Override
  public int read(byte[] buf, int off, int len) throws TTransportException {
    final int n = Math.min(byteBuffer.remaining(), len);
    if (n > 0) {
      try {
        byteBuffer.get(buf, off, len);
      } catch (BufferUnderflowException e) {
        throw new TTransportException("Unexpected end of input buffer", e);
      }
    }
    return n;
  }

  @Override
  public void write(byte[] buf, int off, int len) throws TTransportException {
    try {
      byteBuffer.put(buf, off, len);
    } catch (BufferOverflowException e) {
      throw new TTransportException("Not enough room in output buffer", e);
    }
  }

  /**
   * Get the underlying NIO ByteBuffer.
   */
  public ByteBuffer getByteBuffer() {
    return byteBuffer;
  }

  /**
   * Convenience method to call clear() on the underlying NIO ByteBuffer.
   */
  public TByteBuffer clear() {
    byteBuffer.clear();
    return this;
  }

  /**
   * Convenience method to call flip() on the underlying NIO ByteBuffer.
     */
  public TByteBuffer flip() {
    byteBuffer.flip();
    return this;
  }

  /**
   * Convenience method to convert the underlying NIO ByteBuffer to a
   * plain old byte array.
   */
  public byte[] toByteArray() {
    final byte[] data = new byte[byteBuffer.remaining()];
    byteBuffer.slice().get(data);
    return data;
  }
}
