/*******************************************************************
 * This code is based on the code found in the GCP repository:
 * https://github.com/GoogleCloudPlatform/nodejs-getting-started.git
 * 
 * It is, however, significantly modified
 * ****************************************************************/

'use strict';

// Hierarchical node.js configuration with command-line arguments, environment
// variables, and files.
const nconf = (module.exports = require('nconf'));
const path = require('path');

nconf
  // 1. Command-line arguments
  .argv()
  // 2. Environment variables
  .env(['NODE_ENV', 'PORT'])
  // 3. Config file
  .file({file: path.join(__dirname, 'config.json')})
  // 4. Defaults
  .defaults({
    PORT: 8080,
  });
