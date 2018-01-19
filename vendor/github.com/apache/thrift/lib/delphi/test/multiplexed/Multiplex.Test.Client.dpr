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


program Multiplex.Test.Client;

{$APPTYPE CONSOLE}

uses
  SysUtils,
  Multiplex.Client.Main in 'Multiplex.Client.Main.pas',
  Thrift in '..\..\src\Thrift.pas',
  Thrift.Socket in '..\..\src\Thrift.Socket.pas',
  Thrift.Transport in '..\..\src\Thrift.Transport.pas',
  Thrift.Transport.Pipes in '..\..\src\Thrift.Transport.Pipes.pas',
  Thrift.Protocol in '..\..\src\Thrift.Protocol.pas',
  Thrift.Protocol.Multiplex in '..\..\src\Thrift.Protocol.Multiplex.pas',
  Thrift.Collections in '..\..\src\Thrift.Collections.pas',
  Thrift.Server in '..\..\src\Thrift.Server.pas',
  Thrift.Stream in '..\..\src\Thrift.Stream.pas',
  Thrift.Console in '..\..\src\Thrift.Console.pas',
  Thrift.TypeRegistry in '..\..\src\Thrift.TypeRegistry.pas',
  Thrift.Utils in '..\..\src\Thrift.Utils.pas';

var
  nParamCount : Integer;
  args : array of string;
  i : Integer;
  arg : string;
  s : string;

begin
  try
    Writeln( 'Multiplex TestClient '+Thrift.Version);
    nParamCount := ParamCount;
    SetLength( args, nParamCount);
    for i := 1 to nParamCount do
    begin
      arg := ParamStr( i );
      args[i-1] := arg;
    end;
    TTestClient.Execute( args );
    Readln;
  except
    on E: Exception do begin
      Writeln(E.ClassName, ': ', E.Message);
      ExitCode := $FFFF;
    end;
  end;
end.

