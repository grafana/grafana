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

require 5.6.0;
use strict;
use warnings;
use Data::Dumper;
use Getopt::Long qw(GetOptions);
use Time::HiRes qw(gettimeofday);

use lib '../../lib/perl/lib';
use lib 'gen-perl';

use Thrift;
use Thrift::BinaryProtocol;
use Thrift::BufferedTransport;
use Thrift::FramedTransport;
use Thrift::SSLServerSocket;
use Thrift::ServerSocket;
use Thrift::Server;
use Thrift::UnixServerSocket;

use ThriftTest::ThriftTest;
use ThriftTest::Types;

$|++;

sub usage {
    print <<EOF;
Usage: $0 [OPTIONS]

Options:                          (default)
  --ca                                         Certificate authority file (optional).
  --cert                                       Certificate file.
                                               Required if using --ssl.                                               
  --domain-socket <file>                       Use a unix domain socket.
  --help                                       Show usage.
  --key                                        Private key file for certificate.
                                               Required if using --ssl and private key is
                                               not in the certificate file.
  --port <portnum>                9090         Port to use.
  --protocol {binary}             binary       Protocol to use.
  --ssl                                        If present, use SSL/TLS.
  --transport {buffered|framed}   buffered     Transport to use.
                                   
EOF
}

my %opts = (
    'port' => 9090,
    'protocol' => 'binary',
    'transport' => 'buffered'
);

GetOptions(\%opts, qw (
    ca=s
    cert=s
    domain-socket=s
    help
    host=s
    key=s
    port=i
    protocol=s
    ssl
    transport=s
)) || exit 1;

if ($opts{help}) {
    usage();
    exit 0;
}

if ($opts{ssl} and not defined $opts{cert}) {
    usage();
    exit 1;
}

my $handler = new ThriftTestHandler();
my $processor = new ThriftTest::ThriftTestProcessor($handler);
my $serversocket;
if ($opts{"domain-socket"}) {
    unlink($opts{"domain-socket"});
    $serversocket = new Thrift::UnixServerSocket($opts{"domain-socket"});
} elsif ($opts{ssl}) {
    $serversocket = new Thrift::SSLServerSocket(\%opts);
} else {
    $serversocket = new Thrift::ServerSocket(\%opts);
}
my $transport;
if ($opts{transport} eq 'buffered') {
    $transport = new Thrift::BufferedTransportFactory();
} elsif ($opts{transport} eq 'framed') {
    $transport = new Thrift::FramedTransportFactory();
} else {
    usage();
    exit 1;
}
my $protocol;
if ($opts{protocol} eq 'binary') {
    $protocol = new Thrift::BinaryProtocolFactory();
} else {
    usage();
    exit 1;
}

my $ssltag = '';
if ($opts{ssl}) {
    $ssltag = "(SSL)";
}
my $listening_on = "$opts{port} $ssltag";
if ($opts{"domain-socket"}) {
    $listening_on = $opts{"domain-socket"};
}
my $server = new Thrift::SimpleServer($processor, $serversocket, $transport, $protocol);
print "Starting \"simple\" server ($opts{transport}/$opts{protocol}) listen on: $listening_on\n";
$server->serve();

###    
### Test server implementation
###

package ThriftTestHandler;

use base qw( ThriftTest::ThriftTestIf );

sub new {
    my $classname = shift;
    my $self = {};
    return bless($self, $classname);
}

sub testVoid() {
  print("testVoid()\n"); 
}

sub testString() {
  my $self = shift;
  my $thing = shift;
  print("testString($thing)\n");
  return $thing;
}

sub testBool() {
  my $self = shift;
  my $thing = shift;
  my $str = $thing ? "true" : "false";
  print("testBool($str)\n");
  return $thing;
}

sub testByte() {
  my $self = shift;
  my $thing = shift;
  print("testByte($thing)\n");
  return $thing;
}

sub testI32() {
  my $self = shift;
  my $thing = shift;
  print("testI32($thing)\n");
  return $thing;
}

sub testI64() {
  my $self = shift;
  my $thing = shift;
  print("testI64($thing)\n");
  return $thing;
}

sub testDouble() {
  my $self = shift;
  my $thing = shift;
  print("testDouble($thing)\n");
  return $thing;
}

sub testBinary() {
    my $self = shift;
    my $thing = shift;
    my @bytes = split //, $thing;
    print("testBinary(");
    foreach (@bytes)
    {
        printf "%02lx", ord $_;
    }
    print(")\n");
    return $thing;
}

sub testStruct() {
  my $self = shift;
  my $thing = shift;
  printf("testStruct({\"%s\", %d, %d, %lld})\n",
           $thing->{string_thing},
           $thing->{byte_thing},
           $thing->{i32_thing},
           $thing->{i64_thing});
  return $thing;
}

