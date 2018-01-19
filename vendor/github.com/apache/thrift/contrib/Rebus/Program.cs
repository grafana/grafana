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

using Rebus.Configuration;
using Rebus.RabbitMQ;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using RebusSample.Client;
using RebusSample.Server;

namespace RebusSample
{
    class Program
    {
        static BuiltinContainerAdapter StartRequestServer(string server)
        {
            // client Rebus configuration
            var adapter = new BuiltinContainerAdapter();
            Configure.With(adapter)
                .Transport(t => t.UseRabbitMq("amqp://" + server, "MathRequests", "MathRequestErrors"))
                .MessageOwnership(o => o.FromRebusConfigurationSection())
                .CreateBus().Start();

            // register all relevant message handlers 
            adapter.Register(typeof(MathRequestCallHandler));
            return adapter;
        }


        static BuiltinContainerAdapter StartResponseServer(string server)
        {
            // client Rebus configuration
            var adapter = new BuiltinContainerAdapter();
            Configure.With(adapter)
                .Transport(t => t.UseRabbitMq("amqp://" + server, "MathResponses", "MathResponseErrors"))
                .MessageOwnership(o => o.FromRebusConfigurationSection())
                .CreateBus().Start();

            // register all relevant message handlers 
            adapter.Register(typeof(MathResponseCallHandler));
            return adapter;
        }

        static void Main(string[] args)
        {
            string server = "localhost";

            // start all servers
            var req = StartRequestServer(server);
            var rsp = StartResponseServer(server);

            // send the first message
            var random = new Random();
            var client = new MathRequestClient(server);
            client.DoTheMath(random.Next(), random.Next());

            // now what?
            Console.Write("Hit <ENTER> to stop ... ");
            Console.ReadLine();
        }
    }
}
