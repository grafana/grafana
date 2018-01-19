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

unit TestServer;

{$I ../src/Thrift.Defines.inc}
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
  Thrift.Protocol.JSON,
  Thrift.Protocol.Compact,
  Thrift.Collections,
  Thrift.Utils,
  Thrift.Test,
  Thrift,
  TestConstants,
  TestServerEvents,
  Contnrs;

type
  TTestServer = class
  public
    type

      ITestHandler = interface( TThriftTest.Iface )
        procedure SetServer( const AServer : IServer );
        procedure TestStop;
      end;

      TTestHandlerImpl = class( TInterfacedObject, ITestHandler )
      private
        FServer : IServer;
      protected
        procedure testVoid();
        function testBool(thing: Boolean): Boolean;
        function testString(const thing: string): string;
        function testByte(thing: ShortInt): ShortInt;
        function testI32(thing: Integer): Integer;
        function testI64(const thing: Int64): Int64;
        function testDouble(const thing: Double): Double;
        function testBinary(const thing: TBytes): TBytes;
        function testStruct(const thing: IXtruct): IXtruct;
        function testNest(const thing: IXtruct2): IXtruct2;
        function testMap(const thing: IThriftDictionary<Integer, Integer>): IThriftDictionary<Integer, Integer>;
        function testStringMap(const thing: IThriftDictionary<string, string>): IThriftDictionary<string, string>;
        function testSet(const thing: IHashSet<Integer>): IHashSet<Integer>;
        function testList(const thing: IThriftList<Integer>): IThriftList<Integer>;
        function testEnum(thing: TNumberz): TNumberz;
        function testTypedef(const thing: Int64): Int64;
        function testMapMap(hello: Integer): IThriftDictionary<Integer, IThriftDictionary<Integer, Integer>>;
        function testInsanity(const argument: IInsanity): IThriftDictionary<Int64, IThriftDictionary<TNumberz, IInsanity>>;
        function testMulti(arg0: ShortInt; arg1: Integer; const arg2: Int64; const arg3: IThriftDictionary<SmallInt, string>; arg4: TNumberz; const arg5: Int64): IXtruct;
        procedure testException(const arg: string);
        function testMultiException(const arg0: string; const arg1: string): IXtruct;
        procedure testOneway(secondsToSleep: Integer);

        procedure TestStop;
        procedure SetServer( const AServer : IServer );
      end;

      class procedure PrintCmdLineHelp;
      class procedure InvalidArgs;

      class procedure LaunchAnonPipeChild( const app : string; const transport : IAnonymousPipeServerTransport);
      class procedure Execute( const args: array of string);
  end;

implementation


var g_Handler : TTestServer.ITestHandler = nil;


function MyConsoleEventHandler( dwCtrlType : DWORD) : BOOL;  stdcall;
// Note that this Handler procedure is called from another thread
var handler : TTestServer.ITestHandler;
begin
  result := TRUE;
  try
    case dwCtrlType of
      CTRL_C_EVENT        :  Console.WriteLine( 'Ctrl+C pressed');
      CTRL_BREAK_EVENT    :  Console.WriteLine( 'Ctrl+Break pressed');
      CTRL_CLOSE_EVENT    :  Console.WriteLine( 'Received CloseTask signal');
      CTRL_LOGOFF_EVENT   :  Console.WriteLine( 'Received LogOff signal');
      CTRL_SHUTDOWN_EVENT :  Console.WriteLine( 'Received Shutdown signal');
    else
      Console.WriteLine( 'Received console event #'+IntToStr(Integer(dwCtrlType)));
    end;

    handler := g_Handler;
    if handler <> nil then handler.TestStop;

  except
    // catch all
  end;
end;


{ TTestServer.TTestHandlerImpl }

procedure TTestServer.TTestHandlerImpl.SetServer( const AServer: IServer);
begin
  FServer := AServer;
end;

function TTestServer.TTestHandlerImpl.testByte(thing: ShortInt): ShortInt;
begin
  Console.WriteLine('testByte("' + IntToStr( thing) + '")');
  Result := thing;
end;

