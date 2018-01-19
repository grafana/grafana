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

unit Thrift.Collections;

interface

uses
  Generics.Collections, Generics.Defaults, Thrift.Utils;

type

{$IF CompilerVersion < 21.0}
  TArray<T> = array of T;
{$IFEND}

  IThriftContainer = interface
    ['{93DEF5A0-D162-461A-AB22-5B4EE0734050}']
    function ToString: string;
  end;

  IThriftDictionary<TKey,TValue> = interface(IThriftContainer)
    ['{25EDD506-F9D1-4008-A40F-5940364B7E46}']
    function GetEnumerator: TEnumerator<TPair<TKey,TValue>>;

    function GetKeys: TDictionary<TKey,TValue>.TKeyCollection;
    function GetValues: TDictionary<TKey,TValue>.TValueCollection;
    function GetItem(const Key: TKey): TValue;
    procedure SetItem(const Key: TKey; const Value: TValue);
    function GetCount: Integer;

    procedure Add(const Key: TKey; const Value: TValue);
    procedure Remove(const Key: TKey);
{$IF CompilerVersion >= 21.0}
    function ExtractPair(const Key: TKey): TPair<TKey,TValue>;
{$IFEND}
    procedure Clear;
    procedure TrimExcess;
    function TryGetValue(const Key: TKey; out Value: TValue): Boolean;
    procedure AddOrSetValue(const Key: TKey; const Value: TValue);
    function ContainsKey(const Key: TKey): Boolean;
    function ContainsValue(const Value: TValue): Boolean;
    function ToArray: TArray<TPair<TKey,TValue>>;

    property Items[const Key: TKey]: TValue read GetItem write SetItem; default;
    property Count: Integer read GetCount;
    property Keys: TDictionary<TKey,TValue>.TKeyCollection read GetKeys;
    property Values: TDictionary<TKey,TValue>.TValueCollection read GetValues;
  end;

  TThriftDictionaryImpl<TKey,TValue> = class( TInterfacedObject, IThriftDictionary<TKey,TValue>)
  private
    FDictionaly : TDictionary<TKey,TValue>;
  protected
    function GetEnumerator: TEnumerator<TPair<TKey,TValue>>;

    function GetKeys: TDictionary<TKey,TValue>.TKeyCollection;
    function GetValues: TDictionary<TKey,TValue>.TValueCollection;
    function GetItem(const Key: TKey): TValue;
    procedure SetItem(const Key: TKey; const Value: TValue);
    function GetCount: Integer;

    procedure Add(const Key: TKey; const Value: TValue);
    procedure Remove(const Key: TKey);
{$IF CompilerVersion >= 21.0}
    function ExtractPair(const Key: TKey): TPair<TKey,TValue>;
{$IFEND}
    procedure Clear;
    procedure TrimExcess;
    function TryGetValue(const Key: TKey; out Value: TValue): Boolean;
    procedure AddOrSetValue(const Key: TKey; const Value: TValue);
    function ContainsKey(const Key: TKey): Boolean;
    function ContainsValue(const Value: TValue): Boolean;
    function ToArray: TArray<TPair<TKey,TValue>>;
    property Items[const Key: TKey]: TValue read GetItem write SetItem; default;
    property Count: Integer read GetCount;
    property Keys: TDictionary<TKey,TValue>.TKeyCollection read GetKeys;
    property Values: TDictionary<TKey,TValue>.TValueCollection read GetValues;
  public
    constructor Create(ACapacity: Integer = 0);
    destructor Destroy; override;
  end;

  IThriftList<T> = interface(IThriftContainer)
    ['{29BEEE31-9CB4-401B-AA04-5148A75F473B}']
    function GetEnumerator: TEnumerator<T>;
    function GetCapacity: Integer;
    procedure SetCapacity(Value: Integer);
    function GetCount: Integer;
    procedure SetCount(Value: Integer);
    function GetItem(Index: Integer): T;
    procedure SetItem(Index: Integer; const Value: T);
    function Add(const Value: T): Integer;
    procedure AddRange(const Values: array of T); overload;
    procedure AddRange(const Collection: IEnumerable<T>); overload;
    procedure AddRange(Collection: TEnumerable<T>); overload;
    procedure Insert(Index: Integer; const Value: T);
    procedure InsertRange(Index: Integer; const Values: array of T); overload;
    procedure InsertRange(Index: Integer; const Collection: IEnumerable<T>); overload;
    procedure InsertRange(Index: Integer; const Collection: TEnumerable<T>); overload;
    function Remove(const Value: T): Integer;
    procedure Delete(Index: Integer);
    procedure DeleteRange(AIndex, ACount: Integer);
    function Extract(const Value: T): T;
{$IF CompilerVersion >= 21.0}
    procedure Exchange(Index1, Index2: Integer);
    procedure Move(CurIndex, NewIndex: Integer);
    function First: T;
    function Last: T;
{$IFEND}
    procedure Clear;
    function Contains(const Value: T): Boolean;
    function IndexOf(const Value: T): Integer;
    function LastIndexOf(const Value: T): Integer;
    procedure Reverse;
    procedure Sort; overload;
    procedure Sort(const AComparer: IComparer<T>); overload;
    function BinarySearch(const Item: T; out Index: Integer): Boolean; overload;
    function BinarySearch(const Item: T; out Index: Integer; const AComparer: IComparer<T>): Boolean; overload;
    procedure TrimExcess;
    function ToArray: TArray<T>;
    property Capacity: Integer read GetCapacity write SetCapacity;
    property Count: Integer read GetCount write SetCount;
    property Items[Index: Integer]: T read GetItem write SetItem; default;
  end;

  TThriftListImpl<T> = class( TInterfacedObject, IThriftList<T>)
  private
    FList : TList<T>;
  protected
    function GetEnumerator: TEnumerator<T>;
    function GetCapacity: Integer;
    procedure SetCapacity(Value: Integer);
    function GetCount: Integer;
    procedure SetCount(Value: Integer);
    function GetItem(Index: Integer): T;
    procedure SetItem(Index: Integer; const Value: T);
    function Add(const Value: T): Integer;
    procedure AddRange(const Values: array of T); overload;
    procedure AddRange(const Collection: IEnumerable<T>); overload;
    procedure AddRange(Collection: TEnumerable<T>); overload;
    procedure Insert(Index: Integer; const Value: T);
    procedure InsertRange(Index: Integer; const Values: array of T); overload;
    procedure InsertRange(Index: Integer; const Collection: IEnumerable<T>); overload;
    procedure InsertRange(Index: Integer; const Collection: TEnumerable<T>); overload;
    function Remove(const Value: T): Integer;
    procedure Delete(Index: Integer);
    procedure DeleteRange(AIndex, ACount: Integer);
    function Extract(const Value: T): T;
{$IF CompilerVersion >= 21.0}
    procedure Exchange(Index1, Index2: Integer);
    procedure Move(CurIndex, NewIndex: Integer);
    function First: T;
    function Last: T;
{$IFEND}
    procedure Clear;
    function Contains(const Value: T): Boolean;
    function IndexOf(const Value: T): Integer;
    function LastIndexOf(const Value: T): Integer;
    procedure Reverse;
    procedure Sort; overload;
    procedure Sort(const AComparer: IComparer<T>); overload;
    function BinarySearch(const Item: T; out Index: Integer): Boolean; overload;
    function BinarySearch(const Item: T; out Index: Integer; const AComparer: IComparer<T>): Boolean; overload;
    procedure TrimExcess;
    function ToArray: TArray<T>;
    property Capacity: Integer read GetCapacity write SetCapacity;
    property Count: Integer read GetCount write SetCount;
    property Items[Index: Integer]: T read GetItem write SetItem; default;
  public
    constructor Create;
    destructor Destroy; override;
  end;

  IHashSet<TValue> = interface(IThriftContainer)
    ['{0923A3B5-D4D4-48A8-91AD-40238E2EAD66}']
    function GetEnumerator: TEnumerator<TValue>;
    function GetIsReadOnly: Boolean;
    function GetCount: Integer;
    property Count: Integer read GetCount;
    property IsReadOnly: Boolean read GetIsReadOnly;
    procedure Add( const item: TValue);
    procedure Clear;
    function Contains( const item: TValue): Boolean;
    procedure CopyTo(var A: TArray<TValue>; arrayIndex: Integer);
    function Remove( const item: TValue ): Boolean;
  end;

  THashSetImpl<TValue> = class( TInterfacedObject, IHashSet<TValue>)
  private
    FDictionary : IThriftDictionary<TValue,Integer>;
    FIsReadOnly: Boolean;
  protected
    function GetEnumerator: TEnumerator<TValue>;
    function GetIsReadOnly: Boolean;
    function GetCount: Integer;
    property Count: Integer read GetCount;
    property IsReadOnly: Boolean read FIsReadOnly;
    procedure Add( const item: TValue);
    procedure Clear;
    function Contains( const item: TValue): Boolean;
    procedure CopyTo(var A: TArray<TValue>; arrayIndex: Integer);
    function Remove( const item: TValue ): Boolean;
  public
    constructor Create;
  end;

