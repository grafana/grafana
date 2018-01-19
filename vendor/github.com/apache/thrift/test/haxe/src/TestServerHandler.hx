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

package;

import org.apache.thrift.*;
import org.apache.thrift.protocol.*;
import org.apache.thrift.transport.*;
import org.apache.thrift.server.*;
import org.apache.thrift.meta_data.*;
import org.apache.thrift.helper.*;

import haxe.Int32;
import haxe.Int64;
import haxe.io.Bytes;
import haxe.ds.IntMap;
import haxe.ds.StringMap;
import haxe.ds.ObjectMap;

import thrift.test.*;  // generated code


class TestServerHandler implements ThriftTest {

    public var server:TServer;

    public function new() {
    }

    /**
    * Prints "testVoid()" and returns nothing.
    */
    public function testVoid():Void
    {
        trace("testVoid()");
    }

    /**
    * Prints 'testBool("%s")' where '%s' with thing as 'true' or 'false'
    * @param bool  thing - the bool data to print
    * @return bool  - returns the bool 'thing'
    *
    * @param thing
    */
    public function testBool(thing : Bool) : Bool
    {
        trace('testBool($thing)');
        return thing;
    }

    /**
    * Prints 'testString("%s")' with thing as '%s'
    * @param string thing - the string to print
    * @return string - returns the string 'thing'
    *
    * @param thing
    */
    public function testString(thing:String):String
    {
        trace("teststring(\"" + thing + "\")");
        return thing;
    }

    /**
    * Prints 'testByte("%d")' with thing as '%d'
    * @param byte thing - the byte to print
    * @return byte - returns the byte 'thing'
    *
    * @param thing
    */
    public function testByte(thing:haxe.Int32):haxe.Int32
    {
        trace("testByte(" + thing + ")");
        return thing;
    }

    /**
    * Prints 'testI32("%d")' with thing as '%d'
    * @param i32 thing - the i32 to print
    * @return i32 - returns the i32 'thing'
    *
    * @param thing
    */
    public function testI32(thing:haxe.Int32):haxe.Int32
    {
        trace("testI32(" + thing + ")");
        return thing;
    }

    /**
    * Prints 'testI64("%d")' with thing as '%d'
    * @param i64 thing - the i64 to print
    * @return i64 - returns the i64 'thing'
    *
    * @param thing
    */
    public function testI64(thing:haxe.Int64):haxe.Int64
    {
        trace("testI64(" + thing + ")");
        return thing;
    }

    /**
    * Prints 'testDouble("%f")' with thing as '%f'
    * @param double thing - the double to print
    * @return double - returns the double 'thing'
    *
    * @param thing
    */
    public function testDouble(thing:Float):Float
    {
        trace("testDouble(" + thing + ")");
        return thing;
    }

    /**
     * Prints 'testBinary("%s")' where '%s' is a hex-formatted string of thing's data
     * @param binary  thing - the binary data to print
     * @return binary  - returns the binary 'thing'
     *
     * @param thing
     */
    public function testBinary(thing : haxe.io.Bytes) : haxe.io.Bytes
    {
        var hex = "";
        for ( i in 0 ... thing.length) {
            hex += StringTools.hex( thing.get(i), 2);
        }
        trace('testBinary($hex)');
        return thing;
    }

    /**
    * Prints 'testStruct("{%s}")' where thing has been formatted
    *  into a string of comma separated values
    * @param Xtruct thing - the Xtruct to print
    * @return Xtruct - returns the Xtruct 'thing'
    *
    * @param thing
    */
    public function testStruct(thing:Xtruct):Xtruct
    {
        trace("testStruct({" +
                          "\"" + thing.string_thing + "\", " +
                          thing.byte_thing + ", " +
                          thing.i32_thing + ", " +
                          Int64.toStr(thing.i64_thing) + "})");
        return thing;
    }

    /**
    * Prints 'testNest("{%s}")' where thing has been formatted
    *  into a string of the nested struct
    * @param Xtruct2 thing - the Xtruct2 to print
    * @return Xtruct2 - returns the Xtruct2 'thing'
    *
    * @param thing
    */
    public function testNest(nest:Xtruct2):Xtruct2
    {
        var thing:Xtruct = nest.struct_thing;
        trace("testNest({" +
                          nest.byte_thing + ", {" +
                          "\"" + thing.string_thing + "\", " +
                          thing.byte_thing + ", " +
                          thing.i32_thing + ", " +
                          Int64.toStr(thing.i64_thing) + "}, " +
                          nest.i32_thing + "})");
        return nest;
    }

