import DynamoDB from 'aws-sdk/clients/dynamodb';
import { FirmAppointedRepresentativeLookupTableItem, FirmAuthorisationLookupTableItem, FirmPrincipalLookupTableItem, LookupTableItem } from './LookupTableItems';

const dynamoDbClient = new DynamoDB.DocumentClient();

function tableName(): string {
    if (process.env.LOOKUP_TABLE_NAME === undefined) throw new Error('process.env.LOOKUP_TABLE_NAME === undefined');
    return process.env.LOOKUP_TABLE_NAME;
}

export async function putLookupTableItems(databaseItems: LookupTableItem[]): Promise<void> {

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

export async function getFirmAuthorisationItem(firmReference: string): Promise<FirmAuthorisationLookupTableItem | undefined> {

    const itemOutput =
        await dynamoDbClient
            .get({
                TableName: tableName(),
                Key: {
                    firmReference: firmReference,
                    itemType: FirmAuthorisationLookupTableItem.ItemType
                }
            })
            .promise();
    
    console.log(`itemOutput: ${JSON.stringify(itemOutput)}`);

    return itemOutput.Item === undefined 
        ? undefined 
        : itemOutput.Item as FirmAuthorisationLookupTableItem;
}

export async function getRegisteredPrincipalFirmAuthorisation(firmReference: string): Promise<FirmAuthorisationLookupTableItem | undefined> {

    // Find registered principal

    const appointedRepresentative =
        await dynamoDbClient
            .query({
                TableName: tableName(),
                KeyConditionExpression: 'firmReference = :firmReference and begins_with(itemType, :itemType)',
                FilterExpression: 'statusCode = :statusCode',
                ExpressionAttributeValues: {
                    ':firmReference': firmReference,
                    ':itemType': FirmAppointedRepresentativeLookupTableItem.ItemTypePrefix,
                    ':statusCode': 'Registered'
                }
            })
            .promise();

    if ((appointedRepresentative.Items === undefined) || (appointedRepresentative.Items.length === 0)) {
        return undefined;
    }            

    // Load the principal firm authorisation

    const firmAppointedRepresentativeLookupTableItem = appointedRepresentative.Items[0] as FirmAppointedRepresentativeLookupTableItem;

    const registeredPrincipalFirmAuthorisation = 
        await getFirmAuthorisationItem(firmAppointedRepresentativeLookupTableItem.principalFirmRef);

    return registeredPrincipalFirmAuthorisation;
}

export async function getFirmPrincipalLookupTableItems(firmReference: string): Promise<FirmPrincipalLookupTableItem[]> {

    const principalQueryOutput =
        await dynamoDbClient
            .query({
                TableName: process.env.LOOKUP_TABLE_NAME ?? '',
                KeyConditionExpression: 'firmReference = :firmReference and begins_with(itemType, :itemType)',
                ExpressionAttributeValues: {
                    ':firmReference': firmReference,
                    ':itemType': FirmPrincipalLookupTableItem.ItemTypePrefix
                }
            })
            .promise();

    console.log(`principalQueryOutput.Items?.length: ${principalQueryOutput.Items?.length}`);
    
    if (principalQueryOutput.Items === undefined) {
        return [];
    }

    return principalQueryOutput.Items.map(i => i as FirmPrincipalLookupTableItem);
}