implementation

{ THashSetImpl<TValue> }

procedure THashSetImpl<TValue>.Add( const item: TValue);
begin
  if not FDictionary.ContainsKey(item) then
  begin
    FDictionary.Add( item, 0);
  end;
end;

procedure THashSetImpl<TValue>.Clear;
begin
  FDictionary.Clear;
end;

function THashSetImpl<TValue>.Contains( const item: TValue): Boolean;
begin
  Result := FDictionary.ContainsKey(item);
end;

procedure THashSetImpl<TValue>.CopyTo(var A: TArray<TValue>; arrayIndex: Integer);
var
  i : Integer;
  Enumlator : TEnumerator<TValue>;
begin
  Enumlator := GetEnumerator;
  while Enumlator.MoveNext do
  begin
    A[arrayIndex] := Enumlator.Current;
    Inc(arrayIndex);
  end;
end;

constructor THashSetImpl<TValue>.Create;
begin
  inherited;
  FDictionary := TThriftDictionaryImpl<TValue,Integer>.Create;
end;

function THashSetImpl<TValue>.GetCount: Integer;
begin
  Result := FDictionary.Count;
end;

function THashSetImpl<TValue>.GetEnumerator: TEnumerator<TValue>;
begin
  Result := FDictionary.Keys.GetEnumerator;
