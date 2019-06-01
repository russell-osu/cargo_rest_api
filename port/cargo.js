
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
const CARGO = "cargo";

// Automatically parse request body as JSON
router.use(bodyParser.json());



/*******************************************************************
 * cargo endpoints
 * 
 * ****************************************************************/

/************************************
 * GET /cargo
 *
 * Retrieve a list of all cargo.
 ***********************************/

router.get('/', util.checkJwt, async (req, res, next) => {
  //ensure user is in db (is authenticated to access site)
  var authenticated = await util.isAuthenticatedUser(req);
  if(!authenticated){
    res.status(401).end();
    return;
  }

  model.list(CARGO, req, 5).then( entities => {

    //add link to cargo
    util.addLiveLinks(req, entities[0], "self")
    //add link to carriers
    entities[0].forEach( item => {
        if(item.carrier.hasOwnProperty("id"))
            util.addLiveLinks(req, [item.carrier], "self", null, "/boats");
    });
    //add cursor link
    const results = util.addCursorLink(req, entities[0], entities[1], entities[2], null);

    /* * Respond * */
    util.respondCheck406(req, res, results);

  }).catch( error => {
    next(error);
    return;
  });
});


/************************************
 * GET /cargo/:id
 *
 * Retrieve a single cargo by id.
 ***********************************/
router.get('/:id', util.checkJwt, async (req, res, next) => {
  //ensure user is in db (is authenticated to access site)
  var authenticated = await util.isAuthenticatedUser(req);
  if(!authenticated){
    res.status(401).end();
    return;
  }
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


/************************************
 * POST /cargo
 *
 * Create a new cargo.
 ***********************************/

router.post('/', util.checkJwt, async (req, res, next) => {
  //ensure user is in db (is authenticated to access site)
  var authenticated = await util.isAuthenticatedUser(req);
  if(!authenticated){
    res.status(401).end();
    return;
  }
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


/************************************
 * PUT /cargo/:id
 *
 * Update a cargo.
 ***********************************/
router.put('/:id', util.checkJwt, async (req, res, next) => {
    //ensure user is in db (is authenticated to access site)
    var authenticated = await util.isAuthenticatedUser(req);
    if(!authenticated){
      res.status(401).end();
      return;
    }
    var bodyModel = {weight: 999, carrier: {}, content: "string", delivery_date: "string"};
    if(util.validateReqBody(req.body, bodyModel)) {//if body is well-formed

        //check 404
        var exists = await model.readPromise(req.params.id, CARGO);
        if(!exists){
          res.status(404).send("Entity not found.");
          return;
        }

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


/************************************
 * DELETE /cargo/:id
 *
 * Delete a cargo.
 ***********************************/
router.delete('/:id', util.checkJwt, async (req, res, next) => {
  //ensure user is in db (is authenticated to access site)
  var authenticated = await util.isAuthenticatedUser(req);
  if(!authenticated){
    res.status(401).end();
    return;
  }
  //first, retrieve cargo entity to check if it exists at all
  model.readPromise(req.params.id, CARGO)
    .then(cargo =>{

        //if cargo has carrier, make sure caller is owner of carrier; if not, send 403
        if(cargo.carrier.hasOwnProperty("owner")){
          if(cargo.carrier.owner !== req.user.name){
            res.status(403).end();
            return;
          }
        }
      
        model.delete(req.params.id, CARGO, (err, apiResp) => {
          if (err) {
            next(err);
            return;
          }

          if(cargo){ // if cargo is in db
            util.removeCargo(req.params.id); //remove cargo from boat (if assigned)
            res.status(204).end();
          }
          else //cargo was not in db to begin with
            res.status(404).send("Cargo not found.");
        });
      });
    });
// });


//can't delete all cargo
router.delete('/', util.checkJwt, async function(req, res){
  //ensure user is in db (is authenticated to access site)
  var authenticated = await util.isAuthenticatedUser(req);
  if(!authenticated){
    res.status(401).end();
    return;
  }
  res.set("Allow", "GET, POST");
  res.status(405).end();
});



//delete all cargo (just for testing)
router.delete('/delete/all', (req, res) => {
  let kind = CARGO;
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
