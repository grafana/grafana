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

unit Thrift.Protocol.Compact;

interface

uses
  Classes,
  SysUtils,
  Math,
  Generics.Collections,
  Thrift.Transport,
  Thrift.Protocol,
  Thrift.Utils;

type
  ICompactProtocol = interface( IProtocol)
    ['{C01927EC-021A-45F7-93B1-23D6A5420EDD}']
  end;

  // Compact protocol implementation for thrift.
  // Adapted from the C# version.
  TCompactProtocolImpl = class( TProtocolImpl, ICompactProtocol)
  public
    type
      TFactory = class( TInterfacedObject, IProtocolFactory)
      public
        function GetProtocol( const trans: ITransport): IProtocol;
      end;

  private const

    { TODO
    static TStruct ANONYMOUS_STRUCT = new TStruct("");
    static TField TSTOP = new TField("", TType.Stop, (short)0);
    }

    PROTOCOL_ID       = Byte( $82);
    VERSION           = Byte( 1);
    VERSION_MASK      = Byte( $1F); // 0001 1111
    TYPE_MASK         = Byte( $E0); // 1110 0000
    TYPE_BITS         = Byte( $07); // 0000 0111
    TYPE_SHIFT_AMOUNT = Byte( 5);

  private type
    // All of the on-wire type codes.
    Types = (
      STOP          = $00,
      BOOLEAN_TRUE  = $01,
      BOOLEAN_FALSE = $02,
      BYTE_         = $03,
      I16           = $04,
      I32           = $05,
      I64           = $06,
      DOUBLE_       = $07,
      BINARY        = $08,
      LIST          = $09,
      SET_          = $0A,
      MAP           = $0B,
      STRUCT        = $0C
    );

  private const
    ttypeToCompactType : array[TType] of Types = (
      Types.STOP,           // Stop    = 0,
      Types(-1),            // Void    = 1,
      Types.BOOLEAN_TRUE,   // Bool_   = 2,
      Types.BYTE_,          // Byte_   = 3,
      Types.DOUBLE_,        // Double_ = 4,
      Types(-5),            // unused
      Types.I16,            // I16     = 6,
      Types(-7),            // unused
      Types.I32,            // I32     = 8,
      Types(-9),            // unused
      Types.I64,            // I64     = 10,
      Types.BINARY,         // String_ = 11,
      Types.STRUCT,         // Struct  = 12,
      Types.MAP,            // Map     = 13,
      Types.SET_,           // Set_    = 14,
      Types.LIST            // List    = 15,
    );

    tcompactTypeToType : array[Types] of TType = (
      TType.Stop,       // STOP
      TType.Bool_,      // BOOLEAN_TRUE
      TType.Bool_,      // BOOLEAN_FALSE
      TType.Byte_,      // BYTE_
      TType.I16,        // I16
      TType.I32,        // I32
      TType.I64,        // I64
      TType.Double_,    // DOUBLE_
      TType.String_,    // BINARY
      TType.List,       // LIST
      TType.Set_,       // SET_
      TType.Map,        // MAP
      TType.Struct      // STRUCT
    );

  private
    // Used to keep track of the last field for the current and previous structs,
    // so we can do the delta stuff.
    lastField_ : TStack<Integer>;
    lastFieldId_ : Integer;

    // If we encounter a boolean field begin, save the TField here so it can
    // have the value incorporated.
    private booleanField_ : IField;

    // If we Read a field header, and it's a boolean field, save the boolean
    // value here so that ReadBool can use it.
    private  boolValue_  : ( unused, bool_true, bool_false);

  public
    constructor Create(const trans : ITransport);
    destructor Destroy;  override;

    procedure Reset;

  private
    procedure WriteByteDirect( const b : Byte);  overload;

    // Writes a byte without any possibility of all that field header nonsense.
    procedure WriteByteDirect( const n : Integer);  overload;

    // Write an i32 as a varint. Results in 1-5 bytes on the wire.
    // TODO: make a permanent buffer like WriteVarint64?
    procedure WriteVarint32( n : Cardinal);

  private
    // The workhorse of WriteFieldBegin. It has the option of doing a 'type override'
    // of the type header. This is used specifically in the boolean field case.
    procedure WriteFieldBeginInternal( const field : IField; typeOverride : Byte);

  public
    procedure WriteMessageBegin( const msg: IMessage); override;
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
    procedure WriteDouble( const dub: Double); override;
    procedure WriteBinary( const b: TBytes); overload; override;

  private
    class function  DoubleToInt64Bits( const db : Double) : Int64;
    class function  Int64BitsToDouble( const i64 : Int64) : Double;

    // Abstract method for writing the start of lists and sets. List and sets on
    // the wire differ only by the type indicator.
    procedure WriteCollectionBegin( const elemType : TType; size : Integer);

    procedure WriteVarint64( n : UInt64);

    // Convert l into a zigzag long. This allows negative numbers to be
    // represented compactly as a varint.
    class function  longToZigzag( const n : Int64) : UInt64;

    // Convert n into a zigzag int. This allows negative numbers to be
    // represented compactly as a varint.
    class function intToZigZag( const n : Integer) : Cardinal;

    //Convert a Int64 into little-endian bytes in buf starting at off and going until off+7.
    class procedure fixedLongToBytes( const n : Int64; var buf : TBytes);

  public
    function  ReadMessageBegin: IMessage; override;
    procedure ReadMessageEnd(); override;
    function  ReadStructBegin: IStruct; override;
    procedure ReadStructEnd; override;
    function  ReadFieldBegin: IField; override;
    procedure ReadFieldEnd(); override;
    function  ReadMapBegin: IMap; override;
    procedure ReadMapEnd(); override;
    function  ReadListBegin: IList; override;
    procedure ReadListEnd(); override;
    function  ReadSetBegin: ISet; override;
    procedure ReadSetEnd(); override;
    function  ReadBool: Boolean; override;
    function  ReadByte: ShortInt; override;
    function  ReadI16: SmallInt; override;
    function  ReadI32: Integer; override;
    function  ReadI64: Int64; override;
    function  ReadDouble:Double; override;
    function  ReadBinary: TBytes; overload; override;

  private
    // Internal Reading methods

    // Read an i32 from the wire as a varint. The MSB of each byte is set
    // if there is another byte to follow. This can Read up to 5 bytes.
    function ReadVarint32 : Cardinal;

    // Read an i64 from the wire as a proper varint. The MSB of each byte is set
    // if there is another byte to follow. This can Read up to 10 bytes.
    function ReadVarint64 : UInt64;


    // encoding helpers

    // Convert from zigzag Integer to Integer.
    class function zigzagToInt( const n : Cardinal ) : Integer;

    // Convert from zigzag Int64 to Int64.
    class function zigzagToLong( const n : UInt64) : Int64;

    // Note that it's important that the mask bytes are Int64 literals,
    // otherwise they'll default to ints, and when you shift an Integer left 56 bits,
    // you just get a messed up Integer.
    class function bytesToLong( const bytes : TBytes) : Int64;

    // type testing and converting
    class function isBoolType( const b : byte) : Boolean;

    // Given a TCompactProtocol.Types constant, convert it to its corresponding TType value.
    class function getTType( const type_ : byte) : TType;

    // Given a TType value, find the appropriate TCompactProtocol.Types constant.
    class function getCompactType( const ttype : TType) : Byte;
  end;


