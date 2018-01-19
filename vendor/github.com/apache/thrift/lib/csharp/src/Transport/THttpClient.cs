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
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Threading;
using System.Linq;
using System.Security.Cryptography.X509Certificates;

namespace Thrift.Transport
{

    public class THttpClient : TTransport, IDisposable
    {
        private readonly Uri uri;
        private readonly X509Certificate[] certificates;
        private Stream inputStream;
        private MemoryStream outputStream = new MemoryStream();

        // Timeouts in milliseconds
        private int connectTimeout = 30000;

        private int readTimeout = 30000;

        private IDictionary<String, String> customHeaders = new Dictionary<string, string>();

#if !SILVERLIGHT
        private IWebProxy proxy = WebRequest.DefaultWebProxy;
#endif

        public THttpClient(Uri u)
            : this(u, Enumerable.Empty<X509Certificate>())
        {
        }

        public THttpClient(Uri u, IEnumerable<X509Certificate> certificates)
        {
            uri = u;
            this.certificates = (certificates ?? Enumerable.Empty<X509Certificate>()).ToArray();
        }

        public int ConnectTimeout
        {
            set
            {
               connectTimeout = value;
            }
        }

        public int ReadTimeout
        {
            set
            {
                readTimeout = value;
            }
        }

        public IDictionary<String, String> CustomHeaders
        {
            get
            {
                return customHeaders;
            }
        }

#if !SILVERLIGHT
        public IWebProxy Proxy
        {
            set
            {
                proxy = value;
            }
        }
#endif

        public override bool IsOpen
        {
            get
            {
                return true;
            }
        }

        public override void Open()
        {
        }

        public override void Close()
        {
            if (inputStream != null)
            {
                inputStream.Close();
                inputStream = null;
            }
            if (outputStream != null)
            {
                outputStream.Close();
                outputStream = null;
            }
        }

        public override int Read(byte[] buf, int off, int len)
        {
            if (inputStream == null)
            {
                throw new TTransportException(TTransportException.ExceptionType.NotOpen, "No request has been sent");
            }

            try
            {
                int ret = inputStream.Read(buf, off, len);

                if (ret == -1)
                {
                    throw new TTransportException(TTransportException.ExceptionType.EndOfFile, "No more data available");
                }

                return ret;
            }
            catch (IOException iox)
            {
                throw new TTransportException(TTransportException.ExceptionType.Unknown, iox.ToString());
            }
        }

        public override void Write(byte[] buf, int off, int len)
        {
            outputStream.Write(buf, off, len);
        }

#if !SILVERLIGHT
        public override void Flush()
        {
            try
            {
                SendRequest();
            }
            finally
            {
                outputStream = new MemoryStream();
            }
        }

        private void SendRequest()
        {
            try
            {
                HttpWebRequest connection = CreateRequest();

                byte[] data = outputStream.ToArray();
                connection.ContentLength = data.Length;

                using (Stream requestStream = connection.GetRequestStream())
                {
                    requestStream.Write(data, 0, data.Length);

                    // Resolve HTTP hang that can happens after successive calls by making sure
                    // that we release the response and response stream. To support this, we copy
                    // the response to a memory stream.
                    using (var response = connection.GetResponse())
                    {
                        using (var responseStream = response.GetResponseStream())
                        {
                            // Copy the response to a memory stream so that we can
                            // cleanly close the response and response stream.
                            inputStream = new MemoryStream();
                            byte[] buffer = new byte[8096];
                            int bytesRead;
                            while ((bytesRead = responseStream.Read(buffer, 0, buffer.Length)) > 0)
                            {
                                inputStream.Write (buffer, 0, bytesRead);
                            }
                            inputStream.Seek(0, 0);
                        }
                    }
                }
            }
            catch (IOException iox)
            {
                throw new TTransportException(TTransportException.ExceptionType.Unknown, iox.ToString());
            }
            catch (WebException wx)
            {
                throw new TTransportException(TTransportException.ExceptionType.Unknown, "Couldn't connect to server: " + wx);
            }
        }
#endif
        private HttpWebRequest CreateRequest()
        {
            HttpWebRequest connection = (HttpWebRequest)WebRequest.Create(uri);


#if !SILVERLIGHT
            // Adding certificates through code is not supported with WP7 Silverlight
            // see "Windows Phone 7 and Certificates_FINAL_121610.pdf"
            connection.ClientCertificates.AddRange(certificates);

            if (connectTimeout > 0)
            {
                connection.Timeout = connectTimeout;
            }
            if (readTimeout > 0)
            {
                connection.ReadWriteTimeout = readTimeout;
            }
#endif
            // Make the request
            connection.ContentType = "application/x-thrift";
            connection.Accept = "application/x-thrift";
            connection.UserAgent = "C#/THttpClient";
            connection.Method = "POST";
#if !SILVERLIGHT
            connection.ProtocolVersion = HttpVersion.Version10;
#endif

            //add custom headers here
            foreach (KeyValuePair<string, string> item in customHeaders)
            {
#if !SILVERLIGHT
                connection.Headers.Add(item.Key, item.Value);
#else
                connection.Headers[item.Key] = item.Value;
#endif
            }

#if !SILVERLIGHT
            connection.Proxy = proxy;
#endif

            return connection;
        }

