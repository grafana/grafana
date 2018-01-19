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

package org.apache.thrift.server;

import org.apache.thrift.*;
import org.apache.thrift.protocol.*;
import org.apache.thrift.transport.*;
import org.apache.thrift.meta_data.*;

class TServer
{
    private var processor : TProcessor = null;
    private var serverTransport : TServerTransport = null;
    private var inputTransportFactory : TTransportFactory = null;
    private var outputTransportFactory : TTransportFactory = null;
    private var inputProtocolFactory : TProtocolFactory = null;
    private var outputProtocolFactory : TProtocolFactory = null;

    // server events
    public var serverEventHandler : TServerEventHandler = null;

    // Log delegation
    private var _logDelegate : Dynamic->Void  = null;
    public var logDelegate(get,set) : Dynamic->Void;

    public function new( processor : TProcessor,
                         serverTransport : TServerTransport,
                         inputTransportFactory : TTransportFactory = null,
                         outputTransportFactory : TTransportFactory = null,
                         inputProtocolFactory : TProtocolFactory = null,
                         outputProtocolFactory : TProtocolFactory = null,
                         logDelegate : Dynamic->Void = null)
    {
      this.processor = processor;
      this.serverTransport = serverTransport;
      this.inputTransportFactory = inputTransportFactory;
      this.outputTransportFactory = outputTransportFactory;
      this.inputProtocolFactory = inputProtocolFactory;
      this.outputProtocolFactory = outputProtocolFactory;
      this.logDelegate = logDelegate;

      ApplyMissingDefaults();
    }

    private function ApplyMissingDefaults() {
        if( processor == null)
            throw "Invalid server configuration: processor missing";
        if( serverTransport == null)
            throw "Invalid server configuration: serverTransport missing";
        if( inputTransportFactory == null)
            inputTransportFactory = new TTransportFactory();
        if( outputTransportFactory  == null)
            outputTransportFactory = new TTransportFactory();
        if( inputProtocolFactory  == null)
            inputProtocolFactory = new TBinaryProtocolFactory();
        if( outputProtocolFactory == null)
            outputProtocolFactory= new TBinaryProtocolFactory();
        if( logDelegate == null)
            logDelegate = DefaultLogDelegate;
    }


    private function set_logDelegate(value : Dynamic->Void) : Dynamic->Void {
        if(value != null) {
            _logDelegate = value;
        } else {
            _logDelegate = DefaultLogDelegate;
        }
        return _logDelegate;
    }


    private function get_logDelegate() : Dynamic->Void {
        return _logDelegate;
    }


    private function DefaultLogDelegate(value : Dynamic) : Void  {
        trace( value);
    }



    public function Serve() : Void {
        throw new AbstractMethodError();
    }


    public function Stop() : Void {
        throw new AbstractMethodError();
    }

}
 