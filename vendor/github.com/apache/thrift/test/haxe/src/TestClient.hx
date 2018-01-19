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

import haxe.Int32;
import haxe.Int64;
import haxe.io.Bytes;
import haxe.Timer;
import haxe.ds.IntMap;
import haxe.ds.StringMap;
import haxe.ds.ObjectMap;

import org.apache.thrift.*;
import org.apache.thrift.helper.*;
import org.apache.thrift.protocol.*;
import org.apache.thrift.transport.*;
import org.apache.thrift.server.*;
import org.apache.thrift.meta_data.*;

#if cpp
import cpp.vm.Thread;
#else
// no thread support (yet)
#end

import thrift.test.*;  // generated code


using StringTools;

class TestResults {
    private var successCnt : Int = 0;
    private var errorCnt : Int = 0;
    private var failedTests : String = "";
    private var print_direct : Bool = false;

    public static var EXITCODE_SUCCESS            = 0x00;  // no errors bits set
    //
    public static var EXITCODE_FAILBIT_BASETYPES  = 0x01;
    public static var EXITCODE_FAILBIT_STRUCTS    = 0x02;
    public static var EXITCODE_FAILBIT_CONTAINERS = 0x04;
    public static var EXITCODE_FAILBIT_EXCEPTIONS = 0x08;
    //
    public static var EXITCODE_ALL_FAILBITS       = 0x0F;
    //
    private var testsExecuted : Int = 0;
    private var testsFailed : Int = 0;
    private var currentTest : Int = 0;


    public function new(direct : Bool) {
        print_direct = direct;
    }

    public function StartTestGroup( groupBit : Int) : Void {
        currentTest = groupBit;
        testsExecuted |= groupBit;
    }

    public function Expect( expr : Bool, msg : String) : Void {
        if ( expr) {
            ++successCnt;
        } else {
            ++errorCnt;
            testsFailed |= currentTest;
            failedTests += "\n  " + msg;
            if( print_direct) {
                trace('FAIL: $msg');
            }
        }
    }

    public function CalculateExitCode() : Int {
        var notExecuted : Int = EXITCODE_ALL_FAILBITS & (~testsExecuted);
        return testsFailed | notExecuted;
    }

    public function PrintSummary() : Void {
        var total = successCnt + errorCnt;
        var sp = Math.round((1000 * successCnt) / total) / 10;
        var ep = Math.round((1000 * errorCnt) / total) / 10;

        trace('===========================');
        trace('Tests executed    $total');
        trace('Tests succeeded   $successCnt ($sp%)');
        trace('Tests failed      $errorCnt ($ep%)');
        if ( errorCnt > 0)
        {
            trace('===========================');
            trace('FAILED TESTS: $failedTests');
        }
        trace('===========================');
    }
}


class TestClient {

    public static function Execute(args : Arguments) :  Void
    {
        var exitCode = 0xFF;
        try
        {
            var difft = Timer.stamp();

            if ( args.numThreads > 1) {
                #if cpp
                exitCode = MultiThreadClient(args);
                #else
                trace('Threads not supported/implemented for this platform.');
                exitCode = SingleThreadClient(args);
                #end
            } else {
                exitCode = SingleThreadClient(args);
            }

            difft = Math.round( 1000 * (Timer.stamp() - difft)) / 1000;
            trace('total test time: $difft seconds');
        }
        catch (e : TException)
        {
            trace('TException: $e');
            exitCode = 0xFF;
        }
        catch (e : Dynamic)
        {
            trace('Exception: $e');
            exitCode = 0xFF;
        }

        #if sys
        Sys.exit( exitCode);
        #end
    }


    public static function SingleThreadClient(args : Arguments) :  Int
    {
        var rslt = new TestResults(true);
        RunClient(args,rslt);
        rslt.PrintSummary();
        return rslt.CalculateExitCode();
    }


    #if cpp
    public static function MultiThreadClient(args : Arguments) :  Int
    {
        var threads = new List<Thread>();
        for( test in 0 ... args.numThreads) {
            threads.add( StartThread( args));
        }
        var exitCode : Int = 0;
        for( thread in threads) {
            exitCode |= Thread.readMessage(true);
        }
        return exitCode;
    }
    #end