implementation



//--- TCompactProtocolImpl.TFactory ----------------------------------------


function TCompactProtocolImpl.TFactory.GetProtocol( const trans: ITransport): IProtocol;
begin
  result := TCompactProtocolImpl.Create( trans);
end;


//--- TCompactProtocolImpl -------------------------------------------------


constructor TCompactProtocolImpl.Create(const trans: ITransport);
begin
  inherited Create( trans);

  lastFieldId_ := 0;
  lastField_ := TStack<Integer>.Create;

  booleanField_ := nil;
  boolValue_ := unused;
end;


destructor TCompactProtocolImpl.Destroy;
begin
  try
    FreeAndNil( lastField_);
  finally
    inherited Destroy;
  end;
end;



procedure TCompactProtocolImpl.Reset;
begin
  lastField_.Clear();
  lastFieldId_ := 0;
  booleanField_ := nil;
  boolValue_ := unused;
end;


// Writes a byte without any possibility of all that field header nonsense.
// Used internally by other writing methods that know they need to Write a byte.
procedure TCompactProtocolImpl.WriteByteDirect( const b : Byte);
var data : TBytes;
begin
  SetLength( data, 1);
  data[0] := b;
  Transport.Write( data);
end;


// Writes a byte without any possibility of all that field header nonsense.
procedure TCompactProtocolImpl.WriteByteDirect( const n : Integer);
begin
  WriteByteDirect( Byte(n));
end;


