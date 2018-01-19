<?php

/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 * @package thrift.test
 */

namespace test\Thrift\Protocol;

use Thrift\ClassLoader\ThriftClassLoader;
use Test\Thrift\Fixtures;
use Thrift\Transport\TMemoryBuffer;
use Thrift\Protocol\TSimpleJSONProtocol;

define( 'BUFSIZ', 8192 ); //big enough to read biggest serialized Fixture arg.

require_once __DIR__.'/../../../../lib/Thrift/ClassLoader/ThriftClassLoader.php';

$loader = new ThriftClassLoader();
$loader->registerNamespace('Thrift', __DIR__ . '/../../../../lib');
$loader->registerNamespace('Test', __DIR__ . '/../../..');
$loader->registerDefinition('ThriftTest', __DIR__ . '/../../../packages');
$loader->register();

/***
 * This test suite depends on running the compiler against the
 * standard ThriftTest.thrift file:
 *
 * lib/php/test$ ../../../compiler/cpp/thrift --gen php -r \
 *   --out ./packages ../../../test/ThriftTest.thrift
 */

class TestTSimpleJSONProtocol extends \PHPUnit_Framework_TestCase
{
  private $transport;
  private $protocol;

  public static function setUpBeforeClass()
  {
    Fixtures::populateTestArgs();
    TestTSimpleJSONProtocol_Fixtures::populateTestArgsSimpleJSON();
  }

  public function setUp()
  {
    $this->transport = new TMemoryBuffer();
    $this->protocol = new TSimpleJSONProtocol($this->transport);
    $this->transport->open();
  }

  /***
   * WRITE TESTS
   */

  public function testVoid_Write()
  {
    $args = new \ThriftTest\ThriftTest_testVoid_args();
    $args->write( $this->protocol );

    $actual = $this->transport->read( BUFSIZ );
    $expected = TestTSimpleJSONProtocol_Fixtures::$testArgsJSON['testVoid'];

    $this->assertEquals( $expected, $actual );
  }

  public function testString1_Write()
  {
    $args = new \ThriftTest\ThriftTest_testString_args();
    $args->thing = Fixtures::$testArgs['testString1'];
    $args->write( $this->protocol );

    $actual = $this->transport->read( BUFSIZ );
    $expected = TestTSimpleJSONProtocol_Fixtures::$testArgsJSON['testString1'];

    #$this->assertEquals( $expected, $actual );
  }

  public function testString2_Write()
  {
    $args = new \ThriftTest\ThriftTest_testString_args();
    $args->thing = Fixtures::$testArgs['testString2'];
    $args->write( $this->protocol );

    $actual = $this->transport->read( BUFSIZ );
    $expected = TestTSimpleJSONProtocol_Fixtures::$testArgsJSON['testString2'];

    $this->assertEquals( $expected, $actual );
  }

  public function testDouble_Write()
  {
    $args = new \ThriftTest\ThriftTest_testDouble_args();
    $args->thing = Fixtures::$testArgs['testDouble'];
    $args->write( $this->protocol );

    $actual = $this->transport->read( BUFSIZ );
    $expected = TestTSimpleJSONProtocol_Fixtures::$testArgsJSON['testDouble'];

    $this->assertEquals( $expected, $actual );
  }

  public function testByte_Write()
  {
    $args = new \ThriftTest\ThriftTest_testByte_args();
    $args->thing = Fixtures::$testArgs['testByte'];
    $args->write( $this->protocol );

    $actual = $this->transport->read( BUFSIZ );
    $expected = TestTSimpleJSONProtocol_Fixtures::$testArgsJSON['testByte'];

    $this->assertEquals( $expected, $actual );
  }

  public function testI32_Write()
  {
    $args = new \ThriftTest\ThriftTest_testI32_args();
    $args->thing = Fixtures::$testArgs['testI32'];
    $args->write( $this->protocol );

    $actual = $this->transport->read( BUFSIZ );
    $expected = TestTSimpleJSONProtocol_Fixtures::$testArgsJSON['testI32'];

    $this->assertEquals( $expected, $actual );
  }

