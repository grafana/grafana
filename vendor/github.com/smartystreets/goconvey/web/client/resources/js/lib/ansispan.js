/*
Copyright (C) 2011 by Maciej Małecki

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var ansispan = function (str) {
  Object.keys(ansispan.foregroundColors).forEach(function (ansi) {
    var span = '<span class="ansi-' + ansispan.foregroundColors[ansi] + '">';

    //
    // `\033[Xm` == `\033[0;Xm` sets foreground color to `X`.
    //

    str = str.replace(
      new RegExp('\033\\[' + ansi + 'm', 'g'),
      span
    ).replace(
      new RegExp('\033\\[0;' + ansi + 'm', 'g'),
      span
    );
  });
  //
  // `\033[1m` enables bold font, `\033[22m` disables it
  //
  str = str.replace(/\033\[1m/g, '<b>').replace(/\033\[22m/g, '</b>');

  //
  // `\033[3m` enables italics font, `\033[23m` disables it
  //
  str = str.replace(/\033\[3m/g, '<i>').replace(/\033\[23m/g, '</i>');

  str = str.replace(/\033\[m/g, '</span>');
  str = str.replace(/\033\[0m/g, '</span>');
  return str.replace(/\033\[39m/g, '</span>');
};

ansispan.foregroundColors = {
  '30': 'black',
  '31': 'red',
  '32': 'green',
  '33': 'yellow',
  '34': 'blue',
  '35': 'purple',
  '36': 'cyan',
  '37': 'white'
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ansispan;
}
