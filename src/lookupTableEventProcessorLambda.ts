import { DynamoDBStreamEvent } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import SNS, { PublishInput } from 'aws-sdk/clients/sns';
import { FirmAuthorisationLookupTableItem, ILookupTableItemKeys, LookupTableItem } from './LookupTableItems';
import { LookupTableEventMessage } from './LookupTableEventMessage';
import { PermissionsChangedEventMessage } from './PermissionsChangedEventMessage';

const snsClient = new SNS;
const dynamoDbClient = new DynamoDB.DocumentClient();

export const handle = async (event: DynamoDBStreamEvent): Promise<any> => {

    console.log(`event: ${JSON.stringify(event)}`);

    for (let index = 0; index < event.Records.length; index++) {
        
        const record = event.Records[index];

        if ((record.eventName !== undefined) 
            && (record.dynamodb !== undefined)
            && (record.dynamodb?.Keys !== undefined)) {
        
            const eventName = record.eventName;            
            
            const eventKeys = DynamoDB.Converter.unmarshall(record.dynamodb.Keys) as ILookupTableItemKeys;

            const oldImage = 
                record.dynamodb.OldImage === undefined 
                    ? undefined
                    : DynamoDB.Converter.unmarshall(record.dynamodb.OldImage) as LookupTableItem;
            
            const newImage = 
                record.dynamodb.NewImage === undefined
                    ? undefined
                    : DynamoDB.Converter.unmarshall(record.dynamodb.NewImage) as LookupTableItem;

            await processEventRecord(eventName, eventKeys, oldImage, newImage);
        }
    }    
};

async function processEventRecord(eventName: 'INSERT' | 'MODIFY' | 'REMOVE', eventKeys: ILookupTableItemKeys, 
    oldImage?: LookupTableItem, newImage?: LookupTableItem): Promise<void> {

    if (eventName === 'REMOVE') {
        // Ignore remove events
        return;
    }

    const eventMessage: LookupTableEventMessage = {
        eventName: eventName,
        firmReference: eventKeys.firmReference,
        itemType: eventKeys.itemType,
    };

    const publishInput: PublishInput = {
        Message: JSON.stringify(eventMessage),
        TopicArn: process.env.LOOKUP_TABLE_EVENT_TOPIC,
        MessageAttributes: {
            EventName: { DataType: 'String', StringValue: eventName },
            FirmReference: { DataType: 'String', StringValue: eventKeys.firmReference },
            ItemType: { DataType: 'String', StringValue: eventKeys.itemType },
        }
    };
    
    console.log(`publishInput: ${JSON.stringify(publishInput)}`);
    
    const publishResponse = await snsClient.publish(publishInput).promise();

    console.log(`publishResponse: ${JSON.stringify(publishResponse)}`);

    if (isPermissionChange(oldImage, newImage)) {
        await publishPermissionChangeEvents(eventKeys.firmReference);
    }
}

function isPermissionChange(oldImage?: LookupTableItem, newImage?: LookupTableItem): boolean {
    
    if (newImage?.itemType.startsWith('FirmAuthorisation')) {
        
        const newStatusCode = (newImage as FirmAuthorisationLookupTableItem)?.currentAuthorisationStatusCode;
        const oldStatusCode = (oldImage as FirmAuthorisationLookupTableItem)?.currentAuthorisationStatusCode;

        return (newStatusCode) !== (oldStatusCode);
    }

    if (newImage?.itemType.startsWith('FirmPrincipal-')
        || newImage?.itemType.startsWith('RegulatedActivityPermissions-')) {
        return true;
    }

    return false;
}

async function publishPermissionChangeEvents(firmReference: string): Promise<void> {

    await publishPermissionChangeEvent(firmReference);

    // TODO 03Oct20: We need to raise events for all appointed representatives

    const principal =
        await dynamoDbClient
            .query({
                TableName: process.env.LOOKUP_TABLE_NAME ?? '',
                KeyConditionExpression: 'firmReference = :firmReference and begins_with(itemType, :itemType)',
                ExpressionAttributeValues: {
                    ':firmReference': firmReference,
                    ':itemType': 'FirmPrincipal-'
                }
            })
            .promise();
    
    if (principal.Items !== undefined) {
        for (let index = 0; index < principal.Items.length; index++) {
            const principalItem = principal.Items[index];            
            await publishPermissionChangeEvent(principalItem.appointedRepresentativeFirmRef);
        }
    }
}

async function publishPermissionChangeEvent(firmReference: string): Promise<void> {

    const eventMessage: PermissionsChangedEventMessage = {
        firmReference: firmReference
    };

    const publishInput: PublishInput = {
        Message: JSON.stringify(eventMessage),
        TopicArn: process.env.PERMISSIONS_UPDATE_EVENT_TOPIC,
        MessageAttributes: {
            FirmReference: { DataType: 'String', StringValue: firmReference },
        }
    };

    console.log(`publishPermissionChangeInput: ${JSON.stringify(publishInput)}`);

    const publishResponse = await snsClient.publish(publishInput).promise();

    console.log(`publishPermissionChangeResponse: ${JSON.stringify(publishResponse)}`);
}

