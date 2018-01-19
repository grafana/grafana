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

import java.nio.ByteBuffer;

import junit.framework.TestCase;

public class TestAutoExpandingBufferReadTransport extends TestCase {
  private static final byte[] HUNDRED_BYTES = new byte[100];

  static {
    for (byte i = 0; i < 100; i++) {
      HUNDRED_BYTES[i] = i;
    }
  }

  public void testIt() throws Exception {
    AutoExpandingBufferReadTransport t = new AutoExpandingBufferReadTransport(150, 1.5);

    TMemoryInputTransport membuf = new TMemoryInputTransport(HUNDRED_BYTES);

    t.fill(membuf, 100);
    assertEquals(100, t.getBytesRemainingInBuffer());
    assertEquals(0, t.getBufferPosition());

    byte[] target = new byte[10];
    assertEquals(10, t.read(target, 0, 10));
    assertEquals(ByteBuffer.wrap(HUNDRED_BYTES, 0, 10), ByteBuffer.wrap(target));

    assertEquals(90, t.getBytesRemainingInBuffer());
    assertEquals(10, t.getBufferPosition());
  }
}
