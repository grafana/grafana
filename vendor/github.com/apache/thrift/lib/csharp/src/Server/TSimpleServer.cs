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
using Thrift.Transport;
using Thrift.Protocol;

namespace Thrift.Server
{
  /// <summary>
  /// Simple single-threaded server for testing
  /// </summary>
  public class TSimpleServer : TServer
  {
    private bool stop = false;

    public TSimpleServer(TProcessor processor,
              TServerTransport serverTransport)
      : base(processor, serverTransport, new TTransportFactory(), new TTransportFactory(), new TBinaryProtocol.Factory(), new TBinaryProtocol.Factory(), DefaultLogDelegate)
    {
    }

    public TSimpleServer(TProcessor processor,
              TServerTransport serverTransport,
              LogDelegate logDel)
      : base(processor, serverTransport, new TTransportFactory(), new TTransportFactory(), new TBinaryProtocol.Factory(), new TBinaryProtocol.Factory(), logDel)
    {
    }

    public TSimpleServer(TProcessor processor,
              TServerTransport serverTransport,
              TTransportFactory transportFactory)
      : base(processor,
         serverTransport,
         transportFactory,
         transportFactory,
         new TBinaryProtocol.Factory(),
         new TBinaryProtocol.Factory(),
           DefaultLogDelegate)
    {
    }

    public TSimpleServer(TProcessor processor,
        TServerTransport serverTransport,
        TTransportFactory transportFactory,
        TProtocolFactory protocolFactory)
        : base(processor,
           serverTransport,
           transportFactory,
           transportFactory,
           protocolFactory,
           protocolFactory,
           DefaultLogDelegate)
    {
    }

    public TSimpleServer(TProcessorFactory processorFactory,
              TServerTransport serverTransport,
              TTransportFactory transportFactory,
              TProtocolFactory protocolFactory)
      : base(processorFactory,
         serverTransport,
         transportFactory,
         transportFactory,
         protocolFactory,
         protocolFactory,
         DefaultLogDelegate)
    {
    }

    public override void Serve()
    {
      try
      {
        serverTransport.Listen();
      }
      catch (TTransportException ttx)
      {
        logDelegate(ttx.ToString());
        return;
      }

      //Fire the preServe server event when server is up but before any client connections
      if (serverEventHandler != null)
        serverEventHandler.preServe();

      while (!stop)
      {
        TProcessor processor = null;
        TTransport client = null;
        TTransport inputTransport = null;
        TTransport outputTransport = null;
        TProtocol inputProtocol = null;
        TProtocol outputProtocol = null;
        Object connectionContext = null;
        try
        {
          using (client = serverTransport.Accept())
          {
            processor = processorFactory.GetProcessor(client);
            if (client != null)
            {
              using (inputTransport = inputTransportFactory.GetTransport(client))
              {
                using (outputTransport = outputTransportFactory.GetTransport(client))
                {
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
              }
            }
          }
        }
        catch (TTransportException ttx)
        {
          if (!stop || ttx.Type != TTransportException.ExceptionType.Interrupted)
          {
            logDelegate(ttx.ToString());
          }
        }
        catch (Exception x)
        {
          //Unexpected
          logDelegate(x.ToString());
        }

        //Fire deleteContext server event after client disconnects
        if (serverEventHandler != null)
          serverEventHandler.deleteContext(connectionContext, inputProtocol, outputProtocol);
      }
    }

    public override void Stop()
    {
      stop = true;
      serverTransport.Close();
    }
  }
}
