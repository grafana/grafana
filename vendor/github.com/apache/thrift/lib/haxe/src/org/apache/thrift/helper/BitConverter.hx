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

package org.apache.thrift.helper;

import haxe.Int64;
import haxe.io.Bytes;
import haxe.io.BytesBuffer;

class BitConverter {

    public static function DoubleToInt64Bits( db : Float) : Int64 {
        var buf = new BytesBuffer();
        buf.addDouble( db);
        return bytesToLong( buf.getBytes());
    }


    public static function Int64BitsToDouble( i64 : Int64) : Float {
        var buf = new BytesBuffer();
        buf.add( fixedLongToBytes( i64));
        return buf.getBytes().getDouble(0);
    }



    /**
     * Convert a long into little-endian bytes in buf starting at off and going
     * until off+7.
     */
    public static function fixedLongToBytes( n : Int64)  : Bytes {
        var buf = Bytes.alloc(8);
        #if( haxe_ver < 3.2)
        buf.set( 0, Int64.getLow( Int64.and( n, Int64.make(0, 0xff))));
        buf.set( 1, Int64.getLow( Int64.and( Int64.shr( n, 8),  Int64.make(0, 0xff))));
        buf.set( 2, Int64.getLow( Int64.and( Int64.shr( n, 16), Int64.make(0, 0xff))));
        buf.set( 3, Int64.getLow( Int64.and( Int64.shr( n, 24), Int64.make(0, 0xff))));
        buf.set( 4, Int64.getLow( Int64.and( Int64.shr( n, 32), Int64.make(0, 0xff))));
        buf.set( 5, Int64.getLow( Int64.and( Int64.shr( n, 40), Int64.make(0, 0xff))));
        buf.set( 6, Int64.getLow( Int64.and( Int64.shr( n, 48), Int64.make(0, 0xff))));
        buf.set( 7, Int64.getLow( Int64.and( Int64.shr( n, 56), Int64.make(0, 0xff))));
        #else
        buf.set( 0, Int64.and( n, Int64.make(0, 0xff)).low);
        buf.set( 1, Int64.and( Int64.shr( n, 8),  Int64.make(0, 0xff)).low);
        buf.set( 2, Int64.and( Int64.shr( n, 16), Int64.make(0, 0xff)).low);
        buf.set( 3, Int64.and( Int64.shr( n, 24), Int64.make(0, 0xff)).low);
        buf.set( 4, Int64.and( Int64.shr( n, 32), Int64.make(0, 0xff)).low);
        buf.set( 5, Int64.and( Int64.shr( n, 40), Int64.make(0, 0xff)).low);
        buf.set( 6, Int64.and( Int64.shr( n, 48), Int64.make(0, 0xff)).low);
        buf.set( 7, Int64.and( Int64.shr( n, 56), Int64.make(0, 0xff)).low);
        #end
        return buf;
    }

    /**
     * Note that it's important that the mask bytes are long literals,
     * otherwise they'll default to ints, and when you shift an int left 56 bits,
     * you just get a messed up int.
     */
    public static function bytesToLong( bytes : Bytes) : Int64 {
        var result : Int64 = Int64.make(0, 0);
        result = Int64.or( Int64.shl( result, 8), Int64.make( 0, bytes.get(7)));
        result = Int64.or( Int64.shl( result, 8), Int64.make( 0, bytes.get(6)));
        result = Int64.or( Int64.shl( result, 8), Int64.make( 0, bytes.get(5)));
        result = Int64.or( Int64.shl( result, 8), Int64.make( 0, bytes.get(4)));
        result = Int64.or( Int64.shl( result, 8), Int64.make( 0, bytes.get(3)));
        result = Int64.or( Int64.shl( result, 8), Int64.make( 0, bytes.get(2)));
        result = Int64.or( Int64.shl( result, 8), Int64.make( 0, bytes.get(1)));
        result = Int64.or( Int64.shl( result, 8), Int64.make( 0, bytes.get(0)));
        return result;
    }


    #if debug
    private static function TestBTL( test : Int64) : Void {
        var buf : Bytes = fixedLongToBytes( test);
        var erg = bytesToLong(buf);
        if ( Int64.compare( erg, test) != 0)
            throw 'BitConverter.bytesToLongTest($test) failed: $erg';
    }
    #end


    #if debug
    private static function TestPair( a : Float, b : Int64) : Void {
        var bx = DoubleToInt64Bits(a);
        if ( Int64.compare( bx, b) != 0)
            throw 'BitConverter.TestPair: DoubleToInt64Bits($a): expected $b, got $bx';
        var ax = Int64BitsToDouble(b);
        if( ax != a)
            throw 'BitConverter.TestPair: Int64BitsToDouble($b: expected $a, got  $ax';
    }
    #end


