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

using System;
using System.IO;

namespace Thrift.Transport
{
    public class TBufferedTransport : TTransport, IDisposable
    {
        private readonly int bufSize;
        private readonly MemoryStream inputBuffer = new MemoryStream(0);
        private readonly MemoryStream outputBuffer = new MemoryStream(0);
        private readonly TTransport transport;

        public TBufferedTransport(TTransport transport, int bufSize = 1024)
        {
            if (transport == null)
                throw new ArgumentNullException("transport");
            if (bufSize <= 0)
                throw new ArgumentException("bufSize", "Buffer size must be a positive number.");
            this.transport = transport;
            this.bufSize = bufSize;
        }

        public TTransport UnderlyingTransport
        {
            get
            {
                CheckNotDisposed();
                return transport;
            }
        }

        public override bool IsOpen
        {
            get
            {
                // We can legitimately throw here but be nice a bit.
                // CheckNotDisposed();
                return !_IsDisposed && transport.IsOpen;
            }
        }

        public override void Open()
        {
            CheckNotDisposed();
            transport.Open();
        }

        public override void Close()
        {
            CheckNotDisposed();
            transport.Close();
        }

        public override int Read(byte[] buf, int off, int len)
        {
            CheckNotDisposed();
            ValidateBufferArgs(buf, off, len);
            if (!IsOpen)
                throw new TTransportException(TTransportException.ExceptionType.NotOpen);
            if (inputBuffer.Capacity < bufSize)
                inputBuffer.Capacity = bufSize;
            int got = inputBuffer.Read(buf, off, len);
            if (got > 0)
                return got;

            inputBuffer.Seek(0, SeekOrigin.Begin);
            inputBuffer.SetLength(inputBuffer.Capacity);
            int filled = transport.Read(inputBuffer.GetBuffer(), 0, (int)inputBuffer.Length);
            inputBuffer.SetLength(filled);
            if (filled == 0)
                return 0;
            return Read(buf, off, len);
        }

        public override void Write(byte[] buf, int off, int len)
        {
            CheckNotDisposed();
            ValidateBufferArgs(buf, off, len);
            if (!IsOpen)
                throw new TTransportException(TTransportException.ExceptionType.NotOpen);
            // Relative offset from "off" argument
            int offset = 0;
            if (outputBuffer.Length > 0)
            {
                int capa = (int)(outputBuffer.Capacity - outputBuffer.Length);
                int writeSize = capa <= len ? capa : len;
                outputBuffer.Write(buf, off, writeSize);
                offset += writeSize;
                if (writeSize == capa)
                {
                    transport.Write(outputBuffer.GetBuffer(), 0, (int)outputBuffer.Length);
                    outputBuffer.SetLength(0);
                }
            }
            while (len - offset >= bufSize)
            {
                transport.Write(buf, off + offset, bufSize);
                offset += bufSize;
            }
            int remain = len - offset;
            if (remain > 0)
            {
                if (outputBuffer.Capacity < bufSize)
                    outputBuffer.Capacity = bufSize;
                outputBuffer.Write(buf, off + offset, remain);
            }
        }

        public override void Flush()
        {
            CheckNotDisposed();
            if (!IsOpen)
                throw new TTransportException(TTransportException.ExceptionType.NotOpen);
            if (outputBuffer.Length > 0)
            {
                transport.Write(outputBuffer.GetBuffer(), 0, (int)outputBuffer.Length);
                outputBuffer.SetLength(0);
            }
            transport.Flush();
        }

        private void CheckNotDisposed()
        {
            if (_IsDisposed)
                throw new ObjectDisposedException("TBufferedTransport");
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
                    inputBuffer.Dispose();
                    outputBuffer.Dispose();
                }
            }
            _IsDisposed = true;
        }
        #endregion
    }
}
