# TODO

## Next

* Add table and access policy to the SAM template
  * https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-iam-managedpolicy.html
  * https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-appsync-graphqlapi.html#cfn-appsync-graphqlapi-authenticationtype

* Add a basic AppSync API to the SAM template
  * [An example CloudFormation template for AWS AppSync](https://gist.github.com/adrianhall/50e9fdf08e7a7e52d3ab0f01467b72f7)

## Future

* Use transaction to update the principals / ARs
  * [Amazon DynamoDB Transactions: How It Works](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html)
* Use hash code to conditionally update the items
  * [Conditional Updates](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html#Expressions.ConditionExpressions.SimpleComparisons)

* Add versioning to the database items (e.g. \_v0 or should that be v0\_, see [Sort Key Design](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-sort-keys.html))
* Implement optimistic locking of database items

* Raise SNS events from table updates
  * [DynamoDB Streams and AWS Lambda Triggers](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.Lambda.html)
* Turn SNS events into SQS jobs to:
  * Export to [Amazon Elasticsearch](https://docs.aws.amazon.com/elasticsearch-service/index.html) to do search by name and location
    * [Loading Streaming Data into Amazon ES from Amazon DynamoDB](https://docs.aws.amazon.com/elasticsearch-service/latest/developerguide/es-aws-integrations.html#es-aws-integrations-dynamodb-es)
  * Retrieve extra info from FCA API, i.e. website
    * Should this info be a separate db item?
    * We wouldn't want a separate event => infinite loop
    * How would we merge the db items in the API? E.g. FirmAuthorisation and FirmAuthorisation_Ext

* Add a priority update queue written to by GraphQL API
  * I.e. refresh permissions from the FCA

* Try 1% of the volume

* GSIs for iterating in a sorted manner
  * [Is there a DynamoDB max partition size of 10GB for a single partition key value?](https://stackoverflow.com/questions/40272600/is-there-a-dynamodb-max-partition-size-of-10gb-for-a-single-partition-key-value#40277185)
  * Perhaps a better solution would be to have a separate table

* Implement DLQ for failed updates

* Investigate [NoSQL Workbench for DynamoDB GUI Client](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/workbench.html)

* Look at local AppSync development
  * [Developing and testing GraphQL APIs, Storage and Functions with Amplify Framework Local Mocking features](https://aws.amazon.com/blogs/mobile/amplify-framework-local-mocking/)