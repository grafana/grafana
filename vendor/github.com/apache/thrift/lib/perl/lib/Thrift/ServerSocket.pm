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

use IO::Socket::INET;
use IO::Select;
use Thrift;
use Thrift::Socket;

package Thrift::ServerSocket;

use base qw( Thrift::ServerTransport );

#
# Constructor.
# Legacy construction takes one argument, port number.
# New construction takes a hash:
# @param[in]  host   host interface to listen on (undef = all interfaces)
# @param[in]  port   port number to listen on (required)
# @param[in]  queue  the listen queue size (default if not specified is 128)
# @example    my $serversock = new Thrift::ServerSocket(host => undef, port => port)
#
sub new
{
    my $classname = shift;
    my $args      = shift;
    my $self;
    
    # Support both old-style "port number" construction and newer...
    if (ref($args) eq 'HASH') {
        $self = $args;
    } else {
        $self = { port => $args };
    }

    if (not defined $self->{queue}) {
        $self->{queue} = 128;
    }
    
    return bless($self, $classname);
}

sub listen
{
    my $self = shift;

    my $sock = $self->__listen() || do {
        my $error = ref($self) . ': Could not bind to ' . '*:' . $self->{port} . ' (' . $! . ')';

        if ($self->{debug}) {
            $self->{debugHandler}->($error);
        }

        die new Thrift::TException($error);
    };

    $self->{handle} = $sock;
}

sub accept
{
    my $self = shift;

    if ( exists $self->{handle} and defined $self->{handle} )
    {
        my $client        = $self->{handle}->accept();
        my $result        = $self->__client();
        $result->{handle} = new IO::Select($client);
        return $result;
    }

    return 0;
}

###
### Overridable methods
###

sub __client
{
	return new Thrift::Socket();
}

sub __listen
{
    my $self = shift;
    return IO::Socket::INET->new(LocalAddr => $self->{host},
                                 LocalPort => $self->{port},
                                 Proto     => 'tcp',
                                 Listen    => $self->{queue},
                                 ReuseAddr => 1);
}


1;
