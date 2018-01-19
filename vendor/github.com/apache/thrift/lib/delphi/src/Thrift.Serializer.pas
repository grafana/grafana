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
unit Thrift.Serializer;

{$I Thrift.Defines.inc}

interface

uses
  {$IFDEF OLD_UNIT_NAMES}
  Classes, Windows, SysUtils,
  {$ELSE}
  System.Classes, Winapi.Windows, System.SysUtils,
  {$ENDIF}
  Thrift.Protocol,
  Thrift.Transport,
  Thrift.Stream;


type
  // Generic utility for easily serializing objects into a byte array or Stream.
  TSerializer = class
  private
    FStream    : TMemoryStream;
    FTransport : ITransport;
    FProtocol  : IProtocol;

  public
    // Create a new TSerializer that uses the TBinaryProtocol by default.
    constructor Create;  overload;

    // Create a new TSerializer.
    // It will use the TProtocol specified by the factory that is passed in.
    constructor Create( const factory : IProtocolFactory);  overload;

    // DTOR
    destructor Destroy;  override;

    // Serialize the Thrift object.
    function  Serialize( const input : IBase) : TBytes;  overload;
    procedure Serialize( const input : IBase; const aStm : TStream);  overload;
  end;


  // Generic utility for easily deserializing objects from byte array or Stream.
  TDeserializer = class
  private
    FStream    : TMemoryStream;
    FTransport : ITransport;
    FProtocol  : IProtocol;

  public
    // Create a new TDeserializer that uses the TBinaryProtocol by default.
    constructor Create;  overload;

    // Create a new TDeserializer.
    // It will use the TProtocol specified by the factory that is passed in.
    constructor Create( const factory : IProtocolFactory);  overload;

    // DTOR
    destructor Destroy;  override;

    // Deserialize the Thrift object data.
    procedure Deserialize( const input : TBytes; const target : IBase);  overload;
    procedure Deserialize( const input : TStream; const target : IBase);  overload;
  end;



implementation


{ TSerializer }


constructor TSerializer.Create();
// Create a new TSerializer that uses the TBinaryProtocol by default.
begin
  //no inherited;
  Create( TBinaryProtocolImpl.TFactory.Create);
end;


constructor TSerializer.Create( const factory : IProtocolFactory);
// Create a new TSerializer.
// It will use the TProtocol specified by the factory that is passed in.
var adapter : IThriftStream;
begin
  inherited Create;
  FStream    := TMemoryStream.Create;
  adapter    := TThriftStreamAdapterDelphi.Create( FStream, FALSE);
  FTransport := TStreamTransportImpl.Create( nil, adapter);
  FProtocol  := factory.GetProtocol( FTransport);
end;


destructor TSerializer.Destroy;
begin
  try
    FProtocol  := nil;
    FTransport := nil;
    FreeAndNil( FStream);
  finally
    inherited Destroy;
  end;
end;


function TSerializer.Serialize( const input : IBase) : TBytes;
// Serialize the Thrift object into a byte array. The process is simple,
// just clear the byte array output, write the object into it, and grab the
// raw bytes.
var iBytes : Int64;
begin
  try
    FStream.Size := 0;
    input.Write( FProtocol);
    SetLength( result, FStream.Size);
    iBytes := Length(result);
    if iBytes > 0
    then Move( FStream.Memory^, result[0], iBytes);
  finally
    FStream.Size := 0;  // free any allocated memory
  end;
end;


procedure TSerializer.Serialize( const input : IBase; const aStm : TStream);
// Serialize the Thrift object into a byte array. The process is simple,
// just clear the byte array output, write the object into it, and grab the
// raw bytes.
const COPY_ENTIRE_STREAM = 0;
begin
  try
    FStream.Size := 0;
    input.Write( FProtocol);
    aStm.CopyFrom( FStream, COPY_ENTIRE_STREAM);
  finally
    FStream.Size := 0;  // free any allocated memory
  end;
end;


{ TDeserializer }


constructor TDeserializer.Create();
// Create a new TDeserializer that uses the TBinaryProtocol by default.
begin
  //no inherited;
  Create( TBinaryProtocolImpl.TFactory.Create);
end;


constructor TDeserializer.Create( const factory : IProtocolFactory);
// Create a new TDeserializer.
// It will use the TProtocol specified by the factory that is passed in.
var adapter : IThriftStream;
begin
  inherited Create;
  FStream    := TMemoryStream.Create;
  adapter    := TThriftStreamAdapterDelphi.Create( FStream, FALSE);
  FTransport := TStreamTransportImpl.Create( adapter, nil);
  FProtocol  := factory.GetProtocol( FTransport);
end;


destructor TDeserializer.Destroy;
begin
  try
    FProtocol  := nil;
    FTransport := nil;
    FreeAndNil( FStream);
  finally
    inherited Destroy;
  end;
end;


procedure TDeserializer.Deserialize( const input : TBytes; const target : IBase);
// Deserialize the Thrift object data from the byte array.
var iBytes : Int64;
begin
  try
    iBytes := Length(input);
    FStream.Size := iBytes;
    if iBytes > 0
    then Move( input[0], FStream.Memory^, iBytes);

    target.Read( FProtocol);
  finally
    FStream.Size := 0;  // free any allocated memory
  end;
end;


procedure TDeserializer.Deserialize( const input : TStream; const target : IBase);
// Deserialize the Thrift object data from the byte array.
const COPY_ENTIRE_STREAM = 0;
var before : Int64;
begin
  try
    before := FStream.Position;
    FStream.CopyFrom( input, COPY_ENTIRE_STREAM);
    FStream.Position := before;
    target.Read( FProtocol);
  finally
    FStream.Size := 0;  // free any allocated memory
  end;
end;


end.

