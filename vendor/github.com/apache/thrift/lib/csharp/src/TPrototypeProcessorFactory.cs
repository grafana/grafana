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
using System.Linq;
using System.Text;
using Thrift.Server;
using Thrift.Transport;

namespace Thrift
{
    public class TPrototypeProcessorFactory<P, H> : TProcessorFactory where P : TProcessor
    {
        object[] handlerArgs = null;

        public TPrototypeProcessorFactory()
        {
            handlerArgs = new object[0];
        }

        public TPrototypeProcessorFactory(params object[] handlerArgs)
        {
            this.handlerArgs = handlerArgs;
        }

        public TProcessor GetProcessor(TTransport trans, TServer server = null)
        {
            H handler = (H) Activator.CreateInstance(typeof(H), handlerArgs);

            TControllingHandler handlerServerRef = handler as TControllingHandler;
            if (handlerServerRef != null)
            {
                handlerServerRef.server = server;
            }
            return Activator.CreateInstance(typeof(P), new object[] { handler }) as TProcessor;
        }
    }
}
