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
using System.Collections.Generic;
using Thrift.Collections;
using Thrift.Transport;
using Thrift.Protocol;
using Thrift.Server;
using Thrift;
using Test.Multiplex;

namespace Test.Multiplex.Client
{
    public class TestClient
    {
        static void Execute(int port)
        {
            try
            {
                TTransport trans;
                trans = new TSocket("localhost", port);
                trans = new TFramedTransport(trans);
                trans.Open();

                TProtocol Protocol = new TBinaryProtocol(trans, true, true);

                TMultiplexedProtocol multiplex;

                multiplex = new TMultiplexedProtocol(Protocol, Constants.NAME_BENCHMARKSERVICE);
                BenchmarkService.Iface bench = new BenchmarkService.Client(multiplex);

                multiplex = new TMultiplexedProtocol(Protocol, Constants.NAME_AGGR);
                Aggr.Iface aggr = new Aggr.Client(multiplex);

                for (sbyte i = 1; 10 >= i; ++i)
                {
                    aggr.addValue(bench.fibonacci(i));
                }

                foreach (int k in aggr.getValues())
                {
                    Console.Write(k.ToString() + " ");
                    Console.WriteLine("");
                }
                trans.Close();
            }
            catch (Exception e)
            {
                Console.WriteLine(e.Message);
            }
        }

        static void Main(string[] args)
        {
            int port = 9090;
            if (args.Length > 0)
            {
                port = ushort.Parse(args[0]);
            }
            Execute(port);
            Console.WriteLine("done.");
        }
    }
}

