import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { FirmAuthorisationLookupTableItem, LookupTableItem } from './LookupTableItems';

export async function putItems(dynamoDbClient: DocumentClient, databaseItems: LookupTableItem[]): Promise<void> {

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#transactWrite-property
    // https://www.alexdebrie.com/posts/dynamodb-transactions/
    // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html

    // TODO 19Sep20: Avoid using transactions for single updates
    
    const putItems = databaseItems.map(item => { 
        return {
            Put: {
                TableName: tableName(),
                Item: item,
                ConditionExpression: 'itemHash <> :itemHash',
                ExpressionAttributeValues: { ':itemHash': item.itemHash},
                ReturnValuesOnConditionCheckFailure: 'NONE'
            }
        };
    });

    const params = {
        TransactItems: putItems
    };

    try {
        
        await dynamoDbClient.transactWrite(params).promise();

    } catch (error) {
        
        if (error instanceof Error) {
            
            console.log(`error.message: ${error.message}`);

            if (!error.message.includes('ConditionalCheckFailed')) {
                console.error('TODO: How should we handle this error?');
                // throw error;
            }

        } else {
            throw error;
        }
    }
    
    // console.log(`databaseItems: ${JSON.stringify(databaseItems)}`);
}

export async function getFirmAuthorisationItem(dynamoDbClient: DocumentClient, firmReference: string): Promise<FirmAuthorisationLookupTableItem | undefined> {

    const itemOutput =
        await dynamoDbClient
            .get({
                TableName: tableName(),
                Key: {
                    firmReference: firmReference,
                    itemType: 'FirmAuthorisation'
                }
            })
            .promise();
    
    console.log(`itemOutput: ${JSON.stringify(itemOutput)}`);

    return itemOutput.Item === undefined 
        ? undefined 
        : itemOutput.Item as FirmAuthorisationLookupTableItem;
}

export async function getRegisteredPrincipalFirmAuthorisation(dynamoDbClient: DocumentClient, firmReference: string): Promise<FirmAuthorisationLookupTableItem | undefined> {

    // Find registered principal

    const appointedRepresentative =
        await dynamoDbClient
            .query({
                TableName: tableName(),
                KeyConditionExpression: 'firmReference = :firmReference and begins_with(itemType, :itemType)',
                FilterExpression: 'statusCode = :statusCode',
                ExpressionAttributeValues: {
                    ':firmReference': firmReference,
                    ':itemType': 'FirmAppointedRepresentative-',
                    ':statusCode': 'Registered'
                }
            })
            .promise();

    if ((appointedRepresentative.Items === undefined) || (appointedRepresentative.Items.length === 0)) {
        return undefined;
    }            

    // Load the principal firm authorisation

    const registeredPrincipalFirmAuthorisation = 
        await getFirmAuthorisationItem(dynamoDbClient, appointedRepresentative.Items[0].principalFirmRef);

    return registeredPrincipalFirmAuthorisation;
}

function tableName(): string {
    if (process.env.LOOKUP_TABLE_NAME === undefined) throw new Error('process.env.LOOKUP_TABLE_NAME === undefined');
    return process.env.LOOKUP_TABLE_NAME;
}
