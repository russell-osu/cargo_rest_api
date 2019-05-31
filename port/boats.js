
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
const BOAT = "boat";
const CARGO = "cargo";

// Automatically parse request body as JSON
router.use(bodyParser.json());

/*******************************************************************
 * Boat endpoints
 * 
 * ****************************************************************/

/**
 * GET /boats
 *
 * Retrieve a list of all boats.
 */


router.get('/', util.checkJwt, async (req, res, next) => {

  //ensure user is in db (is authenticated to access site)
  var authenticated = await util.isAuthenticatedUser(req);
  if(!authenticated){
    res.status(401).end();
    return;
  }
  //if user is authenticated
  model.list(BOAT, req, 5).then( entities => { //get slips

    //add live links for links for boat
    util.addLiveLinks(req, entities[0], "self")
    //add live links for cargo
    entities[0].forEach( item => {
      item.cargo.forEach( cargoItem => {
        util.addLiveLinks(req, [cargoItem], "self", null, "/cargo");
      });
    });
    
    /* * Add cursor link * */
    const results = util.addCursorLink(req, entities[0], entities[1], entities[2], null);

    /* * Respond * */
    util.respondCheck406(req, res, results);

  }).catch( error => {
    next(error);
    return;
    });


});



/**
 * GET /boats/:id
 *
 * Retrieve a single boat by id.
 */
router.get('/:id', util.checkJwt, async (req, res, next) => {
  //ensure user is in db (is authenticated to access site)
  var authenticated = await util.isAuthenticatedUser(req);
  if(!authenticated){
    res.status(401).end();
    return;
  }

  model.readPromise(req.params.id, BOAT)
    .then( entity => {
      if(entity){ // if entity is in db
        //add live link
        util.addLiveLinks(req, [entity], "self")
        //add live links to cargo
        entity.cargo.forEach( cargoItem => {
          util.addLiveLinks(req, [cargoItem], "self", null, "/cargo");
        });

        /* * Respond * */
        util.respondCheck406(req, res, entity);

      }
      else //entity was not in db to begin with
        res.status(404).send("Entity not found.");
  });
});


/**
 * GET /boats/{boat_id}/cargo
 *
 * Retrieve a list of all cargo on a given boat
 */

router.get('/:id/cargo', util.checkJwt, async (req, res, next) => {
  //ensure user is in db (is authenticated to access site)
  var authenticated = await util.isAuthenticatedUser(req);
  if(!authenticated){
    res.status(401).end();
    return;
  }

  //check 404
  var exists = await model.readPromise(req.params.id, BOAT);
  if(!exists){
    res.status(404).send("Entity not found.");
    return;
  }

  model.list(CARGO, req, 5, "carrier.id", "=", req.params.id).then( entities => {

    //add link to cargo
    util.addLiveLinks(req, entities[0], "self")
    //add link to carriers
    entities[0].forEach( item => {
        if(item.carrier.hasOwnProperty("id"))
            util.addLiveLinks(req, [item.carrier], "self", null, "/boats");
    });
    /* * Add cursor link * */
    const results = util.addCursorLink(req, entities[0], entities[1], entities[2], "/cargo");

    /* * Respond * */
    util.respondCheck406(req, res, results);

  }).catch( error => {
    next(error);
    return;
  });
});



/**
 * POST /boats
 *
 * Create a new boat.
 */
router.post('/', util.checkJwt, async (req, res, next) => {
  //ensure user is in db (is authenticated to access site)
  var authenticated = await util.isAuthenticatedUser(req);
  if(!authenticated){
    res.status(401).end();
    return;
  }
  var bodyModel = {name: "string", type: "string", length: 999, cargo: []};
  if(util.validateReqBody(req.body, bodyModel)) {//if body is well-formed
    util.isUnique(null, req, BOAT, "name").then(isUnique=>{
      if(isUnique){
        //associate username (owner) with boat
        req.body.owner = req.user.name;
        model.create(req.body, BOAT, (err, entity) => {
          if (err) {
            next(err);
            return;
          }
          util.addLiveLinks(req, [entity], "self")
          res.status(201).json(entity);
        });
      }else
        res.status(409).send("You must use a unique boat name.");
    }).catch( error => {
      next(error);
      return;
    });
  }else {//if body is not well-formed
    res.status(400).send("Request body is not well-formed. Use: " + JSON.stringify(bodyModel));
  }
});


//just for Postman testing purposes
router.post('/rapidCreate', (req, res, next) => {
  var bodyModel = {name: "string", type: "string", length: 999, cargo: []};
  if(util.validateReqBody(req.body, bodyModel)) {//if body is well-formed
    util.isUnique(null, req, BOAT, "name").then(isUnique=>{
      //if(isUnique){
        model.create(req.body, BOAT, (err, entity) => {
          if (err) {
            next(err);
            return;
          }
          //util.addLiveLinks(req, [entity], "self")
          res.status(201).json(entity);
        });
      // }else
      //   res.status(409).send("You must use a unique boat name.");
    }).catch( error => {
      next(error);
      return;
    });
  }else {//if body is not well-formed
    res.status(400).send("Request body is not well-formed. Use: " + JSON.stringify(bodyModel));
  }
});




/**
 * PUT /boats/:id
 *
 * Update a boat.
 */
