/*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/



const AWS = require('aws-sdk')
var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
var bodyParser = require('body-parser')
var express = require('express')

AWS.config.update({ region: process.env.TABLE_REGION });

const dynamodb = new AWS.DynamoDB.DocumentClient();

let tableName = "PaymentTable";
if(process.env.ENV && process.env.ENV !== "NONE") {
  tableName = tableName + '-' + process.env.ENV;
}

const userIdPresent = false; // TODO: update in case is required to use that definition
const partitionKeyName = "email";
const partitionKeyType = "S";
const sortKeyName = "registration_date";
const sortKeyType = "S";
const hasSortKey = sortKeyName !== "";
const path = "/payment";
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

const updateUser = (user, response) => {
  var paramsToUpdate = {
    TableName: tableName,
    Key:{
      "email": user['email'],
      "registration_date": user['registration_date']
    },
    UpdateExpression: "set balance = :balance, user_name=:name, queries=:queries, active=:active, credit=:credit",
    ExpressionAttributeValues:{
        ":credit": user['credit'],
        ":balance": user['balance'],
        ":name": user['user_name'],
        ":active": user['active'],
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
        response.send({"msg": "Updated"})
    }
  });
}

/********************************
 * HTTP Get method for list objects *
 ********************************/

 app.get(path +'/:email/payment-fields', (req, res) => {
  var params = {
    TableName: tableName,
    KeyConditionExpression: "#email = :email",
    ExpressionAttributeNames:{
        "#email": "email"
    },
    ExpressionAttributeValues: {
        ":email": req.params.email
    }
  }
  dynamodb.query(params, function(err, data) {
    if (err) {
        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
        res.status(500).send(err)
    } else {
        console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
        if(data['Items'].length == 0) {
          res.status(404).send({"msg": "User not found"})
        } else {
          var body = {
            "credit": data['Items'][0]['credit'],
            "balance": data['Items'][0]['balance'],
            "queries": data['Items'][0]['queries'],
          }
          res.send(body)
        }
    }
  });
})

 app.put(path + '/:email/payment-fields/by-user', (req, res) => {

  var params = {
    TableName: tableName,
    KeyConditionExpression: "#email = :email",
    ExpressionAttributeNames:{
        "#email": "email"
    },
    ExpressionAttributeValues: {
        ":email": req.params.email
    }
  }
  dynamodb.query(params, function(err, data) {
    if (err) {
        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
        res.status(500).send(err)
    } else {
        console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
        if(data['Items'].length == 0) {
          res.status(404).send({"msg": "User Not Found"})
        } else {
          var user = data['Items'][0]
          if(user['queries'] == 0){
            res.status(412).send({"msg": "you cannot change your payment info"})
          } else {
            user['credit'] = req.body['credit']
            user['balance'] = req.body['balance']
            user['queries'] -= 1
            var result = updateUser(user, res)
            // console.log(result)
            // res.send({"msg": "Updated successfully"})
          }
          // else res.send({"msg": "Something went wrong"})
        }
    }
  });
})

app.put(path + '/:email/payment-fields/by-admin', (req, res) => {

  var params = {
    TableName: tableName,
    KeyConditionExpression: "#email = :email",
    ExpressionAttributeNames:{
        "#email": "email"
    },
    ExpressionAttributeValues: {
        ":email": req.params.email
    }
  }
  dynamodb.query(params, function(err, data) {
    if (err) {
        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
        res.status(500).send(err)
    } else {
        console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
        if(data['Items'].length == 0) {
          res.status(404).send({"msg": "User Not Found"})
        } else {
          var user = data['Items'][0]
          user['credit'] = req.body['credit']
          user['balance'] = req.body['balance']
          var result = updateUser(user, res)
          // console.log(result)
          // res.send({"msg": "Updated successfully"})
          // else res.send({"msg": "Something went wrong"})
        }
    }
  });
})

// app.get(path + hashKeyPath, function(req, res) {
//   var condition = {}
//   condition[partitionKeyName] = {
//     ComparisonOperator: 'EQ'
//   }

