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
 */
 /* jshint -W100 */
 
/*
 * Fully Async JavaScript test suite for ThriftTest.thrift. 
 * These tests are designed to exercise the WebSocket transport
 * (which is exclusively async).
 *
 * To compile client code for this test use:
 *      $ thrift -gen js ThriftTest.thrift
 */



// all Languages in UTF-8
var stringTest = "Afrikaans, Alemannisch, Aragonés, العربية, مصرى, Asturianu, Aymar aru, Azərbaycan, Башҡорт, Boarisch, Žemaitėška, Беларуская, Беларуская (тарашкевіца), Български, Bamanankan, বাংলা, Brezhoneg, Bosanski, Català, Mìng-dĕ̤ng-ngṳ̄, Нохчийн, Cebuano, ᏣᎳᎩ, Česky, Словѣ́ньскъ / ⰔⰎⰑⰂⰡⰐⰠⰔⰍⰟ, Чӑвашла, Cymraeg, Dansk, Zazaki, ދިވެހިބަސް, Ελληνικά, Emiliàn e rumagnòl, English, Esperanto, Español, Eesti, Euskara, فارسی, Suomi, Võro, Føroyskt, Français, Arpetan, Furlan, Frysk, Gaeilge, 贛語, Gàidhlig, Galego, Avañe'ẽ, ગુજરાતી, Gaelg, עברית, हिन्दी, Fiji Hindi, Hrvatski, Kreyòl ayisyen, Magyar, Հայերեն, Interlingua, Bahasa Indonesia, Ilokano, Ido, Íslenska, Italiano, 日本語, Lojban, Basa Jawa, ქართული, Kongo, Kalaallisut, ಕನ್ನಡ, 한국어, Къарачай-Малкъар, Ripoarisch, Kurdî, Коми, Kernewek, Кыргызча, Latina, Ladino, Lëtzebuergesch, Limburgs, Lingála, ລາວ, Lietuvių, Latviešu, Basa Banyumasan, Malagasy, Македонски, മലയാളം, मराठी, Bahasa Melayu, مازِرونی, Nnapulitano, Nedersaksisch, नेपाल भाषा, Nederlands, ‪Norsk (nynorsk)‬, ‪Norsk (bokmål)‬, Nouormand, Diné bizaad, Occitan, Иронау, Papiamentu, Deitsch, Norfuk / Pitkern, Polski, پنجابی, پښتو, Português, Runa Simi, Rumantsch, Romani, Română, Русский, Саха тыла, Sardu, Sicilianu, Scots, Sámegiella, Simple English, Slovenčina, Slovenščina, Српски / Srpski, Seeltersk, Svenska, Kiswahili, தமிழ், తెలుగు, Тоҷикӣ, ไทย, Türkmençe, Tagalog, Türkçe, Татарча/Tatarça, Українська, اردو, Tiếng Việt, Volapük, Walon, Winaray, 吴语, isiXhosa, ייִדיש, Yorùbá, Zeêuws, 中文, Bân-lâm-gú, 粵語";
  
function checkRecursively(map1, map2) {
  if (typeof map1 !== 'function' && typeof map2 !== 'function') {
    if (!map1 || typeof map1 !== 'object') {
        equal(map1, map2);
    } else {
      for (var key in map1) {
        checkRecursively(map1[key], map2[key]);
      }
    }
  }
}

