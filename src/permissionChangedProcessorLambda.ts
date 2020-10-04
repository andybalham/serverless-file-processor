import DynamoDB from 'aws-sdk/clients/dynamodb';
// import { SNSMessage } from 'aws-lambda';
// import { SQSEvent } from 'aws-lambda/trigger/sqs';

import { getFirmAuthorisationItem as getFirmAuthorisation, getRegisteredPrincipalFirmAuthorisation, putItems } from './lookupTable';
import { FirmAuthorisationLookupTableItem, IsActiveMortgageFirmLookupTableItem, LookupTableItem } from './LookupTableItems';

const dynamoDbClient = new DynamoDB.DocumentClient();

// export const handle = async (event: SQSEvent): Promise<any> => {
export const handle = async (event: any): Promise<any> => {

    console.log(`event: ${JSON.stringify(event)}`);

    // for (let recordIndex = 0; recordIndex < event.Records.length; recordIndex++) {
        
    //     const sqsEventRecord = event.Records[recordIndex];

    //     const snsMessage: SNSMessage = JSON.parse(sqsEventRecord.body);

    //     console.log(`snsMessage: ${JSON.stringify(snsMessage)}`);
    // }
    
    const isActiveMortgageFirmLookupTableItem: IsActiveMortgageFirmLookupTableItem = {
        firmReference: event.firmReference,
        itemType: IsActiveMortgageFirmLookupTableItem.ItemType,
        isActiveMortgageFirm: await isActiveMortgageFirm(event.firmReference)
    };

    isActiveMortgageFirmLookupTableItem.itemHash = LookupTableItem.getItemHash(isActiveMortgageFirmLookupTableItem);

    await putItems(dynamoDbClient, [isActiveMortgageFirmLookupTableItem]);

    console.log('Exiting');
};

async function isActiveMortgageFirm(firmReference: string): Promise<boolean> {

    const firmAuthorisation = await getFirmAuthorisation(dynamoDbClient, firmReference);

    if (firmAuthorisation === undefined) {
        throw new Error(`No FirmAuthorisationLookupTableItem found for firmReference: ${firmReference}`);
    }

    if (isAuthorisedMortgageFirm(firmAuthorisation)) {
        return true;
    }

    if (firmAuthorisation.currentAuthorisationStatusCode === 'Registered') {

        const registeredPrincipalFirmAuthorisation = 
            await getRegisteredPrincipalFirmAuthorisation(dynamoDbClient, firmReference);

        if (registeredPrincipalFirmAuthorisation === undefined) {
            return false;
        }

        if (isAuthorisedMortgageFirm(registeredPrincipalFirmAuthorisation)) {
            return true;
        }

        return false;
    }

    return false;
}

function isAuthorisedMortgageFirm(firmAuthorisation: FirmAuthorisationLookupTableItem): boolean {

    if ((firmAuthorisation.currentAuthorisationStatusCode === 'Authorised')
        || (firmAuthorisation.currentAuthorisationStatusCode === 'EEA Authorised')) {

        // TODO 04Oct20: Check the regulated activities 107, 108 and 109

        return true;
    }

    return false;
}