// Write an i32 as a varint. Results in 1-5 bytes on the wire.
procedure TCompactProtocolImpl.WriteVarint32( n : Cardinal);
var i32buf : TBytes;
    idx : Integer;
begin
  SetLength( i32buf, 5);
  idx := 0;
  while TRUE do begin
    ASSERT( idx < Length(i32buf));

    // last part?
    if ((n and not $7F) = 0) then begin
      i32buf[idx] := Byte(n);
      Inc(idx);
      Break;
    end;

    i32buf[idx] := Byte((n and $7F) or $80);
    Inc(idx);
    n := n shr 7;
  end;

  Transport.Write( i32buf, 0, idx);
end;


// Write a message header to the wire. Compact Protocol messages contain the
// protocol version so we can migrate forwards in the future if need be.
procedure TCompactProtocolImpl.WriteMessageBegin( const msg: IMessage);
var versionAndType : Byte;
begin
  Reset;

  versionAndType := Byte( VERSION and VERSION_MASK)
                 or Byte( (Cardinal(msg.Type_) shl TYPE_SHIFT_AMOUNT) and TYPE_MASK);

  WriteByteDirect( PROTOCOL_ID);
  WriteByteDirect( versionAndType);
  WriteVarint32( Cardinal(msg.SeqID));
  WriteString( msg.Name);
end;


// Write a struct begin. This doesn't actually put anything on the wire. We use it as an
// opportunity to put special placeholder markers on the field stack so we can get the
// field id deltas correct.
procedure TCompactProtocolImpl.WriteStructBegin( const struc: IStruct);
begin
  lastField_.Push(lastFieldId_);
  lastFieldId_ := 0;
end;


// Write a struct end. This doesn't actually put anything on the wire. We use this as an
// opportunity to pop the last field from the current struct off of the field stack.
procedure TCompactProtocolImpl.WriteStructEnd;
begin
  lastFieldId_ := lastField_.Pop();
end;


// Write a field header containing the field id and field type. If the difference between the
// current field id and the last one is small (< 15), then the field id will be encoded in
// the 4 MSB as a delta. Otherwise, the field id will follow the type header as a zigzag varint.
procedure TCompactProtocolImpl.WriteFieldBegin( const field: IField);
begin
  case field.Type_ of
    TType.Bool_ : booleanField_ := field; // we want to possibly include the value, so we'll wait.
  else
    WriteFieldBeginInternal(field, $FF);
  end;
end;


// The workhorse of WriteFieldBegin. It has the option of doing a 'type override'
// of the type header. This is used specifically in the boolean field case.
procedure TCompactProtocolImpl.WriteFieldBeginInternal( const field : IField; typeOverride : Byte);
var typeToWrite : Byte;
begin
  // if there's a type override, use that.
  if typeOverride = $FF
  then typeToWrite := getCompactType( field.Type_)
  else typeToWrite := typeOverride;

  // check if we can use delta encoding for the field id
  if (field.ID > lastFieldId_) and ((field.ID - lastFieldId_) <= 15)
  then begin
    // Write them together
    WriteByteDirect( ((field.ID - lastFieldId_) shl 4) or typeToWrite);
  end
  else begin
    // Write them separate
    WriteByteDirect( typeToWrite);
    WriteI16( field.ID);
  end;

  lastFieldId_ := field.ID;
end;


// Write the STOP symbol so we know there are no more fields in this struct.
procedure TCompactProtocolImpl.WriteFieldStop;
begin
  WriteByteDirect( Byte( Types.STOP));
end;


// Write a map header. If the map is empty, omit the key and value type
// headers, as we don't need any additional information to skip it.
procedure TCompactProtocolImpl.WriteMapBegin( const map: IMap);
var key, val : Byte;
begin
  if (map.Count = 0)
  then WriteByteDirect( 0)
  else begin
    WriteVarint32( Cardinal( map.Count));
    key := getCompactType(map.KeyType);
    val := getCompactType(map.ValueType);
    WriteByteDirect( (key shl 4) or val);
  end;
end;


// Write a list header.
procedure TCompactProtocolImpl.WriteListBegin( const list: IList);
begin
  WriteCollectionBegin( list.ElementType, list.Count);
end;


// Write a set header.
procedure TCompactProtocolImpl.WriteSetBegin( const set_: ISet );
begin
  WriteCollectionBegin( set_.ElementType, set_.Count);
end;


