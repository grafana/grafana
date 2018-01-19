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

#
# Transport exceptions
#
package TTransportException;
use base('Thrift::TException');

use constant UNKNOWN      => 0;
use constant NOT_OPEN     => 1;
use constant ALREADY_OPEN => 2;
use constant TIMED_OUT    => 3;
use constant END_OF_FILE  => 4;

sub new{
    my $classname = shift;
    my $self      = $classname->SUPER::new(@_);

    return bless($self,$classname);
}

package Thrift::Transport;

#
# Whether this transport is open.
#
# @return boolean true if open
#
sub isOpen
{
    die "abstract";
}

#
# Open the transport for reading/writing
#
# @throws TTransportException if cannot open
#
sub open
{
    die "abstract";
}

#
# Close the transport.
#
sub close
{
    die "abstract";
}

#
# Read some data into the array.
#
# @param int    $len How much to read
# @return string The data that has been read
# @throws TTransportException if cannot read any more data
#
sub read
{
    my ($len);
    die("abstract");
}

#
# Guarantees that the full amount of data is read.
#
# @return string The data, of exact length
# @throws TTransportException if cannot read data
#
sub readAll
{
    my $self = shift;
    my $len  = shift;

    my $data = '';
    my $got = 0;

    while (($got = length($data)) < $len) {
        $data .= $self->read($len - $got);
    }

    return $data;
}

#
# Writes the given data out.
#
# @param string $buf  The data to write
# @throws TTransportException if writing fails
#
sub write
{
    my ($buf);
    die "abstract";
}

#
# Flushes any pending data out of a buffer
#
# @throws TTransportException if a writing error occurs
#
sub flush {}


#
# TransportFactory creates transport objects from transports
#
package Thrift::TransportFactory;

sub new {
    my $classname = shift;
    my $self      = {};

    return bless($self,$classname);
}

#
# Build a transport from the base transport
#
# @return Thrift::Transport transport
#
sub getTransport
{
    my $self  = shift;
    my $trans = shift;

    return $trans;
}


#
#  ServerTransport base class module
#
package Thrift::ServerTransport;

sub listen
{
    die "abstract";
}

sub accept
{
    die "abstract";
}

sub close
{
    die "abstract";
}


1;

