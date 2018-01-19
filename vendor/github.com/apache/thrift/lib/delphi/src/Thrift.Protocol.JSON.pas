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

{$SCOPEDENUMS ON}

unit Thrift.Protocol.JSON;

interface

uses
  Character,
  Classes,
  SysUtils,
  Math,
  Generics.Collections,
  Thrift.Transport,
  Thrift.Protocol,
  Thrift.Utils;

type
  IJSONProtocol = interface( IProtocol)
    ['{F0DAFDBD-692A-4B71-9736-F5D485A2178F}']
    // Read a byte that must match b; otherwise an exception is thrown.
    procedure ReadJSONSyntaxChar( b : Byte);
  end;

  // JSON protocol implementation for thrift.
  // This is a full-featured protocol supporting Write and Read.
  // Please see the C++ class header for a detailed description of the protocol's wire format.
  // Adapted from the C# version.
  TJSONProtocolImpl = class( TProtocolImpl, IJSONProtocol)
  public
    type
      TFactory = class( TInterfacedObject, IProtocolFactory)
      public
        function GetProtocol( const trans: ITransport): IProtocol;
      end;

  private
    class function GetTypeNameForTypeID(typeID : TType) : string;
    class function GetTypeIDForTypeName( const name : string) : TType;

  protected
    type
      // Base class for tracking JSON contexts that may require
      // inserting/Reading additional JSON syntax characters.
      // This base context does nothing.
      TJSONBaseContext = class
      protected
        FProto : Pointer;  // weak IJSONProtocol;
      public
        constructor Create( const aProto : IJSONProtocol);
        procedure Write;  virtual;
        procedure Read;  virtual;
        function EscapeNumbers : Boolean;  virtual;
      end;

      // Context for JSON lists.
      // Will insert/Read commas before each item except for the first one.
      TJSONListContext = class( TJSONBaseContext)
      private
        FFirst : Boolean;
      public
        constructor Create( const aProto : IJSONProtocol);
        procedure Write;  override;
        procedure Read;  override;
      end;

      // Context for JSON records. Will insert/Read colons before the value portion of each record
      // pair, and commas before each key except the first. In addition, will indicate that numbers
      // in the key position need to be escaped in quotes (since JSON keys must be strings).
      TJSONPairContext = class( TJSONBaseContext)
      private
        FFirst, FColon : Boolean;
      public
        constructor Create( const aProto : IJSONProtocol);
        procedure Write;  override;
        procedure Read;  override;
        function EscapeNumbers : Boolean;  override;
      end;

      // Holds up to one byte from the transport
      TLookaheadReader = class
      protected
        FProto : Pointer;  // weak IJSONProtocol;
        constructor Create( const aProto : IJSONProtocol);

      private
        FHasData : Boolean;
        FData    : TBytes;

      public
        // Return and consume the next byte to be Read, either taking it from the
        // data buffer if present or getting it from the transport otherwise.
        function Read : Byte;

        // Return the next byte to be Read without consuming, filling the data
        // buffer if it has not been filled alReady.
        function Peek : Byte;
      end;

  protected
    // Stack of nested contexts that we may be in
    FContextStack : TStack<TJSONBaseContext>;

    // Current context that we are in
    FContext : TJSONBaseContext;

    // Reader that manages a 1-byte buffer
    FReader : TLookaheadReader;

    // Push/pop a new JSON context onto/from the stack.
    procedure ResetContextStack;
    procedure PushContext( const aCtx : TJSONBaseContext);
    procedure PopContext;

  public
    // TJSONProtocolImpl Constructor
    constructor Create( const aTrans : ITransport);
    destructor Destroy;   override;

  protected
    // IJSONProtocol
    // Read a byte that must match b; otherwise an exception is thrown.
    procedure ReadJSONSyntaxChar( b : Byte);

  private
    // Convert a byte containing a hex char ('0'-'9' or 'a'-'f') into its corresponding hex value
    class function HexVal( ch : Byte) : Byte;

    // Convert a byte containing a hex value to its corresponding hex character
    class function HexChar( val : Byte) : Byte;

    // Write the bytes in array buf as a JSON characters, escaping as needed
    procedure WriteJSONString( const b : TBytes);  overload;
    procedure WriteJSONString( const str : string);  overload;

    // Write out number as a JSON value. If the context dictates so, it will be
    // wrapped in quotes to output as a JSON string.
    procedure WriteJSONInteger( const num : Int64);

    // Write out a double as a JSON value. If it is NaN or infinity or if the
    // context dictates escaping, Write out as JSON string.
    procedure WriteJSONDouble( const num : Double);

    // Write out contents of byte array b as a JSON string with base-64 encoded data
    procedure WriteJSONBase64( const b : TBytes);

    procedure WriteJSONObjectStart;
    procedure WriteJSONObjectEnd;
    procedure WriteJSONArrayStart;
    procedure WriteJSONArrayEnd;

  public
    // IProtocol
    procedure WriteMessageBegin( const aMsg : IMessage); override;
    procedure WriteMessageEnd; override;
    procedure WriteStructBegin( const struc: IStruct); override;
    procedure WriteStructEnd; override;
    procedure WriteFieldBegin( const field: IField); override;
    procedure WriteFieldEnd; override;
    procedure WriteFieldStop; override;
    procedure WriteMapBegin( const map: IMap); override;
    procedure WriteMapEnd; override;
    procedure WriteListBegin( const list: IList); override;
    procedure WriteListEnd(); override;
    procedure WriteSetBegin( const set_: ISet ); override;
    procedure WriteSetEnd(); override;
    procedure WriteBool( b: Boolean); override;
    procedure WriteByte( b: ShortInt); override;
    procedure WriteI16( i16: SmallInt); override;
    procedure WriteI32( i32: Integer); override;
    procedure WriteI64( const i64: Int64); override;
    procedure WriteDouble( const d: Double); override;
    procedure WriteString( const s: string );   override;
    procedure WriteBinary( const b: TBytes); override;
    //
    function ReadMessageBegin: IMessage; override;
    procedure ReadMessageEnd(); override;
    function ReadStructBegin: IStruct; override;
    procedure ReadStructEnd; override;
    function ReadFieldBegin: IField; override;
    procedure ReadFieldEnd(); override;
    function ReadMapBegin: IMap; override;
    procedure ReadMapEnd(); override;
    function ReadListBegin: IList; override;
    procedure ReadListEnd(); override;
    function ReadSetBegin: ISet; override;
    procedure ReadSetEnd(); override;
    function ReadBool: Boolean; override;
    function ReadByte: ShortInt; override;
    function ReadI16: SmallInt; override;
    function ReadI32: Integer; override;
    function ReadI64: Int64; override;
    function ReadDouble:Double; override;
    function ReadString : string;  override;
    function ReadBinary: TBytes; override;


  private
    // Reading methods.

    // Read in a JSON string, unescaping as appropriate.
    // Skip Reading from the context if skipContext is true.
    function ReadJSONString( skipContext : Boolean) : TBytes;

    // Return true if the given byte could be a valid part of a JSON number.
    function IsJSONNumeric( b : Byte) : Boolean;

    // Read in a sequence of characters that are all valid in JSON numbers. Does
    // not do a complete regex check to validate that this is actually a number.
    function ReadJSONNumericChars : String;

    // Read in a JSON number. If the context dictates, Read in enclosing quotes.
    function ReadJSONInteger : Int64;

    // Read in a JSON double value. Throw if the value is not wrapped in quotes
    // when expected or if wrapped in quotes when not expected.
    function ReadJSONDouble : Double;

    // Read in a JSON string containing base-64 encoded data and decode it.
    function ReadJSONBase64 : TBytes;

    procedure ReadJSONObjectStart;
    procedure ReadJSONObjectEnd;
    procedure ReadJSONArrayStart;
    procedure ReadJSONArrayEnd;
  end;


