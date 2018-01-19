/*
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
import haxe.Utf8;
import haxe.crypto.Base64;
import haxe.Int64;

import org.apache.thrift.TException;
import org.apache.thrift.protocol.TMessage;
import org.apache.thrift.protocol.TField;
import org.apache.thrift.protocol.TMap;
import org.apache.thrift.protocol.TSet;
import org.apache.thrift.protocol.TList;
import org.apache.thrift.transport.TTransport;



/* JSON protocol implementation for thrift.
*  This is a full-featured protocol supporting Write and Read.
*
*  Please see the C++ class header for a detailed description of the wire format.
*
*  Adapted from the Java version.
*/
class TJSONProtocol extends TRecursionTracker implements TProtocol {

    public var trans(default,null) : TTransport;

    // Stack of nested contexts that we may be in
    private var contextStack : GenericStack<JSONBaseContext> = new GenericStack<JSONBaseContext>();

    // Current context that we are in
    private var context : JSONBaseContext;

    // Reader that manages a 1-byte buffer
    private var reader : LookaheadReader;

    // whether the underlying system holds Strings as UTF-8
    // http://old.haxe.org/manual/encoding
    private static var utf8Strings = haxe.Utf8.validate("Ç-ß-Æ-Ю-Ш");

    // TJSONProtocol Constructor
    public function new( trans : TTransport)
    {
        this.trans = trans;
        this.context = new JSONBaseContext(this);
        this.reader = new LookaheadReader(this);
    }

    public function getTransport() : TTransport {
      return trans;
    }

    public function writeMessageBegin(message:TMessage) : Void {
        WriteJSONArrayStart();
        WriteJSONInteger( JSONConstants.VERSION);
        WriteJSONString( BytesFromString(message.name));
        WriteJSONInteger( message.type);
        WriteJSONInteger( message.seqid);
    }

    public function writeMessageEnd() : Void {
        WriteJSONArrayEnd();
    }

    public function writeStructBegin(struct:TStruct) : Void {
        WriteJSONObjectStart();
    }

    public function writeStructEnd() : Void {
        WriteJSONObjectEnd();
    }

    public function writeFieldBegin(field:TField) : Void {
        WriteJSONInteger( field.id );
        WriteJSONObjectStart();
        WriteJSONString( BytesFromString( JSONConstants.GetTypeNameForTypeID( field.type)));
    }

    public function writeFieldEnd() : Void {
        WriteJSONObjectEnd();
    }

    public function writeFieldStop() : Void { }

    public function writeMapBegin(map:TMap) : Void {
        WriteJSONArrayStart();
        WriteJSONString( BytesFromString( JSONConstants.GetTypeNameForTypeID( map.keyType)));
        WriteJSONString( BytesFromString( JSONConstants.GetTypeNameForTypeID( map.valueType)));
        WriteJSONInteger( map.size);
        WriteJSONObjectStart();
    }

    public function writeMapEnd() : Void {
        WriteJSONObjectEnd();
        WriteJSONArrayEnd();
    }

    public function writeListBegin(list:TList) : Void {
        WriteJSONArrayStart();
        WriteJSONString( BytesFromString( JSONConstants.GetTypeNameForTypeID( list.elemType )));
        WriteJSONInteger( list.size);
    }

    public function writeListEnd() : Void {
        WriteJSONArrayEnd();
    }

    public function writeSetBegin(set:TSet) : Void {
        WriteJSONArrayStart();
        WriteJSONString( BytesFromString( JSONConstants.GetTypeNameForTypeID( set.elemType)));
        WriteJSONInteger( set.size);
    }

    public function writeSetEnd() : Void {
        WriteJSONArrayEnd();
    }

    public function writeBool(b : Bool) : Void {
        if( b)
            WriteJSONInteger( 1);
        else
            WriteJSONInteger( 0);
    }

    public function writeByte(b : Int) : Void {
        WriteJSONInteger( b);
    }

    public function writeI16(i16 : Int) : Void {
        WriteJSONInteger( i16);
    }

    public function writeI32(i32 : Int) : Void {
        WriteJSONInteger( i32);
    }

    public function writeI64(i64 : haxe.Int64) : Void {
        WriteJSONInt64( i64);
    }

    public function writeDouble(dub:Float) : Void {
        WriteJSONDouble(dub);
    }

    public function writeString(str : String) : Void {
        WriteJSONString( BytesFromString(str));
    }

