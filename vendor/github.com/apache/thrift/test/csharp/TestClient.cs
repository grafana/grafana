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

using System;
using System.Linq;
using System.Diagnostics;
using System.Collections.Generic;
using System.Threading;
using System.Security.Cryptography.X509Certificates;
using Thrift.Collections;
using Thrift.Protocol;
using Thrift.Transport;
using Thrift.Test;
using System.Security.Authentication;

namespace Test
{
    public class TestClient
    {
        private class TestParams
        {
            public int numIterations = 1;
            public string host = "localhost";
            public int port = 9090;
            public string url;
            public string pipe;
            public bool buffered;
            public bool framed;
            public string protocol;
            public bool encrypted = false;
            protected bool _isFirstTransport = true;


            public TTransport CreateTransport()
            {
                if (url == null)
                {
                    // endpoint transport
                    TTransport trans = null;
                    if (pipe != null)
                        trans = new TNamedPipeClientTransport(pipe);
                    else
                    {
                        if (encrypted)
                        {
                            string certPath = "../keys/client.p12";
                            X509Certificate cert = new X509Certificate2(certPath, "thrift");
                            trans = new TTLSSocket(host, port, 0, cert, (o, c, chain, errors) => true, null, SslProtocols.Tls);
                        }
                        else
                        {
                            trans = new TSocket(host, port);
                        }
                    }

                    // layered transport
                    if (buffered)
                        trans = new TBufferedTransport(trans);
                    if (framed)
                        trans = new TFramedTransport(trans);

                    if (_isFirstTransport)
                    {
                        //ensure proper open/close of transport
                        trans.Open();
                        trans.Close();
                        _isFirstTransport = false;
                    }
                    return trans;
                }
                else
                {
                    return new THttpClient(new Uri(url));
                }
            }

            public TProtocol CreateProtocol(TTransport transport)
            {
                if (protocol == "compact")
                    return new TCompactProtocol(transport);
                else if (protocol == "json")
                    return new TJSONProtocol(transport);
                else
                    return new TBinaryProtocol(transport);
            }
        };

        private const int ErrorBaseTypes = 1;
        private const int ErrorStructs = 2;
        private const int ErrorContainers = 4;
        private const int ErrorExceptions = 8;
        private const int ErrorUnknown = 64;

        private class ClientTest
        {
            private readonly TTransport transport;
            private readonly ThriftTest.Client client;
            private readonly int numIterations;
            private bool done;

            public int ReturnCode { get; set; }

            public ClientTest(TestParams param)
            {
                transport = param.CreateTransport();
                client = new ThriftTest.Client(param.CreateProtocol(transport));
                numIterations = param.numIterations;
            }
            public void Execute()
            {
                if (done)
                {
                    Console.WriteLine("Execute called more than once");
                    throw new InvalidOperationException();
                }

                for (int i = 0; i < numIterations; i++)
                {
                    try
                    {
                        if (!transport.IsOpen)
                            transport.Open();
                    }
                    catch (TTransportException ex)
                    {
                        Console.WriteLine("*** FAILED ***");
                        Console.WriteLine("Connect failed: " + ex.Message);
                        ReturnCode |= ErrorUnknown;
                        Console.WriteLine(ex.Message + " ST: " + ex.StackTrace);
                        continue;
                    }

                    try
                    {
                        ReturnCode |= ExecuteClientTest(client);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("*** FAILED ***");
                        Console.WriteLine(ex.Message + " ST: " + ex.StackTrace);
                        ReturnCode |= ErrorUnknown;
                    }
                }
                try
                {
                    transport.Close();
                }
                catch(Exception ex)
                {
                    Console.WriteLine("Error while closing transport");
                    Console.WriteLine(ex.Message + " ST: " + ex.StackTrace);
                }
                done = true;
            }
        }

