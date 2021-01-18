require('dotenv').config();

module.exports = {
  extension: ['ts'],
  opts: false,
  package: './package.json',
  // reporter: 'spec',
  reporter: 'dot',
  spec: ['./src/test/**/*.spec.*'],
  require: ['ts-node/register'],
};
