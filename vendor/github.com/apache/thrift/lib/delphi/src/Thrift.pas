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

unit Thrift;

interface

uses
  SysUtils, Thrift.Protocol;

const
  Version = '0.10.0';

type
  TApplicationExceptionSpecializedClass = class of TApplicationExceptionSpecialized;

  TApplicationException = class( SysUtils.Exception )
  public
    type
{$SCOPEDENUMS ON}
      TExceptionType = (
        Unknown,
        UnknownMethod,
        InvalidMessageType,
        WrongMethodName,
        BadSequenceID,
        MissingResult,
        InternalError,
        ProtocolError,
        InvalidTransform,
        InvalidProtocol,
        UnsupportedClientType
      );
{$SCOPEDENUMS OFF}
  private
    function GetType: TExceptionType;
  protected
    constructor HiddenCreate(const Msg: string);
  public
    // purposefully hide inherited constructor
    class function Create(const Msg: string): TApplicationException; overload; deprecated 'Use specialized TApplicationException types (or regenerate from IDL)';
    class function Create: TApplicationException; overload; deprecated 'Use specialized TApplicationException types (or regenerate from IDL)';
    class function Create( AType: TExceptionType): TApplicationException; overload; deprecated 'Use specialized TApplicationException types (or regenerate from IDL)';
    class function Create( AType: TExceptionType; const msg: string): TApplicationException; overload; deprecated 'Use specialized TApplicationException types (or regenerate from IDL)';

    class function GetSpecializedExceptionType(AType: TExceptionType): TApplicationExceptionSpecializedClass;

    class function Read( const iprot: IProtocol): TApplicationException;
    procedure Write( const oprot: IProtocol );
  end;

  // Needed to remove deprecation warning
  TApplicationExceptionSpecialized = class abstract (TApplicationException)
  public
    constructor Create(const Msg: string);
  end;

  TApplicationExceptionUnknown = class (TApplicationExceptionSpecialized);
  TApplicationExceptionUnknownMethod = class (TApplicationExceptionSpecialized);
  TApplicationExceptionInvalidMessageType = class (TApplicationExceptionSpecialized);
  TApplicationExceptionWrongMethodName = class (TApplicationExceptionSpecialized);
  TApplicationExceptionBadSequenceID = class (TApplicationExceptionSpecialized);
  TApplicationExceptionMissingResult = class (TApplicationExceptionSpecialized);
  TApplicationExceptionInternalError = class (TApplicationExceptionSpecialized);
  TApplicationExceptionProtocolError = class (TApplicationExceptionSpecialized);
  TApplicationExceptionInvalidTransform = class (TApplicationExceptionSpecialized);
  TApplicationExceptionInvalidProtocol = class (TApplicationExceptionSpecialized);
  TApplicationExceptionUnsupportedClientType = class (TApplicationExceptionSpecialized);

  // base class for IDL-generated exceptions
  TException = class( SysUtils.Exception)
  public
    function Message : string;        // hide inherited property: allow read, but prevent accidental writes
    procedure UpdateMessageProperty;  // update inherited message property with toString()
  end;

implementation

{ TException }

function TException.Message;
// allow read (exception summary), but prevent accidental writes
// read will return the exception summary
begin
  result := Self.ToString;
end;

procedure TException.UpdateMessageProperty;
// Update the inherited Message property to better conform to standard behaviour.
// Nice benefit: The IDE is now able to show the exception message again.
begin
  inherited Message := Self.ToString;  // produces a summary text
end;

{ TApplicationException }

function TApplicationException.GetType: TExceptionType;
begin
  if Self is TApplicationExceptionUnknownMethod then Result := TExceptionType.UnknownMethod
  else if Self is TApplicationExceptionInvalidMessageType then Result := TExceptionType.InvalidMessageType
  else if Self is TApplicationExceptionWrongMethodName then Result := TExceptionType.WrongMethodName
  else if Self is TApplicationExceptionBadSequenceID then Result := TExceptionType.BadSequenceID
  else if Self is TApplicationExceptionMissingResult then Result := TExceptionType.MissingResult
  else if Self is TApplicationExceptionInternalError then Result := TExceptionType.InternalError
  else if Self is TApplicationExceptionProtocolError then Result := TExceptionType.ProtocolError
  else if Self is TApplicationExceptionInvalidTransform then Result := TExceptionType.InvalidTransform
  else if Self is TApplicationExceptionInvalidProtocol then Result := TExceptionType.InvalidProtocol
  else if Self is TApplicationExceptionUnsupportedClientType then Result := TExceptionType.UnsupportedClientType
  else Result := TExceptionType.Unknown;