    #if cpp
    private static function StartThread(args : Arguments) : Thread {
        var thread = Thread.create(
            function() : Void {
                var rslt = new TestResults(false);
                var main : Thread = Thread.readMessage(true);
                try
                {
                    RunClient(args,rslt);
                }
                catch (e : TException)
                {
                    rslt.Expect( false, '$e');
                    trace('$e');
                }
                catch (e : Dynamic)
                {
                    rslt.Expect( false, '$e');
                    trace('$e');
                }
                main.sendMessage( rslt.CalculateExitCode());
            });

        thread.sendMessage(Thread.current());
        return thread;
    }
    #end


    public static function RunClient(args : Arguments, rslt : TestResults)
    {
        var transport : TTransport = null;
        switch (args.transport)
        {
            case socket:
                transport = new TSocket(args.host, args.port);
            case http:
                var uri = 'http://${args.host}:${args.port}';
                trace('- http client : ${uri}');
                transport = new THttpClient(uri);
            default:
                throw "Unhandled transport";
        }

        // optional: layered transport
        if ( args.framed) {
            trace("- framed transport");
            transport = new TFramedTransport(transport);
        }
        if ( args.buffered) {
            trace("- buffered transport");
            transport = new TBufferedTransport(transport);
        }

        // protocol
        var protocol : TProtocol = null;
        switch( args.protocol)
        {
        case binary:
            trace("- binary protocol");
            protocol = new TBinaryProtocol(transport);
        case json:
            trace("- json protocol");
            protocol = new TJSONProtocol(transport);
        case compact:
            trace("- compact protocol");
            protocol = new TCompactProtocol(transport);
        }

        // some quick and basic unit tests
        HaxeBasicsTest( args, rslt);
        ModuleUnitTests( args, rslt);

        // now run the test code
        trace('- ${args.numIterations} iterations');
        for( i in 0 ... args.numIterations) {
            ClientTest( transport, protocol, args, rslt);
        }
    }


