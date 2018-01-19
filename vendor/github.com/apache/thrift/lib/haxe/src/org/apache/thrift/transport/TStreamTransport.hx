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

import org.apache.thrift.transport.*;
import org.apache.thrift.helper.*;

import haxe.io.Bytes;
import haxe.io.BytesBuffer;
import haxe.io.BytesOutput;
import haxe.io.BytesInput;


class TStreamTransport extends TTransport {

    public var InputStream(default,null) : TStream;
    public var OutputStream(default,null) : TStream;


    public function new( input : TStream, output : TStream) {
        this.InputStream = input;
        this.OutputStream = output;
    }

    public override function isOpen() : Bool {
        return true;
    }

    public override function peek() : Bool {
        return (InputStream != null);
    }

    public override function open() : Void {
    }

    public override function close() : Void {
        if (InputStream != null)
        {
            InputStream.Close();
            InputStream = null;
        }
        if (OutputStream != null)
        {
            OutputStream.Close();
            OutputStream = null;
        }
    }

    public override function read( buf : BytesBuffer, off : Int, len : Int) : Int {
        if (InputStream == null)
        {
            throw new TTransportException( TTransportException.NOT_OPEN,
                                             "Cannot read from null InputStream");
        }

        var data : Bytes =  Bytes.alloc(len);
        var size = InputStream.Read( data, off, len);
        buf.addBytes( data, 0, size);
        return size;
    }

    public override function write(buf:Bytes, off : Int, len : Int) : Void {
        if (OutputStream == null)
        {
            throw new TTransportException( TTransportException.NOT_OPEN,
                                           "Cannot write to null OutputStream");
        }

        OutputStream.Write(buf, off, len);
    }

    public override function flush(callback:Dynamic->Void =null) : Void {
        if (OutputStream == null)
        {
            var err = new TTransportException( TTransportException.NOT_OPEN,
                                               "Cannot flush null OutputStream");
            if(callback != null)
                callback(err);
            else
                throw err;
        }

        OutputStream.Flush();
    }

}
