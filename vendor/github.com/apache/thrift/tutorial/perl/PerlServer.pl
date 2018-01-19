#!/usr/bin/perl

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
use lib '../gen-perl';
use Thrift::Socket;
use Thrift::Server;
use tutorial::Calculator;

package CalculatorHandler;
use base qw(tutorial::CalculatorIf);

sub new {
    my $classname = shift;
    my $self      = {};

    return bless($self,$classname);
}


sub ping
{
  print "ping()\n";
}

sub add
{
  my($self, $n1, $n2) = @_;
  printf("add(%d,%d)\n", $n1, $n2);
  return $n1 + $n2;
}

sub calculate
{
  my($self, $logid, $work) = @_;
  my $op   = $work->{op};
  my $num1 = $work->{num1};
  my $num2 = $work->{num2};
  printf("calculate(%d, %d %d %d)\n", $logid, $num1, $num2, $op);

  my $val;

  if ($op == tutorial::Operation::ADD) {
    $val = $num1 + $num2;
  } elsif ($op == tutorial::Operation::SUBTRACT) {
    $val = $num1 - $num2;
  } elsif ($op == tutorial::Operation::MULTIPLY) {
    $val = $num1 * $num2;
  } elsif ($op == tutorial::Operation::DIVIDE) {
    if ($num2 == 0)
    {
      my $x = new tutorial::InvalidOperation;
      $x->whatOp($op);
      $x->why('Cannot divide by 0');
      die $x;
    }
    $val = $num1 / $num2;
  } else {
    my $x = new tutorial::InvalidOperation;
    $x->whatOp($op);
    $x->why('Invalid operation');
    die $x;
  }

  my $log = new shared::SharedStruct;
  $log->key($logid);
  $log->value(int($val));
  $self->{log}->{$logid} = $log;

  return $val;
}

sub getStruct
{
  my($self, $key) = @_;
  printf("getStruct(%d)\n", $key);
  return $self->{log}->{$key};
}

sub zip
{
  my($self) = @_;
  print "zip()\n";
}



eval {
  my $handler       = new CalculatorHandler;
  my $processor     = new tutorial::CalculatorProcessor($handler);
  my $serversocket  = new Thrift::ServerSocket(9090);
  my $forkingserver = new Thrift::ForkingServer($processor, $serversocket);
  print "Starting the server...\n";
  $forkingserver->serve();
  print "done.\n";
}; if ($@) {
  if ($@ =~ m/TException/ and exists $@->{message}) {
    my $message = $@->{message};
    my $code    = $@->{code};
    my $out     = $code . ':' . $message;
    die $out;
  } else {
    die $@;
  }
}