implementation

var
  COMMA     : TBytes;
  COLON     : TBytes;
  LBRACE    : TBytes;
  RBRACE    : TBytes;
  LBRACKET  : TBytes;
  RBRACKET  : TBytes;
  QUOTE     : TBytes;
  BACKSLASH : TBytes;
  ESCSEQ    : TBytes;

const
  VERSION = 1;
  JSON_CHAR_TABLE : array[0..$2F] of Byte
                  = (0,0,0,0, 0,0,0,0, Byte('b'),Byte('t'),Byte('n'),0, Byte('f'),Byte('r'),0,0,
                     0,0,0,0, 0,0,0,0, 0,0,0,0,  0,0,0,0,
                     1,1,Byte('"'),1,  1,1,1,1, 1,1,1,1, 1,1,1,1);

  ESCAPE_CHARS     = '"\/btnfr';
  ESCAPE_CHAR_VALS = '"\/'#8#9#10#12#13;

  DEF_STRING_SIZE = 16;

  NAME_BOOL   = 'tf';
  NAME_BYTE   = 'i8';
  NAME_I16    = 'i16';
  NAME_I32    = 'i32';
  NAME_I64    = 'i64';
  NAME_DOUBLE = 'dbl';
  NAME_STRUCT = 'rec';
  NAME_STRING = 'str';
  NAME_MAP    = 'map';
  NAME_LIST   = 'lst';
  NAME_SET    = 'set';

  INVARIANT_CULTURE : TFormatSettings
                    = ( ThousandSeparator: ',';
                        DecimalSeparator: '.');



