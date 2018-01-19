/**
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
 */

package org.apache.thrift.protocol;

import haxe.io.Bytes;
import haxe.io.BytesInput;
import haxe.io.BytesOutput;
import haxe.io.BytesBuffer;
import haxe.ds.GenericStack;
import haxe.Int32;
import haxe.Int64;
import haxe.Utf8;

import org.apache.thrift.TException;
import org.apache.thrift.transport.TTransport;
import org.apache.thrift.helper.ZigZag;
import org.apache.thrift.helper.BitConverter;


/**
* Compact protocol implementation for thrift.
*/
class TCompactProtocol extends TRecursionTracker implements TProtocol {

    private static var ANONYMOUS_STRUCT : TStruct = new TStruct("");
    private static var TSTOP : TField = new TField("", TType.STOP, 0);

    private static inline var PROTOCOL_ID : Int = 0x82;
    private static inline var VERSION : Int = 1;
    private static inline var VERSION_MASK : Int = 0x1f; // 0001 1111
    private static inline var TYPE_MASK : Int = 0xE0; // 1110 0000
    private static inline var TYPE_BITS : Int = 0x07; // 0000 0111
    private static inline var TYPE_SHIFT_AMOUNT : Int = 5;


    private static var ttypeToCompactType = [
        TType.STOP    => TCompactTypes.STOP,
        TType.BOOL    => TCompactTypes.BOOLEAN_TRUE,
        TType.BYTE    => TCompactTypes.BYTE,
        TType.DOUBLE  => TCompactTypes.DOUBLE,
        TType.I16     => TCompactTypes.I16,
        TType.I32     => TCompactTypes.I32,
        TType.I64     => TCompactTypes.I64,
        TType.STRING  => TCompactTypes.BINARY,
        TType.STRUCT  => TCompactTypes.STRUCT,
        TType.MAP     => TCompactTypes.MAP,
        TType.SET     => TCompactTypes.SET,
        TType.LIST    => TCompactTypes.LIST
    ];

    private static var tcompactTypeToType = [
        TCompactTypes.STOP          => TType.STOP,
        TCompactTypes.BOOLEAN_TRUE  => TType.BOOL,
        TCompactTypes.BOOLEAN_FALSE => TType.BOOL,
        TCompactTypes.BYTE          => TType.BYTE,
        TCompactTypes.I16           => TType.I16,
        TCompactTypes.I32           => TType.I32,
        TCompactTypes.I64           => TType.I64,
        TCompactTypes.DOUBLE        => TType.DOUBLE,
        TCompactTypes.BINARY        => TType.STRING,
        TCompactTypes.LIST          => TType.LIST,
        TCompactTypes.SET           => TType.SET,
        TCompactTypes.MAP           => TType.MAP,
        TCompactTypes.STRUCT        => TType.STRUCT
    ];


    /**
     * Used to keep track of the last field for the current and previous structs,
     * so we can do the delta stuff.
     */
    private var lastField_ : GenericStack<Int> = new GenericStack<Int>();
    private var lastFieldId_ : Int = 0;

    /**
     * If we encounter a boolean field begin, save the TField here so it can
     * have the value incorporated.
     */
    private var booleanField_ : Null<TField>;

    /**
     * If we Read a field header, and it's a boolean field, save the boolean
     * value here so that ReadBool can use it.
     */
    private var boolValue_ : Null<Bool>;


    // whether the underlying system holds Strings as UTF-8
    // http://old.haxe.org/manual/encoding
    private static var utf8Strings = haxe.Utf8.validate("Ç-ß-Æ-Ю-Ш");

    // the transport used
    public var trans(default,null) : TTransport;


    // TCompactProtocol Constructor
    public function new( trans : TTransport) {
        this.trans = trans;
    }

    public function getTransport() : TTransport {
      return trans;
    }


    public function Reset() : Void{
        while ( ! lastField_.isEmpty()) {
            lastField_.pop();
        }
        lastFieldId_ = 0;
    }


    /**
     * Writes a byte without any possibility of all that field header nonsense.
     * Used internally by other writing methods that know they need to Write a byte.
     */
    private function WriteByteDirect( b : Int) : Void {
        var buf = Bytes.alloc(1);
        buf.set( 0, b);
        trans.write( buf, 0, 1);
    }

