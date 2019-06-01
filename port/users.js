
/*******************************************************************
 * This code is based on the code found in the GCP repository:
 * https://github.com/GoogleCloudPlatform/nodejs-getting-started.git
 * 
 * It is, however, significantly modified
 * ****************************************************************/

'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const model = require('./model-datastore');
const util = require('./utility');
const router = express.Router();
const request = require('request');
const USER = "user";

// Automatically parse request body as JSON
router.use(bodyParser.json());

const clientID = "7X75UqLWuyXPsGeAlBGALobgDjkDZKzN";
const clientSecret = "j1SWOIQ_htfRxpslyM-piNozqmBPPVFChnIkCB9Hr8U3RzXySPQ6NXjo6DtKW9PO";

/*******************************************************************
 * Login endpoint
 * http://classes.engr.oregonstate.edu/eecs/perpetual/cs493-400/modules/7-more-security/3-node-authorization/
 * ****************************************************************/

router.post('/login', function(req, res){
    const username = req.body.username;
    const password = req.body.password;
    var options = { method: 'POST',
    url: 'https://moonru-authentication.auth0.com/oauth/token',
    headers: { 'content-type': 'application/json' },
    body:
     { grant_type: 'password',
       username: username,
       password: password,
       client_id: clientID,
       client_secret: clientSecret },
    json: true };
    request(options, (error, response, body) => {
        if (error){
            res.status(500).send(error);
        } else {
            res.send(body);
        }
    });
  
  });
  
  /*******************************************************************
   * Sign-up endpoint (creates a user entity on Auth0 and in api database)
   * http://classes.engr.oregonstate.edu/eecs/perpetual/cs493-400/modules/7-more-security/3-node-authorization/
   * ****************************************************************/
  
  router.post('/', function(req, res){
    const email = req.body.email;
    const password = req.body.password;
    var options = { method: 'POST',
    url: 'https://moonru-authentication.auth0.com/dbconnections/signup',
    headers: { 'content-type': 'application/json' },
    body:
     { 
        client_id: clientID,
        email: email,
        password: password,
        connection: "Username-Password-Authentication"
      },
      json: true };
    request(options, (error, response, body) => {
        if (error){
            res.status(500).send(error);
        } else {
            //create user entity
            var userEntity = {};
            userEntity.username = body.email;
            userEntity.auth0ID = body._id;
            model.create(userEntity, USER, (err, entity) => {
                if (err) {
                  next(err);
                  return;
                }
                //user entity created
                res.status(201).send(entity);
              });
            
        }
    });
  
  });



/*******************************************************************
 * user endpoints
 * 
 * ****************************************************************/

/************************************
 * GET /users
 *
 * Retrieve a list of all users.
 ***********************************/

router.get('/', (req, res, next) => {

  model.list(USER).then( entities => {

    res.json(entities[0]);

  }).catch( error => {
    next(error);
    return;
  });
});


/************************************
 * GET /user/:id
 *
 * Retrieve a single user by id.
 ***********************************/
router.get('/:id', (req, res, next) => {
  model.readPromise(req.params.id, USER)
    .then( entity => {
      if(entity){ // if entity is in db
        //add live link to user
        util.addLiveLinks(req, [entity], "self")
        /* * Respond * */
        util.respondCheck406(req, res, entity);
      }
      else //entity was not in db to begin with
        res.status(404).send("Entity not found.");
  });
});



/************************************
 * DELETE /users/:id
 *
 * Delete a user.
 ***********************************/
router.delete('/:id', (req, res, next) => {
        model.delete(req.params.id, USER, (err, apiResp) => {
          if (err) {
            next(err);
            return;
          }
          res.status(204).end();
        });
    });



//delete all users (just for testing)
router.delete('/delete/all', (req, res) => {
  let kind = USER;
  model.listDelete(kind).then( entities => {
    entities.forEach( item =>{
      model.delete(item.id, kind, (err, apiResp) => {
        if (err) {
          next(err);
          return;
        }
        //deletion occurs
      });
    });
    res.status(204).end();
  }).catch( error => {
    next(error);
    return;
  });
});




/************************************
 * Errors on "/api/books/*" routes.
 ***********************************/
router.use((err, req, res, next) => {
  // Format error and forward to generic error handler for logging and
  // responding to the request
  err.response = {
    message: err.message,
    internalCode: err.code,
  };
  next(err);
});

module.exports = router;