    public function writeBinary(bin:Bytes) : Void {
        WriteJSONBase64(bin);
    }

    public function readMessageBegin():TMessage {
        var message : TMessage = new TMessage();
        ReadJSONArrayStart();
        if (ReadJSONInteger() != JSONConstants.VERSION)
        {
            throw new TProtocolException(TProtocolException.BAD_VERSION,
                                         "Message contained bad version.");
        }

        message.name = ReadJSONString(false);
        message.type = ReadJSONInteger();
        message.seqid = ReadJSONInteger();
        return message;
    }

    public function readMessageEnd() : Void {
        ReadJSONArrayEnd();
    }

    public function readStructBegin():TStruct {
        ReadJSONObjectStart();
        return new TStruct();
    }

    public function readStructEnd() : Void {
        ReadJSONObjectEnd();
    }

    public function readFieldBegin() : TField {
        var field : TField = new TField();
        var ch = reader.Peek();
        if (StringFromBytes(ch) == JSONConstants.RBRACE)
        {
            field.type = TType.STOP;
        }
        else
        {
            field.id = ReadJSONInteger();
            ReadJSONObjectStart();
            field.type = JSONConstants.GetTypeIDForTypeName( ReadJSONString(false));
        }
        return field;
    }

    public function readFieldEnd() : Void {
        ReadJSONObjectEnd();
    }

    public function readMapBegin() : TMap {
        ReadJSONArrayStart();
        var KeyType = JSONConstants.GetTypeIDForTypeName( ReadJSONString(false));
        var ValueType = JSONConstants.GetTypeIDForTypeName( ReadJSONString(false));
        var Count : Int = ReadJSONInteger();
        ReadJSONObjectStart();

        var map = new TMap( KeyType, ValueType, Count);
        return map;
    }

    public function readMapEnd() : Void {
        ReadJSONObjectEnd();
        ReadJSONArrayEnd();
    }

    public function readListBegin():TList {
        ReadJSONArrayStart();
        var ElementType = JSONConstants.GetTypeIDForTypeName( ReadJSONString(false));
        var Count : Int = ReadJSONInteger();

        var list = new TList( ElementType, Count);
        return list;
    }

    public function readListEnd() : Void {
        ReadJSONArrayEnd();
    }

    public function readSetBegin() : TSet {
        ReadJSONArrayStart();
        var ElementType = JSONConstants.GetTypeIDForTypeName( ReadJSONString(false));
        var Count : Int = ReadJSONInteger();

        var set = new TSet( ElementType, Count);
        return set;
    }

    public function readSetEnd() : Void {
        ReadJSONArrayEnd();
    }

    public function readBool() : Bool {
        return (ReadJSONInteger() != 0);
    }

    public function readByte() : Int {
        return ReadJSONInteger();
    }

    public function readI16() : Int {
        return ReadJSONInteger();
    }

    public function readI32() : Int {
        return ReadJSONInteger();
    }

    public function readI64() : haxe.Int64 {
        return ReadJSONInt64();
    }

    public function readDouble():Float {
        return ReadJSONDouble();
    }

    public function readString() : String {
        return ReadJSONString(false);
    }

    public function readBinary() : Bytes {
        return ReadJSONBase64();
    }

    // Push a new JSON context onto the stack.
    private function  PushContext(c : JSONBaseContext) : Void {
        contextStack.add(context);
        context = c;
    }

    // Pop the last JSON context off the stack
    private function  PopContext() : Void {
        context = contextStack.pop();
    }


