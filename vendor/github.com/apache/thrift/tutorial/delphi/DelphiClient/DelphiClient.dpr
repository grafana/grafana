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
program DelphiClient;

{$APPTYPE CONSOLE}
{$D 'Copyright (c) 2012 The Apache Software Foundation'}

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
  DelphiTutorialClient = class
  public
    class procedure Main;
  end;


//--- DelphiTutorialClient ---------------------------------------


class procedure DelphiTutorialClient.Main;
var transport : ITransport;
    protocol  : IProtocol;
    client    : TCalculator.Iface;
    work      : IWork;
    sum, quotient, diff : Integer;
    log       : ISharedStruct;
begin
  try
    transport := TSocketImpl.Create( 'localhost', 9090);
    protocol  := TBinaryProtocolImpl.Create( transport);
    client    := TCalculator.TClient.Create( protocol);

    transport.Open;

    client.ping;
    Console.WriteLine('ping()');

    sum := client.add( 1, 1);
    Console.WriteLine( Format( '1+1=%d', [sum]));

    work := TWorkImpl.Create;

    work.Op   := TOperation.DIVIDE;
    work.Num1 := 1;
    work.Num2 := 0;
    try
      quotient := client.calculate(1, work);
      Console.WriteLine( 'Whoa we can divide by 0');
      Console.WriteLine( Format('1/0=%d',[quotient]));
    except
      on io: TInvalidOperation
      do Console.WriteLine( 'Invalid operation: ' + io.Why);
    end;

    work.Op   := TOperation.SUBTRACT;
    work.Num1 := 15;
    work.Num2 := 10;
    try
      diff := client.calculate( 1, work);
      Console.WriteLine( Format('15-10=%d', [diff]));
    except
      on io: TInvalidOperation
      do Console.WriteLine( 'Invalid operation: ' + io.Why);
    end;

    log := client.getStruct(1);
    Console.WriteLine( Format( 'Check log: %s', [log.Value]));

    transport.Close();

  except
    on e : Exception
    do Console.WriteLine( e.ClassName+': '+e.Message);
  end;
end;


begin
  try
    DelphiTutorialClient.Main;
  except
    on E: Exception do
      Writeln(E.ClassName, ': ', E.Message);
  end;
end.