// Write a boolean value. Potentially, this could be a boolean field, in
// which case the field header info isn't written yet. If so, decide what the
// right type header is for the value and then Write the field header.
// Otherwise, Write a single byte.
procedure TCompactProtocolImpl.WriteBool( b: Boolean);
var bt : Types;
begin
  if b
  then bt := Types.BOOLEAN_TRUE
  else bt := Types.BOOLEAN_FALSE;

  if booleanField_ <> nil then begin
    // we haven't written the field header yet
    WriteFieldBeginInternal( booleanField_, Byte(bt));
    booleanField_ := nil;
  end
  else begin
    // we're not part of a field, so just Write the value.
    WriteByteDirect( Byte(bt));
  end;
end;


// Write a byte. Nothing to see here!
procedure TCompactProtocolImpl.WriteByte( b: ShortInt);
begin
  WriteByteDirect( Byte(b));
end;


// Write an I16 as a zigzag varint.
procedure TCompactProtocolImpl.WriteI16( i16: SmallInt);
begin
  WriteVarint32( intToZigZag( i16));
end;


// Write an i32 as a zigzag varint.
procedure TCompactProtocolImpl.WriteI32( i32: Integer);
begin
  WriteVarint32( intToZigZag( i32));
end;


// Write an i64 as a zigzag varint.
procedure TCompactProtocolImpl.WriteI64( const i64: Int64);
begin
  WriteVarint64( longToZigzag( i64));
end;


class function TCompactProtocolImpl.DoubleToInt64Bits( const db : Double) : Int64;
begin
  ASSERT( SizeOf(db) = SizeOf(result));
  Move( db, result, SizeOf(result));
end;


class function TCompactProtocolImpl.Int64BitsToDouble( const i64 : Int64) : Double;
begin
  ASSERT( SizeOf(i64) = SizeOf(result));
  Move( i64, result, SizeOf(result));
end;


// Write a double to the wire as 8 bytes.
procedure TCompactProtocolImpl.WriteDouble( const dub: Double);
var data : TBytes;
begin
  fixedLongToBytes( DoubleToInt64Bits(dub), data);
  Transport.Write( data);
end;


// Write a byte array, using a varint for the size.
procedure TCompactProtocolImpl.WriteBinary( const b: TBytes);
begin
  WriteVarint32( Cardinal(Length(b)));
  Transport.Write( b);
end;

procedure TCompactProtocolImpl.WriteMessageEnd;
begin
  // nothing to do
end;


procedure TCompactProtocolImpl.WriteMapEnd;
begin
  // nothing to do
end;


procedure TCompactProtocolImpl.WriteListEnd;
begin
  // nothing to do
end;


procedure TCompactProtocolImpl.WriteSetEnd;
begin
  // nothing to do
end;


procedure TCompactProtocolImpl.WriteFieldEnd;
begin
  // nothing to do
end;


// Abstract method for writing the start of lists and sets. List and sets on
// the wire differ only by the type indicator.
procedure TCompactProtocolImpl.WriteCollectionBegin( const elemType : TType; size : Integer);
begin
  if size <= 14
  then WriteByteDirect( (size shl 4) or getCompactType(elemType))
  else begin
    WriteByteDirect( $F0 or getCompactType(elemType));
    WriteVarint32( Cardinal(size));
  end;
end;


// Write an i64 as a varint. Results in 1-10 bytes on the wire.
procedure TCompactProtocolImpl.WriteVarint64( n : UInt64);
var varint64out : TBytes;
    idx : Integer;
begin
  SetLength( varint64out, 10);
  idx := 0;
  while TRUE do begin
    ASSERT( idx < Length(varint64out));

    // last one?
    if (n and not UInt64($7F)) = 0 then begin
      varint64out[idx] := Byte(n);
      Inc(idx);
      Break;
    end;

    varint64out[idx] := Byte((n and $7F) or $80);
    Inc(idx);
    n := n shr 7;
  end;

  Transport.Write( varint64out, 0, idx);
end;


// Convert l into a zigzag Int64. This allows negative numbers to be
// represented compactly as a varint.
class function TCompactProtocolImpl.longToZigzag( const n : Int64) : UInt64;
begin
  // there is no arithmetic right shift in Delphi
  if n >= 0
  then result := UInt64(n shl 1)
  else result := UInt64(n shl 1) xor $FFFFFFFFFFFFFFFF;
end;