end;

function THashSetImpl<TValue>.GetIsReadOnly: Boolean;
begin
  Result := FIsReadOnly;
end;

function THashSetImpl<TValue>.Remove( const item: TValue): Boolean;
begin
  Result := False;
  if FDictionary.ContainsKey( item ) then
  begin
    FDictionary.Remove( item );
    Result := not FDictionary.ContainsKey( item );
  end;
end;

{ TThriftDictionaryImpl<TKey, TValue> }

procedure TThriftDictionaryImpl<TKey, TValue>.Add(const Key: TKey;
  const Value: TValue);
begin
  FDictionaly.Add( Key, Value);
end;

procedure TThriftDictionaryImpl<TKey, TValue>.AddOrSetValue(const Key: TKey;
  const Value: TValue);
begin
  FDictionaly.AddOrSetValue( Key, Value);
end;

procedure TThriftDictionaryImpl<TKey, TValue>.Clear;
begin
  FDictionaly.Clear;
end;

function TThriftDictionaryImpl<TKey, TValue>.ContainsKey(
  const Key: TKey): Boolean;
begin
  Result := FDictionaly.ContainsKey( Key );
end;

function TThriftDictionaryImpl<TKey, TValue>.ContainsValue(
  const Value: TValue): Boolean;
begin
  Result := FDictionaly.ContainsValue( Value );
end;

