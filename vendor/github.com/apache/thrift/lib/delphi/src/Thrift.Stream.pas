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

unit Thrift.Stream;

{$I Thrift.Defines.inc}

interface

uses
  Classes,
  SysUtils,
  SysConst,
  RTLConsts,
  {$IFDEF OLD_UNIT_NAMES}
  ActiveX,
  {$ELSE}
  Winapi.ActiveX,
  {$ENDIF}
  Thrift.Utils;

type

  IThriftStream = interface
    ['{732621B3-F697-4D76-A1B0-B4DD5A8E4018}']
    procedure Write( const buffer: TBytes; offset: Integer; count: Integer);
    function Read( var buffer: TBytes; offset: Integer; count: Integer): Integer;
    procedure Open;
    procedure Close;
    procedure Flush;
    function IsOpen: Boolean;
    function ToArray: TBytes;
  end;

  TThriftStreamImpl = class( TInterfacedObject, IThriftStream)
  private
    procedure CheckSizeAndOffset( const buffer: TBytes; offset: Integer; count: Integer);
  protected
    procedure Write( const buffer: TBytes; offset: Integer; count: Integer); virtual;
    function Read( var buffer: TBytes; offset: Integer; count: Integer): Integer; virtual;
    procedure Open; virtual; abstract;
    procedure Close; virtual; abstract;
    procedure Flush; virtual; abstract;
    function IsOpen: Boolean; virtual; abstract;
    function ToArray: TBytes; virtual; abstract;
  end;

  TThriftStreamAdapterDelphi = class( TThriftStreamImpl )
  private
    FStream : TStream;
    FOwnsStream : Boolean;
  protected
    procedure Write( const buffer: TBytes; offset: Integer; count: Integer); override;
    function Read( var buffer: TBytes; offset: Integer; count: Integer): Integer; override;
    procedure Open; override;
    procedure Close; override;
    procedure Flush; override;
    function IsOpen: Boolean; override;
    function ToArray: TBytes; override;
  public
    constructor Create( const AStream: TStream; AOwnsStream : Boolean);
    destructor Destroy; override;
  end;

  TThriftStreamAdapterCOM = class( TThriftStreamImpl)
  private
    FStream : IStream;
  protected
    procedure Write( const buffer: TBytes; offset: Integer; count: Integer); override;
    function Read( var buffer: TBytes; offset: Integer; count: Integer): Integer; override;
    procedure Open; override;
    procedure Close; override;
    procedure Flush; override;
    function IsOpen: Boolean; override;
    function ToArray: TBytes; override;
  public
    constructor Create( const AStream: IStream);
  end;

implementation

{ TThriftStreamAdapterCOM }

procedure TThriftStreamAdapterCOM.Close;
begin
  FStream := nil;
end;

constructor TThriftStreamAdapterCOM.Create( const AStream: IStream);
begin
  inherited Create;
  FStream := AStream;
end;

procedure TThriftStreamAdapterCOM.Flush;
begin
  if IsOpen then begin
    if FStream <> nil then begin
      FStream.Commit( STGC_DEFAULT );
    end;
  end;
end;

function TThriftStreamAdapterCOM.IsOpen: Boolean;
begin
  Result := FStream <> nil;
end;

procedure TThriftStreamAdapterCOM.Open;
begin
  // nothing to do
end;

function TThriftStreamAdapterCOM.Read( var buffer: TBytes; offset: Integer; count: Integer): Integer;
begin
  inherited;
  Result := 0;
  if FStream <> nil then begin
    if count > 0 then begin
      FStream.Read( @buffer[offset], count, @Result);
    end;
  end;
end;

function TThriftStreamAdapterCOM.ToArray: TBytes;
var
  statstg: TStatStg;
  len : Integer;
  NewPos : {$IF CompilerVersion >= 29.0} UInt64 {$ELSE} Int64  {$IFEND};
  cbRead : Integer;
begin
  FillChar( statstg, SizeOf( statstg), 0);
  len := 0;
  if IsOpen then begin
    if Succeeded( FStream.Stat( statstg, STATFLAG_NONAME )) then begin
      len := statstg.cbSize;
    end;
  end;

  SetLength( Result, len );

  if len > 0 then begin
    if Succeeded( FStream.Seek( 0, STREAM_SEEK_SET, NewPos) ) then begin
      FStream.Read( @Result[0], len, @cbRead);
    end;
  end;
end;

procedure TThriftStreamAdapterCOM.Write( const buffer: TBytes; offset: Integer; count: Integer);
var nWritten : Integer;
begin
  inherited;
  if IsOpen then begin
    if count > 0 then begin
      FStream.Write( @buffer[0], count, @nWritten);
    end;
  end;
end;

{ TThriftStreamImpl }

procedure TThriftStreamImpl.CheckSizeAndOffset(const buffer: TBytes; offset,
  count: Integer);
var
  len : Integer;
begin
  if count > 0 then begin
    len := Length( buffer );
    if (offset < 0) or ( offset >= len) then begin
      raise ERangeError.Create( SBitsIndexError );
    end;
    if count > len then begin
      raise ERangeError.Create( SBitsIndexError );
    end;
  end;
end;

function TThriftStreamImpl.Read(var buffer: TBytes; offset, count: Integer): Integer;
begin
  Result := 0;
  CheckSizeAndOffset( buffer, offset, count );
end;

procedure TThriftStreamImpl.Write(const buffer: TBytes; offset, count: Integer);
begin
  CheckSizeAndOffset( buffer, offset, count );
end;

{ TThriftStreamAdapterDelphi }

procedure TThriftStreamAdapterDelphi.Close;
begin
  FStream.Free;
  FStream := nil;
  FOwnsStream := False;
end;

constructor TThriftStreamAdapterDelphi.Create( const AStream: TStream; AOwnsStream: Boolean);
begin
  inherited Create;
  FStream := AStream;
  FOwnsStream := AOwnsStream;
end;

destructor TThriftStreamAdapterDelphi.Destroy;
begin
  if FOwnsStream 
  then Close;
  
  inherited;
end;

procedure TThriftStreamAdapterDelphi.Flush;
begin
  // nothing to do
end;

function TThriftStreamAdapterDelphi.IsOpen: Boolean;
begin
  Result := FStream <> nil;
end;

procedure TThriftStreamAdapterDelphi.Open;
begin
  // nothing to do
end;

function TThriftStreamAdapterDelphi.Read(var buffer: TBytes; offset,
  count: Integer): Integer;
begin
  inherited;
  Result := 0;
  if count > 0 then begin
    Result := FStream.Read( Pointer(@buffer[offset])^, count)
  end;
end;

function TThriftStreamAdapterDelphi.ToArray: TBytes;
var
  OrgPos : Integer;
  len : Integer;
begin
  len := 0;
  if FStream <> nil then
  begin
    len := FStream.Size;
  end;

  SetLength( Result, len );

  if len > 0 then
  begin
    OrgPos := FStream.Position;
    try
      FStream.Position := 0;
      FStream.ReadBuffer( Pointer(@Result[0])^, len );
    finally
      FStream.Position := OrgPos;
    end;
  end
end;

procedure TThriftStreamAdapterDelphi.Write(const buffer: TBytes; offset,
  count: Integer);
begin
  inherited;
  if count > 0 then begin
    FStream.Write( Pointer(@buffer[offset])^, count)
  end;
end;

end.