//--- TJSONProtocolImpl ----------------------


function TJSONProtocolImpl.TFactory.GetProtocol( const trans: ITransport): IProtocol;
begin
  result := TJSONProtocolImpl.Create(trans);
end;

class function TJSONProtocolImpl.GetTypeNameForTypeID(typeID : TType) : string;
begin
  case typeID of
    TType.Bool_:    result := NAME_BOOL;
    TType.Byte_:    result := NAME_BYTE;
    TType.I16:      result := NAME_I16;
    TType.I32:      result := NAME_I32;
    TType.I64:      result := NAME_I64;
    TType.Double_:  result := NAME_DOUBLE;
    TType.String_:  result := NAME_STRING;
    TType.Struct:   result := NAME_STRUCT;
    TType.Map:      result := NAME_MAP;
    TType.Set_:     result := NAME_SET;
    TType.List:     result := NAME_LIST;
  else
    raise TProtocolExceptionNotImplemented.Create('Unrecognized type ('+IntToStr(Ord(typeID))+')');
  end;
end;


class function TJSONProtocolImpl.GetTypeIDForTypeName( const name : string) : TType;
begin
  if      name = NAME_BOOL   then result := TType.Bool_
  else if name = NAME_BYTE   then result := TType.Byte_
  else if name = NAME_I16    then result := TType.I16
  else if name = NAME_I32    then result := TType.I32
  else if name = NAME_I64    then result := TType.I64
  else if name = NAME_DOUBLE then result := TType.Double_
  else if name = NAME_STRUCT then result := TType.Struct
  else if name = NAME_STRING then result := TType.String_
  else if name = NAME_MAP    then result := TType.Map
  else if name = NAME_LIST   then result := TType.List
  else if name = NAME_SET    then result := TType.Set_
  else raise TProtocolExceptionNotImplemented.Create('Unrecognized type ('+name+')');
end;


constructor TJSONProtocolImpl.TJSONBaseContext.Create( const aProto : IJSONProtocol);
begin
  inherited Create;
  FProto := Pointer(aProto);
end;


procedure TJSONProtocolImpl.TJSONBaseContext.Write;
begin
  // nothing
end;


procedure TJSONProtocolImpl.TJSONBaseContext.Read;
begin
  // nothing
end;


function TJSONProtocolImpl.TJSONBaseContext.EscapeNumbers : Boolean;
begin
  result := FALSE;
end;


constructor TJSONProtocolImpl.TJSONListContext.Create( const aProto : IJSONProtocol);
begin
  inherited Create( aProto);
  FFirst := TRUE;
end;


procedure TJSONProtocolImpl.TJSONListContext.Write;
begin
  if FFirst
  then FFirst := FALSE
  else IJSONProtocol(FProto).Transport.Write( COMMA);
end;


procedure TJSONProtocolImpl.TJSONListContext.Read;
begin
  if FFirst
  then FFirst := FALSE
  else IJSONProtocol(FProto).ReadJSONSyntaxChar( COMMA[0]);
end;


constructor TJSONProtocolImpl.TJSONPairContext.Create( const aProto : IJSONProtocol);
begin
  inherited Create( aProto);
  FFirst := TRUE;
  FColon := TRUE;
end;


procedure TJSONProtocolImpl.TJSONPairContext.Write;
begin
  if FFirst then begin
    FFirst := FALSE;
    FColon := TRUE;
  end
  else begin
    if FColon
    then IJSONProtocol(FProto).Transport.Write( COLON)
    else IJSONProtocol(FProto).Transport.Write( COMMA);
    FColon := not FColon;
  end;
end;


procedure TJSONProtocolImpl.TJSONPairContext.Read;
begin
  if FFirst then begin
    FFirst := FALSE;
    FColon := TRUE;
  end
  else begin
    if FColon
    then IJSONProtocol(FProto).ReadJSONSyntaxChar( COLON[0])
    else IJSONProtocol(FProto).ReadJSONSyntaxChar( COMMA[0]);
    FColon := not FColon;
  end;
end;


