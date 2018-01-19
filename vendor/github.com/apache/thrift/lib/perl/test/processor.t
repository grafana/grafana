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

use Test::More tests => 2;

use strict;
use warnings;

use Thrift;
use Thrift::BinaryProtocol;
use Thrift::MemoryBuffer;

use ThriftTest::ThriftTest;
use ThriftTest::Types;

use Data::Dumper;

my $buffer    = Thrift::MemoryBuffer->new(1024);
my $protocol  = Thrift::BinaryProtocol->new($buffer);
my $client    = ThriftTest::ThriftTestClient->new($protocol);

$buffer->open();
$client->send_testString("foo");
$client->{seqid}++;
$client->send_testString("bar");

my $client_command_binary = $buffer->getBuffer;
$buffer->resetBuffer;

# Process by server

my $server_output_binary;
{
    my $protocol_factory = Thrift::BinaryProtocolFactory->new();

    my $input_buffer    = Thrift::MemoryBuffer->new();
    $input_buffer->write($client_command_binary);
    my $input_protocol  = $protocol_factory->getProtocol($input_buffer);

    my $output_buffer   = Thrift::MemoryBuffer->new();
    my $output_protocol = $protocol_factory->getProtocol($output_buffer);

    my $processor = ThriftTest::ThriftTestProcessor->new( My::ThriftTest->new() );
    my $result = $processor->process($input_protocol, $output_protocol);
    print "process resulted in $result\n";
    $result = $processor->process($input_protocol, $output_protocol);
    print "process resulted in $result\n";
    $server_output_binary = $output_buffer->getBuffer();
}

$buffer->write($server_output_binary);

foreach my $val (("got foo","got bar")){
    my ($function_name, $message_type, $sequence_id);

    $protocol->readMessageBegin(\$function_name, \$message_type, \$sequence_id);
    print "  $function_name, $message_type, $sequence_id\n";

    if ($message_type == TMessageType::EXCEPTION) {
        die;
    }

    my $result = ThriftTest::ThriftTest_testString_result->new();
    $result->read($protocol);
    $protocol->readMessageEnd();

    is($result->success(),$val);
}


package My::ThriftTest;

use strict;
use warnings;
use Data::Dumper;

sub new {
    my $class = shift;
    return bless {}, $class;
}

sub testString {
    my ($self, $string) = @_;

    print __PACKAGE__ . "->testString()\n";

    return "got ".$string;
}
