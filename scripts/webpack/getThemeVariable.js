const sass = require('node-sass');
const sassUtils = require('node-sass-utils')(sass);
const { get } = require('lodash');
const tinycolor = require('tinycolor2');
const { getTheme } = require('@grafana/ui/src/themes');

const units = ['rem', 'em', 'vh', 'vw', 'vmin', 'vmax', 'ex', '%', 'px', 'cm', 'mm', 'in', 'pt', 'pc', 'ch'];
const matchDimension = value => value.match(/[a-zA-Z]+|[0-9]+/g);

const isHex = value => {
  const hexRegex = /^((0x){0,1}|#{0,1})([0-9A-F]{8}|[0-9A-F]{6})$/gi;
  return hexRegex.test(value);
};

const isDimension = value => {
  if (typeof value !== 'string') {
    return false;
  }
  const [val, unit] = matchDimension(value);
  return units.indexOf(unit) > -1;
};

/**
 * @param {SassString} variablePath
 * @param {"dark"|"light"} themeName
 */
function getThemeVariable(variablePath, themeName) {
  const theme = getTheme(themeName.getValue());
  const variable = get(theme, variablePath.getValue());

  if (!variable) {
    throw new Error(`${variablePath} is not defined fo ${themeName}`);
  }

  if (isHex(variable)) {
    const rgb = new tinycolor(variable).toRgb();
    const color = sass.types.Color(rgb.r, rgb.g, rgb.b);
    return color;
  }

  if (isDimension(variable)) {
    const [value, unit] = matchDimension(variable);
    const dimension = new sassUtils.SassDimension(parseInt(value, 10), unit);
    return sassUtils.castToSass(dimension);
  }

  return sassUtils.castToSass(variable);
}

module.exports = getThemeVariable;
