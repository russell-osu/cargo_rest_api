/***************************************************************** 
* Randomization Code
******************************************************************/

//rand string code from https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
function rndStr(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  
    for (var i = 0; i < length; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  
    return text;
  }
  
//courtesy of https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
  function rndInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
  }

//create randomized boatName, type and length
pm.environment.set("boatName", rndStr(10));
pm.environment.set("boatType", rndStr(10));
pm.environment.set("boatLength", rndInt(100));
var boatName = pm.environment.get("boatName");
var boatType = pm.environment.get("boatType");
var boatLength = pm.environment.get("boatLength");

//create randomized cargo weight, content and delivery date
pm.environment.set("cargoWeight", rndInt(1000)); 
pm.environment.set("cargoContent", rndStr(10));
var date = (rndInt(11) + 1) + "/" + (rndInt(28) + 1) + "/" + (rndInt(5) + 2019);
console.log("date: " + date);
pm.environment.set("cargoDate", date );
var cargoWeight = pm.environment.get("cargoWeight");
var cargoContent = pm.environment.get("cargoContent");
var cargoDate = pm.environment.get("cargoDate");

//boat get
/******************************************************************************/
var server = pm.environment.get("server");

const getRequest = {
url: server + "/boats",
method: "GET"
}

pm.sendRequest(getRequest, function(err, res){
    if(err){
        console.log(err);
    } else{
        var getData = res.json();
        
        //loop through get data and confirm that boat name only appears once
        var nameCount = 0;
        for (var i = 0; i < getData.items.length; i++ ) {
            if (getData.items[i]["name"] === pm.environment.get("boatName")){
                nameCount++;
            }
        }
        
        pm.test("Confirm that boat name only appears once", function(){
            pm.expect(nameCount).to.equal(1);
        });        


        
    }
});
/******************************************************************************/
//END boat get



//boat delete
/******************************************************************************/
//now delete created Boat for cleanup
const delRequest = {
    url: server + "/boats/" + boatID,
    method: "DELETE"
    }
    
    pm.sendRequest(delRequest, function(err, res){
        if(err){
            console.log(err);
        } else{
            console.log("Boat: " + boatID + " deleted.");
        }
    });
/******************************************************************************/
//END boat delete



//boat post
/******************************************************************************/
var server = pm.environment.get("server");

var requestBody = {
  "name": boatName,
  "type": boatType,
  "length": boatLength,
  "cargo": []
}

const postRequest = {
    url: server + "/boats",
    method: "POST",
    header: { 
            "content-type": "application/json"
    },
    body: {
        mode: "raw",
        raw: JSON.stringify(requestBody)
    }
}

//now we finally make the post request to creat a new boat
pm.sendRequest(postRequest, function(err, res){
    if(err){
        console.log(err);
    } else{
            data = res.json();
            pm.environment.set("boatID", data["id"]);
            console.log("id: " + data["id"]);
    }
});
/******************************************************************************/
//END boat post


//cargo get
/******************************************************************************/
var server = pm.environment.get("server");
const getRequest = {
url: server + "/cargo",
method: "GET"
};

pm.sendRequest(getRequest, function(err, res){
    if(err){
        console.log(err);
    } else{
        var getData = res.json();
        var currRecords = getData.items.length;
        pm.test("Confirm that cargo count increases by 1 on create", function(){
            pm.expect(currRecords).to.equal(pm.environment.get("prevRecords") + 1);
        });
        
        //loop through get data and confirm that new entity ID is in one of the returned entities
        var idFound = false;
        for (var i = 0; i < getData.items.length; i++ ) {
            //console.log("getData id: " + getData[i]["id"])
            if (getData.items[i]["id"] === cargoID){
                idFound = true;
                break;
            }
        }
        
        pm.test("Confirm that new cargo id is included in the second get request", function(){
            pm.expect(idFound).to.equal(true);
        });        

    

        
    }
});
/******************************************************************************/
//END cargo get



//cargo delete
/******************************************************************************/
var server = pm.environment.get("server");
var cargoID = pm.environment.get("cargoID");
const delRequest = {
    url: server + "/cargo/" + cargoID,
    method: "DELETE"
    };
    
    pm.sendRequest(delRequest, function(err, res){
        if(err){
            console.log(err);
        } else{
            console.log("Cargo: " + cargoID + " deleted.");
        }
    });
/******************************************************************************/
//END cargo delete



//cargo post
/******************************************************************************/
//create randomized cargo weight, content and delivery date
pm.environment.set("cargoWeight", rndInt(1000)); 
pm.environment.set("cargoContent", rndStr(10));
var date = (rndInt(11) + 1) + "/" + (rndInt(28) + 1) + "/" + (rndInt(5) + 2019);
console.log("date: " + date);
pm.environment.set("cargoDate", date );
var cargoWeight = pm.environment.get("cargoWeight");
var cargoContent = pm.environment.get("cargoContent");
var cargoDate = pm.environment.get("cargoDate");


var server = pm.environment.get("server");
var requestBody = {
  "weight": cargoWeight,
  "content": cargoContent,
  "delivery_date": cargoDate,
  "carrier": {}
};

const postRequest = {
    url: server + "/cargo",
    method: "POST",
    header: { 
            "content-type": "application/json"
    },
    body: {
        mode: "raw",
        raw: JSON.stringify(requestBody)
    }
};

//now we finally make the post request to creat a new slip
pm.sendRequest(postRequest, function(err, res){
    if(err){
        console.log(err);
    } else{
            data = res.json();
            pm.environment.set("cargoID", data["id"]);
            console.log("id: " + data["id"]);
    }
});
/******************************************************************************/
//END cargo post



//confirm code 201
var code = pm.response.code
pm.test("Confirm code 201 (created)", function(){
    pm.expect(code).to.equal(201);
});