function TJSONProtocolImpl.TJSONPairContext.EscapeNumbers : Boolean;
begin
  result := FColon;
end;


constructor TJSONProtocolImpl.TLookaheadReader.Create( const aProto : IJSONProtocol);
begin
  inherited Create;
  FProto   := Pointer(aProto);
  FHasData := FALSE;
end;


function TJSONProtocolImpl.TLookaheadReader.Read : Byte;
begin
  if FHasData
  then FHasData := FALSE
  else begin
    SetLength( FData, 1);
    IJSONProtocol(FProto).Transport.ReadAll( FData, 0, 1);
  end;
  result := FData[0];
end;


function TJSONProtocolImpl.TLookaheadReader.Peek : Byte;
begin
  if not FHasData then begin
    SetLength( FData, 1);
    IJSONProtocol(FProto).Transport.ReadAll( FData, 0, 1);
    FHasData := TRUE;
  end;
  result := FData[0];
end;


constructor TJSONProtocolImpl.Create( const aTrans : ITransport);
begin
  inherited Create( aTrans);

  // Stack of nested contexts that we may be in
  FContextStack := TStack<TJSONBaseContext>.Create;

  FContext := TJSONBaseContext.Create( Self);
  FReader  := TLookaheadReader.Create( Self);
end;


destructor TJSONProtocolImpl.Destroy;
begin
  try
    ResetContextStack;  // free any contents
    FreeAndNil( FReader);
    FreeAndNil( FContext);
    FreeAndNil( FContextStack);
  finally
    inherited Destroy;
  end;
end;


procedure TJSONProtocolImpl.ResetContextStack;
begin
  while FContextStack.Count > 0
  do PopContext;
end;


procedure TJSONProtocolImpl.PushContext( const aCtx : TJSONBaseContext);
begin
  FContextStack.Push( FContext);
  FContext := aCtx;
end;


procedure TJSONProtocolImpl.PopContext;
begin
  FreeAndNil(FContext);
  FContext := FContextStack.Pop;
end;


procedure TJSONProtocolImpl.ReadJSONSyntaxChar( b : Byte);
var ch : Byte;
begin
  ch := FReader.Read;
  if (ch <> b)
  then raise TProtocolExceptionInvalidData.Create('Unexpected character ('+Char(ch)+')');
end;


class function TJSONProtocolImpl.HexVal( ch : Byte) : Byte;
var i : Integer;
begin
  i := StrToIntDef( '$0'+Char(ch), -1);
  if (0 <= i) and (i < $10)
  then result := i
  else raise TProtocolExceptionInvalidData.Create('Expected hex character ('+Char(ch)+')');
end;


class function TJSONProtocolImpl.HexChar( val : Byte) : Byte;
const HEXCHARS = '0123456789ABCDEF';
begin
  result := Byte( PChar(HEXCHARS)[val and $0F]);
  ASSERT( Pos( Char(result), HEXCHARS) > 0);
end;


procedure TJSONProtocolImpl.WriteJSONString( const str : string);
begin
  WriteJSONString( SysUtils.TEncoding.UTF8.GetBytes( str));
end;


procedure TJSONProtocolImpl.WriteJSONString( const b : TBytes);
var i : Integer;
    tmp : TBytes;
begin
  FContext.Write;
  Transport.Write( QUOTE);
  for i := 0 to Length(b)-1 do begin

    if (b[i] and $00FF) >= $30 then begin

      if (b[i] = BACKSLASH[0]) then begin
        Transport.Write( BACKSLASH);
        Transport.Write( BACKSLASH);
      end
      else begin
        Transport.Write( b, i, 1);
      end;

    end
    else begin
      SetLength( tmp, 2);
      tmp[0] := JSON_CHAR_TABLE[b[i]];
      if (tmp[0] = 1) then begin
        Transport.Write( b, i, 1)
      end
      else if (tmp[0] > 1) then begin
        Transport.Write( BACKSLASH);
        Transport.Write( tmp, 0, 1);
      end
      else begin
        Transport.Write( ESCSEQ);
        tmp[0] := HexChar( b[i] div $10);
        tmp[1] := HexChar( b[i]);
        Transport.Write( tmp, 0, 2);
      end;
    end;
  end;
  Transport.Write( QUOTE);
end;


procedure TJSONProtocolImpl.WriteJSONInteger( const num : Int64);
var str : String;
    escapeNum : Boolean;
begin
  FContext.Write;
  str := IntToStr(num);

  escapeNum := FContext.EscapeNumbers;
  if escapeNum
  then Transport.Write( QUOTE);

  Transport.Write( SysUtils.TEncoding.UTF8.GetBytes( str));

  if escapeNum
  then Transport.Write( QUOTE);
