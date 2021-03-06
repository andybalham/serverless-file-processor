import { SNSMessage } from 'aws-lambda';
import { SQSEvent } from 'aws-lambda/trigger/sqs';

import * as LookupTable from './lookupTable';
import { FirmAuthorisationLookupTableItem, IsActiveMortgageFirmLookupTableItem } from './LookupTableItems';
import { PermissionsChangedEventMessage } from './PermissionsChangedEventMessage';

export const handle = async (event: SQSEvent): Promise<any> => {

    console.log(`event: ${JSON.stringify(event)}`);

    const firmReferenceSet = new Set<string>();

    for (const sqsEventRecord of event.Records) {

        const snsMessage: SNSMessage = JSON.parse(sqsEventRecord.body);

        console.log(`snsMessage: ${JSON.stringify(snsMessage)}`);

        const permissionsChangedEventMessage = JSON.parse(snsMessage.Message) as PermissionsChangedEventMessage;

        firmReferenceSet.add(permissionsChangedEventMessage.firmReference);
    }

    for (const firmReference of firmReferenceSet.keys()) {

        const isActiveMortgageFirm = await getIsActiveMortgageFirm(firmReference);

        const isActiveMortgageFirmLookupTableItem: IsActiveMortgageFirmLookupTableItem = {
            firmReference: firmReference,
            itemType: IsActiveMortgageFirmLookupTableItem.ItemType,
            isActiveMortgageFirm: isActiveMortgageFirm
        };

        console.log(`Putting isActiveMortgageFirmLookupTableItem: ${JSON.stringify(isActiveMortgageFirmLookupTableItem)}`);

        await LookupTable.putItems([isActiveMortgageFirmLookupTableItem]);        
    }
    
    console.log('Exiting');
};

async function getIsActiveMortgageFirm(firmReference: string): Promise<boolean> {

    const firmAuthorisation = await LookupTable.getFirmAuthorisation(firmReference);

    if (firmAuthorisation === undefined) {
        console.error((`No FirmAuthorisationLookupTableItem found for firmReference: ${firmReference}`));
        return false;
    }

    if (isAuthorisedMortgageFirm(firmAuthorisation)) {
        return true;
    }

    if (firmAuthorisation.currentAuthorisationStatusCode === 'Registered') {

        const registeredPrincipalFirmAuthorisation = 
            await LookupTable.getRegisteredPrincipalFirmAuthorisation(firmReference);

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