// Convert n into a zigzag Integer. This allows negative numbers to be
// represented compactly as a varint.
class function TCompactProtocolImpl.intToZigZag( const n : Integer) : Cardinal;
begin
  // there is no arithmetic right shift in Delphi
  if n >= 0
  then result := Cardinal(n shl 1)
  else result := Cardinal(n shl 1) xor $FFFFFFFF;
end;


// Convert a Int64 into 8 little-endian bytes in buf
class procedure TCompactProtocolImpl.fixedLongToBytes( const n : Int64; var buf : TBytes);
begin
  SetLength( buf, 8);
  buf[0] := Byte( n         and $FF);
  buf[1] := Byte((n shr 8)  and $FF);
  buf[2] := Byte((n shr 16) and $FF);
  buf[3] := Byte((n shr 24) and $FF);
  buf[4] := Byte((n shr 32) and $FF);
  buf[5] := Byte((n shr 40) and $FF);
  buf[6] := Byte((n shr 48) and $FF);
  buf[7] := Byte((n shr 56) and $FF);
end;



// Read a message header.
function TCompactProtocolImpl.ReadMessageBegin : IMessage;
var protocolId, versionAndType, version, type_ : Byte;
    seqid : Integer;
    msgNm : String;
begin
  Reset;

  protocolId := Byte( ReadByte);
  if (protocolId <> PROTOCOL_ID)
  then raise TProtocolExceptionBadVersion.Create( 'Expected protocol id ' + IntToHex(PROTOCOL_ID,2)
                                                + ' but got ' + IntToHex(protocolId,2));

  versionAndType := Byte( ReadByte);
  version        := Byte( versionAndType and VERSION_MASK);
  if (version <> VERSION)
  then raise TProtocolExceptionBadVersion.Create( 'Expected version ' +IntToStr(VERSION)
                                                + ' but got ' + IntToStr(version));

  type_ := Byte( (versionAndType shr TYPE_SHIFT_AMOUNT) and TYPE_BITS);
  seqid := Integer( ReadVarint32);
  msgNm := ReadString;
  result := TMessageImpl.Create( msgNm, TMessageType(type_), seqid);
end;


// Read a struct begin. There's nothing on the wire for this, but it is our
// opportunity to push a new struct begin marker onto the field stack.
function TCompactProtocolImpl.ReadStructBegin: IStruct;
begin
  lastField_.Push( lastFieldId_);
  lastFieldId_ := 0;
  result := TStructImpl.Create('');
end;


// Doesn't actually consume any wire data, just removes the last field for
// this struct from the field stack.
procedure TCompactProtocolImpl.ReadStructEnd;
begin
  // consume the last field we Read off the wire.
  lastFieldId_ := lastField_.Pop();
end;


// Read a field header off the wire.
function TCompactProtocolImpl.ReadFieldBegin: IField;
var type_ : Byte;
    fieldId, modifier : ShortInt;
begin
  type_ := Byte( ReadByte);

  // if it's a stop, then we can return immediately, as the struct is over.
  if type_ = Byte(Types.STOP) then begin
    result := TFieldImpl.Create( '', TType.Stop, 0);
    Exit;
  end;

  // mask off the 4 MSB of the type header. it could contain a field id delta.
  modifier := ShortInt( (type_ and $F0) shr 4);
  if (modifier = 0)
  then fieldId := ReadI16    // not a delta. look ahead for the zigzag varint field id.
  else fieldId := ShortInt( lastFieldId_ + modifier); // add the delta to the last Read field id.

  result := TFieldImpl.Create( '', getTType(Byte(type_ and $0F)), fieldId);

  // if this happens to be a boolean field, the value is encoded in the type
   // save the boolean value in a special instance variable.
  if isBoolType(type_) then begin
    if Byte(type_ and $0F) = Byte(Types.BOOLEAN_TRUE)
    then boolValue_ := bool_true
    else boolValue_ := bool_false;
  end;

  // push the new field onto the field stack so we can keep the deltas going.
  lastFieldId_ := result.ID;
end;


// Read a map header off the wire. If the size is zero, skip Reading the key
// and value type. This means that 0-length maps will yield TMaps without the
// "correct" types.
function TCompactProtocolImpl.ReadMapBegin: IMap;
var size : Integer;
    keyAndValueType : Byte;
    key, val : TType;
begin
  size := Integer( ReadVarint32);
  if size = 0
  then keyAndValueType := 0
  else keyAndValueType := Byte( ReadByte);

  key := getTType( Byte( keyAndValueType shr 4));
  val := getTType( Byte( keyAndValueType and $F));
  result := TMapImpl.Create( key, val, size);
  ASSERT( (result.KeyType = key) and (result.ValueType = val));
