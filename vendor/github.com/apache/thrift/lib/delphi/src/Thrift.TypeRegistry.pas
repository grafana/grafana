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

unit Thrift.TypeRegistry;

interface

uses
  Generics.Collections, TypInfo,
  Thrift.Protocol;

type
  TFactoryMethod<T> = function:T;

  TypeRegistry = class
  private
    class var FTypeInfoToFactoryLookup : TDictionary<Pointer, Pointer>;
  public
    class constructor Create;
    class destructor Destroy;
    class procedure RegisterTypeFactory<F>(const aFactoryMethod: TFactoryMethod<F>);
    class function  Construct<F>: F;
    class function  ConstructFromTypeInfo(const aTypeInfo: PTypeInfo): IBase;
  end;

implementation


{ TypeRegistration }

class constructor TypeRegistry.Create;
begin
  FTypeInfoToFactoryLookup := TDictionary<Pointer, Pointer>.Create;
end;

class destructor TypeRegistry.Destroy;
begin
  FTypeInfoToFactoryLookup.Free;
end;

class procedure TypeRegistry.RegisterTypeFactory<F>(const aFactoryMethod: TFactoryMethod<F>);
var
  TypeInfo     : Pointer;
begin
  TypeInfo := System.TypeInfo(F);

  if (TypeInfo <> nil) and (PTypeInfo(TypeInfo).Kind = tkInterface)
  then FTypeInfoToFactoryLookup.AddOrSetValue(TypeInfo, @aFactoryMethod);
end;

class function TypeRegistry.Construct<F>: F;
var
  TypeInfo     : PTypeInfo;
  Factory      : Pointer;
begin
  Result := default(F);

  TypeInfo := System.TypeInfo(F);

  if Assigned(TypeInfo) and (TypeInfo.Kind = tkInterface)
  then begin
    if FTypeInfoToFactoryLookup.TryGetValue(TypeInfo, Factory)
    then Result := TFactoryMethod<F>(Factory)();
  end;
end;

class function TypeRegistry.ConstructFromTypeInfo(const aTypeInfo: PTypeInfo): IBase;
var
  Factory      : Pointer;
begin
  Result := nil;
  if FTypeInfoToFactoryLookup.TryGetValue(aTypeInfo, Factory)
  then Result := IBase(TFactoryMethod<IBase>(Factory)());
end;




end.
