# TODO

## Next

* Use events to keep an 'IsMortgageFirm' flag correct, i.e. on permission change, check if a principal, if so then update the ARs
  * Need to pick up changes to:
    * Firm authorisation (could be a DA, a principal or an AR)
    * Firm permissions (could be a DA or a principal)
    * Appointed Rep (could be new active or updated as inactive)

## Future

* For IsMortgageFirm updates, process batches of update events and filter out duplicates

* Implement DLQ for failed updates

* Change to read before update with optimistic locking of database items?

* Retrieve extra info from FCA API, i.e. website
  * Should this info be a separate db item?
  * We wouldn't want a separate event => infinite loop
  * How would we merge the db items in the API? E.g. FirmAuthorisation and FirmAuthorisation_Ext

* Add a priority update queue written to by GraphQL API
  * I.e. refresh permissions from the FCA

* Turn SNS events into SQS jobs:
  * Export to a new 'Iterator Table' and an AppSync query to get blocks from it

* Export to [Amazon Elasticsearch](https://docs.aws.amazon.com/elasticsearch-service/index.html) to do search by name and location
    * [Loading Streaming Data into Amazon ES from Amazon DynamoDB](https://docs.aws.amazon.com/elasticsearch-service/latest/developerguide/es-aws-integrations.html#es-aws-integrations-dynamodb-es)

* Add versioning to the database items (e.g. \_v0 or should that be v0\_, see [Sort Key Design](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-sort-keys.html))
  * Have a second table just for historical data

* Don't use transactions when only one update

* Try 1% of the volume

* Create a circuit-breaker Lambda, that switches off another Lambda based on some criteria

* GSI usage for iterating in a sorted manner
  * [Is there a DynamoDB max partition size of 10GB for a single partition key value?](https://stackoverflow.com/questions/40272600/is-there-a-dynamodb-max-partition-size-of-10gb-for-a-single-partition-key-value#40277185)
  * Perhaps a better solution would be to have a separate table

* Investigate [NoSQL Workbench for DynamoDB GUI Client](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/workbench.html)

* Look at local AppSync development
  * [Developing and testing GraphQL APIs, Storage and Functions with Amplify Framework Local Mocking features](https://aws.amazon.com/blogs/mobile/amplify-framework-local-mocking/)

## Done

* Store lambdas, schemas and resolvers in S3
  * https://adamtheautomator.com/upload-local-files-aws-s3-aws-cli/

* Add table and access policy to the SAM template
  * https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-iam-managedpolicy.html
  * https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-appsync-graphqlapi.html#cfn-appsync-graphqlapi-authenticationtype

* Add a basic AppSync API to the SAM template
  * [An example CloudFormation template for AWS AppSync](https://gist.github.com/adrianhall/50e9fdf08e7a7e52d3ab0f01467b72f7)

* Use transaction to update the principals / ARs
  * [Amazon DynamoDB Transactions: How It Works](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html)

* Use hash code to conditionally update the items
  * [Conditional Updates](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html#Expressions.ConditionExpressions.SimpleComparisons)

* Hook lambda to table updates and raise SNS events
  * [DynamoDB Streams and AWS Lambda Triggers](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.Lambda.html)
  * https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-dynamodb-table.html#cfn-dynamodb-table-streamspecification