    /**
     * Write an i32 as a varint. Results in 1-5 bytes on the wire.
     */
    private function WriteVarint32( n : UInt) : Void {
        var i32buf = new BytesBuffer();
        while (true)
        {
            if ((n & ~0x7F) == 0)
            {
                i32buf.addByte( n & 0xFF);
                break;
            }
            else
            {
                i32buf.addByte( (n & 0x7F) | 0x80);
                n >>= 7;
            }
        }

        var tmp = i32buf.getBytes();
        trans.write( tmp, 0, tmp.length);
    }

    /**
    * Write a message header to the wire. Compact Protocol messages contain the
    * protocol version so we can migrate forwards in the future if need be.
    */
    public function writeMessageBegin( message : TMessage) : Void {
        Reset();

        var versionAndType : Int =  (VERSION & VERSION_MASK) | ((message.type << TYPE_SHIFT_AMOUNT) & TYPE_MASK);
        WriteByteDirect( PROTOCOL_ID);
        WriteByteDirect( versionAndType);
        WriteVarint32( cast( message.seqid, UInt));
        writeString( message.name);
    }

    /**
     * Write a struct begin. This doesn't actually put anything on the wire. We
     * use it as an opportunity to put special placeholder markers on the field
     * stack so we can get the field id deltas correct.
     */
    public function writeStructBegin(struct:TStruct) : Void {
        lastField_.add( lastFieldId_);
        lastFieldId_ = 0;
    }

    /**
     * Write a struct end. This doesn't actually put anything on the wire. We use
     * this as an opportunity to pop the last field from the current struct off
     * of the field stack.
     */
    public function writeStructEnd() : Void {
        lastFieldId_ = lastField_.pop();
    }

    /**
     * Write a field header containing the field id and field type. If the
     * difference between the current field id and the last one is small (< 15),
     * then the field id will be encoded in the 4 MSB as a delta. Otherwise, the
     * field id will follow the type header as a zigzag varint.
     */
    public function writeFieldBegin(field:TField) : Void {
        if (field.type == TType.BOOL)
            booleanField_ = field; // we want to possibly include the value, so we'll wait.
        else
            WriteFieldBeginInternal(field, 0xFF);
    }

    /**
     * The workhorse of WriteFieldBegin. It has the option of doing a
     * 'type override' of the type header. This is used specifically in the
     * boolean field case.
     */
    private function WriteFieldBeginInternal( field : TField, typeOverride : Int) : Void {
        // if there's a type override, use that.
        var typeToWrite : Int;
        if ( typeOverride == 0xFF)
            typeToWrite = getCompactType( field.type);
        else
            typeToWrite = typeOverride;

        // check if we can use delta encoding for the field id
        if (field.id > lastFieldId_ && field.id - lastFieldId_ <= 15)
        {
            // Write them together
            WriteByteDirect((field.id - lastFieldId_) << 4 | typeToWrite);
        }
        else
        {
            // Write them separate
            WriteByteDirect(typeToWrite);
            writeI16(field.id);
        }

        lastFieldId_ = field.id;
    }

    /**
     * Write the STOP symbol so we know there are no more fields in this struct.
     */
    public function writeFieldStop() : Void {
        WriteByteDirect( cast(TCompactTypes.STOP, Int));
    }

    /**
     * Write a map header. If the map is empty, omit the key and value type
     * headers, as we don't need any additional information to skip it.
     */
    public function writeMapBegin(map:TMap) : Void {
        if (map.size == 0)
        {
            WriteByteDirect(0);
        }
        else
        {
            var kvtype = (getCompactType(map.keyType) << 4) | getCompactType(map.valueType);
            WriteVarint32( cast( map.size, UInt));
            WriteByteDirect( kvtype);
        }
    }

    /**
     * Write a list header.
     */
    public function writeListBegin( list : TList) : Void {
        WriteCollectionBegin( list.elemType, list.size);
    }

    /**
     * Write a set header.
     */
    public function writeSetBegin( set : TSet) : Void {
        WriteCollectionBegin( set.elemType, set.size);
    }