end;


procedure TJSONProtocolImpl.WriteJSONDouble( const num : Double);
var str : string;
    special : Boolean;
    escapeNum : Boolean;
begin
  FContext.Write;

  str := FloatToStr( num, INVARIANT_CULTURE);
  special := FALSE;

  case UpCase(str[1]) of
    'N' : special := TRUE;  // NaN
    'I' : special := TRUE;  // Infinity
    '-' : special := (UpCase(str[2]) = 'I'); // -Infinity
  end;

  escapeNum := special or FContext.EscapeNumbers;


  if escapeNum
  then Transport.Write( QUOTE);

  Transport.Write( SysUtils.TEncoding.UTF8.GetBytes( str));

  if escapeNum
  then Transport.Write( QUOTE);
end;


procedure TJSONProtocolImpl.WriteJSONBase64( const b : TBytes);
var len, off, cnt : Integer;
    tmpBuf : TBytes;
begin
  FContext.Write;
  Transport.Write( QUOTE);

  len := Length(b);
  off := 0;
  SetLength( tmpBuf, 4);

  while len >= 3 do begin
    // Encode 3 bytes at a time
    Base64Utils.Encode( b, off, 3, tmpBuf, 0);
    Transport.Write( tmpBuf, 0, 4);
    Inc( off, 3);
    Dec( len, 3);
  end;

  // Encode remainder, if any
  if len > 0 then begin
    cnt := Base64Utils.Encode( b, off, len, tmpBuf, 0);
    Transport.Write( tmpBuf, 0, cnt);
  end;

  Transport.Write( QUOTE);
end;


procedure TJSONProtocolImpl.WriteJSONObjectStart;
begin
  FContext.Write;
  Transport.Write( LBRACE);
  PushContext( TJSONPairContext.Create( Self));
end;


procedure TJSONProtocolImpl.WriteJSONObjectEnd;
begin
  PopContext;
  Transport.Write( RBRACE);
end;


procedure TJSONProtocolImpl.WriteJSONArrayStart;
begin
  FContext.Write;
  Transport.Write( LBRACKET);
  PushContext( TJSONListContext.Create( Self));
end;


procedure TJSONProtocolImpl.WriteJSONArrayEnd;
begin
  PopContext;
  Transport.Write( RBRACKET);
end;


procedure TJSONProtocolImpl.WriteMessageBegin( const aMsg : IMessage);
begin
  ResetContextStack;  // THRIFT-1473

  WriteJSONArrayStart;
  WriteJSONInteger(VERSION);

  WriteJSONString( SysUtils.TEncoding.UTF8.GetBytes( aMsg.Name));

  WriteJSONInteger( LongInt( aMsg.Type_));
  WriteJSONInteger( aMsg.SeqID);
end;

procedure TJSONProtocolImpl.WriteMessageEnd;
begin
  WriteJSONArrayEnd;
end;


procedure TJSONProtocolImpl.WriteStructBegin( const struc: IStruct);
begin
  WriteJSONObjectStart;
end;


procedure TJSONProtocolImpl.WriteStructEnd;
begin
  WriteJSONObjectEnd;
end;


procedure TJSONProtocolImpl.WriteFieldBegin( const field : IField);
begin
  WriteJSONInteger(field.ID);
  WriteJSONObjectStart;
  WriteJSONString( GetTypeNameForTypeID(field.Type_));
end;


procedure TJSONProtocolImpl.WriteFieldEnd;
begin
  WriteJSONObjectEnd;
end;


procedure TJSONProtocolImpl.WriteFieldStop;
begin
  // nothing to do
end;

procedure TJSONProtocolImpl.WriteMapBegin( const map: IMap);
begin
  WriteJSONArrayStart;
  WriteJSONString( GetTypeNameForTypeID( map.KeyType));
  WriteJSONString( GetTypeNameForTypeID( map.ValueType));
  WriteJSONInteger( map.Count);
  WriteJSONObjectStart;
end;


procedure TJSONProtocolImpl.WriteMapEnd;
begin
  WriteJSONObjectEnd;
  WriteJSONArrayEnd;
end;


procedure TJSONProtocolImpl.WriteListBegin( const list: IList);
begin
  WriteJSONArrayStart;
  WriteJSONString( GetTypeNameForTypeID( list.ElementType));
  WriteJSONInteger(list.Count);
end;


