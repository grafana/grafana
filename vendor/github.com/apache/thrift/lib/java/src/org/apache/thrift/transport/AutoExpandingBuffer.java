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

/**
 * Helper class that wraps a byte[] so that it can expand and be reused. Users
 * should call resizeIfNecessary to make sure the buffer has suitable capacity,
 * and then use the array as needed. Note that the internal array will grow at a
 * rate slightly faster than the requested capacity with the (untested)
 * objective of avoiding expensive buffer allocations and copies.
 */
public class AutoExpandingBuffer {
  private byte[] array;

  private final double growthCoefficient;

  public AutoExpandingBuffer(int initialCapacity, double growthCoefficient) {
    if (growthCoefficient < 1.0) {
      throw new IllegalArgumentException("Growth coefficient must be >= 1.0");
    }
    array = new byte[initialCapacity];
    this.growthCoefficient = growthCoefficient;
  }

  public void resizeIfNecessary(int size) {
    if (array.length < size) {
      byte[] newBuf = new byte[(int)(size * growthCoefficient)];
      System.arraycopy(array, 0, newBuf, 0, array.length);
      array = newBuf;
    }
  }

  public byte[] array() {
    return array;
  }
}
