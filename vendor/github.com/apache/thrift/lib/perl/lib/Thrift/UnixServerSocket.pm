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
use Thrift::UnixSocket;

use IO::Socket::UNIX;
use IO::Select;

package Thrift::UnixServerSocket;

use base qw( Thrift::ServerSocket );

#
# Constructor.
# If a single argument is given that is not a hash, that is the unix domain socket path.
# If a single argument is given that is a hash:
# @param[in]  path   unix domain socket file name
# @param[in]  queue  the listen queue size (default is not specified is supplied by ServerSocket)
# @example    my $serversock = new Thrift::UnixServerSocket($path);
# @example    my $serversock = new Thrift::UnixServerSocket(path => "somepath", queue => 64);
#
sub new
{
    my $classname = shift;
    my $args      = shift;
    my $self;

    if (ref($args) eq 'HASH') {
        $self = $classname->SUPER::new($args);
    } else {
        $self = $classname->SUPER::new();
        $self->{path} = $args;
    }

    return bless($self, $classname);
}

sub __client
{
	return new Thrift::UnixSocket();
}

sub __listen
{
    my $self = shift;

    my $sock = IO::Socket::UNIX->new(
        Type      => IO::Socket::SOCK_STREAM,
        Local     => $self->{path},
        Listen    => $self->{queue})
    || do {
        my $error = 'UnixServerSocket: Could not bind to ' .
                    $self->{path} . ' (' . $! . ')';
        if ($self->{debug}) {
            $self->{debugHandler}->($error);
        }
        die new Thrift::TException($error);
    };

    return $sock;
}

1;
