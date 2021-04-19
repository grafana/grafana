module.exports = function loader(source) {
  source = `var Kusto = require("@kusto/language-service-next/Kusto.Language.Bridge.min");\n${source}`;

  const newSource = source.replace(/importScripts.*/g, '');

  console.log('newSource', newSource);

  return newSource;
};
