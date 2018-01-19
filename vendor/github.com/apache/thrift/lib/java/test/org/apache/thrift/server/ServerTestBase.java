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
package org.apache.thrift.server;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import java.nio.ByteBuffer;

import junit.framework.TestCase;

import org.apache.thrift.TException;
import org.apache.thrift.TProcessor;
import org.apache.thrift.async.AsyncMethodCallback;
import org.apache.thrift.protocol.TBinaryProtocol;
import org.apache.thrift.protocol.TCompactProtocol;
import org.apache.thrift.protocol.TProtocol;
import org.apache.thrift.protocol.TProtocolFactory;
import org.apache.thrift.transport.TFramedTransport;
import org.apache.thrift.transport.TSocket;
import org.apache.thrift.transport.TTransport;
import org.apache.thrift.transport.TTransportFactory;
import org.apache.thrift.transport.TFramedTransport.Factory;

import thrift.test.Insanity;
import thrift.test.Numberz;
import thrift.test.ThriftTest;
import thrift.test.Xception;
import thrift.test.Xception2;
import thrift.test.Xtruct;
import thrift.test.Xtruct2;

public abstract class ServerTestBase extends TestCase {

  public static class TestHandler implements ThriftTest.Iface {
  
    public TestHandler() {}
  
    public void testVoid() {
      System.out.print("testVoid()\n");
    }
  
    public String testString(String thing) {
      System.out.print("testString(\"" + thing + "\")\n");
      return thing;
    }

    public boolean testBool(boolean thing) {
      System.out.print("testBool(" + thing + ")\n");
      return thing;
    }
  
    public byte testByte(byte thing) {
      System.out.print("testByte(" + thing + ")\n");
      return thing;
    }
  
    public int testI32(int thing) {
      System.out.print("testI32(" + thing + ")\n");
      return thing;
    }
  
    public long testI64(long thing) {
      System.out.print("testI64(" + thing + ")\n");
      return thing;
    }
  
    public double testDouble(double thing) {
      System.out.print("testDouble(" + thing + ")\n");
      return thing;
    }

    public ByteBuffer testBinary(ByteBuffer thing) {
      StringBuilder sb = new StringBuilder(thing.remaining() * 3);
      thing.mark();
      while (thing.remaining() > 0) {
        sb.append(String.format("%02X ", thing.get()));
      }
      System.out.print("testBinary(" + sb.toString() + ")\n");
      thing.reset();
      return thing;
    }

    public Xtruct testStruct(Xtruct thing) {
      System.out.print("testStruct({" +
                       "\"" + thing.string_thing + "\", " +
                       thing.byte_thing + ", " +
                       thing.i32_thing + ", " +
                       thing.i64_thing + "})\n");
      return thing;
    }
  
    public Xtruct2 testNest(Xtruct2 nest) {
      Xtruct thing = nest.struct_thing;
      System.out.print("testNest({" +
                       nest.byte_thing + ", {" +
                       "\"" + thing.string_thing + "\", " +
                       thing.byte_thing + ", " +
                       thing.i32_thing + ", " +
                       thing.i64_thing + "}, " +
                       nest.i32_thing + "})\n");
      return nest;
    }
  
    public Map<Integer,Integer> testMap(Map<Integer,Integer> thing) {
      System.out.print("testMap({");
      System.out.print(thing);
      System.out.print("})\n");
      return thing;
    }

    public Map<String,String> testStringMap(Map<String,String> thing) {
      System.out.print("testStringMap({");
      System.out.print(thing);
      System.out.print("})\n");
      return thing;
    }
  
    public Set<Integer> testSet(Set<Integer> thing) {
      System.out.print("testSet({");
      boolean first = true;
      for (int elem : thing) {
        if (first) {
          first = false;
        } else {
          System.out.print(", ");
        }
        System.out.print(elem);
      }
      System.out.print("})\n");
      return thing;
    }
  
    public List<Integer> testList(List<Integer> thing) {
      System.out.print("testList({");
      boolean first = true;
      for (int elem : thing) {
        if (first) {
          first = false;
        } else {
          System.out.print(", ");
        }
        System.out.print(elem);
      }
      System.out.print("})\n");
      return thing;
    }
  
    public Numberz testEnum(Numberz thing) {
      System.out.print("testEnum(" + thing + ")\n");
      return thing;
    }
  
    public long testTypedef(long thing) {
      System.out.print("testTypedef(" + thing + ")\n");
      return thing;
    }
  
