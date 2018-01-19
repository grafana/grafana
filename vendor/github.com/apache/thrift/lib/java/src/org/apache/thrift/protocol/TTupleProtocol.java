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
package org.apache.thrift.protocol;

import java.util.BitSet;

import org.apache.thrift.TException;
import org.apache.thrift.scheme.IScheme;
import org.apache.thrift.scheme.TupleScheme;
import org.apache.thrift.transport.TTransport;

public final class TTupleProtocol extends TCompactProtocol {
  public static class Factory implements TProtocolFactory {
    public Factory() {}

    public TProtocol getProtocol(TTransport trans) {
      return new TTupleProtocol(trans);
    }
  }

  public TTupleProtocol(TTransport transport) {
    super(transport);
  }

  @Override
  public Class<? extends IScheme> getScheme() {
    return TupleScheme.class;
  }

  public void writeBitSet(BitSet bs, int vectorWidth) throws TException {
    byte[] bytes = toByteArray(bs, vectorWidth);
    for (byte b : bytes) {
      writeByte(b);
    }
  }

  public BitSet readBitSet(int i) throws TException {
    int length = (int) Math.ceil(i/8.0);
    byte[] bytes = new byte[length];
    for (int j = 0; j < length; j++) {
      bytes[j] = readByte();
    }
    BitSet bs = fromByteArray(bytes);
    return bs;
  }

  /**
   * Returns a bitset containing the values in bytes. The byte-ordering must be
   * big-endian.
   */
  public static BitSet fromByteArray(byte[] bytes) {
    BitSet bits = new BitSet();
    for (int i = 0; i < bytes.length * 8; i++) {
      if ((bytes[bytes.length - i / 8 - 1] & (1 << (i % 8))) > 0) {
        bits.set(i);
      }
    }
    return bits;
  }

  /**
   * Returns a byte array of at least length 1. The most significant bit in the
   * result is guaranteed not to be a 1 (since BitSet does not support sign
   * extension). The byte-ordering of the result is big-endian which means the
   * most significant bit is in element 0. The bit at index 0 of the bit set is
   * assumed to be the least significant bit.
   * 
   * @param bits
   * @param vectorWidth 
   * @return a byte array of at least length 1
   */
  public static byte[] toByteArray(BitSet bits, int vectorWidth) {
    byte[] bytes = new byte[(int) Math.ceil(vectorWidth/8.0)];
    for (int i = 0; i < bits.length(); i++) {
      if (bits.get(i)) {
        bytes[bytes.length - i / 8 - 1] |= 1 << (i % 8);
      }
    }
    return bytes;
  }

}
