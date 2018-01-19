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

namespace Test.Multiplex.Server
{
    public class TestServer
    {
        class BenchmarkServiceImpl : BenchmarkService.Iface
        {
            public int fibonacci(sbyte n)
            {
                int prev, next, result;
                prev   = 0;
                result = 1;
                while (n > 0)
                {
                    next   = result + prev;
                    prev   = result;
                    result = next;
                    --n;
                }
                return result;
            }
        }

        class AggrServiceImpl : Aggr.Iface
        {
            List<int> values = new List<int>();

            public void addValue(int value)
            {
                values.Add(value);
            }

            public List<int> getValues()
            {
                return values;
            }
        }

        static void Execute(int port)
        {
            try
            {
                // create protocol factory, default to BinaryProtocol
                TProtocolFactory ProtocolFactory = new TBinaryProtocol.Factory(true,true);
                TServerTransport servertrans = new TServerSocket(port, 0, false);
                TTransportFactory TransportFactory = new TFramedTransport.Factory();

                BenchmarkService.Iface benchHandler = new BenchmarkServiceImpl();
                TProcessor benchProcessor = new BenchmarkService.Processor(benchHandler);

                Aggr.Iface aggrHandler = new AggrServiceImpl();
                TProcessor aggrProcessor = new Aggr.Processor(aggrHandler);

                TMultiplexedProcessor multiplex = new TMultiplexedProcessor();
                multiplex.RegisterProcessor(Constants.NAME_BENCHMARKSERVICE, benchProcessor);
                multiplex.RegisterProcessor(Constants.NAME_AGGR, aggrProcessor);

                TServer ServerEngine = new TSimpleServer(multiplex, servertrans, TransportFactory, ProtocolFactory);

                Console.WriteLine("Starting the server ...");
                ServerEngine.Serve();
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
        }
    }
}

