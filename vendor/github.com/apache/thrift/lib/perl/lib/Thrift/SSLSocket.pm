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

use IO::Socket::SSL;
use IO::Select;

package Thrift::SSLSocket;

# TODO: Does not provide cipher selection or authentication hooks yet.

use base qw( Thrift::Socket );

sub new
{
    my $classname = shift;
    my $self      = $classname->SUPER::new(@_);

    return bless($self, $classname);
}

sub __open
{
    my $self = shift;
    return IO::Socket::SSL->new(PeerAddr => $self->{host},
                                PeerPort => $self->{port},
                                Proto    => 'tcp',
                                Timeout  => $self->{sendTimeout} / 1000);
}

sub __close
{
    my $self = shift;
    my $sock = ($self->{handle}->handles())[0];
    if ($sock) {
      $sock->close(SSL_no_shutdown => 1);
    }
}

sub __recv
{
	my $self = shift;
	my $sock = shift;
	my $len = shift;
	my $buf = undef;
  if ($sock) {
    sysread($sock, $buf, $len);
  }
  return $buf;
}

sub __send
{
    my $self = shift;
    my $sock = shift;
    my $buf = shift;
    return syswrite($sock, $buf);
}

sub __wait
{
    my $self = shift;
    my $sock = ($self->{handle}->handles())[0];
    if ($sock and $sock->pending() eq 0) {
        return $self->SUPER::__wait();
    }
    return $sock;
}


1;
