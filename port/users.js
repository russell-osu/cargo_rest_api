
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
   * Sign-up endpoint
   * http://classes.engr.oregonstate.edu/eecs/perpetual/cs493-400/modules/7-more-security/3-node-authorization/
   * ****************************************************************/
  
  router.post('/signup', function(req, res){
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
              });
            res.send(body);
        }
    });
  
  });



/*******************************************************************
 * user endpoints
 * 
 * ****************************************************************/

/**
 * GET /users
 *
 * Retrieve a list of all users.
 */

router.get('/', (req, res, next) => {

  model.list(USER).then( entities => {

    res.json(entities[0]);

  }).catch( error => {
    next(error);
    return;
  });
});


/**
 * GET /cargo/:id
 *
 * Retrieve a single cargo by id.
 */
router.get('/:id', (req, res, next) => {
  model.readPromise(req.params.id, CARGO)
    .then( entity => {
      if(entity){ // if entity is in db
        //add live to cargo
        util.addLiveLinks(req, [entity], "self")
        //add link to carrier
        if(entity.carrier.hasOwnProperty("id"))
            util.addLiveLinks(req, [entity.carrier], "self", null, "/boats");
        
        /* * Respond * */
        util.respondCheck406(req, res, entity);
      }
      else //entity was not in db to begin with
        res.status(404).send("Entity not found.");
  });
});


/**
 * POST /cargo
 *
 * Create a new cargo.
 */

router.post('/', (req, res, next) => {
  var bodyModel = {weight: 999, carrier: {}, content: "string", delivery_date: "string"};
  if(util.validateReqBody(req.body, bodyModel)) {//if body is well-formed

    model.create(req.body, CARGO, (err, entity) => {
        if (err) {
        next(err);
        return;
        }
        util.addLiveLinks(req, [entity], "self")
        res.status(201).json(entity);
        });

  }else {//if body is not well-formed
    res.status(400).send("Request body is not well-formed. Use: " + JSON.stringify(bodyModel));
  }
});





/**
 * PUT /cargo/:id
 *
 * Update a cargo.
 */
router.put('/:id', (req, res, next) => {
    var bodyModel = {weight: 999, carrier: {}, content: "string", delivery_date: "string"};
    if(util.validateReqBody(req.body, bodyModel)) {//if body is well-formed

        model.update(req.params.id,req.body, CARGO, (err, entity) => {
        if (err) {
            next(err);
            return;
        }
        /* * Respond * */
        util.respond303(req, res, "/cargo/" + req.params.id);
        });

    }else {//if body is not well-formed
        res.status(400).send("Request body is not well-formed. Use: " + JSON.stringify(bodyModel));
    }
});


/**
 * DELETE /users/:id
 *
 * Delete a user.
 */
router.delete('/:id', (req, res, next) => {
        model.delete(req.params.id, USER, (err, apiResp) => {
          if (err) {
            next(err);
            return;
          }
          res.status(204).end();
        });
    });



//can't delete all cargo
router.delete('/', function(req, res){
  res.set("Allow", "GET, POST");
  res.status(405).end();
});



//delete all cargo (just for testing)
router.delete('/delete-all', function(req, res){
  let kind = CARGO;
  model.list(kind).then( entities => {
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




/**
 * Errors on "/api/books/*" routes.
 */
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