    public Map<Integer,Map<Integer,Integer>> testMapMap(int hello) {
      System.out.print("testMapMap(" + hello + ")\n");
      Map<Integer,Map<Integer,Integer>> mapmap =
        new HashMap<Integer,Map<Integer,Integer>>();
  
      HashMap<Integer,Integer> pos = new HashMap<Integer,Integer>();
      HashMap<Integer,Integer> neg = new HashMap<Integer,Integer>();
      for (int i = 1; i < 5; i++) {
        pos.put(i, i);
        neg.put(-i, -i);
      }
  
      mapmap.put(4, pos);
      mapmap.put(-4, neg);
  
      return mapmap;
    }
  
    public Map<Long, Map<Numberz,Insanity>> testInsanity(Insanity argument) {
      System.out.print("testInsanity()\n");
  
      HashMap<Numberz,Insanity> first_map = new HashMap<Numberz, Insanity>();
      HashMap<Numberz,Insanity> second_map = new HashMap<Numberz, Insanity>();;
  
      first_map.put(Numberz.TWO, argument);
      first_map.put(Numberz.THREE, argument);
  
      Insanity looney = new Insanity();
      second_map.put(Numberz.SIX, looney);
  
      Map<Long,Map<Numberz,Insanity>> insane =
        new HashMap<Long, Map<Numberz,Insanity>>();
      insane.put((long)1, first_map);
      insane.put((long)2, second_map);
  
      return insane;
    }
  
    public Xtruct testMulti(byte arg0, int arg1, long arg2, Map<Short,String> arg3, Numberz arg4, long arg5) {
      System.out.print("testMulti()\n");
  
      Xtruct hello = new Xtruct();;
      hello.string_thing = "Hello2";
      hello.byte_thing = arg0;
      hello.i32_thing = arg1;
      hello.i64_thing = arg2;
      return hello;
    }
  
    public void testException(String arg) throws Xception, TException {
      System.out.print("testException("+arg+")\n");
      if ("Xception".equals(arg)) {
        Xception x = new Xception();
        x.errorCode = 1001;
        x.message = arg;
        throw x;
      } else if ("TException".equals(arg)) {
        throw new TException(arg);
      } else {
        Xtruct result = new Xtruct();
        result.string_thing = arg;
      }
      return;
    }
  
    public Xtruct testMultiException(String arg0, String arg1) throws Xception, Xception2 {
      System.out.print("testMultiException(" + arg0 + ", " + arg1 + ")\n");
      if (arg0.equals("Xception")) {
        Xception x = new Xception();
        x.errorCode = 1001;
        x.message = "This is an Xception";
        throw x;
      } else if (arg0.equals("Xception2")) {
        Xception2 x = new Xception2();
        x.errorCode = 2002;
        x.struct_thing = new Xtruct();
        x.struct_thing.string_thing = "This is an Xception2";
        throw x;
      }
  
      Xtruct result = new Xtruct();
      result.string_thing = arg1;
      return result;
    }
  
    public void testOneway(int sleepFor) {
      System.out.println("testOneway(" + Integer.toString(sleepFor) +
                         ") => sleeping...");
      try {
        Thread.sleep(sleepFor * 1000);
        System.out.println("Done sleeping!");
      } catch (InterruptedException ie) {
        throw new RuntimeException(ie);
      }
    }
  } // class TestHandler

  private static final List<TProtocolFactory> PROTOCOLS = Arrays.asList(
      new TBinaryProtocol.Factory(),
      new TCompactProtocol.Factory());

  public static final String HOST = "localhost";
  public static final int PORT = Integer.valueOf(
    System.getProperty("test.port", "9090"));
  protected static final int SOCKET_TIMEOUT = 1500;
  private static final Xtruct XSTRUCT = new Xtruct("Zero", (byte) 1, -3, -5);
  private static final Xtruct2 XSTRUCT2 = new Xtruct2((byte)1, XSTRUCT, 5);

  public void startServer(TProcessor processor, TProtocolFactory protoFactory) throws Exception{
    startServer(processor, protoFactory, null);
  }

  public abstract void startServer(TProcessor processor, TProtocolFactory protoFactory, TTransportFactory factory) throws Exception;

  public abstract void stopServer() throws Exception;

  public abstract TTransport getClientTransport(TTransport underlyingTransport) throws Exception;

  private void testBool(ThriftTest.Client testClient) throws TException {
    boolean t = testClient.testBool(true);
    assertEquals(true, t);
    boolean f = testClient.testBool(false);
    assertEquals(false, f);
  }

  private void testByte(ThriftTest.Client testClient) throws TException {
    byte i8 = testClient.testByte((byte)1);
    assertEquals(1, i8);
  }