    // Write the bytes in array buf as a JSON characters, escaping as needed
    private function WriteJSONString( b : Bytes) : Void {
        context.Write();

        var tmp = BytesFromString( JSONConstants.QUOTE);
        trans.write( tmp, 0, tmp.length);

        for (i in 0 ... b.length) {
            var value = b.get(i);

            if ((value & 0x00FF) >= 0x30)
            {
                if (String.fromCharCode(value) == JSONConstants.BACKSLASH.charAt(0))
                {
                    tmp = BytesFromString( JSONConstants.BACKSLASH + JSONConstants.BACKSLASH);
                    trans.write( tmp, 0, tmp.length);
                }
                else
                {
                    trans.write( b, i, 1);
                }
            }
            else
            {
                var num = JSONConstants.JSON_CHAR_TABLE[value];
                if (num == 1)
                {
                    trans.write( b, i, 1);
                }
                else if (num > 1)
                {
                    var buf = new BytesBuffer();
                    buf.addString( JSONConstants.BACKSLASH);
                    buf.addByte( num);
                    tmp = buf.getBytes();
                    trans.write( tmp, 0, tmp.length);
                }
                else
                {
                    var buf = new BytesBuffer();
                    buf.addString( JSONConstants.ESCSEQ);
                    buf.addString( HexChar( (value & 0xFF000000) >> 12));
                    buf.addString( HexChar( (value & 0x00FF0000) >> 8));
                    buf.addString( HexChar( (value & 0x0000FF00) >> 4));
                    buf.addString( HexChar( value & 0x000000FF));
                    tmp = buf.getBytes();
                    trans.write( tmp, 0, tmp.length);
                }
            }
        }

        tmp = BytesFromString( JSONConstants.QUOTE);
        trans.write( tmp, 0, tmp.length);
    }

    // Write out number as a JSON value. If the context dictates so,
    // it will be wrapped in quotes to output as a JSON string.
    private function WriteJSONInteger( num : Int) : Void {
        context.Write();

        var str : String = "";
        var escapeNum : Bool = context.EscapeNumbers();

        if (escapeNum) {
            str += JSONConstants.QUOTE;
        }

        str += Std.string(num);

        if (escapeNum) {
            str += JSONConstants.QUOTE;
        }

        var tmp = BytesFromString( str);
        trans.write( tmp, 0, tmp.length);
    }

    // Write out number as a JSON value. If the context dictates so,
    // it will be wrapped in quotes to output as a JSON string.
    private function WriteJSONInt64( num : Int64) : Void {
        context.Write();

        var str : String = "";
        var escapeNum : Bool = context.EscapeNumbers();

        if (escapeNum) {
            str += JSONConstants.QUOTE;
        }

        str += Std.string(num);

        if (escapeNum) {
            str += JSONConstants.QUOTE;
        }

        var tmp = BytesFromString( str);
        trans.write( tmp, 0, tmp.length);
    }

    // Write out a double as a JSON value. If it is NaN or infinity or if the
    // context dictates escaping, Write out as JSON string.
    private function WriteJSONDouble(num : Float) : Void {
        context.Write();


        var special : Bool = false;
        var rendered : String = "";
        if( Math.isNaN(num)) {
            special = true;
            rendered = JSONConstants.FLOAT_IS_NAN;
        } else if (! Math.isFinite(num)) {
            special = true;
            if( num > 0) {
                rendered = JSONConstants.FLOAT_IS_POS_INF;
            } else {
                rendered = JSONConstants.FLOAT_IS_NEG_INF;
            }
        } else {
            rendered = Std.string(num);  // plain and simple float number
        }

        // compose output
        var escapeNum : Bool = special || context.EscapeNumbers();
        var str : String = "";
        if (escapeNum) {
            str += JSONConstants.QUOTE;
        }
        str += rendered;
        if (escapeNum) {
            str += JSONConstants.QUOTE;
        }

        var tmp = BytesFromString( str);
        trans.write( tmp, 0, tmp.length);
    }

    // Write out contents of byte array b as a JSON string with base-64 encoded data
    private function WriteJSONBase64( b : Bytes) : Void {
        context.Write();

        var buf = new BytesBuffer();
        buf.addString( JSONConstants.QUOTE);
        buf.addString( Base64.encode(b));
        buf.addString( JSONConstants.QUOTE);

        var tmp = buf.getBytes();
        trans.write( tmp, 0, tmp.length);
    }

    private function WriteJSONObjectStart() : Void {
        context.Write();
        var tmp = BytesFromString( JSONConstants.LBRACE);
        trans.write( tmp, 0, tmp.length);
        PushContext( new JSONPairContext(this));
    }

    private function WriteJSONObjectEnd() : Void {
        PopContext();
        var tmp = BytesFromString( JSONConstants.RBRACE);
        trans.write( tmp, 0, tmp.length);
    }

    private function WriteJSONArrayStart() : Void {
        context.Write();
        var tmp = BytesFromString( JSONConstants.LBRACKET);
        trans.write( tmp, 0, tmp.length);
        PushContext( new JSONListContext(this));
    }

