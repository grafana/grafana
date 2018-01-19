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
use Thrift::SSLSocket;

use IO::Socket::SSL;
use IO::Select;

package Thrift::SSLServerSocket;

use base qw( Thrift::ServerSocket );

#
# Constructor.
# Takes a hash:
# See Thirft::Socket for base class parameters.
# @param[in]  ca     certificate authority filename - not required
# @param[in]  cert   certificate filename; may contain key in which case key is not required
# @param[in]  key    private key filename for the certificate if it is not inside the cert file
#
sub new
{
    my $classname = shift;
    my $self      = $classname->SUPER::new(@_);
    return bless($self, $classname);
}

sub __client
{
	return new Thrift::SSLSocket();
}

sub __listen
{
    my $self = shift;
    return IO::Socket::SSL->new(LocalAddr     => $self->{host},
                                LocalPort     => $self->{port},
                                Proto         => 'tcp',
                                Listen        => $self->{queue},
                                ReuseAddr     => 1,
                                SSL_cert_file => $self->{cert},
                                SSL_key_file  => $self->{key},
                                SSL_ca_file   => $self->{ca});
}


1;