end;


// Read a list header off the wire. If the list size is 0-14, the size will
// be packed into the element type header. If it's a longer list, the 4 MSB
// of the element type header will be $F, and a varint will follow with the
// true size.
function TCompactProtocolImpl.ReadListBegin: IList;
var size_and_type : Byte;
    size : Integer;
    type_ : TType;
begin
  size_and_type := Byte( ReadByte);

  size := (size_and_type shr 4) and $0F;
  if (size = 15)
  then size := Integer( ReadVarint32);

  type_ := getTType( size_and_type);
  result := TListImpl.Create( type_, size);
end;


// Read a set header off the wire. If the set size is 0-14, the size will
// be packed into the element type header. If it's a longer set, the 4 MSB
// of the element type header will be $F, and a varint will follow with the
// true size.
function TCompactProtocolImpl.ReadSetBegin: ISet;
var size_and_type : Byte;
    size : Integer;
    type_ : TType;
begin
  size_and_type := Byte( ReadByte);

  size := (size_and_type shr 4) and $0F;
  if (size = 15)
  then size := Integer( ReadVarint32);

  type_ := getTType( size_and_type);
  result := TSetImpl.Create( type_, size);
end;


// Read a boolean off the wire. If this is a boolean field, the value should
// already have been Read during ReadFieldBegin, so we'll just consume the
// pre-stored value. Otherwise, Read a byte.
function TCompactProtocolImpl.ReadBool: Boolean;
begin
  if boolValue_ <> unused then begin
    result := (boolValue_ = bool_true);
    boolValue_ := unused;
    Exit;
  end;

  result := (Byte(ReadByte) = Byte(Types.BOOLEAN_TRUE));
end;


// Read a single byte off the wire. Nothing interesting here.
function TCompactProtocolImpl.ReadByte: ShortInt;
var data : TBytes;
begin
  SetLength( data, 1);
  Transport.ReadAll( data, 0, 1);
  result := ShortInt(data[0]);
end;


// Read an i16 from the wire as a zigzag varint.
function TCompactProtocolImpl.ReadI16: SmallInt;
begin
  result := SmallInt( zigzagToInt( ReadVarint32));
end;


// Read an i32 from the wire as a zigzag varint.
function TCompactProtocolImpl.ReadI32: Integer;
begin
  result := zigzagToInt( ReadVarint32);
end;


// Read an i64 from the wire as a zigzag varint.
function TCompactProtocolImpl.ReadI64: Int64;
begin
  result := zigzagToLong( ReadVarint64);
end;


// No magic here - just Read a double off the wire.
function TCompactProtocolImpl.ReadDouble:Double;
var longBits : TBytes;
begin
  SetLength( longBits, 8);
  Transport.ReadAll( longBits, 0, 8);
  result := Int64BitsToDouble( bytesToLong( longBits));
end;


// Read a byte[] from the wire.
function TCompactProtocolImpl.ReadBinary: TBytes;
var length : Integer;
begin
  length := Integer( ReadVarint32);
  SetLength( result, length);
  if (length > 0)
  then Transport.ReadAll( result, 0, length);
end;


procedure TCompactProtocolImpl.ReadMessageEnd;
begin
  // nothing to do
end;


procedure TCompactProtocolImpl.ReadFieldEnd;
begin
  // nothing to do
end;


procedure TCompactProtocolImpl.ReadMapEnd;
begin
  // nothing to do
end;


procedure TCompactProtocolImpl.ReadListEnd;
begin
  // nothing to do
end;


procedure TCompactProtocolImpl.ReadSetEnd;
begin
  // nothing to do
end;



// Read an i32 from the wire as a varint. The MSB of each byte is set
// if there is another byte to follow. This can Read up to 5 bytes.
function TCompactProtocolImpl.ReadVarint32 : Cardinal;
var shift : Integer;
    b : Byte;
begin
  result := 0;
  shift  := 0;
  while TRUE do begin
    b := Byte( ReadByte);
    result := result or (Cardinal(b and $7F) shl shift);
    if ((b and $80) <> $80)
    then Break;
    Inc( shift, 7);
  end;
end;


// Read an i64 from the wire as a proper varint. The MSB of each byte is set
// if there is another byte to follow. This can Read up to 10 bytes.
function TCompactProtocolImpl.ReadVarint64 : UInt64;
var shift : Integer;
    b : Byte;
