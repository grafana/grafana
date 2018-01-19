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

import flash.errors.EOFError;
import flash.events.Event;
import flash.events.IOErrorEvent;
import flash.events.ProgressEvent;
import flash.events.SecurityErrorEvent;
import flash.net.URLLoader;
import flash.net.URLLoaderDataFormat;
import flash.net.URLRequest;
import flash.net.URLRequestMethod;
import flash.utils.IDataInput;
import flash.utils.IDataOutput;
import haxe.io.Bytes;
import flash.net.Socket;
import flash.events.EventDispatcher;


    /**
     * HTTP implementation of the TTransport interface. Used for working with a
     * Thrift web services implementation.
     * Unlike Http Client, it uses a single POST, and chunk-encoding to transfer all messages.
     */

    public class TFullDuplexHttpClient extends TTransport
    {
        private var socket : Socket = null;
        private var host  :  String;
        private var port  :  Int;
        private var resource  :  String;
        private var stripped  :  Bool = false;
        private var obuffer : Bytes = new Bytes();
        private var input : IDataInput;
        private var output : IDataOutput;
        private var bytesInChunk  :  Int = 0;
        private var CRLF : Bytes = new Bytes();
        private var ioCallback : TException->Void = null;
        private var eventDispatcher : EventDispatcher = new EventDispatcher();

        public function new(host  :  String, port  :  Int, resource  :  String)  :  Void
        {
            CRLF.writeByte(13);
            CRLF.writeByte(10);
            this.host = host;
            this.port = port;
            this.resource = resource;
        }

        public override function close()  :  Void
        {
            this.input = null;
            this.output = null;
            this.stripped = false;
            socket.close()
        }

        public override function peek()  :  Bool
        {
            if(socket.connected)
            {
                trace("Bytes remained:" + socket.bytesAvailable);
                return socket.bytesAvailable>0;
            }
            return false;
        }

        public override function read(buf : Bytes, off  :  Int, len  :  Int)  :  Int
        {
            var n1  :  Int = 0, n2  :  Int = 0, n3  :  Int = 0, n4  :  Int = 0, cidx  :  Int = 2;
            var chunkSize : Bytes = new Bytes();

            try
            {
                while (!stripped)
                {
                    n1 = n2;
                    n2 = n3;
                    n3 = n4;
                    n4 = input.readByte();
                    if ((n1 == 13) && (n2 == 10) && (n3 == 13) && (n4 == 10))
                    {
                        stripped = true;
                    }
                }

                // read chunk size
                if (bytesInChunk == 0)
                {
                    n1 = input.readByte();
                    n2 = input.readByte();

                    chunkSize.writeByte(n1);
                    chunkSize.writeByte(n2);

                    while (!((n1 == 13) && (n2 == 10)))
                    {
                        n1 = n2;
                        n2 = input.readByte();
                        chunkSize.writeByte(n2);
                    }

                    bytesInChunk = parseInt(chunkSize.toString(), 16);
                }

                input.readBytes(buf, off, len);
                debugBuffer(buf);
                bytesInChunk -= len;

                if (bytesInChunk == 0)
                {
                    // advance the  :  "\r\n"
                    input.readUTFBytes(2);
                }
                return len;
            }
            catch (e : EOFError)
            {
                trace(e);
                throw new TTransportException(TTransportException.UNKNOWN, "No more data available.");
            }
            catch (e : TException)
            {
                trace('TException $e');
                throw e;
            }
            catch (e : Error)
            {
                trace(e);
                throw new TTransportException(TTransportException.UNKNOWN, 'Bad IO error: $e');
            }
            catch (e : Dynamic)
            {
                trace(e);
                throw new TTransportException(TTransportException.UNKNOWN, 'Bad IO error: $e');
            }
            return 0;
        }

        public function debugBuffer(buf : Bytes)  :  Void
        {
            var debug  :  String = "BUFFER >>";
            var i  :  Int;
            for (i = 0; i < buf.length; i++)
            {
                debug += buf[i] as int;
                debug += " ";
            }

            trace(debug + "<<");
        }

        public override function write(buf : Bytes, off  :  Int, len  :  Int)  :  Void
        {
            obuffer.writeBytes(buf, off, len);
        }

        public function addEventListener(type  :  String, listener : Function, useCapture  :  Bool = false, priority  :  Int = 0, useWeakReference  :  Bool = false)  :  Void
        {
            this.eventDispatcher.addEventListener(type, listener, useCapture, priority, useWeakReference);
        }

        public override function open()  :  Void
        {
            this.socket = new Socket();
            this.socket.addEventListener(Event.CONNECT, socketConnected);
            this.socket.addEventListener(IOErrorEvent.IO_ERROR, socketError);
            this.socket.addEventListener(SecurityErrorEvent.SECURITY_ERROR, socketSecurityError);
            this.socket.addEventListener(ProgressEvent.SOCKET_DATA, socketDataHandler);
            this.socket.connect(host, port);
        }

        public function socketConnected(event : Event)  :  Void
        {
            this.output = this.socket;
            this.input = this.socket;
            this.output.writeUTF( "CONNECT " + resource + " HTTP/1.1\n"
                                + "Host :  " + host + ":" + port + "\r\n"
                                + "User-Agent :  Thrift/Haxe\r\n"
                                + "Transfer-Encoding :  chunked\r\n"
                                + "content-type :  application/x-thrift\r\n"
                                + "Accept :  */*\r\n"
                                + "\r\n");
            this.eventDispatcher.dispatchEvent(event);
        }

        public function socketError(event : IOErrorEvent)  :  Void
        {
            trace("Error Connecting:" + event);
            this.close();
            if (ioCallback == null)
            {
                return;
            }
            ioCallback(new TTransportException(TTransportException.UNKNOWN, "IOError :  " + event.text));
            this.eventDispatcher.dispatchEvent(event);
        }

        public function socketSecurityError(event : SecurityErrorEvent)  :  Void
        {
            trace("Security Error Connecting:" + event);
            this.close();
            this.eventDispatcher.dispatchEvent(event);
        }

        public function socketDataHandler(event : ProgressEvent)  :  Void
        {
            trace("Got Data call:" +ioCallback);
            if (ioCallback != null)
            {
                ioCallback(null);
            };
            this.eventDispatcher.dispatchEvent(event);
        }

        public override function flush(callback : Error->Void = null)  :  Void
        {
            trace("set callback:" + callback);
            this.ioCallback = callback;
            this.output.writeUTF(this.obuffer.length.toString(16));
            this.output.writeBytes(CRLF);
            this.output.writeBytes(this.obuffer);
            this.output.writeBytes(CRLF);
            this.socket.flush();
            // waiting for  new Flex sdk 3.5
            //this.obuffer.clear();
            this.obuffer = new Bytes();
        }

        public override function isOpen()  :  Bool
        {
            return (this.socket == null ? false  :  this.socket.connected);
        }

}