    /**
    * Prints 'testMap("{%s")' where thing has been formatted
    *  into a string of  'key => value' pairs
    *  separated by commas and new lines
    * @param map<i32,i32> thing - the map<i32,i32> to print
    * @return map<i32,i32> - returns the map<i32,i32> 'thing'
    *
    * @param thing
    */
    public function testMap(thing:IntMap<haxe.Int32>):IntMap<haxe.Int32>
    {
        trace("testMap({");
        var first:Bool = true;
        for (key in thing.keys()) {
            if (first) {
                first = false;
            } else {
                trace(", ");
            };
            trace(key + " => " + thing.get(key));
        };
        trace("})");
        return thing;
    }

    /**
    * Prints 'testStringMap("{%s}")' where thing has been formatted
    *  into a string of  'key => value' pairs
    *  separated by commas and new lines
    * @param map<string,string> thing - the map<string,string> to print
    * @return map<string,string> - returns the map<string,string> 'thing'
    *
    * @param thing
    */
    public function testStringMap(thing:StringMap<String>):StringMap<String>
    {
        trace("testStringMap({");
        var first:Bool = true;
        for (key in thing.keys()) {
            if (first) {
                first = false;
            } else {
                trace(", ");
            };
            trace(key + " => " + thing.get(key));
        };
        trace("})");
        return thing;
    }

    /**
    * Prints 'testSet("{%s}")' where thing has been formatted
    *  into a string of  values
    *  separated by commas and new lines
    * @param set<i32> thing - the set<i32> to print
    * @return set<i32> - returns the set<i32> 'thing'
    *
    * @param thing
    */
    public function testSet(thing:IntSet):IntSet
    {
        trace("testSet({");
        var first:Bool = true;
        for (elem in thing) {
            if (first) {
                first = false;
            } else {
                trace(", ");
            };
            trace(elem);
        };
        trace("})");
        return thing;
    }

    /**
    * Prints 'testList("{%s}")' where thing has been formatted
    *  into a string of  values
    *  separated by commas and new lines
    * @param list<i32> thing - the list<i32> to print
    * @return list<i32> - returns the list<i32> 'thing'
    *
    * @param thing
    */
    public function testList(thing:List<haxe.Int32>):List<haxe.Int32>
    {
        trace("testList({");
        var first:Bool = true;
        for (elem in thing) {
            if (first) {
                first = false;
            } else {
                trace(", ");
            };
            trace(elem);
        };
        trace("})");
        return thing;
    }

    /**
    * Prints 'testEnum("%d")' where thing has been formatted into it's numeric value
    * @param Numberz thing - the Numberz to print
    * @return Numberz - returns the Numberz 'thing'
    *
    * @param thing
    */
    public function testEnum(thing:Int):Int
    {
        trace("testEnum(" + thing + ")");
        return thing;
    }

    /**
    * Prints 'testTypedef("%d")' with thing as '%d'
    * @param UserId thing - the UserId to print
    * @return UserId - returns the UserId 'thing'
    *
    * @param thing
    */
    public function testTypedef(thing:haxe.Int64):haxe.Int64
    {
        trace("testTypedef(" + thing + ")");
        return thing;
    }

    /**
    * Prints 'testMapMap("%d")' with hello as '%d'
    * @param i32 hello - the i32 to print
    * @return map<i32,map<i32,i32>> - returns a dictionary with these values:
    *   {-4 => {-4 => -4, -3 => -3, -2 => -2, -1 => -1, },
    *     4 => {1 => 1, 2 => 2, 3 => 3, 4 => 4, }, }
    *
    * @param hello
    */
    public function testMapMap(hello:haxe.Int32):IntMap<IntMap<haxe.Int32>>
    {
        trace("testMapMap(" + hello + ")");
        var mapmap = new IntMap<IntMap<Int>>();
        var pos = new IntMap<Int>();
        var neg = new IntMap<Int>();
        for (i in 1 ... 5) {
            pos.set(i, i);
            neg.set(-i, -i);
        };
        mapmap.set(4, pos);
        mapmap.set(-4, neg);
        return mapmap;
    }

