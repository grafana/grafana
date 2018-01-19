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
using System.Threading;
using Thrift.Protocol;
using Thrift.Transport;

namespace Thrift.Server
{
  /// <summary>
  /// Server that uses C# built-in ThreadPool to spawn threads when handling requests
  /// </summary>
  public class TThreadPoolServer : TServer
  {
    private const int DEFAULT_MIN_THREADS = 10;
    private const int DEFAULT_MAX_THREADS = 100;
    private volatile bool stop = false;

    public TThreadPoolServer(TProcessor processor, TServerTransport serverTransport)
        : this(new TSingletonProcessorFactory(processor), serverTransport,
         new TTransportFactory(), new TTransportFactory(),
         new TBinaryProtocol.Factory(), new TBinaryProtocol.Factory(),
         DEFAULT_MIN_THREADS, DEFAULT_MAX_THREADS, DefaultLogDelegate)
    {
    }

    public TThreadPoolServer(TProcessor processor, TServerTransport serverTransport, LogDelegate logDelegate)
        : this(new TSingletonProcessorFactory(processor), serverTransport,
         new TTransportFactory(), new TTransportFactory(),
         new TBinaryProtocol.Factory(), new TBinaryProtocol.Factory(),
         DEFAULT_MIN_THREADS, DEFAULT_MAX_THREADS, logDelegate)
    {
    }

    public TThreadPoolServer(TProcessor processor,
     TServerTransport serverTransport,
     TTransportFactory transportFactory,
     TProtocolFactory protocolFactory)
        : this(new TSingletonProcessorFactory(processor), serverTransport,
           transportFactory, transportFactory,
           protocolFactory, protocolFactory,
           DEFAULT_MIN_THREADS, DEFAULT_MAX_THREADS, DefaultLogDelegate)
    {
    }

    public TThreadPoolServer(TProcessorFactory processorFactory,
                 TServerTransport serverTransport,
                 TTransportFactory transportFactory,
                 TProtocolFactory protocolFactory)
        : this(processorFactory, serverTransport,
         transportFactory, transportFactory,
         protocolFactory, protocolFactory,
         DEFAULT_MIN_THREADS, DEFAULT_MAX_THREADS, DefaultLogDelegate)
    {
    }

    public TThreadPoolServer(TProcessorFactory processorFactory,
                 TServerTransport serverTransport,
                 TTransportFactory inputTransportFactory,
                 TTransportFactory outputTransportFactory,
                 TProtocolFactory inputProtocolFactory,
                 TProtocolFactory outputProtocolFactory,
                 int minThreadPoolThreads, int maxThreadPoolThreads, LogDelegate logDel)
        : base(processorFactory, serverTransport, inputTransportFactory, outputTransportFactory,
          inputProtocolFactory, outputProtocolFactory, logDel)
    {
      lock (typeof(TThreadPoolServer))
      {
        if (!ThreadPool.SetMaxThreads(maxThreadPoolThreads, maxThreadPoolThreads))
        {
          throw new Exception("Error: could not SetMaxThreads in ThreadPool");
        }
        if (!ThreadPool.SetMinThreads(minThreadPoolThreads, minThreadPoolThreads))
        {
          throw new Exception("Error: could not SetMinThreads in ThreadPool");
        }
      }
    }


    /// <summary>
    /// Use new ThreadPool thread for each new client connection
    /// </summary>
    public override void Serve()
    {
      try
      {
        serverTransport.Listen();
      }
      catch (TTransportException ttx)
      {
        logDelegate("Error, could not listen on ServerTransport: " + ttx);
        return;
      }

      //Fire the preServe server event when server is up but before any client connections
      if (serverEventHandler != null)
        serverEventHandler.preServe();

      while (!stop)
      {
        int failureCount = 0;
        try
        {
          TTransport client = serverTransport.Accept();
          ThreadPool.QueueUserWorkItem(this.Execute, client);
        }
        catch (TTransportException ttx)
        {
          if (!stop || ttx.Type != TTransportException.ExceptionType.Interrupted)
          {
            ++failureCount;
            logDelegate(ttx.ToString());
          }

        }
      }

      if (stop)
      {
        try
        {
          serverTransport.Close();
        }
        catch (TTransportException ttx)
        {
          logDelegate("TServerTransport failed on close: " + ttx.Message);
        }
        stop = false;
      }
    }

    /// <summary>
    /// Loops on processing a client forever
    /// threadContext will be a TTransport instance
    /// </summary>
    /// <param name="threadContext"></param>
    private void Execute(Object threadContext)
    {
      TTransport client = (TTransport)threadContext;
      TProcessor processor = processorFactory.GetProcessor(client, this);
      TTransport inputTransport = null;
      TTransport outputTransport = null;
      TProtocol inputProtocol = null;
      TProtocol outputProtocol = null;
      Object connectionContext = null;
      try
      {
        inputTransport = inputTransportFactory.GetTransport(client);
        outputTransport = outputTransportFactory.GetTransport(client);
        inputProtocol = inputProtocolFactory.GetProtocol(inputTransport);
        outputProtocol = outputProtocolFactory.GetProtocol(outputTransport);

        //Recover event handler (if any) and fire createContext server event when a client connects
        if (serverEventHandler != null)
          connectionContext = serverEventHandler.createContext(inputProtocol, outputProtocol);

        //Process client requests until client disconnects
        while (!stop)
        {
          if (!inputTransport.Peek())
            break;

          //Fire processContext server event
          //N.B. This is the pattern implemented in C++ and the event fires provisionally.
          //That is to say it may be many minutes between the event firing and the client request
          //actually arriving or the client may hang up without ever makeing a request.
          if (serverEventHandler != null)
            serverEventHandler.processContext(connectionContext, inputTransport);
          //Process client request (blocks until transport is readable)
          if (!processor.Process(inputProtocol, outputProtocol))
            break;
        }
      }
      catch (TTransportException)
      {
        //Usually a client disconnect, expected
      }
      catch (Exception x)
      {
        //Unexpected
        logDelegate("Error: " + x);
      }

      //Fire deleteContext server event after client disconnects
      if (serverEventHandler != null)
        serverEventHandler.deleteContext(connectionContext, inputProtocol, outputProtocol);

      //Close transports
      if (inputTransport != null)
        inputTransport.Close();
      if (outputTransport != null)
        outputTransport.Close();
    }

    public override void Stop()
    {
      stop = true;
      serverTransport.Close();
    }
  }
}
