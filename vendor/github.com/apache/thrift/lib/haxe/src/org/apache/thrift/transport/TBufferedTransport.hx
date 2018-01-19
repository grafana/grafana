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


class TBufferedTransport extends TTransport
{
    // constants
    public static inline var DEFAULT_BUFSIZE : Int = 0x1000;    // 4096 Bytes
    public static inline var MIN_BUFSIZE : Int = 0x100;         // 256 Bytes
    public static inline var MAX_BUFSIZE : Int = 0x100000;      // 1 MB

    // Underlying transport
    public var transport(default,null) :  TTransport = null;

    // Buffer for input/output
    private var readBuffer_ : BytesInput = null;
    private var writeBuffer_ : BytesOutput = null;
    private var bufSize : Int;

    // Constructor wraps around another transport
    public function new( transport : TTransport, bufSize : Int = DEFAULT_BUFSIZE) {

        // ensure buffer size is in the range
        if ( bufSize < MIN_BUFSIZE)
            bufSize = MIN_BUFSIZE;
        else if( bufSize > MAX_BUFSIZE)
            bufSize = MAX_BUFSIZE;

        this.transport = transport;
        this.bufSize = bufSize;
        this.writeBuffer_ = new BytesOutput();
        this.writeBuffer_.bigEndian = true;
    }

    public override function open() : Void {
        transport.open();
    }

    public override function isOpen() : Bool {
        return transport.isOpen();
    }

    public override function close() : Void {
        transport.close();
    }

    public override function read(buf : BytesBuffer, off : Int, len : Int) : Int {
        try {
            var data = Bytes.alloc(len);

            while( true) {
                if ((readBuffer_ != null) && (readBuffer_.position < readBuffer_.length)) {
                    var got = readBuffer_.readBytes(data, 0, len);
                    if (got > 0) {
                        buf.addBytes(data, 0, got);
                        return got;
                    }
                }

                // there is no point in buffering whenever the
                // remaining length exceeds the buffer size
                if ( len >= bufSize) {
                    var got = transport.read( buf, off, len);
                    if (got > 0) {
                        buf.addBytes(data, 0, got);
                        return got;
                    }
                }

                // fill the buffer
                if ( readChunk() <= 0)
                    break;
            }

            throw new TTransportException(TTransportException.END_OF_FILE, 'Can\'t read $len bytes!');
        }
        catch (eof : Eof) {
            throw new TTransportException(TTransportException.END_OF_FILE, 'Can\'t read $len bytes!');
        }
    }

    function readChunk() : Int {
        var size = bufSize;
        try {
            var buffer = new BytesBuffer();
            size = transport.read( buffer, 0, size);
            readBuffer_ = new BytesInput( buffer.getBytes(), 0, size);
            readBuffer_.bigEndian = true;
            return size;
        }
        catch(eof : Eof) {
            throw new TTransportException(TTransportException.END_OF_FILE, 'Can\'t read $size bytes!');
        }
    }

    private function writeChunk(forceWrite : Bool) : Void {
        if( writeBuffer_.length > 0) {
            if ( forceWrite || (writeBuffer_.length >= bufSize)) {
                var buf = writeBuffer_.getBytes();
                writeBuffer_ = new BytesOutput();
                writeBuffer_.bigEndian = true;
                transport.write(buf, 0, buf.length);
            }
        }
    }

    public override function write(buf : Bytes, off : Int, len : Int) : Void {
        var halfSize : Int = Std.int(bufSize / 2);

        // No point in buffering if len exceeds the buffer size.
        // However, if the buffer is less than half full we should still consider
        // squashing all into one write, except when the actual write len is very large.
        var huge_write : Bool = (len >= (2 * bufSize));
        var exceeds_buf : Bool = huge_write || (len >= bufSize);
        var write_thru : Bool = exceeds_buf && (writeBuffer_.length >= halfSize);
        if ( write_thru) {
            writeChunk(true); // force send whatever we have in there
            transport.write(buf, off, len);  // write thru
        } else {
            writeBuffer_.writeBytes(buf, off, len);
            writeChunk(false);
        }
    }

    public override function flush( callback : Dynamic->Void =null) : Void {
        writeChunk(true);
        transport.flush(callback);
    }
}