    public static function HaxeBasicsTest( args : Arguments, rslt : TestResults) : Void
    {
        // We need to test a few basic things used in the ClientTest
        // Anything else beyond this scope should go into /lib/haxe/ instead
        rslt.StartTestGroup( TestResults.EXITCODE_FAILBIT_BASETYPES);

        var map32 = new IntMap<Int32>();
        var map64 = new Int64Map<Int32>();

        rslt.Expect( map32.keys().hasNext() == map64.keys().hasNext(), "Int64Map<Int32> Test #1");
        rslt.Expect( map32.exists( 4711) == map64.exists( Int64.make(47,11)), "Int64Map<Int32> Test #2");
        rslt.Expect( map32.remove( 4711) == map64.remove( Int64.make(47,11)), "Int64Map<Int32> Test #3");
        rslt.Expect( map32.get( 4711) == map64.get( Int64.make(47,11)), "Int64Map<Int32> Test #4");

        map32.set( 42, 815);
        map64.set( Int64.make(0,42), 815);
        map32.set( -517, 23);
        map64.set( Int64.neg(Int64.make(0,517)), 23);
        map32.set( 0, -123);
        map64.set( Int64.make(0,0), -123);

        //trace('map32 = $map32');
        //trace('map64 = $map64');

        rslt.Expect( map32.keys().hasNext() == map64.keys().hasNext(), "Int64Map<Int32> Test #10");
        rslt.Expect( map32.exists( 4711) == map64.exists( Int64.make(47,11)), "Int64Map<Int32> Test #11");
        rslt.Expect( map32.exists( -517) == map64.exists( Int64.neg(Int64.make(0,517))), "Int64Map<Int32> Test #12");
        rslt.Expect( map32.exists( 42) == map64.exists( Int64.make(0,42)), "Int64Map<Int32> Test #13");
        rslt.Expect( map32.exists( 0) == map64.exists( Int64.make(0,0)), "Int64Map<Int32> Test #14");
        rslt.Expect( map32.get( 4711) == map64.get( Int64.make(47,11)), "Int64Map<Int32> Test #15");
        rslt.Expect( map32.get( -517) == map64.get( Int64.neg(Int64.make(0,517))), "Int64Map<Int32> Test #16");
        rslt.Expect( map32.get( 42) == map64.get( Int64.make(0,42)), "Int64Map<Int32> Test #Int64.make(-5,17)");
        rslt.Expect( map32.get( 0) == map64.get( Int64.make(0,0)), "Int64Map<Int32> Test #18");
        rslt.Expect( map32.remove( 4711) == map64.remove( Int64.make(47,11)), "Int64Map<Int32> Test #19");
        rslt.Expect( map32.remove( -517) == map64.remove( Int64.neg(Int64.make(0,517))), "Int64Map<Int32> Test #20");
        rslt.Expect( map32.exists( 4711) == map64.exists( Int64.make(47,11)), "Int64Map<Int32> Test #21");
        rslt.Expect( map32.exists( -517) == map64.exists( Int64.neg(Int64.make(0,517))), "Int64Map<Int32> Test #22");
        rslt.Expect( map32.exists( 42) == map64.exists( Int64.make(0,42)), "Int64Map<Int32> Test #23");
        rslt.Expect( map32.exists( 0) == map64.exists( Int64.make(0,0)), "Int64Map<Int32> Test #24");
        rslt.Expect( map32.get( 4711) == map64.get( Int64.make(47,11)), "Int64Map<Int32> Test #25");
        rslt.Expect( map32.get( -517) == map64.get( Int64.neg(Int64.make(0,517))), "Int64Map<Int32> Test #26");
        rslt.Expect( map32.get( 42) == map64.get( Int64.make(0,42)), "Int64Map<Int32> Test #27");
        rslt.Expect( map32.get( 0) == map64.get( Int64.make(0,0)), "Int64Map<Int32> Test #28");

        map32.set( 42, 1);
        map64.set( Int64.make(0,42), 1);
        map32.set( -517, -2);
        map64.set( Int64.neg(Int64.make(0,517)), -2);
        map32.set( 0, 3);
        map64.set( Int64.make(0,0), 3);

        var c32 = 0;
        var ksum32 = 0;
        for (key in map32.keys()) {
            ++c32;
            ksum32 += key;
        }
        var c64 = 0;
        var ksum64 = Int64.make(0,0);
        for (key in map64.keys()) {
            ++c64;
            ksum64 = Int64.add( ksum64, key);
        }
        rslt.Expect( c32 == c64, "Int64Map<Int32> Test #30");
        rslt.Expect( '$ksum64' == '$ksum32', '$ksum64 == $ksum32   Test #31');

        //compare without spaces because differ in php and cpp
        var s32 = map32.toString().replace(' ', '');
        var s64 = map64.toString().replace(' ', '');
        rslt.Expect( s32 == s64, "Int64Map<Int32>.toString(): " + ' ("$s32" == "$s64") Test #32');

        map32.remove( 42);
        map64.remove( Int64.make(0,42));
        map32.remove( -517);
        map64.remove( Int64.neg(Int64.make(0,517)));
        map32.remove( 0);
        map64.remove( Int64.make(0,0));

        rslt.Expect( map32.keys().hasNext() == map64.keys().hasNext(), "Int64Map<Int32> Test #90");
        rslt.Expect( map32.exists( 4711) == map64.exists( Int64.make(47,11)), "Int64Map<Int32> Test #91");
        rslt.Expect( map32.exists( -517) == map64.exists( Int64.neg(Int64.make(0,517))), "Int64Map<Int32> Test #92");
        rslt.Expect( map32.exists( 42) == map64.exists( Int64.make(0,42)), "Int64Map<Int32> Test #93");
        rslt.Expect( map32.exists( 0) == map64.exists( Int64.make(0,0)), "Int64Map<Int32> Test #94");
        rslt.Expect( map32.get( 4711) == map64.get( Int64.make(47,11)), "Int64Map<Int32> Test #95");
        rslt.Expect( map32.get( -517) == map64.get( Int64.make(-5,17)), "Int64Map<Int32> Test #96");
        rslt.Expect( map32.get( 42) == map64.get( Int64.make(0,42)), "Int64Map<Int32> Test #97");
        rslt.Expect( map32.get( 0) == map64.get( Int64.make(0, 0)), "Int64Map<Int32> Test #98");
    }


