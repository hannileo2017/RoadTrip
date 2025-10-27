const sql = require('mssql');

function sqlTypeForField(field, val) {
    switch (field) {
        case 'DriverID': return sql.NVarChar(50);
        case 'FullName':
        case 'UserName':
        case 'Phone':
        case 'Email':
        case 'VehicleType':
        case 'VehicleNumber':
        case 'LicenseNumber':
        case 'NationalID':
        case 'Address':
        case 'Status':
        case 'MaxLoad':
        case 'Model':
        case 'PhotoURL':
        case 'FCMToken':
        case 'NationalCardURL':
        case 'LicenseURL':
        case 'Notes':
            return sql.NVarChar(sql.MAX);
        case 'CityID':
        case 'AreaID':
            return sql.Int;
        case 'IsActive':
        case 'Available':
        case 'PhoneConfirmed':
            return sql.Bit;
        case 'Rating':
            return sql.Float;
        case 'CreatedAt':
        case 'LastUpdated':
        case 'LastLogin':
        case 'OTPExpires':
            return sql.DateTime;
        case 'Password':
            return sql.NVarChar(400);
        default:
            if (typeof val === 'number') return sql.Float;
            if (typeof val === 'boolean') return sql.Bit;
            return sql.NVarChar(sql.MAX);
    }
}

module.exports = sqlTypeForField;