function TTestServer.TTestHandlerImpl.testDouble( const thing: Double): Double;
begin
  Console.WriteLine('testDouble("' + FloatToStr( thing ) + '")');
  Result := thing;
end;

function TTestServer.TTestHandlerImpl.testBinary(const thing: TBytes): TBytes;
begin
  Console.WriteLine('testBinary("' + BytesToHex( thing ) + '")');
  Result := thing;
end;

function TTestServer.TTestHandlerImpl.testEnum(thing: TNumberz): TNumberz;
begin
  Console.WriteLine('testEnum(' + IntToStr( Integer( thing)) + ')');
  Result := thing;
end;

procedure TTestServer.TTestHandlerImpl.testException(const arg: string);
begin
  Console.WriteLine('testException(' + arg + ')');
  if ( arg = 'Xception') then
  begin
    raise TXception.Create( 1001, arg);
  end;

  if (arg = 'TException') then
  begin
    raise TException.Create('');
  end;

  // else do not throw anything
end;

function TTestServer.TTestHandlerImpl.testI32(thing: Integer): Integer;
begin
  Console.WriteLine('testI32("' + IntToStr( thing) + '")');
  Result := thing;
end;

function TTestServer.TTestHandlerImpl.testI64( const thing: Int64): Int64;
begin
  Console.WriteLine('testI64("' + IntToStr( thing) + '")');
  Result := thing;
end;

function TTestServer.TTestHandlerImpl.testInsanity(
  const argument: IInsanity): IThriftDictionary<Int64, IThriftDictionary<TNumberz, IInsanity>>;
var
  hello, goodbye : IXtruct;
  crazy : IInsanity;
  looney : IInsanity;
  first_map : IThriftDictionary<TNumberz, IInsanity>;
  second_map : IThriftDictionary<TNumberz, IInsanity>;
  insane : IThriftDictionary<Int64, IThriftDictionary<TNumberz, IInsanity>>;

begin

  Console.WriteLine('testInsanity()');
  hello := TXtructImpl.Create;
  hello.String_thing := 'Hello2';
  hello.Byte_thing := 2;
  hello.I32_thing := 2;
  hello.I64_thing := 2;

  goodbye := TXtructImpl.Create;
  goodbye.String_thing := 'Goodbye4';
  goodbye.Byte_thing := 4;
  goodbye.I32_thing := 4;
  goodbye.I64_thing := 4;

  crazy := TInsanityImpl.Create;
  crazy.UserMap := TThriftDictionaryImpl<TNumberz, Int64>.Create;
  crazy.UserMap.AddOrSetValue( TNumberz.EIGHT, 8);
  crazy.Xtructs := TThriftListImpl<IXtruct>.Create;
  crazy.Xtructs.Add(goodbye);

  looney := TInsanityImpl.Create;
  crazy.UserMap.AddOrSetValue( TNumberz.FIVE, 5);
  crazy.Xtructs.Add(hello);

  first_map := TThriftDictionaryImpl<TNumberz, IInsanity>.Create;
  second_map := TThriftDictionaryImpl<TNumberz, IInsanity>.Create;

  first_map.AddOrSetValue( TNumberz.TWO, crazy);
  first_map.AddOrSetValue( TNumberz.THREE, crazy);

  second_map.AddOrSetValue( TNumberz.SIX, looney);

  insane := TThriftDictionaryImpl<Int64, IThriftDictionary<TNumberz, IInsanity>>.Create;

  insane.AddOrSetValue( 1, first_map);
  insane.AddOrSetValue( 2, second_map);

  Result := insane;
end;

function TTestServer.TTestHandlerImpl.testList(
  const thing: IThriftList<Integer>): IThriftList<Integer>;
var
  first : Boolean;
  elem : Integer;
begin
  Console.Write('testList({');
  first := True;
  for elem in thing do
  begin
    if first then
    begin
      first := False;
    end else
    begin
      Console.Write(', ');
    end;
    Console.Write( IntToStr( elem));
  end;
  Console.WriteLine('})');
  Result := thing;
end;

function TTestServer.TTestHandlerImpl.testMap(
  const thing: IThriftDictionary<Integer, Integer>): IThriftDictionary<Integer, Integer>;
var
  first : Boolean;
  key : Integer;