  public function testI64_Write()
  {
    $args = new \ThriftTest\ThriftTest_testI64_args();
    $args->thing = Fixtures::$testArgs['testI64'];
    $args->write( $this->protocol );

    $actual = $this->transport->read( BUFSIZ );
    $expected = TestTSimpleJSONProtocol_Fixtures::$testArgsJSON['testI64'];

    $this->assertEquals( $expected, $actual );
  }

  public function testStruct_Write()
  {
    $args = new \ThriftTest\ThriftTest_testStruct_args();
    $args->thing = Fixtures::$testArgs['testStruct'];

    $args->write( $this->protocol );

    $actual = $this->transport->read( BUFSIZ );
    $expected = TestTSimpleJSONProtocol_Fixtures::$testArgsJSON['testStruct'];

    $this->assertEquals( $expected, $actual );
  }

  public function testNest_Write()
  {
    $args = new \ThriftTest\ThriftTest_testNest_args();
    $args->thing = Fixtures::$testArgs['testNest'];

    $args->write( $this->protocol );

    $actual = $this->transport->read( BUFSIZ );
    $expected = TestTSimpleJSONProtocol_Fixtures::$testArgsJSON['testNest'];

    $this->assertEquals( $expected, $actual );
  }

  public function testMap_Write()
  {
    $args = new \ThriftTest\ThriftTest_testMap_args();
    $args->thing = Fixtures::$testArgs['testMap'];

    $args->write( $this->protocol );

    $actual = $this->transport->read( BUFSIZ );
    $expected = TestTSimpleJSONProtocol_Fixtures::$testArgsJSON['testMap'];

    $this->assertEquals( $expected, $actual );
  }

  public function testStringMap_Write()
  {
    $args = new \ThriftTest\ThriftTest_testStringMap_args();
    $args->thing = Fixtures::$testArgs['testStringMap'];

    $args->write( $this->protocol );

    $actual = $this->transport->read( BUFSIZ );
    $expected = TestTSimpleJSONProtocol_Fixtures::$testArgsJSON['testStringMap'];

    $this->assertEquals( $expected, $actual );
  }

  public function testSet_Write()
  {
    $args = new \ThriftTest\ThriftTest_testSet_args();
    $args->thing = Fixtures::$testArgs['testSet'];

    $args->write( $this->protocol );

    $actual = $this->transport->read( BUFSIZ );
    $expected = TestTSimpleJSONProtocol_Fixtures::$testArgsJSON['testSet'];

    $this->assertEquals( $expected, $actual );
  }

  public function testList_Write()
  {
    $args = new \ThriftTest\ThriftTest_testList_args();
    $args->thing = Fixtures::$testArgs['testList'];

    $args->write( $this->protocol );

    $actual = $this->transport->read( BUFSIZ );
    $expected = TestTSimpleJSONProtocol_Fixtures::$testArgsJSON['testList'];

    $this->assertEquals( $expected, $actual );
  }

  public function testEnum_Write()
  {
    $args = new \ThriftTest\ThriftTest_testEnum_args();
    $args->thing = Fixtures::$testArgs['testEnum'];

    $args->write( $this->protocol );

    $actual = $this->transport->read( BUFSIZ );
    $expected = TestTSimpleJSONProtocol_Fixtures::$testArgsJSON['testEnum'];

    $this->assertEquals( $expected, $actual );
  }

  public function testTypedef_Write()
  {
    $args = new \ThriftTest\ThriftTest_testTypedef_args();
    $args->thing = Fixtures::$testArgs['testTypedef'];

    $args->write( $this->protocol );

    $actual = $this->transport->read( BUFSIZ );
    $expected = TestTSimpleJSONProtocol_Fixtures::$testArgsJSON['testTypedef'];

    $this->assertEquals( $expected, $actual );
  }
}

class TestTSimpleJSONProtocol_Fixtures
{
  public static $testArgsJSON = array();