    private function WriteJSONArrayEnd() : Void {
        PopContext();
        var tmp = BytesFromString( JSONConstants.RBRACKET);
        trans.write( tmp, 0, tmp.length);
    }


    /**
     * Reading methods.
     */

    // Read a byte that must match char, otherwise an exception is thrown.
    public function ReadJSONSyntaxChar( char : String) : Void {
        var b = BytesFromString( char);

        var ch = reader.Read();
        if (ch.get(0) != b.get(0))
        {
            throw new TProtocolException(TProtocolException.INVALID_DATA,
                                         'Unexpected character: $ch');
        }
    }

    // Read in a JSON string, unescaping as appropriate.
    // Skip Reading from the context if skipContext is true.
    private function ReadJSONString(skipContext : Bool) : String
    {
        if (!skipContext)
        {
            context.Read();
        }

        var buffer : BytesBuffer = new BytesBuffer();

        ReadJSONSyntaxChar( JSONConstants.QUOTE);
        while (true)
        {
            var ch = reader.Read();

            // end of string?
            if (StringFromBytes(ch) == JSONConstants.QUOTE)
            {
                break;
            }

            // escaped?
            if (StringFromBytes(ch) != JSONConstants.ESCSEQ.charAt(0))
            {
                buffer.addByte( ch.get(0));
                continue;
            }

            // distinguish between \uXXXX (hex unicode) and \X (control chars)
            ch = reader.Read();
            if (StringFromBytes(ch) != JSONConstants.ESCSEQ.charAt(1))
            {
                var value = JSONConstants.ESCAPE_CHARS_TO_VALUES[ch.get(0)];
                if( value == null)
                {
                    throw new TProtocolException( TProtocolException.INVALID_DATA, "Expected control char");
                }
                buffer.addByte( value);
                continue;
            }


            // it's \uXXXX
            var hexbuf = new BytesBuffer();
            var hexlen = trans.readAll( hexbuf, 0, 4);
            if( hexlen != 4)
            {
                throw new TProtocolException( TProtocolException.INVALID_DATA, "Not enough data for \\uNNNN sequence");
            }

            var hexdigits = hexbuf.getBytes();
            var charcode = 0;
            charcode = (charcode << 4) + HexVal( String.fromCharCode(hexdigits.get(0)));
            charcode = (charcode << 4) + HexVal( String.fromCharCode(hexdigits.get(1)));
            charcode = (charcode << 4) + HexVal( String.fromCharCode(hexdigits.get(2)));
            charcode = (charcode << 4) + HexVal( String.fromCharCode(hexdigits.get(3)));
            buffer.addString( String.fromCharCode(charcode));
        }

        return StringFromBytes( buffer.getBytes());
    }

    // Return true if the given byte could be a valid part of a JSON number.
    private function IsJSONNumeric(b : Int) : Bool {
        switch (b)
        {
            case "+".code:  return true;
            case "-".code:  return true;
            case ".".code:  return true;
            case "0".code:  return true;
            case "1".code:  return true;
            case "2".code:  return true;
            case "3".code:  return true;
            case "4".code:  return true;
            case "5".code:  return true;
            case "6".code:  return true;
            case "7".code:  return true;
            case "8".code:  return true;
            case "9".code:  return true;
            case "E".code:  return true;
            case "e".code:  return true;
        }
        return false;
    }

    // Read in a sequence of characters that are all valid in JSON numbers. Does
    // not do a complete regex check to validate that this is actually a number.
    private function ReadJSONNumericChars() : String
    {
        var buffer : BytesBuffer = new BytesBuffer();
        while (true)
        {
            var ch = reader.Peek();
            if( ! IsJSONNumeric( ch.get(0)))
            {
                break;
            }
            buffer.addByte( reader.Read().get(0));
        }
        return StringFromBytes( buffer.getBytes());
    }

    // Read in a JSON number. If the context dictates, Read in enclosing quotes.
    private function ReadJSONInteger() : Int {
        context.Read();

        if (context.EscapeNumbers()) {
            ReadJSONSyntaxChar( JSONConstants.QUOTE);
        }

        var str : String = ReadJSONNumericChars();

        if (context.EscapeNumbers()) {
            ReadJSONSyntaxChar( JSONConstants.QUOTE);
        }

        var value = Std.parseInt(str);
        if( value == null) {
            throw new TProtocolException(TProtocolException.INVALID_DATA, 'Bad numeric data: $str');
        }

        return value;
    }