router.put('/:id', util.checkJwt, async (req, res, next) => {
  //ensure user is in db (is authenticated to access site)
  var authenticated = await util.isAuthenticatedUser(req);
  if(!authenticated){
    res.status(401).end();
    return;
  }
  var bodyModel = {name: "string", type: "string", length: 999, cargo: []};
  if(util.validateReqBody(req.body, bodyModel)) {//if body is well-formed
    let uniqueProp = "name";
    util.isUnique(req.params.id, req, BOAT, uniqueProp).then(async (isUnique)=>{
      if(isUnique){

        //check 404
        var exists = await model.readPromise(req.params.id, BOAT);
        if(!exists){
          res.status(404).send("Entity not found.");
          return;
        }

        //check 403--is user authorized to edit this resource?
        var authorized = await util.isAuthorizedUser(req, req.params.id, BOAT);
        if(!authorized){
          res.status(403).end();
          return;
        }

        model.update(req.params.id, req.body, BOAT, (err, entity) => {
          if (err) {
            next(err);
            return;
          }
          /* * Respond * */
          util.respond303(req, res, "/boats/" + req.params.id);
        });
      }else
        res.status(409).send("You must use a unique boat name.");
    }).catch( error => {
      next(error);
      return;
    });
  }else {//if body is not well-formed
    res.status(400).send("Request body is not well-formed. Use: " + JSON.stringify(bodyModel));
  }
});


/**
 * DELETE /boats/:id
 *
 * Delete a boat.
 */
router.delete('/:id', util.checkJwt, async (req, res, next) => {
    //ensure user is in db (is authenticated to access site)
    var authenticated = await util.isAuthenticatedUser(req);
    if(!authenticated){
      res.status(401).end();
      return;
    }
  //first, retrieve boat from db to ensure that it exists
  model.readPromise(req.params.id, BOAT)
    .then( async (boat) => {

      //check 403--is user authorized to edit this resource?
      var authorized = await util.isAuthorizedUser(req, req.params.id, BOAT);
      if(!authorized){
        res.status(403).end();
        return;
      }

      //remove carrier info from any cargo stored in boat
      await util.removeCarrierInfoBoat(boat);
      model.delete(req.params.id, BOAT, err => {
        if (err) {
          next(err);
          return;
        }
        if(boat) // if boat is in db   

          res.status(204).end();

        else //boat was not in db to begin with
          res.status(404).send("Boat not found.");
      });
    });    
});

//can't delete all boats
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


//delete all boats (just for testing)
router.delete('/delete/all', (req, res) => {
  let kind = BOAT;
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

/*******************************************************************
 * Loading cargo endpoints
 * 
 * ****************************************************************/

 /**
 * PUT boats/:boat_id/cargo/:cargo_id
 *
 * Add cargo to a boat.
 */
router.put('/:boat_id/cargo/:cargo_id', util.checkJwt, async (req, res, next) => {
      //ensure user is in db (is authenticated to access site)
      var authenticated = await util.isAuthenticatedUser(req);
      if(!authenticated){
        res.status(401).end();
        return;
      }
      //check 403--is user authorized to edit this resource?
      var authorized = await util.isAuthorizedUser(req, req.params.boat_id, BOAT);
      if(!authorized){
        res.status(403).end();
        return;
      }
    model.readPromise(req.params.boat_id, BOAT) //get boat

    .then(boatEntity=>{ 
      
      model.readPromise(req.params.cargo_id, CARGO) //get cargo

      .then(cargoEntity => {

        //check if cargo is already in another boat. If so, throw 403.
        util.cargoCheck(cargoEntity)

        .then( (cargoAssigned)=>{
          if(!boatEntity || !cargoEntity) //if boat or cargo don't exist
            res.status(404).send("Boat or cargo not found.");
          else if(cargoAssigned) //if cargo already assigned
            res.status(400).send("Cargo is already assigned.");
          else{ //boat and cargo exist and cargo is not assigned
            //add cargo to boat
            boatEntity["cargo"].push({"id":cargoEntity.id});
            //add carrier info to cargo 
            util.addCarrierInfo(cargoEntity, boatEntity);
            //update boat entity
            model.update(boatEntity["id"], boatEntity, BOAT, (err, entity) => {
              if (err) {
                next(err);
                return;
              }
              util.respond303(req, res, "/cargo/"+req.params.cargo_id);
              //res.json(entity);
            });
          }
        })
    })
      .catch( error => {
          next(error);
          return;
        });
    });

});


 /**
 * DELETE boats/:boat_id/cargo/:cargo_id
 *
 * Remove cargo from a boat.
 */
router.delete('/:boat_id/cargo/:cargo_id', util.checkJwt, async (req, res, next) => {
  //ensure user is in db (is authenticated to access site)
  var authenticated = await util.isAuthenticatedUser(req);
  if(!authenticated){
    res.status(401).end();
    return;
  }
  //check 403--is user authorized to edit this resource?
  var authorized = await util.isAuthorizedUser(req, req.params.boat_id, BOAT);
  if(!authorized){
    res.status(403).end();
    return;
  }
  model.readPromise(req.params.boat_id, BOAT) //get boat

  .then(boatEntity=>{ 
    
    model.readPromise(req.params.cargo_id, CARGO) //get cargo

    .then(cargoEntity => {

        if(!boatEntity || !cargoEntity) //if boat or cargo don't exist
          res.status(404).send("Boat or cargo not found.");

        //check if cargo is actually in boat
        var cargoAssigned = false;
        boatEntity["cargo"].forEach(item => {
          if (item["id"] === cargoEntity["id"])
              cargoAssigned = true;
        });
        
       if(!cargoAssigned) //if cargo is not in boat
          res.status(400).send("Cargo is not in boat.");
        else{ //boat and cargo exist and cargo is not assigned
          //remove carrier info from cargo
          (async () => {await util.removeCarrierInfoCargo(cargoEntity);})();
          //remove cargo from boat and update boat
          util.removeCargo(cargoEntity["id"], boatEntity);
          model.update(boatEntity["id"], boatEntity, BOAT, (err, entity) => {
            if (err) {
              next(err);
              return;
            }
            res.status(204).end();
            //res.json(entity);
          });
        }

  })
    .catch( error => {
        next(error);
        return;
      });
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
