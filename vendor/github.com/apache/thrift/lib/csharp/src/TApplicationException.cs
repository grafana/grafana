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
using Thrift.Protocol;

namespace Thrift
{
    public class TApplicationException : TException
    {
        protected ExceptionType type;

        public TApplicationException()
        {
        }

        public TApplicationException(ExceptionType type)
        {
            this.type = type;
        }

        public TApplicationException(ExceptionType type, string message)
            : base(message)
        {
            this.type = type;
        }

        public static TApplicationException Read(TProtocol iprot)
        {
            TField field;

            string message = null;
            ExceptionType type = ExceptionType.Unknown;

            iprot.ReadStructBegin();
            while (true)
            {
                field = iprot.ReadFieldBegin();
                if (field.Type == TType.Stop)
                {
                    break;
                }

                switch (field.ID)
                {
                    case 1:
                        if (field.Type == TType.String)
                        {
                            message = iprot.ReadString();
                        }
                        else
                        {
                            TProtocolUtil.Skip(iprot, field.Type);
                        }
                        break;
                    case 2:
                        if (field.Type == TType.I32)
                        {
                            type = (ExceptionType)iprot.ReadI32();
                        }
                        else
                        {
                            TProtocolUtil.Skip(iprot, field.Type);
                        }
                        break;
                    default:
                        TProtocolUtil.Skip(iprot, field.Type);
                        break;
                }

                iprot.ReadFieldEnd();
            }

            iprot.ReadStructEnd();

            return new TApplicationException(type, message);
        }

        public void Write(TProtocol oprot)
        {
            TStruct struc = new TStruct("TApplicationException");
            TField field = new TField();

            oprot.WriteStructBegin(struc);

            if (!String.IsNullOrEmpty(Message))
            {
                field.Name = "message";
                field.Type = TType.String;
                field.ID = 1;
                oprot.WriteFieldBegin(field);
                oprot.WriteString(Message);
                oprot.WriteFieldEnd();
            }

            field.Name = "type";
            field.Type = TType.I32;
            field.ID = 2;
            oprot.WriteFieldBegin(field);
            oprot.WriteI32((int)type);
            oprot.WriteFieldEnd();
            oprot.WriteFieldStop();
            oprot.WriteStructEnd();
        }

        public enum ExceptionType
        {
            Unknown,
            UnknownMethod,
            InvalidMessageType,
            WrongMethodName,
            BadSequenceID,
            MissingResult,
            InternalError,
            ProtocolError,
            InvalidTransform,
            InvalidProtocol,
            UnsupportedClientType
        }
    }
}