        public static int Execute(string[] args)
        {
            try
            {
                TestParams param = new TestParams();
                int numThreads = 1;
                try
                {
                    for (int i = 0; i < args.Length; i++)
                    {
                        if (args[i] == "-u")
                        {
                            param.url = args[++i];
                        }
                        else if (args[i] == "-n")
                        {
                            param.numIterations = Convert.ToInt32(args[++i]);
                        }
                        else if (args[i] == "-pipe")  // -pipe <name>
                        {
                            param.pipe = args[++i];
                            Console.WriteLine("Using named pipes transport");
                        }
                        else if (args[i].Contains("--host="))
                        {
                            param.host = args[i].Substring(args[i].IndexOf("=") + 1);
                        }
                        else if (args[i].Contains("--port="))
                        {
                            param.port = int.Parse(args[i].Substring(args[i].IndexOf("=")+1));
                        }
                        else if (args[i] == "-b" || args[i] == "--buffered" || args[i] == "--transport=buffered")
                        {
                            param.buffered = true;
                            Console.WriteLine("Using buffered sockets");
                        }
                        else if (args[i] == "-f" || args[i] == "--framed"  || args[i] == "--transport=framed")
                        {
                            param.framed = true;
                            Console.WriteLine("Using framed transport");
                        }
                        else if (args[i] == "-t")
                        {
                            numThreads = Convert.ToInt32(args[++i]);
                        }
                        else if (args[i] == "--compact" || args[i] == "--protocol=compact")
                        {
                            param.protocol = "compact";
                            Console.WriteLine("Using compact protocol");
                        }
                        else if (args[i] == "--json" || args[i] == "--protocol=json")
                        {
                            param.protocol = "json";
                            Console.WriteLine("Using JSON protocol");
                        }
                        else if (args[i] == "--ssl")
                        {
                            param.encrypted = true;
                            Console.WriteLine("Using encrypted transport");
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine("*** FAILED ***");
                    Console.WriteLine("Error while  parsing arguments");
                    Console.WriteLine(ex.Message + " ST: " + ex.StackTrace);
                    return ErrorUnknown;
                }

                var tests = Enumerable.Range(0, numThreads).Select(_ => new ClientTest(param)).ToArray();
                //issue tests on separate threads simultaneously
                var threads = tests.Select(test => new Thread(test.Execute)).ToArray();
                DateTime start = DateTime.Now;
                foreach (var t in threads)
                    t.Start();
                foreach (var t in threads)
                    t.Join();
                Console.WriteLine("Total time: " + (DateTime.Now - start));
                Console.WriteLine();
                return tests.Select(t => t.ReturnCode).Aggregate((r1, r2) => r1 | r2);
            }
            catch (Exception outerEx)
            {
                Console.WriteLine("*** FAILED ***");
                Console.WriteLine("Unexpected error");
                Console.WriteLine(outerEx.Message + " ST: " + outerEx.StackTrace);
                return ErrorUnknown;
            }
        }

        public static string BytesToHex(byte[] data) {
            return BitConverter.ToString(data).Replace("-", string.Empty);
        }

        public static byte[] PrepareTestData(bool randomDist)
        {
            byte[] retval = new byte[0x100];
            int initLen = Math.Min(0x100,retval.Length);

            // linear distribution, unless random is requested
            if (!randomDist) {
                for (var i = 0; i < initLen; ++i) {
                    retval[i] = (byte)i;
                }
                return retval;
            }

            // random distribution
            for (var i = 0; i < initLen; ++i) {
                retval[i] = (byte)0;
            }
            var rnd = new Random();
            for (var i = 1; i < initLen; ++i) {
                while( true) {
                    int nextPos = rnd.Next() % initLen;
                    if (retval[nextPos] == 0) {
                        retval[nextPos] = (byte)i;
                        break;
                    }
                }
            }
            return retval;
        }

        public static int ExecuteClientTest(ThriftTest.Client client)
        {
            int returnCode = 0;

            Console.Write("testVoid()");
            client.testVoid();
            Console.WriteLine(" = void");

            Console.Write("testString(\"Test\")");
            string s = client.testString("Test");
            Console.WriteLine(" = \"" + s + "\"");
            if ("Test" != s)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorBaseTypes;
            }

            Console.Write("testBool(true)");
            bool t = client.testBool((bool)true);
            Console.WriteLine(" = " + t);
            if (!t)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorBaseTypes;
            }
            Console.Write("testBool(false)");
            bool f = client.testBool((bool)false);
            Console.WriteLine(" = " + f);
            if (f)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorBaseTypes;
            }

            Console.Write("testByte(1)");
            sbyte i8 = client.testByte((sbyte)1);
            Console.WriteLine(" = " + i8);
            if (1 != i8)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorBaseTypes;
            }