sub testNest() {
  my $self = shift;
  my $nest = shift;
  my $thing = $nest->{struct_thing};
  printf("testNest({%d, {\"%s\", %d, %d, %lld}, %d})\n",
           $nest->{byte_thing},
           $thing->{string_thing},
           $thing->{byte_thing},
           $thing->{i32_thing},
           $thing->{i64_thing},
           $nest->{i32_thing});
  return $nest;
}

sub testMap() {
  my $self = shift;
  my $thing = shift;
  print("testMap({");
  my $first = 1;
  foreach my $key (keys %$thing) {
    if ($first) {
        $first = 0;
    } else {
        print(", ");
    }
    print("$key => $thing->{$key}");
  }
  print("})\n");
  return $thing;
}

sub testStringMap() {
  my $self = shift;
  my $thing = shift;
  print("testStringMap({");
  my $first = 1;
  foreach my $key (keys %$thing) {
    if ($first) {
        $first = 0;
    } else {
        print(", ");
    }
    print("$key => $thing->{$key}");
  }
  print("})\n");
  return $thing;
}

sub testSet() {
  my $self = shift;
  my $thing = shift;
  my @arr;
  my $result = \@arr;
  print("testSet({");
  my $first = 1;
  foreach my $key (keys %$thing) {
    if ($first) {
        $first = 0;
    } else {
        print(", ");
    }
    print("$key");
    push($result, $key);
  }
  print("})\n");
  return $result;
}

sub testList() {
  my $self = shift;
  my $thing = shift;
  print("testList({");
  my $first = 1;
  foreach my $key (@$thing) {
    if ($first) {
        $first = 0;
    } else {
        print(", ");
    }
    print("$key");
  }
  print("})\n");
  return $thing;
}

sub testEnum() {
  my $self = shift;
  my $thing = shift;
  print("testEnum($thing)\n");
  return $thing;
}

sub testTypedef() {
  my $self = shift;
  my $thing = shift;
  print("testTypedef($thing)\n");
  return $thing;
}

sub testMapMap() {
  my $self = shift;
  my $hello = shift;
  
  printf("testMapMap(%d)\n", $hello);
  my $result = { 4 => { 1 => 1, 2 => 2, 3 => 3, 4 => 4 }, -4 => { -1 => -1, -2 => -2, -3 => -3, -4 => -4 } };
  return $result;
}

sub testInsanity() {
  my $self = shift;
  my $argument = shift;
  print("testInsanity()\n");

  my $hello = new ThriftTest::Xtruct({string_thing => "Hello2", byte_thing => 2, i32_thing => 2, i64_thing => 2});
  my @hellos;
  push(@hellos, $hello);
  my $goodbye = new ThriftTest::Xtruct({string_thing => "Goodbye4", byte_thing => 4, i32_thing => 4, i64_thing => 4});
  my @goodbyes;
  push(@goodbyes, $goodbye);
  my $crazy = new ThriftTest::Insanity({userMap => { ThriftTest::Numberz::EIGHT => 8 }, xtructs => \@goodbyes});
  my $loony = new ThriftTest::Insanity();
  my $result = { 1 => { ThriftTest::Numberz::TWO => $argument, ThriftTest::Numberz::THREE => $argument },
                 2 => { ThriftTest::Numberz::SIX => $loony } };
  return $result;
}

sub testMulti() {
  my $self = shift;
  my $arg0 = shift;
  my $arg1 = shift;
  my $arg2 = shift;
  my $arg3 = shift;
  my $arg4 = shift;
  my $arg5 = shift;
  
  print("testMulti()\n");
  return new ThriftTest::Xtruct({string_thing => "Hello2", byte_thing => $arg0, i32_thing => $arg1, i64_thing => $arg2});
}

sub testException() {
  my $self = shift;
  my $arg = shift;
  print("testException($arg)\n");
  if ($arg eq "Xception") {
    die new ThriftTest::Xception({errorCode => 1001, message => $arg});
  } elsif ($arg eq "TException") {
    die "astring"; # all unhandled exceptions become TExceptions
  } else {
    return new ThriftTest::Xtruct({string_thing => $arg});
  }
}

sub testMultiException() {
  my $self = shift;
  my $arg0 = shift;
  my $arg1 = shift;

  printf("testMultiException(%s, %s)\n", $arg0, $arg1);
  if ($arg0 eq "Xception") {
    die new ThriftTest::Xception({errorCode => 1001, message => "This is an Xception"});
  } elsif ($arg0 eq "Xception2") {
    my $struct_thing = new ThriftTest::Xtruct({string_thing => "This is an Xception2"});
    die new ThriftTest::Xception2({errorCode => 2002, struct_thing => $struct_thing});
  } else {
    return new ThriftTest::Xtruct({string_thing => $arg1});
  }
}

sub testOneway() {
  my $self = shift;
  my $sleepFor = shift;
  print("testOneway($sleepFor): Sleeping...\n");
  sleep $sleepFor;
  print("testOneway($sleepFor): done sleeping!\n");
}


1;
