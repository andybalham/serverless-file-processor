import DynamoDB, { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { FirmAppointedRepresentativeLookupTableItem, FirmAuthorisationLookupTableItem, FirmPrincipalLookupTableItem, ILookupTableItem, LookupTableItem } from './LookupTableItems';

const dynamoDbClient = new DynamoDB.DocumentClient();

function tableName(): string {
    if (process.env.LOOKUP_TABLE_NAME === undefined) throw new Error('process.env.LOOKUP_TABLE_NAME === undefined');
    return process.env.LOOKUP_TABLE_NAME;
}

export async function putItems(databaseItems: LookupTableItem[]): Promise<void> {

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#transactWrite-property
    // https://www.alexdebrie.com/posts/dynamodb-transactions/
    // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html

    /*
    For optimistic locking:
    * Get the item
    * If the item exists then put with a condition and a version increment
    * If the item doesn't exist then put with a condition of ??? "attribute_not_exists(Id)"
    */

    // TODO 19Sep20: Avoid using transactions for single updates
    
    const batchGetParams: DocumentClient.BatchGetItemInput = { RequestItems: {}};
    batchGetParams.RequestItems[tableName()] = { 
        Keys: databaseItems.map(item => {
            return { firmReference: item.firmReference, itemType: item.itemType };
        }),
        AttributesToGet: [
            'firmReference', 'itemType', 'itemHash'
        ]
    };
    
    const batchGetResponse = await dynamoDbClient.batchGet(batchGetParams).promise();

    if (batchGetResponse.Responses === undefined) throw new Error('batchGetResponse.Responses === undefined');

    const tableResponses = batchGetResponse.Responses[tableName()];

    const currentItemHashes = new Map<string, string | undefined>();    
    tableResponses
        .forEach((item, index) => 
        {
            const itemHashKey = getItemHashKey(item as ILookupTableItem);
            currentItemHashes.set(itemHashKey, item.itemHash);
        });

    console.log(`currentItemHashes: ${JSON.stringify(Array.from(currentItemHashes.entries()))}`);
    
    databaseItems.forEach(item => LookupTableItem.setItemHash(item));

    const putItems = databaseItems.map(item => { 

        const currentItemHash = currentItemHashes.get(getItemHashKey(item));

        let putItem: any;
        if (currentItemHash === undefined) {
        
            putItem = {
                Put: {
                    TableName: tableName(),
                    Item: item,
                    ConditionExpression: 'attribute_not_exists(itemHash)',
                    ReturnValuesOnConditionCheckFailure: 'NONE'
                }
            };

        } else {

            putItem = {
                Put: {
                    TableName: tableName(),
                    Item: item,
                    ConditionExpression: 'itemHash = :currentItemHash',
                    ExpressionAttributeValues: { ':currentItemHash': currentItemHash},
                    ReturnValuesOnConditionCheckFailure: 'NONE'
                }
            };    
        }

        return putItem;
    });

    const params = {
        TransactItems: putItems
    };

    try {
        
        await dynamoDbClient.transactWrite(params).promise();

    } catch (error) {
        
        if (error instanceof Error) {            
            console.error(`error.message: ${error.message}`);
        } else {
            throw error;
        }
    }
    

    function getItemHashKey(item: ILookupTableItem): string {
        return `${item.firmReference}||${item.itemType}`;
    }
}

export async function getFirmAuthorisation(firmReference: string): Promise<FirmAuthorisationLookupTableItem | undefined> {

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
        await getFirmAuthorisation(firmAppointedRepresentativeLookupTableItem.principalFirmRef);

    return registeredPrincipalFirmAuthorisation;
}

export async function getFirmPrincipals(firmReference: string): Promise<FirmPrincipalLookupTableItem[]> {

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
