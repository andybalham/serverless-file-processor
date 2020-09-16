import { SQSEvent } from 'aws-lambda/trigger/sqs';
import { UpdateMessage } from './UpdateMessage';
import { FileType } from './FileType';
import { DatabaseItem, FirmAuthorisationDatabaseItem, AlternativeFirmNamesDatabaseItem, AlternativeFirmName, FirmPermissionsDatabaseItem, FirmPermission, FirmPrincipalDatabaseItem, FirmAppointedRepresentativeDatabaseItem } from './DatabaseItems';
import DynamoDB from 'aws-sdk/clients/dynamodb';
import { parseLine } from './parsing';

export const handle = async (event: SQSEvent): Promise<any> => {

    console.log(`event: ${JSON.stringify(event)}`);

    for (let recordIndex = 0; recordIndex < event.Records.length; recordIndex++) {
        
        const sqsEventRecord = event.Records[recordIndex];

        const updateMessage: UpdateMessage = JSON.parse(sqsEventRecord.body);

        await processUpdateMessage(updateMessage, updateDatabase);

        console.log(`sqsEventRecord: ${JSON.stringify(sqsEventRecord)}`);
    }
    
    console.log('Exiting');
};

const dynamoDbClient = new DynamoDB.DocumentClient();

async function updateDatabase(databaseItems: DatabaseItem[]): Promise<void> {

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#transactWrite-property
    // https://www.alexdebrie.com/posts/dynamodb-transactions/
    // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html

    if (process.env.TARGET_TABLE_NAME === undefined) throw new Error('process.env.TARGET_TABLE_NAME === undefined');

    // TODO 16Sep20: Look to do this without a transaction when only ONE item

    const putItems = databaseItems.map(item => { 
        return {
            Put: {
                TableName: process.env.TARGET_TABLE_NAME ?? '',
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

export async function processUpdateMessage(updateMessage: UpdateMessage, updater: (databaseItems: DatabaseItem[]) => Promise<void>): Promise<void> {    
    const databaseItems = getDatabaseItems(updateMessage);
    await updater(databaseItems);
}

function getDatabaseItems(updateMessage: UpdateMessage): DatabaseItem[] {
    
    const fileType = updateMessage.headerLine.split('|')[1] as FileType;

    // TODO 12Sep20: How can we reject the message if we are not able to process it?

    let databaseItems: DatabaseItem[];

    switch (fileType) {

    case FileType.FirmsMasterList:
        databaseItems = getFirmsMasterListDatabaseItems(updateMessage);
        break;
    
    case FileType.AlternativeFirmName:
        databaseItems = getAlternativeFirmNameDatabaseItems(updateMessage);
        break;
    
    case FileType.FirmPermission:
        databaseItems = getFirmPermissionDatabaseItems(updateMessage);
        break;
    
    case FileType.Appointment:
        databaseItems = getAppointmentDatabaseItems(updateMessage);
        break;
                
    default:
        throw new Error(`Unhandled file type: ${fileType}`);
    }

    console.log(`${fileType},${JSON.stringify(databaseItems)}`);

    return databaseItems;
}

function getAppointmentDatabaseItems(updateMessage: UpdateMessage): Array<FirmPrincipalDatabaseItem | FirmAppointedRepresentativeDatabaseItem> {

    const dataValuesArray = updateMessage.dataLines.map(line => parseLine(line, 9));

    const appointmentDataValues = dataValuesArray[0];

    const firmAppointedRepresentative: FirmPrincipalDatabaseItem = {
        firmReference: appointmentDataValues[0],
        itemType: `FirmPrincipal-${appointmentDataValues[1]}`,
        principalFirmRef: appointmentDataValues[1],
        statusCode: appointmentDataValues[2],
        statusEffectiveDate: getDateItemValue(appointmentDataValues[3]),
    };

    firmAppointedRepresentative.itemHash = DatabaseItem.getItemHash(firmAppointedRepresentative);

    const firmPrincipal: FirmAppointedRepresentativeDatabaseItem = {
        firmReference: appointmentDataValues[1],
        itemType: `FirmAppointedRepresentative-${appointmentDataValues[0]}`,
        appointedRepresentativeFirmRef: appointmentDataValues[0],
        statusCode: firmAppointedRepresentative.statusCode,
        statusEffectiveDate: firmAppointedRepresentative.statusEffectiveDate,
    };

    firmPrincipal.itemHash = DatabaseItem.getItemHash(firmPrincipal);

    return [firmAppointedRepresentative, firmPrincipal];
}

function getFirmPermissionDatabaseItems(updateMessage: UpdateMessage): FirmPermissionsDatabaseItem[] {

    const dataValuesArray = updateMessage.dataLines.map(line => parseLine(line, 8));

    const getFirmPermissions = (dataValuesArray: string[][]): FirmPermission[] => 
        dataValuesArray.map(firmPermissionValues => {
            return {
                investmentTypeCode: getStringItemValue(firmPermissionValues[2]),
                customerTypeCode: getStringItemValue(firmPermissionValues[3]),
                statusCode: firmPermissionValues[4],
                effectiveDate: getDateItemValue(firmPermissionValues[5]),
            };
        });

    const firmPermissionsDatabaseItem: FirmPermissionsDatabaseItem = {
        firmReference: dataValuesArray[0][0],
        itemType: `RegulatedActivityPermissions-${dataValuesArray[0][1]}`,
        regulatedActivityCode: dataValuesArray[0][1],
        permissions: getFirmPermissions(dataValuesArray)
    };

    firmPermissionsDatabaseItem.itemHash = DatabaseItem.getItemHash(firmPermissionsDatabaseItem);

    return [firmPermissionsDatabaseItem];
}

function getAlternativeFirmNameDatabaseItems(updateMessage: UpdateMessage): AlternativeFirmNamesDatabaseItem[] {

    const dataValuesArray = updateMessage.dataLines.map(line => parseLine(line, 8));

    const getAlternativeNames = (dataValuesArray: string[][]): AlternativeFirmName[] => 
        dataValuesArray.map(alternativeNameValues => {
            return {
                name: alternativeNameValues[1],
                effectiveDate: getDateItemValue(alternativeNameValues[3]),
                endDate: getOptionalDateItemValue(alternativeNameValues[4]),
            };
        });

    const alternativeNamesDatabaseItem: AlternativeFirmNamesDatabaseItem = {
        firmReference: dataValuesArray[0][0],
        itemType: 'AlternativeFirmNames',
        names: getAlternativeNames(dataValuesArray)
    };

    alternativeNamesDatabaseItem.itemHash = DatabaseItem.getItemHash(alternativeNamesDatabaseItem);

    return [alternativeNamesDatabaseItem];
}

function getDateItemValue(dateString: string): string {    
    const formattedDateString = `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}`;
    return formattedDateString;
}

function getOptionalDateItemValue(dateString: string): string | undefined {
    return (dateString === '') ? undefined : getDateItemValue(dateString);
}

function getFirmsMasterListDatabaseItems(updateMessage: UpdateMessage): FirmAuthorisationDatabaseItem[] {

    const dataValuesArray = updateMessage.dataLines.map(line => parseLine(line, 29));

    const firmAuthorisationValues = dataValuesArray[0];

    const firmAuthorisationDatabaseItem: FirmAuthorisationDatabaseItem = {
        firmReference: firmAuthorisationValues[0],
        itemType: 'FirmAuthorisation',
        registeredFirmName: firmAuthorisationValues[1],
        addressLine1: getStringItemValue(firmAuthorisationValues[5]),
        addressLine2: getStringItemValue(firmAuthorisationValues[6]),
        addressLine3: getStringItemValue(firmAuthorisationValues[7]),
        addressLine4: getStringItemValue(firmAuthorisationValues[8]),
        addressLine5: getStringItemValue(firmAuthorisationValues[9]),
        addressLine6: getStringItemValue(firmAuthorisationValues[10]),
        postcodeIn: getStringItemValue(firmAuthorisationValues[11]),
        postcodeOut: getStringItemValue(firmAuthorisationValues[12]),
        currentAuthorisationStatusCode: firmAuthorisationValues[19],
    };

    firmAuthorisationDatabaseItem.itemHash = DatabaseItem.getItemHash(firmAuthorisationDatabaseItem);

    return [firmAuthorisationDatabaseItem];
}

function getStringItemValue(fileValue: string): string | undefined {
    return fileValue === '' ? undefined : fileValue;
}