module("Base Types");

  asyncTest("Void", function() {
    expect( 1 );
    client.testVoid(function(result) {
      equal(result, undefined);
      QUnit.start();
    });
  });
  
  
  asyncTest("String", function() {
    expect( 3 );
    QUnit.stop(2);
    client.testString('', function(result){
       equal(result, '');
       QUnit.start();
    });
    client.testString(stringTest, function(result){
       equal(result, stringTest);
       QUnit.start();
    });

    var specialCharacters = 'quote: \" backslash:' +
          ' forwardslash-escaped: \/ ' +
          ' backspace: \b formfeed: \f newline: \n return: \r tab: ' +
          ' now-all-of-them-together: "\\\/\b\n\r\t' +
          ' now-a-bunch-of-junk: !@#$%&()(&%$#{}{}<><><';
    client.testString(specialCharacters, function(result){
       equal(result, specialCharacters);
       QUnit.start();
    });
  });
  asyncTest("Double", function() {
    expect( 4 );
    QUnit.stop(3);
    client.testDouble(0, function(result){
       equal(result, 0);
       QUnit.start();
    });
    client.testDouble(-1, function(result){
       equal(result, -1);
       QUnit.start();
    });
    client.testDouble(3.14, function(result){
       equal(result, 3.14);
       QUnit.start();
    });
    client.testDouble(Math.pow(2,60), function(result){
       equal(result, Math.pow(2,60));
       QUnit.start();
    });
  });
  // TODO: add testBinary() 
  asyncTest("Byte", function() {
    expect( 2 );
    QUnit.stop();
    client.testByte(0, function(result) {
       equal(result, 0);
       QUnit.start();
    });
    client.testByte(0x01, function(result) {
       equal(result, 0x01);
       QUnit.start();
    });
  });
  asyncTest("I32", function() {
    expect( 3 );
    QUnit.stop(2);
    client.testI32(0, function(result){
       equal(result, 0);
       QUnit.start();
    });
    client.testI32(Math.pow(2,30), function(result){
       equal(result, Math.pow(2,30));
       QUnit.start();
    });
    client.testI32(-Math.pow(2,30), function(result){
       equal(result, -Math.pow(2,30));
       QUnit.start();
    });
  });
  asyncTest("I64", function() {
    expect( 3 );
    QUnit.stop(2);
    client.testI64(0, function(result){
       equal(result, 0);
       QUnit.start();
    });
    //This is usually 2^60 but JS cannot represent anything over 2^52 accurately
    client.testI64(Math.pow(2,52), function(result){
       equal(result, Math.pow(2,52));
       QUnit.start();
    });
    client.testI64(-Math.pow(2,52), function(result){
       equal(result, -Math.pow(2,52));
       QUnit.start();
    });
  });
  

  

module("Structured Types");

  asyncTest("Struct", function() {
    expect( 5 );
    var structTestInput = new ThriftTest.Xtruct();
    structTestInput.string_thing = 'worked';
    structTestInput.byte_thing = 0x01;
    structTestInput.i32_thing = Math.pow(2,30);
    //This is usually 2^60 but JS cannot represent anything over 2^52 accurately
    structTestInput.i64_thing = Math.pow(2,52);

    client.testStruct(structTestInput, function(result){
      equal(result.string_thing, structTestInput.string_thing);
      equal(result.byte_thing, structTestInput.byte_thing);
      equal(result.i32_thing, structTestInput.i32_thing);
      equal(result.i64_thing, structTestInput.i64_thing);
      equal(JSON.stringify(result), JSON.stringify(structTestInput));
      QUnit.start();      
    });
  });

  asyncTest("Nest", function() {
    expect( 7 );
    var xtrTestInput = new ThriftTest.Xtruct();
    xtrTestInput.string_thing = 'worked';
    xtrTestInput.byte_thing = 0x01;
    xtrTestInput.i32_thing = Math.pow(2,30);
    //This is usually 2^60 but JS cannot represent anything over 2^52 accurately
    xtrTestInput.i64_thing = Math.pow(2,52);
    
    var nestTestInput = new ThriftTest.Xtruct2();
    nestTestInput.byte_thing = 0x02;
    nestTestInput.struct_thing = xtrTestInput;
    nestTestInput.i32_thing = Math.pow(2,15);
    
    client.testNest(nestTestInput, function(result){
      equal(result.byte_thing, nestTestInput.byte_thing);
      equal(result.struct_thing.string_thing, nestTestInput.struct_thing.string_thing);
      equal(result.struct_thing.byte_thing, nestTestInput.struct_thing.byte_thing);
      equal(result.struct_thing.i32_thing, nestTestInput.struct_thing.i32_thing);
      equal(result.struct_thing.i64_thing, nestTestInput.struct_thing.i64_thing);
      equal(result.i32_thing, nestTestInput.i32_thing);  
      equal(JSON.stringify(result), JSON.stringify(nestTestInput));
      QUnit.start();      
    });
  });

  asyncTest("Map", function() {
    expect( 3 );
    var mapTestInput = {7:77, 8:88, 9:99};

    client.testMap(mapTestInput, function(result){
      for (var key in result) {
        equal(result[key], mapTestInput[key]);
      }
      QUnit.start();  
    });
  });

  asyncTest("StringMap", function() {
    expect( 6 );
    var mapTestInput = {
      "a":"123", "a b":"with spaces ", "same":"same", "0":"numeric key",
      "longValue":stringTest, stringTest:"long key"
    };

    client.testStringMap(mapTestInput, function(result){
      for (var key in result) {
        equal(result[key], mapTestInput[key]);
      }
      QUnit.start();
    });
  });

  asyncTest("Set", function() {
    expect( 1 );
    var setTestInput = [1,2,3];
    client.testSet(setTestInput, function(result){
      ok(result, setTestInput);
      QUnit.start();
    });
  });

  asyncTest("List", function() {
    expect( 1 );
    var listTestInput = [1,2,3];
    client.testList(listTestInput, function(result){
      ok(result, listTestInput);
      QUnit.start();
    });
  });

  asyncTest("Enum", function() {
    expect( 1 );
    client.testEnum(ThriftTest.Numberz.ONE, function(result){
      equal(result, ThriftTest.Numberz.ONE);
      QUnit.start();
    });
  });

  asyncTest("TypeDef", function() {
    expect( 1 );
    client.testTypedef(69, function(result){
      equal(result, 69);
      QUnit.start();
    });
  });