end;

constructor TApplicationException.HiddenCreate(const Msg: string);
begin
  inherited Create(Msg);
end;

class function TApplicationException.Create(const Msg: string): TApplicationException;
begin
  Result := TApplicationExceptionUnknown.Create(Msg);
end;

class function TApplicationException.Create: TApplicationException;
begin
  Result := TApplicationExceptionUnknown.Create('');
end;

class function TApplicationException.Create( AType: TExceptionType): TApplicationException;
begin
{$WARN SYMBOL_DEPRECATED OFF}
  Result := Create(AType, '');
{$WARN SYMBOL_DEPRECATED DEFAULT}
end;

class function TApplicationException.Create( AType: TExceptionType; const msg: string): TApplicationException;
begin
  Result := GetSpecializedExceptionType(AType).Create(msg);
end;

class function TApplicationException.GetSpecializedExceptionType(AType: TExceptionType): TApplicationExceptionSpecializedClass;
begin
  case AType of
    TExceptionType.UnknownMethod:         Result := TApplicationExceptionUnknownMethod;
    TExceptionType.InvalidMessageType:    Result := TApplicationExceptionInvalidMessageType;
    TExceptionType.WrongMethodName:       Result := TApplicationExceptionWrongMethodName;
    TExceptionType.BadSequenceID:         Result := TApplicationExceptionBadSequenceID;
    TExceptionType.MissingResult:         Result := TApplicationExceptionMissingResult;
    TExceptionType.InternalError:         Result := TApplicationExceptionInternalError;
    TExceptionType.ProtocolError:         Result := TApplicationExceptionProtocolError;
    TExceptionType.InvalidTransform:      Result := TApplicationExceptionInvalidTransform;
    TExceptionType.InvalidProtocol:       Result := TApplicationExceptionInvalidProtocol;
    TExceptionType.UnsupportedClientType: Result := TApplicationExceptionUnsupportedClientType;
  else
    Result := TApplicationExceptionUnknown;
  end;
end;

class function TApplicationException.Read( const iprot: IProtocol): TApplicationException;
var
  field : IField;
  msg : string;
  typ : TExceptionType;
  struc : IStruct;
begin
  msg := '';
  typ := TExceptionType.Unknown;
  struc := iprot.ReadStructBegin;
  while ( True ) do
  begin
    field := iprot.ReadFieldBegin;
    if ( field.Type_ = TType.Stop) then
    begin
      Break;
    end;

    case field.Id of
      1 : begin
        if ( field.Type_ = TType.String_) then
        begin
          msg := iprot.ReadString;
        end else
        begin
          TProtocolUtil.Skip( iprot, field.Type_ );
        end;
      end;

      2 : begin
        if ( field.Type_ = TType.I32) then
        begin
          typ := TExceptionType( iprot.ReadI32 );
        end else
        begin
          TProtocolUtil.Skip( iprot, field.Type_ );
        end;
      end else
      begin
        TProtocolUtil.Skip( iprot, field.Type_);
      end;
    end;
    iprot.ReadFieldEnd;
  end;
  iprot.ReadStructEnd;
  Result := GetSpecializedExceptionType(typ).Create(msg);
end;

procedure TApplicationException.Write( const oprot: IProtocol);
var
  struc : IStruct;
  field : IField;

begin
  struc := TStructImpl.Create( 'TApplicationException' );
  field := TFieldImpl.Create;

  oprot.WriteStructBegin( struc );
  if Message <> '' then
  begin
    field.Name := 'message';
    field.Type_ := TType.String_;
    field.Id := 1;
    oprot.WriteFieldBegin( field );
    oprot.WriteString( Message );
    oprot.WriteFieldEnd;
  end;

  field.Name := 'type';
  field.Type_ := TType.I32;
  field.Id := 2;
  oprot.WriteFieldBegin(field);
  oprot.WriteI32(Integer(GetType));
  oprot.WriteFieldEnd();
  oprot.WriteFieldStop();
  oprot.WriteStructEnd();
end;

{ TApplicationExceptionSpecialized }

constructor TApplicationExceptionSpecialized.Create(const Msg: string);
begin
  inherited HiddenCreate(Msg);
end;

end.
