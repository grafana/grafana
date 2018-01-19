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

package org.apache.thrift.test;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.thrift.TApplicationException;
import org.apache.thrift.TException;
import org.apache.thrift.TSerializer;
import org.apache.thrift.protocol.TBinaryProtocol;
import org.apache.thrift.protocol.TCompactProtocol;
import org.apache.thrift.protocol.TJSONProtocol;
import org.apache.thrift.protocol.TProtocol;
import org.apache.thrift.protocol.TSimpleJSONProtocol;
import org.apache.thrift.transport.TFastFramedTransport;
import org.apache.thrift.transport.TFramedTransport;
import org.apache.thrift.transport.THttpClient;
import org.apache.thrift.transport.TSSLTransportFactory;
import org.apache.thrift.transport.TSocket;
import org.apache.thrift.transport.TTransport;
import org.apache.thrift.transport.TTransportException;

// Generated code
import thrift.test.Insanity;
import thrift.test.Numberz;
import thrift.test.ThriftTest;
import thrift.test.Xception;
import thrift.test.Xception2;
import thrift.test.Xtruct;
import thrift.test.Xtruct2;

/**
 * Test Java client for thrift. Essentially just a copy of the C++ version,
 * this makes a variety of requests to enable testing for both performance and
 * correctness of the output.
 *
 */
public class TestClient {

  private static int ERR_BASETYPES = 1;
  private static int ERR_STRUCTS = 2;
  private static int ERR_CONTAINERS = 4;
  private static int ERR_EXCEPTIONS = 8;
  private static int ERR_UNKNOWN = 64;

