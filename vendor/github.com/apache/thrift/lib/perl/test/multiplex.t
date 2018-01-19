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

use Thrift;
use Thrift::Socket;
use Thrift::Server;
use Thrift::MultiplexedProcessor;
use Thrift::BinaryProtocol;
use Thrift::MemoryBuffer;
use Thrift::FramedTransport;
use Thrift::MemoryBuffer;


use BenchmarkService;
use Aggr;

use constant NAME_BENCHMARKSERVICE => 'BenchmarkService';
use constant NAME_AGGR  =>  'Aggr';

my $buffer    = Thrift::MemoryBuffer->new(1024);
my $aggr_protocol  = Thrift::MultiplexedProtocol->new(Thrift::BinaryProtocol->new($buffer), NAME_AGGR);
my $aggr_client    = AggrClient->new($aggr_protocol);
my $benchmark_protocol = Thrift::MultiplexedProtocol->new(Thrift::BinaryProtocol->new($buffer), NAME_BENCHMARKSERVICE);
my $benchmark_client = BenchmarkServiceClient->new($benchmark_protocol); 

$buffer->open();

for(my $i = 1; $i <= 5; $i++) {
    $aggr_client->send_addValue($i);
    $aggr_client->{seqid}++;
}

$aggr_client->send_getValues();

for(my $i = 1; $i <= 5; $i++) {
    $benchmark_client->send_fibonacci($i);
    $benchmark_client->{seqid}++;
}
$benchmark_client->{seqid}--;

my $client_command_binary = $buffer->getBuffer;
$buffer->resetBuffer;


# Process by server
my $server_output_binary;
{
    my $benchmark_handler = My::BenchmarkService->new();
    my $benchmark_processor = BenchmarkServiceProcessor->new($benchmark_handler);
    my $aggr_handler = My::Aggr->new(); 
    my $aggr_processor = AggrProcessor->new($aggr_handler);
    
    my $protocol_factory = Thrift::BinaryProtocolFactory->new();

    my $input_buffer    = Thrift::MemoryBuffer->new();
    $input_buffer->write($client_command_binary);

    my $input_protocol  = $protocol_factory->getProtocol($input_buffer);

    my $output_buffer   = Thrift::MemoryBuffer->new();
    my $output_protocol = $protocol_factory->getProtocol($output_buffer);

    my $processor = Thrift::MultiplexedProcessor->new();

    $processor->registerProcessor(NAME_BENCHMARKSERVICE, $benchmark_processor);
    $processor->registerProcessor(NAME_AGGR, $aggr_processor);
    my $result;
    for(my $i = 1; $i <= 11; $i++) {
        $result = $processor->process($input_protocol, $output_protocol);
        print "process resulted in $result\n";
    }

    $server_output_binary = $output_buffer->getBuffer();
}

$buffer->write($server_output_binary);



for(my $i = 1; $i <= 5; $i++) {
    my ($function_name, $message_type, $sequence_id);

    $aggr_protocol->readMessageBegin(\$function_name, \$message_type, \$sequence_id);

    if ($message_type == TMessageType::EXCEPTION) {
       die;
    }
    
    my $aggr_result = Aggr_addValue_result->new();
    $aggr_result->read($aggr_protocol);
    $aggr_protocol->readMessageEnd();
}

my ($function_name, $message_type, $sequence_id);

$aggr_protocol->readMessageBegin(\$function_name, \$message_type, \$sequence_id);

if ($message_type == TMessageType::EXCEPTION) {
    die;
}
    
my $aggr_result = Aggr_getValues_result->new();
$aggr_result->read($aggr_protocol);
$aggr_protocol->readMessageEnd();

is_deeply($aggr_result->success(), [1,2,3,4,5]);
 

foreach my $val((1,2,3,5,8)) {
    my ($function_name, $message_type, $sequence_id);

    $benchmark_protocol->readMessageBegin(\$function_name, \$message_type, \$sequence_id);

    if ($message_type == TMessageType::EXCEPTION) {
        die;
    }
    my $benchmark_result = BenchmarkService_fibonacci_result->new();
    $benchmark_result->read($benchmark_protocol);
    $benchmark_protocol->readMessageEnd();
    
    is($benchmark_result->success(), $val);
}


package My::Aggr;
use base qw(AggrIf); 

use strict;
use warnings; 

sub new {
    my $classname = shift;
    my $self      = {};
    
    $self->{values} = ();

    return bless($self,$classname);
}

sub addValue{
    my $self = shift;
    my $value = shift;

    push (@{$self->{values}}, $value);  
}

sub getValues{
    my $self = shift;
    
   return $self->{values};
}



package My::BenchmarkService;
use base qw(BenchmarkServiceIf);

use strict;
use warnings;

sub new {
    my $class = shift;
    return bless {}, $class;
}

sub fibonacci {
    my ($self, $n) = @_;
    
    my $prev = 0;
    my $next;
    my $result = 1;
    
    while ($n > 0) {
        $next = $result + $prev;
        $prev = $result;
        $result = $next;
        --$n;
    }
    
    return $result;
}