  public static function populateTestArgsSimpleJSON()
  {
    self::$testArgsJSON['testVoid'] = '{}';

    self::$testArgsJSON['testString1'] = '{"1":{"str":"Afrikaans, Alemannisch, Aragon\u00e9s, \u0627\u0644\u0639\u0631\u0628\u064a\u0629, \u0645\u0635\u0631\u0649, Asturianu, Aymar aru, Az\u0259rbaycan, \u0411\u0430\u0448\u04a1\u043e\u0440\u0442, Boarisch, \u017demait\u0117\u0161ka, \u0411\u0435\u043b\u0430\u0440\u0443\u0441\u043a\u0430\u044f, \u0411\u0435\u043b\u0430\u0440\u0443\u0441\u043a\u0430\u044f (\u0442\u0430\u0440\u0430\u0448\u043a\u0435\u0432\u0456\u0446\u0430), \u0411\u044a\u043b\u0433\u0430\u0440\u0441\u043a\u0438, Bamanankan, \u09ac\u09be\u0982\u09b2\u09be, Brezhoneg, Bosanski, Catal\u00e0, M\u00ecng-d\u0115\u0324ng-ng\u1e73\u0304, \u041d\u043e\u0445\u0447\u0438\u0439\u043d, Cebuano, \u13e3\u13b3\u13a9, \u010cesky, \u0421\u043b\u043e\u0432\u0463\u0301\u043d\u044c\u0441\u043a\u044a \/ \u2c14\u2c0e\u2c11\u2c02\u2c21\u2c10\u2c20\u2c14\u2c0d\u2c1f, \u0427\u04d1\u0432\u0430\u0448\u043b\u0430, Cymraeg, Dansk, Zazaki, \u078b\u07a8\u0788\u07ac\u0780\u07a8\u0784\u07a6\u0790\u07b0, \u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac, Emili\u00e0n e rumagn\u00f2l, English, Esperanto, Espa\u00f1ol, Eesti, Euskara, \u0641\u0627\u0631\u0633\u06cc, Suomi, V\u00f5ro, F\u00f8royskt, Fran\u00e7ais, Arpetan, Furlan, Frysk, Gaeilge, \u8d1b\u8a9e, G\u00e0idhlig, Galego, Ava\u00f1e\'\u1ebd, \u0a97\u0ac1\u0a9c\u0ab0\u0abe\u0aa4\u0ac0, Gaelg, \u05e2\u05d1\u05e8\u05d9\u05ea, \u0939\u093f\u0928\u094d\u0926\u0940, Fiji Hindi, Hrvatski, Krey\u00f2l ayisyen, Magyar, \u0540\u0561\u0575\u0565\u0580\u0565\u0576, Interlingua, Bahasa Indonesia, Ilokano, Ido, \u00cdslenska, Italiano, \u65e5\u672c\u8a9e, Lojban, Basa Jawa, \u10e5\u10d0\u10e0\u10d7\u10e3\u10da\u10d8, Kongo, Kalaallisut, \u0c95\u0ca8\u0ccd\u0ca8\u0ca1, \ud55c\uad6d\uc5b4, \u041a\u044a\u0430\u0440\u0430\u0447\u0430\u0439-\u041c\u0430\u043b\u043a\u044a\u0430\u0440, Ripoarisch, Kurd\u00ee, \u041a\u043e\u043c\u0438, Kernewek, \u041a\u044b\u0440\u0433\u044b\u0437\u0447\u0430, Latina, Ladino, L\u00ebtzebuergesch, Limburgs, Ling\u00e1la, \u0ea5\u0eb2\u0ea7, Lietuvi\u0173, Latvie\u0161u, Basa Banyumasan, Malagasy, \u041c\u0430\u043a\u0435\u0434\u043e\u043d\u0441\u043a\u0438, \u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02, \u092e\u0930\u093e\u0920\u0940, Bahasa Melayu, \u0645\u0627\u0632\u0650\u0631\u0648\u0646\u06cc, Nnapulitano, Nedersaksisch, \u0928\u0947\u092a\u093e\u0932 \u092d\u093e\u0937\u093e, Nederlands, \u202aNorsk (nynorsk)\u202c, \u202aNorsk (bokm\u00e5l)\u202c, Nouormand, Din\u00e9 bizaad, Occitan, \u0418\u0440\u043e\u043d\u0430\u0443, Papiamentu, Deitsch, Norfuk \/ Pitkern, Polski, \u067e\u0646\u062c\u0627\u0628\u06cc, \u067e\u069a\u062a\u0648, Portugu\u00eas, Runa Simi, Rumantsch, Romani, Rom\u00e2n\u0103, \u0420\u0443\u0441\u0441\u043a\u0438\u0439, \u0421\u0430\u0445\u0430 \u0442\u044b\u043b\u0430, Sardu, Sicilianu, Scots, S\u00e1megiella, Simple English, Sloven\u010dina, Sloven\u0161\u010dina, \u0421\u0440\u043f\u0441\u043a\u0438 \/ Srpski, Seeltersk, Svenska, Kiswahili, \u0ba4\u0bae\u0bbf\u0bb4\u0bcd, \u0c24\u0c46\u0c32\u0c41\u0c17\u0c41, \u0422\u043e\u04b7\u0438\u043a\u04e3, \u0e44\u0e17\u0e22, T\u00fcrkmen\u00e7e, Tagalog, T\u00fcrk\u00e7e, \u0422\u0430\u0442\u0430\u0440\u0447\u0430\/Tatar\u00e7a, \u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430, \u0627\u0631\u062f\u0648, Ti\u1ebfng Vi\u1ec7t, Volap\u00fck, Walon, Winaray, \u5434\u8bed, isiXhosa, \u05d9\u05d9\u05b4\u05d3\u05d9\u05e9, Yor\u00f9b\u00e1, Ze\u00eauws, \u4e2d\u6587, B\u00e2n-l\u00e2m-g\u00fa, \u7cb5\u8a9e"}}';

    self::$testArgsJSON['testString2'] = '{"thing":"quote: \\\\\" backslash: forwardslash-escaped: \\\\\/  backspace: \\\\b formfeed: \f newline: \n return: \r tab:  now-all-of-them-together: \"\\\\\\\\\/\\\\b\n\r\t now-a-bunch-of-junk: !@#$%&()(&%$#{}{}<><><"}';

    self::$testArgsJSON['testDouble'] = '{"thing":3.1415926535898}';

    self::$testArgsJSON['testByte'] = '{"thing":1}';

    self::$testArgsJSON['testI32'] = '{"thing":1073741824}';

    if (PHP_INT_SIZE == 8) {
      self::$testArgsJSON['testI64'] = '{"thing":'.pow( 2, 60 ).'}';
      self::$testArgsJSON['testStruct'] = '{"thing":{"string_thing":"worked","byte_thing":1,"i32_thing":1073741824,"i64_thing":'.pow( 2, 60 ).'}}';
      self::$testArgsJSON['testNest'] = '{"thing":{"byte_thing":1,"struct_thing":{"string_thing":"worked","byte_thing":1,"i32_thing":1073741824,"i64_thing":'.pow( 2, 60 ).'},"i32_thing":32768}}';
    } else {
      self::$testArgsJSON['testI64'] = '{"thing":1152921504606847000}';

      self::$testArgsJSON['testStruct'] = '{"thing":{"string_thing":"worked","byte_thing":1,"i32_thing":1073741824,"i64_thing":1152921504606847000}}';
      self::$testArgsJSON['testNest'] = '{"thing":{"byte_thing":1,"struct_thing":{"string_thing":"worked","byte_thing":1,"i32_thing":1073741824,"i64_thing":1152921504606847000},"i32_thing":32768}}';
    }

    self::$testArgsJSON['testMap'] = '{"thing":{"7":77,"8":88,"9":99}}';

    self::$testArgsJSON['testStringMap'] = '{"thing":{"a":"123","a b":"with spaces ","same":"same","0":"numeric key","longValue":"Afrikaans, Alemannisch, Aragon\u00e9s, \u0627\u0644\u0639\u0631\u0628\u064a\u0629, \u0645\u0635\u0631\u0649, Asturianu, Aymar aru, Az\u0259rbaycan, \u0411\u0430\u0448\u04a1\u043e\u0440\u0442, Boarisch, \u017demait\u0117\u0161ka, \u0411\u0435\u043b\u0430\u0440\u0443\u0441\u043a\u0430\u044f, \u0411\u0435\u043b\u0430\u0440\u0443\u0441\u043a\u0430\u044f (\u0442\u0430\u0440\u0430\u0448\u043a\u0435\u0432\u0456\u0446\u0430), \u0411\u044a\u043b\u0433\u0430\u0440\u0441\u043a\u0438, Bamanankan, \u09ac\u09be\u0982\u09b2\u09be, Brezhoneg, Bosanski, Catal\u00e0, M\u00ecng-d\u0115\u0324ng-ng\u1e73\u0304, \u041d\u043e\u0445\u0447\u0438\u0439\u043d, Cebuano, \u13e3\u13b3\u13a9, \u010cesky, \u0421\u043b\u043e\u0432\u0463\u0301\u043d\u044c\u0441\u043a\u044a \/ \u2c14\u2c0e\u2c11\u2c02\u2c21\u2c10\u2c20\u2c14\u2c0d\u2c1f, \u0427\u04d1\u0432\u0430\u0448\u043b\u0430, Cymraeg, Dansk, Zazaki, \u078b\u07a8\u0788\u07ac\u0780\u07a8\u0784\u07a6\u0790\u07b0, \u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac, Emili\u00e0n e rumagn\u00f2l, English, Esperanto, Espa\u00f1ol, Eesti, Euskara, \u0641\u0627\u0631\u0633\u06cc, Suomi, V\u00f5ro, F\u00f8royskt, Fran\u00e7ais, Arpetan, Furlan, Frysk, Gaeilge, \u8d1b\u8a9e, G\u00e0idhlig, Galego, Ava\u00f1e\'\u1ebd, \u0a97\u0ac1\u0a9c\u0ab0\u0abe\u0aa4\u0ac0, Gaelg, \u05e2\u05d1\u05e8\u05d9\u05ea, \u0939\u093f\u0928\u094d\u0926\u0940, Fiji Hindi, Hrvatski, Krey\u00f2l ayisyen, Magyar, \u0540\u0561\u0575\u0565\u0580\u0565\u0576, Interlingua, Bahasa Indonesia, Ilokano, Ido, \u00cdslenska, Italiano, \u65e5\u672c\u8a9e, Lojban, Basa Jawa, \u10e5\u10d0\u10e0\u10d7\u10e3\u10da\u10d8, Kongo, Kalaallisut, \u0c95\u0ca8\u0ccd\u0ca8\u0ca1, \ud55c\uad6d\uc5b4, \u041a\u044a\u0430\u0440\u0430\u0447\u0430\u0439-\u041c\u0430\u043b\u043a\u044a\u0430\u0440, Ripoarisch, Kurd\u00ee, \u041a\u043e\u043c\u0438, Kernewek, \u041a\u044b\u0440\u0433\u044b\u0437\u0447\u0430, Latina, Ladino, L\u00ebtzebuergesch, Limburgs, Ling\u00e1la, \u0ea5\u0eb2\u0ea7, Lietuvi\u0173, Latvie\u0161u, Basa Banyumasan, Malagasy, \u041c\u0430\u043a\u0435\u0434\u043e\u043d\u0441\u043a\u0438, \u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02, \u092e\u0930\u093e\u0920\u0940, Bahasa Melayu, \u0645\u0627\u0632\u0650\u0631\u0648\u0646\u06cc, Nnapulitano, Nedersaksisch, \u0928\u0947\u092a\u093e\u0932 \u092d\u093e\u0937\u093e, Nederlands, \u202aNorsk (nynorsk)\u202c, \u202aNorsk (bokm\u00e5l)\u202c, Nouormand, Din\u00e9 bizaad, Occitan, \u0418\u0440\u043e\u043d\u0430\u0443, Papiamentu, Deitsch, Norfuk \/ Pitkern, Polski, \u067e\u0646\u062c\u0627\u0628\u06cc, \u067e\u069a\u062a\u0648, Portugu\u00eas, Runa Simi, Rumantsch, Romani, Rom\u00e2n\u0103, \u0420\u0443\u0441\u0441\u043a\u0438\u0439, \u0421\u0430\u0445\u0430 \u0442\u044b\u043b\u0430, Sardu, Sicilianu, Scots, S\u00e1megiella, Simple English, Sloven\u010dina, Sloven\u0161\u010dina, \u0421\u0440\u043f\u0441\u043a\u0438 \/ Srpski, Seeltersk, Svenska, Kiswahili, \u0ba4\u0bae\u0bbf\u0bb4\u0bcd, \u0c24\u0c46\u0c32\u0c41\u0c17\u0c41, \u0422\u043e\u04b7\u0438\u043a\u04e3, \u0e44\u0e17\u0e22, T\u00fcrkmen\u00e7e, Tagalog, T\u00fcrk\u00e7e, \u0422\u0430\u0442\u0430\u0440\u0447\u0430\/Tatar\u00e7a, \u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430, \u0627\u0631\u062f\u0648, Ti\u1ebfng Vi\u1ec7t, Volap\u00fck, Walon, Winaray, \u5434\u8bed, isiXhosa, \u05d9\u05d9\u05b4\u05d3\u05d9\u05e9, Yor\u00f9b\u00e1, Ze\u00eauws, \u4e2d\u6587, B\u00e2n-l\u00e2m-g\u00fa, \u7cb5\u8a9e","Afrikaans, Alemannisch, Aragon\u00e9s, \u0627\u0644\u0639\u0631\u0628\u064a\u0629, \u0645\u0635\u0631\u0649, Asturianu, Aymar aru, Az\u0259rbaycan, \u0411\u0430\u0448\u04a1\u043e\u0440\u0442, Boarisch, \u017demait\u0117\u0161ka, \u0411\u0435\u043b\u0430\u0440\u0443\u0441\u043a\u0430\u044f, \u0411\u0435\u043b\u0430\u0440\u0443\u0441\u043a\u0430\u044f (\u0442\u0430\u0440\u0430\u0448\u043a\u0435\u0432\u0456\u0446\u0430), \u0411\u044a\u043b\u0433\u0430\u0440\u0441\u043a\u0438, Bamanankan, \u09ac\u09be\u0982\u09b2\u09be, Brezhoneg, Bosanski, Catal\u00e0, M\u00ecng-d\u0115\u0324ng-ng\u1e73\u0304, \u041d\u043e\u0445\u0447\u0438\u0439\u043d, Cebuano, \u13e3\u13b3\u13a9, \u010cesky, \u0421\u043b\u043e\u0432\u0463\u0301\u043d\u044c\u0441\u043a\u044a \/ \u2c14\u2c0e\u2c11\u2c02\u2c21\u2c10\u2c20\u2c14\u2c0d\u2c1f, \u0427\u04d1\u0432\u0430\u0448\u043b\u0430, Cymraeg, Dansk, Zazaki, \u078b\u07a8\u0788\u07ac\u0780\u07a8\u0784\u07a6\u0790\u07b0, \u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac, Emili\u00e0n e rumagn\u00f2l, English, Esperanto, Espa\u00f1ol, Eesti, Euskara, \u0641\u0627\u0631\u0633\u06cc, Suomi, V\u00f5ro, F\u00f8royskt, Fran\u00e7ais, Arpetan, Furlan, Frysk, Gaeilge, \u8d1b\u8a9e, G\u00e0idhlig, Galego, Ava\u00f1e\'\u1ebd, \u0a97\u0ac1\u0a9c\u0ab0\u0abe\u0aa4\u0ac0, Gaelg, \u05e2\u05d1\u05e8\u05d9\u05ea, \u0939\u093f\u0928\u094d\u0926\u0940, Fiji Hindi, Hrvatski, Krey\u00f2l ayisyen, Magyar, \u0540\u0561\u0575\u0565\u0580\u0565\u0576, Interlingua, Bahasa Indonesia, Ilokano, Ido, \u00cdslenska, Italiano, \u65e5\u672c\u8a9e, Lojban, Basa Jawa, \u10e5\u10d0\u10e0\u10d7\u10e3\u10da\u10d8, Kongo, Kalaallisut, \u0c95\u0ca8\u0ccd\u0ca8\u0ca1, \ud55c\uad6d\uc5b4, \u041a\u044a\u0430\u0440\u0430\u0447\u0430\u0439-\u041c\u0430\u043b\u043a\u044a\u0430\u0440, Ripoarisch, Kurd\u00ee, \u041a\u043e\u043c\u0438, Kernewek, \u041a\u044b\u0440\u0433\u044b\u0437\u0447\u0430, Latina, Ladino, L\u00ebtzebuergesch, Limburgs, Ling\u00e1la, \u0ea5\u0eb2\u0ea7, Lietuvi\u0173, Latvie\u0161u, Basa Banyumasan, Malagasy, \u041c\u0430\u043a\u0435\u0434\u043e\u043d\u0441\u043a\u0438, \u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02, \u092e\u0930\u093e\u0920\u0940, Bahasa Melayu, \u0645\u0627\u0632\u0650\u0631\u0648\u0646\u06cc, Nnapulitano, Nedersaksisch, \u0928\u0947\u092a\u093e\u0932 \u092d\u093e\u0937\u093e, Nederlands, \u202aNorsk (nynorsk)\u202c, \u202aNorsk (bokm\u00e5l)\u202c, Nouormand, Din\u00e9 bizaad, Occitan, \u0418\u0440\u043e\u043d\u0430\u0443, Papiamentu, Deitsch, Norfuk \/ Pitkern, Polski, \u067e\u0646\u062c\u0627\u0628\u06cc, \u067e\u069a\u062a\u0648, Portugu\u00eas, Runa Simi, Rumantsch, Romani, Rom\u00e2n\u0103, \u0420\u0443\u0441\u0441\u043a\u0438\u0439, \u0421\u0430\u0445\u0430 \u0442\u044b\u043b\u0430, Sardu, Sicilianu, Scots, S\u00e1megiella, Simple English, Sloven\u010dina, Sloven\u0161\u010dina, \u0421\u0440\u043f\u0441\u043a\u0438 \/ Srpski, Seeltersk, Svenska, Kiswahili, \u0ba4\u0bae\u0bbf\u0bb4\u0bcd, \u0c24\u0c46\u0c32\u0c41\u0c17\u0c41, \u0422\u043e\u04b7\u0438\u043a\u04e3, \u0e44\u0e17\u0e22, T\u00fcrkmen\u00e7e, Tagalog, T\u00fcrk\u00e7e, \u0422\u0430\u0442\u0430\u0440\u0447\u0430\/Tatar\u00e7a, \u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430, \u0627\u0631\u062f\u0648, Ti\u1ebfng Vi\u1ec7t, Volap\u00fck, Walon, Winaray, \u5434\u8bed, isiXhosa, \u05d9\u05d9\u05b4\u05d3\u05d9\u05e9, Yor\u00f9b\u00e1, Ze\u00eauws, \u4e2d\u6587, B\u00e2n-l\u00e2m-g\u00fa, \u7cb5\u8a9e":"long key"}}';

    self::$testArgsJSON['testSet'] = '{"thing":[1,5,6]}';

    self::$testArgsJSON['testList'] = '{"thing":[1,2,3]}';

    self::$testArgsJSON['testEnum'] = '{"thing":1}';

    self::$testArgsJSON['testTypedef'] = '{"thing":69}';
  }
}
