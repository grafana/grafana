/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *		http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package org.apache.thrift.transport
{

  import flash.events.EventDispatcher;
  import flash.events.Event;
  import flash.events.IOErrorEvent;
  import flash.events.ProgressEvent;
  import flash.events.SecurityErrorEvent;
  import flash.errors.EOFError;
  import flash.errors.IOError;
  import flash.net.URLLoader;
  import flash.net.URLLoaderDataFormat;
  import flash.net.URLRequest;
  import flash.net.URLRequestMethod;
  import flash.utils.IDataInput;
  import flash.utils.IDataOutput;
  import flash.utils.ByteArray;
  import flash.net.Socket;


  /**
   * Socket implementation of the TTransport interface. Used for working with a
   * Thrift Socket Server based implementations.
   */

  public class TSocket extends TTransport
  {
    private var socket:Socket = null;

    private var host:String;

    private var port:int;

    private var obuffer:ByteArray = new ByteArray();

    private var input:IDataInput;

    private var output:IDataOutput;

    private var ioCallback:Function = null;

    private var eventDispatcher:EventDispatcher = new EventDispatcher();

    public function TSocket(host:String, port:int):void
    {
      this.host = host;
      this.port = port;
    }

    public override function close():void
    {
      this.input = null;
      this.output = null;
      socket.close()
    }

    public override function peek():Boolean
    {
      if(socket.connected)
      {
        trace("Bytes remained:" + socket.bytesAvailable);
        return socket.bytesAvailable>0;
      }
      return false;
    }

    public override function read(buf:ByteArray, off:int, len:int):int
    {
      var n1:int = 0, n2:int = 0, n3:int = 0, n4:int = 0, cidx:int = 2;
      var chunkSize:ByteArray = new ByteArray();

      try
      {
        input.readBytes(buf, off, len);
        return len;
      }
      catch (e:EOFError)
      {
        trace(e);
        throw new TTransportError(TTransportError.END_OF_FILE, "No more data available.");
      }
      catch (e:IOError)
      {
        trace(e);
        if(isOpen())
        {
          throw new TTransportError(TTransportError.UNKNOWN, "IO error while reading: " + e);
        }
        else
        {
          throw new TTransportError(TTransportError.NOT_OPEN, "Socket seem not to be opened: " + e);
    	}
      }
      catch (e:Error)
      {
        trace(e);
        throw new TTransportError(TTransportError.UNKNOWN, "Bad IO error: " + e);
      }
      return 0;
    }

    public override function write(buf:ByteArray, off:int, len:int):void
    {
      obuffer.writeBytes(buf, off, len);
    }

    public function addEventListener(type:String, listener:Function, useCapture:Boolean = false, priority:int = 0, useWeakReference:Boolean = false):void
    {
      this.eventDispatcher.addEventListener(type, listener, useCapture, priority, useWeakReference);
    }
    
    public function removeEventListener(type:String, listener:Function, useCapture:Boolean = false):void
    {
      this.eventDispatcher.removeEventListener(type, listener, useCapture);
    }

    public override function open():void
    {
      this.socket = new Socket();
      this.socket.addEventListener(Event.CONNECT, socketConnected);
      this.socket.addEventListener(IOErrorEvent.IO_ERROR, socketError);
      this.socket.addEventListener(SecurityErrorEvent.SECURITY_ERROR, socketSecurityError);
      this.socket.addEventListener(ProgressEvent.SOCKET_DATA, socketDataHandler);
      this.socket.connect(host, port);
    }

    public function socketConnected(event:Event):void
    {
      this.output = this.socket;
      this.input = this.socket;
      this.eventDispatcher.dispatchEvent(event);
    }

    public function socketError(event:IOErrorEvent):void
    {
      trace("Error Connecting:" + event);
      this.close();
      if (ioCallback == null)
      {
        return;
      }
      ioCallback(new TTransportError(TTransportError.UNKNOWN, "IOError: " + event.text));
      this.eventDispatcher.dispatchEvent(event);
    }

    public function socketSecurityError(event:SecurityErrorEvent):void
    {
      trace("Security Error Connecting:" + event);
      this.close();
      this.eventDispatcher.dispatchEvent(event);
    }

    public function socketDataHandler(event:ProgressEvent):void
    {
      if (ioCallback != null)
      {
        ioCallback(null);
      }
      this.eventDispatcher.dispatchEvent(event);
    }

    public override function flush(callback:Function = null):void
    {
      this.ioCallback = callback;
      this.output.writeBytes(this.obuffer);
      this.socket.flush();
      this.obuffer.clear();
    }

    public override function isOpen():Boolean
    {
      return (this.socket == null ? false : this.socket.connected);
    }
  }
}