    // core module unit tests
    public static function ModuleUnitTests( args : Arguments, rslt : TestResults) : Void {
        #if debug

        try {
            BitConverter.UnitTest();
            rslt.Expect( true, 'BitConverter.UnitTest  Test #100');
        }
        catch( e : Dynamic) {
            rslt.Expect( false, 'BitConverter.UnitTest: $e  Test #100');
        }

        try {
            ZigZag.UnitTest();
            rslt.Expect( true, 'ZigZag.UnitTest  Test #101');
        }
        catch( e : Dynamic) {
            rslt.Expect( false, 'ZigZag.UnitTest: $e  Test #101');
        }

        #end
    }


    public static function BytesToHex(data : Bytes) : String {
        var hex = "";
        for ( i in 0 ... data.length) {
            hex += StringTools.hex( data.get(i), 2);
        }
        return hex;
    }

    public static function PrepareTestData(randomDist : Bool) : Bytes    {
        var retval = Bytes.alloc(0x100);
        var initLen : Int = (retval.length > 0x100 ? 0x100 : retval.length);

        // linear distribution, unless random is requested
        if (!randomDist) {
            for (i in 0 ... initLen) {
                retval.set(i, i % 0x100);
            }
            return retval;
        }

        // random distribution
        for (i in 0 ... initLen) {
            retval.set(i, 0);
        }
        for (i in 1 ... initLen) {
            while( true) {
                var nextPos = Std.random(initLen);
                if (retval.get(nextPos) == 0) {
                    retval.set( nextPos, i % 0x100);
                    break;
                }
            }
        }
        return retval;
    }