procedure TJSONProtocolImpl.WriteListEnd;
begin
  WriteJSONArrayEnd;
end;


procedure TJSONProtocolImpl.WriteSetBegin( const set_: ISet);
begin
  WriteJSONArrayStart;
  WriteJSONString( GetTypeNameForTypeID( set_.ElementType));
  WriteJSONInteger( set_.Count);
end;


procedure TJSONProtocolImpl.WriteSetEnd;
begin
  WriteJSONArrayEnd;
end;

procedure TJSONProtocolImpl.WriteBool( b: Boolean);
begin
  if b
  then WriteJSONInteger( 1)
  else WriteJSONInteger( 0);
end;

procedure TJSONProtocolImpl.WriteByte( b: ShortInt);
begin
  WriteJSONInteger( b);
end;

procedure TJSONProtocolImpl.WriteI16( i16: SmallInt);
begin
  WriteJSONInteger( i16);
end;

procedure TJSONProtocolImpl.WriteI32( i32: Integer);
begin
  WriteJSONInteger( i32);
end;

procedure TJSONProtocolImpl.WriteI64( const i64: Int64);
begin
  WriteJSONInteger(i64);
end;

procedure TJSONProtocolImpl.WriteDouble( const d: Double);
begin
  WriteJSONDouble( d);
end;

procedure TJSONProtocolImpl.WriteString( const s: string );
begin
  WriteJSONString( SysUtils.TEncoding.UTF8.GetBytes( s));
end;

procedure TJSONProtocolImpl.WriteBinary( const b: TBytes);
begin
  WriteJSONBase64( b);
end;


function TJSONProtocolImpl.ReadJSONString( skipContext : Boolean) : TBytes;
var buffer : TMemoryStream;
    ch  : Byte;
    wch : Word;
    highSurogate: Char;
    surrogatePairs: Array[0..1] of Char;
    off : Integer;
    tmp : TBytes;
begin
  highSurogate := #0;
  buffer := TMemoryStream.Create;
  try
    if not skipContext
    then FContext.Read;

    ReadJSONSyntaxChar( QUOTE[0]);

    while TRUE do begin
      ch := FReader.Read;

      if (ch = QUOTE[0])
      then Break;

      // check for escapes
      if (ch <> ESCSEQ[0]) then begin
        buffer.Write( ch, 1);
        Continue;
      end;

      // distuinguish between \uNNNN and \?
      ch := FReader.Read;
      if (ch <> ESCSEQ[1])
      then begin
        off := Pos( Char(ch), ESCAPE_CHARS);
        if off < 1
        then raise TProtocolExceptionInvalidData.Create('Expected control char');
        ch := Byte( ESCAPE_CHAR_VALS[off]);
        buffer.Write( ch, 1);
        Continue;
      end;

      // it is \uXXXX
      SetLength( tmp, 4);
      Transport.ReadAll( tmp, 0, 4);
      wch := (HexVal(tmp[0]) shl 12)
           + (HexVal(tmp[1]) shl 8)
           + (HexVal(tmp[2]) shl 4)
           +  HexVal(tmp[3]);

      // we need to make UTF8 bytes from it, to be decoded later
      if CharUtils.IsHighSurrogate(char(wch)) then begin
        if highSurogate <> #0
        then raise TProtocolExceptionInvalidData.Create('Expected low surrogate char');
        highSurogate := char(wch);
      end
      else if CharUtils.IsLowSurrogate(char(wch)) then begin
        if highSurogate = #0
        then TProtocolExceptionInvalidData.Create('Expected high surrogate char');
        surrogatePairs[0] := highSurogate;
        surrogatePairs[1] := char(wch);
        tmp := TEncoding.UTF8.GetBytes(surrogatePairs);
        buffer.Write( tmp[0], Length(tmp));
        highSurogate := #0;
      end
      else begin
        tmp := SysUtils.TEncoding.UTF8.GetBytes(Char(wch));
        buffer.Write( tmp[0], Length(tmp));
      end;
    end;

    if highSurogate <> #0
    then raise TProtocolExceptionInvalidData.Create('Expected low surrogate char');

    SetLength( result, buffer.Size);
    if buffer.Size > 0 then Move( buffer.Memory^, result[0], Length(result));

  finally
    buffer.Free;
  end;
end;


function TJSONProtocolImpl.IsJSONNumeric( b : Byte) : Boolean;
const NUMCHARS = ['+','-','.','0','1','2','3','4','5','6','7','8','9','E','e'];
begin
  result := CharInSet( Char(b), NUMCHARS);
end;


