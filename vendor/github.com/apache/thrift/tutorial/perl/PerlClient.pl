#!/usr/bin/env perl

#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#

use strict;
use warnings;

use lib '../../lib/perl/lib';
use lib '../gen-perl';

use Thrift;
use Thrift::BinaryProtocol;
use Thrift::Socket;
use Thrift::BufferedTransport;

use shared::SharedService;
use tutorial::Calculator;
use shared::Types;
use tutorial::Types;

use Data::Dumper;

my $socket    = new Thrift::Socket('localhost',9090);
my $transport = new Thrift::BufferedTransport($socket,1024,1024);
my $protocol  = new Thrift::BinaryProtocol($transport);
my $client    = new tutorial::CalculatorClient($protocol);


eval{
    $transport->open();

    $client->ping();
    print "ping()\n";


    my $sum = $client->add(1,1);
    print "1+1=$sum\n";

    my $work = new tutorial::Work();

    $work->op(tutorial::Operation::DIVIDE);
    $work->num1(1);
    $work->num2(0);

    eval {
        $client->calculate(1, $work);
        print "Whoa! We can divide by zero?\n";
    }; if($@) {
        warn "InvalidOperation: ".Dumper($@);
    }

    $work->op(tutorial::Operation::SUBTRACT);
    $work->num1(15);
    $work->num2(10);
    my $diff = $client->calculate(1, $work);
    print "15-10=$diff\n";

    my $log = $client->getStruct(1);
    print "Log: $log->{value}\n";

    $transport->close();

}; if($@){
    warn(Dumper($@));
}