begin
  result := 0;
  shift  := 0;
  while TRUE do begin
    b := Byte( ReadByte);
    result := result or (UInt64(b and $7F) shl shift);
    if ((b and $80) <> $80)
    then Break;
    Inc( shift, 7);
  end;
end;


// Convert from zigzag Integer to Integer.
class function TCompactProtocolImpl.zigzagToInt( const n : Cardinal ) : Integer;
begin
  result := Integer(n shr 1) xor (-Integer(n and 1));
end;


// Convert from zigzag Int64 to Int64.
class function TCompactProtocolImpl.zigzagToLong( const n : UInt64) : Int64;
begin
  result := Int64(n shr 1) xor (-Int64(n and 1));
end;


// Note that it's important that the mask bytes are Int64 literals,
// otherwise they'll default to ints, and when you shift an Integer left 56 bits,
// you just get a messed up Integer.
class function TCompactProtocolImpl.bytesToLong( const bytes : TBytes) : Int64;
begin
  ASSERT( Length(bytes) >= 8);
  result := (Int64(bytes[7] and $FF) shl 56) or
            (Int64(bytes[6] and $FF) shl 48) or
            (Int64(bytes[5] and $FF) shl 40) or
            (Int64(bytes[4] and $FF) shl 32) or
            (Int64(bytes[3] and $FF) shl 24) or
            (Int64(bytes[2] and $FF) shl 16) or
            (Int64(bytes[1] and $FF) shl  8) or
            (Int64(bytes[0] and $FF));
end;


class function TCompactProtocolImpl.isBoolType( const b : byte) : Boolean;
var lowerNibble : Byte;
begin
  lowerNibble := b and $0f;
  result := (Types(lowerNibble) in [Types.BOOLEAN_TRUE, Types.BOOLEAN_FALSE]);
end;


// Given a TCompactProtocol.Types constant, convert it to its corresponding TType value.
class function TCompactProtocolImpl.getTType( const type_ : byte) : TType;
var tct : Types;
begin
  tct := Types( type_ and $0F);
  if tct in [Low(Types)..High(Types)]
  then result := tcompactTypeToType[tct]
  else raise TProtocolExceptionInvalidData.Create('don''t know what type: '+IntToStr(Ord(tct)));
end;


// Given a TType value, find the appropriate TCompactProtocol.Types constant.
class function TCompactProtocolImpl.getCompactType( const ttype : TType) : Byte;
begin
  if ttype in VALID_TTYPES
  then result := Byte( ttypeToCompactType[ttype])
  else raise TProtocolExceptionInvalidData.Create('don''t know what type: '+IntToStr(Ord(ttype)));
end;


//--- unit tests -------------------------------------------

{$IFDEF Debug}
procedure TestDoubleToInt64Bits;

  procedure TestPair( const a : Double; const b : Int64);
  begin
    ASSERT( TCompactProtocolImpl.DoubleToInt64Bits(a) = b);
    ASSERT( TCompactProtocolImpl.Int64BitsToDouble(b) = a);
  end;

begin
  TestPair( 1.0000000000000000E+000,  Int64($3FF0000000000000));
  TestPair( 1.5000000000000000E+001,  Int64($402E000000000000));
  TestPair( 2.5500000000000000E+002,  Int64($406FE00000000000));
  TestPair( 4.2949672950000000E+009,  Int64($41EFFFFFFFE00000));
  TestPair( 3.9062500000000000E-003,  Int64($3F70000000000000));
  TestPair( 2.3283064365386963E-010,  Int64($3DF0000000000000));
  TestPair( 1.2345678901230000E-300,  Int64($01AA74FE1C1E7E45));
  TestPair( 1.2345678901234500E-150,  Int64($20D02A36586DB4BB));
  TestPair( 1.2345678901234565E+000,  Int64($3FF3C0CA428C59FA));
  TestPair( 1.2345678901234567E+000,  Int64($3FF3C0CA428C59FB));
  TestPair( 1.2345678901234569E+000,  Int64($3FF3C0CA428C59FC));
  TestPair( 1.2345678901234569E+150,  Int64($5F182344CD3CDF9F));
  TestPair( 1.2345678901234569E+300,  Int64($7E3D7EE8BCBBD352));
  TestPair( -1.7976931348623157E+308, Int64($FFEFFFFFFFFFFFFF));
  TestPair( 1.7976931348623157E+308,  Int64($7FEFFFFFFFFFFFFF));
  TestPair( 4.9406564584124654E-324,  Int64($0000000000000001));
  TestPair( 0.0000000000000000E+000,  Int64($0000000000000000));
  TestPair( 4.94065645841247E-324,    Int64($0000000000000001));
  TestPair( 3.2378592100206092E-319,  Int64($000000000000FFFF));
  TestPair( 1.3906711615669959E-309,  Int64($0000FFFFFFFFFFFF));
  TestPair( NegInfinity,              Int64($FFF0000000000000));
  TestPair( Infinity,                 Int64($7FF0000000000000));

  // NaN is special
  ASSERT( TCompactProtocolImpl.DoubleToInt64Bits( NaN) = Int64($FFF8000000000000));
  ASSERT( IsNan( TCompactProtocolImpl.Int64BitsToDouble( Int64($FFF8000000000000))));