  private void testDouble(ThriftTest.Client testClient) throws TException {
    double dub = testClient.testDouble(5.325098235);
    assertEquals(5.325098235, dub);
  }

  private void testEnum(ThriftTest.Client testClient) throws TException {
    assertEquals(Numberz.ONE, testClient.testEnum(Numberz.ONE));
    assertEquals(Numberz.TWO, testClient.testEnum(Numberz.TWO));
    assertEquals(Numberz.THREE, testClient.testEnum(Numberz.THREE));
    assertEquals(Numberz.FIVE, testClient.testEnum(Numberz.FIVE));
    assertEquals(Numberz.EIGHT, testClient.testEnum(Numberz.EIGHT));
  }

  private void testI32(ThriftTest.Client testClient) throws TException {
    int i32 = testClient.testI32(-1);
    assertEquals(i32, -1);
  }

  private void testI64(ThriftTest.Client testClient) throws TException {
    long i64 = testClient.testI64(-34359738368L);
    assertEquals(i64, -34359738368L);
  }

  // todo: add assertions
  private void testInsanity(ThriftTest.Client testClient) throws TException {
    Insanity insane;
  
    insane = new Insanity();
    insane.userMap = new HashMap<Numberz, Long>();
    insane.userMap.put(Numberz.FIVE, (long)5000);
    Xtruct truck = new Xtruct();
    truck.string_thing = "Truck";
    truck.byte_thing = (byte)8;
    truck.i32_thing = 8;
    truck.i64_thing = 8;
    insane.xtructs = new ArrayList<Xtruct>();
    insane.xtructs.add(truck);
    System.out.print("testInsanity()");
    Map<Long,Map<Numberz,Insanity>> whoa =
      testClient.testInsanity(insane);
    System.out.print(" = {");
    for (long key : whoa.keySet()) {
      Map<Numberz,Insanity> val = whoa.get(key);
      System.out.print(key + " => {");
  
      for (Numberz k2 : val.keySet()) {
        Insanity v2 = val.get(k2);
        System.out.print(k2 + " => {");
        Map<Numberz, Long> userMap = v2.userMap;
        System.out.print("{");
        if (userMap != null) {
          for (Numberz k3 : userMap.keySet()) {
            System.out.print(k3 + " => " + userMap.get(k3) + ", ");
          }
        }
        System.out.print("}, ");
  
        List<Xtruct> xtructs = v2.xtructs;
        System.out.print("{");
        if (xtructs != null) {
          for (Xtruct x : xtructs) {
            System.out.print("{" + "\"" + x.string_thing + "\", " + x.byte_thing + ", " + x.i32_thing + ", "+ x.i64_thing + "}, ");
          }
        }
        System.out.print("}");
  
        System.out.print("}, ");
      }
      System.out.print("}, ");
    }
    System.out.print("}\n");
  }

  public boolean useAsyncProcessor() {
      return false;
  }

  public void testIt() throws Exception {

    for (TProtocolFactory protoFactory : getProtocols()) {
      TProcessor processor = useAsyncProcessor() ? new ThriftTest.AsyncProcessor(new AsyncTestHandler()) : new ThriftTest.Processor(new TestHandler());

      startServer(processor, protoFactory);

      TSocket socket = new TSocket(HOST, PORT);
      socket.setTimeout(SOCKET_TIMEOUT);
      TTransport transport = getClientTransport(socket);

      TProtocol protocol = protoFactory.getProtocol(transport);
      ThriftTest.Client testClient = new ThriftTest.Client(protocol);

      open(transport);
      testVoid(testClient);
      testString(testClient);
      testBool(testClient);
      testByte(testClient);
      testI32(testClient);
      testI64(testClient);
      testDouble(testClient);
      testStruct(testClient);
      testNestedStruct(testClient);
      testMap(testClient);
      testStringMap(testClient);
      testSet(testClient);
      testList(testClient);
      testEnum(testClient);
      testTypedef(testClient);
      testNestedMap(testClient);
      testInsanity(testClient);
      testException(testClient);
      testOneway(testClient);
      testI32(testClient);
      transport.close();

      stopServer();
    }
  }

  public void open(TTransport transport) throws Exception {
    transport.open();
  }

  public List<TProtocolFactory> getProtocols() {
    return PROTOCOLS;  
  }

  private void testList(ThriftTest.Client testClient) throws TException {
    List<Integer> listout = new ArrayList<Integer>();
    for (int i = -2; i < 3; ++i) {
      listout.add(i);
    }
    List<Integer> listin = testClient.testList(listout);
    assertEquals(listout, listin);
  }