    // Read in a JSON number. If the context dictates, Read in enclosing quotes.
    private function ReadJSONInt64() : haxe.Int64 {
        context.Read();

        if (context.EscapeNumbers()) {
            ReadJSONSyntaxChar( JSONConstants.QUOTE);
        }

        var str : String = ReadJSONNumericChars();
        if( str.length == 0) {
            throw new TProtocolException(TProtocolException.INVALID_DATA, 'Bad numeric data: $str');
        }

        if (context.EscapeNumbers()) {
            ReadJSONSyntaxChar( JSONConstants.QUOTE);
        }

        // process sign
        var bMinus = false;
        var startAt = 0;
        if( (str.charAt(0) == "+") || (str.charAt(0) == "-")) {
            bMinus = (str.charAt(0) == "-");
            startAt++;
        }

        // process digits
        var value : Int64 = Int64.make(0,0);
        var bGotDigits = false;
        for( i in startAt ... str.length) {
            var ch = str.charAt(i);
            var digit = JSONConstants.DECIMAL_DIGITS[ch];
            if( digit == null) {
                throw new TProtocolException(TProtocolException.INVALID_DATA, 'Bad numeric data: $str');
            }
            bGotDigits = true;

            // these are decimal digits
            value = Int64.mul( value, Int64.make(0,10));
            value = Int64.add( value, Int64.make(0,digit));
        }

        // process pending minus sign, if applicable
        // this should also handle the edge case MIN_INT64 correctly
        if( bMinus && (Int64.compare(value,Int64.make(0,0)) > 0)) {
            value = Int64.neg( value);
            bMinus = false;
        }

        if( ! bGotDigits) {
            throw new TProtocolException(TProtocolException.INVALID_DATA, 'Bad numeric data: $str');
        }

        return value;
    }

    // Read in a JSON double value. Throw if the value is not wrapped in quotes
    // when expected or if wrapped in quotes when not expected.
    private function ReadJSONDouble() : Float {
        context.Read();

        var str : String = "";
        if (StringFromBytes(reader.Peek()) == JSONConstants.QUOTE) {
            str = ReadJSONString(true);

            // special cases
            if( str == JSONConstants.FLOAT_IS_NAN) {
                return Math.NaN;
            }
            if( str == JSONConstants.FLOAT_IS_POS_INF) {
                return Math.POSITIVE_INFINITY;
            }
            if( str == JSONConstants.FLOAT_IS_NEG_INF) {
                return Math.NEGATIVE_INFINITY;
            }

            if( ! context.EscapeNumbers())    {
                // throw - we should not be in a string in this case
                throw new TProtocolException(TProtocolException.INVALID_DATA, "Numeric data unexpectedly quoted");
            }
        }
        else
        {
            if( context.EscapeNumbers())    {
                // This will throw - we should have had a quote if EscapeNumbers() == true
                ReadJSONSyntaxChar( JSONConstants.QUOTE);
            }

            str = ReadJSONNumericChars();
        }

        // parse and check - we should have at least one valid digit
        var dub = Std.parseFloat( str);
        if( (str.length == 0) || Math.isNaN(dub)) {
            throw new TProtocolException(TProtocolException.INVALID_DATA, 'Bad numeric data: $str');
        }

        return dub;
    }

    // Read in a JSON string containing base-64 encoded data and decode it.
    private function ReadJSONBase64() : Bytes
    {
        var str = ReadJSONString(false);
        return Base64.decode( str);
    }

    private function ReadJSONObjectStart() : Void {
        context.Read();
        ReadJSONSyntaxChar( JSONConstants.LBRACE);
        PushContext(new JSONPairContext(this));
    }

    private function ReadJSONObjectEnd() : Void {
        ReadJSONSyntaxChar( JSONConstants.RBRACE);
        PopContext();
    }

    private function ReadJSONArrayStart() : Void {
        context.Read();
        ReadJSONSyntaxChar( JSONConstants.LBRACKET);
        PushContext(new JSONListContext(this));
    }

    private function ReadJSONArrayEnd() : Void {
        ReadJSONSyntaxChar( JSONConstants.RBRACKET);
        PopContext();
    }


    public static function BytesFromString( str : String) : Bytes {
        var buf = new BytesBuffer();
        if( utf8Strings)
            buf.addString( str);  // no need to encode on UTF8 targets, the string is just fine
        else
            buf.addString( Utf8.encode( str));
        return buf.getBytes();
    }

