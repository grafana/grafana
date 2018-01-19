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

import haxe.io.Eof;
import haxe.io.Bytes;
import haxe.io.BytesBuffer;
import haxe.io.BytesOutput;
import haxe.io.BytesInput;


/**
 * TFramedTransport is a buffered TTransport that ensures a fully read message
 * every time by preceding messages with a 4-byte frame size.
 */
class TFramedTransport extends TTransport
{
    public static inline var DEFAULT_MAX_LENGTH = 16384000;

    var maxLength_ :  Int;

    /**
     * Underlying transport
     */
    var transport_ :  TTransport = null;

    /**
     * Buffer for output
     */
    var writeBuffer_ : BytesOutput = new BytesOutput();

    /**
     * Buffer for input
     */
    var readBuffer_ : BytesInput = null;

    /**
     * Constructor wraps around another transport
     */
    public function new( transport : TTransport, maxLength : Int = DEFAULT_MAX_LENGTH) {
        transport_ = transport;
        maxLength_ = maxLength;
    }

    public override function open() : Void {
        transport_.open();
    }

    public override function isOpen() : Bool {
        return transport_.isOpen();
    }

    public override function close() : Void {
        transport_.close();
    }

    public override function read(buf : BytesBuffer, off : Int, len : Int) : Int {
        try {
            var data = Bytes.alloc(len);

            if ((readBuffer_ != null) && (readBuffer_.position < readBuffer_.length)) {
                var got : Int = readBuffer_.readBytes(data, off, len);
                if (got > 0) {
                    buf.addBytes(data,0,got);
                    return got;
                };
            };

            // Read another frame of data
            readFrame();

            var got = readBuffer_.readBytes(data, off, len);
            buf.addBytes(data,0,got);
            return got;
        }
        catch (eof : Eof) {
            throw new TTransportException(TTransportException.END_OF_FILE, 'Can\'t read $len bytes!');
        }
    }


    function readFrameSize() : Int {
        try {
            var buffer = new BytesBuffer();
            var len = transport_.readAll( buffer, 0, 4);
            var inp = new BytesInput( buffer.getBytes(), 0, 4);
            inp.bigEndian = true;
            return inp.readInt32();
        }
        catch(eof : Eof) {
            throw new TTransportException(TTransportException.END_OF_FILE, 'Can\'t read 4 bytes!');
        }
    }


    function readFrame() : Void {
        var size : Int = readFrameSize();

        if (size < 0) {
            throw new TTransportException(TTransportException.UNKNOWN, 'Read a negative frame size ($size)!');
        };
        if (size > maxLength_) {
            throw new TTransportException(TTransportException.UNKNOWN, 'Frame size ($size) larger than max length ($maxLength_)!');
        };

        try {
            var buffer = new BytesBuffer();
            size = transport_.readAll( buffer, 0, size);
            readBuffer_ = new BytesInput( buffer.getBytes(), 0, size);
            readBuffer_.bigEndian = true;
        }
        catch(eof : Eof) {
            throw new TTransportException(TTransportException.END_OF_FILE, 'Can\'t read $size bytes!');
        }
    }

    public override function write(buf : Bytes, off : Int, len : Int) : Void {
        writeBuffer_.writeBytes(buf, off, len);
    }

    function writeFrameSize(len : Int) : Void {
        var out = new BytesOutput();
        out.bigEndian = true;
        out.writeInt32(len);
        transport_.write(out.getBytes(), 0, 4);
    }

    public override function flush( callback : Dynamic->Void =null) : Void {
        var buf : Bytes = writeBuffer_.getBytes();
        var len : Int = buf.length;
        writeBuffer_ = new BytesOutput();

        writeFrameSize(len);
        transport_.write(buf, 0, len);
        transport_.flush(callback);
    }
}