    /**
    * So you think you've got this all worked, out eh?
    *
    * Creates a the returned map with these values and prints it out:
    *   { 1 => { 2 => argument,
    *            3 => argument,
    *          },
    *     2 => { 6 => <empty Insanity struct>, },
    *   }
    * @return map<UserId, map<Numberz,Insanity>> - a map with the above values
    *
    * @param argument
    */
    public function testInsanity(argument : Insanity) : Int64Map< IntMap< Insanity>>
    {
        trace("testInsanity()");

        var hello = new Xtruct();
        hello.string_thing = "Hello2";
        hello.byte_thing = 2;
        hello.i32_thing = 2;
        hello.i64_thing = Int64.make(0, 2);

        var goodbye = new Xtruct();
        goodbye.string_thing = "Goodbye4";
        goodbye.byte_thing = 4;
        goodbye.i32_thing = 4;
        goodbye.i64_thing = Int64.make(0, 4);

        var crazy = new Insanity();
        crazy.userMap = new IntMap< haxe.Int64>();
        crazy.userMap.set(Numberz.EIGHT, Int64.make(0,8));
        crazy.xtructs = new List<Xtruct>();
        crazy.xtructs.add(goodbye);

        var looney = new Insanity();
        crazy.userMap.set(Numberz.FIVE, Int64.make(0,5));
        crazy.xtructs.add(hello);

        var first_map = new IntMap< Insanity>();
        first_map.set(Numberz.TWO, crazy);
        first_map.set(Numberz.THREE, crazy);

        var second_map = new IntMap< Insanity>();
        second_map.set(Numberz.SIX, looney);

        var insane = new Int64Map< IntMap< Insanity>>();
        insane.set( Int64.make(0,1), first_map);
        insane.set( Int64.make(0,2), second_map);

        return insane;
    }

    /**
    * Prints 'testMulti()'
    * @param byte arg0 -
    * @param i32 arg1 -
    * @param i64 arg2 -
    * @param map<i16, string> arg3 -
    * @param Numberz arg4 -
    * @param UserId arg5 -
    * @return Xtruct - returns an Xtruct
    *    with string_thing = "Hello2, byte_thing = arg0, i32_thing = arg1
    *    and i64_thing = arg2
    *
    * @param arg0
    * @param arg1
    * @param arg2
    * @param arg3
    * @param arg4
    * @param arg5
    */
    public function testMulti(arg0:haxe.Int32, arg1:haxe.Int32, arg2:haxe.Int64,
        arg3:IntMap<String>, arg4:Int, arg5:haxe.Int64):Xtruct
    {
        trace("testMulti()");
        var hello = new Xtruct();
        hello.string_thing = "Hello2";
        hello.byte_thing = arg0;
        hello.i32_thing = arg1;
        hello.i64_thing = arg2;
        return hello;
    }

    /**
    * Print 'testException(%s)' with arg as '%s'
    * @param string arg - a string indication what type of exception to throw
    * if arg == "Xception" throw Xception with errorCode = 1001 and message = arg
    * elsen if arg == "TException" throw TException
    * else do not throw anything
    *
    * @param arg
    */
    public function testException(arg:String):Void
    {
        trace("testException(" + arg + ")");
        if (arg == "Xception") {
            var x = new Xception();
            x.errorCode = 1001;
            x.message = arg;
            throw x;
        };
        if (arg == "TException") {
            throw new TException();
        };
        return;
    }

    /**
    * Print 'testMultiException(%s, %s)' with arg0 as '%s' and arg1 as '%s'
    * @param string arg - a string indication what type of exception to throw
    * if arg0 == "Xception"
    * throw Xception with errorCode = 1001 and message = "This is an Xception"
    * else if arg0 == "Xception2"
    * throw Xception2 with errorCode = 2002 and message = "This is an Xception2"
    * else do not throw anything
    * @return Xtruct - an Xtruct with string_thing = arg1
    *
    * @param arg0
    * @param arg1
    */
    public function testMultiException(arg0:String, arg1:String):Xtruct
    {
        trace("testMultiException(" + arg0 + ", " + arg1 + ")");
        if (arg0 == "Xception") {
            var x = new Xception();
            x.errorCode = 1001;
            x.message = "This is an Xception";
            throw x;
        } else if (arg0 == "Xception2") {
            var x = new Xception2();
            x.errorCode = 2002;
            x.struct_thing = new Xtruct();
            x.struct_thing.string_thing = "This is an Xception2";
            throw x;
        };
        var result = new Xtruct();
        result.string_thing = arg1;
        return result;
    }

    /**
    * Print 'testOneway(%d): Sleeping...' with secondsToSleep as '%d'
    * sleep 'secondsToSleep'
    * Print 'testOneway(%d): done sleeping!' with secondsToSleep as '%d'
    * @param i32 secondsToSleep - the number of seconds to sleep
    *
    * @param secondsToSleep
    */
    public function testOneway(secondsToSleep:haxe.Int32):Void
    {
        trace("testOneway(" + secondsToSleep + "), sleeping...");
        Sys.sleep(secondsToSleep);
        trace("testOneway finished");
    }

    public function testStop():Void
    {
        if (server != null) {
            server.Stop();
        };
    }
}
