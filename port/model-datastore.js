
/*******************************************************************
 * This code is based on the code found in the GCP repository:
 * https://github.com/GoogleCloudPlatform/nodejs-getting-started.git
 * 
 * It is, however, significantly modified
 * ****************************************************************/

'use strict';

const {Datastore} = require('@google-cloud/datastore');

// [START config]
const ds = new Datastore();
// [END config]

// Translates from Datastore's entity format to
// the format expected by the application.
//
// Datastore format:
//   {
//     key: [kind, id],
//     data: {
//       property: value
//     }
//   }
//
// Application format:
//   {
//     id: id,
//     property: value
//   }
function fromDatastore(obj) {
  obj.id = obj[Datastore.KEY].id;
  return obj;
}

// Translates from the application's format to the datastore's
// extended entity property format. It also handles marking any
// specified properties as non-indexed. Does not translate the key.
//
// Application format:
//   {
//     id: id,
//     property: value,
//     unindexedProperty: value
//   }
//
// Datastore extended format:
//   [
//     {
//       name: property,
//       value: value
//     },
//     {
//       name: unindexedProperty,
//       value: value,
//       excludeFromIndexes: true
//     }
//   ]
function toDatastore(obj /*,nonIndexed*/) {
  //nonIndexed = nonIndexed || [];
  const results = [];
  Object.keys(obj).forEach(k => {
    if (obj[k] === undefined) {
      return;
    }
    results.push({
      name: k,
      value: obj[k]
      //excludeFromIndexes: nonIndexed.indexOf(k) !== -1,
    });
  });
  return results;
}



// Lists all entities in the Datastore
async function list(kind, req = null, limit = null, filterProp = null, 
  filterOp = null, filterVal = null) {
  var q = limit ? ds.createQuery([kind]).limit(limit) : ds.createQuery([kind]);
  
  //start at cursor if query includes cursor key
  if(req){
    if(Object.keys(req.query).includes("cursor")){
      q = q.start(req.query.cursor);
    }
  }

  //add filter if included in argument
  if(filterProp){
    q = q.filter(filterProp, filterOp, filterVal);
  }

  // //run count of entities query (doesn't update in real time)
  // var countQ = ds.createQuery("__Stat_Kind__").filter("kind_name", "=", kind);
  // var kindStats = await ds.runQuery(countQ);
  // kindStats.forEach(item => console.log("stat item: " + JSON.stringify(item)));
  // var kindCount = kindStats[0][0].count;
  // console.log("kind count: " + kindCount);

  //keys only query: finds count of entity kind
  var keysQuery = ds.createQuery([kind]).select('__key__').limit(10000);
  var entityKeys = await ds.runQuery(keysQuery);
  //console.log("entity Keys: " + JSON.stringify(entityKeys));
  //console.log("num entities: " + entityKeys[0].length);
  var numEntities = entityKeys[0].length;

  return ds.runQuery(q).then( entities => {
    //entities[0] contains the entities list
    //entities[1] contains cursor info
    //kindCount in the number of entities of kind in the db
    return [entities[0].map(fromDatastore), entities[1], numEntities];

  }).catch( error => {

    return error;

  });

}

//only used for all-entity delete operations
async function listDelete(kind, owner = null) {
  const q = ds.createQuery([kind]);
   var entities = await ds.runQuery(q);
   return entities[0].map(fromDatastore);

}


// Creates a new entity or updates an existing entity with new data. The provided
// data is automatically translated into Datastore format. The entity will be
// queued for background processing.
// [START update]
function update(id, data, kind, cb) {
  let key;
  if (id) {
    key = ds.key([kind, parseInt(id, 10)]);
  } else {
    key = ds.key(kind);
  }

  const entity = {
    key: key,
    data: toDatastore(data),
  };

  ds.save(entity, err => {
    data.id = entity.key.id;
    cb(err, err ? null : data, true);
  });
}



//calls update with id set to NULL
function create(data, kind, cb) {
  update(null, data, kind, cb);
}


//return entity from db
function read(id, kind, cb) {
  const key = ds.key([kind, parseInt(id, 10)]);
  ds.get(key, (err, entity) => {
    if (!err && !entity) {
      err = {
        code: 404,
        message: 'Not found',
      };
    }
    if (err) {
      cb(err);
      return;
    }
    cb(null, fromDatastore(entity));
  });
}


//return entity from db
function readPromise(id, kind) {
  const key = ds.key([kind, parseInt(id, 10)]);

  return ds.get(key).then( entity  => {

    if(entity[0])
      return fromDatastore(entity[0]);
    else //if entity not found
      return entity[0]; 
  });
}

//deletes entity
function _delete(id, kind, cb) {
  const key = ds.key([kind, parseInt(id, 10)]);
  ds.delete(key, cb);
}


// [START exports]
module.exports = {
  create,
  read,
  update,
  delete: _delete,
  list, 
  listDelete,
  readPromise
};
// [END exports]