begin
  Console.Write('testMap({');
  first := True;
  for key in thing.Keys do
  begin
    if (first) then
    begin
      first := false;
    end else
    begin
      Console.Write(', ');
    end;
    Console.Write(IntToStr(key) + ' => ' + IntToStr( thing[key]));
  end;
  Console.WriteLine('})');
  Result := thing;
end;

function TTestServer.TTestHandlerImpl.TestMapMap(
  hello: Integer): IThriftDictionary<Integer, IThriftDictionary<Integer, Integer>>;
var
  mapmap : IThriftDictionary<Integer, IThriftDictionary<Integer, Integer>>;
  pos : IThriftDictionary<Integer, Integer>;
  neg : IThriftDictionary<Integer, Integer>;
  i : Integer;
begin
  Console.WriteLine('testMapMap(' + IntToStr( hello) + ')');
  mapmap := TThriftDictionaryImpl<Integer, IThriftDictionary<Integer, Integer>>.Create;
  pos := TThriftDictionaryImpl<Integer, Integer>.Create;
  neg := TThriftDictionaryImpl<Integer, Integer>.Create;

  for i := 1 to 4 do
  begin
    pos.AddOrSetValue( i, i);
    neg.AddOrSetValue( -i, -i);
  end;

  mapmap.AddOrSetValue(4, pos);
  mapmap.AddOrSetValue( -4, neg);

  Result := mapmap;
end;

function TTestServer.TTestHandlerImpl.testMulti(arg0: ShortInt; arg1: Integer;
  const arg2: Int64; const arg3: IThriftDictionary<SmallInt, string>;
  arg4: TNumberz; const arg5: Int64): IXtruct;
var
  hello : IXtruct;
begin
  Console.WriteLine('testMulti()');
  hello := TXtructImpl.Create;
  hello.String_thing := 'Hello2';
  hello.Byte_thing := arg0;
  hello.I32_thing := arg1;
  hello.I64_thing := arg2;
  Result := hello;
end;

function TTestServer.TTestHandlerImpl.testMultiException( const arg0, arg1: string): IXtruct;
var
  x2 : TXception2;
begin
  Console.WriteLine('testMultiException(' + arg0 + ', ' + arg1 + ')');
  if ( arg0 = 'Xception') then
  begin
    raise TXception.Create( 1001, 'This is an Xception');  // test the new rich CTOR
  end else
  if ( arg0 = 'Xception2') then
  begin
    x2 := TXception2.Create;  // the old way still works too?
    x2.ErrorCode := 2002;
    x2.Struct_thing := TXtructImpl.Create;
    x2.Struct_thing.String_thing := 'This is an Xception2';
    x2.UpdateMessageProperty;
    raise x2;
  end;

  Result := TXtructImpl.Create;
  Result.String_thing := arg1;
end;

function TTestServer.TTestHandlerImpl.testNest( const thing: IXtruct2): IXtruct2;
var
  temp : IXtruct;
begin
  temp := thing.Struct_thing;
  Console.WriteLine('testNest({' +
         IntToStr( thing.Byte_thing) + ', {' +
         '"' + temp.String_thing + '", ' +
         IntToStr( temp.Byte_thing) + ', ' +
         IntToStr( temp.I32_thing) + ', ' +
         IntToStr( temp.I64_thing) + '}, ' +
         IntToStr( temp.I32_thing) + '})');
  Result := thing;
end;

procedure TTestServer.TTestHandlerImpl.testOneway(secondsToSleep: Integer);
begin
  Console.WriteLine('testOneway(' + IntToStr( secondsToSleep )+ '), sleeping...');
  Sleep(secondsToSleep * 1000);
  Console.WriteLine('testOneway finished');
end;

function TTestServer.TTestHandlerImpl.testSet(
  const thing: IHashSet<Integer>):IHashSet<Integer>;
var
  first : Boolean;
  elem : Integer;
begin
  Console.Write('testSet({');
  first := True;

  for elem in thing do
  begin
    if first then
    begin
      first := False;
    end else
    begin
      Console.Write( ', ');
    end;
    Console.Write( IntToStr( elem));
  end;
  Console.WriteLine('})');
  Result := thing;
end;

