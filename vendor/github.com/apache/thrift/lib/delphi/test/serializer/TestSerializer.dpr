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

program TestSerializer;

{$APPTYPE CONSOLE}

uses
  Classes, Windows, SysUtils, Generics.Collections,
  Thrift in '..\..\src\Thrift.pas',
  Thrift.Socket in '..\..\src\Thrift.Socket.pas',
  Thrift.Transport in '..\..\src\Thrift.Transport.pas',
  Thrift.Protocol in '..\..\src\Thrift.Protocol.pas',
  Thrift.Protocol.JSON in '..\..\src\Thrift.Protocol.JSON.pas',
  Thrift.Collections in '..\..\src\Thrift.Collections.pas',
  Thrift.Server in '..\..\src\Thrift.Server.pas',
  Thrift.Console in '..\..\src\Thrift.Console.pas',
  Thrift.Utils in '..\..\src\Thrift.Utils.pas',
  Thrift.Serializer in '..\..\src\Thrift.Serializer.pas',
  Thrift.Stream in '..\..\src\Thrift.Stream.pas',
  Thrift.TypeRegistry in '..\..\src\Thrift.TypeRegistry.pas',
  DebugProtoTest,
  TestSerializer.Data;



type
  TTestSerializer = class //extends TestCase {
  private
    FProtocols : TList< IProtocolFactory>;

    class function  Serialize(const input : IBase; const factory : IProtocolFactory) : TBytes;  overload;
    class procedure Serialize(const input : IBase; const factory : IProtocolFactory; const aStream : TStream);  overload;
    class procedure Deserialize( const input : TBytes; const target : IBase; const factory : IProtocolFactory);  overload;
    class procedure Deserialize( const input : TStream; const target : IBase; const factory : IProtocolFactory);  overload;

    procedure Test_Serializer_Deserializer;

  public
    constructor Create;
    destructor Destroy;  override;

    procedure RunTests;
  end;



{ TTestSerializer }

constructor TTestSerializer.Create;
begin
  inherited Create;
  FProtocols := TList< IProtocolFactory>.Create;
  FProtocols.Add( TBinaryProtocolImpl.TFactory.Create);
  //FProtocols.Add( TCompactProtocolImpl.TFactory.Create);
  FProtocols.Add( TJSONProtocolImpl.TFactory.Create);
end;


destructor TTestSerializer.Destroy;
begin
  try
    FreeAndNil( FProtocols);
  finally
    inherited Destroy;
  end;
end;

type TMethod = (mt_Bytes, mt_Stream);


procedure TTestSerializer.Test_Serializer_Deserializer;
var level3ooe, correct : IOneOfEach;
    factory : IProtocolFactory;
    bytes   : TBytes;
    stream  : TFileStream;
    i       : Integer;
    method  : TMethod;
begin
  correct := Fixtures.CreateOneOfEach;
  stream  := TFileStream.Create( 'TestSerializer.dat', fmCreate);
  try

    for method in [Low(TMethod)..High(TMethod)] do begin
      for factory in FProtocols do begin

        // write
        level3ooe := Fixtures.CreateOneOfEach;
        case method of
          mt_Bytes:  bytes := Serialize( level3ooe, factory);
          mt_Stream: begin
            stream.Size := 0;
            Serialize( level3ooe, factory, stream);
          end
        else
          ASSERT( FALSE);
        end;

        // init + read
        level3ooe := TOneOfEachImpl.Create;
        case method of
          mt_Bytes:  Deserialize( bytes, level3ooe, factory);
          mt_Stream: begin
            stream.Position := 0;
            Deserialize( stream, level3ooe, factory);
          end
        else
          ASSERT( FALSE);
        end;


        // check
        ASSERT( level3ooe.Im_true = correct.Im_true);
        ASSERT( level3ooe.Im_false = correct.Im_false);
        ASSERT( level3ooe.A_bite = correct.A_bite);
        ASSERT( level3ooe.Integer16 = correct.Integer16);
        ASSERT( level3ooe.Integer32 = correct.Integer32);
        ASSERT( level3ooe.Integer64 = correct.Integer64);
        ASSERT( Abs( level3ooe.Double_precision - correct.Double_precision) < 1E-12);
        ASSERT( level3ooe.Some_characters = correct.Some_characters);
        ASSERT( level3ooe.Zomg_unicode = correct.Zomg_unicode);
        ASSERT( level3ooe.What_who = correct.What_who);
        ASSERT( level3ooe.Base64 = correct.Base64);

        ASSERT( level3ooe.Byte_list.Count = correct.Byte_list.Count);
        for i := 0 to level3ooe.Byte_list.Count-1
        do ASSERT( level3ooe.Byte_list[i] = correct.Byte_list[i]);

        ASSERT( level3ooe.I16_list.Count = correct.I16_list.Count);
        for i := 0 to level3ooe.I16_list.Count-1
        do ASSERT( level3ooe.I16_list[i] = correct.I16_list[i]);

        ASSERT( level3ooe.I64_list.Count = correct.I64_list.Count);
        for i := 0 to level3ooe.I64_list.Count-1
        do ASSERT( level3ooe.I64_list[i] = correct.I64_list[i]);
      end;
    end;

  finally
    stream.Free;
  end;
end;


procedure TTestSerializer.RunTests;
begin
  try
    Test_Serializer_Deserializer;
  except
    on e:Exception do begin
      Writeln( e.Message);
      Write('Hit ENTER to close ... '); Readln;
    end;
  end;
end;


class function TTestSerializer.Serialize(const input : IBase; const factory : IProtocolFactory) : TBytes;
var serial : TSerializer;
begin
  serial := TSerializer.Create( factory);
  try
    result := serial.Serialize( input);
  finally
    serial.Free;
  end;
end;


class procedure TTestSerializer.Serialize(const input : IBase; const factory : IProtocolFactory; const aStream : TStream);
var serial : TSerializer;
begin
  serial := TSerializer.Create( factory);
  try
    serial.Serialize( input, aStream);
  finally
    serial.Free;
  end;
end;


class procedure TTestSerializer.Deserialize( const input : TBytes; const target : IBase; const factory : IProtocolFactory);
var serial : TDeserializer;
begin
  serial := TDeserializer.Create( factory);
  try
    serial.Deserialize( input, target);
  finally
    serial.Free;
  end;
end;

class procedure TTestSerializer.Deserialize( const input : TStream; const target : IBase; const factory : IProtocolFactory);
var serial : TDeserializer;
begin
  serial := TDeserializer.Create( factory);
  try
    serial.Deserialize( input, target);
  finally
    serial.Free;
  end;
end;


var test : TTestSerializer;
begin
  test := TTestSerializer.Create;
  try
    test.RunTests;
  finally
    test.Free;
  end;
end.

