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

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import junit.framework.TestCase;

public class TestTSimpleFileTransport extends TestCase {
  public void testFresh() throws Exception {
    //Test write side
    Path tempFilePathName = Files.createTempFile("TSimpleFileTransportTest", null);
    Files.delete(tempFilePathName);        
    byte[] input_buf = new byte[]{1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
    TSimpleFileTransport trans_write = new TSimpleFileTransport(tempFilePathName.toString(),false, true, false);
    assert (!trans_write.isOpen());
    trans_write.open();
    assert(trans_write.isOpen());
    trans_write.write(input_buf);
    trans_write.write(input_buf,2,2);    
    trans_write.flush();
    trans_write.close();
    
    //Test read side
    TSimpleFileTransport trans = new TSimpleFileTransport(tempFilePathName.toString(),true, false);
    assert(trans_write.isOpen());
    
    //Simple file trans provides no buffer access
    assert(0 == trans.getBufferPosition());
    assert(null == trans.getBuffer());
    assert(-1 == trans.getBytesRemainingInBuffer());

    //Test file pointer operations
    assert(0 == trans.getFilePointer());
    assert(12 == trans.length());

    final int BUFSIZ = 4;
    byte[] buf1 = new byte[BUFSIZ];
    trans.readAll(buf1, 0, BUFSIZ);
    assert(BUFSIZ == trans.getFilePointer());
    assert(Arrays.equals(new byte[]{1, 2, 3, 4}, buf1));
    
    int bytesRead = trans.read(buf1, 0, BUFSIZ);
    assert(bytesRead > 0);
    for (int i = 0; i < bytesRead; ++i) {
      assert(buf1[i] == i+5);    
    }
    
    trans.seek(0);
    assert(0 == trans.getFilePointer());
    trans.readAll(buf1, 0, BUFSIZ);
    assert(Arrays.equals(new byte[]{1, 2, 3, 4}, buf1));
    assert(BUFSIZ == trans.getFilePointer());
    trans.close();
    Files.delete(tempFilePathName);      
  }
}