    public static function ClientTest( transport : TTransport, protocol : TProtocol,
                                       args : Arguments, rslt : TestResults) : Void
    {
        var client = new ThriftTestImpl(protocol,protocol);
        try
        {
            if (!transport.isOpen())
            {
                transport.open();
            }
        }
        catch (e : TException)
        {
            rslt.Expect( false, 'unable to open transport: $e');
            return;
        }
        catch (e : Dynamic)
        {
            rslt.Expect( false, 'unable to open transport: $e');
            return;
        }

        var start = Date.now();

        rslt.StartTestGroup( TestResults.EXITCODE_FAILBIT_EXCEPTIONS);

        // if arg == "Xception" throw Xception with errorCode = 1001 and message = arg
        trace('testException("Xception")');
        try {
            client.testException("Xception");
            rslt.Expect( false, 'testException("Xception") should throw');
        }
        catch (e : Xception)
        {
            rslt.Expect( e.message == "Xception", 'testException("Xception")  -  e.message == "Xception"');
            rslt.Expect( e.errorCode == 1001, 'testException("Xception")  -  e.errorCode == 1001');
        }
        catch (e : Dynamic)
        {
            rslt.Expect( false, 'testException("Xception")  -  $e');
        }

        // if arg == "TException" throw TException
        trace('testException("TException")');
        try {
            client.testException("TException");
            rslt.Expect( false, 'testException("TException") should throw');
        }
        catch (e : TException)
        {
            rslt.Expect( true, 'testException("TException")  -  $e');
        }
        catch (e : Dynamic)
        {
            rslt.Expect( false, 'testException("TException")  -  $e');
        }

        // reopen the transport, just in case the server closed his end
        if (transport.isOpen())
            transport.close();
        transport.open();

        // else do not throw anything
        trace('testException("bla")');
        try {
            client.testException("bla");
            rslt.Expect( true, 'testException("bla") should not throw');
        }
        catch (e : Dynamic)
        {
            rslt.Expect( false, 'testException("bla")  -  $e');
        }

        rslt.StartTestGroup( TestResults.EXITCODE_FAILBIT_BASETYPES);

        trace('testVoid()');
        client.testVoid();
        trace(' = void');
        rslt.Expect(true,"testVoid()");  // bump counter

        trace('testBool(${true})');
        var b = client.testBool(true);
        trace(' = $b');
        rslt.Expect(b, '$b == "${true}"');
        trace('testBool(${false})');
        b = client.testBool(false);
        trace(' = $b');
        rslt.Expect( ! b, '$b == "${false}"');

        trace('testString("Test")');
        var s = client.testString("Test");
        trace(' = "$s"');
        rslt.Expect(s == "Test", '$s == "Test"');

        trace('testByte(1)');
        var i8 = client.testByte(1);
        trace(' = $i8');
        rslt.Expect(i8 == 1, '$i8 == 1');

        trace('testI32(-1)');
        var i32 = client.testI32(-1);
        trace(' = $i32');
        rslt.Expect(i32 == -1, '$i32 == -1');

        trace('testI64(-34359738368)');
        var i64 = client.testI64( Int64.make( 0xFFFFFFF8, 0x00000000)); // -34359738368
        trace(' = $i64');
        rslt.Expect( Int64.compare( i64, Int64.make( 0xFFFFFFF8, 0x00000000)) == 0,
                     Int64.toStr(i64) +" == "+Int64.toStr(Int64.make( 0xFFFFFFF8, 0x00000000)));

        // edge case: the largest negative Int64 has no positive Int64 equivalent
        trace('testI64(-9223372036854775808)');
        i64 = client.testI64( Int64.make( 0x80000000, 0x00000000)); // -9223372036854775808
        trace(' = $i64');
        rslt.Expect( Int64.compare( i64, Int64.make( 0x80000000, 0x00000000)) == 0,
                     Int64.toStr(i64) +" == "+Int64.toStr(Int64.make( 0x80000000, 0x00000000)));

        trace('testDouble(5.325098235)');
        var dub = client.testDouble(5.325098235);
        trace(' = $dub');
        rslt.Expect(dub == 5.325098235, '$dub == 5.325098235');

        var binOut = PrepareTestData(true);
        trace('testBinary('+BytesToHex(binOut)+')');
        try {
            var binIn = client.testBinary(binOut);
            trace('testBinary() = '+BytesToHex(binIn));
            rslt.Expect( binIn.length == binOut.length, '${binIn.length} == ${binOut.length}');
            var len = ((binIn.length < binOut.length)  ?  binIn.length  : binOut.length);
            for (ofs in 0 ... len) {
                if (binIn.get(ofs) != binOut.get(ofs)) {
                    rslt.Expect( false, 'testBinary('+BytesToHex(binOut)+'): content mismatch at offset $ofs');
                }
            }
        }
        catch (e : TApplicationException) {
            trace('testBinary('+BytesToHex(binOut)+'): '+e.errorMsg);  // may not be supported by the server
        }


        rslt.StartTestGroup( TestResults.EXITCODE_FAILBIT_STRUCTS);

        trace('testStruct({"Zero", 1, -3, -5})');
        var o = new Xtruct();
        o.string_thing = "Zero";
        o.byte_thing = 1;
        o.i32_thing = -3;
        o.i64_thing = Int64.make(0,-5);
        var i = client.testStruct(o);
        trace(' = {"' + i.string_thing + '", ' + i.byte_thing +', '
                      + i.i32_thing +', '+ Int64.toStr(i.i64_thing) + '}');
        rslt.Expect( i.string_thing == o.string_thing, "i.string_thing == o.string_thing");
        rslt.Expect( i.byte_thing == o.byte_thing, "i.byte_thing == o.byte_thing");
        rslt.Expect( i.i32_thing == o.i32_thing, "i.i64_thing == o.i64_thing");
        rslt.Expect( i.i32_thing == o.i32_thing, "i.i64_thing == o.i64_thing");

        trace('testNest({1, {\"Zero\", 1, -3, -5}, 5})');
        var o2 = new Xtruct2();
        o2.byte_thing = 1;
        o2.struct_thing = o;
        o2.i32_thing = 5;
        var i2 = client.testNest(o2);
        i = i2.struct_thing;
        trace(" = {" + i2.byte_thing + ", {\"" + i.string_thing + "\", "
              + i.byte_thing + ", " + i.i32_thing + ", " + Int64.toStr(i.i64_thing) + "}, "
              + i2.i32_thing + "}");
        rslt.Expect( i2.byte_thing == o2.byte_thing, "i2.byte_thing == o2.byte_thing");
        rslt.Expect( i2.i32_thing == o2.i32_thing, "i2.i32_thing == o2.i32_thing");
        rslt.Expect( i.string_thing == o.string_thing, "i.string_thing == o.string_thing");
        rslt.Expect( i.byte_thing == o.byte_thing, "i.byte_thing == o.byte_thing");
        rslt.Expect( i.i32_thing == o.i32_thing, "i.i32_thing == o.i32_thing");
        rslt.Expect( Int64.compare( i.i64_thing, o.i64_thing) == 0, "i.i64_thing == o.i64_thing");


        rslt.StartTestGroup( TestResults.EXITCODE_FAILBIT_CONTAINERS);

        var mapout = new IntMap< haxe.Int32>();
        for ( j in 0 ... 5)
        {
            mapout.set(j, j - 10);
        }
        trace("testMap({");
        var first : Bool = true;
        for( key in mapout.keys())
        {
            if (first)
            {
                first = false;
            }
            else
            {
                trace(", ");
            }
            trace(key + " => " + mapout.get(key));
        }
        trace("})");

        var mapin = client.testMap(mapout);

        trace(" = {");
        first = true;
        for( key in mapin.keys())
        {
            if (first)
            {
                first = false;
            }
            else
            {
                trace(", ");
            }
            trace(key + " => " + mapin.get(key));
            rslt.Expect( mapin.get(key) == mapout.get(key), ' mapin.get($key) == mapout.get($key)');
        }
        trace("}");
        for( key in mapout.keys())
        {
            rslt.Expect(mapin.exists(key), 'mapin.exists($key)');
        }

        var listout = new List<Int>();
        for (j in -2 ... 3)
        {
            listout.add(j);
        }
        trace("testList({");
        first = true;
        for( j in listout)
        {
            if (first)
            {
                first = false;
            }
            else
            {
                trace(", ");
            }
            trace(j);
        }
        trace("})");

        var listin = client.testList(listout);

        trace(" = {");
        first = true;
        for( j in listin)
        {
            if (first)
            {
                first = false;
            }
            else
            {
                trace(", ");
            }
            trace(j);
        }
        trace("}");

        rslt.Expect(listin.length == listout.length, "listin.length == listout.length");
        var literout = listout.iterator();
        var literin = listin.iterator();
        while( literin.hasNext()) {
            rslt.Expect(literin.next() == literout.next(), "literin[i] == literout[i]");
        }

        //set
        var setout = new IntSet();
        for (j in -2 ... 3)
        {
            setout.add(j);
        }
        trace("testSet({");
        first = true;
        for( j in setout)
        {
            if (first)
            {
                first = false;
            }
            else
            {
                trace(", ");
            }
            trace(j);
        }
        trace("})");

        var setin = client.testSet(setout);

        trace(" = {");
        first = true;
        for( j in setin)
        {
            if (first)
            {
                first = false;
            }
            else
            {
                trace(", ");
            }
            trace(j);
            rslt.Expect(setout.contains(j), 'setout.contains($j)');
        }
        trace("}");
        rslt.Expect(setin.size == setout.size, "setin.length == setout.length");


        rslt.StartTestGroup( TestResults.EXITCODE_FAILBIT_BASETYPES);

        trace("testEnum(ONE)");
        var ret = client.testEnum(Numberz.ONE);
        trace(" = " + ret);
        rslt.Expect(ret == Numberz.ONE, '$ret == Numberz.ONE');

        trace("testEnum(TWO)");
        ret = client.testEnum(Numberz.TWO);
        trace(" = " + ret);
        rslt.Expect(ret == Numberz.TWO, '$ret == Numberz.TWO');

        trace("testEnum(THREE)");
        ret = client.testEnum(Numberz.THREE);
        trace(" = " + ret);
        rslt.Expect(ret == Numberz.THREE, '$ret == Numberz.THREE');

        trace("testEnum(FIVE)");
        ret = client.testEnum(Numberz.FIVE);
        trace(" = " + ret);
        rslt.Expect(ret == Numberz.FIVE, '$ret == Numberz.FIVE');

        trace("testEnum(EIGHT)");
        ret = client.testEnum(Numberz.EIGHT);
        trace(" = " + ret);
        rslt.Expect(ret == Numberz.EIGHT, '$ret == Numberz.EIGHT');

        trace("testTypedef(309858235082523)");
        var uid = client.testTypedef( Int64.make( 0x119D0, 0x7E08671B));  // 309858235082523
        trace(" = " + uid);
        rslt.Expect( Int64.compare( uid, Int64.make( 0x119D0, 0x7E08671B)) == 0,
                     Int64.toStr(uid)+" == "+Int64.toStr(Int64.make( 0x119D0, 0x7E08671B)));


        rslt.StartTestGroup( TestResults.EXITCODE_FAILBIT_CONTAINERS);

        trace("testMapMap(1)");
        var mm = client.testMapMap(1);
        trace(" = {");
        for( key in mm.keys())
        {
            trace(key + " => {");
            var m2 = mm.get(key);
            for( k2 in m2.keys())
            {
                trace(k2 + " => " + m2.get(k2) + ", ");
            }
            trace("}, ");
        }
        trace("}");

        var pos = mm.get(4);
        var neg = mm.get(-4);
        rslt.Expect( (pos != null) && (neg != null), "(pos != null) && (neg != null)");
        for (i in 1 ... 5) {
            rslt.Expect( pos.get(i) == i, 'pos.get($i) == $i');
            rslt.Expect( neg.get(-i) == -i, 'neg.get(-$i) == -$i');
        }
        rslt.Expect( ! pos.exists(0), '!pos.exists(0)');
        rslt.Expect( ! neg.exists(-0), '!neg.exists(-0)');
        rslt.Expect( ! pos.exists(42), '!pos.exists(42)');
        rslt.Expect( ! neg.exists(-42), '!neg.exists(-42)');


        rslt.StartTestGroup( TestResults.EXITCODE_FAILBIT_STRUCTS);

        var insane = new Insanity();
        insane.userMap = new IntMap< Int64>();
        insane.userMap.set( Numberz.FIVE, Int64.make(0,5000));
        var truck = new Xtruct();
        truck.string_thing = "Truck";
        truck.byte_thing = 8;
        truck.i32_thing = 8;
        truck.i64_thing = Int64.make(0,8);
        insane.xtructs = new List<Xtruct>();
        insane.xtructs.add(truck);
        trace("testInsanity()");
        var whoa = client.testInsanity(insane);
        trace(" = {");
        for( key in whoa.keys())
        {
            var val = whoa.get(key);
            trace(key + " => {");

            for( k2 in val.keys())
            {
                var v2 = val.get(k2);

                trace(k2 + " => {");
                var userMap = v2.userMap;

                trace("{");
                if (userMap != null)
                {
                    for( k3 in userMap.keys())
                    {
                        trace(k3 + " => " + userMap.get(k3) + ", ");
                    }
                }
                else
                {
                    trace("null");
                }
                trace("}, ");

                var xtructs = v2.xtructs;

                trace("{");
                if (xtructs != null)
                {
                    for( x in xtructs)
                    {
                        trace("{\"" + x.string_thing + "\", "
                              + x.byte_thing + ", " + x.i32_thing + ", "
                              + x.i32_thing + "}, ");
                    }
                }
                else
                {
                    trace("null");
                }
                trace("}");

                trace("}, ");
            }
            trace("}, ");
        }
        trace("}");


        var first_map = whoa.get(Int64.make(0,1));
        var second_map = whoa.get(Int64.make(0,2));
        rslt.Expect( (first_map != null) && (second_map != null), "(first_map != null) && (second_map != null)");
        if ((first_map != null) && (second_map != null))
        {
            var crazy2 = first_map.get(Numberz.TWO);
            var crazy3 = first_map.get(Numberz.THREE);
            var looney = second_map.get(Numberz.SIX);
            rslt.Expect( (crazy2 != null) && (crazy3 != null) && (looney != null),
                        "(crazy2 != null) && (crazy3 != null) && (looney != null)");

            rslt.Expect( Int64.compare( crazy2.userMap.get(Numberz.EIGHT), Int64.make(0,8)) == 0,
                        "crazy2.UserMap.get(Numberz.EIGHT) == 8");
            rslt.Expect( Int64.compare( crazy3.userMap.get(Numberz.EIGHT), Int64.make(0,8)) == 0,
                        "crazy3.UserMap.get(Numberz.EIGHT) == 8");
            rslt.Expect( Int64.compare( crazy2.userMap.get(Numberz.FIVE), Int64.make(0,5)) == 0,
                        "crazy2.UserMap.get(Numberz.FIVE) == 5");
            rslt.Expect( Int64.compare( crazy3.userMap.get(Numberz.FIVE), Int64.make(0,5)) == 0,
                        "crazy3.UserMap.get(Numberz.FIVE) == 5");

            var crz2iter = crazy2.xtructs.iterator();
            var crz3iter = crazy3.xtructs.iterator();
            rslt.Expect( crz2iter.hasNext() && crz3iter.hasNext(), "crz2iter.hasNext() && crz3iter.hasNext()");
            var goodbye2 = crz2iter.next();
            var goodbye3 = crz3iter.next();
            rslt.Expect( crz2iter.hasNext() && crz3iter.hasNext(), "crz2iter.hasNext() && crz3iter.hasNext()");
            var hello2 = crz2iter.next();
            var hello3 = crz3iter.next();
            rslt.Expect( ! (crz2iter.hasNext() || crz3iter.hasNext()), "! (crz2iter.hasNext() || crz3iter.hasNext())");

            rslt.Expect( hello2.string_thing == "Hello2", 'hello2.String_thing == "Hello2"');
            rslt.Expect( hello2.byte_thing == 2, 'hello2.Byte_thing == 2');
            rslt.Expect( hello2.i32_thing == 2, 'hello2.I32_thing == 2');
            rslt.Expect( Int64.compare( hello2.i64_thing, Int64.make(0,2)) == 0, 'hello2.I64_thing == 2');
            rslt.Expect( hello3.string_thing == "Hello2", 'hello3.String_thing == "Hello2"');
            rslt.Expect( hello3.byte_thing == 2, 'hello3.Byte_thing == 2');
            rslt.Expect( hello3.i32_thing == 2, 'hello3.I32_thing == 2');
            rslt.Expect( Int64.compare( hello3.i64_thing, Int64.make(0,2)) == 0, 'hello3.I64_thing == 2');

            rslt.Expect( goodbye2.string_thing == "Goodbye4", 'goodbye2.String_thing == "Goodbye4"');
            rslt.Expect( goodbye2.byte_thing == 4, 'goodbye2.Byte_thing == 4');
            rslt.Expect( goodbye2.i32_thing == 4, 'goodbye2.I32_thing == 4');
            rslt.Expect( Int64.compare( goodbye2.i64_thing, Int64.make(0,4)) == 0, 'goodbye2.I64_thing == 4');
            rslt.Expect( goodbye3.string_thing == "Goodbye4", 'goodbye3.String_thing == "Goodbye4"');
            rslt.Expect( goodbye3.byte_thing == 4, 'goodbye3.Byte_thing == 4');
            rslt.Expect( goodbye3.i32_thing == 4, 'goodbye3.I32_thing == 4');
            rslt.Expect( Int64.compare( goodbye3.i64_thing, Int64.make(0,4)) == 0, 'goodbye3.I64_thing == 4');
        }

        var arg0 = 1;
        var arg1 = 2;
        var arg2 = Int64.make( 0x7FFFFFFF,0xFFFFFFFF);
        var multiDict = new IntMap< String>();
        multiDict.set(1, "one");
        var arg4 = Numberz.FIVE;
        var arg5 = Int64.make(0,5000000);
        trace("Test Multi(" + arg0 + "," + arg1 + "," + arg2 + "," + multiDict + "," + arg4 + "," + arg5 + ")");
        var multiResponse = client.testMulti(arg0, arg1, arg2, multiDict, arg4, arg5);
        trace(" = Xtruct(byte_thing:" + multiResponse.byte_thing + ",string_thing:" + multiResponse.string_thing
                    + ",i32_thing:" + multiResponse.i32_thing
                    + ",i64_thing:" + Int64.toStr(multiResponse.i64_thing) + ")");

        rslt.Expect( multiResponse.string_thing == "Hello2", 'multiResponse.String_thing == "Hello2"');
        rslt.Expect( multiResponse.byte_thing == arg0, 'multiResponse.Byte_thing == arg0');
        rslt.Expect( multiResponse.i32_thing == arg1, 'multiResponse.I32_thing == arg1');
        rslt.Expect( Int64.compare( multiResponse.i64_thing, arg2) == 0, 'multiResponse.I64_thing == arg2');


        rslt.StartTestGroup( 0);

        trace("Test Oneway(1)");
        client.testOneway(1);

        if( ! args.skipSpeedTest) {
            trace("Test Calltime()");
            var difft = Timer.stamp();
            for ( k in 0 ... 1000) {
                client.testVoid();
            }
            difft = Math.round( 1000 * (Timer.stamp() - difft)) / 1000;
            trace('$difft ms per testVoid() call');
        }
    }
}
