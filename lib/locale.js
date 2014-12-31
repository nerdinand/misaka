var i18n = require('i18n');

/**
 * Class to configure the global i18n instance.
 * @class
 */
var Locale = function() {
};

/**
 * Configures the global i18n instance.
 */
Locale.prototype.configure = function() {
  // Note: If objectNotation: true, ':' will cause weird output
  // if in input String
  i18n.configure({
    locales: ['en'],
    defaultLocale: 'en',
    directory: 'locales',
    updateFiles: false,
    indent: '  ',
    extension: '.json',
    objectNotation: false
  });
};

module.exports = Locale;
