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

using System;
using System.Collections.Generic;
using System.IO.Pipes;
using System.Threading;

namespace Thrift.Transport
{
    public class TNamedPipeServerTransport : TServerTransport
    {
        /// <summary>
        /// This is the address of the Pipe on the localhost.
        /// </summary>
        private readonly string pipeAddress;
        private NamedPipeServerStream stream = null;
        private bool asyncMode = true;

        public TNamedPipeServerTransport(string pipeAddress)
        {
            this.pipeAddress = pipeAddress;
        }

        public override void Listen()
        {
            // nothing to do here
        }

        public override void Close()
        {
            if (stream != null)
            {
                try
                {
                    stream.Close();
                    stream.Dispose();
                }
                finally
                {
                    stream = null;
                }
            }
        }

        private void EnsurePipeInstance()
        {
            if (stream == null)
            {
                var direction = PipeDirection.InOut;
                var maxconn = 254;
                var mode = PipeTransmissionMode.Byte;
                var options = asyncMode ? PipeOptions.Asynchronous : PipeOptions.None;
                var inbuf = 4096;
                var outbuf = 4096;
                // TODO: security

                try
                {
                    stream = new NamedPipeServerStream(pipeAddress, direction, maxconn, mode, options, inbuf, outbuf);
                }
                catch (NotImplementedException)  // Mono still does not support async, fallback to sync
                {
                    if (asyncMode)
                    {
                        options &= (~PipeOptions.Asynchronous);
                        stream = new NamedPipeServerStream(pipeAddress, direction, maxconn, mode, options, inbuf, outbuf);
                        asyncMode = false;
                    }
                    else
                    {
                        throw;
                    }
                }

            }
        }

        protected override TTransport AcceptImpl()
        {
            try
            {
                EnsurePipeInstance();

                if (asyncMode)
                {
                    var evt = new ManualResetEvent(false);
                    Exception eOuter = null;

                    stream.BeginWaitForConnection(asyncResult =>
                    {
                        try
                        {
                            if (stream != null)
                                stream.EndWaitForConnection(asyncResult);
                            else
                                eOuter = new TTransportException(TTransportException.ExceptionType.Interrupted);
                        }
                        catch (Exception e)
                        {
                            if (stream != null)
                                eOuter = e;
                            else
                                eOuter = new TTransportException(TTransportException.ExceptionType.Interrupted, e.Message);
                        }
                        evt.Set();
                    }, null);

                    evt.WaitOne();

                    if (eOuter != null)
                        throw eOuter; // rethrow exception
                }
                else
                {
                    stream.WaitForConnection();
                }

                var trans = new ServerTransport(stream,asyncMode);
                stream = null;  // pass ownership to ServerTransport
                return trans;
            }
            catch (TTransportException)
            {
                Close();
                throw;
            }
            catch (Exception e)
            {
                Close();
                throw new TTransportException(TTransportException.ExceptionType.NotOpen, e.Message);
            }
        }

        private class ServerTransport : TTransport
        {
            private NamedPipeServerStream stream;
            private bool asyncMode;

            public ServerTransport(NamedPipeServerStream stream, bool asyncMode)
            {
                this.stream = stream;
                this.asyncMode = asyncMode;
            }

            public override bool IsOpen
            {
                get { return stream != null && stream.IsConnected; }
            }

            public override void Open()
            {
            }

            public override void Close()
            {
                if (stream != null)
                    stream.Close();
            }

            public override int Read(byte[] buf, int off, int len)
            {
                if (stream == null)
                {
                    throw new TTransportException(TTransportException.ExceptionType.NotOpen);
                }

                if (asyncMode)
                {
                    Exception eOuter = null;
                    var evt = new ManualResetEvent(false);
                    int retval = 0;

                    stream.BeginRead(buf, off, len, asyncResult =>
                    {
                        try
                        {
                            if (stream != null)
                                retval = stream.EndRead(asyncResult);
                            else
                                eOuter = new TTransportException(TTransportException.ExceptionType.Interrupted);
                        }
                        catch (Exception e)
                        {
                            if (stream != null)
                                eOuter = e;
                            else
                                eOuter = new TTransportException(TTransportException.ExceptionType.Interrupted, e.Message);
                        }
                        evt.Set();
                    }, null);

                    evt.WaitOne();

                    if (eOuter != null)
                        throw eOuter; // rethrow exception
                    else
                        return retval;
                }
                else
                {
                    return stream.Read(buf, off, len);
                }
            }

            public override void Write(byte[] buf, int off, int len)
            {
                if (stream == null)
                {
                    throw new TTransportException(TTransportException.ExceptionType.NotOpen);
                }

                if (asyncMode)
                {
                    Exception eOuter = null;
                    var evt = new ManualResetEvent(false);

                    stream.BeginWrite(buf, off, len, asyncResult =>
                    {
                        try
                        {
                            if (stream != null)
                                stream.EndWrite(asyncResult);
                            else
                                eOuter = new TTransportException(TTransportException.ExceptionType.Interrupted);
                        }
                        catch (Exception e)
                        {
                            if (stream != null)
                                eOuter = e;
                            else
                                eOuter = new TTransportException(TTransportException.ExceptionType.Interrupted, e.Message);
                        }
                        evt.Set();
                    }, null);

                    evt.WaitOne();

                    if (eOuter != null)
                        throw eOuter; // rethrow exception
                }
                else
                {
                    stream.Write(buf, off, len);
                }

            }

            protected override void Dispose(bool disposing)
            {
                if (stream != null)
                    stream.Dispose();
            }
        }
    }
}