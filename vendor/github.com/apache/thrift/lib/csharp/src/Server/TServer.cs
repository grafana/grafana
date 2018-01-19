/**
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
 *
 * Contains some contributions under the Thrift Software License.
 * Please see doc/old-thrift-license.txt in the Thrift distribution for
 * details.
 */

using System;
using Thrift.Protocol;
using Thrift.Transport;
using System.IO;

namespace Thrift.Server
{
  public abstract class TServer
  {
    //Attributes
    protected TProcessorFactory processorFactory;
    protected TServerTransport serverTransport;
    protected TTransportFactory inputTransportFactory;
    protected TTransportFactory outputTransportFactory;
    protected TProtocolFactory inputProtocolFactory;
    protected TProtocolFactory outputProtocolFactory;
    protected TServerEventHandler serverEventHandler = null;

    //Methods
    public void setEventHandler(TServerEventHandler seh)
    {
      serverEventHandler = seh;
    }
    public TServerEventHandler getEventHandler()
    {
      return serverEventHandler;
    }

    //Log delegation
    public delegate void LogDelegate(string str);
    private LogDelegate _logDelegate;
    protected LogDelegate logDelegate
    {
      get { return _logDelegate; }
      set { _logDelegate = (value != null) ? value : DefaultLogDelegate; }
    }
    protected static void DefaultLogDelegate(string s)
    {
      Console.Error.WriteLine(s);
    }

    //Construction
    public TServer(TProcessor processor,
              TServerTransport serverTransport)
      : this(processor, serverTransport,
         new TTransportFactory(),
         new TTransportFactory(),
         new TBinaryProtocol.Factory(),
         new TBinaryProtocol.Factory(),
         DefaultLogDelegate)
    {
    }

    public TServer(TProcessor processor,
            TServerTransport serverTransport,
            LogDelegate logDelegate)
      : this(processor,
         serverTransport,
         new TTransportFactory(),
         new TTransportFactory(),
         new TBinaryProtocol.Factory(),
         new TBinaryProtocol.Factory(),
         logDelegate)
    {
    }

    public TServer(TProcessor processor,
              TServerTransport serverTransport,
              TTransportFactory transportFactory)
      : this(processor,
         serverTransport,
         transportFactory,
         transportFactory,
         new TBinaryProtocol.Factory(),
         new TBinaryProtocol.Factory(),
         DefaultLogDelegate)
    {
    }

    public TServer(TProcessor processor,
              TServerTransport serverTransport,
              TTransportFactory transportFactory,
              TProtocolFactory protocolFactory)
      : this(processor,
         serverTransport,
         transportFactory,
         transportFactory,
         protocolFactory,
         protocolFactory,
           DefaultLogDelegate)
    {
    }

    public TServer(TProcessor processor,
        TServerTransport serverTransport,
        TTransportFactory inputTransportFactory,
        TTransportFactory outputTransportFactory,
        TProtocolFactory inputProtocolFactory,
        TProtocolFactory outputProtocolFactory,
        LogDelegate logDelegate)
    {
        this.processorFactory = new TSingletonProcessorFactory(processor);
        this.serverTransport = serverTransport;
        this.inputTransportFactory = inputTransportFactory;
        this.outputTransportFactory = outputTransportFactory;
        this.inputProtocolFactory = inputProtocolFactory;
        this.outputProtocolFactory = outputProtocolFactory;
        this.logDelegate = (logDelegate != null) ? logDelegate : DefaultLogDelegate;
    }

    public TServer(TProcessorFactory processorFactory,
              TServerTransport serverTransport,
              TTransportFactory inputTransportFactory,
              TTransportFactory outputTransportFactory,
              TProtocolFactory inputProtocolFactory,
              TProtocolFactory outputProtocolFactory,
              LogDelegate logDelegate)
    {
        this.processorFactory = processorFactory;
        this.serverTransport = serverTransport;
        this.inputTransportFactory = inputTransportFactory;
        this.outputTransportFactory = outputTransportFactory;
        this.inputProtocolFactory = inputProtocolFactory;
        this.outputProtocolFactory = outputProtocolFactory;
        this.logDelegate = (logDelegate != null) ? logDelegate : DefaultLogDelegate;
    }

    //Abstract Interface
    public abstract void Serve();
    public abstract void Stop();
  }
}