    /**
     * Write a boolean value. Potentially, this could be a boolean field, in
     * which case the field header info isn't written yet. If so, decide what the
     * right type header is for the value and then Write the field header.
     * Otherwise, Write a single byte.
     */
    public function writeBool(b : Bool) : Void {
        var bct : Int = b ? TCompactTypes.BOOLEAN_TRUE : TCompactTypes.BOOLEAN_FALSE;

        if (booleanField_ != null)
        {
            // we haven't written the field header yet
            WriteFieldBeginInternal( booleanField_, bct);
            booleanField_ = null;
        }
        else
        {
            // we're not part of a field, so just Write the value.
            WriteByteDirect( bct);
        }
    }

    /**
     * Write a byte. Nothing to see here!
     */
    public function writeByte( b : Int) : Void {
        WriteByteDirect( b);
    }

    /**
     * Write an I16 as a zigzag varint.
     */
    public function writeI16( i16 : Int) : Void {
        WriteVarint32( ZigZag.FromInt( i16));
    }

    /**
     * Write an i32 as a zigzag varint.
     */
    public function writeI32( i32 : Int) : Void {
        WriteVarint32( ZigZag.FromInt( i32));
    }

    /**
     * Write an i64 as a zigzag varint.
     */
    public function writeI64( i64 : haxe.Int64) : Void {
        WriteVarint64(  ZigZag.FromLong( i64));
    }

    /**
     * Write a double to the wire as 8 bytes.
     */
    public function writeDouble( dub : Float) : Void {
        var data = BitConverter.fixedLongToBytes( BitConverter.DoubleToInt64Bits(dub));
        trans.write( data, 0, data.length);
    }

    /**
     * Write a string to the wire with a varint size preceding.
     */
    public function writeString(str : String) : Void {
        var buf = new BytesBuffer();
        if( utf8Strings)
            buf.addString( str);  // no need to encode on UTF8 targets, the string is just fine
        else
            buf.addString( Utf8.encode( str));
        var tmp = buf.getBytes();
        writeBinary( tmp);
    }

    /**
     * Write a byte array, using a varint for the size.
     */
    public function writeBinary( bin : Bytes) : Void {
        WriteVarint32( cast(bin.length,UInt));
        trans.write( bin, 0, bin.length);
    }


    // These methods are called by structs, but don't actually have any wire
    // output or purpose.
    public function writeMessageEnd() : Void { }
    public function writeMapEnd() : Void { }
    public function writeListEnd() : Void { }
    public function writeSetEnd() : Void { }
    public function writeFieldEnd() : Void { }

    //
    // Internal writing methods
    //

    /**
     * Abstract method for writing the start of lists and sets. List and sets on
     * the wire differ only by the type indicator.
     */
    private function WriteCollectionBegin( elemType : Int, size : Int) : Void {
        if (size <= 14)    {
            WriteByteDirect( size << 4 | getCompactType(elemType));
        }
        else {
            WriteByteDirect( 0xf0 | getCompactType(elemType));
            WriteVarint32( cast(size, UInt));
        }
    }

    /**
     * Write an i64 as a varint. Results in 1-10 bytes on the wire.
     */
    private function WriteVarint64(n : haxe.Int64) : Void    {
        var varint64out = new BytesBuffer();
        while (true)
        {
            if( Int64.isZero( Int64.and( n, Int64.neg(Int64.make(0,0x7F)))))
            {
                #if( haxe_ver < 3.2)
                varint64out.addByte( Int64.getLow(n));
                #else
                varint64out.addByte( n.low);
                #end
                break;
            }
            else
            {
                #if ( haxe_ver < 3.2)
                varint64out.addByte( (Int64.getLow(n) & 0x7F) | 0x80);
                #else
                varint64out.addByte( (n.low & 0x7F) | 0x80);
                #end
                n = Int64.shr( n, 7);
                n = Int64.and( n, Int64.make(0x01FFFFFF,0xFFFFFFFF));  // clean out the shifted 7 bits
            }
        }
        var tmp = varint64out.getBytes();
        trans.write( tmp, 0, tmp.length);
    }


    /**
     * Read a message header.
     */
    public function readMessageBegin():TMessage {
        Reset();

        var protocolId : Int = readByte();
        if (protocolId != PROTOCOL_ID) {
            throw new TProtocolException( TProtocolException.INVALID_DATA, "Expected protocol id " + StringTools.hex(PROTOCOL_ID,2) + " but got " + StringTools.hex(protocolId));
        }

        var versionAndType : Int = readByte();
        var version : Int = (versionAndType & VERSION_MASK);
        if (version != VERSION) {
            throw new TProtocolException( TProtocolException.INVALID_DATA, "Expected version " + VERSION + " but got " + version);
        }

        var type : Int = ((versionAndType >> TYPE_SHIFT_AMOUNT) & TYPE_BITS);
        var seqid : Int = cast( ReadVarint32(), Int);
        var msgNm : String = readString();
        return new TMessage( msgNm, type, seqid);
    }

