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

import java.io.ByteArrayOutputStream;

/**
 * Class that allows access to the underlying buf without doing deep
 * copies on it.
 *
 */
public class TByteArrayOutputStream extends ByteArrayOutputStream {

  private final int initialSize;

  public TByteArrayOutputStream(int size) {
    super(size);
    this.initialSize = size;
  }

  public TByteArrayOutputStream() {
    this(32);
  }

  public byte[] get() {
    return buf;
  }

  public void reset() {
    super.reset();
    if (buf.length > initialSize) {
      buf = new byte[initialSize];
    }
  }

  public int len() {
    return count;
  }
}
