import { DynamoDBStreamEvent } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import SNS, { PublishInput } from 'aws-sdk/clients/sns';
import { ILookupTableItemKeys } from './LookupTableItems';
import { LookupTableEventMessage } from './LookupTableEventMessage';

const snsClient = new SNS;

export const handle = async (event: DynamoDBStreamEvent): Promise<any> => {

    console.log(`event: ${JSON.stringify(event)}`);

    for (let index = 0; index < event.Records.length; index++) {
        
        const record = event.Records[index];

        if ((record.eventName !== undefined) 
            && (record.dynamodb !== undefined)
            && (record.dynamodb?.Keys !== undefined)) {
        
            const eventName = record.eventName;            
            
            const eventKeys = DynamoDB.Converter.unmarshall(record.dynamodb.Keys) as ILookupTableItemKeys;

            // const oldImage = 
            //     record.dynamodb.OldImage === undefined 
            //         ? undefined
            //         : DynamoDB.Converter.unmarshall(record.dynamodb.OldImage) as DatabaseItem;
            
            // const newImage = 
            //     record.dynamodb.NewImage === undefined
            //         ? undefined
            //         : DynamoDB.Converter.unmarshall(record.dynamodb.NewImage) as DatabaseItem;

            await processEventRecord(eventName, eventKeys/*, oldImage, newImage*/);
        }
    }    
};

async function processEventRecord(eventName: 'INSERT' | 'MODIFY' | 'REMOVE', eventKeys: ILookupTableItemKeys /*, 
    oldImage?: DatabaseItem, newImage?: DatabaseItem*/): Promise<void> {

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
}

