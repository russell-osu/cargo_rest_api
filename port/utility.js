'use strict';

const model = require('./model-datastore');

const {Datastore} = require('@google-cloud/datastore');
const ds = new Datastore();
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');


//check the JSON Web Token
//http://classes.engr.oregonstate.edu/eecs/perpetual/cs493-400/modules/7-more-security/3-node-authorization/
const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://moonru-authentication.auth0.com/.well-known/jwks.json`
  }),

  // Validate the audience and the issuer.
  issuer: `https://moonru-authentication.auth0.com/`,
  algorithms: ['RS256']
});

//return entity id when passed a unique property identifier (like boat name or slip num)
const getID = (kind, propKey, propVal) => new Promise((resolve) => {
    var id = null;
    if(propVal){
      model.list(kind)
      .then(entities => {
        //search through entity list and find id of unique identifier
        for(var i = 0; i < entities.length; i++){
          if(entities[i][propKey] === propVal){
            id = entities[i]["id"];
          }
        }
        resolve(id);
      });
    }
    else
      resolve(id);
  });
  

  function validateReqBody(body, model){
  var isValid = true;
  //make sure req body has same number of properties as model
  if(Object.keys(body).length !== Object.keys(model).length)
    isValid = false;
  
  //make sure req body properties appear in model
  var modelProps = Object.keys(model);
  for(var bodyProp in body){
    if(!modelProps.includes(bodyProp))
      isValid = false;
  }
  
  return isValid;
  }
  


  //add live links to entities (id is option and only used if link is to
  //different entity)
  function addLiveLinks(req, entities, prop, id = null, path = null){
    
    //construct pre-id portion of url contingent on whether a path was sent
    if(path){
        var urlPrefix = req.protocol + '://' + req.get('host') + path;
    }else
        var urlPrefix = req.protocol + '://' + req.get('host') + req.baseUrl;
    //if id not sent, use element's id for live link
    entities.forEach(el=>{
        el[prop]= urlPrefix + "/" + (id ? id : el["id"]); 
    });
    return entities;
  
  }

  //add cursor link to entity list if it pagination required
  //add item count feature to this function
  function addCursorLink(req, entities, cursor, count, path=null){
    
    const results = {};
    results.items = entities;
    //add item count (if included in arguments)
    if(count >= 0) {results.total_items = count;}

    //construct pre-id portion of url contingent on whether a path was sent
    if(path){
        var urlPrefix = req.protocol + '://' + req.get('host') + path;
    }else
        var urlPrefix = req.protocol + '://' + req.get('host') + req.baseUrl;
    
    if(cursor.moreResults !== ds.NO_MORE_RESULTS){
        results.next = urlPrefix + "?cursor=" + cursor.endCursor;
    }
    return results;
  }


  //check for duplicate property value
function isUnique(id, req, kind, uniqueProp){

    return model.list(kind, req).then(entities =>{
   
      var isUnique = true;
      //check entities for duplicate boat name or slip number
      for (var i = 0; i<entities[0].length; i++)
      {
        //only run if entity being checked is not entity being updated
        if(id !== entities[0][i]["id"])
        {
            if (req.body[uniqueProp] === entities[0][i][uniqueProp])
              isUnique = false;
        }
      }
      return isUnique;
  
    }).catch( error => {
      return error;
    });
  }
  

  //if cargo is already assigned to boat, return true
  const cargoCheck = cargo => new Promise((resolve) => {
    if (cargo){
      model.list("boat")
  
      .then(boats => {
        
        var cargoAssigned = false;
        //search through all boats and if cargo is found, return true
        for(var i = 0; i < boats[0].length; i++){
            //search through cargo on each boat
            boats[0][i]["cargo"].forEach(item => {
                if (item["id"] === cargo["id"])
                    cargoAssigned = true;
            });
            if (cargoAssigned)
                break;
        }
        resolve(cargoAssigned);
      });
    }
    else    
        resolve(false);
  });
  