            Console.Write("testI32(-1)");
            int i32 = client.testI32(-1);
            Console.WriteLine(" = " + i32);
            if (-1 != i32)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorBaseTypes;
            }

            Console.Write("testI64(-34359738368)");
            long i64 = client.testI64(-34359738368);
            Console.WriteLine(" = " + i64);
            if (-34359738368 != i64)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorBaseTypes;
            }

            // TODO: Validate received message
            Console.Write("testDouble(5.325098235)");
            double dub = client.testDouble(5.325098235);
            Console.WriteLine(" = " + dub);
            if (5.325098235 != dub)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorBaseTypes;
            }
            Console.Write("testDouble(-0.000341012439638598279)");
            dub = client.testDouble(-0.000341012439638598279);
            Console.WriteLine(" = " + dub);
            if (-0.000341012439638598279 != dub)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorBaseTypes;
            }

            byte[] binOut = PrepareTestData(true);
            Console.Write("testBinary(" + BytesToHex(binOut) + ")");
            try
            {
                byte[] binIn = client.testBinary(binOut);
                Console.WriteLine(" = " + BytesToHex(binIn));
                if (binIn.Length != binOut.Length)
                {
                    Console.WriteLine("*** FAILED ***");
                    returnCode |= ErrorBaseTypes;
                }
                for (int ofs = 0; ofs < Math.Min(binIn.Length, binOut.Length); ++ofs)
                    if (binIn[ofs] != binOut[ofs])
                    {
                        Console.WriteLine("*** FAILED ***");
                        returnCode |= ErrorBaseTypes;
                    }
            }
            catch (Thrift.TApplicationException ex)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorBaseTypes;
                Console.WriteLine(ex.Message + " ST: " + ex.StackTrace);
            }

            // binary equals? only with hashcode option enabled ...
            Console.WriteLine("Test CrazyNesting");
            if( typeof(CrazyNesting).GetMethod("Equals").DeclaringType == typeof(CrazyNesting))
            {
                CrazyNesting one = new CrazyNesting();
                CrazyNesting two = new CrazyNesting();
                one.String_field = "crazy";
                two.String_field = "crazy";
                one.Binary_field = new byte[10] { 0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0xFF };
                two.Binary_field = new byte[10] { 0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0xFF };
                if (!one.Equals(two))
                {
                    Console.WriteLine("*** FAILED ***");
                    returnCode |= ErrorContainers;
                    throw new Exception("CrazyNesting.Equals failed");
                }
            }

            // TODO: Validate received message
            Console.Write("testStruct({\"Zero\", 1, -3, -5})");
            Xtruct o = new Xtruct();
            o.String_thing = "Zero";
            o.Byte_thing = (sbyte)1;
            o.I32_thing = -3;
            o.I64_thing = -5;
            Xtruct i = client.testStruct(o);
            Console.WriteLine(" = {\"" + i.String_thing + "\", " + i.Byte_thing + ", " + i.I32_thing + ", " + i.I64_thing + "}");

            // TODO: Validate received message
            Console.Write("testNest({1, {\"Zero\", 1, -3, -5}, 5})");
            Xtruct2 o2 = new Xtruct2();
            o2.Byte_thing = (sbyte)1;
            o2.Struct_thing = o;
            o2.I32_thing = 5;
            Xtruct2 i2 = client.testNest(o2);
            i = i2.Struct_thing;
            Console.WriteLine(" = {" + i2.Byte_thing + ", {\"" + i.String_thing + "\", " + i.Byte_thing + ", " + i.I32_thing + ", " + i.I64_thing + "}, " + i2.I32_thing + "}");

            Dictionary<int, int> mapout = new Dictionary<int, int>();
            for (int j = 0; j < 5; j++)
            {
                mapout[j] = j - 10;
            }
            Console.Write("testMap({");
            bool first = true;
            foreach (int key in mapout.Keys)
            {
                if (first)
                {
                    first = false;
                }
                else
                {
                    Console.Write(", ");
                }
                Console.Write(key + " => " + mapout[key]);
            }
            Console.Write("})");

            Dictionary<int, int> mapin = client.testMap(mapout);

            Console.Write(" = {");
            first = true;
            foreach (int key in mapin.Keys)
            {
                if (first)
                {
                    first = false;
                }
                else
                {
                    Console.Write(", ");
                }
                Console.Write(key + " => " + mapin[key]);
            }
            Console.WriteLine("}");

            // TODO: Validate received message
            List<int> listout = new List<int>();
            for (int j = -2; j < 3; j++)
            {
                listout.Add(j);
            }
            Console.Write("testList({");
            first = true;
            foreach (int j in listout)
            {
                if (first)
                {
                    first = false;
                }
                else
                {
                    Console.Write(", ");
                }
                Console.Write(j);
            }
            Console.Write("})");

            List<int> listin = client.testList(listout);

            Console.Write(" = {");
            first = true;
            foreach (int j in listin)
            {
                if (first)
                {
                    first = false;
                }
                else
                {
                    Console.Write(", ");
                }
                Console.Write(j);
            }
            Console.WriteLine("}");

            //set
            // TODO: Validate received message
            THashSet<int> setout = new THashSet<int>();
            for (int j = -2; j < 3; j++)
            {
                setout.Add(j);
            }
            Console.Write("testSet({");
            first = true;
            foreach (int j in setout)
            {
                if (first)
                {
                    first = false;
                }
                else
                {
                    Console.Write(", ");
                }
                Console.Write(j);
            }
            Console.Write("})");

            THashSet<int> setin = client.testSet(setout);

            Console.Write(" = {");
            first = true;
            foreach (int j in setin)
            {
                if (first)
                {
                    first = false;
                }
                else
                {
                    Console.Write(", ");
                }
                Console.Write(j);
            }
            Console.WriteLine("}");


            Console.Write("testEnum(ONE)");
            Numberz ret = client.testEnum(Numberz.ONE);
            Console.WriteLine(" = " + ret);
            if (Numberz.ONE != ret)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorStructs;
            }

            Console.Write("testEnum(TWO)");
            ret = client.testEnum(Numberz.TWO);
            Console.WriteLine(" = " + ret);
            if (Numberz.TWO != ret)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorStructs;
            }

            Console.Write("testEnum(THREE)");
            ret = client.testEnum(Numberz.THREE);
            Console.WriteLine(" = " + ret);
            if (Numberz.THREE != ret)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorStructs;
            }

            Console.Write("testEnum(FIVE)");
            ret = client.testEnum(Numberz.FIVE);
            Console.WriteLine(" = " + ret);
            if (Numberz.FIVE != ret)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorStructs;
            }

            Console.Write("testEnum(EIGHT)");
            ret = client.testEnum(Numberz.EIGHT);
            Console.WriteLine(" = " + ret);
            if (Numberz.EIGHT != ret)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorStructs;
            }

            Console.Write("testTypedef(309858235082523)");
            long uid = client.testTypedef(309858235082523L);
            Console.WriteLine(" = " + uid);
            if (309858235082523L != uid)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorStructs;
            }

            // TODO: Validate received message
            Console.Write("testMapMap(1)");
            Dictionary<int, Dictionary<int, int>> mm = client.testMapMap(1);
            Console.Write(" = {");
            foreach (int key in mm.Keys)
            {
                Console.Write(key + " => {");
                Dictionary<int, int> m2 = mm[key];
                foreach (int k2 in m2.Keys)
                {
                    Console.Write(k2 + " => " + m2[k2] + ", ");
                }
                Console.Write("}, ");
            }
            Console.WriteLine("}");

            // TODO: Validate received message
            Insanity insane = new Insanity();
            insane.UserMap = new Dictionary<Numberz, long>();
            insane.UserMap[Numberz.FIVE] = 5000L;
            Xtruct truck = new Xtruct();
            truck.String_thing = "Truck";
            truck.Byte_thing = (sbyte)8;
            truck.I32_thing = 8;
            truck.I64_thing = 8;
            insane.Xtructs = new List<Xtruct>();
            insane.Xtructs.Add(truck);
            Console.Write("testInsanity()");
            Dictionary<long, Dictionary<Numberz, Insanity>> whoa = client.testInsanity(insane);
            Console.Write(" = {");
            foreach (long key in whoa.Keys)
            {
                Dictionary<Numberz, Insanity> val = whoa[key];
                Console.Write(key + " => {");

                foreach (Numberz k2 in val.Keys)
                {
                    Insanity v2 = val[k2];

                    Console.Write(k2 + " => {");
                    Dictionary<Numberz, long> userMap = v2.UserMap;

                    Console.Write("{");
                    if (userMap != null)
                    {
                        foreach (Numberz k3 in userMap.Keys)
                        {
                            Console.Write(k3 + " => " + userMap[k3] + ", ");
                        }
                    }
                    else
                    {
                        Console.Write("null");
                    }
                    Console.Write("}, ");

                    List<Xtruct> xtructs = v2.Xtructs;

                    Console.Write("{");
                    if (xtructs != null)
                    {
                        foreach (Xtruct x in xtructs)
                        {
                            Console.Write("{\"" + x.String_thing + "\", " + x.Byte_thing + ", " + x.I32_thing + ", " + x.I32_thing + "}, ");
                        }
                    }
                    else
                    {
                        Console.Write("null");
                    }
                    Console.Write("}");

                    Console.Write("}, ");
                }
                Console.Write("}, ");
            }
            Console.WriteLine("}");

            sbyte arg0 = 1;
            int arg1 = 2;
            long arg2 = long.MaxValue;
            Dictionary<short, string> multiDict = new Dictionary<short, string>();
            multiDict[1] = "one";
            Numberz arg4 = Numberz.FIVE;
            long arg5 = 5000000;
            Console.Write("Test Multi(" + arg0 + "," + arg1 + "," + arg2 + "," + multiDict + "," + arg4 + "," + arg5 + ")");
            Xtruct multiResponse = client.testMulti(arg0, arg1, arg2, multiDict, arg4, arg5);
            Console.Write(" = Xtruct(byte_thing:" + multiResponse.Byte_thing + ",String_thing:" + multiResponse.String_thing
                        + ",i32_thing:" + multiResponse.I32_thing + ",i64_thing:" + multiResponse.I64_thing + ")\n");

            try
            {
                Console.WriteLine("testException(\"Xception\")");
                client.testException("Xception");
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorExceptions;
            }
            catch (Xception ex)
            {
                if (ex.ErrorCode != 1001 || ex.Message != "Xception")
                {
                    Console.WriteLine("*** FAILED ***");
                    returnCode |= ErrorExceptions;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorExceptions;
                Console.WriteLine(ex.Message + " ST: " + ex.StackTrace);
            }
            try
            {
                Console.WriteLine("testException(\"TException\")");
                client.testException("TException");
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorExceptions;
            }
            catch (Thrift.TException)
            {
                // OK
            }
            catch (Exception ex)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorExceptions;
                Console.WriteLine(ex.Message + " ST: " + ex.StackTrace);
            }
            try
            {
                Console.WriteLine("testException(\"ok\")");
                client.testException("ok");
                // OK
            }
            catch (Exception ex)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorExceptions;
                Console.WriteLine(ex.Message + " ST: " + ex.StackTrace);
            }

            try
            {
                Console.WriteLine("testMultiException(\"Xception\", ...)");
                client.testMultiException("Xception", "ignore");
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorExceptions;
            }
            catch (Xception ex)
            {
                if (ex.ErrorCode != 1001 || ex.Message != "This is an Xception")
                {
                    Console.WriteLine("*** FAILED ***");
                    returnCode |= ErrorExceptions;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorExceptions;
                Console.WriteLine(ex.Message + " ST: " + ex.StackTrace);
            }
            try
            {
                Console.WriteLine("testMultiException(\"Xception2\", ...)");
                client.testMultiException("Xception2", "ignore");
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorExceptions;
            }
            catch (Xception2 ex)
            {
                if (ex.ErrorCode != 2002 || ex.Struct_thing.String_thing != "This is an Xception2")
                {
                    Console.WriteLine("*** FAILED ***");
                    returnCode |= ErrorExceptions;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorExceptions;
                Console.WriteLine(ex.Message + " ST: " + ex.StackTrace);
            }
            try
            {
                Console.WriteLine("testMultiException(\"success\", \"OK\")");
                if ("OK" != client.testMultiException("success", "OK").String_thing)
                {
                    Console.WriteLine("*** FAILED ***");
                    returnCode |= ErrorExceptions;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorExceptions;
                Console.WriteLine(ex.Message + " ST: " + ex.StackTrace);
            }

            Stopwatch sw = new Stopwatch();
            sw.Start();
            Console.WriteLine("Test Oneway(1)");
            client.testOneway(1);
            sw.Stop();
            if (sw.ElapsedMilliseconds > 1000)
            {
                Console.WriteLine("*** FAILED ***");
                returnCode |= ErrorBaseTypes;
            }

            Console.Write("Test Calltime()");
            var times = 50;
            sw.Reset();
            sw.Start();
            for (int k = 0; k < times; ++k)
                client.testVoid();
            sw.Stop();
            Console.WriteLine(" = {0} ms a testVoid() call", sw.ElapsedMilliseconds / times);
            return returnCode;
        }
    }
}
