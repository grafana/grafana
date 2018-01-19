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

/* only for silverlight */
#if SILVERLIGHT

using System;
using System.Net.Sockets;
using System.IO;
using System.Net;
using System.Threading;

namespace Thrift.Transport
{
    public class TSilverlightSocket : TTransport
    {
        Socket socket = null;
        static ManualResetEvent readAsyncComplete = new ManualResetEvent(false);
        public event EventHandler<SocketAsyncEventArgs> connectHandler = null;

        // memory stream for write cache.
        private MemoryStream outputStream = new MemoryStream();

        private string host = null;
        private int port = 0;
        private int timeout = 0;

        // constructor
        public TSilverlightSocket(string host, int port)
            : this(host, port, 0)
        {
        }

        // constructor
        public TSilverlightSocket(string host, int port, int timeout)
        {
            this.host = host;
            this.port = port;
            this.timeout = timeout;

            InitSocket();
        }

        private void InitSocket()
        {
            // Create a stream-based, TCP socket using the InterNetwork Address Family.
            socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
            socket.NoDelay = true;
        }

        public int Timeout
        {
            set
            {
                timeout = value;
            }
        }

        public string Host
        {
            get
            {
                return host;
            }
        }

        public int Port
        {
            get
            {
                return port;
            }
        }

        public override bool IsOpen
        {
            get
            {
                if (socket == null)
                {
                    return false;
                }

                return socket.Connected;
            }
        }

        public override void Open()
        {
            if (IsOpen)
            {
                throw new TTransportException(TTransportException.ExceptionType.AlreadyOpen, "Socket already connected");
            }

            if (String.IsNullOrEmpty(host))
            {
                throw new TTransportException(TTransportException.ExceptionType.NotOpen, "Cannot open null host");
            }

            if (port <= 0)
            {
                throw new TTransportException(TTransportException.ExceptionType.NotOpen, "Cannot open without port");
            }

            if (socket == null)
            {
                InitSocket();
            }

            if (timeout == 0)     // no timeout -> infinite
            {
                timeout = 10000;  // set a default timeout for WP.
            }

            {
                // Create DnsEndPoint. The hostName and port are passed in to this method.
                DnsEndPoint hostEntry = new DnsEndPoint(this.host, this.port);

                // Create a SocketAsyncEventArgs object to be used in the connection request
                SocketAsyncEventArgs socketEventArg = new SocketAsyncEventArgs();
                socketEventArg.RemoteEndPoint = hostEntry;

                // Inline event handler for the Completed event.
                // Note: This event handler was implemented inline in order to make this method self-contained.
                socketEventArg.Completed += new EventHandler<SocketAsyncEventArgs>(delegate(object s, SocketAsyncEventArgs e)
                {
                    if (connectHandler != null)
                    {
                        connectHandler(this, e);
                    }
                });

                // Make an asynchronous Connect request over the socket
                socket.ConnectAsync(socketEventArg);
            }
        }

        public override int Read(byte[] buf, int off, int len)
        {
            bool _timeout = true;
            string _error = null;
            int _recvBytes = -1;

            if (socket == null)
            {
                throw new TTransportException(TTransportException.ExceptionType.NotOpen, "Socket is not open");
            }

            // Create SocketAsyncEventArgs context object
            SocketAsyncEventArgs socketEventArg = new SocketAsyncEventArgs();
            socketEventArg.RemoteEndPoint = socket.RemoteEndPoint;

            // Setup the buffer to receive the data
            socketEventArg.SetBuffer(buf, off, len);

            // Inline event handler for the Completed event.
            // Note: This even handler was implemented inline in order to make
            // this method self-contained.
            socketEventArg.Completed += new EventHandler<SocketAsyncEventArgs>(delegate(object s, SocketAsyncEventArgs e)
            {
                _timeout = false;

                if (e.SocketError == SocketError.Success)
                {
                    _recvBytes = e.BytesTransferred;
                }
                else
                {
                    _error = e.SocketError.ToString();
                }

                readAsyncComplete.Set();
            });

            // Sets the state of the event to nonsignaled, causing threads to block
            readAsyncComplete.Reset();

            // Make an asynchronous Receive request over the socket
            socket.ReceiveAsync(socketEventArg);

            // Block the UI thread for a maximum of TIMEOUT_MILLISECONDS milliseconds.
            // If no response comes back within this time then proceed
            readAsyncComplete.WaitOne(this.timeout);

            if (_timeout)
            {
                throw new TTransportException(TTransportException.ExceptionType.TimedOut, "Socket recv timeout");
            }

            if (_error != null)
            {
                throw new TTransportException(TTransportException.ExceptionType.Unknown, _error);
            }

            return _recvBytes;
        }

