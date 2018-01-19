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
    public class TFramedTransport : TTransport, IDisposable
    {
        private readonly TTransport transport;
        private readonly MemoryStream writeBuffer = new MemoryStream(1024);
        private readonly MemoryStream readBuffer = new MemoryStream(1024);

        private const int HeaderSize = 4;
        private readonly byte[] headerBuf = new byte[HeaderSize];

        public class Factory : TTransportFactory
        {
            public override TTransport GetTransport(TTransport trans)
            {
                return new TFramedTransport(trans);
            }
        }

        public TFramedTransport(TTransport transport)
        {
            if (transport == null)
                throw new ArgumentNullException("transport");
            this.transport = transport;
            InitWriteBuffer();
        }

        public override void Open()
        {
            CheckNotDisposed();
            transport.Open();
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
            int got = readBuffer.Read(buf, off, len);
            if (got > 0)
            {
                return got;
            }

            // Read another frame of data
            ReadFrame();

            return readBuffer.Read(buf, off, len);
        }

        private void ReadFrame()
        {
            transport.ReadAll(headerBuf, 0, HeaderSize);
            int size = DecodeFrameSize(headerBuf);

            readBuffer.SetLength(size);
            readBuffer.Seek(0, SeekOrigin.Begin);
            byte[] buff = readBuffer.GetBuffer();
            transport.ReadAll(buff, 0, size);
        }

        public override void Write(byte[] buf, int off, int len)
        {
            CheckNotDisposed();
            ValidateBufferArgs(buf, off, len);
            if (!IsOpen)
                throw new TTransportException(TTransportException.ExceptionType.NotOpen);
            if (writeBuffer.Length + (long)len > (long)int.MaxValue)
                Flush();
            writeBuffer.Write(buf, off, len);
        }

        public override void Flush()
        {
            CheckNotDisposed();
            if (!IsOpen)
                throw new TTransportException(TTransportException.ExceptionType.NotOpen);
            byte[] buf = writeBuffer.GetBuffer();
            int len = (int)writeBuffer.Length;
            int data_len = len - HeaderSize;
            if ( data_len < 0 )
                throw new System.InvalidOperationException (); // logic error actually

            // Inject message header into the reserved buffer space
            EncodeFrameSize(data_len, buf);

            // Send the entire message at once
            transport.Write(buf, 0, len);

            InitWriteBuffer();

            transport.Flush();
        }

        private void InitWriteBuffer ()
        {
            // Reserve space for message header to be put right before sending it out
            writeBuffer.SetLength(HeaderSize);
            writeBuffer.Seek(0, SeekOrigin.End);
        }

        private static void EncodeFrameSize(int frameSize, byte[] buf)
        {
            buf[0] = (byte)(0xff & (frameSize >> 24));
            buf[1] = (byte)(0xff & (frameSize >> 16));
            buf[2] = (byte)(0xff & (frameSize >> 8));
            buf[3] = (byte)(0xff & (frameSize));
        }

        private static int DecodeFrameSize(byte[] buf)
        {
            return
                ((buf[0] & 0xff) << 24) |
                ((buf[1] & 0xff) << 16) |
                ((buf[2] & 0xff) <<  8) |
                ((buf[3] & 0xff));
        }


        private void CheckNotDisposed()
        {
            if (_IsDisposed)
                throw new ObjectDisposedException("TFramedTransport");
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
                    readBuffer.Dispose();
                    writeBuffer.Dispose();
                }
            }
            _IsDisposed = true;
        }
        #endregion
    }
}