module("deeper!");

  asyncTest("MapMap", function() {
    expect( 16 );
    var mapMapTestExpectedResult = {
      "4":{"1":1,"2":2,"3":3,"4":4},
      "-4":{"-4":-4, "-3":-3, "-2":-2, "-1":-1}
    };

    client.testMapMap(1, function(result){
      for (var key in result) {
        for (var key2 in result[key]) {
          equal(result[key][key2], mapMapTestExpectedResult[key][key2]);
        }
      }
      checkRecursively(result, mapMapTestExpectedResult);
      QUnit.start();
    });
  });


module("Exception");

  asyncTest("Xception", function() {
    expect(2);
    client.testException("Xception", function(e){
      equal(e.errorCode, 1001);
      equal(e.message, "Xception");
      QUnit.start();
    });
  });

  asyncTest("no Exception", 0, function() {
    expect( 1 );
    client.testException("no Exception", function(e){
      ok(!e);
      QUnit.start();
    });
  });

module("Insanity");

  asyncTest("testInsanity", function() {
    expect( 24 );
    var insanity = {
      "1":{
        "2":{
          "userMap":{ "5":5, "8":8 },
          "xtructs":[{
              "string_thing":"Goodbye4",
              "byte_thing":4,
              "i32_thing":4,
              "i64_thing":4
            },
            {
              "string_thing":"Hello2",
              "byte_thing":2,
              "i32_thing":2,
              "i64_thing":2
            }
          ]
        },
        "3":{
          "userMap":{ "5":5, "8":8 },
          "xtructs":[{
              "string_thing":"Goodbye4",
              "byte_thing":4,
              "i32_thing":4,
              "i64_thing":4
            },
            {
              "string_thing":"Hello2",
              "byte_thing":2,
              "i32_thing":2,
              "i64_thing":2
            }
          ]
        }
      },
      "2":{ "6":{ "userMap":null, "xtructs":null } }
    };
    client.testInsanity(new ThriftTest.Insanity(), function(res){
      ok(res, JSON.stringify(res));
      ok(insanity, JSON.stringify(insanity));
      checkRecursively(res, insanity);
      QUnit.start();
    });
  });


