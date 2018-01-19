/*
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

package;

import haxe.Int64;
import sys.FileSystem;

import org.apache.thrift.*;
import org.apache.thrift.protocol.*;
import org.apache.thrift.transport.*;
import org.apache.thrift.server.*;
import org.apache.thrift.meta_data.*;

import thrift.test.*;  // generated code


class StreamTest extends TestBase {


    private inline static var tmpfile : String = "data.tmp";


    private static function MakeTestData() : Xtruct {
        var data : Xtruct = new Xtruct();
        data.string_thing = "Streamtest";
        data.byte_thing = -128;
        data.i32_thing = 4711;
        data.i64_thing = Int64.make(0x12345678,0x9ABCDEF0);
        return data;
    }

    public static function WriteData() : Xtruct
    {
        var stream : TStream = new TFileStream( tmpfile, CreateNew);
        var trans : TTransport = new TStreamTransport( null, stream);
        var prot = new TJSONProtocol( trans);

        var data = MakeTestData();
        data.write(prot);
        trans.close();

        return data;
    }

    public static function ReadData() : Xtruct
    {
        var stream : TStream = new TFileStream( tmpfile, Read);
        var trans : TTransport = new TStreamTransport( stream, null);
        var prot = new TJSONProtocol( trans);

        var data : Xtruct = new Xtruct();
        data.read(prot);
        trans.close();

        return data;
    }

    public static override function Run(server : Bool) : Void
    {
        try {
            var written = WriteData();
            var read = ReadData();
            FileSystem.deleteFile(tmpfile);

            TestBase.Expect( read.string_thing == written.string_thing, "string data");
            TestBase.Expect( read.byte_thing == written.byte_thing, "byte data");
            TestBase.Expect( read.i32_thing == written.i32_thing, "i32 data");
            TestBase.Expect( Int64.compare( read.i64_thing, written.i64_thing) == 0, "i64 data");

        } catch(e:Dynamic) {
            FileSystem.deleteFile(tmpfile);
            throw e;
        }
    }

}


