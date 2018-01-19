/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 *
 */

using System;
using System.Web;
using System.Net;
using System.IO;

using Thrift.Protocol;

namespace Thrift.Transport
{
    public class THttpHandler : IHttpHandler
    {
        protected TProcessor processor;

        protected TProtocolFactory inputProtocolFactory;
        protected TProtocolFactory outputProtocolFactory;

        protected const string contentType = "application/x-thrift";
        protected System.Text.Encoding encoding = System.Text.Encoding.UTF8;

        public THttpHandler(TProcessor processor)
            : this(processor, new TBinaryProtocol.Factory())
        {

        }

        public THttpHandler(TProcessor processor, TProtocolFactory protocolFactory)
            : this(processor, protocolFactory, protocolFactory)
        {

        }

        public THttpHandler(TProcessor processor, TProtocolFactory inputProtocolFactory, TProtocolFactory outputProtocolFactory)
        {
            this.processor = processor;
            this.inputProtocolFactory = inputProtocolFactory;
            this.outputProtocolFactory = outputProtocolFactory;
        }

        public void ProcessRequest(HttpListenerContext context)
        {
            context.Response.ContentType = contentType;
            context.Response.ContentEncoding = encoding;
            ProcessRequest(context.Request.InputStream, context.Response.OutputStream);
        }

        public void ProcessRequest(HttpContext context)
        {
            context.Response.ContentType = contentType;
            context.Response.ContentEncoding = encoding;
            ProcessRequest(context.Request.InputStream, context.Response.OutputStream);
        }

        public void ProcessRequest(Stream input, Stream output)
        {
            TTransport transport = new TStreamTransport(input,output);

            try
            {
                var inputProtocol = inputProtocolFactory.GetProtocol(transport);
                var outputProtocol = outputProtocolFactory.GetProtocol(transport);

                while (processor.Process(inputProtocol, outputProtocol))
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

        public bool IsReusable
        {
            get { return true; }
        }
    }
}
