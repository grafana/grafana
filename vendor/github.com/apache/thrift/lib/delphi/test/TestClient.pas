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

unit TestClient;

{$I ../src/Thrift.Defines.inc}

{.$DEFINE StressTest}   // activate to stress-test the server with frequent connects/disconnects
{.$DEFINE PerfTest}     // activate to activate the performance test

interface

uses
  Windows, SysUtils, Classes, Math,
  DateUtils,
  Generics.Collections,
  TestConstants,
  Thrift,
  Thrift.Protocol.Compact,
  Thrift.Protocol.JSON,
  Thrift.Protocol,
  Thrift.Transport.Pipes,
  Thrift.Transport,
  Thrift.Stream,
  Thrift.Test,
  Thrift.Collections,
  Thrift.Console;

type
  TThreadConsole = class
  private
    FThread : TThread;
  public
    procedure Write( const S : string);
    procedure WriteLine( const S : string);
    constructor Create( AThread: TThread);
  end;

  TClientThread = class( TThread )
  private type
    TTestGroup = (
      test_Unknown,
      test_BaseTypes,
      test_Structs,
      test_Containers,
      test_Exceptions
      // new values here
    );
    TTestGroups = set of TTestGroup;

  private
    FTransport : ITransport;
    FProtocol : IProtocol;
    FNumIteration : Integer;
    FConsole : TThreadConsole;

    // test reporting, will be refactored out into separate class later
    FTestGroup : string;
    FCurrentTest : TTestGroup;
    FSuccesses : Integer;
    FErrors : TStringList;
    FFailed : TTestGroups;
    FExecuted : TTestGroups;
    procedure StartTestGroup( const aGroup : string; const aTest : TTestGroup);
    procedure Expect( aTestResult : Boolean; const aTestInfo : string);
    procedure ReportResults;
    function  CalculateExitCode : Byte;

    procedure ClientTest;
    procedure JSONProtocolReadWriteTest;
    function  PrepareBinaryData( aRandomDist : Boolean = FALSE) : TBytes;
    {$IFDEF StressTest}
    procedure StressTest(const client : TThriftTest.Iface);
    {$ENDIF}
  protected
    procedure Execute; override;
  public
    constructor Create( const ATransport: ITransport; const AProtocol : IProtocol; ANumIteration: Integer);
    destructor Destroy; override;
  end;

  TTestClient = class
  private
    class var
      FNumIteration : Integer;
      FNumThread : Integer;

    class procedure PrintCmdLineHelp;
    class procedure InvalidArgs;
  public
    class function Execute( const args: array of string) : Byte;
  end;


implementation

const
   EXITCODE_SUCCESS           = $00;  // no errors bits set
   //
   EXITCODE_FAILBIT_BASETYPES  = $01;
   EXITCODE_FAILBIT_STRUCTS    = $02;
   EXITCODE_FAILBIT_CONTAINERS = $04;
   EXITCODE_FAILBIT_EXCEPTIONS = $08;

   MAP_FAILURES_TO_EXITCODE_BITS : array[TClientThread.TTestGroup] of Byte = (
     EXITCODE_SUCCESS,  // no bits here
     EXITCODE_FAILBIT_BASETYPES,
     EXITCODE_FAILBIT_STRUCTS,
     EXITCODE_FAILBIT_CONTAINERS,
     EXITCODE_FAILBIT_EXCEPTIONS
   );



function BoolToString( b : Boolean) : string;
// overrides global BoolToString()
begin
  if b
  then result := 'true'
  else result := 'false';
end;

// not available in all versions, so make sure we have this one imported
function IsDebuggerPresent: BOOL; stdcall; external KERNEL32 name 'IsDebuggerPresent';

{ TTestClient }

class procedure TTestClient.PrintCmdLineHelp;
const HELPTEXT = ' [options]'#10
               + #10
               + 'Allowed options:'#10
               + '  -h [ --help ]               produce help message'#10
               + '  --host arg (=localhost)     Host to connect'#10
               + '  --port arg (=9090)          Port number to connect'#10
               + '  --domain-socket arg         Domain Socket (e.g. /tmp/ThriftTest.thrift),'#10
               + '                              instead of host and port'#10
               + '  --named-pipe arg            Windows Named Pipe (e.g. MyThriftPipe)'#10
               + '  --anon-pipes hRead hWrite   Windows Anonymous Pipes pair (handles)'#10
               + '  --transport arg (=sockets)  Transport: buffered, framed, http, evhttp'#10
               + '  --protocol arg (=binary)    Protocol: binary, compact, json'#10
               + '  --ssl                       Encrypted Transport using SSL'#10
               + '  -n [ --testloops ] arg (=1) Number of Tests'#10
               + '  -t [ --threads ] arg (=1)   Number of Test threads'#10
               ;
begin
  Writeln( ChangeFileExt(ExtractFileName(ParamStr(0)),'') + HELPTEXT);
end;

class procedure TTestClient.InvalidArgs;
begin
  Console.WriteLine( 'Invalid args.');
  Console.WriteLine( ChangeFileExt(ExtractFileName(ParamStr(0)),'') + ' -h for more information');
  Abort;
end;

class function TTestClient.Execute(const args: array of string) : Byte;
var
  i : Integer;
  host : string;
  port : Integer;
  sPipeName : string;
  hAnonRead, hAnonWrite : THandle;
  s : string;
  threads : array of TThread;
  dtStart : TDateTime;
  test : Integer;
  thread : TThread;
  trans : ITransport;
  prot : IProtocol;
  streamtrans : IStreamTransport;
  http : IHTTPClient;
  protType : TKnownProtocol;
  endpoint : TEndpointTransport;
  layered : TLayeredTransports;
  UseSSL : Boolean; // include where appropriate (TLayeredTransport?)
const
  // pipe timeouts to be used
  DEBUG_TIMEOUT   = 30 * 1000;
  RELEASE_TIMEOUT = DEFAULT_THRIFT_TIMEOUT;
  TIMEOUT         = RELEASE_TIMEOUT;