    public static function StringFromBytes( buf : Bytes) : String {
        var inp = new BytesInput( buf);
        if( buf.length == 0)
            return "";  // readString() would return null in that case, which is wrong
        var str = inp.readString( buf.length);
        if( utf8Strings)
            return str;  // no need to decode on UTF8 targets, the string is just fine
        else
            return Utf8.decode( str);
    }

    // Convert a byte containing a hex char ('0'-'9' or 'a'-'f') into its corresponding hex value
    private static function HexVal(char : String) : Int {
        var value = JSONConstants.HEX_DIGITS[char];
        if( value == null) {
            throw new TProtocolException(TProtocolException.INVALID_DATA, 'Expected hex character: $char');
        }
        return value;
    }

    // Convert a byte containing a hex nibble to its corresponding hex character
    private static function HexChar(nibble : Int) : String
    {
        return "0123456789abcdef".charAt(nibble & 0x0F);
    }


}


@:allow(TJSONProtocol)
class JSONConstants {
    public static var COMMA = ",";
    public static var COLON = ":";
    public static var LBRACE = "{";
    public static var RBRACE = "}";
    public static var LBRACKET = "[";
    public static var RBRACKET = "]";
    public static var QUOTE = "\"";
    public static var BACKSLASH = "\\";

    public static var ESCSEQ = "\\u";

    public static var FLOAT_IS_NAN = "NaN";
    public static var FLOAT_IS_POS_INF = "Infinity";
    public static var FLOAT_IS_NEG_INF = "-Infinity";

    public static var VERSION = 1;
    public static var JSON_CHAR_TABLE = [
        0,  0,  0,  0,  0,  0,  0,  0,
        "b".code, "t".code, "n".code,  0, "f".code, "r".code,  0,  0,
        0,  0,  0,  0,  0,  0,  0,  0,
        0,  0,  0,  0,  0,  0,  0,  0,
        1,  1, "\"".code,  1,  1,  1,  1,  1,
        1,  1,  1,  1,  1,  1,  1,  1,
    ];

    public static var ESCAPE_CHARS     = ['"','\\','/','b','f','n','r','t'];
    public static var ESCAPE_CHARS_TO_VALUES = [
        "\"".code => 0x22,
        "\\".code => 0x5C,
        "/".code  => 0x2F,
        "b".code  => 0x08,
        "f".code  => 0x0C,
        "n".code  => 0x0A,
        "r".code  => 0x0D,
        "t".code  => 0x09
    ];

    public static var DECIMAL_DIGITS = [
        "0" => 0,
        "1" => 1,
        "2" => 2,
        "3" => 3,
        "4" => 4,
        "5" => 5,
        "6" => 6,
        "7" => 7,
        "8" => 8,
        "9" => 9
    ];

    public static var HEX_DIGITS = [
        "0" => 0,
        "1" => 1,
        "2" => 2,
        "3" => 3,
        "4" => 4,
        "5" => 5,
        "6" => 6,
        "7" => 7,
        "8" => 8,
        "9" => 9,
        "A" => 10,
        "a" => 10,
        "B" => 11,
        "b" => 11,
        "C" => 12,
        "c" => 12,
        "D" => 13,
        "d" => 13,
        "E" => 14,
        "e" => 14,
        "F" => 15,
        "f" => 15
    ];


    public static var DEF_STRING_SIZE = 16;

    public static var NAME_BOOL   = 'tf';
    public static var NAME_BYTE   = 'i8';
    public static var NAME_I16    = 'i16';
    public static var NAME_I32    = 'i32';
    public static var NAME_I64    = 'i64';
    public static var NAME_DOUBLE = 'dbl';
    public static var NAME_STRUCT = 'rec';
    public static var NAME_STRING = 'str';
    public static var NAME_MAP    = 'map';
    public static var NAME_LIST   = 'lst';
    public static var NAME_SET    = 'set';

    public static function GetTypeNameForTypeID(typeID : Int) : String {
        switch (typeID)
        {
            case TType.BOOL:     return NAME_BOOL;
            case TType.BYTE:     return NAME_BYTE;
            case TType.I16:         return NAME_I16;
            case TType.I32:         return NAME_I32;
            case TType.I64:         return NAME_I64;
            case TType.DOUBLE:     return NAME_DOUBLE;
            case TType.STRING:     return NAME_STRING;
            case TType.STRUCT:     return NAME_STRUCT;
            case TType.MAP:         return NAME_MAP;
            case TType.SET:         return NAME_SET;
            case TType.LIST:     return NAME_LIST;
        }
        throw new TProtocolException(TProtocolException.NOT_IMPLEMENTED, "Unrecognized type");
    }

