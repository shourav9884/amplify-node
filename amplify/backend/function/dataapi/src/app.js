/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_DATATABLE_ARN
	STORAGE_DATATABLE_NAME
	STORAGE_DATATABLE_STREAMARN
	STORAGE_RESPONSETABLE_ARN
	STORAGE_RESPONSETABLE_NAME
	STORAGE_RESPONSETABLE_STREAMARN
	STORAGE_USERTABLE_ARN
	STORAGE_USERTABLE_NAME
	STORAGE_USERTABLE_STREAMARN
Amplify Params - DO NOT EDIT *//*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/
const { v4: uuidv4 } = require('uuid');


const AWS = require('aws-sdk')
var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
var bodyParser = require('body-parser')
var express = require('express')

AWS.config.update({ region: process.env.TABLE_REGION });

const dynamodb = new AWS.DynamoDB.DocumentClient();

let tableName = "DataTable";
let userTableName = "UserTable";
let responseTableName = "ResponseTable";
if(process.env.ENV && process.env.ENV !== "NONE") {
  tableName = tableName + '-' + process.env.ENV;
  userTableName = userTableName + '-' + process.env.ENV;
  responseTableName = responseTableName + '-' + process.env.ENV;
}

const userIdPresent = false; // TODO: update in case is required to use that definition
const partitionKeyName = "email";
const partitionKeyType = "S";
const sortKeyName = "uuid";
const sortKeyType = "S";
const hasSortKey = sortKeyName !== "";
const path = "/data";
const UNAUTH = 'UNAUTH';
const hashKeyPath = '/:' + partitionKeyName;
const sortKeyPath = hasSortKey ? '/:' + sortKeyName : '';
// declare a new express app
var app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

// Enable CORS for all methods
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "*")
  next()
});

// convert url string param to expected Type
const convertUrlType = (param, type) => {
  switch(type) {
    case "N":
      return Number.parseInt(param);
    default:
      return param;
  }
}

/********************************
 * HTTP Get method for list objects *
 ********************************/

app.get(path + hashKeyPath, function(req, res) {
  var condition = {}
  condition[partitionKeyName] = {
    ComparisonOperator: 'EQ'
  }

  if (userIdPresent && req.apiGateway) {
    condition[partitionKeyName]['AttributeValueList'] = [req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH ];
  } else {
    try {
      condition[partitionKeyName]['AttributeValueList'] = [ convertUrlType(req.params[partitionKeyName], partitionKeyType) ];
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }

  let queryParams = {
    TableName: tableName,
    KeyConditions: condition
  }

  dynamodb.query(queryParams, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.json({error: 'Could not load items: ' + err});
    } else {
      res.json(data.Items);
    }
  });
});

/*****************************************
 * HTTP Get method for get single object *
 *****************************************/

