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
 *
 * Contains some contributions under the Thrift Software License.
 * Please see doc/old-thrift-license.txt in the Thrift distribution for
 * details.
 */

using System.Threading.Tasks;
using System.Web;
using Thrift.Protocol;

namespace Thrift.Transport
{
    /// <summary>
    /// An async task based HTTP handler for processing thrift services.
    /// </summary>
    public class THttpTaskAsyncHandler : HttpTaskAsyncHandler
    {
        private readonly TAsyncProcessor _processor;
        private readonly TProtocolFactory _inputProtocolFactory;
        private readonly TProtocolFactory _outputProtocolFactory;

        /// <summary>
        /// Initializes a new instance of the <see cref="THttpTaskAsyncHandler"/> class
        /// using the <see cref="TBinaryProtocol.Factory"/> for both input and output streams.
        /// </summary>
        /// <param name="processor">The async processor implementation.</param>
        public THttpTaskAsyncHandler(TAsyncProcessor processor)
            : this(processor, new TBinaryProtocol.Factory())
        {
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="THttpTaskAsyncHandler"/> class
        /// using <paramref name="protocolFactory"/> for both input and output streams.
        /// </summary>
        /// <param name="processor">The async processor implementation.</param>
        /// <param name="protocolFactory">The protocol factory.</param>
        public THttpTaskAsyncHandler(TAsyncProcessor processor, TProtocolFactory protocolFactory)
            : this(processor, protocolFactory, protocolFactory)
        {
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="THttpTaskAsyncHandler"/> class.
        /// </summary>
        /// <param name="processor">The async processor implementation.</param>
        /// <param name="inputProtocolFactory">The input protocol factory.</param>
        /// <param name="outputProtocolFactory">The output protocol factory.</param>
        public THttpTaskAsyncHandler(TAsyncProcessor processor, TProtocolFactory inputProtocolFactory,
            TProtocolFactory outputProtocolFactory)
        {
            _processor = processor;
            _inputProtocolFactory = inputProtocolFactory;
            _outputProtocolFactory = outputProtocolFactory;
        }

        public override async Task ProcessRequestAsync(HttpContext context)
        {
            var transport = new TStreamTransport(context.Request.InputStream, context.Response.OutputStream);

            try
            {
                var input = _inputProtocolFactory.GetProtocol(transport);
                var output = _outputProtocolFactory.GetProtocol(transport);

                while (await _processor.ProcessAsync(input, output))
                {
                }
            }
            catch (TTransportException)
            {
                // Client died, just move on
            }
            finally
            {
                transport.Close();
            }
        }
    }
}
