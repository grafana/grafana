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
using System.IO;

namespace Thrift.Transport
{
    public abstract class TTransport : IDisposable
    {
        public abstract bool IsOpen
        {
            get;
        }

        private byte[] _peekBuffer = new byte[1];
        private bool _hasPeekByte;

        public bool Peek()
        {
            //If we already have a byte read but not consumed, do nothing.
            if (_hasPeekByte)
                return true;

            //If transport closed we can't peek.
            if (!IsOpen)
                return false;

            //Try to read one byte. If succeeds we will need to store it for the next read.
            try
            {
                int bytes = Read(_peekBuffer, 0, 1);
                if (bytes == 0)
                    return false;
            }
            catch( IOException)
            {
                return false;
            }

            _hasPeekByte = true;
            return true;
        }

        public abstract void Open();

        public abstract void Close();

        protected static void ValidateBufferArgs(byte[] buf, int off, int len)
        {
            if (buf == null)
                throw new ArgumentNullException("buf");
            if (off < 0)
                throw new ArgumentOutOfRangeException("Buffer offset is smaller than zero.");
            if (len < 0)
                throw new ArgumentOutOfRangeException("Buffer length is smaller than zero.");
            if (off + len > buf.Length)
                throw new ArgumentOutOfRangeException("Not enough data.");
        }

        public abstract int Read(byte[] buf, int off, int len);

        public int ReadAll(byte[] buf, int off, int len)
        {
            ValidateBufferArgs(buf, off, len);
            int got = 0;

            //If we previously peeked a byte, we need to use that first.
            if (_hasPeekByte)
            {
                buf[off + got++] = _peekBuffer[0];
                _hasPeekByte = false;
            }

            while (got < len)
            {
                int ret = Read(buf, off + got, len - got);
                if (ret <= 0)
                {
                    throw new TTransportException(
                        TTransportException.ExceptionType.EndOfFile,
                        "Cannot read, Remote side has closed");
                }
                got += ret;
            }
            return got;
        }

        public virtual void Write(byte[] buf)
        {
            Write (buf, 0, buf.Length);
        }

        public abstract void Write(byte[] buf, int off, int len);

        public virtual void Flush()
        {
        }

        public virtual IAsyncResult BeginFlush(AsyncCallback callback, object state)
        {
            throw new TTransportException(
                TTransportException.ExceptionType.Unknown,
                "Asynchronous operations are not supported by this transport.");
        }

        public virtual void EndFlush(IAsyncResult asyncResult)
        {
            throw new TTransportException(
                TTransportException.ExceptionType.Unknown,
                "Asynchronous operations are not supported by this transport.");
        }

        #region " IDisposable Support "
        // IDisposable
        protected abstract void Dispose(bool disposing);

        public void Dispose()
        {
            // Do not change this code.  Put cleanup code in Dispose(ByVal disposing As Boolean) above.
            Dispose(true);
            GC.SuppressFinalize(this);
        }
        #endregion
    }
}
