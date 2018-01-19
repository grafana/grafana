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

unit Thrift.Utils;

interface

{$I Thrift.Defines.inc}

uses
  {$IFDEF OLD_UNIT_NAMES}
  Classes, Windows, SysUtils, Character, SyncObjs;
  {$ELSE}
  System.Classes, Winapi.Windows, System.SysUtils, System.Character, System.SyncObjs;
  {$ENDIF}

type
  IOverlappedHelper = interface
    ['{A1832EFA-2E02-4884-8F09-F0A0277157FA}']
    function Overlapped : TOverlapped;
    function OverlappedPtr : POverlapped;
    function WaitHandle : THandle;
    function WaitFor(dwTimeout: DWORD) : DWORD;
  end;

  TOverlappedHelperImpl = class( TInterfacedObject, IOverlappedHelper)
  strict protected
    FOverlapped : TOverlapped;
    FEvent      : TEvent;

    // IOverlappedHelper
    function Overlapped : TOverlapped;
    function OverlappedPtr : POverlapped;
    function WaitHandle : THandle;
    function WaitFor(dwTimeout: DWORD) : DWORD;
  public
    constructor Create;
    destructor Destroy;  override;
  end;


  Base64Utils = class sealed
  public
    class function Encode( const src : TBytes; srcOff, len : Integer; dst : TBytes; dstOff : Integer) : Integer; static;
    class function Decode( const src : TBytes; srcOff, len : Integer; dst : TBytes; dstOff : Integer) : Integer; static;
  end;


  CharUtils = class sealed
  public
    class function IsHighSurrogate( const c : Char) : Boolean; static; inline;
    class function IsLowSurrogate( const c : Char) : Boolean; static; inline;
  end;


function InterlockedCompareExchange64( var Target : Int64; Exchange, Comparand : Int64) : Int64; stdcall;
function InterlockedExchangeAdd64( var Addend : Int64; Value : Int64) : Int64; stdcall;


implementation

{ TOverlappedHelperImpl }

constructor TOverlappedHelperImpl.Create;
begin
  inherited Create;
  FillChar( FOverlapped, SizeOf(FOverlapped), 0);
  FEvent := TEvent.Create( nil, TRUE, FALSE, '');  // always ManualReset, see MSDN
  FOverlapped.hEvent := FEvent.Handle;
end;



destructor TOverlappedHelperImpl.Destroy;
begin
  try
    FOverlapped.hEvent := 0;
    FreeAndNil( FEvent);

  finally
    inherited Destroy;
  end;

end;


function TOverlappedHelperImpl.Overlapped : TOverlapped;
begin
  result := FOverlapped;
end;


function TOverlappedHelperImpl.OverlappedPtr : POverlapped;
begin
  result := @FOverlapped;
end;


function TOverlappedHelperImpl.WaitHandle : THandle;
begin
  result := FOverlapped.hEvent;
end;


function TOverlappedHelperImpl.WaitFor( dwTimeout : DWORD) : DWORD;
begin
  result := WaitForSingleObject( FOverlapped.hEvent, dwTimeout);
end;


{ Base64Utils }

class function Base64Utils.Encode( const src : TBytes; srcOff, len : Integer; dst : TBytes; dstOff : Integer) : Integer;
const ENCODE_TABLE : PAnsiChar = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
begin
  ASSERT( len in [1..3]);
  dst[dstOff] := Byte( ENCODE_TABLE[ (src[srcOff] shr 2) and $3F]);
  case len of
    3 : begin
      Inc(dstOff);
      dst[dstOff] := Byte( ENCODE_TABLE[ ((src[srcOff] shl 4) and $30) or ((src[srcOff + 1] shr 4) and $0F)]);
      Inc(dstOff);
      dst[dstOff] := Byte( ENCODE_TABLE[ ((src[srcOff + 1] shl 2) and $3C) or ((src[srcOff + 2] shr 6) and $03)]);
      Inc(dstOff);
      dst[dstOff] := Byte( ENCODE_TABLE[ src[srcOff + 2] and $3F]);
      result := 4;
    end;

    2 : begin
      Inc(dstOff);
      dst[dstOff] := Byte( ENCODE_TABLE[ ((src[srcOff] shl 4) and $30) or ((src[srcOff + 1] shr 4) and $0F)]);
      Inc(dstOff);
      dst[dstOff] := Byte( ENCODE_TABLE[ (src[srcOff + 1] shl 2) and $3C]);
      result := 3;
    end;

    1 : begin
      Inc(dstOff);
      dst[dstOff] := Byte( ENCODE_TABLE[ (src[srcOff] shl 4) and $30]);
      result := 2;
    end;

  else
    ASSERT( FALSE);
    result := 0;  // because invalid call
  end;
end;


class function Base64Utils.Decode( const src : TBytes; srcOff, len : Integer; dst : TBytes; dstOff : Integer) : Integer;
const DECODE_TABLE : array[0..$FF] of Integer
                   = ( -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
                       -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
                       -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,
                       52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,
                       -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,
                       15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,
                       -1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
                       41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1,
                       -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
                       -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
                       -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
                       -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
                       -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
                       -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
                       -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
                       -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1  );
begin
  ASSERT( len in [1..4]);
  result := 1;
  dst[dstOff] := ((DECODE_TABLE[src[srcOff]     and $0FF] shl 2)
              or  (DECODE_TABLE[src[srcOff + 1] and $0FF] shr 4));

  if (len > 2) then begin
    Inc( result);
    Inc( dstOff);
    dst[dstOff] := (((DECODE_TABLE[src[srcOff + 1] and $0FF] shl 4) and $F0)
                or   (DECODE_TABLE[src[srcOff + 2] and $0FF] shr 2));

    if (len > 3) then begin
      Inc( result);
      Inc( dstOff);
      dst[dstOff] := (((DECODE_TABLE[src[srcOff + 2] and $0FF] shl 6) and $C0)
                  or    DECODE_TABLE[src[srcOff + 3] and $0FF]);
    end;
  end;
end;


class function CharUtils.IsHighSurrogate( const c : Char) : Boolean;
begin
  {$IF CompilerVersion < 23.0}
  result := Character.IsHighSurrogate( c);
  {$ELSE}
  result := c.IsHighSurrogate();
  {$IFEND}
end;


class function CharUtils.IsLowSurrogate( const c : Char) : Boolean;
begin
  {$IF CompilerVersion < 23.0}
  result := Character.IsLowSurrogate( c);
  {$ELSE}
  result := c.IsLowSurrogate;
  {$IFEND}
end;


// natively available since stone age
function InterlockedCompareExchange64;
external KERNEL32 name 'InterlockedCompareExchange64';


// natively available >= Vista
// implemented this way since there are still some people running Windows XP :-(
function InterlockedExchangeAdd64( var Addend : Int64; Value : Int64) : Int64; stdcall;
var old : Int64;
begin
  repeat
    Old := Addend;
  until (InterlockedCompareExchange64( Addend, Old + Value, Old) = Old);
  result := Old;
end;



end.
