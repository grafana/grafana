(*
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
 *)

unit Multiplex.Server.Main;

{$WARN SYMBOL_PLATFORM OFF}

{.$DEFINE RunEndless}   // activate to interactively stress-test the server stop routines via Ctrl+C

interface

uses
  Windows, SysUtils,
  Generics.Collections,
  Thrift.Console,
  Thrift.Server,
  Thrift.Transport,
  Thrift.Transport.Pipes,
  Thrift.Protocol,
  Thrift.Protocol.Multiplex,
  Thrift.Processor.Multiplex,
  Thrift.Collections,
  Thrift.Utils,
  Thrift,
  Benchmark,  // in gen-delphi folder
  Aggr,       // in gen-delphi folder
  Multiplex.Test.Common,
  Contnrs;

type
  TTestServer = class
  public type
    ITestHandler = interface
      ['{CAE09AAB-80FB-48E9-B3A8-7F9B96F5419A}']
      procedure SetServer( const AServer : IServer );
    end;

  protected type
    TTestHandlerImpl = class( TInterfacedObject, ITestHandler)
    private
      FServer : IServer;
    protected
      // ITestHandler
      procedure SetServer( const AServer : IServer );

      property Server : IServer read FServer write SetServer;
    end;

    TBenchmarkServiceImpl = class( TTestHandlerImpl, TBenchmarkService.Iface)
    protected
      // TBenchmarkService.Iface
      function fibonacci(n: ShortInt): Integer;
    end;


    TAggrImpl = class( TTestHandlerImpl, TAggr.Iface)
    protected
      FList : IThriftList<Integer>;

      // TAggr.Iface
      procedure addValue(value: Integer);
      function getValues(): IThriftList<Integer>;
    public
      constructor Create;
      destructor Destroy;  override;
    end;

  public
    class procedure Execute( const args: array of string);
  end;


implementation


{ TTestServer.TTestHandlerImpl }

procedure TTestServer.TTestHandlerImpl.SetServer( const AServer: IServer);
begin
  FServer := AServer;
end;


{ TTestServer.TBenchmarkServiceImpl }

function TTestServer.TBenchmarkServiceImpl.fibonacci(n: ShortInt): Integer;
var prev, next : Integer;
begin
  prev   := 0;
  result := 1;
  while n > 0 do begin
    next   := result + prev;
    prev   := result;
    result := next;
    Dec(n);
  end;
end;

{ TTestServer.TAggrImpl }

constructor TTestServer.TAggrImpl.Create;
begin
  inherited Create;
  FList := TThriftListImpl<Integer>.Create;
end;


destructor TTestServer.TAggrImpl.Destroy;
begin
  try
    FreeAndNil( FList);
  finally
    inherited Destroy;
  end;
end;


procedure TTestServer.TAggrImpl.addValue(value: Integer);
begin
  FList.Add( value);
end;


function TTestServer.TAggrImpl.getValues(): IThriftList<Integer>;
begin
  result := FList;
end;


{ TTestServer }

class procedure TTestServer.Execute( const args: array of string);
var
  TransportFactory : ITransportFactory;
  ProtocolFactory  : IProtocolFactory;
  ServerTrans      : IServerTransport;
  benchHandler     : TBenchmarkService.Iface;
  aggrHandler      : TAggr.Iface;
  benchProcessor   : IProcessor;
  aggrProcessor    : IProcessor;
  multiplex        : IMultiplexedProcessor;
  ServerEngine     : IServer;
begin
  try
    // create protocol factory, default to BinaryProtocol
    ProtocolFactory  := TBinaryProtocolImpl.TFactory.Create( TRUE, TRUE);
    servertrans      := TServerSocketImpl.Create( 9090, 0, FALSE);
    TransportFactory := TFramedTransportImpl.TFactory.Create;

    benchHandler     := TBenchmarkServiceImpl.Create;
    benchProcessor   := TBenchmarkService.TProcessorImpl.Create( benchHandler);

    aggrHandler      := TAggrImpl.Create;
    aggrProcessor    := TAggr.TProcessorImpl.Create( aggrHandler);

    multiplex        := TMultiplexedProcessorImpl.Create;
    multiplex.RegisterProcessor( NAME_BENCHMARKSERVICE, benchProcessor);
    multiplex.RegisterProcessor( NAME_AGGR,  aggrProcessor);

    ServerEngine := TSimpleServer.Create( multiplex,
                                          ServerTrans,
                                          TransportFactory,
                                          ProtocolFactory);

    (benchHandler as ITestHandler).SetServer( ServerEngine);
    (aggrHandler as ITestHandler).SetServer( ServerEngine);

    Console.WriteLine('Starting the server ...');
    ServerEngine.serve();

    (benchHandler as ITestHandler).SetServer( nil);
    (aggrHandler as ITestHandler).SetServer( nil);

  except
    on E: Exception do
    begin
      Console.Write( E.Message);
    end;
  end;
  Console.WriteLine( 'done.');
end;


end.