begin
  protType := prot_Binary;
  endpoint := trns_Sockets;
  layered := [];
  UseSSL := FALSE;
  host := 'localhost';
  port := 9090;
  sPipeName := '';
  hAnonRead := INVALID_HANDLE_VALUE;
  hAnonWrite := INVALID_HANDLE_VALUE;
  try
    i := 0;
    while ( i < Length(args) ) do begin
      s := args[i];
      Inc( i);

      if (s = '-h') or (s = '--help') then begin
        // -h [ --help ]               produce help message
        PrintCmdLineHelp;
        result := $FF;   // all tests failed
        Exit;
      end
      else if s = '--host' then begin
        // --host arg (=localhost)     Host to connect
        host := args[i];
        Inc( i);
      end
      else if s = '--port' then begin
        // --port arg (=9090)          Port number to connect
        s := args[i];
        Inc( i);
        port := StrToIntDef(s,0);
        if port <= 0 then InvalidArgs;
      end
      else if s = '--domain-socket' then begin
        // --domain-socket arg         Domain Socket (e.g. /tmp/ThriftTest.thrift), instead of host and port
        raise Exception.Create('domain-socket not supported');
      end
      else if s = '--named-pipe' then begin
        // --named-pipe arg            Windows Named Pipe (e.g. MyThriftPipe)
        endpoint := trns_NamedPipes;
        sPipeName := args[i];
        Inc( i);
      end
      else if s = '--anon-pipes' then begin
        // --anon-pipes hRead hWrite   Windows Anonymous Pipes pair (handles)
        endpoint := trns_AnonPipes;
        hAnonRead := THandle( StrToIntDef( args[i], Integer(INVALID_HANDLE_VALUE)));
        Inc( i);
        hAnonWrite := THandle( StrToIntDef( args[i], Integer(INVALID_HANDLE_VALUE)));
        Inc( i);
      end
      else if s = '--transport' then begin
        // --transport arg (=sockets)  Transport: buffered, framed, http, evhttp
        s := args[i];
        Inc( i);

        if      s = 'buffered' then Include( layered, trns_Buffered)
        else if s = 'framed'   then Include( layered, trns_Framed)
        else if s = 'http'     then endpoint := trns_Http
        else if s = 'evhttp'   then endpoint := trns_AnonPipes
        else InvalidArgs;
      end
      else if s = '--protocol' then begin
        // --protocol arg (=binary)    Protocol: binary, compact, json
        s := args[i];
        Inc( i);

        if      s = 'binary'   then protType := prot_Binary
        else if s = 'compact'  then protType := prot_Compact
        else if s = 'json'     then protType := prot_JSON
        else InvalidArgs;
      end
      else if s = '--ssl' then begin
        // --ssl                       Encrypted Transport using SSL
        UseSSL := TRUE;

      end
      else if (s = '-n') or (s = '--testloops') then begin
        // -n [ --testloops ] arg (=1) Number of Tests
        FNumIteration := StrToIntDef( args[i], 0);
        Inc( i);
        if FNumIteration <= 0
        then InvalidArgs;

      end
      else if (s = '-t') or (s = '--threads') then begin
        // -t [ --threads ] arg (=1)   Number of Test threads
        FNumThread := StrToIntDef( args[i], 0);
        Inc( i);
        if FNumThread <= 0
        then InvalidArgs;
      end
      else begin
        InvalidArgs;
      end;
    end;


    // In the anonymous pipes mode the client is launched by the test server
    // -> behave nicely and allow for attaching a debugger to this process
    if (endpoint = trns_AnonPipes) and not IsDebuggerPresent
    then MessageBox( 0, 'Attach Debugger and/or click OK to continue.',
                        'Thrift TestClient (Delphi)',
                        MB_OK or MB_ICONEXCLAMATION);

    SetLength( threads, FNumThread);
    dtStart := Now;

    for test := 0 to FNumThread - 1 do
    begin
      case endpoint of
        trns_Sockets: begin
          Console.WriteLine('Using sockets ('+host+' port '+IntToStr(port)+')');
          streamtrans := TSocketImpl.Create( host, port );
        end;

        trns_Http: begin
          Console.WriteLine('Using HTTPClient');
          http := THTTPClientImpl.Create( host);
          trans := http;
        end;

        trns_EvHttp: begin
          raise Exception.Create(ENDPOINT_TRANSPORTS[endpoint]+' transport not implemented');
        end;

        trns_NamedPipes: begin
          Console.WriteLine('Using named pipe ('+sPipeName+')');
          streamtrans := TNamedPipeTransportClientEndImpl.Create( sPipeName, 0, nil, TIMEOUT, TIMEOUT);
        end;

        trns_AnonPipes: begin
          Console.WriteLine('Using anonymous pipes ('+IntToStr(Integer(hAnonRead))+' and '+IntToStr(Integer(hAnonWrite))+')');
          streamtrans := TAnonymousPipeTransportImpl.Create( hAnonRead, hAnonWrite, FALSE);
        end;

      else
        raise Exception.Create('Unhandled endpoint transport');
      end;
      trans := streamtrans;
      ASSERT( trans <> nil);

      if (trns_Buffered in layered) then begin
        trans := TBufferedTransportImpl.Create( streamtrans, 32);  // small buffer to test read()
        Console.WriteLine('Using buffered transport');
      end;

      if (trns_Framed in layered) then begin
        trans := TFramedTransportImpl.Create( trans );
        Console.WriteLine('Using framed transport');
      end;

      if UseSSL then begin
        raise Exception.Create('SSL not implemented');
      end;

      // create protocol instance, default to BinaryProtocol
      case protType of
        prot_Binary  :  prot := TBinaryProtocolImpl.Create( trans, BINARY_STRICT_READ, BINARY_STRICT_WRITE);
        prot_JSON    :  prot := TJSONProtocolImpl.Create( trans);
        prot_Compact :  prot := TCompactProtocolImpl.Create( trans);
      else
        raise Exception.Create('Unhandled protocol');
      end;
      ASSERT( trans <> nil);
      Console.WriteLine(THRIFT_PROTOCOLS[protType]+' protocol');

      thread := TClientThread.Create( trans, prot, FNumIteration);
      threads[test] := thread;
      thread.Start;
    end;

    result := 0;
    for test := 0 to FNumThread - 1 do begin
      result := result or threads[test].WaitFor;
    end;

    for test := 0 to FNumThread - 1
    do threads[test].Free;

    Console.Write('Total time: ' + IntToStr( MilliSecondsBetween(Now, dtStart)));

  except
    on E: EAbort do raise;
    on E: Exception do begin
      Console.WriteLine( E.Message + #10 + E.StackTrace);
      raise;
    end;
  end;

  Console.WriteLine('');
  Console.WriteLine('done!');
end;

{ TClientThread }

procedure TClientThread.ClientTest;
var
  client : TThriftTest.Iface;
  s : string;
  i8 : ShortInt;
  i32 : Integer;
  i64 : Int64;
  binOut,binIn : TBytes;
  dub : Double;
  o : IXtruct;
  o2 : IXtruct2;
  i : IXtruct;
  i2 : IXtruct2;
  mapout : IThriftDictionary<Integer,Integer>;
  mapin : IThriftDictionary<Integer,Integer>;
  strmapout : IThriftDictionary<string,string>;
  strmapin : IThriftDictionary<string,string>;
  j : Integer;
  first : Boolean;
  key : Integer;
  strkey : string;
  listout : IThriftList<Integer>;
  listin : IThriftList<Integer>;
  setout : IHashSet<Integer>;
  setin : IHashSet<Integer>;
  ret : TNumberz;
  uid : Int64;
  mm : IThriftDictionary<Integer, IThriftDictionary<Integer, Integer>>;
  pos : IThriftDictionary<Integer, Integer>;
  neg : IThriftDictionary<Integer, Integer>;
  m2 : IThriftDictionary<Integer, Integer>;
  k2 : Integer;
  insane : IInsanity;
  truck : IXtruct;
  whoa : IThriftDictionary<Int64, IThriftDictionary<TNumberz, IInsanity>>;
  key64 : Int64;
  val : IThriftDictionary<TNumberz, IInsanity>;
  k2_2 : TNumberz;
  k3 : TNumberz;
  v2 : IInsanity;
  userMap : IThriftDictionary<TNumberz, Int64>;
  xtructs : IThriftList<IXtruct>;
  x : IXtruct;
  arg0 : ShortInt;
  arg1 : Integer;
  arg2 : Int64;
  arg3 : IThriftDictionary<SmallInt, string>;
  arg4 : TNumberz;
  arg5 : Int64;
  {$IFDEF PerfTest}
  StartTick : Cardinal;
  k : Integer;
  {$ENDIF}
  hello, goodbye : IXtruct;
  crazy : IInsanity;
  looney : IInsanity;
  first_map : IThriftDictionary<TNumberz, IInsanity>;
  second_map : IThriftDictionary<TNumberz, IInsanity>;

begin
  client := TThriftTest.TClient.Create( FProtocol);
  FTransport.Open;

  {$IFDEF StressTest}
  StressTest( client);
  {$ENDIF StressTest}

  // in-depth exception test
  // (1) do we get an exception at all?
  // (2) do we get the right exception?
  // (3) does the exception contain the expected data?
  StartTestGroup( 'testException', test_Exceptions);
  // case 1: exception type declared in IDL at the function call
  try
    client.testException('Xception');
    Expect( FALSE, 'testException(''Xception''): must trow an exception');
  except
    on e:TXception do begin
      Expect( e.ErrorCode = 1001,       'error code');
      Expect( e.Message_  = 'Xception', 'error message');
      Console.WriteLine( ' = ' + IntToStr(e.ErrorCode) + ', ' + e.Message_ );
    end;
    on e:TTransportException do Expect( FALSE, 'Unexpected : "'+e.ToString+'"');
    on e:Exception do Expect( FALSE, 'Unexpected exception type "'+e.ClassName+'"');
  end;

  // case 2: exception type NOT declared in IDL at the function call
  // this will close the connection
  try
    client.testException('TException');
    Expect( FALSE, 'testException(''TException''): must trow an exception');
  except
    on e:TTransportException do begin
      Console.WriteLine( e.ClassName+' = '+e.Message); // this is what we get
    end;
    on e:TApplicationException do begin
      Console.WriteLine( e.ClassName+' = '+e.Message); // this is what we get
    end;
    on e:TException do Expect( FALSE, 'Unexpected exception type "'+e.ClassName+'"');
    on e:Exception do Expect( FALSE, 'Unexpected exception type "'+e.ClassName+'"');
  end;


  if FTransport.IsOpen then FTransport.Close;
  FTransport.Open;   // re-open connection, server has already closed


  // case 3: no exception
  try
    client.testException('something');
    Expect( TRUE, 'testException(''something''): must not trow an exception');
  except
    on e:TTransportException do Expect( FALSE, 'Unexpected : "'+e.ToString+'"');
    on e:Exception do Expect( FALSE, 'Unexpected exception "'+e.ClassName+'"');
  end;


  // simple things
  StartTestGroup( 'simple Thrift calls', test_BaseTypes);
  client.testVoid();
  Expect( TRUE, 'testVoid()');  // success := no exception

  s := BoolToString( client.testBool(TRUE));
  Expect( s = BoolToString(TRUE),  'testBool(TRUE) = '+s);
  s := BoolToString( client.testBool(FALSE));
  Expect( s = BoolToString(FALSE),  'testBool(FALSE) = '+s);

  s := client.testString('Test');
  Expect( s = 'Test', 'testString(''Test'') = "'+s+'"');

  s := client.testString(HUGE_TEST_STRING);
  Expect( length(s) = length(HUGE_TEST_STRING),
          'testString( length(HUGE_TEST_STRING) = '+IntToStr(Length(HUGE_TEST_STRING))+') '
         +'=> length(result) = '+IntToStr(Length(s)));

  i8 := client.testByte(1);
  Expect( i8 = 1, 'testByte(1) = ' + IntToStr( i8 ));

  i32 := client.testI32(-1);
  Expect( i32 = -1, 'testI32(-1) = ' + IntToStr(i32));

  Console.WriteLine('testI64(-34359738368)');
  i64 := client.testI64(-34359738368);
  Expect( i64 = -34359738368, 'testI64(-34359738368) = ' + IntToStr( i64));

  binOut := PrepareBinaryData( TRUE);
  Console.WriteLine('testBinary('+BytesToHex(binOut)+')');
  try
    binIn := client.testBinary(binOut);
    Expect( Length(binOut) = Length(binIn), 'testBinary(): length '+IntToStr(Length(binOut))+' = '+IntToStr(Length(binIn)));
    i32 := Min( Length(binOut), Length(binIn));
    Expect( CompareMem( binOut, binIn, i32), 'testBinary('+BytesToHex(binOut)+') = '+BytesToHex(binIn));
  except
    on e:TApplicationException do Console.WriteLine('testBinary(): '+e.Message);
    on e:Exception do Expect( FALSE, 'testBinary(): Unexpected exception "'+e.ClassName+'": '+e.Message);
  end;

  Console.WriteLine('testDouble(5.325098235)');
  dub := client.testDouble(5.325098235);
  Expect( abs(dub-5.325098235) < 1e-14, 'testDouble(5.325098235) = ' + FloatToStr( dub));

  // structs
  StartTestGroup( 'testStruct', test_Structs);
  Console.WriteLine('testStruct({''Zero'', 1, -3, -5})');
  o := TXtructImpl.Create;
  o.String_thing := 'Zero';
  o.Byte_thing := 1;
  o.I32_thing := -3;
  o.I64_thing := -5;
  i := client.testStruct(o);
  Expect( i.String_thing = 'Zero', 'i.String_thing = "'+i.String_thing+'"');
  Expect( i.Byte_thing = 1, 'i.Byte_thing = '+IntToStr(i.Byte_thing));
  Expect( i.I32_thing = -3, 'i.I32_thing = '+IntToStr(i.I32_thing));
  Expect( i.I64_thing = -5, 'i.I64_thing = '+IntToStr(i.I64_thing));
  Expect( i.__isset_String_thing, 'i.__isset_String_thing = '+BoolToString(i.__isset_String_thing));
  Expect( i.__isset_Byte_thing, 'i.__isset_Byte_thing = '+BoolToString(i.__isset_Byte_thing));
  Expect( i.__isset_I32_thing, 'i.__isset_I32_thing = '+BoolToString(i.__isset_I32_thing));
  Expect( i.__isset_I64_thing, 'i.__isset_I64_thing = '+BoolToString(i.__isset_I64_thing));

  // nested structs
  StartTestGroup( 'testNest', test_Structs);
  Console.WriteLine('testNest({1, {''Zero'', 1, -3, -5}, 5})');
  o2 := TXtruct2Impl.Create;
  o2.Byte_thing := 1;
  o2.Struct_thing := o;
  o2.I32_thing := 5;
  i2 := client.testNest(o2);
  i := i2.Struct_thing;
  Expect( i.String_thing = 'Zero', 'i.String_thing = "'+i.String_thing+'"');
  Expect( i.Byte_thing = 1,  'i.Byte_thing = '+IntToStr(i.Byte_thing));
  Expect( i.I32_thing = -3,  'i.I32_thing = '+IntToStr(i.I32_thing));
  Expect( i.I64_thing = -5,  'i.I64_thing = '+IntToStr(i.I64_thing));
  Expect( i2.Byte_thing = 1, 'i2.Byte_thing = '+IntToStr(i2.Byte_thing));
  Expect( i2.I32_thing = 5,  'i2.I32_thing = '+IntToStr(i2.I32_thing));
  Expect( i.__isset_String_thing, 'i.__isset_String_thing = '+BoolToString(i.__isset_String_thing));
  Expect( i.__isset_Byte_thing,  'i.__isset_Byte_thing = '+BoolToString(i.__isset_Byte_thing));
  Expect( i.__isset_I32_thing,  'i.__isset_I32_thing = '+BoolToString(i.__isset_I32_thing));
  Expect( i.__isset_I64_thing,  'i.__isset_I64_thing = '+BoolToString(i.__isset_I64_thing));
  Expect( i2.__isset_Byte_thing, 'i2.__isset_Byte_thing');
  Expect( i2.__isset_I32_thing,  'i2.__isset_I32_thing');

  // map<type1,type2>: A map of strictly unique keys to values.
  // Translates to an STL map, Java HashMap, PHP associative array, Python/Ruby dictionary, etc.
  StartTestGroup( 'testMap', test_Containers);
  mapout := TThriftDictionaryImpl<Integer,Integer>.Create;
  for j := 0 to 4 do
  begin
    mapout.AddOrSetValue( j, j - 10);
  end;
  Console.Write('testMap({');
  first := True;
  for key in mapout.Keys do
  begin
    if first
    then first := False
    else Console.Write( ', ' );
    Console.Write( IntToStr( key) + ' => ' + IntToStr( mapout[key]));
  end;
  Console.WriteLine('})');

  mapin := client.testMap( mapout );
  Expect( mapin.Count = mapout.Count, 'testMap: mapin.Count = mapout.Count');
  for j := 0 to 4 do
  begin
    Expect( mapout.ContainsKey(j), 'testMap: mapout.ContainsKey('+IntToStr(j)+') = '+BoolToString(mapout.ContainsKey(j)));
  end;
  for key in mapin.Keys do
  begin
    Expect( mapin[key] = mapout[key], 'testMap: '+IntToStr(key) + ' => ' + IntToStr( mapin[key]));
    Expect( mapin[key] = key - 10, 'testMap: mapin['+IntToStr(key)+'] = '+IntToStr( mapin[key]));
  end;


  // map<type1,type2>: A map of strictly unique keys to values.
  // Translates to an STL map, Java HashMap, PHP associative array, Python/Ruby dictionary, etc.
  StartTestGroup( 'testStringMap', test_Containers);
  strmapout := TThriftDictionaryImpl<string,string>.Create;
  for j := 0 to 4 do
  begin
    strmapout.AddOrSetValue( IntToStr(j), IntToStr(j - 10));
  end;
  Console.Write('testStringMap({');
  first := True;
  for strkey in strmapout.Keys do
  begin
    if first
    then first := False
    else Console.Write( ', ' );
    Console.Write( strkey + ' => ' + strmapout[strkey]);
  end;
  Console.WriteLine('})');

  strmapin := client.testStringMap( strmapout );
  Expect( strmapin.Count = strmapout.Count, 'testStringMap: strmapin.Count = strmapout.Count');
  for j := 0 to 4 do
  begin
    Expect( strmapout.ContainsKey(IntToStr(j)),
            'testStringMap: strmapout.ContainsKey('+IntToStr(j)+') = '
            + BoolToString(strmapout.ContainsKey(IntToStr(j))));
  end;
  for strkey in strmapin.Keys do
  begin
    Expect( strmapin[strkey] = strmapout[strkey], 'testStringMap: '+strkey + ' => ' + strmapin[strkey]);
    Expect( strmapin[strkey] = IntToStr( StrToInt(strkey) - 10), 'testStringMap: strmapin['+strkey+'] = '+strmapin[strkey]);
  end;


  // set<type>: An unordered set of unique elements.
  // Translates to an STL set, Java HashSet, set in Python, etc.
  // Note: PHP does not support sets, so it is treated similar to a List
  StartTestGroup( 'testSet', test_Containers);
  setout := THashSetImpl<Integer>.Create;
  for j := -2 to 2 do
  begin
    setout.Add( j );
  end;
  Console.Write('testSet({');
  first := True;
  for j in setout do
  begin
    if first
    then first := False
    else Console.Write(', ');
    Console.Write(IntToStr( j));
  end;
  Console.WriteLine('})');

  setin := client.testSet(setout);
  Expect( setin.Count = setout.Count, 'testSet: setin.Count = setout.Count');
  Expect( setin.Count = 5, 'testSet: setin.Count = '+IntToStr(setin.Count));
  for j := -2 to 2 do // unordered, we can't rely on the order => test for known elements only
  begin
    Expect( setin.Contains(j), 'testSet: setin.Contains('+IntToStr(j)+') => '+BoolToString(setin.Contains(j)));
  end;

  // list<type>: An ordered list of elements.
  // Translates to an STL vector, Java ArrayList, native arrays in scripting languages, etc.
  StartTestGroup( 'testList', test_Containers);
  listout := TThriftListImpl<Integer>.Create;
  listout.Add( +1);
  listout.Add( -2);
  listout.Add( +3);
  listout.Add( -4);
  listout.Add( 0);
  Console.Write('testList({');
  first := True;
  for j in listout do
    begin
    if first
    then first := False
    else Console.Write(', ');
    Console.Write(IntToStr( j));
  end;
  Console.WriteLine('})');

  listin := client.testList(listout);
  Expect( listin.Count = listout.Count, 'testList: listin.Count = listout.Count');
  Expect( listin.Count = 5, 'testList: listin.Count = '+IntToStr(listin.Count));
  Expect( listin[0] = +1, 'listin[0] = '+IntToStr( listin[0]));
  Expect( listin[1] = -2, 'listin[1] = '+IntToStr( listin[1]));
  Expect( listin[2] = +3, 'listin[2] = '+IntToStr( listin[2]));
  Expect( listin[3] = -4, 'listin[3] = '+IntToStr( listin[3]));
  Expect( listin[4] = 0,  'listin[4] = '+IntToStr( listin[4]));

  // enums
  ret := client.testEnum(TNumberz.ONE);
  Expect( ret = TNumberz.ONE, 'testEnum(ONE) = '+IntToStr(Ord(ret)));

  ret := client.testEnum(TNumberz.TWO);
  Expect( ret = TNumberz.TWO, 'testEnum(TWO) = '+IntToStr(Ord(ret)));

  ret := client.testEnum(TNumberz.THREE);
  Expect( ret = TNumberz.THREE, 'testEnum(THREE) = '+IntToStr(Ord(ret)));

  ret := client.testEnum(TNumberz.FIVE);
  Expect( ret = TNumberz.FIVE, 'testEnum(FIVE) = '+IntToStr(Ord(ret)));

  ret := client.testEnum(TNumberz.EIGHT);
  Expect( ret = TNumberz.EIGHT, 'testEnum(EIGHT) = '+IntToStr(Ord(ret)));


  // typedef
  uid := client.testTypedef(309858235082523);
  Expect( uid = 309858235082523, 'testTypedef(309858235082523) = '+IntToStr(uid));


  // maps of maps
  StartTestGroup( 'testMapMap(1)', test_Containers);
  mm := client.testMapMap(1);
  Console.Write(' = {');
  for key in mm.Keys do
  begin
    Console.Write( IntToStr( key) + ' => {');
    m2 := mm[key];
    for  k2 in m2.Keys do
    begin
      Console.Write( IntToStr( k2) + ' => ' + IntToStr( m2[k2]) + ', ');
    end;
    Console.Write('}, ');
  end;
  Console.WriteLine('}');

  // verify result data
  Expect( mm.Count = 2, 'mm.Count = '+IntToStr(mm.Count));
  pos := mm[4];
  neg := mm[-4];
  for j := 1 to 4 do
  begin
    Expect( pos[j]  = j,  'pos[j]  = '+IntToStr(pos[j]));
    Expect( neg[-j] = -j, 'neg[-j] = '+IntToStr(neg[-j]));
  end;



  // insanity
  StartTestGroup( 'testInsanity', test_Structs);
  insane := TInsanityImpl.Create;
  insane.UserMap := TThriftDictionaryImpl<TNumberz, Int64>.Create;
  insane.UserMap.AddOrSetValue( TNumberz.FIVE, 5000);
  truck := TXtructImpl.Create;
  truck.String_thing := 'Truck';
  truck.Byte_thing := 8;
  truck.I32_thing := 8;
  truck.I64_thing := 8;
  insane.Xtructs := TThriftListImpl<IXtruct>.Create;
  insane.Xtructs.Add( truck );
  whoa := client.testInsanity( insane );
  Console.Write(' = {');
  for key64 in whoa.Keys do
  begin
    val := whoa[key64];
    Console.Write( IntToStr( key64) + ' => {');
    for k2_2 in val.Keys do
    begin
      v2 := val[k2_2];
      Console.Write( IntToStr( Integer( k2_2)) + ' => {');
      userMap := v2.UserMap;
      Console.Write('{');
      if userMap <> nil then
      begin
        for k3 in userMap.Keys do
        begin
          Console.Write( IntToStr( Integer( k3)) + ' => ' + IntToStr( userMap[k3]) + ', ');
        end;
      end else
      begin
        Console.Write('null');
      end;
      Console.Write('}, ');
      xtructs := v2.Xtructs;
      Console.Write('{');

      if xtructs <> nil then
      begin
        for x in xtructs do
        begin
          Console.Write('{"' + x.String_thing + '", ' +
            IntToStr( x.Byte_thing) + ', ' +
            IntToStr( x.I32_thing) + ', ' +
            IntToStr( x.I32_thing) + '}, ');
        end;
      end else
      begin
        Console.Write('null');
      end;
      Console.Write('}');
      Console.Write('}, ');
    end;
    Console.Write('}, ');
  end;
  Console.WriteLine('}');

  // verify result data
  Expect( whoa.Count = 2, 'whoa.Count = '+IntToStr(whoa.Count));
  //
  first_map  := whoa[1];
  second_map := whoa[2];
  Expect( first_map.Count = 2, 'first_map.Count = '+IntToStr(first_map.Count));
  Expect( second_map.Count = 1, 'second_map.Count = '+IntToStr(second_map.Count));
  //
  looney := second_map[TNumberz.SIX];
  Expect( Assigned(looney), 'Assigned(looney) = '+BoolToString(Assigned(looney)));
  Expect( not looney.__isset_UserMap, 'looney.__isset_UserMap = '+BoolToString(looney.__isset_UserMap));
  Expect( not looney.__isset_Xtructs, 'looney.__isset_Xtructs = '+BoolToString(looney.__isset_Xtructs));
  //
  for ret in [TNumberz.TWO, TNumberz.THREE] do begin
    crazy := first_map[ret];
    Console.WriteLine('first_map['+intToStr(Ord(ret))+']');

    Expect( crazy.__isset_UserMap, 'crazy.__isset_UserMap = '+BoolToString(crazy.__isset_UserMap));
    Expect( crazy.__isset_Xtructs, 'crazy.__isset_Xtructs = '+BoolToString(crazy.__isset_Xtructs));

    Expect( crazy.UserMap.Count = 2, 'crazy.UserMap.Count = '+IntToStr(crazy.UserMap.Count));
    Expect( crazy.UserMap[TNumberz.FIVE] = 5, 'crazy.UserMap[TNumberz.FIVE] = '+IntToStr(crazy.UserMap[TNumberz.FIVE]));
    Expect( crazy.UserMap[TNumberz.EIGHT] = 8, 'crazy.UserMap[TNumberz.EIGHT] = '+IntToStr(crazy.UserMap[TNumberz.EIGHT]));

    Expect( crazy.Xtructs.Count = 2, 'crazy.Xtructs.Count = '+IntToStr(crazy.Xtructs.Count));
    goodbye := crazy.Xtructs[0];  // lists are ordered, so we are allowed to assume this order
      hello   := crazy.Xtructs[1];

    Expect( goodbye.String_thing = 'Goodbye4', 'goodbye.String_thing = "'+goodbye.String_thing+'"');
    Expect( goodbye.Byte_thing = 4, 'goodbye.Byte_thing = '+IntToStr(goodbye.Byte_thing));
    Expect( goodbye.I32_thing = 4, 'goodbye.I32_thing = '+IntToStr(goodbye.I32_thing));
    Expect( goodbye.I64_thing = 4, 'goodbye.I64_thing = '+IntToStr(goodbye.I64_thing));
    Expect( goodbye.__isset_String_thing, 'goodbye.__isset_String_thing = '+BoolToString(goodbye.__isset_String_thing));
    Expect( goodbye.__isset_Byte_thing, 'goodbye.__isset_Byte_thing = '+BoolToString(goodbye.__isset_Byte_thing));
    Expect( goodbye.__isset_I32_thing, 'goodbye.__isset_I32_thing = '+BoolToString(goodbye.__isset_I32_thing));
    Expect( goodbye.__isset_I64_thing, 'goodbye.__isset_I64_thing = '+BoolToString(goodbye.__isset_I64_thing));

    Expect( hello.String_thing = 'Hello2', 'hello.String_thing = "'+hello.String_thing+'"');
    Expect( hello.Byte_thing = 2, 'hello.Byte_thing = '+IntToStr(hello.Byte_thing));
    Expect( hello.I32_thing = 2, 'hello.I32_thing = '+IntToStr(hello.I32_thing));
    Expect( hello.I64_thing = 2, 'hello.I64_thing = '+IntToStr(hello.I64_thing));
    Expect( hello.__isset_String_thing, 'hello.__isset_String_thing = '+BoolToString(hello.__isset_String_thing));
    Expect( hello.__isset_Byte_thing, 'hello.__isset_Byte_thing = '+BoolToString(hello.__isset_Byte_thing));
    Expect( hello.__isset_I32_thing, 'hello.__isset_I32_thing = '+BoolToString(hello.__isset_I32_thing));
    Expect( hello.__isset_I64_thing, 'hello.__isset_I64_thing = '+BoolToString(hello.__isset_I64_thing));
  end;


  // multi args
  StartTestGroup( 'testMulti', test_BaseTypes);
  arg0 := 1;
  arg1 := 2;
  arg2 := High(Int64);
  arg3 := TThriftDictionaryImpl<SmallInt, string>.Create;
  arg3.AddOrSetValue( 1, 'one');
  arg4 := TNumberz.FIVE;
  arg5 := 5000000;
  Console.WriteLine('Test Multi(' + IntToStr( arg0) + ',' +
    IntToStr( arg1) + ',' + IntToStr( arg2) + ',' +
    arg3.ToString + ',' + IntToStr( Integer( arg4)) + ',' +
      IntToStr( arg5) + ')');

  i := client.testMulti( arg0, arg1, arg2, arg3, arg4, arg5);
  Expect( i.String_thing = 'Hello2', 'testMulti: i.String_thing = "'+i.String_thing+'"');
  Expect( i.Byte_thing = arg0, 'testMulti: i.Byte_thing = '+IntToStr(i.Byte_thing));
  Expect( i.I32_thing = arg1, 'testMulti: i.I32_thing = '+IntToStr(i.I32_thing));
  Expect( i.I64_thing = arg2, 'testMulti: i.I64_thing = '+IntToStr(i.I64_thing));
  Expect( i.__isset_String_thing, 'testMulti: i.__isset_String_thing = '+BoolToString(i.__isset_String_thing));
  Expect( i.__isset_Byte_thing, 'testMulti: i.__isset_Byte_thing = '+BoolToString(i.__isset_Byte_thing));
  Expect( i.__isset_I32_thing, 'testMulti: i.__isset_I32_thing = '+BoolToString(i.__isset_I32_thing));
  Expect( i.__isset_I64_thing, 'testMulti: i.__isset_I64_thing = '+BoolToString(i.__isset_I64_thing));

  // multi exception
  StartTestGroup( 'testMultiException(1)', test_Exceptions);
  try
    i := client.testMultiException( 'need more pizza', 'run out of beer');
    Expect( i.String_thing = 'run out of beer', 'i.String_thing = "' +i.String_thing+ '"');
    Expect( i.__isset_String_thing, 'i.__isset_String_thing = '+BoolToString(i.__isset_String_thing));
    { this is not necessarily true, these fields are default-serialized
    Expect( not i.__isset_Byte_thing, 'i.__isset_Byte_thing = '+BoolToString(i.__isset_Byte_thing));
    Expect( not i.__isset_I32_thing, 'i.__isset_I32_thing = '+BoolToString(i.__isset_I32_thing));
    Expect( not i.__isset_I64_thing, 'i.__isset_I64_thing = '+BoolToString(i.__isset_I64_thing));
    }
  except
    on e:Exception do Expect( FALSE, 'Unexpected exception "'+e.ClassName+'"');
  end;

  StartTestGroup( 'testMultiException(Xception)', test_Exceptions);
  try
    i := client.testMultiException( 'Xception', 'second test');
    Expect( FALSE, 'testMultiException(''Xception''): must trow an exception');
  except
    on x:TXception do begin
      Expect( x.__isset_ErrorCode, 'x.__isset_ErrorCode = '+BoolToString(x.__isset_ErrorCode));
      Expect( x.__isset_Message_,  'x.__isset_Message_ = '+BoolToString(x.__isset_Message_));
      Expect( x.ErrorCode = 1001, 'x.ErrorCode = '+IntToStr(x.ErrorCode));
      Expect( x.Message_ = 'This is an Xception', 'x.Message = "'+x.Message_+'"');
    end;
    on e:Exception do Expect( FALSE, 'Unexpected exception "'+e.ClassName+'"');
  end;

  StartTestGroup( 'testMultiException(Xception2)', test_Exceptions);
  try
    i := client.testMultiException( 'Xception2', 'third test');
    Expect( FALSE, 'testMultiException(''Xception2''): must trow an exception');
  except
    on x:TXception2 do begin
      Expect( x.__isset_ErrorCode, 'x.__isset_ErrorCode = '+BoolToString(x.__isset_ErrorCode));
      Expect( x.__isset_Struct_thing,  'x.__isset_Struct_thing = '+BoolToString(x.__isset_Struct_thing));
      Expect( x.ErrorCode = 2002, 'x.ErrorCode = '+IntToStr(x.ErrorCode));
      Expect( x.Struct_thing.String_thing = 'This is an Xception2', 'x.Struct_thing.String_thing = "'+x.Struct_thing.String_thing+'"');
      Expect( x.Struct_thing.__isset_String_thing, 'x.Struct_thing.__isset_String_thing = '+BoolToString(x.Struct_thing.__isset_String_thing));
      { this is not necessarily true, these fields are default-serialized
      Expect( not x.Struct_thing.__isset_Byte_thing, 'x.Struct_thing.__isset_Byte_thing = '+BoolToString(x.Struct_thing.__isset_Byte_thing));
      Expect( not x.Struct_thing.__isset_I32_thing, 'x.Struct_thing.__isset_I32_thing = '+BoolToString(x.Struct_thing.__isset_I32_thing));
      Expect( not x.Struct_thing.__isset_I64_thing, 'x.Struct_thing.__isset_I64_thing = '+BoolToString(x.Struct_thing.__isset_I64_thing));
      }
    end;
    on e:Exception do Expect( FALSE, 'Unexpected exception "'+e.ClassName+'"');
  end;


  // oneway functions
  StartTestGroup( 'Test Oneway(1)', test_Unknown);
  client.testOneway(1);
  Expect( TRUE, 'Test Oneway(1)');  // success := no exception

  // call time
  {$IFDEF PerfTest}
  StartTestGroup( 'Test Calltime()');
  StartTick := GetTickCount;
  for k := 0 to 1000 - 1 do
  begin
    client.testVoid();
  end;
  Console.WriteLine(' = ' + FloatToStr( (GetTickCount - StartTick) / 1000 ) + ' ms a testVoid() call' );
  {$ENDIF PerfTest}

  // no more tests here
  StartTestGroup( '', test_Unknown);
end;


{$IFDEF StressTest}
procedure TClientThread.StressTest(const client : TThriftTest.Iface);
begin
  while TRUE do begin
    try
      if not FTransport.IsOpen then FTransport.Open;   // re-open connection, server has already closed
      try
        client.testString('Test');
        Write('.');
      finally
        if FTransport.IsOpen then FTransport.Close;
      end;
    except
      on e:Exception do Writeln(#10+e.message);
    end;
  end;
end;
{$ENDIF}


function TClientThread.PrepareBinaryData( aRandomDist : Boolean = FALSE) : TBytes;
var i, nextPos : Integer;
begin
  SetLength( result, $100);
  ASSERT( Low(result) = 0);

  // linear distribution, unless random is requested
  if not aRandomDist then begin
    for i := Low(result) to High(result) do begin
      result[i] := i;
    end;
    Exit;
  end;

  // random distribution of all 256 values
  FillChar( result[0], Length(result) * SizeOf(result[0]), $0);
  i := 1;
  while i < Length(result) do begin
    nextPos := Byte( Random($100));
    if result[nextPos] = 0 then begin  // unused?
      result[nextPos] := i;
      Inc(i);
    end;
  end;
end;


procedure TClientThread.JSONProtocolReadWriteTest;
// Tests only then read/write procedures of the JSON protocol
// All tests succeed, if we can read what we wrote before
// Note that passing this test does not imply, that our JSON is really compatible to what
// other clients or servers expect as the real JSON. This is beyond the scope of this test.
var prot   : IProtocol;
    stm    : TStringStream;
    list   : IList;
    binary, binRead : TBytes;
    i,iErr : Integer;
const
  TEST_SHORT   = ShortInt( $FE);
  TEST_SMALL   = SmallInt( $FEDC);
  TEST_LONG    = LongInt( $FEDCBA98);
  TEST_I64     = Int64( $FEDCBA9876543210);
  TEST_DOUBLE  = -1.234e-56;
  DELTA_DOUBLE = TEST_DOUBLE * 1e-14;
  TEST_STRING  = 'abc-'#$00E4#$00f6#$00fc; // german umlauts (en-us: "funny chars")
  // Test THRIFT-2336 and THRIFT-3404 with U+1D11E (G Clef symbol) and 'Русское Название';
  G_CLEF_AND_CYRILLIC_TEXT = #$1d11e' '#$0420#$0443#$0441#$0441#$043a#$043e#$0435' '#$041d#$0430#$0437#$0432#$0430#$043d#$0438#$0435;
  G_CLEF_AND_CYRILLIC_JSON = '"\ud834\udd1e \u0420\u0443\u0441\u0441\u043a\u043e\u0435 \u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435"';
  // test both possible solidus encodings
  SOLIDUS_JSON_DATA = '"one/two\/three"';
  SOLIDUS_EXCPECTED = 'one/two/three';
begin
  stm  := TStringStream.Create;
  try
    StartTestGroup( 'JsonProtocolTest', test_Unknown);

    // prepare binary data
    binary := PrepareBinaryData( FALSE);

    // output setup
    prot := TJSONProtocolImpl.Create(
              TStreamTransportImpl.Create(
                nil, TThriftStreamAdapterDelphi.Create( stm, FALSE)));

    // write
    prot.WriteListBegin( TListImpl.Create( TType.String_, 9));
    prot.WriteBool( TRUE);
    prot.WriteBool( FALSE);
    prot.WriteByte( TEST_SHORT);
    prot.WriteI16( TEST_SMALL);
    prot.WriteI32( TEST_LONG);
    prot.WriteI64( TEST_I64);
    prot.WriteDouble( TEST_DOUBLE);
    prot.WriteString( TEST_STRING);
    prot.WriteBinary( binary);
    prot.WriteListEnd;

    // input setup
    Expect( stm.Position = stm.Size, 'Stream position/length after write');
    stm.Position := 0;
    prot := TJSONProtocolImpl.Create(
              TStreamTransportImpl.Create(
                TThriftStreamAdapterDelphi.Create( stm, FALSE), nil));

    // read and compare
    list := prot.ReadListBegin;
    Expect( list.ElementType = TType.String_, 'list element type');
    Expect( list.Count = 9, 'list element count');
    Expect( prot.ReadBool, 'WriteBool/ReadBool: TRUE');
    Expect( not prot.ReadBool, 'WriteBool/ReadBool: FALSE');
    Expect( prot.ReadByte   = TEST_SHORT,  'WriteByte/ReadByte');
    Expect( prot.ReadI16    = TEST_SMALL,  'WriteI16/ReadI16');
    Expect( prot.ReadI32    = TEST_LONG,   'WriteI32/ReadI32');
    Expect( prot.ReadI64    = TEST_I64,    'WriteI64/ReadI64');
    Expect( abs(prot.ReadDouble-TEST_DOUBLE) < abs(DELTA_DOUBLE), 'WriteDouble/ReadDouble');
    Expect( prot.ReadString = TEST_STRING, 'WriteString/ReadString');
    binRead := prot.ReadBinary;
    prot.ReadListEnd;

    // test binary data
    Expect( Length(binary) = Length(binRead), 'Binary data length check');
    iErr := -1;
    for i := Low(binary) to High(binary) do begin
      if binary[i] <> binRead[i] then begin
        iErr := i;
        Break;
      end;
    end;
    if iErr < 0
    then Expect( TRUE,  'Binary data check ('+IntToStr(Length(binary))+' Bytes)')
    else Expect( FALSE, 'Binary data check at offset '+IntToStr(iErr));

    Expect( stm.Position = stm.Size, 'Stream position after read');


    // Solidus can be encoded in two ways. Make sure we can read both
    stm.Position := 0;
    stm.Size     := 0;
    stm.WriteString(SOLIDUS_JSON_DATA);
    stm.Position := 0;
    prot := TJSONProtocolImpl.Create(
              TStreamTransportImpl.Create(
                TThriftStreamAdapterDelphi.Create( stm, FALSE), nil));
    Expect( prot.ReadString = SOLIDUS_EXCPECTED, 'Solidus encoding');


    // Widechars should work too. Do they?
    // After writing, we ensure that we are able to read it back
    // We can't assume hex-encoding, since (nearly) any Unicode char is valid JSON
    stm.Position := 0;
    stm.Size     := 0;
    prot := TJSONProtocolImpl.Create(
              TStreamTransportImpl.Create(
                nil, TThriftStreamAdapterDelphi.Create( stm, FALSE)));
    prot.WriteString( G_CLEF_AND_CYRILLIC_TEXT);
    stm.Position := 0;
    prot := TJSONProtocolImpl.Create(
              TStreamTransportImpl.Create(
                TThriftStreamAdapterDelphi.Create( stm, FALSE), nil));
    Expect( prot.ReadString = G_CLEF_AND_CYRILLIC_TEXT, 'Writing JSON with chars > 8 bit');

    // Widechars should work with hex-encoding too. Do they?
    stm.Position := 0;
    stm.Size     := 0;
    stm.WriteString( G_CLEF_AND_CYRILLIC_JSON);
    stm.Position := 0;
    prot := TJSONProtocolImpl.Create(
              TStreamTransportImpl.Create(
                TThriftStreamAdapterDelphi.Create( stm, FALSE), nil));
    Expect( prot.ReadString = G_CLEF_AND_CYRILLIC_TEXT, 'Reading JSON with chars > 8 bit');


  finally
    stm.Free;
    prot := nil;  //-> Release
    StartTestGroup( '', test_Unknown);  // no more tests here
  end;
end;


procedure TClientThread.StartTestGroup( const aGroup : string; const aTest : TTestGroup);
begin
  FTestGroup := aGroup;
  FCurrentTest := aTest;

  Include( FExecuted, aTest);

  if FTestGroup <> '' then begin
    Console.WriteLine('');
    Console.WriteLine( aGroup+' tests');
    Console.WriteLine( StringOfChar('-',60));
  end;
end;


procedure TClientThread.Expect( aTestResult : Boolean; const aTestInfo : string);
begin
  if aTestResult  then begin
    Inc(FSuccesses);
    Console.WriteLine( aTestInfo+': passed');
  end
  else begin
    FErrors.Add( FTestGroup+': '+aTestInfo);
    Include( FFailed, FCurrentTest);
    Console.WriteLine( aTestInfo+': *** FAILED ***');

    // We have a failed test!
    // -> issue DebugBreak ONLY if a debugger is attached,
    // -> unhandled DebugBreaks would cause Windows to terminate the app otherwise
    if IsDebuggerPresent
    then {$IFDEF CPUX64} DebugBreak {$ELSE} asm int 3 end {$ENDIF};
  end;
end;


procedure TClientThread.ReportResults;
var nTotal : Integer;
    sLine : string;
begin
  // prevent us from stupid DIV/0 errors
  nTotal := FSuccesses + FErrors.Count;
  if nTotal = 0 then begin
    Console.WriteLine('No results logged');
    Exit;
  end;

  Console.WriteLine('');
  Console.WriteLine( StringOfChar('=',60));
  Console.WriteLine( IntToStr(nTotal)+' tests performed');
  Console.WriteLine( IntToStr(FSuccesses)+' tests succeeded ('+IntToStr(round(100*FSuccesses/nTotal))+'%)');
  Console.WriteLine( IntToStr(FErrors.Count)+' tests failed ('+IntToStr(round(100*FErrors.Count/nTotal))+'%)');
  Console.WriteLine( StringOfChar('=',60));
  if FErrors.Count > 0 then begin
    Console.WriteLine('FAILED TESTS:');
    for sLine in FErrors do Console.WriteLine('- '+sLine);
    Console.WriteLine( StringOfChar('=',60));
    InterlockedIncrement( ExitCode);  // return <> 0 on errors
  end;
  Console.WriteLine('');
end;


function TClientThread.CalculateExitCode : Byte;
var test : TTestGroup;
begin
  result := EXITCODE_SUCCESS;
  for test := Low(TTestGroup) to High(TTestGroup) do begin
    if (test in FFailed) or not (test in FExecuted)
    then result := result or MAP_FAILURES_TO_EXITCODE_BITS[test];
  end;
end;


constructor TClientThread.Create( const ATransport: ITransport; const AProtocol : IProtocol; ANumIteration: Integer);
begin
  inherited Create( True );
  FNumIteration := ANumIteration;
  FTransport := ATransport;
  FProtocol := AProtocol;
  FConsole := TThreadConsole.Create( Self );
  FCurrentTest := test_Unknown;

  // error list: keep correct order, allow for duplicates
  FErrors := TStringList.Create;
  FErrors.Sorted := FALSE;
  FErrors.Duplicates := dupAccept;
end;

destructor TClientThread.Destroy;
begin
  FreeAndNil( FConsole);
  FreeAndNil( FErrors);
  inherited;
end;

procedure TClientThread.Execute;
var
  i : Integer;
  proc : TThreadProcedure;
begin
  // perform all tests
  try
    JSONProtocolReadWriteTest;
    for i := 0 to FNumIteration - 1 do
    begin
      ClientTest;
    end;
  except
    on e:Exception do Expect( FALSE, 'unexpected exception: "'+e.message+'"');
  end;

  // report the outcome
  ReportResults;
  SetReturnValue( CalculateExitCode);

  // shutdown
  proc := procedure
  begin
    if FTransport <> nil then
    begin
      FTransport.Close;
      FTransport := nil;
    end;
  end;

  Synchronize( proc );
end;


{ TThreadConsole }

constructor TThreadConsole.Create(AThread: TThread);
begin
  inherited Create;
  FThread := AThread;
end;

procedure TThreadConsole.Write(const S: string);
var
  proc : TThreadProcedure;
begin
  proc := procedure
  begin
    Console.Write( S );
  end;
  TThread.Synchronize( FThread, proc);
end;

procedure TThreadConsole.WriteLine(const S: string);
var
  proc : TThreadProcedure;
begin
  proc := procedure
  begin
    Console.WriteLine( S );
  end;
  TThread.Synchronize( FThread, proc);
end;

initialization
begin
  TTestClient.FNumIteration := 1;
  TTestClient.FNumThread := 1;
end;

end.
