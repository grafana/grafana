/**
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

using Rebus;
using Rebus.Configuration;
using Rebus.Messages;
using Rebus.RabbitMQ;
using System;
using System.Collections.Generic;
using System.IO;
using Thrift.Protocol;
using Thrift.Transport;

/*
 * The client emits calls to BasicMathServers
 * 
 * The client implements the BasicMathClient service. 
 * If the server has processed our request, we get the results back through this service
 */

namespace RebusSample.Client
{

    // handler to be registered with Rebus
    class MathResponseCallHandler : IHandleMessages<MathResponseCall>
    {
        public void Handle(MathResponseCall message)
        {
            // Thrift protocol/transport stack
            var stm = new MemoryStream(message.rawBytes);
            var trns = new TStreamTransport(stm, null);
            var prot = new TBinaryProtocol(trns);

            // create a processor and let him handle the call
            var hndl = new MathResponsesHandler();
            var proc = new BasicMathClient.Processor(hndl);
            proc.Process(prot, null);  // oneway only
        }      
    }


    // serves incoming responses with calculation results
    internal class MathResponsesHandler : BasicMathClient.Iface
    {
        public void FourResults(int added, int multiplied, int subtracted, int divided)
        {
            Console.WriteLine("added = {0}", added);
            Console.WriteLine("multiplied= {0}", multiplied);
            Console.WriteLine("subtracted = {0}", subtracted);
            Console.WriteLine("divided = {0}", divided);

            PingAndDoAnotherCalculation();
        }


        public void ThreeResults(int added, int multiplied, int subtracted)
        {
            Console.WriteLine("added = {0}", added);
            Console.WriteLine("multiplied= {0}", multiplied);
            Console.WriteLine("subtracted = {0}", subtracted);
            Console.WriteLine("DIV/0 error during division");

            PingAndDoAnotherCalculation();
        }


        public void Pong(long value)
        {
            var latency = DateTime.Now.Ticks - value;
            Console.WriteLine("Ping took {0} ms", new DateTime(latency).Millisecond);
        }


        private void PingAndDoAnotherCalculation()
        {
            var random = new Random();
            var client = new MathRequestClient("localhost");
            client.Ping(DateTime.Now.Ticks);
            client.DoTheMath(random.Next(), random.Next());
        }
    }


    // provides the client-side interface for calculation requests
    internal class MathRequestClient : BasicMathServer.Iface
    {
        private BuiltinContainerAdapter MQAdapter;


        public MathRequestClient(string server)
        {
            MQAdapter = new BuiltinContainerAdapter();
            Configure.With(MQAdapter)
                .Transport(t => t.UseRabbitMqInOneWayMode("amqp://" + server))  // we need send only
                .MessageOwnership(o => o.FromRebusConfigurationSection())
                .CreateBus().Start();
        }


        public void SerializeThriftCall(Action<BasicMathServer.Iface> action)
        {
            // Thrift protocol/transport stack
            var stm = new MemoryStream();
            var trns = new TStreamTransport(null, stm);
            var prot = new TBinaryProtocol(trns);
            
            // serialize the call into a bunch of bytes
            var client = new BasicMathServer.Client(prot);
            if( action != null)
                action(client);
            else
                throw new ArgumentException("action must not be null");

            // make sure everything is written to the MemoryStream
            trns.Flush();

            // send the message
            var msg = new MathRequestCall() { rawBytes = stm.ToArray() };
            MQAdapter.Bus.Send(msg);
        }


        public void Ping(long value)
        {
            SerializeThriftCall(client =>
            {
                client.Ping(value);
            });
        }


        public void DoTheMath( int arg1, int arg2)
        {
            SerializeThriftCall(client =>
            {
                client.DoTheMath(arg1, arg2);
            });
        }
    }
}