    private static var NAMES_TO_TYPES = [
        NAME_BOOL   => TType.BOOL,
        NAME_BYTE   => TType.BYTE,
        NAME_I16    => TType.I16,
        NAME_I32    => TType.I32,
        NAME_I64    => TType.I64,
        NAME_DOUBLE => TType.DOUBLE,
        NAME_STRING => TType.STRING,
        NAME_STRUCT => TType.STRUCT,
        NAME_MAP    => TType.MAP,
        NAME_SET    => TType.SET,
        NAME_LIST   => TType.LIST
    ];

    public static function GetTypeIDForTypeName(name : String) : Int
    {
        var type = NAMES_TO_TYPES[name];
        if( null != type) {
            return type;
        }
        throw new TProtocolException(TProtocolException.NOT_IMPLEMENTED, "Unrecognized type");
    }

}


// Base class for tracking JSON contexts that may require inserting/Reading
// additional JSON syntax characters. This base context does nothing.
@:allow(TJSONProtocol)
class JSONBaseContext
{
    private var proto : TJSONProtocol;

    public function new(proto : TJSONProtocol )
    {
        this.proto = proto;
    }

    public function Write() : Void { }
    public function Read() : Void { }

    public function EscapeNumbers() : Bool {
        return false;
    }
}


// Context for JSON lists.
// Will insert/Read commas before each item except for the first one
@:allow(TJSONProtocol)
class JSONListContext extends JSONBaseContext
{
    public function new( proto : TJSONProtocol) {
        super(proto);
    }

    private var first : Bool = true;

    public override function Write() : Void {
        if (first)
        {
            first = false;
        }
        else
        {
            var buf = new BytesBuffer();
            buf.addString( JSONConstants.COMMA);
            var tmp = buf.getBytes();
            proto.trans.write( tmp, 0, tmp.length);
        }
    }

    public override function Read() : Void {
        if (first)
        {
            first = false;
        }
        else
        {
            proto.ReadJSONSyntaxChar( JSONConstants.COMMA);
        }
    }
}


// Context for JSON records.
// Will insert/Read colons before the value portion of each record
// pair, and commas before each key except the first. In addition,
// will indicate that numbers in the key position need to be escaped
// in quotes (since JSON keys must be strings).
@:allow(TJSONProtocol)
class JSONPairContext extends JSONBaseContext
{
    public function new( proto : TJSONProtocol ) {
        super( proto);
    }

    private var first : Bool = true;
    private var colon : Bool  = true;

    public override function Write() : Void {
        if (first)
        {
            first = false;
            colon = true;
        }
        else
        {
            var buf = new BytesBuffer();
            buf.addString( colon ? JSONConstants.COLON : JSONConstants.COMMA);
            var tmp = buf.getBytes();
            proto.trans.write( tmp, 0, tmp.length);
            colon = !colon;
        }
    }

    public override function Read() : Void {
        if (first)
        {
            first = false;
            colon = true;
        }
        else
        {
            proto.ReadJSONSyntaxChar( colon ? JSONConstants.COLON : JSONConstants.COMMA);
            colon = !colon;
        }
    }

    public override function EscapeNumbers() : Bool
    {
        return colon;
    }
}

// Holds up to one byte from the transport
@:allow(TJSONProtocol)
class LookaheadReader {

    private var proto : TJSONProtocol;
    private var data : Bytes;

    public function new( proto : TJSONProtocol ) {
        this.proto = proto;
        data = null;
    }


    // Return and consume the next byte to be Read, either taking it from the
    // data buffer if present or getting it from the transport otherwise.
    public function Read() : Bytes {
        var retval = Peek();
        data = null;
        return retval;
    }

    // Return the next byte to be Read without consuming, filling the data
    // buffer if it has not been filled alReady.
    public function Peek() : Bytes {
        if (data == null) {
            var buf = new BytesBuffer();
            proto.trans.readAll(buf, 0, 1);
            data = buf.getBytes();
        }
        return data;
    }
}

