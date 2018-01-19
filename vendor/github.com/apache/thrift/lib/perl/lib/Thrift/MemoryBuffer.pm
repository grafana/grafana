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

use Thrift;
use Thrift::Transport;

package Thrift::MemoryBuffer;
use base('Thrift::Transport');

sub new
{
    my $classname = shift;

    my $bufferSize= shift || 1024;

    my $self = {
        buffer    => '',
        bufferSize=> $bufferSize,
        wPos      => 0,
        rPos      => 0,
    };

    return bless($self,$classname);
}

sub isOpen
{
    return 1;
}

sub open
{

}

sub close
{

}

sub peek
{
    my $self = shift;
    return($self->{rPos} < $self->{wPos});
}


sub getBuffer
{
    my $self = shift;
    return $self->{buffer};
}

sub resetBuffer
{
    my $self = shift;

    my $new_buffer  = shift || '';

    $self->{buffer}     = $new_buffer;
    $self->{bufferSize} = length($new_buffer);
    $self->{wPos}       = length($new_buffer);
    $self->{rPos}       = 0;
}

sub available
{
    my $self = shift;
    return ($self->{wPos} - $self->{rPos});
}

sub read
{
    my $self = shift;
    my $len  = shift;
    my $ret;

    my $avail = ($self->{wPos} - $self->{rPos});
    return '' if $avail == 0;

    #how much to give
    my $give = $len;
    $give = $avail if $avail < $len;

    $ret = substr($self->{buffer},$self->{rPos},$give);

    $self->{rPos} += $give;

    return $ret;
}

sub readAll
{
    my $self = shift;
    my $len  = shift;

    my $avail = ($self->{wPos} - $self->{rPos});
    if ($avail < $len) {
        die new TTransportException("Attempt to readAll($len) found only $avail available");
    }

    my $data = '';
    my $got = 0;

    while (($got = length($data)) < $len) {
        $data .= $self->read($len - $got);
    }

    return $data;
}

sub write
{
    my $self = shift;
    my $buf  = shift;

    $self->{buffer} .= $buf;
    $self->{wPos}   += length($buf);
}

sub flush
{

}

1;
