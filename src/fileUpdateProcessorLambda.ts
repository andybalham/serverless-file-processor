import { SQSEvent } from 'aws-lambda/trigger/sqs';
import { FileUpdateMessage } from './FileUpdateMessage';
import { FileType } from './FileType';
import { LookupTableItem, FirmAuthorisationLookupTableItem, AlternativeFirmNamesLookupTableItem, AlternativeFirmName, FirmPermissionsLookupTableItem, FirmPermission, FirmAppointedRepresentativeLookupTableItem, FirmPrincipalLookupTableItem } from './LookupTableItems';
import * as LookupTable from './lookupTable';
import dayjs from 'dayjs';
import S3, { GetObjectRequest } from 'aws-sdk/clients/s3';

export const handle = async (event: SQSEvent): Promise<any> => {

    console.log(`event: ${JSON.stringify(event)}`);

    for (let recordIndex = 0; recordIndex < event.Records.length; recordIndex++) {
        
        const sqsEventRecord = event.Records[recordIndex];

        console.log(`sqsEventRecord: ${JSON.stringify(sqsEventRecord)}`);

        const updateMessage: FileUpdateMessage = JSON.parse(sqsEventRecord.body);

        await processUpdateMessage(updateMessage, databaseItems => LookupTable.putItems(databaseItems));
    }
    
    console.log('Exiting');
};

export async function processUpdateMessage(updateMessage: FileUpdateMessage, updater: (databaseItems: LookupTableItem[]) => Promise<void>): Promise<void> {    
    const databaseItems = await getDatabaseItems(updateMessage);
    await updater(databaseItems);
}

const s3Client = new S3;

async function getDatabaseItems(updateMessage: FileUpdateMessage): Promise<LookupTableItem[]> {
    
    const fileType = updateMessage.fileType;

    const params: GetObjectRequest = {
        Bucket: updateMessage.fileBucket,
        Key: updateMessage.fileKey,
    };

    console.log(`params: ${JSON.stringify(params)}`);

    // const readerStream = s3Client.getObject(params).createReadStream();
    // const getObjectResult = 
    await s3Client.getObject(params).promise();

    console.log('getObject awaited');

    const earlyReturn = true; if (earlyReturn) return [];

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

    const dataValuesArray = []; //updateMessage.dataLines.map(line => parseLine(line, 9));

    const appointmentDataValues = dataValuesArray[0];

    const appointedRepresentativeFirmRef = appointmentDataValues[0];
    const principalFirmRef = appointmentDataValues[1];

    const firmAppointedRepresentative: FirmAppointedRepresentativeLookupTableItem = {
        firmReference: appointedRepresentativeFirmRef,
        itemType: FirmAppointedRepresentativeLookupTableItem.getItemType(principalFirmRef),
        principalFirmRef: principalFirmRef,
        statusCode: appointmentDataValues[2],
        statusEffectiveDate: getDateItemValue(appointmentDataValues[3], 'statusEffectiveDate'),
    };

    const firmPrincipal: FirmPrincipalLookupTableItem = {
        firmReference: principalFirmRef,
        itemType: FirmPrincipalLookupTableItem.getItemType(appointedRepresentativeFirmRef),
        appointedRepresentativeFirmRef: appointedRepresentativeFirmRef,
        statusCode: firmAppointedRepresentative.statusCode,
        statusEffectiveDate: firmAppointedRepresentative.statusEffectiveDate,
    };

    return [firmAppointedRepresentative, firmPrincipal];
}

function getFirmPermissionDatabaseItems(updateMessage: FileUpdateMessage): FirmPermissionsLookupTableItem[] {

    const dataValuesArray = []; //updateMessage.dataLines.map(line => parseLine(line, 8));

    const getFirmPermissions = (dataValuesArray: string[][]): FirmPermission[] => 
        dataValuesArray.map(firmPermissionValues => {
            return {
                investmentTypeCode: getStringItemValue(firmPermissionValues[2]),
                customerTypeCode: getStringItemValue(firmPermissionValues[3]),
                statusCode: firmPermissionValues[4],
                effectiveDate: getDateItemValue(firmPermissionValues[5], 'effectiveDate'),
            };
        });

    const firmPermissionsDatabaseItem: FirmPermissionsLookupTableItem = {
        firmReference: dataValuesArray[0][0],
        itemType: FirmPermissionsLookupTableItem.getItemType(dataValuesArray[0][1]),
        regulatedActivityCode: dataValuesArray[0][1],
        permissions: getFirmPermissions(dataValuesArray)
    };

    return [firmPermissionsDatabaseItem];
}

function getAlternativeFirmNameDatabaseItems(updateMessage: FileUpdateMessage): AlternativeFirmNamesLookupTableItem[] {

    const dataValuesArray = []; //updateMessage.dataLines.map(line => parseLine(line, 8));

    const getAlternativeNames = (dataValuesArray: string[][]): AlternativeFirmName[] => 
        dataValuesArray.map(alternativeNameValues => {
            return {
                name: alternativeNameValues[1],
                effectiveDate: getDateItemValue(alternativeNameValues[3], 'effectiveDate'),
                endDate: getOptionalDateItemValue(alternativeNameValues[4], 'endDate'),
            };
        });

    const alternativeNamesDatabaseItem: AlternativeFirmNamesLookupTableItem = {
        firmReference: dataValuesArray[0][0],
        itemType: AlternativeFirmNamesLookupTableItem.ItemType,
        names: getAlternativeNames(dataValuesArray)
    };

    return [alternativeNamesDatabaseItem];
}

function getDateItemValue(dateString: string, attributeName: string): string {

    const formattedDateString = `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}`;

    const dayJsDate = dayjs(formattedDateString);

    if (!dayJsDate.isValid()) {
        throw new Error(`The value for ${attributeName} could not be formatted as a date: ${dateString}`);
    }

    return dayJsDate.format('YYYY-MM-DD');
}

function getOptionalDateItemValue(dateString: string, attributeName: string): string | undefined {
    return (dateString === '') ? undefined : getDateItemValue(dateString, attributeName);
}

function getFirmsMasterListDatabaseItems(updateMessage: FileUpdateMessage): FirmAuthorisationLookupTableItem[] {

    const dataValuesArray = []; //updateMessage.dataLines.map(line => parseLine(line, 29));

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
        dateStatusLastChanged: getDateItemValue(firmAuthorisationValues[20], 'dateStatusLastChanged'),
    };

    return [firmAuthorisationDatabaseItem];
}

function getStringItemValue(fileValue: string): string | undefined {
    return fileValue === '' ? undefined : fileValue;
}

