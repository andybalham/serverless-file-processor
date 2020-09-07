export abstract class DatabaseItem {
    firmReference: string;
    itemType: string;    
}

export class FirmAuthorisationDatabaseItem extends DatabaseItem {
    registeredFirmName: string;
    addressLine1?: string;
    addressLine2?: string;
    addressLine3?: string;
    addressLine4?: string;
    addressLine5?: string;
    addressLine6?: string;
    postcodeIn?: string;
    postcodeOut?: string;
    currentAuthorisationStatusCode: string;
}

export class AlternativeFirmNamesDatabaseItem extends DatabaseItem {
    names: AlternativeFirmName[]
}

export class AlternativeFirmName {
    name: string;
    effectiveDate: string;
    endDate?: string;
}

export class FirmPermissionsDatabaseItem extends DatabaseItem {
    regulatedActivityCode: string;
    permissions: FirmPermission[]
}

export class FirmPermission {
    investmentTypeCode?: string;
    customerTypeCode?: string;
    statusCode: string;
    effectiveDate: string;
}

export class FirmAppointedRepresentativeDatabaseItem extends DatabaseItem {
    principalFirmRef: string;
    statusCode: string;
    statusEffectiveDate: string;
}

export class FirmPrincipalDatabaseItem extends DatabaseItem {
    appointedRepresentativeFirmRef: string;
    statusCode: string;
    statusEffectiveDate: string;
}
