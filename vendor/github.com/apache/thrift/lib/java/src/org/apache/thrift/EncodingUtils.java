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

package org.apache.thrift;

/**
 * Utility methods for use when encoding/decoding raw data as byte arrays.
 */
public class EncodingUtils {

  /**
   * Encode <code>integer</code> as a series of 4 bytes into <code>buf</code>
   * starting at position 0 within that buffer.
   * 
   * @param integer
   *          The integer to encode.
   * @param buf
   *          The buffer to write to.
   */
  public static final void encodeBigEndian(final int integer, final byte[] buf) {
    encodeBigEndian(integer, buf, 0);
  }

  /**
   * Encode <code>integer</code> as a series of 4 bytes into <code>buf</code>
   * starting at position <code>offset</code>.
   * 
   * @param integer
   *          The integer to encode.
   * @param buf
   *          The buffer to write to.
   * @param offset
   *          The offset within <code>buf</code> to start the encoding.
   */
  public static final void encodeBigEndian(final int integer, final byte[] buf, int offset) {
    buf[offset] = (byte) (0xff & (integer >> 24));
    buf[offset + 1] = (byte) (0xff & (integer >> 16));
    buf[offset + 2] = (byte) (0xff & (integer >> 8));
    buf[offset + 3] = (byte) (0xff & (integer));
  }

  /**
   * Decode a series of 4 bytes from <code>buf</code>, starting at position 0,
   * and interpret them as an integer.
   * 
   * @param buf
   *          The buffer to read from.
   * @return An integer, as read from the buffer.
   */
  public static final int decodeBigEndian(final byte[] buf) {
    return decodeBigEndian(buf, 0);
  }

  /**
   * Decode a series of 4 bytes from <code>buf</code>, start at
   * <code>offset</code>, and interpret them as an integer.
   * 
   * @param buf
   *          The buffer to read from.
   * @param offset
   *          The offset with <code>buf</code> to start the decoding.
   * @return An integer, as read from the buffer.
   */
  public static final int decodeBigEndian(final byte[] buf, int offset) {
    return ((buf[offset] & 0xff) << 24) | ((buf[offset + 1] & 0xff) << 16)
        | ((buf[offset + 2] & 0xff) << 8) | ((buf[offset + 3] & 0xff));
  }

  /**
   * Bitfield utilities.
   * Returns true if the bit at position is set in v.
   */
  public static final boolean testBit(byte v, int position) {
    return testBit((int)v, position);
  }

  public static final boolean testBit(short v, int position) {
    return testBit((int)v, position);
  }

  public static final boolean testBit(int v, int position) {
    return (v & (1 << position)) != 0;
  }

  public static final boolean testBit(long v, int position) {
    return (v & (1L << position)) != 0L;
  }

  /**
   * Returns v, with the bit at position set to zero.
   */
  public static final byte clearBit(byte v, int position) {
    return (byte)clearBit((int)v, position);
  }

  public static final short clearBit(short v, int position) {
    return (short)clearBit((int)v, position);
  }

  public static final int clearBit(int v, int position) {
    return v & ~(1 << position);
  }

  public static final long clearBit(long v, int position) {
    return v & ~(1L << position);
  }

  /**
   * Returns v, with the bit at position set to 1 or 0 depending on value.
   */
  public static final byte setBit(byte v, int position, boolean value) {
    return (byte)setBit((int)v, position, value);
  }

  public static final short setBit(short v, int position, boolean value) {
    return (short)setBit((int)v, position, value);
  }

  public static final int setBit(int v, int position, boolean value) {
    if(value)
      return v | (1 << position);
    else
      return clearBit(v, position);
  }

  public static final long setBit(long v, int position, boolean value) {
    if(value)
      return v | (1L << position);
    else
      return clearBit(v, position);
  }
}