    /**
     * Read a struct begin. There's nothing on the wire for this, but it is our
     * opportunity to push a new struct begin marker onto the field stack.
     */
    public function readStructBegin():TStruct {
        lastField_.add(lastFieldId_);
        lastFieldId_ = 0;
        return ANONYMOUS_STRUCT;
    }

    /**
     * Doesn't actually consume any wire data, just removes the last field for
     * this struct from the field stack.
     */
    public function readStructEnd() : Void {
        // consume the last field we Read off the wire.
        lastFieldId_ = lastField_.pop();
    }

    /**
     * Read a field header off the wire.
     */
    public function readFieldBegin() : TField {
        var type : Int = readByte();

        // if it's a stop, then we can return immediately, as the struct is over.
        if (type == cast(TCompactTypes.STOP,Int)) {
            return TSTOP;
        }

        var fieldId : Int;

        // mask off the 4 MSB of the type header. it could contain a field id delta.
        var modifier : Int = ((type & 0xf0) >> 4);
        if (modifier == 0)
            fieldId = readI16();  // not a delta. look ahead for the zigzag varint field id.
        else
            fieldId = lastFieldId_ + modifier; // add the delta to the last Read field id.

        var field : TField  = new TField( "", cast(getTType(type & 0x0f),Int), fieldId);

        // if this happens to be a boolean field, the value is encoded in the type
        if (isBoolType(type)) {
            // save the boolean value in a special instance variable.
            boolValue_ = ((type & 0x0f) == cast(TCompactTypes.BOOLEAN_TRUE,Int));
        }

        // push the new field onto the field stack so we can keep the deltas going.
        lastFieldId_ = field.id;
        return field;
    }

    /**
     * Read a map header off the wire. If the size is zero, skip Reading the key
     * and value type. This means that 0-length maps will yield TMaps without the
     * "correct" types.
     */
    public function readMapBegin() : TMap {
        var size : Int = cast( ReadVarint32(), Int);
        var keyAndValueType : Int = ((size == 0)  ?  0  :  readByte());
        var key : Int = cast( getTType( (keyAndValueType & 0xF0) >> 4), Int);
        var val : Int = cast( getTType( keyAndValueType & 0x0F), Int);
        return new TMap( key, val, size);
    }

    /**
     * Read a list header off the wire. If the list size is 0-14, the size will
     * be packed into the element type header. If it's a longer list, the 4 MSB
     * of the element type header will be 0xF, and a varint will follow with the
     * true size.
     */
    public function readListBegin():TList {
        var size_and_type : Int = readByte();

        var size : Int = ((size_and_type & 0xF0) >> 4) & 0x0F;
        if (size == 15) {
            size = cast( ReadVarint32(), Int);
        }

        var type = getTType(size_and_type);
        return new TList( type, size);
    }

    /**
     * Read a set header off the wire. If the set size is 0-14, the size will
     * be packed into the element type header. If it's a longer set, the 4 MSB
     * of the element type header will be 0xF, and a varint will follow with the
     * true size.
     */
    public function readSetBegin() : TSet {
        var size_and_type : Int = readByte();

        var size : Int = ((size_and_type & 0xF0) >> 4) & 0x0F;
        if (size == 15) {
            size = cast( ReadVarint32(), Int);
        }

        var type = getTType(size_and_type);
        return new TSet( type, size);
    }

    /**
     * Read a boolean off the wire. If this is a boolean field, the value should
     * already have been Read during ReadFieldBegin, so we'll just consume the
     * pre-stored value. Otherwise, Read a byte.
     */
    public function readBool() : Bool {
        if (boolValue_ != null) {
            var result : Bool = boolValue_;
            boolValue_ = null;
            return result;
        }

        return (readByte() == cast(TCompactTypes.BOOLEAN_TRUE,Int));
    }

