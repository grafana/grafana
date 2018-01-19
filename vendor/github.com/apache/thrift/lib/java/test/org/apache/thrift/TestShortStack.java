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

import java.util.Stack;

import junit.framework.TestCase;

public class TestShortStack extends TestCase {
  private static final int NUM_TRIALS = 5;
  private static final int NUM_REPS = 10000000;

  public void testOps() throws Exception {
    ShortStack s = new ShortStack(10);
    s.push((short)10);
    s.push((short)11);
    s.push((short)12);
    assertEquals((short)12, s.peek());
    assertEquals((short)12, s.peek());
    assertEquals((short)12, s.pop());
    assertEquals((short)11, s.pop());
    s.push((short)40);
    assertEquals((short)40, s.peek());
    assertEquals((short)40, s.pop());
    assertEquals((short)10, s.peek());
    assertEquals((short)10, s.pop());
    try {
      s.peek();
      fail("should have thrown an exception!");
    } catch (Exception e) {
      // yay
    }

    try {
      s.pop();
      fail("should have thrown an exception!");
    } catch (Exception e) {
      // yay
    }
  }

  public void testGrow() throws Exception {
    ShortStack s = new ShortStack(1);
    s.push((short)1);
    s.push((short)1);
    s.push((short)1);
    s.push((short)1);
    s.push((short)1);
  }

  public static void main(String[] args) throws Exception {
    for (int trial = 0; trial < NUM_TRIALS; trial++) {
      long start = System.currentTimeMillis();
      ShortStack s = new ShortStack(10);
      for (int rep = 0; rep < NUM_REPS; rep++) {
        s.push((short)1);
        s.push((short)11);
        s.push((short)111);
        s.pop();
        s.pop();
        s.push((short)12);
        s.push((short)121);
        s.push((short)1211);
        s.push((short)12111);
        s.pop();
        s.pop();
        s.pop();
        s.pop();
        s.push((short)5);
        s.pop();
        s.pop();
      }
      long end = System.currentTimeMillis();
      System.out.println("ShortStack: " + (end-start));

      start = System.currentTimeMillis();
      Stack<Short> stdStack = new Stack<Short>();
      for (int rep = 0; rep < NUM_REPS; rep++) {
        stdStack.push((short)1);
        stdStack.push((short)11);
        stdStack.push((short)111);
        stdStack.pop();
        stdStack.pop();
        stdStack.push((short)12);
        stdStack.push((short)121);
        stdStack.push((short)1211);
        stdStack.push((short)12111);
        stdStack.pop();
        stdStack.pop();
        stdStack.pop();
        stdStack.pop();
        stdStack.push((short)5);
        stdStack.pop();
        stdStack.pop();
      }
      end = System.currentTimeMillis();
      System.out.println("Built-in stack: " + (end-start));
    }
  }
}
