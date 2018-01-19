(*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *)
program DelphiServer;

{$APPTYPE CONSOLE}
{$D 'Copyright (c) 2012 The Apache Software Foundation'}

{$Q+}     // throws exceptions on numeric overflows

uses
  SysUtils,
  Generics.Collections,
  Thrift in '..\..\..\lib\delphi\src\Thrift.pas',
  Thrift.Collections in '..\..\..\lib\delphi\src\Thrift.Collections.pas',
  Thrift.Console in '..\..\..\lib\delphi\src\Thrift.Console.pas',
  Thrift.Utils in '..\..\..\lib\delphi\src\Thrift.Utils.pas',
  Thrift.Stream in '..\..\..\lib\delphi\src\Thrift.Stream.pas',
  Thrift.Protocol in '..\..\..\lib\delphi\src\Thrift.Protocol.pas',
  Thrift.Server in '..\..\..\lib\delphi\src\Thrift.Server.pas',
  Thrift.Transport in '..\..\..\lib\delphi\src\Thrift.Transport.pas',
  Shared in '..\..\gen-delphi\Shared.pas',
  Tutorial in '..\..\gen-delphi\Tutorial.pas';


type
  TCalculatorHandler = class( TInterfacedObject, TCalculator.Iface)
  protected
    FLog : TDictionary< Integer, ISharedStruct>;

    // TSharedService.Iface
    function  getStruct(key: Integer): ISharedStruct;

    // TCalculator.Iface
    procedure ping();
    function  add(num1: Integer; num2: Integer): Integer;
    function  calculate(logid: Integer; const w: IWork): Integer;
    procedure zip();

  public
    constructor Create;
    destructor Destroy;  override;

  end;

  DelphiTutorialServer = class
  public
    class procedure Main;
  end;


//--- TCalculatorHandler ---------------------------------------------------


constructor TCalculatorHandler.Create;
begin
  inherited Create;
  FLog := TDictionary< Integer, ISharedStruct>.Create();
end;


destructor TCalculatorHandler.Destroy;
begin
  try
    FreeAndNil( FLog);
  finally
    inherited Destroy;
  end;
end;


procedure TCalculatorHandler.ping;
begin
  Console.WriteLine( 'ping()');
end;


function TCalculatorHandler.add(num1: Integer; num2: Integer): Integer;
begin
  Console.WriteLine( Format( 'add( %d, %d)', [num1, num2]));
  result := num1 + num2;
end;


function TCalculatorHandler.calculate(logid: Integer; const w: IWork): Integer;
var entry : ISharedStruct;
begin
  try
    Console.WriteLine( Format('calculate( %d, [%d,%d,%d])', [logid, Ord(w.Op), w.Num1, w.Num2]));

    case w.Op of
      TOperation.ADD      :  result := w.Num1 + w.Num2;
      TOperation.SUBTRACT :  result := w.Num1 - w.Num2;
      TOperation.MULTIPLY :  result := w.Num1 * w.Num2;
      TOperation.DIVIDE   :  result := Round( w.Num1 / w.Num2);
    else
      raise TInvalidOperation.Create( Ord(w.Op), 'Unknown operation');
    end;

  except
    on e:Thrift.TException do raise;  // let Thrift Exceptions pass through
    on e:Exception do raise TInvalidOperation.Create( Ord(w.Op), e.Message);  // repackage all other
  end;

  entry := TSharedStructImpl.Create;
  entry.Key   := logid;
  entry.Value := IntToStr( result);
  FLog.AddOrSetValue( logid, entry);
end;


function TCalculatorHandler.getStruct(key: Integer): ISharedStruct;
begin
  Console.WriteLine( Format( 'getStruct(%d)', [key]));
  result := FLog[key];
end;


procedure TCalculatorHandler.zip;
begin
  Console.WriteLine( 'zip()');
end;


//--- DelphiTutorialServer ----------------------------------------------------------------------


class procedure DelphiTutorialServer.Main;
var handler   : TCalculator.Iface;
    processor : IProcessor;
    transport : IServerTransport;
    server    : IServer;
begin
  try
    handler   := TCalculatorHandler.Create;
    processor := TCalculator.TProcessorImpl.Create( handler);
    transport := TServerSocketImpl.Create( 9090);
    server    := TSimpleServer.Create( processor, transport);

    Console.WriteLine( 'Starting the server...');
    server.Serve();

  except
    on e: Exception do Console.WriteLine( e.Message);
  end;

  Console.WriteLine('done.');
end;


begin
  try
    DelphiTutorialServer.Main;
  except
    on E: Exception do
      Writeln(E.ClassName, ': ', E.Message);
  end;
end.
