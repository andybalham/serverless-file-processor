import { SQSEvent } from 'aws-lambda/trigger/sqs';
import { FileUpdateMessage } from './FileUpdateMessage';
import { FileType } from './FileType';
import { LookupTableItem, FirmAuthorisationLookupTableItem, AlternativeFirmNamesLookupTableItem, AlternativeFirmName, FirmPermissionsLookupTableItem, FirmPermission, FirmAppointedRepresentativeLookupTableItem, FirmPrincipalLookupTableItem } from './LookupTableItems';
import DynamoDB from 'aws-sdk/clients/dynamodb';
import { parseLine } from './parsing';
import { putItems } from './lookupTable';

const dynamoDbClient = new DynamoDB.DocumentClient();

export const handle = async (event: SQSEvent): Promise<any> => {

    console.log(`event: ${JSON.stringify(event)}`);

    for (let recordIndex = 0; recordIndex < event.Records.length; recordIndex++) {
        
        const sqsEventRecord = event.Records[recordIndex];

        const updateMessage: FileUpdateMessage = JSON.parse(sqsEventRecord.body);

        await processUpdateMessage(
            updateMessage, databaseItems => putItems(dynamoDbClient, databaseItems));

        console.log(`sqsEventRecord: ${JSON.stringify(sqsEventRecord)}`);
    }
    
    console.log('Exiting');
};

export async function processUpdateMessage(updateMessage: FileUpdateMessage, updater: (databaseItems: LookupTableItem[]) => Promise<void>): Promise<void> {    
    const databaseItems = getDatabaseItems(updateMessage);
    await updater(databaseItems);
}

function getDatabaseItems(updateMessage: FileUpdateMessage): LookupTableItem[] {
    
    const fileType = updateMessage.headerLine.split('|')[1] as FileType;

    // TODO 12Sep20: How can we reject the message if we are not able to process it?

    let databaseItems: LookupTableItem[];

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

function getAppointmentDatabaseItems(updateMessage: FileUpdateMessage): Array<FirmAppointedRepresentativeLookupTableItem | FirmPrincipalLookupTableItem> {

    const dataValuesArray = updateMessage.dataLines.map(line => parseLine(line, 9));

    const appointmentDataValues = dataValuesArray[0];

    const appointedRepresentativeFirmRef = appointmentDataValues[0];
    const principalFirmRef = appointmentDataValues[1];

    const firmAppointedRepresentative: FirmAppointedRepresentativeLookupTableItem = {
        firmReference: appointedRepresentativeFirmRef,
        itemType: FirmAppointedRepresentativeLookupTableItem.getItemType(principalFirmRef),
        principalFirmRef: principalFirmRef,
        statusCode: appointmentDataValues[2],
        statusEffectiveDate: getDateItemValue(appointmentDataValues[3]),
    };

    firmAppointedRepresentative.itemHash = LookupTableItem.getItemHash(firmAppointedRepresentative);

    const firmPrincipal: FirmPrincipalLookupTableItem = {
        firmReference: principalFirmRef,
        itemType: FirmPrincipalLookupTableItem.getItemType(appointedRepresentativeFirmRef),
        appointedRepresentativeFirmRef: appointedRepresentativeFirmRef,
        statusCode: firmAppointedRepresentative.statusCode,
        statusEffectiveDate: firmAppointedRepresentative.statusEffectiveDate,
    };

    firmPrincipal.itemHash = LookupTableItem.getItemHash(firmPrincipal);

    return [firmAppointedRepresentative, firmPrincipal];
}

function getFirmPermissionDatabaseItems(updateMessage: FileUpdateMessage): FirmPermissionsLookupTableItem[] {

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

    const firmPermissionsDatabaseItem: FirmPermissionsLookupTableItem = {
        firmReference: dataValuesArray[0][0],
        itemType: FirmPermissionsLookupTableItem.getItemType(dataValuesArray[0][1]),
        regulatedActivityCode: dataValuesArray[0][1],
        permissions: getFirmPermissions(dataValuesArray)
    };

    firmPermissionsDatabaseItem.itemHash = LookupTableItem.getItemHash(firmPermissionsDatabaseItem);

    return [firmPermissionsDatabaseItem];
}

function getAlternativeFirmNameDatabaseItems(updateMessage: FileUpdateMessage): AlternativeFirmNamesLookupTableItem[] {

    const dataValuesArray = updateMessage.dataLines.map(line => parseLine(line, 8));

    const getAlternativeNames = (dataValuesArray: string[][]): AlternativeFirmName[] => 
        dataValuesArray.map(alternativeNameValues => {
            return {
                name: alternativeNameValues[1],
                effectiveDate: getDateItemValue(alternativeNameValues[3]),
                endDate: getOptionalDateItemValue(alternativeNameValues[4]),
            };
        });

    const alternativeNamesDatabaseItem: AlternativeFirmNamesLookupTableItem = {
        firmReference: dataValuesArray[0][0],
        itemType: AlternativeFirmNamesLookupTableItem.ItemType,
        names: getAlternativeNames(dataValuesArray)
    };

    alternativeNamesDatabaseItem.itemHash = LookupTableItem.getItemHash(alternativeNamesDatabaseItem);

    return [alternativeNamesDatabaseItem];
}

function getDateItemValue(dateString: string): string {    
    const formattedDateString = `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}`;
    return formattedDateString;
}

function getOptionalDateItemValue(dateString: string): string | undefined {
    return (dateString === '') ? undefined : getDateItemValue(dateString);
}

function getFirmsMasterListDatabaseItems(updateMessage: FileUpdateMessage): FirmAuthorisationLookupTableItem[] {

    const dataValuesArray = updateMessage.dataLines.map(line => parseLine(line, 29));

    const firmAuthorisationValues = dataValuesArray[0];

    const firmAuthorisationDatabaseItem: FirmAuthorisationLookupTableItem = {
        firmReference: firmAuthorisationValues[0],
        itemType: FirmAuthorisationLookupTableItem.ItemType,
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

    firmAuthorisationDatabaseItem.itemHash = LookupTableItem.getItemHash(firmAuthorisationDatabaseItem);

    return [firmAuthorisationDatabaseItem];
}

function getStringItemValue(fileValue: string): string | undefined {
    return fileValue === '' ? undefined : fileValue;
}
