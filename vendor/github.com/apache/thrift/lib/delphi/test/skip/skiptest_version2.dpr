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

program skiptest_version2;

{$APPTYPE CONSOLE}

uses
  Classes, Windows, SysUtils,
  Skiptest.Two,
  Thrift in '..\..\src\Thrift.pas',
  Thrift.Socket in '..\..\src\Thrift.Socket.pas',
  Thrift.Transport in '..\..\src\Thrift.Transport.pas',
  Thrift.Protocol in '..\..\src\Thrift.Protocol.pas',
  Thrift.Protocol.JSON in '..\..\src\Thrift.Protocol.JSON.pas',
  Thrift.Collections in '..\..\src\Thrift.Collections.pas',
  Thrift.Server in '..\..\src\Thrift.Server.pas',
  Thrift.Console in '..\..\src\Thrift.Console.pas',
  Thrift.Utils in '..\..\src\Thrift.Utils.pas',
  Thrift.TypeRegistry in '..\..\src\Thrift.TypeRegistry.pas',
  Thrift.Stream in '..\..\src\Thrift.Stream.pas';

const
  REQUEST_EXT  = '.request';
  RESPONSE_EXT = '.response';

function CreatePing : IPing;
var list : IThriftList<IPong>;
    set_ : IHashSet<string>;
begin
  result := TPingImpl.Create;
  result.Version1  := Skiptest.Two.TConstants.SKIPTESTSERVICE_VERSION;
  result.BoolVal   := TRUE;
  result.ByteVal   := 2;
  result.DbVal     := 3;
  result.I16Val    := 4;
  result.I32Val    := 5;
  result.I64Val    := 6;
  result.StrVal    := 'seven';

  result.StructVal := TPongImpl.Create;
  result.StructVal.Version1 := -1;
  result.StructVal.Version2 := -2;

  list := TThriftListImpl<IPong>.Create;
  list.Add( result.StructVal);
  list.Add( result.StructVal);

  set_ := THashSetImpl<string>.Create;
  set_.Add( 'one');
  set_.Add( 'uno');
  set_.Add( 'eins');
  set_.Add( 'een');

  result.MapVal := TThriftDictionaryImpl< IThriftList<IPong>, IHashSet<string>>.Create;
  result.MapVal.Add( list, set_);
end;


type
  TDummyServer = class( TInterfacedObject, TSkipTestService.Iface)
  protected
    // TSkipTestService.Iface
    function PingPong(const ping: IPing; const pong: IPong): IPing;
  end;


function TDummyServer.PingPong(const ping: IPing; const pong: IPong): IPing;
// TSkipTestService.Iface
begin
  Writeln('- performing request from version '+IntToStr(ping.Version1)+' client');
  result := CreatePing;
end;


function CreateProtocol( protfact : IProtocolFactory; stm : TStream; aForInput : Boolean) : IProtocol;
var adapt  : IThriftStream;
    trans  : ITransport;
begin
  adapt  := TThriftStreamAdapterDelphi.Create( stm, FALSE);
  if aForInput
  then trans := TStreamTransportImpl.Create( adapt, nil)
  else trans := TStreamTransportImpl.Create( nil, adapt);
  result := protfact.GetProtocol( trans);
end;


procedure CreateRequest( protfact : IProtocolFactory; fname : string);
var stm    : TFileStream;
    ping   : IPing;
    proto  : IProtocol;
    client : TSkipTestService.TClient;   // we need access to send/recv_pingpong()
    cliRef : IUnknown;                   // holds the refcount
begin
  Writeln('- creating new request');
  stm := TFileStream.Create( fname+REQUEST_EXT+'.tmp', fmCreate);
  try
    ping := CreatePing;

    // save request data
    proto  := CreateProtocol( protfact, stm, FALSE);
    client := TSkipTestService.TClient.Create( nil, proto);
    cliRef := client as IUnknown;
    client.send_PingPong( ping, ping.StructVal);

  finally
    client := nil;  // not Free!
    cliRef := nil;
    stm.Free;
    if client = nil then {warning suppressed};
  end;

  DeleteFile( fname+REQUEST_EXT);
  RenameFile( fname+REQUEST_EXT+'.tmp', fname+REQUEST_EXT);
end;


procedure ReadResponse( protfact : IProtocolFactory; fname : string);
var stm    : TFileStream;
    ping   : IPing;
    proto  : IProtocol;
    client : TSkipTestService.TClient;   // we need access to send/recv_pingpong()
    cliRef : IUnknown;                   // holds the refcount
begin
  Writeln('- reading response');
  stm := TFileStream.Create( fname+RESPONSE_EXT, fmOpenRead);
  try
    // save request data
    proto  := CreateProtocol( protfact, stm, TRUE);
    client := TSkipTestService.TClient.Create( proto, nil);
    cliRef := client as IUnknown;
    ping   := client.recv_PingPong;

  finally
    client := nil;  // not Free!
    cliRef := nil;
    stm.Free;
    if client = nil then {warning suppressed};
  end;
end;


procedure ProcessFile( protfact : IProtocolFactory; fname : string);
var stmIn, stmOut   : TFileStream;
    protIn, protOut : IProtocol;
    server : IProcessor;
begin
  Writeln('- processing request');
  stmOut := nil;
  stmIn  := TFileStream.Create( fname+REQUEST_EXT, fmOpenRead);
  try
    stmOut := TFileStream.Create( fname+RESPONSE_EXT+'.tmp', fmCreate);

    // process request and write response data
    protIn  := CreateProtocol( protfact, stmIn,  TRUE);
    protOut := CreateProtocol( protfact, stmOut, FALSE);

    server := TSkipTestService.TProcessorImpl.Create( TDummyServer.Create);
    server.Process( protIn, protOut);

  finally
    server := nil;  // not Free!
    stmIn.Free;
    stmOut.Free;
    if server = nil then {warning suppressed};
  end;

  DeleteFile( fname+RESPONSE_EXT);
  RenameFile( fname+RESPONSE_EXT+'.tmp', fname+RESPONSE_EXT);
end;


procedure Test( protfact : IProtocolFactory; fname : string);
begin
  // try to read an existing request
  if FileExists( fname + REQUEST_EXT) then begin
    ProcessFile( protfact, fname);
    ReadResponse( protfact, fname);
  end;

  // create a new request and try to process
  CreateRequest( protfact, fname);
  ProcessFile( protfact, fname);
  ReadResponse( protfact, fname);
end;


const
  FILE_BINARY = 'pingpong.bin';
  FILE_JSON   = 'pingpong.json';
begin
  try
    Writeln( 'Delphi SkipTest '+IntToStr(TConstants.SKIPTESTSERVICE_VERSION)+' using '+Thrift.Version);

    Writeln;
    Writeln('Binary protocol');
    Test( TBinaryProtocolImpl.TFactory.Create, FILE_BINARY);

    Writeln;
    Writeln('JSON protocol');
    Test( TJSONProtocolImpl.TFactory.Create,   FILE_JSON);

    Writeln;
    Writeln('Test completed without errors.');
    Writeln;
    Write('Press ENTER to close ...');  Readln;
  except
    on E: Exception do
      Writeln(E.ClassName, ': ', E.Message);
  end;
end.