app.get(path + '/object' + hashKeyPath + sortKeyPath, function(req, res) {
  var params = {};
  if (userIdPresent && req.apiGateway) {
    params[partitionKeyName] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  } else {
    params[partitionKeyName] = req.params[partitionKeyName];
    try {
      params[partitionKeyName] = convertUrlType(req.params[partitionKeyName], partitionKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }
  if (hasSortKey) {
    try {
      params[sortKeyName] = convertUrlType(req.params[sortKeyName], sortKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }

  let getItemParams = {
    TableName: tableName,
    Key: params
  }

  dynamodb.get(getItemParams,(err, data) => {
    if(err) {
      res.statusCode = 500;
      res.json({error: 'Could not load items: ' + err.message});
    } else {
      if (data.Item) {
        res.json(data.Item);
      } else {
        res.json(data) ;
      }
    }
  });
});


/************************************
* HTTP post method for insert object *
*************************************/

app.post(path, function(req, res) {

  // if (userIdPresent) {
  //   req.body['userId'] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  // }
  req.body['uuid'] = uuidv4()
  let putItemParams = {
    TableName: tableName,
    Item: req.body
  }
  dynamodb.put(putItemParams, (err, data) => {
    if(err) {
      res.statusCode = 500;
      res.json({error: err, url: req.url, body: req.body});
    } else{
      res.json({success: 'post call succeed!', url: req.url, data: data})
    }
  });
});

app.post(path + hashKeyPath + '/search/by-user', function(req, res) {
  let searchParms = req.body;
  var expressionKeyParams = {"#email": "email"}
  var expressionAttributeValues = {":email": req.params.email }
  var filterExpression = []
  var equalFilterKeys = ['id_receiver', 'type_voucher', 'issuer_id', 'voucher_mumber', 'voucher_series', 'type_receiver']
  for(var i=0;i<equalFilterKeys.length;i++) {
    if(req.body.hasOwnProperty(equalFilterKeys[i])) {
      filterExpression.push("#"+equalFilterKeys[i]+"=:"+equalFilterKeys[i])
      expressionKeyParams["#"+equalFilterKeys[i]] = equalFilterKeys[i]
      expressionAttributeValues[":"+equalFilterKeys[i]] = req.body[equalFilterKeys[i]]
    }
  }
  var filterExpressionStr = filterExpression.join(" and ")
  var params = {
    TableName: tableName,
    KeyConditionExpression: "#email = :email",
    ExpressionAttributeNames: expressionKeyParams,
    ExpressionAttributeValues: expressionAttributeValues
  }

  
  if(filterExpression.length > 0) {
    params['FilterExpression'] = filterExpressionStr
  }
  console.log(params)

  var paramsUserSearch = {
    TableName: userTableName,
    KeyConditionExpression: "#email = :email",
    ExpressionAttributeNames:{
        "#email": "email"
    },
    ExpressionAttributeValues: {
        ":email": req.params.email
    }
  }
  dynamodb.query(paramsUserSearch, function(err, data) {
    if (err) {
        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
        res.status(500).send(err)
    } else {
        console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
        if(data['Items'].length == 0) {
          res.status(404).send({"msg": "User not found"})
        } else {
          var user = data['Items'][0]
          // TODO: check user queries count
          if(user['queries'] <= 0) {
            res.status(412).send({msg: "You cannot search. You donot have have enough queries"})
          } else {
            user['queries'] -= 1
            var paramsToUpdate = {
              TableName: userTableName,
              Key:{
                "email": user['email'],
                "date": user['date']
              },
              UpdateExpression: "set queries=:queries",
              ExpressionAttributeValues:{
                  ":queries": user['queries']
              },
              ReturnValues:"UPDATED_NEW"
            }
            dynamodb.update(paramsToUpdate, function(err, data) {
              if (err) {
                  console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
                  response.status(500).send(err);
              } else {
                  console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
                  dynamodb.query(params, function(err, searchResult) {
                    if(err) {
                      res.status(500).send(err)
                    } else {
                      var responseParams = {
                        TableName: responseTableName,
                        Item: {
                          "email": req.params.email,
                          "uuid": uuidv4(),
                          "request_body": req.body,
                          "response": searchResult,
                        }
                      }
                      dynamodb.put(responseParams, function(err, data) {
                         if (err) {
                             console.error("Error JSON:", JSON.stringify(err, null, 2));
                             res.send(err)
                         } else {
                             res.send(searchResult['Items'])
                         }
                      });
                      
                    }
                  })
              }
            });
          }

          
          
          
        }
    }
  });

})

/**************************************
* HTTP remove method to delete object *
***************************************/

app.delete(path + '/object' + hashKeyPath + sortKeyPath, function(req, res) {
  var params = {};
  if (userIdPresent && req.apiGateway) {
    params[partitionKeyName] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  } else {
    params[partitionKeyName] = req.params[partitionKeyName];
     try {
      params[partitionKeyName] = convertUrlType(req.params[partitionKeyName], partitionKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }
  if (hasSortKey) {
    try {
      params[sortKeyName] = convertUrlType(req.params[sortKeyName], sortKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }

  let removeItemParams = {
    TableName: tableName,
    Key: params
  }
  dynamodb.delete(removeItemParams, (err, data)=> {
    if(err) {
      res.statusCode = 500;
      res.json({error: err, url: req.url});
    } else {
      res.json({url: req.url, data: data});
    }
  });
});
app.listen(3000, function() {
    console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