end;
{$ENDIF}


{$IFDEF Debug}
procedure TestZigZag;

  procedure Test32( const test : Integer);
  var zz : Cardinal;
  begin
    zz := TCompactProtocolImpl.intToZigZag(test);
    ASSERT( TCompactProtocolImpl.zigzagToInt(zz) = test, IntToStr(test));
  end;

  procedure Test64( const test : Int64);
  var zz : UInt64;
  begin
    zz := TCompactProtocolImpl.longToZigzag(test);
    ASSERT( TCompactProtocolImpl.zigzagToLong(zz) = test, IntToStr(test));
  end;

var i : Integer;
begin
  // protobuf testcases
  ASSERT( TCompactProtocolImpl.intToZigZag(0)  = 0, 'pb #1 to ZigZag');
  ASSERT( TCompactProtocolImpl.intToZigZag(-1) = 1, 'pb #2 to ZigZag');
  ASSERT( TCompactProtocolImpl.intToZigZag(1)  = 2, 'pb #3 to ZigZag');
  ASSERT( TCompactProtocolImpl.intToZigZag(-2) = 3, 'pb #4 to ZigZag');
  ASSERT( TCompactProtocolImpl.intToZigZag(+2147483647) = 4294967294, 'pb #5 to ZigZag');
  ASSERT( TCompactProtocolImpl.intToZigZag(-2147483648) = 4294967295, 'pb #6 to ZigZag');

  // protobuf testcases
  ASSERT( TCompactProtocolImpl.zigzagToInt(0)  = 0, 'pb #1 from ZigZag');
  ASSERT( TCompactProtocolImpl.zigzagToInt(1) = -1, 'pb #2 from ZigZag');
  ASSERT( TCompactProtocolImpl.zigzagToInt(2)  = 1, 'pb #3 from ZigZag');
  ASSERT( TCompactProtocolImpl.zigzagToInt(3) = -2, 'pb #4 from ZigZag');
  ASSERT( TCompactProtocolImpl.zigzagToInt(4294967294) = +2147483647, 'pb #5 from ZigZag');
  ASSERT( TCompactProtocolImpl.zigzagToInt(4294967295) = -2147483648, 'pb #6 from ZigZag');

  // back and forth 32
  Test32( 0);
  for i := 0 to 30 do begin
    Test32( +(Integer(1) shl i));
    Test32( -(Integer(1) shl i));
  end;
  Test32( Integer($7FFFFFFF));
  Test32( Integer($80000000));

  // back and forth 64
  Test64( 0);
  for i := 0 to 62 do begin
    Test64( +(Int64(1) shl i));
    Test64( -(Int64(1) shl i));
  end;
  Test64( Int64($7FFFFFFFFFFFFFFF));
  Test64( Int64($8000000000000000));
end;
{$ENDIF}


{$IFDEF Debug}
procedure TestLongBytes;

  procedure Test( const test : Int64);
  var buf : TBytes;
  begin
    TCompactProtocolImpl.fixedLongToBytes( test, buf);
    ASSERT( TCompactProtocolImpl.bytesToLong( buf) = test, IntToStr(test));
  end;

var i : Integer;
begin
  Test( 0);
  for i := 0 to 62 do begin
    Test( +(Int64(1) shl i));
    Test( -(Int64(1) shl i));
  end;
  Test( Int64($7FFFFFFFFFFFFFFF));
  Test( Int64($8000000000000000));
end;
{$ENDIF}


initialization
  {$IFDEF Debug}
  TestDoubleToInt64Bits;
  TestZigZag;
  TestLongBytes;
  {$ENDIF}

end.