//remove cargo from boat (either on cargo remove action
// or cargo delete action)
async function removeCargo(cargoID, boat=null){
    //find index of cargo item in boat's cargo array

    var cargoIndex = -1;
    if (boat){//if boat is known (cargo definitely on boat)

        boat.cargo.forEach( (item, index) => {
            if (item.id === cargoID)
                cargoIndex = index;
        })

        //remove cargo from array
        boat.cargo.splice(cargoIndex, 1);

    }else{// if boat is not known

        //search through all boats for cargo and remove it
        //if found in boat
        let boats = await model.list("boat");
        for(var i = 0; i < boats[0].length; i++){
            //search through cargo on each boat
            boats[0][i]["cargo"].forEach( (item, index) => {
                //console.log("item id: " + item.id);
                if (item.id === cargoID)
                    cargoIndex = index;
            });

            if (cargoIndex !== -1){ //if cargo found in boat
                //remove item from boat's cargo
                boats[0][i]["cargo"].splice(cargoIndex, 1);
                //update boat entity
                var test = await model.update(boats[0][i]["id"], boats[0][i], "boat", (err, entity) => {});
                break;
            }
        }   

    }

}


//remove all carrier info from any cargo stored in boat
async function removeCarrierInfoBoat(boat) {
    if(boat){
        //iterate through boat's cargo array, find the id of each
        //piece of cargo and then remove the carrier info
        boat.cargo.forEach( async (item) => {
            //return the cargo entity based on id
            var cargo = await model.readPromise(item.id, "cargo");
            //remove the carrier info from the cargo
            removeCarrierInfoCargo(cargo);
        });
    }
}

//remove carrier info from a single piece of cargo
async function removeCarrierInfoCargo(cargo){
  if(cargo !== undefined){
    delete cargo.carrier.name;
    delete cargo.carrier.id;
    delete cargo.carrier.owner;
    await model.update(cargo.id, cargo, "cargo", (err, entity) => {});
  }
}

//add carrier info to a piece of cargo (used when adding cargo to boat)
async function addCarrierInfo(cargo, boat){
    cargo.carrier.id = boat.id;
    cargo.carrier.name = boat.name;
    cargo.carrier.owner = boat.owner;
    await model.update(cargo.id, cargo, "cargo", (err, entity) => {});
}


//check for 406 status, otherwise, return retrieved data to client
function respondCheck406(req, res, data){
  //reject request if application/json not in accept header
  const accepts = req.accepts(["application/json"]);
  if(!accepts)
    res.status(406).send("Not Acceptable");
  else if(accepts === "application/json")
    res.json(data);
}

//return 303 and location of resource in header
function respond303(req, res, path){
  var host = req.protocol + '://' + req.get('host');
  var locLink = host + path;
  res.set('Location', locLink);
  res.status(303).end();
}

//checks to ensure that user name from JWT matches one of the usernames in 
//the db user records
async function isAuthenticatedUser(req){

  var entities = await model.list("user");
  var users = entities[0];
  var userFound = false;
  var JWTUser = req.user.name;
  //console.log("JWTUser: " + JWTUser);
  //iterate through users from database and look for JWTUser
  users.forEach(user => {
    //console.log("dbUsername: " + user.username);
    if(user.username === JWTUser)
      userFound = true;
  });
  //console.log("userFound: " + userFound);
  return userFound;
}

//checks to ensure that user name from JWT is authorized to access the
//specified resource
async function isAuthorizedUser(req, id, kind){

  var entity = await model.readPromise(id, kind);
  var authorized = false;
  var JWTUser = req.user.name;
  if(entity.owner === JWTUser) {authorized = true;}

  return authorized;
}
  

  // [START exports]
module.exports = {
    getID,
    validateReqBody,
    addLiveLinks, 
    isUnique,
    cargoCheck, 
    addCursorLink, 
    removeCargo,
    removeCarrierInfoBoat,
    removeCarrierInfoCargo,
    addCarrierInfo,
    respondCheck406,
    respond303,
    checkJwt,
    isAuthenticatedUser,
    isAuthorizedUser
  };
  // [END exports]