function TJSONProtocolImpl.ReadJSONNumericChars : string;
var strbld : TThriftStringBuilder;
    ch : Byte;
begin
  strbld := TThriftStringBuilder.Create;
  try
    while TRUE do begin
      ch := FReader.Peek;
      if IsJSONNumeric(ch)
      then strbld.Append( Char(FReader.Read))
      else Break;
    end;
    result := strbld.ToString;

  finally
    strbld.Free;
  end;
end;


function TJSONProtocolImpl.ReadJSONInteger : Int64;
var str : string;
begin
  FContext.Read;
  if FContext.EscapeNumbers
  then ReadJSONSyntaxChar( QUOTE[0]);

  str := ReadJSONNumericChars;

  if FContext.EscapeNumbers
  then ReadJSONSyntaxChar( QUOTE[0]);

  try
    result := StrToInt64(str);
  except
    on e:Exception do begin
      raise TProtocolExceptionInvalidData.Create('Bad data encounted in numeric data ('+str+') ('+e.Message+')');
    end;
  end;
end;


function TJSONProtocolImpl.ReadJSONDouble : Double;
var dub : Double;
    str : string;
begin
  FContext.Read;

  if FReader.Peek = QUOTE[0]
  then begin
    str := SysUtils.TEncoding.UTF8.GetString( ReadJSONString( TRUE));
    dub := StrToFloat( str, INVARIANT_CULTURE);

    if not FContext.EscapeNumbers()
    and not Math.IsNaN(dub)
    and not Math.IsInfinite(dub)
    then begin
      // Throw exception -- we should not be in a string in  Self case
      raise TProtocolExceptionInvalidData.Create('Numeric data unexpectedly quoted');
    end;
    result := dub;
    Exit;
  end;

  // will throw - we should have had a quote if escapeNum == true
  if FContext.EscapeNumbers
  then ReadJSONSyntaxChar( QUOTE[0]);

  try
    str := ReadJSONNumericChars;
    result := StrToFloat( str, INVARIANT_CULTURE);
  except
    on e:Exception
    do raise TProtocolExceptionInvalidData.Create('Bad data encounted in numeric data ('+str+') ('+e.Message+')');
  end;
end;


function TJSONProtocolImpl.ReadJSONBase64 : TBytes;
var b : TBytes;
    len, off, size : Integer;
begin
  b := ReadJSONString(false);

  len := Length(b);
  off := 0;
  size := 0;

  // reduce len to ignore fill bytes
  Dec(len);
  while (len >= 0) and (b[len] = Byte('=')) do Dec(len);
  Inc(len);

  // read & decode full byte triplets = 4 source bytes
  while (len >= 4) do begin
    // Decode 4 bytes at a time
    Inc( size, Base64Utils.Decode( b, off, 4, b, size)); // decoded in place
    Inc( off, 4);
    Dec( len, 4);
  end;

  // Don't decode if we hit the end or got a single leftover byte (invalid
  // base64 but legal for skip of regular string type)
  if len > 1 then begin
    // Decode remainder
    Inc( size, Base64Utils.Decode( b, off, len, b, size)); // decoded in place
  end;

  // resize to final size and return the data
  SetLength( b, size);
  result := b;
end;


procedure TJSONProtocolImpl.ReadJSONObjectStart;
begin
  FContext.Read;
  ReadJSONSyntaxChar( LBRACE[0]);
  PushContext( TJSONPairContext.Create( Self));
end;


procedure TJSONProtocolImpl.ReadJSONObjectEnd;
begin
  ReadJSONSyntaxChar( RBRACE[0]);
  PopContext;
end;


procedure TJSONProtocolImpl.ReadJSONArrayStart;
begin
  FContext.Read;
  ReadJSONSyntaxChar( LBRACKET[0]);
  PushContext( TJSONListContext.Create( Self));
end;


procedure TJSONProtocolImpl.ReadJSONArrayEnd;
begin
  ReadJSONSyntaxChar( RBRACKET[0]);
  PopContext;
end;


function TJSONProtocolImpl.ReadMessageBegin: IMessage;
begin
  ResetContextStack;  // THRIFT-1473

  result := TMessageImpl.Create;
  ReadJSONArrayStart;

  if ReadJSONInteger <> VERSION
  then raise TProtocolExceptionBadVersion.Create('Message contained bad version.');

  result.Name  := SysUtils.TEncoding.UTF8.GetString( ReadJSONString( FALSE));
  result.Type_ := TMessageType( ReadJSONInteger);
  result.SeqID := ReadJSONInteger;