//   if (userIdPresent && req.apiGateway) {
//     condition[partitionKeyName]['AttributeValueList'] = [req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH ];
//   } else {
//     try {
//       condition[partitionKeyName]['AttributeValueList'] = [ convertUrlType(req.params[partitionKeyName], partitionKeyType) ];
//     } catch(err) {
//       res.statusCode = 500;
//       res.json({error: 'Wrong column type ' + err});
//     }
//   }

//   let queryParams = {
//     TableName: tableName,
//     KeyConditions: condition
//   }

//   dynamodb.query(queryParams, (err, data) => {
//     if (err) {
//       res.statusCode = 500;
//       res.json({error: 'Could not load items: ' + err});
//     } else {
//       res.json(data.Items);
//     }
//   });
// });

// /*****************************************
//  * HTTP Get method for get single object *
//  *****************************************/

// app.get(path + '/object' + hashKeyPath + sortKeyPath, function(req, res) {
//   var params = {};
//   if (userIdPresent && req.apiGateway) {
//     params[partitionKeyName] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
//   } else {
//     params[partitionKeyName] = req.params[partitionKeyName];
//     try {
//       params[partitionKeyName] = convertUrlType(req.params[partitionKeyName], partitionKeyType);
//     } catch(err) {
//       res.statusCode = 500;
//       res.json({error: 'Wrong column type ' + err});
//     }
//   }
//   if (hasSortKey) {
//     try {
//       params[sortKeyName] = convertUrlType(req.params[sortKeyName], sortKeyType);
//     } catch(err) {
//       res.statusCode = 500;
//       res.json({error: 'Wrong column type ' + err});
//     }
//   }

//   let getItemParams = {
//     TableName: tableName,
//     Key: params
//   }

//   dynamodb.get(getItemParams,(err, data) => {
//     if(err) {
//       res.statusCode = 500;
//       res.json({error: 'Could not load items: ' + err.message});
//     } else {
//       if (data.Item) {
//         res.json(data.Item);
//       } else {
//         res.json(data) ;
//       }
//     }
//   });
// });


// /************************************
// * HTTP put method for insert object *
// *************************************/

// app.put(path, function(req, res) {

//   if (userIdPresent) {
//     req.body['userId'] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
//   }

//   let putItemParams = {
//     TableName: tableName,
//     Item: req.body
//   }
//   dynamodb.put(putItemParams, (err, data) => {
//     if(err) {
//       res.statusCode = 500;
//       res.json({error: err, url: req.url, body: req.body});
//     } else{
//       res.json({success: 'put call succeed!', url: req.url, data: data})
//     }
//   });
// });

// /************************************
// * HTTP post method for insert object *
// *************************************/

// app.post(path, function(req, res) {

//   if (userIdPresent) {
//     req.body['userId'] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
//   }

//   let putItemParams = {
//     TableName: tableName,
//     Item: req.body
//   }
//   dynamodb.put(putItemParams, (err, data) => {
//     if(err) {
//       res.statusCode = 500;
//       res.json({error: err, url: req.url, body: req.body});
//     } else{
//       res.json({success: 'post call succeed!', url: req.url, data: data})
//     }
//   });
// });

// /**************************************
// * HTTP remove method to delete object *
// ***************************************/

// app.delete(path + '/object' + hashKeyPath + sortKeyPath, function(req, res) {
//   var params = {};
//   if (userIdPresent && req.apiGateway) {
//     params[partitionKeyName] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
//   } else {
//     params[partitionKeyName] = req.params[partitionKeyName];
//      try {
//       params[partitionKeyName] = convertUrlType(req.params[partitionKeyName], partitionKeyType);
//     } catch(err) {
//       res.statusCode = 500;
//       res.json({error: 'Wrong column type ' + err});
//     }
//   }
//   if (hasSortKey) {
//     try {
//       params[sortKeyName] = convertUrlType(req.params[sortKeyName], sortKeyType);
//     } catch(err) {
//       res.statusCode = 500;
//       res.json({error: 'Wrong column type ' + err});
//     }
//   }

//   let removeItemParams = {
//     TableName: tableName,
//     Key: params
//   }
//   dynamodb.delete(removeItemParams, (err, data)=> {
//     if(err) {
//       res.statusCode = 500;
//       res.json({error: err, url: req.url});
//     } else {
//       res.json({url: req.url, data: data});
//     }
//   });
// });
app.listen(3000, function() {
    console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
