/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_PAYMENTTABLE_ARN
	STORAGE_PAYMENTTABLE_NAME
	STORAGE_PAYMENTTABLE_STREAMARN
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



const AWS = require('aws-sdk')
var express = require('express')
var bodyParser = require('body-parser')
var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
AWS.config.update({ region: process.env.TABLE_REGION });

const dynamodb = new AWS.DynamoDB.DocumentClient();

let tableName = "UserTable";
if(process.env.ENV && process.env.ENV !== "NONE") {
  tableName = tableName + '-' + process.env.ENV;
}

const userIdPresent = false; // TODO: update in case is required to use that definition
const partitionKeyName = "email";
const partitionKeyType = "S";
const sortKeyName = "registration_date";
const sortKeyType = "S";
const hasSortKey = sortKeyName !== "";
const UNAUTH = 'UNAUTH';
const hashKeyPath = '/:' + partitionKeyName;


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
      "date": user['date']
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
        response.status(500).send(err)
    } else {
        console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
        response.send({"msg": "Updated successfully"})
    }
  });
}


/**********************
 * Example get method *
 **********************/

app.get('/userapi', function(req, res) {
  // Add your code here
  dynamodb.scan({TableName: tableName}, function(err, data) {
    if (err) {
        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
        res.status(500).send(err)
    } else {
        console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
        res.send(data['Items'])
    }
  });
});



app.get('/userapi/active', function(req, res) {
  // Add your code here
  var params = {
    TableName: tableName,
    IndexName: 'status_idx',
    KeyConditionExpression: "#active = :active",
    ExpressionAttributeNames:{
        "#active": "active"
    },
    ExpressionAttributeValues: {
        ":active": 1
    }
  }
  dynamodb.query(params, function(err, data) {
    if (err) {
        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
        res.status(500).send(err)
    } else {
        console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
        res.send(data['Items'])
    }
  });
});

app.get('/userapi/inactive', function(req, res) {
  // Add your code here
  var params = {
    TableName: tableName,
    IndexName: 'status_idx',
    KeyConditionExpression: "#active = :active",
    ExpressionAttributeNames:{
        "#active": "active"
    },
    ExpressionAttributeValues: {
        ":active": 0
    }
  }
  dynamodb.query(params, function(err, data) {
    if (err) {
        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
        res.status(500).send(err)
    } else {
        console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
        res.send(data['Items'])
    }
  });
});

app.get('/userapi/:email', function(req, res) {
  // Add your code here
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
        res.send(data['Items'][0])
    }
  });
});

/****************************
* Example post method *
****************************/

app.post('/userapi', function(req, res) {
  // Add your code here
  var params = {
    TableName: tableName,
    Item: req.body
  };
  dynamodb.put(params, function(err, data) {
     if (err) {
         console.error("Unable to add user", req.body.name, ". Error JSON:", JSON.stringify(err, null, 2));
         res.send(err)
     } else {
         res.status(201).send(req.body)
     }
  });
});

app.get('/userapi/:email/payment-fields', (req, res) => {
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

// app.post('/userapi/*', function(req, res) {
//   // Add your code here
//   res.json({success: 'post call succeed!', url: req.url, body: req.body})
// });

/****************************
* Example put method *
****************************/

app.put('/userapi/:email/activate', function(req, res) {
  // Add your code here
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
          user['active'] = 1
          var result = updateUser(user, res)
          // console.log(result)
          // res.send({"msg": "Activated successfully"})
          // else res.send({"msg": "Something went wrong"})
        }
    }
  });
});

app.put('/userapi/:email/deactivate', function(req, res) {
  // Add your code here
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
          user['active'] = 0
          var result = updateUser(user, res)
          // console.log(result)
          // res.send({"msg": "Deactivated successfully"})
          // else res.send({"msg": "Something went wrong"})
        }
    }
  });
});

// app.put('/userapi/*', function(req, res) {
//   // Add your code here
//   res.json({success: 'put call succeed!', url: req.url, body: req.body})
// });

/****************************
* Example delete method *
****************************/

app.delete('/userapi/:email', function(req, res) {
  // Add your code here
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
        var user = data['Items'][0]
        var paramsToDelete = {
          TableName: tableName,
          Key:{
            "email": user['email'],
            "registration_date": user['registration_date']
          }
          
        }
        dynamodb.delete(paramsToDelete, function(err, data) {
          if (err) {
              console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
              res.status(500).send(err);
          } else {
              console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
              res.send({"msg": "Deleted successfully"})
          }
        });
    }
  });
});

// app.delete('/userapi/*', function(req, res) {
//   // Add your code here
//   res.json({success: 'delete call succeed!', url: req.url});
// });

app.listen(3000, function() {
    console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