constructor TThriftDictionaryImpl<TKey, TValue>.Create(ACapacity: Integer);
begin
  inherited Create;
  FDictionaly := TDictionary<TKey,TValue>.Create( ACapacity );
end;

destructor TThriftDictionaryImpl<TKey, TValue>.Destroy;
begin
  FDictionaly.Free;
  inherited;
end;

{$IF CompilerVersion >= 21.0}
function TThriftDictionaryImpl<TKey, TValue>.ExtractPair( const Key: TKey): TPair<TKey, TValue>;
begin
  Result := FDictionaly.ExtractPair( Key);
end;
{$IFEND}

function TThriftDictionaryImpl<TKey, TValue>.GetCount: Integer;
begin
  Result := FDictionaly.Count;
end;

function TThriftDictionaryImpl<TKey, TValue>.GetEnumerator: TEnumerator<TPair<TKey, TValue>>;
begin
  Result := FDictionaly.GetEnumerator;
end;

function TThriftDictionaryImpl<TKey, TValue>.GetItem(const Key: TKey): TValue;
begin
  Result := FDictionaly.Items[Key];
end;

function TThriftDictionaryImpl<TKey, TValue>.GetKeys: TDictionary<TKey, TValue>.TKeyCollection;
begin
  Result := FDictionaly.Keys;
end;

function TThriftDictionaryImpl<TKey, TValue>.GetValues: TDictionary<TKey, TValue>.TValueCollection;
begin
  Result := FDictionaly.Values;
end;

procedure TThriftDictionaryImpl<TKey, TValue>.Remove(const Key: TKey);
begin
  FDictionaly.Remove( Key );
end;

procedure TThriftDictionaryImpl<TKey, TValue>.SetItem(const Key: TKey;
  const Value: TValue);
begin
  FDictionaly.AddOrSetValue( Key, Value);
end;

function TThriftDictionaryImpl<TKey, TValue>.ToArray: TArray<TPair<TKey, TValue>>;
{$IF CompilerVersion < 22.0}
var
  x : TPair<TKey, TValue>;
  i : Integer;
{$IFEND}
begin
{$IF CompilerVersion < 22.0}
  SetLength(Result, Count);
  i := 0;
  for x in FDictionaly do
  begin
    Result[i] := x;
    Inc( i );
  end;
{$ELSE}
  Result := FDictionaly.ToArray;
{$IFEND}
end;

procedure TThriftDictionaryImpl<TKey, TValue>.TrimExcess;
begin
  FDictionaly.TrimExcess;
end;

function TThriftDictionaryImpl<TKey, TValue>.TryGetValue(const Key: TKey;
  out Value: TValue): Boolean;
begin
  Result := FDictionaly.TryGetValue( Key, Value);
end;

{ TThriftListImpl<T> }

function TThriftListImpl<T>.Add(const Value: T): Integer;
begin
  Result := FList.Add( Value );
end;

procedure TThriftListImpl<T>.AddRange(Collection: TEnumerable<T>);
begin
  FList.AddRange( Collection );
end;

procedure TThriftListImpl<T>.AddRange(const Collection: IEnumerable<T>);
begin
  FList.AddRange( Collection );
end;

procedure TThriftListImpl<T>.AddRange(const Values: array of T);
begin
  FList.AddRange( Values );
end;

function TThriftListImpl<T>.BinarySearch(const Item: T;
  out Index: Integer): Boolean;
begin
  Result := FList.BinarySearch( Item, Index);
end;

function TThriftListImpl<T>.BinarySearch(const Item: T; out Index: Integer;
  const AComparer: IComparer<T>): Boolean;
begin
  Result := FList.BinarySearch( Item, Index, AComparer);
end;

procedure TThriftListImpl<T>.Clear;
begin
  FList.Clear;
end;

function TThriftListImpl<T>.Contains(const Value: T): Boolean;
begin
  Result := FList.Contains( Value );
end;

constructor TThriftListImpl<T>.Create;
begin
  inherited;
  FList := TList<T>.Create;
end;

