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

#if flash
import flash.net.Socket;
#elseif js
import js.html.WebSocket;
#else
import haxe.remoting.SocketProtocol;
#end

import haxe.io.Bytes;
import haxe.io.BytesBuffer;
import haxe.io.BytesInput;
import haxe.io.BytesOutput;
import haxe.io.Input;
import haxe.io.Output;
import haxe.io.Eof;


#if ! (flash || js)
import sys.net.Host;
#end


  /**
   * Socket implementation of the TTransport interface. Used for working with a
   * Thrift Socket Server based implementations.
   */

class TSocket extends TTransport  {

    #if (flash || js)
    private var host  :  String;
    #else
    private var host  :  Host;
    #end

    private var port  :  Int;

    #if js
    private var socket : WebSocket = null;
    #else
    private var socket : Socket = null;
    #end

    #if js
    private var input : Dynamic = null;
    private var output : WebSocket = null;
    #elseif flash
    private var input : Socket = null;
    private var output : Socket = null;
    #else
    private var input : Input = null;
    private var output : Output = null;
    #end

    private var timeout : Float = 30;

    private var obuffer : BytesOutput = new BytesOutput();
    private var ioCallback : TException->Void = null;
    private var readCount : Int = 0;

    public function new(host : String, port  :  Int)  :  Void  {
        #if (flash || js)
        this.host = host;
        #else
        this.host = new Host(host);
        #end

        this.port = port;
    }

    #if ! (flash || js)
    // used by TSocketServer
    public static function fromSocket( socket : Socket) : TSocket  {
        var socketHost = socket.host();
        var result = new TSocket(socketHost.host.toString(), socketHost.port);
        result.assignSocket(socket);
        return result;
    }
    #end

    public override function close()  :  Void  {
        input = null;
        output = null;
        socket.close();
    }

    public override function peek()  :  Bool  {
        if( (input == null) || (socket == null)) {
            return false;
        } else {
            #if flash
            return (input.bytesAvailable > 0);
            #elseif js
            return true;
            #else
            var ready = Socket.select( [socket], null, null, 0);
            return (ready.read.length > 0);
            #end
        }
    }

    // Reads up to len bytes into buffer buf, starting att offset off.
    // May return less bytes than len required
    public override function read( buf : BytesBuffer, off : Int, len : Int) : Int   {
        try
        {
            #if flash

            var remaining = len;
            while( remaining > 0) {
                buf.addByte( input.readByte());
                --remaining;
            }
            return len;

            #elseif js

            if( input == null) {
                throw new TTransportException(TTransportException.UNKNOWN, "Still no data ");  // don't block
            }
            var nr = len;
            while( nr < len) {
                buf.addByte( input.get(off+nr));
                ++nr;
            }
            return len;

            #else

            //socket.waitForRead();  -  no, this ignores timeout and blocks infinitely
            if(readCount < off) {
                input.read(off-readCount);
                readCount = off;
            }

            var data = Bytes.alloc(len);
            var got = input.readBytes(data, 0, len);
            buf.addBytes( data, 0, got);
            readCount += got;
            return got;

            #end
        }
        catch (e : Eof)
        {
            trace('Eof $e');
            throw new TTransportException(TTransportException.END_OF_FILE, "No more data available.");
        }
        catch (e : TException)
        {
            trace('TException $e');
            throw e;
        }
        catch (e : Dynamic)
        {
            trace('Error $e');
            throw new TTransportException(TTransportException.UNKNOWN, 'Bad IO error : $e');
        }
    }


    public override function write(buf : Bytes, off  :  Int, len  :  Int)  :  Void
    {
        obuffer.writeBytes(buf, off, len);
    }



    public override function flush(callback : Dynamic->Void = null)  :  Void
    {
        if( ! isOpen())
        {
            throw new TTransportException(TTransportException.NOT_OPEN, "Transport not open");
        }

        #if flash

        var bytes = new flash.utils.ByteArray();
        var data = obuffer.getBytes();
        var len = 0;
        while( len < data.length) {
            bytes.writeByte(data.get(len));
            ++len;
        }

        #elseif js

        var data = obuffer.getBytes();
        var outbuf = new js.html.Int8Array(data.length);
        var len = 0;
        while( len < data.length) {
            outbuf.set( [data.get(len)], len);
            ++len;
        }
        var bytes = outbuf.buffer;

        #else

        var bytes = obuffer.getBytes();
        var len = bytes.length;

        #end

        obuffer = new BytesOutput();


        ioCallback = callback;
        try {
            readCount = 0;

            #if js
            output.send( bytes);
            #else
            output.writeBytes( bytes, 0, bytes.length);
            #end

            if(ioCallback != null) {
                ioCallback(null);  // success call
            }
        }
        catch (e : TException)
        {
            trace('TException $e, message : ${e.errorMsg}');
            if(ioCallback != null) {
                ioCallback(e);
            }
        }
        catch (e : Dynamic) {
            trace(e);
            if(ioCallback != null) {
                ioCallback(new TTransportException(TTransportException.UNKNOWN, 'Bad IO error : $e'));
            }
        }
    }

    public override function isOpen()  :  Bool
    {
        return (socket != null);
    }

    public override function open()  :  Void
    {
        #if js
        var socket = new WebSocket();
        socket.onmessage = function( event : js.html.MessageEvent) {
            this.input = event.data;
        }

        #elseif flash
        var socket = new Socket();
        socket.connect(host, port);

        #elseif php
        var socket = new Socket();
        socket.connect(host, port);
        socket.setBlocking(true);
        socket.setTimeout(timeout);

        #else
        var socket = new Socket();
        socket.setBlocking(true);
        socket.setFastSend(true);
        socket.setTimeout(timeout);
        socket.connect(host, port);

        #end

        assignSocket( socket);
    }

    #if js
    private function assignSocket( socket : WebSocket)  :  Void
    #else
    private function assignSocket( socket : Socket)  :  Void
    #end
    {
        this.socket = socket;

        #if (flash || js)
        output = socket;
        input = socket;

        #else
        output = socket.output;
        input = socket.input;

        #end
    }

    public function setTimeout( timeout : Float ) : Void {
        if(isOpen()) {
            socket.setTimeout(timeout);
        }
        this.timeout = timeout;
    }

}