    #if debug
    public static function UnitTest() : Void {

        // bytesToLong()
        var i : Int;
        TestBTL( Int64.make(0,0));
        for ( i in 0 ... 62) {
            TestBTL( Int64.shl( Int64.make(0,1), i));
            TestBTL( Int64.sub( Int64.make(0,0), Int64.shl( Int64.make(0,1), i)));
        }
        TestBTL( Int64.make(0x7FFFFFFF,0xFFFFFFFF));
        TestBTL( Int64.make(cast(0x80000000,Int),0x00000000));

        // DoubleToInt64Bits;
        TestPair( 1.0000000000000000E+000,  Int64.make(cast(0x3FF00000,Int),cast(0x00000000,Int)));
        TestPair( 1.5000000000000000E+001,  Int64.make(cast(0x402E0000,Int),cast(0x00000000,Int)));
        TestPair( 2.5500000000000000E+002,  Int64.make(cast(0x406FE000,Int),cast(0x00000000,Int)));
        TestPair( 4.2949672950000000E+009,  Int64.make(cast(0x41EFFFFF,Int),cast(0xFFE00000,Int)));
        TestPair( 3.9062500000000000E-003,  Int64.make(cast(0x3F700000,Int),cast(0x00000000,Int)));
        TestPair( 2.3283064365386963E-010,  Int64.make(cast(0x3DF00000,Int),cast(0x00000000,Int)));
        TestPair( 1.2345678901230000E-300,  Int64.make(cast(0x01AA74FE,Int),cast(0x1C1E7E45,Int)));
        TestPair( 1.2345678901234500E-150,  Int64.make(cast(0x20D02A36,Int),cast(0x586DB4BB,Int)));
        TestPair( 1.2345678901234565E+000,  Int64.make(cast(0x3FF3C0CA,Int),cast(0x428C59FA,Int)));
        TestPair( 1.2345678901234567E+000,  Int64.make(cast(0x3FF3C0CA,Int),cast(0x428C59FB,Int)));
        TestPair( 1.2345678901234569E+000,  Int64.make(cast(0x3FF3C0CA,Int),cast(0x428C59FC,Int)));
        TestPair( 1.2345678901234569E+150,  Int64.make(cast(0x5F182344,Int),cast(0xCD3CDF9F,Int)));
        TestPair( 1.2345678901234569E+300,  Int64.make(cast(0x7E3D7EE8,Int),cast(0xBCBBD352,Int)));
        TestPair( -1.7976931348623157E+308, Int64.make(cast(0xFFEFFFFF,Int),cast(0xFFFFFFFF,Int)));
        TestPair( 1.7976931348623157E+308,  Int64.make(cast(0x7FEFFFFF,Int),cast(0xFFFFFFFF,Int)));
        TestPair( 4.9406564584124654E-324,  Int64.make(cast(0x00000000,Int),cast(0x00000001,Int)));
        TestPair( 0.0000000000000000E+000,  Int64.make(cast(0x00000000,Int),cast(0x00000000,Int)));
        TestPair( 4.94065645841247E-324,    Int64.make(cast(0x00000000,Int),cast(0x00000001,Int)));
        TestPair( 3.2378592100206092E-319,  Int64.make(cast(0x00000000,Int),cast(0x0000FFFF,Int)));
        TestPair( 1.3906711615669959E-309,  Int64.make(cast(0x0000FFFF,Int),cast(0xFFFFFFFF,Int)));
        TestPair( Math.NEGATIVE_INFINITY,   Int64.make(cast(0xFFF00000,Int),cast(0x00000000,Int)));
        TestPair( Math.POSITIVE_INFINITY,   Int64.make(cast(0x7FF00000,Int),cast(0x00000000,Int)));

        // NaN is special
        var i64nan = DoubleToInt64Bits( Math.NaN);
        var i64cmp = Int64.make(cast(0xFFF80000, Int), cast(0x00000000, Int));
        if ( ! Math.isNaN( Int64BitsToDouble( i64cmp)))
            throw 'BitConverter NaN-Test #1: expected NaN';

        // For doubles, a quiet NaN is a bit pattern
        // between 7FF8000000000000 and 7FFFFFFFFFFFFFFF
        //      or FFF8000000000000 and FFFFFFFFFFFFFFFF
        var min1 = Int64.make( cast(0x7FF80000, Int), cast(0x00000000, Int));
        var max1 = Int64.make( cast(0x7FFFFFFF, Int), cast(0xFFFFFFFF, Int));
        var min2 = Int64.make( cast(0xFFF80000, Int), cast(0x00000000, Int));
        var max2 = Int64.make( cast(0xFFFFFFFF, Int), cast(0xFFFFFFFF, Int));
        var ok1 =  (Int64.compare( min1, i64nan) <= 0) && (Int64.compare( i64nan, max1) <= 0);
        var ok2 =  (Int64.compare( min2, i64nan) <= 0) && (Int64.compare( i64nan, max2) <= 0);
        if( ! (ok1 || ok2))
            throw 'BitConverter NaN-Test #2: failed';
    }
    #end

}
    