    /**
     * Read a single byte off the wire. Nothing interesting here.
     */
    public function readByte() : Int {
        var byteRawBuf = new BytesBuffer();
        trans.readAll( byteRawBuf, 0, 1);
        return byteRawBuf.getBytes().get(0);
    }

    /**
     * Read an i16 from the wire as a zigzag varint.
     */
    public function readI16() : Int {
        return ZigZag.ToInt( ReadVarint32());
    }

    /**
     * Read an i32 from the wire as a zigzag varint.
     */
    public function readI32() : Int {
        return ZigZag.ToInt( ReadVarint32());
    }

    /**
     * Read an i64 from the wire as a zigzag varint.
     */
    public function readI64() : haxe.Int64 {
        return ZigZag.ToLong( ReadVarint64());
    }

    /**
     * No magic here - just Read a double off the wire.
     */
    public function readDouble():Float {
        var longBits = new BytesBuffer();
        trans.readAll( longBits, 0, 8);
        return BitConverter.Int64BitsToDouble( BitConverter.bytesToLong( longBits.getBytes()));
    }

    /**
     * Reads a byte[] (via ReadBinary), and then UTF-8 decodes it.
     */
    public function readString() : String {
        var length : Int = cast( ReadVarint32(), Int);

        if (length == 0) {
            return "";
        }

        var buf = new BytesBuffer();
        trans.readAll( buf, 0, length);

        length = buf.length;
        var inp = new BytesInput( buf.getBytes());
        var str = inp.readString( length);
        if( utf8Strings)
            return str;  // no need to decode on UTF8 targets, the string is just fine
        else
            return Utf8.decode( str);
    }

    /**
     * Read a byte[] from the wire.
     */
    public function readBinary() : Bytes {
        var length : Int = cast( ReadVarint32(), Int);
        if (length == 0) {
            return Bytes.alloc(0);
        }

        var buf = new BytesBuffer();
        trans.readAll( buf, 0, length);
        return buf.getBytes();
    }


    // These methods are here for the struct to call, but don't have any wire
    // encoding.
    public function readMessageEnd() : Void { }
    public function readFieldEnd() : Void { }
    public function readMapEnd() : Void { }
    public function readListEnd() : Void { }
    public function readSetEnd() : Void { }

    //
    // Internal Reading methods
    //

    /**
     * Read an i32 from the wire as a varint. The MSB of each byte is set
     * if there is another byte to follow. This can Read up to 5 bytes.
     */
    private function ReadVarint32() : UInt {
        var result : UInt = 0;
        var shift : Int = 0;
        while (true) {
            var b : Int = readByte();
            result |= cast((b & 0x7f) << shift, UInt);
            if ((b & 0x80) != 0x80) {
                break;
            }
            shift += 7;
        }
        return result;
    }

    /**
     * Read an i64 from the wire as a proper varint. The MSB of each byte is set
     * if there is another byte to follow. This can Read up to 10 bytes.
     */
    private function ReadVarint64() : Int64 {
        var shift : Int = 0;
        var result : Int64 = Int64.make(0,0);
        while (true) {
            var b : Int = readByte();
            result = Int64.or( result, Int64.shl( Int64.make(0,b & 0x7f), shift));
            if ((b & 0x80) != 0x80) {
                break;
            }
            shift += 7;
        }

        return result;
    }


    //
    // type testing and converting
    //

    private function isBoolType( b : Int) : Bool {
        var lowerNibble : Int = b & 0x0f;
        switch(lowerNibble)
        {
            case TCompactTypes.BOOLEAN_TRUE: return true;
            case TCompactTypes.BOOLEAN_FALSE: return true;
            default: return false;
        }
    }


    /**
     * Given a TCompactProtocol.TCompactTypes constant, convert it to its corresponding
     * TType value.
     */
    private function getTType( type : Int) : Int {
        try
        {
            return tcompactTypeToType[type];
        }
        catch ( e : Dynamic)
        {
            var tt : Int = (type & 0x0f);
            throw new TProtocolException( TProtocolException.UNKNOWN, 'don\'t know what type: $tt ($e)');
        }
    }

    /**
     * Given a TType value, find the appropriate TCompactProtocol.TCompactTypes constant.
     */
    private function getCompactType( ttype : Int) : Int
    {
        return cast( ttypeToCompactType[ttype], Int);
    }
}
