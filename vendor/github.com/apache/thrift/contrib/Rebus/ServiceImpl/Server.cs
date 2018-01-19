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
 * The server implements the BasicMathServer service .
 * All results are sent back to the client via the BasicMathClient service
 */


namespace RebusSample.Server
{
    // handler to be registered with Rebus
    class MathRequestCallHandler : IHandleMessages<MathRequestCall>
    {
        public void Handle(MathRequestCall message)
        {
            // Thrift protocol/transport stack
            var stm = new MemoryStream(message.rawBytes);
            var trns = new TStreamTransport(stm, null);
            var prot = new TBinaryProtocol(trns);

            // create a processor and let him handle the call
            var hndl = new MathRequestsHandler();
            var proc = new BasicMathServer.Processor(hndl);
            proc.Process(prot, null);  // oneway only
        }
    }


    // serves incoming calculation requests
    internal class MathRequestsHandler : BasicMathServer.Iface
    {
        public void Ping(long value)
        {
            var client = new MathResponseClient("localhost");
            client.Pong(value);
        }


        public void DoTheMath(int arg1, int arg2)
        {
            var client = new MathResponseClient("localhost");
            if( arg2 != 0)
                client.FourResults( arg1+arg2, arg1*arg2, arg1-arg2, arg1/arg2);
            else
                client.ThreeResults( arg1+arg2, arg1*arg2, arg1-arg2);
        }
    }


    // provides the client-side interface for calculation responses
    internal class MathResponseClient : BasicMathClient.Iface
    {
        private BuiltinContainerAdapter MQAdapter;


        public MathResponseClient(string server)
        {
            MQAdapter = new BuiltinContainerAdapter();
            Configure.With(MQAdapter)
                .Transport(t => t.UseRabbitMqInOneWayMode("amqp://" + server))  // we need send only
                .MessageOwnership(o => o.FromRebusConfigurationSection())
                .CreateBus().Start();
        }


        public void SerializeThriftCall(Action<BasicMathClient.Iface> action)
        {
            // Thrift protocol/transport stack
            var stm = new MemoryStream();
            var trns = new TStreamTransport(null, stm);
            var prot = new TBinaryProtocol(trns);

            // serialize the call into a bunch of bytes
            var client = new BasicMathClient.Client(prot);
            if (action != null)
                action(client);
            else
                throw new ArgumentException("action must not be null");

            // make sure everything is written to the MemoryStream
            trns.Flush();

            // send the message
            var msg = new MathResponseCall() { rawBytes = stm.ToArray() };
            MQAdapter.Bus.Send(msg);
        }


        public void Pong(long value)
        {
            SerializeThriftCall(client =>
            {
                client.Pong(value);
            });
        }


        public void ThreeResults(int added, int multiplied, int suctracted)
        {
            SerializeThriftCall(client =>
            {
                client.ThreeResults(added, multiplied, suctracted);
            });
        }


        public void FourResults(int added, int multiplied, int suctracted, int divided)
        {
            SerializeThriftCall(client =>
            {
                client.FourResults(added, multiplied, suctracted, divided);
            });
        }
    }
}