procedure TTestServer.TTestHandlerImpl.testStop;
begin
  if FServer <> nil then
  begin
    FServer.Stop;
  end;
end;

function TTestServer.TTestHandlerImpl.testBool(thing: Boolean): Boolean;
begin
  Console.WriteLine('testBool(' + BoolToStr(thing,true) + ')');
  Result := thing;
end;

function TTestServer.TTestHandlerImpl.testString( const thing: string): string;
begin
  Console.WriteLine('teststring("' + thing + '")');
  Result := thing;
end;

function TTestServer.TTestHandlerImpl.testStringMap(
  const thing: IThriftDictionary<string, string>): IThriftDictionary<string, string>;
var
  first : Boolean;
  key : string;
begin
  Console.Write('testStringMap({');
  first := True;
  for key in thing.Keys do
  begin
    if (first) then
    begin
      first := false;
    end else
    begin
      Console.Write(', ');
    end;
    Console.Write(key + ' => ' + thing[key]);
  end;
  Console.WriteLine('})');
  Result := thing;
end;

function TTestServer.TTestHandlerImpl.testTypedef( const thing: Int64): Int64;
begin
  Console.WriteLine('testTypedef(' + IntToStr( thing) + ')');
  Result := thing;
end;

procedure TTestServer.TTestHandlerImpl.TestVoid;
begin
  Console.WriteLine('testVoid()');
end;

function TTestServer.TTestHandlerImpl.testStruct( const thing: IXtruct): IXtruct;
begin
  Console.WriteLine('testStruct({' +
    '"' + thing.String_thing + '", ' +
      IntToStr( thing.Byte_thing) + ', ' +
      IntToStr( thing.I32_thing) + ', ' +
      IntToStr( thing.I64_thing));
  Result := thing;
end;


{ TTestServer }


class procedure TTestServer.PrintCmdLineHelp;
const HELPTEXT = ' [options]'#10
               + #10
               + 'Allowed options:'#10
               + '  -h [ --help ]               produce help message'#10
               + '  --port arg (=9090)          Port number to listen'#10
               + '  --domain-socket arg         Unix Domain Socket (e.g. /tmp/ThriftTest.thrift)'#10
               + '  --named-pipe arg            Windows Named Pipe (e.g. MyThriftPipe)'#10
               + '  --server-type arg (=simple) type of server, "simple", "thread-pool",'#10
               + '                              "threaded", or "nonblocking"'#10
               + '  --transport arg (=socket)   transport: buffered, framed, http, anonpipe'#10
               + '  --protocol arg (=binary)    protocol: binary, compact, json'#10
               + '  --ssl                       Encrypted Transport using SSL'#10
               + '  --processor-events          processor-events'#10
               + '  -n [ --workers ] arg (=4)   Number of thread pools workers. Only valid for'#10
               + '                              thread-pool server type'#10
               ;
begin
  Console.WriteLine( ChangeFileExt(ExtractFileName(ParamStr(0)),'') + HELPTEXT);
end;

class procedure TTestServer.InvalidArgs;
begin
  Console.WriteLine( 'Invalid args.');
  Console.WriteLine( ChangeFileExt(ExtractFileName(ParamStr(0)),'') + ' -h for more information');
  Abort;
end;

class procedure TTestServer.LaunchAnonPipeChild( const app : string; const transport : IAnonymousPipeServerTransport);
//Launch child process and pass R/W anonymous pipe handles on cmd line.
//This is a simple example and does not include elevation or other
//advanced features.
var pi : PROCESS_INFORMATION;
        si : STARTUPINFO;
        sArg, sHandles, sCmdLine : string;
    i : Integer;
begin
  GetStartupInfo( si);  //set startupinfo for the spawned process

  // preformat handles args
  sHandles := Format( '%d %d',
                    [ Integer(transport.ClientAnonRead),
                      Integer(transport.ClientAnonWrite)]);

  // pass all settings to client
  sCmdLine := app;
  for i := 1 to ParamCount do begin
    sArg := ParamStr(i);

    // add anonymous handles and quote strings where appropriate
    if sArg = '-anon'
    then sArg := sArg +' '+ sHandles
    else begin
      if Pos(' ',sArg) > 0
      then sArg := '"'+sArg+'"';
    end;;

    sCmdLine := sCmdLine +' '+ sArg;
  end;

  // spawn the child process
  Console.WriteLine('Starting client '+sCmdLine);
  Win32Check( CreateProcess( nil, PChar(sCmdLine), nil,nil,TRUE,0,nil,nil,si,pi));

  CloseHandle( pi.hThread);
    CloseHandle( pi.hProcess);
