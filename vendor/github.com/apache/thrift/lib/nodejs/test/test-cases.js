'use strict';

var ttypes = require('./gen-nodejs/ThriftTest_types');
var Int64 = require('node-int64');

//all Languages in UTF-8
/*jshint -W100 */
var stringTest = module.exports.stringTest = "Afrikaans, Alemannisch, Aragonés, العربية, مصرى, " +
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
    "Bân-lâm-gú, 粵語";
/*jshint +W100 */

var specialCharacters = module.exports.specialCharacters = 'quote: \" backslash:' +
    ' forwardslash-escaped: \/ ' +
    ' backspace: \b formfeed: \f newline: \n return: \r tab: ' +
    ' now-all-of-them-together: "\\\/\b\n\r\t' +
    ' now-a-bunch-of-junk: !@#$%&()(&%$#{}{}<><><' +
    ' char-to-test-json-parsing: ]] \"]] \\" }}}{ [[[ ';

var mapTestInput = module.exports.mapTestInput = {
  "a":"123", "a b":"with spaces ", "same":"same", "0":"numeric key",
  "longValue":stringTest, stringTest:"long key"
};

var simple = [
  ['testVoid', undefined],
  ['testString', 'Test'],
  ['testString', ''],
  ['testString', stringTest],
  ['testString', specialCharacters],
  ['testBool', true],
  ['testBool', false],
  ['testByte', 1],
  ['testByte', 0],
  ['testByte', -1],
  ['testByte', -127],
  ['testI32', -1],
  ['testDouble', -5.2098523],
  ['testDouble', 7.012052175215044],
  ['testEnum', ttypes.Numberz.ONE],
  ['testI64', 5],
  ['testI64', -5],
  ['testI64', 734359738368],
  ['testI64', -734359738368],
  ['testI64', new Int64(new Buffer([0, 0x20, 0, 0, 0, 0, 0, 1]))],  // 2^53+1
  ['testI64', new Int64(
      new Buffer([0xff, 0xdf, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]))],  // -2^53-1
  ['testTypedef', 69]
]

var mapout = {};
for (var i = 0; i < 5; ++i) {
  mapout[i] = i-10;
}

var deep = [
  ['testList', [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]],
];

var deepUnordered = [
  ['testMap', mapout],
  ['testSet', [1,2,3]],
  ['testStringMap', mapTestInput]
];

var out = new ttypes.Xtruct({
  string_thing: 'Zero',
  byte_thing: 1,
  i32_thing: -3,
  i64_thing: 1000000
});

var out2 = new ttypes.Xtruct2();
out2.byte_thing = 1;
out2.struct_thing = out;
out2.i32_thing = 5;

var crazy = new ttypes.Insanity({
  "userMap":{ "5":5, "8":8 },
  "xtructs":[new ttypes.Xtruct({
      "string_thing":"Goodbye4",
      "byte_thing":4,
      "i32_thing":4,
      "i64_thing":4
    }), new ttypes.Xtruct({
      "string_thing":"Hello2",
      "byte_thing":2,
      "i32_thing":2,
      "i64_thing":2
    })]
});

var crazy2 = new ttypes.Insanity({
  "userMap":{ "5":5, "8":8 },
  "xtructs":[{
      "string_thing":"Goodbye4",
      "byte_thing":4,
      "i32_thing":4,
      "i64_thing":4
    }, {
      "string_thing":"Hello2",
      "byte_thing":2,
      "i32_thing":2,
      "i64_thing":2
    }]
});


var insanity = {
  "1":{ "2": crazy, "3": crazy },
  "2":{ "6":{ "userMap":{}, "xtructs":[] } }
};

module.exports.simple = simple;
module.exports.deep = deep;
module.exports.deepUnordered = deepUnordered;

module.exports.out = out;
module.exports.out2 = out2;
module.exports.crazy = crazy;
module.exports.crazy2 = crazy2;
module.exports.insanity = insanity;
