module.exports = function(config) {
  return {
    src: [
      'Gruntfile.js',
      '<%= baseDir %>/open-falcon/**/*.js',
      '<%= srcDir %>/app/**/*.js',
      '<%= srcDir %>/plugins/**/*.js',
      '!<%= srcDir %>/app/panels/*/{lib,leaflet}/*',
      '!<%= srcDir %>/app/dashboards/*'
    ],
    options: {
      config: ".jscs.json",
    },
  };
};

/*
 "requireCurlyBraces": ["if", "else", "for", "while", "do", "try", "catch"],
    "requireSpaceAfterKeywords": ["if", "else", "for", "while", "do", "switch", "return", "try", "catch"],
    "disallowLeftStickedOperators": ["?", "+", "-", "/", "*", "=", "==", "===", "!=", "!==", ">", ">=", "<", "<="],
    "disallowRightStickedOperators": ["?", "+", "/", "*", ":", "=", "==", "===", "!=", "!==", ">", ">=", "<", "<="],
    "requireRightStickedOperators": ["!"],
    "requireLeftStickedOperators": [","],
   */