  public static void main(String [] args) {
    String host = "localhost";
    int port = 9090;
    int numTests = 1;
    String protocol_type = "binary";
    String transport_type = "buffered";
    boolean ssl = false;

    int socketTimeout = 1000;

    try {
      for (int i = 0; i < args.length; ++i) {
        if (args[i].startsWith("--host")) {
          host = args[i].split("=")[1];
          host.trim();
        } else if (args[i].startsWith("--port")) {
          port = Integer.valueOf(args[i].split("=")[1]);
        } else if (args[i].startsWith("--n") ||
            args[i].startsWith("--testloops")){
          numTests = Integer.valueOf(args[i].split("=")[1]);
        } else if (args[i].equals("--timeout")) {
          socketTimeout = Integer.valueOf(args[i].split("=")[1]);
        } else if (args[i].startsWith("--protocol")) {
          protocol_type = args[i].split("=")[1];
          protocol_type.trim();
        } else if (args[i].startsWith("--transport")) {
          transport_type = args[i].split("=")[1];
          transport_type.trim();
        } else if (args[i].equals("--ssl")) {
          ssl = true;
        } else if (args[i].equals("--help")) {
          System.out.println("Allowed options:");
          System.out.println("  --help\t\t\tProduce help message");
          System.out.println("  --host=arg (=" + host + ")\tHost to connect");
          System.out.println("  --port=arg (=" + port + ")\tPort number to connect");
          System.out.println("  --transport=arg (=" + transport_type + ")\n\t\t\t\tTransport: buffered, framed, fastframed, http");
          System.out.println("  --protocol=arg (=" + protocol_type + ")\tProtocol: binary, json, compact");
          System.out.println("  --ssl\t\t\tEncrypted Transport using SSL");
          System.out.println("  --testloops[--n]=arg (=" + numTests + ")\tNumber of Tests");
          System.exit(0);
        }
      }
    } catch (Exception x) {
      System.err.println("Can not parse arguments! See --help");
      System.exit(ERR_UNKNOWN);
    }

    try {
      if (protocol_type.equals("binary")) {
      } else if (protocol_type.equals("compact")) {
      } else if (protocol_type.equals("json")) {
      } else {
        throw new Exception("Unknown protocol type! " + protocol_type);
      }
      if (transport_type.equals("buffered")) {
      } else if (transport_type.equals("framed")) {
      } else if (transport_type.equals("fastframed")) {
      } else if (transport_type.equals("http")) {
      } else {
        throw new Exception("Unknown transport type! " + transport_type);
      }
      if (transport_type.equals("http") && ssl == true) {
        throw new Exception("SSL is not supported over http.");
      }
    } catch (Exception e) {
      System.err.println("Error: " + e.getMessage());
      System.exit(ERR_UNKNOWN);
    }

    TTransport transport = null;

    try {
      if (transport_type.equals("http")) {
        String url = "http://" + host + ":" + port + "/service";
        transport = new THttpClient(url);
      } else {
        TSocket socket = null;
        if (ssl == true) {
          socket = TSSLTransportFactory.getClientSocket(host, port, 0);
        } else {
          socket = new TSocket(host, port);
        }
        socket.setTimeout(socketTimeout);
        transport = socket;
        if (transport_type.equals("buffered")) {
        } else if (transport_type.equals("framed")) {
          transport = new TFramedTransport(transport);
        } else if (transport_type.equals("fastframed")) {
          transport = new TFastFramedTransport(transport);
        }
      }
    } catch (Exception x) {
      x.printStackTrace();
      System.exit(ERR_UNKNOWN);
    }

    TProtocol tProtocol = null;
    if (protocol_type.equals("json")) {
      tProtocol = new TJSONProtocol(transport);
    } else if (protocol_type.equals("compact")) {
      tProtocol = new TCompactProtocol(transport);
    } else {
      tProtocol = new TBinaryProtocol(transport);
    }

    ThriftTest.Client testClient =
      new ThriftTest.Client(tProtocol);
    Insanity insane = new Insanity();

    long timeMin = 0;
    long timeMax = 0;
    long timeTot = 0;

    int returnCode = 0;
    for (int test = 0; test < numTests; ++test) {
      try {
        /**
         * CONNECT TEST
         */
        System.out.println("Test #" + (test+1) + ", " + "connect " + host + ":" + port);

        if (transport.isOpen() == false) {
          try {
            transport.open();
          } catch (TTransportException ttx) {
            ttx.printStackTrace();
            System.out.println("Connect failed: " + ttx.getMessage());
            System.exit(ERR_UNKNOWN);
          }
        }

        long start = System.nanoTime();

        /**
         * VOID TEST
         */
        try {
          System.out.print("testVoid()");
          testClient.testVoid();
          System.out.print(" = void\n");
        } catch (TApplicationException tax) {
          tax.printStackTrace();
          returnCode |= ERR_BASETYPES;
        }

        /**
         * STRING TEST
         */
        System.out.print("testString(\"Test\")");
        String s = testClient.testString("Test");
        System.out.print(" = \"" + s + "\"\n");
        if (!s.equals("Test")) {
          returnCode |= ERR_BASETYPES;
          System.out.println("*** FAILURE ***\n");
        }

        /**
         * BYTE TEST
         */
        System.out.print("testByte(1)");
        byte i8 = testClient.testByte((byte)1);
        System.out.print(" = " + i8 + "\n");
        if (i8 != 1) {
          returnCode |= ERR_BASETYPES;
          System.out.println("*** FAILURE ***\n");
        }

        /**
         * I32 TEST
         */
        System.out.print("testI32(-1)");
        int i32 = testClient.testI32(-1);
        System.out.print(" = " + i32 + "\n");
        if (i32 != -1) {
          returnCode |= ERR_BASETYPES;
          System.out.println("*** FAILURE ***\n");
        }

        /**
         * I64 TEST
         */
        System.out.print("testI64(-34359738368)");
        long i64 = testClient.testI64(-34359738368L);
        System.out.print(" = " + i64 + "\n");
        if (i64 != -34359738368L) {
          returnCode |= ERR_BASETYPES;
          System.out.println("*** FAILURE ***\n");
        }

        /**
         * DOUBLE TEST
         */
        System.out.print("testDouble(-5.325098235)");
        double dub = testClient.testDouble(-5.325098235);
        System.out.print(" = " + dub + "\n");
        if (Math.abs(dub - (-5.325098235)) > 0.001) {
          returnCode |= ERR_BASETYPES;
          System.out.println("*** FAILURE ***\n");
        }

        /**
         * BINARY TEST
         */
        try {
          System.out.print("testBinary(-128...127) = ");
          byte[] data = new byte[] {-128, -127, -126, -125, -124, -123, -122, -121, -120, -119, -118, -117, -116, -115, -114, -113, -112, -111, -110, -109, -108, -107, -106, -105, -104, -103, -102, -101, -100, -99, -98, -97, -96, -95, -94, -93, -92, -91, -90, -89, -88, -87, -86, -85, -84, -83, -82, -81, -80, -79, -78, -77, -76, -75, -74, -73, -72, -71, -70, -69, -68, -67, -66, -65, -64, -63, -62, -61, -60, -59, -58, -57, -56, -55, -54, -53, -52, -51, -50, -49, -48, -47, -46, -45, -44, -43, -42, -41, -40, -39, -38, -37, -36, -35, -34, -33, -32, -31, -30, -29, -28, -27, -26, -25, -24, -23, -22, -21, -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127};
          ByteBuffer bin = testClient.testBinary(ByteBuffer.wrap(data));
          bin.mark();
          byte[] bytes = new byte[bin.limit() - bin.position()];
          bin.get(bytes);
          bin.reset();
          System.out.print("{");
          boolean first = true;
          for (int i = 0; i < bytes.length; ++i) {
            if (first)
              first = false;
            else
              System.out.print(", ");
            System.out.print(bytes[i]);
          }
          System.out.println("}");
          if (!ByteBuffer.wrap(data).equals(bin)) {
            returnCode |= ERR_BASETYPES;
            System.out.println("*** FAILURE ***\n");
          }
        } catch (Exception ex) {
          returnCode |= ERR_BASETYPES;
          System.out.println("\n*** FAILURE ***\n");
          ex.printStackTrace(System.out);
        }

        /**
         * STRUCT TEST
         */
        System.out.print("testStruct({\"Zero\", 1, -3, -5})");
        Xtruct out = new Xtruct();
        out.string_thing = "Zero";
        out.byte_thing = (byte) 1;
        out.i32_thing = -3;
        out.i64_thing = -5;
        Xtruct in = testClient.testStruct(out);
        System.out.print(" = {" + "\"" +
                         in.string_thing + "\"," +
                         in.byte_thing + ", " +
                         in.i32_thing + ", " +
                         in.i64_thing + "}\n");
        if (!in.equals(out)) {
          returnCode |= ERR_STRUCTS;
          System.out.println("*** FAILURE ***\n");
        }

        /**
         * NESTED STRUCT TEST
         */
        System.out.print("testNest({1, {\"Zero\", 1, -3, -5}), 5}");
        Xtruct2 out2 = new Xtruct2();
        out2.byte_thing = (short)1;
        out2.struct_thing = out;
        out2.i32_thing = 5;
        Xtruct2 in2 = testClient.testNest(out2);
        in = in2.struct_thing;
        System.out.print(" = {" + in2.byte_thing + ", {" + "\"" +
                         in.string_thing + "\", " +
                         in.byte_thing + ", " +
                         in.i32_thing + ", " +
                         in.i64_thing + "}, " +
                         in2.i32_thing + "}\n");
        if (!in2.equals(out2)) {
          returnCode |= ERR_STRUCTS;
          System.out.println("*** FAILURE ***\n");
        }

        /**
         * MAP TEST
         */
        Map<Integer,Integer> mapout = new HashMap<Integer,Integer>();
        for (int i = 0; i < 5; ++i) {
          mapout.put(i, i-10);
        }
        System.out.print("testMap({");
        boolean first = true;
        for (int key : mapout.keySet()) {
          if (first) {
            first = false;
          } else {
            System.out.print(", ");
          }
          System.out.print(key + " => " + mapout.get(key));
        }
        System.out.print("})");
        Map<Integer,Integer> mapin = testClient.testMap(mapout);
        System.out.print(" = {");
        first = true;
        for (int key : mapin.keySet()) {
          if (first) {
            first = false;
          } else {
            System.out.print(", ");
          }
          System.out.print(key + " => " + mapout.get(key));
        }
        System.out.print("}\n");
        if (!mapout.equals(mapin)) {
          returnCode |= ERR_CONTAINERS;
          System.out.println("*** FAILURE ***\n");
        }

        /**
         * STRING MAP TEST
         */
        try {
          Map<String, String> smapout = new HashMap<String, String>();
          smapout.put("a", "2");
          smapout.put("b", "blah");
          smapout.put("some", "thing");
          for (String key : smapout.keySet()) {
            if (first) {
              first = false;
            } else {
              System.out.print(", ");
            }
            System.out.print(key + " => " + smapout.get(key));
          }
          System.out.print("})");
          Map<String, String> smapin = testClient.testStringMap(smapout);
          System.out.print(" = {");
          first = true;
          for (String key : smapin.keySet()) {
            if (first) {
              first = false;
            } else {
              System.out.print(", ");
            }
            System.out.print(key + " => " + smapout.get(key));
          }
          System.out.print("}\n");
          if (!smapout.equals(smapin)) {
            returnCode |= ERR_CONTAINERS;
            System.out.println("*** FAILURE ***\n");
          }
        } catch (Exception ex) {
          returnCode |= ERR_CONTAINERS;
          System.out.println("*** FAILURE ***\n");
          ex.printStackTrace(System.out);
        }

        /**
         * SET TEST
         */
        Set<Integer> setout = new HashSet<Integer>();
        for (int i = -2; i < 3; ++i) {
          setout.add(i);
        }
        System.out.print("testSet({");
        first = true;
        for (int elem : setout) {
          if (first) {
            first = false;
          } else {
            System.out.print(", ");
          }
          System.out.print(elem);
        }
        System.out.print("})");
        Set<Integer> setin = testClient.testSet(setout);
        System.out.print(" = {");
        first = true;
        for (int elem : setin) {
          if (first) {
            first = false;
          } else {
            System.out.print(", ");
          }
          System.out.print(elem);
        }
        System.out.print("}\n");
        if (!setout.equals(setin)) {
          returnCode |= ERR_CONTAINERS;
          System.out.println("*** FAILURE ***\n");
        }

        /**
         * LIST TEST
         */
        List<Integer> listout = new ArrayList<Integer>();
        for (int i = -2; i < 3; ++i) {
          listout.add(i);
        }
        System.out.print("testList({");
        first = true;
        for (int elem : listout) {
          if (first) {
            first = false;
          } else {
            System.out.print(", ");
          }
          System.out.print(elem);
        }
        System.out.print("})");
        List<Integer> listin = testClient.testList(listout);
        System.out.print(" = {");
        first = true;
        for (int elem : listin) {
          if (first) {
            first = false;
          } else {
            System.out.print(", ");
          }
          System.out.print(elem);
        }
        System.out.print("}\n");
        if (!listout.equals(listin)) {
          returnCode |= ERR_CONTAINERS;
          System.out.println("*** FAILURE ***\n");
        }

        /**
         * ENUM TEST
         */
        System.out.print("testEnum(ONE)");
        Numberz ret = testClient.testEnum(Numberz.ONE);
        System.out.print(" = " + ret + "\n");
        if (ret != Numberz.ONE) {
          returnCode |= ERR_STRUCTS;
          System.out.println("*** FAILURE ***\n");
        }

        System.out.print("testEnum(TWO)");
        ret = testClient.testEnum(Numberz.TWO);
        System.out.print(" = " + ret + "\n");
        if (ret != Numberz.TWO) {
          returnCode |= ERR_STRUCTS;
          System.out.println("*** FAILURE ***\n");
        }

        System.out.print("testEnum(THREE)");
        ret = testClient.testEnum(Numberz.THREE);
        System.out.print(" = " + ret + "\n");
        if (ret != Numberz.THREE) {
          returnCode |= ERR_STRUCTS;
          System.out.println("*** FAILURE ***\n");
        }

        System.out.print("testEnum(FIVE)");
        ret = testClient.testEnum(Numberz.FIVE);
        System.out.print(" = " + ret + "\n");
        if (ret != Numberz.FIVE) {
          returnCode |= ERR_STRUCTS;
          System.out.println("*** FAILURE ***\n");
        }

        System.out.print("testEnum(EIGHT)");
        ret = testClient.testEnum(Numberz.EIGHT);
        System.out.print(" = " + ret + "\n");
        if (ret != Numberz.EIGHT) {
          returnCode |= ERR_STRUCTS;
          System.out.println("*** FAILURE ***\n");
        }

        /**
         * TYPEDEF TEST
         */
        System.out.print("testTypedef(309858235082523)");
        long uid = testClient.testTypedef(309858235082523L);
        System.out.print(" = " + uid + "\n");
        if (uid != 309858235082523L) {
          returnCode |= ERR_BASETYPES;
          System.out.println("*** FAILURE ***\n");
        }

        /**
         * NESTED MAP TEST
         */
        System.out.print("testMapMap(1)");
        Map<Integer,Map<Integer,Integer>> mm =
          testClient.testMapMap(1);
        System.out.print(" = {");
        for (int key : mm.keySet()) {
          System.out.print(key + " => {");
          Map<Integer,Integer> m2 = mm.get(key);
          for (int k2 : m2.keySet()) {
            System.out.print(k2 + " => " + m2.get(k2) + ", ");
          }
          System.out.print("}, ");
        }
        System.out.print("}\n");
        if (mm.size() != 2 || !mm.containsKey(4) || !mm.containsKey(-4)) {
          returnCode |= ERR_CONTAINERS;
          System.out.println("*** FAILURE ***\n");
        } else {
          Map<Integer, Integer> m1 = mm.get(4);
          Map<Integer, Integer> m2 = mm.get(-4);
          if (m1.get(1) != 1 || m1.get(2) != 2 || m1.get(3) != 3 || m1.get(4) != 4 ||
              m2.get(-1) != -1 || m2.get(-2) != -2 || m2.get(-3) != -3 || m2.get(-4) != -4) {
            returnCode |= ERR_CONTAINERS;
            System.out.println("*** FAILURE ***\n");
          }
        }

        /**
         * INSANITY TEST
         */

        boolean insanityFailed = true;
        try {
          Xtruct hello = new Xtruct();
          hello.string_thing = "Hello2";
          hello.byte_thing = 2;
          hello.i32_thing = 2;
          hello.i64_thing = 2;

          Xtruct goodbye = new Xtruct();
          goodbye.string_thing = "Goodbye4";
          goodbye.byte_thing = (byte)4;
          goodbye.i32_thing = 4;
          goodbye.i64_thing = (long)4;

          insane.userMap = new HashMap<Numberz, Long>();
          insane.userMap.put(Numberz.EIGHT, (long)8);
          insane.userMap.put(Numberz.FIVE, (long)5);
          insane.xtructs = new ArrayList<Xtruct>();
          insane.xtructs.add(goodbye);
          insane.xtructs.add(hello);

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
          if (whoa.size() == 2 && whoa.containsKey(1L) && whoa.containsKey(2L)) {
            Map<Numberz, Insanity> first_map = whoa.get(1L);
            Map<Numberz, Insanity> second_map = whoa.get(2L);
            if (first_map.size() == 2 &&
                first_map.containsKey(Numberz.TWO) &&
                first_map.containsKey(Numberz.THREE) &&
                second_map.size() == 1 &&
                second_map.containsKey(Numberz.SIX) &&
                insane.equals(first_map.get(Numberz.TWO)) &&
                insane.equals(first_map.get(Numberz.THREE))) {
              Insanity six =second_map.get(Numberz.SIX);
              // Cannot use "new Insanity().equals(six)" because as of now, struct/container
              // fields with default requiredness have isset=false for local instances and yet
              // received empty values from other languages like C++ have isset=true .
              if (six.getUserMapSize() == 0 && six.getXtructsSize() == 0) {
                // OK
                insanityFailed = false;
              }
            }
          }
        } catch (Exception ex) {
          returnCode |= ERR_STRUCTS;
          System.out.println("*** FAILURE ***\n");
          ex.printStackTrace(System.out);
          insanityFailed = false;
        }
        if (insanityFailed) {
          returnCode |= ERR_STRUCTS;
          System.out.println("*** FAILURE ***\n");
        }

        /**
         * EXECPTION TEST
         */
        try {
          System.out.print("testClient.testException(\"Xception\") =>");
          testClient.testException("Xception");
          System.out.print("  void\n*** FAILURE ***\n");
          returnCode |= ERR_EXCEPTIONS;
        } catch(Xception e) {
          System.out.printf("  {%d, \"%s\"}\n", e.errorCode, e.message);
        }

        try {
          System.out.print("testClient.testException(\"TException\") =>");
          testClient.testException("TException");
          System.out.print("  void\n*** FAILURE ***\n");
          returnCode |= ERR_EXCEPTIONS;
        } catch(TException e) {
          System.out.printf("  {\"%s\"}\n", e.getMessage());
        }

        try {
          System.out.print("testClient.testException(\"success\") =>");
          testClient.testException("success");
          System.out.print("  void\n");
        }catch(Exception e) {
          System.out.printf("  exception\n*** FAILURE ***\n");
          returnCode |= ERR_EXCEPTIONS;
        }


        /**
         * MULTI EXCEPTION TEST
         */

        try {
          System.out.printf("testClient.testMultiException(\"Xception\", \"test 1\") =>");
          testClient.testMultiException("Xception", "test 1");
          System.out.print("  result\n*** FAILURE ***\n");
          returnCode |= ERR_EXCEPTIONS;
        } catch(Xception e) {
          System.out.printf("  {%d, \"%s\"}\n", e.errorCode, e.message);
        }

        try {
          System.out.printf("testClient.testMultiException(\"Xception2\", \"test 2\") =>");
          testClient.testMultiException("Xception2", "test 2");
          System.out.print("  result\n*** FAILURE ***\n");
          returnCode |= ERR_EXCEPTIONS;
        } catch(Xception2 e) {
          System.out.printf("  {%d, {\"%s\"}}\n", e.errorCode, e.struct_thing.string_thing);
        }

        try {
          System.out.print("testClient.testMultiException(\"success\", \"test 3\") =>");
          Xtruct result;
          result = testClient.testMultiException("success", "test 3");
          System.out.printf("  {{\"%s\"}}\n", result.string_thing);
        } catch(Exception e) {
          System.out.printf("  exception\n*** FAILURE ***\n");
          returnCode |= ERR_EXCEPTIONS;
        }



        /**
         * ONEWAY TEST
         */
        System.out.print("testOneway(3)...");
        long startOneway = System.nanoTime();
        testClient.testOneway(3);
        long onewayElapsedMillis = (System.nanoTime() - startOneway) / 1000000;
        if (onewayElapsedMillis > 200) {
          System.out.println("Oneway test failed: took " +
                             Long.toString(onewayElapsedMillis) +
                             "ms");
          System.out.printf("*** FAILURE ***\n");
          returnCode |= ERR_BASETYPES;
        } else {
          System.out.println("Success - took " +
                             Long.toString(onewayElapsedMillis) +
                             "ms");
        }


        long stop = System.nanoTime();
        long tot = stop-start;

        System.out.println("Total time: " + tot/1000 + "us");

        if (timeMin == 0 || tot < timeMin) {
          timeMin = tot;
        }
        if (tot > timeMax) {
          timeMax = tot;
        }
        timeTot += tot;

        transport.close();
      } catch (Exception x) {
        System.out.printf("*** FAILURE ***\n");
        x.printStackTrace();
        returnCode |= ERR_UNKNOWN;
      }
    }

    long timeAvg = timeTot / numTests;

    System.out.println("Min time: " + timeMin/1000 + "us");
    System.out.println("Max time: " + timeMax/1000 + "us");
    System.out.println("Avg time: " + timeAvg/1000 + "us");

    try {
      String json = (new TSerializer(new TSimpleJSONProtocol.Factory())).toString(insane);
      System.out.println("\nSample TSimpleJSONProtocol output:\n" + json);
    } catch (TException x) {
      System.out.println("*** FAILURE ***");
      x.printStackTrace();
      returnCode |= ERR_BASETYPES;
    }


    System.exit(returnCode);
  }
}
