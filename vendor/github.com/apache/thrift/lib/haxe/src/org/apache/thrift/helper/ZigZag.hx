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
import haxe.Int32;

class ZigZag {

    /**
     * Convert n into a zigzag int. This allows negative numbers to be
     * represented compactly as a varint.
     */
    public static function FromInt( n : Int) : UInt    {
        #if php

        return cast(cast(cast(n,Int32) << 1,Int32) ^ cast(cast(n,Int32) >> 31,Int32),UInt);

        #else

        return cast(n << 1,UInt) ^ cast(n >> 31,UInt);

        #end
    }


    /**
     * Convert from zigzag int to int.
     */
    public static function ToInt( n : UInt) : Int {
        #if php

        var a = (0x7FFFFFFF & cast(n >> 1,Int));
        var b = (cast(n & 1,Int));
        b = -b;  // workaround for https://github.com/HaxeFoundation/haxe/issues/5288
        return a ^ b;

        #else

        return (0x7FFFFFFF & cast(n >> 1,Int)) ^ (-cast(n & 1,Int));

        #end
    }


    /**
     * Convert l into a zigzag long. This allows negative numbers to be
     * represented compactly as a varint.
     */
    public static function FromLong( n : Int64) : Int64 {
        return Int64.xor( Int64.shl(n, 1), Int64.shr(n, 63));
    }


    /**
     * Convert from zigzag long to long.
     */
    public static function ToLong( n : Int64) : Int64 {
        return Int64.xor(
            Int64.and(
                Int64.shr(n, 1),
                Int64.make(0x7FFFFFFF, 0xFFFFFFFF)),
            Int64.sub(
                Int64.make(0, 0),
                Int64.and(n, Int64.make(0,1))));
    }


    #if debug
    private static function Test32( test : Int) : Void {
        var a : UInt = ZigZag.FromInt( test);
        var b : Int = ZigZag.ToInt(a);
        #if php
        test = test & 0xFFFFFFFF;  // workaround for https://github.com/HaxeFoundation/haxe/issues/5289
        #end
        if( test != b)
            throw 'ZigZag.Test32($test) failed: a = $a, b = $b';
    }
    #end



    #if debug
    private static function Test64( test : haxe.Int64) : Void {
        var a : Int64 = ZigZag.FromLong( test);
        var b : Int64 = ZigZag.ToLong(a);
        if( Int64.compare( test, b) != 0)
            throw 'ZigZag.Test64($test) failed: a = $a, b = $b';
    }
    #end


    #if debug
    public static function UnitTest() : Void {
      var u1 : UInt = 0xFFFFFFFE;
      var u2 : UInt = 0xFFFFFFFF;
      var i1 : Int = 2147483647;
      var i2 : Int = -2147483648;

      #if php
      i2 = i2 & 0xFFFFFFFF;  // workaround for https://github.com/HaxeFoundation/haxe/issues/5289
      #end

      // protobuf testcases
      if( FromInt(0)  != 0) throw 'pb #1 to ZigZag';
      if( FromInt(-1) != 1) throw 'pb #2 to ZigZag';
      if( FromInt(1)  != 2) throw 'pb #3 to ZigZag';
      if( FromInt(-2) != 3) throw 'pb #4 to ZigZag';
      if( FromInt(i1) != u1) throw 'pb #5 to ZigZag';
      if( FromInt(i2) != u2) throw 'pb #6 to ZigZag';

      // protobuf testcases
      if( ToInt(0) != 0) throw 'pb #1 from ZigZag';
      if( ToInt(1) != -1) throw 'pb #2 from ZigZag';
      if( ToInt(2) != 1) throw 'pb #3 from ZigZag';
      if( ToInt(3) != -2) throw 'pb #4 from ZigZag';
      if( ToInt(u1) != i1) throw 'pb #5 from ZigZag, got ${ToInt(u1)} expected $i1';
      if( ToInt(u2) != i2) throw 'pb #6 from ZigZag, got ${ToInt(u2)} expected $i2';

      // back and forth 32
      Test32( 0);
      for( i in 0 ... 30) {
        Test32( 1 << i);
        Test32( -(1  << i));
      }
      Test32( 0x7FFFFFFF);
      Test32( cast(0x80000000,Int));

      // back and forth 64
      Test64( Int64.make(0,0));
      for( i in 0 ... 62) {
        Test64( Int64.shl( Int64.make(0,1), i));
        Test64( Int64.sub( Int64.make(0,0), Int64.shl( Int64.make(0,1), i)));
      }
      Test64( Int64.make(0x7FFFFFFF,0xFFFFFFFF));
      Test64( Int64.make(cast(0x80000000,Int),0x00000000));
    }
    #end
}

   