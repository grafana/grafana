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

import haxe.remoting.SocketProtocol;
import haxe.io.Bytes;
import haxe.io.BytesBuffer;
import haxe.io.BytesInput;
import haxe.io.BytesOutput;
import haxe.io.Input;
import haxe.io.Output;
import haxe.io.Eof;

//import flash.net.ServerSocket; - not yet available on Haxe 3.1.3
#if ! (flash || html5)

import sys.net.Host;


class TServerSocket extends TServerTransport {

    // Underlying server with socket
    private var _socket : Socket= null;

    // Timeout for client sockets from accept
    private var _clientTimeout : Float = 5;

    // Whether or not to wrap new TSocket connections in buffers
    private var _useBufferedSockets : Bool = false;


    public function new(?address : String = 'localhost',  port : Int, clientTimeout : Float = 5, useBufferedSockets : Bool = false)
    {
        _clientTimeout = clientTimeout;
        _useBufferedSockets = useBufferedSockets;

        try
        {
            _socket = new Socket();
            _socket.bind( new Host(address), port);
        }
        catch (e : Dynamic)
        {
            _socket = null;
            throw new TTransportException( TTransportException.UNKNOWN, 'Could not create ServerSocket on port $port: $e');
        }
    }


    public override function Listen() : Void
    {
        // Make sure not to block on accept
        if (_socket != null)    {
            try
            {
                #if !php
                _socket.listen(1);
                #end
            }
            catch (e : Dynamic)
            {
                trace('Error $e');
                throw new TTransportException( TTransportException.UNKNOWN, 'Could not accept on listening socket: $e');
            }
        }
    }

    private override function AcceptImpl() : TTransport
    {
        if (_socket == null) {
            throw new TTransportException( TTransportException.NOT_OPEN, "No underlying server socket.");
        }

        try
        {
            var accepted = _socket.accept();
            var result = TSocket.fromSocket(accepted);
            result.setTimeout( _clientTimeout);

            if( _useBufferedSockets)
            {
                throw "buffered transport not yet supported";  // TODO
                //result = new TBufferedTransport(result);
            }

            return result;
        }
        catch (e : Dynamic)
        {
            trace('Error $e');
            throw new TTransportException( TTransportException.UNKNOWN, '$e');
        }
    }

    public override function Close() : Void
    {
        if (_socket != null)
        {
            try
            {
                _socket.close();
            }
            catch (e : Dynamic)
            {
                trace('Error $e');
                throw new TTransportException( TTransportException.UNKNOWN, 'WARNING: Could not close server socket: $e');
            }
            _socket = null;
        }
    }
}

#end