  private void testMap(ThriftTest.Client testClient) throws TException {
    Map<Integer,Integer> mapout = new HashMap<Integer,Integer>();
    for (int i = 0; i < 5; ++i) {
      mapout.put(i, i-10);
    }
    Map<Integer,Integer> mapin = testClient.testMap(mapout);
    assertEquals(mapout, mapin);
  }

  private void testStringMap(ThriftTest.Client testClient) throws TException {
    Map<String,String> mapout = new HashMap<String,String>();
    mapout.put("a", "123");
    mapout.put(" x y ", " with spaces ");
    mapout.put("same", "same");
    mapout.put("0", "numeric key");
    Map<String,String> mapin = testClient.testStringMap(mapout);
    assertEquals(mapout, mapin);
  }

  private void testNestedMap(ThriftTest.Client testClient) throws TException {
    Map<Integer,Map<Integer,Integer>> mm =
      testClient.testMapMap(1);
    Map<Integer,Map<Integer,Integer>> mapmap =
      new HashMap<Integer,Map<Integer,Integer>>();
  
    HashMap<Integer,Integer> pos = new HashMap<Integer,Integer>();
    HashMap<Integer,Integer> neg = new HashMap<Integer,Integer>();
    for (int i = 1; i < 5; i++) {
      pos.put(i, i);
      neg.put(-i, -i);
    }
  
    mapmap.put(4, pos);
    mapmap.put(-4, neg);
    assertEquals(mapmap, mm);
  }

  private void testNestedStruct(ThriftTest.Client testClient) throws TException {
    Xtruct2 in2 = testClient.testNest(XSTRUCT2);
    assertEquals(XSTRUCT2, in2);
  }

  private void testOneway(ThriftTest.Client testClient) throws Exception {
    long begin = System.currentTimeMillis();
    testClient.testOneway(1);
    long elapsed = System.currentTimeMillis() - begin;
    assertTrue(elapsed < 500);
  }

  private void testSet(ThriftTest.Client testClient) throws TException {
    Set<Integer> setout = new HashSet<Integer>();
    for (int i = -2; i < 3; ++i) {
      setout.add(i);
    }
    Set<Integer> setin = testClient.testSet(setout);
    assertEquals(setout, setin);
  }

  private void testString(ThriftTest.Client testClient) throws TException {
    String s = testClient.testString("Test");
    assertEquals("Test", s);
  }

  private void testStruct(ThriftTest.Client testClient) throws TException {
    assertEquals(XSTRUCT, testClient.testStruct(XSTRUCT));
  }

  private void testTypedef(ThriftTest.Client testClient) throws TException {
    assertEquals(309858235082523L, testClient.testTypedef(309858235082523L));
  }

  private void testVoid(ThriftTest.Client testClient) throws TException {
    testClient.testVoid();
  }

  private static class CallCountingTransportFactory extends TTransportFactory {
    public int count = 0;
    private final Factory factory;

    public CallCountingTransportFactory(Factory factory) {
      this.factory = factory;
    }

    @Override
    public TTransport getTransport(TTransport trans) {
      count++;
      return factory.getTransport(trans);
    }
  }

  public void testTransportFactory() throws Exception {
    for (TProtocolFactory protoFactory : getProtocols()) {
      TestHandler handler = new TestHandler();
      ThriftTest.Processor processor = new ThriftTest.Processor(handler);

      final CallCountingTransportFactory factory = new CallCountingTransportFactory(new TFramedTransport.Factory());

      startServer(processor, protoFactory, factory);
      assertEquals(0, factory.count);

      TSocket socket = new TSocket(HOST, PORT);
      socket.setTimeout(SOCKET_TIMEOUT);
      TTransport transport = getClientTransport(socket);
      open(transport);

      TProtocol protocol = protoFactory.getProtocol(transport);
      ThriftTest.Client testClient = new ThriftTest.Client(protocol);
      assertEquals(0, testClient.testByte((byte) 0));
      assertEquals(2, factory.count);
      stopServer();
    }
  }

  private void testException(ThriftTest.Client testClient) throws TException, Xception {
    try {
      testClient.testException("Xception");
      assert false;
    } catch(Xception e) {
      assertEquals(e.message, "Xception");
      assertEquals(e.errorCode, 1001);
    }
    try {
      testClient.testException("TException");
      assert false;
    } catch(TException e) {
    }
    testClient.testException("no Exception");
  }


  public static class AsyncTestHandler implements ThriftTest.AsyncIface {

    TestHandler handler = new TestHandler();

    @Override
    public void testVoid(AsyncMethodCallback<Void> resultHandler) throws TException {
      resultHandler.onComplete(null);
    }