end;


class procedure TTestServer.Execute( const args: array of string);
var
  Port : Integer;
  ServerEvents : Boolean;
  sPipeName : string;
  testHandler : ITestHandler;
  testProcessor : IProcessor;
  ServerTrans : IServerTransport;
  ServerEngine : IServer;
  anonymouspipe : IAnonymousPipeServerTransport;
  namedpipe : INamedPipeServerTransport;
  TransportFactory : ITransportFactory;
  ProtocolFactory : IProtocolFactory;
  i, numWorker : Integer;
  s : string;
  protType : TKnownProtocol;
  servertype : TServerType;
  endpoint : TEndpointTransport;
  layered : TLayeredTransports;
  UseSSL : Boolean; // include where appropriate (TLayeredTransport?)
begin
  try
    ServerEvents := FALSE;
    protType := prot_Binary;
    servertype := srv_Simple;
    endpoint := trns_Sockets;
    layered := [];
    UseSSL := FALSE;
    Port := 9090;
    sPipeName := '';
    numWorker := 4;

    i := 0;
    while ( i < Length(args) ) do begin
      s := args[i];
      Inc(i);

      // Allowed options:
      if (s = '-h') or (s = '--help') then begin
        // -h [ --help ]               produce help message
        PrintCmdLineHelp;
        Exit;
      end
      else if (s = '--port') then begin
        // --port arg (=9090)          Port number to listen
        s := args[i];
        Inc(i);
        Port := StrToIntDef( s, Port);
      end
      else if (s = '--domain-socket') then begin
        // --domain-socket arg         Unix Domain Socket (e.g. /tmp/ThriftTest.thrift)
        raise Exception.Create('domain-socket not supported');
      end
      else if (s = '--named-pipe') then begin
        // --named-pipe arg            Windows Named Pipe (e.g. MyThriftPipe)
        endpoint := trns_NamedPipes;
        sPipeName := args[i];  // -pipe <name>
        Inc( i );
      end
      else if (s = '--server-type') then begin
        // --server-type arg (=simple) type of server,
        // arg = "simple", "thread-pool", "threaded", or "nonblocking"
        s := args[i];
        Inc(i);

        if      s = 'simple'      then servertype := srv_Simple
        else if s = 'thread-pool' then servertype := srv_Threadpool
        else if s = 'threaded'    then servertype := srv_Threaded
        else if s = 'nonblocking' then servertype := srv_Nonblocking
        else InvalidArgs;
      end
      else if (s = '--transport') then begin
        // --transport arg (=buffered) transport: buffered, framed, http
        s := args[i];
        Inc(i);

        if      s = 'buffered' then Include( layered, trns_Buffered)
        else if s = 'framed'   then Include( layered, trns_Framed)
        else if s = 'http'     then endpoint := trns_Http
        else if s = 'anonpipe' then endpoint := trns_AnonPipes
        else InvalidArgs;
      end
      else if (s = '--protocol') then begin
        // --protocol arg (=binary)    protocol: binary, compact, json
        s := args[i];
        Inc(i);

        if      s = 'binary'   then protType := prot_Binary
        else if s = 'compact'  then protType := prot_Compact
        else if s = 'json'     then protType := prot_JSON
        else InvalidArgs;
      end
      else if (s = '--ssl') then begin
        // --ssl     Encrypted Transport using SSL
        UseSSL := TRUE;
      end
      else if (s = '--processor-events') then begin
         // --processor-events          processor-events
        ServerEvents := TRUE;
      end
      else if (s = '-n') or (s = '--workers') then begin
        // -n [ --workers ] arg (=4)   Number of thread pools workers.
        // Only valid for thread-pool server type
        s := args[i];
        numWorker := StrToIntDef(s,0);
        if numWorker > 0
        then Inc(i)
        else numWorker := 4;
      end
      else begin
        InvalidArgs;
      end;
    end;


    Console.WriteLine('Server configuration: ');

    // create protocol factory, default to BinaryProtocol
    case protType of
      prot_Binary  :  ProtocolFactory := TBinaryProtocolImpl.TFactory.Create( BINARY_STRICT_READ, BINARY_STRICT_WRITE);
      prot_JSON    :  ProtocolFactory := TJSONProtocolImpl.TFactory.Create;
      prot_Compact :  ProtocolFactory := TCompactProtocolImpl.TFactory.Create;
    else
      raise Exception.Create('Unhandled protocol');
    end;
    ASSERT( ProtocolFactory <> nil);
    Console.WriteLine('- '+THRIFT_PROTOCOLS[protType]+' protocol');

    case endpoint of

      trns_Sockets : begin
        Console.WriteLine('- sockets (port '+IntToStr(port)+')');
        if (trns_Buffered in layered) then Console.WriteLine('- buffered');
        servertrans := TServerSocketImpl.Create( Port, 0, (trns_Buffered in layered));
      end;

      trns_Http : begin
        raise Exception.Create(ENDPOINT_TRANSPORTS[endpoint]+' server transport not implemented');
      end;

      trns_NamedPipes : begin
        Console.WriteLine('- named pipe ('+sPipeName+')');
        namedpipe   := TNamedPipeServerTransportImpl.Create( sPipeName, 4096, PIPE_UNLIMITED_INSTANCES);
        servertrans := namedpipe;
      end;

      trns_AnonPipes : begin
        Console.WriteLine('- anonymous pipes');
        anonymouspipe := TAnonymousPipeServerTransportImpl.Create;
        servertrans   := anonymouspipe;
      end

    else
      raise Exception.Create('Unhandled endpoint transport');
    end;
    ASSERT( servertrans <> nil);

    if UseSSL then begin
      raise Exception.Create('SSL not implemented');
    end;

    if (trns_Framed in layered) then begin
      Console.WriteLine('- framed transport');
      TransportFactory := TFramedTransportImpl.TFactory.Create
    end
    else begin
      TransportFactory := TTransportFactoryImpl.Create;
    end;
    ASSERT( TransportFactory <> nil);

    testHandler   := TTestHandlerImpl.Create;
    testProcessor := TThriftTest.TProcessorImpl.Create( testHandler );

    case servertype of
      srv_Simple      : begin
        ServerEngine := TSimpleServer.Create( testProcessor, ServerTrans, TransportFactory, ProtocolFactory);
      end;

      srv_Nonblocking : begin
        raise Exception.Create(SERVER_TYPES[servertype]+' server not implemented');
      end;

      srv_Threadpool,
      srv_Threaded: begin
        if numWorker > 1 then {use here};
        raise Exception.Create(SERVER_TYPES[servertype]+' server not implemented');
      end;

    else
      raise Exception.Create('Unhandled server type');
    end;
    ASSERT( ServerEngine <> nil);

    testHandler.SetServer( ServerEngine);

    // test events?
    if ServerEvents then begin
      Console.WriteLine('- server events test enabled');
      ServerEngine.ServerEvents := TServerEventsImpl.Create;
    end;

    // start the client now when we have the anon handles, but before the server starts
    if endpoint = trns_AnonPipes
    then LaunchAnonPipeChild( ExtractFilePath(ParamStr(0))+'client.exe', anonymouspipe);

    // install Ctrl+C handler before the server starts
    g_Handler := testHandler;
    SetConsoleCtrlHandler( @MyConsoleEventHandler, TRUE);

    Console.WriteLine('');
    repeat
      Console.WriteLine('Starting the server ...');
      serverEngine.Serve;
    until {$IFDEF RunEndless} FALSE {$ELSE} TRUE {$ENDIF};

    testHandler.SetServer( nil);
    g_Handler := nil;

  except
    on E: EAbort do raise;
    on E: Exception do begin
      Console.WriteLine( E.Message + #10 + E.StackTrace );
    end;
  end;
  Console.WriteLine( 'done.');
end;


end.