procedure TThriftListImpl<T>.Delete(Index: Integer);
begin
  FList.Delete( Index )
end;

procedure TThriftListImpl<T>.DeleteRange(AIndex, ACount: Integer);
begin
  FList.DeleteRange( AIndex, ACount)
end;

destructor TThriftListImpl<T>.Destroy;
begin
  FList.Free;
  inherited;
end;

{$IF CompilerVersion >= 21.0}
procedure TThriftListImpl<T>.Exchange(Index1, Index2: Integer);
begin
  FList.Exchange( Index1, Index2 )
end;
{$IFEND}

function TThriftListImpl<T>.Extract(const Value: T): T;
begin
  Result := FList.Extract( Value )
end;

{$IF CompilerVersion >= 21.0}
function TThriftListImpl<T>.First: T;
begin
  Result := FList.First;
end;
{$IFEND}

function TThriftListImpl<T>.GetCapacity: Integer;
begin
  Result := FList.Capacity;
end;

function TThriftListImpl<T>.GetCount: Integer;
begin
  Result := FList.Count;
end;

function TThriftListImpl<T>.GetEnumerator: TEnumerator<T>;
begin
  Result := FList.GetEnumerator;
end;

function TThriftListImpl<T>.GetItem(Index: Integer): T;
begin
  Result := FList[Index];
end;

function TThriftListImpl<T>.IndexOf(const Value: T): Integer;
begin
  Result := FList.IndexOf( Value );
end;

procedure TThriftListImpl<T>.Insert(Index: Integer; const Value: T);
begin
  FList.Insert( Index, Value);
end;

procedure TThriftListImpl<T>.InsertRange(Index: Integer;
  const Collection: TEnumerable<T>);
begin
  FList.InsertRange( Index, Collection );
end;

procedure TThriftListImpl<T>.InsertRange(Index: Integer;
  const Values: array of T);
begin
  FList.InsertRange( Index, Values);
end;

procedure TThriftListImpl<T>.InsertRange(Index: Integer;
  const Collection: IEnumerable<T>);
begin
  FList.InsertRange( Index, Collection );
end;

{$IF CompilerVersion >= 21.0}
function TThriftListImpl<T>.Last: T;
begin
  Result := FList.Last;
end;
{$IFEND}

function TThriftListImpl<T>.LastIndexOf(const Value: T): Integer;
begin
  Result := FList.LastIndexOf( Value );
end;

{$IF CompilerVersion >= 21.0}
procedure TThriftListImpl<T>.Move(CurIndex, NewIndex: Integer);
begin
  FList.Move( CurIndex,  NewIndex);
end;
{$IFEND}

function TThriftListImpl<T>.Remove(const Value: T): Integer;
begin
  Result := FList.Remove( Value );
end;

procedure TThriftListImpl<T>.Reverse;
begin
  FList.Reverse;
end;

procedure TThriftListImpl<T>.SetCapacity(Value: Integer);
begin
  FList.Capacity := Value;
end;

procedure TThriftListImpl<T>.SetCount(Value: Integer);
begin
  FList.Count := Value;
end;

procedure TThriftListImpl<T>.SetItem(Index: Integer; const Value: T);
begin
  FList[Index] := Value;
end;

procedure TThriftListImpl<T>.Sort;
begin
  FList.Sort;
end;

procedure TThriftListImpl<T>.Sort(const AComparer: IComparer<T>);
begin
  FList.Sort;
end;

function TThriftListImpl<T>.ToArray: TArray<T>;
{$IF CompilerVersion < 22.0}
var
  x : T;
  i : Integer;
{$IFEND}
begin
{$IF CompilerVersion < 22.0}
  SetLength(Result, Count);
  i := 0;
  for x in FList do
  begin
    Result[i] := x;
    Inc( i );
  end;
{$ELSE}
  Result := FList.ToArray;
{$IFEND}
end;

procedure TThriftListImpl<T>.TrimExcess;
begin
  FList.TrimExcess;
end;

end.
