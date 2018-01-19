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

import haxe.Int64;
import haxe.Int32;

import org.apache.thrift.*;
import org.apache.thrift.protocol.*;
import org.apache.thrift.transport.*;
import org.apache.thrift.server.*;
import org.apache.thrift.meta_data.*;

// debug only
import org.apache.thrift.protocol.TProtocolDecorator;
import org.apache.thrift.protocol.TMultiplexedProtocol;
import org.apache.thrift.protocol.TMultiplexedProcessor;

// generated code imports
import Aggr;
import AggrImpl;
import AggrProcessor;
import BenchmarkService;
import BenchmarkServiceImpl;
import BenchmarkServiceProcessor;
import Error;


class BenchmarkServiceHandler implements BenchmarkService
{
    public function new() {
    }

    public function fibonacci(n : haxe.Int32) : haxe.Int32 {
        trace('Benchmark.fibonacci($n)');
        var next : Int;
        var prev   = 0;
        var result = 1;
        while( n > 0)
        {
            next   = result + prev;
            prev   = result;
            result = next;
            --n;
        }
        return result;
    }
}


class AggrServiceHandler implements Aggr
{
    private var values : List<haxe.Int32> = new List<haxe.Int32>();

    public function new() {
    }

    public function addValue(value : haxe.Int32) : Void    {
        trace('Aggr.addValue($value)');
        values.add( value);
    }

    public function getValues() : List< haxe.Int32> {
        trace('Aggr.getValues()');
        return values;
    }
}



class MultiplexTest extends TestBase {

    private inline static var NAME_BENCHMARKSERVICE : String = "BenchmarkService";
    private inline static var NAME_AGGR             : String  = "Aggr";


    public static override function Run(server : Bool) : Void {
        if ( server) {
            RunMultiplexServer();
        } else {
            RunMultiplexClient();
            RunDefaultClient();
        }
    }


    // run the multiplex server
    public static override function RunMultiplexServer() : Void  {
       try
       {
            var benchHandler : BenchmarkService = new BenchmarkServiceHandler();
            var benchProcessor : TProcessor = new BenchmarkServiceProcessor( benchHandler);

            var aggrHandler : Aggr = new AggrServiceHandler();
            var aggrProcessor : TProcessor = new AggrProcessor( aggrHandler);

            var multiplex : TMultiplexedProcessor = new TMultiplexedProcessor();
            multiplex.RegisterProcessor( NAME_BENCHMARKSERVICE, benchProcessor, true);  // default
            multiplex.RegisterProcessor( NAME_AGGR, aggrProcessor);

            // protocol+transport stack
            var protfact : TProtocolFactory = new TBinaryProtocolFactory(true,true);
            var servertrans : TServerTransport = new TServerSocket( 9090, 5, false);
            var transfact : TTransportFactory = new TFramedTransportFactory();

            var server : TServer = new TSimpleServer( multiplex, servertrans, transfact, protfact);

            trace("Starting the server ...");
            server.Serve();
       }
        catch( e : TApplicationException)
        {
            TestBase.Expect(false,'${e.errorID} ${e.errorMsg}');
        }
        catch( e : TException)
        {
            TestBase.Expect(false,'$e');
        }
    }


    // run multiplex client against multiplex server
    public static override function RunMultiplexClient() : Void  {
        try
        {
            var trans : TTransport;
            trans = new TSocket("localhost", 9090);
            trans = new TFramedTransport(trans);
            trans.open();

            var protocol : TProtocol = new TBinaryProtocol(trans,true,true);
            var multiplex : TMultiplexedProtocol;

            multiplex = new TMultiplexedProtocol( protocol, NAME_BENCHMARKSERVICE);
            var bench = new BenchmarkServiceImpl( multiplex);

            multiplex = new TMultiplexedProtocol( protocol, NAME_AGGR);
            var aggr = new AggrImpl( multiplex);

            trace('calling aggr.add( bench.fibo())...');
            for( i in 1 ... 10)
            {
                trace('$i');
                aggr.addValue( bench.fibonacci(i));
            }

            trace('calling aggr ...');
            var i = 1;
            var values = aggr.getValues();
            TestBase.Expect(values != null,'aggr.getValues() == null');
            for( k in values)
            {
                trace('fib($i) = $k');
                ++i;
            }

            trans.close();
            trace('done.');

        }
        catch( e : TApplicationException)
        {
            TestBase.Expect(false,'${e.errorID} ${e.errorMsg}');
        }
        catch( e : TException)
        {
            TestBase.Expect(false,'$e');
        }
    }


    // run non-multiplex client against multiplex server to test default fallback
    public static override function RunDefaultClient() : Void  {
        try
        {
            var trans : TTransport;
            trans = new TSocket("localhost", 9090);
            trans = new TFramedTransport(trans);
            trans.open();

            var protocol : TProtocol = new TBinaryProtocol(trans,true,true);

            var bench = new BenchmarkServiceImpl( protocol);

            trace('calling bench (via default) ...');
            for( i in 1 ... 10)
            {
                var k = bench.fibonacci(i);
                trace('fib($i) = $k');
            }

            trans.close();
            trace('done.');
        }
        catch( e : TApplicationException)
        {
            TestBase.Expect(false,'${e.errorID} ${e.errorMsg}');
        }
        catch( e : TException)
        {
            TestBase.Expect(false,'$e');
        }
    }

}


