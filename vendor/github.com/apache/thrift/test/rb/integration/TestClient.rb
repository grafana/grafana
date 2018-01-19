#!/usr/bin/env ruby
# encoding: utf-8

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

$:.push File.dirname(__FILE__) + '/..'

require 'test_helper'
require 'thrift'
require 'thrift_test'

$protocolType = "binary"
$host = "localhost"
$port = 9090
$transport = "buffered"
ARGV.each do|a|
  if a == "--help"
    puts "Allowed options:"
    puts "\t -h [ --help ] \t produce help message"
    puts "\t--host arg (=localhost) \t Host to connect"
    puts "\t--port arg (=9090) \t Port number to listen"
    puts "\t--protocol arg (=binary) \t protocol: binary, accel"
    puts "\t--transport arg (=buffered) transport: buffered, framed, http"
    exit
  elsif a.start_with?("--host")
    $host = a.split("=")[1]
  elsif a.start_with?("--protocol")
    $protocolType = a.split("=")[1]
  elsif a.start_with?("--transport")
    $transport = a.split("=")[1]
  elsif a.start_with?("--port")
    $port = a.split("=")[1].to_i
  end
end
ARGV=[]

class SimpleClientTest < Test::Unit::TestCase
  def setup
    unless @socket
      @socket   = Thrift::Socket.new($host, $port)
      if $transport == "buffered"
        transportFactory = Thrift::BufferedTransport.new(@socket)
      elsif $transport == "framed"
        transportFactory = Thrift::FramedTransport.new(@socket)
      else
        raise 'Unknown transport type'
      end

      if $protocolType == "binary"
        @protocol = Thrift::BinaryProtocol.new(transportFactory)
      elsif $protocolType == "compact"
        @protocol = Thrift::CompactProtocol.new(transportFactory)
      elsif $protocolType == "json"
        @protocol = Thrift::JsonProtocol.new(transportFactory)
      elsif $protocolType == "accel"
        @protocol = Thrift::BinaryProtocolAccelerated.new(transportFactory)
      else
        raise 'Unknown protocol type'
      end
      @client   = Thrift::Test::ThriftTest::Client.new(@protocol)
      @socket.open
    end
  end

  def teardown
    @socket.close
  end

  def test_void
    p 'test_void'
    @client.testVoid()
  end

  def test_string
    p 'test_string'
    test_string =
      'quote: \" backslash:' +
      ' forwardslash-escaped: \/ ' +
      ' backspace: \b formfeed: \f newline: \n return: \r tab: ' +
      ' now-all-of-them-together: "\\\/\b\n\r\t' +
      ' now-a-bunch-of-junk: !@#$%&()(&%$#{}{}<><><' +
      ' char-to-test-json-parsing: ]] \"]] \\" }}}{ [[[ '
    test_string = "Afrikaans, Alemannisch, Aragonés, العربية, مصرى, " +
      "Asturianu, Aymar aru, Azərbaycan, Башҡорт, Boarisch, Žemaitėška, " +
      "Беларуская, Беларуская (тарашкевіца), Български, Bamanankan, " +
      "বাংলা, Brezhoneg, Bosanski, Català, Mìng-dĕ̤ng-ngṳ̄, Нохчийн, " +
      "Cebuano, ᏣᎳᎩ, Česky, Словѣ́ньскъ / ⰔⰎⰑⰂⰡⰐⰠⰔⰍⰟ, Чӑвашла, Cymraeg, " +
      "Dansk, Zazaki, ދިވެހިބަސް, Ελληνικά, Emiliàn e rumagnòl, English, " +
      "Esperanto, Español, Eesti, Euskara, فارسی, Suomi, Võro, Føroyskt, " +
      "Français, Arpetan, Furlan, Frysk, Gaeilge, 贛語, Gàidhlig, Galego, " +
      "Avañe'ẽ, ગુજરાતી, Gaelg, עברית, हिन्दी, Fiji Hindi, Hrvatski, " +
      "Kreyòl ayisyen, Magyar, Հայերեն, Interlingua, Bahasa Indonesia, " +
      "Ilokano, Ido, Íslenska, Italiano, 日本語, Lojban, Basa Jawa, " +
      "ქართული, Kongo, Kalaallisut, ಕನ್ನಡ, 한국어, Къарачай-Малкъар, " +
      "Ripoarisch, Kurdî, Коми, Kernewek, Кыргызча, Latina, Ladino, " +
      "Lëtzebuergesch, Limburgs, Lingála, ລາວ, Lietuvių, Latviešu, Basa " +
      "Banyumasan, Malagasy, Македонски, മലയാളം, मराठी, مازِرونی, Bahasa " +
      "Melayu, Nnapulitano, Nedersaksisch, नेपाल भाषा, Nederlands, ‪" +
      "Norsk (nynorsk)‬, ‪Norsk (bokmål)‬, Nouormand, Diné bizaad, " +
      "Occitan, Иронау, Papiamentu, Deitsch, Polski, پنجابی, پښتو, " +
      "Norfuk / Pitkern, Português, Runa Simi, Rumantsch, Romani, Română, " +
      "Русский, Саха тыла, Sardu, Sicilianu, Scots, Sámegiella, Simple " +
      "English, Slovenčina, Slovenščina, Српски / Srpski, Seeltersk, " +
      "Svenska, Kiswahili, தமிழ், తెలుగు, Тоҷикӣ, ไทย, Türkmençe, Tagalog, " +
      "Türkçe, Татарча/Tatarça, Українська, اردو, Tiếng Việt, Volapük, " +
      "Walon, Winaray, 吴语, isiXhosa, ייִדיש, Yorùbá, Zeêuws, 中文, " +
      "Bân-lâm-gú, 粵語"

    result_string = @client.testString(test_string)
    assert_equal(test_string, result_string.force_encoding(Encoding::UTF_8))
  end

  def test_bool
    p 'test_bool'
    assert_equal(@client.testBool(true), true)
    assert_equal(@client.testBool(false), false)
  end

  def test_byte
    p 'test_byte'
    val = 120
    assert_equal(@client.testByte(val), val)
    assert_equal(@client.testByte(-val), -val)
  end

  def test_i32
    p 'test_i32'
    val = 2000000032
    assert_equal(@client.testI32(val), val)
    assert_equal(@client.testI32(-val), -val)
  end

  def test_i64
    p 'test_i64'
    val = 9000000000000000064
    assert_equal(@client.testI64(val), val)
    assert_equal(@client.testI64(-val), -val)
  end

  def test_double
    p 'test_double'
    val = 3.14159265358979323846
    assert_equal(@client.testDouble(val), val)
    assert_equal(@client.testDouble(-val), -val)
    assert_kind_of(Float, @client.testDouble(val))
  end

  def test_binary
    p 'test_binary'
    val = (0...256).reverse_each.to_a
    ret = @client.testBinary(val.pack('C*'))
    assert_equal(val, ret.bytes.to_a)
  end

  def test_map
    p 'test_map'
    val = {1 => 1, 2 => 2, 3 => 3}
    assert_equal(@client.testMap(val), val)
    assert_kind_of(Hash, @client.testMap(val))
  end

  def test_string_map
    p 'test_string_map'
    val = {'a' => '2', 'b' => 'blah', 'some' => 'thing'}
    ret = @client.testStringMap(val)
    assert_equal(val, ret)
    assert_kind_of(Hash, ret)
  end

  def test_list
    p 'test_list'
    val = [1,2,3,4,5]
    assert_equal(@client.testList(val), val)
    assert_kind_of(Array, @client.testList(val))
  end

  def test_enum
    p 'test_enum'
    val = Thrift::Test::Numberz::SIX
    ret = @client.testEnum(val)

    assert_equal(ret, 6)
    assert_kind_of(Fixnum, ret)
  end

  def test_typedef
    p 'test_typedef'
    #UserId  testTypedef(1: UserId thing),
    assert_equal(@client.testTypedef(309858235082523), 309858235082523)
    assert_kind_of(Fixnum, @client.testTypedef(309858235082523))
    true
  end

  def test_set
    p 'test_set'
    val = Set.new([1,2,3])
    assert_equal(@client.testSet(val), val)
    assert_kind_of(Set, @client.testSet(val))
  end

  def get_struct
    Thrift::Test::Xtruct.new({'string_thing' => 'hi!', 'i32_thing' => 4 })
  end

  def test_struct
    p 'test_struct'
    ret = @client.testStruct(get_struct)

    # TODO: not sure what unspecified "default" requiredness values should be
    assert(ret.byte_thing == nil || ret.byte_thing == 0)
    assert(ret.i64_thing == nil || ret.i64_thing == 0)

    assert_equal(ret.string_thing, 'hi!')
    assert_equal(ret.i32_thing, 4)
    assert_kind_of(Thrift::Test::Xtruct, ret)
  end

  def test_nest
    p 'test_nest'
    struct2 = Thrift::Test::Xtruct2.new({'struct_thing' => get_struct, 'i32_thing' => 10})

    ret = @client.testNest(struct2)

    # TODO: not sure what unspecified "default" requiredness values should be
    assert(ret.struct_thing.byte_thing == nil || ret.struct_thing.byte_thing == 0)
    assert(ret.struct_thing.i64_thing == nil || ret.struct_thing.i64_thing == 0)

    assert_equal(ret.struct_thing.string_thing, 'hi!')
    assert_equal(ret.struct_thing.i32_thing, 4)
    assert_equal(ret.i32_thing, 10)

    assert_kind_of(Thrift::Test::Xtruct, ret.struct_thing)
    assert_kind_of(Thrift::Test::Xtruct2, ret)
  end

  def test_insanity
    p 'test_insanity'
    insane = Thrift::Test::Insanity.new({
      'userMap' => {
        Thrift::Test::Numberz::FIVE => 5,
        Thrift::Test::Numberz::EIGHT => 8,
      },
      'xtructs' => [
        Thrift::Test::Xtruct.new({
          'string_thing' => 'Goodbye4',
          'byte_thing' => 4,
          'i32_thing' => 4,
          'i64_thing' => 4,
        }),
        Thrift::Test::Xtruct.new({
          'string_thing' => 'Hello2',
          'byte_thing' => 2,
          'i32_thing' => 2,
          'i64_thing' => 2,
        })
      ]
    })

    ret = @client.testInsanity(insane)

    assert_equal(insane, ret[1][2])
    assert_equal(insane, ret[1][3])

    assert(ret[2][6].userMap == nil || ret[2][6].userMap.length == 0)
    assert(ret[2][6].xtructs == nil || ret[2][6].xtructs.length == 0)
  end

  def test_map_map
    p 'test_map_map'
    ret = @client.testMapMap(4)
    assert_kind_of(Hash, ret)
    expected = {
      -4 => {
        -4 => -4,
        -3 => -3,
        -2 => -2,
        -1 => -1,
      },
      4 => {
        4 => 4,
        3 => 3,
        2 => 2,
        1 => 1,
      }
    }
    assert_equal(expected, ret)
  end

  def test_multi
    p 'test_multi'
    ret = @client.testMulti(42, 4242, 424242, {1 => 'blah', 2 => 'thing'}, Thrift::Test::Numberz::EIGHT, 24)
    expected = Thrift::Test::Xtruct.new({
      :string_thing => 'Hello2',
      :byte_thing =>   42,
      :i32_thing =>    4242,
      :i64_thing =>    424242
    })
    assert_equal(expected, ret)
  end

  def test_exception
    p 'test_exception'
    assert_raise Thrift::Test::Xception do
      @client.testException('Xception')
    end
    begin
      @client.testException('TException')
    rescue => e
      assert e.class.ancestors.include?(Thrift::Exception)
    end
    assert_nothing_raised do
      @client.testException('test')
    end
  end

  def test_multi_exception
    p 'test_multi_exception'
    assert_raise Thrift::Test::Xception do
      @client.testMultiException("Xception", "test 1")
    end
    assert_raise Thrift::Test::Xception2 do
      @client.testMultiException("Xception2", "test 2")
    end
    assert_equal( @client.testMultiException("Success", "test 3").string_thing, "test 3")
  end

  def test_oneway
    p 'test_oneway'
    time1 = Time.now.to_f
    @client.testOneway(1)
    time2 = Time.now.to_f
    assert_operator (time2-time1), :<, 0.1
  end

end