    @Override
    public void testString(String thing, AsyncMethodCallback<String> resultHandler) throws TException {
      resultHandler.onComplete(handler.testString(thing));
    }

    @Override
    public void testBool(boolean thing, AsyncMethodCallback<Boolean> resultHandler) throws TException {
      resultHandler.onComplete(handler.testBool(thing));
    }

    @Override
    public void testByte(byte thing, AsyncMethodCallback<Byte> resultHandler) throws TException {
      resultHandler.onComplete(handler.testByte(thing));
    }

    @Override
    public void testI32(int thing, AsyncMethodCallback<Integer> resultHandler) throws TException {
      resultHandler.onComplete(handler.testI32(thing));
    }

    @Override
    public void testI64(long thing, AsyncMethodCallback<Long> resultHandler) throws TException {
      resultHandler.onComplete(handler.testI64(thing));
    }

    @Override
    public void testDouble(double thing, AsyncMethodCallback<Double> resultHandler) throws TException {
      resultHandler.onComplete(handler.testDouble(thing));
    }

    @Override
    public void testBinary(ByteBuffer thing, AsyncMethodCallback<ByteBuffer> resultHandler) throws TException {
      resultHandler.onComplete(handler.testBinary(thing));
    }

    @Override
    public void testStruct(Xtruct thing, AsyncMethodCallback<Xtruct> resultHandler) throws TException {
      resultHandler.onComplete(handler.testStruct(thing));
    }

    @Override
    public void testNest(Xtruct2 thing, AsyncMethodCallback<Xtruct2> resultHandler) throws TException {
      resultHandler.onComplete(handler.testNest(thing));
    }

    @Override
    public void testMap(Map<Integer, Integer> thing, AsyncMethodCallback<Map<Integer, Integer>> resultHandler) throws TException {
      resultHandler.onComplete(handler.testMap(thing));
    }

    @Override
    public void testStringMap(Map<String, String> thing, AsyncMethodCallback<Map<String, String>> resultHandler) throws TException {
      resultHandler.onComplete(handler.testStringMap(thing));
    }

    @Override
    public void testSet(Set<Integer> thing, AsyncMethodCallback<Set<Integer>> resultHandler) throws TException {
      resultHandler.onComplete(handler.testSet(thing));
    }

    @Override
    public void testList(List<Integer> thing, AsyncMethodCallback<List<Integer>> resultHandler) throws TException {
      resultHandler.onComplete(handler.testList(thing));
    }

    @Override
    public void testEnum(Numberz thing, AsyncMethodCallback<Numberz> resultHandler) throws TException {
      resultHandler.onComplete(handler.testEnum(thing));
    }

    @Override
    public void testTypedef(long thing, AsyncMethodCallback<Long> resultHandler) throws TException {
      resultHandler.onComplete(handler.testTypedef(thing));
    }

    @Override
    public void testMapMap(int hello, AsyncMethodCallback<Map<Integer,Map<Integer,Integer>>> resultHandler) throws TException {
      resultHandler.onComplete(handler.testMapMap(hello));
    }

    @Override
    public void testInsanity(Insanity argument, AsyncMethodCallback<Map<Long, Map<Numberz,Insanity>>> resultHandler) throws TException {
      resultHandler.onComplete(handler.testInsanity(argument));
    }

    @Override
    public void testMulti(byte arg0, int arg1, long arg2, Map<Short, String> arg3, Numberz arg4, long arg5, AsyncMethodCallback<Xtruct> resultHandler) throws TException {
      resultHandler.onComplete(handler.testMulti(arg0,arg1,arg2,arg3,arg4,arg5));
    }

    @Override
    public void testException(String arg, AsyncMethodCallback<Void> resultHandler) throws TException {
      System.out.print("testException("+arg+")\n");
      if ("Xception".equals(arg)) {
        Xception x = new Xception();
        x.errorCode = 1001;
        x.message = arg;
        // throw and onError yield the same result.
        // resultHandler.onError(x);
        // return;
        throw x;
      } else if ("TException".equals(arg)) {
        // throw new TException(arg);
        resultHandler.onError(new TException(arg));
        return;
      }
      resultHandler.onComplete(null);
    }

    @Override
    public void testMultiException(String arg0, String arg1, AsyncMethodCallback<Xtruct> resultHandler) throws TException {
      //To change body of implemented methods use File | Settings | File Templates.
    }

    @Override
    public void testOneway(int secondsToSleep, AsyncMethodCallback<Void> resultHandler) throws TException {
      handler.testOneway(secondsToSleep);
      resultHandler.onComplete(null);
    }
  }

}
