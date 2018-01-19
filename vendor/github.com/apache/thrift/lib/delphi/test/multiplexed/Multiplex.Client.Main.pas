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

unit Multiplex.Client.Main;

{.$DEFINE StressTest}   // activate to stress-test the server with frequent connects/disconnects
{.$DEFINE PerfTest}     // activate to activate the performance test

interface

uses
  Windows, SysUtils, Classes,
  DateUtils,
  Generics.Collections,
  Thrift,
  Thrift.Protocol,
  Thrift.Protocol.Multiplex,
  Thrift.Transport.Pipes,
  Thrift.Transport,
  Thrift.Stream,
  Thrift.Collections,
  Benchmark,  // in gen-delphi folder
  Aggr,       // in gen-delphi folder
  Multiplex.Test.Common;

type
  TTestClient = class
  protected
    FProtocol : IProtocol;

    procedure ParseArgs( const args: array of string);
    procedure Setup;
    procedure Run;
  public
    constructor Create( const args: array of string);
    class procedure Execute( const args: array of string);
  end;

implementation


type
  IServiceClient = interface
    ['{7745C1C2-AB20-43BA-B6F0-08BF92DE0BAC}']
    procedure Test;
  end;

//--- TTestClient -------------------------------------


class procedure TTestClient.Execute( const args: array of string);
var client : TTestClient;
begin
  client := TTestClient.Create(args);
  try
    client.Run;
  finally
    client.Free;
  end;
end;


constructor TTestClient.Create( const args: array of string);
begin
  inherited Create;
  ParseArgs(args);
  Setup;
end;


procedure TTestClient.ParseArgs( const args: array of string);
begin
  if Length(args) <> 0
  then raise Exception.Create('No args accepted so far');
end;


procedure TTestClient.Setup;
var trans : ITransport;
begin
  trans := TSocketImpl.Create( 'localhost', 9090);
  trans := TFramedTransportImpl.Create( trans);
  trans.Open;
  FProtocol := TBinaryProtocolImpl.Create( trans, TRUE, TRUE);
end;


procedure TTestClient.Run;
var bench : TBenchmarkService.Iface;
    aggr  : TAggr.Iface;
    multiplex : IProtocol;
    i         : Integer;
begin
  try
    multiplex := TMultiplexedProtocol.Create( FProtocol, NAME_BENCHMARKSERVICE);
    bench     := TBenchmarkService.TClient.Create( multiplex);

    multiplex := TMultiplexedProtocol.Create( FProtocol, NAME_AGGR);
    aggr      := TAggr.TClient.Create( multiplex);

    for i := 1 to 10
    do aggr.addValue( bench.fibonacci(i));

    for i in aggr.getValues
    do Write(IntToStr(i)+' ');
    WriteLn;
  except
    on e:Exception do Writeln(#10+e.Message);
  end;
end;


end.