        public override void Write(byte[] buf, int off, int len)
        {
            outputStream.Write(buf, off, len);
        }

        private void beginFlush_Completed(object sender, SocketAsyncEventArgs e)
        {
            FlushAsyncResult flushAsyncResult = e.UserToken as FlushAsyncResult;
            flushAsyncResult.UpdateStatusToComplete();
            flushAsyncResult.NotifyCallbackWhenAvailable();

            if (e.SocketError != SocketError.Success)
            {
                throw new TTransportException(TTransportException.ExceptionType.Unknown, e.SocketError.ToString());
            }
        }

        public override IAsyncResult BeginFlush(AsyncCallback callback, object state)
        {
            // Extract request and reset buffer
            byte[] data = outputStream.ToArray();

            FlushAsyncResult flushAsyncResult = new FlushAsyncResult(callback, state);

            SocketAsyncEventArgs socketEventArg = new SocketAsyncEventArgs();
            socketEventArg.RemoteEndPoint = socket.RemoteEndPoint;
            socketEventArg.UserToken = flushAsyncResult;

            socketEventArg.Completed += beginFlush_Completed;
            socketEventArg.SetBuffer(data, 0, data.Length);

            socket.SendAsync(socketEventArg);

            return flushAsyncResult;
        }

        public override void EndFlush(IAsyncResult asyncResult)
        {
            try
            {
                var flushAsyncResult = (FlushAsyncResult)asyncResult;

                if (!flushAsyncResult.IsCompleted)
                {
                    var waitHandle = flushAsyncResult.AsyncWaitHandle;
                    waitHandle.WaitOne();
                    waitHandle.Close();
                }

                if (flushAsyncResult.AsyncException != null)
                {
                    throw flushAsyncResult.AsyncException;
                }
            }
            finally
            {
                outputStream = new MemoryStream();
            }
        }

        // Copy from impl from THttpClient.cs
        // Based on http://msmvps.com/blogs/luisabreu/archive/2009/06/15/multithreading-implementing-the-iasyncresult-interface.aspx
        class FlushAsyncResult : IAsyncResult
        {
            private volatile Boolean _isCompleted;
            private ManualResetEvent _evt;
            private readonly AsyncCallback _cbMethod;
            private readonly Object _state;

            public FlushAsyncResult(AsyncCallback cbMethod, Object state)
            {
                _cbMethod = cbMethod;
                _state = state;
            }

            internal byte[] Data { get; set; }
            internal Socket Connection { get; set; }
            internal TTransportException AsyncException { get; set; }

            public object AsyncState
            {
                get { return _state; }
            }

            public WaitHandle AsyncWaitHandle
            {
                get { return GetEvtHandle(); }
            }

            public bool CompletedSynchronously
            {
                get { return false; }
            }

            public bool IsCompleted
            {
                get { return _isCompleted; }
            }

            private readonly Object _locker = new Object();

            private ManualResetEvent GetEvtHandle()
            {
                lock (_locker)
                {
                    if (_evt == null)
                    {
                        _evt = new ManualResetEvent(false);
                    }
                    if (_isCompleted)
                    {
                        _evt.Set();
                    }
                }
                return _evt;
            }

            internal void UpdateStatusToComplete()
            {
                _isCompleted = true; //1. set _iscompleted to true
                lock (_locker)
                {
                    if (_evt != null)
                    {
                        _evt.Set(); //2. set the event, when it exists
                    }
                }
            }

            internal void NotifyCallbackWhenAvailable()
            {
                if (_cbMethod != null)
                {
                    _cbMethod(this);
                }
            }
        }

        public override void Close()
        {
            if (socket != null)
            {
                socket.Close();
                socket = null;
            }
        }

        #region " IDisposable Support "
        private bool _IsDisposed;

        // IDisposable
        protected override void Dispose(bool disposing)
        {
            if (!_IsDisposed)
            {
                if (disposing)
                {
                    if (outputStream != null)
                    {
                        outputStream.Dispose();
                    }
                    outputStream = null;
                    if (socket != null)
                    {
                        ((IDisposable)socket).Dispose();
                    }
                }
            }
            _IsDisposed = true;
        }
        #endregion
    }
}


#endif
