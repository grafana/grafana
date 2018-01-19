/// Licensed to the Apache Software Foundation (ASF) under one
/// or more contributor license agreements. See the NOTICE file
/// distributed with this work for additional information
/// regarding copyright ownership. The ASF licenses this file
/// to you under the Apache License, Version 2.0 (the
/// "License"); you may not use this file except in compliance
/// with the License. You may obtain a copy of the License at
///
/// http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
/// KIND, either express or implied. See the License for the
/// specific language governing permissions and limitations
/// under the License.

library thrift;

import 'dart:async';
import 'dart:collection';
import 'dart:convert' show Utf8Codec, BASE64;
import 'dart:typed_data' show ByteData;
import 'dart:typed_data' show Endianness;
import 'dart:typed_data' show Uint8List;

import 'package:fixnum/fixnum.dart';
import 'package:http/http.dart' show Client;
import 'package:logging/logging.dart';

part 'src/t_application_error.dart';
part 'src/t_base.dart';
part 'src/t_error.dart';
part 'src/t_processor.dart';

part 'src/protocol/t_binary_protocol.dart';
part 'src/protocol/t_compact_protocol.dart';
part 'src/protocol/t_field.dart';
part 'src/protocol/t_json_protocol.dart';
part 'src/protocol/t_list.dart';
part 'src/protocol/t_map.dart';
part 'src/protocol/t_message.dart';
part 'src/protocol/t_multiplexed_protocol.dart';
part 'src/protocol/t_protocol.dart';
part 'src/protocol/t_protocol_decorator.dart';
part 'src/protocol/t_protocol_error.dart';
part 'src/protocol/t_protocol_factory.dart';
part 'src/protocol/t_protocol_util.dart';
part 'src/protocol/t_set.dart';
part 'src/protocol/t_struct.dart';
part 'src/protocol/t_type.dart';

part 'src/serializer/t_deserializer.dart';
part 'src/serializer/t_serializer.dart';

part 'src/transport/t_buffered_transport.dart';
part 'src/transport/t_framed_transport.dart';
part 'src/transport/t_http_transport.dart';
part 'src/transport/t_message_reader.dart';
part 'src/transport/t_socket.dart';
part 'src/transport/t_transport.dart';
part 'src/transport/t_transport_error.dart';
part 'src/transport/t_transport_factory.dart';
part 'src/transport/t_socket_transport.dart';
