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

namespace Thrift.Protocol
{
    public class TProtocolException : TException
    {
        public const int UNKNOWN = 0;
        public const int INVALID_DATA = 1;
        public const int NEGATIVE_SIZE = 2;
        public const int SIZE_LIMIT = 3;
        public const int BAD_VERSION = 4;
        public const int NOT_IMPLEMENTED = 5;
        public const int DEPTH_LIMIT = 6;

        protected int type_ = UNKNOWN;

        public TProtocolException()
            : base()
        {
        }

        public TProtocolException(int type)
            : base()
        {
            type_ = type;
        }

        public TProtocolException(int type, String message)
            : base(message)
        {
            type_ = type;
        }

        public TProtocolException(String message)
            : base(message)
        {
        }

        public int getType()
        {
            return type_;
        }
    }
}
