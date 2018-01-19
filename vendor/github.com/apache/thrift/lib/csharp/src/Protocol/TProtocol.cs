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
using System.Text;
using Thrift.Transport;

namespace Thrift.Protocol
{
    public abstract class TProtocol : IDisposable
    {
        private const int DEFAULT_RECURSION_DEPTH = 64;

        protected TTransport trans;
        protected int recursionLimit;
        protected int recursionDepth;

        protected TProtocol(TTransport trans)
        {
            this.trans = trans;
            this.recursionLimit = DEFAULT_RECURSION_DEPTH;
            this.recursionDepth = 0;
        }

        public TTransport Transport
        {
            get { return trans; }
        }

        public int RecursionLimit
        {
            get { return recursionLimit; }
            set { recursionLimit = value; }
        }

        public void IncrementRecursionDepth()
        {
            if (recursionDepth < recursionLimit)
                ++recursionDepth;
            else
                throw new TProtocolException(TProtocolException.DEPTH_LIMIT, "Depth limit exceeded");
        }

        public void DecrementRecursionDepth()
        {
            --recursionDepth;
        }

        #region " IDisposable Support "
        private bool _IsDisposed;

        // IDisposable
        public void Dispose()
        {
            Dispose(true);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (!_IsDisposed)
            {
                if (disposing)
                {
                    if (trans is IDisposable)
                        (trans as IDisposable).Dispose();
                }
            }
            _IsDisposed = true;
        }
        #endregion

        public abstract void WriteMessageBegin(TMessage message);
        public abstract void WriteMessageEnd();
        public abstract void WriteStructBegin(TStruct struc);
        public abstract void WriteStructEnd();
        public abstract void WriteFieldBegin(TField field);
        public abstract void WriteFieldEnd();
        public abstract void WriteFieldStop();
        public abstract void WriteMapBegin(TMap map);
        public abstract void WriteMapEnd();
        public abstract void WriteListBegin(TList list);
        public abstract void WriteListEnd();
        public abstract void WriteSetBegin(TSet set);
        public abstract void WriteSetEnd();
        public abstract void WriteBool(bool b);
        public abstract void WriteByte(sbyte b);
        public abstract void WriteI16(short i16);
        public abstract void WriteI32(int i32);
        public abstract void WriteI64(long i64);
        public abstract void WriteDouble(double d);
        public virtual void WriteString(string s) {
            WriteBinary(Encoding.UTF8.GetBytes(s));
        }
        public abstract void WriteBinary(byte[] b);

        public abstract TMessage ReadMessageBegin();
        public abstract void ReadMessageEnd();
        public abstract TStruct ReadStructBegin();
        public abstract void ReadStructEnd();
        public abstract TField ReadFieldBegin();
        public abstract void ReadFieldEnd();
        public abstract TMap ReadMapBegin();
        public abstract void ReadMapEnd();
        public abstract TList ReadListBegin();
        public abstract void ReadListEnd();
        public abstract TSet ReadSetBegin();
        public abstract void ReadSetEnd();
        public abstract bool ReadBool();
        public abstract sbyte ReadByte();
        public abstract short ReadI16();
        public abstract int ReadI32();
        public abstract long ReadI64();
        public abstract double ReadDouble();
        public virtual string ReadString() {
            var buf = ReadBinary();
            return Encoding.UTF8.GetString(buf, 0, buf.Length);
        }
        public abstract byte[] ReadBinary();
    }
}
