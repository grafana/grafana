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

package org.apache.thrift.transport;

import haxe.io.Bytes;
import haxe.io.BytesBuffer;
import haxe.io.Input;
import haxe.io.Output;


enum TFileMode {
    CreateNew;
    Append;
    Read;
}


class TFileStream implements TStream {

    public var FileName(default,null) : String;

    private var Input  : sys.io.FileInput;
    private var Output : sys.io.FileOutput;


    public function new( fname : String, mode : TFileMode) {
        FileName = fname;
        switch ( mode)
        {
            case TFileMode.CreateNew:
                Output = sys.io.File.write( fname, true);

            case TFileMode.Append:
                Output = sys.io.File.append( fname, true);

            case TFileMode.Read:
                Input = sys.io.File.read( fname, true);

            default:
                throw new TTransportException( TTransportException.UNKNOWN,
                                               "Unsupported mode");
        }

    }

    public function Close() : Void {
        if( Input != null) {
            Input.close();
            Input = null;
        }
        if( Output != null) {
            Output.close();
            Output = null;
        }
    }

    public function Peek() : Bool {
        if( Input == null)
            throw new TTransportException( TTransportException.NOT_OPEN, "File not open for input");

        return (! Input.eof());
    }

    public function Read( buf : Bytes, offset : Int, count : Int) : Int {
        if( Input == null)
            throw new TTransportException( TTransportException.NOT_OPEN, "File not open for input");

        return Input.readBytes( buf, offset, count);
    }

    public function Write( buf : Bytes, offset : Int, count : Int) : Void {
        if( Output == null)
            throw new TTransportException( TTransportException.NOT_OPEN, "File not open for output");

        Output.writeBytes( buf, offset, count);
    }

    public function Flush() : Void {
        if( Output != null)
            Output.flush();
    }

}
 