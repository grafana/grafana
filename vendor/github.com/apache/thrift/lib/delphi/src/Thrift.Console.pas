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

unit Thrift.Console;

interface

uses Classes;

type
  TThriftConsole = class
  public
    procedure Write( const S: string); virtual;
    procedure WriteLine( const S: string); virtual;
  end;

  TGUIConsole = class( TThriftConsole )
  private
    FLineBreak : Boolean;
    FMemo : TStrings;

    procedure InternalWrite( const S: string; bWriteLine: Boolean);
  public
    procedure Write( const S: string); override;
    procedure WriteLine( const S: string); override;
    constructor Create( AMemo: TStrings);
  end;

function Console: TThriftConsole;
procedure ChangeConsole( AConsole: TThriftConsole );
procedure RestoreConsoleToDefault;

implementation

var
  FDefaultConsole : TThriftConsole;
  FConsole : TThriftConsole;

function Console: TThriftConsole;
begin
  Result := FConsole;
end;

{ TThriftConsole }

procedure TThriftConsole.Write(const S: string);
begin
  System.Write( S );
end;

procedure TThriftConsole.WriteLine(const S: string);
begin
  System.Writeln( S );
end;

procedure ChangeConsole( AConsole: TThriftConsole );
begin
  FConsole := AConsole;
end;

procedure RestoreConsoleToDefault;
begin
  FConsole := FDefaultConsole;
end;

{ TGUIConsole }

constructor TGUIConsole.Create( AMemo: TStrings);
begin
  inherited Create;
  FMemo := AMemo;
  FLineBreak := True;
end;

procedure TGUIConsole.InternalWrite(const S: string; bWriteLine: Boolean);
var
  idx : Integer;
begin
  if FLineBreak then
  begin
    FMemo.Add( S );
  end else
  begin
    idx := FMemo.Count - 1;
    if idx < 0 then
    begin
      FMemo.Add( S );
    end;
    FMemo[idx] := FMemo[idx] + S;
  end;
  FLineBreak := bWriteLine;
end;

procedure TGUIConsole.Write(const S: string);
begin
  InternalWrite( S, False);
end;

procedure TGUIConsole.WriteLine(const S: string);
begin
  InternalWrite( S, True);
end;

initialization
begin
  FDefaultConsole := TThriftConsole.Create;
  FConsole := FDefaultConsole;
end;

finalization
begin
  FDefaultConsole.Free;
end;

end.