        public override IAsyncResult BeginFlush(AsyncCallback callback, object state)
        {
            // Extract request and reset buffer
            var data = outputStream.ToArray();

            //requestBuffer_ = new MemoryStream();

            try
            {
                // Create connection object
                var flushAsyncResult = new FlushAsyncResult(callback, state);
                flushAsyncResult.Connection = CreateRequest();

                flushAsyncResult.Data = data;


                flushAsyncResult.Connection.BeginGetRequestStream(GetRequestStreamCallback, flushAsyncResult);
                return flushAsyncResult;

            }
            catch (IOException iox)
            {
                throw new TTransportException(iox.ToString());
            }
        }

        public override void EndFlush(IAsyncResult asyncResult)
        {
            try
            {
                var flushAsyncResult = (FlushAsyncResult) asyncResult;

                if (!flushAsyncResult.IsCompleted)
                {
                    var waitHandle = flushAsyncResult.AsyncWaitHandle;
                    waitHandle.WaitOne();  // blocking INFINITEly
                    waitHandle.Close();
                }

                if (flushAsyncResult.AsyncException != null)
                {
                    throw flushAsyncResult.AsyncException;
                }
            } finally
            {
                outputStream = new MemoryStream();
            }

        }

        private void GetRequestStreamCallback(IAsyncResult asynchronousResult)
        {
            var flushAsyncResult = (FlushAsyncResult)asynchronousResult.AsyncState;
            try
            {
                var reqStream = flushAsyncResult.Connection.EndGetRequestStream(asynchronousResult);
                reqStream.Write(flushAsyncResult.Data, 0, flushAsyncResult.Data.Length);
                reqStream.Flush();
                reqStream.Close();

                // Start the asynchronous operation to get the response
                flushAsyncResult.Connection.BeginGetResponse(GetResponseCallback, flushAsyncResult);
            }
            catch (Exception exception)
            {
                flushAsyncResult.AsyncException = new TTransportException(exception.ToString());
                flushAsyncResult.UpdateStatusToComplete();
                flushAsyncResult.NotifyCallbackWhenAvailable();
            }
        }

        private void GetResponseCallback(IAsyncResult asynchronousResult)
        {
            var flushAsyncResult = (FlushAsyncResult)asynchronousResult.AsyncState;
            try
            {
                inputStream = flushAsyncResult.Connection.EndGetResponse(asynchronousResult).GetResponseStream();
            }
            catch (Exception exception)
            {
                flushAsyncResult.AsyncException = new TTransportException(exception.ToString());
            }
            flushAsyncResult.UpdateStatusToComplete();
            flushAsyncResult.NotifyCallbackWhenAvailable();
        }

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
            internal HttpWebRequest Connection { get; set; }
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

#region " IDisposable Support "
        private bool _IsDisposed;

        // IDisposable
        protected override void Dispose(bool disposing)
        {
            if (!_IsDisposed)
            {
                if (disposing)
                {
                    if (inputStream != null)
                        inputStream.Dispose();
                    if (outputStream != null)
                        outputStream.Dispose();
                }
            }
            _IsDisposed = true;
        }
#endregion
    }
}
