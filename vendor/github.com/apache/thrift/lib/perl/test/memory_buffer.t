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

use Test::More tests => 6;

use strict;
use warnings;

use Data::Dumper;

use Thrift::BinaryProtocol;
use Thrift::MemoryBuffer;

use ThriftTest::Types;


my $transport = Thrift::MemoryBuffer->new();
my $protocol = Thrift::BinaryProtocol->new($transport);

my $a = ThriftTest::Xtruct->new();
$a->i32_thing(10);
$a->i64_thing(30);
$a->string_thing('Hello, world!');
$a->write($protocol);

my $b = ThriftTest::Xtruct->new();
$b->read($protocol);
is($b->i32_thing, $a->i32_thing);
is($b->i64_thing, $a->i64_thing);
is($b->string_thing, $a->string_thing);

$b->write($protocol);
my $c = ThriftTest::Xtruct->new();
$c->read($protocol);
is($c->i32_thing, $a->i32_thing);
is($c->i64_thing, $a->i64_thing);
is($c->string_thing, $a->string_thing);