end;


procedure TJSONProtocolImpl.ReadMessageEnd;
begin
  ReadJSONArrayEnd;
end;


function TJSONProtocolImpl.ReadStructBegin : IStruct ;
begin
  ReadJSONObjectStart;
  result := TStructImpl.Create('');
end;


procedure TJSONProtocolImpl.ReadStructEnd;
begin
  ReadJSONObjectEnd;
end;


function TJSONProtocolImpl.ReadFieldBegin : IField;
var ch : Byte;
    str : string;
begin
  result := TFieldImpl.Create;
  ch := FReader.Peek;
  if ch = RBRACE[0]
  then result.Type_ := TType.Stop
  else begin
    result.ID := ReadJSONInteger;
    ReadJSONObjectStart;

    str := SysUtils.TEncoding.UTF8.GetString( ReadJSONString( FALSE));
    result.Type_ := GetTypeIDForTypeName( str);
  end;
end;


procedure TJSONProtocolImpl.ReadFieldEnd;
begin
  ReadJSONObjectEnd;
end;


function TJSONProtocolImpl.ReadMapBegin : IMap;
var str : string;
begin
  result := TMapImpl.Create;
  ReadJSONArrayStart;

  str := SysUtils.TEncoding.UTF8.GetString( ReadJSONString(FALSE));
  result.KeyType := GetTypeIDForTypeName( str);

  str := SysUtils.TEncoding.UTF8.GetString( ReadJSONString(FALSE));
  result.ValueType := GetTypeIDForTypeName( str);

  result.Count := ReadJSONInteger;
  ReadJSONObjectStart;
end;


procedure TJSONProtocolImpl.ReadMapEnd;
begin
  ReadJSONObjectEnd;
  ReadJSONArrayEnd;
end;


function TJSONProtocolImpl.ReadListBegin : IList;
var str : string;
begin
  result := TListImpl.Create;
  ReadJSONArrayStart;

  str := SysUtils.TEncoding.UTF8.GetString( ReadJSONString(FALSE));
  result.ElementType := GetTypeIDForTypeName( str);
  result.Count := ReadJSONInteger;
end;


procedure TJSONProtocolImpl.ReadListEnd;
begin
  ReadJSONArrayEnd;
end;


function TJSONProtocolImpl.ReadSetBegin : ISet;
var str : string;
begin
  result := TSetImpl.Create;
  ReadJSONArrayStart;

  str := SysUtils.TEncoding.UTF8.GetString( ReadJSONString(FALSE));
  result.ElementType := GetTypeIDForTypeName( str);
  result.Count := ReadJSONInteger;
end;


procedure TJSONProtocolImpl.ReadSetEnd;
begin
  ReadJSONArrayEnd;
end;


function TJSONProtocolImpl.ReadBool : Boolean;
begin
  result := (ReadJSONInteger <> 0);
end;


function TJSONProtocolImpl.ReadByte : ShortInt;
begin
  result := ReadJSONInteger;
end;


function TJSONProtocolImpl.ReadI16 : SmallInt;
begin
  result := ReadJSONInteger;
end;


function TJSONProtocolImpl.ReadI32 : LongInt;
begin
  result := ReadJSONInteger;
end;


function TJSONProtocolImpl.ReadI64 : Int64;
begin
  result := ReadJSONInteger;
end;


function TJSONProtocolImpl.ReadDouble : Double;
begin
  result := ReadJSONDouble;
end;


function TJSONProtocolImpl.ReadString : string;
begin
  result := SysUtils.TEncoding.UTF8.GetString( ReadJSONString( FALSE));
end;


function TJSONProtocolImpl.ReadBinary : TBytes;
begin
  result := ReadJSONBase64;
end;


//--- init code ---

procedure InitBytes( var b : TBytes; aData : array of Byte);
begin
  SetLength( b, Length(aData));
  Move( aData, b[0], Length(b));
end;

initialization
  InitBytes( COMMA,     [Byte(',')]);
  InitBytes( COLON,     [Byte(':')]);
  InitBytes( LBRACE,    [Byte('{')]);
  InitBytes( RBRACE,    [Byte('}')]);
  InitBytes( LBRACKET,  [Byte('[')]);
  InitBytes( RBRACKET,  [Byte(']')]);
  InitBytes( QUOTE,     [Byte('"')]);
  InitBytes( BACKSLASH, [Byte('\')]);
  InitBytes( ESCSEQ,    [Byte('\'),Byte('u'),Byte('0'),Byte('0')]);
end.
