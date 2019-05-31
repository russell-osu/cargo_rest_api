/*******************************************************************
 * This code is based on the code found in the GCP repository:
 * https://github.com/GoogleCloudPlatform/nodejs-getting-started.git
 * 
 * It is, however, significantly modified
 * ****************************************************************/

'use strict';

const path = require('path');
const express = require('express');
const config = require('./config');

const app = express();

app.disable('etag');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('trust proxy', true);

// Port
app.use('/boats', require('./port/boats'));
app.use('/cargo', require('./port/cargo'));  
app.use('/users', require('./port/users'));

// // Redirect root to /marina
// app.get('/', (req, res) => {
//   res.redirect('/marina');
// });

// Basic 404 handler
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// Basic error handler
app.use((err, req, res) => {
  /* jshint unused:false */
  console.error(err);
  // If our routes specified a specific response, then send that. Otherwise,
  // send a generic message so as not to leak anything.
  res.status(500).send(err.response || 'Something broke!');
});

if (module === require.main) {
  // Start the server
  const server = app.listen(config.get('PORT'), () => {
    const port = server.address().port;
    console.log(`App listening on port ${port}`);
  });
}

module.exports = app;
