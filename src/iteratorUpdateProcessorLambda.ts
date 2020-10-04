import { SNSMessage } from 'aws-lambda';
import { SQSEvent } from 'aws-lambda/trigger/sqs';
import DynamoDB from 'aws-sdk/clients/dynamodb';
import { interactiveDebug } from './debugUtils';
import { LookupTableEventMessage } from './LookupTableEventMessage';

const dynamoDbClient = new DynamoDB.DocumentClient();

export const handle = async (event: SQSEvent): Promise<any> => {

    console.log(`event: ${JSON.stringify(event)}`);

    for (let recordIndex = 0; recordIndex < event.Records.length; recordIndex++) {
        
        const sqsEventRecord = event.Records[recordIndex];

        const snsMessage: SNSMessage = JSON.parse(sqsEventRecord.body);

        const lookupTableEventMessage: LookupTableEventMessage = JSON.parse(snsMessage.Message);

        console.log(`lookupTableEventMessage: ${JSON.stringify(lookupTableEventMessage)}`);

        const itemTypeMatch = 
            lookupTableEventMessage.itemType.match(
                /^(?<iteratorType>(FirmAuthorisation|AlternativeFirmNames|FirmPrincipal|RegulatedActivityPermissions))(-(?<sortKeySuffix>.*))?$/);

        if (itemTypeMatch === null) {
            console.log(`Skipping itemType: ${lookupTableEventMessage.itemType}`);
            return;
        }

        const iteratorType = itemTypeMatch.groups?.iteratorType;
        const sortKeySuffix = itemTypeMatch.groups?.sortKeySuffix;

        const sortKey =
            sortKeySuffix === undefined
                ? lookupTableEventMessage.firmReference
                : `${lookupTableEventMessage.firmReference}-${(sortKeySuffix ?? 'undefined').padStart(6, '0')}`;

        const putParams: any = {
            TableName: process.env.LOOKUP_TABLE_NAME,
            Item: {
                iteratorType: iteratorType,
                sortKey: sortKey
            }
        };

        interactiveDebug(() => `putParams=${JSON.stringify(putParams)}`);
    
        await dynamoDbClient.put(putParams).promise();
    }
    
    console.log('Exiting');
};
