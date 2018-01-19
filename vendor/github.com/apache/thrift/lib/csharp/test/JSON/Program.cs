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
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using Thrift.Protocol;
using Thrift.Transport;

namespace JSONTest
{
    class Program
    {
        static void Main(string[] args)
        {
            TestThrift2365();  // JSON binary decodes too much data
            TestThrift2336();  // hex encoding using \uXXXX where 0xXXXX > 0xFF
            TestThrift3403(); // JSON escaped unicode surrogate pair support.
        }


        public static void TestThrift2365()
        {
            var rnd = new Random();
            for (var len = 0; len < 10; ++len)
            {
                byte[] dataWritten = new byte[len];
                rnd.NextBytes(dataWritten);

                Stream stm = new MemoryStream();
                TTransport trans = new TStreamTransport(null, stm);
                TProtocol prot = new TJSONProtocol(trans);
                prot.WriteBinary(dataWritten);

                stm.Position = 0;
                trans = new TStreamTransport(stm, null);
                prot = new TJSONProtocol(trans);
                byte[] dataRead = prot.ReadBinary();

                Debug.Assert(dataRead.Length == dataWritten.Length);
                for (var i = 0; i < dataRead.Length; ++i)
                    Debug.Assert(dataRead[i] == dataWritten[i]);
            }
        }


        public static void TestThrift2336()
        {
            const string RUSSIAN_TEXT = "\u0420\u0443\u0441\u0441\u043a\u043e\u0435 \u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435";
            const string RUSSIAN_JSON = "\"\\u0420\\u0443\\u0441\\u0441\\u043a\\u043e\\u0435 \\u041d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435\"";

            // prepare buffer with JSON data
            byte[] rawBytes = new byte[RUSSIAN_JSON.Length];
            for (var i = 0; i < RUSSIAN_JSON.Length; ++i)
                rawBytes[i] = (byte)(RUSSIAN_JSON[i] & (char)0xFF);  // only low bytes

            // parse and check
            var stm = new MemoryStream(rawBytes);
            var trans = new TStreamTransport(stm, null);
            var prot = new TJSONProtocol(trans);
            Debug.Assert(prot.ReadString() == RUSSIAN_TEXT, "reading JSON with hex-encoded chars > 8 bit");
        }

        public static void TestThrift3403()
        {
            string GCLEF_TEXT = "\ud834\udd1e";
            const string GCLEF_JSON = "\"\\ud834\\udd1e\"";

            // parse and check
            var stm = new MemoryStream(Encoding.UTF8.GetBytes(GCLEF_JSON));
            var trans = new TStreamTransport(stm, null);
            var prot = new TJSONProtocol(trans);
            Debug.Assert(prot.ReadString() == GCLEF_TEXT, "reading JSON with surrogate pair hex-encoded chars");
        }
    }
}
