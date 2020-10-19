import readline from 'readline';
import { SQSEvent } from 'aws-lambda/trigger/sqs';
import { FileUpdateMessage } from './FileUpdateMessage';
import { FileType } from './FileType';
import { LookupTableItem, FirmAuthorisationLookupTableItem, AlternativeFirmNamesLookupTableItem, AlternativeFirmName, FirmPermissionsLookupTableItem, FirmPermission, FirmAppointedRepresentativeLookupTableItem, FirmPrincipalLookupTableItem } from './LookupTableItems';
import * as LookupTable from './lookupTable';
import dayjs from 'dayjs';
import S3, { GetObjectRequest } from 'aws-sdk/clients/s3';
import { parseLine } from './parsing';
import { Readable } from 'stream';

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

    const readerStream = s3Client.getObject(params).createReadStream();

    // TODO 12Sep20: How can we reject the message if we are not able to process it?

    const dataLineGroups = 
        await getDataLineGroups(updateMessage.lineGroupBlock.startLineKey, updateMessage.lineGroupBlock.endLineKey, readerStream);

    console.log(`dataLineGroups.length: ${dataLineGroups.length}`);
    
    let databaseItems = new Array<LookupTableItem>();

    for (const dataLines of dataLineGroups) {
        
        switch (fileType) {

        case FileType.FirmsMasterList:
            databaseItems = databaseItems.concat(getFirmsMasterListDatabaseItems(dataLines));
            break;
    
        case FileType.AlternativeFirmName:
            databaseItems = databaseItems.concat(databaseItems = getAlternativeFirmNameDatabaseItems(dataLines));
            break;
    
        case FileType.FirmPermission:
            databaseItems = databaseItems.concat(databaseItems = getFirmPermissionDatabaseItems(dataLines));
            break;
    
        case FileType.Appointment:
            databaseItems = databaseItems.concat(databaseItems = getAppointmentDatabaseItems(dataLines));
            break;
                
        default:
            throw new Error(`Unhandled file type: ${fileType}`);
        }
    }

    console.log(`databaseItems.length: ${databaseItems.length}`);

    return databaseItems;
}

function getAppointmentDatabaseItems(dataLines: string[]): Array<FirmAppointedRepresentativeLookupTableItem | FirmPrincipalLookupTableItem> {

    const dataValuesArray = dataLines.map(line => parseLine(line, 9));

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

function getFirmPermissionDatabaseItems(dataLines: string[]): FirmPermissionsLookupTableItem[] {

    const dataValuesArray = dataLines.map(line => parseLine(line, 8));

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

function getAlternativeFirmNameDatabaseItems(dataLines: string[]): AlternativeFirmNamesLookupTableItem[] {

    const dataValuesArray = dataLines.map(line => parseLine(line, 8));

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

function getFirmsMasterListDatabaseItems(dataLines: string[]): FirmAuthorisationLookupTableItem[] {

    const dataValuesArray = dataLines.map(line => parseLine(line, 29));

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

async function getDataLineGroups(startLineKey: string | null, endLineKey: string | null, readerStream: Readable): Promise<Array<Array<string>>> {

    const getLineKey = (lineParts: string[]): string | null => {        
        switch (fileType) {
        case FileType.Appointment:
        case FileType.FirmPermission:
            return `${lineParts[0]}|${lineParts[1]}`;
        default:
            return lineParts[0];
        }
    };

    let fileType: FileType | undefined = undefined;
    let currentLineKey: string | null = null;
    let currentLineGroup = new Array<string>();
    let lineNumber = 0;
    let isInRange = false;

    const dataLineGroups = Array<Array<string>>();

    const readFileAsync = new Promise(resolve => {

        const lineReader = readline
            .createInterface({
                input: readerStream,
                terminal: false
            });

        lineReader.on('line', async (line: string) => {

            lineNumber = lineNumber + 1;

            const lineParts = parseLine(line);

            if (lineParts[0] === 'Header') {
                fileType = lineParts[1] as FileType;
                return;                
            }

            if (lineParts[0] === 'Footer') {
                return;                
            }

            const lineKey = getLineKey(lineParts);

            if (lineKey === startLineKey) {
                isInRange = true;
            }

            if (!isInRange) {
                return;
            }

            if (lineKey === currentLineKey) {

                currentLineGroup.push(line);

            } else {

                if (currentLineGroup.length > 0) {
                    dataLineGroups.push(currentLineGroup);
                }

                currentLineKey = lineKey;    
                currentLineGroup = (lineKey !== endLineKey) ? [line] : [];

                if (lineKey === endLineKey) {
                    isInRange = false;
                }
            }
        });

        lineReader.on('close', async () => {

            console.log('closed');

            if (currentLineGroup.length > 0) {
                dataLineGroups.push(currentLineGroup);
            }

            resolve();
        });
    });

    try {
        await readFileAsync;
    }
    catch(err) {
        console.log('an error has occurred');
    }

    return dataLineGroups;
}