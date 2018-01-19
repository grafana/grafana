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

import java.io.BufferedOutputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.util.Arrays;

import junit.framework.TestCase;

public class TestTFramedTransport extends TestCase {

  protected TTransport getTransport(TTransport underlying) {
    return new TFramedTransport(underlying);
  }

  protected TTransport getTransport(TTransport underlying, int maxLength) {
    return new TFramedTransport(underlying, maxLength);
  }

  public static byte[] byteSequence(int start, int end) {
    byte[] result = new byte[end-start+1];
    for (int i = 0; i <= (end-start); i++) {
      result[i] = (byte)(start+i);
    }
    return result;
  }

  public void testRead() throws IOException, TTransportException {
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    DataOutputStream dos = new DataOutputStream(baos);
    dos.writeInt(50);
    dos.write(byteSequence(0, 49));

    dos.writeInt(220);
    dos.write(byteSequence(0, 219));

    TMemoryBuffer membuf = new TMemoryBuffer(0);
    membuf.write(baos.toByteArray());

    ReadCountingTransport countTrans = new ReadCountingTransport(membuf);
    TTransport trans = getTransport(countTrans);

    byte[] readBuf = new byte[10];
    trans.read(readBuf, 0, 10);
    assertTrue(Arrays.equals(readBuf, byteSequence(0,9)));
    assertEquals(2, countTrans.readCount);

    trans.read(readBuf, 0, 10);
    assertTrue(Arrays.equals(readBuf, byteSequence(10,19)));
    assertEquals(2, countTrans.readCount);

    assertEquals(30, trans.read(new byte[30], 0, 30));
    assertEquals(2, countTrans.readCount);

    readBuf = new byte[220];
    assertEquals(220, trans.read(readBuf, 0, 220));
    assertTrue(Arrays.equals(readBuf, byteSequence(0, 219)));
    assertEquals(4, countTrans.readCount);
  }

  public void testInvalidFrameSize() throws IOException, TTransportException {
    int maxLength = 128;

    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    DataOutputStream dos = new DataOutputStream(baos);
    dos.writeInt(130);
    dos.write(byteSequence(0, 129));

    TMemoryBuffer membuf = new TMemoryBuffer(0);
    membuf.write(baos.toByteArray());

    ReadCountingTransport countTrans = new ReadCountingTransport(membuf);
    TTransport trans = getTransport(countTrans, maxLength);

    byte[] readBuf = new byte[10];
    try {
      trans.read(readBuf, 0, 4);
      fail("Expected a TTransportException");
    } catch (TTransportException e) {
      // We expect this exception because the frame we're trying to read is larger than our max frame length
      assertEquals(TTransportException.CORRUPTED_DATA, e.getType());
    }

    assertFalse(trans.isOpen());

    try {
      trans.read(readBuf, 0, 4);
      fail("Expected a TTransportException");
    } catch (TTransportException e) {
      // This time we get an exception indicating the connection was closed
      assertEquals(TTransportException.NOT_OPEN, e.getType());
    }
  }

  public void testWrite() throws TTransportException, IOException {
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    WriteCountingTransport countingTrans = new WriteCountingTransport(new TIOStreamTransport(new BufferedOutputStream(baos)));
    TTransport trans = getTransport(countingTrans);

    trans.write(byteSequence(0,100));
    assertEquals(0, countingTrans.writeCount);
    trans.write(byteSequence(101,200));
    trans.write(byteSequence(201,255));
    assertEquals(0, countingTrans.writeCount);

    trans.flush();
    assertEquals(2, countingTrans.writeCount);

    trans.write(byteSequence(0, 245));
    trans.flush();
    assertEquals(4, countingTrans.writeCount);

    DataInputStream din = new DataInputStream(new ByteArrayInputStream(baos.toByteArray()));
    assertEquals(256, din.readInt());

    byte[] buf = new byte[256];
    din.read(buf, 0, 256);
    assertTrue(Arrays.equals(byteSequence(0,255), buf));

    assertEquals(246, din.readInt());
    buf = new byte[246];
    din.read(buf, 0, 246);
    assertTrue(Arrays.equals(byteSequence(0,245), buf));
  }

  public void testDirectRead() throws IOException, TTransportException {
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    DataOutputStream dos = new DataOutputStream(baos);
    dos.writeInt(50);
    dos.write(byteSequence(0, 49));
    dos.writeInt(75);
    dos.write(byteSequence(125, 200));

    TMemoryBuffer membuf = new TMemoryBuffer(0);
    membuf.write(baos.toByteArray());

    ReadCountingTransport countTrans = new ReadCountingTransport(membuf);
    TTransport trans = getTransport(countTrans);

    assertEquals(0, trans.getBytesRemainingInBuffer());

    byte[] readBuf = new byte[10];
    trans.read(readBuf, 0, 10);
    assertTrue(Arrays.equals(readBuf, byteSequence(0,9)));

    assertEquals(40, trans.getBytesRemainingInBuffer());
    assertEquals(10, trans.getBufferPosition());

    trans.consumeBuffer(5);
    assertEquals(35, trans.getBytesRemainingInBuffer());
    assertEquals(15, trans.getBufferPosition());

    assertEquals(2, countTrans.readCount);

    assertEquals(35, trans.read(new byte[35], 0, 35));
    assertEquals(0, trans.getBytesRemainingInBuffer());
    assertEquals(50, trans.getBufferPosition());

    trans.read(readBuf, 0, 10);
    assertEquals(4, countTrans.readCount);
    assertTrue(Arrays.equals(readBuf, byteSequence(125,134)));
    assertEquals(65, trans.getBytesRemainingInBuffer());
    assertEquals(10, trans.getBufferPosition());
  }
}
