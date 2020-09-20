import { SNSMessage } from 'aws-lambda';
import { SQSEvent } from 'aws-lambda/trigger/sqs';
import DynamoDB from 'aws-sdk/clients/dynamodb';
import { LookupTableEventMessage } from './LookupTableEventMessage';

const dynamoDbClient = new DynamoDB.DocumentClient();

export const handle = async (event: SQSEvent): Promise<any> => {

    console.log(`event: ${JSON.stringify(event)}`);

    for (let recordIndex = 0; recordIndex < event.Records.length; recordIndex++) {
        
        const sqsEventRecord = event.Records[recordIndex];

        const snsMessage: SNSMessage = JSON.parse(sqsEventRecord.body);

        const lookupTableEventMessage: LookupTableEventMessage = JSON.parse(snsMessage.Message);

        console.log(`lookupTableEventMessage: ${JSON.stringify(lookupTableEventMessage)}`);

        if (lookupTableEventMessage.itemType === 'FirmAuthorisation') {
            
            const params: any = {
                TableName: process.env.TARGET_TABLE_NAME,
                Item: {
                    iteratorType: 'FirmAuthorisation',
                    sortKey: lookupTableEventMessage.firmReference
                }
            };
    
            await dynamoDbClient.put(params).promise();    
        }

        // TODO 20Sep20: Handle the other cases
    }
    
    console.log('Exiting');
};

