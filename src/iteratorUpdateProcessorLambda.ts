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

        /*
            AlternativeFirmNames
            `FirmPrincipal-${appointmentDataValues[1]}`
            `RegulatedActivityPermissions-${dataValuesArray[0][1]}`
        */

        const itemTypeMatch = 
            lookupTableEventMessage.itemType.match(
                /^(?<iteratorType>(FirmAuthorisation|AlternativeFirmNames|FirmPrincipal|RegulatedActivityPermissions))(-(?<sortKeySuffix>.*))?$/);

        if (itemTypeMatch === null) {
            throw new Error(`Cannot match itemType: ${lookupTableEventMessage.itemType}`);
        }

        // TODO 20Sep20: Assumes firmReference is always the same length, we also need to pad activity code as well

        const sortKey =
            itemTypeMatch.groups?.sortKeySuffix === undefined
                ? lookupTableEventMessage.firmReference
                : `${lookupTableEventMessage.firmReference}-${itemTypeMatch.groups?.sortKeySuffix}`;

        const params: any = {
            TableName: process.env.TARGET_TABLE_NAME,
            Item: {
                iteratorType: itemTypeMatch.groups?.iteratorType,
                sortKey: sortKey
            }
        };
    
        await dynamoDbClient.put(params).promise();
    }
    
    console.log('Exiting');
};

